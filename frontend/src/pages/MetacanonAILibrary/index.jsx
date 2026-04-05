import Sidebar, { SidebarMobileHeader } from "@/components/Sidebar";
import PrismHoverTarget from "@/components/PrismHoverTarget";
import LensWorkbenchModal from "@/components/Metacanon/LensWorkbenchModal";
import {
  buildFeaturedCouncilId,
  buildFeaturedLensId,
  buildPinnedConstellationId,
  deleteFeaturedCouncil,
  deleteFeaturedLens,
  deleteCouncilPack,
  deletePinnedConstellation,
  fetchLibraryCollection,
  fetchLibraryItem,
  fetchLibraryManifest,
  loadFeaturedCouncils,
  loadFeaturedLenses,
  loadCouncilPacks,
  loadPinnedConstellations,
  METACANON_FEATURED_COUNCILS_EVENT,
  METACANON_FEATURED_LENSES_EVENT,
  METACANON_PINNED_CONSTELLATIONS_EVENT,
  reorderFeaturedCouncils,
  reorderFeaturedLenses,
  reorderPinnedConstellations,
  saveFeaturedCouncil,
  saveFeaturedLens,
  savePinnedConstellation,
  saveCouncilPack,
} from "@/models/metacanonLibrary";
import { openMetacanonChat } from "@/utils/metacanonLaunch";
import paths from "@/utils/paths";
import { safeJsonParse } from "@/utils/request";
import showToast from "@/utils/toast";
import {
  METACANON_TERMS,
  getConstellationRoleUiTitle,
  getCouncilUiTitle,
  getLensUiCollectionLabel,
  getLensUiTitle,
  getSubSphereUiTitle,
  sanitizeLensTitle,
  sanitizeLensContentForUi,
  sanitizeUiContent,
} from "@/utils/metacanonTerminology";
import {
  buildPromptForAlignment,
  clearActiveMetacanonAlignment,
  getMetacanonLensAccent,
  isRunnableMetacanonAlignment,
  setActiveMetacanonAlignment,
} from "@/utils/metacanonAlignment";
import useMetacanonAlignment from "@/hooks/useMetacanonAlignment";
import { BookOpen } from "@phosphor-icons/react/dist/csr/BookOpen";
import { FileText } from "@phosphor-icons/react/dist/csr/FileText";
import { FlowArrow } from "@phosphor-icons/react/dist/csr/FlowArrow";
import { Gavel } from "@phosphor-icons/react/dist/csr/Gavel";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { DotsSixVertical } from "@phosphor-icons/react/dist/csr/DotsSixVertical";

import { isMobile } from "react-device-detect";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_BASE = (import.meta.env.VITE_API_BASE || "/api").replace(/\/$/, "");
const DRAFT_CONSTELLATION_STORAGE_KEY =
  "anythingllm_metacanon_draft_constellation";

const TABS = [
  {
    id: "councils",
    label: METACANON_TERMS.councils,
    icon: <Gavel className="h-4 w-4" weight="fill" />,
  },
  {
    id: "lenses",
    label: METACANON_TERMS.lenses,
    icon: <BookOpen className="h-4 w-4" weight="fill" />,
  },
  {
    id: "constellations",
    label: "Preset Constellations",
    icon: <FlowArrow className="h-4 w-4" weight="bold" />,
  },
  {
    id: "packs",
    label: "Saved Constellations",
    icon: <FileText className="h-4 w-4" weight="fill" />,
  },
  {
    id: "skills",
    label: "Skills",
    icon: <FileText className="h-4 w-4" weight="fill" />,
  },
  {
    id: "constitution",
    label: METACANON_TERMS.governanceDocuments,
    icon: <Gavel className="h-4 w-4" weight="fill" />,
  },
];

const ALL_LENS_COLLECTIONS = "all-lenses";
const MIN_CUSTOM_CONSTELLATION_LENSES = 2;
const EMPTY_LIBRARY_MANIFEST = {
  generatedAt: null,
  counts: {
    councils: 0,
    lenses: 0,
    constellations: 0,
    skills: 0,
    constitution: 0,
  },
  collections: {},
};

function getLensDisplayTitle(lens = {}) {
  return getLensUiTitle(lens);
}

function getLensCollectionLabel(lens = {}) {
  return getLensUiCollectionLabel(lens);
}

function getLensCollectionKey(lens = {}) {
  return (
    lens.collectionId || lens.councilId || lens.boardSlug || lens.board || ""
  );
}

function getPackKindLabel(item = {}) {
  if (item.kind === "constellation") return "Preset Configuration";
  if (item.kind === "council") return "Custom Council";
  if (item.kind === "custom") return "Custom Constellation";
  return item.kind || "Constellation";
}

function getItemDisplayTitle(item = {}, tab = "lenses") {
  if (tab === "councils") return getCouncilUiTitle(item);
  if (tab === "lenses") return getLensDisplayTitle(item);
  if (tab === "constellations") return getSubSphereUiTitle(item);
  return item.title || item.name;
}

function getItemSnippet(item = {}, tab = "lenses") {
  if (tab === "councils") {
    return `${item.lensCount} ${METACANON_TERMS.lenses}${item.phase ? ` • ${item.phase}` : ""}`;
  }

  if (tab === "lenses") {
    const overview = sanitizeUiContent(item.overview || "").trim();
    if (overview) return overview;

    const contentPreview = sanitizeLensContentForUi(item.content || "", item)
      .split("\n")
      .map((line) => line.trim())
      .filter(
        (line) =>
          line &&
          !line.startsWith("#") &&
          !/^\*\s+\*\*(PCL ID|Version|Activation Date|Prism Holder|Accountability Member|Governing Documents|Sovereign Veto|Audit Logging|Revocation)\*\*/i.test(
            line
          )
      )
      .slice(0, 2)
      .join(" ");

    return contentPreview || item.phase || "";
  }

  if (tab === "constellations") return item.purpose;
  if (tab === "packs") {
    if (item.kind === "constellation") {
      return `Preset-derived saved constellation${item.leadTitle ? ` • Lead ${item.leadTitle}` : ""}`;
    }

    if (item.kind === "council") {
      return `Custom-built council${item.lensHandles?.length ? ` • ${item.lensHandles.length} lenses` : ""}${item.leadTitle ? ` • Lead ${item.leadTitle}` : ""}`;
    }

    return `Custom-built saved constellation • ${item.lensHandles?.length || 0} lenses${item.leadTitle ? ` • Lead ${item.leadTitle}` : ""}`;
  }

  if (tab === "skills") return item.description;
  return item.content?.split("\n").slice(1, 4).join(" ");
}

function getDeletePackLabel(item = {}) {
  if (item.kind === "council") return "Delete Custom Council";
  return item.kind === "custom"
    ? "Delete Custom Constellation"
    : "Delete Preset Configuration";
}

function getDetailLabel(tab = "lenses") {
  if (tab === "councils") return METACANON_TERMS.council;
  if (tab === "lenses") return "Lens";
  if (tab === "constellations") return "Preset Constellation";
  if (tab === "packs") return "Saved Constellation";
  if (tab === "skills") return "Skill";
  return "Governance Document";
}

function getPackSectionLabel(item = {}) {
  if (item.kind === "council") return `Featured ${METACANON_TERMS.councils}`;
  return `Sidebar ${METACANON_TERMS.constellations}`;
}

function getConstellationModeCopy(
  tab = "councils",
  draftMode = "constellation"
) {
  if (tab === "constellations") {
    return {
      eyebrow: "Preset Constellations",
      title: "Canonical multi-lens formations",
      description:
        "These are predefined library patterns. Run them directly, pin them to the sidebar, or save them into your own saved constellation stack.",
    };
  }

  if (tab === "packs") {
    return {
      eyebrow: "Saved Constellations",
      title: "Reusable alignments with memory",
      description:
        "These are the constellations you saved. They preserve their lens roster, lead lens, and repeatable execution mode for later use.",
    };
  }

  return {
    eyebrow: "Custom Draft",
    title:
      draftMode === "council"
        ? "Build a council from live parts"
        : "Build a constellation from live parts",
    description:
      draftMode === "council"
        ? "Combine councils or individual lenses, choose the lead lens, then activate, run, or save the draft as your own reusable council."
        : "Combine councils or individual lenses, choose the lead lens, then activate, run, or save the draft as your own reusable constellation.",
  };
}

function getDraftModeMeta(draftMode = "constellation") {
  if (draftMode === "council") {
    return {
      title: "Custom Council",
      defaultName: "Custom Council",
      savedKind: "council",
      collectionLabel: METACANON_TERMS.councils,
      activateCopy: "custom council",
      saveCopy: "Council",
      clearCopy: "Council",
      nameLabel: "Council Name",
      nameHelper:
        "This is the name shown when the council is saved or featured in the sidebar.",
      namePlaceholder: "Name this custom council",
    };
  }

  return {
    title: "Custom Constellation",
    defaultName: "Custom Constellation",
    savedKind: "custom",
    collectionLabel: METACANON_TERMS.savedConstellations,
    activateCopy: "custom constellation",
    saveCopy: "Constellation",
    clearCopy: "Constellation",
    nameLabel: "Constellation Name",
    nameHelper:
      "This is the name shown when the constellation is saved for reuse.",
    namePlaceholder: "Name this custom constellation",
  };
}

function shouldReplaceDraftName(currentName = "") {
  const normalized = String(currentName || "").trim();
  if (!normalized) return true;
  return ["Custom Constellation", "Custom Council"].includes(normalized);
}

