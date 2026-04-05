/**
 * Sphere Thread Engine - Lightweight v2.0 Implementation
 *
 * Provides higher-level sphere operations coordination for PrismAI v2.0.
 * Wraps the MetaCanon FFI bridge's sphere operations with deliberation-focused APIs.
 * Full TypeScript embedding deferred to v2.1.
 *
 * @module sphere-thread
 */

const { createMetaCanonClient } = require("./client.js");

/**
 * Status of an active deliberation sphere
 * @typedef {Object} DeliberationStatus
 * @property {string} sphereId - Unique identifier for the sub-sphere
 * @property {string} topic - Topic under deliberation
 * @property {string[]} boundAgents - Agent IDs bound to this sphere
 * @property {boolean} hitlRequired - Whether HITL approval is required
 * @property {string} state - Current state (active, paused, dissolved)
 * @property {Object[]} pendingActions - Actions awaiting HITL approval
 */

/**
 * Result of a deliberation query
 * @typedef {Object} DeliberationResult
 * @property {string} sphereId - Sphere where query was submitted
 * @property {string} queryId - Query identifier
 * @property {string} content - Result content from the deliberation
 * @property {string} status - Status (completed, pending, failed)
 */

/**
 * Sphere Thread Coordinator - manages deliberation spheres and agent coordination
 */
class SphereThreadCoordinator {
  /**
   * Create a new Sphere Thread Coordinator
   * @param {Object} options - Configuration options
   * @param {Object} [options.client] - MetaCanon client (uses default bridge if not provided)
   */
  constructor(options = {}) {
    this.client = options.client || this._createDefaultClient();
    this.deliberations = new Map(); // Track local state of deliberations
  }

  /**
   * Create a default MetaCanon client using the bridge
   * @private
   * @returns {Object} MetaCanon client
   */
  _createDefaultClient() {
    try {
      return createMetaCanonClient();
    } catch (error) {
      console.warn(
        "MetaCanon bridge unavailable. Sphere operations will gracefully degrade.",
        error.message
      );
      return null;
    }
  }

  /**
   * Check if runtime is available
   * @returns {boolean} True if MetaCanon bridge is available
   */
  isRuntimeAvailable() {
    return this.client !== null;
  }

  /**
   * Create a deliberation sphere and bind agents to it
   *
   * @param {string} topic - Topic for deliberation
   * @param {string[]} agentIds - Array of agent IDs to bind to this sphere
   * @param {boolean} [hitlRequired=false] - Whether HITL approval is required for actions
   * @returns {Promise<Object>} Sphere metadata with sphereId
   * @throws {Error} If runtime is unavailable or creation fails
   *
   * @example
   * const sphere = await coordinator.createDeliberationSphere(
   *   "API design best practices",
   *   ["agent-1", "agent-2"],
   *   true
   * );
   */
  async createDeliberationSphere(topic, agentIds, hitlRequired = false) {
    if (!this.isRuntimeAvailable()) {
      throw new Error(
        "MetaCanon runtime unavailable. Cannot create deliberation sphere."
      );
    }

    // Create the sub-sphere with the topic as objective
    const sphereResult = this.client.createTaskSubSphere(
      topic,
      topic,
      hitlRequired
    );

    const sphereId = sphereResult.id;

    // Bind each agent to the sphere
    const boundAgents = [];
    for (const agentId of agentIds) {
      try {
        this.client.bindAgentRoute(agentId, null, null, sphereId, false);
        boundAgents.push(agentId);
      } catch (error) {
        console.error(
          `Failed to bind agent ${agentId} to sphere ${sphereId}:`,
          error.message
        );
        // Continue binding other agents on partial failure
      }
    }

    // Store deliberation metadata locally
    const deliberationMeta = {
      sphereId,
      topic,
      boundAgents,
      hitlRequired,
      createdAt: new Date().toISOString(),
      status: "active",
    };
    this.deliberations.set(sphereId, deliberationMeta);

    return {
      sphereId,
      topic,
      boundAgents,
      hitlRequired,
      status: "active",
    };
  }

  /**
   * Submit a query to a deliberation sphere and retrieve the result
   *
   * @param {string} sphereId - ID of the deliberation sphere
   * @param {string} query - Query or prompt to submit for deliberation
   * @param {string} [providerOverride] - Optional provider override
   * @returns {Promise<DeliberationResult>} Result of the deliberation
   * @throws {Error} If sphere not found or query fails
   *
   * @example
   * const result = await coordinator.queryDeliberation(sphereId, "What are the pros and cons?");
   */
  async queryDeliberation(sphereId, query, providerOverride = null) {
    if (!this.isRuntimeAvailable()) {
      throw new Error("MetaCanon runtime unavailable. Cannot submit query.");
    }

    // Verify sphere exists locally
    if (!this.deliberations.has(sphereId)) {
      throw new Error(
        `Deliberation sphere ${sphereId} not found or not active.`
      );
    }

    // Submit query to the sub-sphere
    const queryResult = this.client.submitSubSphereQuery(
      sphereId,
      query,
      providerOverride
    );

    return {
      sphereId,
      queryId: queryResult.id,
      content: queryResult.content || queryResult.result || "",
      status: queryResult.status || "completed",
    };
  }

