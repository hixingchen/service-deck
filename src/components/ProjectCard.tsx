import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Play,
  Square,
  Trash2,
  Rocket,
  Edit,
  ChevronDown,
  ChevronRight,
  FileText,
  RotateCw,
  FolderOpen,
  Star,
} from "lucide-react";
import type { Project } from "../types";
import { ServiceStatusDot } from "./ServiceStatusDot";
import { ActionButton } from "./ActionButton";

interface ProjectCardProps {
  project: Project;
  runningServices: string[];
  isProjectRunning: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onStart: () => void;
  onStop: () => void;
  onToggleFavorite: () => void;
  onViewLogs: (serviceName: string) => void;
  onStartService: (serviceName: string) => void;
  onStopService: (serviceName: string) => void;
  onRestartService: (serviceName: string) => void;
}

export function ProjectCard({
  project,
  runningServices,
  isProjectRunning,
  onEdit,
  onDelete,
  onStart,
  onStop,
  onToggleFavorite,
  onViewLogs,
  onStartService,
  onStopService,
  onRestartService,
}: ProjectCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [loadingService, setLoadingService] = useState<string | null>(null);

  const handleOpenDirectory = async (path: string) => {
    try {
      await invoke("open_directory", { path });
    } catch (e) {
      console.error("打开目录失败:", e);
    }
  };

  const handleDelete = () => {
    if (window.confirm(`确定要删除项目 "${project.name}" 吗？此操作不可撤销。`)) {
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

  const runningCount = project.services.filter(s =>
    runningServices.includes(s.name)
  ).length;
  const isRunning = isProjectRunning;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border transition-all duration-300 group ${
        isRunning
          ? "border-emerald-500/30 bg-emerald-500/[0.03] hover:border-emerald-500/50"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
      }`}
    >
      {isRunning && (
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none" />
      )}

      {/* 主卡片行 */}
      <div className="relative flex items-center gap-3 p-4">
        {/* 图标 */}
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300 ${
            isRunning
              ? "bg-emerald-500/10 border border-emerald-500/20"
              : "bg-blue-500/10 border border-blue-500/20"
          }`}
        >
          <Rocket
            className={`w-5 h-5 ${isRunning ? "text-emerald-400" : "text-blue-400"}`}
          />
        </div>

        {/* 内容 */}
        <div
          className="flex-1 min-w-0"
          onClick={() => project.services.length > 0 && setExpanded(!expanded)}
          style={{
            cursor: project.services.length > 0 ? "pointer" : "default",
          }}
        >
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-semibold text-white/90 leading-none">
              {project.name}
            </h3>
          </div>
          <p className="text-[12px] text-gray-500 mt-1 truncate">
            {project.services.length > 0 ? (
              project.services.map(s => s.name).join(" · ")
            ) : (
              <span className="text-gray-600 italic">暂无服务</span>
            )}
          </p>
        </div>

        {/* 展开/收起 */}
        {project.services.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 p-1 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/[0.06] transition-colors"
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
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
          <ActionButton
            icon={<Star className={`w-4 h-4 ${project.favorite ? "fill-yellow-400 text-yellow-400" : ""}`} />}
            onClick={onToggleFavorite}
            title={project.favorite ? "取消收藏" : "收藏"}
          />
          {project.services.length > 0 &&
            (isRunning ? (
              <ActionButton
                icon={<Square className="w-4 h-4" />}
                onClick={onStop}
                title="停止项目"
                variant="danger"
              />
            ) : (
              <ActionButton
                icon={<Play className="w-4 h-4" />}
                onClick={onStart}
                title="启动项目"
                variant="success"
              />
            ))}
          <ActionButton
            icon={<Edit className="w-4 h-4" />}
            onClick={onEdit}
            title="编辑"
          />
          <ActionButton
            icon={<Trash2 className="w-4 h-4" />}
            onClick={handleDelete}
            title="删除"
            variant="danger"
          />
        </div>
      </div>

      {/* 展开的服务列表 */}
      {expanded && project.services.length > 0 && (
        <div className="relative px-4 pb-3 pt-1 border-t border-white/[0.04]">
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
                  {/* 状态指示灯 */}
                  <ServiceStatusDot running={svcRunning} />

                  {/* 服务名 */}
                  <span
                    className={`text-[13px] flex-1 ${
                      svcRunning ? "text-emerald-300" : "text-gray-400"
                    }`}
                  >
                    {service.name}
                  </span>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1">
                    <ActionButton
                      icon={<FolderOpen className="w-3 h-3" />}
                      onClick={() => handleOpenDirectory(service.path)}
                      title="打开目录"
                      disabled={loadingService === service.name}
                    />
                    {svcRunning ? (
                      <>
                        <button
                          onClick={() => onViewLogs(service.name)}
                          className="h-6 px-2 flex items-center gap-1 rounded text-[11px] text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                          title="查看日志"
                        >
                          <FileText className="w-3 h-3" />
                          日志
                        </button>
                        <ActionButton
                          icon={<RotateCw className="w-3 h-3" />}
                          onClick={() => handleServiceAction(service.name, () => onRestartService(service.name))}
                          title="重启"
                          variant="default"
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
                      <button
                        onClick={() => handleServiceAction(service.name, () => onStartService(service.name))}
                        disabled={loadingService === service.name}
                        className="h-6 px-2 flex items-center gap-1 rounded text-[11px] text-gray-500 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors disabled:opacity-50"
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
  );
}
