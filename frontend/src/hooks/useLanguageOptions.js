import i18n, { changeAppLanguage } from "@/i18n";
import {
  resolveSupportedLanguage,
  supportedLanguages,
} from "@/locales/runtime";

export function useLanguageOptions() {
  const languageNames = new Intl.DisplayNames(supportedLanguages, {
    type: "language",
  });

  const changeLanguage = async (newLang = "en") => {
    const resolvedLanguage = resolveSupportedLanguage(newLang);
    if (!supportedLanguages.includes(resolvedLanguage)) return false;
    await changeAppLanguage(resolvedLanguage);
    return true;
  };

  return {
    currentLanguage: resolveSupportedLanguage(
      i18n.resolvedLanguage || i18n.language || "en"
    ),
    supportedLanguages,
    getLanguageName: (lang = "en") => languageNames.of(lang),
    changeLanguage,
  };
}
