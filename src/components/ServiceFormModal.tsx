import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { ArrowLeft, RefreshCw, FolderOpen } from "lucide-react";
import { FormField } from "./FormField";
import { FormFooter } from "./FormFooter";

interface Props {
  title: string;
  name: string;
  command: string;
  path: string;
  serviceType: string;
  logPath: string;
  onNameChange: (v: string) => void;
  onCommandChange: (v: string) => void;
  onPathChange: (v: string) => void;
  onServiceTypeChange: (v: string) => void;
  onLogPathChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
}

const SERVICE_TYPES = [
  { value: "normal", label: "普通" },
  { value: "npm", label: "npm" },
  { value: "maven", label: "maven" },
];

function ServiceTypeButton({ label, value, current, onClick }: { label: string; value: string; current: string; onClick: (v: string) => void }) {
  const active = value === current;
  return (
    <button type="button" onClick={() => onClick(value)}
      className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${
        active
          ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
          : "bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.08]"
      }`}
    >
      {label}
    </button>
  );
}

export function ServiceFormModal({
  title,
  name,
  command,
  path,
  serviceType,
  logPath,
  onNameChange,
  onCommandChange,
  onPathChange,
  onServiceTypeChange,
  onLogPathChange,
  onClose,
  onSubmit,
  submitLabel,
}: Props) {
  const [availableCommands, setAvailableCommands] = useState<string[]>([]);
  const [loadingCommands, setLoadingCommands] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 当服务类型或路径变化时，自动获取可用命令
  useEffect(() => {
    if ((serviceType === "npm" || serviceType === "maven") && path.trim()) {
      let cancelled = false;
      async function load() {
        setLoadingCommands(true);
        try {
          const commands = await invoke<string[]>("get_available_commands", {
            path: path.trim(),
            serviceType: serviceType,
          });
          if (!cancelled) setAvailableCommands(commands);
        } catch (e) {
          console.error("获取可用命令失败:", e);
          if (!cancelled) setAvailableCommands([]);
        } finally {
          if (!cancelled) setLoadingCommands(false);
        }
      }
      load();
      return () => { cancelled = true; };
    } else {
      setAvailableCommands([]);
    }
  }, [serviceType, path]);

  // 表单验证
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "服务名称不能为空";
    if (!command.trim()) newErrors.command = "启动命令不能为空";
    if (!path.trim()) newErrors.path = "工作目录不能为空";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSubmit();
    }
  };

  const showCommandSelector = (serviceType === "npm" || serviceType === "maven") && availableCommands.length > 0;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#0a0a0f]" style={{ top: '2.75rem' }}>
      {/* 头部 */}
      <div className="flex-shrink-0 flex items-center h-14 px-4 border-b border-white/[0.06]">
        <button onClick={onClose}
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-white/[0.08] hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </button>
        <h2 className="ml-3 text-[15px] font-semibold text-white/90">{title}</h2>
      </div>

      {/* 表单内容 */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="space-y-5 max-w-lg mx-auto">
          <FormField label="服务名称" placeholder="请输入服务名称" value={name} onChange={(v) => { onNameChange(v); if (errors.name) setErrors(e => ({ ...e, name: "" })); }} />
          {errors.name && <p className="text-[12px] text-red-400 -mt-3">{errors.name}</p>}
          <div>
            <label className="block text-[13px] font-medium text-gray-400 mb-2">服务类型</label>
            <div className="flex gap-2">
              {SERVICE_TYPES.map((t) => (
                <ServiceTypeButton key={t.value} label={t.label} value={t.value} current={serviceType} onClick={(v) => {
                  if (v !== serviceType) {
                    onCommandChange(""); // 切换类型时清空命令
                    setAvailableCommands([]);
                  }
                  onServiceTypeChange(v);
                }} />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-400 mb-2">启动目录</label>
            <div className="flex gap-2">
              <input
                placeholder="如: D:\projects\my-app"
                value={path}
                onChange={(e) => { onPathChange(e.target.value); if (errors.path) setErrors(er => ({ ...er, path: "" })); }}
                className={`flex-1 px-3 py-2.5 rounded-xl bg-white/[0.04] border text-white/90 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 text-[13px] ${
                  errors.path ? "border-red-500/50" : "border-white/[0.08]"
                }`}
              />
              <button
                type="button"
                onClick={async () => {
                  const selected = await open({ directory: true, title: "选择启动目录" });
                  if (selected) {
                    onPathChange(selected as string);
                    if (errors.path) setErrors(er => ({ ...er, path: "" }));
                  }
                }}
                className="h-10 w-10 flex items-center justify-center rounded-xl border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors flex-shrink-0"
                title="浏览目录"
              >
                <FolderOpen className="w-4 h-4" />
              </button>
            </div>
            {errors.path && <p className="text-[12px] text-red-400 mt-1">{errors.path}</p>}
          </div>

          {/* 启动命令 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-medium text-gray-400">启动命令</label>
              {(serviceType === "npm" || serviceType === "maven") && (
                <button onClick={() => {
                  if (path.trim()) {
                    setLoadingCommands(true);
                    invoke<string[]>("get_available_commands", { path: path.trim(), serviceType })
                      .then(commands => setAvailableCommands(commands))
                      .catch(() => setAvailableCommands([]))
                      .finally(() => setLoadingCommands(false));
                  }
                }} disabled={loadingCommands}
                  className="h-6 px-2 flex items-center gap-1 rounded text-[11px] text-gray-500 hover:text-blue-400 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingCommands ? "animate-spin" : ""}`} />
                  刷新命令
                </button>
              )}
            </div>

            {/* 手动输入框 - 始终显示 */}
            <input
              placeholder={serviceType === "npm" ? "如: npm run dev" : serviceType === "maven" ? "如: mvn clean install" : "如: npm run dev、java -jar app.jar"}
              value={command}
              onChange={(e) => { onCommandChange(e.target.value); if (errors.command) setErrors(er => ({ ...er, command: "" })); }}
              className={`w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border text-white/90 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 text-[13px] font-mono ${
                errors.command ? "border-red-500/50" : "border-white/[0.08]"
              }`}
            />
            {errors.command && <p className="text-[12px] text-red-400 mt-1">{errors.command}</p>}

            {/* 命令快速选择 - 标签式 */}
            {showCommandSelector && (
              <div className="mt-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[11px] text-gray-600">可用命令:</span>
                  {loadingCommands && (
                    <RefreshCw className="w-3 h-3 text-gray-600 animate-spin" />
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availableCommands.map((cmd) => {
                    const fullCmd = serviceType === "npm" ? `npm run ${cmd}` : `mvn ${cmd}`;
                    const isActive = command === fullCmd;
                    return (
                      <button key={cmd} type="button"
                        onClick={() => onCommandChange(fullCmd)}
                        className={`px-2 py-1 rounded-md text-[11px] font-mono transition-all duration-150 ${
                          isActive
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-white/[0.04] border border-white/[0.06] text-gray-500 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.12]"
                        }`}
                      >
                        {cmd}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {loadingCommands && !showCommandSelector && (
              <p className="text-[11px] text-gray-600 mt-1.5">正在读取可用命令...</p>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-medium text-gray-400 mb-2">日志路径（可选）</label>
            <div className="flex gap-2">
              <input
                placeholder="留空则捕获控制台输出，填写则读取日志文件"
                value={logPath}
                onChange={(e) => onLogPathChange(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/90 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 text-[13px]"
              />
              <button
                type="button"
                onClick={async () => {
                  const selected = await open({ directory: false, title: "选择日志文件", filters: [{ name: "日志文件", extensions: ["log", "out", "txt"] }] });
                  if (selected) onLogPathChange(selected as string);
                }}
                className="h-10 w-10 flex items-center justify-center rounded-xl border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors flex-shrink-0"
                title="浏览文件"
              >
                <FolderOpen className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 底部按钮 */}
      <FormFooter onClose={onClose} onSubmit={handleSubmit} submitLabel={submitLabel} />
    </div>
  );
}
