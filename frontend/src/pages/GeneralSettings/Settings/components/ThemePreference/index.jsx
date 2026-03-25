import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "react-i18next";

export default function ThemePreference() {
  const { t } = useTranslation();
  const { theme, setTheme, availableThemes } = useTheme();

  return (
    <section className="prism-settings-field">
      <div className="prism-page-section-label">Sanctuary</div>
      <p className="prism-settings-field-title">
        {t("customization.items.theme.title")}
      </p>
      <p className="prism-settings-field-copy">
        {t("customization.items.theme.description")}
      </p>
      <div
        className="prism-settings-choice-row"
        role="tablist"
        aria-label="Theme"
      >
        {Object.entries(availableThemes).map(([key, value]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTheme(key)}
            className={`prism-settings-choice ${theme === key ? "prism-settings-choice--active" : ""}`}
          >
            {value}
          </button>
        ))}
      </div>
    </section>
  );
}
