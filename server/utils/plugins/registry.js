/**
 * PrismAI Plugin Registry
 *
 * Discovers, validates, and tracks PrismAI plugins from the
 * `prismai-plugins` storage directory. Provides a synchronous
 * tool enumeration function for agent integration.
 */

const fs = require("fs");
const path = require("path");
const {
  CURRENT_SCHEMA_VERSION: _CURRENT_SCHEMA_VERSION, // imported for schema-awareness; used by Sprint 3 upgrade checks
  validateManifest,
  validateHandler,
  migrateSchema,
  runHealthCheck,
} = require("./manifest-validator");
const { normalizePath } = require("../files");

const PRISMAI_PLUGIN_PREFIX = "@@prism_";

const PLUGIN_STATES = Object.freeze({
  DISCOVERED: "discovered",
  VALID: "valid",
  INVALID: "invalid",
  HEALTHY: "healthy",
  DEGRADED: "degraded",
});

// ── Module-scoped state ─────────────────────────────────────────────────────

/** @type {Map<string, PluginMetadata>} */
let _plugins = new Map();

/**
 * @typedef {object} PluginMetadata
 * @property {string} id - From manifest.id
 * @property {string} name - From manifest.name
 * @property {string} version - From manifest.version
 * @property {string} schemaVersion - From manifest.schemaVersion
 * @property {string} state - One of PLUGIN_STATES values
 * @property {string[]} errors - Accumulated validation errors
 * @property {string} pluginDir - Absolute path to plugin directory
 * @property {string} manifestPath - Absolute path to plugin.prismai.json
 * @property {object} manifest - The parsed (and possibly migrated) manifest
 * @property {object} tools - From manifest.tools (map keyed by tool name)
 * @property {object|null} handler - The require()'d handler module
 * @property {object|null} healthCheck - Health check result: { healthy, details? }
 */

// ── Path resolution ─────────────────────────────────────────────────────────

function _resolvePluginDir() {
  if (process.env.STORAGE_DIR) {
    return path.resolve(process.env.STORAGE_DIR, "plugins", "prismai-plugins");
  }
  return path.resolve(__dirname, "../../storage/plugins/prismai-plugins");
}

// ── Registry class ──────────────────────────────────────────────────────────

class PrismAIPluginRegistry {
  /**
   * Scan the plugin directory, validate each plugin, and return a summary.
   *
   * @returns {Promise<Array<{ id: string, state: string, errors: string[] }>>}
   */
  static async discoverAndValidate() {
    const pluginsDir = _resolvePluginDir();

    // Create directory if missing, return empty
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
      return [];
    }

    const results = [];
    let entries;
    try {
      entries = fs.readdirSync(pluginsDir);
    } catch (err) {
      console.error(
        `PrismAIPluginRegistry: failed to read plugins dir: ${err.message}`
      );
      return [];
    }

    for (const entry of entries) {
      // Sanitize directory name to prevent path traversal
      let safeEntry;
      try {
        safeEntry = normalizePath(entry);
      } catch {
        continue;
      }
      const pluginDir = path.resolve(pluginsDir, safeEntry);

      // Skip non-directories
      try {
        if (!fs.statSync(pluginDir).isDirectory()) continue;
      } catch {
        continue;
      }

      const manifestPath = path.resolve(pluginDir, "plugin.prismai.json");
      const errors = [];
      let manifest = null;
      let handler = null;
      let state = PLUGIN_STATES.DISCOVERED;

      // ── Parse manifest ──────────────────────────────────────────────
      if (!fs.existsSync(manifestPath)) {
        console.warn(
          `PrismAIPluginRegistry: no plugin.prismai.json found in "${safeEntry}" — skipping`
        );
        continue;
      }

      try {
        const raw = fs.readFileSync(manifestPath, "utf8");
        manifest = JSON.parse(raw);
      } catch (parseErr) {
        errors.push(
          `Malformed JSON in plugin.prismai.json: ${parseErr.message}`
        );
        state = PLUGIN_STATES.INVALID;
        results.push({ id: safeEntry, state, errors });
        continue;
      }

      // ── Migrate schema ──────────────────────────────────────────────
      const migration = migrateSchema(manifest, manifestPath);
      if (migration.errors.length > 0) {
        errors.push(...migration.errors);
        state = PLUGIN_STATES.INVALID;
        const pluginId = manifest.id || safeEntry;
        if (_plugins.has(pluginId)) {
          console.warn(
            `PrismAIPluginRegistry: duplicate plugin id "${pluginId}" found. Later discovery overwrites earlier.`
          );
        }
        _plugins.set(pluginId, {
          id: pluginId,
          name: manifest.name || "",
          version: manifest.version || "",
          schemaVersion: manifest.schemaVersion || "",
          state,
          errors,
          pluginDir,
          manifestPath,
          manifest,
          tools: manifest.tools || {},
          handler: null,
          healthCheck: null,
        });
        results.push({ id: pluginId, state, errors });
        continue;
      }
      if (migration.migrated) {
        manifest = migration.manifest;
      }

      // ── Validate manifest ───────────────────────────────────────────
      const manifestResult = validateManifest(manifest);
      if (!manifestResult.valid) {
        errors.push(...manifestResult.errors);
        state = PLUGIN_STATES.INVALID;
        const pluginId = manifest.id || safeEntry;
        if (_plugins.has(pluginId)) {
          console.warn(
            `PrismAIPluginRegistry: duplicate plugin id "${pluginId}" found. Later discovery overwrites earlier.`
          );
        }
        _plugins.set(pluginId, {
          id: pluginId,
          name: manifest.name || "",
          version: manifest.version || "",
          schemaVersion: manifest.schemaVersion || "",
          state,
          errors,
          pluginDir,
          manifestPath,
          manifest,
          tools: manifest.tools || {},
          handler: null,
          healthCheck: null,
        });
        results.push({ id: pluginId, state, errors });
        continue;
      }

      // ── Validate handler ────────────────────────────────────────────
      const handlerResult = validateHandler(manifest, pluginDir);
      if (!handlerResult.valid) {
        errors.push(...handlerResult.errors);
        state = PLUGIN_STATES.INVALID;
        if (_plugins.has(manifest.id)) {
          console.warn(
            `PrismAIPluginRegistry: duplicate plugin id "${manifest.id}" found. Later discovery overwrites earlier.`
          );
        }
        _plugins.set(manifest.id, {
          id: manifest.id,
          name: manifest.name,
          version: manifest.version,
          schemaVersion: manifest.schemaVersion,
          state,
          errors,
          pluginDir,
          manifestPath,
          manifest,
          tools: manifest.tools || {},
          handler: null,
          healthCheck: null,
        });
        results.push({ id: manifest.id, state, errors });
        continue;
      }
      handler = handlerResult.handler;

      // ── Run health check ────────────────────────────────────────────
      const healthResult = await runHealthCheck(manifest, pluginDir);
      if (healthResult.healthy) {
        state = healthResult.details?.skipped
          ? PLUGIN_STATES.VALID
          : PLUGIN_STATES.HEALTHY;
      } else {
        errors.push(...healthResult.errors);
        state = PLUGIN_STATES.DEGRADED;
      }

      if (_plugins.has(manifest.id)) {
        console.warn(
          `PrismAIPluginRegistry: duplicate plugin id "${manifest.id}" found. Later discovery overwrites earlier.`
        );
      }
      _plugins.set(manifest.id, {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        schemaVersion: manifest.schemaVersion,
        state,
        errors,
        pluginDir,
        manifestPath,
        manifest,
        tools: manifest.tools || {},
        handler,
        healthCheck: healthResult,
      });

      results.push({ id: manifest.id, state, errors });
    }

