import path from "node:path";

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

export function slugify(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

function stripSourcePersonPrefix(value = "") {
  const raw = String(value || "").trim();
  const match = raw.match(
    /^([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})\s+[—-]\s+(.+)$/
  );
  if (!match) return raw;
  return match[2].trim();
}

function normalizeTitle(value = "", fallback = "") {
  let next = stripLensPrefixes(String(value || ""));
  next = next.replace(/^["'`]+|["'`]+$/g, "").trim();
  next = stripSourcePersonPrefix(next);
  next = next.replace(/\s+Lens$/i, "").trim();
  next = next.replace(/\s+/g, " ").trim();

  if (!next) return String(fallback || "").trim();
  return next;
}

function isPlaceholderTitle(value = "") {
  const normalized = normalizeTitle(value);
  if (!normalized) return true;
  return [
    /^agent name$/i,
    /^instructions for the ai agent$/i,
    /^ai contact lens$/i,
    /^1\.\s*metacanonical header$/i,
    /^metacanonical header$/i,
    /^untitled$/i,
    /^untitled lens$/i,
  ].some((pattern) => pattern.test(normalized));
}

function titleFromSourceRelativePath(relativePath = "") {
  const fileName = path
    .basename(String(relativePath || ""))
    .replace(/\.(md|json|pdf|docx)$/i, "");

  if (!fileName) return "";

  let next = fileName
    .replace(/^PCL[_-]\d{2}[_-]\d{2}[_-]/i, "")
    .replace(/^\d+[_-]*/, "")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .trim();

  return toTitleCase(next);
}

function titleFromContent(content = "") {
  const raw = String(content || "");
  const patterns = [
    /(?:^|\n)[_>*\s#-]*PCL:\s*([^\n*_`]+)/i,
    /(?:^|\n)[_>*\s#-]*AI Contact Lens(?:\s+v[\d.]+)?\s*:?\s*([^\n*_`]+)/i,
    /(?:^|\n)[_>*\s#-]*Agent Name:\s*([^\n*_`]+)/i,
    /(?:^|\n)[_>*\s#-]*#\s+([^\n]+)/,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return "";
}

function stripLeadingArticleSlug(value = "") {
  return slugify(
    String(value || "")
      .replace(/^the\s+/i, "")
      .replace(/%/g, " percent ")
      .replace(/&/g, " and ")
      .replace(/[’']/g, "")
      .replace(/"/g, "")
  );
}

export function isBrokenLensTitle(value = "") {
  return isPlaceholderTitle(value);
}

export function canonicalizeLensTitle(
  value = "",
  { relativePath = "", content = "" } = {}
) {
  const primary = normalizeTitle(value);
  if (!isPlaceholderTitle(primary)) return primary;

  const fromContent = normalizeTitle(titleFromContent(content));
  if (!isPlaceholderTitle(fromContent)) return fromContent;

  const fromPath = normalizeTitle(titleFromSourceRelativePath(relativePath));
  if (!isPlaceholderTitle(fromPath)) return fromPath;

  return primary || fromContent || fromPath || "Untitled Lens";
}

export function canonicalizeConstellationTitle(value = "", relativePath = "") {
  const primary = normalizeTitle(value);
  if (!isPlaceholderTitle(primary)) return primary;
  return normalizeTitle(titleFromSourceRelativePath(relativePath), primary);
}

export function resolveLensDisplayTitle(item = {}) {
  return canonicalizeLensTitle(item.displayTitle || item.title || "", {
    relativePath: item.relativePath || "",
    content: item.content || "",
  });
}

export function resolveConstellationTitle(item = {}) {
  return canonicalizeConstellationTitle(
    item.displayTitle || item.title || item.name || "",
    item.relativePath || ""
  );
}

export function ensureCouncilName(value = "") {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "Untitled Council";
  return /council$/i.test(trimmed) ? trimmed : `${trimmed} Council`;
}

export function resolveCouncilName(item = {}) {
  return ensureCouncilName(
    item.councilName || item.collectionLabel || item.councilLabel || item.board
  );
}

export function resolveCouncilLabel(item = {}) {
  return String(
    item.councilLabel ||
      item.collectionLabel ||
      item.board ||
      resolveCouncilName(item)
  )
    .replace(/\s+Council$/i, "")
    .trim();
}

export function buildCanonicalBoardLensId(boardSlug = "", title = "") {
  return slugify(`${boardSlug}-${stripLeadingArticleSlug(title)}`);
}

export function buildCanonicalCouncilId(councilTitle = "") {
  return stripLeadingArticleSlug(councilTitle);
}

export function buildCanonicalCouncilLensId(councilId = "", title = "") {
  return slugify(
    `${buildCanonicalCouncilId(councilId)}-${stripLeadingArticleSlug(title)}`
  );
}

export function buildCanonicalConstellationId(title = "") {
  return stripLeadingArticleSlug(title);
}

export function buildLensHandle(id = "") {
  return `@mc-${slugify(id)}`;
}

export function buildConstellationHandle(id = "") {
  return `@constellation-${slugify(id)}`;
}
