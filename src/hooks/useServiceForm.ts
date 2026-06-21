import { useState, useCallback } from "react";
import type { Service, WatchMode } from "../types";

// 默认的监听包含文件类型
const DEFAULT_WATCH_INCLUDE = [
  "*.js", "*.ts", "*.jsx", "*.tsx", "*.vue", "*.java", "*.py", "*.go",
  "*.rs", "*.html", "*.css", "*.scss", "*.json", "*.yaml", "*.yml", "*.toml",
  "*.xml", "*.properties", "*.conf",
];

// 默认的监听排除目录
const DEFAULT_WATCH_EXCLUDE = [
  "node_modules", ".git", "dist", "build", "target", "__pycache__",
  ".next", ".nuxt", "logs", ".idea", ".vscode",
];

export function useServiceForm() {
  const [showAddService, setShowAddService] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const [serviceName, setServiceName] = useState("");
  const [serviceCommand, setServiceCommand] = useState("");
  const [servicePath, setServicePath] = useState("");
  const [watchMode, setWatchMode] = useState<WatchMode>("off");
  const [watchPath, setWatchPath] = useState("");
  const [watchInclude, setWatchInclude] = useState<string[]>(DEFAULT_WATCH_INCLUDE);
  const [watchExclude, setWatchExclude] = useState<string[]>(DEFAULT_WATCH_EXCLUDE);

  const resetForm = useCallback(() => {
    setServiceName("");
    setServiceCommand("");
    setServicePath("");
    setWatchMode("off");
    setWatchPath("");
    setWatchInclude(DEFAULT_WATCH_INCLUDE);
    setWatchExclude(DEFAULT_WATCH_EXCLUDE);
  }, []);

  const openAddForm = useCallback(() => {
    resetForm();
    setShowAddService(true);
  }, [resetForm]);

  const openEditForm = useCallback((service: Service) => {
    setServiceName(service.name);
    setServiceCommand(service.command);
    setServicePath(service.path);
    setWatchMode(service.watch_mode || "off");
    setWatchPath(service.watch_path || "");
    setWatchInclude(service.watch_include?.length > 0 ? service.watch_include : DEFAULT_WATCH_INCLUDE);
    setWatchExclude(service.watch_exclude?.length > 0 ? service.watch_exclude : DEFAULT_WATCH_EXCLUDE);
    setEditingService(service);
  }, []);

  const closeForm = useCallback(() => {
    setShowAddService(false);
    setEditingService(null);
    resetForm();
  }, [resetForm]);

  return {
    showAddService,
    editingService,
    serviceName,
    serviceCommand,
    servicePath,
    watchMode,
    watchPath,
    watchInclude,
    watchExclude,
    setServiceName,
    setServiceCommand,
    setServicePath,
    setWatchMode,
    setWatchPath,
    setWatchInclude,
    setWatchExclude,
    openAddForm,
    openEditForm,
    closeForm,
  };
}
