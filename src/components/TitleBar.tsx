import { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Rocket, Minus, X, Square, Minimize2 } from "lucide-react";
import { useI18n } from "../hooks/useI18n";

export function TitleBar() {
  const { t } = useI18n();
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindowRef = useRef(getCurrentWindow());
  const appWindow = appWindowRef.current;

  useEffect(() => {
    appWindow.isMaximized().then(setIsMaximized);
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized);
    });
    return () => { unlisten.then(fn => fn()); };
  }, [appWindow]);

  return (
    <header data-tauri-drag-region className="h-12 flex items-center px-4 bg-background select-none shrink-0">
      <div className="flex items-center gap-2.5" data-tauri-no-drag>
        <div className="w-7 h-7 rounded-md bg-blue-500/20 flex items-center justify-center">
          <Rocket className="w-4 h-4 text-blue-400" />
        </div>
        <span className="text-sm font-semibold text-foreground">Service Deck</span>
      </div>
      <div className="flex-1" data-tauri-drag-region />
      <div className="flex items-center" data-tauri-no-drag>
        <button onClick={() => appWindow.minimize()} className="w-11 h-8 flex items-center justify-center hover:bg-card-hover transition-colors" title={t.titleBar.minimize}>
          <Minus className="w-4 h-4 text-muted-foreground" />
        </button>
        <button onClick={() => appWindow.toggleMaximize()} className="w-11 h-8 flex items-center justify-center hover:bg-card-hover transition-colors" title={isMaximized ? t.titleBar.restore : t.titleBar.maximize}>
          {isMaximized ? <Minimize2 className="w-4 h-4 text-muted-foreground" /> : <Square className="w-4 h-4 text-muted-foreground" />}
        </button>
        <button onClick={() => appWindow.close()} className="w-11 h-8 flex items-center justify-center hover:bg-red-500/80 transition-colors group" title={t.titleBar.close}>
          <X className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
        </button>
      </div>
    </header>
  );
}
