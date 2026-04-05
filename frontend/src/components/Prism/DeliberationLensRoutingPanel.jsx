import React from "react";
import CTAButton from "@/components/lib/CTAButton";

const LENS_ROWS = [
  { key: "watcher", label: "Watcher", description: "Vigilance / Compliance Monitor" },
  { key: "auditor", label: "Auditor", description: "Criticism / Integrity Checker" },
  { key: "synthesizer", label: "Synthesizer", description: "Expansion / Option Generator" },
  { key: "torus", label: "Torus", description: "Integration / Synthesis Hub" },
  { key: "prism", label: "Prism", description: "Clarity / Unifying Refractor" },
];

/**
 * Panel for assigning provider slots to each of the 5 built-in deliberation lenses.
 *
 * @param {Object[]} slots - Provider slot objects from ProviderSlotsPanel.
 * @param {Object} routing - Current routing map { watcher, auditor, synthesizer, torus, prism }.
 * @param {Function} setRouting - State setter for routing.
 * @param {Function} onSave - Save handler.
 * @param {boolean} saving - Save in progress.
 */
export default function DeliberationLensRoutingPanel({
  slots = [],
  routing = {},
  setRouting,
  onSave,
  saving = false,
}) {
  const enabledSlots = slots.filter((s) => s.enabled && s.provider);

  const handleChange = (lensKey, value) => {
    setRouting((prev) => ({
      ...prev,
      [lensKey]: value === "" ? null : value,
    }));
  };

  return (
    <div className="prism-settings-field">
      <div className="prism-settings-field-title">Deliberation Lens Routing</div>
      <p className="prism-settings-field-copy">
        Assign a specific provider slot to each built-in deliberation lens. Unassigned lenses
        fall back to the workspace default model.
      </p>

      {enabledSlots.length === 0 ? (
        <p className="mt-3 text-xs text-theme-text-secondary">
          Configure at least one enabled Provider Slot above to assign lenses.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-y-2">
          {LENS_ROWS.map(({ key, label, description }) => {
            const assignedSlotId = routing[key] ?? null;
            const slotStillExists =
              assignedSlotId === null ||
              enabledSlots.some((s) => s.id === assignedSlotId);

            return (
              <div key={key} className="flex items-center gap-x-3">
                <div className="w-[110px] shrink-0">
                  <span className="text-xs font-semibold text-theme-text-primary leading-none">
                    {label}
                  </span>
                  <span className="block text-[10px] text-theme-text-secondary leading-none mt-0.5">
                    {description}
                  </span>
                </div>

                <div className="prism-settings-select-wrap flex-1 max-w-[260px]">
                  <select
                    className="prism-settings-select w-full"
                    value={assignedSlotId ?? ""}
                    onChange={(e) => handleChange(key, e.target.value)}
                  >
                    <option value="">Workspace Default</option>
                    {enabledSlots.map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {slot.label} · {slot.provider}
                        {slot.model ? ` ${slot.model}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {!slotStillExists && (
                  <span className="text-[10px] text-yellow-400 leading-none">
                    Slot no longer available — falls back to workspace default.
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {enabledSlots.length > 0 && (
        <div className="mt-4">
          <CTAButton onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save Lens Routing"}
          </CTAButton>
        </div>
      )}
    </div>
  );
}
