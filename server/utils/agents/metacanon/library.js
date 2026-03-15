const {
  getLibraryManifest,
  getLibraryItem,
  getLensIndex,
  getConstellationIndex,
  getLensManifestByHandle,
  getLensManifestById,
  getConstellationManifestByHandle,
  getConstellationManifestById,
} = require("./store");

const library = getLibraryManifest();

const METACANON_COUNCIL_HANDLE = "@council";

function uniqueStrings(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function getImportedLensHandles() {
  return getLensIndex().map((lens) => lens.handle);
}

function getConstellationHandles() {
  return getConstellationIndex().map((constellation) => constellation.handle);
}

function getSupportedMetacanonHandles() {
  return uniqueStrings([
    METACANON_COUNCIL_HANDLE,
    ...getImportedLensHandles(),
    ...getConstellationHandles(),
  ]);
}

function getImportedLensByHandle(handle = "") {
  return getLensManifestByHandle(handle);
}

function getImportedLensById(id = "") {
  return getLensManifestById(id);
}

function getImportedLensDetailByHandle(handle = "") {
  const lens = getImportedLensByHandle(handle);
  if (!lens?.id) return null;
  return getLibraryItem("lenses", lens.id);
}

function getConstellationByHandle(handle = "") {
  return getConstellationManifestByHandle(handle);
}

function getConstellationById(id = "") {
  return getConstellationManifestById(id);
}

function getImportedLensDefinition(handle = "", functions = []) {
  const lens = getImportedLensByHandle(handle);
  const detail = getImportedLensDetailByHandle(handle);
  if (!lens || !detail?.content) return null;

  return {
    name: lens.handle,
    definition: {
      role: detail.content,
      soul: lens.board,
      lensId: lens.id,
      lensTitle: lens.title,
      board: lens.board,
      functions: [...functions],
    },
  };
}

function getConstellationExecutionPlan(constellationOrHandle = "") {
  const constellation =
    typeof constellationOrHandle === "string"
      ? getConstellationByHandle(constellationOrHandle) ||
        getConstellationById(constellationOrHandle)
      : constellationOrHandle;

  if (!constellation) return null;

  const projectManager = constellation.projectManagerHandle
    ? getImportedLensByHandle(constellation.projectManagerHandle)
    : null;

  const members = (constellation.members || [])
    .map((member) => {
      if (!member?.lensHandle) return null;
      const lens = getImportedLensByHandle(member.lensHandle);
      if (!lens) return null;
      return {
        ...member,
        lens,
      };
    })
    .filter(Boolean);

  return {
    constellation,
    projectManager,
    members,
    handles: uniqueStrings([
      projectManager?.handle,
      ...members.map((member) => member.lens.handle),
    ]),
  };
}

function parseCouncilPackPrompt(prompt = "") {
  const raw = String(prompt || "");
  const lines = raw.split(/\r?\n/);
  const handles = [];
  let packName = "Saved Council Pack";
  let readingQuery = false;
  const queryLines = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (index === 0) return;
    if (!trimmed && !readingQuery) return;

    if (/^pack:\s*/i.test(trimmed)) {
      packName = trimmed.replace(/^pack:\s*/i, "").trim() || packName;
      return;
    }

    if (/^lenses:\s*/i.test(trimmed)) {
      trimmed
        .replace(/^lenses:\s*/i, "")
        .split(/[,\s]+/)
        .map((token) => token.trim().toLowerCase())
        .filter((token) => token.startsWith("@"))
        .forEach((token) => handles.push(token));
      return;
    }

    if (/^user query:\s*/i.test(trimmed)) {
      const inlineQuery = trimmed.replace(/^user query:\s*/i, "");
      if (inlineQuery) queryLines.push(inlineQuery);
      readingQuery = true;
      return;
    }

    if (readingQuery) {
      queryLines.push(line);
    }
  });

  return {
    packName,
    handles: uniqueStrings(handles),
    userQuery: queryLines.join("\n").trim(),
  };
}

module.exports = {
  METACANON_COUNCIL_HANDLE,
  metacanonLibrary: library,
  getSupportedMetacanonHandles,
  getImportedLensDefinition,
  getImportedLensHandles,
  getConstellationHandles,
  getImportedLensByHandle,
  getImportedLensById,
  getConstellationByHandle,
  getConstellationById,
  getConstellationExecutionPlan,
  parseCouncilPackPrompt,
};
