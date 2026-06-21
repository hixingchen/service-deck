import { useState, useEffect, useRef, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Database, Cpu, Bell, Globe, Monitor,
  FolderOpen, Save, Loader2, CheckCircle,
  Activity, HardDrive, Sun, Moon, SunMoon, Wrench,
  Trash2,
} from "lucide-react";
import type { AppSettings, ThemeMode } from "../types";
import { settingsApi, configApi } from "../lib/api";
import { applyTheme } from "../lib/theme";
import { useI18n } from "../hooks/useI18n";
import { LogViewer } from "./LogViewer";

/* ================================================================== */

interface SettingsPanelProps {
  configDir: string;
  defaultConfigDir: string;
  onConfigDirChange: (dir: string) => void;
}

type Tab = "general" | "environment" | "advanced";
type Accent = "blue" | "amber" | "emerald";

const A: Record<Accent, { text: string; bg: string; btn: string }> = {
  blue:    { text: "text-blue-500",   bg: "bg-blue-500",   btn: "bg-blue-600 text-white hover:bg-blue-500" },
  amber:   { text: "text-amber-500",  bg: "bg-amber-500",  btn: "bg-amber-600 text-white hover:bg-amber-500" },
  emerald: { text: "text-emerald-500",bg: "bg-emerald-500",btn: "bg-emerald-600 text-white hover:bg-emerald-500" },
};

/* ================================================================== */

