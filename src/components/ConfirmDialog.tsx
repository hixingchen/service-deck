import { AlertTriangle, X } from "lucide-react";
import { useI18n } from "../hooks/useI18n";

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
  confirmLabel,
  cancelLabel,
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const finalConfirmLabel = confirmLabel || t.common.confirm;
  const finalCancelLabel = cancelLabel || t.common.cancel;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]" onClick={onCancel}>
      <div
        className="w-[380px] bg-card rounded-xl border-[3px] border-border-subtle shadow-[0_0_0_2px_rgba(255,255,255,0.15),0_0_20px_rgba(0,0,0,0.3),0_25px_50px_-12px_rgba(0,0,0,0.6)] overflow-hidden animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            variant === "danger" ? "bg-red-500/20" : "bg-yellow-500/20"
          }`}>
            <AlertTriangle className={`w-4 h-4 ${
              variant === "danger" ? "text-red-400" : "text-yellow-400"
            }`} />
          </div>
          <h3 className="text-base font-semibold text-foreground flex-1">{title}</h3>
          <button
            onClick={onCancel}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-card-hover rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-5 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
        </div>

        {/* 按钮 */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onCancel}
            className="h-9 px-4 rounded-lg border border-border text-muted-foreground text-sm font-medium hover:bg-card-hover hover:text-foreground transition-colors"
          >
            {finalCancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`h-9 px-4 rounded-lg text-primary-foreground text-sm font-medium transition-colors ${
              variant === "danger"
                ? "bg-red-600 hover:bg-red-500"
                : "bg-yellow-600 hover:bg-yellow-500"
            }`}
          >
            {finalConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
