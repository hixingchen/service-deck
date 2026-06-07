import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Plus, ArrowLeft, X, RefreshCw, Link, FolderOpen } from "lucide-react";
import { FormField } from "./FormField";
import { FormFooter } from "./FormFooter";
import type { Service } from "../types";

interface Props {
  title: string;
  name: string;
  command: string;
  path: string;
  serviceType: string;
  envVars: Record<string, string>;
  logPath: string;
  dependsOn: string[];
  onNameChange: (v: string) => void;
  onCommandChange: (v: string) => void;
  onPathChange: (v: string) => void;
  onServiceTypeChange: (v: string) => void;
  onEnvVarsChange: (v: Record<string, string>) => void;
  onLogPathChange: (v: string) => void;
  onDependsOnChange: (v: string[]) => void;
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
  envVars,
  logPath,
  dependsOn,
  onNameChange,
  onCommandChange,
  onPathChange,
  onServiceTypeChange,
  onEnvVarsChange,
  onLogPathChange,
  onDependsOnChange,
  onClose,
  onSubmit,
  submitLabel,
}: Props) {
  const envEntries = Object.entries(envVars);
  const [availableCommands, setAvailableCommands] = useState<string[]>([]);
  const [loadingCommands, setLoadingCommands] = useState(false);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [showDepsDropdown, setShowDepsDropdown] = useState(false);
  const [depsSearch, setDepsSearch] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const depsDropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭依赖下拉框
  useEffect(() => {
    if (!showDepsDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (depsDropdownRef.current && !depsDropdownRef.current.contains(e.target as Node)) {
        setShowDepsDropdown(false);
        setDepsSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDepsDropdown]);

  // 加载所有服务（用于依赖选择）
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const services = await invoke<Service[]>("get_services");
        if (!cancelled) setAllServices(services);
      } catch (e) {
        console.error("加载服务列表失败:", e);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

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

  function addEnvVar() {
    // 生成唯一空 key，避免多条空 key 覆盖
    let idx = 1;
    let newKey = `KEY_${idx}`;
    while (newKey in envVars) {
      idx++;
      newKey = `KEY_${idx}`;
    }
    onEnvVarsChange({ ...envVars, [newKey]: "" });
  }

  function updateEnvVarKey(oldKey: string, newKey: string) {
    // 如果新 key 为空或与旧 key 相同，不处理
    if (!newKey.trim() || newKey === oldKey) return;
    // 如果新 key 已存在，不允许覆盖
    if (newKey in envVars && newKey !== oldKey) return;
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

  function toggleDependency(serviceId: string) {
    if (dependsOn.includes(serviceId)) {
      onDependsOnChange(dependsOn.filter(id => id !== serviceId));
    } else {
      onDependsOnChange([...dependsOn, serviceId]);
    }
  }

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

  // 过滤掉当前正在编辑的服务（不能依赖自己）- 使用名称匹配（编辑时名称唯一）
  const availableForDeps = allServices
    .filter(s => s.name !== name || !name.trim())
    .filter(s => !depsSearch.trim() || s.name.toLowerCase().includes(depsSearch.toLowerCase()));

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

          {/* 服务依赖 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-medium text-gray-400">服务依赖（可选）</label>
              <span className="text-[11px] text-gray-600">启动时会自动先启动依赖服务</span>
            </div>
            <div className="relative" ref={depsDropdownRef}>
              <button
                type="button"
                onClick={() => setShowDepsDropdown(!showDepsDropdown)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/90 focus:outline-none focus:border-blue-500/50 text-[13px] text-left flex items-center gap-2"
              >
                <Link className="w-3.5 h-3.5 text-gray-500" />
                {dependsOn.length === 0 ? (
                  <span className="text-gray-600">选择依赖服务...</span>
                ) : (
                  <span>已选择 {dependsOn.length} 个依赖</span>
                )}
              </button>

              {showDepsDropdown && (
                <div className="absolute z-10 w-full mt-1 rounded-xl bg-[#1a1a2e] border border-white/[0.1] shadow-xl overflow-hidden">
                  {/* 搜索框 */}
                  <div className="p-2 border-b border-white/[0.06]">
                    <input
                      type="text"
                      value={depsSearch}
                      onChange={(e) => setDepsSearch(e.target.value)}
                      placeholder="搜索服务..."
                      className="w-full h-7 px-2 rounded-md bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/90 placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
                      autoFocus
                    />
                  </div>
                  {/* 服务列表 */}
                  <div className="max-h-40 overflow-y-auto">
                    {availableForDeps.length === 0 ? (
                      <div className="px-3 py-2 text-[12px] text-gray-600">
                        {depsSearch.trim() ? "未找到匹配的服务" : "暂无可用服务"}
                      </div>
                    ) : (
                      availableForDeps.map((service) => (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => toggleDependency(service.id)}
                          className={`w-full px-3 py-2 text-left text-[13px] hover:bg-white/[0.06] transition-colors flex items-center gap-2 ${
                            dependsOn.includes(service.id) ? "text-blue-400" : "text-gray-400"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                            dependsOn.includes(service.id)
                              ? "bg-blue-600 border-blue-600"
                              : "border-gray-600"
                          }`}>
                            {dependsOn.includes(service.id) && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="truncate block">{service.name}</span>
                            <span className="text-[11px] text-gray-600 truncate block">{service.command}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 已选择的依赖列表 */}
            {dependsOn.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {dependsOn.map((depId) => {
                  const dep = allServices.find(s => s.id === depId);
                  if (!dep) return null;
                  return (
                    <span
                      key={depId}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-[12px]"
                    >
                      {dep.name}
                      <button
                        type="button"
                        onClick={() => toggleDependency(depId)}
                        className="hover:text-blue-300"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

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
      <FormFooter onClose={onClose} onSubmit={handleSubmit} submitLabel={submitLabel} />
    </div>
  );
}
