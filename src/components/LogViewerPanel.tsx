import { useState, useRef, useEffect, useMemo } from "react";
import { ArrowLeft, Search, X, RotateCw, Square, Play } from "lucide-react";
import { useI18n } from "../hooks/useI18n";

// ANSI 颜色映射
const ANSI_COLORS: Record<string, string> = {
  "30": "#000000", "31": "#e74c3c", "32": "#2ecc71", "33": "#f39c12",
  "34": "#3498db", "35": "#9b59b6", "36": "#1abc9c", "37": "#ecf0f1",
  "90": "#95a5a6", "91": "#e74c3c", "92": "#2ecc71", "93": "#f39c12",
  "94": "#3498db", "95": "#9b59b6", "96": "#1abc9c", "97": "#ffffff",
  "40": "#000000", "41": "#e74c3c", "42": "#2ecc71", "43": "#f39c12",
  "44": "#3498db", "45": "#9b59b6", "46": "#1abc9c", "47": "#ecf0f1",
  "100": "#95a5a6", "101": "#e74c3c", "102": "#2ecc71", "103": "#f39c12",
  "104": "#3498db", "105": "#9b59b6", "106": "#1abc9c", "107": "#ffffff",
};

// 日志关键字着色配置
const LOG_LEVEL_COLORS: Record<string, { color: string; bg?: string; fontWeight?: string }> = {
  "ERROR": { color: "#f87171", fontWeight: "bold" },
  "FATAL": { color: "#f87171", fontWeight: "bold" },
  "CRITICAL": { color: "#f87171", fontWeight: "bold" },
  "PANIC": { color: "#f87171", fontWeight: "bold" },
  "EXCEPTION": { color: "#f87171", fontWeight: "bold" },
  "WARN": { color: "#fbbf24", fontWeight: "bold" },
  "WARNING": { color: "#fbbf24", fontWeight: "bold" },
  "INFO": { color: "#4ade80", fontWeight: "bold" },
  "INFORMATION": { color: "#4ade80", fontWeight: "bold" },
  "DEBUG": { color: "#60a5fa" },
  "TRACE": { color: "#94a3b8" },
  "VERBOSE": { color: "#94a3b8" },
  "SUCCESS": { color: "#34d399", fontWeight: "bold" },
  "OK": { color: "#34d399" },
  "DONE": { color: "#34d399" },
  "START": { color: "#60a5fa" },
  "STOP": { color: "#f87171" },
  "STARTED": { color: "#34d399" },
  "STOPPED": { color: "#f87171" },
  "FAILED": { color: "#f87171", fontWeight: "bold" },
  "ERR": { color: "#f87171", fontWeight: "bold" },
};

// 时间戳正则表达式
const TIMESTAMP_PATTERNS = [
  /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/,
  /\[\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?\]/,
  /\d{2}:\d{2}:\d{2}(?:\.\d+)?/,
  /[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}/,
];

// 解析 ANSI 转义码为 HTML
function ansiToHtml(text: string): string {
  if (text.includes('\x1b[')) {
    const regex = /\x1b\[([0-9;]*)m/g;
    let result = "";
    let lastIndex = 0;
    let currentStyles: string[] = [];

    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const textContent = text.slice(lastIndex, match.index);
        if (currentStyles.length > 0) {
          result += `<span style="${currentStyles.join(";")}">${escapeHtml(textContent)}</span>`;
        } else {
          result += escapeHtml(textContent);
        }
      }

      const params = match[1].split(";").map(Number);
      for (const param of params) {
        if (param === 0) {
          currentStyles = [];
        } else if (param === 1) {
          currentStyles.push("font-weight:bold");
        } else if (param === 2) {
          currentStyles.push("opacity:0.7");
        } else if (param === 3) {
          currentStyles.push("font-style:italic");
        } else if (param === 4) {
          currentStyles.push("text-decoration:underline");
        } else if (param >= 30 && param <= 37) {
          currentStyles = currentStyles.filter(s => !s.startsWith("color:"));
          currentStyles.push(`color:${ANSI_COLORS[String(param)]}`);
        } else if (param >= 90 && param <= 97) {
          currentStyles = currentStyles.filter(s => !s.startsWith("color:"));
          currentStyles.push(`color:${ANSI_COLORS[String(param)]}`);
        } else if (param >= 40 && param <= 47) {
          currentStyles = currentStyles.filter(s => !s.startsWith("background-color:"));
          currentStyles.push(`background-color:${ANSI_COLORS[String(param)]}`);
        } else if (param >= 100 && param <= 107) {
          currentStyles = currentStyles.filter(s => !s.startsWith("background-color:"));
          currentStyles.push(`background-color:${ANSI_COLORS[String(param)]}`);
        }
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      const textContent = text.slice(lastIndex);
      if (currentStyles.length > 0) {
        result += `<span style="${currentStyles.join(";")}">${escapeHtml(textContent)}</span>`;
      } else {
        result += escapeHtml(textContent);
      }
    }

    return result;
  }

  return smartColorize(text);
}

