import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { Plus, FolderOpen, Wrench, X, Layers, Star, Settings2, ArrowLeft, Server, FolderKanban, AlertCircle, CheckCircle } from "lucide-react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import type { View } from "./types";
import { TitleBar } from "./components/TitleBar";
import { EmptyState } from "./components/EmptyState";
import { SortableServiceCard } from "./components/SortableServiceCard";
import { SortableProjectCard } from "./components/SortableProjectCard";
import { ProjectGroups } from "./components/ProjectGroups";
import { ServiceFormModal } from "./components/ServiceFormModal";
import { ProjectFormModal } from "./components/ProjectFormModal";
import { LogViewerPanel } from "./components/LogViewerPanel";
import { BatchOperations } from "./components/BatchOperations";
import { SettingsPanel } from "./components/SettingsPanel";

import {
  useServices,
  useProjects,
  useLogs,
  useDnD,
  useServiceForm,
  useProjectForm,
  useConfirm,
  useI18n,
} from "./hooks";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { WatchConfirmToast } from "./components/WatchConfirmToast";
import { processApi, configApi, projectsApi, settingsApi } from "./lib/api";
import { applyTheme } from "./lib/theme";

function App() {
  // 视图状态
  const [view, setView] = useState<View>("projects");
  const [showBatchOps, setShowBatchOps] = useState(false);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [serviceSearch, setServiceSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const { t } = useI18n();

  // 使用自定义 hooks
  const {
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
    toggleFavorite: toggleServiceFavorite,
  } = useServices();

  // 刷新服务运行状态（用于删除项目后同步共享服务状态）
  const refreshRunningServices = useCallback(async () => {
    try {
      const r = await processApi.getRunning();
      setRunningServices(r);
    } catch (e) {
      console.error("刷新运行状态失败:", e);
    }
  }, [setRunningServices]);

  const {
    projects,
    setProjects,
    runningProjects,
    addProject,
    updateProject,
    removeProject,
    toggleFavorite: toggleProjectFavorite,
    startProject,
    stopProject,
    restartProject,
    addServiceToProject,
    removeServiceFromProject,
  } = useProjects(refreshRunningServices);

  const { logService, logContent, viewLogs, closeLogViewer } = useLogs();

  const serviceForm = useServiceForm();
  const projectForm = useProjectForm();
  const { options: confirmOptions, confirm, handleConfirm, handleCancel } = useConfirm();

  const [globalError, setGlobalError] = useState<string | null>(null);
  const [configDir, setConfigDir] = useState("");
  const [defaultConfigDir, setDefaultConfigDir] = useState("");

  // 文件监听确认提示状态（支持多个服务同时显示）
  const [watchEvents, setWatchEvents] = useState<Array<{
    serviceName: string;
    changedFiles: string[];
    timestamp: number;
  }>>([]);

  // 记录进入设置前的视图，用于返回
  const previousView = useRef<View>("projects");

  // 防抖：记录每个服务最后一次提示的时间
  const lastWatchEventRef = useRef<Record<string, number>>({});

  // 错误提示 5 秒后自动消失
  useEffect(() => {
    if (!globalError) return;
    const timer = setTimeout(() => setGlobalError(null), 5000);
    return () => clearTimeout(timer);
  }, [globalError]);

  // Toast 提示 3 秒后自动消失
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // 监听文件变化事件（confirm 模式）
  useEffect(() => {
    const unlisten = listen<{
      service_name: string;
      paths: string[];
      auto_restart: boolean;
    }>("watch:event", (event) => {
      // 只处理 confirm 模式（auto_restart = false）
      if (!event.payload.auto_restart) {
        const now = Date.now();
        const lastTime = lastWatchEventRef.current[event.payload.service_name] || 0;

        // 防抖：同一个服务 3 秒内不重复提示
        if (now - lastTime < 3000) {
          return;
        }

        lastWatchEventRef.current[event.payload.service_name] = now;

        setWatchEvents((prev) => {
          // 如果该服务已有提示，更新它
          const existing = prev.findIndex((e) => e.serviceName === event.payload.service_name);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = {
              serviceName: event.payload.service_name,
              changedFiles: event.payload.paths,
              timestamp: now,
            };
            return updated;
          }
          // 否则添加新提示
          return [
            ...prev,
            {
              serviceName: event.payload.service_name,
              changedFiles: event.payload.paths,
              timestamp: now,
            },
          ];
        });
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // 加载所有数据
  const loadData = useCallback(async () => {
    try {
      const [s, p, r, c] = await Promise.all([
        import("./lib/api").then(m => m.servicesApi.getAll()),
        import("./lib/api").then(m => m.projectsApi.getAll()),
        processApi.getRunning(),
        configApi.getConfigDir().catch(() => ["", ""] as [string, string]),
      ]);
      setServices(s);
      setProjects(p);
      setRunningServices(r);
      if (c && c[0]) {
        setConfigDir(c[0]);
        setDefaultConfigDir(c[1]);
      }
    } catch (e) {
      console.error("加载数据失败:", e);
    } finally {
      setIsLoading(false);
    }
  }, [setServices, setProjects, setRunningServices]);

  // 初始化加载
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 启动时加载并应用主题
  useEffect(() => {
    settingsApi.get().then(s => applyTheme(s.theme)).catch(() => applyTheme("dark"));
  }, []);

  // 定时轮询运行状态（无运行服务时降低频率）
  const runningCountRef = useRef(0);
  runningCountRef.current = runningServices.length;

  useEffect(() => {
    let active = true;

    const poll = async () => {
      if (!active) return;
      try {
        const r = await processApi.getRunning();
        if (!active) return;
        setRunningServices(r);
      } catch (e) {
        console.error("轮询运行状态失败:", e);
      }
    };

    const getInterval = () => runningCountRef.current > 0 ? 2000 : 10000;

    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(async () => {
        await poll();
        schedule();
      }, getInterval());
    };

    poll().then(() => schedule());

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [setRunningServices]);

  // 排序后的列表（收藏优先）
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return a.sort_index - b.sort_index;
    });
  }, [projects]);

  // 项目搜索过滤
  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return sortedProjects;
    const q = projectSearch.trim().toLowerCase();
    return sortedProjects.filter((p) => p.name.toLowerCase().includes(q));
  }, [sortedProjects, projectSearch]);

  const sortedServices = useMemo(() => {
    return [...services].sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return a.sort_index - b.sort_index;
    });
  }, [services]);

  // 搜索过滤
  const filteredServices = useMemo(() => {
    if (!serviceSearch.trim()) return sortedServices;
    const q = serviceSearch.trim().toLowerCase();
    return sortedServices.filter((s) => s.name.toLowerCase().includes(q));
  }, [sortedServices, serviceSearch]);

  // 预计算每个服务所属项目数量（避免在列表渲染中重复计算）
  const serviceProjectCount = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const p of projects) {
      for (const s of p.services) {
        countMap.set(s.id, (countMap.get(s.id) || 0) + 1);
      }
    }
    return countMap;
  }, [projects]);

  // 拖拽处理（使用过滤后的列表，确保索引与 SortableContext 一致）
  const { sensors, handleServiceDragEnd, handleProjectDragEnd } = useDnD(
    filteredServices,
    filteredProjects,
    loadData
  );

  // 分组：收藏 和 全部
  const favoriteServices = useMemo(() => {
    return filteredServices.filter((s) => s.favorite);
  }, [filteredServices]);

  const otherServices = useMemo(() => {
    return filteredServices.filter((s) => !s.favorite);
  }, [filteredServices]);

  // 服务操作
  const handleAddService = async () => {
    const { serviceName, serviceCommand, servicePath } = serviceForm;
    if (!serviceName.trim() || !serviceCommand.trim() || !servicePath.trim()) return;

    try {
      await addService({
        name: serviceName.trim(),
        command: serviceCommand.trim(),
        path: servicePath.trim(),
      });
      serviceForm.closeForm();
    } catch (e) {
      console.error("添加服务失败:", e);
      setGlobalError(`Failed to add service: ${e}`);
    }
  };

  const handleUpdateService = async () => {
    const { editingService, serviceName, serviceCommand, servicePath, watchMode, watchPath, watchInclude, watchExclude } = serviceForm;
    if (!editingService) return;
    if (!serviceName.trim() || !serviceCommand.trim() || !servicePath.trim()) return;

    const params = {
      id: editingService.id,
      name: serviceName.trim(),
      command: serviceCommand.trim(),
      path: servicePath.trim(),
      watch_mode: watchMode,
      watch_path: watchPath || servicePath.trim(),
      watch_include: watchInclude,
      watch_exclude: watchExclude,
    };

    try {
      await updateService(params);
      serviceForm.closeForm();
    } catch (e) {
      console.error("更新服务失败:", e);
      setGlobalError(`Failed to update service: ${e}`);
    }
  };

  // 项目操作（带通知）
  const handleAddProject = async () => {
    if (!projectForm.projectName.trim()) return;

    try {
      await addProject(projectForm.projectName.trim(), projectForm.newProjectServices);
      projectForm.closeForm();
    } catch (e) {
      console.error("添加项目失败:", e);
      setGlobalError(`Failed to add project: ${e}`);
    }
  };

  const handleUpdateProject = async () => {
    if (!projectForm.editingProject || !projectForm.projectName.trim()) return;

    try {
      await updateProject(projectForm.editingProject.id, projectForm.projectName.trim());
      projectForm.closeForm();
    } catch (e) {
      console.error("更新项目失败:", e);
      setGlobalError(`Failed to update project: ${e}`);
    }
  };

  const handleAddServiceToProject = async (serviceId: string) => {
    if (!projectForm.editingProject) return;

    try {
      await addServiceToProject(projectForm.editingProject.id, serviceId);
      // 更新编辑中的项目
      const updatedProjects = await projectsApi.getAll();
      setProjects(updatedProjects);
      const updated = updatedProjects.find((p) => p.id === projectForm.editingProject!.id);
      if (updated) projectForm.setEditingProject(updated);
    } catch (e) {
      console.error("添加服务到项目失败:", e);
    }
  };

  const handleRemoveServiceFromProject = async (serviceId: string) => {
    if (!projectForm.editingProject) return;

    try {
      await removeServiceFromProject(projectForm.editingProject.id, serviceId);
      // 更新编辑中的项目
      const updatedProjects = await projectsApi.getAll();
      setProjects(updatedProjects);
      const updated = updatedProjects.find((p) => p.id === projectForm.editingProject!.id);
      if (updated) projectForm.setEditingProject(updated);
    } catch (e) {
      console.error("从项目移除服务失败:", e);
    }
  };

  // 批量操作（带通知）
  const handleBatchStart = async (serviceNames: string[]) => {
    try {
      await processApi.batchStart(serviceNames);
      loadData();
    } catch (e) {
      const msg = `${t.toast.batchStartFailed}: ${e}`;
      console.error(msg);
      setGlobalError(msg);
    }
  };

  const handleBatchStop = async (serviceNames: string[]) => {
    try {
      await processApi.batchStop(serviceNames);
      loadData();
    } catch (e) {
      const msg = `${t.toast.batchStopFailed}: ${e}`;
      console.error(msg);
      setGlobalError(msg);
    }
  };

  const handleBatchRestart = async (serviceNames: string[]) => {
    try {
      await processApi.batchStop(serviceNames);
      await processApi.batchStart(serviceNames);
      loadData();
    } catch (e) {
      const msg = `${t.toast.batchRestartFailed}: ${e}`;
      console.error(msg);
      setGlobalError(msg);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TitleBar />

      {/* 工具栏 */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 h-14 bg-background">
        {/* 左侧 */}
        <div className="flex items-center gap-2 min-w-[120px]">
          {view === "settings" ? (
            <>
              <button
                onClick={() => setView(previousView.current || "projects")}
                className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-card-hover transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-blue-400" />
                <span className="text-base font-semibold text-foreground">{t.nav.settings}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/80">
              <button
                onClick={() => setView("services")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm transition-all duration-200 ${
                  view === "services"
                    ? "bg-background text-foreground font-semibold shadow-md ring-1 ring-border"
                    : "text-muted-foreground font-medium hover:text-foreground"
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                {t.nav.services}
              </button>
              <button
                onClick={() => setView("projects")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm transition-all duration-200 ${
                  view === "projects"
                    ? "bg-background text-foreground font-semibold shadow-md ring-1 ring-border"
                    : "text-muted-foreground font-medium hover:text-foreground"
                }`}
              >
                <FolderKanban className="w-3.5 h-3.5" />
                {t.nav.projects}
              </button>
            </div>
          )}
        </div>

        {/* 右侧 */}
        <div className="flex items-center gap-2 min-w-[120px] justify-end">
          {view === "settings" ? (
            <div />
          ) : (
            <>
              {view === "projects" ? (
                <button
                  onClick={() => projectForm.openAddForm()}
                  className="h-9 px-3 flex items-center gap-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {t.nav.addProject}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => serviceForm.openAddForm()}
                    className="h-9 px-3 flex items-center gap-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    {t.nav.addService}
                  </button>
                  <button
                    onClick={() => setShowBatchOps(true)}
                    className="h-9 px-3 flex items-center gap-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-card-hover transition-colors text-sm"
                    title={t.nav.batchOps}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    {t.nav.batchOps}
                  </button>
                </>
              )}
              <button
                onClick={() => { previousView.current = view; setView("settings"); }}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-card-hover transition-colors"
                title={t.nav.settings}
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 内容区域 */}
      <main className="flex-1 overflow-auto p-4">
        {view === "settings" ? (
          <SettingsPanel
            configDir={configDir}
            defaultConfigDir={defaultConfigDir}
            onConfigDirChange={setConfigDir}
          />
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : view === "projects" ? (
          sortedProjects.length === 0 && projectSearch === "" ? (
            <EmptyState
              icon={<FolderOpen className="w-12 h-12" />}
              title={t.empty.noProjects}
              subtitle={t.empty.noProjectsHint}
            />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleProjectDragEnd}
            >
              <div className="space-y-4">
                {/* 搜索框 */}
                <div className="relative">
                  <input
                    type="text"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder={t.project.searchPlaceholder}
                    className="w-full h-10 px-3 pl-9 rounded-lg bg-card border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  {projectSearch && (
                    <button
                      onClick={() => setProjectSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <SortableContext
                  items={filteredProjects.map(p => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ProjectGroups
                    projects={filteredProjects}
                  >
                    {(project) => (
                      <SortableProjectCard
                        key={project.id}
                        project={project}
                        runningServices={runningServices}
                        isProjectRunning={runningProjects.includes(project.id)}
                        expanded={expandedProjectId === project.id}
                        onToggleExpand={() => setExpandedProjectId(expandedProjectId === project.id ? null : project.id)}
                        onEdit={() => projectForm.openEditForm(project)}
                        onDelete={() => removeProject(project.id)}
                        onStart={() => startProject(project.id).catch(e => setGlobalError(String(e)))}
                        onStop={() => stopProject(project.id).catch(e => setGlobalError(String(e)))}
                        onRestart={() => restartProject(project.id).catch(e => setGlobalError(String(e)))}
                        onToggleFavorite={() => toggleProjectFavorite(project.id)}
                        onViewLogs={viewLogs}
                        onStartService={(name) => startService(name).catch(e => setGlobalError(String(e)))}
                        onStopService={(name) => stopService(name).catch(e => setGlobalError(String(e)))}
                        onRestartService={(name) => restartService(name).catch(e => setGlobalError(String(e)))}
                        onConfirmDelete={() => confirm({
                          title: t.project.deleteConfirm.title,
                          message: t.project.deleteConfirm.message.replace("{name}", project.name),
                          confirmLabel: t.common.delete,
                          variant: "danger",
                        })}
                      />
                    )}
                  </ProjectGroups>
                </SortableContext>

                {/* 搜索无结果 */}
                {projectSearch && filteredProjects.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {t.project.noMatch}
                  </div>
                )}
              </div>
            </DndContext>
          )
        ) : sortedServices.length === 0 && serviceSearch === "" ? (
          <EmptyState
            icon={<Wrench className="w-12 h-12" />}
            title={t.empty.noServices}
            subtitle={t.empty.noServicesHint}
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleServiceDragEnd}
          >
            <div className="space-y-4">
              {/* 搜索框 */}
              <div className="relative">
                <input
                  type="text"
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  placeholder={t.selectService.searchPlaceholder}
                  className="w-full h-10 px-3 pl-9 rounded-lg bg-card border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-blue-500/50 transition-colors"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                {serviceSearch && (
                  <button
                    onClick={() => setServiceSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* 收藏服务 */}
              {favoriteServices.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Star className="w-3.5 h-3.5 text-yellow-400" />
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      {t.selectService.favorites}
                    </h3>
                    <span className="text-sm text-muted-foreground">
                      ({favoriteServices.length})
                    </span>
                  </div>
                  <SortableContext
                    items={favoriteServices.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {favoriteServices.map((service) => (
                        <SortableServiceCard
                          key={service.id}
                          service={service}
                          running={runningServices.includes(service.name)}
                          projectCount={serviceProjectCount.get(service.id) || 0}
                          onEdit={() => serviceForm.openEditForm(service)}
                          onDelete={() => deleteService(service.id)}
                          onStart={() => startService(service.name).catch(e => setGlobalError(String(e)))}
                          onStop={() => stopService(service.name).catch(e => setGlobalError(String(e)))}
                          onRestart={() => restartService(service.name).catch(e => setGlobalError(String(e)))}
                          onViewLogs={() => viewLogs(service.name)}
                          onToggleFavorite={() => toggleServiceFavorite(service.id)}
                          onConfirmDelete={() => confirm({
                            title: t.service.deleteConfirm.title,
                            message: t.service.deleteConfirm.message.replace("{name}", service.name),
                            confirmLabel: t.common.delete,
                            variant: "danger",
                          })}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              )}

              {/* 全部服务 */}
              {otherServices.length > 0 && (
                <div>
                  {favoriteServices.length > 0 && (
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <h3 className="text-sm font-semibold text-muted-foreground">
                        {t.selectService.allServices}
                      </h3>
                      <span className="text-sm text-muted-foreground">
                        ({otherServices.length})
                      </span>
                    </div>
                  )}
                  <SortableContext
                    items={otherServices.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {otherServices.map((service) => (
                        <SortableServiceCard
                          key={service.id}
                          service={service}
                          running={runningServices.includes(service.name)}
                          projectCount={serviceProjectCount.get(service.id) || 0}
                          onEdit={() => serviceForm.openEditForm(service)}
                          onDelete={() => deleteService(service.id)}
                          onStart={() => startService(service.name).catch(e => setGlobalError(String(e)))}
                          onStop={() => stopService(service.name).catch(e => setGlobalError(String(e)))}
                          onRestart={() => restartService(service.name).catch(e => setGlobalError(String(e)))}
                          onViewLogs={() => viewLogs(service.name)}
                          onToggleFavorite={() => toggleServiceFavorite(service.id)}
                          onConfirmDelete={() => confirm({
                            title: t.service.deleteConfirm.title,
                            message: t.service.deleteConfirm.message.replace("{name}", service.name),
                            confirmLabel: t.common.delete,
                            variant: "danger",
                          })}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              )}

              {/* 搜索无结果 */}
              {serviceSearch &&
                filteredServices.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {t.selectService.noResults}
                  </div>
                )}
            </div>
          </DndContext>
        )}
      </main>

      {/* 弹窗 */}
      {serviceForm.showAddService && (
        <ServiceFormModal
          title={t.service.form.title.add}
          name={serviceForm.serviceName}
          command={serviceForm.serviceCommand}
          path={serviceForm.servicePath}
          watchMode={serviceForm.watchMode}
          watchPath={serviceForm.watchPath}
          watchInclude={serviceForm.watchInclude}
          watchExclude={serviceForm.watchExclude}
          onNameChange={serviceForm.setServiceName}
          onCommandChange={serviceForm.setServiceCommand}
          onPathChange={serviceForm.setServicePath}
          onWatchModeChange={serviceForm.setWatchMode}
          onWatchPathChange={serviceForm.setWatchPath}
          onWatchIncludeChange={serviceForm.setWatchInclude}
          onWatchExcludeChange={serviceForm.setWatchExclude}
          onClose={serviceForm.closeForm}
          onSubmit={handleAddService}
          submitLabel={t.common.add}
        />
      )}
      {serviceForm.editingService && (
        <ServiceFormModal
          title={t.service.form.title.edit}
          name={serviceForm.serviceName}
          command={serviceForm.serviceCommand}
          path={serviceForm.servicePath}
          watchMode={serviceForm.watchMode}
          watchPath={serviceForm.watchPath}
          watchInclude={serviceForm.watchInclude}
          watchExclude={serviceForm.watchExclude}
          onNameChange={serviceForm.setServiceName}
          onCommandChange={serviceForm.setServiceCommand}
          onPathChange={serviceForm.setServicePath}
          onWatchModeChange={serviceForm.setWatchMode}
          onWatchPathChange={serviceForm.setWatchPath}
          onWatchIncludeChange={serviceForm.setWatchInclude}
          onWatchExcludeChange={serviceForm.setWatchExclude}
          onClose={serviceForm.closeForm}
          onSubmit={handleUpdateService}
          submitLabel={t.common.save}
        />
      )}
      {projectForm.showAddProject && (
        <ProjectFormModal
          title={t.project.form.title.add}
          name={projectForm.projectName}
          projectServices={projectForm.newProjectServices}
          allServices={services}
          onNameChange={projectForm.setProjectName}
          onClose={projectForm.closeForm}
          onSubmit={handleAddProject}
          onAddService={(serviceId) => {
            const svc = services.find((s) => s.id === serviceId);
            if (svc) projectForm.addService(svc);
          }}
          onRemoveService={projectForm.removeService}
          submitLabel={t.common.add}
        />
      )}
      {projectForm.editingProject && (
        <ProjectFormModal
          title={t.project.form.title.edit}
          name={projectForm.projectName}
          projectServices={projectForm.editingProject.services}
          allServices={services}
          onNameChange={projectForm.setProjectName}
          onClose={projectForm.closeForm}
          onSubmit={handleUpdateProject}
          onAddService={handleAddServiceToProject}
          onRemoveService={handleRemoveServiceFromProject}
          submitLabel={t.common.save}
        />
      )}

      {/* 日志查看弹窗 */}
      {logService && (
        <LogViewerPanel
          serviceName={logService}
          content={logContent}
          running={runningServices.includes(logService)}
          onClose={closeLogViewer}
          onStart={startService}
          onStop={stopService}
          onRestart={restartService}
        />
      )}

      {/* 批量操作 */}
      {showBatchOps && (
        <BatchOperations
          services={sortedServices}
          runningServices={runningServices}
          onStartSelected={handleBatchStart}
          onStopSelected={handleBatchStop}
          onRestartSelected={handleBatchRestart}
          onClose={() => setShowBatchOps(false)}
        />
      )}

      {/* 全局错误提示 */}
      <div className={`fixed top-12 left-1/2 -translate-x-1/2 z-[200] transition-all duration-300 ease-out ${globalError ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
        {globalError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-sm text-red-400 shadow-lg">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1">{globalError}</span>
            <button
              onClick={() => setGlobalError(null)}
              className="flex-shrink-0 hover:bg-red-500/20 rounded p-0.5 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Toast 提示 */}
      <div className={`fixed top-12 left-1/2 -translate-x-1/2 z-[200] transition-all duration-300 ease-out ${toast ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
        {toast && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-sm text-emerald-400 shadow-lg">
            <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1">{toast}</span>
            <button
              onClick={() => setToast(null)}
              className="flex-shrink-0 hover:bg-emerald-500/20 rounded p-0.5 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* 确认对话框 */}
      {confirmOptions && (
        <ConfirmDialog
          title={confirmOptions.title}
          message={confirmOptions.message}
          confirmLabel={confirmOptions.confirmLabel}
          cancelLabel={confirmOptions.cancelLabel}
          variant={confirmOptions.variant}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {/* 文件监听确认提示（右下角，支持多个） */}
      <WatchConfirmToast
        events={watchEvents}
        onConfirm={async (serviceName) => {
          try {
            await restartService(serviceName);
          } catch (e) {
            setGlobalError(`Failed to restart service: ${e}`);
          }
          setWatchEvents((prev) => prev.filter((e) => e.serviceName !== serviceName));
        }}
        onDismiss={(serviceName) => {
          setWatchEvents((prev) => prev.filter((e) => e.serviceName !== serviceName));
        }}
      />
    </div>
  );
}

export default App;
