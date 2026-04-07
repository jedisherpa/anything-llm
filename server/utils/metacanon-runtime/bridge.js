/**
 * MetaCanon Runtime Bridge
 * Singleton loader for the MetaCanon FFI bridge.
 * Provides lazy initialization with error caching.
 */
const { createMetaCanonClient } = require("./client");

let _client = null;
let _initError = null;

function getMetaCanonClient() {
  if (_client) return _client;
  if (_initError) throw _initError;
  try {
    _client = createMetaCanonClient();
    console.log("[MetaCanon Runtime] Initialized successfully");
    return _client;
  } catch (err) {
    _initError = err;
    console.error("[MetaCanon Runtime] Failed to initialize:", err.message);
    throw err;
  }
}

function isRuntimeAvailable() {
  if (process.env.NODE_ENV === "test") return false;
  try {
    getMetaCanonClient();
    return true;
  } catch {
    return false;
  }
}

module.exports = { getMetaCanonClient, isRuntimeAvailable };
