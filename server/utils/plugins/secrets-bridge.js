/**
 * PrismAI Secrets Bridge (Stub)
 *
 * Placeholder for Phase 2 secrets management. All retrieval and storage
 * operations throw with a clear "deferred to Phase 2" message.
 * listSecrets returns an empty array.
 */

/**
 * Retrieve a secret for a plugin. Deferred to Phase 2.
 *
 * @param {string} pluginId
 * @param {string} secretName
 * @returns {Promise<never>}
 */
async function getSecret(pluginId, secretName) {
  throw new Error(
    `Secret retrieval deferred to Phase 2 (plugin: ${pluginId}, secret: ${secretName})`
  );
}

/**
 * Store a secret for a plugin. Deferred to Phase 2.
 *
 * @param {string} pluginId
 * @param {string} secretName
 * @param {string} value
 * @returns {Promise<never>}
 */
async function storeSecret(pluginId, secretName, _value) {
  throw new Error(
    `Secret storage deferred to Phase 2 (plugin: ${pluginId}, secret: ${secretName})`
  );
}

/**
 * List all secrets for a plugin. Returns empty array (stub).
 *
 * @param {string} pluginId
 * @returns {Promise<string[]>}
 */
async function listSecrets(_pluginId) {
  return [];
}

module.exports = { getSecret, storeSecret, listSecrets };
