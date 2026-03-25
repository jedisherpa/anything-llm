const {
  getLibraryManifest,
  getLibraryItem,
  getLensIndex,
  getConstellationIndex,
  getLensAliasHandles,
  getConstellationAliasHandles,
  getLensManifestByHandle,
  getLensManifestById,
  getConstellationManifestByHandle,
  getConstellationManifestById,
} = require("./store");

const METACANON_COUNCIL_HANDLE = "@council";
const warnedFailures = new Set();

function uniqueStrings(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function warnOnce(label = "", error) {
  if (warnedFailures.has(label)) return;
  warnedFailures.add(label);
  console.error(
    `[MetacanonLibrary] ${label} is unavailable: ${error?.message || error}`
  );
}

function safeRead(label, fallback, reader) {
  try {
    return reader();
  } catch (error) {
    warnOnce(label, error);
    return fallback;
  }
}

function getMetacanonLibrary() {
  return safeRead(
    "manifest",
    { generatedAt: null, counts: {}, collections: {} },
    () => getLibraryManifest()
  );
}

function getImportedLensHandles() {
  return safeRead("lens index", [], () =>
    uniqueStrings([
      ...getLensIndex().map((lens) => lens.handle),
      ...(typeof getLensAliasHandles === "function" ? getLensAliasHandles() : []),
    ])
  );
}

function getConstellationHandles() {
  return safeRead("constellation index", [], () =>
    uniqueStrings([
      ...getConstellationIndex().map((constellation) => constellation.handle),
      ...(typeof getConstellationAliasHandles === "function"
        ? getConstellationAliasHandles()
        : []),
    ])
  );
}

function getSupportedMetacanonHandles() {
  return uniqueStrings([
    METACANON_COUNCIL_HANDLE,
    ...getImportedLensHandles(),
    ...getConstellationHandles(),
  ]);
}

function getImportedLensByHandle(handle = "") {
  return safeRead(`lens handle "${handle}"`, null, () =>
    getLensManifestByHandle(handle)
  );
}

function getImportedLensById(id = "") {
  return safeRead(`lens id "${id}"`, null, () => getLensManifestById(id));
}

function getImportedLensDetailByHandle(handle = "") {
  const lens = getImportedLensByHandle(handle);
  if (!lens?.id) return null;
  return safeRead(`lens detail "${handle}"`, null, () =>
    getLibraryItem("lenses", lens.id)
  );
}

function getConstellationByHandle(handle = "") {
  return safeRead(`constellation handle "${handle}"`, null, () =>
    getConstellationManifestByHandle(handle)
  );
}

function getConstellationById(id = "") {
  return safeRead(`constellation id "${id}"`, null, () =>
    getConstellationManifestById(id)
  );
}

function getConstellationDetailByHandle(handle = "") {
  const constellation = getConstellationByHandle(handle);
  if (!constellation?.id) return null;
  return safeRead(`constellation detail "${handle}"`, null, () =>
    getLibraryItem("constellations", constellation.id)
  );
}

function getConstellationDetailById(id = "") {
  const constellation = getConstellationById(id);
  if (!constellation?.id) return null;
  return safeRead(`constellation detail "${id}"`, null, () =>
    getLibraryItem("constellations", constellation.id)
  );
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
  const manifest =
    typeof constellationOrHandle === "string"
      ? getConstellationByHandle(constellationOrHandle) ||
        getConstellationById(constellationOrHandle)
      : constellationOrHandle;

  if (!manifest) return null;

  const detail =
    typeof constellationOrHandle === "string"
      ? getConstellationDetailByHandle(constellationOrHandle) ||
        getConstellationDetailById(constellationOrHandle)
      : safeRead(`constellation detail "${manifest.id}"`, null, () =>
          getLibraryItem("constellations", manifest.id)
        );

  const constellation = detail ? { ...manifest, ...detail } : manifest;

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
  let leadHandle = "";
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

    if (/^lead:\s*/i.test(trimmed)) {
      leadHandle = trimmed.replace(/^lead:\s*/i, "").trim().toLowerCase();
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
    leadHandle: leadHandle.startsWith("@") ? leadHandle : "",
    userQuery: queryLines.join("\n").trim(),
  };
}

module.exports = {
  METACANON_COUNCIL_HANDLE,
  get metacanonLibrary() {
    return getMetacanonLibrary();
  },
  getMetacanonLibrary,
  getSupportedMetacanonHandles,
  getImportedLensDefinition,
  getImportedLensHandles,
  getConstellationHandles,
  getImportedLensByHandle,
  getImportedLensById,
  getConstellationByHandle,
  getConstellationById,
  getConstellationDetailByHandle,
  getConstellationDetailById,
  getConstellationExecutionPlan,
  parseCouncilPackPrompt,
};
