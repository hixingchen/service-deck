import type { ThemeMode } from "../types";

/** 判断系统是否为深色模式 */
function getSystemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** 根据 ThemeMode 决定是否添加 dark class */
function resolveDark(mode: ThemeMode): boolean {
  if (mode === "system") return getSystemDark();
  return mode === "dark";
}

/** 将主题应用到 document.documentElement */
function apply(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

// system 模式的媒体查询监听器（全局单例，避免重复注册）
let cleanup: (() => void) | null = null;

/**
 * 应用主题设置。
 * - light / dark：直接设置，注销监听器
 * - system：立即设置 + 监听系统主题变化实时跟随
 */
export function applyTheme(mode: ThemeMode) {
  // 先注销上一次的监听
  cleanup?.();
  cleanup = null;

  apply(resolveDark(mode));

  if (mode === "system") {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => apply(getSystemDark());
    mq.addEventListener("change", handler);
    cleanup = () => mq.removeEventListener("change", handler);
  }
}
