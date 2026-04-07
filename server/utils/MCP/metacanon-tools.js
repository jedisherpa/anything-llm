/**
 * MetaCanon MCP Tools Registration
 * Registers Metacanon runtime functions as MCP-compatible tools.
 *
 * This module defines 10 core MetaCanon tools for constitutional deliberation,
 * sub-sphere management, human-in-the-loop approvals, and compute provider selection.
 */

const {
  getMetaCanonClient,
  isRuntimeAvailable,
} = require("../metacanon-runtime/bridge");

/**
 * Tool: metacanon_genesis
 * Initialize the MetaCanon runtime with genesis configuration
 */
const metacanon_genesis = {
  name: "metacanon_genesis",
  description:
    "Initialize the MetaCanon runtime with genesis configuration. Must be called before other MetaCanon operations.",
  parameters: {
    type: "object",
    properties: {
      config: {
        type: "object",
        description:
          "Genesis configuration object containing constitutional rules, initial sub-spheres, and provider settings",
        properties: {
          constitution: {
            type: "string",
            description: "Constitutional rules as JSON string",
          },
          initialProviders: {
            type: "array",
            description: "List of initial compute providers to configure",
            items: { type: "string" },
          },
          hitlThreshold: {
            type: "number",
            description: "Human-in-the-loop approval threshold (0.0-1.0)",
          },
        },
        required: ["constitution"],
      },
    },
    required: ["config"],
  },
  execute: async (args) => {
    if (!isRuntimeAvailable()) {
      return {
        success: false,
        error: "MetaCanon runtime is not available",
      };
    }

    try {
      const client = getMetaCanonClient();
      const result = client.genesisRite(args.config);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to initialize MetaCanon runtime",
      };
    }
  },
};

/**
 * Tool: metacanon_deliberate
 * Submit a query for constitutional deliberation
 */
const metacanon_deliberate = {
  name: "metacanon_deliberate",
  description:
    "Submit a query for constitutional deliberation within a sub-sphere. Returns reasoned decision based on constitutional rules.",
  parameters: {
    type: "object",
    properties: {
      subSphereId: {
        type: "string",
        description: "The unique identifier of the target sub-sphere",
      },
      query: {
        type: "string",
        description:
          "The query or decision request for constitutional deliberation",
      },
      providerOverride: {
        type: "string",
        description:
          "Optional compute provider ID to override the default for this query",
      },
    },
    required: ["subSphereId", "query"],
  },
  execute: async (args) => {
    if (!isRuntimeAvailable()) {
      return {
        success: false,
        error: "MetaCanon runtime is not available",
      };
    }

    try {
      const client = getMetaCanonClient();
      const result = client.submitSubSphereQuery(
        args.subSphereId,
        args.query,
        args.providerOverride || null
      );
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to submit query for deliberation",
      };
    }
  },
};

/**
 * Tool: metacanon_validate
 * Validate an action against the constitution (CRITICAL: call before external tool execution)
 */
const metacanon_validate = {
  name: "metacanon_validate",
  description:
    "Validate an action against the constitutional framework. Returns a structured report with validity, reason, alignment score, and flags (e.g., requires_human_approval, authority_drift_detected). CRITICAL: This tool must be called before any agent tool execution outside read-only scope.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "object",
        description: "The action to validate",
        properties: {
          type: {
            type: "string",
            description:
              "Action type (e.g., 'read', 'write', 'delete', 'execute', 'query')",
          },
          target: {
            type: "string",
            enum: ["llm_call", "tool_invocation", "external_message"],
            description:
              "Target category: llm_call (advisory/read), tool_invocation (tool execution), external_message (affects external systems)",
          },
          content: {
            type: "string",
            description: "Description of the action being validated",
          },
        },
        required: ["type", "target", "content"],
      },
      willVector: {
        type: "object",
        description: "The will vector representing agent intent and values",
        properties: {
          intent: {
            type: "string",
            description: "Primary intent of the action",
          },
          scope: {
            type: "string",
            enum: ["user", "system", "shared"],
            description: "Scope of the action",
          },
          confidence: {
            type: "number",
            description: "Confidence level (0.0-1.0)",
          },
          directives: {
            type: "array",
            items: { type: "string" },
            description: "Directive phrases describing the action's purpose",
          },
        },
        required: ["intent", "directives"],
      },
    },
    required: ["action", "willVector"],
  },
  execute: async (args) => {
    if (!isRuntimeAvailable()) {
      return {
        success: false,
        error: "MetaCanon runtime is not available",
        valid: false,
      };
    }

    try {
      const client = getMetaCanonClient();

      // Build the will vector with all fields for the enhanced validator
      const willVector = {
        directives: args.willVector.directives || [],
        intent: args.willVector.intent || null,
        scope: args.willVector.scope || null,
        confidence:
          args.willVector.confidence != null
            ? args.willVector.confidence
            : null,
      };

      // Try the enhanced constitutional validator (uses cached genesis state)
      if (typeof client.validateActionConstitutional === "function") {
        const report = client.validateActionConstitutional(
          args.action,
          willVector
        );
        return {
          success: true,
          valid: report.valid,
          reason: report.reason || null,
          alignment_score: report.alignment_score || 0,
          flags: report.flags || [],
          blocked_by: report.blocked_by || null,
          data: report,
        };
      }

      // Fallback to legacy boolean validator
      const result = client.validateAction(args.action, args.willVector);
      return {
        success: true,
        valid: !!result,
        data: { valid: !!result },
      };
    } catch (error) {
      return {
        success: false,
        valid: false,
        error: error.message || "Failed to validate action",
      };
    }
  },
};

