/**
 * PrismAI Worker Runner (P1-007)
 *
 * Runs INSIDE a Worker Thread. Loads a plugin handler module and
 * executes tool functions on demand, communicating results back
 * to the parent thread via postMessage.
 *
 * Message protocol (Worker → Main):
 *   Ready:   { action: "ready" }
 *   Error:   { action: "error", error: string }        (startup handler-load failure)
 *   Success: { requestId, success: true, result: any }
 *   Failure: { requestId, success: false, error: string }
 *
 * CRITICAL: This file must NOT import any FFI, registry, or agent modules.
 * Only worker_threads builtins and the handler module itself.
 */

const { parentPort, workerData } = require("worker_threads");

// ── Load handler ───────────────────────────────────────────────────────────

let handler = null;

try {
  const { handlerPath } = workerData;
  handler = require(handlerPath);
} catch (err) {
  if (parentPort) {
    parentPort.postMessage({
      action: "error",
      error: `Failed to load handler: ${err.message}`,
    });
  }
  process.exit(1);
}

// Signal ready
if (parentPort) {
  parentPort.postMessage({ action: "ready" });
}

// ── Message listener ───────────────────────────────────────────────────────

if (parentPort) {
  parentPort.on("message", async (msg) => {
    if (!msg || typeof msg !== "object") return;

    // ── Terminate ──────────────────────────────────────────────────────
    if (msg.action === "terminate") {
      process.exit(0);
    }

    // ── Execute ────────────────────────────────────────────────────────
    if (msg.action === "execute") {
      const { requestId, tool, args } = msg;

      // Verify handler exports the requested tool
      if (!handler || typeof handler[tool] !== "function") {
        parentPort.postMessage({
          requestId,
          success: false,
          error: `Handler does not export function "${tool}"`,
        });
        return;
      }

      try {
        const result = await handler[tool](args);

        // Attempt to post the result; handle DataCloneError for
        // non-serializable values (functions, symbols, circular refs, etc.)
        try {
          parentPort.postMessage({ requestId, success: true, result });
        } catch (cloneErr) {
          // DataCloneError — convert to string and try again
          if (
            cloneErr.name === "DataCloneError" ||
            cloneErr.message.includes("DataCloneError") ||
            cloneErr.message.includes("could not be cloned")
          ) {
            parentPort.postMessage({
              requestId,
              success: false,
              error: `Tool returned a non-serializable result (DataCloneError)`,
            });
          } else {
            // Some other postMessage error
            parentPort.postMessage({
              requestId,
              success: false,
              error: `Failed to send result: ${cloneErr.message}`,
            });
          }
        }
      } catch (execErr) {
        parentPort.postMessage({
          requestId,
          success: false,
          error: execErr.message || String(execErr),
        });
      }
    }
  });
}
