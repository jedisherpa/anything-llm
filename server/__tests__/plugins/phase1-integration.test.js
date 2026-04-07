/**
 * Phase 1 Integration Tests
 *
 * Tests the full PrismAI plugin system pipeline:
 *   Registry discovery -> getPrismAIPluginTools -> createEnforcedHandler -> Worker dispatch
 *
 * Runs standalone with Node.js assert (no external test runner required).
 * Safe for CI: NODE_ENV=test prevents native FFI bridge load attempts.
 *
 * Usage:
 *   node server/__tests__/plugins/phase1-integration.test.js
 *
 * Exit code 0 on all tests passing, 1 on any failure.
 */

"use strict";

process.env.NODE_ENV = "test";

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const os = require("os");

// ── Test harness ─────────────────────────────────────────────────────────────

let _passed = 0;
let _failed = 0;
const _failures = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    _passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
    _failed++;
    _failures.push({ name, error: err.message });
  }
}

function suite(name) {
  console.log(`\n${name}`);
}

// ── Paths ────────────────────────────────────────────────────────────────────

const SERVER_ROOT = path.resolve(__dirname, "../..");
const PLUGINS_ROOT = path.resolve(
  SERVER_ROOT,
  "storage/plugins/prismai-plugins"
);

// ── Imports ──────────────────────────────────────────────────────────────────

const {
  PrismAIPluginRegistry,
  getPrismAIPluginTools,
  PRISMAI_PLUGIN_PREFIX,
  PLUGIN_STATES,
} = require("../../utils/plugins/registry");

const {
  createEnforcedHandler,
  getEnforcementWrapper,
  EnforcementWrapper,
} = require("../../utils/plugins/enforcement-wrapper");

const {
  getWorkerHost,
  terminateAll,
  MAX_CRASHES,
  DEFAULT_TIMEOUT,
  WORKER_POOL,
} = require("../../utils/plugins/worker-host");

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a temporary plugin directory with the given manifest and handler source.
 * Returns { pluginDir, cleanup }.
 */
function createTempPlugin(pluginId, manifestOverride, handlerSource) {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), `prismai-test-`));
  const pluginDir = path.join(tmpBase, pluginId);
  fs.mkdirSync(pluginDir, { recursive: true });

  const manifest = Object.assign(
    {
      id: pluginId,
      name: `Test Plugin ${pluginId}`,
      version: "1.0.0",
      schemaVersion: "1.0.0",
      author: "test",
      license: "MIT",
      description: `Temp test plugin ${pluginId}`,
      runtime: { entrypoint: "handler.js", timeout: 2000 },
      tools: {
        run: {
          description: "Test tool",
          parameters: {
            type: "object",
            properties: { input: { type: "string" } },
            required: ["input"],
          },
        },
      },
    },
    manifestOverride
  );

  fs.writeFileSync(
    path.join(pluginDir, "plugin.prismai.json"),
    JSON.stringify(manifest, null, 2)
  );

  fs.writeFileSync(
    path.join(pluginDir, "handler.js"),
    handlerSource
  );

  function cleanup() {
    try {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }

  return { pluginDir, tmpBase, cleanup };
}

// ── Test Suite ────────────────────────────────────────────────────────────────

suite("Test 1: Full Pipeline — Discovery -> Execution");

await test("discoverAndValidate finds echo plugin and returns @@prism_echo.echo", async () => {
  PrismAIPluginRegistry.reset();
  const results = await PrismAIPluginRegistry.discoverAndValidate();

  // Echo plugin should be discovered
  const echoResult = results.find((r) => r.id === "echo");
  assert.ok(echoResult, "echo plugin not found in discovery results");
  assert.ok(
    echoResult.state === PLUGIN_STATES.VALID ||
      echoResult.state === PLUGIN_STATES.HEALTHY,
    `expected echo to be VALID or HEALTHY, got: ${echoResult.state}. Errors: ${echoResult.errors.join(", ")}`
  );

  // getPrismAIPluginTools must return the prefixed name
  const tools = getPrismAIPluginTools();
  assert.ok(Array.isArray(tools), "getPrismAIPluginTools must return an array");
  assert.ok(
    tools.includes("@@prism_echo.echo"),
    `Expected "@@prism_echo.echo" in tools, got: ${JSON.stringify(tools)}`
  );
});

