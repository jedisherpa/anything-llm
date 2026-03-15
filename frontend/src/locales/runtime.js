import English from "./en/common.js";

export const defaultNS = "common";
export const fallbackLanguage = "en";
export const supportedLanguages = [
  "en",
  "zh",
  "zh-tw",
  "es",
  "de",
  "fr",
  "ko",
  "et",
  "ru",
  "it",
  "pt",
  "he",
  "nl",
  "vi",
  "fa",
  "tr",
  "ar",
  "da",
  "ja",
  "lv",
  "pl",
  "ro",
  "cs",
];

export const bundledResources = {
  [fallbackLanguage]: {
    [defaultNS]: English,
  },
};

const languageAliases = {
  "pt-br": "pt",
  "pt-pt": "pt",
  "zh-cn": "zh",
  "zh-hk": "zh-tw",
  "zh-mo": "zh-tw",
  "zh-sg": "zh",
  vn: "vi",
};

const languageLoaders = {
  en: async () => English,
  zh: async () => (await import("./zh/common.js")).default,
  "zh-tw": async () => (await import("./zh_TW/common.js")).default,
  es: async () => (await import("./es/common.js")).default,
  de: async () => (await import("./de/common.js")).default,
  fr: async () => (await import("./fr/common.js")).default,
  ko: async () => (await import("./ko/common.js")).default,
  et: async () => (await import("./et/common.js")).default,
  ru: async () => (await import("./ru/common.js")).default,
  it: async () => (await import("./it/common.js")).default,
  pt: async () => (await import("./pt_BR/common.js")).default,
  he: async () => (await import("./he/common.js")).default,
  nl: async () => (await import("./nl/common.js")).default,
  vi: async () => (await import("./vn/common.js")).default,
  fa: async () => (await import("./fa/common.js")).default,
  tr: async () => (await import("./tr/common.js")).default,
  ar: async () => (await import("./ar/common.js")).default,
  da: async () => (await import("./da/common.js")).default,
  ja: async () => (await import("./ja/common.js")).default,
  lv: async () => (await import("./lv/common.js")).default,
  pl: async () => (await import("./pl/common.js")).default,
  ro: async () => (await import("./ro/common.js")).default,
  cs: async () => (await import("./cs/common.js")).default,
};

export function resolveSupportedLanguage(language = fallbackLanguage) {
  const normalized = String(language || fallbackLanguage)
    .toLowerCase()
    .replace(/_/g, "-");

  if (supportedLanguages.includes(normalized)) return normalized;
  if (languageAliases[normalized]) return languageAliases[normalized];

  const [baseLanguage] = normalized.split("-");
  if (supportedLanguages.includes(baseLanguage)) return baseLanguage;
  if (languageAliases[baseLanguage]) return languageAliases[baseLanguage];

  return fallbackLanguage;
}

export async function loadLanguageMessages(language = fallbackLanguage) {
  const resolvedLanguage = resolveSupportedLanguage(language);
  return languageLoaders[resolvedLanguage]();
}
