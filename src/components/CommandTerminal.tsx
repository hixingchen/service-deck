import { useState } from "react";
import { Terminal, Loader2 } from "lucide-react";
import { terminalApi } from "../lib/api/terminal";
import { useI18n } from "../hooks/useI18n";

interface CommandTerminalProps {
  serviceName: string;
  servicePath: string;
  onClose: () => void;
}

export function CommandTerminal({ serviceName, servicePath, onClose }: CommandTerminalProps) {
  const { t } = useI18n();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenTerminal = async () => {
    setOpening(true);
    setError(null);
    try {
      await terminalApi.openSystemTerminal(servicePath);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[400px] bg-card rounded-xl border-[3px] border-border-subtle shadow-[0_0_0_2px_rgba(255,255,255,0.15),0_0_20px_rgba(0,0,0,0.3),0_25px_50px_-12px_rgba(0,0,0,0.6)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h3 className="text-base font-semibold text-foreground">{t.terminal.title}</h3>
          </div>
        </div>

        {/* 内容 */}
        <div className="p-5">
          <p className="text-sm text-muted-foreground mb-2">{t.terminal.serviceName}: <span className="text-foreground">{serviceName}</span></p>
          <p className="text-sm text-muted-foreground mb-4 font-mono">{t.terminal.path}: {servicePath}</p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={handleOpenTerminal}
            disabled={opening}
            className="w-full h-10 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {opening ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t.terminal.opening}
              </>
            ) : (
              <>
                <Terminal className="w-4 h-4" />
                {t.terminal.openButton}
              </>
            )}
          </button>

          <p className="text-xs text-muted-foreground mt-3 text-center">
            {t.terminal.hint}
          </p>
        </div>
      </div>
    </div>
  );
}