// 智能着色：为纯文本日志添加颜色
function smartColorize(text: string): string {
  if (!text.trim()) return escapeHtml(text);

  const placeholders: Array<{ id: string; html: string }> = [];
  let result = text;
  let placeholderId = 0;

  const addPlaceholder = (html: string): string => {
    const id = `__PH_${placeholderId++}__`;
    placeholders.push({ id, html });
    return id;
  };

  // URL
  result = result.replace(/(https?:\/\/[^\s<>"]+)/g, (match) => {
    return addPlaceholder(`<span style="color:#7dd3fc;text-decoration:underline">${escapeHtml(match)}</span>`);
  });

  // IP 地址
  result = result.replace(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?)\b/g, (match) => {
    return addPlaceholder(`<span style="color:#5eead4">${escapeHtml(match)}</span>`);
  });

  // 时间戳
  for (const pattern of TIMESTAMP_PATTERNS) {
    result = result.replace(pattern, (match) => {
      return addPlaceholder(`<span style="color:#94a3b8">${escapeHtml(match)}</span>`);
    });
  }

  // 日志级别
  const levelPattern = /\b(ERROR|FATAL|CRITICAL|PANIC|EXCEPTION|WARN(?:ING)?|INFO(?:RMATION)?|DEBUG|TRACE|VERBOSE|SUCCESS|OK|DONE|START(?:ED)?|STOP(?:PED)?|FAILED|ERR)\b/gi;
  result = result.replace(levelPattern, (match) => {
    const upperMatch = match.toUpperCase();
    const config = LOG_LEVEL_COLORS[upperMatch];
    if (config) {
      const styles = [`color:${config.color}`];
      if (config.fontWeight) styles.push(`font-weight:${config.fontWeight}`);
      return addPlaceholder(`<span style="${styles.join(";")}">${escapeHtml(match)}</span>`);
    }
    return match;
  });

  // 引号内容
  result = result.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (match) => {
    return addPlaceholder(`<span style="color:#fcd34d">${escapeHtml(match)}</span>`);
  });

  // 文件行号
  result = result.replace(/([a-zA-Z\/\\]+\.\w+:\d+)/g, (match) => {
    return addPlaceholder(`<span style="color:#c4b5fd">${escapeHtml(match)}</span>`);
  });

  // HTTP 状态码
  result = result.replace(/(status|http|response|code)\s*[:=]?\s*(2\d{2}|3\d{2}|4\d{2}|5\d{2})\b/gi, (match) => {
    return addPlaceholder(`<span style="color:#93c5fd">${escapeHtml(match)}</span>`);
  });

  // JSON 花括号
  result = result.replace(/([{}[\]])/g, (match) => {
    return addPlaceholder(`<span style="color:#64748b">${escapeHtml(match)}</span>`);
  });

  result = escapeHtml(result);

  for (const { id, html } of placeholders) {
    result = result.replace(id, html);
  }

  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface Props {
  serviceName: string;
  content: string;
  running?: boolean;
  onClose: () => void;
  onStart?: (name: string) => Promise<void>;
  onStop?: (name: string) => Promise<void>;
  onRestart?: (name: string) => Promise<void>;
}

