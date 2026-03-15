export const PRISM_STATE_THINKING = "prismStateThinking";
export const PRISM_STATE_RESPONSE = "prismStateResponse";
export const PRISM_STATE_ERROR = "prismStateError";
export const PRISM_STATE_RESET = "prismStateReset";

function dispatchPrismEvent(type, detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(type, { detail }));
}

export function signalPrismThinking(detail = {}) {
  dispatchPrismEvent(PRISM_STATE_THINKING, detail);
}

export function signalPrismResponse(detail = {}) {
  dispatchPrismEvent(PRISM_STATE_RESPONSE, detail);
}

export function signalPrismError(detail = {}) {
  dispatchPrismEvent(PRISM_STATE_ERROR, detail);
}

export function resetPrismState(detail = {}) {
  dispatchPrismEvent(PRISM_STATE_RESET, detail);
}
