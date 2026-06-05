import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft, FolderOpen, Download, Upload } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";

interface Props {
  onClose: () => void;
  onConfigImported: () => void;
}

export function SettingsPanel({ onClose, onConfigImported }: Props) {
  const [configDir, setConfigDir] = useState("");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadConfigDir();
  }, []);

  async function loadConfigDir() {
    try {
      const dir = await invoke<string>("get_config_dir");
      setConfigDir(dir);
    } catch (e) {
      console.error("获取配置目录失败:", e);
    }
  }

  async function handleExport() {
    try {
      setExporting(true);
      setMessage(null);
      const selected = await open({
        directory: false,
        title: "导出配置文件",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (selected) {
        await invoke("export_config", { exportPath: selected });
        setMessage({ type: "success", text: "配置导出成功！" });
      }
    } catch (e) {
      setMessage({ type: "error", text: `导出失败: ${e}` });
    } finally {
      setExporting(false);
    }
  }

  async function handleImport() {
    try {
      setImporting(true);
      setMessage(null);
      const selected = await open({
        directory: false,
        title: "选择配置文件",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (selected) {
        await invoke("import_config", { importPath: selected });
        setMessage({ type: "success", text: "配置导入成功！" });
        onConfigImported();
      }
    } catch (e) {
      setMessage({ type: "error", text: `导入失败: ${e}` });
    } finally {
      setImporting(false);
    }
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
        <h2 className="ml-3 text-[15px] font-semibold text-white/90">设置</h2>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="space-y-6 max-w-lg mx-auto">
          {/* 配置文件路径 */}
          <div>
            <h3 className="text-[14px] font-semibold text-white/90 mb-4">配置文件路径</h3>
            <p className="text-[12px] text-gray-500 mb-4">
              配置文件存储在程序同级目录的 config 文件夹下
            </p>

            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-[13px] text-white/70 font-mono break-all">{configDir || "加载中..."}</span>
              </div>
            </div>
            <p className="text-[11px] text-gray-600 mt-1">
              包含: services.json, projects.json, settings.json
            </p>
          </div>

          {/* 导入导出 */}
          <div>
            <h3 className="text-[14px] font-semibold text-white/90 mb-4">导入导出配置</h3>
            <p className="text-[12px] text-gray-500 mb-4">
              导出配置到其他目录，或从其他目录导入配置
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex-1 h-10 px-4 flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-colors text-[13px] font-medium disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {exporting ? "导出中..." : "导出配置"}
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex-1 h-10 px-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-colors text-[13px] font-medium disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {importing ? "导入中..." : "导入配置"}
              </button>
            </div>
          </div>

          {/* 消息提示 */}
          {message && (
            <div className={`p-3 rounded-xl text-[13px] ${
              message.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                : "bg-red-500/10 border border-red-500/20 text-red-400"
            }`}>
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
