import { useCallback, useRef, useState } from "react";
import { formatLensContent } from "@/models/metacanonLibrary";
import showToast from "@/utils/toast";

const ACCEPTED_TYPES = new Set(["text/plain", "text/markdown"]);
const ACCEPTED_EXTENSIONS = new Set([".txt", ".md"]);

function isAcceptedFile(file) {
  if (ACCEPTED_TYPES.has(file.type)) return true;
  const lower = file.name.toLowerCase();
  return [...ACCEPTED_EXTENSIONS].some((ext) => lower.endsWith(ext));
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file, "utf-8");
  });
}

/**
 * CustomLensCreatorPanel
 *
 * A form for creating a new PCL lens from raw text or an uploaded file.
 * The Auto-Format button sends the raw content to the server LLM and
 * returns a formatted PCL markdown document for review in the preview modal.
 *
 * Props:
 *   onRequestPreview({ title, rawContent, formattedContent }) — called when
 *     auto-format completes successfully. The parent opens the preview modal.
 */
export default function CustomLensCreatorPanel({ onRequestPreview }) {
  const [title, setTitle] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [formatting, setFormatting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const appendFileContent = useCallback(async (file) => {
    if (!isAcceptedFile(file)) {
      showToast(
        `${file.name} is not supported. Upload .txt or .md files only.`,
        "warning"
      );
      return;
    }

    try {
      const text = await readFileAsText(file);
      setRawContent((current) => {
        const separator = current.trim() ? "\n\n" : "";
        return current + separator + text.trim();
      });
      showToast(`${file.name} loaded into the editor.`, "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  }, []);

  const handleFileChange = useCallback(
    async (event) => {
      const files = Array.from(event.target.files || []);
      for (const file of files) await appendFileContent(file);
      // Reset so the same file can be re-selected later.
      event.target.value = "";
    },
    [appendFileContent]
  );

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (event) => {
      event.preventDefault();
      setDragOver(false);
      const files = Array.from(event.dataTransfer.files || []);
      for (const file of files) await appendFileContent(file);
    },
    [appendFileContent]
  );

  const handleAutoFormat = useCallback(async () => {
    const content = rawContent.trim();
    if (!content) {
      showToast("Add some raw lens content before formatting.", "warning");
      return;
    }

    if (content.length > 30000) {
      showToast(
        "Content exceeds 30,000 characters. Trim it before formatting.",
        "warning"
      );
      return;
    }

    setFormatting(true);
    try {
      const result = await formatLensContent({
        rawContent: content,
        title: title.trim(),
      });

      if (!result?.formatted) {
        throw new Error("Server returned an empty formatted result.");
      }

      onRequestPreview?.({
        title: title.trim(),
        rawContent: content,
        formattedContent: result.formatted,
      });
    } catch (error) {
      showToast(
        error.message || "Auto-format failed. Try again.",
        "error"
      );
    } finally {
      setFormatting(false);
    }
  }, [rawContent, title, onRequestPreview]);

  const handlePreviewRaw = useCallback(() => {
    const content = rawContent.trim();
    if (!content) {
      showToast("Add some raw lens content before previewing.", "warning");
      return;
    }
    onRequestPreview?.({
      title: title.trim(),
      rawContent: content,
      formattedContent: content,
    });
  }, [rawContent, title, onRequestPreview]);

  return (
    <div className="prism-composer-save prism-page-panel flex flex-col gap-5">
      <div className="prism-composer-panel-header">
        <div>
          <div className="prism-composer-panel-eyebrow">New Lens</div>
          <div className="prism-composer-panel-title">Create from Raw Text</div>
        </div>
        <div className="prism-composer-panel-note">
          Type, paste, or upload a .txt / .md file. Hit Auto-Format to have the
          LLM structure it into a PCL lens.
        </div>
      </div>

      {/* Lens title */}
      <label className="flex flex-col gap-1.5 text-xs text-theme-text-secondary">
        Lens name (optional — will be inferred if blank)
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. The Risk Analyst"
          className="rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-2.5 text-sm text-theme-text-primary outline-none focus:border-theme-primary-button"
        />
      </label>

      {/* Raw content textarea */}
      <label className="flex flex-col gap-1.5 text-xs text-theme-text-secondary">
        Raw lens content
        <textarea
          value={rawContent}
          onChange={(e) => setRawContent(e.target.value)}
          placeholder="Describe the lens persona, role, domain expertise, behaviors, and constraints. You can type freely or paste from another document. Uploaded file content will appear here."
          rows={12}
          className="min-h-[220px] rounded-[18px] border border-theme-sidebar-border bg-theme-bg-primary px-4 py-3 text-sm leading-7 text-theme-text-primary outline-none focus:border-theme-primary-button"
        />
        <span className="text-right text-[11px] text-theme-text-secondary">
          {rawContent.length.toLocaleString()} / 30,000 chars
        </span>
      </label>

      {/* File upload drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a .txt or .md file"
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-dashed px-4 py-6 text-center transition-colors duration-150 ${
          dragOver
            ? "border-theme-primary-button bg-theme-primary-button/10"
            : "border-theme-sidebar-border bg-theme-bg-primary hover:border-theme-primary-button/60"
        }`}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="text-sm font-medium text-theme-text-primary">
          Drop a file here or click to browse
        </div>
        <div className="text-xs text-theme-text-secondary">
          .txt and .md supported — content appends to the editor above
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          multiple
          className="hidden"
          onChange={handleFileChange}
          aria-hidden="true"
        />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="prism-composer-action"
          onClick={handleAutoFormat}
          disabled={formatting || !rawContent.trim()}
        >
          {formatting ? "Formatting..." : "Auto-Format"}
        </button>
        <button
          type="button"
          className="prism-composer-action is-secondary"
          onClick={handlePreviewRaw}
          disabled={formatting || !rawContent.trim()}
        >
          Preview as-is
        </button>
        {rawContent ? (
          <button
            type="button"
            className="prism-composer-inline-action ml-auto"
            onClick={() => {
              setRawContent("");
              setTitle("");
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
