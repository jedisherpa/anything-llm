require("./utils/loadEnv").loadEnv();

require("./utils/logger")();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const { reqBody } = require("./utils/http");
const { systemEndpoints } = require("./endpoints/system");
const { workspaceEndpoints } = require("./endpoints/workspaces");
const { chatEndpoints } = require("./endpoints/chat");
const { embeddedEndpoints } = require("./endpoints/embed");
const { embedManagementEndpoints } = require("./endpoints/embedManagement");
const { getVectorDbClass } = require("./utils/helpers");
const { adminEndpoints } = require("./endpoints/admin");
const { inviteEndpoints } = require("./endpoints/invite");
const { utilEndpoints } = require("./endpoints/utils");
const { developerEndpoints } = require("./endpoints/api");
const { extensionEndpoints } = require("./endpoints/extensions");
const { bootHTTP, bootSSL } = require("./utils/boot");
const { workspaceThreadEndpoints } = require("./endpoints/workspaceThreads");
const { documentEndpoints } = require("./endpoints/document");
const { agentWebsocket } = require("./endpoints/agentWebsocket");
const { experimentalEndpoints } = require("./endpoints/experimental");
const { browserExtensionEndpoints } = require("./endpoints/browserExtension");
const { communityHubEndpoints } = require("./endpoints/communityHub");
const { agentFlowEndpoints } = require("./endpoints/agentFlows");
const { mcpServersEndpoints } = require("./endpoints/mcpServers");
const { mobileEndpoints } = require("./endpoints/mobile");
const { webPushEndpoints } = require("./endpoints/webPush");
const { metacanonAIEndpoints } = require("./endpoints/metacanonAI");
const { piperTTSStaticEndpoint } = require("./utils/piper");
const { httpLogger } = require("./middleware/httpLogger");
const app = express();
const apiRouter = express.Router();
const FILE_LIMIT = "3GB";

// Only log HTTP requests in development mode and if the ENABLE_HTTP_LOGGER environment variable is set to true
if (
  process.env.NODE_ENV === "development" &&
  !!process.env.ENABLE_HTTP_LOGGER
) {
  app.use(
    httpLogger({
      enableTimestamps: !!process.env.ENABLE_HTTP_LOGGER_TIMESTAMPS,
    })
  );
}
app.use(cors({ origin: true }));
app.use(bodyParser.text({ limit: FILE_LIMIT }));
app.use(bodyParser.json({ limit: FILE_LIMIT }));
app.use(
  bodyParser.urlencoded({
    limit: FILE_LIMIT,
    extended: true,
  })
);

if (!!process.env.ENABLE_HTTPS) {
  bootSSL(app, process.env.SERVER_PORT || 3001);
} else {
  require("@mintplex-labs/express-ws").default(app); // load WebSockets in non-SSL mode.
}

app.use("/api", apiRouter);
systemEndpoints(apiRouter);
extensionEndpoints(apiRouter);
workspaceEndpoints(apiRouter);
workspaceThreadEndpoints(apiRouter);
chatEndpoints(apiRouter);
adminEndpoints(apiRouter);
inviteEndpoints(apiRouter);
embedManagementEndpoints(apiRouter);
utilEndpoints(apiRouter);
documentEndpoints(apiRouter);
agentWebsocket(apiRouter);
experimentalEndpoints(apiRouter);
developerEndpoints(app, apiRouter);
communityHubEndpoints(apiRouter);
agentFlowEndpoints(apiRouter);
mcpServersEndpoints(apiRouter);
mobileEndpoints(apiRouter);
webPushEndpoints(apiRouter);
metacanonAIEndpoints(apiRouter);
piperTTSStaticEndpoint(app);
// Externally facing embedder endpoints
embeddedEndpoints(apiRouter);

// Externally facing browser extension endpoints
browserExtensionEndpoints(apiRouter);

