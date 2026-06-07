import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

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

export function useScripts() {
  const [scripts, setScripts] = useState<Script[]>([]);

  // 从本地存储加载脚本
  useEffect(() => {
    try {
      const saved = localStorage.getItem("scripts");
      if (saved) {
        setScripts(JSON.parse(saved));
      }
    } catch (e) {
      console.error("加载脚本失败:", e);
    }
  }, []);

  // 保存到本地存储
  const saveScripts = useCallback((newScripts: Script[]) => {
    try {
      localStorage.setItem("scripts", JSON.stringify(newScripts));
    } catch (e) {
      console.error("保存脚本失败:", e);
    }
  }, []);

  const addScript = useCallback((script: Omit<Script, "id" | "lastRun" | "lastResult">) => {
    const newScript: Script = {
      ...script,
      id: Date.now().toString(),
    };
    const newScripts = [...scripts, newScript];
    setScripts(newScripts);
    saveScripts(newScripts);
    return newScript;
  }, [scripts, saveScripts]);

  const updateScript = useCallback((id: string, updates: Partial<Script>) => {
    const newScripts = scripts.map(s => s.id === id ? { ...s, ...updates } : s);
    setScripts(newScripts);
    saveScripts(newScripts);
  }, [scripts, saveScripts]);

  const removeScript = useCallback((id: string) => {
    const newScripts = scripts.filter(s => s.id !== id);
    setScripts(newScripts);
    saveScripts(newScripts);
  }, [scripts, saveScripts]);

  const toggleScript = useCallback((id: string) => {
    const newScripts = scripts.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s);
    setScripts(newScripts);
    saveScripts(newScripts);
  }, [scripts, saveScripts]);

  const runScript = useCallback(async (id: string) => {
    const script = scripts.find(s => s.id === id);
    if (!script) return;

    // 更新最后运行时间
    updateScript(id, { lastRun: Date.now() });

    try {
      // 如果关联了服务，使用服务的工作目录；否则使用当前目录
      let workDir = ".";
      if (script.serviceName) {
        try {
          const services = await invoke<Array<{ name: string; path: string }>>("get_services");
          const svc = services.find(s => s.name === script.serviceName);
          if (svc) workDir = svc.path;
        } catch {
          // 忽略错误，使用默认目录
        }
      }

      await invoke("execute_command", { command: script.command, workDir });
      updateScript(id, { lastResult: true });
    } catch (e) {
      console.error("脚本执行失败:", e);
      updateScript(id, { lastResult: false });
    }
  }, [scripts, updateScript]);

  return {
    scripts,
    addScript,
    updateScript,
    removeScript,
    toggleScript,
    runScript,
  };
}
