import System from "@/models/system";

const PRISM_SETUP_DRAFT_KEY = "prism_setup_assistant_draft_v1";
const PRISM_SETUP_COMPLETED_KEY = "prism_setup_assistant_completed_v1";

function loadLocalJson(key) {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function saveLocalJson(key, payload = null) {
  if (typeof window === "undefined") return;
  if (!payload) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify(payload));
}

export async function loadPrismSetupDraft() {
  const remoteDraft = await System.prismSetupDraft();
  if (!remoteDraft?.error) {
    saveLocalJson(PRISM_SETUP_DRAFT_KEY, remoteDraft.draft);
    return remoteDraft.draft;
  }
  return loadLocalJson(PRISM_SETUP_DRAFT_KEY);
}

export async function savePrismSetupDraft(draft = null) {
  saveLocalJson(PRISM_SETUP_DRAFT_KEY, draft);
  return await System.savePrismSetupDraft(draft);
}

export function loadPrismSetupCompleted() {
  return loadLocalJson(PRISM_SETUP_COMPLETED_KEY);
}

export function savePrismSetupCompleted(payload = null) {
  saveLocalJson(PRISM_SETUP_COMPLETED_KEY, payload);
}

export { PRISM_SETUP_COMPLETED_KEY, PRISM_SETUP_DRAFT_KEY };
