import { invoke } from "@tauri-apps/api/core";

export const watchApi = {
  setMode: (serviceName: string, mode: string, watchPath?: string) =>
    invoke<void>("set_watch_mode", { serviceName, mode, watchPath: watchPath ?? null }),

  getEvents: () => invoke<Array<{
    service_name: string;
    path: string;
    timestamp: number;
  }>>("get_watch_events"),

  clearEvents: () => invoke<void>("clear_watch_events"),
};
