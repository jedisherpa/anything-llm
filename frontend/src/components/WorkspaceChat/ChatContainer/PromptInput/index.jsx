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
import { clearActiveMetacanonAlignment } from "@/utils/metacanonAlignment";
import StarterPackSheet from "@/components/Metacanon/StarterPackSheet";

export const PROMPT_INPUT_ID = "primary-prompt-input";
export const PROMPT_INPUT_EVENT = "set_prompt_input";
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
}) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const { isDisabled } = useIsDisabled();
  const agentSessionActive = useIsAgentSessionActive();
  const activeAlignment = useMetacanonAlignment();
  const [promptInput, setPromptInput] = useState("");
  const [showTools, setShowTools] = useState(false);
  const [showStarterPacks, setShowStarterPacks] = useState(false);
  const autoOpenedToolsRef = useRef(false);
  const toolsHighlightRef = useRef(-1);
  const formRef = useRef(null);
  const textareaRef = useRef(null);
  const [_, setFocused] = useState(false);
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const { textSizeClass } = useTextSize();
  const [searchParams] = useSearchParams();
  const centeredPlaceholder = centered
    ? chatMode === "query"
      ? "Query your documents with Prism..."
      : resolvedTheme === "light"
        ? "Send a message"
        : "Speak, and the Prism listens..."
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
      sendCommand({ text: "@agent " });
      textareaRef.current?.focus();
    }
  }, [textareaRef.current]);

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

  useEffect(() => {
    if (!isStreaming && textareaRef.current) textareaRef.current.focus();
    resetTextAreaHeight();
  }, [isStreaming]);

  /**
   * Save the current state before changes
   * @param {number} adjustment
   */
  function saveCurrentState(adjustment = 0) {
    if (undoStack.current.length >= MAX_EDIT_STACK_SIZE)
      undoStack.current.shift();
    undoStack.current.push({
      value: promptInput,
      cursorPositionStart: textareaRef.current.selectionStart + adjustment,
      cursorPositionEnd: textareaRef.current.selectionEnd + adjustment,
    });
  }
  const debouncedSaveState = debounce(saveCurrentState, 250);

  function handleSubmit(e) {
    // Ignore submits from portaled modals (slash command preset forms)
    if (e.target !== e.currentTarget) return;
    setFocused(false);
    setShowTools(false);
    submit(e);
  }

  function resetTextAreaHeight() {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
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
    debouncedSaveState(-1);
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
          : "w-full fixed md:absolute bottom-0 left-0 z-10 flex justify-center items-center pwa:pb-5"
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
              className={`${centered ? "metacanon-composer-shell" : "bg-zinc-800 light:bg-white light:border light:border-slate-300"} flex flex-col overflow-hidden rounded-[24px] px-6 pwa:rounded-3xl`}
            >
              <AttachmentManager attachments={attachments} />
              {typeof onChatModeChange === "function" ? (
                <div className="pt-4">
                  <ChatModeToggle
                    chatMode={chatMode}
                    onChange={onChatModeChange}
                  />
                </div>
              ) : null}
              {activeAlignment?.handle ? (
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

function ChatModeToggle({ chatMode = "chat", onChange }) {
  const { t } = useTranslation();
  const description =
    chatMode === "chat"
      ? "Conversational synthesis with model knowledge and retrieved context."
      : "Direct retrieval from your documents with stricter vector grounding.";

  return (
    <div className="metacanon-chat-mode-shell rounded-[16px] px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
          Chat vs Query
        </div>
        <div className="metacanon-chat-mode-toggle flex items-center rounded-full p-1">
          <button
            type="button"
            disabled={chatMode === "chat"}
            onClick={() => onChange?.("chat")}
            className="metacanon-chat-mode-toggle__button rounded-full px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.12em]"
            data-active={chatMode === "chat" ? "true" : "false"}
          >
            {t("chat.mode.chat.title")}
          </button>
          <button
            type="button"
            disabled={chatMode === "query"}
            onClick={() => onChange?.("query")}
            className="metacanon-chat-mode-toggle__button rounded-full px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.12em]"
            data-active={chatMode === "query" ? "true" : "false"}
          >
            {t("chat.mode.query.title")}
          </button>
        </div>
      </div>
      <div className="mt-2 text-[12px] leading-5 text-theme-text-secondary">
        {description}
      </div>
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
