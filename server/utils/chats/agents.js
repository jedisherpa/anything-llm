const pluralize = require("pluralize");
const {
  WorkspaceAgentInvocation,
} = require("../../models/workspaceAgentInvocation");
const { writeResponseChunk } = require("../helpers/chat/responses");
const { getVectorDbClass } = require("../helpers");

async function grepAgents({
  uuid,
  response,
  message,
  workspace,
  user = null,
  thread = null,
}) {
  const agentHandles = WorkspaceAgentInvocation.parseAgents(message);
  if (agentHandles.length > 0) {
    if (workspace?.chatMode === "query") {
      const VectorDb = getVectorDbClass();
      const hasVectorizedSpace = await VectorDb.hasNamespace(workspace.slug);
      const embeddingsCount = await VectorDb.namespaceCount(workspace.slug);

      if (!hasVectorizedSpace || embeddingsCount === 0) {
        writeResponseChunk(response, {
          id: uuid,
          type: "textResponse",
          textResponse:
            workspace?.queryRefusalResponse ??
            "There is no relevant information in this workspace to answer your query.",
          sources: [],
          close: true,
          error: null,
        });
        return true;
      }
    }

    const { invocation: newInvocation } = await WorkspaceAgentInvocation.new({
      prompt: message,
      workspace: workspace,
      user: user,
      thread: thread,
    });

    if (!newInvocation) {
      writeResponseChunk(response, {
        id: uuid,
        type: "statusResponse",
        textResponse: `${pluralize(
          "Agent",
          agentHandles.length
        )} ${agentHandles.join(
          ", "
        )} could not be called. Chat will be handled as default chat.`,
        sources: [],
        close: true,
        animate: false,
        error: null,
      });
      return;
    }

    writeResponseChunk(response, {
      id: uuid,
      type: "agentInitWebsocketConnection",
      textResponse: null,
      sources: [],
      close: false,
      error: null,
      websocketUUID: newInvocation.uuid,
    });

    // Close HTTP stream-able chunk response method because we will swap to agents now.
    writeResponseChunk(response, {
      id: uuid,
      type: "statusResponse",
      textResponse: `${pluralize(
        "Agent",
        agentHandles.length
      )} ${agentHandles.join(
        ", "
      )} invoked.\nSwapping over to agent chat. Type /exit to exit agent execution loop early.`,
      sources: [],
      close: true,
      error: null,
      animate: true,
    });
    return true;
  }

  return false;
}

module.exports = { grepAgents };
