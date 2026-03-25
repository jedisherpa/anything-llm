import Sidebar from "@/components/SettingsSidebar";
import { isMobile } from "react-device-detect";
import FooterCustomization from "../components/FooterCustomization";
import SupportEmail from "../components/SupportEmail";
import CustomLogo from "../components/CustomLogo";
import CustomMessages from "../components/CustomMessages";
import { useTranslation } from "react-i18next";
import CustomAppName from "../components/CustomAppName";
import CustomSiteSettings from "../components/CustomSiteSettings";

export default function BrandingSettings() {
  const { t } = useTranslation();

  return (
    <div className="metacanon-page-shell prism-settings-route w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      <Sidebar />
      <div
        style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
        className="metacanon-page-frame prism-settings-route__frame relative md:mx-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-scroll p-4 md:p-0"
      >
        <div className="prism-settings-content prism-settings-content--wide flex flex-col w-full px-1 md:pl-6 md:pr-[86px] md:py-6 py-16">
          <div className="prism-settings-page-header">
            <div className="prism-page-section-label">Transformation Agency</div>
            <div className="items-center">
              <p className="prism-settings-page-title">
                {t("customization.branding.title")}
              </p>
            </div>
            <p className="prism-settings-page-description">
              {t("customization.branding.description")}
            </p>
          </div>
          <div className="prism-settings-page-stack">
            <CustomAppName />
            <CustomLogo />
            <CustomMessages />
            <FooterCustomization />
            <SupportEmail />
            <CustomSiteSettings />
          </div>
        </div>
      </div>
    </div>
  );
}
