import Sidebar, { SidebarMobileHeader } from "@/components/Sidebar";
import {
  buildComposerDataset,
  cloneMixAsCustom,
  COMPOSER_BUILD_MODES,
  COMPOSER_FAMILIES,
  createCustomCouncilMix,
  createCustomShapeMix,
  deleteSavedCouncil,
  deleteSavedShape,
  loadSavedCouncils,
  loadSavedShapes,
  resolveShapeTemplate,
  saveCouncilMix,
  saveShapeMix,
  validateShapeMix,
  describeCouncilMix,
} from "@/models/metacanonComposer";
import {
  fetchLibraryCollection,
  saveCustomConstellation as saveCustomConstellationToServer,
} from "@/models/metacanonLibrary";
import System from "@/models/system";
import paths from "@/utils/paths";
import showToast from "@/utils/toast";
import { isMobile } from "react-device-detect";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CustomLensCreatorPanel from "./CustomLensCreatorPanel";
import LensFormatPreviewModal from "@/components/Metacanon/LensFormatPreviewModal";
import LensWorkbenchModal from "@/components/Metacanon/LensWorkbenchModal";

const CUSTOM_SUB_MODES = {
  COMPOSE: "compose",
  CREATE: "create",
};

function buildShapeSlots(mix = {}, template) {
  const slots = Array.from({ length: template.cardinality }, (_, index) => ({
    index: index + 1,
    lens: null,
    locked: index === 0,
  }));

  (mix.lenses || []).forEach((lens, index) => {
    const slotIndex =
      Number.isInteger(lens.slot) && lens.slot > 0 ? lens.slot : index + 1;
    if (!slots[slotIndex - 1]) return;
    slots[slotIndex - 1] = {
      index: slotIndex,
      lens,
      locked: slotIndex === 1 || Boolean(lens.locked),
    };
  });

  return slots;
}

function summarizeMix(mix = {}, template) {
  if (mix.mode === "shape") return validateShapeMix(mix, template);
  return describeCouncilMix(mix);
}

