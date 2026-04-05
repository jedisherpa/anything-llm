const fs = require("fs");
const path = require("path");
const { default: slugify } = require("slugify");

let customConstellationCache = null;

function getStorageRoot() {
  return process.env.STORAGE_DIR
    ? path.resolve(process.env.STORAGE_DIR)
    : path.resolve(__dirname, "../../../storage");
}

function getCustomConstellationDirectory() {
  return path.resolve(
    getStorageRoot(),
    "metacanon",
    "custom-constellations"
  );
}

function ensureCustomConstellationDirectory() {
  fs.mkdirSync(getCustomConstellationDirectory(), { recursive: true });
}

function safeJsonParse(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(
      `Failed to parse custom constellation ${filePath}`,
      error.message
    );
    return null;
  }
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

/**
 * Normalize an incoming payload into the canonical custom constellation shape.
 * Mirrors `normalizeCustomLens` in customLenses.js.
 */
function normalizeCustomConstellation(payload = {}) {
  const name = String(payload.name || "Custom Constellation").trim();
  const requestedId = String(payload.id || "").trim();
  const id =
    requestedId ||
    slugify(name, {
      lower: true,
      strict: true,
    });

  const kind =
    payload.kind === "custom-shape" || payload.kind === "custom-council"
      ? payload.kind
      : payload.mode === "shape"
        ? "custom-shape"
        : "custom-council";

  const handle = (() => {
    const raw = String(payload.handle || "").trim();
    if (raw.startsWith("@")) return raw;
    if (raw) return `@${raw}`;
    return `@constellation-custom-${id}`;
  })();

  const lenses = Array.isArray(payload.lenses) ? payload.lenses : [];

  const lensHandles = uniqueStrings(
    payload.lensHandles ||
      lenses.map((l) => l.handle).filter(Boolean)
  );

  const lensTitles = uniqueStrings(
    payload.lensTitles ||
      lenses.map((l) => l.title || l.displayTitle).filter(Boolean)
  );

  const executionRoutes =
    payload.executionRoutes && typeof payload.executionRoutes === "object"
      ? Object.fromEntries(
          Object.entries(payload.executionRoutes).map(([h, backends]) => [
            String(h || "").trim(),
            uniqueStrings(backends),
          ])
        )
      : {};

  return {
    id,
    name,
    handle,
    description: String(payload.description || "").trim(),
    kind,
    // Shape-specific fields
    shapeId: payload.shapeId || payload.shapeKey || null,
    // Lens membership
    lenses: lenses.map((lens, index) => ({
      handle: lens.handle || null,
      title: lens.title || lens.displayTitle || null,
      slot: lens.slot || index + 1,
      role: lens.role || lens.title || null,
      locked: Boolean(lens.locked),
    })),
    lensHandles,
    lensTitles,
    leadHandle:
      payload.leadHandle ||
      payload.projectManagerLensHandle ||
      null,
    leadTitle:
      payload.leadTitle ||
      payload.projectManagerLensTitle ||
      null,
    executionRoutes,
    isCustom: true,
    relativePath: `storage/metacanon/custom-constellations/${id}.json`,
    detailPath: `custom-constellations/${id}.json`,
    updatedAt: new Date().toISOString(),
    createdAt:
      payload.createdAt || new Date().toISOString(),
  };
}

function loadCustomConstellations() {
  if (customConstellationCache) return customConstellationCache;
  ensureCustomConstellationDirectory();

  const items = fs
    .readdirSync(getCustomConstellationDirectory(), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) =>
      safeJsonParse(
        path.join(getCustomConstellationDirectory(), entry.name)
      )
    )
    .filter(Boolean)
    .sort((left, right) =>
      String(left.name || "").localeCompare(String(right.name || ""))
    );

  customConstellationCache = items;
  return customConstellationCache;
}

function clearCustomConstellationCache() {
  customConstellationCache = null;
}

function listCustomConstellations() {
  return loadCustomConstellations();
}

function getCustomConstellationById(id = "") {
  const safeId = String(id || "").trim();
  if (!safeId) return null;
  return (
    loadCustomConstellations().find(
      (item) => String(item.id || "") === safeId
    ) || null
  );
}

function getCustomConstellationByHandle(handle = "") {
  const safeHandle = String(handle || "")
    .trim()
    .toLowerCase();
  if (!safeHandle) return null;
  return (
    loadCustomConstellations().find(
      (item) =>
        String(item.handle || "")
          .trim()
          .toLowerCase() === safeHandle
    ) || null
  );
}

function saveCustomConstellation(payload = {}) {
  ensureCustomConstellationDirectory();
  const normalized = normalizeCustomConstellation(payload);
  const filePath = path.join(
    getCustomConstellationDirectory(),
    `${normalized.id}.json`
  );
  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2));
  clearCustomConstellationCache();
  return normalized;
}

function deleteCustomConstellation(id = "") {
  const safeId = String(id || "").trim();
  if (!safeId) return false;
  const filePath = path.join(
    getCustomConstellationDirectory(),
    `${safeId}.json`
  );
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  clearCustomConstellationCache();
  return true;
}

module.exports = {
  listCustomConstellations,
  getCustomConstellationById,
  getCustomConstellationByHandle,
  saveCustomConstellation,
  deleteCustomConstellation,
  clearCustomConstellationCache,
};
