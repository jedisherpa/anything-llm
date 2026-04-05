import React, { useEffect, useMemo, useState } from "react";
import { fetchLibraryItem, saveCustomLens } from "@/models/metacanonLibrary";
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

export default function LensWorkbenchModal({
  open = false,
  lenses = [],
  onClose,
  onSaved,
  initialLensId = "",
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState("edit");
  const [form, setForm] = useState({
    sourceId: "",
    title: "",
    handle: "",
    content: "",
    preferredBackends: "",
    fallbackBackends: "",
  });

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelectedId("");
    setLoading(false);
    setSaving(false);
    setMode("edit");
    setForm({
      sourceId: "",
      title: "",
      handle: "",
      content: "",
      preferredBackends: "",
      fallbackBackends: "",
    });
  }, [open]);

  const filteredLenses = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return lenses;
    return lenses.filter((lens) =>
      JSON.stringify(lens).toLowerCase().includes(query)
    );
  }, [lenses, search]);

  const selectedLensSummary = useMemo(
    () => filteredLenses.find((lens) => lens.id === selectedId) || null,
    [filteredLenses, selectedId]
  );

  const loadLens = async (lensId) => {
    setSelectedId(lensId);
    if (!lensId) return;

    setMode("edit");
    setLoading(true);
    try {
      const payload = await fetchLibraryItem("lenses", lensId);
      setForm({
        sourceId: payload.sourceId || payload.id || "",
        title: payload.title || "",
        handle: payload.handle || "",
        content: payload.content || "",
        preferredBackends: (payload.preferredBackends || []).join(", "),
        fallbackBackends: (payload.fallbackBackends || []).join(", "),
      });
    } catch (error) {
      console.error(error);
      showToast(`Failed to load lens: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Pre-select a specific lens when the modal opens with an initialLensId.
  useEffect(() => {
    if (open && initialLensId) {
      loadLens(initialLensId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialLensId]);

  const switchToCreate = () => {
    setMode("create");
    setSelectedId("");
    setForm({
      sourceId: "",
      title: "",
      handle: "",
      content: "",
      preferredBackends: "",
      fallbackBackends: "",
    });
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      showToast("A lens needs both a title and content.", "warning");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        sourceId: mode === "edit" ? form.sourceId || selectedId : "",
        title: form.title.trim(),
        handle: (form.handle || slugifyHandle(form.title)).trim(),
        content: form.content.trim(),
        preferredBackends: parseBackendList(form.preferredBackends),
        fallbackBackends: parseBackendList(form.fallbackBackends),
      };
      const { item } = await saveCustomLens(payload);
      showToast(
        mode === "edit"
          ? `${item.title} saved as a live lens override.`
          : `${item.title} created as a new custom lens.`,
        "success"
      );
      onSaved?.(item);
      onClose?.();
    } catch (error) {
      console.error(error);
      showToast(error.message || "Failed to save custom lens.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl overflow-clip rounded-[28px] border border-theme-sidebar-border bg-theme-bg-secondary shadow-2xl">
        <div className="hidden w-[360px] shrink-0 border-r border-theme-sidebar-border bg-theme-bg-primary md:flex md:flex-col">
          <div className="border-b border-theme-sidebar-border px-5 py-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-theme-primary-button">
              Lens Workbench
            </div>
            <h3 className="mt-2 text-2xl font-semibold text-theme-text-primary">
              Edit or create lenses
            </h3>
            <p className="mt-2 text-sm leading-7 text-theme-text-secondary">
              Search the current lens library, load a lens into the editor, or
              create a brand-new custom lens from pasted text.
            </p>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search lenses"
              className="mt-4 w-full rounded-xl border border-theme-sidebar-border bg-theme-bg-secondary px-3 py-3 text-sm text-theme-text-primary outline-none"
            />
          </div>

          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <button
              type="button"
              onClick={switchToCreate}
              className="rounded-full bg-theme-primary-button px-4 py-2 text-sm font-semibold text-white"
            >
              Create New Lens
            </button>
            <div className="text-xs text-theme-text-secondary">
              {filteredLenses.length} result
              {filteredLenses.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-4">
            <div className="space-y-2">
              {filteredLenses.map((lens) => (
                <button
                  type="button"
                  key={lens.id}
                  onClick={() => loadLens(lens.id)}
                  className={`w-full rounded-[18px] border px-4 py-3 text-left transition-all duration-200 ${
                    selectedId === lens.id
                      ? "border-theme-primary-button bg-theme-bg-secondary"
                      : "border-theme-sidebar-border bg-transparent hover:border-theme-primary-button"
                  }`}
                >
                  <div className="text-sm font-semibold text-theme-text-primary">
                    {lens.title}
                  </div>
                  <div className="mt-1 text-xs text-theme-text-secondary">
                    {lens.handle || "No handle"}
                  </div>
                  <div className="mt-2 text-xs leading-6 text-theme-text-secondary">
                    {lens.overview || lens.collectionLabel || "Lens"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-theme-sidebar-border px-6 py-5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-theme-primary-button">
                {mode === "edit" ? "Editing Lens" : "Creating Lens"}
              </div>
              <h4 className="mt-2 text-2xl font-semibold text-theme-text-primary">
                {mode === "edit"
                  ? selectedLensSummary?.title || "Select a lens"
                  : "New Custom Lens"}
              </h4>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-theme-text-secondary">
                {mode === "edit"
                  ? "The saved version becomes a Prism-side override while preserving the original generated source."
                  : "Paste the desired prompt and behavior. Prism will store it as a new custom lens in the active profile."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-theme-sidebar-border px-4 py-2 text-sm font-medium text-theme-text-primary"
            >
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm text-theme-text-secondary">
                Title
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                      handle:
                        !current.handle || current.handle.startsWith("@mc-")
                          ? slugifyHandle(event.target.value)
                          : current.handle,
                    }))
                  }
                  placeholder="Lens title"
                  className="rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-3 text-sm text-theme-text-primary outline-none"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-theme-text-secondary">
                Handle
                <input
                  value={form.handle}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      handle: event.target.value,
                    }))
                  }
                  placeholder="@mc-your-lens-handle"
                  className="rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-3 text-sm text-theme-text-primary outline-none"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm text-theme-text-secondary">
                Preferred backends
                <input
                  value={form.preferredBackends}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      preferredBackends: event.target.value,
                    }))
                  }
                  placeholder="slot-1, openai-primary, docker-model-runner"
                  className="rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-3 text-sm text-theme-text-primary outline-none"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-theme-text-secondary">
                Fallback backends
                <input
                  value={form.fallbackBackends}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      fallbackBackends: event.target.value,
                    }))
                  }
                  placeholder="slot-2, anthropic-backup"
                  className="rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-3 text-sm text-theme-text-primary outline-none"
                />
              </label>
            </div>

            <label className="mt-4 flex flex-col gap-2 text-sm text-theme-text-secondary">
              Lens content
              <textarea
                value={form.content}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    content: event.target.value,
                  }))
                }
                placeholder="Paste the lens content here"
                rows={18}
                className="min-h-[420px] rounded-[20px] border border-theme-sidebar-border bg-theme-bg-primary px-4 py-4 text-sm leading-7 text-theme-text-primary outline-none"
              />
            </label>

            {loading ? (
              <div className="mt-3 text-sm text-theme-text-secondary">
                Loading lens content...
              </div>
            ) : null}

            {mode === "edit" && selectedLensSummary ? (
              <div className="mt-4 rounded-[20px] border border-theme-sidebar-border bg-theme-bg-primary px-4 py-4 text-xs leading-6 text-theme-text-secondary">
                Source lens: {selectedLensSummary.title}{" "}
                {selectedLensSummary.handle}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-theme-sidebar-border px-6 py-5">
            <button
              type="button"
              onClick={switchToCreate}
              className="rounded-full border border-theme-sidebar-border px-4 py-2 text-sm font-medium text-theme-text-primary"
            >
              New Lens
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-theme-primary-button px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Saving Lens..."
                : mode === "edit"
                  ? "Save Lens Override"
                  : "Create Lens"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
