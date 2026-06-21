import { useState, useEffect, useCallback } from "react";
import { getTranslation, type Language, type Translations } from "../i18n";
import { settingsApi } from "../lib/api";

// 全局语言状态
let currentLanguage: Language = "zh";
let listeners: Array<(lang: Language) => void> = [];

export function useI18n() {
  const [language, setLanguage] = useState<Language>(currentLanguage);
  const [t, setT] = useState<Translations>(() => getTranslation(currentLanguage));

  useEffect(() => {
    // 加载设置获取语言
    settingsApi.get().then((settings) => {
      const lang = (settings.language as Language) || "zh";
      currentLanguage = lang;
      setLanguage(lang);
      setT(getTranslation(lang));
    }).catch(console.error);
  }, []);

  useEffect(() => {
    const listener = (lang: Language) => {
      setLanguage(lang);
      setT(getTranslation(lang));
    };
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  const changeLanguage = useCallback((lang: Language) => {
    // 立即更新内存状态
    currentLanguage = lang;
    setLanguage(lang);
    setT(getTranslation(lang));
    listeners.forEach((l) => l(lang));

    // 立即持久化到后端（不走防抖，防止组件卸载时被清除）
    settingsApi.get().then((settings) => {
      settingsApi.save({ ...settings, language: lang });
    }).catch((e) => console.error("保存语言设置失败:", e));
  }, []);

  return { t, language, changeLanguage };
}

// 用于在非组件中获取当前语言
export function getCurrentLanguage(): Language {
  return currentLanguage;
}

export function getCurrentTranslations(): Translations {
  return getTranslation(currentLanguage);
}
