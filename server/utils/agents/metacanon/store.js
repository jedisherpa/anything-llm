const fs = require("fs");
const path = require("path");
const {
  listCustomLenses,
  getCustomLensById,
  clearCustomLensCache,
} = require("./customLenses");

const INDEX_PATH = path.resolve(__dirname, "library.generated.json");
const ALIAS_PATH = path.resolve(__dirname, "library.aliases.generated.json");
const COLLECTIONS_ROOT = path.resolve(__dirname, "library-collections");
const ITEMS_ROOT = path.resolve(__dirname, "library-items");

let baseIndexCache = null;
let indexCache = null;
let aliasCache = null;
const itemCache = new Map();
const collectionCache = new Map();
const lensHandleMap = new Map();
const lensIdMap = new Map();
const constellationHandleMap = new Map();
const constellationIdMap = new Map();
const lensHandleAliases = new Set();
const constellationHandleAliases = new Set();
const itemIdAliases = {
  lenses: new Map(),
  constellations: new Map(),
  councils: new Map(),
};

function readJsonFile(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(
      `Failed to load Metacanon ${label} from ${filePath}: ${error.message}`
    );
  }
}

function loadIndex() {
  if (!indexCache) {
    if (!baseIndexCache) {
      baseIndexCache = readJsonFile(INDEX_PATH, "library index");
    }
    indexCache = buildMergedIndex(baseIndexCache);
    hydrateIndexes(indexCache);
  }
  return indexCache;
}

function buildMergedIndex(baseIndex = {}) {
  const mergedIndex = JSON.parse(JSON.stringify(baseIndex || {}));
  const baseLenses = Array.isArray(mergedIndex.lookup?.lenses)
    ? mergedIndex.lookup.lenses
    : [];
  const lensesById = new Map(
    baseLenses.map((lens) => [String(lens.id || ""), lens])
  );

  listCustomLenses().forEach((lens) => {
    lensesById.set(String(lens.id || ""), {
      ...lens,
      title: lens.title || lens.displayTitle || "Custom Lens",
      handle: lens.handle,
      detailPath: lens.detailPath || `custom-lenses/${lens.id}.json`,
    });
  });

  const mergedLenses = Array.from(lensesById.values()).sort((left, right) =>
    String(left.title || "").localeCompare(String(right.title || ""))
  );

  mergedIndex.lookup = {
    ...(mergedIndex.lookup || {}),
    lenses: mergedLenses,
  };
  mergedIndex.counts = {
    ...(mergedIndex.counts || {}),
    lenses: mergedLenses.length,
  };
  return mergedIndex;
}

function loadAliases() {
  if (aliasCache !== null) return aliasCache;

  try {
    aliasCache = readJsonFile(ALIAS_PATH, "library aliases");
  } catch {
    aliasCache = {
      lenses: { id: {}, handle: {} },
      constellations: { id: {}, handle: {} },
      councils: { id: {} },
    };
  }

  return aliasCache;
}

