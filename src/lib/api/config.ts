import { invoke } from "@tauri-apps/api/core";

export interface BackupInfo {
  name: string;
  path: string;
  size: number;
  created_at: string;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  target: string;
  message: string;
}

export const configApi = {
  getConfigDir: () => invoke<[string, string]>("get_config_dir"),

  migrateConfigDir: (newDir: string) =>
    invoke<void>("migrate_config_dir", { newDir }),

  export: (exportPath: string) =>
    invoke<void>("export_config", { exportPath }),

  import: (importPath: string) =>
    invoke<void>("import_config", { importPath }),

  // 手动备份
  getManualBackups: () => invoke<BackupInfo[]>("get_manual_backups"),
  createManualBackup: () => invoke<BackupInfo>("create_manual_backup"),

  // 自动备份
  getAutoBackups: () => invoke<BackupInfo[]>("get_auto_backups"),
  createAutoBackup: () => invoke<BackupInfo>("create_auto_backup"),
  cleanupAutoBackups: (keepDays: number) =>
    invoke<number>("cleanup_auto_backups", { keepDays }),
  clearAutoBackups: () => invoke<number>("clear_auto_backups"),

  // 通用
  restoreBackup: (backupPath: string) =>
    invoke<void>("restore_backup", { backupPath }),
  deleteBackup: (backupPath: string) =>
    invoke<void>("delete_backup", { backupPath }),
  renameBackup: (backupPath: string, newName: string) =>
    invoke<string>("rename_backup", { backupPath, newName }),

  // 日志
  getLogEntries: (date?: string, limit?: number) =>
    invoke<LogEntry[]>("get_log_entries", { date, limit }),
  getLogDates: () => invoke<string[]>("get_log_dates"),
  getLogLevel: () => invoke<string>("get_log_level"),
  setLogLevel: (level: string) =>
    invoke<void>("set_log_level", { level }),
  clearLogs: (date?: string) =>
    invoke<void>("clear_logs", { date }),
  getLogRetentionDays: () => invoke<number>("get_log_retention_days"),
  setLogRetentionDays: (days: number) =>
    invoke<void>("set_log_retention_days", { days }),
};
