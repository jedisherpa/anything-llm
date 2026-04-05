import { useEffect, useState } from "react";
import { saveCustomLens } from "@/models/metacanonLibrary";
import showToast from "@/utils/toast";

function slugifyHandle(value = "") {
  const slug = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `@mc-${slug}` : "@mc-custom-lens";
}

function parseBackendList(value = "") {
  return Array.from(
    new Set(
      String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

/**
 * LensFormatPreviewModal
 *
 * Shows the auto-formatted PCL content for review before saving.
 * The user can edit the content, set a title/handle, and approve.
 *
 * Props:
 *   open {boolean}
 *   formattedContent {string} — pre-populated PCL markdown from auto-format
 *   suggestedTitle {string}   — passed from the creator panel
 *   onClose {function}
 *   onLensCreated {function}  — called with the saved lens item after approval
 */
export default function LensFormatPreviewModal({
  open = false,
  formattedContent = "",
  suggestedTitle = "",
  onClose,
  onLensCreated,
}) {
  const [title, setTitle] = useState("");
  const [handle, setHandle] = useState("");
  const [content, setContent] = useState("");
  const [preferredBackends, setPreferredBackends] = useState("");
  const [fallbackBackends, setFallbackBackends] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset form whenever the modal opens with new content.
  useEffect(() => {
    if (!open) return;
    const inferredTitle = suggestedTitle.trim() || extractTitleFromPCL(formattedContent);
    setTitle(inferredTitle);
    setHandle(slugifyHandle(inferredTitle));
    setContent(formattedContent);
    setPreferredBackends("");
    setFallbackBackends("");
    setSaving(false);
  }, [open, formattedContent, suggestedTitle]);

  // Auto-update handle when title changes (unless user has manually edited it).
  function handleTitleChange(value) {
    setTitle(value);
    setHandle(slugifyHandle(value));
  }

  async function handleApprove() {
    if (!title.trim()) {
      showToast("A lens title is required.", "warning");
      return;
    }
    if (!content.trim()) {
      showToast("Lens content cannot be empty.", "warning");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        handle: (handle || slugifyHandle(title)).trim(),
        content: content.trim(),
        preferredBackends: parseBackendList(preferredBackends),
        fallbackBackends: parseBackendList(fallbackBackends),
      };

      const { item } = await saveCustomLens(payload);
      showToast(`${item.title} saved as a new custom lens.`, "success");
      onLensCreated?.(item);
      onClose?.();
    } catch (error) {
      showToast(error.message || "Failed to save custom lens.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-theme-sidebar-border bg-theme-bg-secondary shadow-2xl">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-theme-sidebar-border px-6 py-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-theme-primary-button">
              Lens Preview
            </div>
            <h3 className="mt-1.5 text-2xl font-semibold text-theme-text-primary">
              Review & Approve
            </h3>
            <p className="mt-1.5 max-w-xl text-sm leading-7 text-theme-text-secondary">
              The formatted PCL content is shown below. Edit anything before
              saving. Once approved, this lens is immediately available in the
              library.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-theme-sidebar-border px-4 py-2 text-sm font-medium text-theme-text-primary"
          >
            Cancel
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Metadata row */}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm text-theme-text-secondary">
              Lens title <span className="text-red-400">*</span>
              <input
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="The Risk Analyst"
                className="rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-2.5 text-sm text-theme-text-primary outline-none focus:border-theme-primary-button"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-theme-text-secondary">
              Handle (auto-generated)
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@mc-the-risk-analyst"
                className="rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-2.5 text-sm text-theme-text-primary outline-none focus:border-theme-primary-button"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm text-theme-text-secondary">
              Preferred backends
              <input
                value={preferredBackends}
                onChange={(e) => setPreferredBackends(e.target.value)}
                placeholder="slot-1, openai-primary"
                className="rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-2.5 text-sm text-theme-text-primary outline-none focus:border-theme-primary-button"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-theme-text-secondary">
              Fallback backends
              <input
                value={fallbackBackends}
                onChange={(e) => setFallbackBackends(e.target.value)}
                placeholder="slot-2, anthropic-backup"
                className="rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-2.5 text-sm text-theme-text-primary outline-none focus:border-theme-primary-button"
              />
            </label>
          </div>

          {/* Formatted content editor */}
          <label className="mt-5 flex flex-col gap-1.5 text-sm text-theme-text-secondary">
            Formatted PCL content (editable)
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              className="min-h-[400px] rounded-[20px] border border-theme-sidebar-border bg-theme-bg-primary px-4 py-4 font-mono text-xs leading-7 text-theme-text-primary outline-none focus:border-theme-primary-button"
            />
          </label>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 border-t border-theme-sidebar-border px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-theme-sidebar-border px-4 py-2 text-sm font-medium text-theme-text-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={saving || !title.trim() || !content.trim()}
            className="rounded-full bg-theme-primary-button px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Approve & Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Tries to extract the lens title from the first H1 line of PCL markdown.
 * Falls back to empty string so the user is prompted to enter a title.
 *
 * @param {string} pcl
 * @returns {string}
 */
function extractTitleFromPCL(pcl = "") {
  const match = String(pcl || "").match(/^#\s+PCL:\s*(.+)$/m);
  if (match) return match[1].trim();
  // Fallback: first H1
  const h1 = String(pcl || "").match(/^#\s+(.+)$/m);
  return h1 ? h1[1].trim() : "";
}
