// 文件监听模式
export type WatchMode = "off" | "auto" | "confirm";

export interface Service {
  id: string;
  name: string;
  command: string;
  path: string;
  sort_index: number;
  env_vars: Record<string, string>;
  log_path: string;
  service_type: string;
  favorite: boolean;
  depends_on: string[];
  health_check_url: string;
  health_check_interval: number;
  // 文件监听配置
  watch_mode: WatchMode;
  watch_path: string;
  watch_include: string[];
  watch_exclude: string[];
  runtime_versions: Record<string, string>;
  env_groups: EnvGroup[];
}

export interface EnvGroup {
  id: string;
  service_id: string;
  name: string;
  vars: Record<string, EnvVar>;
  is_active: boolean;
}

export interface EnvVar {
  key: string;
  value: string;
  is_sensitive: boolean;
  source: "manual" | "dotenv";
}

export interface Project {
  id: string;
  name: string;
  services: Service[];
  sort_index: number;
  favorite: boolean;
}

export type ThemeMode = "light" | "dark" | "system";

export interface AppSettings {
  minimize_to_tray: boolean;
  show_notifications: boolean;
  theme: ThemeMode;
  java_home: string;
  language: string;
  auto_backup_enabled: boolean;
  auto_backup_keep_days: number;
}

export type View = "projects" | "services" | "settings";
