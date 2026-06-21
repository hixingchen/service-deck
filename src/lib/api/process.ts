import { invoke } from "@tauri-apps/api/core";

export const processApi = {
  startService: (serviceName: string, command?: string) =>
    invoke<void>("start_service", { serviceName, command: command ?? null }),

  stopService: (serviceName: string) =>
    invoke<void>("stop_service", { serviceName }),

  restartService: (serviceName: string) =>
    invoke<void>("restart_service", { serviceName }),

  startProject: (projectId: string) =>
    invoke<string[]>("start_project", { projectId }),

  stopProject: (projectId: string) =>
    invoke<string[]>("stop_project", { projectId }),

  restartProject: (projectId: string) =>
    invoke<string[]>("restart_project", { projectId }),

  getRunning: () => invoke<string[]>("get_running_services"),

  batchStart: (serviceNames: string[]) =>
    invoke<string[]>("batch_start_services", { serviceNames }),

  batchStop: (serviceNames: string[]) =>
    invoke<string[]>("batch_stop_services", { serviceNames }),
};
