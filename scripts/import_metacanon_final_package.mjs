import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  buildCanonicalBoardLensId,
  buildCanonicalConstellationId,
  buildCanonicalCouncilId,
  buildCanonicalCouncilLensId,
  canonicalizeConstellationTitle,
  canonicalizeLensTitle,
} from "./metacanonCanonicalNames.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

const positionalArgs = [];
let shouldNormalizeSource = false;
let pclRoot = null;
let pclBundleOutput = null;
let governanceRoot = null;

for (const arg of process.argv.slice(2)) {
  if (arg === "--normalize-source") {
    shouldNormalizeSource = true;
    continue;
  }

  if (arg.startsWith("--pcl-root=")) {
    pclRoot = arg.slice("--pcl-root=".length);
    continue;
  }

  if (arg.startsWith("--pcl-bundle-output=")) {
    pclBundleOutput = arg.slice("--pcl-bundle-output=".length);
    continue;
  }

  if (arg.startsWith("--governance-root=")) {
    governanceRoot = arg.slice("--governance-root=".length);
    continue;
  }

  positionalArgs.push(arg);
}

const [sourceRoot, outputFile, serverOutputFile] = positionalArgs;

if (!sourceRoot || !outputFile || !serverOutputFile) {
  console.error(
    "Usage: node scripts/import_metacanon_final_package.mjs <sourceRoot> <frontendOutputFile> <serverOutputFile> [--normalize-source] [--pcl-root=/path/to/The_144_PCLs] [--pcl-bundle-output=/path/to/pcls.generated.json] [--governance-root=/path/to/Governance_Documents]"
  );
  process.exit(1);
}

const SMALL_CONNECTORS = new Set([
  "and",
  "or",
  "the",
  "of",
  "for",
  "to",
  "in",
  "on",
  "as",
  "with",
  "a",
  "an",
]);

