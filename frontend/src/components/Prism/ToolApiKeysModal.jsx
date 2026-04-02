import React from "react";

export default function ToolApiKeysModal({
  open = false,
  credentials = [],
  setCredentials,
  onClose,
  onSave,
  saving = false,
}) {
  if (!open) return null;

  const updateCredential = (id, updates = {}) => {
    setCredentials((current) =>
      current.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              ...updates,
            }
          : entry
      )
    );
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[28px] border border-theme-sidebar-border bg-theme-bg-secondary shadow-2xl">
        <div className="flex items-start justify-between border-b border-theme-sidebar-border px-6 py-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-theme-primary-button">
              Prism Tool Vault
            </div>
            <h3 className="mt-2 text-2xl font-semibold text-theme-text-primary">
              Tool API Keys
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-theme-text-secondary">
              Store tool credentials once so Prism can hand them to agents when
              image, voice, domain, or media tasks require them.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-theme-sidebar-border px-3 py-2 text-sm font-medium text-theme-text-primary transition-all duration-200 hover:border-theme-primary-button hover:text-theme-primary-button"
          >
            Close
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto px-6 py-5">
          <div className="grid gap-4">
            {credentials.map((entry) => (
              <section
                key={entry.id}
                className="rounded-[22px] border border-theme-sidebar-border bg-theme-bg-primary px-4 py-4"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-theme-primary-button">
                  {entry.id}
                </div>
                <h4 className="mt-2 text-lg font-semibold text-theme-text-primary">
                  {entry.label}
                </h4>
                <p className="mt-2 text-sm leading-7 text-theme-text-secondary">
                  {entry.description}
                </p>
                <label className="mt-4 flex flex-col gap-2 text-sm text-theme-text-secondary">
                  API Key / Secret
                  <input
                    type="password"
                    value={entry.value || ""}
                    onChange={(event) =>
                      updateCredential(entry.id, { value: event.target.value })
                    }
                    placeholder={`Paste the ${entry.label} credential`}
                    className="rounded-xl border border-theme-sidebar-border bg-theme-bg-secondary px-3 py-3 text-sm text-theme-text-primary outline-none"
                  />
                </label>
              </section>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-theme-sidebar-border px-6 py-5">
          <p className="text-xs leading-6 text-theme-text-secondary">
            Keys are persisted in Prism-owned encrypted settings storage. This
            modal does not expose raw values again after save.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-theme-sidebar-border px-4 py-2 text-sm font-medium text-theme-text-primary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="rounded-full bg-theme-primary-button px-4 py-2 text-sm font-semibold text-black transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving Tool Keys..." : "Save Tool Keys"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
