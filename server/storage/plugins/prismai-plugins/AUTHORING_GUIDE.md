# PrismAI Plugin Authoring Guide

**Version:** 1.0 — Sprint 2 Phase 2
**Location:** `server/storage/plugins/prismai-plugins/AUTHORING_GUIDE.md`

This guide is the definitive reference for building PrismAI plugins. Read the example plugins in this directory alongside this guide: `echo/` (minimal), `counter/` (stateful), `weather/` (async HTTP with health check).

---

## 1. Overview

### What is a PrismAI plugin?

A PrismAI plugin is a self-contained Node.js module that exposes one or more **tools** to the PrismAI agent system. Tools are functions your plugin exports that agents can invoke via natural language.

Each plugin consists of:
- A **manifest** (`plugin.prismai.json`) that declares the plugin's identity, tools, and requirements.
- A **handler** (`handler.js`) that implements each declared tool as an exported function.
- An optional **health check** (`health.js`) that verifies external dependencies are available.

### Plugin lifecycle

```
Server start
    |
    v
Registry: discoverAndValidate()
    |
    +-- For each directory in storage/plugins/prismai-plugins/:
    |
    |   1. Parse plugin.prismai.json          --> state: DISCOVERED
    |   2. validateManifest()                 --> state: VALID | INVALID
    |   3. validateHandler()                  --> state: VALID | INVALID
    |   4. runHealthCheck() (if declared)     --> state: HEALTHY | DEGRADED
    |
    v
getPrismAIPluginTools()
    |
    +-- Only VALID and HEALTHY plugins contribute tools to agents
    |
    v
Agent invokes tool "@@ prism_myplugin.my_tool"
    |
    v
enforcement-wrapper.js (rate limiting, output capping)
    |
    v
worker-host.js (manages Worker Thread pool)
    |
    v
worker-runner.js (inside Worker Thread: require() handler, call function)
    |
    v
handler.js: myTool(args) -> result
```

### Architecture summary

| Component | Role |
|-----------|------|
| `registry.js` | Discovers, validates, and registers plugins at startup |
| `manifest-validator.js` | Validates manifest schema and handler exports |
| `enforcement-wrapper.js` | Rate limiting and output size enforcement |
| `worker-host.js` | Manages a persistent Worker Thread per plugin |
| `worker-runner.js` | Runs inside the Worker Thread; loads and calls handler functions |
| `handler.js` | Your code: implements the plugin's tools |

---

## 2. Quick Start

### Option A: Use the scaffold tool (recommended)

```bash
# From prismai-server/ directory:
node server/utils/plugins/scaffold.js my-plugin "My Plugin" tool_one tool_two
```

This creates:
```
server/storage/plugins/prismai-plugins/my-plugin/
  plugin.prismai.json   (manifest template — edit descriptions and parameters)
  handler.js            (stub functions — implement your logic)
```

Then:
1. Edit `plugin.prismai.json`: add tool descriptions and parameter schemas.
2. Implement tool functions in `handler.js`.
3. Verify with discovery (see Section 8.3).

### Option B: Copy from an example

Copy `echo/` for a minimal stateless plugin, or `counter/` for a stateful plugin, and edit the copied files.

### Directory structure of a minimal plugin

```
my-plugin/
  plugin.prismai.json     # Required — manifest
  handler.js              # Required — tool implementations
  health.js               # Optional — health check (if plugin has external deps)
  README.md               # Optional — plugin documentation
```

---

## 3. Manifest Reference (`plugin.prismai.json`)

### 3.1 Required Fields

| Field | Type | Constraints | Example |
|-------|------|-------------|---------|
| `id` | string | `/^[a-z0-9][a-z0-9_-]*$/`, max 64 chars | `"my-plugin"` |
| `name` | string | Non-empty | `"My Plugin"` |
| `version` | string | Semver `x.y.z` | `"1.0.0"` |
| `schemaVersion` | string | Must be `"1.0.0"` | `"1.0.0"` |
| `runtime.entrypoint` | string | Must end in `.js` | `"handler.js"` |
| `tools` | object | At least one tool | see below |

