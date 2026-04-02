import React, { useMemo, useState } from "react";
import System from "@/models/system";
import showToast from "@/utils/toast";
import { AVAILABLE_LLM_PROVIDERS } from "@/constants/llmProviders";

function normalizeModels(models = []) {
  return Array.from(
    new Set(
      (Array.isArray(models) ? models : [])
        .map((model) => String(model || "").trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));
}

export default function ProviderSlotsPanel({
  slots = [],
  setSlots,
  onSave,
  saving = false,
  onOpenToolKeys,
}) {
  const [refreshingSlotId, setRefreshingSlotId] = useState(null);
  const [slotModels, setSlotModels] = useState({});

  const providerOptions = useMemo(
    () =>
      AVAILABLE_LLM_PROVIDERS.map((provider) => ({
        value: provider.value,
        label: provider.name,
      })),
    []
  );

  const updateSlot = (slotId, updates = {}) => {
    setSlots((current) =>
      current.map((slot) =>
        slot.id === slotId
          ? {
              ...slot,
              ...updates,
            }
          : slot
      )
    );
  };

  const refreshModels = async (slot) => {
    if (!slot?.provider) {
      showToast("Pick a provider before refreshing models.", "warning");
      return;
    }

    setRefreshingSlotId(slot.id);
    const { models = [], error } = await System.customModels(
      slot.provider,
      slot.apiKey || null,
      slot.basePath || null,
      10000
    );

    if (error) {
      showToast(
        `Failed to refresh models for ${slot.label}: ${error}`,
        "error"
      );
      setRefreshingSlotId(null);
      return;
    }

    const normalized = normalizeModels(models);
    setSlotModels((current) => ({
      ...current,
      [slot.id]: normalized,
    }));

    if (!slot.model && normalized[0]) {
      updateSlot(slot.id, { model: normalized[0] });
    }

    showToast(
      normalized.length > 0
        ? `${normalized.length} model${normalized.length === 1 ? "" : "s"} found for ${slot.label}.`
        : `No models were returned for ${slot.label}.`,
      normalized.length > 0 ? "success" : "info"
    );
    setRefreshingSlotId(null);
  };

  return (
    <div className="mt-10 rounded-[24px] border border-theme-sidebar-border bg-theme-bg-primary p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-theme-primary-button">
            Prism Provider Lanes
          </div>
          <h3 className="mt-2 text-xl font-semibold text-theme-text-primary">
            Five live model seats
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-theme-text-secondary">
            Keep up to five provider lanes ready at once. Prism can use these
            saved seats for workspace routing, future deliberation wiring, and
            provider switching without making you re-enter credentials.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onOpenToolKeys}
            className="rounded-full border border-theme-primary-button px-4 py-2 text-sm font-medium text-theme-primary-button transition-all duration-200 hover:bg-theme-primary-button hover:text-black"
          >
            Tool API Keys
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-full bg-theme-primary-button px-4 py-2 text-sm font-semibold text-black transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving Provider Lanes..." : "Save Provider Lanes"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {slots.map((slot, index) => {
          const models = slotModels[slot.id] || [];
          return (
            <section
              key={slot.id}
              className="rounded-[22px] border border-theme-sidebar-border bg-theme-bg-secondary px-4 py-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-theme-primary-button">
                    Seat {index + 1}
                  </div>
                  <input
                    value={slot.label}
                    onChange={(event) =>
                      updateSlot(slot.id, { label: event.target.value })
                    }
                    placeholder={`Provider Slot ${index + 1}`}
                    className="mt-2 w-full bg-transparent text-lg font-semibold text-theme-text-primary outline-none"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-theme-text-secondary">
                  <input
                    type="checkbox"
                    checked={slot.enabled !== false}
                    onChange={(event) =>
                      updateSlot(slot.id, { enabled: event.target.checked })
                    }
                  />
                  Enabled
                </label>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm text-theme-text-secondary">
                  Provider
                  <select
                    value={slot.provider || ""}
                    onChange={(event) =>
                      updateSlot(slot.id, {
                        provider: event.target.value,
                        model: "",
                      })
                    }
                    className="rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-3 text-sm text-theme-text-primary outline-none"
                  >
                    <option value="">Select a provider</option>
                    {providerOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2 text-sm text-theme-text-secondary">
                  Base URL / Endpoint
                  <input
                    value={slot.basePath || ""}
                    onChange={(event) =>
                      updateSlot(slot.id, { basePath: event.target.value })
                    }
                    placeholder="Optional custom base URL"
                    className="rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-3 text-sm text-theme-text-primary outline-none"
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm text-theme-text-secondary md:col-span-2">
                  API Key
                  <input
                    type="password"
                    value={slot.apiKey || ""}
                    onChange={(event) =>
                      updateSlot(slot.id, { apiKey: event.target.value })
                    }
                    placeholder="Paste provider key"
                    className="rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-3 text-sm text-theme-text-primary outline-none"
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm text-theme-text-secondary">
                  Model
                  {models.length > 0 ? (
                    <select
                      value={slot.model || ""}
                      onChange={(event) =>
                        updateSlot(slot.id, { model: event.target.value })
                      }
                      className="rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-3 text-sm text-theme-text-primary outline-none"
                    >
                      <option value="">Select a model</option>
                      {models.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={slot.model || ""}
                      onChange={(event) =>
                        updateSlot(slot.id, { model: event.target.value })
                      }
                      placeholder="Model id"
                      className="rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-3 text-sm text-theme-text-primary outline-none"
                    />
                  )}
                </label>

                <label className="flex flex-col gap-2 text-sm text-theme-text-secondary">
                  Token / Context Window
                  <input
                    value={slot.tokenLimit || ""}
                    onChange={(event) =>
                      updateSlot(slot.id, { tokenLimit: event.target.value })
                    }
                    placeholder="Optional context window"
                    className="rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-3 text-sm text-theme-text-primary outline-none"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => refreshModels(slot)}
                  disabled={refreshingSlotId === slot.id}
                  className="rounded-full border border-theme-sidebar-border px-4 py-2 text-sm font-medium text-theme-text-primary transition-all duration-200 hover:border-theme-primary-button hover:text-theme-primary-button disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {refreshingSlotId === slot.id
                    ? "Refreshing Models..."
                    : "Refresh Models"}
                </button>
                {models.length > 0 ? (
                  <div className="flex items-center text-xs text-theme-text-secondary">
                    {models.length} model{models.length === 1 ? "" : "s"} cached
                    for this seat.
                  </div>
                ) : (
                  <div className="flex items-center text-xs text-theme-text-secondary">
                    Model refresh is optional. Prism will still persist this
                    seat without a live lookup.
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
