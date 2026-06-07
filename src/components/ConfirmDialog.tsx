import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "确定",
  cancelLabel = "取消",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]" onClick={onCancel}>
      <div
        className="w-[380px] bg-[#0f0f14] rounded-xl border border-white/[0.08] shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            variant === "danger" ? "bg-red-500/20" : "bg-yellow-500/20"
          }`}>
            <AlertTriangle className={`w-4 h-4 ${
              variant === "danger" ? "text-red-400" : "text-yellow-400"
            }`} />
          </div>
          <h3 className="text-[14px] font-semibold text-white flex-1">{title}</h3>
          <button
            onClick={onCancel}
            className="p-1 text-gray-500 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-5 py-4">
          <p className="text-[13px] text-gray-400 leading-relaxed">{message}</p>
        </div>

        {/* 按钮 */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06]">
          <button
            onClick={onCancel}
            className="h-9 px-4 rounded-lg border border-white/[0.08] text-gray-400 text-[13px] font-medium hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`h-9 px-4 rounded-lg text-white text-[13px] font-medium transition-colors ${
              variant === "danger"
                ? "bg-red-600 hover:bg-red-500"
                : "bg-yellow-600 hover:bg-yellow-500"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
