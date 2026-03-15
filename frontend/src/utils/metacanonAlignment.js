import { safeJsonParse } from "@/utils/request";

export const ACTIVE_METACANON_ALIGNMENT =
  "anythingllm_active_metacanon_alignment";
export const METACANON_ALIGNMENT_EVENT = "metacanon_alignment_updated";

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

export function getActiveMetacanonAlignment() {
  if (typeof window === "undefined") return null;
  return safeJsonParse(localStorage.getItem(ACTIVE_METACANON_ALIGNMENT), null);
}

export function setActiveMetacanonAlignment(alignment = {}) {
  if (typeof window === "undefined") return null;
  const next = {
    id: alignment.id || null,
    title: alignment.title || alignment.archetypeName || "Untitled Lens",
    handle: alignment.handle || null,
    collectionLabel: alignment.collectionLabel || alignment.board || "Library",
    colorHex: alignment.colorHex || getMetacanonLensAccent(alignment),
  };

  localStorage.setItem(ACTIVE_METACANON_ALIGNMENT, JSON.stringify(next));
  emitAlignmentUpdate(next);
  return next;
}

export function clearActiveMetacanonAlignment() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACTIVE_METACANON_ALIGNMENT);
  emitAlignmentUpdate(null);
}

export function buildAlignedPrompt(
  prompt = "",
  alignment = getActiveMetacanonAlignment()
) {
  const trimmed = String(prompt || "").trim();
  if (!trimmed || !alignment?.handle) return prompt;
  if (/^[@/]/.test(trimmed)) return prompt;
  return `${alignment.handle} ${trimmed}`;
}
