/**
 * PrismAI Worker Host (P1-006)
 *
 * Main-thread Worker lifecycle manager. Creates and manages Worker Thread
 * instances for isolated plugin execution. Handles spawn, execute, terminate,
 * and crash recovery with automatic restart up to MAX_CRASHES.
 *
 * Timeout Strategy C:
 *   1. On timeout: reject the caller's Promise immediately.
 *   2. Mark Worker as "overrun" (NOT dead — execution continues in background).
 *   3. Start a grace timer at 2× the original timeout.
 *   4. If the Worker responds during grace: log "Late completion" and mark idle.
 *   5. If grace expires without a response: terminate the Worker, increment
 *      crashCount, and respawn if under MAX_CRASHES.
 */

const { Worker } = require("worker_threads");
const path = require("path");
const crypto = require("crypto");
const { PLUGIN_STATES, PrismAIPluginRegistry } = require("./registry");

const MAX_CRASHES = 3;
const DEFAULT_TIMEOUT = 30000;
const SPAWN_TIMEOUT = 5000;

// ── UUID generation with fallback ──────────────────────────────────────────

let _uuidCounter = 0;

function generateRequestId() {
  try {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to counter-based
  }
  _uuidCounter += 1;
  return `req_${Date.now()}_${_uuidCounter}`;
}

// ── Worker states ──────────────────────────────────────────────────────────

const WORKER_STATES = Object.freeze({
  NOT_SPAWNED: "NOT_SPAWNED",
  SPAWNING: "SPAWNING",
  IDLE: "IDLE",
  EXECUTING: "EXECUTING",
  OVERRUN: "OVERRUN", // Timed out but still executing in background
  TERMINATED: "TERMINATED",
  CRASHED: "CRASHED",
  DEGRADED: "DEGRADED",
});

// ── WorkerHost class ───────────────────────────────────────────────────────

class WorkerHost {
  /**
   * @param {string} pluginId - Plugin identifier
   * @param {string} handlerPath - Absolute path to the handler module
   */
  constructor(pluginId, handlerPath) {
    this._pluginId = pluginId;
    this._handlerPath = handlerPath;
    this._state = WORKER_STATES.NOT_SPAWNED;
    this._crashCount = 0;
    this._pendingRequests = new Map(); // Map<requestId, PendingRequest>
    this._overrunRequests = new Map(); // Map<requestId, OverrunEntry>
    this._spawnPromise = null;
    this._worker = null;
    this._runnerPath = path.join(__dirname, "worker-runner.js");
  }

