const fs = require("fs");
const path = require("path");

const INDEX_PATH = path.resolve(__dirname, "library.generated.json");
const COLLECTIONS_ROOT = path.resolve(__dirname, "library-collections");
const ITEMS_ROOT = path.resolve(__dirname, "library-items");

let indexCache = null;
const itemCache = new Map();
const collectionCache = new Map();
const lensHandleMap = new Map();
const lensIdMap = new Map();
const constellationHandleMap = new Map();
const constellationIdMap = new Map();

function loadIndex() {
  if (!indexCache) {
    indexCache = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
    hydrateIndexes(indexCache);
  }
  return indexCache;
}

function hydrateIndexes(index = {}) {
  lensHandleMap.clear();
  lensIdMap.clear();
  constellationHandleMap.clear();
  constellationIdMap.clear();

  (index.lookup?.lenses || []).forEach((lens) => {
    if (lens?.handle) lensHandleMap.set(String(lens.handle).toLowerCase(), lens);
    if (lens?.id) lensIdMap.set(String(lens.id), lens);
  });

  (index.lookup?.constellations || []).forEach((constellation) => {
    if (constellation?.handle) {
      constellationHandleMap.set(
        String(constellation.handle).toLowerCase(),
        constellation
      );
    }
    if (constellation?.id) constellationIdMap.set(String(constellation.id), constellation);
  });
}

function getLibraryManifest() {
  const index = loadIndex();
  return {
    generatedAt: index.generatedAt,
    counts: index.counts || {},
    collections: index.collections || {},
  };
}

function getLibraryCollection(tab = "") {
  const safeTab = String(tab || "").trim();
  if (!safeTab) return [];
  if (collectionCache.has(safeTab)) return collectionCache.get(safeTab);

  loadIndex();
  const filePath = path.resolve(COLLECTIONS_ROOT, `${safeTab}.json`);
  const rootWithSep = `${COLLECTIONS_ROOT}${path.sep}`;
  if (filePath !== COLLECTIONS_ROOT && !filePath.startsWith(rootWithSep)) return [];
  if (!fs.existsSync(filePath)) return [];

  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const items = Array.isArray(payload?.items) ? payload.items : [];
  collectionCache.set(safeTab, items);
  return items;
}

function resolveItemPath(tab = "", id = "") {
  const safeTab = String(tab || "").trim();
  const safeId = String(id || "").trim();
  if (!safeTab || !safeId) return null;
  const nextPath = path.resolve(ITEMS_ROOT, safeTab, `${safeId}.json`);
  const rootWithSep = `${ITEMS_ROOT}${path.sep}`;
  if (nextPath !== ITEMS_ROOT && !nextPath.startsWith(rootWithSep)) return null;
  return nextPath;
}

function getLibraryItem(tab = "", id = "") {
  const cacheKey = `${tab}:${id}`;
  if (itemCache.has(cacheKey)) return itemCache.get(cacheKey);

  const filePath = resolveItemPath(tab, id);
  if (!filePath || !fs.existsSync(filePath)) return null;

  const item = JSON.parse(fs.readFileSync(filePath, "utf8"));
  itemCache.set(cacheKey, item);
  return item;
}

function getManifestItem(tab = "", id = "") {
  const cacheKey = `${tab}:${id}`;
  if (collectionCache.has(cacheKey)) return collectionCache.get(cacheKey);

  const item =
    getLibraryCollection(tab).find(
      (entry) => String(entry?.id || "") === String(id || "")
    ) || null;

  collectionCache.set(cacheKey, item);
  return item;
}

function getLensManifestByHandle(handle = "") {
  loadIndex();
  return lensHandleMap.get(String(handle || "").toLowerCase()) || null;
}

function getLensManifestById(id = "") {
  loadIndex();
  return lensIdMap.get(String(id || "")) || null;
}

function getConstellationManifestByHandle(handle = "") {
  loadIndex();
  return constellationHandleMap.get(String(handle || "").toLowerCase()) || null;
}

function getConstellationManifestById(id = "") {
  loadIndex();
  return constellationIdMap.get(String(id || "")) || null;
}

function getLensIndex() {
  return loadIndex().lookup?.lenses || [];
}

function getConstellationIndex() {
  return loadIndex().lookup?.constellations || [];
}

module.exports = {
  getLibraryManifest,
  getLibraryCollection,
  getLibraryItem,
  getManifestItem,
  getLensIndex,
  getConstellationIndex,
  getLensManifestByHandle,
  getLensManifestById,
  getConstellationManifestByHandle,
  getConstellationManifestById,
};
