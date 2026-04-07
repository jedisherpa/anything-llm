/**
 * PrismAI Enforcement Wrapper (P1-008)
 *
 * Main-thread validation and dispatch layer. For every plugin tool call:
 *   1. Validates the action through the MetaCanon FFI bridge (when available).
 *   2. Validates tool input arguments against the declared JSON Schema (via ajv).
 *   3. Dispatches execution to the plugin Worker Thread.
 *   4. Normalizes the Worker result to a string (Aibitat contract).
 *
 * Fails open: if the FFI bridge is unavailable or errors, the call proceeds.
 * The createEnforcedHandler() function NEVER throws — all errors returned as strings.
 */

const Ajv = require("ajv");
const { PrismAIPluginRegistry } = require("./registry");
const { getWorkerHost, DEFAULT_TIMEOUT } = require("./worker-host");
const path = require("path");

// ── Lazy bridge loading ────────────────────────────────────────────────────
// bridge.js loads native Rust bindings that may not be available in all
// environments. We lazy-load the module once (module-level cache) and cache
// the result (null if unavailable), but we do NOT permanently cache the
// runtime-availability boolean. bridge.js already maintains its own Map-based
// availability cache so calling isRuntimeAvailable() is a cheap synchronous
// lookup — no native call on repeat invocations.

let _bridge = null;
let _bridgeChecked = false;

// ── Lazy HITL bridge loading ───────────────────────────────────────────────
// hitl-bridge.js depends on the MetaCanon runtime (SphereThreadCoordinator).
// Lazy-load here to avoid circular dependency issues and to allow the
// enforcement-wrapper to function in test environments without the HITL bridge.

let _hitlBridge = null;
let _hitlBridgeChecked = false;

function _loadHitlBridge() {
  if (_hitlBridgeChecked) return _hitlBridge;
  _hitlBridgeChecked = true;
  try {
    _hitlBridge = require("./hitl-bridge");
  } catch {
    _hitlBridge = null;
  }
  return _hitlBridge;
}

function _loadBridge() {
  if (_bridgeChecked) return _bridge;
  _bridgeChecked = true;
  try {
    _bridge = require("../metacanon-runtime/bridge");
  } catch {
    _bridge = null;
  }
  return _bridge;
}

/**
 * Returns true if the MetaCanon FFI runtime is currently available.
 * Delegates to bridge.isRuntimeAvailable() which is a cached Map lookup.
 * Called on every validateAction() invocation — no permanent boolean cache
 * here so that a late-loading bridge (e.g. hot-reloaded in tests) is picked up.
 *
 * @returns {boolean}
 */
function _isFfiAvailable() {
  const bridge = _loadBridge();
  return (
    bridge !== null &&
    typeof bridge.isRuntimeAvailable === "function" &&
    bridge.isRuntimeAvailable()
  );
}

// ── EnforcementWrapper class ───────────────────────────────────────────────

class EnforcementWrapper {
  /**
   * @param {object|null} client - Optional MetaCanonClient instance (for testing).
   *   If null, the client is obtained lazily from the bridge on first FFI call.
   */
  constructor(client) {
    this._client = client || null;
    this._ajv = new Ajv({
      allErrors: true, // Report all errors, not just the first
      strict: false, // Allow JSON Schema features beyond strict mode
      validateFormats: false, // Don't validate "format" strings (avoids ajv-formats dep)
    });
  }

