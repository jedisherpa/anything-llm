import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import {
  bundledResources,
  defaultNS,
  fallbackLanguage,
  loadLanguageMessages,
  resolveSupportedLanguage,
  supportedLanguages,
} from "./locales/runtime";

const languageDetector = new LanguageDetector();
languageDetector.init();

async function ensureLanguageLoaded(language = fallbackLanguage) {
  const resolvedLanguage = resolveSupportedLanguage(language);

  if (!i18next.hasResourceBundle(resolvedLanguage, defaultNS)) {
    const resource = await loadLanguageMessages(resolvedLanguage);
    i18next.addResourceBundle(
      resolvedLanguage,
      defaultNS,
      resource,
      true,
      true
    );
  }

  return resolvedLanguage;
}

export async function changeAppLanguage(language = fallbackLanguage) {
  const resolvedLanguage = await ensureLanguageLoaded(language);
  await i18next.changeLanguage(resolvedLanguage);
  return resolvedLanguage;
}

i18next
  // https://github.com/i18next/i18next-browser-languageDetector/blob/9efebe6ca0271c3797bc09b84babf1ba2d9b4dbb/src/index.js#L11
  .use(initReactI18next) // Initialize i18n for React
  .use(languageDetector)
  .init({
    fallbackLng: fallbackLanguage,
    debug: import.meta.env.DEV,
    defaultNS,
    resources: bundledResources,
    partialBundledLanguages: true,
    supportedLngs: supportedLanguages,
    lowerCaseLng: true,
    interpolation: {
      escapeValue: false,
    },
  });

const initialLanguage = resolveSupportedLanguage(languageDetector.detect());
if (initialLanguage !== fallbackLanguage) {
  changeAppLanguage(initialLanguage).catch((error) => {
    console.warn(`Failed to preload language "${initialLanguage}"`, error);
  });
}

export default i18next;
