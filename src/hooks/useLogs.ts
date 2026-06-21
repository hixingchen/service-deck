import { useState, useEffect, useCallback, useRef } from "react";

import { logsApi } from "../lib/api/logs";
import { listen } from "@tauri-apps/api/event";

// 日志行事件负载类型
interface LogLinePayload {
  service_name: string;
  line: string;
}

export function useLogs() {
  const [logService, setLogService] = useState<string | null>(null);
  const [logContent, setLogContent] = useState("");
  const logContentRef = useRef("");
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dirtyRef = useRef(false);

  // 刷新缓冲区到状态
  const flush = useCallback(() => {
    if (dirtyRef.current) {
      dirtyRef.current = false;
      setLogContent(logContentRef.current);
    }
  }, []);

  // 启动/停止定时刷新
  useEffect(() => {
    if (logService) {
      // 每 50ms 刷新一次，限制最多 20fps 重渲染
      flushTimerRef.current = setInterval(flush, 50);
      return () => {
        if (flushTimerRef.current) {
          clearInterval(flushTimerRef.current);
          flushTimerRef.current = null;
        }
        // 卸载时最后一次刷新
        flush();
      };
    }
  }, [logService, flush]);

  // 监听实时日志事件
  useEffect(() => {
    const unlisten = listen<LogLinePayload>("log:line-added", (event) => {
      const { service_name, line } = event.payload;
      // 只处理当前查看的服务的日志
      if (service_name === logService) {
        logContentRef.current += line + "\n";
        dirtyRef.current = true;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [logService]);

  const viewLogs = useCallback(async (serviceName: string) => {
    try {
      // 标记日志界面打开
      await logsApi.setViewerActive(serviceName, true);

      // 获取历史日志
      const content = await logsApi.get(serviceName, 1000);
      logContentRef.current = content;
      setLogContent(content);
    } catch {
      logContentRef.current = "";
      setLogContent("");
    }
    setLogService(serviceName);
  }, []);

  const closeLogViewer = useCallback(async () => {
    if (logService) {
      try {
        // 标记日志界面关闭
        await logsApi.setViewerActive(logService, false);
        // 清除旧日志，保留最近 1000 行
        await logsApi.clear(logService);
      } catch (e) {
        console.error("关闭日志查看器失败:", e);
      }
    }
    logContentRef.current = "";
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