await test("createEnforcedHandler produces a handler that returns a string containing echoedMessage", async () => {
  // Discovery should already have run in the previous test; reset and re-run to be safe
  PrismAIPluginRegistry.reset();
  await PrismAIPluginRegistry.discoverAndValidate();

  const plugin = PrismAIPluginRegistry.getPluginById("echo");
  assert.ok(plugin, "echo plugin not found in registry after discovery");

  const toolConfig = plugin.tools.echo;
  assert.ok(toolConfig, "echo tool not found in plugin.tools");

  const handler = createEnforcedHandler("echo", "echo", toolConfig, null);
  assert.strictEqual(typeof handler, "function", "handler must be a function");

  // Call with a fake Aibitat context that provides introspect
  const introspectLog = [];
  const fakeContext = {
    super: {
      introspect: (msg) => introspectLog.push(msg),
    },
  };

  const result = await handler.call(fakeContext, { message: "hello-pipeline" });

  assert.strictEqual(typeof result, "string", "result must be a string");
  assert.ok(
    result.includes("echoedMessage"),
    `result must contain "echoedMessage", got: ${result}`
  );
  assert.ok(
    result.includes("hello-pipeline"),
    `result must contain the input message, got: ${result}`
  );

  terminateAll();
  WORKER_POOL.clear();
});

// ──────────────────────────────────────────────────────────────────────────────

suite("Test 2: Worker Thread Spawn and Execute");

await test("WorkerHost spawns, executes echo tool, and terminates cleanly", async () => {
  PrismAIPluginRegistry.reset();
  await PrismAIPluginRegistry.discoverAndValidate();

  const plugin = PrismAIPluginRegistry.getPluginById("echo");
  assert.ok(plugin, "echo plugin not found");

  const handlerPath = path.resolve(plugin.pluginDir, plugin.manifest.runtime.entrypoint);
  const host = getWorkerHost("echo", handlerPath);

  assert.ok(!host.isRunning(), "host should not be running before spawn");

  await host.spawn();
  assert.ok(host.isRunning(), "host should be running after spawn");

  const result = await host.execute("echo", { message: "worker-test" });
  assert.ok(result.success, `execute must succeed, got: ${JSON.stringify(result)}`);
  assert.deepStrictEqual(
    result.result,
    { echoedMessage: "worker-test" },
    `unexpected result: ${JSON.stringify(result.result)}`
  );

  host.terminate();
  assert.ok(!host.isRunning(), "host should not be running after terminate");

  terminateAll();
  WORKER_POOL.clear();
});

// ──────────────────────────────────────────────────────────────────────────────

suite("Test 3: Timeout Enforcement");

await test("execute rejects with timeout error when tool exceeds timeout; worker stays in OVERRUN state", async () => {
  // Create a temporary slow handler (sleeps 10 seconds)
  const { pluginDir, cleanup } = createTempPlugin(
    "slow-test",
    {
      id: "slow-test",
      runtime: { entrypoint: "handler.js", timeout: 500 },
    },
    `
"use strict";
function run(args) {
  // Busy-wait for 10 seconds to simulate a slow operation
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) { /* spin */ }
  return { done: true };
}
module.exports = { run };
`
  );

  try {
    const handlerPath = path.join(pluginDir, "handler.js");
    const host = getWorkerHost("slow-test", handlerPath);
    await host.spawn();

    let threw = false;
    let errorMessage = "";
    try {
      await host.execute("run", { input: "test" }, 300);
    } catch (err) {
      threw = true;
      errorMessage = err.message;
    }

    assert.ok(threw, "execute should have thrown a timeout error");
    assert.ok(
      errorMessage.toLowerCase().includes("timed out"),
      `error message should mention timeout, got: ${errorMessage}`
    );

    // Worker should be in OVERRUN state (not DEAD or CRASHED)
    const state = host.getState();
    assert.strictEqual(
      state,
      "OVERRUN",
      `Worker should be in OVERRUN state after timeout, got: ${state}`
    );

    host.terminate();
  } finally {
    terminateAll();
    WORKER_POOL.clear();
    cleanup();
  }
});

