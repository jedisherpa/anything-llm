import { safeJsonParse } from "@/utils/request";

export const ACTIVE_METACANON_ALIGNMENT =
  "anythingllm_active_metacanon_alignment";
export const METACANON_ALIGNMENT_EVENT = "metacanon_alignment_updated";
const REFERENTIAL_ALIGNMENT_PROMPT_PATTERN =
  /\b(answer|respond|re-answer|rewrite|rework|revise|refine|try|do|approach)\b[\s\S]{0,80}\bagain\b|\bin light of\b|\busing (?:the )?(?:constellation|council|lens)\b|\bwith (?:the )?(?:constellation|council|lens)\b|\bthrough (?:the )?.+?\blens\b/i;
const MAX_FOLLOW_UP_SNIPPET_LENGTH = 1200;
const MAX_SHORT_FOLLOW_UP_LENGTH = 500;

const BOARD_ACCENTS = {
  "direct-response-board": "#c89b2f",
  "marketing-branding-board": "#d07a56",
  "millennial-founders-board": "#5ca4ff",
  "org-builder-board": "#4fd1c5",
  "pauls-board": "#46c8ff",
  "project-managers-board": "#72d6a4",
  "visual-branding-board": "#c37aff",
};

const COUNCIL_ACCENTS = {
  "matchless-love-council": "#d9b24c",
  "prophetic-witness-council": "#d9895f",
  "wholistic-restoration-council": "#df6f77",
  "fierce-compassion-council": "#e2778b",
  "reconciliation-and-wholeness-council": "#b56be3",
  "unseen-weavers-council": "#6d7cff",
  "discerning-intellect-council": "#46c8ff",
  "questioner-council": "#47d7c1",
  "witness-and-the-void-council": "#6fdb8a",
  "strategic-mind-council": "#b3d85a",
  "builder-and-the-pivot-council": "#d5a24c",
  "sovereign-command-and-legacy-council": "#db7a5f",
  Council_01: "#d9b24c",
  Council_02: "#d9895f",
  Council_03: "#df6f77",
  Council_04: "#e2778b",
  Council_05: "#b56be3",
  Council_06: "#6d7cff",
  Council_07: "#46c8ff",
  Council_08: "#47d7c1",
  Council_09: "#6fdb8a",
  Council_10: "#b3d85a",
  Council_11: "#d5a24c",
  Council_12: "#db7a5f",
};

function emitAlignmentUpdate(detail = null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(METACANON_ALIGNMENT_EVENT, {
      detail,
    })
  );
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function normalizeMessageText(text = "") {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateForAlignment(
  text = "",
  maxLength = MAX_FOLLOW_UP_SNIPPET_LENGTH
) {
  const normalized = normalizeMessageText(text);
  if (!normalized || normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function shouldAnchorFollowUpPrompt(prompt = "") {
  return REFERENTIAL_ALIGNMENT_PROMPT_PATTERN.test(String(prompt || "").trim());
}

function assistantAskedForFollowUp(assistantText = "") {
  const normalized = normalizeMessageText(assistantText).toLowerCase();
  if (!normalized) return false;
  if (normalized.includes("?")) return true;
  return /\b(what|which|who|where|when|why|how|can you|could you|would you|tell me|share|clarify|describe|give me)\b/.test(
    normalized
  );
}

function getMostRecentResolvedExchange(history = []) {
  const messages = Array.isArray(history) ? history : [];
  let assistantIndex = -1;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.pending) continue;
    if (
      message?.role === "assistant" &&
      normalizeMessageText(message?.content)
    ) {
      assistantIndex = i;
      break;
    }
  }

  if (assistantIndex < 0) return null;

  for (let i = assistantIndex - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.pending) continue;
    if (message?.role !== "user") continue;

    const userText = normalizeMessageText(message?.content);
    if (!userText) continue;

    return {
      user: userText,
      assistant: normalizeMessageText(messages[assistantIndex]?.content),
    };
  }

  return null;
}

