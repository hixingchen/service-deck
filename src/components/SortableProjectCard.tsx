import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { invoke } from "@tauri-apps/api/core";
import { Play, Square, Trash2, Rocket, Edit, GripVertical, ChevronDown, ChevronRight, FileText, Circle, RotateCw, FolderOpen } from "lucide-react";
import type { Project } from "../types";

interface Props {
  project: Project;
  runningServices: string[];
  isProjectRunning: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onStart: () => void;
  onStop: () => void;
  onViewLogs: (serviceName: string) => void;
  onStartService: (serviceName: string) => void;
  onStopService: (serviceName: string) => void;
  onRestartService: (serviceName: string) => void;
}

export function SortableProjectCard({ project, runningServices, isProjectRunning, onEdit, onDelete, onStart, onStop, onViewLogs, onStartService, onStopService, onRestartService }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });
  const [expanded, setExpanded] = useState(false);

  async function handleOpenDirectory(path: string) {
    try {
      await invoke("open_directory", { path });
    } catch (e) {
      console.error("打开目录失败:", e);
    }
  }

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const projectServiceNames = project.services.map(s => s.name);
  const runningCount = projectServiceNames.filter(name => runningServices.includes(name)).length;
  const isRunning = isProjectRunning;

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`relative overflow-hidden rounded-xl border transition-all duration-300 group ${
          isDragging
            ? "border-blue-500/60 bg-[#0f1520] shadow-lg shadow-blue-500/10 scale-105 z-10 cursor-grabbing"
            : isRunning
              ? "border-emerald-500/30 bg-emerald-500/[0.03] hover:border-emerald-500/50"
              : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
        }`}>
        {isDragging && (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent pointer-events-none" />
        )}
        {isRunning && !isDragging && (
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none" />
        )}

        {/* 主卡片行 */}
        <div className="relative flex items-center gap-3 p-4">
          {/* 拖拽手柄 */}
          <button
            className={`-ml-1.5 flex-shrink-0 p-1.5 rounded-md transition-colors ${
              isDragging
                ? "cursor-grabbing text-blue-400"
                : "cursor-grab text-gray-600 hover:text-gray-400 hover:bg-white/[0.06]"
            }`}
            {...attributes} {...listeners}
          >
            <GripVertical className="w-4 h-4" />
          </button>

          {/* 图标 */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300 ${
            isRunning
              ? "bg-emerald-500/10 border border-emerald-500/20"
              : "bg-blue-500/10 border border-blue-500/20"
          }`}>
            <Rocket className={`w-5 h-5 ${isRunning ? "text-emerald-400" : "text-blue-400"}`} />
          </div>

          {/* 内容 */}
          <div className="flex-1 min-w-0" onClick={() => project.services.length > 0 && setExpanded(!expanded)} style={{ cursor: project.services.length > 0 ? 'pointer' : 'default' }}>
            <h3 className="text-[14px] font-semibold text-white/90 leading-none">{project.name}</h3>
            <p className="text-[12px] text-gray-500 mt-1 truncate">
              {project.services.length > 0
                ? project.services.map(s => s.name).join(" · ")
                : <span className="text-gray-600 italic">暂无服务</span>
              }
            </p>
          </div>

          {/* 展开/收起 */}
          {project.services.length > 0 && (
            <button onClick={() => setExpanded(!expanded)}
              className="flex-shrink-0 p-1 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/[0.06] transition-colors"
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}

          {/* 运行状态 / 服务数量 */}
          {isRunning ? (
            <div className="flex-shrink-0 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[11px] font-medium">
              运行中 {runningCount}/{project.services.length}
            </div>
          ) : project.services.length > 0 ? (
            <div className="flex-shrink-0 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[11px] font-medium">
              {project.services.length} 个服务
            </div>
          ) : null}

          {/* 操作按钮 */}
          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {project.services.length > 0 && (
              isRunning ? (
                <button onClick={onStop}
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-emerald-400 hover:text-red-400 transition-colors"
                  title="停止项目"
                >
                  <Square className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={onStart}
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-emerald-500/20 text-gray-500 hover:text-emerald-400 transition-colors"
                  title="启动项目"
                >
                  <Play className="w-4 h-4" />
                </button>
              )
            )}
            <button onClick={onEdit}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/[0.08] text-gray-500 hover:text-white transition-colors"
              title="编辑"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button onClick={onDelete}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
              title="删除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 展开的服务列表 */}
        {expanded && project.services.length > 0 && (
          <div className="relative px-4 pb-3 pt-1 border-t border-white/[0.04]">
            <div className="space-y-1">
              {project.services.map((service) => {
                const svcRunning = runningServices.includes(service.name);
                return (
                  <div key={service.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      svcRunning ? "bg-emerald-500/[0.05]" : "bg-white/[0.02]"
                    }`}
                  >
                    {/* 状态指示灯 */}
                    <Circle className={`w-2 h-2 flex-shrink-0 ${svcRunning ? "fill-emerald-400 text-emerald-400" : "fill-gray-600 text-gray-600"}`} />

                    {/* 服务名 */}
                    <span className={`text-[13px] flex-1 ${svcRunning ? "text-emerald-300" : "text-gray-400"}`}>
                      {service.name}
                    </span>

                    {/* 启动类型标签 */}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      service.startup_type === "auto" ? "bg-blue-500/15 text-blue-400" : "bg-white/[0.06] text-gray-500"
                    }`}>
                      {service.startup_type === "auto" ? "自动" : "手动"}
                    </span>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleOpenDirectory(service.path)}
                        className="h-6 w-6 flex items-center justify-center rounded text-gray-500 hover:bg-blue-500/10 hover:text-blue-400 transition-colors"
                        title="打开目录"
                      >
                        <FolderOpen className="w-3 h-3" />
                      </button>
                      {svcRunning ? (
                        <>
                          <button onClick={() => onViewLogs(service.name)}
                            className="h-6 px-2 flex items-center gap-1 rounded text-[11px] text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                            title="查看日志"
                          >
                            <FileText className="w-3 h-3" />
                            日志
                          </button>
                          <button onClick={() => onRestartService(service.name)}
                            className="h-6 w-6 flex items-center justify-center rounded text-blue-400 hover:bg-blue-500/10 transition-colors"
                            title="重启"
                          >
                            <RotateCw className="w-3 h-3" />
                          </button>
                          <button onClick={() => onStopService(service.name)}
                            className="h-6 w-6 flex items-center justify-center rounded text-red-400 hover:bg-red-500/10 transition-colors"
                            title="停止"
                          >
                            <Square className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => onStartService(service.name)}
                          className="h-6 px-2 flex items-center gap-1 rounded text-[11px] text-gray-500 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors"
                          title="启动"
                        >
                          <Play className="w-3 h-3" />
                          启动
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
