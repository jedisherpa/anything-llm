import React, { useState } from "react";
import { saveAs } from "file-saver";
import { DownloadSimple } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { SlidersHorizontal } from "@phosphor-icons/react/dist/csr/SlidersHorizontal";
import { Database } from "@phosphor-icons/react/dist/csr/Database";
import Workspace from "@/models/workspace";
import showToast from "@/utils/toast";
import DeliberationViewerModal from "@/components/Metacanon/DeliberationViewerModal";

/**
 * Renders the three deliberation action buttons (Save, View, Embed) below an
 * assistant message that carries deliberation data from a multi-lens run.
 *
 * @param {{ deliberationData: object, workspaceSlug: string }} props
 */
export default function DeliberationActions({ deliberationData, workspaceSlug }) {
  const [showViewer, setShowViewer] = useState(false);
  const [embedding, setEmbedding] = useState(false);

  if (!deliberationData) return null;

  function handleSave() {
    const md = deliberationData.markdownContent;
    if (!md) return;
    const ts = deliberationData.timestamp
      ? new Date(deliberationData.timestamp)
          .toISOString()
          .replace(/[:.]/g, "-")
          .slice(0, 19)
      : Date.now();
    const filename = `deliberation-${ts}.md`;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    saveAs(blob, filename);
  }

  async function handleEmbed() {
    if (!workspaceSlug || embedding) return;
    const md = deliberationData.markdownContent;
    if (!md) return;

    setEmbedding(true);
    try {
      const ts = deliberationData.timestamp
        ? new Date(deliberationData.timestamp)
            .toISOString()
            .replace(/[:.]/g, "-")
            .slice(0, 19)
        : Date.now();
      const filename = `deliberation-${ts}.md`;
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

  return (
    <>
      <div className="flex items-center gap-x-1 mt-2">
        <button
          type="button"
          onClick={handleSave}
          title="Save deliberation as .md"
          className="flex items-center gap-x-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-theme-text-secondary border border-white/10 light:border-slate-200 hover:bg-white/5 light:hover:bg-slate-100 transition"
        >
          <DownloadSimple size={13} />
          Save
        </button>

        <button
          type="button"
          onClick={() => setShowViewer(true)}
          title="View lens outputs"
          className="flex items-center gap-x-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-theme-text-secondary border border-white/10 light:border-slate-200 hover:bg-white/5 light:hover:bg-slate-100 transition"
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
            className="flex items-center gap-x-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-theme-text-secondary border border-white/10 light:border-slate-200 hover:bg-white/5 light:hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
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
          onSave={handleSave}
        />
      )}
    </>
  );
}
