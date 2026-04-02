/* global describe, it, expect, beforeEach, jest, require */
jest.mock("../../../utils/DocumentManager", () => ({
  DocumentManager: jest.fn().mockImplementation(() => ({
    pinnedDocs: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock("../../../models/workspaceParsedFiles", () => ({
  WorkspaceParsedFiles: {
    getContextFiles: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock("../../../utils/helpers", () => ({
  getVectorDbClass: jest.fn(),
  getLLMProvider: jest.fn(),
}));

jest.mock("../../../utils/helpers/chat", () => ({
  fillSourceWindow: jest.fn(),
}));

jest.mock("../../../utils/chats/contextManifest", () => ({
  buildAttachedContextManifest: jest.fn().mockReturnValue(""),
}));

jest.mock("../../../utils/chats", () => ({
  recentChatHistory: jest.fn().mockResolvedValue({ rawHistory: [] }),
  sourceIdentifier: jest.fn().mockReturnValue("doc-id"),
}));

const { getVectorDbClass, getLLMProvider } = require("../../../utils/helpers");
const { fillSourceWindow } = require("../../../utils/helpers/chat");
const {
  buildQueryAwareAgentPrompt,
} = require("../../../utils/agents/queryContext");

describe("buildQueryAwareAgentPrompt", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getLLMProvider.mockReturnValue({
      promptWindowLimit: jest.fn().mockReturnValue(16000),
    });
    fillSourceWindow.mockReturnValue({
      contextTexts: [],
      sources: [],
    });
  });

  it("returns the prompt unchanged when workspace query mode is not active", async () => {
    const result = await buildQueryAwareAgentPrompt({
      workspace: {
        slug: "prism-preview",
        chatMode: "chat",
      },
      prompt: "Hello there",
    });

    expect(result).toBe("Hello there");
    expect(getVectorDbClass).not.toHaveBeenCalled();
  });

  it("returns an exact refusal instruction when the workspace has no vectorized context", async () => {
    const VectorDb = {
      hasNamespace: jest.fn().mockResolvedValue(false),
      namespaceCount: jest.fn().mockResolvedValue(0),
    };
    getVectorDbClass.mockReturnValue(VectorDb);

    const result = await buildQueryAwareAgentPrompt({
      workspace: {
        slug: "prism-preview",
        chatMode: "query",
        queryRefusalResponse: "No relevant workspace information is available.",
      },
      prompt: "Tell me about Paul Cooper",
    });

    expect(result).toContain("Workspace query mode is active.");
    expect(result).toContain(
      'If the workspace context is missing, respond exactly with: "No relevant workspace information is available."'
    );
    expect(result).toContain("User query:");
    expect(result).toContain("Tell me about Paul Cooper");
  });

  it("builds a direct-answer prompt from retrieved workspace context", async () => {
    const VectorDb = {
      hasNamespace: jest.fn().mockResolvedValue(true),
      namespaceCount: jest.fn().mockResolvedValue(4),
      performSimilaritySearch: jest.fn().mockResolvedValue({
        contextTexts: ["Paul Cooper runs PrismAI and iampaulcooper.com."],
        sources: [
          {
            title: "iampaulcooper.com — About",
            pageContent: "Paul Cooper runs PrismAI and iampaulcooper.com.",
          },
        ],
        message: null,
      }),
    };

    getVectorDbClass.mockReturnValue(VectorDb);
    fillSourceWindow.mockReturnValue({
      contextTexts: ["Paul Cooper runs PrismAI and iampaulcooper.com."],
      sources: [
        {
          title: "iampaulcooper.com — About",
          pageContent: "Paul Cooper runs PrismAI and iampaulcooper.com.",
        },
      ],
    });

    const result = await buildQueryAwareAgentPrompt({
      workspace: {
        slug: "prism-preview",
        chatMode: "query",
        chatProvider: "docker-model-runner",
        chatModel: "ai/qwen3:latest",
        topN: 4,
      },
      prompt: "Tell me about Paul Cooper",
    });

    expect(result).toContain(
      "Answer using only the workspace context below and any explicitly attached thread documents."
    );
    expect(result).toContain(
      "Do not comment on /lens, /agent, tool availability, or function routing."
    );
    expect(result).toContain("Relevant sources:\n1. iampaulcooper.com — About");
    expect(result).toContain("Workspace context:");
    expect(result).toContain("Paul Cooper runs PrismAI and iampaulcooper.com.");
    expect(result).toContain("User query:\n\nTell me about Paul Cooper");
    expect(result).toContain(
      "Answer the user's query directly in the active lens voice using the workspace context above."
    );
  });
});
