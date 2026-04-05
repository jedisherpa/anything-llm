import Sidebar from "@/components/SettingsSidebar";
import { isMobile } from "react-device-detect";
import { useTranslation } from "react-i18next";
import AutoSubmit from "../components/AutoSubmit";
import AutoSpeak from "../components/AutoSpeak";
import SpellCheck from "../components/SpellCheck";
import ShowScrollbar from "../components/ShowScrollbar";
import ChatRenderHTML from "../components/ChatRenderHTML";

export default function ChatSettings() {
  const { t } = useTranslation();

  return (
    <div className="metacanon-page-shell w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      <Sidebar />
      <div
        style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
        className="metacanon-page-frame relative md:mx-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-scroll p-4 md:p-0"
      >
        <div className="prism-settings-content flex flex-col w-full px-1 md:pl-6 md:pr-[86px] md:py-6 py-16">
          <div className="prism-settings-page-header">
            <div className="prism-page-section-label">Transformation Agency</div>
            <p className="prism-settings-page-title">{t("customization.chat.title")}</p>
            <p className="prism-settings-page-description">{t("customization.chat.description")}</p>
          </div>
          <AutoSubmit />
          <AutoSpeak />
          <SpellCheck />
          <ShowScrollbar />
          <ChatRenderHTML />
        </div>
      </div>
    </div>
  );
}
