import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConstellationHandle, buildLensHandle, slugify } from "./metacanonCanonicalNames.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const METACANON_ROOT = path.join(REPO_ROOT, "server/utils/agents/metacanon");

const pad2 = (value = 0) => String(value).padStart(2, "0");

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function legacyCouncilIdFromSortOrder(sortOrder = 0) {
  const councilNumber = Math.floor(Number(sortOrder || 0));
  if (!councilNumber) return null;
  return `Council_${pad2(councilNumber)}`;
}

function legacyCouncilCollectionIdFromSortOrder(sortOrder = 0) {
  const councilNumber = Math.floor(Number(sortOrder || 0));
  if (!councilNumber) return null;
  return `council-${pad2(councilNumber)}`;
}

async function main() {
  const lensCollection = (
    await readJson(path.join(METACANON_ROOT, "library-collections/lenses.json"))
  ).items;
  const lensDetails = await Promise.all(
    lensCollection.map((lens) =>
      readJson(path.join(METACANON_ROOT, "library-items", lens.detailPath))
    )
  );
  const constellationCollection = (
    await readJson(path.join(METACANON_ROOT, "library-collections/constellations.json"))
  ).items;
  const constellationDetails = await Promise.all(
    constellationCollection.map((constellation) =>
      readJson(path.join(METACANON_ROOT, "library-items", constellation.detailPath))
    )
  );
  const councilCollection = (
    await readJson(path.join(METACANON_ROOT, "library-collections/councils.json"))
  ).items;

  const aliases = {
    generatedAt: new Date().toISOString(),
    lenses: {
      byId: {},
      byHandle: {},
    },
    constellations: {
      byId: {},
      byHandle: {},
    },
    councils: {
      byId: {},
    },
  };

  lensDetails.forEach((lens) => {
    if (lens.collectionKind === "board") {
      const legacyBaseName = String(lens.relativePath || "")
        .split(/[\\/]/)
        .pop()
        ?.replace(/\.md$/i, "");
      if (legacyBaseName) {
        const legacyId = slugify(`${lens.collectionId}-${legacyBaseName}`);
        const legacyHandle = buildLensHandle(legacyId).toLowerCase();
        aliases.lenses.byId[legacyId] = lens.id;
        aliases.lenses.byHandle[legacyHandle] = lens.handle;
      }
      return;
    }

    const legacyId = slugify(lens.backendId || "");
    const legacyHandle = buildLensHandle(legacyId).toLowerCase();
    const legacyCouncilId = legacyCouncilIdFromSortOrder(
      Math.floor(Number(lens.sortOrder || 0) / 100)
    );
    const legacyCouncilCollectionId = legacyCouncilCollectionIdFromSortOrder(
      Math.floor(Number(lens.sortOrder || 0) / 100)
    );

    if (legacyId) {
      aliases.lenses.byId[legacyId] = lens.id;
      aliases.lenses.byHandle[legacyHandle] = lens.handle;
    }
    if (legacyCouncilId) aliases.councils.byId[legacyCouncilId] = lens.councilId;
    if (legacyCouncilCollectionId) {
      aliases.councils.byId[legacyCouncilCollectionId] = lens.councilId;
    }
  });

  constellationDetails.forEach((constellation) => {
    const legacyId = slugify(constellation.name || "");
    const legacyHandle = buildConstellationHandle(legacyId).toLowerCase();
    if (legacyId) {
      aliases.constellations.byId[legacyId] = constellation.id;
      aliases.constellations.byHandle[legacyHandle] = constellation.handle;
    }
  });

  councilCollection.forEach((council) => {
    const councilNumber = Number(council.sortOrder || 0);
    const legacyCouncilId = legacyCouncilIdFromSortOrder(councilNumber);
    const legacyCouncilCollectionId = legacyCouncilCollectionIdFromSortOrder(
      councilNumber
    );
    if (legacyCouncilId) aliases.councils.byId[legacyCouncilId] = council.id;
    if (legacyCouncilCollectionId) {
      aliases.councils.byId[legacyCouncilCollectionId] = council.id;
    }
  });

  await writeJson(
    path.join(METACANON_ROOT, "library.aliases.generated.json"),
    aliases
  );

  console.log(
    JSON.stringify(
      {
        lensAliases: Object.keys(aliases.lenses.byId).length,
        constellationAliases: Object.keys(aliases.constellations.byId).length,
        councilAliases: Object.keys(aliases.councils.byId).length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
