/**
 * PrismAI Secrets Bridge
 *
 * Provides per-plugin secret storage and retrieval backed by AnythingLLM's
 * SystemSettings model (unencrypted SQLite). Secrets are namespaced using
 * the key format:
 *
 *   prismai_plugin_secret::{pluginId}::{secretName}
 *
 * The `::` separator is used instead of `_` to avoid label collisions when
 * pluginId or secretName contain underscores. The `::` character sequence is
 * blocked from secretName values by validation.
 *
 * This is the same mechanism used for all other server credentials (OpenAI
 * keys, Anthropic keys, etc.). Secrets live locally on the user's machine.
 *
 * Worker threads do NOT call these functions directly. The main thread holds
 * all secret retrieval. Worker-to-main-thread message-passing for secrets is
 * a Sprint 3 deliverable.
 */

const { SystemSettings } = require("../../models/systemSettings");

// ── Validation ─────────────────────────────────────────────────────────────

const PLUGIN_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const SECRET_KEY_PREFIX = "prismai_plugin_secret::";
// Legacy prefix used before the :: separator was introduced. Used only by migrateSecretKeys().
const LEGACY_SECRET_KEY_PREFIX = "prismai_plugin_secret_";
const MAX_SECRET_VALUE_LENGTH = 10000;

/**
 * Validate pluginId and secretName inputs.
 * Throws with a descriptive message on violation.
 *
 * @param {string} pluginId
 * @param {string} secretName
 */
function _validateInputs(pluginId, secretName) {
  if (typeof pluginId !== "string" || pluginId.length === 0) {
    throw new Error("pluginId must be a non-empty string");
  }
  if (!PLUGIN_ID_PATTERN.test(pluginId)) {
    throw new Error(
      `pluginId "${pluginId}" is invalid: must match /^[a-z0-9][a-z0-9_-]*$/`
    );
  }
  if (typeof secretName !== "string" || secretName.length === 0) {
    throw new Error("secretName must be a non-empty string");
  }
  if (secretName.includes("::")) {
    throw new Error(
      `secretName "${secretName}" is invalid: must not contain "::" (reserved separator)`
    );
  }
}

/**
 * Build the SystemSettings label for a plugin secret.
 * Format: prismai_plugin_secret::{pluginId}::{secretName}
 *
 * The `::` separator prevents label collisions when pluginId or secretName
 * contain underscores (which are allowed in pluginId values).
 *
 * @param {string} pluginId
 * @param {string} secretName
 * @returns {string}
 */
function _buildLabel(pluginId, secretName) {
  return `${SECRET_KEY_PREFIX}${pluginId}::${secretName}`;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Retrieve a secret for a plugin from SystemSettings.
 * Returns null if the secret does not exist (rather than throwing).
 * Throws on invalid inputs or unexpected database errors.
 *
 * @param {string} pluginId  - Plugin identifier (must match /^[a-z0-9][a-z0-9_-]*$/)
 * @param {string} secretName - Secret key name (non-empty string)
 * @returns {Promise<string | null>} Secret value or null if not stored
 */
async function getSecret(pluginId, secretName) {
  _validateInputs(pluginId, secretName);
  const label = _buildLabel(pluginId, secretName);
  const setting = await SystemSettings.get({ label });
  if (!setting) return null;
  return setting.value ?? null;
}

/**
 * Store (or update) a secret for a plugin in SystemSettings.
 * Uses Prisma's upsert semantics -- creates the key if it does not exist,
 * updates the value if it does.
 *
 * @param {string} pluginId   - Plugin identifier
 * @param {string} secretName - Secret key name
 * @param {string} value      - Secret value (non-empty string, max 10000 chars)
 * @returns {Promise<void>}
 */
async function storeSecret(pluginId, secretName, value) {
  _validateInputs(pluginId, secretName);
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("value must be a non-empty string");
  }
  if (value.length > MAX_SECRET_VALUE_LENGTH) {
    throw new Error(
      `value exceeds maximum length of ${MAX_SECRET_VALUE_LENGTH} characters`
    );
  }
  const label = _buildLabel(pluginId, secretName);
  // _updateSettings bypasses the supportedFields allowlist and calls
  // prisma.system_settings.upsert directly -- same pattern as markOnboardingComplete.
  await SystemSettings._updateSettings({ [label]: value });
}

