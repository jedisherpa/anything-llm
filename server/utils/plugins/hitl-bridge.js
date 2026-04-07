/**
 * PrismAI HITL Bridge (P2-003)
 *
 * Human-In-The-Loop approval gate for plugin tool calls. Wraps the
 * SphereThreadCoordinator to create deliberation spheres, submit pending
 * actions, and poll for resolution before allowing tool execution.
 *
 * Design principles:
 * - Fail-CLOSED: tools declaring hitl:true cannot execute without approval.
 *   If the MetaCanon runtime is unavailable, execution is blocked, not
 *   silently allowed. This is the opposite of FFI validation (which fails open).
 * - Per-plugin sub-sphere: a single sphere is reused across HITL requests
 *   for the same plugin to reduce sphere creation overhead.
 * - Polling at 2s intervals: simple, no WebSocket dependency, acceptable
 *   latency for a human-decision gate.
 * - Default timeout: 24 hours. Per-tool overrides honored via options param.
 *
 * Graceful degradation: when the runtime is unavailable the bridge throws an
 * error (fail-CLOSED). The enforcement-wrapper catches this and returns an
 * error string to the caller.
 */

const {
  getSphereThreadCoordinator,
} = require("../metacanon-runtime/sphere-thread");

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_POLL_INTERVAL_MS = 2000; // 2 seconds

// ── Per-plugin sphere tracking ───────────────────────────────────────────────

/**
 * Map from "{pluginId}.{toolName}" -> sphereId. Each tool gets its own
 * sphere, so requests for different tools within the same plugin are
 * deliberated in separate spheres.
 *
 * @type {Map<string, string>}
 */
const _pluginSpheres = new Map();

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Sleep for a given number of milliseconds without blocking the event loop.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get or create a sub-sphere for the given plugin + tool combination.
 * Reuses an existing sphere if one is already tracked for this
 * "{pluginId}.{toolName}" key. Each tool gets its own sphere.
 *
 * @param {SphereThreadCoordinator} coordinator
 * @param {string} pluginId
 * @param {string} toolName
 * @returns {Promise<string>} sphereId
 */
