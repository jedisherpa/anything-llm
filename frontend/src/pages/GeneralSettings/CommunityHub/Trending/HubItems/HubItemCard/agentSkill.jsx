import { Link } from "react-router-dom";
import paths from "@/utils/paths";
import pluralize from "pluralize";
import { VisibilityIcon } from "./generic";

export default function AgentSkillHubCard({ item }) {
  return (
    <>
      <Link
        key={item.id}
        to={paths.communityHub.importItem(item.importId)}
        className="bg-theme-settings-input-bg light:bg-theme-bg-secondary rounded-[16px] p-4 hover:bg-theme-action-menu-item-hover transition-all duration-200 cursor-pointer group border border-theme-sidebar-border hover:border-theme-sidebar-border/80"
      >
        <div className="flex gap-x-2 items-center">
          <p className="text-theme-text-primary text-sm font-medium">{item.name}</p>
          <VisibilityIcon visibility={item.visibility} />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-theme-text-secondary text-xs mt-1">{item.description}</p>

          <p className="font-mono text-xs mt-1 text-theme-text-secondary">
            {item.verified ? (
              <span className="metacanon-lens-card__badge rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">Verified</span>
            ) : (
              <span className="text-theme-text-secondary/60">Unverified</span>
            )}{" "}
            Skill
          </p>
          <p className="font-mono text-xs mt-1 text-theme-text-secondary">
            {item.manifest.files?.length || 0}{" "}
            {pluralize("file", item.manifest.files?.length || 0)} found
          </p>
        </div>
        <div className="flex justify-end mt-2">
          <span className="text-primary-button hover:text-primary-button/80 text-sm font-medium px-3 py-1.5 rounded-[14px] bg-theme-settings-input-bg group-hover:bg-theme-action-menu-item-hover transition-all border border-theme-sidebar-border">
            Import →
          </span>
        </div>
      </Link>
    </>
  );
}