### 3.2 Optional Fields

| Field | Type | Constraints | Default | Notes |
|-------|------|-------------|---------|-------|
| `author` | string | Any string | `""` | Your name or org |
| `license` | string | Any string | `"MIT"` | SPDX identifier recommended |
| `description` | string | Any string | `""` | Shown in registry output |
| `runtime.timeout` | integer | 100–300000 ms | `30000` | Per-call execution timeout |
| `healthCheck.entrypoint` | string | Must end in `.js` | none | Path to health check module |
| `secrets` | array | See Section 6 | none | Forward declaration for secrets-bridge |

### 3.3 Tool Definition

Each key in `tools` must:
- Match `/^[a-zA-Z][a-zA-Z0-9_]*$/` (start with a letter, alphanumeric + underscores only).
- Contain a `description` (non-empty string — this is shown to the LLM agent).
- Contain a `parameters` object with `type: "object"` and a `properties` object.

```json
"my_tool": {
  "description": "Does X when you provide Y. Returns Z.",
  "parameters": {
    "type": "object",
    "properties": {
      "input": {
        "type": "string",
        "description": "The input to process."
      },
      "count": {
        "type": "integer",
        "description": "Number of results to return.",
        "default": 10
      }
    },
    "required": ["input"]
  }
}
```

**Write good tool descriptions.** The description is sent verbatim to the LLM agent. Be specific about what the tool does, what inputs it expects, and what it returns.

### 3.4 Full Manifest Examples

**Minimal (echo plugin):**
```json
{
  "id": "echo",
  "name": "Echo Test Plugin",
  "version": "1.0.0",
  "schemaVersion": "1.0.0",
  "author": "PrismAI",
  "license": "MIT",
  "description": "Echoes back its input.",
  "runtime": { "entrypoint": "handler.js", "timeout": 5000 },
  "tools": {
    "echo": {
      "description": "Echoes the provided message back to the caller.",
      "parameters": {
        "type": "object",
        "properties": {
          "message": { "type": "string", "description": "The message to echo." }
        },
        "required": ["message"]
      }
    }
  }
}
```

**With health check and secrets (weather plugin):**
```json
{
  "id": "weather",
  "name": "Weather Plugin",
  "version": "1.0.0",
  "schemaVersion": "1.0.0",
  "author": "PrismAI",
  "license": "MIT",
  "description": "Fetches weather data from Open-Meteo.",
  "runtime": { "entrypoint": "handler.js", "timeout": 15000 },
  "tools": {
    "get_forecast": {
      "description": "Get the current weather for a location.",
      "parameters": {
        "type": "object",
        "properties": {
          "location": { "type": "string", "description": "City name." }
        },
        "required": ["location"]
      }
    }
  },
  "secrets": [
    { "key": "WEATHER_API_KEY", "description": "API key (optional for free tier).", "required": false }
  ],
  "healthCheck": { "entrypoint": "health.js" }
}
```

---

## 4. Handler Contract

### 4.1 Module Exports

Your handler must export one function for every tool key declared in the manifest:

```javascript
// manifest declares tools: { "my_tool": ..., "other_tool": ... }

function my_tool(args) { ... }
function other_tool(args) { ... }

module.exports = { my_tool, other_tool };
```

The validator (`validateHandler`) checks `typeof handler["my_tool"] === "function"`. If any declared tool is missing, the plugin is marked `INVALID` and will not be available.

### 4.2 Function Signature

```javascript
/**
 * @param {object} args  — The tool's arguments (matches parameters schema).
 * @returns {object|Promise<object>}  — JSON-serializable result.
 */
function my_tool(args) {
  // ...
  return { result: "..." };
}
```

- `args` is always a plain object (may be `{}` if the tool takes no parameters).
- The return value must be JSON-serializable (no functions, Buffers, circular refs).
- Both sync returns and async (Promise-returning) functions are supported.

### 4.3 Sync vs Async

