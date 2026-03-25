import CTAButton from "@/components/lib/CTAButton";
import CommunityHubImportItemSteps from "../..";
import showToast from "@/utils/toast";
import paths from "@/utils/paths";
import { CircleNotch } from "@phosphor-icons/react/dist/csr/CircleNotch";

import { useState } from "react";
import AgentFlows from "@/models/agentFlows";
import { safeJsonParse } from "@/utils/request";

export default function AgentFlow({ item, setStep }) {
  const flowInfo = safeJsonParse(item.flow, { steps: [] });
  const [loading, setLoading] = useState(false);

  async function importAgentFlow() {
    try {
      setLoading(true);
      const { success, error, flow } = await AgentFlows.saveFlow(
        item.name,
        flowInfo
      );
      if (!success) throw new Error(error);
      if (!!flow?.uuid) await AgentFlows.toggleFlow(flow.uuid, true); // Enable the flow automatically after import

      showToast(`Agent flow imported successfully!`, "success");
      setStep(CommunityHubImportItemSteps.completed.key);
    } catch (e) {
      console.error(e);
      showToast(`Failed to import agent flow. ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-theme-text-primary">
          Import Agent Flow &quot;{item.name}&quot;
        </h2>
        {item.creatorUsername && (
          <p className="text-xs font-mono text-theme-text-secondary">
            Created by{" "}
            <a
              href={paths.communityHub.profile(item.creatorUsername)}
              target="_blank"
              className="font-semibold text-theme-primary-button transition-colors duration-200 hover:text-theme-text-primary hover:underline"
              rel="noreferrer"
            >
              @{item.creatorUsername}
            </a>
          </p>
        )}
      </div>

      <div className="prism-community-import-summary text-sm leading-7 text-theme-text-secondary">
        <p>
          Agent flows allow you to create reusable sequences of actions that can
          be triggered by your agent.
        </p>

        <div className="mt-5 flex flex-col gap-3">
          <p className="font-semibold text-theme-text-primary">Flow details</p>
          <p>{item.description || "No description was provided with this flow."}</p>
          <div>
            <p className="font-semibold text-theme-text-primary">
              Steps ({flowInfo.steps.length})
            </p>
            <ul className="mt-2 list-disc pl-6">
              {flowInfo.steps.map((step, index) => (
                <li key={index}>{step.type}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="prism-community-import-summary">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-primary-button">
            Type
          </div>
          <div className="mt-2 text-sm font-semibold text-theme-text-primary">
            Agent Flow
          </div>
        </div>
        <div className="prism-community-import-summary">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-primary-button">
            Imported State
          </div>
          <div className="mt-2 text-sm font-semibold text-theme-text-primary">
            Enabled automatically
          </div>
        </div>
        <div className="prism-community-import-summary">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-primary-button">
            Step Count
          </div>
          <div className="mt-2 text-sm font-semibold text-theme-text-primary">
            {flowInfo.steps.length} step{flowInfo.steps.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <CTAButton
          type="button"
          disabled={loading}
          className="!mr-0 h-11 w-full rounded-[14px] text-dark-text md:w-auto md:min-w-[220px]"
          onClick={importAgentFlow}
        >
          {loading ? <CircleNotch size={16} className="animate-spin" /> : null}
          {loading ? "Importing..." : "Import agent flow"}
        </CTAButton>
      </div>
    </div>
  );
}