  /**
   * Spawn a Worker Thread and wait for its "ready" signal.
   * Concurrent-spawn safe: if spawn is already in progress, returns the
   * existing promise instead of creating a second Worker.
   *
   * @returns {Promise<void>}
   */
  async spawn() {
    // If already spawning, coalesce to the existing promise
    if (this._spawnPromise !== null) {
      return this._spawnPromise;
    }

    // Allowed source states: NOT_SPAWNED, TERMINATED, CRASHED
    if (
      this._state !== WORKER_STATES.NOT_SPAWNED &&
      this._state !== WORKER_STATES.TERMINATED &&
      this._state !== WORKER_STATES.CRASHED
    ) {
      if (
        this._state === WORKER_STATES.IDLE ||
        this._state === WORKER_STATES.EXECUTING ||
        this._state === WORKER_STATES.OVERRUN
      ) {
        return; // Already running
      }
      throw new Error(
        `WorkerHost[${this._pluginId}]: cannot spawn from state ${this._state}`
      );
    }

    this._state = WORKER_STATES.SPAWNING;

    this._spawnPromise = new Promise((resolve, reject) => {
      let timeoutHandle = null;

      // Create the Worker Thread
      try {
        this._worker = new Worker(this._runnerPath, {
          workerData: { handlerPath: this._handlerPath },
        });
      } catch (err) {
        this._state = WORKER_STATES.CRASHED;
        this._spawnPromise = null;
        reject(
          new Error(
            `WorkerHost[${this._pluginId}]: failed to create Worker: ${err.message}`
          )
        );
        return;
      }

      // Spawn timeout — Worker must send "ready" within SPAWN_TIMEOUT ms
      timeoutHandle = setTimeout(() => {
        this._state = WORKER_STATES.NOT_SPAWNED;
        this._spawnPromise = null;
        try {
          this._worker.removeAllListeners();
          this._worker.terminate();
        } catch {
          // ignore
        }
        this._worker = null;
        reject(
          new Error(
            `WorkerHost[${this._pluginId}]: spawn timed out after ${SPAWN_TIMEOUT}ms`
          )
        );
      }, SPAWN_TIMEOUT);

      // One-shot "ready" listener used only during spawn
      const onSpawnMessage = (msg) => {
        if (!msg || !msg.action) return;

        if (msg.action === "ready") {
          clearTimeout(timeoutHandle);
          this._state = WORKER_STATES.IDLE;
          this._spawnPromise = null;

          // Remove spawn-time listener and attach persistent runtime listeners
          this._worker.removeListener("message", onSpawnMessage);
          this._worker.on("message", (m) => this._onMessage(m));
          this._worker.on("error", (e) => this._onError(e));
          this._worker.on("exit", (code) => this._onExit(code));

          resolve();
        } else if (msg.action === "error") {
          clearTimeout(timeoutHandle);
          this._state = WORKER_STATES.NOT_SPAWNED;
          this._spawnPromise = null;
          this._worker.removeAllListeners();
          reject(
            new Error(
              `WorkerHost[${this._pluginId}]: handler load failed: ${msg.error}`
            )
          );
        }
      };

      this._worker.on("message", onSpawnMessage);

      // Handle early exit during spawn (before "ready" or "error" message)
      this._worker.once("exit", (code) => {
        if (this._state === WORKER_STATES.SPAWNING) {
          clearTimeout(timeoutHandle);
          this._state = WORKER_STATES.NOT_SPAWNED;
          this._spawnPromise = null;
          this._worker.removeAllListeners();
          reject(
            new Error(
              `WorkerHost[${this._pluginId}]: worker exited during spawn with code ${code}`
            )
          );
        }
      });
    });

    return this._spawnPromise;
  }

