import React, { useState, useEffect, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { isMobile } from "react-device-detect";
import { SidebarMobileHeader } from "@/components/Sidebar";
import {
  PROMPT_INPUT_EVENT,
  PROMPT_INPUT_ID,
} from "@/components/WorkspaceChat/ChatContainer/PromptInput/constants";
import DnDFileUploaderWrapper, {
  DndUploaderContext,
  DnDFileUploaderProvider,
  OPEN_ATTACHMENT_PICKER_EVENT,
  PASTE_ATTACHMENT_EVENT,
} from "@/components/WorkspaceChat/ChatContainer/DnDWrapper";
import { useTranslation } from "react-i18next";
import {
  LAST_VISITED_WORKSPACE,
  PENDING_HOME_MESSAGE,
  PRISM_HOME_FIRST_RUN_HINT_DISMISSED,
} from "@/utils/constants";
import Workspace from "@/models/workspace";
import paths from "@/utils/paths";
import showToast from "@/utils/toast";
import { safeJsonParse } from "@/utils/request";
import useUser from "@/hooks/useUser";
import System from "@/models/system";
import TextSizeMenu from "@/components/WorkspaceChat/ChatContainer/TextSizeMenu";
import { ChatTooltips } from "@/components/WorkspaceChat/ChatContainer/ChatTooltips";
import MetacanonHomeStage from "@/components/Metacanon/HomeStage";
import RuntimeReadinessModal from "@/components/Metacanon/RuntimeReadinessModal";
import PrismSetupAssistantModal from "@/components/Metacanon/PrismSetupAssistantModal";
import { loadPrismSetupDraft } from "@/utils/prismSetupState";

async function getTargetWorkspace() {
  const lastVisited = safeJsonParse(
    localStorage.getItem(LAST_VISITED_WORKSPACE)
  );
  if (lastVisited?.slug) {
    const workspace = await Workspace.bySlug(lastVisited.slug);
    if (workspace) return workspace;
  }

  const workspaces = await Workspace.all();
  return workspaces.length > 0 ? workspaces[0] : null;
}

async function createDefaultWorkspace(workspaceName = "My Workspace") {
  const { workspace, message: errorMsg } = await Workspace.new({
    name: workspaceName,
  });
  if (!workspace) {
    showToast(errorMsg || "Failed to create workspace", "error");
    return null;
  }
  return workspace;
}

export default function Home() {
  const { t } = useTranslation();
  const { user } = useUser();
  const [workspace, setWorkspace] = useState(null);
  const [threadSlug, setThreadSlug] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [showFirstRunHint, setShowFirstRunHint] = useState(() => {
    try {
      return (
        localStorage.getItem(PRISM_HOME_FIRST_RUN_HINT_DISMISSED) !== "true"
      );
    } catch {
      return true;
    }
  });
  const pendingFilesRef = useRef([]);

  function dismissFirstRunHint() {
    setShowFirstRunHint(false);
    try {
      localStorage.setItem(PRISM_HOME_FIRST_RUN_HINT_DISMISSED, "true");
    } catch {
      // Ignore localStorage failures while dismissing the hint.
    }
  }

  useEffect(() => {
    async function init() {
      const ws = await getTargetWorkspace();
      if (ws) {
        const [suggestedMessages, pfpUrl] = await Promise.all([
          Workspace.getSuggestedMessages(ws.slug),
          Workspace.fetchPfp(ws.slug),
        ]);
        setWorkspace({ ...ws, suggestedMessages, pfpUrl });
      }
      setWorkspaceLoading(false);
    }
    init();
  }, []);

  // When workspace/thread becomes available and we have pending files, trigger upload
  useEffect(() => {
    if (workspace && threadSlug && pendingFilesRef.current.length > 0) {
      const files = pendingFilesRef.current;
      pendingFilesRef.current = [];
      window.dispatchEvent(
        new CustomEvent(PASTE_ATTACHMENT_EVENT, { detail: { files } })
      );
    }
  }, [t, workspace, threadSlug]);

  // Handle paste events when no thread exists yet
  useEffect(() => {
    if (threadSlug) return;

    async function handlePaste(e) {
      const files = e.detail?.files;
      if (!files?.length) return;

      pendingFilesRef.current = files;
      let ws = workspace;
      if (!ws) {
        ws = await createDefaultWorkspace(t("new-workspace.placeholder"));
        if (!ws) return;
        setWorkspace(ws);
      }
      const { thread } = await Workspace.threads.new(ws.slug);
      if (thread) setThreadSlug(thread.slug);
    }

    window.addEventListener(PASTE_ATTACHMENT_EVENT, handlePaste);
    return () =>
      window.removeEventListener(PASTE_ATTACHMENT_EVENT, handlePaste);
  }, [workspace, threadSlug]);

  async function handleDropWithoutWorkspace(acceptedFiles) {
    setDragging(false);
    pendingFilesRef.current = acceptedFiles;
    const ws = await createDefaultWorkspace(t("new-workspace.placeholder"));
    if (!ws) return;
    setWorkspace(ws);
    const { thread } = await Workspace.threads.new(ws.slug);
    if (thread) setThreadSlug(thread.slug);
  }

  async function handleDropWithWorkspace(acceptedFiles) {
    setDragging(false);
    pendingFilesRef.current = acceptedFiles;
    const { thread } = await Workspace.threads.new(workspace.slug);
    if (thread) setThreadSlug(thread.slug);
  }

  if (workspaceLoading) {
    return (
      <div
        style={{ height: "100%" }}
        className="transition-all duration-500 relative flex-1 min-w-0 bg-zinc-900 light:bg-white h-full overflow-hidden"
      />
    );
  }

  if (!workspace && user?.role === "default") {
    return <NoWorkspacesAssigned />;
  }

  if (workspace && threadSlug) {
    return (
      <DnDFileUploaderProvider workspace={workspace} threadSlug={threadSlug}>
        <HomeContent
          workspace={workspace}
          setWorkspace={setWorkspace}
          threadSlug={threadSlug}
          setThreadSlug={setThreadSlug}
          showFirstRunHint={showFirstRunHint}
          dismissFirstRunHint={dismissFirstRunHint}
        />
      </DnDFileUploaderProvider>
    );
  }

  return (
    <DndUploaderContext.Provider
      value={{
        files: [],
        ready: true,
        dragging,
        setDragging,
        onDrop: workspace
          ? handleDropWithWorkspace
          : handleDropWithoutWorkspace,
        parseAttachments: () => [],
      }}
    >
      <HomeContent
        workspace={workspace}
        setWorkspace={setWorkspace}
        threadSlug={null}
        setThreadSlug={setThreadSlug}
        showFirstRunHint={showFirstRunHint}
        dismissFirstRunHint={dismissFirstRunHint}
      />
    </DndUploaderContext.Provider>
  );
}

function HomeContent({
  workspace,
  setWorkspace,
  threadSlug,
  setThreadSlug,
  showFirstRunHint,
  dismissFirstRunHint,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showReadinessModal, setShowReadinessModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [checkedSetupGate, setCheckedSetupGate] = useState(false);
  const { files, parseAttachments } = useContext(DndUploaderContext);
  const chatMode = workspace?.chatMode || "chat";

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(PROMPT_INPUT_EVENT, {
        detail: { messageContent: "", writeMode: "replace" },
      })
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function inspectSetupGate() {
      const onboardingComplete = await System.isOnboardingComplete();
      const draft = await loadPrismSetupDraft();
      if (cancelled) return;

      if (onboardingComplete && draft?.formState) {
        setShowSetupModal(true);
      }
      setCheckedSetupGate(true);
    }

    inspectSetupGate();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleChatModeChange(nextMode) {
    if (!nextMode || nextMode === chatMode) return;

    if (!workspace?.slug) return;

    const { workspace: updatedWorkspace, message } = await Workspace.update(
      workspace.slug,
      { chatMode: nextMode }
    );

    if (!updatedWorkspace) {
      showToast(message || "Failed to update chat mode.", "error");
      return;
    }

    setWorkspace((current) => ({ ...current, ...updatedWorkspace }));
    showToast(
      nextMode === "chat" ? "Chat mode enabled." : "Query mode enabled.",
      "success"
    );
  }

  async function submitMessage(message, attachments = []) {
    if (!message || loading) return;
    dismissFirstRunHint?.();
    setLoading(true);
    try {
      let targetWorkspace = workspace;
      let targetThread = threadSlug;

      if (!targetWorkspace) {
        targetWorkspace = await createDefaultWorkspace(
          t("new-workspace.placeholder")
        );
        if (!targetWorkspace) {
          setLoading(false);
          return;
        }
        setWorkspace(targetWorkspace);
      }

      if (!targetThread) {
        const { thread } = await Workspace.threads.new(targetWorkspace.slug);
        targetThread = thread?.slug;
        if (thread) setThreadSlug(thread.slug);
      }

      sessionStorage.setItem(
        PENDING_HOME_MESSAGE,
        JSON.stringify({ message, attachments })
      );

      if (targetThread) {
        navigate(paths.workspace.thread(targetWorkspace.slug, targetThread));
      } else {
        navigate(paths.workspace.chat(targetWorkspace.slug));
      }
    } catch (error) {
      console.error("Error submitting message:", error);
      showToast("Failed to send message", "error");
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const currentMessage =
      document.getElementById(PROMPT_INPUT_ID)?.value?.trim() || "";
    await submitMessage(currentMessage, parseAttachments());
  }

  function sendCommand({
    text = "",
    autoSubmit = false,
    writeMode = "replace",
  }) {
    if (autoSubmit) {
      if (writeMode === "append") {
        const currentText =
          document.getElementById(PROMPT_INPUT_ID)?.value ?? "";
        text = currentText + text;
      }
      if (!text.trim()) return;
      submitMessage(text.trim());
      return;
    }
    window.dispatchEvent(
      new CustomEvent(PROMPT_INPUT_EVENT, {
        detail: { messageContent: text, writeMode },
      })
    );
  }

  async function handleEditWorkspace() {
    let targetWorkspace = workspace;

    if (!targetWorkspace) {
      targetWorkspace = await createDefaultWorkspace(
        t("new-workspace.placeholder")
      );
      if (!targetWorkspace) return;
      setWorkspace(targetWorkspace);
    }

    navigate(paths.workspace.settings.generalAppearance(targetWorkspace.slug));
  }

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
          isStreaming={loading}
          sendCommand={sendCommand}
          attachments={files}
          workspaceSlug={workspace?.slug}
          threadSlug={threadSlug}
          chatMode={chatMode}
          onChatModeChange={handleChatModeChange}
          hasAvailableWorkspace={!!workspace}
          onCreateAgent={() => navigate(paths.settings.agentSkills())}
          onConnectLLM={() => navigate(paths.settings.llmPreference())}
          onEditWorkspace={handleEditWorkspace}
          onUploadDocument={() =>
            window.dispatchEvent(new CustomEvent(OPEN_ATTACHMENT_PICKER_EVENT))
          }
          onOpenReadiness={() => setShowReadinessModal(true)}
          onOpenSetup={() => setShowSetupModal(true)}
          showFirstRunHint={showFirstRunHint}
          onDismissFirstRunHint={dismissFirstRunHint}
          setupNeedsAttention={!checkedSetupGate || showSetupModal}
        />
      </DnDFileUploaderWrapper>
      <RuntimeReadinessModal
        isOpen={showReadinessModal}
        onClose={() => setShowReadinessModal(false)}
        workspaceSlug={workspace?.slug}
        onOpenSetup={() => setShowSetupModal(true)}
      />
      <PrismSetupAssistantModal
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onApplied={() => setShowReadinessModal(true)}
      />
      <ChatTooltips />
    </div>
  );
}

function NoWorkspacesAssigned() {
  const { t } = useTranslation();
  return (
    <div
      style={{ height: "100%" }}
      className="transition-all duration-500 relative flex-1 min-w-0 bg-zinc-900 light:bg-white h-full overflow-hidden"
    >
      <div className="flex flex-col h-full w-full items-center justify-center">
        <p className="text-white/60 text-sm text-center whitespace-pre-line">
          {t("home.notAssigned")}
        </p>
      </div>
    </div>
  );
}
