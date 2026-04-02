const fs = require("fs");
const path = require("path");
const { default: slugify } = require("slugify");

let customLensCache = null;

function getStorageRoot() {
  return process.env.STORAGE_DIR
    ? path.resolve(process.env.STORAGE_DIR)
    : path.resolve(__dirname, "../../../storage");
}

function getCustomLensDirectory() {
  return path.resolve(getStorageRoot(), "metacanon", "custom-lenses");
}

function ensureCustomLensDirectory() {
  fs.mkdirSync(getCustomLensDirectory(), { recursive: true });
}

function safeJsonParse(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`Failed to parse custom lens ${filePath}`, error.message);
    return null;
  }
}

function summarizeContent(content = "") {
  return String(content || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !line.startsWith("#") &&
        !line.startsWith("*") &&
        !line.startsWith("##")
    )
    .slice(0, 2)
    .join(" ")
    .slice(0, 320);
}

function normalizeHandle(handle = "", title = "") {
  const nextHandle = String(handle || "").trim();
  if (nextHandle.startsWith("@")) return nextHandle;
  if (nextHandle) return `@${nextHandle}`;
  return `@mc-${slugify(title || "custom-lens", { lower: true, strict: true })}`;
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function normalizeCustomLens(payload = {}, baseLens = null) {
  const title = String(
    payload.title || baseLens?.title || "Custom Lens"
  ).trim();
  const requestedId = String(
    payload.id || payload.sourceId || baseLens?.id || ""
  ).trim();
  const id =
    requestedId ||
    slugify(title, {
      lower: true,
      strict: true,
    });

  const handle = normalizeHandle(
    payload.handle || baseLens?.handle || `mc-${id}`,
    title
  );
  const content = String(payload.content || baseLens?.content || "").trim();
  const overview =
    String(payload.overview || "").trim() || summarizeContent(content);

  return {
    id,
    title,
    handle,
    displayTitle: title,
    content,
    overview,
    boardSlug: payload.boardSlug || baseLens?.boardSlug || "custom-lenses",
    board: payload.board || baseLens?.board || "Custom Lenses",
    collectionKind:
      payload.collectionKind || baseLens?.collectionKind || "custom",
    collectionLabel:
      payload.collectionLabel || baseLens?.collectionLabel || "Custom Lenses",
    councilId: payload.councilId || baseLens?.councilId || null,
    councilName: payload.councilName || baseLens?.councilName || null,
    phase: payload.phase || baseLens?.phase || null,
    sourceFormat: "custom-lens",
    sourceId: payload.sourceId || baseLens?.sourceId || baseLens?.id || null,
    sourceHandle:
      payload.sourceHandle ||
      baseLens?.sourceHandle ||
      baseLens?.handle ||
      null,
    preferredBackends: uniqueStrings(
      payload.preferredBackends || baseLens?.preferredBackends || []
    ),
    fallbackBackends: uniqueStrings(
      payload.fallbackBackends || baseLens?.fallbackBackends || []
    ),
    relativePath: `storage/metacanon/custom-lenses/${id}.json`,
    detailPath: `custom-lenses/${id}.json`,
    isCustom: true,
    updatedAt: new Date().toISOString(),
    createdAt:
      payload.createdAt || baseLens?.createdAt || new Date().toISOString(),
  };
}

function loadCustomLenses() {
  if (customLensCache) return customLensCache;
  ensureCustomLensDirectory();

  const items = fs
    .readdirSync(getCustomLensDirectory(), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) =>
      safeJsonParse(path.join(getCustomLensDirectory(), entry.name))
    )
    .filter(Boolean)
    .sort((left, right) => left.title.localeCompare(right.title));

  customLensCache = items;
  return customLensCache;
}

function clearCustomLensCache() {
  customLensCache = null;
}

function listCustomLenses() {
  return loadCustomLenses();
}

function getCustomLensById(id = "") {
  const safeId = String(id || "").trim();
  if (!safeId) return null;
  return (
    loadCustomLenses().find((item) => String(item.id || "") === safeId) || null
  );
}

function getCustomLensByHandle(handle = "") {
  const safeHandle = String(handle || "")
    .trim()
    .toLowerCase();
  if (!safeHandle) return null;
  return (
    loadCustomLenses().find(
      (item) =>
        String(item.handle || "")
          .trim()
          .toLowerCase() === safeHandle
    ) || null
  );
}

function saveCustomLens(payload = {}, baseLens = null) {
  ensureCustomLensDirectory();
  const normalized = normalizeCustomLens(payload, baseLens);
  const filePath = path.join(getCustomLensDirectory(), `${normalized.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2));
  clearCustomLensCache();
  return normalized;
}

module.exports = {
  listCustomLenses,
  getCustomLensById,
  getCustomLensByHandle,
  saveCustomLens,
  clearCustomLensCache,
};
