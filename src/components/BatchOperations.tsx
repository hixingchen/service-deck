import { useState } from "react";
import { Play, Square, RotateCw, Loader2 } from "lucide-react";
import type { Service } from "../types";
import { useI18n } from "../hooks/useI18n";

interface BatchOperationsProps {
  services: Service[];
  runningServices: string[];
  onStartSelected: (serviceNames: string[]) => Promise<void>;
  onStopSelected: (serviceNames: string[]) => Promise<void>;
  onRestartSelected?: (serviceNames: string[]) => Promise<void>;
  onClose: () => void;
}

export function BatchOperations({
  services,
  runningServices,
  onStartSelected,
  onStopSelected,
  onRestartSelected,
  onClose,
}: BatchOperationsProps) {
  const { t } = useI18n();
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const toggleService = (name: string) => {
    setSelectedServices(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const selectAll    = () => setSelectedServices(new Set(services.map(s => s.name)));
  const selectNone   = () => setSelectedServices(new Set());
  const selectRunning = () => setSelectedServices(new Set(services.filter(s => runningServices.includes(s.name)).map(s => s.name)));
  const selectStopped = () => setSelectedServices(new Set(services.filter(s => !runningServices.includes(s.name)).map(s => s.name)));

  const act = async (fn: (names: string[]) => Promise<void>) => {
    const names = Array.from(selectedServices);
    if (names.length === 0) return;
    setLoading(true);
    try { await fn(names); onClose(); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg mx-4 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50">
          <h3 className="text-base font-semibold text-foreground">{t.batch.title}</h3>
          <button onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            ✕
          </button>
        </div>

        {/* 快速选择 */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border/50 text-sm">
          <button onClick={selectAll} className="text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t.batch.selectAll}</button>
          <button onClick={selectNone} className="text-muted-foreground hover:text-foreground transition-colors">{t.batch.deselectAll}</button>
          <button onClick={selectRunning} className="text-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">{t.batch.selectRunning}</button>
          <button onClick={selectStopped} className="text-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">{t.batch.selectStopped}</button>
          <span className="text-muted-foreground ml-auto">{t.batch.selectedCount.replace("{count}", String(selectedServices.size))}</span>
        </div>

        {/* 服务列表 */}
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-1.5">
            {services.map(service => {
              const running = runningServices.includes(service.name);
              const checked = selectedServices.has(service.name);
              return (
                <div
                  key={service.id}
                  onClick={() => toggleService(service.name)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200
                    ${checked ? "bg-blue-500/10 border border-blue-500/40 ring-1 ring-blue-500/20" : "bg-card border border-border hover:bg-card-hover hover:border-border-subtle"}`}
                >
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border transition-all duration-200 cursor-pointer ${
                    checked
                      ? "bg-blue-500 border-blue-500"
                      : "bg-background border-border hover:border-foreground/30"
                  }`}>
                    {checked && (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground">{service.name}</div>
                    <div className="text-sm text-muted-foreground font-mono mt-0.5 truncate">{service.command}</div>
                  </div>
                  <span className={`flex-shrink-0 px-2 py-0.5 rounded-md text-xs font-medium ${
                    running
                      ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                      : "text-muted-foreground bg-muted"
                  }`}>
                    {running ? t.service.status.running : t.service.status.stopped}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-t border-border/50">
          <button onClick={() => act(onStartSelected)} disabled={selectedServices.size === 0 || loading}
            className="flex-1 h-9 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {t.batch.start}
          </button>
          <button onClick={() => act(onStopSelected)} disabled={selectedServices.size === 0 || loading}
            className="flex-1 h-9 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
            {t.batch.stop}
          </button>
          {onRestartSelected && (
            <button onClick={() => act(onRestartSelected)} disabled={selectedServices.size === 0 || loading}
              className="flex-1 h-9 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
              {t.batch.restart}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