    return results;
  }

  /**
   * Count of plugins in VALID or HEALTHY state.
   * @returns {number}
   */
  static getLoadedCount() {
    let count = 0;
    for (const plugin of _plugins.values()) {
      if (
        plugin.state === PLUGIN_STATES.VALID ||
        plugin.state === PLUGIN_STATES.HEALTHY
      ) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get plugin metadata by ID.
   * @param {string} id
   * @returns {PluginMetadata|undefined}
   */
  static getPluginById(id) {
    return _plugins.get(id);
  }

  /**
   * Parse a qualified tool name like "echo.echo" and return the
   * matching plugin metadata.
   * @param {string} qualifiedToolName - "pluginId.toolName"
   * @returns {{ plugin: PluginMetadata, toolName: string }|undefined}
   */
  static getPluginForTool(qualifiedToolName) {
    if (!qualifiedToolName || typeof qualifiedToolName !== "string")
      return undefined;
    const dotIndex = qualifiedToolName.indexOf(".");
    if (dotIndex === -1) return undefined;

    const pluginId = qualifiedToolName.substring(0, dotIndex);
    const toolName = qualifiedToolName.substring(dotIndex + 1);
    const plugin = _plugins.get(pluginId);
    if (!plugin) return undefined;

    return { plugin, toolName };
  }

  /**
   * Get the state of a plugin by ID.
   * @param {string} id
   * @returns {string|undefined}
   */
  static getPluginState(id) {
    const plugin = _plugins.get(id);
    return plugin?.state;
  }

  /**
   * Set the state of a plugin by ID.
   * @param {string} id
   * @param {string} state - One of PLUGIN_STATES values
   */
  static setPluginState(id, state) {
    if (!Object.values(PLUGIN_STATES).includes(state)) {
      console.warn(
        `PrismAIPluginRegistry: invalid state "${state}" — must be one of: ${Object.values(PLUGIN_STATES).join(", ")}`
      );
      return;
    }
    const plugin = _plugins.get(id);
    if (plugin) {
      plugin.state = state;
    }
  }

  /**
   * Clear all plugin state (for testing).
   */
  static reset() {
    _plugins = new Map();
  }
}

/**
 * Synchronously returns an array of qualified tool names
 * (e.g., "@@prism_echo.echo") for all VALID or HEALTHY plugins.
 *
 * Defensive: wraps in try/catch and returns [] on any error.
 *
 * @returns {string[]}
 */
function getPrismAIPluginTools() {
  try {
    const tools = [];
    for (const plugin of _plugins.values()) {
      if (
        plugin.state !== PLUGIN_STATES.VALID &&
        plugin.state !== PLUGIN_STATES.HEALTHY
      ) {
        continue;
      }
      const toolKeys = Object.keys(plugin.tools || {});
      for (const toolName of toolKeys) {
        tools.push(`${PRISMAI_PLUGIN_PREFIX}${plugin.id}.${toolName}`);
      }
    }
    return tools;
  } catch {
    return [];
  }
}

module.exports = {
  PRISMAI_PLUGIN_PREFIX,
  PLUGIN_STATES,
  PrismAIPluginRegistry,
  getPrismAIPluginTools,
};