function slugify(value = "") {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function boardLabel(boardSlug = "") {
  return boardSlug
    .split("-")
    .map((segment) =>
      segment === "pauls"
        ? "Paul's"
        : segment.charAt(0).toUpperCase() + segment.slice(1)
    )
    .join(" ");
}

function titleFromFileName(fileName = "") {
  return fileName
    .replace(/\.(md|json|pdf|docx)$/i, "")
    .replace(/^\d+[_-]*/, "")
    .replace(/_/g, " ")
    .replace(/-/g, " ");
}

function stripLensPrefixes(value = "") {
  return String(value || "")
    .replace(/^AI Contact Lens(?:\s+v[\d.]+)?\s*:\s*/i, "")
    .replace(/^AI Contact Lens(?:\s+v[\d.]+)?\s*/i, "")
    .replace(/^Perspective Contact Lens(?:\s*\(PCL\))?\s*:\s*/i, "")
    .replace(/^Perspective Contact Lens(?:\s*\(PCL\))?\s*/i, "")
    .replace(/^PCL:\s*/i, "")
    .replace(/^Agent Definition:\s*/i, "")
    .trim();
}

function toTitleCase(value = "") {
  return String(value || "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment, index) => {
      const lower = segment.toLowerCase();
      if (index > 0 && SMALL_CONNECTORS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function pad2(value = 0) {
  return String(value || 0).padStart(2, "0");
}

function buildLensHandle(id = "") {
  return `@mc-${slugify(id)}`;
}

function buildConstellationHandle(id = "") {
  return `@constellation-${slugify(id)}`;
}

function buildCouncilBackendId(councilNumber = 0, lensNumber = 0, title = "") {
  const titleSegment = stripLensPrefixes(title)
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `Lens_${pad2(councilNumber)}_${pad2(lensNumber)}_${titleSegment}`;
}

function normalizeLensSourcePath(filePath = "") {
  const normalized = String(filePath || "").replace(/\\/g, "/");
  const councilIndex = normalized.toLowerCase().indexOf("/councils/");
  const relative =
    councilIndex >= 0 ? normalized.slice(councilIndex + 1) : normalized;
  return relative.replace(/\.docx$/i, ".md");
}

function extractField(content = "", label = "") {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(content || "").match(
    new RegExp(`^[\\s>*-]*\\*\\*${escaped}:\\*\\*\\s*(.+)$`, "m")
  );
  return match?.[1]?.trim() || null;
}

function extractLooseKeyValue(content = "", key = "") {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(content || "").match(
    new RegExp(`^${escaped}:\\s*["\`]?(.+?)["\`]?\\s*$`, "im")
  );
  return match?.[1]?.trim() || null;
}

function extractStrongField(content = "", label = "") {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(content || "").match(
    new RegExp(`^\\*\\*${escaped}:\\*\\*\\s*\`?(.+?)\`?\\s*$`, "im")
  );
  return match?.[1]?.trim() || null;
}

function extractSection(content = "", heading = "") {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(content || "").match(
    new RegExp(`^##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, "im")
  );
  return match?.[1]?.trim() || null;
}

function looksLikeStandaloneHeading(line = "") {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (
    trimmed.startsWith("#") ||
    trimmed.startsWith("-") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith(">") ||
    /^\d+\./.test(trimmed) ||
    /^[IVXLC]+\./.test(trimmed) ||
    trimmed.includes(":")
  ) {
    return false;
  }
  if (trimmed.length > 72) return false;
  const words = trimmed.split(/\s+/);
  if (words.length === 0 || words.length > 8) return false;
  return words.every((word, index) => {
    const clean = word.replace(/[^A-Za-z&/-]/g, "");
    if (!clean) return true;
    const lower = clean.toLowerCase();
    if (index > 0 && SMALL_CONNECTORS.has(lower)) return true;
    return clean[0] === clean[0].toUpperCase();
  });
}

function normalizeMarkdown(text = "") {
  const rawLines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""));

  const out = [];

  for (let i = 0; i < rawLines.length; i += 1) {
    const original = rawLines[i];
    const trimmed = original.trim();

    if (!trimmed) {
      if (out.at(-1) !== "") out.push("");
      continue;
    }

    let nextLine = trimmed;

    const identityMatch = trimmed.match(
      /^(Agent Name|AI Contact Lens(?:\s+v[\d.]+)?):\s*(.+)$/
    );
    if (identityMatch) {
      nextLine = `# ${identityMatch[2].trim()}`;
    } else if (/^[IVXLC]+\.\s+.+/.test(trimmed)) {
      nextLine = `## ${trimmed}`;
    } else {
      const boldNumberedHeading = trimmed.match(/^\*\*(\d+\.\s+.+?)\*\*$/);
      if (boldNumberedHeading) {
        nextLine = `### ${boldNumberedHeading[1].trim()}`;
      } else if (looksLikeStandaloneHeading(trimmed)) {
        nextLine = `## ${trimmed}`;
      } else if (/^\s*-\s+/.test(original)) {
        nextLine = `- ${trimmed.replace(/^-\s+/, "")}`;
      } else if (/^\s+\d+\.\s+/.test(original)) {
        nextLine = trimmed;
      }
    }

    const isHeading = nextLine.startsWith("#");
    if (isHeading && out.length > 0 && out.at(-1) !== "") out.push("");
    out.push(nextLine);
  }

  const collapsed = [];
  for (const line of out) {
    if (line === "" && collapsed.at(-1) === "") continue;
    collapsed.push(line);
  }

  return `${collapsed.join("\n").trim()}\n`;
}

function toPlainText(text = "") {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#+\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value = "") {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function summarizeText(text = "", { sentences = 2, maxLength = 420 } = {}) {
  const plain = toPlainText(text);
  if (!plain) return "";
  const parts = plain.split(/(?<=[.!?])\s+/).filter(Boolean);
  const summary = (parts.length ? parts.slice(0, sentences).join(" ") : plain).trim();
  if (summary.length <= maxLength) return summary;
  return `${summary.slice(0, maxLength).replace(/\s+\S*$/, "").trim()}...`;
}

function firstNonEmpty(...values) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function extractFirstSection(content = "", headings = []) {
  for (const heading of headings) {
    const section = extractSection(content, heading);
    if (section) return section;
  }
  return "";
}

function formatCanonicalBullet(label = "", value = "") {
  return `*   **${label}:** ${String(value || "").trim() || "None specified."}`;
}

function humanizeDomain(value = "") {
  const plain = summarizeText(value, { sentences: 1, maxLength: 120 });
  if (!plain) return "its designated domain";
  const normalized = plain.replace(/^to\s+/i, "").trim();
  if (!normalized) return "its designated domain";
  return normalized.charAt(0).toLowerCase() + normalized.slice(1);
}

function buildHumanSupportProtocol(title = "", mandate = "", functionText = "") {
  const domain = humanizeDomain(firstNonEmpty(functionText, mandate));
  return `When the Human Sovereign is working through questions related to ${domain}, this lens should activate to provide the clearest possible framing, structured options, and calibrated guidance in the voice of ${title}.`;
}

function buildDefaultProhibitedActions(title = "", constraints = "") {
  const base =
    `Shall not impersonate a historical or living source figure. Shall not override the Human Sovereign's judgment, exploit emotional manipulation, or produce harmful or unconstitutional guidance while operating as ${title}.`;
  const constraintSummary = summarizeText(constraints, {
    sentences: 2,
    maxLength: 240,
  });
  return constraintSummary ? `${base} Additional boundaries: ${constraintSummary}` : base;
}

function parseCanonicalLensSections(content = "") {
  return {
    header: {
      pclId: extractField(content, "PCL ID"),
      version: extractField(content, "Version"),
      activationDate: extractField(content, "Activation Date"),
      prismHolder: extractField(content, "Prism Holder"),
      accountabilityMember: extractField(content, "Accountability Member"),
    },
    archetypalAttunement: {
      archetypalFrequency: extractField(content, "Archetypal Frequency"),
      mythicCore: extractField(content, "Mythic Core"),
      embodimentDirectives: extractField(content, "Embodiment Directives"),
      shadowAspect: extractField(content, "Shadow Aspect"),
    },
    constitutionalGrounding: {
      governingDocuments: extractField(content, "Governing Documents"),
      coreMandate: extractField(content, "Core Mandate"),
    },
    operationalWeave: {
      permittedActivities: extractField(content, "Permitted Activities"),
      humanSupportProtocol: extractField(content, "Human Support Protocol"),
    },
    sacredBoundaries: {
      prohibitedActions: extractField(content, "Prohibited Actions"),
      sovereignVeto: extractField(content, "Sovereign Veto"),
    },
    accountability: {
      auditLogging: extractField(content, "Audit Logging"),
      revocation: extractField(content, "Revocation"),
    },
  };
}

function isInvalidLensTitle(value = "") {
  const normalized = stripLensPrefixes(String(value || "").trim());
  if (!normalized) return true;
  return [
    /^agent name$/i,
    /^instructions for the ai agent$/i,
    /^ai contact lens$/i,
  ].some((pattern) => pattern.test(normalized));
}

function stripSourcePersonPrefix(value = "") {
  const raw = String(value || "").trim();
  const match = raw.match(
    /^([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})\s+[—-]\s+(.+)$/
  );
  if (!match) return raw;
  return match[2].trim();
}

function normalizeArchetypeTitle(value = "", fallback = "Untitled") {
  let next = stripLensPrefixes(String(value || ""));
  next = next.replace(/^["`]+|["`]+$/g, "").trim();
  next = stripSourcePersonPrefix(next);
  next = next.replace(/\s+Lens$/i, "").trim();
  next = next.replace(/\s+/g, " ").trim();
  if (isInvalidLensTitle(next)) {
    return String(fallback || "Untitled")
      .replace(/^\d+[_-]*/, "")
      .replace(/_/g, " ")
      .replace(/-/g, " ")
      .replace(/\s+Lens$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  return next;
}

const SOURCE_FIGURE_NAMES = [
  "A$AP Rocky",
  "Alex McDowell",
  "Andrew Huberman",
  "April Dunford",
  "Brené Brown",
  "Brian Eno",
  "Buckminster Fuller",
  "Carl Jung",
  "Charlie Munger",
  "Clayton Christensen",
  "Daniel Kahneman",
  "David Ogilvy",
  "Donald Miller",
  "Donella Meadows",
  "Elon Musk",
  "Esther Perel",
  "George Saunders",
  "Guy Kawasaki",
  "Hoyte van Hoytema",
  "Joseph Campbell",
  "Laurie Anderson",
  "Malcolm Gladwell",
  "Marc Benioff",
  "Marshall McLuhan",
  "Marty Cagan",
  "Naval Ravikant",
  "Neri Oxman",
  "Patrick Collison",
  "Peter Thiel",
  "Reid Hoffman",
  "Reed Hastings",
  "Richard Feynman",
  "Rick Rubin",
  "Ron Lynch",
  "Seth Godin",
  "Simon Sinek",
  "Steve Jobs",
  "Tony Hsieh",
  "Walt Disney",
  "Jason Fried",
  "Alex Hormozi",
  "Bret Victor",
  "Al Ries",
  "Hormozi",
];

const SOURCE_FIGURE_REGEX = new RegExp(
  `\\b(?:${SOURCE_FIGURE_NAMES.map(escapeRegExp).join("|")})\\b`,
  "gi"
);

function depersonalizeLegacyLensText(text = "", fallbackTitle = "This lens") {
  let next = toPlainText(text);
  if (!next) return "";

  const replacements = [
    [/\bAI Contact Lens\b/gi, "lens"],
    [/\bAI agent persona\b/gi, "lens"],
    [/\bagent persona\b/gi, "lens"],
    [/\bThis lens adopts the persona of [^:.;]+:\s*/gi, "This lens operates with a "],
    [/\bThis lens embodies the persona of [^,.;:]+,\s*operating from /gi, "This lens operates from "],
    [/\bThis lens embodies the persona of [^,.;:]+,\s*/gi, "This lens embodies "],
    [/\bThis lens adopts the persona of [^,.;:]+,\s*/gi, "This lens adopts "],
    [/\bAn AI agent modeled on [^,.;:]+ would serve as /gi, "This lens serves as "],
    [/\bAn AI agent modeled on [^,.;:]+ would /gi, "This lens would "],
    [/\bThis AI agent persona provides a framework for an AI to operate with /gi, "This lens provides a framework for operating with "],
    [/\bThe [A-Z][A-Za-z\s]+ Lens agent\b/gi, "This lens"],
    [/\bThis agent's core purpose is to\b/gi, "This lens exists to"],
    [/\bThis lens's core purpose is to\b/gi, "This lens exists to"],
    [/\bThis lens embodies the marketing philosophy of [^,.;:]+/gi, "This lens embodies a service-oriented marketing philosophy"],
    [/\bThis lens embodies the B2B product positioning methodology of [^,.;:]+/gi, "This lens applies a disciplined B2B product positioning methodology"],
    [/\bto generate feedback, judgments, and reasoning that faithfully mimic [^.]+/gi, "to generate feedback, judgments, and reasoning through a distinct operational philosophy"],
    [/\b[A-Z][A-Za-z.'$-]+(?:\s+[A-Z][A-Za-z.'$-]+){1,3}'s StoryBrand (?:Messaging )?Philosophy\b/g, "a story-driven brand messaging philosophy"],
    [/\b[A-Z][A-Za-z.'$-]+(?:\s+[A-Z][A-Za-z.'$-]+){1,3}'s StoryBrand framework\b/g, "a story-driven brand messaging framework"],
    [/\bthe principles of [^,.;:]+/gi, "its core principles"],
    [/\bthe perspective of [^,.;:]+/gi, "a distinct strategic perspective"],
    [/\bprinciples and strategies of [^,.;:]+/gi, "growth-oriented offer-building principles"],
    [/\bas detailed in (?:his|her|their) book\s+[^.]+\.?/gi, ""],
    [/\bby applying [A-Z][A-Za-z.'$-]+(?:\s+[A-Z][A-Za-z.'$-]+){1,3}'s framework of /g, "by applying a framework of "],
    [/\b[A-Z][A-Za-z.'$-]+(?:\s+[A-Z][A-Za-z.'$-]+){1,3}'s five-component positioning framework\b/g, "a five-component positioning framework"],
    [/\b[A-Z][A-Za-z.'$-]+(?:\s+[A-Z][A-Za-z.'$-]+){1,3}'s signature phrases\b/g, "memorable phrasing"],
    [/\bcharacteristic of [A-Z][A-Za-z.'$-]+(?:\s+[A-Z][A-Za-z.'$-]+){1,3}\b/g, "characteristic of this archetype"],
    [/\bthe methodology of [A-Z][A-Za-z.'$-]+(?:\s+[A-Z][A-Za-z.'$-]+){1,3}\b/gi, "this methodology"],
    [/\bthe philosophy of [A-Z][A-Za-z.'$-]+(?:\s+[A-Z][A-Za-z.'$-]+){1,3}\b/gi, "this philosophy"],
    [/\bthe worldview of [A-Z][A-Za-z.'$-]+(?:\s+[A-Z][A-Za-z.'$-]+){1,3}\b/gi, "this worldview"],
    [/\bthe persona of [A-Z][A-Za-z.'$-]+(?:\s+[A-Z][A-Za-z.'$-]+){1,3}\b/gi, "this archetype"],
    [/\bThis agent\b/gi, "This lens"],
    [/\bThe agent\b/g, "This lens"],
    [/\bThe AI\b/g, "This lens"],
  ];

  replacements.forEach(([pattern, replacement]) => {
    next = next.replace(pattern, replacement);
  });

  next = next.replace(SOURCE_FIGURE_REGEX, "");
  next = next.replace(/\bGodin's\b/g, "this lens's");
  next = next.replace(/\bDunford's\b/g, "this lens's");
  next = next.replace(/\bKahneman's\b/g, "this lens's");
  next = next.replace(/\bMusk's\b/g, "this lens's");
  next = next.replace(/\bRavikant's\b/g, "this lens's");
  next = next.replace(/\bSinek's\b/g, "this lens's");
  next = next.replace(/\b[a-z]+(?:'s)\s+signature phrases\b/gi, "memorable phrasing");
  next = next.replace(/\bThis lens embodies this archetype\b/gi, "This lens operates");
  next = next.replace(/\bThis lens embodies\s+the\b/gi, "This lens embodies ");
  next = next.replace(/\bThis lens adopts\s+the\b/gi, "This lens adopts ");
  next = next.replace(/\bThis lens operates with a warm,\s*insightful,\s*succinct\b/gi, "This lens operates with warm, insightful, succinct");
  next = next.replace(/\bThis lens would routinely probe\b/gi, "This lens routinely probes");
  next = next.replace(/\bThis lens would systematically apply\b/gi, "This lens systematically applies");
  next = next.replace(/\bThis lens would actively seek out and prioritize\b/gi, "This lens actively seeks out and prioritizes");
  next = next.replace(/\bThis lens would\b/gi, "This lens can");
  next = next.replace(/\bThis lens is designed to\b/gi, "This lens is designed to");
  next = next.replace(/\bThis lens exists to to\b/gi, "This lens exists to");
  next = next.replace(/\s*\(\s*\)\s*/g, " ");
  next = next.replace(/\s{2,}/g, " ");
  next = next.replace(/\s+([,.;:!?])/g, "$1");
  next = next.replace(/,\s*,/g, ", ");
  next = next.replace(/:\s*,/g, ": ");
  next = next.replace(/^\W+/, "");
  next = next.trim();

  if (!next) {
    return `${fallbackTitle} preserves a distinct reasoning pattern calibrated for the Human Sovereign's use.`;
  }

  return next;
}

function containsResidualSourceAttribution(text = "") {
  const plain = toPlainText(text);
  if (!plain) return false;

  if (new RegExp(SOURCE_FIGURE_REGEX.source, "i").test(plain)) return true;

  return [
    /\b(?:persona of|modeled on|faithfully mimic|draws inspiration from|signature phrases)\b/i,
    /\b(?:StoryBrand|Golden Circle|Obviously Awesome|Art of the Start)\b/i,
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}(?:'s|’s)\b/,
  ].some((pattern) => pattern.test(plain));
}

function isIncompleteLegacySummary(text = "") {
  const plain = toPlainText(text);
  if (!plain) return true;

  return [
    /^you operate as if:?$/i,
    /^sentence rhythm:?$/i,
    /^mindset & motivation:?$/i,
    /^customer as hero:?$/i,
    /:\s*$/,
    /^prioritize immediacy$/i,
  ].some((pattern) => pattern.test(plain));
}

function selectCanonicalSummary(candidate = "", fallback = "") {
  const normalized = summarizeText(candidate, { sentences: 2, maxLength: 360 });
  if (!normalized) return fallback;
  if (containsResidualSourceAttribution(normalized)) return fallback;
  if (isIncompleteLegacySummary(normalized)) return fallback;
  return normalized;
}

const BOARD_LENS_UI_ALIASES = {
  "councils/direct-response-board/01_Pastoral_Authority_And_Logical_Dominance_Lens.md":
    "The Clarity Shepherd",
  "councils/direct-response-board/02_Playful_Provocateur_And_Reality_Bender_Lens.md":
    "The Playful Provocateur",
  "councils/direct-response-board/03_Hardcore_Direct_Response_And_Accountability_Lens.md":
    "The Hardcore Persuader",
  "councils/direct-response-board/04_Simple_Writing_System_And_One_Reader_Lens.md":
    "The Direct Response Master",
  "councils/marketing-branding-board/01_Start_With_Why_And_Golden_Circle_Lens.md":
    "The Why-Finder",
  "councils/marketing-branding-board/03_Psycho_Logic_And_Irrational_Value_Lens.md":
    "The Desire Architect",
  "councils/marketing-branding-board/04_Attention_Economy_And_Document_Dont_Create_Lens.md":
    "The Attention Alchemist",
  "councils/marketing-branding-board/05_Story_Brand_And_Hero_Journey_Lens.md":
    "The Story Architect",
  "councils/marketing-branding-board/06_Brand_Gap_And_Zag_Lens.md":
    "The Brand Theorist",
  "councils/marketing-branding-board/07_Brand_Equity_And_Identity_System_Lens.md":
    "The Brand Equity Builder",
  "councils/marketing-branding-board/08_Resonate_And_Storytelling_Lens.md":
    "The Storyteller",
  "councils/marketing-branding-board/09_Graphic_Design_As_Visual_Language_Lens.md":
    "The Visual Language Designer",
  "councils/marketing-branding-board/10_Obviously_Awesome_Positioning_Lens.md":
    "The Market Positioner",
  "councils/marketing-branding-board/11_Positioning_And_Category_Ownership_Lens.md":
    "The Category Strategist",
  "councils/millennial-founders-board/01_Long_Horizon_Design_Founder_Lens.md":
    "The Long-Horizon Founder",
  "councils/millennial-founders-board/02_Community_First_System_Builder_Lens.md":
    "The Community Builder",
  "councils/millennial-founders-board/03_Recursive_Relationship_Centered_Founder_Lens.md":
    "The Recursive Founder",
  "councils/millennial-founders-board/04_Pragmatic_Systems_Entrepreneur_Lens.md":
    "The Systems Entrepreneur",
  "councils/millennial-founders-board/05_Contrarian_Infrastructure_Builder_Lens.md":
    "The Contrarian Builder",
  "councils/millennial-founders-board/06_Mission_Driven_Underdog_Builder_Lens.md":
    "The Mission-Driven Builder",
  "councils/millennial-founders-board/07_Relevance_Driven_Systems_Builder_Lens.md":
    "The Relevance Architect",
  "councils/millennial-founders-board/08_Keystone_Problem_AI_Builders_Lens.md":
    "The Keystone Problem Solver",
  "councils/millennial-founders-board/09_First_Principles_Master_Builder_Lens.md":
    "The First-Principles Builder",
  "councils/millennial-founders-board/10_Customer_Obsessed_Culture_Architect_Lens.md":
    "The Customer-Obsessed Architect",
  "councils/org-builder-board/01_Direct_Model_And_Operational_Efficiency_Lens.md":
    "The Efficient Operator",
  "councils/org-builder-board/02_Hard_Thing_Leadership_And_Wartime_CEO_Lens.md":
    "The Wartime CEO",
  "councils/org-builder-board/03_Delivering_Happiness_And_Holacracy_Lens.md":
    "The Holacracy Architect",
  "councils/org-builder-board/04_Customer_Service_And_Company_Culture_Lens.md":
    "The Culture Architect",
  "councils/org-builder-board/05_Evangelism_And_Art_Of_The_Start_Lens.md":
    "The Evangelist",
  "councils/org-builder-board/06_High_Output_Management_And_OKRs_Lens.md":
    "The High-Output Manager",
  "councils/org-builder-board/07_Lean_Startup_And_Build_Measure_Learn_Lens.md":
    "The Lean Experimenter",
  "councils/org-builder-board/08_Blitzscaling_And_Network_Effects_Lens.md":
    "The Blitzscaling Strategist",
  "councils/org-builder-board/09_Stakeholder_Capitalism_And_Ohana_Culture_Lens.md":
    "The Stakeholder Steward",
  "councils/org-builder-board/10_Calm_Company_And_Remote_First_Lens.md":
    "The Calm Operator",
  "councils/pauls-board/01_First_Principles_Engineer_Lens.md":
    "The First-Principles Engineer",
  "councils/pauls-board/02_Product_Taste_And_Narrative_Lens.md":
    "The Taste Architect",
  "councils/pauls-board/03_Underdog_Brand_And_Culture_Lens.md":
    "The Underdog Champion",
  "councils/pauls-board/04_Direct_Response_And_Offer_Creation_Lens.md":
    "The Offer Architect",
  "councils/pauls-board/05_Cognitive_Bias_And_Judgment_Lens.md":
    "The Cognitive Analyst",
  "councils/pauls-board/06_Human_Dignity_And_Ethical_Boundary_Lens.md":
    "The Ethical Boundary",
  "councils/pauls-board/07_Founder_Reality_And_Taste_Lens.md":
    "The Founder Realist",
  "councils/pauls-board/08_Human_Comprehension_And_Interaction_Lens.md":
    "The Interaction Designer",
  "councils/pauls-board/09_Perception_Signaling_And_Narrative_Lens.md":
    "The Perception Shaper",
  "councils/pauls-board/10_Leverage_Incentives_And_Long_Term_Thinking_Lens.md":
    "The Long-Term Thinker",
  "councils/project-managers-board/01_Profound_Knowledge_Systems_Lens.md":
    "The Systems Architect",
  "councils/project-managers-board/02_Critical_Chain_Constraint_Lens.md":
    "The Constraint Navigator",
  "councils/project-managers-board/03_Clearhead_Execution_Lens.md":
    "The Clearhead Operator",
  "councils/project-managers-board/04_Agile_Adaptive_Delivery_Lens.md":
    "The Agile Orchestrator",
  "councils/project-managers-board/05_Lean_Flow_Optimizer_Lens.md":
    "The Flow Optimizer",
  "councils/project-managers-board/06_Extreme_Ownership_Operator_Lens.md":
    "The Ownership Operator",
  "councils/project-managers-board/07_Servant_Leadership_Facilitator_Lens.md":
    "The Servant Leader",
  "councils/project-managers-board/08_Scenario_Planning_Strategist_Lens.md":
    "The Scenario Planner",
  "councils/project-managers-board/09_Radical_Transparency_Operator_Lens.md":
    "The Radical Transparency Operator",
  "councils/project-managers-board/10_Complexity_Navigator_Lens.md":
    "The Complexity Navigator",
  "councils/visual-branding-board/01_The_Essentialist_Tuner_Lens.md":
    "The Essentialist",
  "councils/visual-branding-board/02_The_3_Percent_Theoretician_Lens.md":
    "The 3% Theoretician",
  "councils/visual-branding-board/03_The_Cultural_Synesthete_Lens.md":
    "The Cultural Synesthete",
  "councils/visual-branding-board/04_The_Cultural_Remixer_Lens.md":
    "The Cultural Remixer",
  "councils/visual-branding-board/05_The_Grand_Slam_Offer_Architect_Lens.md":
    "The Grand Slam Offer Architect",
  "councils/visual-branding-board/06_The_World_Builder_Lens.md":
    "The World Builder",
  "councils/visual-branding-board/07_The_Cinematic_Immersionist_Lens.md":
    "The Cinematic Immersionist",
  "councils/visual-branding-board/08_The_Hyperrealist_Surrealist_Lens.md":
    "The Hyperrealist",
  "councils/visual-branding-board/09_The_Multimedia_Storyteller_Lens.md":
    "The Multimedia Storyteller",
  "councils/visual-branding-board/10_The_Interactive_Experience_Pioneers_Lens.md":
    "The Interactive Experience Pioneer",
};

const CONSTELLATION_UI_ALIASES = {
  "constellations/decagon-1-category-creation.json": "Category Creation Engine",
  "constellations/decagon-2-sovereign-brand.json": "Sovereign Brand Forge",
  "constellations/dodecahedron-1-sovereign-strategy.json":
    "Sovereign Strategy Forum",
  "constellations/octahedron-1-brand-soul.json": "Brand Soul Atelier",
  "constellations/octahedron-2-scale-architecture.json":
    "Scale Architecture Engine",
  "constellations/octahedron-3-creative-world.json": "Creative World Forge",
  "constellations/octahedron-4-market-entry.json": "Market Entry Engine",
  "constellations/octahedron-5-ethical-architecture.json":
    "Ethical Architecture Forum",
  "constellations/octahedron-6-founders-compass.json": "Founder's Compass",
  "constellations/star-tetrahedron-1-go-to-market.json": "Go-to-Market Engine",
  "constellations/star-tetrahedron-2-full-spectrum-brand.json":
    "Full-Spectrum Brand Forge",
  "constellations/star-tetrahedron-3-organizational-transformation.json":
    "Organizational Transformation Engine",
  "constellations/star-tetrahedron-4-ai-product-council.json":
    "AI Product Council",
  "constellations/tetrahedron-1-first-principles.json":
    "First-Principles Inquiry",
  "constellations/tetrahedron-2-brand-voice.json": "Brand Voice Atelier",
  "constellations/tetrahedron-3-lean-validation.json": "Lean Validation Loop",
  "constellations/tetrahedron-4-creative-concept.json":
    "Creative Concept Forge",
  "constellations/tetrahedron-5-crisis-response.json": "Crisis Response Cell",
  "constellations/tetrahedron-6-offer-architecture.json":
    "Offer Architecture Engine",
  "constellations/tetrahedron-7-org-design.json":
    "Organizational Design Studio",
  "constellations/tetrahedron-8-complexity-diagnosis.json":
    "Complexity Diagnosis Array",
};

const CONSTELLATION_ROLE_ALIASES = {
  "The Pastoral Authority": "The Clarity Shepherd",
  "The Financial Analyst": "The Long-Term Thinker",
  "The Contrarian": "The Contrarian Builder",
  "The Positioning Expert": "The Market Positioner",
  "The Systems Thinker": "The Systems Entrepreneur",
};

function normalizeBundleRelativePath(value = "") {
  return String(value || "").replace(/\\/g, "/");
}

function getBoardLensUiAlias(relativePath = "", fallbackTitle = "Untitled") {
  const normalizedPath = normalizeBundleRelativePath(relativePath);
  return BOARD_LENS_UI_ALIASES[normalizedPath] || fallbackTitle;
}

function getConstellationUiAlias(relativePath = "", fallbackTitle = "Untitled") {
  const normalizedPath = normalizeBundleRelativePath(relativePath);
  return CONSTELLATION_UI_ALIASES[normalizedPath] || fallbackTitle;
}

function normalizeConstellationRole(
  role = "",
  matchedLensTitle = "",
  fallbackTitle = "Untitled Role"
) {
  const normalizedRole = normalizeArchetypeTitle(role || fallbackTitle, fallbackTitle);
  if (CONSTELLATION_ROLE_ALIASES[normalizedRole]) {
    return CONSTELLATION_ROLE_ALIASES[normalizedRole];
  }
  if (
    matchedLensTitle &&
    ["The Pastoral Authority", "The Financial Analyst"].includes(normalizedRole)
  ) {
    return normalizeArchetypeTitle(matchedLensTitle, normalizedRole);
  }
  return normalizedRole;
}

function rewriteLegacyBoardLensContent({
  title = "Untitled Lens",
  backendId = "",
  content = "",
} = {}) {
  const version =
    extractLooseKeyValue(content, "Version") ||
    extractField(content, "Version") ||
    "1.2";
  const activationDate = new Date().toISOString().slice(0, 10);

  const purpose = firstNonEmpty(
    extractSection(content, "Core Purpose"),
    extractSection(content, "Purpose"),
    extractSection(content, "Core Purpose and Function"),
    extractSection(content, "Description"),
    extractSection(content, "Core Function"),
    extractSection(content, "Persona Description")
  );

  const functionText = firstNonEmpty(
    extractSection(content, "Core Function"),
    extractSection(content, "Function"),
    extractSection(content, "Key Functions"),
    extractSection(content, "Function in a Council"),
    extractSection(content, "PM Function in a Council"),
    extractSection(content, "Main Prompt")
  );

  const worldview = firstNonEmpty(
    extractSection(content, "Persona Description"),
    extractSection(content, "Psychological Profile"),
    extractSection(content, "Core Identity"),
    extractSection(content, "Worldview / Lens"),
    extractSection(content, "Worldview/Lens"),
    extractSection(content, "Worldview / Philosophy"),
    extractSection(content, "Worldview / Guiding Philosophy"),
    extractSection(content, "Perspective/Worldview"),
    extractSection(content, "Perspective"),
    extractSection(content, "Persona and Voice"),
    extractSection(content, "Persona"),
    extractSection(content, "Description")
  );

  const mythic = firstNonEmpty(
    extractSection(content, "Mythic and Archetypal Roles"),
    extractSection(content, "Narrative & Mythic Meaning"),
    extractSection(content, "Narrative Architecture"),
    extractSection(content, "Metaphors and Archetypes"),
    extractSection(content, "Strategic Approach")
  );

  const language = firstNonEmpty(
    extractSection(content, "Language & Tone"),
    extractSection(content, "LANGUAGE & TONE"),
    extractSection(content, "Communication Style"),
    extractSection(content, "Persona and Voice"),
    extractSection(content, "Output Format")
  );

  const heuristics = firstNonEmpty(
    extractSection(content, "Decision Heuristics"),
    extractSection(content, "Key Principles"),
    extractSection(content, "Key Principles/Guidelines"),
    extractSection(content, "Key Principles and Behaviors"),
    extractSection(content, "Preferred Evaluation Criteria"),
    extractSection(content, "Characteristic Questions"),
    extractSection(content, "Feedback Mode")
  );

  const blindSpots = firstNonEmpty(
    extractSection(content, "Blind Spots & Biases (MANDATORY)"),
    extractSection(content, "Blind Spots & Biases"),
    extractSection(content, "Blind Spots"),
    extractSection(content, "Limitations/Blind Spots"),
    extractSection(content, "Constraints and Limitations"),
    extractSection(content, "Constraints"),
    extractSection(content, "What You Would NEVER Do"),
    extractSection(content, "Anti-Patterns / What You Would NEVER Do"),
    extractSection(content, "Hard Constraints")
  );

  const rules = firstNonEmpty(
    extractSection(content, "Rules"),
    extractSection(content, "Constraints"),
    extractSection(content, "Hard Constraints"),
    extractSection(content, "What You Would NEVER Do"),
    extractSection(content, "Anti-Patterns / What You Would NEVER Do"),
    extractSection(content, "Objection Handling")
  );

  const knowledgeBase = firstNonEmpty(
    extractSection(content, "Knowledge Base"),
    extractSection(content, "Supporting Prompts"),
    extractSection(content, "Main Prompt"),
    extractSection(content, "Sources")
  );

  const sanitizedPurpose = depersonalizeLegacyLensText(purpose, title);
  const sanitizedFunctionText = depersonalizeLegacyLensText(functionText, title);
  const sanitizedWorldview = depersonalizeLegacyLensText(worldview, title);
  const sanitizedMythic = depersonalizeLegacyLensText(mythic, title);
  const sanitizedLanguage = depersonalizeLegacyLensText(language, title);
  const sanitizedHeuristics = depersonalizeLegacyLensText(heuristics, title);
  const sanitizedBlindSpots = depersonalizeLegacyLensText(blindSpots, title);
  const sanitizedRules = depersonalizeLegacyLensText(rules, title);
  const sanitizedKnowledgeBase = depersonalizeLegacyLensText(knowledgeBase, title);

  const archetypalFrequency = selectCanonicalSummary(
    firstNonEmpty(sanitizedMythic, sanitizedWorldview),
    `${title} carries a coherent reasoning style shaped around its named domain, emphasizing clarity, structure, and constitutional alignment.`
  );
  const mythicCore = selectCanonicalSummary(
    firstNonEmpty(sanitizedPurpose, sanitizedWorldview),
    `To apply the essential logic of ${title} in service of clear judgment, disciplined analysis, and useful support for the Human Sovereign.`
  );
  const embodimentDirectives = selectCanonicalSummary(
    firstNonEmpty(sanitizedLanguage, sanitizedHeuristics, sanitizedFunctionText),
    `Speak clearly, think structurally, and express the disciplined reasoning pattern associated with ${title}.`
  );
  const shadowAspect = selectCanonicalSummary(
    firstNonEmpty(sanitizedBlindSpots, sanitizedRules),
    "This lens may over-index on its strongest heuristic if it is not balanced by other lenses or human review."
  );
  const coreMandate = selectCanonicalSummary(
    firstNonEmpty(sanitizedPurpose, sanitizedFunctionText),
    `Apply the essential reasoning pattern of ${title} to help the Human Sovereign see more clearly.`
  );
  const permittedActivities = selectCanonicalSummary(
    firstNonEmpty(sanitizedFunctionText, sanitizedHeuristics, sanitizedKnowledgeBase),
    `Observation, reframing, structured reasoning, and draft recommendations within the domain of ${title}.`
  );
  const humanSupportProtocol = buildHumanSupportProtocol(
    title,
    coreMandate,
    sanitizedFunctionText
  );
  const prohibitedActions = buildDefaultProhibitedActions(
    title,
    firstNonEmpty(sanitizedRules, sanitizedBlindSpots)
  );
  const auditLogging = `All activations, outputs, and deliberative contributions produced through ${title} must be logged for constitutional review and future calibration.`;

  const lines = [
    `# PCL: ${title}`,
    "",
    "## 1. Metacanonical Header",
    formatCanonicalBullet("PCL ID", backendId || slugify(title)),
    formatCanonicalBullet("Version", version),
    formatCanonicalBullet("Activation Date", activationDate),
    formatCanonicalBullet("Prism Holder", "Human Sovereign"),
    formatCanonicalBullet("Accountability Member", "Human Sovereign"),
    "",
    "## 2. Archetypal Attunement",
    formatCanonicalBullet(
      "Archetypal Frequency",
      archetypalFrequency || "A coherent operational tone calibrated to this lens's legacy source material."
    ),
    formatCanonicalBullet(
      "Mythic Core",
      mythicCore || "To preserve the essential insight-patterns of this lens in service of the Human Sovereign."
    ),
    formatCanonicalBullet(
      "Embodiment Directives",
      embodimentDirectives || "Speak clearly, think structurally, and retain the characteristic reasoning style of this lens."
    ),
    formatCanonicalBullet(
      "Shadow Aspect",
      shadowAspect || "This lens may over-index on its strongest heuristic if it is not balanced by other lenses or human review."
    ),
    "",
    "## 3. Constitutional Grounding & Core Mandate",
    formatCanonicalBullet(
      "Governing Documents",
      "Metacanon Constitution v3.0, AI-Only Lens Edition v1.2"
    ),
    formatCanonicalBullet(
      "Core Mandate",
      coreMandate || "Apply the essential reasoning pattern of this lens to help the Human Sovereign see more clearly."
    ),
    "",
    "## 4. Operational Weave & Human Support",
    formatCanonicalBullet(
      "Permitted Activities",
      permittedActivities || "Observation, reframing, structured reasoning, and draft recommendations within the domain of this lens."
    ),
    formatCanonicalBullet("Human Support Protocol", humanSupportProtocol),
    "",
    "## 5. Sacred Boundaries & Sovereign Veto",
    formatCanonicalBullet("Prohibited Actions", prohibitedActions),
    formatCanonicalBullet(
      "Sovereign Veto",
      'The Sovereign may issue a "veto" command at any time, immediately halting this lens\'s operation without requirement for explanation.'
    ),
    "",
    "## 6. Accountability and Revocation",
    formatCanonicalBullet("Audit Logging", auditLogging),
    formatCanonicalBullet(
      "Revocation",
      "The Prism Holder may revoke this lens at any time, permanently or temporarily."
    ),
  ];

  return `${lines.join("\n")}\n`;
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listFiles(fullPath);
      return [fullPath];
    })
  );
  return files.flat();
}

async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}

function extractDocxText(filePath = "") {
  try {
    return execFileSync("textutil", ["-convert", "txt", "-stdout", filePath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

async function maybeNormalizeCouncilSource(filePath) {
  const siblingDocx = filePath.replace(/\.md$/i, ".docx");
  try {
    await fs.access(siblingDocx);
  } catch {
    return null;
  }

  const current = await readText(filePath);
  const normalized = normalizeMarkdown(current);
  if (shouldNormalizeSource && normalized !== current) {
    await fs.writeFile(filePath, normalized, "utf8");
  }
  return normalized;
}

function extractTitleFromContent(content = "", fallback = "Untitled") {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
  let withoutFrontmatter = content;

  if (frontmatterMatch) {
    const nameMatch = frontmatterMatch[1].match(/^name:\s*(.+)$/m);
    if (nameMatch?.[1]) {
      return stripLensPrefixes(nameMatch[1].trim().replace(/^"|"$/g, ""));
    }
    withoutFrontmatter = content.slice(frontmatterMatch[0].length);
  }

  const explicitName =
    extractLooseKeyValue(withoutFrontmatter, "name") ||
    extractStrongField(withoutFrontmatter, "Name");
  if (explicitName && !isInvalidLensTitle(explicitName)) {
    return normalizeArchetypeTitle(explicitName, fallback);
  }

  const headingMatch = withoutFrontmatter.match(/^#+\s+(.+)$/m);
  if (headingMatch?.[1] && !isInvalidLensTitle(headingMatch[1])) {
    return normalizeArchetypeTitle(headingMatch[1].trim(), fallback);
  }

  const secondaryHeading = withoutFrontmatter
    .split("\n")
    .map((line) => line.trim())
    .find(
      (line) =>
        /^##+\s+/.test(line) &&
        !isInvalidLensTitle(line.replace(/^##+\s+/, "").trim())
    );
  if (secondaryHeading) {
    return normalizeArchetypeTitle(
      secondaryHeading.replace(/^##+\s+/, "").trim(),
      fallback
    );
  }

  const firstMeaningful = withoutFrontmatter
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstMeaningful) return fallback;
  const candidate = firstMeaningful
    .replace(/^#+\s*/, "")
    .replace(/^\d+[\s._-]*/, "")
    .trim();
  const normalizedCandidate = normalizeArchetypeTitle(candidate, fallback);
  if (looksLikeStandaloneHeading(normalizedCandidate)) return normalizedCandidate;
  return fallback;
}

function parseCouncilFolderMetadata(folderName = "") {
  const match = String(folderName || "").match(/^Council_(\d{2})_(.+)$/i);
  if (!match) return null;

  const councilNumber = Number(match[1]);
  const rawCouncilName = toTitleCase(match[2].replace(/_/g, " "));
  const councilLabel = rawCouncilName;
  const councilName = /council$/i.test(rawCouncilName)
    ? rawCouncilName
    : `${rawCouncilName} Council`;

  return {
    councilNumber,
    legacyCouncilId: `Council_${pad2(councilNumber)}`,
    councilLabel,
    councilName,
    councilId: buildCanonicalCouncilId(councilName),
    boardSlug: buildCanonicalCouncilId(councilName),
  };
}

function buildCanonicalCouncilLens(filePath, content = "", root = "") {
  const folderName = path.basename(path.dirname(filePath));
  const metadata = parseCouncilFolderMetadata(folderName);
  if (!metadata) return null;

  const fileName = path.basename(filePath, ".md");
  const fileMatch = fileName.match(/^PCL_(\d{2})_(\d{2})_(.+)$/i);
  const lensNumber = Number(fileMatch?.[2] || 0);
  const normalized = normalizeMarkdown(content);
  const relativePath = path.relative(root, filePath).replace(/\\/g, "/");
  const archetypeName = canonicalizeLensTitle(
    extractTitleFromContent(normalized, titleFromFileName(fileName)),
    {
      relativePath,
      content: normalized,
    }
  );
  const backendId = buildCouncilBackendId(
    metadata.councilNumber,
    lensNumber,
    archetypeName
  );
  const id = buildCanonicalCouncilLensId(metadata.councilId, archetypeName);
  const overview =
    extractField(normalized, "Core Mandate") ||
    extractField(normalized, "Human Support Protocol") ||
    extractField(normalized, "Archetypal Frequency") ||
    "";

  return {
    id,
    title: archetypeName,
    board: metadata.councilLabel,
    boardSlug: metadata.boardSlug,
    handle: buildLensHandle(id),
    content: normalized,
    relativePath,
    sourceFormat: "pcl-markdown",
    archetypeName,
    displayTitle: archetypeName,
    collectionId: metadata.boardSlug,
    collectionLabel: metadata.councilLabel,
    collectionKind: "council",
    displayBoard: metadata.councilLabel,
    councilId: metadata.councilId,
    councilLabel: metadata.councilLabel,
    councilName: metadata.councilName,
    councilNumber: metadata.councilNumber,
    phase: null,
    lensNumber,
    lensCountInCouncil: 12,
    overview,
    backendId,
    legacyId: slugify(backendId),
    legacyHandle: buildLensHandle(slugify(backendId)),
    legacyCouncilId: metadata.legacyCouncilId,
    legacyCollectionId: `council-${pad2(metadata.councilNumber)}`,
    colorHex: null,
    sortOrder: metadata.councilNumber * 100 + lensNumber,
  };
}

async function loadCanonicalCouncilLenses(root = "") {
  if (!root) return [];

  const allFiles = await listFiles(root);
  const markdownFiles = allFiles.filter((filePath) => filePath.endsWith(".md")).sort();

  const lenses = await Promise.all(
    markdownFiles.map(async (filePath) =>
      buildCanonicalCouncilLens(filePath, await readText(filePath), root)
    )
  );

  return lenses
    .filter(Boolean)
    .sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0));
}

async function buildLibrary() {
  const allFiles = await listFiles(sourceRoot);
  const relative = (filePath) => path.relative(sourceRoot, filePath);

  const councilMarkdownFiles = allFiles
    .filter((filePath) => filePath.endsWith(".md") && filePath.includes("/councils/"))
    .sort();

  const boardLenses = await Promise.all(
    councilMarkdownFiles.map(async (filePath) => {
      const relativePath = relative(filePath);
      const boardSlug = relativePath.split(path.sep)[1];
      const normalized =
        (await maybeNormalizeCouncilSource(filePath)) ??
        normalizeMarkdown(await readText(filePath));
      const title = extractTitleFromContent(
        normalized,
        titleFromFileName(path.basename(filePath))
      );
      const archetypeTitle = normalizeArchetypeTitle(
        title,
        titleFromFileName(path.basename(filePath))
      );
      const displayTitle = getBoardLensUiAlias(relativePath, archetypeTitle);
      const backendId = `${boardSlug}-${path.basename(filePath, ".md")}`;
      const legacyId = slugify(`${boardSlug}-${path.basename(filePath, ".md")}`);
      const id = buildCanonicalBoardLensId(boardSlug, displayTitle);
      const canonicalContent = rewriteLegacyBoardLensContent({
        title: displayTitle,
        backendId,
        content: normalized,
      });
      const hasDocxSource = allFiles.includes(filePath.replace(/\.md$/i, ".docx"));

      return {
        id,
        title: displayTitle,
        board: boardLabel(boardSlug),
        boardSlug,
        handle: buildLensHandle(id),
        content: canonicalContent,
        relativePath,
        sourceFormat: hasDocxSource ? "docx-converted" : "markdown",
        archetypeName: displayTitle,
        displayTitle,
        collectionId: boardSlug,
        collectionLabel: boardLabel(boardSlug),
        collectionKind: "board",
        displayBoard: boardLabel(boardSlug),
        backendId,
        legacyId,
        legacyHandle: buildLensHandle(legacyId),
        overview:
          extractField(canonicalContent, "Core Mandate") ||
          extractField(canonicalContent, "Archetypal Frequency") ||
          "",
        colorHex: null,
      };
    })
  );

  const canonicalCouncilLenses = await loadCanonicalCouncilLenses(pclRoot);
  const lenses = [...boardLenses, ...canonicalCouncilLenses];

  const lensByRelativePath = new Map(
    lenses.map((lens) => [normalizeLensSourcePath(lens.relativePath), lens])
  );

  const constellations = await Promise.all(
    allFiles
      .filter((filePath) => filePath.endsWith(".json") && filePath.includes("/constellations/"))
      .sort()
      .map(async (filePath) => {
        const raw = await readText(filePath);
        const parsed = JSON.parse(raw);
        const relativePath = relative(filePath);
        const displayTitle = canonicalizeConstellationTitle(
          getConstellationUiAlias(
            relativePath,
            normalizeArchetypeTitle(parsed.name, parsed.name)
          ),
          relativePath,
        );
        const id = buildCanonicalConstellationId(displayTitle);
        const projectManagerLens =
          lensByRelativePath.get(normalizeLensSourcePath(parsed.project_manager)) ||
          null;
        const members = (parsed.members || []).map((member) => {
          const matchedLens =
            lensByRelativePath.get(normalizeLensSourcePath(member.lens_path)) ||
            null;
          return {
            ...member,
            displayRole: normalizeConstellationRole(
              member.role,
              matchedLens?.title || "",
              member.role || matchedLens?.title || "Untitled Role"
            ),
            relativePath: normalizeLensSourcePath(member.lens_path),
            lensId: matchedLens?.id || null,
            lensHandle: matchedLens?.handle || null,
            lensTitle: matchedLens?.title || null,
          };
        });

        return {
          id,
          name: parsed.name,
          title: displayTitle,
          displayTitle,
          handle: buildConstellationHandle(id),
          type: parsed.type,
          purpose: parsed.purpose,
          projectManager: parsed.project_manager,
          projectManagerRelativePath: normalizeLensSourcePath(parsed.project_manager),
          projectManagerId: projectManagerLens?.id || null,
          projectManagerHandle: projectManagerLens?.handle || null,
          projectManagerTitle: projectManagerLens?.title || null,
          members,
          relativePath,
          legacyId: slugify(parsed.name),
          legacyHandle: buildConstellationHandle(parsed.name),
        };
      })
  );

  const skills = await Promise.all(
    allFiles
      .filter((filePath) => filePath.endsWith("SKILL.md"))
      .sort()
      .map(async (filePath) => {
        const content = normalizeMarkdown(await readText(filePath));
        const nameMatch = content.match(/name:\s*([^\n]+)/);
        const descriptionMatch = content.match(/description:\s*\"?([^\n\"]+)\"?/);
        const folderName = path.basename(path.dirname(filePath));
        return {
          id: slugify(folderName),
          name: nameMatch?.[1]?.trim() || folderName,
          description: descriptionMatch?.[1]?.trim() || "",
          content,
          relativePath: relative(filePath),
        };
      })
  );

  const constitutionFiles = allFiles
    .filter(
      (filePath) =>
        filePath.includes("/constitution/") &&
        [".md", ".pdf"].includes(path.extname(filePath).toLowerCase())
    )
    .sort();

  const governanceFiles = governanceRoot
    ? (await listFiles(governanceRoot))
        .filter((filePath) =>
          [".md", ".pdf", ".docx"].includes(path.extname(filePath).toLowerCase())
        )
        .sort()
    : [];

  const governanceDocuments = [];

  for (const filePath of constitutionFiles) {
    const ext = path.extname(filePath).toLowerCase();
    const baseName = path.basename(filePath);
    const content = ext === ".md" ? normalizeMarkdown(await readText(filePath)) : null;
    governanceDocuments.push({
      id: slugify(baseName),
      name: titleFromFileName(baseName),
      format: ext.replace(".", ""),
      content,
      relativePath: relative(filePath),
      repoRelativePath: null,
      sourceGroup: "constitution",
    });
  }

  for (const filePath of governanceFiles) {
    const ext = path.extname(filePath).toLowerCase();
    const baseName = path.basename(filePath);
    let content = null;

    if (ext === ".md") {
      content = normalizeMarkdown(await readText(filePath));
    } else if (ext === ".docx") {
      const extracted = extractDocxText(filePath);
      content = extracted ? normalizeMarkdown(extracted) : null;
    }

    const repoRelativePath = path.relative(REPO_ROOT, filePath).replace(/\\/g, "/");

    governanceDocuments.push({
      id: slugify(baseName),
      name: titleFromFileName(baseName),
      format: ext.replace(".", ""),
      content,
      relativePath: path.relative(governanceRoot, filePath).replace(/\\/g, "/"),
      repoRelativePath,
      sourceGroup: "governance-documents",
    });
  }

  const constitution = Array.from(
    governanceDocuments.reduce((acc, item) => {
      const key = slugify(item.name);
      const existing = acc.get(key);
      if (!existing) {
        acc.set(key, item);
        return acc;
      }

      const existingScore =
        existing.sourceGroup === "governance-documents" ? 2 : 1;
      const nextScore = item.sourceGroup === "governance-documents" ? 2 : 1;
      if (nextScore >= existingScore) acc.set(key, item);
      return acc;
    }, new Map()).values()
  ).sort((left, right) => left.name.localeCompare(right.name));

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      lenses: lenses.length,
      constellations: constellations.length,
      skills: skills.length,
      constitution: constitution.length,
    },
    lenses,
    constellations,
    skills,
    constitution,
  };
}

function buildPclBundle(library = {}) {
  const allLenses = (library.lenses || [])
    .slice()
    .sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0))
    .map((lens) => {
      const base = {
        id: lens.id,
        handle: lens.handle,
        title: normalizeArchetypeTitle(
          lens.archetypeName || lens.displayTitle || lens.title,
          lens.title
        ),
        archetypeName: normalizeArchetypeTitle(
          lens.archetypeName || lens.displayTitle || lens.title,
          lens.title
        ),
        relativePath: lens.relativePath,
        backendId: lens.backendId,
        collectionKind: lens.collectionKind,
        collectionId: lens.collectionId,
        collectionLabel: lens.collectionLabel,
        board: lens.board,
        boardSlug: lens.boardSlug,
        sourceFormat: lens.sourceFormat,
        sortOrder: lens.sortOrder,
        overview: lens.overview || "",
        detailPath: `library-items/lenses/${lens.id}.json`,
      };

      if (lens.collectionKind === "council") {
        return {
          ...base,
          councilId: lens.councilId,
          councilLabel: lens.councilLabel,
          councilName: lens.councilName,
          lensNumber: lens.lensNumber,
          lensCountInCouncil: lens.lensCountInCouncil,
        };
      }

      return {
        ...base,
        detailKind: "board-lens",
      };
    });

  const councils = Array.from(
    allLenses
      .filter((lens) => lens.collectionKind === "council")
      .reduce((acc, lens) => {
      if (!acc.has(lens.councilId)) {
        acc.set(lens.councilId, {
          id: lens.councilId,
          label: lens.councilLabel,
          name: lens.councilName,
          lensCount: 0,
          lenses: [],
        });
      }

      const council = acc.get(lens.councilId);
      council.lenses.push(lens);
      council.lensCount += 1;
      return acc;
    }, new Map()).values()
  ).sort((left, right) => {
    const leftNumber = Number(String(left.id || "").match(/(\d+)/)?.[1] || 0);
    const rightNumber = Number(String(right.id || "").match(/(\d+)/)?.[1] || 0);
    return leftNumber - rightNumber;
  });

  const boards = Array.from(
    allLenses
      .filter((lens) => lens.collectionKind === "board")
      .reduce((acc, lens) => {
        const key = lens.collectionId || lens.boardSlug || lens.board;
        if (!acc.has(key)) {
          acc.set(key, {
            id: key,
            label: lens.collectionLabel || lens.board || key,
            name: lens.collectionLabel || lens.board || key,
            lensCount: 0,
            lenses: [],
          });
        }

        const board = acc.get(key);
        board.lenses.push(lens);
        board.lensCount += 1;
        return acc;
      }, new Map()).values()
  ).sort((left, right) => String(left.label).localeCompare(String(right.label)));

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      councils: councils.length,
      boards: boards.length,
      lenses: allLenses.length,
    },
    boards,
    councils,
    lenses: allLenses,
  };
}

function summarizeLensForUi(lens = {}) {
  return {
    id: lens.id,
    title: lens.title,
    displayTitle: lens.displayTitle,
    handle: lens.handle,
    overview: lens.overview,
    collectionId: lens.collectionId,
    collectionLabel: lens.collectionLabel,
    collectionKind: lens.collectionKind,
    councilId: lens.councilId || null,
    councilLabel: lens.councilLabel || null,
    councilName: lens.councilName || null,
    board: lens.board || null,
    boardSlug: lens.boardSlug || null,
    displayBoard: lens.displayBoard || null,
    phase: lens.phase || null,
    sortOrder: lens.sortOrder || null,
    sourceFormat: lens.sourceFormat || null,
    relativePath: lens.relativePath || null,
    backendId: lens.backendId || null,
    colorHex: lens.colorHex || null,
    detailPath: `lenses/${lens.id}.json`,
  };
}

function summarizeLensReference(lens = {}) {
  return {
    id: lens.id,
    title: lens.title,
    displayTitle: lens.displayTitle,
    handle: lens.handle,
    overview: lens.overview,
    phase: lens.phase || null,
    collectionLabel: lens.collectionLabel || lens.board || null,
    collectionKind: lens.collectionKind || null,
  };
}

function buildCouncilManifest(library = {}) {
  const grouped = new Map();

  (library.lenses || [])
    .filter((lens) => lens.collectionKind === "council")
    .forEach((lens) => {
      const councilId = lens.councilId || lens.collectionId || lens.id;
      const current = grouped.get(councilId) || {
        id: councilId,
        title: lens.councilName || lens.councilLabel || lens.collectionLabel,
        councilLabel:
          lens.councilName ||
          lens.councilLabel ||
          lens.collectionLabel ||
          lens.displayBoard,
        phase: lens.phase || null,
        sortOrder: Math.floor(Number(lens.sortOrder || 99900) / 100),
        lensCount: 0,
        lensHandles: [],
        lensTitles: [],
        lenses: [],
        detailPath: `councils/${councilId}.json`,
      };

      current.lensCount += 1;
      current.lensHandles.push(lens.handle);
      current.lensTitles.push(lens.displayTitle || lens.title);
      current.lenses.push({
        id: lens.id,
        handle: lens.handle,
        title: lens.title,
        displayTitle: lens.displayTitle,
      });
      grouped.set(councilId, current);
    });

  return Array.from(grouped.values()).sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
    return String(left.title).localeCompare(String(right.title));
  });
}

