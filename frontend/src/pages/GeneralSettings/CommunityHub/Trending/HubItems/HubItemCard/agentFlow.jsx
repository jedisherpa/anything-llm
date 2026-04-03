import { Link } from "react-router-dom";
import paths from "@/utils/paths";
import { VisibilityIcon } from "./generic";
import { safeJsonParse } from "@/utils/request";

export default function AgentFlowHubCard({ item }) {
  const flow = safeJsonParse(item.flow, { steps: [] });
  return (
    <Link
      to={paths.communityHub.importItem(item.importId)}
      className="bg-theme-settings-input-bg light:bg-theme-bg-secondary rounded-[16px] p-4 hover:bg-theme-action-menu-item-hover transition-all duration-200 cursor-pointer group border border-theme-sidebar-border hover:border-theme-sidebar-border/80 flex flex-col h-full"
    >
      <div className="flex gap-x-2 items-center">
        <p className="text-theme-text-primary text-sm font-medium">{item.name}</p>
        <VisibilityIcon visibility={item.visibility} />
      </div>
      <div className="flex flex-col gap-2 flex-1">
        <p className="text-theme-text-secondary text-xs mt-1">{item.description}</p>
        <label className="text-theme-text-secondary text-xs font-semibold mt-4">
          Steps ({flow.steps.length}):
        </label>
        <div className="text-theme-text-secondary text-xs bg-theme-settings-input-bg px-2 py-1 rounded-[14px] font-mono border border-theme-sidebar-border">
          <ul className="list-disc pl-4">
            {flow.steps.map((step, index) => (
              <li key={index}>{step.type}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex justify-end mt-2">
        <span className="text-primary-button hover:text-primary-button/80 text-sm font-medium px-3 py-1.5 rounded-[14px] bg-theme-settings-input-bg group-hover:bg-theme-action-menu-item-hover transition-all border border-theme-sidebar-border">
          Import →
        </span>
      </div>
    </Link>
  );
}