  /**
   * Send an execute message to the Worker and await the correlated response.
   *
   * Implements Timeout Strategy C:
   *   - On primary timeout: reject the caller, mark Worker "OVERRUN", start grace timer.
   *   - On late response within grace: log, clear grace timer, transition back to IDLE.
   *   - On grace expiry: terminate Worker, treat as crash (increment crashCount, respawn or DEGRADE).
   *
   * @param {string} toolName - Name of the tool function to call
   * @param {object} args - Arguments to pass to the tool
   * @param {number} [timeout=DEFAULT_TIMEOUT] - Primary timeout in milliseconds
   * @returns {Promise<{ success: boolean, result?: any, error?: string }>}
   */
  async execute(toolName, args, timeout = DEFAULT_TIMEOUT) {
    if (
      this._state !== WORKER_STATES.IDLE &&
      this._state !== WORKER_STATES.EXECUTING &&
      this._state !== WORKER_STATES.OVERRUN
    ) {
      throw new Error(
        `WorkerHost[${this._pluginId}]: cannot execute from state ${this._state}`
      );
    }

    const requestId = generateRequestId();
    const effectiveTimeout = timeout || DEFAULT_TIMEOUT;
    const graceTimeout = effectiveTimeout * 2;

    // Transition to EXECUTING (unless already in OVERRUN which is a superset)
    if (this._state === WORKER_STATES.IDLE) {
      this._state = WORKER_STATES.EXECUTING;
    }

    return new Promise((resolve, reject) => {
      // Primary timeout timer
      const primaryTimer = setTimeout(() => {
        if (!this._pendingRequests.has(requestId)) return;

        const pending = this._pendingRequests.get(requestId);
        this._pendingRequests.delete(requestId);

        console.warn(
          `WorkerHost[${this._pluginId}]: tool "${toolName}" timed out after ${effectiveTimeout}ms. ` +
            `Worker continues in background (OVERRUN). Grace period: ${graceTimeout}ms.`
        );

        // Mark Worker as OVERRUN — it is still running
        this._state = WORKER_STATES.OVERRUN;

        // Reject the caller immediately
        reject(
          new Error(
            `WorkerHost[${this._pluginId}]: execute "${toolName}" timed out after ${effectiveTimeout}ms`
          )
        );

        // Register in overrun tracking BEFORE starting the grace timer so that
        // _onMessage's late-response path can clear it even if the timer fires
        // before execution returns here (micro-task ordering).
        this._overrunRequests.set(requestId, {
          toolName,
          startMs: pending.startMs,
          timeoutMs: effectiveTimeout,
          graceTimer: null, // patched in below after timer creation
        });

        // Start grace timer — if Worker responds within grace, log it and recover
        const graceTimer = setTimeout(() => {
          // Grace period expired and no late response was received
          if (this._overrunRequests.has(requestId)) {
            this._overrunRequests.delete(requestId);
            console.error(
              `WorkerHost[${this._pluginId}]: tool "${toolName}" did not complete within grace period ` +
                `(${graceTimeout}ms). Terminating Worker.`
            );
            this._terminateAndCrash(
              `grace period expired for "${toolName}" (limit: ${graceTimeout}ms)`
            );
          }
        }, graceTimeout);

        // Patch the timer handle into the already-registered entry
        const overrunEntry = this._overrunRequests.get(requestId);
        if (overrunEntry) {
          overrunEntry.graceTimer = graceTimer;
        }
      }, effectiveTimeout);

      this._pendingRequests.set(requestId, {
        resolve,
        reject,
        primaryTimer,
        startMs: Date.now(),
        toolName,
      });

      // Send the execute message to the Worker Thread
      try {
        this._worker.postMessage({
          action: "execute",
          requestId,
          tool: toolName,
          args,
        });
      } catch (err) {
        clearTimeout(primaryTimer);
        this._pendingRequests.delete(requestId);
        if (
          this._pendingRequests.size === 0 &&
          this._state === WORKER_STATES.EXECUTING
        ) {
          this._state = WORKER_STATES.IDLE;
        }
        reject(
          new Error(
            `WorkerHost[${this._pluginId}]: failed to post message: ${err.message}`
          )
        );
      }
    });
  }

  /**
   * Terminate the Worker Thread gracefully. Rejects all pending requests.
   */
  terminate() {
    if (
      this._state === WORKER_STATES.TERMINATED ||
      this._state === WORKER_STATES.NOT_SPAWNED
    ) {
      return;
    }

    this._state = WORKER_STATES.TERMINATED;
    this._rejectAllPending(`WorkerHost[${this._pluginId}]: worker terminated`);
    this._clearAllOverrun();

    if (this._worker) {
      try {
        this._worker.postMessage({ action: "terminate" });
      } catch {
        // Worker may already be dead
      }
      try {
        this._worker.terminate();
      } catch {
        // ignore
      }
      this._worker.removeAllListeners();
      this._worker = null;
    }
  }

  /**
   * @returns {string} Current worker state
   */
  getState() {
    return this._state;
  }

  /**
   * @returns {number} Total crash count
   */
  getCrashCount() {
    return this._crashCount;
  }

  /**
   * @returns {boolean} True if worker can accept new execute() calls
   */
  isRunning() {
    return (
      this._state === WORKER_STATES.IDLE ||
      this._state === WORKER_STATES.EXECUTING ||
      this._state === WORKER_STATES.OVERRUN
    );
  }

