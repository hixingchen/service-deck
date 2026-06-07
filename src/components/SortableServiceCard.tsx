import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Play, Square, Trash2, Edit3, FolderOpen, ScrollText, Star, RotateCw } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { Service } from "../types";
import { ServiceStatusDot } from "./ServiceStatusDot";
import { ServiceTypeBadge } from "./ServiceTypeBadge";
import { ActionButton } from "./ActionButton";

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
  const [loading, setLoading] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : transition,
    zIndex: isDragging ? 50 : "auto" as const,
  };

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (running) {
        await onStop();
      } else {
        await onStart();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDirectory = async () => {
    try {
      await invoke("open_directory", { path: service.path });
    } catch (e) {
      console.error("打开目录失败:", e);
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
        isDragging
          ? "bg-[#1a1a2e] border-blue-500/50 shadow-[0_16px_48px_rgba(0,0,0,0.5),0_0_0_1px_rgba(59,130,246,0.4)] ring-2 ring-blue-500/20"
          : "bg-white/[0.02] hover:bg-white/[0.04] border-white/[0.06] hover:border-white/[0.1] transition-all duration-200"
      }`}
    >
      {/* 拖拽手柄 */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-600 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      {/* 状态指示灯 */}
      <ServiceStatusDot running={running} />

      {/* 服务信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-white/90 truncate">
            {service.name}
          </span>
          {service.favorite && (
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 flex-shrink-0" />
          )}
          <ServiceTypeBadge serviceType={service.service_type || "normal"} />
          {projectCount > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-400">
              {projectCount} 个项目
            </span>
          )}
          {service.depends_on && service.depends_on.length > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400">
              依赖 {service.depends_on.length}
            </span>
          )}
        </div>
        <div className="text-[11px] text-gray-600 truncate mt-0.5 font-mono">
          {service.command}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onToggleFavorite && (
          <ActionButton
            icon={<Star className={`w-3.5 h-3.5 ${service.favorite ? "fill-yellow-400 text-yellow-400" : ""}`} />}
            onClick={onToggleFavorite}
            title={service.favorite ? "取消收藏" : "收藏"}
          />
        )}
        <ActionButton
          icon={<FolderOpen className="w-3.5 h-3.5" />}
          onClick={handleOpenDirectory}
          title="打开目录"
        />
        <ActionButton
          icon={<ScrollText className="w-3.5 h-3.5" />}
          onClick={onViewLogs}
          title="查看日志"
        />
        {running ? (
          <>
            <ActionButton
              icon={<RotateCw className="w-3.5 h-3.5" />}
              onClick={onRestart}
              title="重启"
              disabled={loading}
            />
            <ActionButton
              icon={<Square className="w-3.5 h-3.5" />}
              onClick={onStop}
              title="停止"
              variant="danger"
              disabled={loading}
            />
          </>
        ) : (
          <ActionButton
            icon={<Play className="w-3.5 h-3.5" />}
            onClick={onStart}
            title="启动"
            variant="success"
            disabled={loading}
          />
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
  );
}
