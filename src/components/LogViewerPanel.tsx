import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Search, X, RotateCw, Square, Play } from "lucide-react";

interface Props {
  serviceName: string;
  content: string;
  running?: boolean;
  onClose: () => void;
  onStart?: (name: string) => Promise<void>;
  onStop?: (name: string) => Promise<void>;
  onRestart?: (name: string) => Promise<void>;
}

export function LogViewerPanel({ serviceName, content, running = false, onClose, onStart, onStop, onRestart }: Props) {
  const [loading, setLoading] = useState(false);
  const [clearOffset, setClearOffset] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  // 清屏：记录当前内容长度，之后只显示新增部分
  const handleClear = () => {
    setClearOffset(content.length);
  };

  // 实际显示的内容
  const rawContent = clearOffset !== null ? content.slice(clearOffset) : content;

  // 搜索过滤
  const displayContent = searchTerm.trim()
    ? rawContent.split('\n').filter(line => line.toLowerCase().includes(searchTerm.toLowerCase())).join('\n')
    : rawContent;

  // 内容变化时自动滚到底部（未暂停时）
  useEffect(() => {
    if (!pausedRef.current && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [displayContent]);

  // 暂停状态同步到 ref
  const handlePauseToggle = () => {
    setPaused(prev => {
      const next = !prev;
      pausedRef.current = next;
      // 取消暂停时立即滚到底部
      if (!next && logEndRef.current) {
        setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
      return next;
    });
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#0a0a0f]" style={{ top: '2.75rem' }}>
      {/* 头部 */}
      <div className="flex-shrink-0 flex items-center h-14 px-4 border-b border-white/[0.06]">
        <button onClick={onClose}
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-white/[0.08] hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </button>
        <h2 className="ml-3 text-[15px] font-semibold text-white/90">{serviceName}</h2>
        {running && (
          <span className="ml-2 text-[12px] text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded">运行中</span>
        )}
        <div className="flex-1" />
        {/* 服务控制按钮 */}
        <div className="flex items-center gap-2 mr-2">
          {running ? (
            <>
              <button
                onClick={async () => {
                  if (!onRestart) return;
                  setLoading(true);
                  try {
                    await onRestart(serviceName);
                  } catch (e) {
                    console.error("重启服务失败:", e);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading || !onRestart}
                className="h-8 px-3 flex items-center gap-1.5 rounded-lg border border-white/[0.08] text-blue-400 hover:bg-blue-500/10 transition-colors text-[12px] disabled:opacity-50"
                title="重启服务"
              >
                <RotateCw className="w-3.5 h-3.5" />
                重启
              </button>
              <button
                onClick={async () => {
                  if (!onStop) return;
                  setLoading(true);
                  try {
                    await onStop(serviceName);
                  } catch (e) {
                    console.error("停止服务失败:", e);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading || !onStop}
                className="h-8 px-3 flex items-center gap-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors text-[12px] disabled:opacity-50"
                title="停止服务"
              >
                <Square className="w-3.5 h-3.5" />
                停止
              </button>
            </>
          ) : (
            <button
              onClick={async () => {
                if (!onStart) return;
                setLoading(true);
                try {
                  await onStart(serviceName);
                } catch (e) {
                  console.error("启动服务失败:", e);
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading || !onStart}
              className="h-8 px-3 flex items-center gap-1.5 rounded-lg border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 transition-colors text-[12px] disabled:opacity-50"
              title="启动服务"
            >
              <Play className="w-3.5 h-3.5" />
              启动
            </button>
          )}
        </div>
        {/* 搜索框 */}
        <div className="relative h-8 w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索日志..."
            className="w-full h-full pl-8 pr-7 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/90 placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <button onClick={handleClear}
          className="h-8 px-3 ml-2 flex items-center gap-1.5 rounded-lg border border-white/[0.08] text-gray-400 hover:bg-white/[0.06] hover:text-white transition-colors text-[12px]"
        >
          清屏
        </button>
        <button onClick={handlePauseToggle}
          className={`h-8 px-3 ml-2 flex items-center gap-1.5 rounded-lg border text-[12px] transition-colors ${
            paused
              ? "border-yellow-500/30 text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20"
              : "border-white/[0.08] text-gray-400 hover:bg-white/[0.06] hover:text-white"
          }`}
        >
          {paused ? "继续" : "暂停"}
        </button>
      </div>

      {/* 日志内容 */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-[12px] leading-relaxed">
        {displayContent ? (
          <pre className="text-gray-300 whitespace-pre-wrap break-all">
            {displayContent}
            <div ref={logEndRef} />
          </pre>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p className="text-[13px]">{clearOffset !== null ? "已清屏，新日志将在此显示" : "暂无日志输出"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
