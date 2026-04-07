import Sidebar from "@/components/SettingsSidebar";
import { isMobile } from "react-device-detect";
import HubItems from "./HubItems";

export default function CommunityHub() {
  return (
    <div className="metacanon-page-shell w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      <Sidebar />
      <div
        style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
        className="metacanon-page-frame relative md:mx-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-scroll p-4 md:p-0"
      >
        <div className="prism-settings-content flex flex-col w-full px-1 md:pl-6 md:pr-[86px] md:py-6 py-16">
          <div className="prism-settings-page-header">
            <div className="prism-page-section-label">Community</div>
            <p className="prism-settings-page-title">Community Hub</p>
            <p className="prism-settings-page-description">Share and collaborate with the AnythingLLM community.</p>
          </div>
          <HubItems />
        </div>
      </div>
    </div>
  );
}
