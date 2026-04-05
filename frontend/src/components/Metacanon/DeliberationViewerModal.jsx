import React, { useState } from "react";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { DownloadSimple } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import renderMarkdown from "@/utils/chat/markdown";
import DOMPurify from "@/utils/chat/purify";

/**
 * DeliberationViewerModal
 *
 * A modal with a left sidebar listing lens names and a main content area
 * showing the selected lens's full response.
 *
 * Props:
 *   deliberationData {object} — the deliberation payload from the server
 *   onClose {function}
 *   onSave {function} — triggers the .md file download
 */
export default function DeliberationViewerModal({
  deliberationData,
  onClose,
  onSave,
}) {
  const lenses = deliberationData?.lensOutputs ?? [];
  const synthesis = deliberationData?.synthesis ?? null;

  // Sidebar entries: all lenses + synthesis at the bottom
  const sidebarItems = [
    ...lenses.map((l, idx) => ({ key: `lens-${idx}`, label: l.label, content: l.content })),
    synthesis
      ? {
          key: "synthesis",
          label: `Synthesis (${synthesis.label || "Prism"})`,
          content: synthesis.content,
        }
      : null,
  ].filter(Boolean);

  const [selectedKey, setSelectedKey] = useState(
    sidebarItems.length > 0 ? sidebarItems[0].key : null
  );

  const selectedItem = sidebarItems.find((item) => item.key === selectedKey);

  const typeLabel =
    deliberationData?.type === "council-pack"
      ? "Council Pack"
      : deliberationData?.type === "constellation"
        ? "Constellation"
        : "Lens Deliberation";

  const formattedDate = deliberationData?.timestamp
    ? new Date(deliberationData.timestamp).toLocaleString()
    : null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="relative flex flex-col w-[90vw] max-w-[960px] h-[80vh] rounded-[18px] bg-theme-bg-primary border border-theme-modal-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-theme-modal-border shrink-0">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
              {typeLabel} &mdash; {deliberationData?.label}
            </div>
            <div className="mt-1 text-[13px] text-theme-text-primary truncate max-w-[600px]">
              {deliberationData?.query || "No query"}
            </div>
            {formattedDate && (
              <div className="mt-0.5 text-[10px] text-theme-text-secondary opacity-60">
                {formattedDate}
              </div>
            )}
          </div>
          <div className="flex items-center gap-x-2 shrink-0 ml-4">
            {typeof onSave === "function" && (
              <button
                type="button"
                onClick={onSave}
                title="Save deliberation as .md"
                className="flex items-center gap-x-1 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-theme-text-secondary border border-white/10 light:border-slate-200 hover:bg-white/5 light:hover:bg-slate-100 transition"
              >
                <DownloadSimple size={13} />
                Save .md
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center rounded-full w-7 h-7 text-theme-text-secondary hover:bg-white/10 light:hover:bg-slate-100 transition"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body: sidebar + content */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <nav className="w-[200px] shrink-0 border-r border-theme-modal-border overflow-y-auto py-3 px-2 flex flex-col gap-y-0.5">
            {sidebarItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSelectedKey(item.key)}
                className={`w-full text-left rounded-[10px] px-3 py-2 text-[11px] font-medium transition
                  ${
                    selectedKey === item.key
                      ? "bg-white/10 light:bg-slate-200 text-theme-text-primary"
                      : "text-theme-text-secondary hover:bg-white/5 light:hover:bg-slate-100"
                  }
                  ${item.key === "synthesis" ? "mt-2 border-t border-white/10 light:border-slate-200 pt-3 rounded-none rounded-b-[10px]" : ""}
                `}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {selectedItem ? (
              <div className="prose prose-invert light:prose max-w-none text-[13px] leading-6 text-theme-text-primary">
                <span
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(
                      renderMarkdown(selectedItem.content || "(no output)")
                    ),
                  }}
                />
              </div>
            ) : (
              <div className="text-theme-text-secondary text-sm">
                Select a lens from the sidebar to view its output.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
