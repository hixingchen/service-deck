import { invoke } from "@tauri-apps/api/core";
import type { Project } from "../../types";

export const projectsApi = {
  getAll: () => invoke<Project[]>("get_projects"),

  add: (name: string) => invoke<Project>("add_project", { name }),

  update: (id: string, name: string, favorite?: boolean) =>
    invoke<void>("update_project", { id, name, favorite: favorite ?? null }),

  remove: (id: string) => invoke<void>("remove_project", { id }),

  toggleFavorite: (id: string) =>
    invoke<boolean>("toggle_project_favorite", { id }),

  updateSort: (updates: [string, number][]) =>
    invoke<void>("update_project_sort", { updates }),

  addService: (projectId: string, serviceId: string) =>
    invoke<void>("add_service_to_project", { projectId, serviceId }),

  removeService: (projectId: string, serviceId: string) =>
    invoke<void>("remove_service_from_project", { projectId, serviceId }),
};