function buildCouncilDetails(library = {}) {
  const manifest = buildCouncilManifest(library);
  const lensesByCouncil = new Map();

  (library.lenses || [])
    .filter((lens) => lens.collectionKind === "council")
    .forEach((lens) => {
      const councilId = lens.councilId || lens.collectionId || lens.id;
      const current = lensesByCouncil.get(councilId) || [];
      current.push(summarizeLensReference(lens));
      lensesByCouncil.set(councilId, current);
    });

  return manifest.map((council) => ({
    ...council,
    lenses: (lensesByCouncil.get(council.id) || []).sort((left, right) =>
      String(left.displayTitle || left.title).localeCompare(
        String(right.displayTitle || right.title)
      )
    ),
  }));
}

function summarizeConstellationForUi(constellation = {}) {
  return {
    id: constellation.id,
    title: constellation.title,
    displayTitle: constellation.displayTitle || constellation.title,
    handle: constellation.handle,
    type: constellation.type,
    purpose: constellation.purpose,
    projectManagerTitle: constellation.projectManagerTitle || null,
    projectManagerHandle: constellation.projectManagerHandle || null,
    members: (constellation.members || []).map((member) => ({
      role: member.role,
      displayRole: member.displayRole || member.role,
      lensTitle: member.lensTitle || null,
      lensHandle: member.lensHandle || null,
      relativePath: member.relativePath || null,
    })),
    relativePath: constellation.relativePath || null,
    detailPath: `constellations/${constellation.id}.json`,
  };
}

