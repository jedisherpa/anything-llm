import React from "react";
import { CaretRight } from "@phosphor-icons/react/dist/csr/CaretRight";

export default function AgentFlowsList({
  flows = [],
  selectedFlow,
  handleClick,
}) {
  if (flows.length === 0) {
    return (
      <div className="prism-empty-state prism-empty-state--compact text-xs">
        <p>No agent flows found</p>
        <a
          href="https://docs.anythingllm.com/agent-flows/getting-started"
          target="_blank"
          className="text-theme-text-secondary underline hover:text-cta-button"
          rel="noreferrer"
        >
          Learn more about Agent Flows.
        </a>
      </div>
    );
  }

  return (
    <div className="prism-interactive-list text-white rounded-xl w-full md:min-w-[360px]">
      {flows.map((flow, index) => (
        <div
          key={flow.uuid}
          className={`prism-interactive-list-row py-3 px-4 flex items-center justify-between ${
            index === 0 ? "rounded-t-xl" : ""
          } ${
            index === flows.length - 1 ? "rounded-b-xl" : ""
          } cursor-pointer transition-all duration-300 hover:bg-theme-bg-primary ${
            selectedFlow?.uuid === flow.uuid
              ? "bg-white/10 light:bg-theme-bg-sidebar"
              : ""
          }`}
          onClick={() => handleClick?.(flow)}
        >
          <div className="text-sm font-light">{flow.name}</div>
          <div className="flex items-center gap-x-2">
            <div className="text-sm text-theme-text-secondary font-medium">
              {flow.active ? "On" : "Off"}
            </div>
            <CaretRight
              size={14}
              weight="bold"
              className="text-theme-text-secondary"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