// 高亮搜索关键词
function highlightSearchTerm(text: string, searchTerm: string): string {
  if (!searchTerm.trim()) return text;

  const escapedHtml = escapeHtml(text);
  const escapedSearch = escapeHtml(searchTerm);
  const escapedRegex = new RegExp(`(${escapedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');

  return escapedHtml.replace(escapedRegex, '<mark style="background:rgba(251,191,36,0.2);color:#fcd34d;padding:1px 3px;border-radius:3px;border:1px solid rgba(251,191,36,0.3)">$1</mark>');
}

// 从 <pre> 开头移除一行 DOM 节点（一个 <span> + 后续 \n 文本节点）
function removeFirstLineFromPre(pre: HTMLPreElement): void {
  while (pre.firstChild) {
    const node = pre.firstChild;

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      const nlIdx = text.indexOf('\n');
      if (nlIdx === 0) {
        // 开头就是换行 — 这是行分隔符，移除后结束
        node.textContent = text.length > 1 ? text.slice(1) : '';
        if (!node.textContent) pre.removeChild(node);
        break;
      } else if (nlIdx > 0) {
        // 换行在中间 — 截掉前面部分，保留后面
        node.textContent = text.slice(nlIdx + 1);
        break;
      }
      // 无换行 — 整个文本节点属于当前行，移除继续
      pre.removeChild(node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // <span> 等元素节点，直接移除
      pre.removeChild(node);
    } else {
      pre.removeChild(node);
    }
  }
}

const MAX_LOG_LINES = 1000;

export function LogViewerPanel({ serviceName, content, running = false, onClose, onStart, onStop, onRestart }: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [clearOffset, setClearOffset] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const pausedRef = useRef(false);
  const isFirstLoad = useRef(true);
  const renderedLengthRef = useRef(0);
  const lineBufferRef = useRef<string[]>([]);

  const handleClear = () => {
    setClearOffset(content.length);
    renderedLengthRef.current = 0;
    lineBufferRef.current = [];
    if (preRef.current) {
      preRef.current.innerHTML = '';
    }
  };

  const rawContent = clearOffset !== null ? content.slice(clearOffset) : content;
  const isSearchActive = searchTerm.trim().length > 0;

  // 计算过滤后的行（仅搜索时用于全量渲染）
  const filteredLines = useMemo(() => {
    if (!isSearchActive) return null;
    return rawContent.split('\n').filter(line =>
      line.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [rawContent, isSearchActive, searchTerm]);

  // DOM 更新：追加模式 + 行数限制
  useEffect(() => {
    if (!preRef.current) return;

    if (isSearchActive) {
      // 搜索模式：全量渲染高亮结果（不限行数，搜索结果通常较少）
      const html = filteredLines!.map(line => {
        const htmlLine = ansiToHtml(line);
        return highlightSearchTerm(htmlLine, searchTerm);
      }).join('\n');
      preRef.current.innerHTML = html;
      lineBufferRef.current = filteredLines!;
      renderedLengthRef.current = 0;
    } else if (lineBufferRef.current.length === 0 && rawContent.trim()) {
      // 首次渲染或清屏后：全量渲染，截取最后 MAX_LOG_LINES 行
      const lines = rawContent.split('\n');
      const trimmed = lines.slice(-MAX_LOG_LINES);
      lineBufferRef.current = trimmed;
      preRef.current.innerHTML = trimmed.map(ansiToHtml).join('\n');
      renderedLengthRef.current = rawContent.length;
    } else if (rawContent.length > renderedLengthRef.current) {
      // 追加模式：只处理新增内容
      const newContent = rawContent.slice(renderedLengthRef.current);
      if (newContent) {
        const newLines = newContent.split('\n');
        lineBufferRef.current.push(...newLines);

        // 超出限制时裁剪旧 DOM 节点
        while (lineBufferRef.current.length > MAX_LOG_LINES) {
          lineBufferRef.current.shift();
          removeFirstLineFromPre(preRef.current);
        }

        // 追加新内容到 DOM
        const html = newLines.map(ansiToHtml).join('\n');
        preRef.current.insertAdjacentHTML('beforeend', '\n' + html);
        renderedLengthRef.current = rawContent.length;
      }
    }

    // 滚动到底部
    if (!pausedRef.current && logEndRef.current) {
      logEndRef.current.scrollIntoView({
        behavior: isFirstLoad.current ? "instant" : "smooth"
      });
      isFirstLoad.current = false;
    }
  }, [rawContent, isSearchActive, filteredLines, searchTerm]);

  // 退出搜索时重置缓冲区，触发下次全量重建
  useEffect(() => {
    if (!isSearchActive) {
      renderedLengthRef.current = 0;
      lineBufferRef.current = [];
    }
  }, [isSearchActive]);

  const handlePauseToggle = () => {
    setPaused(prev => {
      const next = !prev;
      pausedRef.current = next;
      if (!next && logEndRef.current) {
        setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "instant" }), 50);
      }
      return next;
    });
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
          <h2 className="ml-2 text-sm font-semibold text-foreground">{serviceName}</h2>
          {running && (
            <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              {t.service.status.running}
            </span>
          )}

          <div className="flex-1" />

          {/* 搜索框 */}
          <div className="relative h-7 w-44 mr-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.log.title + "..."}
              className="w-full h-full pl-7 pr-7 rounded-lg bg-card border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* 服务控制按钮 */}
          <div className="flex items-center gap-1.5 mr-2">
            {running ? (
              <>
                <button
                  onClick={async () => {
                    if (!onRestart) return;
                    setLoading(true);
                    try { await onRestart(serviceName); }
                    catch (e) { console.error("重启服务失败:", e); }
                    finally { setLoading(false); }
                  }}
                  disabled={loading || !onRestart}
                  className="h-7 px-2.5 flex items-center gap-1 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border hover:bg-card-hover transition-colors disabled:opacity-50"
                  title={t.service.action.restart}
                >
                  <RotateCw className="w-3 h-3" />
                  {t.service.action.restart}
                </button>
                <button
                  onClick={async () => {
                    if (!onStop) return;
                    setLoading(true);
                    try { await onStop(serviceName); }
                    catch (e) { console.error("停止服务失败:", e); }
                    finally { setLoading(false); }
                  }}
                  disabled={loading || !onStop}
                  className="h-7 px-2.5 flex items-center gap-1 rounded-lg text-xs text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  title={t.service.action.stop}
                >
                  <Square className="w-3 h-3" />
                  {t.service.action.stop}
                </button>
              </>
            ) : (
              <button
                onClick={async () => {
                  if (!onStart) return;
                  setLoading(true);
                  try { await onStart(serviceName); }
                  catch (e) { console.error("启动服务失败:", e); }
                  finally { setLoading(false); }
                }}
                disabled={loading || !onStart}
                className="h-7 px-2.5 flex items-center gap-1 rounded-lg text-xs text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                title={t.service.action.start}
              >
                <Play className="w-3 h-3" />
                {t.service.action.start}
              </button>
            )}
          </div>

          <button onClick={handleClear}
            className="h-7 px-2.5 flex items-center gap-1 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border hover:bg-card-hover transition-colors"
          >
            {t.log.clearScreen}
          </button>
          <button onClick={handlePauseToggle}
            className={`h-7 px-2.5 ml-1.5 flex items-center gap-1 rounded-lg text-xs transition-colors ${
              paused
                ? "border border-yellow-500/30 text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20"
                : "border border-border text-muted-foreground hover:text-foreground hover:bg-card-hover"
            }`}
          >
            {paused ? t.log.resume : t.log.pause}
          </button>
        </div>

        {/* 日志内容 */}
        <div
          ref={logContainerRef}
          className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[13px] leading-relaxed"
        >
          {rawContent.trim() || isSearchActive ? (
            <>
              <pre
                ref={preRef}
                className="text-foreground/80 whitespace-pre-wrap break-all"
              />
              {/* 搜索无结果提示 */}
              {isSearchActive && filteredLines && filteredLines.length === 0 && (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <p className="text-sm">{t.selectService.noResults}</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p className="text-sm">
                {clearOffset !== null ? t.log.clear : t.log.noLogs}
              </p>
            </div>
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