```javascript
// Sync — fine for CPU-only work:
function compute(args) {
  return { result: args.x * 2 };
}

// Async — required for I/O (HTTP, file system, database):
async function fetch_data(args) {
  const data = await someHttpCall(args.url);
  return { data };
}
```

The worker-runner wraps your return value in `Promise.resolve()`, so both patterns work identically from the caller's perspective.

### 4.4 Error Handling

There are two ways to signal an error:

**1. Throw an Error (recommended for unexpected failures):**
```javascript
function process(args) {
  if (!args.input) throw new Error("input is required");
  // ...
}
```
The worker-runner catches thrown errors and returns `{ error: err.message }` to the caller. The Worker Thread continues running (no crash).

**2. Return `{ error: "..." }` (for expected/user-facing errors):**
```javascript
async function get_data(args) {
  const result = await fetchUser(args.id);
  if (!result) return { error: "User not found: " + args.id };
  return { user: result };
}
```
Use this for errors that are a normal part of the tool's operation (not found, invalid input, etc.).

**What NOT to do:**
- Do not call `process.exit()` — it terminates the Worker Thread.
- Do not throw outside of a try/catch if you want the Worker Thread to survive. Uncaught exceptions increment the crash counter; after enough crashes the Worker enters cooldown.

### 4.5 State Persistence

Module-scoped variables persist across tool calls within a single Worker Thread lifecycle:

```javascript
// This state persists across calls to increment() and get_count()
// within the same Worker Thread instance.
let count = 0;

function increment(args) {
  count += (args.amount || 1);
  return { count };
}

function get_count(args) {
  return { count };
}
```

**State resets when:**
- The Worker Thread crashes and is respawned.
- The server is restarted.
- The Worker is explicitly terminated (e.g., plugin reload).

**Important: do NOT rely on module-scoped state for data that must survive restarts.** Use an external store (database, filesystem, Redis) for durable state. Module-scoped state is best for caches, connection pools, and counters that are acceptable to reset.

### 4.6 Allowed Imports

Inside your handler, you may use:
- Node.js built-in modules: `fs`, `path`, `https`, `http`, `crypto`, `url`, `os`, `util`, etc.
- Modules local to your plugin directory (using relative `require('./...')`).

You may NOT:
- Access directories outside your plugin directory via `require('../...')` — the path is validated.
- `require` the registry, enforcement-wrapper, or metacanon-runtime — these are host-side components.
- Install npm packages — the plugin environment is intentionally dependency-free in Sprint 1.

---

## 5. Health Checks

### 5.1 When to Add a Health Check

Add a health check if your plugin:
- Calls an external HTTP API that may be unavailable.
- Requires a system binary (e.g., `ffmpeg`, `python`).
- Needs a database or network service to function.

Do NOT add a health check if your plugin is self-contained (like `echo` or `counter`). An unnecessary health check that fails at startup will mark your plugin as `DEGRADED` and exclude it from agent tools.

### 5.2 Health Check Contract

Your health check module must:
- Export a `check` function.
- Return `{ healthy: true, ...optionalMetadata }` on success.
- Return `{ healthy: false, error: "reason" }` on failure.
- Complete within 5 seconds (enforced by the registry with a hard timeout).

```javascript
// health.js
async function check() {
  const start = Date.now();
  try {
    const ok = await pingExternalService();
    return { healthy: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { healthy: false, error: err.message };
  }
}

module.exports = { check };
```

The health check must apply its own timeout shorter than 5 seconds (recommend 4 seconds) to account for the validator's overhead:

```javascript
// Use a 4-second timeout inside a 5-second validator envelope:
async function check() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch("https://api.example.com/health", { signal: controller.signal });
    clearTimeout(timer);
    return { healthy: res.ok };
  } catch (err) {
    clearTimeout(timer);
    return { healthy: false, error: err.message };
  }
}
```

