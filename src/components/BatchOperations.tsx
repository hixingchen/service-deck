import { useState } from "react";
import { Play, Square, RotateCw, Loader2 } from "lucide-react";
import type { Service } from "../types";

interface BatchOperationsProps {
  services: Service[];
  runningServices: string[];
  onStartSelected: (serviceNames: string[]) => Promise<void>;
  onStopSelected: (serviceNames: string[]) => Promise<void>;
  onRestartSelected?: (serviceNames: string[]) => Promise<void>;
  onClose: () => void;
}

export function BatchOperations({
  services,
  runningServices,
  onStartSelected,
  onStopSelected,
  onRestartSelected,
  onClose,
}: BatchOperationsProps) {
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const toggleService = (serviceName: string) => {
    setSelectedServices(prev => {
      const next = new Set(prev);
      if (next.has(serviceName)) {
        next.delete(serviceName);
      } else {
        next.add(serviceName);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedServices(new Set(services.map(s => s.name)));
  };

  const selectNone = () => {
    setSelectedServices(new Set());
  };

  const selectRunning = () => {
    setSelectedServices(new Set(services.filter(s => runningServices.includes(s.name)).map(s => s.name)));
  };

  const selectStopped = () => {
    setSelectedServices(new Set(services.filter(s => !runningServices.includes(s.name)).map(s => s.name)));
  };

  const handleStartSelected = async () => {
    const selected = Array.from(selectedServices);
    if (selected.length === 0) return;
    setLoading(true);
    try {
      await onStartSelected(selected);
      onClose();
    } catch (e) {
      console.error("批量启动失败:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleStopSelected = async () => {
    const selected = Array.from(selectedServices);
    if (selected.length === 0) return;
    setLoading(true);
    try {
      await onStopSelected(selected);
      onClose();
    } catch (e) {
      console.error("批量停止失败:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRestartSelected = async () => {
    const selected = Array.from(selectedServices);
    if (selected.length === 0 || !onRestartSelected) return;
    setLoading(true);
    try {
      await onRestartSelected(selected);
      onClose();
    } catch (e) {
      console.error("批量重启失败:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* 对话框 */}
      <div className="relative w-full max-w-lg mx-4 rounded-2xl bg-[#1a1a2e] border border-white/[0.1] shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-white/[0.06] flex-shrink-0">
          <h3 className="text-[15px] font-semibold text-white/90">批量操作</h3>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            ×
          </button>
        </div>

        {/* 快速选择 */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06] flex-shrink-0">
          <button onClick={selectAll} className="text-[11px] text-blue-400 hover:text-blue-300">全选</button>
          <button onClick={selectNone} className="text-[11px] text-gray-500 hover:text-gray-400">取消全选</button>
          <button onClick={selectRunning} className="text-[11px] text-emerald-400 hover:text-emerald-300">选择运行中</button>
          <button onClick={selectStopped} className="text-[11px] text-orange-400 hover:text-orange-300">选择已停止</button>
          <span className="text-[11px] text-gray-600 ml-auto">已选 {selectedServices.size} 个</span>
        </div>

        {/* 服务列表 */}
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-2">
            {services.map(service => (
              <label
                key={service.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.04] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedServices.has(service.name)}
                  onChange={() => toggleService(service.name)}
                  className="w-4 h-4 rounded border-white/20 bg-white/[0.04] text-blue-500 focus:ring-blue-500/50"
                />
                <div className="flex-1">
                  <div className="text-[13px] text-white/90">{service.name}</div>
                  <div className="text-[11px] text-gray-500">{service.command}</div>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded ${
                  runningServices.includes(service.name)
                    ? "text-emerald-400 bg-emerald-500/15"
                    : "text-gray-500 bg-white/[0.04]"
                }`}>
                  {runningServices.includes(service.name) ? "运行中" : "已停止"}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-white/[0.06] flex-shrink-0">
          <button
            onClick={handleStartSelected}
            disabled={selectedServices.size === 0 || loading}
            className="flex-1 h-9 px-4 rounded-lg bg-emerald-600 text-white text-[13px] font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            启动选中
          </button>
          <button
            onClick={handleStopSelected}
            disabled={selectedServices.size === 0 || loading}
            className="flex-1 h-9 px-4 rounded-lg bg-red-600 text-white text-[13px] font-medium hover:bg-red-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
            停止选中
          </button>
          {onRestartSelected && (
            <button
              onClick={handleRestartSelected}
              disabled={selectedServices.size === 0 || loading}
              className="flex-1 h-9 px-4 rounded-lg bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
              重启选中
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
