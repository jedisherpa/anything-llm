import paths from "@/utils/paths";
import { Eye } from "@phosphor-icons/react/dist/csr/Eye";
import { LockSimple } from "@phosphor-icons/react/dist/csr/LockSimple";

import { Link } from "react-router-dom";
import { Tooltip } from "react-tooltip";

export default function GenericHubCard({ item }) {
  return (
    <div
      key={item.id}
      className="bg-theme-settings-input-bg light:bg-theme-bg-secondary rounded-[16px] p-4 hover:bg-theme-action-menu-item-hover transition-all duration-200 border border-theme-sidebar-border"
    >
      <p className="text-theme-text-primary text-sm font-medium">{item.name}</p>
      <p className="text-theme-text-secondary text-xs mt-1">{item.description}</p>
      <div className="flex justify-end mt-2">
        <Link
          className="text-primary-button hover:text-primary-button/80 text-xs"
          to={paths.communityHub.importItem(item.importId)}
        >
          Import →
        </Link>
      </div>
    </div>
  );
}

export function VisibilityIcon({ visibility = "public" }) {
  const Icon = visibility === "private" ? LockSimple : Eye;

  return (
    <>
      <div
        data-tooltip-id="visibility-icon"
        data-tooltip-content={`This item is ${visibility === "private" ? "private" : "public"}`}
      >
        <Icon className="w-4 h-4 text-theme-text-secondary" />
      </div>
      <Tooltip
        id="visibility-icon"
        place="top"
        delayShow={300}
        className="allm-tooltip !allm-text-xs"
      />
    </>
  );
}
