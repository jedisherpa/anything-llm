const STORAGE_KEY = "metacanon-council-packs";
const API_BASE = (import.meta.env.VITE_API_BASE || "/api").replace(/\/$/, "");

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
    lensHandles: Array.from(new Set(pack.lensHandles || [])),
    lensTitles: pack.lensTitles || [],
    createdAt: pack.createdAt || new Date().toISOString(),
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

export function deleteCouncilPack(packId = "") {
  if (typeof window === "undefined") return [];
  const next = loadCouncilPacks().filter((item) => item.id !== packId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function buildCouncilPackPrompt({
  name = "Saved Constellation",
  lensHandles = [],
  userQuery = "",
}) {
  return `@council
Pack: ${name}
Lenses: ${lensHandles.join(", ")}
User query:
${userQuery.trim()}`;
}

export async function fetchLibraryManifest() {
  const response = await fetch(`${API_BASE}/metacanonai/library/manifest`);
  if (!response.ok) {
    throw new Error("Failed to load Metacanon library manifest.");
  }
  return response.json();
}

export async function fetchLibraryCollection(tab = "") {
  const params = new URLSearchParams({ tab });
  const response = await fetch(
    `${API_BASE}/metacanonai/library/collection?${params.toString()}`
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
    `${API_BASE}/metacanonai/library/item?${params.toString()}`
  );
  if (!response.ok) {
    throw new Error("Failed to load Metacanon library item.");
  }
  return response.json();
}
