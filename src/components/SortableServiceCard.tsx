import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Play, Square, Trash2, Edit3, FolderOpen, ScrollText, Star, RotateCw, Terminal } from "lucide-react";
import { terminalApi } from "../lib/api/terminal";
import type { Service } from "../types";
import { ServiceStatusDot } from "./ServiceStatusDot";
import { ActionButton } from "./ActionButton";
import { CommandTerminal } from "./CommandTerminal";
import { useI18n } from "../hooks/useI18n";

interface SortableServiceCardProps {
  service: Service;
  running: boolean;
  projectCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  onRestart: () => Promise<void>;
  onViewLogs: () => void;
  onToggleFavorite?: () => void;
  onConfirmDelete?: () => Promise<boolean>;
}

export function SortableServiceCard({
  service,
  running,
  projectCount,
  onEdit,
  onDelete,
  onStart,
  onStop,
  onRestart,
  onViewLogs,
  onToggleFavorite,
  onConfirmDelete,
}: SortableServiceCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: service.id });
  const [showTerminal, setShowTerminal] = useState(false);
  const { t } = useI18n();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : transition,
    zIndex: isDragging ? 50 : "auto" as const,
  };

  const handleOpenDirectory = async () => {
    try {
      await terminalApi.openDirectory(service.path);
    } catch (e) {
      console.error("打开目录失败:", e);
    }
  };

  const handleDelete = async () => {
    if (onConfirmDelete) {
      const confirmed = await onConfirmDelete();
      if (confirmed) onDelete();
    } else {
      onDelete();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 px-3 py-3 rounded-xl ${
        isDragging
          ? "bg-[#1a1a2e] border border-blue-500/50 shadow-[0_16px_48px_rgba(0,0,0,0.5),0_0_0_1px_rgba(59,130,246,0.4)] ring-2 ring-blue-500/20"
          : "bg-card border border-border hover:bg-card-hover hover:border-border-subtle transition-all duration-200"
      }`}
    >
      {/* 拖拽手柄 */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* 状态指示灯 */}
      <ServiceStatusDot running={running} />

      {/* 服务信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {service.name}
          </span>
          {service.favorite && (
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 flex-shrink-0" />
          )}
          {projectCount > 0 && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">
              {t.project.serviceCount.replace("{count}", String(projectCount))}
            </span>
          )}
        </div>
        <div className="text-sm text-muted-foreground truncate mt-0.5 font-mono">
          {service.command}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onToggleFavorite && (
          <ActionButton
            icon={<Star className={`w-4 h-4 ${service.favorite ? "fill-yellow-400 text-yellow-400" : ""}`} />}
            onClick={onToggleFavorite}
            title={service.favorite ? t.service.action.unfavorite : t.service.action.favorite}
          />
        )}
        <ActionButton
          icon={<FolderOpen className="w-4 h-4" />}
          onClick={handleOpenDirectory}
          title={t.service.action.openDir}
        />
        <ActionButton
          icon={<ScrollText className="w-4 h-4" />}
          onClick={onViewLogs}
          title={t.service.action.viewLogs}
        />
        <ActionButton
          icon={<Terminal className="w-4 h-4" />}
          onClick={() => setShowTerminal(true)}
          title={t.service.action.terminal}
        />
        {running ? (
          <>
            <ActionButton
              icon={<RotateCw className="w-4 h-4" />}
              onClick={onRestart}
              title={t.service.action.restart}
            />
            <ActionButton
              icon={<Square className="w-4 h-4" />}
              onClick={onStop}
              title={t.service.action.stop}
              variant="danger"
            />
          </>
        ) : (
          <ActionButton
            icon={<Play className="w-4 h-4" />}
            onClick={onStart}
            title={t.service.action.start}
            variant="success"
          />
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

      {/* 命令终端弹窗 */}
      {showTerminal && (
        <CommandTerminal
          serviceName={service.name}
          servicePath={service.path}
          onClose={() => setShowTerminal(false)}
        />
      )}
    </div>
  );
}