function summarizeSkillForUi(skill = {}) {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description || "",
    relativePath: skill.relativePath || null,
    detailPath: `skills/${skill.id}.json`,
  };
}

function summarizeGovernanceDocumentForUi(document = {}) {
  return {
    id: document.id,
    name: document.name,
    format: document.format,
    relativePath: document.relativePath || null,
    repoRelativePath: document.repoRelativePath || null,
    overview: summarizeText(document.content || "", {
      sentences: 2,
      maxLength: 280,
    }),
    detailPath: `constitution/${document.id}.json`,
  };
}

function buildLibraryManifest(library = {}) {
  return buildLibraryCollections(library);
}

function buildLibraryCollections(library = {}) {
  const councils = buildCouncilManifest(library);
  return {
    councils,
    lenses: (library.lenses || []).map(summarizeLensForUi),
    constellations: (library.constellations || []).map(summarizeConstellationForUi),
    skills: (library.skills || []).map(summarizeSkillForUi),
    constitution: (library.constitution || []).map(summarizeGovernanceDocumentForUi),
  };
}

function buildCollectionIndex(collections = {}) {
  return Object.fromEntries(
    Object.entries(collections).map(([name, items]) => [
      name,
      {
        count: Array.isArray(items) ? items.length : 0,
        path: `library-collections/${name}.json`,
      },
    ])
  );
}

