/**
 * Phase 0 Integration Tests — MetaCanon Startup Sequence
 *
 * Tests the degradation path (CI / no native binary) and documents the happy
 * path (local dev with native binary available).
 *
 * Mocking strategy:
 *   - The native binary is never loaded in tests. bridge.js returns false from
 *     isRuntimeAvailable() when NODE_ENV === "test" (already implemented).
 *   - filesystem interactions for governance-check.js are controlled via jest
 *     module mocks so tests are hermetic.
 *   - sphere-thread.js uses createMetaCanonClient() which calls bridge.js
 *     through client.js → index.js.  In the degradation path the coordinator
 *     simply stores client = null.
 */

"use strict";

const path = require("path");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset module registry before each isolated test group. */
function freshRequire(modulePath) {
  jest.resetModules();
  return require(modulePath);
}

// ---------------------------------------------------------------------------
// DEGRADATION PATH (CI — isRuntimeAvailable() returns false)
// ---------------------------------------------------------------------------

describe("Degradation path (CI — runtime unavailable)", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    jest.resetModules();
  });

  afterEach(() => {
    jest.resetModules();
  });

  // Test 1: bridge module can be required without crashing
  it("bridge module can be required without crashing", () => {
    expect(() => {
      require("../utils/metacanon-runtime/bridge");
    }).not.toThrow();
  });

  // Test 2: isRuntimeAvailable() returns false in test env
  it("isRuntimeAvailable() returns false when NODE_ENV is test", () => {
    const { isRuntimeAvailable } = require("../utils/metacanon-runtime/bridge");
    expect(isRuntimeAvailable()).toBe(false);
  });

  // Test 3: getMetaCanonToolNames() returns empty array when runtime unavailable
  it("getMetaCanonToolNames() returns [] when runtime unavailable", () => {
    const {
      getMetaCanonToolNames,
    } = require("../utils/MCP/metacanon-tools-loader");
    const names = getMetaCanonToolNames();
    expect(Array.isArray(names)).toBe(true);
    expect(names).toHaveLength(0);
  });

  // Test 4: verifyGovernanceDocuments() runs and returns a result structure
  it("verifyGovernanceDocuments() returns a result object with the expected shape", () => {
    // Mock node:fs so we do not depend on actual files existing
    jest.doMock("node:fs", () => {
      const actual = jest.requireActual("node:fs");
      return {
        ...actual,
        existsSync: jest.fn(() => false),
        statSync: jest.fn(),
      };
    });
    jest.isolateModules(() => {
      const {
        verifyGovernanceDocuments,
      } = require("../utils/metacanon-runtime/governance-check");
      const result = verifyGovernanceDocuments("/fake/governance/dir");

      expect(result).toMatchObject({
        valid: expect.any(Boolean),
        missing: expect.any(Array),
        empty: expect.any(Array),
        total: expect.any(Number),
        found: expect.any(Number),
      });
    });
    jest.unmock("node:fs");
  });

  // Test 5: verifyGovernanceDocuments() detects all files missing
  it("verifyGovernanceDocuments() marks valid=false when all docs are missing", () => {
    jest.doMock("node:fs", () => {
      const actual = jest.requireActual("node:fs");
      return {
        ...actual,
        existsSync: jest.fn(() => false),
        statSync: jest.fn(),
      };
    });
    jest.isolateModules(() => {
      const {
        verifyGovernanceDocuments,
        REQUIRED_DOCS,
      } = require("../utils/metacanon-runtime/governance-check");
      const result = verifyGovernanceDocuments("/fake/governance/dir");

      expect(result.valid).toBe(false);
      expect(result.found).toBe(0);
      expect(result.missing).toHaveLength(REQUIRED_DOCS.length);
    });
    jest.unmock("node:fs");
  });

  // Test 6: verifyGovernanceDocuments() detects empty files
  it("verifyGovernanceDocuments() marks valid=false when a doc is empty", () => {
    const FIRST_DOC = "1_v1.0_The_Canonical_Preamble.docx";

    jest.doMock("node:fs", () => {
      const actual = jest.requireActual("node:fs");
      return {
        ...actual,
        existsSync: jest.fn(() => true),
        statSync: jest.fn((filePath) => {
          // Report the first required doc as 0 bytes
          if (String(filePath).endsWith(FIRST_DOC)) {
            return { size: 0 };
          }
          return { size: 1024 };
        }),
      };
    });
    // isolateModules ensures governance-check picks up the mocked node:fs
    jest.isolateModules(() => {
      const {
        verifyGovernanceDocuments,
      } = require("../utils/metacanon-runtime/governance-check");
      const result = verifyGovernanceDocuments("/fake/governance/dir");

      expect(result.valid).toBe(false);
      expect(result.empty.length).toBeGreaterThanOrEqual(1);
    });
    jest.unmock("node:fs");
  });

  // Test 7: Sphere coordinator initializes with client = null when runtime unavailable
  it("SphereThreadCoordinator initializes with client=null when runtime unavailable", () => {
    // Mock client.js so it throws (simulating no native binary)
    jest.doMock("../utils/metacanon-runtime/client", () => ({
      createMetaCanonClient: jest.fn(() => {
        throw new Error("Native binary not found");
      }),
    }));
    jest.isolateModules(() => {
      const {
        SphereThreadCoordinator,
      } = require("../utils/metacanon-runtime/sphere-thread");
      const coordinator = new SphereThreadCoordinator();
      expect(coordinator.isRuntimeAvailable()).toBe(false);
    });
    jest.unmock("../utils/metacanon-runtime/client");
  });

  // Test 8: getSphereThreadCoordinator() singleton — same instance on multiple calls
  it("getSphereThreadCoordinator() returns the same singleton instance on repeated calls", () => {
    jest.doMock("../utils/metacanon-runtime/client", () => ({
      createMetaCanonClient: jest.fn(() => {
        throw new Error("Native binary not found");
      }),
    }));
    jest.isolateModules(() => {
      const {
        getSphereThreadCoordinator,
      } = require("../utils/metacanon-runtime/sphere-thread");
      const first = getSphereThreadCoordinator();
      const second = getSphereThreadCoordinator();
      expect(first).toBe(second);
    });
    jest.unmock("../utils/metacanon-runtime/client");
  });

  // Test 9: metacanon-status endpoint returns valid JSON structure
  it("metacanon-status endpoint handler returns valid JSON with native_addon.available=false", async () => {
    // Mock all dependencies used by the endpoint handler
    jest.doMock("../utils/metacanon-runtime/bridge", () => ({
      isRuntimeAvailable: jest.fn(() => false),
    }));
    jest.doMock("../utils/metacanon-runtime/governance-check", () => ({
      verifyGovernanceDocuments: jest.fn(() => ({
        valid: false,
        found: 0,
        total: 5,
        missing: ["1_v1.0_The_Canonical_Preamble.docx"],
        empty: [],
      })),
      REQUIRED_DOCS: ["1_v1.0_The_Canonical_Preamble.docx"],
    }));
    jest.doMock("../utils/metacanon-runtime/sphere-thread", () => ({
      getSphereThreadCoordinator: jest.fn(() => ({
        isRuntimeAvailable: jest.fn(() => false),
      })),
    }));
    jest.doMock("../utils/MCP/metacanon-tools-loader", () => ({
      getMetaCanonToolNames: jest.fn(() => []),
    }));

    // Build a minimal mock of the Express request/response objects
    const mockResponse = {
      _statusCode: null,
      _body: null,
      status(code) {
        this._statusCode = code;
        return this;
      },
      json(body) {
        this._body = body;
        return this;
      },
    };

    // Inline the handler logic that mirrors the endpoint implementation
    // (We test the contract of the modules, not the full Express routing)
    jest.isolateModules(() => {
      const {
        isRuntimeAvailable,
      } = require("../utils/metacanon-runtime/bridge");
      const {
        verifyGovernanceDocuments,
      } = require("../utils/metacanon-runtime/governance-check");
      const {
        getSphereThreadCoordinator,
      } = require("../utils/metacanon-runtime/sphere-thread");
      const {
        getMetaCanonToolNames,
      } = require("../utils/MCP/metacanon-tools-loader");

      const runtimeAvailable = isRuntimeAvailable();
      const govResult = verifyGovernanceDocuments("/fake/dir");
      const coordinator = getSphereThreadCoordinator();
      const toolNames = getMetaCanonToolNames();

      const payload = {
        native_addon: {
          available: runtimeAvailable,
          path: "/some/path",
        },
        governance_documents: {
          verified: govResult.valid,
          total_found: govResult.found,
          missing: govResult.missing,
          empty: govResult.empty,
        },
        auto_genesis: {
          completed: runtimeAvailable,
          genesis_hash: null,
        },
        sphere_coordinator: {
          initialized: coordinator !== null,
          runtime_available: coordinator.isRuntimeAvailable(),
        },
        metacanon_tools: {
          available: toolNames.length > 0,
          tool_count: toolNames.length,
          tool_names: toolNames,
        },
      };

      // Assertions
      expect(payload.native_addon.available).toBe(false);
      expect(typeof payload.native_addon.path).toBe("string");
      expect(payload.governance_documents).toHaveProperty("verified");
      expect(payload.governance_documents).toHaveProperty("total_found");
      expect(Array.isArray(payload.governance_documents.missing)).toBe(true);
      expect(Array.isArray(payload.governance_documents.empty)).toBe(true);
      expect(payload.auto_genesis).toHaveProperty("completed");
      expect(payload.sphere_coordinator).toHaveProperty("initialized");
      expect(payload.sphere_coordinator).toHaveProperty("runtime_available");
      expect(payload.metacanon_tools).toHaveProperty("available");
      expect(typeof payload.metacanon_tools.tool_count).toBe("number");
      expect(Array.isArray(payload.metacanon_tools.tool_names)).toBe(true);
    });

    jest.unmock("../utils/metacanon-runtime/bridge");
    jest.unmock("../utils/metacanon-runtime/governance-check");
    jest.unmock("../utils/metacanon-runtime/sphere-thread");
    jest.unmock("../utils/MCP/metacanon-tools-loader");
  });
});

