const { reqBody } = require("../utils/http");
const { validatedRequest } = require("../utils/middleware/validatedRequest");
const fs = require("fs");
const path = require("path");
const {
  flexUserRoleValid,
  ROLES,
} = require("../utils/middleware/multiUserProtected");
const {
  getRepoInfo,
  listDirectory,
  buildFileIndex,
  readFile,
  writeFile,
  normalizeRelativePath,
} = require("../utils/metacanonRepo");
const {
  getLibraryManifest,
  getLibraryItem,
  getLibraryCollection,
} = require("../utils/agents/metacanon/store");

const PROTECTED_ROUTE = [
  validatedRequest,
  flexUserRoleValid([ROLES.admin, ROLES.manager]),
];

function repoLabEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.METACANON_REPO_LAB === "enabled"
  );
}

function ensureRepoLabEnabled(response) {
  if (repoLabEnabled()) return true;
  response.status(404).json({
    error: "Repo Lab is only available in local development.",
  });
  return false;
}

const REPO_ROOT = path.resolve(__dirname, "../..");
const GOVERNANCE_ROOT = path.resolve(
  REPO_ROOT,
  "data/metacanon/governance-documents"
);

function resolveGovernanceFile(relativePath = "") {
  const normalized = normalizeRelativePath(relativePath);
  const absolutePath = path.resolve(REPO_ROOT, normalized);
  const governanceWithSep = `${GOVERNANCE_ROOT}${path.sep}`;

  if (
    absolutePath !== GOVERNANCE_ROOT &&
    !absolutePath.startsWith(governanceWithSep)
  ) {
    throw new Error("Invalid governance document path.");
  }

  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    throw new Error("Governance document not found.");
  }

  return { normalized, absolutePath };
}

function metacanonAIEndpoints(app) {
  if (!app) return;

  app.get("/metacanonai/governance/file", async (request, response) => {
    try {
      const { absolutePath } = resolveGovernanceFile(request.query.path || "");
      response.sendFile(absolutePath);
    } catch (error) {
      response.status(400).json({ error: error.message });
    }
  });

  app.get("/metacanonai/library/manifest", async (_, response) => {
    try {
      response.status(200).json(getLibraryManifest());
    } catch (error) {
      console.error(error);
      response.status(500).json({ error: error.message });
    }
  });

  app.get("/metacanonai/library/collection", async (request, response) => {
    try {
      const tab = String(request.query.tab || "").trim();
      if (!tab) {
        response.status(400).json({ error: "Missing tab parameter." });
        return;
      }
      response.status(200).json({ items: getLibraryCollection(tab) });
    } catch (error) {
      response.status(400).json({ error: error.message });
    }
  });

  app.get("/metacanonai/library/item", async (request, response) => {
    try {
      const tab = String(request.query.tab || "").trim();
      const id = String(request.query.id || "").trim();
      if (!tab || !id) {
        response.status(400).json({ error: "Missing tab or id parameter." });
        return;
      }

      const item = getLibraryItem(tab, id);
      if (!item) {
        response.status(404).json({ error: "Library item not found." });
        return;
      }

      response.status(200).json(item);
    } catch (error) {
      response.status(400).json({ error: error.message });
    }
  });

  app.get("/metacanonai/repo/info", PROTECTED_ROUTE, async (_, response) => {
    try {
      if (!ensureRepoLabEnabled(response)) return;
      response.status(200).json(await getRepoInfo());
    } catch (error) {
      console.error(error);
      response.status(500).json({ error: error.message });
    }
  });

  app.get(
    "/metacanonai/repo/children",
    PROTECTED_ROUTE,
    async (request, response) => {
      try {
        if (!ensureRepoLabEnabled(response)) return;
        const relativePath = normalizeRelativePath(request.query.path || "");
        const directory = await listDirectory(relativePath);
        response.status(200).json(directory);
      } catch (error) {
        response.status(400).json({ error: error.message });
      }
    }
  );

  app.get("/metacanonai/repo/index", PROTECTED_ROUTE, async (_, response) => {
    try {
      if (!ensureRepoLabEnabled(response)) return;
      const files = await buildFileIndex();
      response.status(200).json({ files });
    } catch (error) {
      console.error(error);
      response.status(500).json({ error: error.message });
    }
  });

  app.get("/metacanonai/repo/file", PROTECTED_ROUTE, async (request, response) => {
    try {
      if (!ensureRepoLabEnabled(response)) return;
      const relativePath = normalizeRelativePath(request.query.path || "");
      const file = await readFile(relativePath);
      response.status(200).json(file);
    } catch (error) {
      response.status(400).json({ error: error.message });
    }
  });

  app.post(
    "/metacanonai/repo/file",
    PROTECTED_ROUTE,
    async (request, response) => {
      try {
        if (!ensureRepoLabEnabled(response)) return;
        const { path: relativePath = "", content = "" } = reqBody(request);
        const file = await writeFile(relativePath, content);
        response.status(200).json({ success: true, file });
      } catch (error) {
        response.status(400).json({ success: false, error: error.message });
      }
    }
  );
}

module.exports = {
  metacanonAIEndpoints,
};