function hydrateIndexes(index = {}) {
  lensHandleMap.clear();
  lensIdMap.clear();
  constellationHandleMap.clear();
  constellationIdMap.clear();
  lensHandleAliases.clear();
  constellationHandleAliases.clear();
  Object.values(itemIdAliases).forEach((map) => map.clear());

  const lenses = index.lookup?.lenses || [];
  const constellations = index.lookup?.constellations || [];
  const aliases =
    index.aliases && Object.keys(index.aliases).length > 0
      ? index.aliases
      : loadAliases();
  const lensIdAliases = aliases.lenses?.id || aliases.lenses?.byId || {};
  const lensHandleAliasesMap =
    aliases.lenses?.handle || aliases.lenses?.byHandle || {};
  const constellationIdAliases =
    aliases.constellations?.id || aliases.constellations?.byId || {};
  const constellationHandleAliasesMap =
    aliases.constellations?.handle || aliases.constellations?.byHandle || {};
  const councilIdAliases = aliases.councils?.id || aliases.councils?.byId || {};

  lenses.forEach((lens) => {
    if (lens?.handle)
      lensHandleMap.set(String(lens.handle).toLowerCase(), lens);
    if (lens?.id) lensIdMap.set(String(lens.id), lens);
  });

  constellations.forEach((constellation) => {
    if (constellation?.handle) {
      constellationHandleMap.set(
        String(constellation.handle).toLowerCase(),
        constellation
      );
    }
    if (constellation?.id)
      constellationIdMap.set(String(constellation.id), constellation);
  });

  Object.entries(lensIdAliases).forEach(([legacyId, nextId]) => {
    const target = lensIdMap.get(String(nextId));
    if (!target) return;
    lensIdMap.set(String(legacyId), target);
    itemIdAliases.lenses.set(String(legacyId), String(nextId));
  });

  Object.entries(lensHandleAliasesMap).forEach(([legacyHandle, nextHandle]) => {
    const target = lensHandleMap.get(String(nextHandle).toLowerCase());
    if (!target) return;
    lensHandleMap.set(String(legacyHandle).toLowerCase(), target);
    lensHandleAliases.add(String(legacyHandle).toLowerCase());
  });

  Object.entries(constellationIdAliases).forEach(([legacyId, nextId]) => {
    const target = constellationIdMap.get(String(nextId));
    if (!target) return;
    constellationIdMap.set(String(legacyId), target);
    itemIdAliases.constellations.set(String(legacyId), String(nextId));
  });

  Object.entries(constellationHandleAliasesMap).forEach(
    ([legacyHandle, nextHandle]) => {
      const target = constellationHandleMap.get(
        String(nextHandle).toLowerCase()
      );
      if (!target) return;
      constellationHandleMap.set(String(legacyHandle).toLowerCase(), target);
      constellationHandleAliases.add(String(legacyHandle).toLowerCase());
    }
  );

  Object.entries(councilIdAliases).forEach(([legacyId, nextId]) => {
    itemIdAliases.councils.set(String(legacyId), String(nextId));
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
  if (filePath !== COLLECTIONS_ROOT && !filePath.startsWith(rootWithSep))
    return [];
  if (!fs.existsSync(filePath)) return [];

  const payload = readJsonFile(filePath, `library collection "${safeTab}"`);
  let items = Array.isArray(payload?.items) ? payload.items : [];
  if (safeTab === "lenses") {
    const itemsById = new Map(
      items.map((item) => [String(item.id || ""), item])
    );
    listCustomLenses().forEach((lens) => {
      itemsById.set(String(lens.id || ""), lens);
    });
    items = Array.from(itemsById.values()).sort((left, right) =>
      String(left.title || "").localeCompare(String(right.title || ""))
    );
  }
  collectionCache.set(safeTab, items);
  return items;
}

function resolveItemPath(tab = "", id = "") {
  const safeTab = String(tab || "").trim();
  const safeId = resolveItemIdAlias(safeTab, id);
  if (!safeTab || !safeId) return null;
  const nextPath = path.resolve(ITEMS_ROOT, safeTab, `${safeId}.json`);
  const rootWithSep = `${ITEMS_ROOT}${path.sep}`;
  if (nextPath !== ITEMS_ROOT && !nextPath.startsWith(rootWithSep)) return null;
  return nextPath;
}

function resolveItemIdAlias(tab = "", id = "") {
  loadIndex();
  const safeTab = String(tab || "").trim();
  const safeId = String(id || "").trim();
  if (!safeTab || !safeId) return safeId;
  return itemIdAliases[safeTab]?.get(safeId) || safeId;
}

function getLibraryItem(tab = "", id = "") {
  const resolvedId = resolveItemIdAlias(tab, id);
  const cacheKey = `${tab}:${resolvedId}`;
  if (itemCache.has(cacheKey)) return itemCache.get(cacheKey);

  if (tab === "lenses") {
    const customLens = getCustomLensById(resolvedId);
    if (customLens) {
      itemCache.set(cacheKey, customLens);
      return customLens;
    }
  }

  const filePath = resolveItemPath(tab, resolvedId);
  if (!filePath || !fs.existsSync(filePath)) return null;

  const item = readJsonFile(filePath, `library item "${cacheKey}"`);
  itemCache.set(cacheKey, item);
  return item;
}

function getManifestItem(tab = "", id = "") {
  const resolvedId = resolveItemIdAlias(tab, id);
  const cacheKey = `${tab}:${resolvedId}`;
  if (collectionCache.has(cacheKey)) return collectionCache.get(cacheKey);

  const item =
    getLibraryCollection(tab).find(
      (entry) => String(entry?.id || "") === resolvedId
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

function getLensAliasHandles() {
  loadIndex();
  return [...lensHandleAliases];
}

function getConstellationAliasHandles() {
  loadIndex();
  return [...constellationHandleAliases];
}

function clearMetacanonStoreCaches() {
  baseIndexCache = null;
  indexCache = null;
  aliasCache = null;
  itemCache.clear();
  collectionCache.clear();
  lensHandleMap.clear();
  lensIdMap.clear();
  constellationHandleMap.clear();
  constellationIdMap.clear();
  lensHandleAliases.clear();
  constellationHandleAliases.clear();
  Object.values(itemIdAliases).forEach((map) => map.clear());
  clearCustomLensCache();
}

module.exports = {
  getLibraryManifest,
  getLibraryCollection,
  getLibraryItem,
  getManifestItem,
  getLensIndex,
  getConstellationIndex,
  getLensAliasHandles,
  getConstellationAliasHandles,
  getLensManifestByHandle,
  getLensManifestById,
  getConstellationManifestByHandle,
  getConstellationManifestById,
  clearMetacanonStoreCaches,
};
