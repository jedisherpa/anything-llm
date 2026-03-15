import Sidebar, { SidebarMobileHeader } from "@/components/Sidebar";
import PrismHoverTarget from "@/components/PrismHoverTarget";
import Workspace from "@/models/workspace";
import {
  buildCouncilPackPrompt,
  deleteCouncilPack,
  fetchLibraryCollection,
  fetchLibraryItem,
  fetchLibraryManifest,
  loadCouncilPacks,
  saveCouncilPack,
} from "@/models/metacanonLibrary";
import paths from "@/utils/paths";
import {
  LAST_VISITED_WORKSPACE,
  PENDING_HOME_MESSAGE,
} from "@/utils/constants";
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
import { BookOpen } from "@phosphor-icons/react/dist/csr/BookOpen";
import { FileText } from "@phosphor-icons/react/dist/csr/FileText";
import { FlowArrow } from "@phosphor-icons/react/dist/csr/FlowArrow";
import { Gavel } from "@phosphor-icons/react/dist/csr/Gavel";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";

import { isMobile } from "react-device-detect";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_BASE = (import.meta.env.VITE_API_BASE || "/api").replace(/\/$/, "");

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
    label: METACANON_TERMS.subSpheres,
    icon: <FlowArrow className="h-4 w-4" weight="bold" />,
  },
  {
    id: "packs",
    label: METACANON_TERMS.savedConstellations,
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
  if (item.kind === "custom") return "Saved Constellation";
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
    return `${item.lensCount} ${METACANON_TERMS.lenses} aligned to ${getCouncilUiTitle(item)}${item.phase ? ` • ${item.phase}` : ""}`;
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
  if (tab === "packs")
    return (
      item.description ||
      item.lensTitles?.map((title) => sanitizeLensTitle(title)).join(", ")
    );

  if (tab === "skills") return item.description;
  return item.content?.split("\n").slice(1, 4).join(" ");
}

function getDeletePackLabel(item = {}) {
  return item.kind === "custom"
    ? "Delete Saved Constellation"
    : "Delete Preset Configuration";
}

function getDetailLabel(tab = "lenses") {
  if (tab === "councils") return METACANON_TERMS.council;
  if (tab === "lenses") return "Lens";
  if (tab === "constellations") return METACANON_TERMS.subSphere;
  if (tab === "packs") return "Saved Constellation";
  if (tab === "skills") return "Skill";
  return "Governance Document";
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
  };
}

async function getTargetWorkspace() {
  const lastVisited = safeJsonParse(
    localStorage.getItem(LAST_VISITED_WORKSPACE)
  );
  if (lastVisited?.slug) {
    const workspace = await Workspace.bySlug(lastVisited.slug);
    if (workspace) return workspace;
  }

  const workspaces = await Workspace.all();
  return workspaces.length > 0 ? workspaces[0] : null;
}

async function createDefaultWorkspace(workspaceName = "MetaCanon Workspace") {
  const { workspace, message } = await Workspace.new({ name: workspaceName });
  if (!workspace) {
    showToast(message || "Failed to create workspace", "error");
    return null;
  }
  return workspace;
}

function StatusTile({ label, value, description }) {
  return (
    <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-bg-sidebar px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-text-secondary">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-theme-text-primary">
        {value}
      </div>
      <div className="mt-2 text-sm leading-6 text-theme-text-secondary">
        {description}
      </div>
    </div>
  );
}

