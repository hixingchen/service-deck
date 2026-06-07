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
  const [serviceLogPath, setServiceLogPath] = useState("");

  const resetForm = useCallback(() => {
    setServiceName("");
    setServiceCommand("");
    setServicePath("");
    setServiceType("normal");
    setServiceLogPath("");
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
    setServiceLogPath(service.log_path || "");
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
    serviceLogPath,
    // setter
    setServiceName,
    setServiceCommand,
    setServicePath,
    setServiceType,
    setServiceLogPath,
    // 操作
    resetForm,
    openAddForm,
    openEditForm,
    closeForm,
  };
}
