/**
 * MetaCanon Auto-Genesis
 * Runs genesis_rite at server startup using governance documents and Prism
 * constitutional values. The Rust runtime is responsible for interpreting the
 * raw document text — this module only reads and passes it.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { isRuntimeAvailable, getMetaCanonClient } = require("./bridge");

// Governance documents directory — relative to the worktree root
const GOVERNANCE_DOCS_DIR = path.resolve(
  __dirname,
  "../../../data/metacanon/governance-documents/Governance_Documents"
);

// The two text-readable governance documents we can pass as constitution content
const TEXT_DOC_NAMES = [
  "3_v3.0_Metacanon_Constitution.md",
  "5_AI_Only_Lens_Edition_v1.2.md",
];

/**
 * Read all available text governance documents and concatenate them.
 * Binary formats (.docx, .pdf) are noted but not read — the Rust runtime
 * may handle them separately. Only readable text is passed here.
 * @returns {string}
 */
function readGovernanceDocuments() {
  const parts = [];

  for (const docName of TEXT_DOC_NAMES) {
    const docPath = path.join(GOVERNANCE_DOCS_DIR, docName);
    if (!fs.existsSync(docPath)) {
      console.warn(`[AutoGenesis] Governance document not found: ${docName}`);
      continue;
    }
    try {
      const content = fs.readFileSync(docPath, "utf8");
      parts.push(`=== ${docName} ===\n${content}`);
    } catch (err) {
      console.warn(
        `[AutoGenesis] Could not read governance document ${docName}: ${err.message}`
      );
    }
  }

  if (parts.length === 0) {
    throw new Error(
      `No readable governance documents found in ${GOVERNANCE_DOCS_DIR}`
    );
  }

  return parts.join("\n\n");
}

/**
 * Build the GenesisRiteRequest from governance documents and Prism
 * constitutional values. The Rust runtime interprets the raw text.
 * @param {string} constitutionText
 * @returns {object} GenesisRiteRequest-shaped object
 */
function buildGenesisConfig(constitutionText) {
  return {
    vision_core: constitutionText,
    core_values: [
      "sovereignty",
      "transparency",
      "human-in-the-loop",
      "no-autonomous-execution-without-validation",
      "no-authority-drift",
    ],
    soul_facets: [],
    human_in_loop: true,
    interpretive_boundaries: [
      "AI agents have no authority to interpret intent, governance, or meaning under ambiguity",
      "All decisions with material impact require explicit human approval",
      "No silent execution — all actions must be traceable",
      "Agents clarify, structure, analyze, and support delegation; they do not act independently",
    ],
    drift_prevention:
      "Actively watch for authority drift, unclear delegation, hidden assumptions, premature conclusions, implicit decisions, and scope creep. Flag them clearly. Never resolve ambiguity independently.",
    enable_morpheus_compute: false,
    morpheus: {},
    will_directives: [
      "Surface unknowns rather than resolve them silently",
      "Return control to the Human Sovereign at every decision threshold",
      "Validate actions against the constitution before execution",
      "Maintain full audit trail of delegated actions",
    ],
    signing_secret:
      process.env.METACANON_SIGNING_SECRET ||
      process.env.SIG_KEY ||
      "prismai-default-signing-secret",
  };
}

// Tracks whether genesis_rite has completed successfully in this process lifetime.
// Exported via isGenesisCompleted() so external callers (e.g. the status endpoint)
// can distinguish "runtime available" from "genesis actually ran and succeeded".
let _genesisCompleted = false;

/**
 * Returns true if autoGenesis() has completed a successful genesis_rite call
 * during this server process lifetime.
 * @returns {boolean}
 */
function isGenesisCompleted() {
  return _genesisCompleted;
}

/**
 * Run genesis_rite using governance documents and Prism constitutional values.
 * Handles missing runtime gracefully — logs a warning but does not crash.
 */
async function autoGenesis() {
  if (!isRuntimeAvailable()) {
    console.warn(
      "[AutoGenesis] MetaCanon runtime is not available — skipping auto-genesis. " +
        "Ensure the native bridge binary is present to enable constitutional validation."
    );
    return;
  }

  console.log(
    "[AutoGenesis] Starting auto-genesis with governance documents..."
  );

  let constitutionText;
  try {
    constitutionText = readGovernanceDocuments();
  } catch (err) {
    console.error(
      `[AutoGenesis] Failed to read governance documents: ${err.message}`
    );
    return;
  }

  const config = buildGenesisConfig(constitutionText);

  try {
    const client = getMetaCanonClient();
    const result = client.genesisRite(config);
    _genesisCompleted = true;
    console.log(
      "[AutoGenesis] Genesis complete. Hash:",
      result && result.genesis_hash ? result.genesis_hash : "(no hash returned)"
    );
  } catch (err) {
    console.error(`[AutoGenesis] genesis_rite failed: ${err.message}`);
  }
}

module.exports = { autoGenesis, isGenesisCompleted };
