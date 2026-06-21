import { invoke } from "@tauri-apps/api/core";
import type { Service } from "../../types";

export const servicesApi = {
  getAll: () => invoke<Service[]>("get_services"),

  add: (params: {
    name: string;
    command: string;
    path: string;
    envVars?: Record<string, string>;
    logPath?: string;
    serviceType?: string;
  }) => invoke<Service>("add_service", {
    name: params.name,
    command: params.command,
    path: params.path,
    envVars: params.envVars ?? {},
    logPath: params.logPath ?? "",
    serviceType: params.serviceType ?? null,
  }),

  update: (params: {
    id: string;
    name: string;
    command: string;
    path: string;
    envVars?: Record<string, string>;
    logPath?: string;
    serviceType?: string;
    watchMode?: string;
    watchPath?: string;
    watchInclude?: string[];
    watchExclude?: string[];
  }) => invoke<void>("update_service", {
    id: params.id,
    name: params.name,
    command: params.command,
    path: params.path,
    envVars: params.envVars ?? {},
    logPath: params.logPath ?? null,
    serviceType: params.serviceType ?? null,
    watchMode: params.watchMode ?? null,
    watchPath: params.watchPath ?? null,
    watchInclude: params.watchInclude ?? null,
    watchExclude: params.watchExclude ?? null,
  }),

  delete: (id: string) => invoke<void>("delete_service", { id }),

  updateSort: (updates: [string, number][]) =>
    invoke<void>("update_service_sort", { updates }),

  toggleFavorite: (id: string) =>
    invoke<boolean>("toggle_service_favorite", { id }),
};
