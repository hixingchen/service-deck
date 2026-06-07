import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB 最大日志大小
const TRIM_LOG_SIZE = 4 * 1024 * 1024; // 裁剪到 4MB

export function useLogs() {
  const [logService, setLogService] = useState<string | null>(null);
  const [logContent, setLogContent] = useState("");
  const logOffsetRef = useRef(0);

  // 定时刷新日志（只追加新增部分，使用字节offset）
  useEffect(() => {
    if (!logService) return;
    const timer = setInterval(async () => {
      try {
        const newContent = await invoke<string>("get_service_logs", {
          serviceName: logService,
          offset: logOffsetRef.current,
        });
        if (newContent) {
          setLogContent(prev => {
            let updated = prev + newContent;
            // 如果超过最大大小，裁剪到指定大小
            if (updated.length > MAX_LOG_SIZE) {
              updated = updated.slice(updated.length - TRIM_LOG_SIZE);
            }
            return updated;
          });
          logOffsetRef.current += new Blob([newContent]).size;
        }
      } catch (e) {
        console.error("获取日志失败:", e);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [logService]);

  const viewLogs = useCallback(async (serviceName: string) => {
    try {
      const content = await invoke<string>("get_service_logs", { serviceName, tailLines: 5 });
      setLogContent(content);
      const fileSize = await invoke<number>("get_log_file_size", { serviceName });
      logOffsetRef.current = fileSize;
    } catch {
      logOffsetRef.current = 0;
      setLogContent("");
    }
    setLogService(serviceName);
  }, []);

  const closeLogViewer = useCallback(() => {
    setLogService(null);
    setLogContent("");
    logOffsetRef.current = 0;
  }, []);

  return {
    logService,
    logContent,
    viewLogs,
    closeLogViewer,
  };
}