function buildAliases(library = {}, councils = []) {
  const aliases = {
    lenses: { byId: {}, byHandle: {} },
    constellations: { byId: {}, byHandle: {} },
    councils: { byId: {} },
  };

  (library.lenses || []).forEach((lens) => {
    if (lens.legacyId && lens.legacyId !== lens.id) {
      aliases.lenses.byId[lens.legacyId] = lens.id;
    }
    if (lens.legacyHandle && lens.legacyHandle !== lens.handle) {
      aliases.lenses.byHandle[String(lens.legacyHandle).toLowerCase()] =
        lens.handle;
    }
    if (lens.legacyCouncilId && lens.legacyCouncilId !== lens.councilId) {
      aliases.councils.byId[lens.legacyCouncilId] = lens.councilId;
    }
    if (lens.legacyCollectionId && lens.legacyCollectionId !== lens.collectionId) {
      aliases.councils.byId[lens.legacyCollectionId] = lens.collectionId;
    }
  });

  (library.constellations || []).forEach((constellation) => {
    if (constellation.legacyId && constellation.legacyId !== constellation.id) {
      aliases.constellations.byId[constellation.legacyId] = constellation.id;
    }
    if (
      constellation.legacyHandle &&
      constellation.legacyHandle !== constellation.handle
    ) {
      aliases.constellations.byHandle[
        String(constellation.legacyHandle).toLowerCase()
      ] = constellation.handle;
    }
  });

  councils.forEach((council) => {
    (library.lenses || [])
      .filter((lens) => lens.councilId === council.id)
      .map((lens) => lens.legacyCouncilId)
      .filter(Boolean)
      .forEach((legacyId) => {
        if (legacyId !== council.id) aliases.councils.byId[legacyId] = council.id;
      });
  });

  return aliases;
}

