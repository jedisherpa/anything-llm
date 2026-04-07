/**
 * MetaCanon Tools Loader
 * Converts metacanon-tools.js definitions into Aibitat-compatible plugins
 * so they appear in the agent's function list and can be called during chat.
 */

const METACANON_PREFIX = "@@mc_";

/**
 * Returns an array of name-strings (prefixed with @@mc_) for inclusion
 * in the agent's functions array. Returns [] if the runtime is unavailable
 * so workspaces without the native runtime don't see MetaCanon tools.
 * @returns {string[]}
 */
function getMetaCanonToolNames() {
  try {
    const { isRuntimeAvailable } = require("../metacanon-runtime/bridge");
    if (!isRuntimeAvailable()) return [];
    const tools = require("./metacanon-tools");
    if (!Array.isArray(tools) || tools.length === 0) return [];
    return tools.map((t) => `${METACANON_PREFIX}${t.name}`);
  } catch {
    return [];
  }
}

/**
 * Load a single MetaCanon tool by name and attach it to an Aibitat instance.
 * Called from AgentHandler.#attachPlugins when it encounters a @@mc_ prefix.
 *
 * @param {string} toolName - The tool name without the @@mc_ prefix
 * @param {import("../agents/aibitat")} _aibitat - Reserved for interface parity with MCP loader; unused (aibitat is received via setup())
 * @returns {{ name: string, plugin: Function } | null}
 */
function loadMetaCanonPlugin(toolName, _aibitat = null) {
  try {
    const { isRuntimeAvailable } = require("../metacanon-runtime/bridge");
    if (!isRuntimeAvailable()) return null;
    const tools = require("./metacanon-tools");
    const tool = tools.find((t) => t.name === toolName);
    if (!tool) return null;

    return {
      name: tool.name,
      plugin: function () {
        return {
          name: tool.name,
          setup(aibitat) {
            aibitat.function({
              super: aibitat,
              name: tool.name,
              description: tool.description,
              parameters: {
                $schema: "http://json-schema.org/draft-07/schema#",
                ...tool.parameters,
                additionalProperties: false,
              },
              handler: async function (args) {
                try {
                  this.super.introspect(
                    `Executing MetaCanon tool: ${tool.name} with ${JSON.stringify(args, null, 2)}`
                  );
                  const result = await tool.execute(args);
                  this.super.introspect(
                    `MetaCanon tool: ${tool.name} completed successfully`
                  );
                  return JSON.stringify(result);
                } catch (error) {
                  this.super.introspect(
                    `MetaCanon tool: ${tool.name} failed with error: ${error.message}`
                  );
                  return `There was an error while calling the MetaCanon tool "${tool.name}": ${error.message}`;
                }
              },
            });
          },
        };
      },
    };
  } catch {
    return null;
  }
}

module.exports = {
  METACANON_PREFIX,
  getMetaCanonToolNames,
  loadMetaCanonPlugin,
};