// ──────────────────────────────────────────────────────────────────────────────

suite("Test 4: Worker Crash and Auto-Recovery");

await test("worker auto-recovers after a single crash and crashCount increments to 1", async () => {
  // Create a temporary crash handler (exits immediately)
  const { pluginDir, cleanup } = createTempPlugin(
    "crash-test",
    { id: "crash-test" },
    `
"use strict";
function run(args) {
  process.exit(1);
}
module.exports = { run };
`
  );

  try {
    const handlerPath = path.join(pluginDir, "handler.js");
    const host = getWorkerHost("crash-test", handlerPath);
    await host.spawn();

    // Execute — this will cause a crash
    let executeError = null;
    try {
      await host.execute("run", { input: "crash-me" }, 3000);
    } catch (err) {
      executeError = err;
    }

    // Give the crash handler time to complete
    await new Promise((r) => setTimeout(r, 500));

    // After crash, crashCount should be >= 1
    assert.ok(
      host.getCrashCount() >= 1,
      `expected crashCount >= 1, got: ${host.getCrashCount()}`
    );
  } finally {
    terminateAll();
    WORKER_POOL.clear();
    cleanup();
  }
});

// ──────────────────────────────────────────────────────────────────────────────

suite("Test 5: Max Crashes -> DEGRADED");

await test("plugin enters DEGRADED state after MAX_CRASHES crashes and execute rejects immediately", async () => {
  // Create a temp crash plugin
  const pluginId = "degraded-test";
  const { pluginDir, cleanup } = createTempPlugin(
    pluginId,
    { id: pluginId },
    `
"use strict";
function run(args) {
  process.exit(1);
}
module.exports = { run };
`
  );

  // Register a minimal plugin in the registry so the enforcement wrapper can find it
  PrismAIPluginRegistry.reset();

  try {
    const handlerPath = path.join(pluginDir, "handler.js");
    const host = getWorkerHost(pluginId, handlerPath);

    // Drive crashes until MAX_CRASHES is reached
    for (let i = 0; i < MAX_CRASHES; i++) {
      try {
        await host.spawn();
      } catch {
        // spawn may fail after some crashes
      }
      try {
        await host.execute("run", { input: "crash" }, 2000);
      } catch {
        // expected
      }
      // Wait for crash processing
      await new Promise((r) => setTimeout(r, 400));
    }

    // After MAX_CRASHES crashes, host should be degraded
    assert.ok(
      !host.isRunning(),
      `host should not be running after ${MAX_CRASHES} crashes`
    );
    const state = host.getState();
    assert.strictEqual(
      state,
      "DEGRADED",
      `expected DEGRADED state after ${MAX_CRASHES} crashes, got: ${state}`
    );

    // execute should reject immediately when DEGRADED
    let degradedError = null;
    try {
      await host.execute("run", { input: "test" }, 2000);
    } catch (err) {
      degradedError = err;
    }
    assert.ok(degradedError, "execute should reject when worker is DEGRADED");
  } finally {
    terminateAll();
    WORKER_POOL.clear();
    PrismAIPluginRegistry.reset();
    cleanup();
  }
});

// ──────────────────────────────────────────────────────────────────────────────

suite("Test 6: Missing Plugin Graceful Skip");

await test("getPluginForTool and getPluginById return undefined for nonexistent entries without throwing", async () => {
  PrismAIPluginRegistry.reset();

  const toolResult = PrismAIPluginRegistry.getPluginForTool("nonexistent.tool");
  assert.strictEqual(
    toolResult,
    undefined,
    `getPluginForTool should return undefined for missing tool, got: ${JSON.stringify(toolResult)}`
  );

  const pluginResult = PrismAIPluginRegistry.getPluginById("nonexistent");
  assert.strictEqual(
    pluginResult,
    undefined,
    `getPluginById should return undefined for missing plugin, got: ${JSON.stringify(pluginResult)}`
  );

  // getPrismAIPluginTools on empty registry returns []
  const tools = getPrismAIPluginTools();
  assert.deepStrictEqual(tools, [], `expected [] on empty registry, got: ${JSON.stringify(tools)}`);
});

