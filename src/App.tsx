import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, FolderOpen, Wrench, Settings, FileText, X } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import type { Service, Project, View } from "./types";
import { TitleBar } from "./components/TitleBar";
import { EmptyState } from "./components/EmptyState";
import { SortableProjectCard } from "./components/SortableProjectCard";
import { SortableServiceCard } from "./components/SortableServiceCard";
import { DroppableCategory } from "./components/DroppableCategory";
import { ServiceFormModal } from "./components/ServiceFormModal";
import { ProjectFormModal } from "./components/ProjectFormModal";
import { LogViewerPanel } from "./components/LogViewerPanel";
import { GuidePanel } from "./components/GuidePanel";
import { SettingsPanel } from "./components/SettingsPanel";

function App() {
  const [view, setView] = useState<View>("projects");
  const [services, setServices] = useState<Service[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [runningServices, setRunningServices] = useState<string[]>([]);
  const [runningProjects, setRunningProjects] = useState<string[]>([]);

  // 日志查看
  const [logService, setLogService] = useState<string | null>(null);
  const [logContent, setLogContent] = useState("");

  // 设置
  const [showSettings, setShowSettings] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // 弹窗状态
  const [showAddService, setShowAddService] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProjectServices, setNewProjectServices] = useState<Service[]>([]);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // 表单状态
  const [serviceName, setServiceName] = useState("");
  const [serviceCommand, setServiceCommand] = useState("");
  const [servicePath, setServicePath] = useState("");
  const [serviceStartupType, setServiceStartupType] = useState("manual");
  const [serviceEnvVars, setServiceEnvVars] = useState<Record<string, string>>({});
  const [serviceLogPath, setServiceLogPath] = useState("");
  const [serviceCategory, setServiceCategory] = useState("basic");
  const [projectName, setProjectName] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");

  // 拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 排序后的项目列表
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => a.sort_index - b.sort_index);
  }, [projects]);

  // 排序后的服务列表
  const sortedServices = useMemo(() => {
    return [...services].sort((a, b) => a.sort_index - b.sort_index);
  }, [services]);

  // 基础服务和项目服务
  const basicServices = useMemo(() => {
    return sortedServices.filter(s => s.category === "basic");
  }, [sortedServices]);

  const projectServices = useMemo(() => {
    return sortedServices.filter(s => s.category === "project");
  }, [sortedServices]);

  // 搜索过滤
  const filteredBasicServices = useMemo(() => {
    if (!serviceSearch.trim()) return basicServices;
    const q = serviceSearch.trim().toLowerCase();
    return basicServices.filter(s => s.name.toLowerCase().includes(q));
  }, [basicServices, serviceSearch]);

  const filteredProjectServices = useMemo(() => {
    if (!serviceSearch.trim()) return projectServices;
    const q = serviceSearch.trim().toLowerCase();
    return projectServices.filter(s => s.name.toLowerCase().includes(q));
  }, [projectServices, serviceSearch]);

  useEffect(() => {
    loadData();
  }, []);

  // 定时轮询运行状态
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const r = await invoke<string[]>("get_running_services");
        setRunningServices(r);
      } catch (e) {
        console.error("轮询运行状态失败:", e);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // 定时刷新日志（只追加新增部分，使用字节offset）
  useEffect(() => {
    if (!logService) return;
    const timer = setInterval(async () => {
      try {
        const newContent = await invoke<string>("get_service_logs", { serviceName: logService, offset: logOffsetRef.current });
        if (newContent) {
          setLogContent(prev => prev + newContent);
          logOffsetRef.current += new Blob([newContent]).size;
        }
      } catch (e) {
        console.error("获取日志失败:", e);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [logService]);

  async function loadData() {
    try {
      const [s, p, r] = await Promise.all([
        invoke<Service[]>("get_services"),
        invoke<Project[]>("get_projects"),
        invoke<string[]>("get_running_services"),
      ]);
      setServices(s);
      setProjects(p);
      setRunningServices(r);
    } catch (e) {
      console.error("加载数据失败:", e);
    }
  }

  // 拖拽结束处理
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedProjects.findIndex(p => p.id === active.id);
    const newIndex = sortedProjects.findIndex(p => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sortedProjects, oldIndex, newIndex);
    const updates = reordered.map((p, i) => [p.id, i] as [string, number]);

    try {
      await invoke("update_project_sort", { updates });
      await loadData();
    } catch (e) {
      console.error("更新排序失败:", e);
    }
  }, [sortedProjects]);

  // 服务拖拽（支持跨分类）
  const handleServiceCategoryDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeService = services.find(s => s.id === active.id);
    if (!activeService) return;

    // 拖到了空白区域（droppable-basic 或 droppable-project）
    const overId = String(over.id);
    if (overId.startsWith("droppable-")) {
      const targetCategory = overId.replace("droppable-", "");
      if (activeService.category !== targetCategory) {
        try {
          await invoke("update_service", {
            id: activeService.id, name: activeService.name, command: activeService.command,
            path: activeService.path, startupType: activeService.startup_type,
            envVars: activeService.env_vars, logPath: activeService.log_path,
            category: targetCategory,
          });
          await loadData();
        } catch (e) {
          console.error("更新服务分类失败:", e);
        }
      }
      return;
    }

    // 拖到了另一个服务
    const overService = services.find(s => s.id === over.id);
    if (!overService) return;

    // 跨分类拖拽
    if (activeService.category !== overService.category) {
      try {
        await invoke("update_service", {
          id: activeService.id, name: activeService.name, command: activeService.command,
          path: activeService.path, startupType: activeService.startup_type,
          envVars: activeService.env_vars, logPath: activeService.log_path,
          category: overService.category,
        });
        await loadData();
      } catch (e) {
        console.error("更新服务分类失败:", e);
      }
      return;
    }

    // 同分类内排序
    const sameCategory = sortedServices.filter(s => s.category === activeService.category);
    const oldIndex = sameCategory.findIndex(s => s.id === active.id);
    const newIndex = sameCategory.findIndex(s => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sameCategory, oldIndex, newIndex);
    const updates = reordered.map((s, i) => [s.id, i] as [string, number]);

    try {
      await invoke("update_service_sort", { updates });
      await loadData();
    } catch (e) {
      console.error("更新服务排序失败:", e);
    }
  }, [sortedServices, services]);

  // ===== 服务管理 =====

  function resetServiceForm() {
    setServiceName("");
    setServiceCommand("");
    setServicePath("");
    setServiceStartupType("auto");
    setServiceEnvVars({});
    setServiceLogPath("");
  }

  function openEditService(service: Service) {
    setServiceName(service.name);
    setServiceCommand(service.command);
    setServicePath(service.path);
    setServiceStartupType(service.startup_type);
    setServiceEnvVars(service.env_vars || {});
    setServiceLogPath(service.log_path || "");
    setServiceCategory(service.category || "basic");
    setEditingService(service);
  }

  async function handleAddService() {
    if (!serviceName.trim() || !serviceCommand.trim() || !servicePath.trim()) return;
    try {
      await invoke("add_service", {
        name: serviceName.trim(),
        command: serviceCommand.trim(),
        path: servicePath.trim(),
        startupType: serviceStartupType,
        envVars: serviceEnvVars,
        logPath: serviceLogPath.trim(),
        category: serviceCategory,
      });
      resetServiceForm();
      setShowAddService(false);
      loadData();
    } catch (e) {
      console.error("添加服务失败:", e);
    }
  }

  async function handleUpdateService() {
    if (!editingService) return;
    if (!serviceName.trim() || !serviceCommand.trim() || !servicePath.trim()) return;
    try {
      await invoke("update_service", {
        id: editingService.id,
        name: serviceName.trim(),
        command: serviceCommand.trim(),
        path: servicePath.trim(),
        startupType: serviceStartupType,
        envVars: serviceEnvVars,
        logPath: serviceLogPath.trim(),
        category: serviceCategory,
      });
      resetServiceForm();
      setEditingService(null);
      loadData();
    } catch (e) {
      console.error("更新服务失败:", e);
    }
  }

  async function handleDeleteService(id: string) {
    try {
      await invoke("delete_service", { id });
      loadData();
    } catch (e) {
      console.error("删除服务失败:", e);
    }
  }

  // ===== 项目管理 =====

  async function handleAddProject() {
    if (!projectName.trim()) return;
    try {
      const project = await invoke<{ id: string }>("add_project", { name: projectName.trim() });
      for (const svc of newProjectServices) {
        await invoke("add_service_to_project", { projectId: project.id, serviceId: svc.id });
      }
      setProjectName("");
      setNewProjectServices([]);
      setShowAddProject(false);
      loadData();
    } catch (e) {
      console.error("添加项目失败:", e);
    }
  }

  async function handleUpdateProject() {
    if (!editingProject || !projectName.trim()) return;
    try {
      await invoke("update_project", { id: editingProject.id, name: projectName.trim() });
      setProjectName("");
      setEditingProject(null);
      loadData();
    } catch (e) {
      console.error("更新项目失败:", e);
    }
  }

  async function handleRemoveProject(id: string) {
    try {
      await invoke("remove_project", { id });
      loadData();
    } catch (e) {
      console.error("删除项目失败:", e);
    }
  }

  async function handleStartProject(projectId: string) {
    try {
      const started = await invoke<string[]>("start_project", { projectId });
      console.log("已启动:", started);
      setRunningProjects(prev => prev.includes(projectId) ? prev : [...prev, projectId]);
      loadData();
    } catch (e) {
      console.error("启动项目失败:", e);
    }
  }

  async function handleStopProject(projectId: string) {
    try {
      const stopped = await invoke<string[]>("stop_project", { projectId });
      console.log("已停止:", stopped);
      setRunningProjects(prev => prev.filter(id => id !== projectId));
      loadData();
    } catch (e) {
      console.error("停止项目失败:", e);
    }
  }

  const logOffsetRef = useRef(0);

  async function handleViewLogs(serviceName: string) {
    try {
      const content = await invoke<string>("get_service_logs", { serviceName, tailLines: 5 });
      setLogContent(content);
      const fileSize = await invoke<number>("get_log_file_size", { serviceName });
      logOffsetRef.current = fileSize;
    } catch {
      logOffsetRef.current = 0;
      setLogContent("");
    }
    setLogService(serviceName);
  }

  async function handleStartService(serviceName: string) {
    try {
      await invoke("start_service", { serviceName });
      loadData();
    } catch (e) {
      console.error("启动服务失败:", e);
    }
  }

  async function handleStopService(serviceName: string) {
    try {
      await invoke("stop_service", { serviceName });
      loadData();
    } catch (e) {
      console.error("停止服务失败:", e);
    }
  }

  async function handleRestartService(serviceName: string) {
    try {
      await invoke("restart_service", { serviceName });
      loadData();
    } catch (e) {
      console.error("重启服务失败:", e);
    }
  }

  async function handleAddServiceToProject(projectId: string, serviceId: string) {
    try {
      await invoke("add_service_to_project", { projectId, serviceId });
      const p = await invoke<Project[]>("get_projects");
      setProjects(p);
      if (editingProject) {
        const updated = p.find(proj => proj.id === editingProject.id);
        if (updated) setEditingProject(updated);
      }
    } catch (e) {
      console.error("添加服务到项目失败:", e);
    }
  }

  async function handleRemoveServiceFromProject(projectId: string, serviceId: string) {
    try {
      await invoke("remove_service_from_project", { projectId, serviceId });
      const p = await invoke<Project[]>("get_projects");
      setProjects(p);
      if (editingProject) {
        const updated = p.find(proj => proj.id === editingProject.id);
        if (updated) setEditingProject(updated);
      }
    } catch (e) {
      console.error("从项目移除服务失败:", e);
    }
  }

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0f] overflow-hidden">
      <TitleBar />

      {/* 工具栏 */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 h-12 border-b border-white/[0.06] bg-[#0a0a0f]">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.03]">
          <button onClick={() => setView("services")}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 ${
              view === "services"
                ? "bg-white/[0.1] text-white shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}>
            服务列表
          </button>
          <button onClick={() => setView("projects")}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 ${
              view === "projects"
                ? "bg-white/[0.1] text-white shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}>
            项目列表
          </button>
        </div>
        <div className="flex items-center gap-2">
          {view === "projects" ? (
            <button
              onClick={() => { setProjectName(""); setShowAddProject(true); }}
              className="h-8 px-3 flex items-center gap-1.5 rounded-lg bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加项目
            </button>
          ) : (
            <>
              <button
                onClick={() => { resetServiceForm(); setServiceCategory("basic"); setShowAddService(true); }}
                className="h-8 px-3 flex items-center gap-1.5 rounded-lg bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-500 transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加基础服务
              </button>
              <button
                onClick={() => { resetServiceForm(); setServiceCategory("project"); setShowAddService(true); }}
                className="h-8 px-3 flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white text-[13px] font-medium hover:bg-emerald-500 transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加项目服务
              </button>
            </>
          )}
          {view === "services" && (
            <button onClick={() => setShowGuide(true)}
              className="h-8 px-3 flex items-center gap-1.5 rounded-lg border border-white/[0.08] text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors text-[12px]"
            >
              <FileText className="w-3.5 h-3.5" />
              操作指南
            </button>
          )}
          <button onClick={() => setShowSettings(true)}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-white/[0.08] text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="设置"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <main className="flex-1 p-4 overflow-auto">
        {view === "projects" ? (
          sortedProjects.length === 0 ? (
            <EmptyState icon={<FolderOpen className="w-12 h-12" />} title="暂无项目" subtitle="点击「添加项目」开始管理" />
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sortedProjects.map(p => p.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {sortedProjects.map((project) => (
                    <SortableProjectCard
                      key={project.id}
                      project={project}
                      runningServices={runningServices}
                      isProjectRunning={runningProjects.includes(project.id)}
                      onEdit={() => { setProjectName(project.name); setEditingProject(project); }}
                      onDelete={() => handleRemoveProject(project.id)}
                      onStart={() => handleStartProject(project.id)}
                      onStop={() => handleStopProject(project.id)}
                      onViewLogs={handleViewLogs}
                      onStartService={handleStartService}
                      onStopService={handleStopService}
                      onRestartService={handleRestartService}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )
        ) : (
          sortedServices.length === 0 && serviceSearch === "" ? (
            <EmptyState icon={<Wrench className="w-12 h-12" />} title="暂无服务" subtitle="点击「添加服务」开始管理" />
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleServiceCategoryDragEnd}>
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
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {serviceSearch && (
                    <button onClick={() => setServiceSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* 基础服务 */}
                {filteredBasicServices.length > 0 || (!serviceSearch && basicServices.length === 0) ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                      <h3 className="text-[13px] font-semibold text-gray-400">基础服务</h3>
                      <span className="text-[11px] text-gray-600">({filteredBasicServices.length})</span>
                    </div>
                    <SortableContext items={filteredBasicServices.map(s => s.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {filteredBasicServices.length === 0 ? (
                          <DroppableCategory category="basic" />
                        ) : filteredBasicServices.map((service) => (
                          <SortableServiceCard
                            key={service.id}
                            service={service}
                            running={runningServices.includes(service.name)}
                            projectCount={projects.filter(p => p.services.some(s => s.id === service.id)).length}
                            onEdit={() => openEditService(service)}
                            onDelete={() => handleDeleteService(service.id)}
                            onStart={() => handleStartService(service.name)}
                            onStop={() => handleStopService(service.name)}
                            onViewLogs={() => handleViewLogs(service.name)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </div>
                ) : null}

                {/* 项目服务 */}
                {filteredProjectServices.length > 0 || (!serviceSearch && projectServices.length === 0) ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                      <h3 className="text-[13px] font-semibold text-gray-400">项目服务</h3>
                      <span className="text-[11px] text-gray-600">({filteredProjectServices.length})</span>
                    </div>
                    <SortableContext items={filteredProjectServices.map(s => s.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {filteredProjectServices.length === 0 ? (
                          <DroppableCategory category="project" />
                        ) : filteredProjectServices.map((service) => (
                          <SortableServiceCard
                            key={service.id}
                            service={service}
                            running={runningServices.includes(service.name)}
                            projectCount={projects.filter(p => p.services.some(s => s.id === service.id)).length}
                            onEdit={() => openEditService(service)}
                            onDelete={() => handleDeleteService(service.id)}
                            onStart={() => handleStartService(service.name)}
                            onStop={() => handleStopService(service.name)}
                            onViewLogs={() => handleViewLogs(service.name)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </div>
                ) : null}

                {/* 搜索无结果 */}
                {serviceSearch && filteredBasicServices.length === 0 && filteredProjectServices.length === 0 && (
                  <div className="text-center py-8 text-gray-600 text-[13px]">未找到匹配的服务</div>
                )}
              </div>
            </DndContext>
          )
        )}
      </main>

      {/* 弹窗 */}
      {showAddService && (
        <ServiceFormModal
          title="添加服务"
          name={serviceName} command={serviceCommand} path={servicePath} startupType={serviceStartupType}
          envVars={serviceEnvVars} logPath={serviceLogPath}
          onNameChange={setServiceName} onCommandChange={setServiceCommand} onPathChange={setServicePath} onStartupTypeChange={setServiceStartupType}
          onEnvVarsChange={setServiceEnvVars} onLogPathChange={setServiceLogPath}
          onClose={() => { setShowAddService(false); resetServiceForm(); }}
          onSubmit={handleAddService}
          submitLabel="添加"
        />
      )}
      {editingService && (
        <ServiceFormModal
          title="编辑服务"
          name={serviceName} command={serviceCommand} path={servicePath} startupType={serviceStartupType}
          envVars={serviceEnvVars} logPath={serviceLogPath}
          onNameChange={setServiceName} onCommandChange={setServiceCommand} onPathChange={setServicePath} onStartupTypeChange={setServiceStartupType}
          onEnvVarsChange={setServiceEnvVars} onLogPathChange={setServiceLogPath}
          onClose={() => { setEditingService(null); resetServiceForm(); }}
          onSubmit={handleUpdateService}
          submitLabel="保存"
        />
      )}
      {showAddProject && (
        <ProjectFormModal
          title="添加项目"
          name={projectName}
          projectServices={newProjectServices}
          allServices={services}
          onNameChange={setProjectName}
          onClose={() => { setShowAddProject(false); setProjectName(""); setNewProjectServices([]); }}
          onSubmit={handleAddProject}
          onAddService={(serviceId) => {
            const svc = services.find(s => s.id === serviceId);
            if (svc) setNewProjectServices(prev => [...prev, svc]);
          }}
          onRemoveService={(serviceId) => {
            setNewProjectServices(prev => prev.filter(s => s.id !== serviceId));
          }}
          submitLabel="添加"
        />
      )}
      {editingProject && (
        <ProjectFormModal
          title="编辑项目"
          name={projectName}
          projectServices={editingProject.services}
          allServices={services}
          onNameChange={setProjectName}
          onClose={() => { setEditingProject(null); setProjectName(""); }}
          onSubmit={handleUpdateProject}
          onAddService={(serviceId) => handleAddServiceToProject(editingProject.id, serviceId)}
          onRemoveService={(serviceId) => handleRemoveServiceFromProject(editingProject.id, serviceId)}
          submitLabel="保存"
        />
      )}

      {/* 日志查看弹窗 */}
      {logService && (
        <LogViewerPanel
          serviceName={logService}
          content={logContent}
          onClose={() => { setLogService(null); setLogContent(""); }}
        />
      )}

      {/* 设置面板 */}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          onConfigImported={() => loadData()}
        />
      )}

      {showGuide && (
        <GuidePanel onClose={() => setShowGuide(false)} />
      )}

    </div>
  );
}

export default App;
