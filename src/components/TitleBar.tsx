import { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Rocket, Minus, X, Maximize2, Copy } from "lucide-react";

export function TitleBar() {
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
    <header data-tauri-drag-region className="h-11 flex items-center px-4 bg-[#0a0a0f] select-none shrink-0 border-b border-white/[0.06]">
      <div className="flex items-center gap-2.5" data-tauri-no-drag>
        <div className="w-6 h-6 rounded-md bg-blue-500/20 flex items-center justify-center">
          <Rocket className="w-3.5 h-3.5 text-blue-400" />
        </div>
        <span className="text-[13px] font-semibold text-white/80">Service Deck</span>
      </div>
      <div className="flex-1" data-tauri-drag-region />
      <div className="flex items-center" data-tauri-no-drag>
        <button onClick={() => appWindow.minimize()} className="w-11 h-8 flex items-center justify-center hover:bg-white/[0.06] transition-colors" title="最小化">
          <Minus className="w-4 h-4 text-gray-500" />
        </button>
        <button onClick={() => appWindow.toggleMaximize()} className="w-11 h-8 flex items-center justify-center hover:bg-white/[0.06] transition-colors" title={isMaximized ? "还原" : "最大化"}>
          {isMaximized ? <Copy className="w-3.5 h-3.5 text-gray-500" /> : <Maximize2 className="w-3.5 h-3.5 text-gray-500" />}
        </button>
        <button onClick={() => appWindow.close()} className="w-11 h-8 flex items-center justify-center hover:bg-red-500/80 transition-colors group" title="关闭">
          <X className="w-4 h-4 text-gray-500 group-hover:text-white" />
        </button>
      </div>
    </header>
  );
}
