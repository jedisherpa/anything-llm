import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { AGENT_SESSION_END, AGENT_SESSION_START } from "@/utils/chat/agent";
import {
  PRISM_STATE_ERROR,
  PRISM_STATE_RESET,
  PRISM_STATE_RESPONSE,
  PRISM_STATE_THINKING,
} from "@/utils/prism/events";

const PrismContext = createContext(null);

const RESPONSE_PULSE_MS = 1600;
const ERROR_PULSE_MS = 2200;

export function PrismProvider({ children }) {
  const [hoverCount, setHoverCount] = useState(0);
  const [activeSessions, setActiveSessions] = useState(0);
  const [transientState, setTransientState] = useState(null);
  const hoverTargetsRef = useRef(new Set());
  const responseTimerRef = useRef(null);
  const errorTimerRef = useRef(null);

  const clearTransientTimers = useCallback(() => {
    clearTimeout(responseTimerRef.current);
    clearTimeout(errorTimerRef.current);
    responseTimerRef.current = null;
    errorTimerRef.current = null;
  }, []);

  const scheduleTransientState = useCallback(
    (state, durationMs) => {
      clearTransientTimers();
      setTransientState(state);

      const timerRef = state === "error" ? errorTimerRef : responseTimerRef;

      timerRef.current = setTimeout(() => {
        setTransientState((currentState) =>
          currentState === state ? null : currentState
        );
        timerRef.current = null;
      }, durationMs);
    },
    [clearTransientTimers]
  );

  const beginThinking = useCallback(() => {
    clearTransientTimers();
    setTransientState(null);
    setActiveSessions((count) => count + 1);
  }, [clearTransientTimers]);

  const completeThinking = useCallback(() => {
    setActiveSessions((count) => {
      const nextCount = Math.max(count - 1, 0);
      if (nextCount === 0) {
        scheduleTransientState("response", RESPONSE_PULSE_MS);
      }
      return nextCount;
    });
  }, [scheduleTransientState]);

  const pulseResponse = useCallback(() => {
    setActiveSessions(0);
    scheduleTransientState("response", RESPONSE_PULSE_MS);
  }, [scheduleTransientState]);

  const signalError = useCallback(() => {
    setActiveSessions(0);
    scheduleTransientState("error", ERROR_PULSE_MS);
  }, [scheduleTransientState]);

  const resetState = useCallback(() => {
    clearTransientTimers();
    setTransientState(null);
    setActiveSessions(0);
  }, [clearTransientTimers]);

  const setHoverTarget = useCallback((targetId, isActive) => {
    const nextTargets = new Set(hoverTargetsRef.current);

    if (isActive) nextTargets.add(targetId);
    else nextTargets.delete(targetId);

    hoverTargetsRef.current = nextTargets;
    setHoverCount(nextTargets.size);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleAgentStart = () => beginThinking();
    const handleAgentEnd = () => completeThinking();
    const handleThinking = () => beginThinking();
    const handleResponse = () => pulseResponse();
    const handleError = () => signalError();
    const handleReset = () => resetState();

    window.addEventListener(AGENT_SESSION_START, handleAgentStart);
    window.addEventListener(AGENT_SESSION_END, handleAgentEnd);
    window.addEventListener(PRISM_STATE_THINKING, handleThinking);
    window.addEventListener(PRISM_STATE_RESPONSE, handleResponse);
    window.addEventListener(PRISM_STATE_ERROR, handleError);
    window.addEventListener(PRISM_STATE_RESET, handleReset);

    return () => {
      window.removeEventListener(AGENT_SESSION_START, handleAgentStart);
      window.removeEventListener(AGENT_SESSION_END, handleAgentEnd);
      window.removeEventListener(PRISM_STATE_THINKING, handleThinking);
      window.removeEventListener(PRISM_STATE_RESPONSE, handleResponse);
      window.removeEventListener(PRISM_STATE_ERROR, handleError);
      window.removeEventListener(PRISM_STATE_RESET, handleReset);
    };
  }, [beginThinking, completeThinking, pulseResponse, resetState, signalError]);

  useEffect(() => {
    return () => clearTransientTimers();
  }, [clearTransientTimers]);

  const state =
    transientState === "error"
      ? "error"
      : activeSessions > 0
        ? "thinking"
        : transientState === "response"
          ? "response"
          : hoverCount > 0
            ? "hover"
            : "idle";

  const value = useMemo(
    () => ({
      state,
      beginThinking,
      completeThinking,
      pulseResponse,
      signalError,
      resetState,
      setHoverTarget,
    }),
    [
      beginThinking,
      completeThinking,
      pulseResponse,
      resetState,
      setHoverTarget,
      signalError,
      state,
    ]
  );

  return (
    <PrismContext.Provider value={value}>{children}</PrismContext.Provider>
  );
}

export function usePrism() {
  const context = useContext(PrismContext);
  if (!context) {
    throw new Error("usePrism must be used within a PrismProvider.");
  }
  return context;
}

export function usePrismHoverTarget(targetKey = null) {
  const generatedId = useId();
  const targetId = targetKey ?? generatedId;
  const { setHoverTarget } = usePrism();

  const activate = useCallback(() => {
    setHoverTarget(targetId, true);
  }, [setHoverTarget, targetId]);

  const deactivate = useCallback(() => {
    setHoverTarget(targetId, false);
  }, [setHoverTarget, targetId]);

  useEffect(() => {
    return () => setHoverTarget(targetId, false);
  }, [setHoverTarget, targetId]);

  return { activate, deactivate };
}
