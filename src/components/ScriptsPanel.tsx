import { useState } from "react";
import { X, Terminal, Play, Trash2, Plus, ToggleLeft, ToggleRight, CheckCircle, XCircle } from "lucide-react";

interface Script {
  id: string;
  name: string;
  description: string;
  command: string;
  serviceName?: string;
  enabled: boolean;
  lastRun?: number;
  lastResult?: boolean;
}

interface ScriptsPanelProps {
  scripts: Script[];
  onClose: () => void;
  onAdd: (script: Omit<Script, "id" | "lastRun" | "lastResult">) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
  onRun: (id: string) => void;
}

export function ScriptsPanel({
  scripts,
  onClose,
  onAdd,
  onRemove,
  onToggle,
  onRun,
}: ScriptsPanelProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCommand, setNewCommand] = useState("");
  const [newServiceName, setNewServiceName] = useState("");

  const handleAdd = () => {
    if (!newName.trim() || !newCommand.trim()) return;
    onAdd({
      name: newName.trim(),
      description: newDescription.trim(),
      command: newCommand.trim(),
      serviceName: newServiceName.trim() || undefined,
      enabled: true,
    });
    setNewName("");
    setNewDescription("");
    setNewCommand("");
    setNewServiceName("");
    setShowAdd(false);
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return "未执行";
    return new Date(timestamp).toLocaleString("zh-CN");
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-[600px] max-h-[80vh] bg-[#0f0f14] rounded-xl border border-white/[0.06] shadow-2xl overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h3 className="text-[14px] font-semibold text-white">脚本管理</h3>
            <span className="text-[11px] text-gray-500">{scripts.length} 个脚本</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="px-3 py-1.5 text-[12px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5 inline mr-1" />
              添加脚本
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 脚本列表 */}
        <div className="flex-1 overflow-auto p-4">
          {scripts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Terminal className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-[13px]">暂无脚本</p>
              <p className="text-[12px] mt-1">添加常用脚本方便快速执行</p>
            </div>
          ) : (
            <div className="space-y-2">
              {scripts.map((script) => (
                <div
                  key={script.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    script.enabled
                      ? "bg-white/[0.03] border-white/[0.06]"
                      : "bg-white/[0.01] border-white/[0.03] opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[14px] font-medium text-white">
                          {script.name}
                        </span>
                        {script.lastResult !== undefined && (
                          script.lastResult ? (
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400" />
                          )
                        )}
                      </div>
                      {script.description && (
                        <p className="text-[12px] text-gray-500 mb-2">{script.description}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <code className="text-[11px] text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded font-mono">
                          {script.command}
                        </code>
                        {script.serviceName && (
                          <span className="text-[11px] text-gray-500">
                            关联服务: {script.serviceName}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-600 mt-2">
                        上次执行: {formatTime(script.lastRun)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onRun(script.id)}
                        className="p-1.5 text-gray-500 hover:text-emerald-400 hover:bg-emerald-400/10 rounded transition-colors"
                        title="执行"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onToggle(script.id)}
                        className="p-1.5 text-gray-500 hover:text-white hover:bg-white/[0.06] rounded transition-colors"
                        title={script.enabled ? "禁用" : "启用"}
                      >
                        {script.enabled ? (
                          <ToggleRight className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => onRemove(script.id)}
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

        {/* 添加脚本对话框 */}
        {showAdd && (
          <div className="border-t border-white/[0.06] p-4 bg-white/[0.02]">
            <h4 className="text-[13px] font-medium text-white mb-3">添加脚本</h4>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">名称</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/90 focus:outline-none focus:border-blue-500/50"
                  placeholder="脚本名称"
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
              <div className="col-span-2">
                <label className="text-[11px] text-gray-500 mb-1 block">命令</label>
                <input
                  value={newCommand}
                  onChange={(e) => setNewCommand(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/90 font-mono focus:outline-none focus:border-blue-500/50"
                  placeholder="npm install, git pull, etc."
                />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] text-gray-500 mb-1 block">关联服务 (可选)</label>
                <input
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/90 focus:outline-none focus:border-blue-500/50"
                  placeholder="关联的服务名称"
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