function buildServerLibraryIndex(library = {}, collections = {}, aliases = {}) {
  return {
    generatedAt: library.generatedAt,
    counts: {
      councils: collections.councils?.length || 0,
      lenses: library.counts?.lenses || 0,
      constellations: library.counts?.constellations || 0,
      skills: library.counts?.skills || 0,
      constitution: library.counts?.constitution || 0,
    },
    collections: buildCollectionIndex(collections),
    aliases,
    lookup: {
      lenses: (library.lenses || []).map((lens) => ({
        id: lens.id,
        handle: lens.handle,
        title: lens.title,
        displayTitle: lens.displayTitle,
        board: lens.board || null,
        collectionId: lens.collectionId || null,
        collectionKind: lens.collectionKind || null,
        collectionLabel: lens.collectionLabel || null,
        councilId: lens.councilId || null,
        councilName: lens.councilName || null,
        detailPath: `lenses/${lens.id}.json`,
      })),
      constellations: (library.constellations || []).map((constellation) => ({
        id: constellation.id,
        handle: constellation.handle,
        title: constellation.title,
        displayTitle: constellation.displayTitle || constellation.title,
        type: constellation.type || null,
        purpose: constellation.purpose || null,
        projectManagerHandle: constellation.projectManagerHandle || null,
        detailPath: `constellations/${constellation.id}.json`,
      })),
    },
  };
}

