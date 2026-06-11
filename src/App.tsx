import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, FolderOpen, Wrench, X, Layers, HardDrive, MoreHorizontal, Star, Settings } from "lucide-react";
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
import { BackupRestorePanel } from "./components/BackupRestorePanel";
import { SettingsPanel } from "./components/SettingsPanel";

import {
  useServices,
  useProjects,
  useLogs,
  useDnD,
  useServiceForm,
  useProjectForm,
  useBackup,
  useConfirm,
} from "./hooks";
import { ConfirmDialog } from "./components/ConfirmDialog";

function App() {
  // 视图状态
  const [view, setView] = useState<View>("projects");
  const [showBatchOps, setShowBatchOps] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [serviceSearch, setServiceSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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
  } = useProjects();

  const { logService, logContent, viewLogs, closeLogViewer } = useLogs();

  const serviceForm = useServiceForm();
  const projectForm = useProjectForm();
  const { options: confirmOptions, confirm, handleConfirm, handleCancel } = useConfirm();

  // 功能扩展 hooks
  const { backing, restoring, lastBackup, createBackup, restoreBackup } = useBackup();
  const [showBackupRestore, setShowBackupRestore] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [configPath, setConfigPath] = useState("");

  // 错误提示 5 秒后自动消失
  useEffect(() => {
    if (!globalError) return;
    const timer = setTimeout(() => setGlobalError(null), 5000);
    return () => clearTimeout(timer);
  }, [globalError]);

  // 加载所有数据
  const loadData = useCallback(async () => {
    try {
      const [s, p, r, c] = await Promise.all([
        invoke<import("./types").Service[]>("get_services"),
        invoke<import("./types").Project[]>("get_projects"),
        invoke<string[]>("get_running_services"),
        invoke<string>("get_config_file_path").catch(() => ""),
      ]);
      setServices(s);
      setProjects(p);
      setRunningServices(r);
      if (c) setConfigPath(c);
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

  // 定时轮询运行状态（无运行服务时降低频率）
  useEffect(() => {
    let active = true;

    const poll = async () => {
      if (!active) return;
      try {
        const r = await invoke<string[]>("get_running_services");
        if (!active) return;
        setRunningServices(r);
      } catch (e) {
        console.error("轮询运行状态失败:", e);
      }
    };

    // 有运行服务时 2 秒轮询，否则 10 秒
    const getInterval = () => runningServices.length > 0 ? 2000 : 10000;

    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(async () => {
        await poll();
        schedule();
      }, getInterval());
    };

    // 首次立即轮询
    poll().then(() => schedule());

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [setRunningServices, runningServices.length]);

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
    const { serviceName, serviceCommand, servicePath, serviceType, serviceLogPath } = serviceForm;
    if (!serviceName.trim() || !serviceCommand.trim() || !servicePath.trim()) return;

    try {
      await addService({
        name: serviceName.trim(),
        command: serviceCommand.trim(),
        path: servicePath.trim(),
        serviceType,
        logPath: serviceLogPath.trim(),
      });
      serviceForm.closeForm();
    } catch (e) {
      console.error("添加服务失败:", e);
      setGlobalError(`添加服务失败: ${e}`);
    }
  };

  const handleUpdateService = async () => {
    const { editingService, serviceName, serviceCommand, servicePath, serviceType, serviceLogPath } = serviceForm;
    if (!editingService) return;
    if (!serviceName.trim() || !serviceCommand.trim() || !servicePath.trim()) return;

    try {
      await updateService({
        id: editingService.id,
        name: serviceName.trim(),
        command: serviceCommand.trim(),
        path: servicePath.trim(),
        serviceType,
        logPath: serviceLogPath.trim(),
      });
      serviceForm.closeForm();
    } catch (e) {
      console.error("更新服务失败:", e);
      setGlobalError(`更新服务失败: ${e}`);
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
      setGlobalError(`添加项目失败: ${e}`);
    }
  };

  const handleUpdateProject = async () => {
    if (!projectForm.editingProject || !projectForm.projectName.trim()) return;

    try {
      await updateProject(projectForm.editingProject.id, projectForm.projectName.trim());
      projectForm.closeForm();
    } catch (e) {
      console.error("更新项目失败:", e);
      setGlobalError(`更新项目失败: ${e}`);
    }
  };

  const handleAddServiceToProject = async (serviceId: string) => {
    if (!projectForm.editingProject) return;

    try {
      await addServiceToProject(projectForm.editingProject.id, serviceId);
      // 更新编辑中的项目
      const updatedProjects = await invoke<import("./types").Project[]>("get_projects");
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
      const updatedProjects = await invoke<import("./types").Project[]>("get_projects");
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
      await invoke("batch_start_services", { serviceNames });
      loadData();
    } catch (e) {
      const msg = `批量启动失败: ${e}`;
      console.error(msg);
      setGlobalError(msg);
    }
  };

  const handleBatchStop = async (serviceNames: string[]) => {
    try {
      await invoke("batch_stop_services", { serviceNames });
      loadData();
    } catch (e) {
      const msg = `批量停止失败: ${e}`;
      console.error(msg);
      setGlobalError(msg);
    }
  };

  const handleBatchRestart = async (serviceNames: string[]) => {
    try {
      await invoke("batch_stop_services", { serviceNames });
      await invoke("batch_start_services", { serviceNames });
      loadData();
    } catch (e) {
      const msg = `批量重启失败: ${e}`;
      console.error(msg);
      setGlobalError(msg);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0f] overflow-hidden">
      <TitleBar />

      {/* 工具栏 */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 h-12 border-b border-white/[0.06] bg-[#0a0a0f]">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.03]">
          <button
            onClick={() => setView("services")}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 ${
              view === "services"
                ? "bg-white/[0.1] text-white shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            服务列表
          </button>
          <button
            onClick={() => setView("projects")}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 ${
              view === "projects"
                ? "bg-white/[0.1] text-white shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            项目列表
          </button>
        </div>
        <div className="flex items-center gap-2">
          {view === "projects" ? (
            <button
              onClick={() => projectForm.openAddForm()}
              className="h-8 px-3 flex items-center gap-1.5 rounded-lg bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加项目
            </button>
          ) : (
            <>
              <button
                onClick={() => serviceForm.openAddForm()}
                className="h-8 px-3 flex items-center gap-1.5 rounded-lg bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-500 transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加服务
              </button>
              <button
                onClick={() => setShowBatchOps(true)}
                className="h-8 px-3 flex items-center gap-1.5 rounded-lg border border-white/[0.08] text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors text-[12px]"
                title="批量操作"
              >
                <Layers className="w-3.5 h-3.5" />
                批量操作
              </button>
            </>
          )}
          {/* 更多功能下拉菜单 */}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-white/[0.08] text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors"
              title="更多功能"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMoreMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                <div className="absolute right-0 top-10 z-50 w-48 py-1 rounded-xl bg-[#1a1a2e] border border-white/[0.1] shadow-xl">
                  <button
                    onClick={() => { setShowBackupRestore(true); setShowMoreMenu(false); }}
                    className="w-full px-3 py-2 text-left text-[13px] text-gray-400 hover:text-white hover:bg-white/[0.06] flex items-center gap-2"
                  >
                    <HardDrive className="w-4 h-4" />
                    备份恢复
                  </button>
                  <button
                    onClick={() => { setShowSettings(true); setShowMoreMenu(false); }}
                    className="w-full px-3 py-2 text-left text-[13px] text-gray-400 hover:text-white hover:bg-white/[0.06] flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    环境配置
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <main className="flex-1 p-4 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : view === "projects" ? (
          sortedProjects.length === 0 && projectSearch === "" ? (
            <EmptyState
              icon={<FolderOpen className="w-12 h-12" />}
              title="暂无项目"
              subtitle="点击「添加项目」开始管理"
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
                    placeholder="搜索项目名称..."
                    className="w-full h-9 px-3 pl-9 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white/90 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600"
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
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
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
                          title: "删除项目",
                          message: `确定要删除项目 "${project.name}" 吗？此操作不可撤销。`,
                          confirmLabel: "删除",
                          variant: "danger",
                        })}
                      />
                    )}
                  </ProjectGroups>
                </SortableContext>

                {/* 搜索无结果 */}
                {projectSearch && filteredProjects.length === 0 && (
                  <div className="text-center py-8 text-gray-600 text-[13px]">
                    未找到匹配的项目
                  </div>
                )}
              </div>
            </DndContext>
          )
        ) : sortedServices.length === 0 && serviceSearch === "" ? (
          <EmptyState
            icon={<Wrench className="w-12 h-12" />}
            title="暂无服务"
            subtitle="点击「添加服务」开始管理"
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
                  placeholder="搜索服务名称..."
                  className="w-full h-9 px-3 pl-9 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white/90 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600"
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
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
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
                    <h3 className="text-[13px] font-semibold text-gray-400">
                      收藏
                    </h3>
                    <span className="text-[11px] text-gray-600">
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
                            title: "删除服务",
                            message: `确定要删除服务 "${service.name}" 吗？此操作不可撤销。`,
                            confirmLabel: "删除",
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
                      <h3 className="text-[13px] font-semibold text-gray-400">
                        全部服务
                      </h3>
                      <span className="text-[11px] text-gray-600">
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
                            title: "删除服务",
                            message: `确定要删除服务 "${service.name}" 吗？此操作不可撤销。`,
                            confirmLabel: "删除",
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
                  <div className="text-center py-8 text-gray-600 text-[13px]">
                    未找到匹配的服务
                  </div>
                )}
            </div>
          </DndContext>
        )}
      </main>

      {/* 弹窗 */}
      {serviceForm.showAddService && (
        <ServiceFormModal
          title="添加服务"
          name={serviceForm.serviceName}
          command={serviceForm.serviceCommand}
          path={serviceForm.servicePath}
          serviceType={serviceForm.serviceType}
          logPath={serviceForm.serviceLogPath}
          onNameChange={serviceForm.setServiceName}
          onCommandChange={serviceForm.setServiceCommand}
          onPathChange={serviceForm.setServicePath}
          onServiceTypeChange={serviceForm.setServiceType}
          onLogPathChange={serviceForm.setServiceLogPath}
          onClose={serviceForm.closeForm}
          onSubmit={handleAddService}
          submitLabel="添加"
        />
      )}
      {serviceForm.editingService && (
        <ServiceFormModal
          title="编辑服务"
          name={serviceForm.serviceName}
          command={serviceForm.serviceCommand}
          path={serviceForm.servicePath}
          serviceType={serviceForm.serviceType}
          logPath={serviceForm.serviceLogPath}
          onNameChange={serviceForm.setServiceName}
          onCommandChange={serviceForm.setServiceCommand}
          onPathChange={serviceForm.setServicePath}
          onServiceTypeChange={serviceForm.setServiceType}
          onLogPathChange={serviceForm.setServiceLogPath}
          onClose={serviceForm.closeForm}
          onSubmit={handleUpdateService}
          submitLabel="保存"
        />
      )}
      {projectForm.showAddProject && (
        <ProjectFormModal
          title="添加项目"
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
          submitLabel="添加"
        />
      )}
      {projectForm.editingProject && (
        <ProjectFormModal
          title="编辑项目"
          name={projectForm.projectName}
          projectServices={projectForm.editingProject.services}
          allServices={services}
          onNameChange={projectForm.setProjectName}
          onClose={projectForm.closeForm}
          onSubmit={handleUpdateProject}
          onAddService={handleAddServiceToProject}
          onRemoveService={handleRemoveServiceFromProject}
          submitLabel="保存"
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

      {/* 环境配置面板 */}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* 备份恢复面板 */}
      {showBackupRestore && (
        <BackupRestorePanel
          backing={backing}
          restoring={restoring}
          lastBackup={lastBackup}
          configPath={configPath}
          onClose={() => setShowBackupRestore(false)}
          onBackup={createBackup}
          onRestore={restoreBackup}
          onRefresh={loadData}
        />
      )}

      {/* 全局错误提示 */}
      {globalError && (
        <div className="fixed bottom-4 right-4 z-[200] max-w-md animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/90 backdrop-blur-sm text-white shadow-lg">
            <div className="flex-1 text-[13px]">{globalError}</div>
            <button
              onClick={() => setGlobalError(null)}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
    </div>
  );
}

export default App;
