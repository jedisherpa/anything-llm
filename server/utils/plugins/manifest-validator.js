/**
 * PrismAI Plugin Manifest Validator
 *
 * Validates plugin manifests against the PrismAI plugin schema,
 * verifies handler exports, runs health checks, and handles
 * schema migrations.
 *
 * No external dependencies — all validation is imperative.
 */

const fs = require("fs");
const path = require("path");

const CURRENT_SCHEMA_VERSION = "1.0.0";

/**
 * JSON Schema reference (documentation only — not consumed by ajv).
 */
const PRISMAI_PLUGIN_SCHEMA_v1 = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: ["id", "name", "version", "schemaVersion", "runtime", "tools"],
  properties: {
    id: {
      type: "string",
      pattern: "^[a-z0-9][a-z0-9_-]*$",
      minLength: 1,
      maxLength: 64,
    },
    name: { type: "string" },
    version: { type: "string" },
    schemaVersion: { type: "string", const: CURRENT_SCHEMA_VERSION },
    author: { type: "string" },
    license: { type: "string" },
    description: { type: "string" },
    runtime: {
      type: "object",
      required: ["entrypoint"],
      properties: {
        entrypoint: { type: "string", pattern: "\\.js$" },
        timeout: { type: "integer", minimum: 100, maximum: 300000 },
      },
    },
    tools: {
      type: "object",
      minProperties: 1,
      additionalProperties: {
        type: "object",
        required: ["description", "parameters"],
        properties: {
          description: { type: "string" },
          parameters: {
            type: "object",
            required: ["type", "properties"],
            properties: {
              type: { type: "string", const: "object" },
              properties: { type: "object" },
            },
          },
        },
      },
    },
    healthCheck: {
      type: "object",
      required: ["entrypoint"],
      properties: {
        entrypoint: { type: "string", pattern: "\\.js$" },
      },
    },
  },
};

/**
 * Schema migration registry.
 * Keys are "fromVersion->toVersion", values are migration functions.
 * Empty in Sprint 1 — structure only.
 */
const MIGRATIONS = {};

// ── Regex patterns ──────────────────────────────────────────────────────────
const PLUGIN_ID_RE = /^[a-z0-9][a-z0-9_-]*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const TOOL_KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/;

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Simple "is `inner` a child of `outer`?" check.
 * Re-uses the same logic as server/utils/files/index.js:isWithin
 * without importing it (to keep the plugin subsystem self-contained).
 */
