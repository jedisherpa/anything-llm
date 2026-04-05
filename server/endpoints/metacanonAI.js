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
  clearMetacanonStoreCaches,
} = require("../utils/agents/metacanon/store");
const { saveCustomLens } = require("../utils/agents/metacanon/customLenses");
const {
  buildFormatLensMessageList,
} = require("../utils/agents/metacanon/formatLensPrompt");
const { getLLMProvider } = require("../utils/helpers");

const PROTECTED_ROUTE = [
  validatedRequest,
  flexUserRoleValid([ROLES.admin, ROLES.manager]),
];

const READ_ROUTE = [validatedRequest];
const REPO_WRITE_ROUTE = [validatedRequest, flexUserRoleValid([ROLES.admin])];

const GOVERNANCE_ALLOWED_EXTENSIONS = new Set([
  ".json",
  ".md",
  ".pdf",
  ".txt",
  ".docx",
]);

function hasRepoDevelopmentMarker() {
  return fs.existsSync(path.join(REPO_ROOT, ".git"));
}

function isLocalRepoLabDevelopment() {
  const normalized = String(process.env.NODE_ENV || "")
    .trim()
    .toLowerCase();
  return (
    normalized === "development" ||
    (normalized === "" && hasRepoDevelopmentMarker())
  );
}

function repoLabReadEnabled() {
  return (
    isLocalRepoLabDevelopment() || process.env.METACANON_REPO_LAB === "enabled"
  );
}

function repoLabWriteEnabled() {
  return (
    repoLabReadEnabled() &&
    (isLocalRepoLabDevelopment() ||
      process.env.METACANON_REPO_LAB_WRITE === "enabled")
  );
}

function hasGovernanceDocumentFiles(directory) {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    return false;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory() && hasGovernanceDocumentFiles(entryPath)) {
      return true;
    }

    if (
      entry.isFile() &&
      GOVERNANCE_ALLOWED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    ) {
      return true;
    }
  }

  return false;
}

function ensureRepoLabReadEnabled(response) {
  if (repoLabReadEnabled()) return true;
  response.status(404).json({
    error:
      "Repo Lab read surfaces are only available in local development or when explicitly enabled.",
  });
  return false;
}

function ensureRepoLabWriteEnabled(response) {
  if (repoLabWriteEnabled()) return true;
  response.status(404).json({
    error:
      "Repo Lab write surfaces are disabled outside local development unless explicitly enabled.",
  });
  return false;
}

const REPO_ROOT = path.resolve(__dirname, "../..");
const GOVERNANCE_ROOT = path.resolve(
  REPO_ROOT,
  "data/metacanon/governance-documents"
);

function governanceDocumentsAvailable() {
  return hasGovernanceDocumentFiles(GOVERNANCE_ROOT);
}

function resolveGovernanceRequest(relativePath = "") {
  const normalized = normalizeRelativePath(relativePath);
  const absolutePath = path.resolve(REPO_ROOT, normalized);
  const governanceWithSep = `${GOVERNANCE_ROOT}${path.sep}`;

  if (
    absolutePath !== GOVERNANCE_ROOT &&
    !absolutePath.startsWith(governanceWithSep)
  ) {
    throw new Error("Invalid governance document path.");
  }

  if (
    !GOVERNANCE_ALLOWED_EXTENSIONS.has(path.extname(absolutePath).toLowerCase())
  ) {
    throw new Error("Governance document type is not allowed.");
  }

  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    throw new Error("Governance document not found.");
  }

  return { normalized, absolutePath };
}

