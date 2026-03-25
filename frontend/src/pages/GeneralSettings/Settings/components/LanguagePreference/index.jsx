import { useLanguageOptions } from "@/hooks/useLanguageOptions";
import { useTranslation } from "react-i18next";

export default function LanguagePreference() {
  const { t } = useTranslation();
  const {
    currentLanguage,
    supportedLanguages,
    getLanguageName,
    changeLanguage,
  } = useLanguageOptions();

  return (
    <section className="prism-settings-field">
      <div className="prism-page-section-label">Language</div>
      <p className="prism-settings-field-title">
        {t("customization.items.display-language.title")}
      </p>
      <p className="prism-settings-field-copy">
        {t("customization.items.display-language.description")}
      </p>
      <div className="prism-settings-select-wrap">
        <select
          name="userLang"
          className="prism-settings-select"
          defaultValue={currentLanguage || "en"}
          onChange={(e) => changeLanguage(e.target.value)}
        >
          {supportedLanguages.map((lang) => {
            return (
              <option key={lang} value={lang}>
                {getLanguageName(lang)}
              </option>
            );
          })}
        </select>
      </div>
    </section>
  );
}
