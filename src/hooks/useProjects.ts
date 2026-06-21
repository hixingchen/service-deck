import { useState, useCallback } from "react";
import type { Project, Service } from "../types";
import { projectsApi, processApi } from "../lib/api";

export function useProjects(refreshRunningServices?: () => Promise<void>) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [runningProjects, setRunningProjects] = useState<string[]>([]);

  const loadProjects = useCallback(async () => {
    try {
      const p = await projectsApi.getAll();
      setProjects(p);
    } catch (e) {
      console.error("加载项目失败:", e);
    }
  }, []);

  const addProject = useCallback(async (name: string, services: Service[]) => {
    const project = await projectsApi.add(name);
    for (const svc of services) {
      await projectsApi.addService(project.id, svc.id);
    }
    await loadProjects();
    return project;
  }, [loadProjects]);

  const updateProject = useCallback(async (id: string, name: string, favorite?: boolean) => {
    await projectsApi.update(id, name, favorite);
    await loadProjects();
  }, [loadProjects]);

  const removeProject = useCallback(async (id: string) => {
    await projectsApi.remove(id);
    await loadProjects();
    // 删除项目后刷新服务运行状态（共享服务可能仍在运行）
    if (refreshRunningServices) {
      await refreshRunningServices();
    }
  }, [loadProjects, refreshRunningServices]);

  const toggleFavorite = useCallback(async (id: string) => {
    const result = await projectsApi.toggleFavorite(id);
    await loadProjects();
    return result;
  }, [loadProjects]);

  const startProject = useCallback(async (projectId: string) => {
    const started = await processApi.startProject(projectId);
    setRunningProjects(prev => prev.includes(projectId) ? prev : [...prev, projectId]);
    return started;
  }, []);

  const stopProject = useCallback(async (projectId: string) => {
    const stopped = await processApi.stopProject(projectId);
    setRunningProjects(prev => prev.filter(id => id !== projectId));
    return stopped;
  }, []);

  const restartProject = useCallback(async (projectId: string) => {
    const result = await processApi.restartProject(projectId);
    setRunningProjects(prev => prev.includes(projectId) ? prev : [...prev, projectId]);
    return result;
  }, []);

  const addServiceToProject = useCallback(async (projectId: string, serviceId: string) => {
    await projectsApi.addService(projectId, serviceId);
    await loadProjects();
  }, [loadProjects]);

  const removeServiceFromProject = useCallback(async (projectId: string, serviceId: string) => {
    await projectsApi.removeService(projectId, serviceId);
    await loadProjects();
  }, [loadProjects]);

  return {
    projects,
    setProjects,
    runningProjects,
    addProject,
    updateProject,
    removeProject,
    toggleFavorite,
    startProject,
    stopProject,
    restartProject,
    addServiceToProject,
    removeServiceFromProject,
  };
}
