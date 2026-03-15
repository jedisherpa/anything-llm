import fs from "node:fs/promises";
import path from "node:path";

const [
  existingLibraryFile,
  lensArchiveRoot,
  frontendOutputFile,
  serverOutputFile,
] = process.argv.slice(2);

if (
  !existingLibraryFile ||
  !lensArchiveRoot ||
  !frontendOutputFile ||
  !serverOutputFile
) {
  console.error(
    "Usage: node scripts/augment_metacanon_library_with_lens_archive.mjs <existingLibraryJson> <lensArchiveRoot> <frontendOutputFile> <serverOutputFile>"
  );
  process.exit(1);
}

const DIRECT_RESPONSE_BOARD = "Direct Response Board";
const DIRECT_RESPONSE_LABEL = "Studio";

function slugify(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function boardLabel(board = "") {
  if (board === DIRECT_RESPONSE_BOARD) return DIRECT_RESPONSE_LABEL;
  return board;
}

function stripLensPrefix(value = "") {
  return String(value || "")
    .replace(
      /^(?:AI|Perspective)\s+Contact\s+Lens(?:\s+v[\d.]+)?\s*:?\s*/i,
      ""
    )
    .trim();
}

function stripLensSuffix(value = "") {
  return String(value || "").replace(/\s+Lens$/i, "").trim();
}

function buildArchetypeName(value = "", fallback = "Untitled") {
  const cleaned = stripLensSuffix(stripLensPrefix(value));
  return cleaned || fallback;
}

function extractHeading(content = "") {
  return (
    String(content || "")
      .match(/^#\s+(.+)$/m)?.[1]
      ?.trim() || ""
  );
}

function extractField(content = "", label = "") {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(content || "").match(
    new RegExp(`^\\*\\*${escaped}:\\*\\*\\s*(.+)$`, "m")
  );
  return match?.[1]?.trim() || null;
}

function extractSection(content = "", heading = "") {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(content || "").match(
    new RegExp(
      `^##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`,
      "im"
    )
  );
  return match?.[1]?.trim() || null;
}

function cleanLensContent(content = "") {
  const normalized = String(content || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/^\s*##\s+Agent Name\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normalized ? `${normalized}\n` : "";
}

function enrichLegacyLens(lens = {}, index = 0) {
  const content = cleanLensContent(lens.content || "");
  const rawTitle = lens.title || extractHeading(content) || lens.id || "Untitled";
  const archetypeName = buildArchetypeName(rawTitle, rawTitle);
  const collectionLabel = boardLabel(lens.board || lens.boardSlug || "Library");
  const collectionId = lens.boardSlug || slugify(collectionLabel);

  return {
    ...lens,
    content,
    archetypeName,
    displayTitle: archetypeName,
    collectionId,
    collectionLabel,
    collectionKind: "board",
    displayBoard: collectionLabel,
    backendId: lens.backendId || lens.id,
    colorHex: lens.colorHex || null,
    sortOrder: Number.isFinite(lens.sortOrder) ? lens.sortOrder : index + 1,
  };
}

function parseCouncilNumber(councilId = "", councilLabel = "") {
  const councilMatch =
    String(councilId || "").match(/Council_(\d{2})/i) ||
    String(councilLabel || "").match(/Council\s+(\d+)/i);
  return councilMatch ? Number(councilMatch[1]) : null;
}

function buildArchiveLens(filePath, content = "") {
  const relativePath = path.relative(lensArchiveRoot, filePath).replace(/\\/g, "/");
  const backendId = path.basename(filePath, path.extname(filePath));
  const heading = extractHeading(content) || backendId.replace(/_/g, " ");
  const archetypeName = buildArchetypeName(heading, heading);
  const councilId = path.basename(path.dirname(filePath));
  const councilField = extractField(content, "Council") || councilId;
  const councilNumber = parseCouncilNumber(councilId, councilField) || 0;
  const councilName =
    councilField.match(/^Council\s+\d+\s*:\s*(.+)$/i)?.[1]?.trim() || null;
  const councilLabel = councilNumber > 0 ? `Council ${councilNumber}` : councilField;
  const lensNumberField = extractField(content, "Lens Number") || "";
  const lensNumber = Number(lensNumberField.match(/^(\d+)/)?.[1] || 0);
  const phase = extractField(content, "Phase");
  const overview = extractSection(content, "Overview");
  const boardSlug = councilNumber
    ? `council-${String(councilNumber).padStart(2, "0")}`
    : slugify(councilId);
  const id = slugify(backendId);

  return {
    id,
    title: archetypeName,
    board: councilLabel,
    boardSlug,
    handle: `@mc-${id}`,
    content: cleanLensContent(content),
    relativePath,
    sourceFormat: "markdown-archive",
    archetypeName,
    displayTitle: archetypeName,
    collectionId: boardSlug,
    collectionLabel: councilLabel,
    collectionKind: "council",
    displayBoard: councilLabel,
    councilId,
    councilLabel,
    councilName,
    phase,
    lensNumber,
    lensCountInCouncil: 12,
    overview,
    backendId,
    colorHex: null,
    sortOrder: councilNumber * 100 + lensNumber,
  };
}

async function listMarkdownFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) return listMarkdownFiles(fullPath);
      return fullPath.endsWith(".md") ? [fullPath] : [];
    })
  );

  return files.flat().sort();
}

async function loadArchiveLenses(root) {
  const files = await listMarkdownFiles(root);
  return Promise.all(
    files.map(async (filePath) =>
      buildArchiveLens(filePath, await fs.readFile(filePath, "utf8"))
    )
  );
}

const existingLibrary = JSON.parse(
  await fs.readFile(existingLibraryFile, "utf8")
);

const legacyLenses = (existingLibrary.lenses || []).map(enrichLegacyLens);
const archiveLenses = await loadArchiveLenses(lensArchiveRoot);

const combinedLenses = [
  ...legacyLenses,
  ...archiveLenses
    .filter((lens) => !legacyLenses.some((existing) => existing.id === lens.id))
    .sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0)),
];

const mergedLibrary = {
  ...existingLibrary,
  generatedAt: new Date().toISOString(),
  counts: {
    ...existingLibrary.counts,
    lenses: combinedLenses.length,
  },
  lenses: combinedLenses,
};

await fs.mkdir(path.dirname(frontendOutputFile), { recursive: true });
await fs.writeFile(
  frontendOutputFile,
  `export const metacanonLibrary = ${JSON.stringify(
    mergedLibrary,
    null,
    2
  )};\n\nexport default metacanonLibrary;\n`,
  "utf8"
);

await fs.mkdir(path.dirname(serverOutputFile), { recursive: true });
await fs.writeFile(serverOutputFile, JSON.stringify(mergedLibrary, null, 2), "utf8");

console.log(
  `Merged ${legacyLenses.length} legacy lenses with ${archiveLenses.length} archive lenses for ${combinedLenses.length} total lenses.`
);
