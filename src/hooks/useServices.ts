import { useState, useCallback } from "react";
import type { Service } from "../types";
import { servicesApi, processApi } from "../lib/api";

export function useServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [runningServices, setRunningServices] = useState<string[]>([]);

  const loadServices = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        servicesApi.getAll(),
        processApi.getRunning(),
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
  }) => {
    await servicesApi.add({ ...params });
    await loadServices();
  }, [loadServices]);

  const updateService = useCallback(async (params: {
    id: string;
    name: string;
    command: string;
    path: string;
    watch_mode?: string;
    watch_path?: string;
    watch_include?: string[];
    watch_exclude?: string[];
  }) => {
    await servicesApi.update({
      id: params.id,
      name: params.name,
      command: params.command,
      path: params.path,
      watchMode: params.watch_mode || undefined,
      watchPath: params.watch_path || undefined,
      watchInclude: params.watch_include || undefined,
      watchExclude: params.watch_exclude || undefined,
    });
    await loadServices();
  }, [loadServices]);

  const deleteService = useCallback(async (id: string) => {
    await servicesApi.delete(id);
    await loadServices();
  }, [loadServices]);

  const startService = useCallback(async (serviceName: string, command?: string) => {
    await processApi.startService(serviceName, command);
    await loadServices();
  }, [loadServices]);

  const stopService = useCallback(async (serviceName: string) => {
    await processApi.stopService(serviceName);
    await loadServices();
  }, [loadServices]);

  const restartService = useCallback(async (serviceName: string) => {
    await processApi.restartService(serviceName);
    await loadServices();
  }, [loadServices]);

  const toggleFavorite = useCallback(async (id: string) => {
    const result = await servicesApi.toggleFavorite(id);
    await loadServices();
    return result;
  }, [loadServices]);

  return {
    services,
    setServices,
    runningServices,
    setRunningServices,
    addService,
    updateService,
    deleteService,
    startService,
    stopService,
    restartService,
    toggleFavorite,
  };
}