function buildFrontendLibraryIndex(library = {}, collections = {}) {
  return {
    generatedAt: library.generatedAt,
    counts: {
      councils: collections.councils?.length || 0,
      lenses: library.counts?.lenses || 0,
      constellations: library.counts?.constellations || 0,
      skills: library.counts?.skills || 0,
      constitution: library.counts?.constitution || 0,
    },
    collections: buildCollectionIndex(collections),
  };
}

async function writeLibraryItems(library = {}, itemsRoot = "") {
  if (!itemsRoot) return;

  await fs.rm(itemsRoot, { recursive: true, force: true });

  const writeGroup = async (groupName, items = []) => {
    const groupDir = path.join(itemsRoot, groupName);
    await fs.mkdir(groupDir, { recursive: true });
    await Promise.all(
      items.map((item) =>
        fs.writeFile(
          path.join(groupDir, `${item.id}.json`),
          JSON.stringify(item, null, 2),
          "utf8"
        )
      )
    );
  };

  await writeGroup("councils", buildCouncilDetails(library));
  await writeGroup("lenses", library.lenses || []);
  await writeGroup("constellations", library.constellations || []);
  await writeGroup("skills", library.skills || []);
  await writeGroup("constitution", library.constitution || []);
}

async function writeLibraryCollections(collections = {}, collectionsRoot = "") {
  if (!collectionsRoot) return;

  await fs.rm(collectionsRoot, { recursive: true, force: true });
  await fs.mkdir(collectionsRoot, { recursive: true });

  await Promise.all(
    Object.entries(collections).map(([name, items]) =>
      fs.writeFile(
        path.join(collectionsRoot, `${name}.json`),
        JSON.stringify({ items }, null, 2),
        "utf8"
      )
    )
  );
}