  /**
   * List all active deliberations with their current status
   *
   * @returns {Promise<DeliberationStatus[]>} Array of active deliberations
   *
   * @example
   * const active = await coordinator.getActiveDeliberations();
   * active.forEach(d => console.log(`${d.topic}: ${d.state}`));
   */
  async getActiveDeliberations() {
    if (!this.isRuntimeAvailable()) {
      console.warn("MetaCanon runtime unavailable. Returning empty list.");
      return Array.from(this.deliberations.values());
    }

    try {
      const spheres = this.client.getSubSphereList();

      // Enhance with local metadata if available
      return spheres.map((sphere) => {
        const local = this.deliberations.get(sphere.id) || {};
        return {
          sphereId: sphere.id,
          topic: local.topic || sphere.objective || "Unknown",
          boundAgents: local.boundAgents || [],
          hitlRequired: local.hitlRequired || false,
          state: sphere.state || "active",
          pendingActions: sphere.pending_actions || [],
        };
      });
    } catch (error) {
      console.error("Failed to fetch sphere list:", error.message);
      // Gracefully degrade to local state
      return Array.from(this.deliberations.values());
    }
  }

  /**
   * Resolve a pending HITL action (approve or reject)
   *
   * @param {string} sphereId - ID of the deliberation sphere
   * @param {string} actionId - ID of the pending action
   * @param {boolean} approved - Whether to approve (true) or reject (false)
   * @param {string} [reason] - Optional reason for rejection
   * @returns {Promise<Object>} Result of the action resolution
   * @throws {Error} If sphere not found or action not pending
   *
   * @example
   * await coordinator.resolveHitlAction(sphereId, actionId, true);
   * // or
   * await coordinator.resolveHitlAction(sphereId, actionId, false, "Needs revision");
   */
  async resolveHitlAction(sphereId, actionId, approved, reason = undefined) {
    if (!this.isRuntimeAvailable()) {
      throw new Error(
        "MetaCanon runtime unavailable. Cannot resolve HITL action."
      );
    }

    if (approved) {
      return this.client.approveHitlAction(sphereId, actionId);
    } else {
      const rejectionReason =
        reason || "Rejected via PrismAI sphere interface.";
      return this.client.rejectHitlAction(sphereId, actionId, rejectionReason);
    }
  }

  /**
   * Pause a deliberation sphere (does not dissolve it)
   *
   * @param {string} sphereId - ID of the sphere to pause
   * @returns {Promise<Object>} Updated sphere status
   *
   * @example
   * await coordinator.pauseDeliberation(sphereId);
   */
  async pauseDeliberation(sphereId) {
    if (!this.isRuntimeAvailable()) {
      throw new Error(
        "MetaCanon runtime unavailable. Cannot pause deliberation."
      );
    }

    const result = this.client.pauseSubSphere(sphereId);
    const local = this.deliberations.get(sphereId);
    if (local) {
      local.status = "paused";
    }

    return result;
  }

  /**
   * Dissolve a deliberation sphere (ends it permanently)
   *
   * @param {string} sphereId - ID of the sphere to dissolve
   * @param {string} [reason] - Optional reason for dissolution
   * @returns {Promise<Object>} Dissolution result
   *
   * @example
   * await coordinator.endDeliberation(sphereId, "Consensus reached");
   */
  async endDeliberation(sphereId, reason = undefined) {
    if (!this.isRuntimeAvailable()) {
      throw new Error(
        "MetaCanon runtime unavailable. Cannot end deliberation."
      );
    }

    const dissolutionReason = reason || "Deliberation concluded.";
    const result = this.client.dissolveSubSphere(sphereId, dissolutionReason);

    // Remove from local tracking
    this.deliberations.delete(sphereId);

    return result;
  }

  /**
   * Send a message to an agent bound to a sphere (if supported)
   *
   * @param {string} agentId - ID of the agent
   * @param {string} message - Message content
   * @param {string} [platform="in-app"] - Platform (telegram, discord, in-app)
   * @returns {Promise<Object>} Send result
   *
   * @example
   * await coordinator.sendAgentMessage(agentId, "Please elaborate on this point");
   */
  async sendAgentMessage(agentId, message, platform = "in-app") {
    if (!this.isRuntimeAvailable()) {
      throw new Error(
        "MetaCanon runtime unavailable. Cannot send agent message."
      );
    }

    return this.client.sendAgentMessage(platform, agentId, message);
  }
}

/**
 * Create a singleton instance of the Sphere Thread Coordinator
 * @type {SphereThreadCoordinator|null}
 */
let coordinatorInstance = null;

/**
 * Get or create the Sphere Thread Coordinator singleton
 *
 * @param {Object} [options] - Configuration options
 * @returns {SphereThreadCoordinator} Coordinator instance
 *
 * @example
 * const coordinator = getSphereThreadCoordinator();
 * const sphere = await coordinator.createDeliberationSphere("topic", ["agent1"]);
 */
function getSphereThreadCoordinator(options = {}) {
  if (!coordinatorInstance) {
    coordinatorInstance = new SphereThreadCoordinator(options);
  }
  return coordinatorInstance;
}

// Module exports
module.exports = {
  SphereThreadCoordinator,
  getSphereThreadCoordinator,
};
