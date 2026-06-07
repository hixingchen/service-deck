import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useLogs() {
  const [logService, setLogService] = useState<string | null>(null);
  const [logContent, setLogContent] = useState("");

  // 定时刷新日志
  useEffect(() => {
    if (!logService) return;
    const timer = setInterval(async () => {
      try {
        const content = await invoke<string>("get_service_logs", {
          serviceName: logService,
        });
        setLogContent(content);
      } catch (e) {
        console.error("获取日志失败:", e);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [logService]);

  const viewLogs = useCallback(async (serviceName: string) => {
    try {
      // 标记日志界面打开
      await invoke("set_log_viewer_active", { serviceName, active: true });

      const content = await invoke<string>("get_service_logs", { serviceName, tailLines: 100 });
      setLogContent(content);
    } catch {
      setLogContent("");
    }
    setLogService(serviceName);
  }, []);

  const closeLogViewer = useCallback(async () => {
    if (logService) {
      try {
        // 标记日志界面关闭
        await invoke("set_log_viewer_active", { serviceName: logService, active: false });
        // 清除日志，只保留最近5行
        await invoke("clear_service_logs", { serviceName: logService });
      } catch (e) {
        console.error("关闭日志查看器失败:", e);
      }
    }
    setLogService(null);
    setLogContent("");
  }, [logService]);

  return {
    logService,
    logContent,
    viewLogs,
    closeLogViewer,
  };
}