/**
 * Tool: metacanon_health
 * Check MetaCanon runtime health and communication status
 */
const metacanon_health = {
  name: "metacanon_health",
  description:
    "Check the health and communication status of the MetaCanon runtime. Returns operational status and diagnostic information including genesis state.",
  parameters: {
    type: "object",
    properties: {},
  },
  execute: async (_args) => {
    if (!isRuntimeAvailable()) {
      return {
        success: false,
        healthy: false,
        genesis_performed: false,
        error: "MetaCanon runtime is not available",
        diagnostics: {
          runtime_available: false,
          genesis_performed: false,
          message:
            "MetaCanon native bridge could not be loaded. Ensure the Rust runtime binary is present and compatible.",
        },
      };
    }

    try {
      const client = getMetaCanonClient();
      const result = client.getCommunicationStatus();

      // Determine genesis state: if agent_bindings is populated or status is
      // operational, genesis has been performed. Otherwise report as pending.
      const genesisPerformed =
        Array.isArray(result.agent_bindings) &&
        result.agent_bindings.length > 0;

      return {
        success: true,
        healthy: result.status === "operational",
        genesis_performed: genesisPerformed,
        data: result,
        diagnostics: {
          runtime_available: true,
          genesis_performed: genesisPerformed,
          message: genesisPerformed
            ? "Runtime is operational and genesis has been performed."
            : "Runtime is available but genesis has not yet been performed. Call metacanon_genesis or wait for auto-genesis at startup.",
        },
      };
    } catch (error) {
      return {
        success: false,
        healthy: false,
        genesis_performed: false,
        error: error.message || "Failed to check health status",
        diagnostics: {
          runtime_available: true,
          genesis_performed: false,
          message: `Runtime loaded but health check failed: ${error.message}`,
        },
      };
    }
  },
};

/**
 * Tool: metacanon_create_subsphere
 * Create a new task sub-sphere
 */
const metacanon_create_subsphere = {
  name: "metacanon_create_subsphere",
  description:
    "Create a new task sub-sphere for delegated decision-making. Sub-spheres operate independently within the constitutional framework.",
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Display name for the sub-sphere",
      },
      objective: {
        type: "string",
        description: "The primary objective or mandate of the sub-sphere",
      },
      hitlRequired: {
        type: "boolean",
        description:
          "Whether human-in-the-loop approval is required for actions",
        default: false,
      },
    },
    required: ["name", "objective"],
  },
  execute: async (args) => {
    if (!isRuntimeAvailable()) {
      return {
        success: false,
        error: "MetaCanon runtime is not available",
      };
    }

    try {
      const client = getMetaCanonClient();
      const result = client.createTaskSubSphere(
        args.name,
        args.objective,
        args.hitlRequired || false
      );
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to create sub-sphere",
      };
    }
  },
};

/**
 * Tool: metacanon_list_subspheres
 * List all active sub-spheres
 */
