/**
 * PrismAI Provider Interface Contract (P2-NEW)
 *
 * Defines the four-method interface that all PrismAI media providers must
 * implement (image, TTS, video, music). Sprint 3 will build media-specific
 * subclasses on top of this single base contract.
 *
 * Exports:
 *   REQUIRED_METHODS     - Ordered list of method names every provider must export
 *   validateProvider(m)  - Returns { valid, errors } for a provider module
 *   createProviderBase() - Returns a stub object with all 4 methods throwing "not implemented"
 *   createMockProvider() - Returns a fully working mock for testing
 */

// ── Contract definition ──────────────────────────────────────────────────────

/**
 * The four methods every provider module must export.
 *
 * @type {string[]}
 */
const REQUIRED_METHODS = [
  "initialize",
  "generate",
  "getCapabilities",
  "estimateCost",
];

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate a provider module against the interface contract.
 *
 * Checks:
 *   1. providerModule is not null/undefined
 *   2. Each of the four required methods exists and is a function
 *   3. getCapabilities() returns an object with at least { id: string, type: string }
 *
 * The capabilities check (rule 3) is a shallow structural check only -- it
 * calls getCapabilities() synchronously and inspects the returned object.
 * If getCapabilities() throws, that is reported as a validation error.
 *
 * @param {object} providerModule - Provider object or class instance to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateProvider(providerModule) {
  const errors = [];

  if (providerModule === null || providerModule === undefined) {
    return { valid: false, errors: ["providerModule is null or undefined"] };
  }

  // Check each required method exists and is a function
  for (const method of REQUIRED_METHODS) {
    if (typeof providerModule[method] !== "function") {
      errors.push(
        `Missing required method: "${method}" (expected function, got ${typeof providerModule[method]})`
      );
    }
  }

  // Only run capabilities check if getCapabilities exists (avoid double-reporting)
  if (typeof providerModule.getCapabilities === "function") {
    try {
      const caps = providerModule.getCapabilities();
      if (!caps || typeof caps !== "object") {
        errors.push(
          "getCapabilities() must return a non-null object with at least { id: string, type: string }"
        );
      } else {
        if (typeof caps.id !== "string" || caps.id.length === 0) {
          errors.push(
            'getCapabilities() return value must include a non-empty "id" string'
          );
        }
        if (typeof caps.type !== "string" || caps.type.length === 0) {
          errors.push(
            'getCapabilities() return value must include a non-empty "type" string'
          );
        }
      }
    } catch (err) {
      errors.push(`getCapabilities() threw during validation: ${err.message}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Provider base stub ───────────────────────────────────────────────────────

/**
 * Create a provider base stub where all four required methods throw
 * "not implemented" errors. Use this as documentation and as a starting
 * point for concrete provider implementations.
 *
 * The base stub intentionally does NOT pass validateProvider() because
 * all four methods throw -- concrete providers must override all of them.
 *
 * @returns {object} Provider base stub
 */
function createProviderBase() {
  return {
    /**
     * One-time setup: validate API key, check endpoint health.
     * @param {object} config - Provider configuration (api key, endpoint, etc.)
     * @returns {Promise<void>}
     */
    async initialize(_config) {
      throw new Error(
        "initialize() not implemented. Override this method in your provider."
      );
    },

    /**
     * Execute the generation (image, audio, video, music).
     * @param {object} params - Generation parameters (provider-specific)
     * @returns {Promise<object>} Provider-specific result object
     */
    async generate(_params) {
      throw new Error(
        "generate() not implemented. Override this method in your provider."
      );
    },

    /**
     * Return static capability metadata for this provider.
     * Must include at minimum: { id: string, type: string, name: string }.
     * @returns {object} Capabilities object
     */
    getCapabilities() {
      throw new Error(
        "getCapabilities() not implemented. Override this method in your provider."
      );
    },

    /**
     * Synchronous pre-flight cost estimate before executing generate().
     * @param {object} params - Same params that would be passed to generate()
     * @returns {{ estimated_cost: number, currency: string, breakdown: object }}
     */
    estimateCost(_params) {
      throw new Error(
        "estimateCost() not implemented. Override this method in your provider."
      );
    },
  };
}

// ── Mock provider ────────────────────────────────────────────────────────────

/**
 * Create a minimal mock provider that satisfies the interface contract.
 * Suitable for testing the validation and registry without a real API.
 *
 * @param {object} [overrides] - Override any method on the mock
 * @returns {object} Valid mock provider
 */
function createMockProvider(overrides = {}) {
  return {
    async initialize(_config) {
      // no-op: mock does not need setup
    },

    async generate(params) {
      return { mock: true, params };
    },

    getCapabilities() {
      return {
        id: "mock",
        type: "test",
        name: "Mock Provider",
        supportedFormats: [],
        maxBatchSize: 1,
      };
    },

    estimateCost(_params) {
      return {
        estimated_cost: 0,
        currency: "USD",
        breakdown: {},
      };
    },

    ...overrides,
  };
}

module.exports = {
  REQUIRED_METHODS,
  validateProvider,
  createProviderBase,
  createMockProvider,
};
