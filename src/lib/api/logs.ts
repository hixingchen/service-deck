import { invoke } from "@tauri-apps/api/core";

export const logsApi = {
  get: (serviceName: string, tailLines?: number) =>
    invoke<string>("get_service_logs", { serviceName, tailLines: tailLines ?? null }),

  getFileSize: (serviceName: string) =>
    invoke<number>("get_log_file_size", { serviceName }),

  setViewerActive: (serviceName: string, active: boolean) =>
    invoke<void>("set_log_viewer_active", { serviceName, active }),

  clear: (serviceName: string) =>
    invoke<void>("clear_service_logs", { serviceName }),
};
