import { useState, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { ArrowLeft, FolderOpen, Eye, EyeOff, Zap, MessageSquare, X } from "lucide-react";
import { FormField } from "./FormField";
import { FormFooter } from "./FormFooter";
import type { WatchMode } from "../types";
import { useI18n } from "../hooks/useI18n";

interface Props {
  title: string;
  name: string;
  command: string;
  path: string;
  watchMode: WatchMode;
  watchPath: string;
  watchInclude: string[];
  watchExclude: string[];
  onNameChange: (v: string) => void;
  onCommandChange: (v: string) => void;
  onPathChange: (v: string) => void;
  onWatchModeChange: (v: WatchMode) => void;
  onWatchPathChange: (v: string) => void;
  onWatchIncludeChange: (v: string[]) => void;
  onWatchExcludeChange: (v: string[]) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
}

export function ServiceFormModal({
  title,
  name,
  command,
  path,
  watchMode,
  watchPath,
  watchInclude,
  watchExclude,
  onNameChange,
  onCommandChange,
  onPathChange,
  onWatchModeChange,
  onWatchPathChange,
  onWatchIncludeChange,
  onWatchExcludeChange,
  onClose,
  onSubmit,
  submitLabel,
}: Props) {
  const { t } = useI18n();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showWatchConfig, setShowWatchConfig] = useState(watchMode !== "off");

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = t.service.form.nameRequired;
    if (!command.trim()) newErrors.command = t.service.form.commandRequired;
    if (!path.trim()) newErrors.path = t.service.form.pathRequired;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) onSubmit();
  };

  const handleWatchModeChange = (mode: WatchMode) => {
    onWatchModeChange(mode);
    setShowWatchConfig(mode !== "off");
    // 如果切换到开启状态且监听目录为空，自动使用启动目录
    if (mode !== "off" && !watchPath) {
      onWatchPathChange(path);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl max-h-[90vh] rounded-2xl border-[3px] border-white/30 bg-card shadow-[0_0_0_2px_rgba(255,255,255,0.15),0_0_20px_rgba(0,0,0,0.3),0_25px_50px_-12px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3.5 border-b border-border/50">
          <button onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
        </div>

        {/* 表单内容 */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-5">
          <FormField label={t.service.name} placeholder={t.service.form.namePlaceholder} value={name} onChange={(v) => { onNameChange(v); if (errors.name) setErrors(e => ({ ...e, name: "" })); }} />
          {errors.name && <p className="text-sm text-red-400 -mt-3">{errors.name}</p>}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t.service.path}</label>
            <div className="flex gap-2">
              <input
                placeholder={t.service.form.pathPlaceholder}
                value={path}
                onChange={(e) => { onPathChange(e.target.value); if (errors.path) setErrors(er => ({ ...er, path: "" })); }}
                className={`flex-1 px-3 py-2.5 rounded-xl bg-card border text-foreground placeholder-muted-foreground focus:outline-none focus:border-blue-500/50 text-sm ${
                  errors.path ? "border-red-500/50" : "border-border"
                }`}
              />
              <button
                type="button"
                onClick={async () => {
                  const selected = await open({ directory: true, title: t.service.form.selectPath });
                  if (selected) {
                    onPathChange(selected as string);
                    if (errors.path) setErrors(er => ({ ...er, path: "" }));
                  }
                }}
                className="h-10 w-10 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-card-hover transition-colors flex-shrink-0"
                title={t.settings.environment.browse}
              >
                <FolderOpen className="w-4 h-4" />
              </button>
            </div>
            {errors.path && <p className="text-sm text-red-400 mt-1">{errors.path}</p>}
          </div>

          {/* 启动命令 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t.service.command}</label>
            <input
              placeholder={t.service.form.commandPlaceholder}
              value={command}
              onChange={(e) => { onCommandChange(e.target.value); if (errors.command) setErrors(er => ({ ...er, command: "" })); }}
              className={`w-full px-3 py-2.5 rounded-xl bg-card border text-foreground placeholder-muted-foreground focus:outline-none focus:border-blue-500/50 text-sm font-mono ${
                errors.command ? "border-red-500/50" : "border-border"
              }`}
            />
            {errors.command && <p className="text-sm text-red-400 mt-1">{errors.command}</p>}
          </div>

          {/* 文件监听配置 */}
          <div className="border-t border-border pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-muted-foreground" />
                <label className="text-sm font-medium text-foreground">{t.service.watch.title}</label>
              </div>
              <button
                type="button"
                onClick={() => setShowWatchConfig(!showWatchConfig)}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                {showWatchConfig ? t.service.watch.collapse : t.service.watch.expand}
              </button>
            </div>

            {showWatchConfig && (
              <div className="space-y-4">
                {/* 监听模式 */}
                <div>
                  <label className="block text-sm text-gray-500 mb-2">{t.service.watch.mode}</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleWatchModeChange("off")}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                        watchMode === "off"
                          ? "border-gray-500/50 bg-gray-500/10 text-gray-300"
                          : "border-border text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      {t.service.watch.off}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleWatchModeChange("auto")}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                        watchMode === "auto"
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                          : "border-border text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {t.service.watch.auto}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleWatchModeChange("confirm")}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                        watchMode === "confirm"
                          ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-400"
                          : "border-border text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {t.service.watch.confirm}
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {watchMode === "off" && t.service.watch.offDesc}
                    {watchMode === "auto" && t.service.watch.autoDesc}
                    {watchMode === "confirm" && t.service.watch.confirmDesc}
                  </p>
                </div>

                {/* 监听目录 */}
                {watchMode !== "off" && (
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">{t.service.watch.watchPath}</label>
                    <div className="flex gap-2">
                      <input
                        placeholder={t.service.watch.watchPathPlaceholder}
                        value={watchPath}
                        onChange={(e) => onWatchPathChange(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-blue-500/50 text-sm"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const selected = await open({ directory: true, title: t.service.watch.watchPath });
                          if (selected) onWatchPathChange(selected as string);
                        }}
                        className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-card-hover transition-colors flex-shrink-0"
                        title={t.settings.environment.browse}
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {watchPath === path ? t.service.watch.watchPathSame : t.service.watch.watchPathCustom}
                    </p>
                  </div>
                )}

                {/* 监听文件类型 */}
                {watchMode !== "off" && (
                  <TagInput
                    label={t.service.watch.include}
                    tags={watchInclude}
                    onChange={onWatchIncludeChange}
                    placeholder={t.service.watch.includePlaceholder}
                  />
                )}

                {/* 排除目录 */}
                {watchMode !== "off" && (
                  <TagInput
                    label={t.service.watch.exclude}
                    tags={watchExclude}
                    onChange={onWatchExcludeChange}
                    placeholder={t.service.watch.excludePlaceholder}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

        {/* 底部按钮 */}
        <FormFooter onClose={onClose} onSubmit={handleSubmit} submitLabel={submitLabel} />
      </div>
    </div>
  );
}

/* ================================================================== */
/*  标签输入组件                                                        */
/* ================================================================== */

function TagInput({ label, tags, onChange, placeholder }: {
  label: string;
  tags: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue("");
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const handleInputBlur = () => {
    if (inputValue.trim()) addTag(inputValue);
  };

  return (
    <div>
      <label className="block text-sm text-muted-foreground mb-2">{label}</label>

      {/* 标签 + 输入框 */}
      <div
        className="flex flex-wrap items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-lg bg-card border border-border
          focus-within:border-blue-500/50 transition-colors cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-xs border border-blue-500/20"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
              className="hover:text-blue-200 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleInputBlur}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[60px] bg-transparent text-sm text-foreground placeholder-muted-foreground focus:outline-none"
        />
      </div>
    </div>
  );
}