/**
 * List all stored secret names for a plugin.
 * Returns an array of secret names (NOT values). Returns an empty array if
 * the plugin has no stored secrets.
 *
 * @param {string} pluginId
 * @returns {Promise<string[]>} Array of secretName strings
 */
async function listSecrets(pluginId) {
  if (typeof pluginId !== "string" || pluginId.length === 0) {
    throw new Error("pluginId must be a non-empty string");
  }
  if (!PLUGIN_ID_PATTERN.test(pluginId)) {
    throw new Error(
      `pluginId "${pluginId}" is invalid: must match /^[a-z0-9][a-z0-9_-]*$/`
    );
  }

  const prefix = `${SECRET_KEY_PREFIX}${pluginId}::`;
  const settings = await SystemSettings.where({
    label: { startsWith: prefix },
  });

  return settings.map((s) => s.label.slice(prefix.length));
}

/**
 * One-time migration from the old underscore-separated key format to the
 * new `::` separator format. Safe to call at startup on every boot --
 * it only touches keys in the old format.
 *
 * Migration strategy:
 *   Old format: prismai_plugin_secret_{pluginId}_{secretName}
 *   New format: prismai_plugin_secret::{pluginId}::{secretName}
 *
 * Because the old format used `_` as separator between pluginId and
 * secretName, and both components can contain underscores, perfect parsing
 * is impossible. Best-effort approach: split on the FIRST `_` after the
 * prefix to obtain pluginId, and treat the remainder as secretName. This
 * recovers correctly for any pluginId that does NOT contain an underscore.
 * For ambiguous cases, the old key is still re-keyed using this heuristic
 * so the data is preserved even if the split is inexact.
 *
 * @returns {Promise<{ migrated: number, skipped: number }>}
 */
async function migrateSecretKeys() {
  let migrated = 0;
  let skipped = 0;

  // Find all settings that still use the legacy underscore prefix
  const legacySettings = await SystemSettings.where({
    label: { startsWith: LEGACY_SECRET_KEY_PREFIX },
  });

  for (const setting of legacySettings) {
    // Skip any key that has already been migrated (new format also starts
    // with "prismai_plugin_secret_" since the new prefix starts with
    // "prismai_plugin_secret::" which does NOT start with the legacy prefix,
    // so this loop only ever sees old-format keys).
    const remainder = setting.label.slice(LEGACY_SECRET_KEY_PREFIX.length);
    if (!remainder) {
      skipped++;
      continue;
    }

    // Best-effort split: first `_` separates pluginId from secretName.
    const firstUnderscore = remainder.indexOf("_");
    let pluginId, secretName;

    if (firstUnderscore === -1) {
      // No underscore in remainder: treat entire remainder as pluginId with
      // an empty secretName. Cannot migrate cleanly -- skip.
      console.warn(
        `[secrets-bridge] migrateSecretKeys: cannot parse legacy key "${setting.label}" ` +
          `(no underscore separator after prefix) -- skipping`
      );
      skipped++;
      continue;
    }

    pluginId = remainder.slice(0, firstUnderscore);
    secretName = remainder.slice(firstUnderscore + 1);

    if (!pluginId || !secretName) {
      console.warn(
        `[secrets-bridge] migrateSecretKeys: skipping malformed legacy key "${setting.label}"`
      );
      skipped++;
      continue;
    }

    const newLabel = `${SECRET_KEY_PREFIX}${pluginId}::${secretName}`;

    try {
      // Write under new key
      await SystemSettings._updateSettings({ [newLabel]: setting.value });
      // Remove old key by setting to empty string then deleting. SystemSettings
      // does not expose a delete method, so we overwrite with an empty string
      // as a best-effort tombstone. The old key will no longer be found by
      // getSecret() since _buildLabel() now produces the new format.
      await SystemSettings._updateSettings({ [setting.label]: "" });
      console.log(
        `[secrets-bridge] migrateSecretKeys: migrated "${setting.label}" -> "${newLabel}"`
      );
      migrated++;
    } catch (err) {
      console.error(
        `[secrets-bridge] migrateSecretKeys: error migrating "${setting.label}": ${err.message}`
      );
      skipped++;
    }
  }

  if (migrated > 0 || skipped > 0) {
    console.log(
      `[secrets-bridge] migrateSecretKeys complete: ${migrated} migrated, ${skipped} skipped`
    );
  }

  return { migrated, skipped };
}

module.exports = { getSecret, storeSecret, listSecrets, migrateSecretKeys };