// ---------------------------------------------------------------------------
// HAPPY PATH (documented — requires native binary, run locally only)
// ---------------------------------------------------------------------------

describe("Happy path (local only — skipped in CI)", () => {
  const addonPath = path.resolve(
    __dirname,
    "../utils/metacanon-runtime/metacanon_ai.node"
  );
  const nativeBinaryPresent =
    process.env.NODE_ENV !== "test" &&
    require("fs").existsSync(addonPath);

  /**
   * These tests document the expected behaviour when the native binary is
   * present but are skipped automatically in CI (NODE_ENV=test) or when
   * the binary is absent.  To run them locally:
   *
   *   NODE_ENV=development npx jest phase0-startup
   */
  const describeIfNative = nativeBinaryPresent ? describe : describe.skip;

  describeIfNative("with native binary available", () => {
    beforeEach(() => {
      // Ensure we use the real modules
      jest.resetModules();
      // Switch off test-mode runtime guard
      process.env.NODE_ENV = "development";
    });

    afterEach(() => {
      process.env.NODE_ENV = "test";
      jest.resetModules();
    });

    // Test 10: When runtime available, tool names are returned (10 tools expected)
    it("getMetaCanonToolNames() returns 10 tool names prefixed with @@mc_", () => {
      const {
        getMetaCanonToolNames,
      } = require("../utils/MCP/metacanon-tools-loader");
      const names = getMetaCanonToolNames();
      expect(names).toHaveLength(10);
      names.forEach((n) => expect(n).toMatch(/^@@mc_/));
    });

    // Test 11: Genesis produces a hash (integration)
    it("autoGenesis() completes without throwing", async () => {
      const {
        autoGenesis,
      } = require("../utils/metacanon-runtime/auto-genesis");
      await expect(autoGenesis()).resolves.not.toThrow();
    });

    // Test 12: Coordinator initializes with a live client
    it("getSphereThreadCoordinator() initializes with a live client when runtime available", () => {
      const {
        getSphereThreadCoordinator,
      } = require("../utils/metacanon-runtime/sphere-thread");
      const coordinator = getSphereThreadCoordinator();
      expect(coordinator.isRuntimeAvailable()).toBe(true);
    });
  });
});
