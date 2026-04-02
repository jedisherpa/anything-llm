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
import {
  PRISM_STATE_ERROR,
  PRISM_STATE_RESET,
  PRISM_STATE_RESPONSE,
  PRISM_STATE_THINKING,
} from "@/utils/prism/events";

const PrismContext = createContext(null);

const RESPONSE_PULSE_MS = 4000;
const ERROR_PULSE_MS = 2200;
const THINKING_GUARD_MS = 5000;

export function PrismProvider({ children }) {
  const [hoverCount, setHoverCount] = useState(0);
  const [chatThinking, setChatThinking] = useState(false);
  const [agentThinking, setAgentThinking] = useState(false);
  const [transientState, setTransientState] = useState(null);
  const hoverTargetsRef = useRef(new Set());
  const responseTimerRef = useRef(null);
  const errorTimerRef = useRef(null);
  const lastSettledAtRef = useRef(0);

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

  const beginThinking = useCallback((source = "agent") => {
    if (Date.now() - lastSettledAtRef.current < THINKING_GUARD_MS) return;
    clearTransientTimers();
    setTransientState(null);
    if (source === "chat") setChatThinking(true);
    else setAgentThinking(true);
  }, [clearTransientTimers]);

  const completeThinking = useCallback(() => {
    setAgentThinking(false);
    setChatThinking(false);
    scheduleTransientState("response", RESPONSE_PULSE_MS);
  }, [scheduleTransientState]);

  const pulseResponse = useCallback(() => {
    lastSettledAtRef.current = Date.now();
    setChatThinking(false);
    setAgentThinking(false);
    scheduleTransientState("response", RESPONSE_PULSE_MS);
  }, [scheduleTransientState]);

  const signalError = useCallback(() => {
    lastSettledAtRef.current = Date.now();
    setChatThinking(false);
    setAgentThinking(false);
    scheduleTransientState("error", ERROR_PULSE_MS);
  }, [scheduleTransientState]);

  const resetState = useCallback(() => {
    clearTransientTimers();
    lastSettledAtRef.current = 0;
    setTransientState(null);
    setChatThinking(false);
    setAgentThinking(false);
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

    const handleThinking = () => beginThinking("chat");
    const handleResponse = () => pulseResponse();
    const handleError = () => signalError();
    const handleReset = () => resetState();

    window.addEventListener(PRISM_STATE_THINKING, handleThinking);
    window.addEventListener(PRISM_STATE_RESPONSE, handleResponse);
    window.addEventListener(PRISM_STATE_ERROR, handleError);
    window.addEventListener(PRISM_STATE_RESET, handleReset);

    return () => {
      window.removeEventListener(PRISM_STATE_THINKING, handleThinking);
      window.removeEventListener(PRISM_STATE_RESPONSE, handleResponse);
      window.removeEventListener(PRISM_STATE_ERROR, handleError);
      window.removeEventListener(PRISM_STATE_RESET, handleReset);
    };
  }, [beginThinking, pulseResponse, resetState, signalError]);

  useEffect(() => {
    return () => clearTransientTimers();
  }, [clearTransientTimers]);

  const state =
    transientState === "error"
      ? "error"
      : transientState === "response"
        ? "response"
        : chatThinking || agentThinking
          ? "thinking"
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
