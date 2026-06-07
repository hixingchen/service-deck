import { useState } from "react";
import { X, GitBranch, Play, Trash2, Plus, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";

interface WorkflowStep {
  id: string;
  name: string;
  serviceName: string;
  action: "start" | "stop" | "restart";
  delay: number;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  enabled: boolean;
  running: boolean;
  lastRun?: number;
}

interface WorkflowPanelProps {
  workflows: Workflow[];
  onClose: () => void;
  onAdd: (workflow: Omit<Workflow, "id" | "running" | "lastRun">) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
  onStart: (id: string) => void;
}

export function WorkflowPanel({
  workflows,
  onClose,
  onAdd,
  onRemove,
  onToggle,
  onStart,
}: WorkflowPanelProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSteps, setNewSteps] = useState<Omit<WorkflowStep, "id">[]>([]);

  const addStep = () => {
    setNewSteps([
      ...newSteps,
      { name: "", serviceName: "", action: "start", delay: 0 },
    ]);
  };

  const updateStep = (index: number, updates: Partial<Omit<WorkflowStep, "id">>) => {
    setNewSteps(newSteps.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  };

  const removeStep = (index: number) => {
    setNewSteps(newSteps.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    if (!newName.trim() || newSteps.length === 0) return;
    onAdd({
      name: newName.trim(),
      description: newDescription.trim(),
      steps: newSteps.map((s, i) => ({ ...s, id: `step-${i}` })),
      enabled: true,
    });
    setNewName("");
    setNewDescription("");
    setNewSteps([]);
    setShowAdd(false);
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return "未执行";
    return new Date(timestamp).toLocaleString("zh-CN");
  };

  const getActionLabel = (action: WorkflowStep["action"]) => {
    switch (action) {
      case "start": return "启动";
      case "stop": return "停止";
      case "restart": return "重启";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-[700px] max-h-[85vh] bg-[#0f0f14] rounded-xl border border-white/[0.06] shadow-2xl overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-purple-400" />
            <h3 className="text-[14px] font-semibold text-white">工作流</h3>
            <span className="text-[11px] text-gray-500">{workflows.length} 个工作流</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="px-3 py-1.5 text-[12px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5 inline mr-1" />
              新建工作流
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 工作流列表 */}
        <div className="flex-1 overflow-auto p-4">
          {workflows.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <GitBranch className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-[13px]">暂无工作流</p>
              <p className="text-[12px] mt-1">创建工作流可以批量执行多个服务操作</p>
            </div>
          ) : (
            <div className="space-y-3">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    workflow.enabled
                      ? "bg-white/[0.03] border-white/[0.06]"
                      : "bg-white/[0.01] border-white/[0.03] opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[14px] font-medium text-white">
                          {workflow.name}
                        </span>
                        {workflow.running && (
                          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                        )}
                      </div>
                      {workflow.description && (
                        <p className="text-[12px] text-gray-500">{workflow.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onStart(workflow.id)}
                        disabled={workflow.running}
                        className="p-1.5 text-gray-500 hover:text-emerald-400 hover:bg-emerald-400/10 rounded transition-colors disabled:opacity-50"
                        title="执行"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onToggle(workflow.id)}
                        className="p-1.5 text-gray-500 hover:text-white hover:bg-white/[0.06] rounded transition-colors"
                        title={workflow.enabled ? "禁用" : "启用"}
                      >
                        {workflow.enabled ? (
                          <ToggleRight className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => onRemove(workflow.id)}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 步骤列表 */}
                  <div className="space-y-1.5 ml-2 pl-3 border-l-2 border-white/[0.06]">
                    {workflow.steps.map((step, index) => (
                      <div key={step.id} className="flex items-center gap-2 text-[12px]">
                        <span className="text-gray-600 w-5">{index + 1}.</span>
                        <span className="text-white/80">{step.name || step.serviceName}</span>
                        <span className="text-gray-500">-</span>
                        <span className="text-gray-400">{getActionLabel(step.action)}</span>
                        {step.delay > 0 && (
                          <span className="text-gray-600">延迟 {step.delay}s</span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 text-[11px] text-gray-600">
                    上次执行: {formatTime(workflow.lastRun)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 新建工作流对话框 */}
        {showAdd && (
          <div className="border-t border-white/[0.06] p-4 bg-white/[0.02] max-h-[50vh] overflow-auto">
            <h4 className="text-[13px] font-medium text-white mb-3">新建工作流</h4>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">名称</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/90 focus:outline-none focus:border-blue-500/50"
                  placeholder="工作流名称"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">描述</label>
                <input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/90 focus:outline-none focus:border-blue-500/50"
                  placeholder="可选描述"
                />
              </div>
            </div>

            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] text-gray-500">执行步骤</label>
                <button
                  onClick={addStep}
                  className="text-[11px] text-blue-400 hover:text-blue-300"
                >
                  + 添加步骤
                </button>
              </div>
              <div className="space-y-2">
                {newSteps.map((step, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-600 w-5">{index + 1}.</span>
                    <input
                      value={step.name}
                      onChange={(e) => updateStep(index, { name: e.target.value })}
                      className="flex-1 h-7 px-2 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/90 focus:outline-none focus:border-blue-500/50"
                      placeholder="步骤名称"
                    />
                    <input
                      value={step.serviceName}
                      onChange={(e) => updateStep(index, { serviceName: e.target.value })}
                      className="flex-1 h-7 px-2 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/90 focus:outline-none focus:border-blue-500/50"
                      placeholder="服务名称"
                    />
                    <select
                      value={step.action}
                      onChange={(e) => updateStep(index, { action: e.target.value as "start" | "stop" | "restart" })}
                      className="h-7 px-2 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/90 focus:outline-none focus:border-blue-500/50"
                    >
                      <option value="start">启动</option>
                      <option value="stop">停止</option>
                      <option value="restart">重启</option>
                    </select>
                    <input
                      type="number"
                      value={step.delay}
                      onChange={(e) => updateStep(index, { delay: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      className="w-16 h-7 px-2 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/90 focus:outline-none focus:border-blue-500/50"
                      placeholder="延迟"
                    />
                    <button
                      onClick={() => removeStep(index)}
                      className="p-1 text-gray-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
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
                创建
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
