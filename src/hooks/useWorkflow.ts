import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface WorkflowStep {
  id: string;
  name: string;
  serviceName: string;
  action: "start" | "stop" | "restart";
  delay: number; // 延迟执行（秒）
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

export function useWorkflow() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);

  // 从本地存储加载工作流
  useEffect(() => {
    try {
      const saved = localStorage.getItem("workflows");
      if (saved) {
        setWorkflows(JSON.parse(saved));
      }
    } catch (e) {
      console.error("加载工作流失败:", e);
    }
  }, []);

  // 保存到本地存储
  const saveWorkflows = useCallback((newWorkflows: Workflow[]) => {
    try {
      localStorage.setItem("workflows", JSON.stringify(newWorkflows));
    } catch (e) {
      console.error("保存工作流失败:", e);
    }
  }, []);

  const addWorkflow = useCallback((workflow: Omit<Workflow, "id" | "running" | "lastRun">) => {
    const newWorkflow: Workflow = {
      ...workflow,
      id: Date.now().toString(),
      running: false,
    };
    const newWorkflows = [...workflows, newWorkflow];
    setWorkflows(newWorkflows);
    saveWorkflows(newWorkflows);
    return newWorkflow;
  }, [workflows, saveWorkflows]);

  const updateWorkflow = useCallback((id: string, updates: Partial<Workflow>) => {
    const newWorkflows = workflows.map(w => w.id === id ? { ...w, ...updates } : w);
    setWorkflows(newWorkflows);
    saveWorkflows(newWorkflows);
  }, [workflows, saveWorkflows]);

  const removeWorkflow = useCallback((id: string) => {
    const newWorkflows = workflows.filter(w => w.id !== id);
    setWorkflows(newWorkflows);
    saveWorkflows(newWorkflows);
  }, [workflows, saveWorkflows]);

  const toggleWorkflow = useCallback((id: string) => {
    const newWorkflows = workflows.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w);
    setWorkflows(newWorkflows);
    saveWorkflows(newWorkflows);
  }, [workflows, saveWorkflows]);

  const startWorkflow = useCallback(async (id: string) => {
    const workflow = workflows.find(w => w.id === id);
    if (!workflow) return;

    // 标记为运行中
    updateWorkflow(id, { running: true, lastRun: Date.now() });

    try {
      // 按顺序执行步骤
      for (const step of workflow.steps) {
        // 延迟执行
        if (step.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, step.delay * 1000));
        }

        // 执行实际的服务操作
        try {
          switch (step.action) {
            case "start":
              await invoke("start_service", { serviceName: step.serviceName });
              break;
            case "stop":
              await invoke("stop_service", { serviceName: step.serviceName });
              break;
            case "restart":
              await invoke("restart_service", { serviceName: step.serviceName });
              break;
          }
        } catch (e) {
          console.error(`工作流步骤 "${step.name}" 执行失败:`, e);
        }
      }
    } finally {
      // 标记为完成
      updateWorkflow(id, { running: false });
    }
  }, [workflows, updateWorkflow]);

  return {
    workflows,
    addWorkflow,
    updateWorkflow,
    removeWorkflow,
    toggleWorkflow,
    startWorkflow,
  };
}