function buildAnchoredFollowUpPrompt(prompt = "", history = []) {
  const trimmedPrompt = String(prompt || "").trim();
  if (!trimmedPrompt) {
    return trimmedPrompt;
  }

  const priorExchange = getMostRecentResolvedExchange(history);
  if (!priorExchange?.user) return trimmedPrompt;

  const shouldAnchor =
    shouldAnchorFollowUpPrompt(trimmedPrompt) ||
    (trimmedPrompt.length <= MAX_SHORT_FOLLOW_UP_LENGTH &&
      assistantAskedForFollowUp(priorExchange.assistant));

  if (!shouldAnchor) return trimmedPrompt;

  const assistantReply = truncateForAlignment(priorExchange.assistant);
  return [
    "Continue the existing thread using this alignment.",
    "Stay anchored to the ongoing conversation instead of describing the alignment on its own.",
    `Original user question:\n${truncateForAlignment(priorExchange.user)}`,
    assistantReply ? `Most recent assistant answer:\n${assistantReply}` : null,
    `Current user follow-up:\n${trimmedPrompt}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function getMetacanonLensAccent(lens = {}) {
  if (lens?.colorHex) return lens.colorHex;
  if (lens?.councilId && COUNCIL_ACCENTS[lens.councilId]) {
    return COUNCIL_ACCENTS[lens.councilId];
  }
  if (lens?.boardSlug && BOARD_ACCENTS[lens.boardSlug]) {
    return BOARD_ACCENTS[lens.boardSlug];
  }
  return "#d4a63e";
}

export function buildCouncilPackPrompt({
  name = "Saved Constellation",
  lensHandles = [],
  leadHandle = "",
  executionRoutes = {},
  userQuery = "",
}) {
  const normalizedExecutionRoutes =
    executionRoutes && typeof executionRoutes === "object"
      ? executionRoutes
      : {};
  const routeLines = Object.entries(normalizedExecutionRoutes)
    .map(([handle, backends]) => {
      const normalizedHandle = String(handle || "").trim();
      const normalizedBackends = uniqueStrings(backends);
      if (!normalizedHandle || normalizedBackends.length === 0) return null;
      return `Route: ${normalizedHandle} -> ${normalizedBackends.join(", ")}`;
    })
    .filter(Boolean)
    .join("\n");

  return `@council
Pack: ${name}
${leadHandle ? `Lead: ${String(leadHandle).trim()}\n` : ""}Lenses: ${uniqueStrings(lensHandles).join(", ")}
${routeLines ? `${routeLines}\n` : ""}User query:
${String(userQuery || "").trim()}`;
}

export function normalizeMetacanonAlignment(alignment = {}) {
  const nextAlignment =
    alignment && typeof alignment === "object" ? alignment : {};
  const lensHandles = uniqueStrings(nextAlignment.lensHandles);
  const normalizedHandle = String(nextAlignment.handle || "").trim() || null;
  const inferredKind =
    nextAlignment.kind ||
    nextAlignment.mode ||
    (lensHandles.length > 0 && !normalizedHandle
      ? "pack"
      : normalizedHandle === "@agent"
        ? "agent"
        : normalizedHandle?.startsWith("@constellation-")
          ? "constellation"
          : "lens");

  return {
    id: nextAlignment.id || null,
    title:
      nextAlignment.title ||
      nextAlignment.name ||
      nextAlignment.archetypeName ||
      "Untitled Alignment",
    handle: normalizedHandle,
    kind: inferredKind,
    sourceId: nextAlignment.sourceId || null,
    description: nextAlignment.description || "",
    collectionLabel:
      nextAlignment.collectionLabel ||
      nextAlignment.board ||
      (inferredKind === "pack" ? "Saved Constellation" : "Library"),
    colorHex: nextAlignment.colorHex || getMetacanonLensAccent(nextAlignment),
    lensHandles,
    lensTitles: uniqueStrings(nextAlignment.lensTitles),
    leadHandle: String(nextAlignment.leadHandle || "").trim() || null,
    leadTitle: String(nextAlignment.leadTitle || "").trim() || null,
    executionRoutes:
      nextAlignment.executionRoutes &&
      typeof nextAlignment.executionRoutes === "object"
        ? Object.fromEntries(
            Object.entries(nextAlignment.executionRoutes).map(
              ([handle, backends]) => [
                String(handle || "").trim(),
                uniqueStrings(backends),
              ]
            )
          )
        : {},
  };
}

export function isRunnableMetacanonAlignment(alignment = {}) {
  const normalizedAlignment = normalizeMetacanonAlignment(alignment);
  if (!normalizedAlignment?.title) return false;

  if (normalizedAlignment.kind === "pack") {
    return normalizedAlignment.lensHandles.length > 0;
  }

  return Boolean(normalizedAlignment.handle);
}

export function getActiveMetacanonAlignment() {
  if (typeof window === "undefined") return null;
  return normalizeMetacanonAlignment(
    safeJsonParse(localStorage.getItem(ACTIVE_METACANON_ALIGNMENT), null)
  );
}

export function setActiveMetacanonAlignment(alignment = {}) {
  if (typeof window === "undefined") return null;
  const next = normalizeMetacanonAlignment(alignment);
  if (!isRunnableMetacanonAlignment(next)) return null;

  localStorage.setItem(ACTIVE_METACANON_ALIGNMENT, JSON.stringify(next));
  emitAlignmentUpdate(next);
  return next;
}

export function clearActiveMetacanonAlignment() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACTIVE_METACANON_ALIGNMENT);
  emitAlignmentUpdate(null);
}

export function buildPromptForAlignment(
  prompt = "",
  alignment = getActiveMetacanonAlignment()
) {
  const trimmed = String(prompt || "").trim();
  if (!trimmed || !alignment) return prompt;
  if (/^[@/]/.test(trimmed)) return prompt;
  if (!isRunnableMetacanonAlignment(alignment)) return prompt;

  if (alignment.kind === "pack") {
    return buildCouncilPackPrompt({
      name: alignment.title,
      lensHandles: alignment.lensHandles,
      leadHandle: alignment.leadHandle,
      executionRoutes: alignment.executionRoutes,
      userQuery: trimmed,
    });
  }

  if (!alignment.handle) return prompt;
  return `${buildExplicitMetacanonInvocation(alignment.handle)} ${trimmed}`.trim();
}

export function buildAlignedPrompt(
  prompt = "",
  alignment = getActiveMetacanonAlignment(),
  history = []
) {
  return buildPromptForAlignment(
    buildAnchoredFollowUpPrompt(prompt, history),
    alignment
  );
}

export function buildExplicitMetacanonInvocation(handle = "") {
  const normalizedHandle = String(handle || "").trim();
  if (!normalizedHandle) return "";
  if (normalizedHandle === "@agent") return "/agent";
  if (normalizedHandle.startsWith("@constellation-")) {
    return `/constellation ${normalizedHandle}`;
  }
  return `/lens ${normalizedHandle}`;
}

// ---------------------------------------------------------------------------
// Display-time cleanup — does NOT mutate stored data.
// Applied only when rendering user messages in the chat history.
// ---------------------------------------------------------------------------

/**
 * Humanize a raw mc handle like "@mc-direct-response-board-direct-response-master"
 * into "Direct Response Master".  We try the summary library first so the
 * real display title is used; otherwise we fall back to stripping the prefix
 * and title-casing the remainder.
 */
function _humanizeHandle(rawHandle = "") {
  // Lazy-load summary to avoid a circular-dependency at module init time.
  try {
    // Dynamic require is intentional here — this module is frontend-only.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { metacanonLibrarySummary } = require("@/data/metacanon/summary.generated");
    if (metacanonLibrarySummary?.featuredLenses) {
      const match = metacanonLibrarySummary.featuredLenses.find(
        (l) => l.handle === rawHandle
      );
      if (match?.displayTitle || match?.title) {
        const title = match.displayTitle || match.title;
        // Strip leading "The " for brevity in the bubble label.
        return title.replace(/^The\s+/i, "");
      }
    }
  } catch (_) {
    // summary import not available — fall through to generic humanization.
  }

  // Generic fallback: strip "@mc-" or "@constellation-" prefix, replace hyphens, title-case.
  const stripped = rawHandle
    .replace(/^@mc-/, "")
    .replace(/^@constellation-/, "")
    .replace(/-/g, " ");

  return stripped
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const ANCHORING_BOILERPLATE =
  /Continue the existing thread using this alignment\.\s*\nStay anchored to the ongoing conversation instead of describing the alignment on its own\./;

/**
 * Extract only the user's actual follow-up text from an anchored prompt block.
 * Returns null if no follow-up block is found.
 */
function _extractFollowUp(text = "") {
  const marker = "Current user follow-up:";
  const idx = text.indexOf(marker);
  if (idx === -1) return null;
  return text.slice(idx + marker.length).trim();
}

/**
 * formatPromptForDisplay(rawPrompt) → human-readable display string.
 *
 * Converts internal alignment invocation strings into clean labels.
 * The raw prompt is NEVER modified — this is display-only.
 *
 * Handled patterns:
 *   /lens @mc-<handle> <rest>          → "Aligned with <Title>: <rest>"
 *   /constellation @constellation-<x>  → "Constellation <Title>: <rest>"
 *   /agent <rest>                       → "Agent: <rest>"
 *   @council\nPack: <name>\n...\nUser query:\n<q>  → "Council (<name>): <q>"
 *
 * For anchored follow-ups the function extracts only the "Current user follow-up:" block.
 * Unrecognized prompts are returned unchanged.
 */
export function formatPromptForDisplay(rawPrompt = "") {
  const text = String(rawPrompt || "").trim();
  if (!text) return text;

  // --- /lens pattern -------------------------------------------------------
  const lensMatch = text.match(/^\/lens\s+(@mc-[\w-]+)\s*([\s\S]*)$/);
  if (lensMatch) {
    const handle = lensMatch[1];
    let rest = lensMatch[2].trim();
    // Strip anchoring boilerplate if present.
    rest = rest.replace(ANCHORING_BOILERPLATE, "").trim();
    // If the rest contains a follow-up block, use only that.
    const followUp = _extractFollowUp(rest);
    const userText = followUp !== null ? followUp : rest;
    const title = _humanizeHandle(handle);
    return userText
      ? `Aligned with ${title}: ${userText}`
      : `Aligned with ${title}`;
  }

  // --- /constellation pattern ----------------------------------------------
  const constellationMatch = text.match(
    /^\/constellation\s+(@constellation-[\w-]+)\s*([\s\S]*)$/
  );
  if (constellationMatch) {
    const handle = constellationMatch[1];
    let rest = constellationMatch[2].trim();
    rest = rest.replace(ANCHORING_BOILERPLATE, "").trim();
    const followUp = _extractFollowUp(rest);
    const userText = followUp !== null ? followUp : rest;
    const title = _humanizeHandle(handle);
    return userText
      ? `Constellation ${title}: ${userText}`
      : `Constellation ${title}`;
  }

  // --- /agent pattern ------------------------------------------------------
  const agentMatch = text.match(/^\/agent\s+([\s\S]+)$/);
  if (agentMatch) {
    return `Agent: ${agentMatch[1].trim()}`;
  }

  // --- @council block -------------------------------------------------------
  if (text.startsWith("@council")) {
    const packMatch = text.match(/^@council\s*\nPack:\s*(.+)/m);
    const packName = packMatch ? packMatch[1].trim() : "Council";
    const userQueryMarker = "User query:";
    const queryIdx = text.indexOf(userQueryMarker);
    const userQuery =
      queryIdx !== -1
        ? text.slice(queryIdx + userQueryMarker.length).trim()
        : "";
    return userQuery
      ? `Council (${packName}): ${userQuery}`
      : `Council (${packName})`;
  }

  // Unrecognized — return as-is.
  return text;
}