function _isWithin(outer, inner) {
  if (outer === inner) return false;
  const rel = path.relative(outer, inner);
  return !rel.startsWith("../") && rel !== "..";
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Validate a manifest object against the PrismAI plugin schema.
 *
 * @param {any} manifest
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateManifest(manifest) {
  const errors = [];

  // 1. Must be a non-null object
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { valid: false, errors: ["Manifest must be a non-null object"] };
  }

  // 2. Required string fields
  for (const field of ["id", "name", "version", "schemaVersion"]) {
    if (typeof manifest[field] !== "string" || manifest[field].length === 0) {
      errors.push(`"${field}" is required and must be a non-empty string`);
    }
  }

  // 3. id format
  if (typeof manifest.id === "string" && !PLUGIN_ID_RE.test(manifest.id)) {
    errors.push(
      `"id" must match /^[a-z0-9][a-z0-9_-]*$/ (got "${manifest.id}")`
    );
  }

  // 3c. id length constraints
  if (
    typeof manifest.id === "string" &&
    (manifest.id.length < 1 || manifest.id.length > 64)
  ) {
    errors.push(
      `"id" must be between 1 and 64 characters (got ${manifest.id.length})`
    );
  }

  // 3b. version format — must be semver (x.y.z)
  if (
    typeof manifest.version === "string" &&
    !SEMVER_RE.test(manifest.version)
  ) {
    errors.push(
      `"version" must be a semver string matching x.y.z (got "${manifest.version}")`
    );
  }

  // 4. schemaVersion must equal CURRENT_SCHEMA_VERSION
  if (
    typeof manifest.schemaVersion === "string" &&
    manifest.schemaVersion !== CURRENT_SCHEMA_VERSION
  ) {
    errors.push(
      `"schemaVersion" must be "${CURRENT_SCHEMA_VERSION}" (got "${manifest.schemaVersion}")`
    );
  }

  // 5. runtime
  if (!manifest.runtime || typeof manifest.runtime !== "object") {
    errors.push(`"runtime" is required and must be an object`);
  } else {
    if (
      typeof manifest.runtime.entrypoint !== "string" ||
      !manifest.runtime.entrypoint.endsWith(".js")
    ) {
      errors.push(
        `"runtime.entrypoint" is required and must be a string ending in ".js"`
      );
    }
    if (manifest.runtime.timeout !== undefined) {
      if (
        !Number.isInteger(manifest.runtime.timeout) ||
        manifest.runtime.timeout < 100 ||
        manifest.runtime.timeout > 300000
      ) {
        errors.push(
          `"runtime.timeout" must be a positive integer between 100 and 300000`
        );
      }
    }
  }

  // 6. tools
  if (!manifest.tools || typeof manifest.tools !== "object") {
    errors.push(`"tools" is required and must be an object`);
  } else {
    const toolKeys = Object.keys(manifest.tools);
    if (toolKeys.length === 0) {
      errors.push(`"tools" must contain at least one tool definition`);
    }
    for (const key of toolKeys) {
      if (!TOOL_KEY_RE.test(key)) {
        errors.push(`Tool key "${key}" must match /^[a-zA-Z][a-zA-Z0-9_]*$/`);
      }
      const tool = manifest.tools[key];
      if (!tool || typeof tool !== "object") {
        errors.push(`Tool "${key}" must be an object`);
        continue;
      }
      if (
        typeof tool.description !== "string" ||
        tool.description.length === 0
      ) {
        errors.push(`Tool "${key}" must have a non-empty "description" string`);
      }
      if (!tool.parameters || typeof tool.parameters !== "object") {
        errors.push(`Tool "${key}" must have a "parameters" object`);
      } else {
        if (tool.parameters.type !== "object") {
          errors.push(`Tool "${key}" parameters.type must be "object"`);
        }
        if (
          !tool.parameters.properties ||
          typeof tool.parameters.properties !== "object"
        ) {
          errors.push(
            `Tool "${key}" parameters must have a "properties" object`
          );
        }
      }
    }
  }

  // 7. Optional fields type checks
  if (manifest.author !== undefined && typeof manifest.author !== "string") {
    errors.push(`"author" must be a string if provided`);
  }
  if (manifest.license !== undefined && typeof manifest.license !== "string") {
    errors.push(`"license" must be a string if provided`);
  }
  if (
    manifest.description !== undefined &&
    typeof manifest.description !== "string"
  ) {
    errors.push(`"description" must be a string if provided`);
  }
  if (manifest.healthCheck !== undefined) {
    if (!manifest.healthCheck || typeof manifest.healthCheck !== "object") {
      errors.push(`"healthCheck" must be an object if provided`);
    } else if (
      typeof manifest.healthCheck.entrypoint !== "string" ||
      !manifest.healthCheck.entrypoint.endsWith(".js")
    ) {
      errors.push(`"healthCheck.entrypoint" must be a string ending in ".js"`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate that the handler file exists, loads, and exports a function
 * for every tool declared in the manifest.
 *
 * @param {object} manifest
 * @param {string} pluginDir - Absolute path to plugin directory
 * @returns {{ valid: boolean, errors: string[], handler: object|null }}
 */
function validateHandler(manifest, pluginDir) {
  const errors = [];
  let handler = null;

  try {
    // 1. Resolve handler path
    const entrypoint = manifest?.runtime?.entrypoint;
    if (!entrypoint) {
      return {
        valid: false,
        errors: ["manifest.runtime.entrypoint is missing"],
        handler: null,
      };
    }

    const handlerPath = path.resolve(pluginDir, entrypoint);

    // 2. Path security — must be within pluginDir
    if (!_isWithin(pluginDir, handlerPath)) {
      return {
        valid: false,
        errors: [
          `Handler path "${entrypoint}" resolves outside of plugin directory`,
        ],
        handler: null,
      };
    }

    // 3. File must exist
    if (!fs.existsSync(handlerPath)) {
      return {
        valid: false,
        errors: [`Handler file not found: ${handlerPath}`],
        handler: null,
      };
    }

    // 4. Clear require cache and require the handler
    try {
      delete require.cache[require.resolve(handlerPath)];
      handler = require(handlerPath);
    } catch (requireErr) {
      return {
        valid: false,
        errors: [`Failed to require handler: ${requireErr.message}`],
        handler: null,
      };
    }

    // 5. Verify each tool has a corresponding exported function
    const tools = manifest.tools || {};
    for (const toolName of Object.keys(tools)) {
      if (typeof handler[toolName] !== "function") {
        errors.push(
          `The handler does not export a function for declared tool "${toolName}".`
        );
      }
    }
  } catch (err) {
    return {
      valid: false,
      errors: [`Handler validation error: ${err.message}`],
      handler: null,
    };
  }

  return {
    valid: errors.length === 0,
    errors,
    handler: errors.length === 0 ? handler : null,
  };
}

/**
 * Attempt to migrate a manifest from an older schema version to the current one.
 *
 * @param {object} manifest
 * @param {string} manifestPath - Path to the manifest file (for backup/write)
 * @returns {{ migrated: boolean, manifest: object, errors: string[] }}
 */
function migrateSchema(manifest, manifestPath) {
  try {
    // 1. Already current — no migration needed
    if (manifest && manifest.schemaVersion === CURRENT_SCHEMA_VERSION) {
      return { migrated: false, manifest, errors: [] };
    }

    const fromVersion = manifest?.schemaVersion;

    // 2. Unknown source version — cannot migrate
    if (!fromVersion || typeof fromVersion !== "string") {
      return {
        migrated: false,
        manifest,
        errors: [`Cannot migrate: unknown or missing schemaVersion`],
      };
    }

    // 3. Build migration chain
    const chain = [];
    let current = fromVersion;
    while (current !== CURRENT_SCHEMA_VERSION) {
      const keys = Object.keys(MIGRATIONS);
      const key = keys.find((k) => k.startsWith(`${current}->`));
      if (!key) {
        return {
          migrated: false,
          manifest,
          errors: [
            `No migration path from "${current}" to "${CURRENT_SCHEMA_VERSION}"`,
          ],
        };
      }
      chain.push({ key, fn: MIGRATIONS[key] });
      current = key.split("->")[1];
    }

    // 4. Back up original manifest
    if (manifestPath && fs.existsSync(manifestPath)) {
      try {
        fs.copyFileSync(manifestPath, `${manifestPath}.bak`);
      } catch (backupErr) {
        return {
          migrated: false,
          manifest,
          errors: [
            `Backup failed: could not write ${manifestPath}.bak — ${backupErr.message}`,
          ],
        };
      }
    }

    // 5. Run migration chain
    let migrated = { ...manifest };
    for (const step of chain) {
      migrated = step.fn(migrated);
    }

    // 6. Write migrated manifest
    if (manifestPath) {
      fs.writeFileSync(manifestPath, JSON.stringify(migrated, null, 2), "utf8");
    }

    return { migrated: true, manifest: migrated, errors: [] };
  } catch (err) {
    return {
      migrated: false,
      manifest,
      errors: [`Migration error: ${err.message}`],
    };
  }
}

/**
 * Run the plugin's optional health check.
 *
 * @param {object} manifest
 * @param {string} pluginDir - Absolute path to plugin directory
 * @returns {Promise<{ healthy: boolean, errors: string[], details: any }>}
 */
async function runHealthCheck(manifest, pluginDir) {
  try {
    // 1. No healthCheck declared — default to healthy (skipped)
    if (!manifest.healthCheck) {
      return {
        healthy: true,
        errors: [],
        details: { skipped: true, reason: "No healthCheck declared" },
      };
    }

    const entrypoint = manifest.healthCheck.entrypoint;
    if (!entrypoint) {
      return {
        healthy: false,
        errors: ["healthCheck.entrypoint is missing"],
        details: null,
      };
    }

    // 2. Resolve and require health check module
    const checkPath = path.resolve(pluginDir, entrypoint);
    if (!_isWithin(pluginDir, checkPath)) {
      return {
        healthy: false,
        errors: [
          `Health check path "${entrypoint}" resolves outside of plugin directory`,
        ],
        details: null,
      };
    }

    if (!fs.existsSync(checkPath)) {
      return {
        healthy: false,
        errors: [`Health check file not found: ${checkPath}`],
        details: null,
      };
    }

    let checkModule;
    try {
      delete require.cache[require.resolve(checkPath)];
      checkModule = require(checkPath);
    } catch (requireErr) {
      return {
        healthy: false,
        errors: [`Failed to require health check: ${requireErr.message}`],
        details: null,
      };
    }

    // 3. Verify it exports a `check` function
    if (typeof checkModule.check !== "function") {
      return {
        healthy: false,
        errors: ['Health check module does not export a "check" function'],
        details: null,
      };
    }

    // 4. Execute with 5-second timeout
    const TIMEOUT_MS = 5000;
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Health check timed out after ${TIMEOUT_MS}ms`)),
        TIMEOUT_MS
      );
    });

    let result;
    try {
      result = await Promise.race([
        Promise.resolve(checkModule.check()),
        timeoutPromise,
      ]);
    } finally {
      clearTimeout(timer);
    }

    // 5. Interpret result
    if (result && result.healthy === true) {
      return { healthy: true, errors: [], details: result };
    }

    return {
      healthy: false,
      errors: [result?.error || "Health check returned unhealthy"],
      details: result || null,
    };
  } catch (err) {
    return {
      healthy: false,
      errors: [`Health check error: ${err.message}`],
      details: null,
    };
  }
}

module.exports = {
  CURRENT_SCHEMA_VERSION,
  PRISMAI_PLUGIN_SCHEMA_v1,
  MIGRATIONS,
  validateManifest,
  validateHandler,
  migrateSchema,
  runHealthCheck,
};
