import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  buildCanonicalBoardLensId,
  buildCanonicalConstellationId,
  buildCanonicalCouncilId,
  buildCanonicalCouncilLensId,
  buildConstellationHandle,
  buildLensHandle,
  resolveConstellationTitle,
  resolveCouncilLabel,
  resolveCouncilName,
  resolveLensDisplayTitle,
} from "./metacanonCanonicalNames.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const SERVER_ROOT = path.join(REPO_ROOT, "server/utils/agents/metacanon");
const FRONTEND_ROOT = path.join(REPO_ROOT, "frontend/src/data/metacanon");
const MOBILE_ROOT = path.join(
  REPO_ROOT,
  "mobile-ios/PrismAI/PrismAI/Resources/MetacanonLibrary"
);

function collectionPath(root, tab) {
  return path.join(root, "library-collections", `${tab}.json`);
}

function itemPath(root, tab, id) {
  return path.join(root, "library-items", tab, `${id}.json`);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function readHeadJson(repoPath) {
  try {
    const raw = execFileSync("git", ["show", `HEAD:${repoPath}`], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readJsonCandidate(filePath) {
  try {
    if (!(await fileExists(filePath))) return null;
    return await readJson(filePath);
  } catch {
    return null;
  }
}

async function loadCollection(root, tab) {
  const payload = await readJson(collectionPath(root, tab));
  return Array.isArray(payload?.items) ? payload.items : [];
}

function byId(items = []) {
  return new Map(items.map((item) => [String(item.id), item]));
}

function nonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

function parseCouncilNumber(item = {}) {
  const fromCouncilId = String(item.councilId || "").match(/Council_(\d{2})/i);
  if (fromCouncilId) return Number(fromCouncilId[1]);

  const fromCollectionId = String(item.collectionId || "").match(/council-(\d{1,2})/i);
  if (fromCollectionId) return Number(fromCollectionId[1]);

  const fromRelativePath = String(item.relativePath || "").match(/Council_(\d{2})_/i);
  if (fromRelativePath) return Number(fromRelativePath[1]);

  const sortOrder = Number(item.sortOrder || 0);
  if (sortOrder > 0) return Math.floor(sortOrder / 100);

  return null;
}

function parseLensNumber(item = {}) {
  const fromRelativePath = String(item.relativePath || "").match(
    /PCL_\d{2}_(\d{2})_/i
  );
  if (fromRelativePath) return Number(fromRelativePath[1]);

  const lensNumber = Number(item.lensNumber || 0);
  return lensNumber > 0 ? lensNumber : null;
}

function pad2(value = 0) {
  return String(value || 0).padStart(2, "0");
}

function fileStem(relativePath = "") {
  return path.basename(String(relativePath || ""), path.extname(relativePath || ""));
}

function computeLegacyBoardLensId(item = {}) {
  const boardSlug = nonEmpty(item.boardSlug, item.collectionId, item.board, "library");
  return `${boardSlug}-${fileStem(item.relativePath || "")}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function computeLegacyCouncilLensId(item = {}) {
  const backendId = String(item.backendId || "").trim();
  if (backendId) {
    return backendId
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  const councilNumber = parseCouncilNumber(item);
  const lensNumber = parseLensNumber(item);
  if (!councilNumber || !lensNumber) return String(item.id || "");

  return `lens-${pad2(councilNumber)}-${pad2(lensNumber)}`;
}

function computeLegacyConstellationId(item = {}) {
  return String(item.name || item.id || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sortByDisplayTitle(left = {}, right = {}) {
  return String(left.displayTitle || left.title).localeCompare(
    String(right.displayTitle || right.title)
  );
}

function summarizeLensReference(lens = {}) {
  return {
    id: lens.id,
    title: lens.title,
    displayTitle: lens.displayTitle,
    handle: lens.handle,
    overview: lens.overview || "",
    phase: lens.phase || null,
    collectionLabel: lens.collectionLabel || lens.board || null,
    collectionKind: lens.collectionKind || null,
  };
}

function summarizeLensForUi(lens = {}) {
  return {
    id: lens.id,
    title: lens.title,
    displayTitle: lens.displayTitle,
    handle: lens.handle,
    overview: lens.overview,
    collectionId: lens.collectionId,
    collectionLabel: lens.collectionLabel,
    collectionKind: lens.collectionKind,
    councilId: lens.councilId || null,
    councilLabel: lens.councilLabel || null,
    councilName: lens.councilName || null,
    board: lens.board || null,
    boardSlug: lens.boardSlug || null,
    displayBoard: lens.displayBoard || null,
    phase: lens.phase || null,
    sortOrder: lens.sortOrder || null,
    sourceFormat: lens.sourceFormat || null,
    relativePath: lens.relativePath || null,
    backendId: lens.backendId || null,
    colorHex: lens.colorHex || null,
    detailPath: `lenses/${lens.id}.json`,
  };
}

function summarizeConstellationForUi(constellation = {}) {
  return {
    id: constellation.id,
    title: constellation.title,
    displayTitle: constellation.displayTitle || constellation.title,
    handle: constellation.handle,
    type: constellation.type,
    purpose: constellation.purpose,
    projectManagerTitle: constellation.projectManagerTitle || null,
    projectManagerHandle: constellation.projectManagerHandle || null,
    members: (constellation.members || []).map((member) => ({
      role: member.role,
      displayRole: member.displayRole || member.role,
      lensTitle: member.lensTitle || null,
      lensHandle: member.lensHandle || null,
      relativePath: member.relativePath || null,
    })),
    relativePath: constellation.relativePath || null,
    detailPath: `constellations/${constellation.id}.json`,
  };
}

function summarizeSkillForUi(skill = {}) {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description || "",
    relativePath: skill.relativePath || null,
    detailPath: `skills/${skill.id}.json`,
  };
}

function summarizeGovernanceDocumentForUi(document = {}) {
  return {
    id: document.id,
    name: document.name,
    format: document.format,
    relativePath: document.relativePath || null,
    repoRelativePath: document.repoRelativePath || null,
    overview: document.overview || "",
    detailPath: `constitution/${document.id}.json`,
  };
}

function buildCouncilManifest(lenses = []) {
  const grouped = new Map();

  lenses
    .filter((lens) => lens.collectionKind === "council")
    .forEach((lens) => {
      const councilId = lens.councilId || lens.collectionId || lens.id;
      const current = grouped.get(councilId) || {
        id: councilId,
        title: lens.councilName || lens.councilLabel || lens.collectionLabel,
        councilName: lens.councilName || lens.councilLabel || lens.collectionLabel,
        councilLabel:
          lens.councilLabel ||
          lens.collectionLabel ||
          lens.displayBoard ||
          lens.board,
        phase: lens.phase || null,
        councilNumber: lens.councilNumber || null,
        sortOrder: lens.councilNumber || 999,
        lensCount: 0,
        lensHandles: [],
        lensTitles: [],
        lenses: [],
        detailPath: `councils/${councilId}.json`,
      };

      current.lensCount += 1;
      current.lensHandles.push(lens.handle);
      current.lensTitles.push(lens.displayTitle || lens.title);
      current.lenses.push({
        id: lens.id,
        handle: lens.handle,
        title: lens.title,
        displayTitle: lens.displayTitle,
      });

      grouped.set(councilId, current);
    });

  return Array.from(grouped.values()).sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
    return String(left.title).localeCompare(String(right.title));
  });
}

function buildCouncilDetails(lenses = []) {
  const manifest = buildCouncilManifest(lenses);
  const lensesByCouncil = new Map();

  lenses
    .filter((lens) => lens.collectionKind === "council")
    .forEach((lens) => {
      const councilId = lens.councilId || lens.collectionId || lens.id;
      const items = lensesByCouncil.get(councilId) || [];
      items.push(summarizeLensReference(lens));
      lensesByCouncil.set(councilId, items);
    });

  return manifest.map((council) => ({
    ...council,
    lenses: (lensesByCouncil.get(council.id) || []).sort(sortByDisplayTitle),
  }));
}

function buildCollectionIndex(collections = {}) {
  return Object.fromEntries(
    Object.entries(collections).map(([name, items]) => [
      name,
      {
        count: Array.isArray(items) ? items.length : 0,
        path: `library-collections/${name}.json`,
      },
    ])
  );
}

function buildAliases(lenses = [], constellations = [], councils = []) {
  const aliases = {
    lenses: { byId: {}, byHandle: {} },
    constellations: { byId: {}, byHandle: {} },
    councils: { byId: {} },
  };

  for (const lens of lenses) {
    if (lens.legacyId && lens.legacyId !== lens.id) {
      aliases.lenses.byId[lens.legacyId] = lens.id;
    }
    if (lens.legacyHandle && lens.legacyHandle !== lens.handle) {
      aliases.lenses.byHandle[String(lens.legacyHandle).toLowerCase()] = lens.handle;
    }
    if (lens.legacyCouncilId && lens.legacyCouncilId !== lens.councilId) {
      aliases.councils.byId[lens.legacyCouncilId] = lens.councilId;
    }
    if (lens.legacyCollectionId && lens.legacyCollectionId !== lens.collectionId) {
      aliases.councils.byId[lens.legacyCollectionId] = lens.collectionId;
    }
  }

  for (const constellation of constellations) {
    if (constellation.legacyId && constellation.legacyId !== constellation.id) {
      aliases.constellations.byId[constellation.legacyId] = constellation.id;
    }
    if (
      constellation.legacyHandle &&
      constellation.legacyHandle !== constellation.handle
    ) {
      aliases.constellations.byHandle[
        String(constellation.legacyHandle).toLowerCase()
      ] = constellation.handle;
    }
  }

  for (const council of councils) {
    if (council.legacyId && council.legacyId !== council.id) {
      aliases.councils.byId[council.legacyId] = council.id;
    }
  }

  return aliases;
}

function mergeAliasMaps(base = {}, extra = {}) {
  return {
    lenses: {
      byId: {
        ...(base.lenses?.byId || {}),
        ...(extra.lenses?.byId || {}),
      },
      byHandle: {
        ...(base.lenses?.byHandle || {}),
        ...(extra.lenses?.byHandle || {}),
      },
    },
    constellations: {
      byId: {
        ...(base.constellations?.byId || {}),
        ...(extra.constellations?.byId || {}),
      },
      byHandle: {
        ...(base.constellations?.byHandle || {}),
        ...(extra.constellations?.byHandle || {}),
      },
    },
    councils: {
      byId: {
        ...(base.councils?.byId || {}),
        ...(extra.councils?.byId || {}),
      },
    },
  };
}

function buildLegacyConstellationAliases(currentConstellations = []) {
  const aliases = {
    lenses: { byId: {}, byHandle: {} },
    constellations: { byId: {}, byHandle: {} },
    councils: { byId: {} },
  };

  const headCollection = readHeadJson(
    "server/utils/agents/metacanon/library-collections/constellations.json"
  );
  const previousItems = Array.isArray(headCollection?.items)
    ? headCollection.items
    : [];
  const currentByRelativePath = new Map(
    currentConstellations
      .filter((item) => item?.relativePath)
      .map((item) => [String(item.relativePath), item])
  );

  for (const previous of previousItems) {
    const relativePath = String(previous?.relativePath || "");
    if (!relativePath) continue;

    const current = currentByRelativePath.get(relativePath);
    if (!current) continue;

    if (previous.id && current.id && previous.id !== current.id) {
      aliases.constellations.byId[String(previous.id)] = String(current.id);
    }

    if (
      previous.handle &&
      current.handle &&
      String(previous.handle).toLowerCase() !== String(current.handle).toLowerCase()
    ) {
      aliases.constellations.byHandle[String(previous.handle).toLowerCase()] =
        String(current.handle);
    }
  }

  return aliases;
}

function buildServerLibraryIndex(library = {}, collections = {}, aliases = {}) {
  return {
    generatedAt: library.generatedAt,
    counts: {
      councils: collections.councils?.length || 0,
      lenses: library.counts?.lenses || 0,
      constellations: library.counts?.constellations || 0,
      skills: library.counts?.skills || 0,
      constitution: library.counts?.constitution || 0,
    },
    collections: buildCollectionIndex(collections),
    aliases,
    lookup: {
      lenses: (library.lenses || []).map((lens) => ({
        id: lens.id,
        handle: lens.handle,
        title: lens.title,
        displayTitle: lens.displayTitle,
        board: lens.board || null,
        collectionId: lens.collectionId || null,
        collectionKind: lens.collectionKind || null,
        collectionLabel: lens.collectionLabel || null,
        councilId: lens.councilId || null,
        councilName: lens.councilName || null,
        detailPath: `lenses/${lens.id}.json`,
      })),
      constellations: (library.constellations || []).map((constellation) => ({
        id: constellation.id,
        handle: constellation.handle,
        title: constellation.title,
        displayTitle: constellation.displayTitle || constellation.title,
        type: constellation.type || null,
        purpose: constellation.purpose || null,
        projectManagerHandle: constellation.projectManagerHandle || null,
        detailPath: `constellations/${constellation.id}.json`,
      })),
    },
  };
}

function buildFrontendLibraryIndex(library = {}, collections = {}) {
  return {
    generatedAt: library.generatedAt,
    counts: {
      councils: collections.councils?.length || 0,
      lenses: library.counts?.lenses || 0,
      constellations: library.counts?.constellations || 0,
      skills: library.counts?.skills || 0,
      constitution: library.counts?.constitution || 0,
    },
    collections: buildCollectionIndex(collections),
  };
}

function buildLibrarySummary(library = {}, councilCount = 0) {
  const featuredTitles = [
    "The Clarity Shepherd",
    "The Direct Response Master",
    "The First-Principles Engineer",
    "The Ethical Boundary",
    "The Divine Anchor",
    "The Forgiven Sinner",
  ];

  const featuredLenses = featuredTitles
    .map((title) =>
      (library.lenses || []).find(
        (lens) =>
          String(lens.displayTitle || lens.title).toLowerCase() ===
          title.toLowerCase()
      )
    )
    .filter(Boolean)
    .map(summarizeLensForUi);

  return {
    generatedAt: library.generatedAt,
    counts: {
      ...(library.counts || {}),
      councils: councilCount,
    },
    councilCount,
    featuredLenses,
  };
}

function buildPclBundle(library = {}) {
  const allLenses = (library.lenses || [])
    .slice()
    .sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0))
    .map((lens) => {
      const base = {
        id: lens.id,
        handle: lens.handle,
        title: lens.title,
        archetypeName: lens.archetypeName || lens.displayTitle || lens.title,
        relativePath: lens.relativePath,
        backendId: lens.backendId,
        collectionKind: lens.collectionKind,
        collectionId: lens.collectionId,
        collectionLabel: lens.collectionLabel,
        board: lens.board,
        boardSlug: lens.boardSlug,
        sourceFormat: lens.sourceFormat,
        sortOrder: lens.sortOrder,
        overview: lens.overview || "",
        detailPath: `library-items/lenses/${lens.id}.json`,
      };

      if (lens.collectionKind === "council") {
        return {
          ...base,
          councilId: lens.councilId,
          councilLabel: lens.councilLabel,
          councilName: lens.councilName,
          councilNumber: lens.councilNumber,
          lensNumber: lens.lensNumber,
          lensCountInCouncil: lens.lensCountInCouncil,
        };
      }

      return {
        ...base,
        detailKind: "board-lens",
      };
    });

  const groupedBoards = new Map();
  const groupedCouncils = new Map();

  for (const lens of allLenses) {
    if (lens.collectionKind === "council") {
      const council = groupedCouncils.get(lens.councilId) || {
        id: lens.councilId,
        label: lens.councilLabel,
        name: lens.councilName,
        lensCount: 0,
        lenses: [],
      };
      council.lensCount += 1;
      council.lenses.push(lens);
      groupedCouncils.set(lens.councilId, council);
      continue;
    }

    const board = groupedBoards.get(lens.collectionId) || {
      id: lens.collectionId,
      label: lens.collectionLabel || lens.board || lens.collectionId,
      name: lens.collectionLabel || lens.board || lens.collectionId,
      lensCount: 0,
      lenses: [],
    };
    board.lensCount += 1;
    board.lenses.push(lens);
    groupedBoards.set(lens.collectionId, board);
  }

  return {
    generatedAt: library.generatedAt,
    counts: {
      councils: groupedCouncils.size,
      boards: groupedBoards.size,
      lenses: allLenses.length,
    },
    boards: Array.from(groupedBoards.values()).sort((left, right) =>
      String(left.label).localeCompare(String(right.label))
    ),
    councils: Array.from(groupedCouncils.values()).sort(
      (left, right) =>
        Number(left.lenses[0]?.councilNumber || 999) -
        Number(right.lenses[0]?.councilNumber || 999)
    ),
    lenses: allLenses,
  };
}

function assertUnique(items = [], label = "items") {
  const seenIds = new Set();
  const seenHandles = new Set();

  for (const item of items) {
    if (seenIds.has(item.id)) {
      throw new Error(`Duplicate ${label} id detected: ${item.id}`);
    }
    seenIds.add(item.id);

    if (!item.handle) continue;
    if (seenHandles.has(item.handle)) {
      throw new Error(`Duplicate ${label} handle detected: ${item.handle}`);
    }
    seenHandles.add(item.handle);
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function writeLibraryItems(itemsRoot, library = {}, councils = []) {
  await fs.rm(itemsRoot, { recursive: true, force: true });

  const groups = {
    councils,
    lenses: library.lenses || [],
    constellations: library.constellations || [],
    skills: library.skills || [],
    constitution: library.constitution || [],
  };

  for (const [groupName, items] of Object.entries(groups)) {
    const groupDir = path.join(itemsRoot, groupName);
    await fs.mkdir(groupDir, { recursive: true });

    for (const item of items) {
      const normalizedItem =
        groupName === "constellations"
          ? {
              ...item,
              detailPath: `constellations/${item.id}.json`,
            }
          : item;
      await writeJson(path.join(groupDir, `${item.id}.json`), normalizedItem);
    }
  }
}

async function writeLibraryCollections(collectionsRoot, collections = {}) {
  await fs.rm(collectionsRoot, { recursive: true, force: true });
  await fs.mkdir(collectionsRoot, { recursive: true });

  for (const [tab, items] of Object.entries(collections)) {
    await writeJson(path.join(collectionsRoot, `${tab}.json`), { items });
  }
}

async function loadLibrarySources() {
  const [
    serverLensCollection,
    serverConstellationCollection,
    serverSkillCollection,
    serverConstitutionCollection,
    mobileLensCollection,
    mobileConstellationCollection,
    mobileSkillCollection,
    mobileConstitutionCollection,
  ] = await Promise.all([
    loadCollection(SERVER_ROOT, "lenses"),
    loadCollection(SERVER_ROOT, "constellations"),
    loadCollection(SERVER_ROOT, "skills"),
    loadCollection(SERVER_ROOT, "constitution"),
    loadCollection(MOBILE_ROOT, "lenses"),
    loadCollection(MOBILE_ROOT, "constellations"),
    loadCollection(MOBILE_ROOT, "skills"),
    loadCollection(MOBILE_ROOT, "constitution"),
  ]);

  return {
    serverLensCollection,
    serverConstellationCollection,
    serverSkillCollection,
    serverConstitutionCollection,
    mobileLensCollection,
    mobileConstellationCollection,
    mobileSkillCollection,
    mobileConstitutionCollection,
  };
}

async function loadDetailWithFallback(tab, id) {
  return (
    (await readJsonCandidate(itemPath(SERVER_ROOT, tab, id))) ||
    (await readJsonCandidate(itemPath(MOBILE_ROOT, tab, id))) ||
    null
  );
}

async function buildCanonicalLibrary() {
  const sources = await loadLibrarySources();
  const mobileLensById = byId(sources.mobileLensCollection);
  const mobileConstellationById = byId(sources.mobileConstellationCollection);
  const mobileSkillById = byId(sources.mobileSkillCollection);
  const mobileConstitutionById = byId(sources.mobileConstitutionCollection);

  const lenses = [];

  for (const summary of sources.serverLensCollection) {
    const mobileSummary = mobileLensById.get(summary.id) || {};
    const detail = await loadDetailWithFallback("lenses", summary.id);
    const merged = { ...mobileSummary, ...summary, ...(detail || {}) };
    const displayTitle = resolveLensDisplayTitle(merged);
    const collectionKind = merged.collectionKind || "board";
    const councilNumber = parseCouncilNumber(merged);
    const lensNumber = parseLensNumber(merged);
    const councilName =
      collectionKind === "council" ? resolveCouncilName(merged) : null;
    const councilLabel =
      collectionKind === "council" ? resolveCouncilLabel(merged) : null;

    const id =
      collectionKind === "council"
        ? buildCanonicalCouncilLensId(councilName, displayTitle)
        : buildCanonicalBoardLensId(
            nonEmpty(merged.boardSlug, merged.collectionId, merged.board),
            displayTitle
          );
    const handle = buildLensHandle(id);
    const councilId =
      collectionKind === "council" ? buildCanonicalCouncilId(councilName) : null;
    const legacyId =
      collectionKind === "council"
        ? computeLegacyCouncilLensId(merged)
        : computeLegacyBoardLensId(merged);

    lenses.push({
      ...merged,
      id,
      title: displayTitle,
      displayTitle,
      archetypeName: displayTitle,
      handle,
      board:
        collectionKind === "council"
          ? councilLabel
          : nonEmpty(merged.board, merged.collectionLabel, "Library"),
      boardSlug:
        collectionKind === "council"
          ? councilId
          : nonEmpty(merged.boardSlug, merged.collectionId, "library"),
      collectionId:
        collectionKind === "council"
          ? councilId
          : nonEmpty(merged.collectionId, merged.boardSlug, "library"),
      collectionLabel:
        collectionKind === "council"
          ? councilLabel
          : nonEmpty(merged.collectionLabel, merged.board, "Library"),
      displayBoard:
        collectionKind === "council"
          ? councilLabel
          : nonEmpty(merged.displayBoard, merged.collectionLabel, merged.board),
      councilId,
      councilLabel,
      councilName,
      councilNumber,
      lensNumber,
      legacyId,
      legacyHandle: buildLensHandle(legacyId),
      legacyCouncilId:
        collectionKind === "council" && councilNumber
          ? `Council_${pad2(councilNumber)}`
          : null,
      legacyCollectionId:
        collectionKind === "council" && councilNumber
          ? `council-${pad2(councilNumber)}`
          : nonEmpty(merged.collectionId, merged.boardSlug, null),
      sortOrder:
        merged.sortOrder ||
        (councilNumber && lensNumber ? councilNumber * 100 + lensNumber : null),
    });
  }

  assertUnique(lenses, "lens");

  const legacyLensIdMap = new Map(lenses.map((lens) => [lens.legacyId, lens]));
  const legacyLensHandleMap = new Map(
    lenses.map((lens) => [String(lens.legacyHandle || "").toLowerCase(), lens])
  );

  const constellations = [];
  for (const summary of sources.serverConstellationCollection) {
    const mobileSummary = mobileConstellationById.get(summary.id) || {};
    const detail = await loadDetailWithFallback("constellations", summary.id);
    const merged = { ...mobileSummary, ...summary, ...(detail || {}) };
    const title = resolveConstellationTitle(merged);
    const id = buildCanonicalConstellationId(title);
    const handle = buildConstellationHandle(id);
    const legacyId = computeLegacyConstellationId(merged);
    const projectManagerLens =
      legacyLensIdMap.get(merged.projectManagerId) ||
      legacyLensHandleMap.get(String(merged.projectManagerHandle || "").toLowerCase()) ||
      null;

    const members = (merged.members || []).map((member) => {
      const matchedLens =
        legacyLensIdMap.get(member.lensId) ||
        legacyLensHandleMap.get(String(member.lensHandle || "").toLowerCase()) ||
        null;

      return {
        ...member,
        lensId: matchedLens?.id || member.lensId || null,
        lensHandle: matchedLens?.handle || member.lensHandle || null,
        lensTitle:
          matchedLens?.displayTitle ||
          matchedLens?.title ||
          member.lensTitle ||
          null,
      };
    });

    constellations.push({
      ...merged,
      id,
      title,
      displayTitle: title,
      handle,
      detailPath: `constellations/${id}.json`,
      projectManagerId: projectManagerLens?.id || merged.projectManagerId || null,
      projectManagerHandle:
        projectManagerLens?.handle || merged.projectManagerHandle || null,
      projectManagerTitle:
        projectManagerLens?.displayTitle ||
        projectManagerLens?.title ||
        merged.projectManagerTitle ||
        null,
      members,
      legacyId,
      legacyHandle: buildConstellationHandle(legacyId),
    });
  }

  assertUnique(constellations, "constellation");

  const skills = [];
  for (const summary of sources.serverSkillCollection) {
    const mobileSummary = mobileSkillById.get(summary.id) || {};
    const detail = await loadDetailWithFallback("skills", summary.id);
    skills.push({ ...mobileSummary, ...summary, ...(detail || {}) });
  }

  const constitution = [];
  for (const summary of sources.serverConstitutionCollection) {
    const mobileSummary = mobileConstitutionById.get(summary.id) || {};
    const detail = await loadDetailWithFallback("constitution", summary.id);
    constitution.push({ ...mobileSummary, ...summary, ...(detail || {}) });
  }

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      lenses: lenses.length,
      constellations: constellations.length,
      skills: skills.length,
      constitution: constitution.length,
    },
    lenses: lenses.sort((left, right) => {
      const leftSort = Number(left.sortOrder || 0);
      const rightSort = Number(right.sortOrder || 0);
      if (leftSort && rightSort && leftSort !== rightSort) return leftSort - rightSort;
      return sortByDisplayTitle(left, right);
    }),
    constellations: constellations.sort((left, right) =>
      String(left.displayTitle || left.title).localeCompare(
        String(right.displayTitle || right.title)
      )
    ),
    skills: skills.sort((left, right) =>
      String(left.name || left.id).localeCompare(String(right.name || right.id))
    ),
    constitution: constitution.sort((left, right) =>
      String(left.name || left.id).localeCompare(String(right.name || right.id))
    ),
  };
}

async function writeOutputs() {
  const library = await buildCanonicalLibrary();
  const councils = buildCouncilDetails(library.lenses);
  const collections = {
    councils: buildCouncilManifest(library.lenses),
    lenses: library.lenses.map(summarizeLensForUi),
    constellations: library.constellations.map(summarizeConstellationForUi),
    skills: library.skills.map(summarizeSkillForUi),
    constitution: library.constitution.map(summarizeGovernanceDocumentForUi),
  };
  const aliases = mergeAliasMaps(
    buildAliases(library.lenses, library.constellations, collections.councils),
    buildLegacyConstellationAliases(library.constellations)
  );
  const serverIndex = buildServerLibraryIndex(library, collections, aliases);
  const frontendIndex = buildFrontendLibraryIndex(library, collections);
  const summary = buildLibrarySummary(library, collections.councils.length);
  const pclBundle = buildPclBundle(library);

  await writeJson(path.join(SERVER_ROOT, "library.generated.json"), serverIndex);
  await writeJson(path.join(SERVER_ROOT, "summary.generated.json"), summary);
  await writeJson(path.join(SERVER_ROOT, "pcls.generated.json"), pclBundle);
  await writeJson(path.join(SERVER_ROOT, "library.aliases.generated.json"), aliases);
  await writeLibraryCollections(path.join(SERVER_ROOT, "library-collections"), collections);
  await writeLibraryItems(path.join(SERVER_ROOT, "library-items"), library, councils);

  await fs.mkdir(FRONTEND_ROOT, { recursive: true });
  await fs.writeFile(
    path.join(FRONTEND_ROOT, "library.generated.js"),
    `export const metacanonLibrary = ${JSON.stringify(
      frontendIndex,
      null,
      2
    )};\n\nexport default metacanonLibrary;\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(FRONTEND_ROOT, "summary.generated.js"),
    `export const metacanonLibrarySummary = ${JSON.stringify(
      summary,
      null,
      2
    )};\n\nexport default metacanonLibrarySummary;\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(FRONTEND_ROOT, "aliases.generated.js"),
    `export const metacanonLibraryAliases = ${JSON.stringify(
      {
        generatedAt: library.generatedAt,
        lenses: {
          id: aliases.lenses.byId,
          handle: aliases.lenses.byHandle,
        },
        constellations: {
          id: aliases.constellations.byId,
          handle: aliases.constellations.byHandle,
        },
        councils: {
          id: aliases.councils.byId,
        },
      },
      null,
      2
    )};\n\nexport default metacanonLibraryAliases;\n`,
    "utf8"
  );

  await fs.rm(MOBILE_ROOT, { recursive: true, force: true });
  await fs.mkdir(MOBILE_ROOT, { recursive: true });
  await fs.cp(path.join(SERVER_ROOT, "library-collections"), path.join(MOBILE_ROOT, "library-collections"), {
    recursive: true,
  });
  await fs.cp(path.join(SERVER_ROOT, "library-items"), path.join(MOBILE_ROOT, "library-items"), {
    recursive: true,
  });
  await fs.copyFile(
    path.join(SERVER_ROOT, "library.generated.json"),
    path.join(MOBILE_ROOT, "library.generated.json")
  );

  console.log(
    JSON.stringify(
      {
        lenses: library.counts.lenses,
        constellations: library.counts.constellations,
        councils: collections.councils.length,
        lensAliases: Object.keys(aliases.lenses.byId).length,
        constellationAliases: Object.keys(aliases.constellations.byId).length,
        councilAliases: Object.keys(aliases.councils.byId).length,
      },
      null,
      2
    )
  );
}

await writeOutputs();