function TabButton({ active, icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all ${
        active
          ? "border-theme-button-primary bg-theme-sidebar-item-selected text-theme-text-primary"
          : "border-theme-sidebar-border bg-transparent text-theme-text-secondary hover:bg-theme-sidebar-subitem-hover"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <label className="relative block w-full">
      <MagnifyingGlass
        className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-text-secondary"
        weight="bold"
      />

      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="metacanon-sidebar-search h-[46px] w-full rounded-[16px] border-none pl-11 pr-4 text-sm text-theme-text-primary outline-none placeholder:text-theme-settings-input-placeholder"
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
        className="metacanon-sidebar-search h-[46px] rounded-[16px] border-none px-4 text-sm text-theme-text-primary outline-none"
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
      className={`rounded-full border px-4 py-2 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
        variant === "primary"
          ? "border-theme-button-primary bg-theme-button-primary text-theme-button-primary-text hover:opacity-90"
          : "border-theme-sidebar-border bg-theme-bg-sidebar text-theme-text-primary hover:bg-theme-sidebar-subitem-hover"
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
      className={`inline-flex rounded-full border px-4 py-2 text-sm transition-all ${
        variant === "primary"
          ? "border-theme-button-primary bg-theme-button-primary text-theme-button-primary-text hover:opacity-90"
          : "border-theme-sidebar-border bg-theme-bg-sidebar text-theme-text-primary hover:bg-theme-sidebar-subitem-hover"
      }`}
    >
      {label}
    </a>
  );
}

function ItemCard({ active, title, meta, snippet, onClick, targetId }) {
  const card = (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[18px] border px-4 py-4 text-left transition-all ${
        active
          ? "border-theme-button-primary bg-theme-sidebar-item-selected shadow-[0_14px_30px_rgba(0,0,0,0.12)]"
          : "border-theme-sidebar-border bg-theme-bg-sidebar hover:bg-theme-sidebar-subitem-hover"
      }`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-theme-primary-button">
        {meta}
      </div>
      <div className="mt-2 text-base font-semibold text-theme-text-primary">
        {title}
      </div>
      {snippet ? (
        <div className="mt-2 line-clamp-3 text-sm leading-6 text-theme-text-secondary">
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
    <div className="rounded-[14px] border border-theme-sidebar-border bg-theme-bg-sidebar px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
        {label}
      </div>
      <div
        className={`mt-1 break-words leading-6 text-theme-text-primary ${
          monospace ? "font-mono text-xs" : "text-sm"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function RawContent({ content, lens = null }) {
  if (!content) {
    return (
      <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-bg-sidebar px-5 py-5 text-sm leading-7 text-theme-text-secondary">
        This governance document is referenced in the library, but its raw text
        is not embedded in the app yet.
      </div>
    );
  }

  return (
    <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-bg-sidebar px-5 py-5">
      <pre className="whitespace-pre-wrap break-words font-[inherit] text-sm leading-7 text-theme-text-primary">
        {lens
          ? sanitizeLensContentForUi(content, lens)
          : sanitizeUiContent(content)}
      </pre>
    </div>
  );
}

function PackChip({ label, onRemove }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="rounded-full border border-theme-sidebar-border bg-theme-bg-sidebar px-3 py-1.5 text-xs text-theme-text-primary transition-all hover:bg-theme-sidebar-subitem-hover"
    >
      {label} ×
    </button>
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
        <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-bg-sidebar px-5 py-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
            Council Lenses
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(item.lenses || []).map((lens) => (
              <div
                key={lens.id}
                className="rounded-[14px] border border-theme-sidebar-border bg-theme-bg-container px-4 py-3"
              >
                <div className="text-sm font-semibold text-theme-text-primary">
                  {getLensDisplayTitle(lens)}
                </div>
                {lens.phase ? (
                  <div className="mt-1 text-xs leading-6 text-theme-text-secondary">
                    {lens.phase}
                  </div>
                ) : null}
                <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-theme-primary-button">
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

        <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-bg-sidebar px-5 py-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
            Lenses
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {(item.members || []).map((member) => (
              <div
                key={`${item.id}-${member.role}-${member.relativePath}`}
                className="rounded-[14px] border border-theme-sidebar-border bg-theme-bg-container px-4 py-3"
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
          label="Handles"
          value={item.lensHandles.join(", ")}
          monospace
        />

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
  const [tab, setTab] = useState("councils");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [runPrompt, setRunPrompt] = useState("");
  const [savedPacks, setSavedPacks] = useState([]);
  const [draftLenses, setDraftLenses] = useState([]);
  const [draftName, setDraftName] = useState("Custom Constellation");
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

  useEffect(() => {
    setSavedPacks(loadCouncilPacks());
  }, []);

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

  const addLensToDraft = (lens) => {
    const nextLens = normalizeDraftLens(lens);
    setDraftLenses((current) =>
      current.some((item) => item.handle === nextLens.handle)
        ? current
        : [...current, nextLens]
    );
    showToast(
      `${getLensDisplayTitle(lens)} added to the draft Constellation.`,
      "success"
    );
  };

  const addCouncilToDraft = (council) => {
    const nextLenses = (council.lenses || []).map(normalizeDraftLens);
    setDraftLenses((current) => {
      const byHandle = new Map(current.map((item) => [item.handle, item]));
      nextLenses.forEach((lens) => {
        if (lens.handle) byHandle.set(lens.handle, lens);
      });
      return Array.from(byHandle.values());
    });
    showToast(
      `${getCouncilUiTitle(council)} added to the draft Constellation.`,
      "success"
    );
  };

  const removeLensFromDraft = (handle = "") => {
    setDraftLenses((current) =>
      current.filter((item) => item.handle !== handle)
    );
  };

  const persistDraftPack = () => {
    if (draftLenses.length === 0) {
      showToast("Add at least one Lens to save a Constellation.", "warning");
      return;
    }

    const saved = saveCouncilPack({
      name: draftName.trim() || "Custom Constellation",
      description: `${draftLenses.length} Lenses selected from the library.`,
      kind: "custom",
      lensHandles: draftLenses.map((lens) => lens.handle).filter(Boolean),
      lensTitles: draftLenses.map((lens) => lens.title).filter(Boolean),
    });

    setSavedPacks(loadCouncilPacks());
    setSelectedId(saved?.id || null);
    setTab("packs");
    showToast("Constellation saved.", "success");
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
      lensHandles: Array.from(new Set(packHandles)),
      lensTitles: [
        constellation.projectManagerTitle,
        ...constellation.members.map((member) => member.lensTitle),
      ].filter(Boolean),
    });

    setSavedPacks(loadCouncilPacks());
    setSelectedId(saved?.id || null);
    setTab("packs");
    showToast("Preset saved as a reusable Constellation.", "success");
  };

  const removeSavedPack = (packId) => {
    setSavedPacks(deleteCouncilPack(packId));
    setSelectedId(null);
    showToast("Saved Constellation removed.", "success");
  };

  async function runInChat(promptToRun) {
    if (!promptToRun?.trim()) {
      showToast("Add a focus before aligning Prism.", "warning");
      return;
    }

    setRunning(true);
    try {
      let workspace = await getTargetWorkspace();
      if (!workspace) {
        workspace = await createDefaultWorkspace("MetaCanon Workspace");
        if (!workspace) return;
      }

      const { thread } = await Workspace.threads.new(workspace.slug);
      sessionStorage.setItem(
        PENDING_HOME_MESSAGE,
        JSON.stringify({ message: promptToRun, attachments: [] })
      );

      navigate(
        thread?.slug
          ? paths.workspace.thread(workspace.slug, thread.slug)
          : paths.workspace.chat(workspace.slug)
      );
      showToast("Alignment staged in chat. Opening workspace now.", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to align Prism.", "error");
    } finally {
      setRunning(false);
    }
  }

  const runSelectedItem = async () => {
    if (!selectedItem) return;
    const trimmedQuery = runPrompt.trim();
    if (!trimmedQuery) {
      showToast("What should Prism focus on while aligned?", "warning");
      return;
    }

    if (tab === "councils") {
      showToast(`Aligning Prism with ${selectedItem.title}...`, "success");
      await runInChat(
        buildCouncilPackPrompt({
          name: selectedItem.title,
          lensHandles: selectedItem.lensHandles,
          userQuery: trimmedQuery,
        })
      );
      return;
    }

    if (tab === "lenses") {
      showToast(
        `Aligning Prism with ${getLensDisplayTitle(selectedItem)}...`,
        "success"
      );
      await runInChat(`${selectedItem.handle} ${trimmedQuery}`);
      return;
    }

    if (tab === "constellations") {
      showToast(
        `Aligning Prism with ${getSubSphereUiTitle(selectedItem)}...`,
        "success"
      );
      await runInChat(`${selectedItem.handle} ${trimmedQuery}`);
      return;
    }

    if (tab === "packs") {
      showToast(`Aligning Prism with ${selectedItem.name}...`, "success");
      await runInChat(
        buildCouncilPackPrompt({
          name: selectedItem.name,
          lensHandles: selectedItem.lensHandles,
          userQuery: trimmedQuery,
        })
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
        className="metacanon-page-frame relative h-full w-full overflow-y-scroll bg-theme-bg-secondary p-4 md:my-[16px] md:ml-[2px] md:mr-[16px] md:rounded-[16px] md:p-0"
      >
        <div className="flex w-full flex-col gap-6 px-1 py-20 md:px-6 md:py-6">
          <div className="rounded-[24px] border border-theme-sidebar-border bg-theme-bg-sidebar px-6 py-6 shadow-[0_16px_48px_rgba(15,10,4,0.06)]">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="flex max-w-3xl flex-col gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-theme-primary-button">
                  PrismAI Library
                </div>
                <h1 className="text-2xl font-semibold text-theme-text-primary md:text-[32px]">
                  Councils, Lenses, Presets, Skills, Saved Constellations, and
                  Governance Documents
                </h1>
                <p className="text-sm leading-7 text-theme-text-secondary md:text-base">
                  Browse canonical Councils, align Prism with any Lens, review
                  reusable Presets, save custom Constellations, and inspect
                  Governance Documents directly in the app.
                </p>
                <div className="pt-1">
                  <Link
                    to={paths.metacanonAI()}
                    className="text-sm font-medium text-theme-primary-button hover:underline"
                  >
                    Back to PrismAI features
                  </Link>
                </div>
              </div>
              <div className="grid min-w-[320px] grid-cols-2 gap-3 md:grid-cols-5">
                <StatusTile
                  label="Councils"
                  value={String(libraryManifest.counts.councils)}
                  description="Canonical twelve-lens formations."
                />

                <StatusTile
                  label="Lenses"
                  value={String(libraryManifest.counts.lenses)}
                  description="Individual archetypes available."
                />

                <StatusTile
                  label="Presets"
                  value={String(libraryManifest.counts.constellations)}
                  description="Reusable multi-lens alignments."
                />

                <StatusTile
                  label="Skills"
                  value={String(libraryManifest.counts.skills)}
                  description="Reusable orchestration workflows."
                />

                <StatusTile
                  label="Saved Constellations"
                  value={String(savedPacks.length)}
                  description="Saved Constellations and Preset configurations."
                />
              </div>
            </div>
          </div>

          {["councils", "lenses"].includes(tab) ? (
            <div className="rounded-[24px] border border-theme-sidebar-border bg-theme-bg-sidebar px-5 py-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="max-w-2xl">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-primary-button">
                    Draft Constellation
                  </div>
                  <div className="mt-2 text-lg font-semibold text-theme-text-primary">
                    Map a custom Constellation from Councils or individual
                    Lenses
                  </div>
                  <div className="mt-2 text-sm leading-6 text-theme-text-secondary">
                    Add whole Councils or individual Lenses, give the
                    Constellation a name, and save it for repeat use.
                  </div>
                </div>
                <div className="flex w-full max-w-xl flex-col gap-3">
                  <input
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    className="metacanon-sidebar-search h-[44px] rounded-[14px] border-none px-4 text-sm text-theme-text-primary outline-none placeholder:text-theme-settings-input-placeholder"
                    placeholder="Custom Constellation Name"
                  />

                  <div className="flex flex-wrap gap-2">
                    {draftLenses.length > 0 ? (
                      draftLenses.map((lens) => (
                        <PackChip
                          key={lens.handle || lens.id}
                          label={lens.title}
                          onRemove={() => removeLensFromDraft(lens.handle)}
                        />
                      ))
                    ) : (
                      <div className="text-sm text-theme-text-secondary">
                        No Lenses mapped yet.
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ActionButton
                      label="Save Constellation"
                      onClick={persistDraftPack}
                      variant="primary"
                      disabled={draftLenses.length === 0}
                    />

                    <ActionButton
                      label="Clear Constellation"
                      onClick={() => setDraftLenses([])}
                      disabled={draftLenses.length === 0}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
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

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="flex min-h-[640px] flex-col gap-3 rounded-[24px] border border-theme-sidebar-border bg-theme-bg-container/40 p-3">
              {filteredItems.length === 0 ? (
                <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-bg-sidebar px-5 py-5 text-sm leading-7 text-theme-text-secondary">
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
                    snippet={getItemSnippet(item, tab)}
                    onClick={() => setSelectedId(item.id)}
                    targetId={`metacanon-library-${tab}-${item.id}`}
                  />
                ))
              )}
            </div>

            <div className="flex min-h-[640px] flex-col gap-4 rounded-[24px] border border-theme-sidebar-border bg-theme-bg-container/40 p-4">
              {selectedItem ? (
                <>
                  <div className="rounded-[20px] border border-theme-sidebar-border bg-theme-bg-sidebar px-5 py-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-primary-button">
                          {getDetailLabel(tab)}
                        </div>
                        <h2 className="mt-2 text-2xl font-semibold text-theme-text-primary">
                          {getItemDisplayTitle(selectedItem, tab)}
                        </h2>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {tab === "councils" ? (
                          <>
                            <ActionButton
                              label="Add to Constellation"
                              onClick={() => addCouncilToDraft(selectedItem)}
                            />

                            <ActionButton
                              label="Align Prism"
                              onClick={runSelectedItem}
                              variant="primary"
                              disabled={running}
                            />
                          </>
                        ) : null}
                        {tab === "lenses" ? (
                          <>
                            <ActionButton
                              label="Add to Constellation"
                              onClick={() => addLensToDraft(selectedItem)}
                            />

                            <ActionButton
                              label="Align Prism"
                              onClick={runSelectedItem}
                              variant="primary"
                              disabled={running}
                            />
                          </>
                        ) : null}
                        {tab === "constellations" ? (
                          <>
                            <ActionButton
                              label="Save as Constellation"
                              onClick={() =>
                                saveConstellationAsPack(selectedItem)
                              }
                            />

                            <ActionButton
                              label="Align Prism"
                              onClick={runSelectedItem}
                              variant="primary"
                              disabled={running}
                            />
                          </>
                        ) : null}
                        {tab === "packs" ? (
                          <>
                            <ActionButton
                              label={getDeletePackLabel(selectedItem)}
                              onClick={() => removeSavedPack(selectedItem.id)}
                            />

                            <ActionButton
                              label="Align Prism"
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
                    <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-bg-sidebar px-5 py-5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
                        Align Prism
                      </div>
                      <textarea
                        value={runPrompt}
                        onChange={(event) => setRunPrompt(event.target.value)}
                        placeholder="What should Prism focus on while aligned with this Council, Lens, Preset, or Constellation?"
                        className="mt-3 min-h-[120px] w-full rounded-[16px] border border-theme-sidebar-border bg-theme-bg-container px-4 py-4 text-sm leading-7 text-theme-text-primary outline-none placeholder:text-theme-settings-input-placeholder"
                      />

                      <div className="mt-3 text-xs leading-6 text-theme-text-secondary">
                        Alignments are staged in the current workspace chat
                        using the real invocation handles, so you can inspect
                        the full exchange afterward.
                      </div>
                    </div>
                  ) : null}

                  {loadingDetail ? (
                    <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-bg-sidebar px-5 py-5 text-sm leading-7 text-theme-text-secondary">
                      Loading selected item...
                    </div>
                  ) : (
                    renderDetail(renderItem, tab)
                  )}
                </>
              ) : (
                <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-bg-sidebar px-5 py-5 text-sm leading-7 text-theme-text-secondary">
                  Select a Council, Lens, Preset, Skill, or Governance Document
                  to inspect it.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
