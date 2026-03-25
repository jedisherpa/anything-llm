import React, { useState, useEffect } from "react";
import showToast from "@/utils/toast";
import { safeJsonParse } from "@/utils/request";
import NewIconForm from "./NewIconForm";
import Admin from "@/models/admin";
import System from "@/models/system";
import { useTranslation } from "react-i18next";

export default function FooterCustomization() {
  const [footerIcons, setFooterIcons] = useState(Array(3).fill(null));
  const { t } = useTranslation();

  useEffect(() => {
    async function fetchFooterIcons() {
      const { settings } = await Admin.systemPreferencesByFields([
        "footer_data",
      ]);

      const footerData = settings?.footer_data;
      if (footerData) {
        const parsedIcons = safeJsonParse(footerData, []);
        setFooterIcons((prevIcons) => {
          const updatedIcons = [...prevIcons];
          parsedIcons.forEach((icon, index) => {
            updatedIcons[index] = icon;
          });
          return updatedIcons;
        });
      }
    }
    fetchFooterIcons();
  }, []);

  const updateFooterIcons = async (updatedIcons) => {
    const { success, error } = await Admin.updateSystemPreferences({
      footer_data: JSON.stringify(updatedIcons.filter((icon) => icon !== null)),
    });

    if (!success) {
      showToast(`Failed to update footer icons - ${error}`, "error", {
        clear: true,
      });
      return;
    }

    window.localStorage.removeItem(System.cacheKeys.footerIcons);
    setFooterIcons(updatedIcons);
    showToast("Successfully updated footer icons.", "success", { clear: true });
  };

  const handleRemoveIcon = (index) => {
    const updatedIcons = [...footerIcons];
    updatedIcons[index] = null;
    updateFooterIcons(updatedIcons);
  };

  return (
    <section className="prism-settings-field flex flex-col gap-y-0.5">
      <p className="prism-settings-field-title mt-0">
        {t("customization.items.sidebar-footer.title")}
      </p>
      <p className="prism-settings-field-copy mt-0">
        {t("customization.items.sidebar-footer.description")}
      </p>
      <div className="mt-2 flex gap-x-3 font-medium text-theme-text-primary text-sm">
        <div>{t("customization.items.sidebar-footer.icon")}</div>
        <div>{t("customization.items.sidebar-footer.link")}</div>
      </div>
      <div className="mt-2 flex flex-col gap-y-[10px]">
        {footerIcons.map((icon, index) => (
          <NewIconForm
            key={index}
            icon={icon?.icon}
            url={icon?.url}
            onSave={(newIcon, newUrl) => {
              const updatedIcons = [...footerIcons];
              updatedIcons[index] = { icon: newIcon, url: newUrl };
              updateFooterIcons(updatedIcons);
            }}
            onRemove={() => handleRemoveIcon(index)}
          />
        ))}
      </div>
    </section>
  );
}
