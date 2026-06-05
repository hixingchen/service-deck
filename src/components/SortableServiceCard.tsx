import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { invoke } from "@tauri-apps/api/core";
import { Play, Square, Trash2, Edit, GripVertical, Wrench, FileText, FolderOpen } from "lucide-react";
import type { Service } from "../types";

interface Props {
  service: Service;
  running: boolean;
  projectCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onStart: () => void;
  onStop: () => void;
  onViewLogs: () => void;
}

export function SortableServiceCard({ service, running, projectCount, onEdit, onDelete, onStart, onStop, onViewLogs }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: service.id });

  async function handleOpenDirectory() {
    try {
      await invoke("open_directory", { path: service.path });
    } catch (e) {
      console.error("打开目录失败:", e);
    }
  }

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className={`relative overflow-hidden rounded-xl border p-4 transition-all duration-300 group ${
        isDragging
          ? "border-emerald-500/60 bg-[#0f1520] shadow-lg shadow-emerald-500/10 scale-105 z-10 cursor-grabbing"
          : running
            ? "border-emerald-500/30 bg-emerald-500/[0.03] hover:border-emerald-500/50"
            : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
      }`}>
        {isDragging && (
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent pointer-events-none" />
        )}
        {running && !isDragging && (
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none" />
        )}
        <div className="relative flex items-center gap-3">
          {/* 拖拽手柄 */}
          <button
            className={`-ml-1.5 flex-shrink-0 p-1.5 rounded-md transition-colors ${
              isDragging
                ? "cursor-grabbing text-emerald-400"
                : "cursor-grab text-gray-600 hover:text-gray-400 hover:bg-white/[0.06]"
            }`}
            {...attributes} {...listeners}
          >
            <GripVertical className="w-4 h-4" />
          </button>

          {/* 图标 */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300 ${
            running
              ? "bg-emerald-500/10 border border-emerald-500/20"
              : "bg-emerald-500/10 border border-emerald-500/20"
          }`}>
            <Wrench className={`w-5 h-5 ${running ? "text-emerald-400" : "text-emerald-400"}`} />
          </div>

          {/* 内容 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold text-white/90">{service.name}</span>
              {running && (
                <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400">
                  运行中
                </span>
              )}
              <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                service.startup_type === "auto"
                  ? "bg-blue-500/15 text-blue-400"
                  : "bg-white/[0.06] text-gray-500"
              }`}>
                {service.startup_type === "auto" ? "自动" : "手动"}
              </span>
              {projectCount > 0 && (
                <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-purple-500/15 text-purple-400">
                  {projectCount} 个项目引用
                </span>
              )}
            </div>
            <p className="text-[12px] text-gray-500 truncate mt-1 font-mono">{service.command}</p>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button onClick={handleOpenDirectory}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-blue-500/20 text-gray-500 hover:text-blue-400 transition-colors"
              title="打开目录"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
            {running ? (
              <>
                <button onClick={onViewLogs}
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-blue-500/20 text-emerald-400 hover:text-blue-400 transition-colors"
                  title="查看日志"
                >
                  <FileText className="w-4 h-4" />
                </button>
                <button onClick={onStop}
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-emerald-400 hover:text-red-400 transition-colors"
                  title="强制停止"
                >
                  <Square className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button onClick={onStart}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-emerald-500/20 text-gray-500 hover:text-emerald-400 transition-colors"
                title="启动"
              >
                <Play className="w-4 h-4" />
              </button>
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
      </div>
    </div>
  );
}
