import { useState, useRef, useEffect } from "react";
import { ArrowLeft } from "lucide-react";

interface Props {
  serviceName: string;
  content: string;
  onClose: () => void;
}

export function LogViewerPanel({ serviceName, content, onClose }: Props) {
  const [clearOffset, setClearOffset] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  // 清屏：记录当前内容长度，之后只显示新增部分
  const handleClear = () => {
    setClearOffset(content.length);
  };

  // 实际显示的内容
  const displayContent = clearOffset !== null ? content.slice(clearOffset) : content;

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
        <span className="ml-2 text-[12px] text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded">运行中</span>
        <div className="flex-1" />
        <button onClick={handleClear}
          className="h-8 px-3 flex items-center gap-1.5 rounded-lg border border-white/[0.08] text-gray-400 hover:bg-white/[0.06] hover:text-white transition-colors text-[12px]"
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
