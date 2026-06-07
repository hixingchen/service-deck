import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Service } from "../types";

export function useServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [runningServices, setRunningServices] = useState<string[]>([]);

  const loadServices = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        invoke<Service[]>("get_services"),
        invoke<string[]>("get_running_services"),
      ]);
      setServices(s);
      setRunningServices(r);
    } catch (e) {
      console.error("加载服务失败:", e);
    }
  }, []);

  const addService = useCallback(async (params: {
    name: string;
    command: string;
    path: string;
    serviceType: string;
    envVars: Record<string, string>;
    logPath: string;
    dependsOn: string[];
    healthCheckUrl?: string;
  }) => {
    await invoke("add_service", params);
    await loadServices();
  }, [loadServices]);

  const updateService = useCallback(async (params: {
    id: string;
    name: string;
    command: string;
    path: string;
    serviceType: string;
    envVars: Record<string, string>;
    logPath: string;
    dependsOn: string[];
    healthCheckUrl?: string;
  }) => {
    await invoke("update_service", params);
    await loadServices();
  }, [loadServices]);

  const deleteService = useCallback(async (id: string) => {
    await invoke("delete_service", { id });
    await loadServices();
  }, [loadServices]);

  const startService = useCallback(async (serviceName: string, command?: string) => {
    await invoke("start_service", { serviceName, command: command || null });
    await loadServices();
  }, [loadServices]);

  const stopService = useCallback(async (serviceName: string) => {
    await invoke("stop_service", { serviceName });
    await loadServices();
  }, [loadServices]);

  const restartService = useCallback(async (serviceName: string) => {
    await invoke("restart_service", { serviceName });
    await loadServices();
  }, [loadServices]);

  const updateServiceSort = useCallback(async (updates: [string, number][]) => {
    await invoke("update_service_sort", { updates });
    await loadServices();
  }, [loadServices]);

  const toggleFavorite = useCallback(async (id: string) => {
    const result = await invoke<boolean>("toggle_service_favorite", { id });
    await loadServices();
    return result;
  }, [loadServices]);

  return {
    services,
    setServices,
    runningServices,
    setRunningServices,
    loadServices,
    addService,
    updateService,
    deleteService,
    startService,
    stopService,
    restartService,
    updateServiceSort,
    toggleFavorite: toggleFavorite,
  };
}
