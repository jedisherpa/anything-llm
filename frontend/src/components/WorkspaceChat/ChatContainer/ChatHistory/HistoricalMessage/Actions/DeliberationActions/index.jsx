import React, { useState, useRef, useEffect } from "react";
import { saveAs } from "file-saver";
import { DownloadSimple } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { CaretDown } from "@phosphor-icons/react/dist/csr/CaretDown";
import { SlidersHorizontal } from "@phosphor-icons/react/dist/csr/SlidersHorizontal";
import { Database } from "@phosphor-icons/react/dist/csr/Database";
import Workspace from "@/models/workspace";
import showToast from "@/utils/toast";
import DeliberationViewerModal from "@/components/Metacanon/DeliberationViewerModal";

/**
 * Build a filename base from deliberationData (no extension).
 */
function buildFilenameBase(deliberationData) {
  const ts = deliberationData.timestamp
    ? new Date(deliberationData.timestamp)
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19)
    : Date.now();
  return `deliberation-${ts}`;
}

/**
 * Save deliberation as Markdown (.md).
 */
function saveMarkdown(deliberationData) {
  const md = deliberationData.markdownContent;
  if (!md) return;
  const filename = `${buildFilenameBase(deliberationData)}.md`;
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  saveAs(blob, filename);
}

/**
 * Save deliberation as Word document (.docx).
 * Uses dynamic import to keep initial bundle small.
 */
async function saveDocx(deliberationData) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import(
    "docx"
  );

  const children = [];

  // Title
  children.push(
    new Paragraph({
      text: `Deliberation: ${deliberationData.label || deliberationData.type || "Lens Deliberation"}`,
      heading: HeadingLevel.HEADING_1,
    })
  );

  // Metadata
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Date: ", bold: true }),
        new TextRun(deliberationData.timestamp || ""),
      ],
    })
  );
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Type: ", bold: true }),
        new TextRun(deliberationData.type || ""),
      ],
    })
  );
  children.push(new Paragraph({ text: "" }));

  // User query
  children.push(
    new Paragraph({ text: "User Query", heading: HeadingLevel.HEADING_2 })
  );
  children.push(new Paragraph({ text: deliberationData.query || "(no query)" }));
  children.push(new Paragraph({ text: "" }));

  // Lens outputs
  for (const lens of deliberationData.lensOutputs ?? []) {
    children.push(
      new Paragraph({ text: lens.label || lens.handle, heading: HeadingLevel.HEADING_2 })
    );
    // Split on newlines to preserve paragraph structure
    const paragraphs = (lens.content || "(no output)").split(/\n+/);
    for (const para of paragraphs) {
      children.push(new Paragraph({ text: para }));
    }
    children.push(new Paragraph({ text: "" }));
  }

  // Synthesis
  const synthLabel = deliberationData.synthesis?.label || "Prism";
  children.push(
    new Paragraph({
      text: `Synthesis (${synthLabel})`,
      heading: HeadingLevel.HEADING_2,
    })
  );
  const synthParagraphs = (
    deliberationData.synthesis?.content || "(no synthesis)"
  ).split(/\n+/);
  for (const para of synthParagraphs) {
    children.push(new Paragraph({ text: para }));
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const buffer = await Packer.toBlob(doc);
  const filename = `${buildFilenameBase(deliberationData)}.docx`;
  saveAs(buffer, filename);
}

/**
 * Save deliberation as PDF (.pdf).
 * Uses dynamic import to keep initial bundle small.
 * Renders title, then each lens as a section, then synthesis.
 */
