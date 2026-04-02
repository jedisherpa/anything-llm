const path = require("path");
const {
  getVectorDbClass,
  getEmbeddingEngineSelection,
} = require("../../helpers");

function describeStorageProfile(storageDir = "") {
  if (!storageDir) return "default";
  const normalized = path.normalize(storageDir);
  const parentDir = path.dirname(normalized);
  return path.basename(parentDir) || path.basename(normalized) || "default";
}

async function workspaceStatus(workspace, message, msgUUID) {
  void message;
  const VectorDb = getVectorDbClass();
  const embedder = getEmbeddingEngineSelection();

  let hasNamespace = false;
  let embeddingsCount = 0;
  try {
    hasNamespace = await VectorDb.hasNamespace(workspace.slug);
    embeddingsCount = await VectorDb.namespaceCount(workspace.slug);
  } catch (error) {
    console.error("Failed to inspect workspace vector readiness:", error);
  }

  const vectorBackend = process.env.VECTOR_DB || "lancedb";
  const vectorReadiness =
    hasNamespace && embeddingsCount > 0
      ? `ready (${embeddingsCount} vectors)`
      : "not ready";
  const queryReadiness =
    workspace?.chatMode === "query"
      ? hasNamespace && embeddingsCount > 0
        ? "ready"
        : "blocked"
      : "not active";

  const textResponse = [
    "Prism status",
    `Workspace: ${workspace?.name || workspace?.slug || "Unknown"} (${workspace?.slug || "unknown"})`,
    `Mode: ${(workspace?.chatMode || "chat").toUpperCase()}`,
    `Chat model: ${workspace?.chatProvider || process.env.LLM_PROVIDER || "unset"} / ${workspace?.chatModel || process.env.LLM_MODEL_PREF || "unset"}`,
    `Vector backend: ${vectorBackend} (${vectorReadiness})`,
    `Query readiness: ${queryReadiness}`,
    `Embedder: ${process.env.EMBEDDING_ENGINE || "native"} / ${embedder?.model || process.env.EMBEDDING_MODEL_PREF || "default"}`,
    `TTS: ${process.env.TTS_PROVIDER || "native"}`,
    `Storage profile: ${describeStorageProfile(process.env.STORAGE_DIR)}`,
  ].join("\n");

  return {
    uuid: msgUUID,
    type: "textResponse",
    textResponse,
    sources: [],
    close: true,
    error: false,
    action: "workspace_status",
  };
}

module.exports = {
  workspaceStatus,
};
