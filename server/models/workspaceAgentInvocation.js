const prisma = require("../utils/prisma");
const { v4: uuidv4 } = require("uuid");
const {
  LENS_AGENT_HANDLES,
} = require("../utils/agents/aibitat/prompts/lensAgents");
const {
  getSupportedMetacanonHandles,
} = require("../utils/agents/metacanon/library");

function supportedAgentHandles() {
  return new Set([
    "@agent",
    ...LENS_AGENT_HANDLES,
    ...getSupportedMetacanonHandles(),
  ]);
}

const WorkspaceAgentInvocation = {
  // returns array of normalized @handles present in the prompt when the
  // prompt starts with a supported agent handle.
  parseAgents: function (promptString) {
    if (!promptString || typeof promptString !== "string") return [];
    const normalized = promptString.trim().toLowerCase();
    const tokens = normalized
      .split(/\s+/)
      .map((token) => token.replace(/[^a-z0-9@_-]/g, ""));
    if (tokens.length === 0) return [];

    const firstToken = tokens[0];
    if (!supportedAgentHandles().has(firstToken)) return [];

    return tokens.filter((token) => token.startsWith("@"));
  },

  close: async function (uuid) {
    if (!uuid) return;
    try {
      await prisma.workspace_agent_invocations.update({
        where: { uuid: String(uuid) },
        data: { closed: true },
      });
    } catch {}
  },

  new: async function ({ prompt, workspace, user = null, thread = null }) {
    try {
      const invocation = await prisma.workspace_agent_invocations.create({
        data: {
          uuid: uuidv4(),
          workspace_id: workspace.id,
          prompt: String(prompt),
          user_id: user?.id,
          thread_id: thread?.id,
        },
      });

      return { invocation, message: null };
    } catch (error) {
      console.error(error.message);
      return { invocation: null, message: error.message };
    }
  },

  get: async function (clause = {}) {
    try {
      const invocation = await prisma.workspace_agent_invocations.findFirst({
        where: clause,
      });

      return invocation || null;
    } catch (error) {
      console.error(error.message);
      return null;
    }
  },

  getWithWorkspace: async function (clause = {}) {
    try {
      const invocation = await prisma.workspace_agent_invocations.findFirst({
        where: clause,
        include: {
          workspace: true,
        },
      });

      return invocation || null;
    } catch (error) {
      console.error(error.message);
      return null;
    }
  },

  delete: async function (clause = {}) {
    try {
      await prisma.workspace_agent_invocations.delete({
        where: clause,
      });
      return true;
    } catch (error) {
      console.error(error.message);
      return false;
    }
  },

  where: async function (clause = {}, limit = null, orderBy = null) {
    try {
      const results = await prisma.workspace_agent_invocations.findMany({
        where: clause,
        ...(limit !== null ? { take: limit } : {}),
        ...(orderBy !== null ? { orderBy } : {}),
      });
      return results;
    } catch (error) {
      console.error(error.message);
      return [];
    }
  },
};

module.exports = { WorkspaceAgentInvocation };
