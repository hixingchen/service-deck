import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Project, Service } from "../types";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [runningProjects, setRunningProjects] = useState<string[]>([]);

  const loadProjects = useCallback(async () => {
    try {
      const p = await invoke<Project[]>("get_projects");
      setProjects(p);
    } catch (e) {
      console.error("加载项目失败:", e);
    }
  }, []);

  const addProject = useCallback(async (name: string, services: Service[]) => {
    const project = await invoke<{ id: string }>("add_project", { name });
    for (const svc of services) {
      await invoke("add_service_to_project", { projectId: project.id, serviceId: svc.id });
    }
    await loadProjects();
    return project;
  }, [loadProjects]);

  const updateProject = useCallback(async (id: string, name: string, favorite?: boolean) => {
    await invoke("update_project", { id, name, favorite: favorite ?? null });
    await loadProjects();
  }, [loadProjects]);

  const removeProject = useCallback(async (id: string) => {
    await invoke("remove_project", { id });
    await loadProjects();
  }, [loadProjects]);

  const toggleFavorite = useCallback(async (id: string) => {
    const result = await invoke<boolean>("toggle_project_favorite", { id });
    await loadProjects();
    return result;
  }, [loadProjects]);

  const startProject = useCallback(async (projectId: string) => {
    const started = await invoke<string[]>("start_project", { projectId });
    setRunningProjects(prev => prev.includes(projectId) ? prev : [...prev, projectId]);
    return started;
  }, []);

  const stopProject = useCallback(async (projectId: string) => {
    const stopped = await invoke<string[]>("stop_project", { projectId });
    setRunningProjects(prev => prev.filter(id => id !== projectId));
    return stopped;
  }, []);

  const restartProject = useCallback(async (projectId: string) => {
    const result = await invoke<string[]>("restart_project", { projectId });
    // 重启后项目应该在运行中
    setRunningProjects(prev => prev.includes(projectId) ? prev : [...prev, projectId]);
    return result;
  }, []);

  const updateProjectSort = useCallback(async (updates: [string, number][]) => {
    await invoke("update_project_sort", { updates });
    await loadProjects();
  }, [loadProjects]);

  const addServiceToProject = useCallback(async (projectId: string, serviceId: string) => {
    await invoke("add_service_to_project", { projectId, serviceId });
    await loadProjects();
  }, [loadProjects]);

  const removeServiceFromProject = useCallback(async (projectId: string, serviceId: string) => {
    await invoke("remove_service_from_project", { projectId, serviceId });
    await loadProjects();
  }, [loadProjects]);

  return {
    projects,
    setProjects,
    runningProjects,
    setRunningProjects,
    loadProjects,
    addProject,
    updateProject,
    removeProject,
    toggleFavorite,
    startProject,
    stopProject,
    restartProject,
    updateProjectSort,
    addServiceToProject,
    removeServiceFromProject,
  };
}
