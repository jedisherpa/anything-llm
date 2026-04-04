/**
 * MetaCanon Governance Document Verification
 * Ensures all 5 canonical governance documents exist and are non-empty at startup.
 */

const fs = require("node:fs");
const path = require("node:path");

const REQUIRED_DOCS = [
  "1_v1.0_The_Canonical_Preamble.docx",
  "2_v2.0_Metacanon_Constitution_Second_Edition.pdf",
  "3_v3.0_Metacanon_Constitution.md",
  "4_Values_and_The_Values_Prism.pdf",
  "5_AI_Only_Lens_Edition_v1.2.md"
];

/**
 * Verify that all required governance documents exist and are non-empty.
 * @param {string} governanceDir - Path to the governance documents directory
 * @returns {object} Verification result with keys: valid, missing, empty, total, found
 */
function verifyGovernanceDocuments(governanceDir) {
  const result = {
    valid: true,
    missing: [],
    empty: [],
    total: REQUIRED_DOCS.length,
    found: 0
  };

  for (const docName of REQUIRED_DOCS) {
    const docPath = path.join(governanceDir, docName);

    if (!fs.existsSync(docPath)) {
      result.missing.push(docName);
      result.valid = false;
      continue;
    }

    result.found++;

    try {
      const stats = fs.statSync(docPath);
      if (stats.size === 0) {
        result.empty.push(docName);
        result.valid = false;
      }
    } catch (err) {
      result.missing.push(docName);
      result.valid = false;
    }
  }

  // Log verification results
  if (result.valid) {
    console.log(
      `[MetaCanon Governance] Verification passed: ${result.found}/${result.total} documents found and valid`
    );
  } else {
    console.error("[MetaCanon Governance] Verification failed:");
    if (result.missing.length > 0) {
      console.error(`  Missing: ${result.missing.join(", ")}`);
    }
    if (result.empty.length > 0) {
      console.error(`  Empty: ${result.empty.join(", ")}`);
    }
  }

  return result;
}

module.exports = {
  verifyGovernanceDocuments,
  REQUIRED_DOCS
};