const metacanon_list_subspheres = {
  name: "metacanon_list_subspheres",
  description:
    "List all active sub-spheres currently operating in the MetaCanon runtime.",
  parameters: {
    type: "object",
    properties: {},
  },
  execute: async (_args) => {
    if (!isRuntimeAvailable()) {
      return {
        success: false,
        error: "MetaCanon runtime is not available",
        subSpheres: [],
      };
    }

    try {
      const client = getMetaCanonClient();
      const result = client.getSubSphereList();
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to list sub-spheres",
        subSpheres: [],
      };
    }
  },
};

/**
 * Tool: metacanon_approve_hitl
 * Approve a pending human-in-the-loop action
 */
const metacanon_approve_hitl = {
  name: "metacanon_approve_hitl",
  description:
    "Approve a pending human-in-the-loop action that requires explicit authorization before execution.",
  parameters: {
    type: "object",
    properties: {
      subSphereId: {
        type: "string",
        description: "The sub-sphere containing the pending action",
      },
      actionId: {
        type: "string",
        description: "The unique identifier of the action to approve",
      },
    },
    required: ["subSphereId", "actionId"],
  },
  execute: async (args) => {
    if (!isRuntimeAvailable()) {
      return {
        success: false,
        error: "MetaCanon runtime is not available",
      };
    }

    try {
      const client = getMetaCanonClient();
      const result = client.approveHitlAction(args.subSphereId, args.actionId);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to approve HITL action",
      };
    }
  },
};

/**
 * Tool: metacanon_reject_hitl
 * Reject a pending human-in-the-loop action
 */
const metacanon_reject_hitl = {
  name: "metacanon_reject_hitl",
  description:
    "Reject a pending human-in-the-loop action and prevent its execution.",
  parameters: {
    type: "object",
    properties: {
      subSphereId: {
        type: "string",
        description: "The sub-sphere containing the pending action",
      },
      actionId: {
        type: "string",
        description: "The unique identifier of the action to reject",
      },
      reason: {
        type: "string",
        description: "The reason for rejecting the action",
        default: "Rejected in Prism execute mode.",
      },
    },
    required: ["subSphereId", "actionId"],
  },
  execute: async (args) => {
    if (!isRuntimeAvailable()) {
      return {
        success: false,
        error: "MetaCanon runtime is not available",
      };
    }

    try {
      const client = getMetaCanonClient();
      const result = client.rejectHitlAction(
        args.subSphereId,
        args.actionId,
        args.reason || "Rejected in Prism execute mode."
      );
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to reject HITL action",
      };
    }
  },
};

/**
 * Tool: metacanon_compute_options
 * List available compute providers
 */
const metacanon_compute_options = {
  name: "metacanon_compute_options",
  description:
    "List all available compute providers that MetaCanon can delegate work to (e.g., local, cloud, specialized).",
  parameters: {
    type: "object",
    properties: {},
  },
  execute: async (_args) => {
    if (!isRuntimeAvailable()) {
      return {
        success: false,
        error: "MetaCanon runtime is not available",
        providers: [],
      };
    }

    try {
      const client = getMetaCanonClient();
      const result = client.getComputeOptions();
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to retrieve compute options",
        providers: [],
      };
    }
  },
};

/**
 * Tool: metacanon_set_provider
 * Set the global compute provider
 */
const metacanon_set_provider = {
  name: "metacanon_set_provider",
  description:
    "Set the global default compute provider for MetaCanon operations.",
  parameters: {
    type: "object",
    properties: {
      providerId: {
        type: "string",
        description:
          "The unique identifier of the compute provider to set as default",
      },
    },
    required: ["providerId"],
  },
  execute: async (args) => {
    if (!isRuntimeAvailable()) {
      return {
        success: false,
        error: "MetaCanon runtime is not available",
      };
    }

    try {
      const client = getMetaCanonClient();
      const result = client.setGlobalComputeProvider(args.providerId);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to set compute provider",
      };
    }
  },
};

/**
 * Export all Metacanon tools
 * Array format compatible with MCP tool registration system
 */
module.exports = [
  metacanon_genesis,
  metacanon_deliberate,
  metacanon_validate,
  metacanon_health,
  metacanon_create_subsphere,
  metacanon_list_subspheres,
  metacanon_approve_hitl,
  metacanon_reject_hitl,
  metacanon_compute_options,
  metacanon_set_provider,
];