if (process.env.NODE_ENV !== "development") {
  const { MetaGenerator } = require("./utils/boot/MetaGenerator");
  const IndexPage = new MetaGenerator();

  app.use(
    express.static(path.resolve(__dirname, "public"), {
      extensions: ["js"],
      setHeaders: (res) => {
        // Disable I-framing of entire site UI
        res.removeHeader("X-Powered-By");
        res.setHeader("X-Frame-Options", "DENY");
      },
    })
  );

  app.get("/robots.txt", function (_, response) {
    response.type("text/plain");
    response.send("User-agent: *\nDisallow: /").end();
  });

  app.get("/manifest.json", async function (_, response) {
    IndexPage.generateManifest(response);
    return;
  });

  app.use("/", function (_, response) {
    IndexPage.generate(response);
    return;
  });
} else {
  // Debug route for development connections to vectorDBs
  apiRouter.post("/v/:command", async (request, response) => {
    try {
      const VectorDb = getVectorDbClass();
      const { command } = request.params;
      if (!Object.getOwnPropertyNames(VectorDb).includes(command)) {
        response.status(500).json({
          message: "invalid interface command",
          commands: Object.getOwnPropertyNames(VectorDb),
        });
        return;
      }

      try {
        const body = reqBody(request);
        const resBody = await VectorDb[command](body);
        response.status(200).json({ ...resBody });
      } catch (e) {
        // console.error(e)
        console.error(JSON.stringify(e));
        response.status(500).json({ error: e.message });
      }
      return;
    } catch (e) {
      console.error(e.message, e);
      response.sendStatus(500).end();
    }
  });
}

app.all("*", function (_, response) {
  response.sendStatus(404);
});

// In non-https mode we need to boot at the end since the server has not yet
// started and is `.listen`ing.
if (!process.env.ENABLE_HTTPS) bootHTTP(app, process.env.SERVER_PORT || 3001);

// Phase 0: MetaCanon startup sequence — runs concurrently with server boot.
// Order: governance check → auto-genesis → sphere coordinator → tools log.
(async () => {
  const { isRuntimeAvailable } = require("./utils/metacanon-runtime/bridge");
  const {
    verifyGovernanceDocuments,
  } = require("./utils/metacanon-runtime/governance-check");
  // Note: path is already required at module scope above — no shadowed re-require needed.
  const GOVERNANCE_DOCS_DIR = path.resolve(
    __dirname,
    "data/metacanon/governance-documents/Governance_Documents"
  );

  // [MetaCanon] — native addon status
  if (isRuntimeAvailable()) {
    console.log("[MetaCanon] Native addon loaded successfully.");
  } else {
    console.warn(
      "[MetaCanon] Native addon unavailable — MetaCanon features disabled. " +
        "Run 'npm run build:native' in ffi-node to enable."
    );
  }

  // [Governance] — verify documents before attempting genesis
  const govResult = verifyGovernanceDocuments(GOVERNANCE_DOCS_DIR);
  if (govResult.valid) {
    console.log(
      `[Governance] Verification passed: ${govResult.found}/${govResult.total} documents found and valid`
    );
  } else {
    console.warn(
      `[Governance] Verification failed: ${govResult.found}/${govResult.total} documents valid. ` +
        `Missing: [${govResult.missing.join(", ")}] Empty: [${govResult.empty.join(", ")}]`
    );
  }

  // [AutoGenesis] — only run if governance verified
  const { autoGenesis } = require("./utils/metacanon-runtime/auto-genesis");
  if (govResult.valid) {
    await autoGenesis().catch((err) =>
      console.error("[AutoGenesis]", err.message)
    );
  } else {
    console.warn(
      "[AutoGenesis] Skipped — governance verification did not pass."
    );
  }

  // [Sphere] — initialize coordinator singleton
  const {
    getSphereThreadCoordinator,
  } = require("./utils/metacanon-runtime/sphere-thread");
  const coordinator = getSphereThreadCoordinator();
  console.log(
    `[Sphere] Coordinator initialized. Runtime available: ${coordinator.isRuntimeAvailable()}`
  );

  // [Tools] — log registered MetaCanon tool count
  // Wrapped in try/catch so a loader failure still produces a visible warning
  // rather than silently swallowing the error.
  try {
    const {
      getMetaCanonToolNames,
    } = require("./utils/MCP/metacanon-tools-loader");
    const toolNames = getMetaCanonToolNames();
    console.log(`[Tools] Registered ${toolNames.length} MetaCanon tools`);
  } catch (err) {
    console.warn(`[Tools] Failed to load MetaCanon tool names: ${err.message}`);
  }
})().catch((err) =>
  console.error("[MetaCanon] Startup sequence error:", err.message)
);