async function savePdf(deliberationData) {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const marginLeft = 15;
  const marginRight = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const usableWidth = pageWidth - marginLeft - marginRight;
  let y = 20;
  const lineHeight = 6;
  const sectionGap = 8;

  function checkPageBreak(needed = lineHeight) {
    if (y + needed > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      y = 20;
    }
  }

  function addHeading1(text) {
    checkPageBreak(10);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    const lines = doc.splitTextToSize(text, usableWidth);
    doc.text(lines, marginLeft, y);
    y += lines.length * 8 + 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
  }

  function addHeading2(text) {
    checkPageBreak(9);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    const lines = doc.splitTextToSize(text, usableWidth);
    doc.text(lines, marginLeft, y);
    y += lines.length * 7 + 3;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
  }

  function addBodyText(text) {
    const lines = doc.splitTextToSize(text || "", usableWidth);
    for (const line of lines) {
      checkPageBreak(lineHeight);
      doc.text(line, marginLeft, y);
      y += lineHeight;
    }
  }

  function addSeparator() {
    checkPageBreak(4);
    doc.setDrawColor(180, 180, 180);
    doc.line(marginLeft, y, pageWidth - marginRight, y);
    y += 4;
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");

  addHeading1(
    `Deliberation: ${deliberationData.label || deliberationData.type || "Lens Deliberation"}`
  );
  addBodyText(`Date: ${deliberationData.timestamp || ""}`);
  addBodyText(`Type: ${deliberationData.type || ""}`);
  y += 4;

  addSeparator();
  addHeading2("User Query");
  addBodyText(deliberationData.query || "(no query)");
  y += sectionGap;

  for (const lens of deliberationData.lensOutputs ?? []) {
    addSeparator();
    addHeading2(lens.label || lens.handle);
    addBodyText(lens.content || "(no output)");
    y += sectionGap;
  }

  addSeparator();
  const synthLabel = deliberationData.synthesis?.label || "Prism";
  addHeading2(`Synthesis (${synthLabel})`);
  addBodyText(deliberationData.synthesis?.content || "(no synthesis)");

  const filename = `${buildFilenameBase(deliberationData)}.pdf`;
  doc.save(filename);
}

/**
 * Renders the three deliberation action buttons (Save ▼, View, Embed) below an
 * assistant message that carries deliberation data from a multi-lens run.
 *
 * The Save button is a dropdown offering MD (default), DOCX, and PDF export.
 *
 * @param {{ deliberationData: object, workspaceSlug: string }} props
 */
export default function DeliberationActions({ deliberationData, workspaceSlug }) {
  const [showViewer, setShowViewer] = useState(false);
  const [embedding, setEmbedding] = useState(false);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [saving, setSaving] = useState(null); // "md" | "docx" | "pdf" | null
  const menuRef = useRef(null);

  if (!deliberationData) return null;

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!saveMenuOpen) return;
    function handleOutsideClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setSaveMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [saveMenuOpen]);

  async function handleSaveFormat(format) {
    setSaveMenuOpen(false);
    if (saving) return;
    setSaving(format);
    try {
      if (format === "md") {
        saveMarkdown(deliberationData);
      } else if (format === "docx") {
        await saveDocx(deliberationData);
      } else if (format === "pdf") {
        await savePdf(deliberationData);
      }
    } catch (err) {
      showToast(`Export failed: ${err.message}`, "error");
    } finally {
      setSaving(null);
    }
  }

  async function handleEmbed() {
    if (!workspaceSlug || embedding) return;
    const md = deliberationData.markdownContent;
    if (!md) return;

    setEmbedding(true);
    try {
      const filename = `${buildFilenameBase(deliberationData)}.md`;
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const formData = new FormData();
      formData.append("file", blob, filename);

      const { response, data } = await Workspace.uploadAndEmbedFile(
        workspaceSlug,
        formData
      );
      if (response.ok && data?.success) {
        showToast("Deliberation embedded into workspace.", "success");
      } else {
        showToast(data?.error || "Embed failed.", "error");
      }
    } catch (err) {
      showToast("Embed failed: " + err.message, "error");
    } finally {
      setEmbedding(false);
    }
  }

  const buttonClass =
    "flex items-center gap-x-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-theme-text-secondary border border-white/10 light:border-slate-200 hover:bg-white/5 light:hover:bg-slate-100 transition";

  return (
    <>
      <div className="flex items-center gap-x-1 mt-2">
        {/* Save dropdown */}
        <div className="relative" ref={menuRef}>
          <div className="flex items-center rounded-full border border-white/10 light:border-slate-200 overflow-hidden">
            {/* Primary Save button — defaults to MD */}
            <button
              type="button"
              onClick={() => handleSaveFormat("md")}
              disabled={!!saving}
              title="Save deliberation as .md"
              className="flex items-center gap-x-1 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-theme-text-secondary hover:bg-white/5 light:hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <DownloadSimple size={13} />
              {saving ? `${saving.toUpperCase()}…` : "Save"}
            </button>
            {/* Caret toggle */}
            <button
              type="button"
              onClick={() => setSaveMenuOpen((v) => !v)}
              disabled={!!saving}
              title="More export formats"
              aria-label="More export formats"
              className="flex items-center px-1.5 py-1 text-theme-text-secondary border-l border-white/10 light:border-slate-200 hover:bg-white/5 light:hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CaretDown
                size={10}
                className={`transform transition-transform duration-150 ${saveMenuOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {saveMenuOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 min-w-[100px] rounded-lg border border-white/10 light:border-slate-200 bg-theme-bg-secondary light:bg-white shadow-lg py-1">
              {[
                { format: "md", label: "MD (Markdown)" },
                { format: "docx", label: "DOCX (Word)" },
                { format: "pdf", label: "PDF" },
              ].map(({ format, label }) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => handleSaveFormat(format)}
                  className="w-full text-left px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-theme-text-secondary hover:bg-white/5 light:hover:bg-slate-100 transition"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowViewer(true)}
          title="View lens outputs"
          className={buttonClass}
        >
          <SlidersHorizontal size={13} />
          View
        </button>

        {workspaceSlug && (
          <button
            type="button"
            onClick={handleEmbed}
            disabled={embedding}
            title="Embed deliberation into workspace vector DB"
            className={`${buttonClass} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <Database size={13} />
            {embedding ? "Embedding…" : "Embed"}
          </button>
        )}
      </div>

      {showViewer && (
        <DeliberationViewerModal
          deliberationData={deliberationData}
          onClose={() => setShowViewer(false)}
          onSave={() => saveMarkdown(deliberationData)}
        />
      )}
    </>
  );
}