function metacanonAIEndpoints(app) {
  if (!app) return;

  app.get("/metacanonai/features", READ_ROUTE, async (_, response) => {
    response.status(200).json({
      repoLabReadEnabled: repoLabReadEnabled(),
      repoLabWriteEnabled: repoLabWriteEnabled(),
      governanceDocumentsAvailable: governanceDocumentsAvailable(),
      governanceDocumentExtensions: Array.from(GOVERNANCE_ALLOWED_EXTENSIONS),
    });
  });

  app.get(
    "/metacanonai/governance/file",
    READ_ROUTE,
    async (request, response) => {
      try {
        const { absolutePath } = resolveGovernanceRequest(
          request.query.path || ""
        );
        response.sendFile(absolutePath);
      } catch (error) {
        response.status(400).json({ error: error.message });
      }
    }
  );

  app.get("/metacanonai/library/manifest", READ_ROUTE, async (_, response) => {
    try {
      response.status(200).json(getLibraryManifest());
    } catch (error) {
      console.error(error);
      response.status(500).json({ error: error.message });
    }
  });

  app.get(
    "/metacanonai/library/collection",
    READ_ROUTE,
    async (request, response) => {
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
    }
  );

  app.get(
    "/metacanonai/library/item",
    READ_ROUTE,
    async (request, response) => {
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
    }
  );

  app.post(
    "/metacanonai/library/custom-lens",
    REPO_WRITE_ROUTE,
    async (request, response) => {
      try {
        const {
          sourceId = "",
          id = "",
          title = "",
          handle = "",
          content = "",
          preferredBackends = [],
          fallbackBackends = [],
        } = reqBody(request);

        const baseLens =
          getLibraryItem("lenses", String(sourceId || id || "").trim()) || null;

        const item = saveCustomLens(
          {
            id: String(id || sourceId || baseLens?.id || "").trim(),
            sourceId: String(sourceId || baseLens?.id || "").trim() || null,
            title,
            handle,
            content,
            boardSlug: baseLens?.boardSlug,
            board: baseLens?.board,
            collectionKind: baseLens?.collectionKind,
            collectionLabel: baseLens?.collectionLabel,
            councilId: baseLens?.councilId,
            councilName: baseLens?.councilName,
            phase: baseLens?.phase,
            preferredBackends,
            fallbackBackends,
            createdAt: baseLens?.createdAt,
          },
          baseLens
        );

        clearMetacanonStoreCaches();
        response.status(200).json({ success: true, item });
      } catch (error) {
        response.status(400).json({ success: false, error: error.message });
      }
    }
  );

  app.post(
    "/metacanonai/library/format-lens",
    REPO_WRITE_ROUTE,
    async (request, response) => {
      try {
        const { rawContent = "", title = "" } = reqBody(request);

        if (!String(rawContent || "").trim()) {
          response
            .status(400)
            .json({ success: false, error: "rawContent is required." });
          return;
        }

        // Truncate very large inputs to avoid overwhelming the LLM context window.
        const safeContent = String(rawContent).slice(0, 30000);

        let LLMConnector;
        try {
          LLMConnector = getLLMProvider();
        } catch (providerError) {
          response.status(503).json({
            success: false,
            error:
              "No LLM provider is configured on this server. Configure a provider in system settings before using Auto-Format.",
          });
          return;
        }

        const messages = buildFormatLensMessageList(safeContent, title);

        const { textResponse } = await LLMConnector.getChatCompletion(
          messages,
          { temperature: 0.4 }
        );

        if (!textResponse) {
          response.status(500).json({
            success: false,
            error: "LLM returned an empty response. Please try again.",
          });
          return;
        }

        response.status(200).json({ success: true, formatted: textResponse });
      } catch (error) {
        console.error("[format-lens] Error:", error.message);
        response.status(500).json({ success: false, error: error.message });
      }
    }
  );

  app.get("/metacanonai/repo/info", PROTECTED_ROUTE, async (_, response) => {
    try {
      if (!ensureRepoLabReadEnabled(response)) return;
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
        if (!ensureRepoLabReadEnabled(response)) return;
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
      if (!ensureRepoLabReadEnabled(response)) return;
      const files = await buildFileIndex();
      response.status(200).json({ files });
    } catch (error) {
      console.error(error);
      response.status(500).json({ error: error.message });
    }
  });

  app.get(
    "/metacanonai/repo/file",
    PROTECTED_ROUTE,
    async (request, response) => {
      try {
        if (!ensureRepoLabReadEnabled(response)) return;
        const relativePath = normalizeRelativePath(request.query.path || "");
        const file = await readFile(relativePath);
        response.status(200).json(file);
      } catch (error) {
        response.status(400).json({ error: error.message });
      }
    }
  );

  app.post(
    "/metacanonai/repo/file",
    REPO_WRITE_ROUTE,
    async (request, response) => {
      try {
        if (!ensureRepoLabWriteEnabled(response)) return;
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
  _internals: {
    governanceDocumentsAvailable,
    hasGovernanceDocumentFiles,
    hasRepoDevelopmentMarker,
    isLocalRepoLabDevelopment,
    repoLabReadEnabled,
    repoLabWriteEnabled,
    resolveGovernanceRequest,
  },
};