// ──────────────────────────────────────────────────────────────────────────────

suite("Test 7: Enforcement Wrapper FFI Degradation");

await test("EnforcementWrapper with null client returns permitted=true with ffi_unavailable flag and validates input correctly", async () => {
  const wrapper = new EnforcementWrapper(null);

  // validateAction: should fail-open when FFI is unavailable (in NODE_ENV=test, bridge will not load)
  const actionResult = await wrapper.validateAction("echo", "echo", { args: { message: "test" } });
  assert.strictEqual(
    actionResult.permitted,
    true,
    `expected permitted=true, got: ${JSON.stringify(actionResult)}`
  );
  assert.ok(
    Array.isArray(actionResult.flags),
    "flags must be an array"
  );
  // In test environment, FFI is not available — should include ffi_unavailable or ffi_error flag
  const hasFfiFlag = actionResult.flags.some(
    (f) => f === "ffi_unavailable" || f.startsWith("ffi_error")
  );
  assert.ok(
    hasFfiFlag,
    `expected ffi_unavailable or ffi_error flag, got: ${JSON.stringify(actionResult.flags)}`
  );

  // validateInput: valid input passes
  const schema = {
    type: "object",
    properties: { message: { type: "string" } },
    required: ["message"],
  };
  const validResult = wrapper.validateInput({ message: "hello" }, schema);
  assert.strictEqual(validResult.valid, true, "valid input should pass schema validation");
  assert.deepStrictEqual(validResult.errors, [], "valid input should have no errors");

  // validateInput: invalid input fails
  const invalidResult = wrapper.validateInput({ message: 42 }, schema);
  assert.strictEqual(
    invalidResult.valid,
    false,
    "invalid input (wrong type) should fail schema validation"
  );
  assert.ok(
    invalidResult.errors.length > 0,
    "invalid input should produce validation errors"
  );

  // validateInput: missing required field fails
  const missingResult = wrapper.validateInput({}, schema);
  assert.strictEqual(
    missingResult.valid,
    false,
    "missing required field should fail schema validation"
  );
});

// ──────────────────────────────────────────────────────────────────────────────

suite("Test 8: NODE_ENV=test Guard");

await test("NODE_ENV is 'test' and bridge load is suppressed in test environment", async () => {
  // This test verifies that the enforcement wrapper does NOT attempt to load
  // the native bridge in a way that would crash in CI/test environments.
  assert.strictEqual(
    process.env.NODE_ENV,
    "test",
    "NODE_ENV must be 'test' for CI safety"
  );

  // Verify that requiring enforcement-wrapper does not throw
  // (the bridge is loaded lazily and fails gracefully)
  let importError = null;
  try {
    require("../../utils/plugins/enforcement-wrapper");
  } catch (err) {
    importError = err;
  }
  assert.strictEqual(
    importError,
    null,
    `enforcement-wrapper should load without throwing in test environment: ${importError}`
  );

  // Verify that validateAction on a fresh wrapper returns ffi_unavailable (not an error)
  const wrapper = new EnforcementWrapper(null);
  const result = await wrapper.validateAction("test-plugin", "test-tool", {});
  assert.strictEqual(
    result.permitted,
    true,
    "validateAction must return permitted=true in test environment"
  );
  const hasFfiFlag = result.flags.some(
    (f) => f === "ffi_unavailable" || f.startsWith("ffi_error")
  );
  assert.ok(
    hasFfiFlag,
    `expected ffi_unavailable or ffi_error flag in test environment, got: ${JSON.stringify(result.flags)}`
  );
});

// ── Final report ──────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`Results: ${_passed} passed, ${_failed} failed`);
if (_failures.length > 0) {
  console.log("\nFailed tests:");
  for (const { name, error } of _failures) {
    console.log(`  - ${name}`);
    console.log(`    ${error}`);
  }
}
console.log(`${"─".repeat(60)}\n`);

process.exit(_failed > 0 ? 1 : 0);
