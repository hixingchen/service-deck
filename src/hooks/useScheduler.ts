import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ScheduledTask {
  id: string;
  name: string;
  serviceName: string;
  action: "start" | "stop" | "restart";
  schedule: string; // cron expression
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}

export function useScheduler() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [running, setRunning] = useState(false);
  const schedulerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 从本地存储加载任务
  useEffect(() => {
    try {
      const saved = localStorage.getItem("scheduled-tasks");
      if (saved) {
        setTasks(JSON.parse(saved));
      }
    } catch (e) {
      console.error("加载定时任务失败:", e);
    }
  }, []);

  // 保存到本地存储
  const saveTasks = useCallback((newTasks: ScheduledTask[]) => {
    try {
      localStorage.setItem("scheduled-tasks", JSON.stringify(newTasks));
    } catch (e) {
      console.error("保存定时任务失败:", e);
    }
  }, []);

  const addTask = useCallback((task: Omit<ScheduledTask, "id" | "lastRun" | "nextRun">) => {
    const newTask: ScheduledTask = {
      ...task,
      id: Date.now().toString(),
    };
    const newTasks = [...tasks, newTask];
    setTasks(newTasks);
    saveTasks(newTasks);
    return newTask;
  }, [tasks, saveTasks]);

  const updateTask = useCallback((id: string, updates: Partial<ScheduledTask>) => {
    const newTasks = tasks.map(t => t.id === id ? { ...t, ...updates } : t);
    setTasks(newTasks);
    saveTasks(newTasks);
  }, [tasks, saveTasks]);

  const removeTask = useCallback((id: string) => {
    const newTasks = tasks.filter(t => t.id !== id);
    setTasks(newTasks);
    saveTasks(newTasks);
  }, [tasks, saveTasks]);

  const toggleTask = useCallback((id: string) => {
    const newTasks = tasks.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t);
    setTasks(newTasks);
    saveTasks(newTasks);
  }, [tasks, saveTasks]);

  // Cron 匹配：支持 *, */N, 具体值, 范围 a-b, 列表 a,b,c
  const matchCronField = useCallback((value: number, pattern: string): boolean => {
    if (pattern === "*") return true;
    // 支持 */N 间隔格式
    if (pattern.startsWith("*/")) {
      const interval = parseInt(pattern.slice(2), 10);
      return interval > 0 && value % interval === 0;
    }
    // 支持列表 a,b,c
    if (pattern.includes(",")) {
      return pattern.split(",").some(p => matchCronField(value, p.trim()));
    }
    // 支持范围 a-b
    if (pattern.includes("-")) {
      const [start, end] = pattern.split("-").map(Number);
      return value >= start && value <= end;
    }
    // 支持范围带步长 a-b/N
    if (pattern.includes("/")) {
      const [range, step] = pattern.split("/");
      if (range.includes("-")) {
        const [start, end] = range.split("-").map(Number);
        const stepNum = parseInt(step, 10);
        return value >= start && value <= end && (value - start) % stepNum === 0;
      }
    }
    // 具体数值
    return parseInt(pattern, 10) === value;
  }, []);

  const matchCron = useCallback((cron: string, date: Date): boolean => {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return false;

    const [min, hour, dayOfMonth, month, dayOfWeek] = parts;
    return (
      matchCronField(date.getMinutes(), min) &&
      matchCronField(date.getHours(), hour) &&
      matchCronField(date.getDate(), dayOfMonth) &&
      matchCronField(date.getMonth() + 1, month) &&
      matchCronField(date.getDay(), dayOfWeek)
    );
  }, [matchCronField]);

  // 执行任务
  const executeTask = useCallback(async (task: ScheduledTask) => {
    try {
      switch (task.action) {
        case "start":
          await invoke("start_service", { serviceName: task.serviceName });
          break;
        case "stop":
          await invoke("stop_service", { serviceName: task.serviceName });
          break;
        case "restart":
          await invoke("restart_service", { serviceName: task.serviceName });
          break;
      }
    } catch (e) {
      console.error(`定时任务 "${task.name}" 执行失败:`, e);
    }
  }, []);

  // 启动调度器
  const startScheduler = useCallback(() => {
    setRunning(true);
    // 每分钟检查一次
    schedulerRef.current = setInterval(() => {
      const now = new Date();
      tasks.forEach(task => {
        if (!task.enabled) return;
        if (matchCron(task.schedule, now)) {
          executeTask(task);
          // 更新最后运行时间
          const newTasks = tasks.map(t => t.id === task.id ? { ...t, lastRun: Date.now() } : t);
          setTasks(newTasks);
          saveTasks(newTasks);
        }
      });
    }, 60000);
  }, [tasks, matchCron, executeTask, saveTasks]);

  // 停止调度器
  const stopScheduler = useCallback(() => {
    setRunning(false);
    if (schedulerRef.current) {
      clearInterval(schedulerRef.current);
      schedulerRef.current = null;
    }
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (schedulerRef.current) {
        clearInterval(schedulerRef.current);
      }
    };
  }, []);

  return {
    tasks,
    running,
    addTask,
    updateTask,
    removeTask,
    toggleTask,
    startScheduler,
    stopScheduler,
  };
}
