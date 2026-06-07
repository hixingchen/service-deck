import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Play, Square, Edit3, Trash2, Star, ChevronDown, ChevronRight, FolderOpen, RotateCw, Rocket, FileText } from "lucide-react";
import { confirm } from "@tauri-apps/plugin-dialog";
import type { Project } from "../types";
import { ActionButton } from "./ActionButton";
import { ServiceStatusDot } from "./ServiceStatusDot";

interface SortableProjectCardProps {
  project: Project;
  runningServices: string[];
  isProjectRunning: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onToggleFavorite: () => void;
  onViewLogs: (serviceName: string) => void;
  onStartService: (serviceName: string) => void;
  onStopService: (serviceName: string) => void;
  onRestartService: (serviceName: string) => void;
  onConfirmDelete?: () => Promise<boolean>;
}

export function SortableProjectCard({
  project,
  runningServices,
  isProjectRunning,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onStart,
  onStop,
  onRestart,
  onToggleFavorite,
  onViewLogs,
  onStartService,
  onStopService,
  onRestartService,
  onConfirmDelete,
}: SortableProjectCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });
  const [loading, setLoading] = useState(false);
  const [loadingService, setLoadingService] = useState<string | null>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : transition,
    zIndex: isDragging ? 50 : "auto" as const,
  };

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (isProjectRunning) {
        await onStop();
      } else {
        await onStart();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (onConfirmDelete) {
      const confirmed = await onConfirmDelete();
      if (confirmed) {
        onDelete();
      }
    } else {
      onDelete();
    }
  };

  const handleServiceAction = async (serviceName: string, action: () => void | Promise<void>) => {
    setLoadingService(serviceName);
    try {
      await action();
    } finally {
      setLoadingService(null);
    }
  };

  const handleOpenDirectory = async (path: string) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_directory", { path });
    } catch (e) {
      console.error("打开目录失败:", e);
    }
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`group rounded-xl border overflow-hidden ${
          isDragging
            ? "bg-[#1a1a2e] border-blue-500/50 shadow-[0_16px_48px_rgba(0,0,0,0.5),0_0_0_1px_rgba(59,130,246,0.4)] ring-2 ring-blue-500/20"
            : "bg-white/[0.02] hover:bg-white/[0.04] border-white/[0.06] hover:border-white/[0.1] transition-all duration-200"
        }`}
      >
        {/* 主卡片行 */}
        <div className="flex items-center gap-3 px-3 py-2.5">
          {/* 拖拽手柄 */}
          <div
            {...attributes}
            {...listeners}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-600 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>

          {/* 图标 */}
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300 bg-blue-500/10 border border-blue-500/20">
            <Rocket className="w-5 h-5 text-blue-400" />
          </div>

          {/* 项目信息 */}
          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => project.services.length > 0 && onToggleExpand()}
          >
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-white/90 truncate">
                {project.name}
              </span>
              {project.favorite && (
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 flex-shrink-0" />
              )}
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-400">
                {project.services.length} 个服务
              </span>
              {isProjectRunning && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400">
                  运行中 {runningServices.filter(name => project.services.some(s => s.name === name)).length}/{project.services.length}
                </span>
              )}
            </div>
            <div className="text-[11px] text-gray-600 truncate mt-0.5">
              {project.services.length > 0 ? (
                project.services.map(s => s.name).join(" · ")
              ) : (
                "暂无服务"
              )}
            </div>
          </div>

          {/* 展开/收起按钮 */}
          {project.services.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
              className="flex-shrink-0 p-1 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/[0.06] transition-colors"
            >
              {expanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )}

          {/* 操作按钮 */}
          <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <ActionButton
              icon={<Star className={`w-3.5 h-3.5 ${project.favorite ? "fill-yellow-400 text-yellow-400" : ""}`} />}
              onClick={onToggleFavorite}
              title={project.favorite ? "取消收藏" : "收藏"}
            />
            {project.services.length > 0 && (
              <>
                <ActionButton
                  icon={<Play className="w-3.5 h-3.5" />}
                  onClick={onStart}
                  title="启动项目"
                  variant="success"
                  disabled={loading}
                />
                <ActionButton
                  icon={<Square className="w-3.5 h-3.5" />}
                  onClick={onStop}
                  title="停止项目"
                  variant="danger"
                  disabled={loading}
                />
                <ActionButton
                  icon={<RotateCw className="w-3.5 h-3.5" />}
                  onClick={onRestart}
                  title="重启项目"
                  disabled={loading}
                />
              </>
            )}
            <ActionButton
              icon={<Edit3 className="w-3.5 h-3.5" />}
              onClick={onEdit}
              title="编辑"
            />
            <ActionButton
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={handleDelete}
              title="删除"
              variant="danger"
            />
          </div>
        </div>

        {/* 展开的服务列表 */}
        {expanded && project.services.length > 0 && (
          <div className="px-3 pb-3 pt-1 border-t border-white/[0.04]">
            <div className="space-y-1">
              {project.services.map(service => {
                const svcRunning = runningServices.includes(service.name);
                return (
                  <div
                    key={service.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      svcRunning ? "bg-emerald-500/[0.05]" : "bg-white/[0.02]"
                    }`}
                  >
                    <ServiceStatusDot running={svcRunning} />
                    <span className={`text-[13px] flex-1 ${
                      svcRunning ? "text-emerald-300" : "text-gray-400"
                    }`}>
                      {service.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <ActionButton
                        icon={<FolderOpen className="w-3 h-3" />}
                        onClick={() => handleOpenDirectory(service.path)}
                        title="打开目录"
                        disabled={loadingService === service.name}
                      />
                      {svcRunning ? (
                        <>
                          <ActionButton
                            icon={<FileText className="w-3 h-3" />}
                            onClick={() => onViewLogs(service.name)}
                            title="查看日志"
                          />
                          <ActionButton
                            icon={<RotateCw className="w-3 h-3" />}
                            onClick={() => handleServiceAction(service.name, () => onRestartService(service.name))}
                            title="重启"
                            disabled={loadingService === service.name}
                          />
                          <ActionButton
                            icon={<Square className="w-3 h-3" />}
                            onClick={() => handleServiceAction(service.name, () => onStopService(service.name))}
                            title="停止"
                            variant="danger"
                            disabled={loadingService === service.name}
                          />
                        </>
                      ) : (
                        <ActionButton
                          icon={<Play className="w-3 h-3" />}
                          onClick={() => handleServiceAction(service.name, () => onStartService(service.name))}
                          title="启动"
                          variant="success"
                          disabled={loadingService === service.name}
                        />
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