async function _getOrCreateSphere(coordinator, pluginId, toolName) {
  const sphereKey = `${pluginId}.${toolName}`;
  if (_pluginSpheres.has(sphereKey)) {
    return _pluginSpheres.get(sphereKey);
  }

  const topic = `Plugin HITL: ${pluginId}.${toolName}`;
  const sphere = await coordinator.createDeliberationSphere(
    topic,
    [], // no agents bound -- human-only decision
    true // hitlRequired
  );

  _pluginSpheres.set(sphereKey, sphere.sphereId);
  return sphere.sphereId;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Request human approval for a plugin tool call.
 *
 * Creates (or reuses) a sub-sphere for the plugin, submits the approval
 * request as a query, then polls for resolution using checkApprovalStatus.
 *
 * FAIL-CLOSED: throws if the MetaCanon runtime is unavailable.
 *
 * @param {string} pluginId   - Plugin requesting approval
 * @param {string} toolName   - Tool that triggered the gate
 * @param {object} args       - Arguments passed to the tool
 * @param {object} [context]  - Additional context (alignment_score, flags, etc.)
 * @param {object} [options]  - Optional overrides { timeoutMs, pollIntervalMs }
 * @returns {Promise<{ approved: boolean, requestId: string, reason?: string }>}
 * @throws {Error} If MetaCanon runtime is unavailable (fail-CLOSED)
 */
async function requestApproval(
  pluginId,
  toolName,
  args,
  context = {},
  options = {}
) {
  const coordinator = getSphereThreadCoordinator();

  if (!coordinator.isRuntimeAvailable()) {
    throw new Error(
      `HITL gate for ${pluginId}.${toolName} requires MetaCanon runtime, which is unavailable. ` +
        `Action cannot proceed without human approval.`
    );
  }

  const sphereId = await _getOrCreateSphere(coordinator, pluginId, toolName);

  // Build the approval request payload submitted as a sphere query.
  // The content of this query is what the human sees when reviewing.
  const requestPayload = {
    action: `${pluginId}.${toolName}`,
    args,
    requires_approval: true,
    context: {
      alignment_score: context.alignment_score ?? null,
      flags: context.flags ?? [],
      timestamp: new Date().toISOString(),
    },
  };

  let queryResult;
  try {
    queryResult = await coordinator.queryDeliberation(
      sphereId,
      JSON.stringify(requestPayload)
    );
  } catch {
    // If sphere was dissolved externally, clear tracking and retry once with a new sphere
    _pluginSpheres.delete(`${pluginId}.${toolName}`);
    const freshSphereId = await _getOrCreateSphere(
      coordinator,
      pluginId,
      toolName
    );
    queryResult = await coordinator.queryDeliberation(
      freshSphereId,
      JSON.stringify(requestPayload)
    );
  }

  const requestId = queryResult.queryId;

  // Poll until resolved, rejected, or timed out
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  const resolution = await checkApprovalStatus(sphereId, requestId, {
    timeoutMs,
    pollIntervalMs,
    coordinator,
  });

  // Prune the sphere entry once the action is resolved (approved, rejected,
  // or timed out). This prevents _pluginSpheres from accumulating stale
  // entries across the server session.
  _pluginSpheres.delete(`${pluginId}.${toolName}`);

  return {
    approved: resolution.approved,
    requestId,
    reason: resolution.reason,
  };
}

/**
 * Poll a deliberation sphere for the resolution of a pending action.
 *
 * Polls at `pollIntervalMs` intervals until the action is approved or
 * rejected, or until `timeoutMs` has elapsed. On timeout, auto-rejects
 * and returns { approved: false, reason: "HITL timeout after Xms" }.
 *
 * @param {string} sphereId           - Deliberation sphere ID
 * @param {string} pendingActionId    - Query/action ID to check
 * @param {object} [options]
 * @param {number} [options.timeoutMs=86400000]      - Max wait in ms
 * @param {number} [options.pollIntervalMs=2000]     - Poll interval in ms
 * @param {object} [options.coordinator]             - Coordinator override (for testing)
 * @returns {Promise<{ approved: boolean, reason?: string }>}
 */
async function checkApprovalStatus(sphereId, pendingActionId, options = {}) {
  const coordinator = options.coordinator || getSphereThreadCoordinator();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  const startTime = Date.now();

  while (true) {
    const elapsed = Date.now() - startTime;

    if (elapsed >= timeoutMs) {
      // Timeout: auto-reject (fail-CLOSED)
      try {
        await coordinator.resolveHitlAction(
          sphereId,
          pendingActionId,
          false,
          "HITL timeout"
        );
      } catch {
        // Best-effort rejection on timeout -- swallow errors
      }
      return {
        approved: false,
        reason: `HITL timeout after ${timeoutMs}ms`,
      };
    }

    // Check sphere status for this pending action
    try {
      // getSubSphereStatus is called directly on the coordinator's client,
      // which is the raw MetaCanon FFI client.
      if (
        coordinator.client &&
        typeof coordinator.client.getSubSphereStatus === "function"
      ) {
        const status = coordinator.client.getSubSphereStatus(sphereId);
        const pendingActions = status.pending_actions || [];
        const action = pendingActions.find((a) => a.id === pendingActionId);

        if (!action) {
          // Action is no longer in pending list. Check the resolved list first;
          // if it is not there either, treat disappearance without resolution as
          // failure. Treat disappearance without resolution as failure — fail-CLOSED.
          // The sphere may have moved the action to a completed state.
          const resolvedActions = status.resolved_actions || [];
          const resolved = resolvedActions.find(
            (a) => a.id === pendingActionId
          );

          if (resolved) {
            const wasApproved = resolved.status === "approved";
            return {
              approved: wasApproved,
              reason: resolved.reason || undefined,
            };
          }

          // Action disappeared without appearing in resolved list.
          // Treat as an error (fail-CLOSED).
          return {
            approved: false,
            reason: "Pending action disappeared from sphere without resolution",
          };
        }

        if (action.status === "approved") {
          return { approved: true };
        }

        if (action.status === "rejected") {
          return {
            approved: false,
            reason: action.reason || "Rejected by human",
          };
        }

        // Still pending -- fall through to sleep and retry
      } else {
        // Client does not support getSubSphereStatus -- cannot poll.
        // Fail-CLOSED: cannot verify approval state.
        return {
          approved: false,
          reason:
            "MetaCanon client does not support getSubSphereStatus -- cannot poll for HITL resolution",
        };
      }
    } catch (err) {
      // Polling error -- fail-CLOSED
      return {
        approved: false,
        reason: `HITL polling error: ${err.message}`,
      };
    }

    await _sleep(pollIntervalMs);
  }
}

/**
 * Wait for approval using the full requestApproval flow. This is the primary
 * entry point called by the enforcement-wrapper.
 *
 * Alias for requestApproval -- provided for clarity in caller code.
 *
 * @param {string} pluginId
 * @param {string} toolName
 * @param {object} args
 * @param {object} [context]
 * @param {object} [options]  - { timeoutMs, pollIntervalMs }
 * @returns {Promise<{ approved: boolean, requestId: string, reason?: string }>}
 */
async function waitForApproval(
  pluginId,
  toolName,
  args,
  context = {},
  options = {}
) {
  return requestApproval(pluginId, toolName, args, context, options);
}

/**
 * Clear the per-plugin sphere cache. Used in tests to reset state between runs.
 */
function _resetSphereCache() {
  _pluginSpheres.clear();
}

module.exports = {
  requestApproval,
  checkApprovalStatus,
  waitForApproval,
  _resetSphereCache,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_POLL_INTERVAL_MS,
};
