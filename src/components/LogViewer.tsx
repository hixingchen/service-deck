import { useState, useEffect, useRef } from "react";
import { RefreshCw, Search, X, Calendar, ChevronDown, Check, ArrowLeft } from "lucide-react";
import type { LogEntry } from "../lib/api/config";
import { configApi } from "../lib/api/config";
import { useI18n } from "../hooks/useI18n";

const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
type LogLevel = typeof LOG_LEVELS[number];

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "text-gray-400",
  info: "text-blue-500",
  warn: "text-amber-500",
  error: "text-red-500",
};

const LEVEL_DOT_COLORS: Record<LogLevel, string> = {
  debug: "bg-gray-400",
  info: "bg-blue-500",
  warn: "bg-amber-500",
  error: "bg-red-500",
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function highlightText(text: string, searchTerm: string): string {
  if (!searchTerm.trim()) return escapeHtml(text);
  const escapedHtml = escapeHtml(text);
  const escapedSearch = escapeHtml(searchTerm);
  const regex = new RegExp(`(${escapedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escapedHtml.replace(regex, '<mark style="background:rgba(251,191,36,0.2);color:#fcd34d;padding:1px 2px;border-radius:2px;border:1px solid rgba(251,191,36,0.3)">$1</mark>');
}

interface Props {
  onClose: () => void;
}

export function LogViewer({ onClose }: Props) {
  const { t } = useI18n();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [searchText, setSearchText] = useState<string>("");
  const [logLevel, setLogLevel] = useState<LogLevel>("info");
  const [showLevelDropdown, setShowLevelDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const levelDropdownRef = useRef<HTMLDivElement>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  const filteredLogs = logs.filter((log) => {
    const logLevelLower = log.level.toLowerCase() as LogLevel;
    const logPriority = LEVEL_PRIORITY[logLevelLower] ?? 1;
    if (logPriority < LEVEL_PRIORITY[logLevel]) return false;

    if (!searchText) return true;
    const text = searchText.toLowerCase();
    return (
      log.message.toLowerCase().includes(text) ||
      log.target.toLowerCase().includes(text)
    );
  });

  useEffect(() => {
    loadDates();
    loadLogLevel();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (levelDropdownRef.current && !levelDropdownRef.current.contains(e.target as Node)) {
        setShowLevelDropdown(false);
      }
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setShowDateDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    loadLogs();
  }, [selectedDate]);

  const loadDates = async () => {
    try {
      const dates = await configApi.getLogDates();
      setAvailableDates(dates);
      if (dates.length > 0 && !selectedDate) {
        setSelectedDate(dates[0]);
      }
    } catch (e) {
      console.error("加载日志日期失败:", e);
    }
  };

  const loadLogLevel = async () => {
    try {
      const level = await configApi.getLogLevel();
      setLogLevel(level as LogLevel);
    } catch (e) {
      console.error("加载日志级别失败:", e);
    }
  };

  const handleSetLogLevel = async (level: LogLevel) => {
    try {
      await configApi.setLogLevel(level);
      setLogLevel(level);
      setShowLevelDropdown(false);
    } catch (e) {
      console.error("设置日志级别失败:", e);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const entries = await configApi.getLogEntries(selectedDate || undefined, 1000);
      setLogs(entries);
    } catch (e) {
      console.error("加载日志失败:", e);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const time = timestamp.split(" ")[1] || timestamp;
    return time.substring(0, 8);
  };

  const getDateDisplayText = (date: string) => {
    if (!date) return t.settings.logs.noLogs;
    return date;
  };

  return (
    <div className="fixed inset-4 z-50 flex flex-col" style={{ top: '3.5rem' }}>
      <div className="relative flex flex-col h-full rounded-xl overflow-hidden
        bg-background border border-border
        shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
      >
        {/* 头部 */}
        <div className="flex-shrink-0 flex items-center h-12 px-3 border-b border-border">
          <button onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-card-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="ml-2 text-sm font-semibold text-foreground">{t.settings.advanced.logManagement}</h2>

          <div className="flex-1" />

          {/* 日志级别 */}
          <div className="relative mr-2" ref={levelDropdownRef}>
            <button
              onClick={() => setShowLevelDropdown(!showLevelDropdown)}
              className="h-7 px-2 flex items-center gap-1.5 rounded-lg border border-border text-xs text-foreground
                hover:bg-card-hover transition-colors"
            >
              <div className={`w-2 h-2 rounded-full ${LEVEL_DOT_COLORS[logLevel]}`} />
              <span className="uppercase">{logLevel}</span>
              <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${showLevelDropdown ? "rotate-180" : ""}`} />
            </button>

            {showLevelDropdown && (
              <div className="absolute top-full right-0 mt-1 w-32 py-1 rounded-lg border border-border bg-card shadow-lg z-50">
                {LOG_LEVELS.map((level) => (
                  <button
                    key={level}
                    onClick={() => handleSetLogLevel(level)}
                    className={`w-full px-3 py-1.5 flex items-center gap-2 text-sm hover:bg-card-hover transition-colors ${
                      level === logLevel ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${LEVEL_DOT_COLORS[level]}`} />
                    <span className="uppercase flex-1 text-left">{level}</span>
                    {level === logLevel && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 日期选择 */}
          <div className="relative mr-2" ref={dateDropdownRef}>
            <button
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              className="h-7 px-2 flex items-center gap-1.5 rounded-lg border border-border text-xs text-foreground
                hover:bg-card-hover transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="max-w-[100px] truncate">{getDateDisplayText(selectedDate)}</span>
              <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${showDateDropdown ? "rotate-180" : ""}`} />
            </button>

            {showDateDropdown && (
              <div className="absolute top-full right-0 mt-1 w-40 py-1 rounded-lg border border-border bg-card shadow-lg z-50 max-h-60 overflow-y-auto">
                {availableDates.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">{t.settings.logs.noLogs}</div>
                ) : (
                  availableDates.map((date) => (
                    <button
                      key={date}
                      onClick={() => {
                        setSelectedDate(date);
                        setShowDateDropdown(false);
                      }}
                      className={`w-full px-3 py-1.5 flex items-center gap-2 text-sm hover:bg-card-hover transition-colors ${
                        date === selectedDate ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="flex-1 text-left">{date}</span>
                      {date === selectedDate && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 搜索 */}
          <div className="relative w-44">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={t.settings.logs.search}
              className="h-7 w-full pl-7 pr-7 rounded-lg border border-border bg-background text-xs text-foreground placeholder-muted-foreground
                focus:outline-none focus:border-primary/50 transition-colors"
            />
            {searchText && (
              <button
                onClick={() => setSearchText("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* 刷新 */}
          <button
            onClick={loadLogs}
            title={t.settings.logs.refresh || "刷新"}
            className="h-7 w-7 ml-1.5 flex items-center justify-center rounded-lg border border-border
              text-muted-foreground hover:text-foreground hover:bg-card-hover transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 日志内容 */}
        <div
          ref={logContainerRef}
          className="flex-1 overflow-auto font-mono text-xs"
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {t.settings.logs.noLogs}
            </div>
          ) : (
            <div className="py-1">
              {filteredLogs.map((log, index) => {
                const level = log.level.toLowerCase() as LogLevel;
                const hasSearch = searchText.trim().length > 0;
                return (
                  <div
                    key={index}
                    className={`flex items-start gap-2 px-4 py-1.5 hover:bg-card-hover transition-colors ${
                      hasSearch ? "bg-yellow-500/[0.03] border-l-2 border-l-yellow-500/30" : ""
                    }`}
                  >
                    <span className="text-muted-foreground whitespace-nowrap select-none">
                      {formatTime(log.timestamp)}
                    </span>
                    <span
                      className={`font-semibold w-10 text-center uppercase select-none ${
                        LEVEL_COLORS[level] || "text-foreground"
                      }`}
                    >
                      {log.level.substring(0, 4)}
                    </span>
                    <span
                      className="text-muted-foreground w-24 truncate select-none"
                      title={log.target}
                      dangerouslySetInnerHTML={{ __html: highlightText(log.target, searchText) }}
                    />
                    <span
                      className="flex-1 break-all text-foreground/80"
                      dangerouslySetInnerHTML={{ __html: highlightText(log.message, searchText) }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