export function SettingsPanel(props: SettingsPanelProps) {
  const { configDir, defaultConfigDir, onConfigDirChange } = props;
  const { t, language, changeLanguage } = useI18n();

  const TABS: { key: Tab; label: string; icon: React.ElementType; accent: Accent }[] = [
    { key: "general",     label: t.settings.general.title, icon: Bell,     accent: "blue" },
    { key: "environment", label: t.settings.environment.title, icon: Cpu,      accent: "amber" },
    { key: "advanced",    label: t.settings.advanced.title, icon: Wrench, accent: "emerald" },
  ];

  const [tab, setTab] = useState<Tab>("general");
  const [settings, setSettings] = useState<AppSettings>({
    minimize_to_tray: false,
    show_notifications: true,
    theme: "dark",
    java_home: "",
    language: "zh",
    auto_backup_enabled: false,
    auto_backup_keep_days: 7,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // 防抖保存计时器
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    settingsApi.get().then(setSettings).catch(console.error).finally(() => setLoading(false));
  }, []);

  // 清理计时器
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // 防抖自动保存（通用和环境 tab 使用）
  const debouncedSave = useCallback(async (newSettings: AppSettings) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await settingsApi.save(newSettings);
      } catch (e) {
        console.error("自动保存失败:", e);
      }
    }, 500);
  }, []);

  // 设置变更处理（自动保存）
  const handleSettingsChange = useCallback((updater: React.SetStateAction<AppSettings>) => {
    setSettings(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      debouncedSave(next);
      return next;
    });
  }, [debouncedSave]);

  // 手动保存（环境 tab 的 JAVA_HOME 使用）
  const save = async () => {
    setSaving(true);
    try {
      await settingsApi.save(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const browse = async (field: keyof AppSettings) => {
    try {
      const selected = await open({ directory: true });
      if (typeof selected === "string" && selected) handleSettingsChange(p => ({ ...p, [field]: selected }));
    } catch (e) { console.error(e); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  const accent = A[TABS.find(t => t.key === tab)!.accent];

  return (
    <div className="h-full flex flex-col">
      {/* Tab nav */}
      <nav className="flex-shrink-0 flex gap-1 p-1 bg-muted/80 rounded-xl border border-border mb-4">
        {TABS.map(t => {
          const a = A[t.accent];
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 flex-1 justify-center
                ${active ? `${a.text} bg-background shadow-md font-semibold` : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}
            >
              <t.icon className={`w-4 h-4 ${active ? a.text : ""}`} />
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {tab === "general"     && <General settings={settings} onChange={handleSettingsChange} onLanguageChange={changeLanguage} currentLang={language} t={t} accent="blue" />}
        {tab === "environment" && <Environment settings={settings} onChange={handleSettingsChange} browse={browse} t={t} accent="amber" />}
        {tab === "advanced"    && <Advanced configDir={configDir} defaultConfigDir={defaultConfigDir} onConfigDirChange={onConfigDirChange} settings={settings} onChange={handleSettingsChange} t={t} accent="emerald" />}
      </div>

      {/* 环境 tab 显示保存按钮 */}
      {tab === "environment" && (
        <div className="flex-shrink-0 flex justify-end pt-4 mt-4 border-t border-border">
          <button onClick={save} disabled={saving || saved}
            className={`h-9 px-6 rounded-lg text-sm font-medium transition-all duration-300 disabled:opacity-30 flex items-center gap-2 ${
              saved ? "bg-emerald-500 text-white" : accent.btn
            }`}
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />{t.common.loading}</>
            : saved ? <><CheckCircle className="w-4 h-4" />{t.common.success}</>
            :          <><Save className="w-4 h-4" />{t.settings.environment.save}</>}
          </button>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Tab: 通用                                                         */
/* ================================================================== */

import type { Translations } from "../i18n";
import type { Language } from "../i18n";

function General({ settings, onChange, onLanguageChange, currentLang, t, accent }: {
  settings: AppSettings; onChange: React.Dispatch<React.SetStateAction<AppSettings>>;
  onLanguageChange: (lang: Language) => void; currentLang: Language; t: Translations; accent: Accent;
}) {
  const [autoStart, setAutoStart] = useState(false);
  const [autoStartLoading, setAutoStartLoading] = useState(true);

  // 查询开机自启状态
  useEffect(() => {
    settingsApi.isAutostartEnabled()
      .then(setAutoStart)
      .catch(console.error)
      .finally(() => setAutoStartLoading(false));
  }, []);

  const handleLanguageChange = (lang: Language) => {
    onChange(p => ({ ...p, language: lang }));
    onLanguageChange(lang);
  };

  const handleThemeChange = (mode: ThemeMode) => {
    onChange(p => ({ ...p, theme: mode }));
    applyTheme(mode);
  };

  const handleAutoStartToggle = async () => {
    const next = !autoStart;
    setAutoStart(next);
    try {
      await settingsApi.setAutostart(next);
    } catch (e) {
      console.error("设置开机自启失败:", e);
      setAutoStart(!next); // 回滚
    }
  };

  const A_THEME = A[accent];
  const themes: { key: ThemeMode; label: string; icon: React.ElementType }[] = [
    { key: "light", label: t.settings.general.themeLight, icon: Sun },
    { key: "dark", label: t.settings.general.themeDark, icon: Moon },
    { key: "system", label: t.settings.general.themeSystem, icon: SunMoon },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Header icon={Activity} title={t.settings.general.behavior} accent={accent} />
        <Card>
          <ToggleRow label={t.settings.general.minimizeToTray} note={t.settings.general.minimizeToTrayNote}
            on={settings.minimize_to_tray} accent={accent}
            onToggle={() => onChange(p => ({ ...p, minimize_to_tray: !p.minimize_to_tray }))} />
        </Card>
      </div>

      <div>
        <Header icon={Globe} title={t.settings.general.appearance} accent={accent} />
        <Card>
          <div className="px-4 py-3.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-foreground/90">{t.settings.general.language}</div>
                <div className="text-xs text-muted-foreground/50 mt-0.5">{t.settings.general.languageNote}</div>
              </div>
              <div className="flex gap-1.5 p-1 bg-card-hover rounded-lg">
                <button
                  onClick={() => handleLanguageChange("zh")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    currentLang === "zh"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-card-hover"
                  }`}
                >
                  中文
                </button>
                <button
                  onClick={() => handleLanguageChange("en")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    currentLang === "en"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-card-hover"
                  }`}
                >
                  English
                </button>
              </div>
            </div>
          </div>
          <div className="px-4 py-3.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-foreground/90">{t.settings.general.darkMode}</div>
                <div className="text-xs text-muted-foreground/50 mt-0.5">{t.settings.general.darkModeNote}</div>
              </div>
              <div className="flex gap-1 p-1 bg-card-hover rounded-lg">
                {themes.map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => handleThemeChange(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      settings.theme === key
                        ? `${A_THEME.btn} shadow-sm`
                        : "text-muted-foreground hover:text-foreground hover:bg-card-hover"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div>
        <Header icon={Monitor} title={t.settings.general.advanced} accent={accent} />
        <Card>
          <ToggleRow label={t.settings.general.autoStart} note={t.settings.general.autoStartNote} on={autoStart} accent={accent}
            onToggle={handleAutoStartToggle} disabled={autoStartLoading} />
        </Card>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Tab: 环境                                                         */
/* ================================================================== */

function Environment({ t }: {
  settings: AppSettings; onChange: React.Dispatch<React.SetStateAction<AppSettings>>;
  browse: (f: keyof AppSettings) => void; t: Translations; accent: Accent;
}) {
  return (
    <div className="space-y-6">
      <div className="p-8 rounded-xl border border-border bg-card text-center">
        <Cpu className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">
          {t.settings.environment.title}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-2">
          {t.settings.environment.comingSoon}
        </p>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Tab: 高级                                                         */
/* ================================================================== */

import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./Accordion";

function Advanced({ configDir, defaultConfigDir, onConfigDirChange, settings, onChange, t, accent }: {
  configDir: string; defaultConfigDir: string; onConfigDirChange: (dir: string) => void;
  settings: AppSettings; onChange: React.Dispatch<React.SetStateAction<AppSettings>>;
  t: Translations; accent: Accent;
}) {
  const [showLogViewer, setShowLogViewer] = useState(false);

  return (
    <>
    <Accordion defaultOpen={[]}>
      <AccordionItem>
        <AccordionTrigger
          value="directory"
          icon={<HardDrive className="w-5 h-5 text-emerald-500" />}
          title={t.settings.backup.configDir}
          description={t.settings.backup.configDirDesc}
        />
        <AccordionContent value="directory">
          <DirectorySection configDir={configDir} defaultConfigDir={defaultConfigDir} onConfigDirChange={onConfigDirChange} t={t} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem>
        <AccordionTrigger
          value="backup"
          icon={<Database className="w-5 h-5 text-blue-500" />}
          title={t.settings.backup.databaseBackup}
          description={t.settings.backup.databaseBackupDesc}
        />
        <AccordionContent value="backup">
          <DatabaseBackupSection settings={settings} onChange={onChange} t={t} accent={accent} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem>
        <AccordionTrigger
          value="logs"
          icon={<Activity className="w-5 h-5 text-amber-500" />}
          title={t.settings.advanced.logManagement}
          description={t.settings.advanced.logManagementDesc}
        />
        <AccordionContent value="logs">
          <LogRetentionSetting t={t} />
          <button
            onClick={() => setShowLogViewer(true)}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-border
              bg-card text-sm text-foreground hover:bg-card-hover transition-colors mt-3"
          >
            <Activity className="w-4 h-4 text-amber-500" />
            {t.settings.advanced.openLogViewer || "打开日志查看"}
          </button>
        </AccordionContent>
      </AccordionItem>
    </Accordion>

    {showLogViewer && <LogViewer onClose={() => setShowLogViewer(false)} />}
    </>
  );
}

/* ================================================================== */
/*  配置目录                                                          */
/* ================================================================== */

function DirectorySection({ configDir, defaultConfigDir, onConfigDirChange, t }: {
  configDir: string; defaultConfigDir: string; onConfigDirChange: (dir: string) => void;
  t: Translations;
}) {
  const [migrating, setMigrating] = useState(false);
  const [pendingDir, setPendingDir] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const displayDir = pendingDir ?? configDir;
  const hasPending = pendingDir !== null;

  useEffect(() => {
    if (!showSuccess) return;
    const timer = setTimeout(() => setShowSuccess(false), 3000);
    return () => clearTimeout(timer);
  }, [showSuccess]);

  const handleMigrate = async (newDir: string) => {
    setMigrating(true);
    setPendingDir(null);
    try {
      const { configApi } = await import("../lib/api");
      await configApi.migrateConfigDir(newDir);
      onConfigDirChange(newDir);
      setShowSuccess(true);
    } catch (e) {
      console.error("迁移配置目录失败:", e);
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input type="text" value={displayDir} readOnly
          className={`flex-1 h-10 px-3 rounded-lg border bg-card text-sm font-mono
            text-foreground placeholder:text-muted-foreground/40
            focus:outline-none transition-all
            ${hasPending ? "border-amber-500/40" : "border-border-subtle"}`} />
        <button onClick={async () => {
          const { open } = await import("@tauri-apps/plugin-dialog");
          const selected = await open({ directory: true, defaultPath: displayDir });
          if (typeof selected === "string" && selected && selected !== configDir) {
            setPendingDir(selected);
          }
        }} disabled={migrating}
          className="h-10 px-3 flex items-center justify-center gap-2 rounded-lg border border-border-subtle
            bg-card text-muted-foreground hover:text-foreground hover:bg-card-hover transition-colors text-sm disabled:opacity-50">
          <FolderOpen className="w-4 h-4" />
          {t.settings.backup.browse}
        </button>
        {configDir !== defaultConfigDir && !hasPending && (
          <button onClick={() => setPendingDir(defaultConfigDir)} disabled={migrating}
            className="h-10 px-3 flex items-center justify-center gap-2 rounded-lg border border-border-subtle
              bg-card text-muted-foreground hover:text-foreground hover:bg-card-hover transition-colors text-sm disabled:opacity-50">
            {t.settings.backup.resetDefault}
          </button>
        )}
        {hasPending && (
          <button onClick={() => handleMigrate(pendingDir!)} disabled={migrating}
            className="h-10 px-5 flex items-center justify-center gap-2 rounded-lg text-sm font-medium
              bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-50">
            <Save className="w-4 h-4" />
            {t.settings.backup.saveDir}
          </button>
        )}
      </div>
      {showSuccess && (
        <div className="flex items-center gap-2 text-sm text-emerald-500">
          <CheckCircle className="w-4 h-4" />
          {t.settings.backup.migrateSuccess}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  数据库备份                                                        */
/* ================================================================== */

import type { BackupInfo } from "../lib/api/config";

function DatabaseBackupSection({ settings, onChange, t }: {
  settings: AppSettings; onChange: React.Dispatch<React.SetStateAction<AppSettings>>;
  t: Translations; accent: Accent;
}) {
  const [error, setError] = useState<string | null>(null);

  // 手动备份
  const [manualBackups, setManualBackups] = useState<BackupInfo[]>([]);
  const [loadingManual, setLoadingManual] = useState(true);
  const [creatingManual, setCreatingManual] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [newBackupPath, setNewBackupPath] = useState<string | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [manualPage, setManualPage] = useState(1);
  const [autoPage, setAutoPage] = useState(1);
  const PAGE_SIZE = 5;

  // 自动备份
  const [autoBackups, setAutoBackups] = useState<BackupInfo[]>([]);
  const [loadingAuto, setLoadingAuto] = useState(true);

  // 加载数据
  useEffect(() => {
    loadManualBackups();
    loadAutoBackups();
  }, []);

  const loadManualBackups = async () => {
    try {
      const { configApi } = await import("../lib/api");
      const list = await configApi.getManualBackups();
      setManualBackups(list);
    } catch (e) {
      console.error("加载手动备份列表失败:", e);
    } finally {
      setLoadingManual(false);
    }
  };

  const loadAutoBackups = async () => {
    try {
      const { configApi } = await import("../lib/api");
      const list = await configApi.getAutoBackups();
      setAutoBackups(list);
    } catch (e) {
      console.error("加载自动备份列表失败:", e);
    } finally {
      setLoadingAuto(false);
    }
  };

  // 创建手动备份
  const handleCreateManualBackup = async () => {
    if (cooldown || creatingManual) return;

    setCreatingManual(true);
    setCooldown(true);
    setError(null);

    // 0.5秒防抖
    setTimeout(() => setCooldown(false), 500);

    try {
      const { configApi } = await import("../lib/api");
      const backup = await configApi.createManualBackup();

      setManualBackups(prev => [backup, ...prev]);
      setNewBackupPath(backup.path);
      setCreatingManual(false);

      setTimeout(() => {
        setNewBackupPath(null);
      }, 2000);
    } catch (e) {
      setError(`${e}`);
      setCreatingManual(false);
    }
  };

  // 恢复备份
  const handleRestoreBackup = async (path: string) => {
    if (!confirm(t.settings.backup.restoreConfirm)) return;
    setError(null);
    try {
      const { configApi } = await import("../lib/api");
      await configApi.restoreBackup(path);
      window.location.reload();
    } catch (e) {
      console.error("恢复失败:", e);
      setError(`${e}`);
    }
  };

  // 删除备份
  const handleDeleteBackup = async (path: string, isAuto: boolean) => {
    if (!confirm(t.settings.backup.deleteConfirm)) return;
    setError(null);
    try {
      const { configApi } = await import("../lib/api");
      await configApi.deleteBackup(path);
      if (isAuto) {
        setAutoBackups(prev => prev.filter(b => b.path !== path));
      } else {
        setManualBackups(prev => prev.filter(b => b.path !== path));
      }
    } catch (e) {
      setError(`${e}`);
    }
  };

  // 开始重命名
  const handleStartRename = (backup: BackupInfo) => {
    setRenamingPath(backup.path);
    setRenameValue(backup.name);
  };

  // 取消重命名
  const handleCancelRename = () => {
    setRenamingPath(null);
    setRenameValue("");
  };

  // 确认重命名
  const handleConfirmRename = async () => {
    if (!renamingPath || !renameValue.trim()) return;

    try {
      const { configApi } = await import("../lib/api");
      const newPath = await configApi.renameBackup(renamingPath, renameValue.trim());
      setManualBackups(prev => prev.map(b =>
        b.path === renamingPath
          ? { ...b, name: renameValue.trim(), path: newPath }
          : b
      ));
      setRenamingPath(null);
      setRenameValue("");
    } catch (e) {
      setError(`${e}`);
    }
  };

  // 保存自动备份配置（自动保存到 DB）
  const handleAutoBackupChange = (updates: Partial<AppSettings>) => {
    onChange(prev => ({ ...prev, ...updates }));
  };

  // 一键清空自动备份
  const handleClearAutoBackups = async () => {
    if (!confirm(t.settings.backup.clearAutoConfirm)) return;
    try {
      const { configApi } = await import("../lib/api");
      await configApi.clearAutoBackups();
      setAutoBackups([]);
    } catch (e) {
      setError(`${e}`);
    }
  };

  // 格式化文件大小
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // 渲染备份列表
  const renderBackupList = (backups: BackupInfo[], loading: boolean, isAuto: boolean) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
        </div>
      );
    }

    const showCreatingCard = !isAuto && creatingManual;
    const currentPage = isAuto ? autoPage : manualPage;
    const totalPages = Math.ceil(backups.length / PAGE_SIZE);
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const currentBackups = backups.slice(startIndex, endIndex);

    if (backups.length === 0 && !showCreatingCard) {
      return (
        <div className="py-8 text-center text-sm text-muted-foreground/50">
          {t.settings.backup.noBackups}
        </div>
      );
    }

    return (
      <div>
        <div className="divide-y divide-border">
          {/* 创建中的进度卡片 */}
          {showCreatingCard && currentPage === 1 && (
            <div className="px-4 py-3 relative overflow-hidden animate-backup-slide-in">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 animate-progress-pulse">
                  <Database className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground/70">{t.settings.backup.creating}</span>
                  {/* 不确定进度条 */}
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full w-1/3 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full animate-progress-indeterminate"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 现有备份列表 */}
          {currentBackups.map((backup) => {
            const isNew = backup.path === newBackupPath;
            const isRenaming = backup.path === renamingPath;
            return (
              <div
                key={backup.path}
                className={`flex items-center justify-between px-4 py-3 hover:bg-card-hover group transition-all duration-300 ${
                  isNew ? "animate-backup-slide-in border-l-2 border-l-emerald-500/60 bg-emerald-500/[0.03]" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  {isRenaming ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleConfirmRename();
                          if (e.key === 'Escape') handleCancelRename();
                        }}
                        className="flex-1 px-2 py-1 text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        autoFocus
                      />
                      <button
                        onClick={handleConfirmRename}
                        className="px-2 py-1 text-xs text-emerald-500 hover:bg-emerald-500/10 rounded"
                      >
                        {t.common.confirm}
                      </button>
                      <button
                        onClick={handleCancelRename}
                        className="px-2 py-1 text-xs text-muted-foreground hover:bg-muted rounded"
                      >
                        {t.common.cancel}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium truncate ${isNew ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                          {backup.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-muted-foreground">{formatSize(backup.size)}</span>
                        <span className="text-xs text-muted-foreground">{backup.created_at}</span>
                      </div>
                    </>
                  )}
                </div>
                {!isRenaming && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isAuto && (
                      <>
                        <button
                          onClick={() => handleStartRename(backup)}
                          className="px-2.5 py-1.5 text-xs text-amber-500 hover:bg-amber-500/10 rounded transition-colors"
                        >
                          {t.settings.backup.renameBackup}
                        </button>
                        <button
                          onClick={() => handleRestoreBackup(backup.path)}
                          className="px-2.5 py-1.5 text-xs text-blue-500 hover:bg-blue-500/10 rounded transition-colors"
                        >
                          {t.settings.backup.restoreBackup}
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(backup.path, false)}
                          className="px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-500/10 rounded transition-colors"
                        >
                          {t.settings.backup.deleteBackup}
                        </button>
                      </>
                    )}
                    {isAuto && (
                      <button
                        onClick={() => handleRestoreBackup(backup.path)}
                        className="px-2.5 py-1.5 text-xs text-blue-500 hover:bg-blue-500/10 rounded transition-colors"
                      >
                        {t.settings.backup.restoreBackup}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 分页控件 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {currentPage}/{totalPages} {t.settings.backup.page}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => isAuto ? setAutoPage(p => Math.max(1, p - 1)) : setManualPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {t.settings.backup.prevPage}
              </button>
              <button
                onClick={() => isAuto ? setAutoPage(p => Math.min(totalPages, p + 1)) : setManualPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {t.settings.backup.nextPage}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 自动备份 */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="p-4 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Database className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">{t.settings.backup.autoBackup}</div>
            </div>
            <span
              onClick={() => handleAutoBackupChange({ auto_backup_enabled: !settings.auto_backup_enabled })}
              role="switch"
              tabIndex={0}
              aria-checked={settings.auto_backup_enabled}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleAutoBackupChange({ auto_backup_enabled: !settings.auto_backup_enabled }); }}}
              className={`relative w-10 h-[22px] rounded-full transition-colors flex-shrink-0 cursor-pointer ${
                settings.auto_backup_enabled ? "bg-blue-500" : "bg-muted-foreground/20"
              }`}
            >
              <span
                className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  settings.auto_backup_enabled ? "translate-x-[20px]" : "translate-x-[3px]"
                }`}
              />
            </span>
          </div>
        </div>

        {settings.auto_backup_enabled && (
          <div className="divide-y divide-border">
            {/* 保留天数设置 */}
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t.settings.backup.keepDays}</span>
              <div className="flex gap-1.5">
                {[
                  { value: 3, label: t.settings.backup.keep3Days },
                  { value: 7, label: t.settings.backup.keep1Week },
                  { value: 30, label: t.settings.backup.keep1Month },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => handleAutoBackupChange({ auto_backup_keep_days: value })}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      settings.auto_backup_keep_days === value
                        ? "bg-blue-500 text-white"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 自动备份列表 */}
            {autoBackups.length > 0 && (
              <div>
                <div className="px-4 py-2 flex items-center justify-between bg-muted/20">
                  <span className="text-xs text-muted-foreground">
                    {autoBackups.length} {t.settings.backup.backupCount}
                  </span>
                  <button
                    onClick={handleClearAutoBackups}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground hover:text-red-500 hover:bg-red-500/5 rounded transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    {t.settings.backup.clearAll}
                  </button>
                </div>
                {renderBackupList(autoBackups, loadingAuto, true)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 手动备份 */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="p-4 bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Save className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">{t.settings.backup.manualBackup}</div>
            </div>
          </div>
          <button
            onClick={handleCreateManualBackup}
            disabled={creatingManual || cooldown}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 disabled:cursor-not-allowed ${
              creatingManual
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 animate-pulse"
                : cooldown
                  ? "bg-emerald-500/60 text-white/70"
                  : "bg-emerald-500 text-white hover:bg-emerald-600 hover:shadow-md"
            }`}
          >
            {creatingManual ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Save className="w-3 h-3" />
            )}
            {t.settings.backup.createBackup}
          </button>
        </div>

        {(manualBackups.length > 0 || creatingManual) && (
          <div>
            {manualBackups.length > 0 && (
              <div className="px-4 py-2 bg-muted/20">
                <span className="text-xs text-muted-foreground">
                  {manualBackups.length} {t.settings.backup.backupCount}
                </span>
              </div>
            )}
            {renderBackupList(manualBackups, loadingManual, false)}
          </div>
        )}

        {manualBackups.length === 0 && !loadingManual && !creatingManual && (
          <div className="px-4 py-8 text-center">
            <Save className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground/50">{t.settings.backup.noBackups}</p>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-sm text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Shared                                                            */
/* ================================================================== */

function Header({ icon: Icon, title, accent, className = "" }: {
  icon: React.ElementType; title: string; accent: Accent; className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 mb-3 ${className}`}>
      <Icon className={`w-4 h-4 ${A[accent].text}`} />
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">{title}</h3>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">{children}</div>;
}

function ToggleRow({ label, note, on, onToggle, accent, disabled = false }: {
  label: string; note: string; on: boolean; onToggle: () => void; accent: Accent; disabled?: boolean;
}) {
  const a = A[accent];
  return (
    <button onClick={onToggle} disabled={disabled}
      className="w-full flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-card-hover transition-all duration-200 text-left group disabled:opacity-50 disabled:cursor-not-allowed">
      <div className="min-w-0 pr-4">
        <div className="text-sm text-foreground/90 group-hover:text-foreground transition-colors">{label}</div>
        <div className="text-xs text-muted-foreground/50 mt-0.5">{note}</div>
      </div>
      <span className={`relative w-10 h-[22px] rounded-full transition-colors flex-shrink-0 ${on ? a.bg : "bg-muted-foreground/20"}`}>
        <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${on ? "translate-x-[20px]" : "translate-x-[3px]"}`} />
      </span>
    </button>
  );
}

/* ================================================================== */
/*  日志保留时间设置                                                    */
/* ================================================================== */

const LOG_RETENTION_OPTIONS = [
  { value: 3, key: "keep3Days" },
  { value: 7, key: "keep1Week" },
  { value: 30, key: "keep1Month" },
] as const;

function LogRetentionSetting({ t }: { t: Translations }) {
  const [retentionDays, setRetentionDays] = useState<number>(7);

  useEffect(() => {
    configApi.getLogRetentionDays().then(setRetentionDays).catch(console.error);
  }, []);

  const handleSet = async (days: number) => {
    try {
      await configApi.setLogRetentionDays(days);
      setRetentionDays(days);
    } catch (e) {
      console.error("设置日志保留天数失败:", e);
    }
  };

  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-card">
      <span className="text-xs text-muted-foreground">{t.settings.logs.retention}</span>
      <div className="flex gap-1.5">
        {LOG_RETENTION_OPTIONS.map(({ value, key }) => (
          <button
            key={value}
            onClick={() => handleSet(value)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              retentionDays === value
                ? "bg-emerald-500 text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.settings.logs[key]}
          </button>
        ))}
      </div>
    </div>
  );
}