  /**
   * Validate an action through the MetaCanon FFI bridge.
   * Fails open: if FFI is unavailable or errors, returns permitted with a flag.
   *
   * @param {string} pluginId
   * @param {string} toolName
   * @param {object} context
   * @returns {Promise<{ permitted: boolean, alignment_score: number, flags: string[] }>}
   */
  async validateAction(pluginId, toolName, context) {
    try {
      // Check FFI availability on every call. _isFfiAvailable() delegates to
      // bridge.isRuntimeAvailable() which is an O(1) Map lookup — no native
      // cost on repeat calls. Avoid a permanent boolean cache here so that a
      // bridge that becomes available after first call (e.g. in tests) is
      // picked up correctly.
      if (!_isFfiAvailable()) {
        return {
          permitted: true,
          alignment_score: 1.0,
          flags: ["ffi_unavailable"],
        };
      }

      // Obtain the client lazily (cached on the instance after first call)
      if (this._client === null) {
        const bridge = _loadBridge();
        this._client = bridge.getMetaCanonClient();
      }

      if (
        !this._client ||
        typeof this._client.validateActionWithContext !== "function"
      ) {
        return {
          permitted: true,
          alignment_score: 1.0,
          flags: ["ffi_no_validate_method"],
        };
      }

      const action = {
        type: "plugin_tool_call",
        plugin: pluginId,
        tool: toolName,
        context,
      };
      const soulFile = {}; // Phase 2 will supply the real soul file

      // validateActionWithContext is a synchronous Rust FFI call (N-API).
      // Wrapping it in setImmediate yields the event loop before the blocking
      // call executes, preventing starvation of other queued I/O callbacks.
      // This is a v1 mitigation: the FFI still blocks for its own duration.
      // Phase 2 improvement: move the FFI call into a dedicated Worker Thread
      // so it runs truly off the main thread (see architecture note in P1-008).
      const client = this._client;
      const result = await new Promise((res) =>
        setImmediate(() =>
          res(client.validateActionWithContext(action, soulFile))
        )
      );

      return {
        permitted: result.permitted,
        alignment_score: result.alignment_score,
        flags: result.flags || [],
      };
    } catch (err) {
      // Fail open — FFI errors do not block plugin execution
      return {
        permitted: true,
        alignment_score: 1.0,
        flags: [`ffi_error: ${err.message}`],
      };
    }
  }

