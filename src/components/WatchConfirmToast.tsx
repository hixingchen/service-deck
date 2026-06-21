import { useState, useEffect } from "react";
import { AlertTriangle, RotateCw, X } from "lucide-react";
import { useI18n } from "../hooks/useI18n";

interface WatchEvent {
  serviceName: string;
  changedFiles: string[];
  timestamp: number;
}

interface Props {
  events: WatchEvent[];
  onConfirm: (serviceName: string) => void;
  onDismiss: (serviceName: string) => void;
}

export function WatchConfirmToast({ events, onConfirm, onDismiss }: Props) {
  if (events.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 max-w-sm">
      {events.map((event) => (
        <WatchToastItem
          key={event.serviceName}
          event={event}
          onConfirm={onConfirm}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}

function WatchToastItem({
  event,
  onConfirm,
  onDismiss,
}: {
  event: WatchEvent;
  onConfirm: (name: string) => void;
  onDismiss: (name: string) => void;
}) {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // 自动折叠：5秒后自动折叠（不消失）
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExpanded(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [event.timestamp]);

  if (!isVisible) return null;

  return (
    <div className="animate-in slide-in-from-right-5 duration-300">
      <div className="bg-[#1a1a2e] border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* 头部 - 始终显示 */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 rounded-lg bg-yellow-500/15 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/90 truncate">
              {event.serviceName}
            </p>
            <p className="text-sm text-gray-500">
              {t.watchConfirm.message}
            </p>
          </div>
          <button
            onClick={() => onDismiss(event.serviceName)}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/[0.06] transition-colors flex-shrink-0"
          >
            <X className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>

        {/* 展开的文件列表 */}
        {isExpanded && (
          <div className="px-4 pb-3">
            <div className="max-h-[80px] overflow-y-auto rounded-lg bg-white/[0.03] border border-border p-2">
              {event.changedFiles.slice(0, 5).map((file, index) => (
                <div key={index} className="text-sm text-gray-500 font-mono py-0.5 truncate">
                  {file}
                </div>
              ))}
              {event.changedFiles.length > 5 && (
                <div className="text-sm text-gray-600 py-0.5">
                  {t.watchConfirm.moreFiles.replace("{count}", String(event.changedFiles.length - 5))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 px-4 pb-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-1 h-7 rounded-lg border border-border text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors text-sm"
          >
            {isExpanded ? t.service.watch.collapse : t.service.watch.expand}
          </button>
          <button
            onClick={() => {
              onConfirm(event.serviceName);
              setIsVisible(false);
            }}
            className="flex-1 h-7 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors text-sm flex items-center justify-center gap-1"
          >
            <RotateCw className="w-3 h-3" />
            {t.watchConfirm.restart}
          </button>
        </div>
      </div>
    </div>
  );
}
