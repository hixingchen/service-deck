import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "../../types";

export const settingsApi = {
  get: () => invoke<AppSettings>("get_settings"),

  save: (settings: AppSettings) =>
    invoke<void>("save_settings", { settings }),

  /** 启用/禁用开机自启 */
  setAutostart: (enabled: boolean) =>
    enabled
      ? invoke<void>("plugin:autostart|enable")
      : invoke<void>("plugin:autostart|disable"),

  /** 查询开机自启状态 */
  isAutostartEnabled: () =>
    invoke<boolean>("plugin:autostart|is_enabled"),
};
