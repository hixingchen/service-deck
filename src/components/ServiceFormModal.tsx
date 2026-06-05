import { Plus, ArrowLeft, X } from "lucide-react";
import { FormField } from "./FormField";
import { StartupTypeButton } from "./StartupTypeButton";
import { FormFooter } from "./FormFooter";

interface Props {
  title: string;
  name: string;
  command: string;
  path: string;
  startupType: string;
  envVars: Record<string, string>;
  logPath: string;
  onNameChange: (v: string) => void;
  onCommandChange: (v: string) => void;
  onPathChange: (v: string) => void;
  onStartupTypeChange: (v: string) => void;
  onEnvVarsChange: (v: Record<string, string>) => void;
  onLogPathChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
}

export function ServiceFormModal({ title, name, command, path, startupType, envVars, logPath, onNameChange, onCommandChange, onPathChange, onStartupTypeChange, onEnvVarsChange, onLogPathChange, onClose, onSubmit, submitLabel }: Props) {
  const envEntries = Object.entries(envVars);

  function addEnvVar() {
    onEnvVarsChange({ ...envVars, "": "" });
  }

  function updateEnvVarKey(oldKey: string, newKey: string) {
    const entries = Object.entries(envVars).map(([k, v]) => k === oldKey ? [newKey, v] : [k, v]);
    onEnvVarsChange(Object.fromEntries(entries));
  }

  function updateEnvVarValue(key: string, value: string) {
    onEnvVarsChange({ ...envVars, [key]: value });
  }

  function removeEnvVar(key: string) {
    const { [key]: _, ...rest } = envVars;
    onEnvVarsChange(rest);
  }

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
          <FormField label="服务名称" placeholder="请输入服务名称" value={name} onChange={onNameChange} />
          <FormField label="工作目录" placeholder="如: D:\projects\my-app" value={path} onChange={onPathChange} />
          <FormField label="启动命令" placeholder="如: npm run dev、java -jar app.jar" value={command} onChange={onCommandChange} />
          <div>
            <label className="block text-[13px] font-medium text-gray-400 mb-2">启动类型</label>
            <div className="flex gap-2">
              <StartupTypeButton label="自动启动" value="auto" current={startupType} onClick={onStartupTypeChange} />
              <StartupTypeButton label="手动启动" value="manual" current={startupType} onClick={onStartupTypeChange} />
            </div>
          </div>
          <FormField label="日志路径（可选）" placeholder="留空则捕获控制台输出，填写则读取日志文件" value={logPath} onChange={onLogPathChange} />

          {/* 环境变量 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-medium text-gray-400">环境变量（可选）</label>
              <button onClick={addEnvVar}
                className="h-7 px-2.5 flex items-center gap-1 rounded-md bg-white/[0.06] text-gray-400 text-[12px] font-medium hover:bg-white/[0.1] hover:text-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> 添加
              </button>
            </div>
            {envEntries.length === 0 ? (
              <div className="py-3 text-center text-[12px] text-gray-600">暂无环境变量</div>
            ) : (
              <div className="space-y-2">
                {envEntries.map(([key, value], index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      placeholder="KEY"
                      value={key}
                      onChange={(e) => updateEnvVarKey(key, e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/90 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 text-[13px] font-mono"
                    />
                    <span className="text-gray-600 text-[13px]">=</span>
                    <input
                      placeholder="VALUE"
                      value={value}
                      onChange={(e) => updateEnvVarValue(key, e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/90 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 text-[13px] font-mono"
                    />
                    <button onClick={() => removeEnvVar(key)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 底部按钮 */}
      <FormFooter onClose={onClose} onSubmit={onSubmit} submitLabel={submitLabel} />
    </div>
  );
}
