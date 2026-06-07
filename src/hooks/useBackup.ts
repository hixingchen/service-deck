import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";

export function useBackup() {
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  const createBackup = useCallback(async () => {
    setBacking(true);
    try {
      const filePath = await save({
        defaultPath: `service-deck-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });

      console.log("save 对话框返回:", filePath, "类型:", typeof filePath);

      // Tauri v2 的 save 对话框返回 string | null
      if (filePath && typeof filePath === 'string' && filePath.length > 0) {
        try {
          await invoke("export_config", { exportPath: filePath });
          setLastBackup(filePath);
          return filePath;
        } catch (invokeErr) {
          console.error("调用 export_config 失败:", invokeErr);
          throw invokeErr;
        }
      }
      return null;
    } catch (e) {
      console.error("备份失败:", e);
      throw e;
    } finally {
      setBacking(false);
    }
  }, []);

  const restoreBackup = useCallback(async () => {
    setRestoring(true);
    try {
      const filePath = await open({
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });

      console.log("open 对话框返回:", filePath, "类型:", typeof filePath);

      // Tauri v2 的 open 对话框返回 string | string[] | null
      let path: string | null = null;
      if (typeof filePath === 'string') {
        path = filePath;
      } else if (Array.isArray(filePath) && filePath.length > 0) {
        path = filePath[0];
      }

      if (path && path.length > 0) {
        try {
          await invoke("import_config", { importPath: path });
          return path;
        } catch (invokeErr) {
          console.error("调用 import_config 失败:", invokeErr);
          throw invokeErr;
        }
      }
      return null;
    } catch (e) {
      console.error("恢复失败:", e);
      throw e;
    } finally {
      setRestoring(false);
    }
  }, []);

  return {
    backing,
    restoring,
    lastBackup,
    createBackup,
    restoreBackup,
  };
}
