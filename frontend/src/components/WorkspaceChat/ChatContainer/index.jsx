import { useState, useEffect, useContext, useRef } from "react";
import ChatHistory from "./ChatHistory";
import {
  CLEAR_ATTACHMENTS_EVENT,
  DndUploaderContext,
  OPEN_ATTACHMENT_PICKER_EVENT,
} from "./DnDWrapper";
import PromptInput from "./PromptInput";
import { PROMPT_INPUT_EVENT, PROMPT_INPUT_ID } from "./PromptInput/constants";
import Workspace from "@/models/workspace";
import handleChat, { ABORT_STREAM_EVENT } from "@/utils/chat";
import { isMobile } from "react-device-detect";
import { SidebarMobileHeader } from "../../Sidebar";
import { useNavigate, useParams } from "react-router-dom";
import { v4 } from "uuid";
import handleSocketResponse, {
  websocketURI,
  AGENT_SESSION_END,
  setAgentSessionActive,
} from "@/utils/chat/agent";
import DnDFileUploaderWrapper from "./DnDWrapper";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { ChatTooltips } from "./ChatTooltips";
import { MetricsProvider } from "./ChatHistory/HistoricalMessage/Actions/RenderMetrics";
import useChatContainerQuickScroll from "@/hooks/useChatContainerQuickScroll";
import { PENDING_HOME_MESSAGE } from "@/utils/constants";
import { clearPromptInputDraft } from "@/hooks/usePromptInputStorage";
import { safeJsonParse } from "@/utils/request";
import paths from "@/utils/paths";
import TextSizeMenu from "./TextSizeMenu";
import SourcesSidebar, { SourcesSidebarProvider } from "./SourcesSidebar";
import PrismPresence from "@/components/PrismPresence";
import MetacanonHomeStage from "@/components/Metacanon/HomeStage";
import { buildAlignedPrompt } from "@/utils/metacanonAlignment";
import {
  signalPrismError,
  signalPrismResponse,
  signalPrismThinking,
} from "@/utils/prism/events";
import showToast from "@/utils/toast";

const AGENT_HANDLE_PATTERN =
  /^\s*(?:\/(?:agent|lens|constellation|council)\b|@(?:agent|council|constellation-[a-z0-9_-]+|[a-z0-9_-]+))\b/i;
const EXECUTE_INTENT_PATTERN =
  /\b(save\s+(?:it|this|that)|save\s+to|desktop\b|write\s+(?:a|the)?\s*(?:file|report|summary|markdown|md)\b|export\b|run\s+(?:tests?|build|command|script|check)\b|inspect\s+(?:the\s+)?(?:repo|repository|worktree|codebase)\b|edit\s+(?:the\s+)?file\b|search\s+(?:the\s+)?internet\b|browse\s+(?:the\s+)?web\b|go\s+online\b|look\s+(?:this|that|it)?\s*up\s+online\b|research\b)/i;