function normalizeDraftLens(item = {}) {
  const handle = item.handle || item.lensHandle || "";
  const title =
    item.displayTitle ||
    item.lensTitle ||
    item.title ||
    sanitizeLensTitle(item.relativePath || handle);

  return {
    id: item.id || handle || title,
    handle,
    title,
    colorHex: getMetacanonLensAccent(item),
    preferredBackends: Array.from(
      new Set(
        (Array.isArray(item.preferredBackends) ? item.preferredBackends : [])
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      )
    ),
    fallbackBackends: Array.from(
      new Set(
        (Array.isArray(item.fallbackBackends) ? item.fallbackBackends : [])
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      )
    ),
  };
}

function buildExecutionRoutesFromLenses(lenses = []) {
  return Object.fromEntries(
    lenses
      .map(normalizeDraftLens)
      .map((lens) => [
        lens.handle,
        Array.from(
          new Set([
            ...(lens.preferredBackends || []),
            ...(lens.fallbackBackends || []),
          ])
        ),
      ])
      .filter(
        ([handle, backends]) =>
          String(handle || "")
            .trim()
            .startsWith("@") &&
          Array.isArray(backends) &&
          backends.length > 0
      )
  );
}

function getDraftConstellation(
  alignmentName = "",
  draftLenses = [],
  draftLeadHandle = "",
  draftMode = "constellation"
) {
  const draftModeMeta = getDraftModeMeta(draftMode);
  const normalizedLenses = draftLenses
    .map(normalizeDraftLens)
    .filter((lens) => lens.handle);
  const leadLens =
    normalizedLenses.find((lens) => lens.handle === draftLeadHandle) ||
    normalizedLenses[0] ||
    null;

  return {
    id: `draft-${String(alignmentName || draftModeMeta.defaultName)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}`,
    title: String(alignmentName || "").trim() || draftModeMeta.defaultName,
    kind: "pack",
    savedKind: draftModeMeta.savedKind,
    collectionLabel: draftModeMeta.collectionLabel,
    lensHandles: Array.from(
      new Set(normalizedLenses.map((lens) => lens.handle))
    ),
    lensTitles: Array.from(
      new Set(normalizedLenses.map((lens) => lens.title).filter(Boolean))
    ),
    leadHandle: leadLens?.handle || null,
    leadTitle: leadLens?.title || null,
    executionRoutes: buildExecutionRoutesFromLenses(normalizedLenses),
    colorHex: getMetacanonLensAccent({
      colorHex: leadLens?.colorHex || normalizedLenses[0]?.colorHex,
    }),
  };
}

function validateDraftConstellation(draft = {}) {
  const lensCount = draft.lensHandles?.length || 0;
  const formationTitle =
    draft.savedKind === "council" ? "Council" : "Constellation";
  if (lensCount === 0) {
    return {
      valid: false,
      message: `Add at least one Lens to build a ${formationTitle}.`,
    };
  }

  if (lensCount < MIN_CUSTOM_CONSTELLATION_LENSES) {
    return {
      valid: false,
      message: `Add at least ${MIN_CUSTOM_CONSTELLATION_LENSES} Lenses to run a custom ${formationTitle}.`,
    };
  }

  return { valid: true, message: "" };
}

function buildCouncilAlignment(council = {}) {
  return {
    id: council.id,
    title: getCouncilUiTitle(council),
    kind: "pack",
    collectionLabel: METACANON_TERMS.councils,
    lensHandles: council.lensHandles || [],
    lensTitles: (council.lenses || []).map((lens) => getLensDisplayTitle(lens)),
    executionRoutes: buildExecutionRoutesFromLenses(council.lenses || []),
    colorHex:
      council.lenses?.[0]?.colorHex ||
      getMetacanonLensAccent(council.lenses?.[0] || {}),
  };
}

function buildLensAlignment(lens = {}) {
  return {
    ...lens,
    id: lens.id,
    title: getLensDisplayTitle(lens),
    collectionLabel: getLensCollectionLabel(lens),
    colorHex: getMetacanonLensAccent(lens),
  };
}

function buildConstellationAlignment(constellation = {}) {
  return {
    id: constellation.id,
    title: getSubSphereUiTitle(constellation),
    kind: "constellation",
    handle: constellation.handle,
    sourceId: constellation.id,
    description: constellation.purpose || "",
    collectionLabel: METACANON_TERMS.subSpheres,
    colorHex: getMetacanonLensAccent({
      colorHex: constellation.projectManagerColorHex,
    }),
  };
}

function buildSavedPackAlignment(pack = {}) {
  if (pack.kind === "constellation" && pack.handle) {
    return {
      id: pack.sourceId || pack.id,
      title: pack.name,
      kind: "constellation",
      handle: pack.handle,
      sourceId: pack.sourceId || pack.id,
      description: pack.description || "",
      collectionLabel: "Preset Configuration",
      colorHex: pack.colorHex || "#d4a63e",
    };
  }

  return {
    id: pack.id,
    title: pack.name,
    kind: "pack",
    sourceId: pack.sourceId || null,
    description: pack.description || "",
    collectionLabel:
      pack.collectionLabel ||
      (pack.kind === "constellation"
        ? "Preset Configuration"
        : METACANON_TERMS.savedConstellations),
    lensHandles: pack.lensHandles || [],
    lensTitles: pack.lensTitles || [],
    leadHandle: pack.leadHandle || null,
    leadTitle: pack.leadTitle || null,
    executionRoutes: (() => {
      if (pack.executionRoutes && typeof pack.executionRoutes === "object") {
        return pack.executionRoutes;
      }
      return {};
    })(),
    colorHex: pack.colorHex || "#d4a63e",
  };
}

function StatusTile({ label, value, className = "" }) {
  return (
    <div className={`flex items-baseline gap-1.5 ${className}`.trim()}>
      <span className="text-lg font-bold text-theme-text-primary">{value}</span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-text-secondary">
        {label}
      </span>
    </div>
  );
}

function ConstellationModeTile({
  eyebrow,
  title,
  description,
  emphasis = false,
}) {
  return (
    <div
      className={`rounded-[10px] border px-3 py-2 ${
        emphasis
          ? "border-primary-button bg-theme-sidebar-item-selected"
          : "border-theme-sidebar-border"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-theme-primary-button">
        {eyebrow}
      </div>
      <div className="mt-1 text-xs font-semibold text-theme-text-primary">
        {title}
      </div>
    </div>
  );
}

function TabButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition-all ${
        active
          ? "border-primary-button bg-theme-sidebar-item-selected text-theme-text-primary"
          : "border-theme-sidebar-border bg-transparent text-theme-text-secondary hover:bg-theme-sidebar-subitem-hover"
      }`}
    >
      {label}
    </button>
  );
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <label className="relative block w-full">
      <MagnifyingGlass
        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-theme-text-secondary"
        weight="bold"
      />

      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="metacanon-sidebar-search prism-library-input h-[38px] w-full rounded-[10px] border-none pl-10 pr-3 text-sm text-theme-text-primary outline-none placeholder:text-theme-settings-input-placeholder"
      />
    </label>
  );
}

function FilterSelect({ label, options, value, onChange }) {
  return (
    <label className="flex min-w-[220px] flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="metacanon-sidebar-search prism-library-input h-[38px] rounded-[10px] border-none px-3 text-sm text-theme-text-primary outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionButton({
  label,
  onClick,
  variant = "secondary",
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`prism-library-action rounded-full px-2.5 py-1 text-[11px] transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
        variant === "primary"
          ? "prism-library-action--primary border border-primary-button bg-primary-button text-white hover:opacity-90"
          : "prism-library-action--secondary border border-theme-sidebar-border text-theme-text-secondary hover:text-theme-text-primary"
      }`}
    >
      {label}
    </button>
  );
}

function ActionLink({ label, href, variant = "secondary" }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`prism-library-action inline-flex rounded-full px-2.5 py-1 text-[11px] transition-all ${
        variant === "primary"
          ? "prism-library-action--primary border border-primary-button bg-primary-button text-white hover:opacity-90"
          : "prism-library-action--secondary border border-theme-sidebar-border text-theme-text-secondary hover:text-theme-text-primary"
      }`}
    >
      {label}
    </a>
  );
}

