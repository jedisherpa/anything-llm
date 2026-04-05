import React, { memo, useEffect, useRef, useState } from "react";
import { Info } from "@phosphor-icons/react/dist/csr/Info";
import { Warning } from "@phosphor-icons/react/dist/csr/Warning";

import Actions from "./Actions";
import renderMarkdown from "@/utils/chat/markdown";
import Citations from "../Citation";
import { v4 } from "uuid";
import DOMPurify from "@/utils/chat/purify";
import { EditMessageForm, useEditMessage } from "./Actions/EditMessage";
import { useWatchDeleteMessage } from "./Actions/DeleteMessage";
import TTSMessage from "./Actions/TTSButton";
import {
  THOUGHT_REGEX_CLOSE,
  THOUGHT_REGEX_COMPLETE,
  THOUGHT_REGEX_OPEN,
  ThoughtChainComponent,
} from "../ThoughtContainer";
import paths from "@/utils/paths";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { chatQueryRefusalResponse } from "@/utils/chat";
import { formatPromptForDisplay } from "@/utils/metacanonAlignment";

const HistoricalMessage = ({
  uuid = v4(),
  message,
  role,
  workspace,
  sources = [],
  attachments = [],
  error = false,
  feedbackScore = null,
  chatId = null,
  isLastMessage = false,
  regenerateMessage,
  saveEditedMessage,
  forkThread,
  metrics = {},
  executionMode = null,
  trustedSessionId = null,
  sessionExpiresAt = null,
  subSphereId = null,
  selectedWorktreeRoot = null,
  artifactRefs = [],
  requiresApproval = false,
  pendingActionId = null,
}) => {
  const { t } = useTranslation();
  const { isEditing } = useEditMessage({ chatId, role });
  const { isDeleted, completeDelete, onEndAnimation } = useWatchDeleteMessage({
    chatId,
    role,
  });
  const adjustTextArea = (event) => {
    const element = event.target;
    element.style.height = "auto";
    element.style.height = element.scrollHeight + "px";
  };

  const isRefusalMessage =
    role === "assistant" && message === chatQueryRefusalResponse(workspace);

  if (completeDelete) return null;

  if (!!error) {
    return (
      <div key={uuid} className="flex justify-start w-full">
        <div className="py-3 pl-0 pr-4 flex flex-col md:max-w-[80%]">
          <div className="p-2 rounded-lg bg-red-50 text-red-500">
            <span className="inline-block">
              <Warning className="h-4 w-4 mb-1 inline-block" /> Could not
              respond to message.
            </span>
            <p className="text-xs font-mono mt-2 border-l-2 border-red-300 pl-2 bg-red-200 p-2 rounded-sm">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (role === "user") {
    if (isEditing) {
      return (
        <div key={uuid} className="flex justify-end w-full py-3 px-4">
          <EditMessageForm
            role={role}
            chatId={chatId}
            message={message}
            attachments={attachments}
            adjustTextArea={adjustTextArea}
            saveChanges={saveEditedMessage}
          />
        </div>
      );
    }

    return (
      <div
        key={uuid}
        onAnimationEnd={onEndAnimation}
        className={`${isDeleted ? "animate-remove" : ""} flex justify-end w-full group`}
      >
        <div className="py-3 px-4 flex flex-col items-end">
          <div className="metacanon-user-bubble max-w-[600px] px-4 py-3.5 [&_p]:m-0">
            <TruncatableContent>
              <RenderChatContent
                role={role}
                message={formatPromptForDisplay(message)}
                messageId={uuid}
              />

              <ChatAttachments attachments={attachments} />
            </TruncatableContent>
          </div>
          <Actions
            message={message}
            feedbackScore={feedbackScore}
            chatId={chatId}
            slug={workspace?.slug}
            isLastMessage={isLastMessage}
            regenerateMessage={regenerateMessage}
            isEditing={isEditing}
            role={role}
            forkThread={forkThread}
            metrics={metrics}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      key={uuid}
      onAnimationEnd={onEndAnimation}
      className={`${isDeleted ? "animate-remove" : ""} flex justify-start w-full group`}
    >
      <div className="py-3 px-4 md:pl-0 flex flex-col w-full">
        {isEditing ? (
          <EditMessageForm
            role={role}
            chatId={chatId}
            message={message}
            attachments={attachments}
            adjustTextArea={adjustTextArea}
            saveChanges={saveEditedMessage}
          />
        ) : (
          <div className="metacanon-assistant-message break-words">
            <RenderChatContent role={role} message={message} messageId={uuid} />
            {isRefusalMessage && (
              <Link
                data-tooltip-id="query-refusal-info"
                data-tooltip-content={`${t("chat.refusal.tooltip-description")}`}
                className="!no-underline group !flex w-fit"
                to={paths.chatModes()}
                target="_blank"
              >
                <div className="flex flex-row items-center gap-x-1 group-hover:opacity-100 opacity-60 w-fit">
                  <Info className="text-theme-text-secondary" />
                  <p className="!m-0 !p-0 text-theme-text-secondary !no-underline text-xs cursor-pointer">
                    {t("chat.refusal.tooltip-title")}
                  </p>
                </div>
              </Link>
            )}

            <ChatAttachments attachments={attachments} />
            <ExecutionSummaryCard
              executionMode={executionMode}
              trustedSessionId={trustedSessionId}
              sessionExpiresAt={sessionExpiresAt}
              subSphereId={subSphereId}
              selectedWorktreeRoot={selectedWorktreeRoot}
              artifactRefs={artifactRefs}
              requiresApproval={requiresApproval}
              pendingActionId={pendingActionId}
            />
          </div>
        )}

        <div className="mt-2 flex items-start md:items-center gap-x-1">
          <TTSMessage
            slug={workspace?.slug}
            chatId={chatId}
            message={message}
          />

          <Actions
            message={message}
            feedbackScore={feedbackScore}
            chatId={chatId}
            slug={workspace?.slug}
            isLastMessage={isLastMessage}
            regenerateMessage={regenerateMessage}
            isEditing={isEditing}
            role={role}
            forkThread={forkThread}
            metrics={metrics}
          />
        </div>
        {role === "assistant" && <Citations sources={sources} />}
      </div>
    </div>
  );
};

export default memo(
  HistoricalMessage,
  // Skip re-render the historical message:
  // if the content is the exact same AND (not streaming)
  // the lastMessage status is the same (regen icon)
  // and the chatID matches between renders. (feedback icons)
  (prevProps, nextProps) => {
    return (
      prevProps.message === nextProps.message &&
      prevProps.isLastMessage === nextProps.isLastMessage &&
      prevProps.chatId === nextProps.chatId
    );
  }
);

function ExecutionSummaryCard({
  executionMode = null,
  trustedSessionId = null,
  sessionExpiresAt = null,
  subSphereId = null,
  selectedWorktreeRoot = null,
  artifactRefs = [],
  requiresApproval = false,
  pendingActionId = null,
}) {
  if (executionMode !== "execute") return null;

  return (
    <div
      className="mt-4 rounded-[18px] border border-theme-modal-border bg-theme-bg-secondary px-4 py-3 text-[12px] leading-5 text-theme-text-secondary"
      data-testid="execute-artifact-summary"
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
        Execute Result
      </div>
      {trustedSessionId ? (
        <div className="mt-2">
          Trusted session:{" "}
          <span className="font-medium text-theme-text-primary">
            {trustedSessionId}
          </span>
        </div>
      ) : null}
      {selectedWorktreeRoot ? (
        <div>Scoped root: {selectedWorktreeRoot}</div>
      ) : null}
      {subSphereId ? <div>Sub-sphere: {subSphereId}</div> : null}
      {sessionExpiresAt ? <div>Session expiry: {sessionExpiresAt}</div> : null}
      {requiresApproval && pendingActionId ? (
        <div className="mt-2 rounded-[12px] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-200 light:text-amber-700">
          Pending approval: {pendingActionId}
        </div>
      ) : null}
      {Array.isArray(artifactRefs) && artifactRefs.length ? (
        <div className="mt-3 grid gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
            Artifacts
          </div>
          {artifactRefs.map((artifact, index) => (
            <div
              key={artifact.artifact_id || artifact.value || index}
              className="rounded-[12px] border border-theme-modal-border px-3 py-2"
            >
              <div className="font-medium text-theme-text-primary">
                {artifact.label || artifact.kind || `Artifact ${index + 1}`}
              </div>
              {artifact.kind ? <div>Type: {artifact.kind}</div> : null}
              {artifact.value ? (
                <div className="break-all">Path: {artifact.value}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChatAttachments({ attachments = [] }) {
  if (!attachments.length) return null;
  return (
    <div className="flex flex-wrap gap-4 mt-4">
      {attachments.map((item) => (
        <img
          alt={`Attachment: ${item.name}`}
          key={item.name}
          src={item.contentString}
          className="w-[120px] h-[120px] object-cover rounded-lg"
        />
      ))}
    </div>
  );
}

function TruncatableContent({ children }) {
  const contentRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (contentRef.current) {
      setIsOverflowing(contentRef.current.scrollHeight > 250);
    }
  }, []);

  const showTruncation = !isExpanded && isOverflowing;

  return (
    <>
      <div className="relative">
        <div
          ref={contentRef}
          className={showTruncation ? "max-h-[250px] overflow-hidden" : ""}
        >
          {children}
        </div>
        {showTruncation && (
          <>
            <div
              className="absolute bottom-0 left-0 right-0 h-[36px] light:hidden pointer-events-none"
              style={{
                background:
                  "linear-gradient(180deg, rgba(39, 39, 42, 0.00) 0%, rgba(39, 39, 42, 0.65) 50%, #27272A 100%)",
              }}
            />

            <div
              className="absolute bottom-0 left-0 right-0 h-[36px] hidden light:block pointer-events-none"
              style={{
                background:
                  "linear-gradient(180deg, rgba(241, 245, 249, 0.00) 0%, rgba(241, 245, 249, 0.65) 50%, #F1F5F9 100%)",
              }}
            />
          </>
        )}
      </div>
      {isOverflowing && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-zinc-300 light:text-slate-700 hover:text-white light:hover:text-slate-900 text-xs font-medium leading-4 mt-2"
        >
          {isExpanded ? t("chat_window.see_less") : t("chat_window.see_more")}
        </button>
      )}
    </>
  );
}

const RenderChatContent = memo(
  ({ role, message, messageId }) => {
    // If the message is not from the assistant, we can render it directly
    // as normal since the user cannot think (lol)
    if (role !== "assistant")
      return (
        <span
          className="flex flex-col gap-y-1 text-white light:text-slate-900"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(renderMarkdown(message)),
          }}
        />
      );

    let thoughtChain = null;
    let msgToRender = message;
    if (!message) return null;

    // If the message is a perfect thought chain, we can render it directly
    // Complete == open and close tags match perfectly.
    if (message.match(THOUGHT_REGEX_COMPLETE)) {
      thoughtChain = message.match(THOUGHT_REGEX_COMPLETE)?.[0];
      msgToRender = message.replace(THOUGHT_REGEX_COMPLETE, "");
    }

    // If the message is a thought chain but not a complete thought chain (matching opening tags but not closing tags),
    // we can render it as a thought chain if we can at least find a closing tag
    // This can occur when the assistant starts with <thinking> and then <response>'s later.
    if (
      message.match(THOUGHT_REGEX_OPEN) &&
      !message.match(THOUGHT_REGEX_CLOSE)
    ) {
      thoughtChain = message;
      msgToRender = "";
    }

    return (
      <>
        {thoughtChain && (
          <ThoughtChainComponent content={thoughtChain} messageId={messageId} />
        )}

        <span
          className="flex flex-col gap-y-1 text-white light:text-slate-900"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(renderMarkdown(msgToRender)),
          }}
        />
      </>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.role === nextProps.role &&
      prevProps.message === nextProps.message &&
      prevProps.messageId === nextProps.messageId
    );
  }
);
