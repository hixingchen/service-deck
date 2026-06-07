import { useState } from "react";
import { X, Download, Upload, HardDrive, Loader2, CheckCircle, FolderOpen } from "lucide-react";
import { useConfirm } from "../hooks/useConfirm";
import { ConfirmDialog } from "./ConfirmDialog";

interface BackupRestorePanelProps {
  backing: boolean;
  restoring: boolean;
  lastBackup: string | null;
  configPath: string;
  onClose: () => void;
  onBackup: () => Promise<string | null>;
  onRestore: () => Promise<string | null>;
  onRefresh: () => void;
}

export function BackupRestorePanel({
  backing,
  restoring,
  lastBackup,
  configPath,
  onClose,
  onBackup,
  onRestore,
  onRefresh,
}: BackupRestorePanelProps) {
  const { options, confirm, handleConfirm, handleCancel } = useConfirm();
  const [error, setError] = useState<string | null>(null);

  const handleBackup = async () => {
    setError(null);
    try {
      const path = await onBackup();
      if (path) {
        onRefresh();
      }
    } catch (e) {
      const msg = `备份失败: ${e}`;
      console.error(msg);
      setError(msg);
    }
  };

  const handleRestore = async () => {
    const confirmed = await confirm({
      title: "恢复备份",
      message: "恢复备份将覆盖当前所有配置，确定要继续吗？",
      confirmLabel: "恢复",
      variant: "warning",
    });
    if (!confirmed) return;
    setError(null);
    try {
      const path = await onRestore();
      if (path) {
        onRefresh();
      }
    } catch (e) {
      const msg = `恢复失败: ${e}`;
      console.error(msg);
      setError(msg);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="w-[420px] bg-[#0f0f14] rounded-xl border border-white/[0.06] shadow-2xl overflow-hidden">
          {/* 头部 */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-blue-400" />
              <h3 className="text-[14px] font-semibold text-white">备份与恢复</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 内容 */}
          <div className="p-5 space-y-4">
            {/* 备份 */}
            <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Download className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-[13px] font-medium text-white">备份配置</h4>
                  <p className="text-[12px] text-gray-500">导出所有服务和项目配置到文件</p>
                </div>
              </div>
              <button
                onClick={handleBackup}
                disabled={backing}
                className="w-full h-9 px-4 rounded-lg bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {backing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    备份中...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    创建备份
                  </>
                )}
              </button>
            </div>

            {/* 恢复 */}
            <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-[13px] font-medium text-white">恢复配置</h4>
                  <p className="text-[12px] text-gray-500">从备份文件导入服务和项目配置</p>
                </div>
              </div>
              <button
                onClick={handleRestore}
                disabled={restoring}
                className="w-full h-9 px-4 rounded-lg bg-emerald-600 text-white text-[13px] font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {restoring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    恢复中...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    恢复备份
                  </>
                )}
              </button>
            </div>

            {/* 配置文件路径 */}
            {configPath && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <FolderOpen className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-gray-500">配置文件</p>
                  <p className="text-[12px] text-white/80 truncate font-mono">{configPath}</p>
                </div>
              </div>
            )}

            {/* 最后备份 */}
            {lastBackup && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-gray-500">上次备份</p>
                  <p className="text-[12px] text-white/80 truncate">{lastBackup}</p>
                </div>
              </div>
            )}

            {/* 提示 */}
            <div className="text-[11px] text-gray-600 space-y-1">
              <p>• 备份文件包含所有服务和项目配置</p>
              <p>• 恢复会覆盖当前配置，请谨慎操作</p>
              <p>• 建议定期备份配置文件</p>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-[12px] text-red-400">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 确认对话框 */}
      {options && (
        <ConfirmDialog
          title={options.title}
          message={options.message}
          confirmLabel={options.confirmLabel}
          cancelLabel={options.cancelLabel}
          variant={options.variant}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}