> **Note on HTTP approaches:** The example above uses `fetch` with `AbortController`, which is available natively in Node.js 18+. The reference implementation (`weather/health.js`) uses Node's built-in `https` module instead, which works on all supported Node versions and requires no global API. Both approaches are acceptable; use `fetch` if you prefer the modern API and are confident your runtime is Node 18+, or use `https` for maximum compatibility.

### 5.3 Impact on Plugin State

| Scenario | Plugin State | Tools Available to Agents? |
|----------|-------------|---------------------------|
| No `healthCheck` declared | `VALID` | Yes |
| `healthCheck` declared, check passes | `HEALTHY` | Yes |
| `healthCheck` declared, check fails | `DEGRADED` | **No** |
| Manifest or handler invalid | `INVALID` | **No** |

A `DEGRADED` plugin is excluded from `getPrismAIPluginTools()`. If your API is temporarily unreachable at server startup, your plugin will be invisible to agents until the server is restarted with connectivity. Plan accordingly.

### 5.4 Health Check Example

See `weather/health.js` for a complete example with a 4-second HTTP timeout and structured response.

---

## 6. Secrets Declaration

### 6.1 Current Status (Sprint 1)

The `secrets` field in the manifest is a **forward declaration** for the secrets-bridge system (Sprint 2). In Sprint 1:
- The validator does **not** validate the `secrets` field structure.
- The secrets-bridge (`secrets-bridge.js`) is a stub that throws on `getSecret()` and `storeSecret()`.
- Use `process.env.MY_KEY` as a fallback for any credentials your plugin needs.

### 6.2 Declaration Convention

Declare your secrets in the manifest even though they are not yet enforced. This documents requirements for future operators:

```json
"secrets": [
  {
    "key": "MY_API_KEY",
    "description": "API key from example.com — get one at https://example.com/api",
    "required": true
  },
  {
    "key": "MY_OPTIONAL_KEY",
    "description": "Optional secondary key for premium features.",
    "required": false
  }
]
```

Key naming convention: `UPPER_SNAKE_CASE`, prefixed with a domain hint if useful (e.g., `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`).

### 6.3 Reading Secrets in Sprint 1

Until secrets-bridge is implemented, read secrets from environment variables:

```javascript
// Sprint 1 pattern — env var fallback:
const apiKey = process.env.MY_API_KEY || null;
if (!apiKey) {
  // Handle gracefully if key is optional, or throw if required:
  throw new Error("MY_API_KEY environment variable is not set");
}
```

### 6.4 Sprint 2 Migration

When Sprint 2 delivers the secrets-bridge, update your handler to:

```javascript
const { getSecret } = require("../../utils/plugins/secrets-bridge");
const apiKey = await getSecret("my-plugin", "MY_API_KEY");
```

Structure your handler to make this a one-line change. The pattern `process.env.KEY || null` is the approved Sprint 1 placeholder.

---

## 7. Scaffold Tool

### 7.1 Usage

```bash
# From prismai-server/ directory:
node server/utils/plugins/scaffold.js <plugin-id> [display-name] [tool1] [tool2] ...
```

**Arguments:**
- `plugin-id` — Required. Directory name and manifest `id`. Must match `/^[a-z0-9][a-z0-9_-]*$/`, max 64 chars.
- `display-name` — Optional. Human-readable manifest `name`. Quote it if it contains spaces. Defaults to title-cased `plugin-id`.
- `tool1 tool2 ...` — Optional. Tool function names. Each must match `/^[a-zA-Z][a-zA-Z0-9_]*$/`. Defaults to a single tool named after `plugin-id` (hyphens become underscores).

**Examples:**
```bash
# Minimal — one tool, default display name:
node server/utils/plugins/scaffold.js my-plugin

# Custom display name + two tools:
node server/utils/plugins/scaffold.js sentiment-analyzer "Sentiment Analyzer" analyze_text batch_analyze
```

### 7.2 Generated Files

**`plugin.prismai.json`** — Manifest template with your plugin ID, display name, and tool stubs. Version is set to `0.1.0` as a reminder this is a new plugin in development.

**`handler.js`** — Handler template with a stub function for each tool. Each stub returns `{ message: "<tool> not yet implemented" }` as a safe placeholder.

