import { useState, useRef, useEffect } from "react";
import debounce from "lodash.debounce";
import { ArrowUp } from "@phosphor-icons/react/dist/csr/ArrowUp";
import { At } from "@phosphor-icons/react/dist/csr/At";

import StopGenerationButton from "./StopGenerationButton";
import SpeechToText from "./SpeechToText";
import { Tooltip } from "react-tooltip";
import AttachmentManager from "./Attachments";
import AttachItem from "./AttachItem";
import {
  ATTACHMENTS_PROCESSED_EVENT,
  ATTACHMENTS_PROCESSING_EVENT,
  PASTE_ATTACHMENT_EVENT,
} from "../DnDWrapper";
import useTextSize from "@/hooks/useTextSize";
import { useTranslation } from "react-i18next";
import Appearance from "@/models/appearance";
import usePromptInputStorage from "@/hooks/usePromptInputStorage";
import ToolsMenu, { TOOLS_MENU_KEYBOARD_EVENT } from "./ToolsMenu";
import { useSearchParams } from "react-router-dom";
import { useIsAgentSessionActive } from "@/utils/chat/agent";
import { useTheme } from "@/hooks/useTheme";
import useMetacanonAlignment from "@/hooks/useMetacanonAlignment";
import {
  clearActiveMetacanonAlignment,
  isRunnableMetacanonAlignment,
} from "@/utils/metacanonAlignment";
import { PRISM_WORKSPACE_FIRST_RUN_HINT_DISMISSED } from "@/utils/constants";
import {
  getDesktopRuntimeStatus,
  isPrismDesktopShell,
  restartDesktopApp,
  setDesktopExecutionEngineUrl,
} from "@/utils/desktopRuntime";
import showToast from "@/utils/toast";
import { PROMPT_INPUT_EVENT, PROMPT_INPUT_ID } from "./constants";
import StarterPackSheet from "@/components/Metacanon/StarterPackSheet";
const MAX_EDIT_STACK_SIZE = 100;

/**
 * @param {function} props.submit - form submit handler
 * @param {boolean} props.isStreaming - disables input while streaming response
 * @param {function} props.sendCommand - handler for slash commands and agent mentions
 * @param {Array} [props.attachments] - file attachments array
 * @param {boolean} [props.centered] - renders in centered layout mode (for home page)
 * @param {string} [props.workspaceSlug] - workspace slug for home page context
 * @param {string} [props.threadSlug] - thread slug for home page context
 * @param {"chat"|"query"} [props.chatMode] - current workspace chat mode
 * @param {(nextMode: "chat"|"query") => void} [props.onChatModeChange] - handler to change chat mode
 * @param {"chat"|"execute"} [props.executionMode] - current execution mode
 * @param {(nextMode: "chat"|"execute") => void} [props.onExecutionModeChange] - handler to change execution mode
 * @param {string} [props.executionWorktreeRoot] - selected repo/worktree root for execute mode
 * @param {(nextRoot: string) => void} [props.onExecutionWorktreeRootChange] - handler to change selected worktree root
 * @param {{ trustedSessionId?: string, sessionExpiresAt?: string, subSphereId?: string, selectedWorktreeRoot?: string } | null} [props.trustedSession] - active trusted session metadata
 * @param {object | null} [props.executionStatus] - runtime/engine status for execute mode
 * @param {() => Promise<unknown>} [props.onExecutionStatusRefresh] - handler to refresh runtime/engine status
 * @param {(config: { demoModeEnabled?: boolean }) => Promise<unknown>} [props.onExecutionConfigUpdate] - handler to update execute config
 */
