export const METACANON_TERMS = {
  prism: "Prism",
  lens: "Lens",
  lenses: "Lenses",
  council: "Council",
  councils: "Councils",
  subSphere: "Preset",
  subSpheres: "Presets",
  constellation: "Constellation",
  constellations: "Constellations",
  savedConstellations: "Saved Constellations",
  governanceDocuments: "Governance Documents",
  studio: "Studio",
  sanctuary: "Sanctuary",
  align: "Align",
  alignPrism: "Align Prism",
  awakenPrism: "Awaken Prism",
  feedPrism: "Feed Prism",
  exploreArtifact: "Explore the Artifact",
};

const TITLE_PREFIX_PATTERNS = [
  /^PCL:\s*/i,
  /^AI Contact Lens(?: v[\d.]+)?\s*:\s*/i,
  /^AI Contact Lens(?: v[\d.]+)?\s*/i,
  /^Perspective Contact Lens(?:\s*\(PCL\))?\s*:\s*/i,
  /^Perspective Contact Lens(?:\s*\(PCL\))?\s*/i,
];

const SOURCE_FIGURE_PATTERNS = [
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
  "Donella Meadows",
  "Elon Musk",
  "Esther Perel",
  "George Saunders",
  "Hoyte van Hoytema",
  "Joseph Campbell",
  "Laurie Anderson",
  "Malcolm Gladwell",
  "Marshall McLuhan",
  "Marty Cagan",
  "Naval Ravikant",
  "Neri Oxman",
  "Patrick Collison",
  "Peter Thiel",
  "Reed Hastings",
  "Richard Feynman",
  "Rick Rubin",
  "Ron Lynch",
  "Seth Godin",
  "Simon Sinek",
  "Steve Jobs",
  "Walt Disney",
].map(
  (value) =>
    new RegExp(`\\b${value.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "gi")
);

export function sanitizeLensTitle(value = "") {
  let next = String(value || "").trim();
  TITLE_PREFIX_PATTERNS.forEach((pattern) => {
    next = next.replace(pattern, "");
  });
  next = next.replace(/\s+Lens$/i, "").trim();
  return next || String(value || "").trim();
}

export function sanitizeCollectionLabel(value = "") {
  const label = String(value || "").trim();
  if (!label) return "Library";
  if (/^direct response board$/i.test(label)) return METACANON_TERMS.studio;
  if (/^.+ board$/i.test(label)) return label.replace(/\s+board$/i, " Studio");
  return label;
}

export function sanitizeSubSphereTitle(value = "") {
  let next = String(value || "").trim();
  next = next.replace(
    /^(Decagon|Dodecahedron|Octahedron|Star Tetrahedron|Tetrahedron)\s+\d+:\s*/i,
    ""
  );
  next = next.replace(/^The\s+/i, "");
  next = next.replace(/^"(.*)"$/, "$1");
  next = next.replace(/\s+Council$/i, "");
  next = next.replace(/\s+Quad$/i, "");
  next = next.trim();
  return next || String(value || "").trim();
}

export function sanitizeUiContent(value = "") {
  let next = String(value || "");
  if (!next.trim()) return "";

  const replacements = [
    [/\bThe AI\b/g, METACANON_TERMS.prism],
    [/\bThe Bot\b/g, METACANON_TERMS.prism],
    [/\bAI Contact Lens Constitution\b/g, "Lens Constitution"],
    [/\bAI Contact Lens(?: v[\d.]+)?\b/g, METACANON_TERMS.lens],
    [/\bPerspective Contact Lens(?:\s*\(PCL\))?\b/g, METACANON_TERMS.lens],
    [/\bPCLs\b/g, METACANON_TERMS.lenses],
    [/\bPCL\b/g, METACANON_TERMS.lens],
    [/\bDirect Response Board\b/g, METACANON_TERMS.studio],
    [/^###?\s+1\.\s+Agent Name\s*$/gim, ""],
    [/^##+\s+AI Contact Lens(?: v[\d.]+)?\s*:?\s*/gim, "## "],
  ];

  replacements.forEach(([pattern, replacement]) => {
    next = next.replace(pattern, replacement);
  });

  SOURCE_FIGURE_PATTERNS.forEach((pattern) => {
    next = next.replace(pattern, "");
  });

  next = next
    .replace(/\bthe persona of\b/gi, "the archetype of")
    .replace(/\bmodeled on\b/gi, "structured as")
    .replace(
      /\bcharacteristic of this archetype\b/gi,
      "characteristic of this lens"
    )
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ");

  next = next.replace(/\n{3,}/g, "\n\n").trim();
  return next;
}

function escapeRegExp(value = "") {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sanitizeLensContentForUi(value = "", lens = {}) {
  let next = sanitizeUiContent(value);
  const displayTitle = getLensUiTitle(lens);
  const legacyTitle = sanitizeLensTitle(lens.legacyTitle || "");

  if (legacyTitle && displayTitle && legacyTitle !== displayTitle) {
    next = next.replace(
      new RegExp(
        escapeRegExp(`AI Contact Lens v1.2: ${legacyTitle} Lens`),
        "gi"
      ),
      displayTitle
    );
    next = next.replace(
      new RegExp(escapeRegExp(`${legacyTitle} Lens`), "gi"),
      displayTitle
    );
    next = next.replace(
      new RegExp(escapeRegExp(legacyTitle), "g"),
      displayTitle
    );
  }

  return next.replace(/\n{3,}/g, "\n\n").trim();
}

export function getLensUiTitle(lens = {}) {
  return sanitizeLensTitle(
    lens.archetypeName ||
      lens.displayTitle ||
      lens.title ||
      lens.name ||
      "Untitled Lens"
  );
}

export function getLensUiCollectionLabel(lens = {}) {
  if (lens.collectionKind === "council" && lens.councilName) {
    return sanitizeCollectionLabel(lens.councilName);
  }
  return sanitizeCollectionLabel(
    lens.collectionLabel ||
      lens.councilLabel ||
      lens.displayBoard ||
      lens.board ||
      "Library"
  );
}

export function getSubSphereUiTitle(item = {}) {
  return sanitizeSubSphereTitle(
    item.displayTitle || item.title || item.name || "Untitled Preset"
  );
}

export function getCouncilUiTitle(item = {}) {
  return sanitizeCollectionLabel(
    item.councilName ||
      item.title ||
      item.name ||
      item.councilLabel ||
      "Untitled Council"
  );
}

export function getConstellationRoleUiTitle(member = {}) {
  return sanitizeLensTitle(
    member.displayRole || member.role || member.lensTitle || "Untitled Role"
  );
}