### 7.3 Post-Scaffold Checklist

After running the scaffold:

- [ ] Edit `plugin.prismai.json` — replace `"TODO: Add plugin description"` with a real description.
- [ ] Edit each tool's `"description"` — this is what the LLM agent sees.
- [ ] Add `parameters.properties` and `parameters.required` for tools that take input.
- [ ] Implement each tool function in `handler.js`.
- [ ] If your plugin calls external services, add `health.js` and declare it in the manifest.
- [ ] If your plugin needs API keys, declare them in `secrets` and read from `process.env`.
- [ ] Validate and run discovery (Section 8).

---

## 8. Testing Your Plugin

### 8.1 Validate the Manifest

```bash
node -e "
  const { validateManifest } = require('./server/utils/plugins/manifest-validator');
  const manifest = require('./server/storage/plugins/prismai-plugins/my-plugin/plugin.prismai.json');
  const result = validateManifest(manifest);
  console.log('Valid:', result.valid);
  if (!result.valid) result.errors.forEach(e => console.error(' ', e));
"
```

### 8.2 Validate the Handler

```bash
node -e "
  const { validateManifest, validateHandler } = require('./server/utils/plugins/manifest-validator');
  const path = require('path');
  const manifest = require('./server/storage/plugins/prismai-plugins/my-plugin/plugin.prismai.json');
  const pluginDir = path.resolve(__dirname, 'server/storage/plugins/prismai-plugins/my-plugin');
  const mr = validateManifest(manifest);
  const hr = validateHandler(manifest, pluginDir);
  console.log('Manifest:', mr.valid ? 'OK' : 'FAIL', mr.errors);
  console.log('Handler: ', hr.valid ? 'OK' : 'FAIL', hr.errors);
"
```

### 8.3 Run Full Discovery

```bash
node -e "
  const { PrismAIPluginRegistry } = require('./server/utils/plugins/registry');
  PrismAIPluginRegistry.discoverAndValidate().then(plugins => {
    console.log('Registered plugins:', plugins.length);
    plugins.forEach(p => {
      const errs = p.errors && p.errors.length ? ' (' + p.errors.join('; ') + ')' : '';
      console.log(' ', p.id, '->', p.state + errs);
    });
  });
"
```

### 8.4 Check Tool Enumeration

```bash
node -e "
  const { PrismAIPluginRegistry } = require('./server/utils/plugins/registry');
  PrismAIPluginRegistry.discoverAndValidate().then(() => {
    const tools = PrismAIPluginRegistry.getPrismAIPluginTools();
    console.log('Tools available to agents:', tools.length);
    tools.forEach(t => console.log(' ', t.name, '-', t.description));
  });
"
```

### 8.5 Run the Health Check Manually

```bash
node -e "
  const { runHealthCheck } = require('./server/utils/plugins/manifest-validator');
  const manifest = require('./server/storage/plugins/prismai-plugins/my-plugin/plugin.prismai.json');
  const path = require('path');
  const pluginDir = path.resolve(__dirname, 'server/storage/plugins/prismai-plugins/my-plugin');
  runHealthCheck(manifest, pluginDir).then(r => console.log(JSON.stringify(r, null, 2)));
"
```

---

## 9. Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Forgot to export a tool function | `Handler valid: false` — "does not export a function for declared tool X" | `module.exports = { tool_name }` |
| Tool key in manifest doesn't match function name | Same as above | Make manifest key and function name identical |
| Tool key contains a hyphen (e.g., `my-tool`) | Manifest validation fails — key must match `/^[a-zA-Z][a-zA-Z0-9_]*$/` | Use underscore: `my_tool` |
| Plugin ID starts with a number | Manifest validation fails | Start ID with a lowercase letter |
| `module.exports = function()` instead of an object | Handler valid: false | Use `module.exports = { toolName: function() ... }` |
| Returning non-serializable values (Buffer, function, circular ref) | Serialization error in worker-runner | Return plain JSON-compatible objects only |
| Health check takes >5 seconds | Plugin marked DEGRADED | Apply a 4-second timeout inside your health check |
| Relying on module state across Worker restarts | Count/cache disappears | Use external storage for durable state |
| `schemaVersion` set to anything other than `"1.0.0"` | Manifest invalid | Use exactly `"1.0.0"` |
| `runtime.timeout` outside 100–300000 | Manifest invalid | Use a value between 100ms and 300 seconds |