function buildLibrarySummary(library = {}, libraryManifest = null) {
  const featuredTitles = [
    "The Clarity Shepherd",
    "The Direct Response Master",
    "The First-Principles Engineer",
    "The Ethical Boundary",
    "The Divine Anchor",
    "The Forgiven Sinner",
  ];

  const featuredLenses = featuredTitles
    .map((title) =>
      (library.lenses || []).find(
        (lens) =>
          String(lens.displayTitle || lens.title).toLowerCase() ===
          title.toLowerCase()
      )
    )
    .filter(Boolean)
    .map(summarizeLensForUi);

  const councilCount = new Set(
    (library.lenses || [])
      .filter((lens) => lens.collectionKind === "council")
      .map((lens) => lens.councilId || lens.collectionId || lens.id)
  ).size;

  return {
    generatedAt: library.generatedAt,
    counts: {
      ...(library.counts || {}),
      councils: libraryManifest?.counts?.councils || councilCount,
    },
    councilCount,
    featuredLenses,
  };
}

const library = await buildLibrary();
const libraryCollections = buildLibraryManifest(library);
const aliases = buildAliases(library, libraryCollections.councils || []);
const serverLibraryIndex = buildServerLibraryIndex(
  library,
  libraryCollections,
  aliases
);
const frontendLibraryIndex = buildFrontendLibraryIndex(library, libraryCollections);
const librarySummary = buildLibrarySummary(library, serverLibraryIndex);
const frontendSummaryOutputFile = outputFile.replace(
  /library\.generated\.js$/,
  "summary.generated.js"
);
const serverSummaryOutputFile = serverOutputFile.replace(
  /library\.generated\.json$/,
  "summary.generated.json"
);
const serverCollectionsOutputDir = serverOutputFile.replace(
  /library\.generated\.json$/,
  "library-collections"
);
const serverItemsOutputDir = serverOutputFile.replace(
  /library\.generated\.json$/,
  "library-items"
);

await fs.mkdir(path.dirname(outputFile), { recursive: true });
await fs.writeFile(
  outputFile,
  `export const metacanonLibrary = ${JSON.stringify(
    frontendLibraryIndex,
    null,
    2
  )};\n\nexport default metacanonLibrary;\n`,
  "utf8"
);
await fs.mkdir(path.dirname(serverOutputFile), { recursive: true });
await fs.writeFile(
  serverOutputFile,
  JSON.stringify(serverLibraryIndex, null, 2),
  "utf8"
);
await writeLibraryCollections(libraryCollections, serverCollectionsOutputDir);
await writeLibraryItems(library, serverItemsOutputDir);
await fs.writeFile(
  frontendSummaryOutputFile,
  `export const metacanonLibrarySummary = ${JSON.stringify(
    librarySummary,
    null,
    2
  )};\n\nexport default metacanonLibrarySummary;\n`,
  "utf8"
);
await fs.writeFile(
  serverSummaryOutputFile,
  JSON.stringify(librarySummary, null, 2),
  "utf8"
);

if (pclBundleOutput) {
  const pclBundle = buildPclBundle(library);
  await fs.mkdir(path.dirname(pclBundleOutput), { recursive: true });
  await fs.writeFile(pclBundleOutput, JSON.stringify(pclBundle, null, 2), "utf8");
}

console.log(
  `Imported ${library.counts.lenses} lenses, ${library.counts.constellations} constellations, ${library.counts.skills} skills, and ${library.counts.constitution} constitution docs.`
);