export default function PromptInput({
  submit,
  isStreaming,
  sendCommand,
  attachments = [],
  centered = false,
  workspaceSlug = null,
  threadSlug = null,
  chatMode = "chat",
  onChatModeChange = null,
  executionMode = "chat",
  onExecutionModeChange = null,
  executionWorktreeRoot = "",
  onExecutionWorktreeRootChange = null,
  trustedSession = null,
  executionStatus = null,
  onExecutionStatusRefresh = null,
  onExecutionConfigUpdate = null,
}) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const { isDisabled } = useIsDisabled();
  const agentSessionActive = useIsAgentSessionActive();
  const activeAlignment = useMetacanonAlignment();
  const hasActiveAlignment = isRunnableMetacanonAlignment(activeAlignment);
  const [promptInput, setPromptInput] = useState("");
  const [showTools, setShowTools] = useState(false);
  const [showStarterPacks, setShowStarterPacks] = useState(false);
  const [showFirstRunHint, setShowFirstRunHint] = useState(false);
  const autoOpenedToolsRef = useRef(false);
  const toolsHighlightRef = useRef(-1);
  const formRef = useRef(null);
  const textareaRef = useRef(null);
  const latestPromptInputRef = useRef("");
  const debouncedSaveStateRef = useRef(null);
  const [, setFocused] = useState(false);
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const { textSizeClass } = useTextSize();
  const [searchParams] = useSearchParams();
  const composePlaceholder =
    executionMode === "execute"
      ? "Run a governed local task in the selected worktree..."
      : chatMode === "query"
        ? "Query your documents with Prism..."
        : resolvedTheme === "light"
          ? "Send a message"
          : "Speak, and the Prism listens...";
  const centeredPlaceholder = centered
    ? composePlaceholder
    : executionMode === "execute"
      ? "Describe the local task Prism should execute in the selected worktree..."
      : t("chat_window.send_message");

  // Synchronizes prompt input value with localStorage, scoped to the current thread.
  usePromptInputStorage({
    promptInput,
    setPromptInput,
  });

  /*
   * @checklist-item
   * If the URL has the agent param, open the agent menu for the user
   * automatically when the component mounts.
   */
  useEffect(() => {
    if (searchParams.get("action") === "set-agent-chat") {
      sendCommand({ text: "/agent " });
      textareaRef.current?.focus();
    }
  }, [searchParams, sendCommand]);

  useEffect(() => {
    if (centered) return;
    try {
      setShowFirstRunHint(
        localStorage.getItem(PRISM_WORKSPACE_FIRST_RUN_HINT_DISMISSED) !==
          "true"
      );
    } catch {
      setShowFirstRunHint(true);
    }
  }, [centered]);

  function dismissFirstRunHint() {
    setShowFirstRunHint(false);
    try {
      localStorage.setItem(PRISM_WORKSPACE_FIRST_RUN_HINT_DISMISSED, "true");
    } catch {}
  }

  useEffect(() => {
    latestPromptInputRef.current = promptInput;
  }, [promptInput]);

  /**
   * To prevent too many re-renders we remotely listen for updates from the parent
   * via an event cycle. Otherwise, using message as a prop leads to a re-render every
   * change on the input.
   * @param {{detail: {messageContent: string, writeMode: 'replace' | 'append'}}} e
   */
  function handlePromptUpdate(e) {
    const { messageContent, writeMode = "replace" } = e?.detail ?? {};
    if (writeMode === "append") setPromptInput((prev) => prev + messageContent);
    else if (writeMode === "prepend")
      setPromptInput((prev) => messageContent + " " + prev);
    else setPromptInput(messageContent ?? "");
  }

  useEffect(() => {
    if (!!window)
      window.addEventListener(PROMPT_INPUT_EVENT, handlePromptUpdate);
    return () =>
      window?.removeEventListener(PROMPT_INPUT_EVENT, handlePromptUpdate);
  }, []);

  function resetTextAreaHeight() {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
  }

  useEffect(() => {
    if (!isStreaming && textareaRef.current) textareaRef.current.focus();
    resetTextAreaHeight();
  }, [isStreaming]);

  /**
   * Save the current state before changes
   * @param {number} adjustment
   */
  function saveCurrentState(adjustment = 0) {
    if (!textareaRef.current) return;
    if (undoStack.current.length >= MAX_EDIT_STACK_SIZE)
      undoStack.current.shift();
    undoStack.current.push({
      value: latestPromptInputRef.current,
      cursorPositionStart: textareaRef.current.selectionStart + adjustment,
      cursorPositionEnd: textareaRef.current.selectionEnd + adjustment,
    });
  }

  useEffect(() => {
    const debounced = debounce((adjustment = 0) => {
      saveCurrentState(adjustment);
    }, 250);
    debouncedSaveStateRef.current = debounced;
    return () => debounced.cancel();
  }, []);

  function handleSubmit(e) {
    // Ignore submits from portaled modals (slash command preset forms)
    if (e.target !== e.currentTarget) return;
    setFocused(false);
    setShowTools(false);
    submit(e);
  }

  /**
   * Capture enter key press to handle submission, redo, or undo
   * via keyboard shortcuts
   * @param {KeyboardEvent} event
   */
  function captureEnterOrUndo(event) {
    // Forward keyboard events to the ToolsMenu when open
    if (showTools) {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
      ) {
        event.preventDefault();
        window.dispatchEvent(
          new CustomEvent(TOOLS_MENU_KEYBOARD_EVENT, {
            detail: { key: event.key },
          })
        );
        return;
      }
      // When an item is highlighted via arrow keys, Enter selects it.
      // Otherwise, Enter falls through to submit the form normally.
      if (event.key === "Enter" && toolsHighlightRef.current >= 0) {
        event.preventDefault();
        window.dispatchEvent(
          new CustomEvent(TOOLS_MENU_KEYBOARD_EVENT, {
            detail: { key: "Enter" },
          })
        );
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setShowTools(false);
        textareaRef.current?.focus();
        return;
      }
    }

    // "/" toggles the Tools menu only when the input is empty
    if (
      event.key === "/" &&
      !event.ctrlKey &&
      !event.metaKey &&
      promptInput.trim() === ""
    ) {
      setShowTools((prev) => {
        autoOpenedToolsRef.current = !prev;
        return !prev;
      });
      return;
    }

    // Is simple enter key press w/o shift key
    if (event.keyCode === 13 && !event.shiftKey) {
      event.preventDefault();
      if (isStreaming || isDisabled) return; // Prevent submission if streaming or disabled
      setShowTools(false);
      return submit(event);
    }

    // Is undo with Ctrl+Z or Cmd+Z + Shift key = Redo
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key === "z" &&
      event.shiftKey
    ) {
      event.preventDefault();
      if (redoStack.current.length === 0) return;

      const nextState = redoStack.current.pop();
      if (!nextState) return;

      undoStack.current.push({
        value: promptInput,
        cursorPositionStart: textareaRef.current.selectionStart,
        cursorPositionEnd: textareaRef.current.selectionEnd,
      });
      setPromptInput(nextState.value);
      setTimeout(() => {
        textareaRef.current.setSelectionRange(
          nextState.cursorPositionStart,
          nextState.cursorPositionEnd
        );
      }, 0);
    }

    // Undo with Ctrl+Z or Cmd+Z
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key === "z" &&
      !event.shiftKey
    ) {
      if (undoStack.current.length === 0) return;
      const lastState = undoStack.current.pop();
      if (!lastState) return;

      redoStack.current.push({
        value: promptInput,
        cursorPositionStart: textareaRef.current.selectionStart,
        cursorPositionEnd: textareaRef.current.selectionEnd,
      });
      setPromptInput(lastState.value);
      setTimeout(() => {
        textareaRef.current.setSelectionRange(
          lastState.cursorPositionStart,
          lastState.cursorPositionEnd
        );
      }, 0);
    }
  }

  function adjustTextArea(event) {
    const element = event.target;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }

  function handlePasteEvent(e) {
    e.preventDefault();
    if (e.clipboardData.items.length === 0) return false;

    // paste any clipboard items that are images.
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        window.dispatchEvent(
          new CustomEvent(PASTE_ATTACHMENT_EVENT, {
            detail: { files: [file] },
          })
        );
        continue;
      }

      // handle files specifically that are not images as uploads
      if (item.kind === "file") {
        const file = item.getAsFile();
        window.dispatchEvent(
          new CustomEvent(PASTE_ATTACHMENT_EVENT, {
            detail: { files: [file] },
          })
        );
        continue;
      }
    }

    const pasteText = e.clipboardData.getData("text/plain");
    if (pasteText) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newPromptInput =
        promptInput.substring(0, start) +
        pasteText +
        promptInput.substring(end);
      setPromptInput(newPromptInput);

      // Set the cursor position after the pasted text
      // we need to use setTimeout to prevent the cursor from being set to the end of the text
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd =
          start + pasteText.length;
        adjustTextArea({ target: textarea });
      }, 0);
    }
    return;
  }

  function handleChange(e) {
    debouncedSaveStateRef.current?.(-1);
    adjustTextArea(e);
    const value = e.target.value;
    setPromptInput(value);

    // Auto-dismiss the tools menu when the "/" that opened it is modified
    if (autoOpenedToolsRef.current && showTools && value !== "/") {
      setShowTools(false);
      autoOpenedToolsRef.current = false;
    }
  }

  return (
    <div
      className={
        centered
          ? "w-full relative flex justify-center items-center"
          : "w-full shrink-0 flex justify-center items-center pwa:pb-5"
      }
    >
      <form
        onSubmit={handleSubmit}
        className={
          centered
            ? "flex w-full max-w-[816px] flex-col gap-y-1 rounded-t-lg items-center"
            : "flex flex-col gap-y-1 rounded-t-lg md:w-full w-full mx-auto max-w-[750px] items-center"
        }
      >
        <div
          className={`flex items-center rounded-lg md:w-full ${centered ? "mb-0 w-full" : "mb-4"}`}
        >
          <div
            className={`relative ${centered ? "w-full max-w-[816px]" : "w-[95vw] md:w-[750px]"}`}
          >
            <StarterPackSheet
              open={showStarterPacks}
              onClose={() => setShowStarterPacks(false)}
            />

            <ToolsMenu
              showing={showTools}
              setShowing={setShowTools}
              sendCommand={sendCommand}
              promptRef={textareaRef}
              centered={centered}
              highlightedIndexRef={toolsHighlightRef}
            />

            <div
              className={`${centered ? "metacanon-composer-shell" : "bg-zinc-800 light:bg-white border border-white/20 light:border-slate-200"} flex flex-col overflow-y-auto max-h-[70vh] rounded-[24px] px-6 pwa:rounded-3xl`}
            >
              <AttachmentManager attachments={attachments} />
              {executionMode === "execute" ? (
                <ExecutionTargetPanel
                  executionWorktreeRoot={executionWorktreeRoot}
                  onExecutionWorktreeRootChange={onExecutionWorktreeRootChange}
                  trustedSession={trustedSession}
                  executionStatus={executionStatus}
                  onExecutionStatusRefresh={onExecutionStatusRefresh}
                  onExecutionConfigUpdate={onExecutionConfigUpdate}
                />
              ) : null}
              {!centered && showFirstRunHint ? (
                <div className="mt-2.5 flex items-start justify-between gap-3 rounded-[16px] border border-white/10 bg-white/[0.04] px-3.5 py-2.5 light:border-slate-200 light:bg-slate-50">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
                      Quick guide
                    </div>
                    <div className="mt-1 text-[12px] leading-5 text-theme-text-secondary">
                      Talk normally. Switch to{" "}
                      <span className="font-semibold text-theme-text-primary">
                        QUERY
                      </span>{" "}
                      to search this workspace. Use{" "}
                      <span className="font-semibold text-theme-text-primary">
                        Align
                      </span>{" "}
                      for a lens voice. Try{" "}
                      <span className="font-semibold text-theme-text-primary">
                        /status
                      </span>{" "}
                      anytime for model and backend health.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={dismissFirstRunHint}
                    className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-theme-text-secondary transition hover:bg-white/5 hover:text-theme-text-primary light:border-slate-200 light:hover:bg-slate-100"
                  >
                    Dismiss
                  </button>
                </div>
              ) : null}
              {hasActiveAlignment ? (
                <div
                  className="metacanon-alignment-chip mt-4 flex items-center justify-between gap-3 rounded-[16px] px-4 py-3"
                  style={{ "--lens-color": activeAlignment.colorHex }}
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
                      {activeAlignment.collectionLabel || "Alignment"}
                    </div>
                    <div className="truncate text-[14px] text-theme-text-primary">
                      {activeAlignment.title}
                    </div>
                    <div className="truncate text-[11px] leading-5 text-theme-text-secondary">
                      {activeAlignment.kind === "pack"
                        ? `${activeAlignment.lensHandles?.length || 0} lenses routed through council orchestration`
                        : activeAlignment.kind === "constellation"
                          ? "Preset constellation orchestration active"
                          : activeAlignment.handle || "Lens alignment active"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearActiveMetacanonAlignment}
                    className="metacanon-alignment-chip__clear shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                  >
                    Clear
                  </button>
                </div>
              ) : null}
              <div className="flex items-center">
                <textarea
                  id={PROMPT_INPUT_ID}
                  ref={textareaRef}
                  onChange={handleChange}
                  onKeyDown={captureEnterOrUndo}
                  onPaste={(e) => {
                    saveCurrentState();
                    handlePasteEvent(e);
                  }}
                  required={true}
                  onFocus={() => setFocused(true)}
                  onBlur={(e) => {
                    setFocused(false);
                    adjustTextArea(e);
                  }}
                  value={promptInput}
                  spellCheck={Appearance.get("enableSpellCheck")}
                  className={`border-none cursor-text max-h-[50vh] md:max-h-[350px] md:min-h-[40px] ${centered ? "pt-[26px]" : "pt-[20px]"} w-full leading-5 ${centered ? "text-theme-text-primary placeholder:text-theme-settings-input-placeholder" : "text-white light:text-slate-600 placeholder:text-white/60 light:placeholder:text-slate-400"} bg-transparent resize-none active:outline-none focus:outline-none flex-grow pwa:!text-[16px] ${textSizeClass}`}
                  placeholder={centeredPlaceholder}
                />
              </div>
              <div
                className={`flex justify-between items-center ${centered ? "pt-[18px] pb-[22px]" : "pt-3.5 pb-3"}`}
              >
                <div className="flex items-center gap-x-0.25">
                  {typeof onChatModeChange === "function" ? (
                    <ChatModePills
                      chatMode={chatMode}
                      onChange={onChatModeChange}
                      executionMode={executionMode}
                      onExecutionModeChange={onExecutionModeChange}
                    />
                  ) : null}
                  <div className="flex items-center gap-x-1">
                    <AttachItem
                      workspaceSlug={workspaceSlug}
                      workspaceThreadSlug={threadSlug}
                    />

                    <StarterPackButton
                      onClick={() => setShowStarterPacks(true)}
                      centered={centered}
                    />

                    <AgentSessionButton
                      sendCommand={sendCommand}
                      promptInput={promptInput}
                      textareaRef={textareaRef}
                      visible={!agentSessionActive}
                      centered={centered}
                    />
                  </div>
                  <ToolsButton
                    showTools={showTools}
                    setShowTools={setShowTools}
                    textareaRef={textareaRef}
                    autoOpenedToolsRef={autoOpenedToolsRef}
                    centered={centered}
                  />
                </div>
                <div className="flex gap-x-2 items-center">
                  <SpeechToText sendCommand={sendCommand} />
                  {isStreaming ? (
                    <StopGenerationButton />
                  ) : (
                    <SendPromptButton
                      formRef={formRef}
                      promptInput={promptInput}
                      isDisabled={isDisabled}
                      centered={centered}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function ChatModePills({
  chatMode = "chat",
  onChange,
  executionMode = "chat",
  onExecutionModeChange,
}) {
  const { t } = useTranslation();
  const activeMode = executionMode === "execute" ? "execute" : chatMode;

  return (
    <div className="flex items-center gap-x-0.5 mr-1">
      <button
        type="button"
        disabled={activeMode === "chat"}
        onClick={() => {
          onExecutionModeChange?.("chat");
          onChange?.("chat");
        }}
        data-testid="chat-mode-chat-button"
        className="metacanon-mode-pill rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.10em]"
        data-active={activeMode === "chat" ? "true" : "false"}
      >
        {t("chat.mode.chat.title")}
      </button>
      <button
        type="button"
        disabled={activeMode === "query"}
        onClick={() => {
          onExecutionModeChange?.("chat");
          onChange?.("query");
        }}
        data-testid="chat-mode-query-button"
        className="metacanon-mode-pill rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.10em]"
        data-active={activeMode === "query" ? "true" : "false"}
      >
        {t("chat.mode.query.title")}
      </button>
      <button
        type="button"
        disabled={activeMode === "execute"}
        onClick={() => onExecutionModeChange?.("execute")}
        data-testid="chat-mode-execute-button"
        className="metacanon-mode-pill rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.10em]"
        data-active={activeMode === "execute" ? "true" : "false"}
      >
        Execute
      </button>
    </div>
  );
}

function ExecutionTargetPanel({
  executionWorktreeRoot = "",
  onExecutionWorktreeRootChange,
  trustedSession = null,
  executionStatus = null,
  onExecutionStatusRefresh = null,
  onExecutionConfigUpdate = null,
}) {
  const bridge = executionStatus?.bridge ?? null;
  const router = executionStatus?.execution_router ?? null;
  const demoMode = executionStatus?.demo_mode ?? null;
  const versions = executionStatus?.versions ?? null;
  const setupChecks = Array.isArray(executionStatus?.setup_checks)
    ? executionStatus.setup_checks
    : [];
  const deliberation = executionStatus?.deliberation ?? null;
  const engineConnection = executionStatus?.engine_connection ?? null;
  const statusError = executionStatus?.error ?? null;
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [isUpdatingDemoMode, setIsUpdatingDemoMode] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [desktopRuntimeStatus, setDesktopRuntimeStatus] = useState(null);
  const [desktopEngineUrl, setDesktopEngineUrl] = useState(
    executionStatus?.engine_connection?.base_url || ""
  );
  const [isSavingDesktopEngineUrl, setIsSavingDesktopEngineUrl] =
    useState(false);
  const desktopShell = isPrismDesktopShell();

  async function handleDemoModeToggle() {
    if (!onExecutionConfigUpdate || !demoMode) return;
    setIsUpdatingDemoMode(true);
    try {
      await onExecutionConfigUpdate({
        demoModeEnabled: !demoMode.enabled,
      });
    } finally {
      setIsUpdatingDemoMode(false);
    }
  }

  useEffect(() => {
    if (!desktopShell) return;
    let cancelled = false;

    getDesktopRuntimeStatus().then((status) => {
      if (cancelled || !status) return;
      setDesktopRuntimeStatus(status);
      setDesktopEngineUrl(status.execution_engine_url || "");
    });

    return () => {
      cancelled = true;
    };
  }, [desktopShell]);

  useEffect(() => {
    if (desktopShell) return;
    setDesktopEngineUrl(executionStatus?.engine_connection?.base_url || "");
  }, [desktopShell, executionStatus?.engine_connection?.base_url]);

  async function handleStatusRefresh() {
    if (!onExecutionStatusRefresh) return;
    setIsRefreshingStatus(true);
    try {
      await onExecutionStatusRefresh();
      if (desktopShell) {
        const status = await getDesktopRuntimeStatus();
        if (status) {
          setDesktopRuntimeStatus(status);
        }
      }
    } finally {
      setIsRefreshingStatus(false);
    }
  }

  async function handleDesktopEngineSaveAndRestart() {
    if (!desktopShell || isSavingDesktopEngineUrl) return;

    setIsSavingDesktopEngineUrl(true);
    try {
      const saveResult = await setDesktopExecutionEngineUrl(desktopEngineUrl);
      if (!saveResult?.success) {
        throw new Error(
          saveResult?.error || "Failed to save the execute engine URL."
        );
      }

      setDesktopRuntimeStatus(saveResult.status || null);
      showToast(
        "Saved execute engine URL. Prism will restart to apply the new runtime target.",
        "success"
      );

      const restartResult = await restartDesktopApp();
      if (!restartResult?.success) {
        throw new Error(
          restartResult?.error ||
            "Prism could not restart after saving the execute engine URL."
        );
      }
    } catch (error) {
      showToast(
        error.message || "Failed to update the execute engine URL.",
        "error"
      );
    } finally {
      setIsSavingDesktopEngineUrl(false);
    }
  }

  return (
    <div
      className="mt-4 rounded-[16px] border border-theme-modal-border px-4 py-4 text-theme-text-primary"
      data-testid="execute-target-panel"
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
        Execute Target
      </div>
      <label className="mt-3 block text-[12px] font-semibold uppercase tracking-[0.12em] text-theme-text-secondary">
        Selected worktree root
      </label>
      <input
        type="text"
        value={executionWorktreeRoot}
        onChange={(event) =>
          onExecutionWorktreeRootChange?.(event.target.value)
        }
        placeholder="/Users/paulcooper/Documents/Codex Master Folder/worktrees/..."
        data-testid="execution-worktree-root-input"
        className="mt-2 w-full rounded-[14px] border-none bg-theme-settings-input-bg px-4 py-3 text-[13px] text-theme-text-primary outline-none placeholder:text-theme-settings-input-placeholder"
      />
      {trustedSession?.trustedSessionId ? (
        <div
          className="mt-3 rounded-[14px] bg-theme-bg-secondary px-4 py-3 text-[12px] leading-5 text-theme-text-secondary"
          data-testid="trusted-session-banner"
        >
          <div>
            Trusted session:{" "}
            <span className="font-medium text-theme-text-primary">
              {trustedSession.trustedSessionId}
            </span>
          </div>
          {trustedSession?.sessionExpiresAt ? (
            <div>Expires: {trustedSession.sessionExpiresAt}</div>
          ) : null}
          {trustedSession?.subSphereId ? (
            <div>Sub-sphere: {trustedSession.subSphereId}</div>
          ) : null}
          {trustedSession?.selectedWorktreeRoot ? (
            <div>Scoped root: {trustedSession.selectedWorktreeRoot}</div>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 text-[12px] leading-5 text-theme-text-secondary">
          Execute mode opens a trusted session scoped to one selected repo or
          worktree root.
        </div>
      )}
      {desktopShell ? (
        <div className="mt-3 rounded-[14px] border border-theme-modal-border px-4 py-3 text-[12px] leading-5 text-theme-text-secondary">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
            Desktop execute engine
          </div>
          <div className="mt-2 text-[11px] leading-5 text-theme-text-secondary">
            Persist the sphere-thread-engine URL in Prism desktop config. Prism
            will restart after saving so the local server picks it up.
          </div>
          <input
            type="text"
            value={desktopEngineUrl}
            onChange={(event) => setDesktopEngineUrl(event.target.value)}
            placeholder="http://127.0.0.1:3001"
            data-testid="desktop-execution-engine-url-input"
            className="mt-3 w-full rounded-[14px] border-none bg-theme-settings-input-bg px-4 py-3 text-[13px] text-theme-text-primary outline-none placeholder:text-theme-settings-input-placeholder"
          />
          <div className="mt-2 text-[11px] leading-5 text-theme-text-secondary">
            {desktopRuntimeStatus?.execution_engine_url
              ? "Saved target: " + desktopRuntimeStatus.execution_engine_url
              : "No saved execute engine target yet."}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDesktopEngineSaveAndRestart}
              disabled={isSavingDesktopEngineUrl}
              className="rounded-full border border-theme-modal-border px-3 py-1.5 text-[11px] font-medium text-theme-text-primary disabled:opacity-50"
            >
              {isSavingDesktopEngineUrl
                ? "Saving..."
                : "Save and restart Prism"}
            </button>
          </div>
        </div>
      ) : null}
      {statusError ? (
        <div className="mt-3 rounded-[14px] border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-[12px] leading-5 text-rose-200 light:text-rose-700">
          Runtime status unavailable: {statusError}
        </div>
      ) : null}
      {executionStatus?.ok ? (
        <div
          className="mt-3 rounded-[14px] bg-theme-bg-secondary px-4 py-3 text-[12px] leading-5 text-theme-text-secondary"
          data-testid="execute-runtime-status"
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
            Runtime Status
          </div>
          <div className="mt-2">
            Bridge:{" "}
            <span className="font-medium text-theme-text-primary">
              {bridge?.ready ? "Ready" : "Attention needed"}
            </span>
            {bridge?.mode ? ` (${bridge.mode})` : ""}
          </div>
          <div>
            Engine URL: {engineConnection?.base_url || "Not configured"}
          </div>
          {engineConnection?.source ? (
            <div>Configured via: {engineConnection.source}</div>
          ) : null}
          <div>
            Engine connection:{" "}
            <span className="font-medium text-theme-text-primary">
              {!engineConnection?.configured
                ? "Needs configuration"
                : engineConnection?.reachable
                  ? "Reachable"
                  : "Unavailable"}
            </span>
          </div>
          {engineConnection?.error ? (
            <div className="mt-2 rounded-[12px] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-5 text-amber-100 light:text-amber-700">
              {engineConnection.error}
            </div>
          ) : null}
          {executionStatus?.backend_health_summary ? (
            <div>Backends: {executionStatus.backend_health_summary}</div>
          ) : null}
          {router?.defaultHealthyBackendId ? (
            <div>Default backend: {router.defaultHealthyBackendId}</div>
          ) : router?.defaultBackendId ? (
            <div>Preferred backend: {router.defaultBackendId}</div>
          ) : null}
          {router?.configVersion ? (
            <div>Router config: v{router.configVersion}</div>
          ) : null}
          {demoMode?.enabled ? (
            <div>
              Demo mode: enabled
              {demoMode?.session_ttl_ms
                ? ` (${Math.round(demoMode.session_ttl_ms / 60000)} min trusted session TTL)`
                : ""}
            </div>
          ) : null}
          {demoMode?.policy ? <div>Policy: {demoMode.policy}</div> : null}
          {versions ? (
            <div className="mt-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
                Installed stack
              </div>
              <div className="mt-2 grid gap-1">
                {versions?.engine ? (
                  <div>Engine: v{versions.engine}</div>
                ) : null}
                {versions?.runtime_env ? (
                  <div>Runtime env: {versions.runtime_env}</div>
                ) : null}
                {versions?.backends_config ? (
                  <div>Backends config: v{versions.backends_config}</div>
                ) : null}
              </div>
            </div>
          ) : null}
          {setupChecks.length ? (
            <div className="mt-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
                Setup checklist
              </div>
              <div className="mt-2 grid gap-2">
                {setupChecks.map((check) => (
                  <div
                    key={check.id}
                    className="rounded-[12px] border border-theme-modal-border px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-theme-text-primary">
                        {check.label}
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.14em] text-theme-text-secondary">
                        {check.status}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] leading-5 text-theme-text-secondary">
                      {check.detail}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {deliberation ? (
            <div className="mt-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
                Deliberation routing
              </div>
              <div className="mt-2">
                Mixed-provider ready:{" "}
                <span className="font-medium text-theme-text-primary">
                  {deliberation.mixed_provider_ready ? "Yes" : "Not yet"}
                </span>
              </div>
              <div>
                Healthy providers: {deliberation.healthy_provider_count}
              </div>
              <div>
                Lens backend prefs: {deliberation.lens_preference_count}
              </div>
              {deliberation.summary ? <div>{deliberation.summary}</div> : null}
              {Array.isArray(deliberation.routes) &&
              deliberation.routes.length ? (
                <div className="mt-2 grid gap-2">
                  {deliberation.routes.slice(0, 4).map((route) => (
                    <div
                      key={`${route.avatar_name}-${route.seat_number}`}
                      className="rounded-[12px] border border-theme-modal-border px-3 py-2"
                    >
                      <div className="font-medium text-theme-text-primary">
                        {route.avatar_name}
                      </div>
                      <div>
                        Backend: {route.backend_id || "Unresolved"}
                        {route.provider_id ? ` (${route.provider_id})` : ""}
                      </div>
                      {Array.isArray(route.fallback_backend_ids) &&
                      route.fallback_backend_ids.length ? (
                        <div>
                          Fallbacks: {route.fallback_backend_ids.join(", ")}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowAdvancedControls((current) => !current)}
              className="text-[10px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary"
            >
              {showAdvancedControls
                ? "Hide advanced runtime controls"
                : "Show advanced runtime controls"}
            </button>
            {showAdvancedControls ? (
              <div className="mt-2 grid gap-2 rounded-[12px] border border-theme-modal-border px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-theme-text-primary">
                      Hidden demo mode
                    </div>
                    <div className="text-[11px] leading-5 text-theme-text-secondary">
                      {demoMode?.enabled
                        ? "Demo-safe approvals are relaxed for the current engine session."
                        : "Standard execute safeguards are active."}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDemoModeToggle}
                    disabled={!demoMode || isUpdatingDemoMode}
                    className="rounded-full border border-theme-modal-border px-3 py-1.5 text-[11px] font-medium text-theme-text-primary disabled:opacity-50"
                  >
                    {isUpdatingDemoMode
                      ? "Updating..."
                      : demoMode?.enabled
                        ? "Disable demo mode"
                        : "Enable demo mode"}
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[11px] leading-5 text-theme-text-secondary">
                    Refresh runtime, backend, and routing health from the
                    engine.
                  </div>
                  <button
                    type="button"
                    onClick={handleStatusRefresh}
                    disabled={isRefreshingStatus}
                    className="rounded-full border border-theme-modal-border px-3 py-1.5 text-[11px] font-medium text-theme-text-primary disabled:opacity-50"
                  >
                    {isRefreshingStatus ? "Refreshing..." : "Refresh status"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StarterPackButton({ onClick, centered = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex h-7 cursor-pointer items-center justify-center rounded-full border-none px-2.5 ${
        centered
          ? "metacanon-composer-toolbar-button"
          : "hover:bg-zinc-700 light:hover:bg-slate-200"
      }`}
      aria-label="Open alignment menu"
    >
      <span
        className={`metacanon-composer-toolbar-label text-sm font-medium ${
          centered
            ? ""
            : "text-zinc-300 light:text-slate-600 group-hover:text-white light:group-hover:text-slate-800"
        }`}
      >
        Align
      </span>
    </button>
  );
}

function AgentSessionButton({
  sendCommand,
  promptInput,
  textareaRef,
  visible = true,
  centered = false,
}) {
  const { t } = useTranslation();
  if (!visible) return null;

  function handleClick() {
    try {
      if (promptInput?.trim()?.startsWith("@agent")) return;
      sendCommand({ text: "@agent", writeMode: "prepend" });
    } finally {
      textareaRef?.current?.focus();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        data-tooltip-id="agent-session"
        data-tooltip-content={t("chat_window.start_agent_session")}
        aria-label={t("chat_window.start_agent_session")}
        className={`group relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-none ${
          centered
            ? "metacanon-composer-toolbar-button"
            : "hover:bg-zinc-700 light:hover:bg-slate-200"
        }`}
      >
        <At
          size={17}
          className={`pointer-events-none shrink-0 ${
            centered
              ? "text-current"
              : "text-zinc-300 light:text-slate-600 group-hover:text-white light:group-hover:text-slate-600"
          }`}
        />
      </button>
      <Tooltip
        id="agent-session"
        place="bottom"
        delayShow={300}
        className="tooltip !text-xs z-99"
      />
    </>
  );
}

function ToolsButton({
  showTools,
  setShowTools,
  textareaRef,
  autoOpenedToolsRef,
  centered = false,
}) {
  const { t } = useTranslation();

  return (
    <button
      id="tools-btn"
      type="button"
      onClick={() => {
        autoOpenedToolsRef.current = false;
        setShowTools(!showTools);
        textareaRef.current?.focus();
      }}
      className={`group flex h-7 cursor-pointer items-center justify-center rounded-full border-none px-2.5 ${
        centered
          ? "metacanon-composer-toolbar-button"
          : showTools
            ? "bg-zinc-700 light:bg-slate-200"
            : "hover:bg-zinc-700 light:hover:bg-slate-200"
      }`}
      data-open={centered && showTools ? "true" : "false"}
    >
      <span
        className={`metacanon-composer-toolbar-label text-sm font-medium ${
          centered
            ? ""
            : showTools
              ? "text-white light:text-slate-800"
              : "text-zinc-300 light:text-slate-600 group-hover:text-white light:group-hover:text-slate-800"
        }`}
      >
        {t("chat_window.tools")}
      </span>
    </button>
  );
}

function SendPromptButton({
  formRef,
  promptInput,
  isDisabled,
  centered = false,
}) {
  const { t } = useTranslation();

  return (
    <>
      <button
        ref={formRef}
        type="submit"
        disabled={isDisabled || !promptInput.trim().length}
        className={`border-none flex justify-center items-center rounded-full w-10 h-10 transition-all ${
          promptInput.trim().length && !isDisabled
            ? centered
              ? "metacanon-send-button cursor-pointer"
              : "cursor-pointer bg-white hover:bg-zinc-200 light:bg-slate-800 light:hover:bg-slate-600"
            : centered
              ? "metacanon-send-button metacanon-send-button--disabled cursor-not-allowed"
              : "cursor-not-allowed bg-zinc-600 light:bg-slate-400"
        }`}
        data-tooltip-id="send-prompt"
        data-tooltip-content={
          isDisabled
            ? t("chat_window.attachments_processing")
            : t("chat_window.send")
        }
        aria-label={t("chat_window.send")}
      >
        <ArrowUp
          className={`metacanon-send-button-icon w-[18px] h-[18px] pointer-events-none ${
            centered ? "" : "text-zinc-800 light:text-white"
          }`}
          weight="bold"
        />

        <span className="sr-only">{t("chat_window.send")}</span>
      </button>
      <Tooltip
        id="send-prompt"
        place="bottom"
        delayShow={300}
        className="tooltip !text-xs z-99"
      />
    </>
  );
}

/**
 * Handle event listeners to prevent the send button from being used
 * for whatever reason that may we may want to prevent the user from sending a message.
 */
function useIsDisabled() {
  const [isDisabled, setIsDisabled] = useState(false);

  /**
   * Handle attachments processing and processed events
   * to prevent the send button from being clicked when attachments are processing
   * or else the query may not have relevant context since RAG is not yet ready.
   */
  useEffect(() => {
    if (!window) return;
    const onProcessing = () => setIsDisabled(true);
    const onProcessed = () => setIsDisabled(false);

    window.addEventListener(ATTACHMENTS_PROCESSING_EVENT, onProcessing);
    window.addEventListener(ATTACHMENTS_PROCESSED_EVENT, onProcessed);

    return () => {
      window.removeEventListener(ATTACHMENTS_PROCESSING_EVENT, onProcessing);
      window.removeEventListener(ATTACHMENTS_PROCESSED_EVENT, onProcessed);
    };
  }, []);

  return { isDisabled };
}