---

## 10. Example Plugins

| Plugin | Directory | Demonstrates |
|--------|-----------|--------------|
| Echo | `echo/` | Minimal plugin: 1 tool, synchronous, no state, no external deps |
| Counter | `counter/` | Stateful plugin: 2 tools, module-scoped state, negative amounts, floor of floats |
| Weather | `weather/` | Async HTTP plugin: geocoding + forecast API, health check, secrets declaration |

Study these in order. `echo` is the baseline. `counter` adds state. `weather` adds async, HTTP, health check, and secrets.

---

## Appendix A: Manifest JSON Schema (Reference)

The authoritative schema is implemented imperatively in `server/utils/plugins/manifest-validator.js`. The JSON Schema below is for documentation only.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "name", "version", "schemaVersion", "runtime", "tools"],
  "properties": {
    "id": { "type": "string", "pattern": "^[a-z0-9][a-z0-9_-]*$", "maxLength": 64 },
    "name": { "type": "string" },
    "version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "schemaVersion": { "type": "string", "const": "1.0.0" },
    "author": { "type": "string" },
    "license": { "type": "string" },
    "description": { "type": "string" },
    "runtime": {
      "type": "object",
      "required": ["entrypoint"],
      "properties": {
        "entrypoint": { "type": "string", "pattern": "\\.js$" },
        "timeout": { "type": "integer", "minimum": 100, "maximum": 300000 }
      }
    },
    "tools": {
      "type": "object",
      "minProperties": 1,
      "additionalProperties": {
        "type": "object",
        "required": ["description", "parameters"],
        "properties": {
          "description": { "type": "string" },
          "parameters": {
            "type": "object",
            "required": ["type", "properties"],
            "properties": {
              "type": { "const": "object" },
              "properties": { "type": "object" }
            }
          }
        }
      }
    },
    "healthCheck": {
      "type": "object",
      "required": ["entrypoint"],
      "properties": {
        "entrypoint": { "type": "string", "pattern": "\\.js$" }
      }
    }
  }
}
```

---

## Appendix B: Tool Name Qualification

Tool names are qualified with a prefix when exposed to agents:

| Context | Format | Example |
|---------|--------|---------|
| Manifest key | `toolName` | `get_forecast` |
| Internal (registry) | `pluginId.toolName` | `weather.get_forecast` |
| Agent-facing | `@@prism_pluginId.toolName` | `@@prism_weather.get_forecast` |

The `@@prism_` prefix is applied by `getPrismAIPluginTools()` using the `PRISMAI_PLUGIN_PREFIX` constant. You never write this in your code — it is applied automatically.

---

## Appendix C: Plugin States

```
                   ┌──────────────┐
Server startup  -> │  DISCOVERED  │  (manifest file found)
                   └──────┬───────┘
                          │
              ┌───────────┴───────────┐
              │ validateManifest() +  │
              │ validateHandler()     │
              └───────────┬───────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
          [valid]                [invalid]
              │                       │
              v                       v
          ┌───────┐             ┌─────────┐
          │ VALID │             │ INVALID │ (not available)
          └───┬───┘             └─────────┘
              │
    [healthCheck declared?]
              │
    ┌─────────┴──────────┐
    │ yes                │ no
    │                    │
    v                    v
runHealthCheck()     stays VALID
    │
    ├── [healthy: true]  --> HEALTHY  (available)
    └── [healthy: false] --> DEGRADED (not available)
```

**States that make tools available to agents:** `VALID`, `HEALTHY`

**States that exclude plugins from agent tool enumeration:** `INVALID`, `DEGRADED`
