import { zh, type Translations } from "./zh";
import { en } from "./en";

export type Language = "zh" | "en";

const translations: Record<Language, Translations> = {
  zh,
  en,
};

export function getTranslation(lang: Language): Translations {
  return translations[lang] || zh;
}

export type { Translations };
