import { useState, useCallback } from "react";
import type { Service } from "../types";

export function useServiceForm() {
  const [showAddService, setShowAddService] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  // 表单状态
  const [serviceName, setServiceName] = useState("");
  const [serviceCommand, setServiceCommand] = useState("");
  const [servicePath, setServicePath] = useState("");
  const [serviceType, setServiceType] = useState("normal");
  const [serviceEnvVars, setServiceEnvVars] = useState<Record<string, string>>({});
  const [serviceLogPath, setServiceLogPath] = useState("");
  const [serviceDependsOn, setServiceDependsOn] = useState<string[]>([]);

  const resetForm = useCallback(() => {
    setServiceName("");
    setServiceCommand("");
    setServicePath("");
    setServiceType("normal");
    setServiceEnvVars({});
    setServiceLogPath("");
    setServiceDependsOn([]);
  }, []);

  const openAddForm = useCallback(() => {
    resetForm();
    setShowAddService(true);
  }, [resetForm]);

  const openEditForm = useCallback((service: Service) => {
    setServiceName(service.name);
    setServiceCommand(service.command);
    setServicePath(service.path);
    setServiceType(service.service_type || "normal");
    setServiceEnvVars(service.env_vars || {});
    setServiceLogPath(service.log_path || "");
    setServiceDependsOn(service.depends_on || []);
    setEditingService(service);
  }, []);

  const closeForm = useCallback(() => {
    setShowAddService(false);
    setEditingService(null);
    resetForm();
  }, [resetForm]);

  return {
    // 状态
    showAddService,
    editingService,
    serviceName,
    serviceCommand,
    servicePath,
    serviceType,
    serviceEnvVars,
    serviceLogPath,
    serviceDependsOn,
    // setter
    setServiceName,
    setServiceCommand,
    setServicePath,
    setServiceType,
    setServiceEnvVars,
    setServiceLogPath,
    setServiceDependsOn,
    // 操作
    resetForm,
    openAddForm,
    openEditForm,
    closeForm,
  };
}