  // ── Internal handlers ──────────────────────────────────────────────────

  /**
   * Handle messages from the Worker Thread.
   *
   * Handles both normal responses (requestId in _pendingRequests) and
   * late responses from OVERRUN workers (requestId in _overrunRequests).
   *
   * @param {object} msg
   */
  _onMessage(msg) {
    if (!msg || !msg.requestId) return;

    const { requestId } = msg;

    // ── Normal response path ───────────────────────────────────────────
    const pending = this._pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.primaryTimer);
      this._pendingRequests.delete(requestId);

      if (
        this._pendingRequests.size === 0 &&
        this._state === WORKER_STATES.EXECUTING
      ) {
        this._state = WORKER_STATES.IDLE;
      }

      pending.resolve({
        success: msg.success,
        result: msg.result,
        error: msg.error,
      });
      return;
    }

    // ── Late response path (Strategy C — OVERRUN recovery) ────────────
    const overrun = this._overrunRequests.get(requestId);
    if (overrun) {
      clearTimeout(overrun.graceTimer);
      this._overrunRequests.delete(requestId);

      const elapsedMs = Date.now() - overrun.startMs;
      console.warn(
        `WorkerHost[${this._pluginId}]: Late completion for "${overrun.toolName}" ` +
          `(took ${elapsedMs}ms, limit was ${overrun.timeoutMs}ms). ` +
          `Result ${msg.success ? "received" : "errored"} — discarding (caller already rejected).`
      );

      // If no more pending or overrun requests, transition Worker back to IDLE
      if (
        this._overrunRequests.size === 0 &&
        this._pendingRequests.size === 0 &&
        this._state === WORKER_STATES.OVERRUN
      ) {
        this._state = WORKER_STATES.IDLE;
      }

      return;
    }

    // ── Orphaned response (requestId unknown) ─────────────────────────
    console.warn(
      `WorkerHost[${this._pluginId}]: orphaned response for requestId "${requestId}" — discarding.`
    );
  }

  /**
   * Handle Worker error events.
   * @param {Error} err
   */
  _onError(err) {
    if (
      this._state === WORKER_STATES.TERMINATED ||
      this._state === WORKER_STATES.DEGRADED ||
      this._state === WORKER_STATES.CRASHED ||
      this._state === WORKER_STATES.SPAWNING
    ) {
      return;
    }
    console.error(
      `WorkerHost[${this._pluginId}]: worker error: ${err.message}`
    );
    this._rejectAllPending(
      `WorkerHost[${this._pluginId}]: worker error: ${err.message}`
    );
    this._clearAllOverrun();
    this._state = WORKER_STATES.CRASHED;
    this._handleCrash();
  }

  /**
   * Handle Worker exit events.
   * @param {number} code
   */
  _onExit(code) {
    if (
      this._state === WORKER_STATES.TERMINATED ||
      this._state === WORKER_STATES.DEGRADED ||
      this._state === WORKER_STATES.SPAWNING ||
      this._state === WORKER_STATES.CRASHED
    ) {
      return;
    }

    if (code !== 0) {
      console.warn(
        `WorkerHost[${this._pluginId}]: worker exited with code ${code}`
      );
      this._rejectAllPending(
        `WorkerHost[${this._pluginId}]: worker exited with code ${code}`
      );
      this._clearAllOverrun();
      this._state = WORKER_STATES.CRASHED;
      this._worker = null;
      this._handleCrash();
    } else {
      // Clean exit (code 0) — terminate() was called or the runner processed
      // a "terminate" message. Treat as intentional shutdown.
      this._state = WORKER_STATES.TERMINATED;
      this._worker = null;
    }
  }

  /**
   * Handle crash recovery. Auto-restarts while crashCount < MAX_CRASHES.
   *
   * Crash budget (MAX_CRASHES = 3):
   *   crash 1 → crashCount=1 → 1 < 3 → restart
   *   crash 2 → crashCount=2 → 2 < 3 → restart
   *   crash 3 → crashCount=3 → 3 < 3 is FALSE → DEGRADED (no more restarts)
   *
   * The `<` (not `<=`) comparison means the third crash permanently degrades
   * the worker. Adjust MAX_CRASHES to allow more retries.
   */
  _handleCrash() {
    this._crashCount += 1;

    if (this._crashCount < MAX_CRASHES) {
      console.log(
        `WorkerHost[${this._pluginId}]: crash ${this._crashCount}/${MAX_CRASHES}, auto-restarting...`
      );
      this._state = WORKER_STATES.NOT_SPAWNED;
      this.spawn().catch((err) => {
        console.error(
          `WorkerHost[${this._pluginId}]: auto-restart failed: ${err.message}`
        );
      });
    } else {
      console.error(
        `WorkerHost[${this._pluginId}]: reached MAX_CRASHES (${MAX_CRASHES}), marking DEGRADED`
      );
      this._state = WORKER_STATES.DEGRADED;
      try {
        PrismAIPluginRegistry.setPluginState(
          this._pluginId,
          PLUGIN_STATES.DEGRADED
        );
      } catch (regErr) {
        console.error(
          `WorkerHost[${this._pluginId}]: failed to set registry DEGRADED state: ${regErr.message}`
        );
      }
    }
  }

  /**
   * Terminate the Worker and immediately treat it as a crash.
   * Used when the grace period expires on an OVERRUN worker.
   *
   * @param {string} reason
   */
  _terminateAndCrash(reason) {
    console.error(
      `WorkerHost[${this._pluginId}]: force-terminating worker: ${reason}`
    );

    if (this._worker) {
      try {
        this._worker.removeAllListeners();
        this._worker.terminate();
      } catch {
        // ignore
      }
      this._worker = null;
    }

    this._rejectAllPending(
      `WorkerHost[${this._pluginId}]: worker force-terminated: ${reason}`
    );
    this._clearAllOverrun();
    this._state = WORKER_STATES.CRASHED;
    this._handleCrash();
  }

  /**
   * Reject all pending requests with an error message and clear timers.
   * @param {string} errorMessage
   */
  _rejectAllPending(errorMessage) {
    for (const [, pending] of this._pendingRequests) {
      clearTimeout(pending.primaryTimer);
      pending.reject(new Error(errorMessage));
    }
    this._pendingRequests.clear();
  }

  /**
   * Cancel all overrun grace timers and clear the overrun map.
   */
  _clearAllOverrun() {
    for (const [, overrun] of this._overrunRequests) {
      clearTimeout(overrun.graceTimer);
    }
    this._overrunRequests.clear();
  }
}

// ── Singleton pool ─────────────────────────────────────────────────────────

/** @type {Map<string, WorkerHost>} */
const WORKER_POOL = new Map();

/**
 * Get an existing WorkerHost from the pool, or create a new one.
 *
 * @param {string} pluginId
 * @param {string} handlerPath - Absolute path to the handler module
 * @returns {WorkerHost}
 */
function getWorkerHost(pluginId, handlerPath) {
  let host = WORKER_POOL.get(pluginId);
  if (host) return host;

  host = new WorkerHost(pluginId, handlerPath);
  WORKER_POOL.set(pluginId, host);
  return host;
}

/**
 * Terminate all workers in the pool and clear it.
 * For use during server shutdown or test cleanup.
 */
function terminateAll() {
  for (const [, host] of WORKER_POOL) {
    try {
      host.terminate();
    } catch {
      // Best-effort
    }
  }
  WORKER_POOL.clear();
}

module.exports = {
  WorkerHost,
  WORKER_POOL,
  getWorkerHost,
  terminateAll,
  MAX_CRASHES,
  DEFAULT_TIMEOUT,
  SPAWN_TIMEOUT,
};
