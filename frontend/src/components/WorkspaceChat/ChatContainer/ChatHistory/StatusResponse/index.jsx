import React, { useState } from "react";
import { CaretDown } from "@phosphor-icons/react/dist/csr/CaretDown";

import AgentAnimation from "@/media/animations/agent-animation.webm";
import AgentStatic from "@/media/animations/agent-static.png";

export default function StatusResponse({
  messages = [],
  isThinking = false,
  onExecuteSessionAction = null,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const currentThought = messages[messages.length - 1];
  const previousThoughts = messages.slice(0, -1);
  const canResolveApproval =
    Boolean(currentThought?.requiresApproval) &&
    Boolean(currentThought?.pendingActionId) &&
    typeof onExecuteSessionAction === "function";

  function handleExpandClick() {
    if (!previousThoughts.length > 0) return;
    setIsExpanded(!isExpanded);
  }

  async function handleApprovalAction(action) {
    if (!canResolveApproval || pendingAction) return;

    const reason =
      action === "reject"
        ? window.prompt(
            "Why should Prism reject this pending action?",
            "Rejected in Prism execute mode."
          ) || "Rejected in Prism execute mode."
        : null;

    try {
      setPendingAction(action);
      await onExecuteSessionAction({
        action,
        pendingActionId: currentThought.pendingActionId,
        reason,
      });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div
      className="flex justify-center w-full pr-4"
      data-testid="status-response"
    >
      <div className="w-full flex flex-col">
        <div className="w-full">
          <div
            onClick={handleExpandClick}
            style={{
              transition: "all 0.1s ease-in-out",
              borderRadius: "16px",
            }}
            className="metacanon-status-thought relative p-4"
          >
            <div className="absolute top-4 left-4 w-[18px] h-[18px]">
              {isThinking ? (
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-[18px] h-[18px] scale-[165%] transition-opacity duration-200 light:invert light:opacity-50"
                  data-tooltip-id="agent-thinking"
                  data-tooltip-content="Agent is thinking..."
                  aria-label="Agent is thinking..."
                >
                  <source src={AgentAnimation} type="video/webm" />
                </video>
              ) : (
                <img
                  src={AgentStatic}
                  alt="Agent complete"
                  className="w-[18px] h-[18px] transition-opacity duration-200 light:invert light:opacity-50"
                  data-tooltip-id="agent-thinking"
                  data-tooltip-content="Agent has finished thinking"
                  aria-label="Agent has finished thinking"
                />
              )}
            </div>
            {previousThoughts?.length > 0 && (
              <button
                onClick={handleExpandClick}
                className="absolute top-4 right-4 border-none text-zinc-200 light:text-slate-800 transition-colors"
                data-tooltip-id="expand-cot"
                data-tooltip-content={
                  isExpanded ? "Hide thought chain" : "Show thought chain"
                }
                aria-label={
                  isExpanded ? "Hide thought chain" : "Show thought chain"
                }
              >
                <CaretDown
                  className={`w-4 h-4 transform transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                />
              </button>
            )}

            <div
              className={`ml-[28px] mr-[26px] transition-[max-height] duration-300 ease-in-out origin-top ${isExpanded ? "" : "overflow-hidden max-h-[18px]"}`}
            >
              <div className="text-zinc-200 light:text-slate-800 font-mono text-sm leading-[18px]">
                {!isExpanded ? (
                  <span className="block w-full truncate">
                    {currentThought.content}
                  </span>
                ) : (
                  <>
                    {previousThoughts.map((thought, index) => (
                      <div
                        key={`cot-${thought.uuid || index}`}
                        className="mb-2"
                      >
                        {thought.content}
                      </div>
                    ))}
                    <div>{currentThought.content}</div>
                  </>
                )}
              </div>
              {canResolveApproval ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={Boolean(pendingAction)}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleApprovalAction("approve");
                    }}
                    data-testid="execute-approve-button"
                    className="rounded-full border-none bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white disabled:cursor-wait disabled:opacity-60"
                  >
                    {pendingAction === "approve" ? "Approving..." : "Approve"}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(pendingAction)}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleApprovalAction("reject");
                    }}
                    data-testid="execute-reject-button"
                    className="rounded-full border-none bg-rose-600 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white disabled:cursor-wait disabled:opacity-60"
                  >
                    {pendingAction === "reject" ? "Rejecting..." : "Reject"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
