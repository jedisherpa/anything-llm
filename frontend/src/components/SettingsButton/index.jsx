import useUser from "@/hooks/useUser";
import paths from "@/utils/paths";
import { ArrowUUpLeft } from "@phosphor-icons/react/dist/csr/ArrowUUpLeft";
import { Wrench } from "@phosphor-icons/react/dist/csr/Wrench";

import { Link } from "react-router-dom";
import { useMatch } from "react-router-dom";
import PrismHoverTarget from "@/components/PrismHoverTarget";

export default function SettingsButton() {
  const isInSettings = !!useMatch("/settings/*");
  const { user } = useUser();

  if (user && user?.role === "default") return null;

  if (isInSettings)
    return (
      <div className="flex w-fit">
        <PrismHoverTarget targetId="settings-button-home">
          <Link
            to={paths.home()}
            className="metacanon-footer-button transition-all duration-300 p-[4px] rounded-full"
            aria-label="Home"
            data-tooltip-id="footer-item"
            data-tooltip-content="Back to workspaces"
          >
            <ArrowUUpLeft
              className="h-3.5 w-3.5"
              color="var(--theme-sidebar-footer-icon-fill)"
              weight="fill"
            />
          </Link>
        </PrismHoverTarget>
      </div>
    );

  return (
    <div className="flex w-fit">
      <PrismHoverTarget targetId="settings-button-open">
        <Link
          to={paths.settings.interface()}
          className="metacanon-footer-button transition-all duration-300 p-[4px] rounded-full"
          aria-label="Settings"
          data-tooltip-id="footer-item"
          data-tooltip-content="Open settings"
        >
          <Wrench
            className="h-3.5 w-3.5"
            color="var(--theme-sidebar-footer-icon-fill)"
            weight="fill"
          />
        </Link>
      </PrismHoverTarget>
    </div>
  );
}