  /**
   * Validate tool input arguments against the declared JSON Schema.
   * Uses ajv@8.x for full JSON Schema draft-07 validation.
   * Fails open: if schema compilation fails (bad schema from plugin author), proceeds.
   *
   * @param {object} args - The arguments to validate
   * @param {object|null|undefined} schema - JSON Schema definition
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validateInput(args, schema) {
    if (!schema || typeof schema !== "object") {
      return { valid: true, errors: [] }; // No schema — fail-open
    }

    try {
      const validate = this._ajv.compile(schema);
      const valid = validate(args || {});

      if (valid) {
        return { valid: true, errors: [] };
      }

      const errors = (validate.errors || []).map(
        (e) => `${e.instancePath || "root"}: ${e.message}`
      );
      return { valid: false, errors };
    } catch (compileErr) {
      // Malformed schema from plugin author — fail-open, log warning
      console.warn(
        `EnforcementWrapper: failed to compile schema for validation: ${compileErr.message}. Proceeding.`
      );
      return { valid: true, errors: [] };
    }
  }

  /**
   * Execute a tool via Worker Thread. Looks up the plugin, gets or creates
   * a WorkerHost, spawns if not running, and dispatches execution.
   *
   * @param {string} pluginId
   * @param {string} toolName
   * @param {object} args
   * @param {number} [timeout=DEFAULT_TIMEOUT]
   * @returns {Promise<{ success: boolean, result?: any, error?: string }>}
   */
  async executeViaWorker(pluginId, toolName, args, timeout = DEFAULT_TIMEOUT) {
    const plugin = PrismAIPluginRegistry.getPluginById(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: "${pluginId}"`);
    }

    // Re-validate at execution time that the resolved handler path stays within
    // the plugin's own directory. This catches any dynamic manifest mutation or
    // path-traversal attempts that slipped past manifest-validator at load time.
    const pluginDir = path.resolve(plugin.pluginDir);
    const handlerPath = path.resolve(
      pluginDir,
      plugin.manifest.runtime.entrypoint
    );
    if (!handlerPath.startsWith(pluginDir + path.sep)) {
      throw new Error(
        `Plugin "${pluginId}" handler path escapes plugin directory.`
      );
    }

    const host = getWorkerHost(pluginId, handlerPath);

    if (!host.isRunning()) {
      await host.spawn();
    }

    return host.execute(toolName, args, timeout);
  }

  /**
   * Convert any Worker result value to a string suitable for agent consumption.
   * The Aibitat contract requires all handler return values to be strings.
   *
   * @param {*} result
   * @returns {string}
   */
  normalizeOutput(result) {
    if (result === null || result === undefined) return "";
    if (typeof result === "string") return result;
    if (typeof result === "object" || Array.isArray(result)) {
      try {
        return JSON.stringify(result);
      } catch {
        return String(result);
      }
    }
    return String(result);
  }
}

// ── Singleton getter ───────────────────────────────────────────────────────

let _sharedWrapper = null;

/**
 * Get or create the shared EnforcementWrapper singleton.
 *
 * @param {object|null} [client] - Optional MetaCanonClient (for testing).
 * @returns {EnforcementWrapper}
 */
function getEnforcementWrapper(client) {
  // If called with an explicit client (e.g. in tests), return a dedicated instance
  if (client !== undefined && client !== null) {
    return new EnforcementWrapper(client);
  }
  if (!_sharedWrapper) {
    _sharedWrapper = new EnforcementWrapper(null);
  }
  return _sharedWrapper;
}

// ── createEnforcedHandler ──────────────────────────────────────────────────

/**
 * Create an enforced handler function for a specific plugin tool.
 * Returns an async function that:
 *   1. Validates the action via FFI (graceful degradation if unavailable)
 *   2. Validates input against the tool's JSON Schema (via ajv)
 *   3. Dispatches to the plugin's Worker Thread
 *   4. Normalizes output to string
 *   5. NEVER throws — all errors are caught and returned as error strings
 *
 * The returned function is registered as the Aibitat handler in Sprint 3.
 * Aibitat calls it with `this` bound to an object containing `this.super`
 * (the Aibitat instance) for introspect() calls.
 *
 * @param {string} pluginId
 * @param {string} toolName
 * @param {object} toolConfig - Tool definition from manifest (has .parameters, .timeout)
 * @param {object|null} aibitat - Aibitat instance (used for introspect calls)
 * @returns {Function} async function(args): string
 */
function createEnforcedHandler(pluginId, toolName, toolConfig, _aibitat) {
  const wrapper = getEnforcementWrapper();

  // Pre-resolve timeout at handler creation time:
  //   1. Per-tool timeout (toolConfig.timeout)
  //   2. Per-plugin timeout from registry (manifest.runtime.timeout)
  //   3. Default timeout (DEFAULT_TIMEOUT)
  // The per-plugin timeout is resolved lazily at call time because the plugin
  // may not be in the registry when createEnforcedHandler is called.

  const parameterSchema = toolConfig ? toolConfig.parameters : null;

  return async function enforcedHandler(args) {
    // Aibitat binds `this` to a context object containing `this.super`.
    // Arrow functions capture the lexical `this` of the enclosing scope
    // (createEnforcedHandler's scope), which is NOT the Aibitat context.
    // Capture the correct `this` explicitly at the top of the regular function.
    const boundThis = this;

    // Resolve timeout with precedence: tool > plugin runtime > default
    let timeout = DEFAULT_TIMEOUT;
    if (toolConfig && toolConfig.timeout) {
      timeout = toolConfig.timeout;
    } else {
      try {
        const plugin = PrismAIPluginRegistry.getPluginById(pluginId);
        if (
          plugin &&
          plugin.manifest &&
          plugin.manifest.runtime &&
          plugin.manifest.runtime.timeout
        ) {
          timeout = plugin.manifest.runtime.timeout;
        }
      } catch {
        // If registry lookup fails, use default timeout
      }
    }

    // Helper: safely call introspect if Aibitat context is available.
    // Uses boundThis (the Aibitat-provided context) rather than a bare `this`
    // reference, which would resolve to the lexical outer scope inside an
    // arrow function and produce the wrong receiver.
    const introspect = (msg) => {
      try {
        if (
          boundThis &&
          boundThis.super &&
          typeof boundThis.super.introspect === "function"
        ) {
          boundThis.super.introspect(msg);
        }
      } catch {
        // introspect failures must not surface to callers
      }
    };

    try {
      // Step 1: FFI enforcement (fail-open if unavailable)
      const enforcement = await wrapper.validateAction(pluginId, toolName, {
        args,
      });

      if (!enforcement.permitted) {
        introspect(
          `PrismAI plugin ${pluginId}.${toolName}: Action blocked by governance (score: ${enforcement.alignment_score})`
        );
        return `Action blocked by governance: alignment score ${enforcement.alignment_score}`;
      }

      if (enforcement.flags && enforcement.flags.length > 0) {
        introspect(
          `PrismAI plugin ${pluginId}.${toolName}: Enforcement flags: ${enforcement.flags.join(", ")}`
        );
      }

      // Step 1.5: HITL gate (fail-CLOSED if required)
      // Triggered when the tool manifest declares hitl:true, or when the FFI
      // runtime flags this specific invocation as requiring human approval.
      // Unlike FFI validation (which fails open), HITL is fail-CLOSED: if the
      // gate cannot be satisfied, execution does not proceed.
      const needsHitl =
        (toolConfig && toolConfig.hitl === true) ||
        (enforcement.flags &&
          enforcement.flags.includes("requires_human_approval"));

      if (needsHitl) {
        const hitlBridge = _loadHitlBridge();
        if (!hitlBridge) {
          return "HITL gate required but hitl-bridge module unavailable. Cannot proceed.";
        }
        try {
          const hitlResult = await hitlBridge.requestApproval(
            pluginId,
            toolName,
            args,
            {
              alignment_score: enforcement.alignment_score,
              flags: enforcement.flags,
            }
          );
          if (!hitlResult.approved) {
            introspect(
              `PrismAI plugin ${pluginId}.${toolName}: Action rejected by human (${hitlResult.reason || "no reason given"})`
            );
            return `Action rejected by human: ${hitlResult.reason || "No reason provided"}`;
          }
          introspect(
            `PrismAI plugin ${pluginId}.${toolName}: HITL approval received`
          );
        } catch (hitlErr) {
          // HITL is fail-CLOSED: errors block execution, not pass-through
          introspect(
            `PrismAI plugin ${pluginId}.${toolName}: HITL gate error: ${hitlErr.message}`
          );
          return `HITL gate error: ${hitlErr.message}`;
        }
      }

      // Step 2: Input validation (ajv-based)
      const inputValidation = wrapper.validateInput(args, parameterSchema);
      if (!inputValidation.valid) {
        return `Invalid input for ${pluginId}.${toolName}: ${inputValidation.errors.join("; ")}`;
      }

      // Step 3: Dispatch to Worker Thread
      introspect(`Executing PrismAI plugin: ${pluginId}.${toolName}`);

      const workerResult = await wrapper.executeViaWorker(
        pluginId,
        toolName,
        args,
        timeout
      );

      // Step 4: Handle Worker result
      if (!workerResult.success) {
        introspect(
          `PrismAI plugin ${pluginId}.${toolName} failed: ${workerResult.error}`
        );
        return `Plugin error: ${workerResult.error}`;
      }

      // Step 5: Normalize output to string
      introspect(`PrismAI plugin ${pluginId}.${toolName} completed`);
      return wrapper.normalizeOutput(workerResult.result);
    } catch (err) {
      // Error boundary: never throw, always return error string
      return `PrismAI plugin ${pluginId}.${toolName} error: ${err.message}`;
    }
  };
}

module.exports = {
  createEnforcedHandler,
  getEnforcementWrapper,
  EnforcementWrapper,
};
