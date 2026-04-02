const { DocumentManager } = require("../DocumentManager");
const { WorkspaceParsedFiles } = require("../../models/workspaceParsedFiles");
const { getVectorDbClass, getLLMProvider } = require("../helpers");
const { fillSourceWindow } = require("../helpers/chat");
const { buildAttachedContextManifest } = require("../chats/contextManifest");
const { recentChatHistory, sourceIdentifier } = require("../chats");

async function buildQueryAwareAgentPrompt({
  workspace,
  user = null,
  thread = null,
  apiSessionId = null,
  prompt = "",
  log = () => {},
}) {
  const normalizedPrompt = String(prompt || "").trim();
  if (
    !normalizedPrompt ||
    workspace?.chatMode !== "query" ||
    !workspace?.slug
  ) {
    return normalizedPrompt;
  }

  const queryRefusalResponse =
    workspace?.queryRefusalResponse ??
    "There is no relevant information in this workspace to answer your query.";

  const VectorDb = getVectorDbClass();
  const LLMConnector = getLLMProvider({
    provider: workspace?.chatProvider,
    model: workspace?.chatModel,
  });

  const hasVectorizedSpace = await VectorDb.hasNamespace(workspace.slug);
  const embeddingsCount = await VectorDb.namespaceCount(workspace.slug);

  if (!hasVectorizedSpace || embeddingsCount === 0) {
    return [
      "Workspace query mode is active.",
      `If the workspace context is missing, respond exactly with: "${queryRefusalResponse}"`,
      "No vectorized workspace context is available for this query.",
      "User query:",
      normalizedPrompt,
    ].join("\n\n");
  }

  const messageLimit = workspace?.openAiHistory || 20;
  const { rawHistory } = await recentChatHistory({
    user,
    workspace,
    thread,
    messageLimit,
    apiSessionId,
  });

  let contextTexts = [];
  let sources = [];
  const pinnedDocIdentifiers = [];

  await new DocumentManager({
    workspace,
    maxTokens: LLMConnector.promptWindowLimit(),
  })
    .pinnedDocs()
    .then((pinnedDocs) => {
      pinnedDocs.forEach((doc) => {
        pinnedDocIdentifiers.push(sourceIdentifier(doc));
        contextTexts.push(doc.pageContent);
        sources.push({
          text:
            doc.pageContent.slice(0, 1_000) +
            "...continued on in source document...",
          ...doc,
        });
      });
    })
    .catch((error) => {
      log(`Failed to gather pinned documents for query mode: ${error.message}`);
    });

  const parsedFiles = await WorkspaceParsedFiles.getContextFiles(
    workspace,
    thread || null,
    user || null
  );
  const attachedContextManifest = buildAttachedContextManifest(parsedFiles);
  if (attachedContextManifest) {
    contextTexts.push(attachedContextManifest);
  }
  parsedFiles.forEach((doc) => {
    contextTexts.push(doc.pageContent);
    sources.push({
      text:
        doc.pageContent.slice(0, 1_000) +
        "...continued on in source document...",
      ...doc,
    });
  });

  const vectorSearchResults =
    embeddingsCount !== 0
      ? await VectorDb.performSimilaritySearch({
          namespace: workspace.slug,
          input: normalizedPrompt,
          LLMConnector,
          similarityThreshold: workspace?.similarityThreshold,
          topN: workspace?.topN,
          filterIdentifiers: pinnedDocIdentifiers,
          rerank: workspace?.vectorSearchMode === "rerank",
        })
      : { contextTexts: [], sources: [], message: null };

  if (vectorSearchResults?.message) {
    log(
      `Query mode similarity search failed for agent prompt: ${vectorSearchResults.message}`
    );
  } else {
    const filledSources = fillSourceWindow({
      nDocs: workspace?.topN || 4,
      searchResults: vectorSearchResults.sources,
      history: rawHistory,
      filterIdentifiers: pinnedDocIdentifiers,
    });

    contextTexts = [...contextTexts, ...filledSources.contextTexts];
    sources = [...sources, ...vectorSearchResults.sources];
  }

  const trimmedContext = contextTexts
    .map((text) => String(text || "").trim())
    .filter(Boolean);

  if (trimmedContext.length === 0) {
    return [
      "Workspace query mode is active.",
      `If the workspace context is insufficient, respond exactly with: "${queryRefusalResponse}"`,
      "No relevant workspace context was found for this query.",
      "User query:",
      normalizedPrompt,
    ].join("\n\n");
  }

  const sourceSummary = sources
    .slice(0, 8)
    .map((source, index) => {
      const label = source?.title || source?.docpath || source?.location;
      return label ? `${index + 1}. ${label}` : null;
    })
    .filter(Boolean)
    .join("\n");

  return [
    "Workspace query mode is active.",
    "Answer using only the workspace context below and any explicitly attached thread documents.",
    "The invocation syntax has already been resolved for you.",
    "Do not comment on /lens, /agent, tool availability, or function routing.",
    "Do not answer from general world knowledge when the workspace context is insufficient.",
    `If the workspace context is insufficient, respond exactly with: "${queryRefusalResponse}"`,
    sourceSummary ? `Relevant sources:\n${sourceSummary}` : null,
    "Workspace context:",
    trimmedContext.join("\n\n---\n\n"),
    "User query:",
    normalizedPrompt,
    "Task:",
    "Answer the user's query directly in the active lens voice using the workspace context above.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

module.exports = { buildQueryAwareAgentPrompt };
