import { useState } from "react";
import { Play, Square, CheckSquare, RotateCw } from "lucide-react";
import type { Service } from "../types";

interface BatchOperationsProps {
  services: Service[];
  runningServices: string[];
  onStartSelected: (serviceNames: string[]) => void;
  onStopSelected: (serviceNames: string[]) => void;
  onRestartSelected?: (serviceNames: string[]) => void;
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

  const handleStartSelected = () => {
    const selected = Array.from(selectedServices);
    if (selected.length > 0) {
      onStartSelected(selected);
      onClose();
    }
  };

  const handleStopSelected = () => {
    const selected = Array.from(selectedServices);
    if (selected.length > 0) {
      onStopSelected(selected);
      onClose();
    }
  };

  const handleRestartSelected = () => {
    const selected = Array.from(selectedServices);
    if (selected.length > 0 && onRestartSelected) {
      onRestartSelected(selected);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* 对话框 */}
      <div className="relative w-full max-w-lg mx-4 rounded-2xl bg-[#1a1a2e] border border-white/[0.1] shadow-2xl overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-white/[0.06]">
          <h3 className="text-[15px] font-semibold text-white/90">批量操作</h3>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-gray-500">
              已选择 {selectedServices.size}/{services.length}
            </span>
          </div>
        </div>

        {/* 快捷选择 */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06]">
          <button
            onClick={selectAll}
            className="px-2 py-1 rounded text-[11px] bg-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.1] transition-colors"
          >
            全选
          </button>
          <button
            onClick={selectNone}
            className="px-2 py-1 rounded text-[11px] bg-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.1] transition-colors"
          >
            全不选
          </button>
          <button
            onClick={selectRunning}
            className="px-2 py-1 rounded text-[11px] bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
          >
            选择运行中
          </button>
          <button
            onClick={selectStopped}
            className="px-2 py-1 rounded text-[11px] bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
          >
            选择已停止
          </button>
        </div>

        {/* 服务列表 */}
        <div className="max-h-64 overflow-y-auto">
          {services.map(service => {
            const isRunning = runningServices.includes(service.name);
            const isSelected = selectedServices.has(service.name);

            return (
              <button
                key={service.id}
                onClick={() => toggleService(service.name)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  isSelected ? "bg-blue-500/10" : "hover:bg-white/[0.04]"
                }`}
              >
                {/* 复选框 */}
                <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                  isSelected
                    ? "bg-blue-600 border-blue-600"
                    : "border-gray-600"
                }`}>
                  {isSelected && (
                    <CheckSquare className="w-3.5 h-3.5 text-white" />
                  )}
                </div>

                {/* 状态指示灯 */}
                <div className={`w-2 h-2 rounded-full ${
                  isRunning ? "bg-emerald-400" : "bg-gray-600"
                }`} />

                {/* 名称 */}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-white/90 truncate">{service.name}</div>
                  <div className="text-[11px] text-gray-600 truncate font-mono">{service.command}</div>
                </div>

                {/* 状态标签 */}
                <div className={`px-2 py-0.5 rounded text-[11px] ${
                  isRunning
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-white/[0.06] text-gray-500"
                }`}>
                  {isRunning ? "运行中" : "已停止"}
                </div>
              </button>
            );
          })}
        </div>

        {/* 底部操作按钮 */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/[0.06]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[13px] text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleStartSelected}
            disabled={selectedServices.size === 0}
            className="px-4 py-2 rounded-lg text-[13px] bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            启动选中 ({selectedServices.size})
          </button>
          <button
            onClick={handleRestartSelected}
            disabled={selectedServices.size === 0 || !onRestartSelected}
            className="px-4 py-2 rounded-lg text-[13px] bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5" />
            重启选中
          </button>
          <button
            onClick={handleStopSelected}
            disabled={selectedServices.size === 0}
            className="px-4 py-2 rounded-lg text-[13px] bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Square className="w-3.5 h-3.5" />
            停止选中 ({selectedServices.size})
          </button>
        </div>
      </div>
    </div>
  );
}
