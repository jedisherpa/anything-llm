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

function normalizeAgentToken(token = "") {
  return String(token || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@_-]/g, "");
}

function normalizeInvocationPrompt(promptString) {
  const rawPrompt = String(promptString || "").trim();
  if (!rawPrompt.startsWith("/")) return rawPrompt;

  const supportedHandles = supportedAgentHandles();

  if (/^\/agent(?:\s|$)/i.test(rawPrompt)) {
    const query = rawPrompt.replace(/^\/agent\b/i, "").trim();
    return ["@agent", query].filter(Boolean).join(" ").trim();
  }

  if (/^\/lens(?:\s|$)/i.test(rawPrompt)) {
    const remainder = rawPrompt.replace(/^\/lens\b/i, "").trim();
    const [rawHandle, ...queryParts] = remainder.split(/\s+/);
    const handle = normalizeAgentToken(rawHandle);
    if (!supportedHandles.has(handle)) return rawPrompt;
    return [handle, queryParts.join(" ").trim()].filter(Boolean).join(" ");
  }

  if (/^\/constellation(?:\s|$)/i.test(rawPrompt)) {
    const remainder = rawPrompt.replace(/^\/constellation\b/i, "").trim();
    const [rawHandle, ...queryParts] = remainder.split(/\s+/);
    const handle = normalizeAgentToken(rawHandle);
    if (!supportedHandles.has(handle)) return rawPrompt;
    return [handle, queryParts.join(" ").trim()].filter(Boolean).join(" ");
  }

  if (/^\/council(?:\s|$)/i.test(rawPrompt)) {
    const remainder = rawPrompt.replace(/^\/council\b/i, "").trim();
    const separatorIndex = remainder.indexOf("--");
    const handlesPart =
      separatorIndex >= 0 ? remainder.slice(0, separatorIndex) : remainder;
    const query =
      separatorIndex >= 0 ? remainder.slice(separatorIndex + 2).trim() : "";
    const handles = handlesPart
      .split(/[,\s]+/)
      .map(normalizeAgentToken)
      .filter((token) => supportedHandles.has(token) && token !== "@council");

    if (handles.length === 0) return rawPrompt;

    return [
      "@council",
      "pack: Ad Hoc Council Pack",
      `lenses: ${handles.join(" ")}`,
      query ? `user query: ${query}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return rawPrompt;
}

const WorkspaceAgentInvocation = {
  // returns array of normalized @handles present in the prompt when the
  // prompt starts with a supported agent handle.
  parseAgents: function (promptString) {
    if (!promptString || typeof promptString !== "string") return [];
    const normalized = normalizeInvocationPrompt(promptString)
      .trim()
      .toLowerCase();
    const tokens = normalized
      .split(/\s+/)
      .map((token) => token.replace(/[^a-z0-9@_-]/g, ""));
    if (tokens.length === 0) return [];

    const supportedHandles = supportedAgentHandles();
    const parsedHandles = [];

    for (const token of tokens) {
      if (!token.startsWith("@")) break;
      if (!supportedHandles.has(token)) {
        if (parsedHandles.length === 0) return [];
        break;
      }
      parsedHandles.push(token);
    }

    return [...new Set(parsedHandles)];
  },

  normalizeInvocationPrompt,

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
