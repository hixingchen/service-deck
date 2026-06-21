import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Play, Square, Edit3, Trash2, Star, ChevronDown, ChevronRight, FolderOpen, RotateCw, Rocket, ScrollText, Terminal } from "lucide-react";
import { terminalApi } from "../lib/api/terminal";
import type { Project, Service } from "../types";
import { ActionButton } from "./ActionButton";
import { ServiceStatusDot } from "./ServiceStatusDot";
import { CommandTerminal } from "./CommandTerminal";
import { useI18n } from "../hooks/useI18n";

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
  const [loadingService, setLoadingService] = useState<string | null>(null);
  const [terminalService, setTerminalService] = useState<Service | null>(null);
  const { t } = useI18n();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : transition,
    zIndex: isDragging ? 50 : "auto" as const,
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
      await terminalApi.openDirectory(path);
    } catch (e) {
      console.error("打开目录失败:", e);
    }
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`group rounded-xl overflow-hidden ${
          isDragging
            ? "bg-[#1a1a2e] border border-blue-500/50 shadow-[0_16px_48px_rgba(0,0,0,0.5),0_0_0_1px_rgba(59,130,246,0.4)] ring-2 ring-blue-500/20"
            : "bg-card border border-border hover:bg-card-hover hover:border-border-subtle transition-all duration-200"
        }`}
      >
        {/* 主卡片行 */}
        <div className="flex items-center gap-3 px-3 py-3">
          {/* 拖拽手柄 */}
          <div
            {...attributes}
            {...listeners}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
          >
            <GripVertical className="w-4 h-4" />
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
              <span className="text-sm font-medium text-foreground truncate">
                {project.name}
              </span>
              {project.favorite && (
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 flex-shrink-0" />
              )}
              <span className="px-1.5 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400">
                {t.project.serviceCount.replace("{count}", String(project.services.length))}
              </span>
              {isProjectRunning && (
                <span className="px-1.5 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400">
                  {t.project.runningCount.replace("{running}", String(runningServices.filter(name => project.services.some(s => s.name === name)).length)).replace("{total}", String(project.services.length))}
                </span>
              )}
            </div>
            <div className="text-sm text-muted-foreground truncate mt-0.5">
              {project.services.length > 0 ? (
                project.services.map(s => s.name).join(" · ")
              ) : (
                t.project.noServices
              )}
            </div>
          </div>

          {/* 展开/收起按钮 */}
          {project.services.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
              className="flex-shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-card-hover transition-colors"
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
              title={project.favorite ? t.service.action.unfavorite : t.service.action.favorite}
            />
            {project.services.length > 0 && (
              <>
                <ActionButton
                  icon={<Play className="w-4 h-4" />}
                  onClick={onStart}
                  title={t.project.action.start}
                  variant="success"
                />
                <ActionButton
                  icon={<Square className="w-4 h-4" />}
                  onClick={onStop}
                  title={t.project.action.stop}
                  variant="danger"
                />
                <ActionButton
                  icon={<RotateCw className="w-4 h-4" />}
                  onClick={onRestart}
                  title={t.project.action.restart}
                />
              </>
            )}
            <ActionButton
              icon={<Edit3 className="w-4 h-4" />}
              onClick={onEdit}
              title={t.common.edit}
            />
            <ActionButton
              icon={<Trash2 className="w-4 h-4" />}
              onClick={handleDelete}
              title={t.common.delete}
              variant="danger"
            />
          </div>
        </div>

        {/* 展开的服务列表 */}
        {expanded && project.services.length > 0 && (
          <div className="px-3 pb-3 pt-1.5">
            <div className="space-y-1">
              {project.services.map(service => {
                const svcRunning = runningServices.includes(service.name);
                return (
                  <div
                    key={service.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      svcRunning ? "bg-emerald-500/[0.05]" : "bg-card"
                    }`}
                  >
                    <ServiceStatusDot running={svcRunning} />
                    <span className={`text-sm flex-1 ${
                      svcRunning ? "text-emerald-300" : "text-muted-foreground"
                    }`}>
                      {service.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <ActionButton
                        icon={<FolderOpen className="w-3.5 h-3.5" />}
                        onClick={() => handleOpenDirectory(service.path)}
                        title={t.service.action.openDir}
                        disabled={loadingService === service.name}
                      />
                      <ActionButton
                        icon={<ScrollText className="w-3.5 h-3.5" />}
                        onClick={() => onViewLogs(service.name)}
                        title={t.service.action.viewLogs}
                      />
                      <ActionButton
                        icon={<Terminal className="w-3.5 h-3.5" />}
                        onClick={() => setTerminalService(service)}
                        title={t.service.action.terminal}
                      />
                      {svcRunning ? (
                        <>
                          <ActionButton
                            icon={<RotateCw className="w-3.5 h-3.5" />}
                            onClick={() => handleServiceAction(service.name, () => onRestartService(service.name))}
                            title={t.service.action.restart}
                            disabled={loadingService === service.name}
                          />
                          <ActionButton
                            icon={<Square className="w-3.5 h-3.5" />}
                            onClick={() => handleServiceAction(service.name, () => onStopService(service.name))}
                            title={t.service.action.stop}
                            variant="danger"
                            disabled={loadingService === service.name}
                          />
                        </>
                      ) : (
                        <ActionButton
                          icon={<Play className="w-3.5 h-3.5" />}
                          onClick={() => handleServiceAction(service.name, () => onStartService(service.name))}
                          title={t.service.action.start}
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

      {/* 命令终端弹窗 */}
      {terminalService && (
        <CommandTerminal
          serviceName={terminalService.name}
          servicePath={terminalService.path}
          onClose={() => setTerminalService(null)}
        />
      )}
    </div>
  );
}
