const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const { execFile } = require("child_process");
const { CollectorApi } = require("./collectorApi");
const { PGVector } = require("./vectorDbProviders/pgvector");
const { SystemSettings } = require("../models/systemSettings");
const { Workspace } = require("../models/workspace");
const { resolveRuntimeEnvPath } = require("./loadEnv");
const { getVectorDbClass, getEmbeddingEngineSelection } = require("./helpers");
const { getCustomModels } = require("./helpers/customModels");
const execFileAsync = promisify(execFile);

function readinessState(ok, detail) {
  return {
    status: ok ? "ready" : "attention",
    ok,
    detail,
  };
}

function inactiveState(detail) {
  return {
    status: "inactive",
    ok: null,
    detail,
  };
}

function errorState(detail) {
  return {
    status: "error",
    ok: false,
    detail,
  };
}

const EMBEDDING_DIMENSIONS = {
  openai: {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
    "text-embedding-ada-002": 1536,
  },
  native: {
    "Xenova/all-MiniLM-L6-v2": 384,
    "Xenova/nomic-embed-text-v1": 768,
    "MintplexLabs/multilingual-e5-small": 384,
  },
};

function getStorageProfile(storageDir = "") {
  if (!storageDir) return "default";
  const normalized = path.normalize(storageDir);
  const parentDir = path.dirname(normalized);
  return path.basename(parentDir) || path.basename(normalized) || "default";
}

async function getWorkspaceQueryReadiness(workspaceSlug = null) {
  if (!workspaceSlug) return inactiveState("No workspace selected.");

  const workspace = await Workspace.get({ slug: workspaceSlug });
  if (!workspace) return inactiveState("Workspace not found.");

  const VectorDb = getVectorDbClass();
  try {
    const hasNamespace = await VectorDb.hasNamespace(workspace.slug);
    const vectorCount = await VectorDb.namespaceCount(workspace.slug);
    const ready = hasNamespace && vectorCount > 0;
    return {
      ...readinessState(
        ready,
        ready
          ? `${workspace.name || workspace.slug} is indexed with ${vectorCount} vectors.`
          : `${workspace.name || workspace.slug} does not have an indexed namespace yet.`
      ),
      workspace: {
        slug: workspace.slug,
        name: workspace.name,
        chatMode: workspace.chatMode || "chat",
      },
      vectorCount,
    };
  } catch (error) {
    return {
      status: "error",
      ok: false,
      detail: error.message,
      workspace: {
        slug: workspace.slug,
        name: workspace.name,
        chatMode: workspace.chatMode || "chat",
      },
      vectorCount: 0,
    };
  }
}

async function getPgVectorReadiness() {
  if (!process.env.PGVECTOR_CONNECTION_STRING) {
    return {
      ...inactiveState("No pgvector connection string configured."),
      configured: false,
    };
  }

  const result = await PGVector.validateConnection({
    connectionString: process.env.PGVECTOR_CONNECTION_STRING,
    tableName: PGVector.tableName(),
  });

  return result.success
    ? {
        ...readinessState(
          true,
          `Connected to pgvector table ${PGVector.tableName()}.`
        ),
        configured: true,
      }
    : {
        ...errorState(result.error || "pgvector connection failed."),
        configured: true,
      };
}

async function getDockerDesktopReadiness() {
  const dockerAppInstalled = fs.existsSync("/Applications/Docker.app");

  try {
    const { stdout } = await execFileAsync(
      "docker",
      ["info", "--format", "{{json .ServerVersion}}"],
      { timeout: 8000 }
    );

    const version = String(stdout || "")
      .trim()
      .replace(/^"|"$/g, "");
    return {
      ...readinessState(
        true,
        version
          ? `Docker engine is reachable (Server ${version}).`
          : "Docker engine is reachable."
      ),
      installed: true,
      running: true,
      version: version || null,
    };
  } catch {
    if (dockerAppInstalled) {
      return {
        ...readinessState(
          false,
          "Docker Desktop is installed but the Docker engine is not reachable. Start Docker Desktop before continuing."
        ),
        installed: true,
        running: false,
        version: null,
      };
    }

    return {
      ...readinessState(
        false,
        "Docker Desktop is not installed on this Mac yet."
      ),
      installed: false,
      running: false,
      version: null,
    };
  }
}

async function getPostgresDesktopReadiness() {
  try {
    const [{ stdout: psqlStdout }, { stdout: configStdout }] =
      await Promise.all([
        execFileAsync("psql", ["--version"], { timeout: 5000 }),
        execFileAsync("pg_config", ["--version"], { timeout: 5000 }),
      ]);

    const psqlVersion = String(psqlStdout || "").trim();
    const pgConfigVersion = String(configStdout || "").trim();
    return {
      ...readinessState(
        true,
        [psqlVersion, pgConfigVersion].filter(Boolean).join(" • ") ||
          "PostgreSQL client tools are installed."
      ),
      installed: true,
      psqlVersion: psqlVersion || null,
      pgConfigVersion: pgConfigVersion || null,
    };
  } catch {
    return {
      ...readinessState(
        false,
        "PostgreSQL client tools are not installed or not on PATH yet."
      ),
      installed: false,
      psqlVersion: null,
      pgConfigVersion: null,
    };
  }
}