function buildViewerNodes(mix = {}, template) {
  const slots =
    mix.mode === "shape"
      ? buildShapeSlots(mix, template)
      : (mix.lenses || []).map((lens, index) => ({
          index: index + 1,
          lens,
          locked: false,
        }));

  const total = Math.max(
    slots.length,
    mix.mode === "shape" ? template.cardinality : 1
  );
  const centerX = 250;
  const centerY = 250;
  const radius = mix.mode === "shape" ? 170 : 185;

  return slots.map((slot, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(total, 1);
    return {
      ...slot,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });
}

function ComposerSegmentedControl({ label, value, options, onChange }) {
  return (
    <div className="prism-composer-mode-dial">
      <div className="prism-composer-mode-label">{label}</div>
      <div
        className="prism-composer-mode-track"
        role="tablist"
        aria-label={label}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={value === option.value}
            className={`prism-composer-mode-pill ${
              value === option.value ? "is-active" : ""
            }`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectorRail({
  title,
  subtitle,
  items,
  activeValue,
  onSelect,
  renderLabel,
}) {
  return (
    <div className="prism-composer-rail">
      <div className="prism-composer-rail-header">
        <div className="prism-composer-rail-eyebrow">{title}</div>
        {subtitle ? (
          <div className="prism-composer-rail-subtitle">{subtitle}</div>
        ) : null}
      </div>
      <div className="prism-composer-rail-list">
        {items.map((item) => (
          <button
            type="button"
            key={item.value}
            className={`prism-composer-rail-item ${
              activeValue === item.value ? "is-active" : ""
            }`}
            onClick={() => onSelect(item.value)}
          >
            {renderLabel(item)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ShapeWireframeViewer({ mix, template, activeSlot, onSelectSlot }) {
  const nodes = buildViewerNodes(mix, template);
  const summary = summarizeMix(mix, template);
  const lines =
    mix.mode === "shape"
      ? nodes.map((node, index) => {
          const next = nodes[(index + 1) % nodes.length];
          return { from: node, to: next };
        })
      : nodes.map((node) => ({
          from: { x: 250, y: 250 },
          to: node,
        }));

  return (
    <div className="prism-composer-viewer-shell prism-page-panel">
      <div className="prism-composer-viewer-copy">
        <div className="prism-composer-viewer-eyebrow">
          {mix.mode === "shape" ? "Shape Composer" : "Council Composer"}
        </div>
        <div className="prism-composer-viewer-title">{mix.name}</div>
        <div className="prism-composer-viewer-description">
          {mix.description ||
            template?.purpose ||
            "Compose and inspect the active lens formation."}
        </div>
      </div>

      <div className="prism-composer-viewer-canvas">
        <svg
          viewBox="0 0 500 500"
          className="h-full w-full"
          role="img"
          aria-label={`${mix.name} wireframe viewer`}
        >
          <defs>
            <radialGradient id="composerGlow" cx="50%" cy="45%" r="60%">
              <stop offset="0%" stopColor="rgba(214,180,107,0.18)" />
              <stop offset="100%" stopColor="rgba(214,180,107,0)" />
            </radialGradient>
          </defs>
          <circle cx="250" cy="250" r="215" fill="url(#composerGlow)" />
          {lines.map((line, index) => (
            <line
              key={`${line.from.x}-${line.to.x}-${index}`}
              x1={line.from.x}
              y1={line.from.y}
              x2={line.to.x}
              y2={line.to.y}
              className="prism-composer-wire"
            />
          ))}
          {mix.mode === "shape" ? (
            nodes.map((node) => (
              <line
                key={`spoke-${node.index}`}
                x1="250"
                y1="250"
                x2={node.x}
                y2={node.y}
                className="prism-composer-spoke"
              />
            ))
          ) : (
            <circle
              cx="250"
              cy="250"
              r="110"
              className="prism-composer-council-ring"
            />
          )}
          {nodes.map((node) => {
            const isActive = activeSlot === node.index;
            const isFilled = Boolean(node.lens);
            const isLocked = Boolean(node.locked);

            return (
              <g
                key={`node-${node.index}`}
                transform={`translate(${node.x} ${node.y})`}
                onClick={() => onSelectSlot(node.index)}
                className="cursor-pointer"
              >
                <circle
                  r={isActive ? 19 : 15}
                  className={`prism-composer-node ${
                    isActive ? "is-active" : ""
                  } ${isFilled ? "is-filled" : ""} ${isLocked ? "is-locked" : ""}`}
                />
                <text
                  y="5"
                  textAnchor="middle"
                  className="prism-composer-node-label"
                >
                  {node.index}
                </text>
              </g>
            );
          })}
          <g transform="translate(250 250)">
            <circle r="34" className="prism-composer-core" />
            <text
              textAnchor="middle"
              y="-2"
              className="prism-composer-core-title"
            >
              {mix.mode === "shape" ? template.label : "Council"}
            </text>
            <text
              textAnchor="middle"
              y="16"
              className="prism-composer-core-copy"
            >
              {summary.valid ? "Ready" : "Draft"}
            </text>
          </g>
        </svg>
      </div>

      <div className="prism-composer-viewer-footer">
        <div className="prism-composer-status-chip">{summary.message}</div>
        <div className="prism-composer-status-meta">
          {mix.mode === "shape"
            ? `${mix.lenses.length} / ${template.cardinality} lenses`
            : `${mix.lenses.length} lenses selected`}
        </div>
      </div>
    </div>
  );
}

function LensRoster({
  mix,
  template,
  activeSlot,
  onSelectSlot,
  onRemoveLens,
  onMoveLens,
  providerSlots = [],
  executionRoutes = {},
  onRouteChange,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const slots =
    mix.mode === "shape"
      ? buildShapeSlots(mix, template)
      : (mix.lenses || []).map((lens, index) => ({
          index: index + 1,
          lens,
          locked: false,
        }));

  const enabledSlots = providerSlots.filter(
    (slot) => slot.enabled && slot.provider
  );

  return (
    <div className="prism-composer-roster prism-page-panel">
      <div className="prism-composer-panel-header">
        <div>
          <div className="prism-composer-panel-eyebrow">Current Mix</div>
          <div className="prism-composer-panel-title">
            {mix.mode === "shape" ? "Slot Roster" : "Council Lenses"}
          </div>
        </div>
      </div>
      <div className="prism-composer-roster-list">
        {slots.map((slot, index) => (
          <div key={`slot-${slot.index}`} className="flex flex-col">
            <button
              type="button"
              className={`prism-composer-roster-item ${
                activeSlot === slot.index ? "is-active" : ""
              }`}
              onClick={() => onSelectSlot(slot.index)}
            >
              <div className="prism-composer-roster-slot">
                <span className="prism-composer-roster-index">
                  {mix.mode === "shape" ? `S${slot.index}` : `L${slot.index}`}
                </span>
                {slot.locked ? (
                  <span className="prism-composer-roster-badge">PM</span>
                ) : null}
              </div>
              <div className="prism-composer-roster-copy">
                <div className="prism-composer-roster-title">
                  {slot.lens?.title || `Empty slot ${slot.index}`}
                </div>
                <div className="prism-composer-roster-meta">
                  {slot.lens?.collectionLabel ||
                    (slot.locked ? "Project Manager Lens" : "Choose a lens")}
                </div>
              </div>
              {slot.lens && !slot.locked ? (
                <div className="prism-composer-roster-actions">
                  {mix.mode === "council" ? (
                    <>
                      <button
                        type="button"
                        className="prism-composer-inline-action"
                        onClick={(event) => {
                          event.stopPropagation();
                          onMoveLens(index, Math.max(0, index - 1));
                        }}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="prism-composer-inline-action"
                        onClick={(event) => {
                          event.stopPropagation();
                          onMoveLens(
                            index,
                            Math.min(slots.length - 1, index + 1)
                          );
                        }}
                      >
                        Down
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="prism-composer-inline-action"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveLens(slot.index);
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : null}
            </button>
            {advancedOpen && slot.lens && enabledSlots.length > 0 ? (
              <div className="flex items-center gap-2 px-3 pb-1.5 -mt-1">
                <span className="text-[10px] text-theme-text-secondary opacity-60 shrink-0">
                  Route
                </span>
                <select
                  className="text-[10px] bg-transparent border border-white/10 rounded px-1.5 py-0.5 text-theme-text-secondary min-w-0 flex-1"
                  value={
                    slot.lens?.handle &&
                    // Only single-element route arrays are supported in the current UI;
                    // index [0] is the sole active route for this lens slot.
                    executionRoutes[slot.lens.handle]?.[0]
                      ? executionRoutes[slot.lens.handle][0]
                      : ""
                  }
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    event.stopPropagation();
                    if (slot.lens?.handle && onRouteChange) {
                      onRouteChange(slot.lens.handle, event.target.value || null);
                    }
                  }}
                >
                  <option value="">Default</option>
                  {enabledSlots.map((ps) => (
                    <option key={ps.id} value={ps.id}>
                      {ps.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {enabledSlots.length > 0 ? (
        <button
          type="button"
          className="mt-2 w-full text-left text-[10px] text-theme-text-secondary opacity-60 hover:opacity-100 px-3 py-1.5 transition-opacity"
          onClick={() => setAdvancedOpen((prev) => !prev)}
        >
          {advancedOpen ? "Hide" : "Advanced"}: Provider Routing
        </button>
      ) : null}
    </div>
  );
}

function LensChooser({
  title,
  description,
  search,
  onSearch,
  items,
  onApplyLens,
  actionLabel = "Assign",
  isInspect = false,
}) {
  return (
    <div className="prism-composer-library prism-page-panel">
      <div className="prism-composer-panel-header">
        <div>
          <div className="prism-composer-panel-eyebrow">{title}</div>
        </div>
        <div className="prism-composer-panel-note">{description}</div>
      </div>

      <input
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        className="prism-composer-search"
        placeholder="Search lenses"
        aria-label="Search available lenses"
      />

      <div className="prism-composer-library-list">
        {items.map((lens) => (
          <div
            key={lens.handle || lens.id}
            className="prism-composer-library-item"
          >
            <div className="prism-composer-library-copy">
              <div className="prism-composer-library-title">{lens.title}</div>
              <div className="prism-composer-library-meta">
                {lens.collectionLabel}
              </div>
            </div>
            <button
              type="button"
              className={
                isInspect
                  ? "text-[10px] text-theme-text-secondary hover:text-theme-text-primary transition-colors underline-offset-2 hover:underline shrink-0"
                  : "prism-composer-add-button"
              }
              onClick={() => onApplyLens(lens)}
            >
              {actionLabel}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SavedMixes({ title, items, onApply, onDelete, emptyLabel }) {
  return (
    <div className="prism-composer-saved prism-page-panel">
      <div className="prism-composer-panel-header">
        <div>
          <div className="prism-composer-panel-eyebrow">Saved</div>
          <div className="prism-composer-panel-title">{title}</div>
        </div>
      </div>
      <div className="prism-composer-saved-list">
        {items.length === 0 ? (
          <div className="prism-composer-empty">{emptyLabel}</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="prism-composer-saved-item">
              <div className="prism-composer-saved-copy">
                <div className="prism-composer-saved-title">{item.name}</div>
                <div className="prism-composer-saved-meta">
                  {item.description ||
                    `${item.lenses.length} lenses saved locally.`}
                </div>
              </div>
              <div className="prism-composer-saved-actions">
                <button
                  type="button"
                  className="prism-composer-inline-action"
                  onClick={() => onApply(item)}
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="prism-composer-inline-action"
                  onClick={() => onDelete(item.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SaveMixPanel({
  mix,
  validation,
  onNameChange,
  onDescriptionChange,
  onSave,
  onClonePreset,
  onAutocomplete,
  canAutocomplete,
}) {
  return (
    <div className="prism-composer-save prism-page-panel">
      <div className="prism-composer-panel-header">
        <div>
          <div className="prism-composer-panel-eyebrow">Save Current Mix</div>
          <div className="prism-composer-panel-title">
            {mix.mode === "shape" ? "Custom Shape" : "Custom Council"}
          </div>
        </div>
        <div className="prism-composer-panel-note">{validation.message}</div>
      </div>
      <div className="prism-composer-save-form">
        <input
          value={mix.name}
          onChange={(event) => onNameChange(event.target.value)}
          className="prism-composer-search"
          placeholder={
            mix.mode === "shape" ? "Name this shape" : "Name this council"
          }
        />
        <textarea
          value={mix.description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          className="prism-composer-description"
          placeholder="Optional description"
        />
      </div>
      <div className="prism-composer-save-actions">
        <button
          type="button"
          className="prism-composer-action is-secondary"
          onClick={onClonePreset}
        >
          Start from preset
        </button>
        {canAutocomplete ? (
          <button
            type="button"
            className="prism-composer-action is-secondary"
            onClick={onAutocomplete}
          >
            Autocomplete
          </button>
        ) : null}
        <button
          type="button"
          className="prism-composer-action"
          onClick={onSave}
          disabled={!validation.valid}
        >
          Save locally
        </button>
      </div>
    </div>
  );
}

export default function MetacanonLensComposerPage() {
  const [family, setFamily] = useState(COMPOSER_FAMILIES.SHAPES);
  const [buildMode, setBuildMode] = useState(COMPOSER_BUILD_MODES.PRESETS);
  const [shapeId, setShapeId] = useState("cube");
  const [selectedShapePresetId, setSelectedShapePresetId] = useState("");
  const [selectedCouncilPresetId, setSelectedCouncilPresetId] = useState("");
  const [activeSlot, setActiveSlot] = useState(1);
  const [lensSearch, setLensSearch] = useState("");
  const [inspectLensId, setInspectLensId] = useState(null);
  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [customShape, setCustomShape] = useState(null);
  const [customCouncil, setCustomCouncil] = useState(() =>
    createCustomCouncilMix()
  );
  const [savedShapes, setSavedShapes] = useState([]);
  const [savedCouncils, setSavedCouncils] = useState([]);
  const [customSubMode, setCustomSubMode] = useState(CUSTOM_SUB_MODES.COMPOSE);
  const [previewModal, setPreviewModal] = useState({
    open: false,
    formattedContent: "",
    suggestedTitle: "",
  });
  const [providerSlots, setProviderSlots] = useState([]);
  const [shapeDialOpen, setShapeDialOpen] = useState(true);

  useEffect(() => {
    setSavedShapes(loadSavedShapes());
    setSavedCouncils(loadSavedCouncils());
  }, []);

  useEffect(() => {
    System.prismProviderSlots()
      .then(({ slots = [] }) => setProviderSlots(slots))
      .catch((e) => console.warn("[LensComposer] Failed to load provider slots:", e.message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetchLibraryCollection("councils"),
      fetchLibraryCollection("constellations"),
      fetchLibraryCollection("lenses"),
    ])
      .then(([councils, constellations, lenses]) => {
        if (cancelled) return;
        const nextDataset = buildComposerDataset({
          councils,
          constellations,
          lenses,
        });
        setDataset(nextDataset);
      })
      .catch((error) => {
        console.error(error);
        showToast("Failed to load the Lens Composer.", "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const shapeTemplates = dataset?.shapeTemplates || [];
  const activeTemplate =
    shapeTemplates.find((template) => template.id === shapeId) ||
    resolveShapeTemplate(shapeId);
  const shapePresets = activeTemplate?.presets || [];
  const councilPresets = dataset?.councilPresets || [];

  useEffect(() => {
    if (!shapeTemplates.length) return;
    if (!shapeTemplates.some((template) => template.id === shapeId)) {
      setShapeId(shapeTemplates[0].id);
    }
  }, [shapeId, shapeTemplates]);

  useEffect(() => {
    if (!shapeTemplates.length) return;
    const template =
      shapeTemplates.find((item) => item.id === shapeId) || shapeTemplates[0];

    if (!customShape || customShape.shapeId !== template.id) {
      setCustomShape(createCustomShapeMix(template));
      setActiveSlot(2);
    }
  }, [customShape, shapeId, shapeTemplates]);

  useEffect(() => {
    if (!shapePresets.length) return;
    if (!shapePresets.some((preset) => preset.id === selectedShapePresetId)) {
      setSelectedShapePresetId(shapePresets[0].id);
    }
  }, [shapePresets, selectedShapePresetId]);

  useEffect(() => {
    if (!councilPresets.length) return;
    if (
      !councilPresets.some((preset) => preset.id === selectedCouncilPresetId)
    ) {
      setSelectedCouncilPresetId(councilPresets[0].id);
    }
  }, [councilPresets, selectedCouncilPresetId]);

  const activeShapePreset =
    shapePresets.find((preset) => preset.id === selectedShapePresetId) ||
    shapePresets[0] ||
    null;
  const activeCouncilPreset =
    councilPresets.find((preset) => preset.id === selectedCouncilPresetId) ||
    councilPresets[0] ||
    null;

  const activeMix = useMemo(() => {
    if (buildMode === COMPOSER_BUILD_MODES.PRESETS) {
      return family === COMPOSER_FAMILIES.SHAPES
        ? activeShapePreset
        : activeCouncilPreset;
    }

    return family === COMPOSER_FAMILIES.SHAPES ? customShape : customCouncil;
  }, [
    activeCouncilPreset,
    activeShapePreset,
    buildMode,
    customCouncil,
    customShape,
    family,
  ]);

  const activeTemplateForMix =
    activeMix?.mode === "shape"
      ? resolveShapeTemplate(activeMix.shapeId)
      : activeTemplate;
  const validation = summarizeMix(activeMix || {}, activeTemplateForMix);

  const availableLenses = useMemo(() => {
    const all = dataset?.allLenses || [];
    const query = lensSearch.trim().toLowerCase();
    const activeHandles = new Set(
      (activeMix?.lenses || []).map((lens) => lens.handle).filter(Boolean)
    );

    return all
      .filter((lens) => {
        if (activeHandles.has(lens.handle)) return false;
        if (!query) return true;
        return (
          lens.title.toLowerCase().includes(query) ||
          String(lens.collectionLabel || "")
            .toLowerCase()
            .includes(query)
        );
      })
      .slice(0, 32);
  }, [activeMix?.lenses, dataset?.allLenses, lensSearch]);

  const selectorItems = useMemo(() => {
    if (family === COMPOSER_FAMILIES.SHAPES) {
      return shapeTemplates.map((template) => ({
        value: template.id,
        label: template.label,
        caption: `${template.cardinality} lenses`,
      }));
    }

    return councilPresets.map((preset) => ({
      value: preset.id,
      label: preset.name,
      caption: `${preset.lenses.length} lenses`,
    }));
  }, [councilPresets, family, shapeTemplates]);

  const presetDialItems = useMemo(() => {
    if (family !== COMPOSER_FAMILIES.SHAPES) return [];
    return shapePresets.map((preset) => ({
      value: preset.id,
      label: preset.name,
      caption: preset.description,
    }));
  }, [family, shapePresets]);

  function updateCustomShape(updater) {
    setCustomShape((current) => {
      if (!current) return current;
      return typeof updater === "function" ? updater(current) : updater;
    });
  }

  function replaceShapeSlot(slotIndex, lens) {
    if (slotIndex <= 1) return;
    if (!customShape) return;

    const slots = buildShapeSlots(customShape, activeTemplate);
    const alreadyUsedIndex = slots.findIndex(
      (slot) => slot.lens?.handle && slot.lens.handle === lens.handle
    );
    if (alreadyUsedIndex >= 0) {
      showToast("That lens is already part of this shape.", "warning");
      return;
    }

    slots[slotIndex - 1] = {
      index: slotIndex,
      lens: {
        ...lens,
        slot: slotIndex,
        role: lens.title,
      },
      locked: false,
    };

    updateCustomShape((current) => ({
      ...current,
      lenses: slots
        .filter((slot) => slot.lens)
        .map((slot) => ({
          ...slot.lens,
          slot: slot.index,
          locked: slot.locked,
        })),
    }));
  }

  function removeShapeSlot(slotIndex) {
    if (slotIndex <= 1 || !customShape) return;
    const slots = buildShapeSlots(customShape, activeTemplate);
    slots[slotIndex - 1] = {
      index: slotIndex,
      lens: null,
      locked: false,
    };
    updateCustomShape((current) => ({
      ...current,
      lenses: slots
        .filter((slot) => slot.lens)
        .map((slot) => ({
          ...slot.lens,
          slot: slot.index,
          locked: slot.locked,
        })),
    }));
  }

  function addCouncilLens(lens) {
    setCustomCouncil((current) => {
      if (current.lenses.some((item) => item.handle === lens.handle)) {
        showToast("That lens is already part of this council.", "warning");
        return current;
      }
      return {
        ...current,
        lenses: [
          ...current.lenses,
          {
            ...lens,
            slot: current.lenses.length + 1,
            role: lens.title,
          },
        ],
      };
    });
  }

  function removeCouncilLens(slotIndex) {
    setCustomCouncil((current) => ({
      ...current,
      lenses: current.lenses
        .filter((_, index) => index !== slotIndex - 1)
        .map((lens, index) => ({ ...lens, slot: index + 1 })),
    }));
  }

  function moveCouncilLens(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    setCustomCouncil((current) => {
      const next = [...current.lenses];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return {
        ...current,
        lenses: next.map((lens, index) => ({ ...lens, slot: index + 1 })),
      };
    });
  }

  function setShapeExecutionRoute(lensHandle, slotId) {
    setCustomShape((current) => {
      if (!current) return current;
      const next = { ...(current.executionRoutes || {}) };
      if (slotId) {
        next[lensHandle] = [slotId];
      } else {
        delete next[lensHandle];
      }
      return { ...current, executionRoutes: next };
    });
  }

  function setCouncilExecutionRoute(lensHandle, slotId) {
    setCustomCouncil((current) => {
      const next = { ...(current.executionRoutes || {}) };
      if (slotId) {
        next[lensHandle] = [slotId];
      } else {
        delete next[lensHandle];
      }
      return { ...current, executionRoutes: next };
    });
  }

  function autocompleteShape() {
    if (!customShape) return;
    const slots = buildShapeSlots(customShape, activeTemplate);
    const existing = new Set(
      slots.map((slot) => slot.lens?.handle).filter(Boolean)
    );
    const canonicalHandles = activeTemplate.defaultCanonicalLensHandles || [];

    canonicalHandles.forEach((handle) => {
      if (existing.has(handle)) return;
      const nextEmpty = slots.find((slot) => !slot.lens && !slot.locked);
      if (!nextEmpty) return;
      const lens = dataset?.lensLookups?.byHandle?.get(handle);
      if (!lens) return;
      existing.add(handle);
      nextEmpty.lens = {
        ...lens,
        slot: nextEmpty.index,
        role: lens.title,
      };
    });

    updateCustomShape((current) => ({
      ...current,
      lenses: slots
        .filter((slot) => slot.lens)
        .map((slot) => ({
          ...slot.lens,
          slot: slot.index,
          locked: slot.locked,
        })),
    }));
  }

  async function saveCurrentMix() {
    if (!activeMix) return;

    // Capture executionRoutes from the live mix before normalizing.
    const liveExecutionRoutes =
      activeMix.executionRoutes && typeof activeMix.executionRoutes === "object"
        ? activeMix.executionRoutes
        : {};

    if (activeMix.mode === "shape") {
      const next = saveShapeMix(activeMix);
      setSavedShapes(loadSavedShapes());
      showToast(`${next?.name || "Shape"} saved.`, "success");
      // Persist server-side; failures are non-blocking.
      saveCustomConstellationToServer({
        ...next,
        kind: "custom-shape",
        executionRoutes: liveExecutionRoutes,
      }).catch((err) =>
        console.warn("[LensComposer] Server-side constellation save failed:", err.message)
      );
      return;
    }

    const next = saveCouncilMix(activeMix);
    setSavedCouncils(loadSavedCouncils());
    showToast(`${next?.name || "Council"} saved.`, "success");
    // Persist server-side; failures are non-blocking.
    saveCustomConstellationToServer({
      ...next,
      kind: "custom-council",
      executionRoutes: liveExecutionRoutes,
    }).catch((err) =>
      console.warn("[LensComposer] Server-side constellation save failed:", err.message)
    );
  }

  function clonePresetIntoCustom() {
    if (family === COMPOSER_FAMILIES.SHAPES && activeShapePreset) {
      setBuildMode(COMPOSER_BUILD_MODES.CUSTOM);
      setCustomShape(cloneMixAsCustom(activeShapePreset, activeTemplate));
      setActiveSlot(2);
      return;
    }

    if (family === COMPOSER_FAMILIES.COUNCILS && activeCouncilPreset) {
      setBuildMode(COMPOSER_BUILD_MODES.CUSTOM);
      setCustomCouncil(cloneMixAsCustom(activeCouncilPreset));
      setActiveSlot(1);
    }
  }

  if (loading || !dataset || !activeMix) {
    return (
      <div className="relative flex h-full w-full overflow-hidden bg-theme-bg-primary">
        {!isMobile ? <Sidebar /> : <SidebarMobileHeader />}
        <main className="prism-route-content w-full px-1 py-20 md:px-6 md:py-6">
          <div className="prism-page-shell flex min-h-[70vh] items-center justify-center">
            <div className="text-sm text-theme-text-secondary">
              Loading the Lens Composer...
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-theme-bg-primary">
      {!isMobile ? <Sidebar /> : <SidebarMobileHeader />}
      <main className="prism-route-content prism-composer-page w-full px-1 py-20 md:px-6 md:py-6">
        <div className="prism-page-shell flex flex-col gap-5">
          <section className="prism-page-hero prism-composer-hero">
            <div className="prism-composer-hero-copy">
              <div className="prism-composer-hero-eyebrow">
                Transformation Agency
              </div>
              <h1 className="prism-composer-hero-title">Lens Composer</h1>
              <p className="prism-composer-hero-description">
                Build strict productivity shapes and freeform reflective
                councils from the existing Metacanon Lens Library, then save
                working mixes locally.
              </p>
              <div className="prism-composer-hero-links">
                <Link
                  to={paths.metacanonAILibrary()}
                  className="prism-composer-text-link"
                >
                  Back to Metacanon Lens Library
                </Link>
              </div>
            </div>
            <div className="prism-composer-hero-stats flex flex-wrap items-center gap-x-4 gap-y-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-theme-text-primary">{shapeTemplates.length}</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-text-secondary">Shapes</span>
              </div>
              <span className="text-theme-text-secondary opacity-40">|</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-theme-text-primary">{dataset.councilPresets.length}</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-text-secondary">Councils</span>
              </div>
            </div>
          </section>

          <section className="prism-composer-topbar prism-page-panel">
            <ComposerSegmentedControl
              label="Orientation"
              value={family}
              onChange={(value) => {
                setFamily(value);
                setActiveSlot(1);
              }}
              options={[
                { value: COMPOSER_FAMILIES.SHAPES, label: "Shapes" },
                { value: COMPOSER_FAMILIES.COUNCILS, label: "Councils" },
              ]}
            />
            <ComposerSegmentedControl
              label="Build Mode"
              value={buildMode}
              onChange={(value) => {
                setBuildMode(value);
                if (value === COMPOSER_BUILD_MODES.PRESETS) {
                  setCustomSubMode(CUSTOM_SUB_MODES.COMPOSE);
                }
              }}
              options={[
                { value: COMPOSER_BUILD_MODES.PRESETS, label: "Presets" },
                {
                  value: COMPOSER_BUILD_MODES.CUSTOM,
                  label: "Create Your Own",
                },
              ]}
            />
            {buildMode === COMPOSER_BUILD_MODES.CUSTOM ? (
              <ComposerSegmentedControl
                label="Custom Mode"
                value={customSubMode}
                onChange={setCustomSubMode}
                options={[
                  { value: CUSTOM_SUB_MODES.COMPOSE, label: "Compose Mix" },
                  { value: CUSTOM_SUB_MODES.CREATE, label: "Create New Lens" },
                ]}
              />
            ) : null}
          </section>

          <section className="prism-composer-grid">
            <div className="prism-composer-column prism-composer-column--selectors">
              <div className="prism-composer-rail">
                <button
                  type="button"
                  className="prism-composer-rail-header w-full text-left flex items-center justify-between"
                  onClick={() => family === COMPOSER_FAMILIES.SHAPES && setShapeDialOpen((prev) => !prev)}
                  aria-expanded={family !== COMPOSER_FAMILIES.SHAPES || shapeDialOpen}
                >
                  <div>
                    <div className="prism-composer-rail-eyebrow">
                      {family === COMPOSER_FAMILIES.SHAPES ? "Shape Dial" : "Council Dial"}
                    </div>
                    <div className="prism-composer-rail-subtitle">
                      {family === COMPOSER_FAMILIES.SHAPES
                        ? "Pick the formation size first."
                        : "Jump between preset councils without backing out."}
                    </div>
                  </div>
                  {family === COMPOSER_FAMILIES.SHAPES ? (
                    <span className="ml-2 text-[10px] text-theme-text-secondary opacity-60 shrink-0">
                      {shapeDialOpen ? "▲" : "▼"}
                    </span>
                  ) : null}
                </button>
                {(family !== COMPOSER_FAMILIES.SHAPES || shapeDialOpen) ? (
                  <div className="prism-composer-rail-list">
                    {selectorItems.map((item) => {
                      const activeVal = family === COMPOSER_FAMILIES.SHAPES ? shapeId : selectedCouncilPresetId;
                      const isSelected = activeVal === item.value;
                      return (
                        <button
                          type="button"
                          key={item.value}
                          className={`prism-composer-rail-item ${isSelected ? "is-active" : ""}`}
                          onClick={() => {
                            if (family === COMPOSER_FAMILIES.SHAPES) {
                              setShapeId(item.value);
                              setActiveSlot(1);
                            } else {
                              setSelectedCouncilPresetId(item.value);
                              setActiveSlot(1);
                            }
                          }}
                        >
                          <div className="prism-composer-rail-copy w-full">
                            <div className="prism-composer-rail-title">{item.label}</div>
                            <div className="prism-composer-rail-meta">{item.caption}</div>
                            {isSelected && family === COMPOSER_FAMILIES.COUNCILS && buildMode === COMPOSER_BUILD_MODES.PRESETS ? (
                              <button
                                type="button"
                                className="mt-1.5 text-[10px] text-theme-text-secondary hover:text-theme-text-primary transition-colors underline-offset-2 hover:underline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  clonePresetIntoCustom();
                                }}
                              >
                                Use as starting point
                              </button>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              {family === COMPOSER_FAMILIES.SHAPES &&
              buildMode === COMPOSER_BUILD_MODES.PRESETS ? (
                <SelectorRail
                  title="Preset Dial"
                  subtitle="Every switch updates the viewer instantly."
                  items={presetDialItems}
                  activeValue={selectedShapePresetId}
                  onSelect={(value) => {
                    setSelectedShapePresetId(value);
                    setActiveSlot(1);
                  }}
                  renderLabel={(item) => (
                    <div className="prism-composer-rail-copy w-full">
                      <div className="prism-composer-rail-title">
                        {item.label}
                      </div>
                      <div className="prism-composer-rail-meta line-clamp-1 text-[11px]">
                        {item.caption}
                      </div>
                      {item.value === selectedShapePresetId ? (
                        <button
                          type="button"
                          className="mt-1.5 text-[10px] text-theme-text-secondary hover:text-theme-text-primary transition-colors underline-offset-2 hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                            clonePresetIntoCustom();
                          }}
                        >
                          Use as starting point
                        </button>
                      ) : null}
                    </div>
                  )}
                />
              ) : null}

              {buildMode === COMPOSER_BUILD_MODES.CUSTOM &&
              customSubMode === CUSTOM_SUB_MODES.COMPOSE ? (
                <LensRoster
                  mix={activeMix}
                  template={activeTemplateForMix}
                  activeSlot={activeSlot}
                  onSelectSlot={setActiveSlot}
                  onRemoveLens={
                    family === COMPOSER_FAMILIES.SHAPES
                      ? removeShapeSlot
                      : removeCouncilLens
                  }
                  onMoveLens={moveCouncilLens}
                  providerSlots={providerSlots}
                  executionRoutes={activeMix?.executionRoutes || {}}
                  onRouteChange={
                    family === COMPOSER_FAMILIES.SHAPES
                      ? setShapeExecutionRoute
                      : setCouncilExecutionRoute
                  }
                />
              ) : null}
            </div>

            <div className="prism-composer-column prism-composer-column--viewer">
              <ShapeWireframeViewer
                mix={activeMix}
                template={activeTemplateForMix}
                activeSlot={activeSlot}
                onSelectSlot={setActiveSlot}
              />

              {buildMode === COMPOSER_BUILD_MODES.CUSTOM &&
              customSubMode === CUSTOM_SUB_MODES.COMPOSE ? (
                <SavedMixes
                  title={
                    family === COMPOSER_FAMILIES.SHAPES
                      ? "Saved Shapes"
                      : "Saved Councils"
                  }
                  items={
                    family === COMPOSER_FAMILIES.SHAPES
                      ? savedShapes
                      : savedCouncils
                  }
                  onApply={(item) => {
                    if (family === COMPOSER_FAMILIES.SHAPES) {
                      setCustomShape(
                        cloneMixAsCustom(
                          item,
                          resolveShapeTemplate(item.shapeId)
                        )
                      );
                      setShapeId(item.shapeId || shapeId);
                      setBuildMode(COMPOSER_BUILD_MODES.CUSTOM);
                      setActiveSlot(2);
                    } else {
                      setCustomCouncil(cloneMixAsCustom(item));
                      setBuildMode(COMPOSER_BUILD_MODES.CUSTOM);
                      setActiveSlot(1);
                    }
                  }}
                  onDelete={(mixId) => {
                    if (family === COMPOSER_FAMILIES.SHAPES) {
                      setSavedShapes(deleteSavedShape(mixId));
                    } else {
                      setSavedCouncils(deleteSavedCouncil(mixId));
                    }
                  }}
                  emptyLabel={
                    family === COMPOSER_FAMILIES.SHAPES
                      ? "Save a completed custom shape to keep it here."
                      : "Save a council mix to keep it here."
                  }
                />
              ) : null}
            </div>

            <div className="prism-composer-column prism-composer-column--actions">
              {!(buildMode === COMPOSER_BUILD_MODES.CUSTOM &&
                customSubMode === CUSTOM_SUB_MODES.CREATE) ? (
              <LensChooser
                title={
                  buildMode === COMPOSER_BUILD_MODES.PRESETS
                    ? "Lens Roster"
                    : family === COMPOSER_FAMILIES.SHAPES
                      ? `Slot ${activeSlot}`
                      : "Council Builder"
                }
                description={
                  buildMode === COMPOSER_BUILD_MODES.PRESETS
                    ? "Inspect the exact lenses inside the active preset."
                    : family === COMPOSER_FAMILIES.SHAPES
                      ? activeSlot === 1
                        ? "Slot one is the locked project manager lens."
                        : "Assign a lens into the active slot."
                      : "Add any lens from the library into this custom council."
                }
                search={lensSearch}
                onSearch={setLensSearch}
                items={
                  buildMode === COMPOSER_BUILD_MODES.PRESETS
                    ? activeMix.lenses || []
                    : availableLenses
                }
                actionLabel={
                  buildMode === COMPOSER_BUILD_MODES.PRESETS
                    ? "Inspect"
                    : family === COMPOSER_FAMILIES.SHAPES
                      ? "Assign"
                      : "Add"
                }
                isInspect={buildMode === COMPOSER_BUILD_MODES.PRESETS}
                onApplyLens={(lens) => {
                  if (buildMode === COMPOSER_BUILD_MODES.PRESETS) {
                    const slot = (activeMix.lenses || []).find(
                      (item) => item.handle === lens.handle
                    );
                    setActiveSlot(slot?.slot || 1);
                    setInspectLensId(lens.id || null);
                    return;
                  }

                  if (family === COMPOSER_FAMILIES.SHAPES) {
                    replaceShapeSlot(activeSlot, lens);
                  } else {
                    addCouncilLens(lens);
                  }
                }}
              />
              ) : null}

              {buildMode === COMPOSER_BUILD_MODES.CUSTOM &&
              customSubMode === CUSTOM_SUB_MODES.COMPOSE ? (
                <SaveMixPanel
                  mix={activeMix}
                  validation={validation}
                  onNameChange={(value) => {
                    if (family === COMPOSER_FAMILIES.SHAPES) {
                      updateCustomShape((current) => ({
                        ...current,
                        name: value,
                      }));
                    } else {
                      setCustomCouncil((current) => ({
                        ...current,
                        name: value,
                      }));
                    }
                  }}
                  onDescriptionChange={(value) => {
                    if (family === COMPOSER_FAMILIES.SHAPES) {
                      updateCustomShape((current) => ({
                        ...current,
                        description: value,
                      }));
                    } else {
                      setCustomCouncil((current) => ({
                        ...current,
                        description: value,
                      }));
                    }
                  }}
                  onSave={saveCurrentMix}
                  onClonePreset={clonePresetIntoCustom}
                  onAutocomplete={autocompleteShape}
                  canAutocomplete={family === COMPOSER_FAMILIES.SHAPES}
                />
              ) : null}

              {buildMode === COMPOSER_BUILD_MODES.CUSTOM &&
              customSubMode === CUSTOM_SUB_MODES.CREATE ? (
                <CustomLensCreatorPanel
                  onRequestPreview={({ title, rawContent, formattedContent }) =>
                    setPreviewModal({
                      open: true,
                      formattedContent,
                      suggestedTitle: title,
                    })
                  }
                />
              ) : null}
            </div>
          </section>
        </div>
      </main>

      <LensFormatPreviewModal
        open={previewModal.open}
        formattedContent={previewModal.formattedContent}
        suggestedTitle={previewModal.suggestedTitle}
        onClose={() =>
          setPreviewModal((current) => ({ ...current, open: false }))
        }
        onLensCreated={() => {
          setPreviewModal((current) => ({ ...current, open: false }));
          // Refresh the dataset so the new lens appears immediately in LensChooser.
          Promise.all([
            fetchLibraryCollection("councils"),
            fetchLibraryCollection("constellations"),
            fetchLibraryCollection("lenses"),
          ])
            .then(([councils, constellations, lenses]) => {
              setDataset(buildComposerDataset({ councils, constellations, lenses }));
            })
            .catch(() => {
              // Non-fatal — user can refresh manually.
            });
        }}
      />

      <LensWorkbenchModal
        open={!!inspectLensId}
        lenses={dataset?.allLenses || []}
        initialLensId={inspectLensId}
        onClose={() => setInspectLensId(null)}
        onSaved={() => setInspectLensId(null)}
      />
    </div>
  );
}