export default function ChatContainer({ workspace, knownHistory = [] }) {
  const navigate = useNavigate();
  const { threadSlug = null } = useParams();
  const [loadingResponse, setLoadingResponse] = useState(false);
  const [chatHistory, setChatHistory] = useState(knownHistory);
  const [socketId, setSocketId] = useState(null);
  const [websocket, setWebsocket] = useState(null);
  const [chatMode, setChatMode] = useState(workspace?.chatMode || "chat");
  const [executionMode, setExecutionMode] = useState("chat");
  const [executionWorktreeRoot, setExecutionWorktreeRoot] = useState("");
  const [trustedSession, setTrustedSession] = useState(null);
  const [executionStatus, setExecutionStatus] = useState(null);
  const { files, parseAttachments } = useContext(DndUploaderContext);
  const { chatHistoryRef } = useChatContainerQuickScroll();
  const pendingMessageChecked = useRef(false);
  const previousLoadingResponse = useRef(false);
  const lastSettledAssistantRef = useRef(null);
  const agentTurnLoadingRef = useRef(false);

  const { listening, resetTranscript } = useSpeechRecognition({
    clearTranscriptOnListen: true,
  });

  useEffect(() => {
    setChatMode(workspace?.chatMode || "chat");
  }, [workspace?.chatMode, workspace?.slug]);

  useEffect(() => {
    setExecutionMode("chat");
    setExecutionWorktreeRoot("");
    setTrustedSession(null);
    setExecutionStatus(null);
  }, [workspace?.slug, threadSlug]);

  useEffect(() => {
    const latestExecuteMessage = [...knownHistory]
      .reverse()
      .find(
        (entry) =>
          entry?.role === "assistant" &&
          entry?.executionMode === "execute" &&
          (entry?.trustedSessionId || entry?.selectedWorktreeRoot)
      );

    if (!latestExecuteMessage) return;

    setExecutionMode("execute");
    setExecutionWorktreeRoot(latestExecuteMessage.selectedWorktreeRoot || "");
    setTrustedSession({
      trustedSessionId: latestExecuteMessage.trustedSessionId || null,
      sessionExpiresAt: latestExecuteMessage.sessionExpiresAt || null,
      subSphereId: latestExecuteMessage.subSphereId || null,
      selectedWorktreeRoot: latestExecuteMessage.selectedWorktreeRoot || "",
    });
  }, [knownHistory]);

  async function fetchExecutionStatus(nextTrustedSessionId = null) {
    if (executionMode !== "execute" || !workspace?.slug) {
      setExecutionStatus(null);
      return null;
    }

    const result = threadSlug
      ? await Workspace.threads.executionStatus(
          { workspaceSlug: workspace.slug, threadSlug },
          {
            trustedSessionId:
              nextTrustedSessionId ?? trustedSession?.trustedSessionId ?? null,
          }
        )
      : await Workspace.executionStatus(
          { slug: workspace.slug },
          {
            trustedSessionId:
              nextTrustedSessionId ?? trustedSession?.trustedSessionId ?? null,
          }
        );

    setExecutionStatus(result?.ok ? result : { error: result?.error || null });
    return result;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadExecutionStatus() {
      const result = await (threadSlug || workspace?.slug
        ? fetchExecutionStatus()
        : null);
      if (!cancelled && result == null) {
        setExecutionStatus(null);
      }
    }

    loadExecutionStatus().catch((error) => {
      if (!cancelled) {
        setExecutionStatus({
          error: error.message || "Failed to load execute status.",
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    executionMode,
    workspace?.slug,
    threadSlug,
    trustedSession?.trustedSessionId,
  ]);

  async function handleExecutionConfigUpdate({ demoModeEnabled }) {
    try {
      const result = threadSlug
        ? await Workspace.threads.updateExecutionConfig(
            { workspaceSlug: workspace.slug, threadSlug },
            { demoModeEnabled }
          )
        : await Workspace.updateExecutionConfig(
            { slug: workspace.slug },
            { demoModeEnabled }
          );

      if (result?.error || result?.message) {
        throw new Error(result.error || result.message);
      }

      await fetchExecutionStatus();
      showToast("Execute configuration updated.", "success");
      return result;
    } catch (error) {
      showToast(
        error.message || "Failed to update execute configuration.",
        "error"
      );
      throw error;
    }
  }

  async function handleChatModeChange(nextMode) {
    if (!workspace?.slug || !nextMode || nextMode === chatMode) return;
    const previousMode = chatMode;
    setChatMode(nextMode);
    const { workspace: updatedWorkspace, message } = await Workspace.update(
      workspace.slug,
      { chatMode: nextMode }
    );

    if (!updatedWorkspace) {
      setChatMode(previousMode);
      showToast(message || "Failed to update chat mode.", "error");
      return;
    }

    showToast(
      nextMode === "chat" ? "Chat mode enabled." : "Query mode enabled.",
      "success"
    );
  }

  function handleExecutionModeChange(nextMode) {
    if (!nextMode) return;
    setExecutionMode(nextMode === "execute" ? "execute" : "chat");
  }

  function updateTrustedSession(chatResult, selectedWorktreeRoot) {
    const nextTrustedSessionId = chatResult?.trustedSessionId;
    const sessionExpiresAt = chatResult?.sessionExpiresAt;
    const subSphereId = chatResult?.subSphereId;
    const sessionWorktreeRoot =
      chatResult?.selectedWorktreeRoot ?? selectedWorktreeRoot;

    if (!nextTrustedSessionId && !sessionExpiresAt && !subSphereId) return;

    setTrustedSession((current) => ({
      trustedSessionId:
        nextTrustedSessionId ?? current?.trustedSessionId ?? null,
      sessionExpiresAt: sessionExpiresAt ?? current?.sessionExpiresAt ?? null,
      subSphereId: subSphereId ?? current?.subSphereId ?? null,
      selectedWorktreeRoot:
        sessionWorktreeRoot ??
        current?.selectedWorktreeRoot ??
        executionWorktreeRoot.trim() ??
        "",
    }));
  }

  function ensureExecutionTarget() {
    if (executionMode !== "execute") return true;
    if (executionWorktreeRoot.trim()) return true;
    showToast("Execute mode requires a selected worktree root.", "error");
    return false;
  }

  function shouldHandoffToExecute(message) {
    const value = String(message || "").trim();
    if (!value) return false;
    if (executionMode === "execute") return false;
    if (value.startsWith("/") || value.startsWith("@")) return false;
    return EXECUTE_INTENT_PATTERN.test(value);
  }

  function handoffToExecute(message) {
    setExecutionMode("execute");
    setMessageEmit(message || "", "replace");
    showToast(
      "This task needs Execute mode. Prism switched modes so you can pick a worktree and run it with approvals.",
      "info"
    );
  }

  const handleExecuteSessionAction = async ({
    action,
    pendingActionId = null,
    reason = null,
  }) => {
    if (!trustedSession?.trustedSessionId) {
      showToast("No active trusted session is available.", "error");
      return;
    }

    try {
      const result = threadSlug
        ? await Workspace.threads.executeSessionAction(
            { workspaceSlug: workspace.slug, threadSlug },
            {
              trustedSessionId: trustedSession.trustedSessionId,
              action,
              pendingActionId,
              reason,
            }
          )
        : await Workspace.executeSessionAction(
            { slug: workspace.slug },
            {
              trustedSessionId: trustedSession.trustedSessionId,
              action,
              pendingActionId,
              reason,
            }
          );

      if (result?.error || result?.message) {
        throw new Error(result.error || result.message);
      }

      if (result?.session) {
        setTrustedSession({
          trustedSessionId: result.session.trustedSessionId,
          sessionExpiresAt: result.session.expiresAt ?? null,
          subSphereId: result.session.subSphereId ?? null,
          selectedWorktreeRoot:
            result.session.selectedWorktreeRoot ??
            executionWorktreeRoot.trim() ??
            "",
        });
      }

      const statusText =
        result?.action_result?.status_text || "Execute session updated.";
      setChatHistory((prev) => [
        ...prev,
        {
          uuid: v4(),
          type: "statusResponse",
          content: statusText,
          role: "assistant",
          sources: [],
          closed: true,
          error: null,
          animate: false,
          pending: false,
          trustedSessionId:
            result?.session?.trustedSessionId ??
            trustedSession.trustedSessionId,
          sessionExpiresAt:
            result?.session?.expiresAt ??
            trustedSession.sessionExpiresAt ??
            null,
          subSphereId:
            result?.session?.subSphereId ?? trustedSession.subSphereId,
          selectedWorktreeRoot:
            result?.session?.selectedWorktreeRoot ??
            trustedSession.selectedWorktreeRoot,
        },
      ]);
      showToast(statusText, "success");
      await fetchExecutionStatus(result?.session?.trustedSessionId ?? null);
    } catch (error) {
      showToast(error.message || "Failed to update execute session.", "error");
      throw error;
    }
  };

  /**
   * Emit an update to the state of the prompt input without directly
   * passing a prop in so that it does not re-render constantly.
   * @param {string} messageContent - The message content to set
   * @param {'replace' | 'append'} writeMode - Replace current text or append to existing text (default: replace)
   */
  function setMessageEmit(messageContent = "", writeMode = "replace") {
    window.dispatchEvent(
      new CustomEvent(PROMPT_INPUT_EVENT, {
        detail: { messageContent, writeMode },
      })
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!ensureExecutionTarget()) return false;
    const currentMessage = buildAlignedPrompt(
      document.getElementById(PROMPT_INPUT_ID)?.value || "",
      undefined,
      chatHistory
    );
    if (!currentMessage) return false;
    if (shouldHandoffToExecute(currentMessage)) {
      handoffToExecute(currentMessage);
      return false;
    }
    agentTurnLoadingRef.current = AGENT_HANDLE_PATTERN.test(currentMessage);

    // Clear the localStorage draft for this thread/workspace so that if the
    // PromptInput remounts (empty→chat transition), it won't restore stale text
    clearPromptInputDraft(threadSlug ?? workspace.slug);

    const prevChatHistory = [
      ...chatHistory,
      {
        content: currentMessage,
        role: "user",
        attachments: parseAttachments(),
      },
      {
        content: "",
        role: "assistant",
        pending: true,
        userMessage: currentMessage,
        animate: true,
      },
    ];

    if (listening) {
      // Stop the mic if the send button is clicked
      endSTTSession();
    }
    setChatHistory(prevChatHistory);
    setMessageEmit("");
    setLoadingResponse(true);
  };

  function endSTTSession() {
    SpeechRecognition.stopListening();
    resetTranscript();
  }

  const regenerateAssistantMessage = (chatId) => {
    const updatedHistory = chatHistory.slice(0, -1);
    const lastUserMessage = updatedHistory.slice(-1)[0];
    Workspace.deleteChats(workspace.slug, [chatId])
      .then(() =>
        sendCommand({
          text: lastUserMessage.content,
          autoSubmit: true,
          history: updatedHistory,
          attachments: lastUserMessage?.attachments,
        })
      )
      .catch((e) => console.error(e));
  };

  /**
   * Send a command to the LLM prompt input.
   * @param {Object} options - Arguments to send to the LLM
   * @param {string} options.text - The text to send to the LLM
   * @param {boolean} options.autoSubmit - Determines if the text should be sent immediately or if it should be added to the message state (default: false)
   * @param {Object[]} options.history - The history of the chat prior to this message for overriding the current chat history
   * @param {Object[import("./DnDWrapper").Attachment]} options.attachments - The attachments to send to the LLM for this message
   * @param {'replace' | 'append' | 'prepend'} options.writeMode - Replace current text or append to existing text (default: replace)
   * @returns {void}
   */
  const sendCommand = async ({
    text = "",
    autoSubmit = false,
    history = [],
    attachments = [],
    writeMode = "replace",
  } = {}) => {
    // If we are not auto-submitting, we can just emit the text to the prompt input.
    if (!autoSubmit) {
      setMessageEmit(text, writeMode);
      return;
    }

    if (writeMode === "prepend") {
      const currentText = document.getElementById(PROMPT_INPUT_ID)?.value ?? "";
      text = currentText + " " + text;
    }

    // If we are auto-submitting in append mode
    // than we need to update text with whatever is in the prompt input + the text we are sending.
    // @note: `message` will not work here since it is not updated yet.
    // If text is still empty, after this, then we should just return.
    if (writeMode === "append") {
      const currentText = document.getElementById(PROMPT_INPUT_ID)?.value ?? "";
      text = currentText + text;
    }

    if (!text || text === "") return false;
    text = buildAlignedPrompt(
      text,
      undefined,
      history.length > 0 ? history : chatHistory
    );
    if (shouldHandoffToExecute(text)) {
      handoffToExecute(text);
      return false;
    }
    agentTurnLoadingRef.current = AGENT_HANDLE_PATTERN.test(text);

    // Clear the localStorage draft so that if the PromptInput remounts
    // (e.g. /reset causing empty→chat or chat→empty transitions),
    // it won't restore stale text.
    clearPromptInputDraft(threadSlug ?? workspace.slug);

    // If we are auto-submitting
    // Then we can replace the current text since this is not accumulating.
    let prevChatHistory;
    if (history.length > 0) {
      // use pre-determined history chain.
      prevChatHistory = [
        ...history,
        {
          content: "",
          role: "assistant",
          pending: true,
          userMessage: text,
          attachments,
          animate: true,
        },
      ];
    } else {
      prevChatHistory = [
        ...chatHistory,
        {
          content: text,
          role: "user",
          attachments,
        },
        {
          content: "",
          role: "assistant",
          pending: true,
          userMessage: text,
          attachments,
          animate: true,
        },
      ];
    }

    setChatHistory(prevChatHistory);
    setMessageEmit("");
    setLoadingResponse(true);
  };

  useEffect(() => {
    if (pendingMessageChecked.current || !workspace?.slug) return;
    pendingMessageChecked.current = true;

    const pending = safeJsonParse(sessionStorage.getItem(PENDING_HOME_MESSAGE));
    if (pending?.message) {
      setTimeout(() => {
        sessionStorage.removeItem(PENDING_HOME_MESSAGE);
        sendCommand({
          text: pending.message,
          attachments: pending.attachments || [],
          autoSubmit: true,
        });
      }, 100);
    }
  }, [workspace?.slug]);

  useEffect(() => {
    async function fetchReply() {
      const promptMessage =
        chatHistory.length > 0 ? chatHistory[chatHistory.length - 1] : null;
      const remHistory = chatHistory.length > 0 ? chatHistory.slice(0, -1) : [];
      var _chatHistory = [...remHistory];

      // Override hook for new messages to now go to agents until the connection closes
      if (!!websocket) {
        if (!promptMessage || !promptMessage?.userMessage) return false;
        window.dispatchEvent(new CustomEvent(CLEAR_ATTACHMENTS_EVENT));
        websocket.send(
          JSON.stringify({
            type: "awaitingFeedback",
            feedback: promptMessage?.userMessage,
          })
        );
        return;
      }

      if (!promptMessage || !promptMessage?.userMessage) return false;

      // If running and edit or regeneration, this history will already have attachments
      // so no need to parse the current state.
      const attachments = promptMessage?.attachments ?? parseAttachments();
      window.dispatchEvent(new CustomEvent(CLEAR_ATTACHMENTS_EVENT));

      await Workspace.multiplexStream({
        workspaceSlug: workspace.slug,
        threadSlug,
        prompt: promptMessage.userMessage,
        chatHandler: (chatResult) => {
          if (executionMode === "execute") {
            updateTrustedSession(chatResult, executionWorktreeRoot.trim());
          }

          return handleChat(
            chatResult,
            setLoadingResponse,
            setChatHistory,
            remHistory,
            _chatHistory,
            setSocketId
          );
        },
        attachments,
        executionMode,
        trustedSessionId:
          executionMode === "execute"
            ? (trustedSession?.trustedSessionId ?? null)
            : null,
        executionContext:
          executionMode === "execute"
            ? {
                selectedWorktreeRoot: executionWorktreeRoot.trim(),
              }
            : null,
      });
      return;
    }
    loadingResponse === true && fetchReply();
  }, [loadingResponse, chatHistory, workspace]);

  useEffect(() => {
    if (agentTurnLoadingRef.current) {
      if (!loadingResponse && !socketId && !websocket) {
        agentTurnLoadingRef.current = false;
        signalPrismResponse({ source: "agent-turn-settled" });
      }
      previousLoadingResponse.current = loadingResponse;
      return;
    }

    if (!!websocket || !!socketId) {
      previousLoadingResponse.current = loadingResponse;
      return;
    }

    if (loadingResponse && !previousLoadingResponse.current) {
      signalPrismThinking({ source: "chat-stream" });
    }

    if (!loadingResponse && previousLoadingResponse.current) {
      signalPrismResponse({ source: "chat-stream" });
    }

    previousLoadingResponse.current = loadingResponse;
  }, [chatHistory, loadingResponse, socketId, websocket]);

  useEffect(() => {
    if (loadingResponse) return;

    const lastSettledAssistant = [...chatHistory]
      .reverse()
      .find(
        (message) =>
          message?.role === "assistant" &&
          !!message?.content &&
          !message?.pending &&
          !message?.animate
      );

    if (!lastSettledAssistant) return;

    const responseKey =
      lastSettledAssistant.chatId ||
      lastSettledAssistant.uuid ||
      `${chatHistory.length}:${lastSettledAssistant.content}`;

    if (lastSettledAssistantRef.current === responseKey) return;
    lastSettledAssistantRef.current = responseKey;

    signalPrismResponse({ source: "chat-history" });
    agentTurnLoadingRef.current = false;

    if (socketId || websocket) {
      setAgentSessionActive(false);
      window.dispatchEvent(new CustomEvent(AGENT_SESSION_END));
    }
  }, [chatHistory, loadingResponse, socketId, websocket]);

  // TODO: Simplify this WSS stuff
  useEffect(() => {
    let socket = null;

    function handleWSS() {
      try {
        if (!socketId || !!websocket) return;
        socket = new WebSocket(
          `${websocketURI()}/api/agent-invocation/${socketId}`
        );
        socket.supportsAgentStreaming = false;
        socket.agentSessionReady = false;
        socket.agentSessionFailed = false;
        socket.agentSessionHadActivity = false;
        socket.agentSessionInitTimeout = window.setTimeout(() => {
          if (socket?.agentSessionReady || socket?.agentSessionFailed) return;
          socket.agentSessionFailed = true;
          signalPrismError({
            source: "agent-socket",
            message:
              "Agent session did not finish initializing. Please try again.",
          });
          setChatHistory((prev) => [
            ...prev.filter((msg) => !!msg.content),
            {
              uuid: v4(),
              type: "abort",
              content:
                "Agent session did not finish initializing. Please try again.",
              role: "assistant",
              sources: [],
              closed: true,
              error:
                "Agent session did not finish initializing. Please try again.",
              animate: false,
              pending: false,
            },
          ]);
          setLoadingResponse(false);
          setAgentSessionActive(false);
          window.dispatchEvent(new CustomEvent(AGENT_SESSION_END));
          socket?.close();
        }, 8000);

        window.addEventListener(ABORT_STREAM_EVENT, () => {
          if (socket?.agentSessionInitTimeout) {
            window.clearTimeout(socket.agentSessionInitTimeout);
            socket.agentSessionInitTimeout = null;
          }
          setAgentSessionActive(false);
          window.dispatchEvent(new CustomEvent(AGENT_SESSION_END));
          socket?.close();
        });

        socket.addEventListener("message", (event) => {
          setLoadingResponse(true);
          try {
            handleSocketResponse(socket, event, setChatHistory);
          } catch {
            console.error("Failed to parse data");
            setAgentSessionActive(false);
            window.dispatchEvent(new CustomEvent(AGENT_SESSION_END));
            socket.close();
          }
          setLoadingResponse(false);
        });

        socket.addEventListener("close", (_event) => {
          if (socket?.agentSessionInitTimeout) {
            window.clearTimeout(socket.agentSessionInitTimeout);
            socket.agentSessionInitTimeout = null;
          }
          setAgentSessionActive(false);
          window.dispatchEvent(new CustomEvent(AGENT_SESSION_END));
          signalPrismResponse({ source: "agent-socket-close" });
          if (
            socket?.agentSessionReady &&
            !socket?.agentSessionFailed &&
            !socket?.agentSessionTerminalResponseSeen
          ) {
            setChatHistory((prev) => [
              ...prev.filter((msg) => !!msg.content),
              {
                uuid: v4(),
                type: "statusResponse",
                content: "Agent session complete.",
                role: "assistant",
                sources: [],
                closed: true,
                error: null,
                animate: false,
                pending: false,
              },
            ]);
          }
          setLoadingResponse(false);
          setWebsocket(null);
          setSocketId(null);
          agentTurnLoadingRef.current = false;
        });
        setWebsocket(socket);
        window.dispatchEvent(new CustomEvent(CLEAR_ATTACHMENTS_EVENT));
      } catch (e) {
        signalPrismError({ source: "agent-socket", message: e.message });
        setChatHistory((prev) => [
          ...prev.filter((msg) => !!msg.content),
          {
            uuid: v4(),
            type: "abort",
            content: e.message,
            role: "assistant",
            sources: [],
            closed: true,
            error: e.message,
            animate: false,
            pending: false,
          },
        ]);
        setLoadingResponse(false);
        setWebsocket(null);
        setSocketId(null);
        agentTurnLoadingRef.current = false;
      }
    }
    handleWSS();

    return () => {
      if (socket) {
        if (socket.agentSessionInitTimeout) {
          window.clearTimeout(socket.agentSessionInitTimeout);
          socket.agentSessionInitTimeout = null;
        }
        setAgentSessionActive(false);
        window.dispatchEvent(new CustomEvent(AGENT_SESSION_END));
        socket.close();
      }
    };
  }, [socketId]);

  const isEmpty =
    chatHistory.length === 0 && !sessionStorage.getItem(PENDING_HOME_MESSAGE);

  if (isEmpty) {
    return (
      <div
        style={{ height: "100%" }}
        className="metacanon-home-surface transition-all duration-500 relative flex-1 min-w-0 h-full overflow-hidden border-none"
      >
        {isMobile && <SidebarMobileHeader />}
        <TextSizeMenu />
        <DnDFileUploaderWrapper>
          <MetacanonHomeStage
            submit={handleSubmit}
            isStreaming={loadingResponse}
            sendCommand={sendCommand}
            attachments={files}
            workspaceSlug={workspace.slug}
            threadSlug={threadSlug}
            chatMode={chatMode}
            onChatModeChange={handleChatModeChange}
            executionMode={executionMode}
            onExecutionModeChange={handleExecutionModeChange}
            executionWorktreeRoot={executionWorktreeRoot}
            onExecutionWorktreeRootChange={setExecutionWorktreeRoot}
            trustedSession={trustedSession}
            executionStatus={executionStatus}
            hasAvailableWorkspace={!!workspace}
            onCreateAgent={() => navigate(paths.settings.agentSkills())}
            onConnectLLM={() => navigate(paths.settings.llmPreference())}
            onEditWorkspace={() =>
              navigate(
                paths.workspace.settings.generalAppearance(workspace.slug)
              )
            }
            onUploadDocument={() =>
              window.dispatchEvent(
                new CustomEvent(OPEN_ATTACHMENT_PICKER_EVENT)
              )
            }
          />
        </DnDFileUploaderWrapper>
        <ChatTooltips />
      </div>
    );
  }

  return (
    <SourcesSidebarProvider>
      <div
        style={{ height: "100%" }}
        className="relative flex flex-1 min-w-0 h-full z-[2]"
      >
        <div className="workspace-prism-chat-panel flex-1 min-w-0 transition-all duration-500 relative text-white light:text-slate-900 h-full overflow-hidden">
          <div className="absolute top-3 right-4 md:right-6 z-30 hidden md:block">
            <TextSizeMenu
              floating={false}
              className="absolute top-0 right-0"
              buttonClassName="workspace-prism-chat-rail__toggle"
              panelClassName="workspace-prism-chat-rail__menu"
            />
          </div>
          <div className="absolute top-[52px] right-4 md:right-6 z-20 hidden md:block">
            <PrismPresence
              surface="chat-corner"
              size="sm"
              label="Prism"
              caption="Listening"
              align="center"
            />
          </div>
          {isMobile && <SidebarMobileHeader />}
          <DnDFileUploaderWrapper>
            <div className="flex flex-col h-full w-full">
              <div className="flex flex-1 min-h-0 flex-col">
                <MetricsProvider>
                  <ChatHistory
                    ref={chatHistoryRef}
                    history={chatHistory}
                    workspace={workspace}
                    sendCommand={sendCommand}
                    updateHistory={setChatHistory}
                    regenerateAssistantMessage={regenerateAssistantMessage}
                    onExecuteSessionAction={handleExecuteSessionAction}
                  />
                </MetricsProvider>
                <PromptInput
                  submit={handleSubmit}
                  isStreaming={loadingResponse}
                  sendCommand={sendCommand}
                  attachments={files}
                  centered={false}
                  workspaceSlug={workspace.slug}
                  threadSlug={threadSlug}
                  chatMode={chatMode}
                  onChatModeChange={handleChatModeChange}
                  executionMode={executionMode}
                  onExecutionModeChange={handleExecutionModeChange}
                  executionWorktreeRoot={executionWorktreeRoot}
                  onExecutionWorktreeRootChange={setExecutionWorktreeRoot}
                  trustedSession={trustedSession}
                  executionStatus={executionStatus}
                  onExecutionStatusRefresh={() => fetchExecutionStatus()}
                  onExecutionConfigUpdate={handleExecutionConfigUpdate}
                />
              </div>
            </div>
          </DnDFileUploaderWrapper>
          <ChatTooltips />
        </div>
        <SourcesSidebar />
      </div>
    </SourcesSidebarProvider>
  );
}