async function getDockerModelRunnerReadiness() {
  const basePath = process.env.DOCKER_MODEL_RUNNER_BASE_PATH;
  if (!basePath) return inactiveState("Docker Model Runner is not configured.");

  const { models, error } = await getCustomModels(
    "docker-model-runner",
    null,
    basePath
  );

  if (error) {
    return {
      ...errorState(error),
      models: 0,
    };
  }

  return {
    ...readinessState(
      models.length > 0,
      models.length > 0
        ? `${models.length} Docker Model Runner model${models.length === 1 ? "" : "s"} available.`
        : "Docker Model Runner is reachable but no local models are installed yet."
    ),
    models,
  };
}

async function getPrismDependencySequence({ workspaceSlug = null } = {}) {
  const dockerDesktop = await getDockerDesktopReadiness();
  const postgresDesktop = await getPostgresDesktopReadiness();
  const pgvector = await getPgVectorReadiness();
  const dockerModelRunner = await getDockerModelRunnerReadiness();
  const workspaceQuery = await getWorkspaceQueryReadiness(workspaceSlug);

  return {
    dockerDesktop,
    postgresDesktop,
    pgvector,
    dockerModelRunner,
    workspaceQuery,
    backendProfiles: getBackendProfiles({
      currentBackend: process.env.VECTOR_DB || "lancedb",
      pgvector,
    }),
  };
}

function getBackendProfiles({
  currentBackend = "lancedb",
  pgvector = inactiveState("No pgvector data."),
} = {}) {
  return [
    {
      id: "lancedb",
      label: "LanceDB",
      active: currentBackend === "lancedb",
      detail:
        "Profile-local vector store inside the Prism/AnythingLLM storage directory.",
    },
    {
      id: "pgvector",
      label: "pgvector",
      active: currentBackend === "pgvector",
      detail:
        pgvector?.detail ||
        "Shared PostgreSQL vector backend for durable multi-runtime retrieval.",
      status: pgvector?.status || "inactive",
      ok: pgvector?.ok ?? null,
      configured: !!pgvector?.configured,
    },
  ];
}

async function getPrismReadiness({ workspaceSlug = null } = {}) {
  const collector = new CollectorApi();
  const settings = await SystemSettings.currentSettings();
  const onboardingComplete = await SystemSettings.isOnboardingComplete();
  const vectorBackend = process.env.VECTOR_DB || "lancedb";
  const embedder = getEmbeddingEngineSelection();
  const runtimeEnvPath = resolveRuntimeEnvPath();
  const collectorOnline = await collector.online();
  const dependencies = await getPrismDependencySequence({ workspaceSlug });

  return {
    onboardingComplete,
    storageProfile: getStorageProfile(process.env.STORAGE_DIR),
    machine: {
      runtimeEnvPath: runtimeEnvPath || null,
      runtimeEnvPresent: !!runtimeEnvPath && fs.existsSync(runtimeEnvPath),
      storageDir: process.env.STORAGE_DIR || null,
    },
    services: {
      documentProcessor: readinessState(
        collectorOnline,
        collectorOnline
          ? "Document processor is online."
          : "Document processor is offline."
      ),
      runtimeConfig: readinessState(
        !!runtimeEnvPath && fs.existsSync(runtimeEnvPath),
        runtimeEnvPath
          ? `Runtime env path: ${runtimeEnvPath}`
          : "No runtime env file was resolved for this profile."
      ),
      dockerDesktop: dependencies.dockerDesktop,
      postgresDesktop: dependencies.postgresDesktop,
    },
    llm: {
      provider: settings.LLMProvider || "unset",
      model: settings.LLMModel || null,
      dockerModelRunner: dependencies.dockerModelRunner,
    },
    embeddings: {
      engine: settings.EmbeddingEngine || "native",
      model:
        embedder?.model ||
        settings.EmbeddingModelPref ||
        settings.EmbeddingEngine,
      hasExistingEmbeddings: !!settings.HasExistingEmbeddings,
      hasCachedEmbeddings: !!settings.HasCachedEmbeddings,
    },
    vector: {
      backend: vectorBackend,
      pgvector: dependencies.pgvector,
      profiles: dependencies.backendProfiles,
    },
    tts: {
      provider: process.env.TTS_PROVIDER || "piper_local",
    },
    workspaceQuery: dependencies.workspaceQuery,
    dependencySequence: dependencies,
  };
}

function resolveEmbeddingDimensions(engine = "native", model = "") {
  const dims = EMBEDDING_DIMENSIONS?.[engine]?.[model];
  if (dims) return dims;
  // Native embedders default to 384 dimensions if model is unrecognized
  if (engine === "native") return 384;
  return null;
}

module.exports = {
  getPrismReadiness,
  getPrismDependencySequence,
  resolveEmbeddingDimensions,
};
