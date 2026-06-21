import { invoke } from "@tauri-apps/api/core";

export const terminalApi = {
  openSystemTerminal: (path: string) => invoke<void>("open_system_terminal", { path }),
  openDirectory: (path: string) => invoke<void>("open_directory", { path }),
};
