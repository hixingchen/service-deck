import { useState } from "react";
import { X, Clock, Trash2, Plus, ToggleLeft, ToggleRight } from "lucide-react";

interface ScheduledTask {
  id: string;
  name: string;
  serviceName: string;
  action: "start" | "stop" | "restart";
  schedule: string;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}

interface SchedulerPanelProps {
  tasks: ScheduledTask[];
  running: boolean;
  onClose: () => void;
  onAdd: (task: Omit<ScheduledTask, "id" | "lastRun" | "nextRun">) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
  onStart: () => void;
  onStop: () => void;
}

export function SchedulerPanel({
  tasks,
  running,
  onClose,
  onAdd,
  onRemove,
  onToggle,
  onStart,
  onStop,
}: SchedulerPanelProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newServiceName, setNewServiceName] = useState("");
  const [newAction, setNewAction] = useState<"start" | "stop" | "restart">("start");
  const [newSchedule, setNewSchedule] = useState("0 9 * * *");

  const handleAdd = () => {
    if (!newName.trim() || !newServiceName.trim()) return;
    onAdd({
      name: newName.trim(),
      serviceName: newServiceName.trim(),
      action: newAction,
      schedule: newSchedule,
      enabled: true,
    });
    setNewName("");
    setNewServiceName("");
    setNewAction("start");
    setNewSchedule("0 9 * * *");
    setShowAdd(false);
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return "未执行";
    return new Date(timestamp).toLocaleString("zh-CN");
  };

  const getActionLabel = (action: ScheduledTask["action"]) => {
    switch (action) {
      case "start": return "启动";
      case "stop": return "停止";
      case "restart": return "重启";
    }
  };

  const getActionColor = (action: ScheduledTask["action"]) => {
    switch (action) {
      case "start": return "text-emerald-400 bg-emerald-400/10";
      case "stop": return "text-red-400 bg-red-400/10";
      case "restart": return "text-blue-400 bg-blue-400/10";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-[600px] max-h-[80vh] bg-[#0f0f14] rounded-xl border border-white/[0.06] shadow-2xl overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="text-[14px] font-semibold text-white">定时任务</h3>
            <span className="text-[11px] text-gray-500">{tasks.length} 个任务</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={running ? onStop : onStart}
              className={`px-3 py-1.5 text-[12px] rounded-lg transition-colors ${
                running
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
              }`}
            >
              {running ? "停止调度器" : "启动调度器"}
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="px-3 py-1.5 text-[12px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5 inline mr-1" />
              添加任务
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 任务列表 */}
        <div className="flex-1 overflow-auto p-4">
          {tasks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-[13px]">暂无定时任务</p>
              <p className="text-[12px] mt-1">点击「添加任务」创建定时执行的服务操作</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    task.enabled
                      ? "bg-white/[0.03] border-white/[0.06]"
                      : "bg-white/[0.01] border-white/[0.03] opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[14px] font-medium text-white">
                          {task.name}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${getActionColor(task.action)}`}>
                          {getActionLabel(task.action)}
                        </span>
                        {!task.enabled && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-400">
                            已禁用
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-[12px] text-gray-500">
                        <span>服务: {task.serviceName}</span>
                        <span>调度: {task.schedule}</span>
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-gray-600 mt-2">
                        <span>上次执行: {formatTime(task.lastRun)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onToggle(task.id)}
                        className="p-1.5 text-gray-500 hover:text-white hover:bg-white/[0.06] rounded transition-colors"
                        title={task.enabled ? "禁用" : "启用"}
                      >
                        {task.enabled ? (
                          <ToggleRight className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => onRemove(task.id)}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 添加任务对话框 */}
        {showAdd && (
          <div className="border-t border-white/[0.06] p-4 bg-white/[0.02]">
            <h4 className="text-[13px] font-medium text-white mb-3">添加定时任务</h4>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">任务名称</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/90 focus:outline-none focus:border-blue-500/50"
                  placeholder="例: 每日启动开发环境"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">服务名称</label>
                <input
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/90 focus:outline-none focus:border-blue-500/50"
                  placeholder="服务名称"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">执行动作</label>
                <select
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value as "start" | "stop" | "restart")}
                  className="w-full h-8 px-2.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/90 focus:outline-none focus:border-blue-500/50"
                >
                  <option value="start">启动</option>
                  <option value="stop">停止</option>
                  <option value="restart">重启</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">Cron 表达式</label>
                <input
                  value={newSchedule}
                  onChange={(e) => setNewSchedule(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/90 focus:outline-none focus:border-blue-500/50"
                  placeholder="0 9 * * *"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="px-3 py-1.5 text-[12px] text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAdd}
                className="px-3 py-1.5 text-[12px] bg-blue-600 text-white hover:bg-blue-500 rounded-lg transition-colors"
              >
                添加
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
