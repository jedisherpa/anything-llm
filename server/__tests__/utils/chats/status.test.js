/* global describe, it, expect, beforeEach, jest, process, require */
jest.mock("../../../utils/helpers", () => ({
  getVectorDbClass: jest.fn(),
  getEmbeddingEngineSelection: jest.fn(),
}));

const {
  getVectorDbClass,
  getEmbeddingEngineSelection,
} = require("../../../utils/helpers");
const { workspaceStatus } = require("../../../utils/chats/commands/status");

describe("workspaceStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.VECTOR_DB = "pgvector";
    process.env.EMBEDDING_ENGINE = "openai";
    process.env.TTS_PROVIDER = "piper_local";
    process.env.STORAGE_DIR =
      "/Users/paulcooper/Library/Application Support/com.sovereign.anythingllm.desktop/storage";

    getEmbeddingEngineSelection.mockReturnValue({
      model: "text-embedding-3-large",
    });
  });

  it("summarizes the active workspace and query readiness", async () => {
    getVectorDbClass.mockReturnValue({
      hasNamespace: jest.fn().mockResolvedValue(true),
      namespaceCount: jest.fn().mockResolvedValue(9551),
    });

    const result = await workspaceStatus(
      {
        name: "Prism Preview",
        slug: "prism-preview",
        chatMode: "query",
        chatProvider: "docker-model-runner",
        chatModel: "ai/qwen3:latest",
      },
      "/status",
      "msg-1"
    );

    expect(result.type).toBe("textResponse");
    expect(result.close).toBe(true);
    expect(result.textResponse).toContain("Prism status");
    expect(result.textResponse).toContain(
      "Workspace: Prism Preview (prism-preview)"
    );
    expect(result.textResponse).toContain("Mode: QUERY");
    expect(result.textResponse).toContain(
      "Chat model: docker-model-runner / ai/qwen3:latest"
    );
    expect(result.textResponse).toContain(
      "Vector backend: pgvector (ready (9551 vectors))"
    );
    expect(result.textResponse).toContain("Query readiness: ready");
    expect(result.textResponse).toContain(
      "Embedder: openai / text-embedding-3-large"
    );
    expect(result.textResponse).toContain("TTS: piper_local");
    expect(result.textResponse).toContain(
      "Storage profile: com.sovereign.anythingllm.desktop"
    );
  });
});
