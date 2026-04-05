import { baseHeaders } from "@/utils/request";
const STORAGE_KEY = "metacanon-council-packs";
const PINNED_STORAGE_KEY = "metacanon-sidebar-pinned-constellations";
const FEATURED_LENSES_STORAGE_KEY = "metacanon-sidebar-featured-lenses";
const FEATURED_COUNCILS_STORAGE_KEY = "metacanon-sidebar-featured-councils";
const API_BASE = (import.meta.env.VITE_API_BASE || "/api").replace(/\/$/, "");
export { buildCouncilPackPrompt } from "@/utils/metacanonAlignment";
export const METACANON_PINNED_CONSTELLATIONS_EVENT =
  "metacanon_pinned_constellations_updated";
export const METACANON_FEATURED_LENSES_EVENT =
  "metacanon_featured_lenses_updated";
export const METACANON_FEATURED_COUNCILS_EVENT =
  "metacanon_featured_councils_updated";

function safeParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizePack(pack = {}) {
  return {
    id:
      pack.id || `pack-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: pack.name || "Saved Constellation",
    description: pack.description || "",
    kind: pack.kind || "custom",
    sourceId: pack.sourceId || null,
    handle: pack.handle || null,
    lensHandles: Array.from(new Set(pack.lensHandles || [])),
    lensTitles: Array.from(new Set(pack.lensTitles || [])),
    leadHandle: pack.leadHandle || null,
    leadTitle: pack.leadTitle || null,
    executionRoutes:
      pack.executionRoutes && typeof pack.executionRoutes === "object"
        ? Object.fromEntries(
            Object.entries(pack.executionRoutes).map(([handle, backends]) => [
              String(handle || "").trim(),
              Array.from(
                new Set(
                  (Array.isArray(backends) ? backends : [])
                    .map((value) => String(value || "").trim())
                    .filter(Boolean)
                )
              ),
            ])
          )
        : {},
    collectionLabel: pack.collectionLabel || "Saved Constellation",
    colorHex: pack.colorHex || null,
    createdAt: pack.createdAt || new Date().toISOString(),
  };
}

function emitStorageEvent(eventName, detail = null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(eventName, {
      detail,
    })
  );
}

function emitPinnedConstellationsUpdate(detail = null) {
  emitStorageEvent(METACANON_PINNED_CONSTELLATIONS_EVENT, detail);
}

function emitFeaturedLensesUpdate(detail = null) {
  emitStorageEvent(METACANON_FEATURED_LENSES_EVENT, detail);
}

function emitFeaturedCouncilsUpdate(detail = null) {
  emitStorageEvent(METACANON_FEATURED_COUNCILS_EVENT, detail);
}

export function buildPinnedConstellationId(pack = {}) {
  if (pack.kind === "constellation") {
    return `preset:${pack.sourceId || pack.handle || pack.id}`;
  }
  return `pack:${pack.id || pack.sourceId || pack.handle || pack.name}`;
}

function normalizePinnedConstellation(pack = {}) {
  const normalizedPack = normalizePack(pack);
  return {
    ...normalizedPack,
    pinId: pack.pinId || buildPinnedConstellationId(normalizedPack),
    pinnedAt: pack.pinnedAt || new Date().toISOString(),
  };
}

export function buildFeaturedLensId(lens = {}) {
  return `lens:${lens.id || lens.handle || lens.title || Date.now()}`;
}

function normalizeFeaturedLens(lens = {}) {
  return {
    id: lens.id || lens.handle || lens.title,
    featureId: lens.featureId || buildFeaturedLensId(lens),
    title: lens.title || lens.name || "Featured Lens",
    handle: lens.handle || null,
    description: lens.description || lens.overview || "",
    collectionLabel: lens.collectionLabel || "Featured Lens",
    colorHex: lens.colorHex || null,
    boardSlug: lens.boardSlug || null,
    councilId: lens.councilId || null,
  };
}

export function buildFeaturedCouncilId(council = {}) {
  if (council.kind === "council") {
    return `council:${council.sourceId || council.id || council.title}`;
  }
  return `council-pack:${council.id || council.sourceId || council.title}`;
}

function normalizeFeaturedCouncil(council = {}) {
  return {
    id: council.id || council.sourceId || council.title,
    sourceId: council.sourceId || council.id || null,
    featureId: council.featureId || buildFeaturedCouncilId(council),
    title: council.title || council.name || "Featured Council",
    kind: council.kind || "council",
    description: council.description || council.purpose || "",
    collectionLabel: council.collectionLabel || "Council",
    lensHandles: Array.from(new Set(council.lensHandles || [])),
    lensTitles: Array.from(new Set(council.lensTitles || [])),
    leadTitle: council.leadTitle || null,
    colorHex: council.colorHex || null,
  };
}

export function loadCouncilPacks() {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  return safeParse(raw, []).map(normalizePack);
}

export function saveCouncilPack(pack = {}) {
  if (typeof window === "undefined") return null;
  const nextPack = normalizePack(pack);
  const existing = loadCouncilPacks().filter((item) => item.id !== nextPack.id);
  const next = [nextPack, ...existing];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return nextPack;
}

export function updateCouncilPack(packId = "", updates = {}) {
  if (typeof window === "undefined") return null;

  let updatedPack = null;
  const nextPacks = loadCouncilPacks().map((item) => {
    if (item.id !== packId) return item;
    updatedPack = normalizePack({
      ...item,
      ...updates,
      id: item.id,
      createdAt: item.createdAt,
    });
    return updatedPack;
  });

  if (!updatedPack) return null;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPacks));

  const featuredCouncilId = `council-pack:${String(packId || "")}`;
  const currentFeaturedCouncils = loadFeaturedCouncils();
  let featuredCouncilUpdated = false;
  const nextFeaturedCouncils = currentFeaturedCouncils.map((item) => {
    if (item.featureId !== featuredCouncilId) return item;
    featuredCouncilUpdated = true;
    return normalizeFeaturedCouncil({
      ...item,
      sourceId: updatedPack.id,
      title: updatedPack.name,
      description: updatedPack.description,
      collectionLabel:
        updatedPack.kind === "council"
          ? "Custom Council"
          : item.collectionLabel,
      lensHandles: updatedPack.lensHandles,
      lensTitles: updatedPack.lensTitles,
      leadTitle: updatedPack.leadTitle,
      colorHex: updatedPack.colorHex,
      kind: "custom",
    });
  });

  if (featuredCouncilUpdated) {
    localStorage.setItem(
      FEATURED_COUNCILS_STORAGE_KEY,
      JSON.stringify(nextFeaturedCouncils)
    );
    emitFeaturedCouncilsUpdate(nextFeaturedCouncils);
  }

  return updatedPack;
}

export function deleteCouncilPack(packId = "") {
  if (typeof window === "undefined") return [];
  const next = loadCouncilPacks().filter((item) => item.id !== packId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  const currentPinned = loadPinnedConstellations();
  const nextPinned = currentPinned.filter(
    (item) => item.pinId !== `pack:${String(packId || "")}`
  );
  if (nextPinned.length !== currentPinned.length) {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(nextPinned));
    emitPinnedConstellationsUpdate(nextPinned);
  }
  const currentFeaturedCouncils = loadFeaturedCouncils();
  const nextFeaturedCouncils = currentFeaturedCouncils.filter(
    (item) => item.featureId !== `council-pack:${String(packId || "")}`
  );
  if (nextFeaturedCouncils.length !== currentFeaturedCouncils.length) {
    localStorage.setItem(
      FEATURED_COUNCILS_STORAGE_KEY,
      JSON.stringify(nextFeaturedCouncils)
    );
    emitFeaturedCouncilsUpdate(nextFeaturedCouncils);
  }
  return next;
}

export function loadFeaturedLenses() {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(FEATURED_LENSES_STORAGE_KEY);
  return safeParse(raw, []).map(normalizeFeaturedLens);
}

export function saveFeaturedLens(lens = {}) {
  if (typeof window === "undefined") return null;
  const nextLens = normalizeFeaturedLens(lens);
  const existing = loadFeaturedLenses().filter(
    (item) => item.featureId !== nextLens.featureId
  );
  const next = [nextLens, ...existing];
  localStorage.setItem(FEATURED_LENSES_STORAGE_KEY, JSON.stringify(next));
  emitFeaturedLensesUpdate(next);
  return nextLens;
}

export function deleteFeaturedLens(featureId = "") {
  if (typeof window === "undefined") return [];
  const next = loadFeaturedLenses().filter(
    (item) => item.featureId !== featureId
  );
  localStorage.setItem(FEATURED_LENSES_STORAGE_KEY, JSON.stringify(next));
  emitFeaturedLensesUpdate(next);
  return next;
}

export function reorderFeaturedLenses(startIndex, endIndex) {
  if (typeof window === "undefined") return [];
  const current = loadFeaturedLenses();
  if (
    startIndex < 0 ||
    endIndex < 0 ||
    startIndex >= current.length ||
    endIndex >= current.length
  ) {
    return current;
  }

  const reordered = Array.from(current);
  const [removed] = reordered.splice(startIndex, 1);
  reordered.splice(endIndex, 0, removed);
  localStorage.setItem(FEATURED_LENSES_STORAGE_KEY, JSON.stringify(reordered));
  emitFeaturedLensesUpdate(reordered);
  return reordered;
}

export function loadFeaturedCouncils() {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(FEATURED_COUNCILS_STORAGE_KEY);
  return safeParse(raw, []).map(normalizeFeaturedCouncil);
}

export function saveFeaturedCouncil(council = {}) {
  if (typeof window === "undefined") return null;
  const nextCouncil = normalizeFeaturedCouncil(council);
  const existing = loadFeaturedCouncils().filter(
    (item) => item.featureId !== nextCouncil.featureId
  );
  const next = [nextCouncil, ...existing];
  localStorage.setItem(FEATURED_COUNCILS_STORAGE_KEY, JSON.stringify(next));
  emitFeaturedCouncilsUpdate(next);
  return nextCouncil;
}

export function deleteFeaturedCouncil(featureId = "") {
  if (typeof window === "undefined") return [];
  const next = loadFeaturedCouncils().filter(
    (item) => item.featureId !== featureId
  );
  localStorage.setItem(FEATURED_COUNCILS_STORAGE_KEY, JSON.stringify(next));
  emitFeaturedCouncilsUpdate(next);
  return next;
}

export function reorderFeaturedCouncils(startIndex, endIndex) {
  if (typeof window === "undefined") return [];
  const current = loadFeaturedCouncils();
  if (
    startIndex < 0 ||
    endIndex < 0 ||
    startIndex >= current.length ||
    endIndex >= current.length
  ) {
    return current;
  }

  const reordered = Array.from(current);
  const [removed] = reordered.splice(startIndex, 1);
  reordered.splice(endIndex, 0, removed);
  localStorage.setItem(
    FEATURED_COUNCILS_STORAGE_KEY,
    JSON.stringify(reordered)
  );
  emitFeaturedCouncilsUpdate(reordered);
  return reordered;
}

export function loadPinnedConstellations() {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(PINNED_STORAGE_KEY);
  return safeParse(raw, []).map(normalizePinnedConstellation);
}

export function savePinnedConstellation(pack = {}) {
  if (typeof window === "undefined") return null;
  const nextPack = normalizePinnedConstellation(pack);
  const existing = loadPinnedConstellations().filter(
    (item) => item.pinId !== nextPack.pinId
  );
  const next = [nextPack, ...existing];
  localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(next));
  emitPinnedConstellationsUpdate(next);
  return nextPack;
}

export function deletePinnedConstellation(pinId = "") {
  if (typeof window === "undefined") return [];
  const next = loadPinnedConstellations().filter(
    (item) => item.pinId !== pinId
  );
  localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(next));
  emitPinnedConstellationsUpdate(next);
  return next;
}

export function reorderPinnedConstellations(startIndex, endIndex) {
  if (typeof window === "undefined") return [];
  const current = loadPinnedConstellations();
  if (
    startIndex < 0 ||
    endIndex < 0 ||
    startIndex >= current.length ||
    endIndex >= current.length
  ) {
    return current;
  }

  const reordered = Array.from(current);
  const [removed] = reordered.splice(startIndex, 1);
  reordered.splice(endIndex, 0, removed);
  localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(reordered));
  emitPinnedConstellationsUpdate(reordered);
  return reordered;
}
export async function fetchLibraryManifest() {
  const response = await fetch(`${API_BASE}/metacanonai/library/manifest`, {
    headers: baseHeaders(),
  });
  if (!response.ok) {
    throw new Error("Failed to load Metacanon library manifest.");
  }
  return response.json();
}

export async function fetchLibraryCollection(tab = "") {
  const params = new URLSearchParams({ tab });
  const response = await fetch(
    `${API_BASE}/metacanonai/library/collection?${params.toString()}`,
    { headers: baseHeaders() }
  );
  if (!response.ok) {
    throw new Error("Failed to load Metacanon library collection.");
  }
  const payload = await response.json();
  return Array.isArray(payload?.items) ? payload.items : [];
}

export async function fetchLibraryItem(tab = "", id = "") {
  const params = new URLSearchParams({ tab, id });
  const response = await fetch(
    `${API_BASE}/metacanonai/library/item?${params.toString()}`,
    { headers: baseHeaders() }
  );
  if (!response.ok) {
    throw new Error("Failed to load Metacanon library item.");
  }
  return response.json();
}

export async function saveCustomLens(payload = {}) {
  const response = await fetch(`${API_BASE}/metacanonai/library/custom-lens`, {
    method: "POST",
    headers: {
      ...baseHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Failed to save custom lens.";
    try {
      const errorPayload = await response.json();
      message = errorPayload?.error || message;
    } catch {
      // ignore malformed error payloads
    }
    throw new Error(message);
  }

  return response.json();
}

export async function formatLensContent(payload = {}) {
  const response = await fetch(
    `${API_BASE}/metacanonai/library/format-lens`,
    {
      method: "POST",
      headers: {
        ...baseHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    let message = "Failed to format lens content.";
    try {
      const errorPayload = await response.json();
      message = errorPayload?.error || message;
    } catch {
      // ignore malformed error payloads
    }
    throw new Error(message);
  }

  return response.json();
}

export async function fetchMetacanonFeatures() {
  const response = await fetch(`${API_BASE}/metacanonai/features`, {
    headers: baseHeaders(),
  });
  if (!response.ok) {
    throw new Error("Failed to load Metacanon feature flags.");
  }
  return response.json();
}
