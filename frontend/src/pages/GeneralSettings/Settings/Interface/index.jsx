import Sidebar from "@/components/SettingsSidebar";
import { isMobile } from "react-device-detect";
import { useTranslation } from "react-i18next";
import LanguagePreference from "../components/LanguagePreference";
import ThemePreference from "../components/ThemePreference";

export default function InterfaceSettings() {
  const { t } = useTranslation();

  return (
    <div className="metacanon-page-shell w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      <Sidebar />
      <div
        style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
        className="metacanon-page-frame relative md:mx-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-scroll p-4 md:p-0"
      >
        <div className="prism-settings-content prism-settings-interface flex flex-col w-full px-1 md:pl-6 md:pr-[86px] md:py-6 py-16">
          <div className="prism-settings-page-header">
            <div className="prism-page-section-label">
              Transformation Agency
            </div>
            <div className="prism-settings-page-title">
              {t("customization.interface.title")}
            </div>
            <p className="prism-settings-page-description">
              {t("customization.interface.description")}
            </p>
          </div>
          <div className="prism-settings-page-stack">
            <ThemePreference />
            <LanguagePreference />
          </div>
        </div>
      </div>
    </div>
  );
}
