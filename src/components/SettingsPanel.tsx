import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { X, Settings, FolderOpen, Save, Loader2 } from "lucide-react";

interface AppSettings {
  minimize_to_tray: boolean;
  show_notifications: boolean;
  theme: string;
  java_home: string;
  maven_home: string;
  maven_settings: string;
  maven_local_repo: string;
}

interface SettingsPanelProps {
  onClose: () => void;
  onSaved?: () => void;
}

export function SettingsPanel({ onClose, onSaved }: SettingsPanelProps) {
  const [settings, setSettings] = useState<AppSettings>({
    minimize_to_tray: false,
    show_notifications: true,
    theme: "",
    java_home: "",
    maven_home: "",
    maven_settings: "",
    maven_local_repo: "",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<AppSettings>("get_settings")
      .then(setSettings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await invoke("save_settings", { settings });
      onSaved?.();
      onClose();
    } catch (e) {
      console.error("保存设置失败:", e);
    } finally {
      setSaving(false);
    }
  };

  const browseFolder = async (field: keyof AppSettings) => {
    try {
      const selected = await open({ directory: true });
      if (typeof selected === "string" && selected) {
        setSettings(prev => ({ ...prev, [field]: selected }));
      }
    } catch (e) {
      console.error("选择目录失败:", e);
    }
  };

  const browseFile = async (field: keyof AppSettings) => {
    try {
      const selected = await open({
        multiple: false,
        filters: field === "maven_settings" ? [{ name: "XML", extensions: ["xml"] }] : undefined,
      });
      if (typeof selected === "string" && selected) {
        setSettings(prev => ({ ...prev, [field]: selected }));
      }
    } catch (e) {
      console.error("选择文件失败:", e);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[520px] max-h-[80vh] bg-[#0f0f14] rounded-xl border border-white/[0.06] shadow-2xl overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-400" />
            <h3 className="text-[14px] font-semibold text-white">环境配置</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-auto p-5 space-y-5">
          {/* 说明 */}
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-[12px] text-blue-400">
              配置 Java 和 Maven 环境路径，类似 IDEA 的 Project Structure 和 Maven 设置。配置后，所有 Maven/Java 命令将使用此处指定的版本。
            </p>
          </div>

          {/* Java 配置 */}
          <div className="space-y-3">
            <h4 className="text-[13px] font-medium text-white/80 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-400"></span>
              Java 配置
            </h4>
            <div>
              <label className="text-[11px] text-gray-500 mb-1.5 block">JAVA_HOME（JDK 路径）</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings.java_home}
                  onChange={(e) => setSettings(prev => ({ ...prev, java_home: e.target.value }))}
                  placeholder="例: D:\software\commonBag\jdk\jdk8"
                  className="flex-1 h-9 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/90 font-mono placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
                />
                <button
                  onClick={() => browseFolder("java_home")}
                  className="h-9 px-3 rounded-lg border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <FolderOpen className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-gray-600 mt-1">JDK 根目录，包含 bin、jre、lib 等子目录</p>
            </div>
          </div>

          {/* Maven 配置 */}
          <div className="space-y-3">
            <h4 className="text-[13px] font-medium text-white/80 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
              Maven 配置
            </h4>
            <div>
              <label className="text-[11px] text-gray-500 mb-1.5 block">Maven Home Path</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings.maven_home}
                  onChange={(e) => setSettings(prev => ({ ...prev, maven_home: e.target.value }))}
                  placeholder="例: D:\software\commonBag\apache-maven-3.8.6"
                  className="flex-1 h-9 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/90 font-mono placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
                />
                <button
                  onClick={() => browseFolder("maven_home")}
                  className="h-9 px-3 rounded-lg border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <FolderOpen className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-gray-600 mt-1">Maven 根目录，包含 bin、conf、lib 等子目录</p>
            </div>
            <div>
              <label className="text-[11px] text-gray-500 mb-1.5 block">User Settings File</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings.maven_settings}
                  onChange={(e) => setSettings(prev => ({ ...prev, maven_settings: e.target.value }))}
                  placeholder="例: C:\Users\xxx\.m2\settings.xml"
                  className="flex-1 h-9 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/90 font-mono placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
                />
                <button
                  onClick={() => browseFile("maven_settings")}
                  className="h-9 px-3 rounded-lg border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <FolderOpen className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-gray-600 mt-1">Maven 配置文件，用于配置镜像、代理等</p>
            </div>
            <div>
              <label className="text-[11px] text-gray-500 mb-1.5 block">Local Repository</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings.maven_local_repo}
                  onChange={(e) => setSettings(prev => ({ ...prev, maven_local_repo: e.target.value }))}
                  placeholder="例: D:\repository（默认 ~/.m2/repository）"
                  className="flex-1 h-9 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/90 font-mono placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
                />
                <button
                  onClick={() => browseFolder("maven_local_repo")}
                  className="h-9 px-3 rounded-lg border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <FolderOpen className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-gray-600 mt-1">Maven 本地仓库路径，存放下载的依赖包</p>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex-shrink-0 flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06]">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-white/[0.08] text-gray-400 text-[13px] hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-9 px-4 rounded-lg bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
