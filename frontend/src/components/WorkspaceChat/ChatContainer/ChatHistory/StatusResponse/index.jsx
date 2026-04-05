import React, { useState } from "react";
import { CaretDown } from "@phosphor-icons/react/dist/csr/CaretDown";

import AgentAnimation from "@/media/animations/agent-animation.webm";
import AgentStatic from "@/media/animations/agent-static.png";
import DeliberationViewerModal from "@/components/Metacanon/DeliberationViewerModal";

const RUNNING_AGENT_RE = /^Running (.+)\.$/;

/**
 * Extract a clean agent name from a "Running {name}." message.
 * Strips a leading "The " prefix per the Human Sovereign decision.
 * Returns null if the message does not match the pattern.
 */
function parseAgentName(content = "") {
  const match = String(content || "").match(RUNNING_AGENT_RE);
  if (!match) return null;
  return match[1].replace(/^The /, "");
}

/**
 * A single agent pill. Two visual states: "running" (shimmer) and "done" (muted gold).
 * When an onClick handler is provided the pill becomes interactive.
 */
function AgentPill({ name, state, onClick }) {
  const stateClass =
    state === "running"
      ? "metacanon-agent-pill metacanon-agent-pill--running"
      : "metacanon-agent-pill metacanon-agent-pill--done";
  const isClickable = typeof onClick === "function";
  return (
    <span
      className={`inline-flex items-center text-[10px] px-2.5 py-1 rounded-full ${stateClass} ${isClickable ? "hover:opacity-80 transition-opacity" : ""}`}
      style={{ cursor: isClickable ? "pointer" : "default" }}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(e); }
          : undefined
      }
    >
      {name}
    </span>
  );
}

/**
 * Partition a message list into plain-text messages and agent pill descriptors.
 * Agent pill messages are those matching "Running {name}.".
 * The last pill is "running" when isThinking is true; all others are "done".
 */
function partitionMessages(messages = [], isThinking = false) {
  const textMessages = [];
  const pills = [];

  messages.forEach((msg) => {
    const agentName = parseAgentName(msg.content);
    if (agentName) {
      pills.push({ name: agentName, uuid: msg.uuid });
    } else {
      textMessages.push(msg);
    }
  });

  return {
    textMessages,
    pills: pills.map((pill, index) => ({
      ...pill,
      state:
        isThinking && index === pills.length - 1 ? "running" : "done",
    })),
  };
}

/**
 * Match a pill name to a lens in deliberationData.lensOutputs using
 * case-insensitive substring matching.
 */
function findLensKeyForPill(pillName = "", deliberationData = null) {
  if (!deliberationData?.lensOutputs?.length) return null;
  const normalized = pillName.toLowerCase();
  const lenses = deliberationData.lensOutputs;
  for (let i = 0; i < lenses.length; i++) {
    const label = (lenses[i].label || "").toLowerCase();
    if (label.includes(normalized) || normalized.includes(label)) {
      return `lens-${i}`;
    }
  }
  return null;
}

export default function StatusResponse({
  messages = [],
  isThinking = false,
  onExecuteSessionAction = null,
  deliberationData = null,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialKey, setModalInitialKey] = useState(null);
  const currentThought = messages[messages.length - 1];
  const previousThoughts = messages.slice(0, -1);
  const canResolveApproval =
    Boolean(currentThought?.requiresApproval) &&
    Boolean(currentThought?.pendingActionId) &&
    typeof onExecuteSessionAction === "function";

  // Partition ALL messages (previous + current) for the expanded view.
  const { textMessages: allTextMessages, pills: allPills } = partitionMessages(
    messages,
    isThinking
  );

  // For the collapsed single-line view, use only the current thought.
  const currentAgentName = parseAgentName(currentThought?.content);

  function handleExpandClick() {
    if (!previousThoughts.length > 0) return;
    setIsExpanded(!isExpanded);
  }

  function handlePillClick(pillName) {
    if (!deliberationData) return;
    const key = findLensKeyForPill(pillName, deliberationData);
    setModalInitialKey(key || (deliberationData?.lensOutputs?.length > 0 ? "lens-0" : null));
    setModalOpen(true);
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
    <>
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
              {!isExpanded ? (
                /* Collapsed: single-line preview */
                <div className="text-zinc-200 light:text-slate-800 font-mono text-sm leading-[18px]">
                  {currentAgentName ? (
                    <AgentPill
                      name={currentAgentName}
                      state={isThinking ? "running" : "done"}
                      onClick={deliberationData ? () => handlePillClick(currentAgentName) : undefined}
                    />
                  ) : (
                    <span className="block w-full truncate">
                      {currentThought?.content}
                    </span>
                  )}
                </div>
              ) : (
                /* Expanded: text messages above, pill row below */
                <div className="space-y-1">
                  {allTextMessages.length > 0 && (
                    <div className="text-zinc-200 light:text-slate-800 font-mono text-sm leading-[18px] space-y-1">
                      {allTextMessages.map((msg, index) => (
                        <div key={`text-${msg.uuid || index}`}>
                          {msg.content}
                        </div>
                      ))}
                    </div>
                  )}
                  {allPills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {allPills.map((pill, index) => (
                        <AgentPill
                          key={`pill-${pill.uuid || index}`}
                          name={pill.name}
                          state={pill.state}
                          onClick={deliberationData ? () => handlePillClick(pill.name) : undefined}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
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
    {modalOpen && deliberationData && (
      <DeliberationViewerModal
        deliberationData={deliberationData}
        initialSelectedKey={modalInitialKey}
        onClose={() => setModalOpen(false)}
      />
    )}
    </>
  );
}