function SidebarSectionManager({
  title,
  eyebrow,
  description,
  items = [],
  getItemTitle = (item) => item?.title || "Untitled",
  getItemMeta = () => "",
  onMove = () => {},
  onRemove = () => {},
  emptyLabel = "Nothing added yet.",
}) {
  const [draggedItemKey, setDraggedItemKey] = useState(null);

  function getItemKey(item = {}, index = 0) {
    return item.pinId || item.featureId || item.id || `${title}-${index}`;
  }

  return (
    <div className="rounded-[8px] border border-theme-sidebar-border px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-theme-primary-button">
            {eyebrow}
          </div>
          <div className="mt-1 text-xs font-semibold text-theme-text-primary">
            {title}
          </div>
        </div>
        <div className="rounded-full border border-theme-sidebar-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
          {items.length} live
        </div>
      </div>
      {items.length > 0 ? (
        <div className="mt-2 flex flex-col gap-2">
          {items.map((item, index) => (
            <div
              key={getItemKey(item, index)}
              draggable
              onDragStart={() => setDraggedItemKey(getItemKey(item, index))}
              onDragEnd={() => setDraggedItemKey(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                const sourceIndex = items.findIndex(
                  (entry, entryIndex) =>
                    getItemKey(entry, entryIndex) === draggedItemKey
                );
                if (sourceIndex >= 0 && sourceIndex !== index) {
                  onMove(sourceIndex, index);
                }
                setDraggedItemKey(null);
              }}
              className={`rounded-[8px] border px-2 py-1.5 transition-all ${
                draggedItemKey === getItemKey(item, index)
                  ? "border-primary-button bg-theme-sidebar-item-selected"
                  : "border-theme-sidebar-border bg-theme-bg-container hover:bg-theme-sidebar-subitem-hover"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex cursor-grab items-center justify-center rounded-full border border-theme-sidebar-border bg-theme-bg-sidebar px-1.5 py-0.5 text-theme-text-secondary"
                      title="Drag to reorder"
                    >
                      <DotsSixVertical className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-theme-text-primary">
                    {getItemTitle(item)}
                  </div>
                  <div className="mt-0.5 text-[10px] leading-4 text-theme-text-secondary">
                    {getItemMeta(item)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onRemove(item)}
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-theme-text-secondary transition-colors hover:text-theme-text-primary"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 rounded-[8px] border border-theme-sidebar-border/40 bg-theme-bg-container px-3 py-2 text-[11px] leading-4 text-theme-text-secondary">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}

function ItemCard({
  active,
  title,
  meta,
  snippet,
  badge = null,
  accent = null,
  onClick,
  targetId,
}) {
  const card = (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[8px] border px-3 py-2 text-left transition-all ${
        active
          ? "border-primary-button bg-theme-sidebar-item-selected"
          : "border-theme-sidebar-border bg-theme-bg-container hover:bg-theme-sidebar-subitem-hover"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-theme-primary-button">
          {meta}
        </div>
        {badge ? (
          <div
            className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{
              borderColor: accent || "var(--theme-sidebar-border)",
              color: accent || "var(--theme-text-secondary)",
            }}
          >
            {badge}
          </div>
        ) : null}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-theme-text-primary">
        {title}
      </div>
      {snippet ? (
        <div className="mt-1 line-clamp-1 text-xs leading-4 text-theme-text-secondary">
          {snippet}
        </div>
      ) : null}
    </button>
  );

  return targetId ? (
    <PrismHoverTarget targetId={targetId}>{card}</PrismHoverTarget>
  ) : (
    card
  );
}

function DetailMeta({ label, value, monospace = false }) {
  if (!value) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-2 py-1 border-b border-theme-sidebar-border/40 last:border-0">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary shrink-0 min-w-[80px]">
        {label}
      </span>
      <span
        className={`break-words leading-5 text-theme-text-primary flex-1 ${
          monospace ? "font-mono text-xs" : "text-xs"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function reorderDraftItems(items = [], startIndex, endIndex) {
  const reordered = Array.from(items);
  const [removed] = reordered.splice(startIndex, 1);
  reordered.splice(endIndex, 0, removed);
  return reordered;
}

function RawContent({ content, lens = null }) {
  if (!content) {
    return (
      <div className="prism-page-card text-sm leading-7 text-theme-text-secondary">
        This governance document is referenced in the library, but its raw text
        is not embedded in the app yet.
      </div>
    );
  }

  return (
    <div className="prism-page-card prism-library-panel-card">
      <pre className="whitespace-pre-wrap break-words font-[inherit] text-sm leading-7 text-theme-text-primary">
        {lens
          ? sanitizeLensContentForUi(content, lens)
          : sanitizeUiContent(content)}
      </pre>
    </div>
  );
}

function renderDetail(item, tab) {
  if (!item) return null;

  if (tab === "councils") {
    return (
      <div className="flex flex-col gap-4">
        <DetailMeta label="Council" value={getCouncilUiTitle(item)} />
        <DetailMeta label="Council ID" value={item.id} />
        <DetailMeta
          label={METACANON_TERMS.lenses}
          value={String(item.lensCount)}
        />
        <DetailMeta label="Phase" value={item.phase} />
        <div className="rounded-[8px] border border-theme-sidebar-border bg-theme-bg-sidebar px-3 py-2">
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-theme-text-secondary">
            Council Lenses
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {(item.lenses || []).map((lens) => (
              <div
                key={lens.id}
                className="rounded-[6px] border border-theme-sidebar-border bg-theme-bg-container px-2.5 py-1.5"
              >
                <div className="text-xs font-semibold text-theme-text-primary">
                  {getLensDisplayTitle(lens)}
                </div>
                {lens.phase ? (
                  <div className="mt-1 text-xs leading-4 text-theme-text-secondary">
                    {lens.phase}
                  </div>
                ) : null}
                <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-theme-primary-button">
                  {lens.handle}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (tab === "constellations") {
    return (
      <div className="flex flex-col gap-4">
        <DetailMeta label="Invocation Handle" value={item.handle} monospace />
        <DetailMeta label="Preset Geometry" value={item.type} />
        <DetailMeta label="Purpose" value={item.purpose} />
        <DetailMeta
          label="Prism Steward"
          value={sanitizeLensTitle(
            item.projectManagerTitle || item.projectManagerRelativePath
          )}
        />

        <div className="rounded-[8px] border border-theme-sidebar-border bg-theme-bg-sidebar px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
            Lenses
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {(item.members || []).map((member) => (
              <div
                key={`${item.id}-${member.role}-${member.relativePath}`}
                className="rounded-[8px] border border-theme-sidebar-border bg-theme-bg-container px-3 py-2"
              >
                <div className="text-sm font-semibold text-theme-text-primary">
                  {getConstellationRoleUiTitle(member)}
                </div>
                <div className="mt-1 text-xs leading-6 text-theme-text-secondary">
                  {sanitizeLensTitle(member.lensTitle || member.relativePath)}
                </div>
                {member.lensHandle ? (
                  <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-theme-primary-button">
                    {member.lensHandle}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <DetailMeta label="Source" value={item.relativePath} />
      </div>
    );
  }

  if (tab === "skills") {
    return (
      <div className="flex flex-col gap-4">
        <DetailMeta label="Description" value={item.description} />
        <DetailMeta label="Source" value={item.relativePath} />
        <RawContent content={item.content} lens={item} />
      </div>
    );
  }

  if (tab === "constitution") {
    return (
      <div className="flex flex-col gap-4">
        <DetailMeta label="Format" value={item.format.toUpperCase()} />
        <DetailMeta label="Source" value={item.relativePath} />
        <RawContent content={item.content} />
      </div>
    );
  }

  if (tab === "packs") {
    return (
      <div className="flex flex-col gap-4">
        <DetailMeta label="Type" value={getPackKindLabel(item)} />
        <DetailMeta
          label={METACANON_TERMS.lenses}
          value={String(item.lensHandles.length)}
        />
        <DetailMeta
          label="Execution Mode"
          value={
            item.kind === "constellation"
              ? "Preset constellation orchestration"
              : item.kind === "council"
                ? "Custom council orchestration with Prism synthesis"
                : "Custom council-pack orchestration with Prism synthesis"
          }
        />
        {item.leadTitle || item.leadHandle ? (
          <DetailMeta
            label="Lead Lens"
            value={item.leadTitle || item.leadHandle}
          />
        ) : null}
        <DetailMeta
          label="Handles"
          value={item.lensHandles.join(", ")}
          monospace
        />
        {item.kind === "constellation" && item.handle ? (
          <DetailMeta label="Preset Handle" value={item.handle} monospace />
        ) : null}
        {item.lensTitles?.length ? (
          <DetailMeta label="Lens Titles" value={item.lensTitles.join(", ")} />
        ) : null}

        <DetailMeta
          label="Created"
          value={new Date(item.createdAt).toLocaleString()}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DetailMeta label="Invocation Handle" value={item.handle} monospace />
      <DetailMeta
        label={item.collectionKind === "council" ? "Council" : "Studio"}
        value={getLensCollectionLabel(item)}
      />

      <DetailMeta label="Council" value={item.councilName} />
      <DetailMeta label="Phase" value={item.phase} />
      <DetailMeta label="Source Format" value={item.sourceFormat} />
      <DetailMeta label="Source" value={item.relativePath} />
      <RawContent content={item.content} lens={item} />
    </div>
  );
}

export default function MetacanonAILibraryPage() {
  const navigate = useNavigate();
  const activeAlignment = useMetacanonAlignment();
  const [tab, setTab] = useState("councils");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [runPrompt, setRunPrompt] = useState("");
  const [savedPacks, setSavedPacks] = useState([]);
  const [pinnedConstellations, setPinnedConstellations] = useState([]);
  const [featuredLenses, setFeaturedLenses] = useState([]);
  const [featuredCouncils, setFeaturedCouncils] = useState([]);
  const [draftLenses, setDraftLenses] = useState(() => {
    if (typeof window === "undefined") return [];
    const draft = safeJsonParse(
      localStorage.getItem(DRAFT_CONSTELLATION_STORAGE_KEY),
      {}
    );
    return Array.isArray(draft?.lenses)
      ? draft.lenses.map(normalizeDraftLens).filter((lens) => lens.handle)
      : [];
  });
  const [draftName, setDraftName] = useState(() => {
    if (typeof window === "undefined") return "Custom Constellation";
    const draft = safeJsonParse(
      localStorage.getItem(DRAFT_CONSTELLATION_STORAGE_KEY),
      {}
    );
    return String(draft?.name || "").trim() || "Custom Constellation";
  });
  const [draftMode, setDraftMode] = useState(() => {
    if (typeof window === "undefined") return "constellation";
    const draft = safeJsonParse(
      localStorage.getItem(DRAFT_CONSTELLATION_STORAGE_KEY),
      {}
    );
    return draft?.mode === "council" ? "council" : "constellation";
  });
  const [draftLeadHandle, setDraftLeadHandle] = useState(() => {
    if (typeof window === "undefined") return "";
    const draft = safeJsonParse(
      localStorage.getItem(DRAFT_CONSTELLATION_STORAGE_KEY),
      {}
    );
    return String(draft?.leadHandle || "").trim();
  });
  const [draggedDraftHandle, setDraggedDraftHandle] = useState(null);
  const [lensFilter, setLensFilter] = useState(ALL_LENS_COLLECTIONS);
  const [running, setRunning] = useState(false);
  const [libraryManifest, setLibraryManifest] = useState(
    EMPTY_LIBRARY_MANIFEST
  );
  const [libraryCollections, setLibraryCollections] = useState({});
  const [loadingManifest, setLoadingManifest] = useState(true);
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [lensWorkbenchOpen, setLensWorkbenchOpen] = useState(false);

  useEffect(() => {
    setSavedPacks(loadCouncilPacks());
    setPinnedConstellations(loadPinnedConstellations());
    setFeaturedLenses(loadFeaturedLenses());
    setFeaturedCouncils(loadFeaturedCouncils());
  }, []);

  useEffect(() => {
    function syncPinnedConstellations(event) {
      if (event?.type === "storage") {
        setPinnedConstellations(loadPinnedConstellations());
        return;
      }
      setPinnedConstellations(event?.detail ?? loadPinnedConstellations());
    }

    window.addEventListener(
      METACANON_PINNED_CONSTELLATIONS_EVENT,
      syncPinnedConstellations
    );
    window.addEventListener("storage", syncPinnedConstellations);
    return () => {
      window.removeEventListener(
        METACANON_PINNED_CONSTELLATIONS_EVENT,
        syncPinnedConstellations
      );
      window.removeEventListener("storage", syncPinnedConstellations);
    };
  }, []);

  useEffect(() => {
    function syncFeaturedLenses(event) {
      if (event?.type === "storage") {
        setFeaturedLenses(loadFeaturedLenses());
        return;
      }
      setFeaturedLenses(event?.detail ?? loadFeaturedLenses());
    }

    window.addEventListener(
      METACANON_FEATURED_LENSES_EVENT,
      syncFeaturedLenses
    );
    window.addEventListener("storage", syncFeaturedLenses);
    return () => {
      window.removeEventListener(
        METACANON_FEATURED_LENSES_EVENT,
        syncFeaturedLenses
      );
      window.removeEventListener("storage", syncFeaturedLenses);
    };
  }, []);

  useEffect(() => {
    function syncFeaturedCouncils(event) {
      if (event?.type === "storage") {
        setFeaturedCouncils(loadFeaturedCouncils());
        return;
      }
      setFeaturedCouncils(event?.detail ?? loadFeaturedCouncils());
    }

    window.addEventListener(
      METACANON_FEATURED_COUNCILS_EVENT,
      syncFeaturedCouncils
    );
    window.addEventListener("storage", syncFeaturedCouncils);
    return () => {
      window.removeEventListener(
        METACANON_FEATURED_COUNCILS_EVENT,
        syncFeaturedCouncils
      );
      window.removeEventListener("storage", syncFeaturedCouncils);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      DRAFT_CONSTELLATION_STORAGE_KEY,
      JSON.stringify({
        name: draftName,
        mode: draftMode,
        lenses: draftLenses,
        leadHandle: draftLeadHandle,
      })
    );
  }, [draftLenses, draftLeadHandle, draftMode, draftName]);

  useEffect(() => {
    if (draftLenses.length === 0) {
      if (draftLeadHandle) setDraftLeadHandle("");
      return;
    }

    if (!draftLeadHandle) {
      setDraftLeadHandle(draftLenses[0]?.handle || "");
      return;
    }

    if (!draftLenses.some((lens) => lens.handle === draftLeadHandle)) {
      setDraftLeadHandle(draftLenses[0]?.handle || "");
    }
  }, [draftLeadHandle, draftLenses]);

  const activeCollectionLoaded = Boolean(libraryCollections[tab]);

  useEffect(() => {
    let cancelled = false;

    async function loadManifest() {
      setLoadingManifest(true);
      try {
        const nextManifest = await fetchLibraryManifest();
        if (cancelled) return;
        setLibraryManifest(nextManifest);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          showToast("Failed to load the Metacanon library.", "error");
        }
      } finally {
        if (!cancelled) setLoadingManifest(false);
      }
    }

    loadManifest();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (tab === "packs" || activeCollectionLoaded) return;

    let cancelled = false;
    setLoadingCollection(true);

    fetchLibraryCollection(tab)
      .then((items) => {
        if (cancelled) return;
        setLibraryCollections((current) => ({
          ...current,
          [tab]: items,
        }));
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          showToast(
            `Failed to load the ${getDetailLabel(tab).toLowerCase()} collection.`,
            "error"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCollection(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeCollectionLoaded, tab]);

  const councilItems = useMemo(() => {
    return libraryCollections.councils || [];
  }, [libraryCollections]);

  const lensItems = useMemo(() => {
    return libraryCollections.lenses || [];
  }, [libraryCollections]);

  const refreshLibrarySlice = async ({
    refreshManifest = false,
    tabs = [],
    selectedLensId = null,
  } = {}) => {
    try {
      const nextTabs = Array.from(
        new Set(tabs.filter(Boolean).concat(selectedLensId ? ["lenses"] : []))
      );

      const [manifestPayload, ...collections] = await Promise.all([
        refreshManifest ? fetchLibraryManifest() : Promise.resolve(null),
        ...nextTabs.map((nextTab) => fetchLibraryCollection(nextTab)),
      ]);

      if (manifestPayload) {
        setLibraryManifest(manifestPayload);
      }

      if (nextTabs.length > 0) {
        setLibraryCollections((current) => {
          const next = { ...current };
          nextTabs.forEach((nextTab, index) => {
            next[nextTab] = collections[index];
          });
          return next;
        });
      }

      if (selectedLensId) {
        setTab("lenses");
        setSelectedId(selectedLensId);
      }
    } catch (error) {
      console.error(error);
      showToast("Failed to refresh the lens library.", "error");
    }
  };

  const openLensWorkbench = async () => {
    if (!libraryCollections.lenses) {
      await refreshLibrarySlice({ tabs: ["lenses"] });
    }
    setLensWorkbenchOpen(true);
  };

  const lensFilterOptions = useMemo(() => {
    const byCollection = new Map();

    lensItems.forEach((lens) => {
      const value = getLensCollectionKey(lens);
      if (!value) return;

      const current = byCollection.get(value);
      const label = getLensCollectionLabel(lens);
      const sortOrder =
        lens.collectionKind === "council" ? lens.sortOrder || 0 : 10_000;

      byCollection.set(value, {
        value,
        label,
        count: (current?.count || 0) + 1,
        sortOrder: current ? current.sortOrder : sortOrder,
      });
    });

    return [
      {
        value: ALL_LENS_COLLECTIONS,
        label: `All ${libraryManifest.counts.lenses} Lenses`,
      },
      ...Array.from(byCollection.values())
        .sort((left, right) => {
          if (left.sortOrder !== right.sortOrder)
            return left.sortOrder - right.sortOrder;
          return left.label.localeCompare(right.label);
        })
        .map((option) => ({
          value: option.value,
          label: `${option.label} (${option.count})`,
        })),
    ];
  }, [lensItems, libraryManifest]);

  const activeCollection = useMemo(() => {
    if (tab === "councils") return councilItems;
    if (tab === "packs") return savedPacks;
    const collection = libraryCollections[tab] ?? [];
    if (tab !== "lenses" || lensFilter === ALL_LENS_COLLECTIONS)
      return collection;

    return collection.filter(
      (item) => getLensCollectionKey(item) === lensFilter
    );
  }, [councilItems, libraryCollections, savedPacks, tab, lensFilter]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return activeCollection;

    return activeCollection.filter((item) =>
      JSON.stringify(item).toLowerCase().includes(query)
    );
  }, [activeCollection, search]);

  const selectedItem = useMemo(() => {
    if (!filteredItems.length) return null;
    return (
      filteredItems.find((item) => item.id === selectedId) || filteredItems[0]
    );
  }, [filteredItems, selectedId]);

  useEffect(() => {
    if (tab === "packs" || !selectedItem?.id) {
      setSelectedDetail(null);
      setLoadingDetail(false);
      return;
    }

    let cancelled = false;
    setLoadingDetail(true);
    setSelectedDetail(null);

    fetchLibraryItem(tab, selectedItem.id)
      .then((item) => {
        if (!cancelled) setSelectedDetail(item);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          showToast("Failed to load the selected item.", "error");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedItem?.id, tab]);

  const selectedDocumentHref = useMemo(() => {
    const relativePath =
      selectedDetail?.repoRelativePath || selectedItem?.repoRelativePath;
    if (tab !== "constitution" || !relativePath) return null;
    return `${API_BASE}/metacanonai/governance/file?path=${encodeURIComponent(
      relativePath
    )}`;
  }, [selectedDetail, selectedItem, tab]);

  const setActiveTab = (nextTab) => {
    setTab(nextTab);
    setSearch("");
    setSelectedId(null);
  };

  const clearDraftAlignmentIfActive = (draftId = `draft-${draftMode}`) => {
    if (activeAlignment?.id === draftId) {
      clearActiveMetacanonAlignment();
    }
  };

  const addLensToDraft = (lens) => {
    const nextLens = normalizeDraftLens(lens);
    let added = false;
    setDraftLenses((current) => {
      if (current.some((item) => item.handle === nextLens.handle)) {
        return current;
      }
      added = true;
      return [...current, nextLens];
    });
    showToast(
      added
        ? `${getLensDisplayTitle(lens)} added to the draft Constellation.`
        : `${getLensDisplayTitle(lens)} is already in the draft Constellation.`,
      added ? "success" : "info"
    );
  };

  const addCouncilToDraft = (council) => {
    const nextLenses = (council.lenses || []).map(normalizeDraftLens);
    let addedCount = 0;
    setDraftLenses((current) => {
      const byHandle = new Map(current.map((item) => [item.handle, item]));
      nextLenses.forEach((lens) => {
        if (!lens.handle || byHandle.has(lens.handle)) return;
        byHandle.set(lens.handle, lens);
        addedCount += 1;
      });
      return Array.from(byHandle.values());
    });
    showToast(
      addedCount > 0
        ? `${getCouncilUiTitle(council)} added ${addedCount} Lens${addedCount === 1 ? "" : "es"} to the draft Constellation.`
        : `${getCouncilUiTitle(council)} is already fully represented in the draft Constellation.`,
      addedCount > 0 ? "success" : "info"
    );
  };

  const removeLensFromDraft = (handle = "") => {
    clearDraftAlignmentIfActive();
    setDraftLenses((current) =>
      current.filter((item) => item.handle !== handle)
    );
  };

  const reorderDraftLenses = (startIndex, endIndex) => {
    setDraftLenses((current) =>
      reorderDraftItems(current, startIndex, endIndex)
    );
  };

  const moveDraftLensByHandle = (sourceHandle = "", targetHandle = "") => {
    if (!sourceHandle || !targetHandle || sourceHandle === targetHandle) return;

    const startIndex = draftLenses.findIndex(
      (lens) => lens.handle === sourceHandle
    );
    const endIndex = draftLenses.findIndex(
      (lens) => lens.handle === targetHandle
    );

    if (startIndex < 0 || endIndex < 0 || startIndex === endIndex) return;
    reorderDraftLenses(startIndex, endIndex);
  };

  const clearDraftConstellation = () => {
    clearDraftAlignmentIfActive();
    const nextDraftModeMeta = getDraftModeMeta(draftMode);
    setDraftLenses([]);
    setDraftName(nextDraftModeMeta.defaultName);
    setDraftLeadHandle("");
    if (typeof window !== "undefined") {
      localStorage.removeItem(DRAFT_CONSTELLATION_STORAGE_KEY);
    }
  };

  const draftModeMeta = useMemo(() => getDraftModeMeta(draftMode), [draftMode]);
  const draftConstellation = useMemo(
    () =>
      getDraftConstellation(draftName, draftLenses, draftLeadHandle, draftMode),
    [draftLeadHandle, draftLenses, draftMode, draftName]
  );
  const draftValidation = useMemo(
    () => validateDraftConstellation(draftConstellation),
    [draftConstellation]
  );

  const activateAlignment = (alignment = {}, toastMessage = null) => {
    const next = setActiveMetacanonAlignment(alignment);
    if (!next) {
      showToast("This alignment is not ready to run yet.", "warning");
      return null;
    }
    if (toastMessage) {
      showToast(
        toastMessage(next) || `${next?.title || "Alignment"} activated.`,
        "success"
      );
    }
    return next;
  };

  const activateDraftPack = () => {
    if (!draftValidation.valid) {
      showToast(draftValidation.message, "warning");
      return;
    }

    activateAlignment(
      {
        ...draftConstellation,
        id: `draft-${draftMode}`,
      },
      (next) =>
        `Prism aligned to ${next?.title}. Your next message will run this custom ${draftMode}.`
    );
  };

  const persistDraftPack = () => {
    if (!draftValidation.valid) {
      showToast(draftValidation.message, "warning");
      return;
    }

    const saved = saveCouncilPack({
      name: draftConstellation.title,
      description: `${draftConstellation.lensHandles.length} Lenses selected from the library.${draftConstellation.leadTitle ? ` Lead lens: ${draftConstellation.leadTitle}.` : ""}`,
      kind: "custom",
      collectionLabel: draftConstellation.collectionLabel,
      lensHandles: draftConstellation.lensHandles,
      lensTitles: draftConstellation.lensTitles,
      leadHandle: draftConstellation.leadHandle,
      leadTitle: draftConstellation.leadTitle,
      executionRoutes: draftConstellation.executionRoutes,
      colorHex: draftConstellation.colorHex,
    });

    setSavedPacks(loadCouncilPacks());
    setSelectedId(saved?.id || null);
    setTab("packs");
    clearDraftConstellation();
    showToast("Constellation saved.", "success");
  };

  const persistDraftCouncil = () => {
    if (!draftValidation.valid) {
      showToast(draftValidation.message, "warning");
      return;
    }

    const saved = saveCouncilPack({
      name: draftConstellation.title,
      description: `${draftConstellation.lensHandles.length} Lenses selected for a custom council.${draftConstellation.leadTitle ? ` Lead lens: ${draftConstellation.leadTitle}.` : ""}`,
      kind: "council",
      collectionLabel: "Custom Council",
      lensHandles: draftConstellation.lensHandles,
      lensTitles: draftConstellation.lensTitles,
      leadHandle: draftConstellation.leadHandle,
      leadTitle: draftConstellation.leadTitle,
      executionRoutes: draftConstellation.executionRoutes,
      colorHex: draftConstellation.colorHex,
    });

    setSavedPacks(loadCouncilPacks());
    setSelectedId(saved?.id || null);
    setTab("packs");
    clearDraftConstellation();
    showToast("Custom council saved.", "success");
  };

  const saveConstellationAsPack = (constellation) => {
    const packHandles = [
      constellation.projectManagerHandle,
      ...constellation.members.map((member) => member.lensHandle),
    ].filter(Boolean);

    if (packHandles.length === 0) {
      showToast(
        "This Preset does not have alignable Lens handles yet.",
        "warning"
      );
      return;
    }

    const saved = saveCouncilPack({
      name: getSubSphereUiTitle(constellation),
      description: constellation.purpose,
      kind: "constellation",
      sourceId: constellation.id,
      handle: constellation.handle,
      leadHandle: constellation.projectManagerHandle || null,
      leadTitle: constellation.projectManagerTitle || null,
      collectionLabel: "Preset Configuration",
      lensHandles: Array.from(new Set(packHandles)),
      lensTitles: [
        constellation.projectManagerTitle,
        ...constellation.members.map((member) => member.lensTitle),
      ].filter(Boolean),
      executionRoutes: buildExecutionRoutesFromLenses([
        {
          handle: constellation.projectManagerHandle,
          title: constellation.projectManagerTitle,
          preferredBackends: constellation.preferredBackends,
          fallbackBackends: constellation.fallbackBackends,
        },
        ...constellation.members.map((member) => ({
          handle: member.lensHandle,
          title: member.lensTitle,
          preferredBackends: member.preferredBackends,
          fallbackBackends: member.fallbackBackends,
        })),
      ]),
    });

    setSavedPacks(loadCouncilPacks());
    setSelectedId(saved?.id || null);
    setTab("packs");
    showToast("Preset saved as a reusable Constellation.", "success");
  };

  const pinPresetConstellation = (constellation) => {
    const packHandles = [
      constellation.projectManagerHandle,
      ...constellation.members.map((member) => member.lensHandle),
    ].filter(Boolean);

    const pinned = savePinnedConstellation({
      id: constellation.id,
      name: getSubSphereUiTitle(constellation),
      description: constellation.purpose,
      kind: "constellation",
      sourceId: constellation.id,
      handle: constellation.handle,
      collectionLabel: "Preset Configuration",
      lensHandles: Array.from(new Set(packHandles)),
      lensTitles: [
        constellation.projectManagerTitle,
        ...constellation.members.map((member) => member.lensTitle),
      ].filter(Boolean),
      colorHex: getMetacanonLensAccent({
        colorHex: constellation.projectManagerColorHex,
      }),
    });

    setPinnedConstellations(loadPinnedConstellations());
    showToast(
      `${pinned?.name || "Preset"} is now visible in the sidebar.`,
      "success"
    );
  };

  const pinSavedPack = (pack) => {
    if (pack.kind === "council") {
      const featured = saveFeaturedCouncil({
        id: pack.id,
        sourceId: pack.id,
        title: pack.name,
        kind: "custom",
        description: pack.description,
        collectionLabel: "Custom Council",
        lensHandles: pack.lensHandles,
        lensTitles: pack.lensTitles,
        leadTitle: pack.leadTitle,
        colorHex: pack.colorHex,
      });
      setFeaturedCouncils(loadFeaturedCouncils());
      showToast(
        `${featured?.title || "Council"} is now visible in Featured Councils.`,
        "success"
      );
      return;
    }

    const pinned = savePinnedConstellation(pack);
    setPinnedConstellations(loadPinnedConstellations());
    showToast(
      `${pinned?.name || "Constellation"} is now visible in the sidebar.`,
      "success"
    );
  };

  const unpinConstellation = (pack = {}) => {
    const pinId = buildPinnedConstellationId(pack);
    setPinnedConstellations(deletePinnedConstellation(pinId));
    showToast(
      `${pack.name || getItemDisplayTitle(pack, "packs") || "Constellation"} removed from the sidebar.`,
      "success"
    );
  };

  const isPinnedConstellation = (pack = {}) =>
    pinnedConstellations.some(
      (item) => item.pinId === buildPinnedConstellationId(pack)
    );

  const featureLens = (lens = {}) => {
    const featured = saveFeaturedLens({
      id: lens.id,
      title: getLensDisplayTitle(lens),
      handle: lens.handle,
      description: getItemSnippet(lens, "lenses"),
      collectionLabel: getLensCollectionLabel(lens),
      colorHex: getMetacanonLensAccent(lens),
      boardSlug: lens.boardSlug,
      councilId: lens.councilId,
    });
    setFeaturedLenses(loadFeaturedLenses());
    showToast(
      `${featured?.title || "Lens"} is now visible in Featured Lenses.`,
      "success"
    );
  };

  const unfeatureLens = (lens = {}) => {
    setFeaturedLenses(deleteFeaturedLens(buildFeaturedLensId(lens)));
    showToast(
      `${getLensDisplayTitle(lens) || "Lens"} removed from Featured Lenses.`,
      "success"
    );
  };

  const isFeaturedLens = (lens = {}) =>
    featuredLenses.some((item) => item.featureId === buildFeaturedLensId(lens));

  const featureCouncil = (council = {}) => {
    const featured = saveFeaturedCouncil({
      id: council.id,
      sourceId: council.id,
      title: getCouncilUiTitle(council),
      kind: "council",
      description: getItemSnippet(council, "councils"),
      collectionLabel: METACANON_TERMS.councils,
      lensHandles: council.lensHandles || [],
      lensTitles: (council.lenses || []).map((lens) =>
        getLensDisplayTitle(lens)
      ),
      colorHex:
        council.lenses?.[0]?.colorHex ||
        getMetacanonLensAccent(council.lenses?.[0] || {}),
    });
    setFeaturedCouncils(loadFeaturedCouncils());
    showToast(
      `${featured?.title || "Council"} is now visible in Featured Councils.`,
      "success"
    );
  };

  const unfeatureCouncil = (council = {}) => {
    setFeaturedCouncils(
      deleteFeaturedCouncil(
        buildFeaturedCouncilId({ ...council, kind: "council" })
      )
    );
    showToast(
      `${getCouncilUiTitle(council) || "Council"} removed from Featured Councils.`,
      "success"
    );
  };

  const isFeaturedCouncil = (council = {}) =>
    featuredCouncils.some(
      (item) =>
        item.featureId ===
        buildFeaturedCouncilId({ ...council, kind: "council" })
    );

  const isFeaturedSavedCouncil = (pack = {}) =>
    featuredCouncils.some(
      (item) =>
        item.featureId === buildFeaturedCouncilId({ ...pack, kind: pack.kind })
    );

  const unfeatureSavedCouncil = (pack = {}) => {
    setFeaturedCouncils(
      deleteFeaturedCouncil(
        buildFeaturedCouncilId({ ...pack, kind: pack.kind })
      )
    );
    showToast(
      `${pack.name || "Custom Council"} removed from Featured Councils.`,
      "success"
    );
  };

  const moveFeaturedLens = (startIndex, endIndex) => {
    setFeaturedLenses(reorderFeaturedLenses(startIndex, endIndex));
  };

  const moveFeaturedCouncil = (startIndex, endIndex) => {
    setFeaturedCouncils(reorderFeaturedCouncils(startIndex, endIndex));
  };

  const movePinnedConstellation = (startIndex, endIndex) => {
    setPinnedConstellations(reorderPinnedConstellations(startIndex, endIndex));
  };

  const removeSavedPack = (packId) => {
    setSavedPacks(deleteCouncilPack(packId));
    setSelectedId(null);
    showToast("Saved Constellation removed.", "success");
  };

  async function runInChat(promptToRun = "") {
    setRunning(true);
    try {
      const opened = await openMetacanonChat({
        navigate,
        initialPrompt: promptToRun,
      });
      if (!opened) return;
      showToast(
        promptToRun?.trim()
          ? "Alignment staged in chat. Opening workspace now."
          : "Opening aligned workspace chat.",
        "success"
      );
    } catch (error) {
      console.error(error);
      showToast("Failed to align Prism.", "error");
    } finally {
      setRunning(false);
    }
  }

  async function runAlignmentNow(alignment, successLabel = "Prism") {
    const trimmedQuery = runPrompt.trim();
    if (!trimmedQuery) {
      showToast("What should Prism focus on while aligned?", "warning");
      return;
    }

    const promptToRun = buildPromptForAlignment(trimmedQuery, alignment);
    if (!isRunnableMetacanonAlignment(alignment)) {
      showToast("This alignment is missing runnable Lens routing.", "warning");
      return;
    }

    if (!promptToRun || promptToRun === trimmedQuery) {
      showToast("This alignment could not be activated.", "error");
      return;
    }

    showToast(`Aligning Prism with ${successLabel}...`, "success");
    await runInChat(promptToRun);
  }

  async function openAlignmentChat(alignment, successLabel = "Prism") {
    if (!isRunnableMetacanonAlignment(alignment)) {
      showToast("This alignment is missing runnable Lens routing.", "warning");
      return;
    }

    const next = setActiveMetacanonAlignment(alignment);
    if (!next) {
      showToast("This alignment could not be activated.", "error");
      return;
    }

    showToast(`Opening chat aligned to ${successLabel}...`, "success");
    await runInChat("");
  }

  const runSelectedItem = async () => {
    if (!selectedItem) return;

    if (tab === "councils") {
      await runAlignmentNow(
        buildCouncilAlignment(selectedItem),
        getCouncilUiTitle(selectedItem)
      );
      return;
    }

    if (tab === "lenses") {
      await runAlignmentNow(
        buildLensAlignment(selectedItem),
        getLensDisplayTitle(selectedItem)
      );
      return;
    }

    if (tab === "constellations") {
      await runAlignmentNow(
        buildConstellationAlignment(selectedItem),
        getSubSphereUiTitle(selectedItem)
      );
      return;
    }

    if (tab === "packs") {
      await runAlignmentNow(
        buildSavedPackAlignment(selectedItem),
        selectedItem.name
      );
    }
  };

  const isRunnableTab = [
    "councils",
    "lenses",
    "constellations",
    "packs",
  ].includes(tab);
  const renderItem =
    selectedDetail && selectedDetail.id === selectedItem?.id
      ? selectedDetail
      : selectedItem;
  const constellationModeCopy = getConstellationModeCopy(tab, draftMode);
  const searchPlaceholder =
    tab === "councils"
      ? "Search Councils, phases, or Lens names"
      : tab === "lenses"
        ? "Search Lenses, Councils, Studios, or content"
        : tab === "constellations"
          ? "Search Presets, roles, or purpose"
          : tab === "packs"
            ? "Search Saved Constellations or Preset configurations"
            : tab === "skills"
              ? "Search Skills or workflow content"
              : "Search Governance Documents";

  return (
    <div className="metacanon-page-shell flex h-screen w-screen overflow-hidden bg-theme-bg-container">
      {!isMobile ? <Sidebar /> : <SidebarMobileHeader />}
      <div
        style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
        className="metacanon-page-frame relative h-full w-full overflow-y-scroll bg-theme-bg-secondary p-4 md:my-[16px] md:mx-[16px] md:rounded-[16px] md:p-0"
      >
        <div className="prism-route-content prism-library-page w-full px-1 py-20 md:px-6 md:py-6">
          <div className="prism-page-hero prism-library-hero-shell">
            <div className="prism-library-hero-grid">
              <div className="prism-library-hero-copy flex max-w-3xl flex-col gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-theme-primary-button">
                  Transformation Agency
                </div>
                <h1 className="text-lg font-semibold text-theme-text-primary">
                  Metacanon Lens Library
                </h1>
                <p className="text-sm leading-6 text-theme-text-secondary">
                  Browse councils, lenses, presets, skills, and constellations.
                </p>
                <div className="pt-1">
                  <div className="flex flex-wrap items-center gap-4">
                    <Link
                      to={paths.metacanonAI()}
                      className="prism-library-hero-link text-sm font-medium text-theme-primary-button hover:underline"
                    >
                      Back to PrismAI features
                    </Link>
                    <Link
                      to={paths.metacanonAIComposer()}
                      className="prism-library-hero-link text-sm font-medium text-theme-primary-button hover:underline"
                    >
                      Open Lens Composer
                    </Link>
                    <button
                      type="button"
                      onClick={openLensWorkbench}
                      className="rounded-full border border-theme-primary-button px-3 py-1.5 text-xs font-medium text-theme-primary-button transition-all duration-200 hover:bg-theme-primary-button hover:text-black"
                    >
                      Edit / Create Lens
                    </button>
                  </div>
                </div>
              </div>
              <div className="prism-library-stat-grid flex flex-wrap items-center gap-x-4 gap-y-1">
                <StatusTile
                  label="Lenses"
                  value={String(libraryManifest.counts.lenses)}
                />
                <span className="text-theme-text-secondary opacity-40">|</span>
                <StatusTile
                  label="Presets"
                  value={String(libraryManifest.counts.constellations)}
                />
                <span className="text-theme-text-secondary opacity-40">|</span>
                <StatusTile
                  label="Skills"
                  value={String(libraryManifest.counts.skills)}
                />
                <span className="text-theme-text-secondary opacity-40">|</span>
                <StatusTile
                  label="Councils"
                  value={String(libraryManifest.counts.councils)}
                />
                <span className="text-theme-text-secondary opacity-40">|</span>
                <StatusTile
                  label="Saved"
                  value={String(savedPacks.length)}
                />
              </div>
            </div>
          </div>

          {["councils", "lenses"].includes(tab) ? (
            <div className="rounded-[10px] border border-theme-sidebar-border px-3 py-3">
              <div className="flex flex-col gap-4 md:items-start md:justify-between">
                <div className="max-w-2xl">
                  <div className="mt-1 text-sm font-semibold text-theme-text-primary">
                    {draftMode === "council"
                      ? "Custom council draft"
                      : "Custom constellation draft"}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ActionButton
                      label="Draft a Constellation"
                      onClick={() => {
                        clearDraftAlignmentIfActive();
                        setDraftMode("constellation");
                        if (shouldReplaceDraftName(draftName)) {
                          setDraftName("Custom Constellation");
                        }
                      }}
                      variant={
                        draftMode === "constellation" ? "primary" : "secondary"
                      }
                    />
                    <ActionButton
                      label="Draft a Council"
                      onClick={() => {
                        clearDraftAlignmentIfActive();
                        setDraftMode("council");
                        if (shouldReplaceDraftName(draftName)) {
                          setDraftName("Custom Council");
                        }
                      }}
                      variant={
                        draftMode === "council" ? "primary" : "secondary"
                      }
                    />
                  </div>
                </div>
                <div className="flex w-full max-w-xl flex-col gap-3">
                  <div className="prism-library-draft-board-header flex items-center justify-between gap-3">
                    <div className="rounded-full border border-theme-sidebar-border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
                      {draftModeMeta.saveCopy}
                    </div>
                  </div>
                  <input
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    className="metacanon-sidebar-search prism-library-input h-[38px] rounded-[10px] border-none px-3 text-sm text-theme-text-primary outline-none placeholder:text-theme-settings-input-placeholder"
                    placeholder={draftModeMeta.namePlaceholder}
                  />
                  <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-theme-text-secondary">
                    Lens Order
                  </div>
                  <div className="prism-library-draft-chip-row flex flex-wrap gap-2">
                    {draftLenses.length > 0 ? (
                      draftLenses.map((lens) => (
                        <div
                          key={lens.handle || lens.id}
                          draggable
                          onDragStart={() =>
                            setDraggedDraftHandle(lens.handle || null)
                          }
                          onDragEnd={() => setDraggedDraftHandle(null)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => {
                            moveDraftLensByHandle(
                              draggedDraftHandle,
                              lens.handle
                            );
                            setDraggedDraftHandle(null);
                          }}
                          className={`prism-library-draft-chip flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs text-theme-text-primary transition-colors ${
                            draggedDraftHandle === lens.handle
                              ? "border-theme-primary-button bg-theme-sidebar-subitem-hover"
                              : "border-theme-sidebar-border bg-theme-bg-sidebar"
                          }`}
                        >
                          <div
                            className="cursor-grab text-theme-text-secondary"
                            title="Drag to reorder"
                          >
                            <DotsSixVertical className="h-4 w-4" />
                          </div>
                          <span>{lens.title}</span>
                          <button
                            type="button"
                            onClick={() => setDraftLeadHandle(lens.handle)}
                            className={`rounded-full px-2 py-0.5 transition-all ${
                              draftLeadHandle === lens.handle
                                ? "bg-primary-button text-white"
                                : "bg-theme-bg-container text-theme-text-secondary hover:bg-theme-sidebar-subitem-hover hover:text-theme-text-primary"
                            }`}
                          >
                            {draftLeadHandle === lens.handle
                              ? "Leading"
                              : "Lead"}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeLensFromDraft(lens.handle)}
                            className="text-theme-text-secondary transition-colors hover:text-theme-text-primary"
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-theme-text-secondary">
                        No Lenses mapped yet.
                      </div>
                    )}
                  </div>
                  <div className="mt-2 border-t border-theme-sidebar-border/40 pt-2 text-xs text-theme-text-secondary">
                    <span className="font-medium text-theme-text-primary">
                      {draftConstellation.lensHandles.length}{" "}
                      {draftConstellation.lensHandles.length === 1
                        ? "Lens"
                        : "Lenses"}{" "}
                      selected
                    </span>
                    {draftConstellation.leadTitle ? (
                      <span className="ml-2 text-theme-text-secondary">
                        · Lead: {draftConstellation.leadTitle}
                      </span>
                    ) : null}
                    {!draftValidation.valid ? (
                      <div className="mt-1 text-theme-primary-button">
                        {draftValidation.message}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <ActionButton
                      label={`Activate ${draftModeMeta.saveCopy}`}
                      onClick={activateDraftPack}
                      disabled={!draftValidation.valid}
                    />
                    <ActionButton
                      label={`Open ${draftModeMeta.saveCopy} Chat`}
                      onClick={() =>
                        openAlignmentChat(
                          draftConstellation,
                          draftConstellation.title
                        )
                      }
                      disabled={!draftValidation.valid || running}
                    />
                    <ActionButton
                      label={`Run ${draftModeMeta.saveCopy} Now`}
                      onClick={() =>
                        runAlignmentNow(
                          draftConstellation,
                          draftConstellation.title
                        )
                      }
                      variant="primary"
                      disabled={!draftValidation.valid || running}
                    />
                    <ActionButton
                      label={`Save ${draftModeMeta.saveCopy}`}
                      onClick={persistDraftCouncil}
                      disabled={
                        !draftValidation.valid || draftMode !== "council"
                      }
                    />
                    <ActionButton
                      label={`Save ${draftModeMeta.saveCopy}`}
                      onClick={persistDraftPack}
                      disabled={
                        !draftValidation.valid || draftMode !== "constellation"
                      }
                    />

                    <ActionButton
                      label={`Clear ${draftModeMeta.clearCopy}`}
                      onClick={clearDraftConstellation}
                      disabled={draftLenses.length === 0}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
              <ConstellationModeTile
                eyebrow="Preset Constellations"
                title="Canonical formations"
                emphasis={tab === "constellations"}
              />
              <ConstellationModeTile
                eyebrow="Custom Draft"
                title="Compose something new"
                emphasis={["councils", "lenses"].includes(tab)}
              />
              <ConstellationModeTile
                eyebrow="Saved Constellations"
                title="Keep what works"
                emphasis={tab === "packs"}
              />
            </div>
            <div className="prism-library-tab-row flex flex-wrap gap-2">
              {TABS.map((tabOption) => (
                <TabButton
                  key={tabOption.id}
                  active={tabOption.id === tab}
                  icon={tabOption.icon}
                  label={tabOption.label}
                  onClick={() => setActiveTab(tabOption.id)}
                />
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
                <SidebarSectionManager
                  eyebrow="Featured Lenses"
                  title={`${featuredLenses.length} featured lens${featuredLenses.length === 1 ? "" : "es"}`}
                  description="Single-lens alignments shown in the left sidebar."
                  items={featuredLenses}
                  getItemTitle={(item) => item.title}
                  getItemMeta={(item) =>
                    item.collectionLabel || METACANON_TERMS.lenses
                  }
                  onMove={moveFeaturedLens}
                  onRemove={(item) => unfeatureLens(item)}
                  emptyLabel="Add lenses from the library detail panel to build this section."
                />
                <SidebarSectionManager
                  eyebrow="Featured Councils"
                  title={`${featuredCouncils.length} featured council${featuredCouncils.length === 1 ? "" : "s"}`}
                  description="Canonical and custom councils ready from the left sidebar."
                  items={featuredCouncils}
                  getItemTitle={(item) => item.title}
                  getItemMeta={(item) =>
                    item.kind === "council"
                      ? "Canonical Council"
                      : "Custom Council"
                  }
                  onMove={moveFeaturedCouncil}
                  onRemove={(item) =>
                    item.kind === "council"
                      ? unfeatureCouncil(item)
                      : unfeatureSavedCouncil(item)
                  }
                  emptyLabel="Add canonical councils or saved custom councils from the library detail panel."
                />
                <SidebarSectionManager
                  eyebrow="Sidebar Constellations"
                  title={`${pinnedConstellations.length} sidebar constellation${pinnedConstellations.length === 1 ? "" : "s"}`}
                  description="Preset and saved constellations pinned into the dedicated constellation section."
                  items={pinnedConstellations}
                  getItemTitle={(item) => item.name || item.title}
                  getItemMeta={(item) =>
                    item.kind === "constellation"
                      ? "Preset Constellation"
                      : "Saved Constellation"
                  }
                  onMove={movePinnedConstellation}
                  onRemove={(item) => unpinConstellation(item)}
                  emptyLabel="Add preset or saved constellations from the library detail panel."
                />
              </div>
            </div>
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="flex-1">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder={searchPlaceholder}
                />
              </div>
              {tab === "lenses" ? (
                <FilterSelect
                  label="Council / Studio"
                  options={lensFilterOptions}
                  value={lensFilter}
                  onChange={setLensFilter}
                />
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
            <div className="flex flex-col gap-2 rounded-[10px] border border-theme-sidebar-border bg-theme-bg-container/40 p-2">
              {filteredItems.length === 0 ? (
                <div className="rounded-[8px] border border-theme-sidebar-border bg-theme-bg-sidebar px-3 py-3 text-sm leading-6 text-theme-text-secondary">
                  {loadingManifest || loadingCollection
                    ? "Loading Metacanon library..."
                    : "No items matched this filter."}
                </div>
              ) : (
                filteredItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    active={selectedItem?.id === item.id}
                    title={getItemDisplayTitle(item, tab)}
                    meta={
                      tab === "councils"
                        ? "Canonical Council"
                        : tab === "lenses"
                          ? getLensCollectionLabel(item)
                          : tab === "constellations"
                            ? `${item.type} ${METACANON_TERMS.subSphere}`
                            : tab === "packs"
                              ? getPackKindLabel(item)
                              : tab === "skills"
                                ? "Skill"
                                : item.format?.toUpperCase() || "Document"
                    }
                    badge={
                      tab === "packs"
                        ? item.kind === "constellation"
                          ? "Preset-derived"
                          : item.kind === "council"
                            ? "Custom Council"
                            : "Custom-built"
                        : null
                    }
                    accent={
                      tab === "packs"
                        ? item.kind === "constellation"
                          ? "#d4a63e"
                          : item.kind === "council"
                            ? "#72d6a4"
                            : "#46c8ff"
                        : null
                    }
                    snippet={getItemSnippet(item, tab)}
                    onClick={() => setSelectedId(item.id)}
                    targetId={`metacanon-library-${tab}-${item.id}`}
                  />
                ))
              )}
            </div>

            <div className="flex flex-col gap-3 rounded-[10px] border border-theme-sidebar-border bg-theme-bg-container/40 p-3">
              {selectedItem ? (
                <>
                  <div className="rounded-[8px] border border-theme-sidebar-border bg-theme-bg-sidebar px-3 py-2">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-theme-primary-button">
                          {getDetailLabel(tab)}
                        </div>
                        <h2 className="mt-0.5 text-sm font-semibold text-theme-text-primary">
                          {getItemDisplayTitle(selectedItem, tab)}
                        </h2>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {tab === "councils" ? (
                          <>
                            <ActionButton
                              label={
                                isFeaturedCouncil(selectedItem)
                                  ? "Hide from Councils"
                                  : "Show in Councils"
                              }
                              onClick={() =>
                                isFeaturedCouncil(selectedItem)
                                  ? unfeatureCouncil(selectedItem)
                                  : featureCouncil(selectedItem)
                              }
                            />
                            <ActionButton
                              label="Add to Constellation"
                              onClick={() => addCouncilToDraft(selectedItem)}
                            />
                            <ActionButton
                              label="Set Active Alignment"
                              onClick={() =>
                                activateAlignment(
                                  buildCouncilAlignment(selectedItem),
                                  (next) =>
                                    `Prism aligned to ${next?.title}. Your next message will run this council formation.`
                                )
                              }
                            />
                            <ActionButton
                              label="Open Chat"
                              onClick={() =>
                                openAlignmentChat(
                                  buildCouncilAlignment(selectedItem),
                                  getCouncilUiTitle(selectedItem)
                                )
                              }
                            />

                            <ActionButton
                              label="Run in Chat"
                              onClick={runSelectedItem}
                              variant="primary"
                              disabled={running}
                            />
                          </>
                        ) : null}
                        {tab === "lenses" ? (
                          <>
                            <ActionButton
                              label={
                                isFeaturedLens(selectedItem)
                                  ? "Hide from Featured Lenses"
                                  : "Show in Featured Lenses"
                              }
                              onClick={() =>
                                isFeaturedLens(selectedItem)
                                  ? unfeatureLens(selectedItem)
                                  : featureLens(selectedItem)
                              }
                            />
                            <ActionButton
                              label="Add to Constellation"
                              onClick={() => addLensToDraft(selectedItem)}
                            />
                            <ActionButton
                              label="Set Active Alignment"
                              onClick={() =>
                                activateAlignment(
                                  buildLensAlignment(selectedItem),
                                  (next) =>
                                    `Prism aligned to ${next?.title}. Your next message will use this lens.`
                                )
                              }
                            />
                            <ActionButton
                              label="Open Chat"
                              onClick={() =>
                                openAlignmentChat(
                                  buildLensAlignment(selectedItem),
                                  getLensDisplayTitle(selectedItem)
                                )
                              }
                            />

                            <ActionButton
                              label="Run in Chat"
                              onClick={runSelectedItem}
                              variant="primary"
                              disabled={running}
                            />
                          </>
                        ) : null}
                        {tab === "constellations" ? (
                          <>
                            <ActionButton
                              label={
                                isPinnedConstellation({
                                  kind: "constellation",
                                  sourceId: selectedItem.id,
                                  handle: selectedItem.handle,
                                  id: selectedItem.id,
                                })
                                  ? "Hide from Sidebar"
                                  : "Show in Sidebar"
                              }
                              onClick={() =>
                                isPinnedConstellation({
                                  kind: "constellation",
                                  sourceId: selectedItem.id,
                                  handle: selectedItem.handle,
                                  id: selectedItem.id,
                                })
                                  ? unpinConstellation({
                                      kind: "constellation",
                                      sourceId: selectedItem.id,
                                      handle: selectedItem.handle,
                                      id: selectedItem.id,
                                      name: getSubSphereUiTitle(selectedItem),
                                    })
                                  : pinPresetConstellation(selectedItem)
                              }
                            />
                            <ActionButton
                              label="Set Active Alignment"
                              onClick={() =>
                                activateAlignment(
                                  buildConstellationAlignment(selectedItem),
                                  (next) =>
                                    `Prism aligned to ${next?.title}. Your next message will run this preset constellation.`
                                )
                              }
                            />
                            <ActionButton
                              label="Open Chat"
                              onClick={() =>
                                openAlignmentChat(
                                  buildConstellationAlignment(selectedItem),
                                  getSubSphereUiTitle(selectedItem)
                                )
                              }
                            />
                            <ActionButton
                              label="Save as Saved Constellation"
                              onClick={() =>
                                saveConstellationAsPack(selectedItem)
                              }
                            />

                            <ActionButton
                              label="Run in Chat"
                              onClick={runSelectedItem}
                              variant="primary"
                              disabled={running}
                            />
                          </>
                        ) : null}
                        {tab === "packs" ? (
                          <>
                            <ActionButton
                              label={
                                selectedItem.kind === "council"
                                  ? isFeaturedSavedCouncil(selectedItem)
                                    ? `Hide from ${getPackSectionLabel(selectedItem)}`
                                    : `Show in ${getPackSectionLabel(selectedItem)}`
                                  : isPinnedConstellation(selectedItem)
                                    ? "Hide from Sidebar"
                                    : "Show in Sidebar"
                              }
                              onClick={() =>
                                selectedItem.kind === "council"
                                  ? isFeaturedSavedCouncil(selectedItem)
                                    ? unfeatureSavedCouncil(selectedItem)
                                    : pinSavedPack(selectedItem)
                                  : isPinnedConstellation(selectedItem)
                                    ? unpinConstellation(selectedItem)
                                    : pinSavedPack(selectedItem)
                              }
                            />
                            <ActionButton
                              label={
                                selectedItem.kind === "council"
                                  ? "Set Active Council"
                                  : "Set Active Saved Constellation"
                              }
                              onClick={() =>
                                activateAlignment(
                                  buildSavedPackAlignment(selectedItem),
                                  (next) =>
                                    `Prism aligned to ${next?.title}. Your next message will run this ${selectedItem.kind === "council" ? "custom council" : "saved constellation"}.`
                                )
                              }
                            />
                            <ActionButton
                              label="Open Chat"
                              onClick={() =>
                                openAlignmentChat(
                                  buildSavedPackAlignment(selectedItem),
                                  selectedItem.name
                                )
                              }
                            />
                            <ActionButton
                              label={getDeletePackLabel(selectedItem)}
                              onClick={() => removeSavedPack(selectedItem.id)}
                            />

                            <ActionButton
                              label="Run in Chat"
                              onClick={runSelectedItem}
                              variant="primary"
                              disabled={running}
                            />
                          </>
                        ) : null}
                        {tab === "constitution" && selectedDocumentHref ? (
                          <ActionLink
                            label="Open Original Document"
                            href={selectedDocumentHref}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {isRunnableTab ? (
                    <div className="rounded-[8px] border border-theme-sidebar-border bg-theme-bg-sidebar px-3 py-2">
                      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-theme-text-secondary">
                        Align Prism
                      </div>
                      <textarea
                        value={runPrompt}
                        onChange={(event) => setRunPrompt(event.target.value)}
                        placeholder="What should Prism focus on?"
                        className="mt-1.5 min-h-[70px] w-full rounded-[8px] border border-theme-sidebar-border bg-theme-bg-container px-3 py-2 text-sm leading-5 text-theme-text-primary outline-none placeholder:text-theme-settings-input-placeholder"
                      />
                    </div>
                  ) : null}

                  {loadingDetail ? (
                    <div className="rounded-[8px] border border-theme-sidebar-border bg-theme-bg-sidebar px-3 py-3 text-sm leading-6 text-theme-text-secondary">
                      Loading selected item...
                    </div>
                  ) : (
                    renderDetail(renderItem, tab)
                  )}
                </>
              ) : (
                <div className="rounded-[8px] border border-theme-sidebar-border bg-theme-bg-sidebar px-3 py-3 text-sm leading-6 text-theme-text-secondary">
                  Select a Council, Lens, Preset, Skill, or Governance Document
                  to inspect it.
                </div>
              )}
            </div>
          </div>
        </div>
        <LensWorkbenchModal
          open={lensWorkbenchOpen}
          lenses={lensItems}
          onClose={() => setLensWorkbenchOpen(false)}
          onSaved={(item) => {
            refreshLibrarySlice({
              refreshManifest: true,
              tabs: ["lenses"],
              selectedLensId: item?.id || null,
            });
          }}
        />
      </div>
    </div>
  );
}
