import { useState, useEffect, useRef, useCallback } from "react";
import { X, Play, Terminal, Loader2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface CommandTerminalProps {
  serviceName: string;
  servicePath: string;
  serviceType: string;
  onClose: () => void;
}

export function CommandTerminal({ serviceName, servicePath, serviceType, onClose }: CommandTerminalProps) {
  const [customCommand, setCustomCommand] = useState("");
  const [output, setOutput] = useState<Array<{ type: string; text: string }>>([]);
  const [running, setRunning] = useState(false);
  const [availableCommands, setAvailableCommands] = useState<string[]>([]);
  const outputRef = useRef<HTMLDivElement>(null);

  // 加载 package.json 中的 scripts
  useEffect(() => {
    if (serviceType === "npm" || serviceType === "maven") {
      let cancelled = false;
      invoke<string[]>("get_available_commands", {
        path: servicePath,
        serviceType,
      })
        .then((cmds) => { if (!cancelled) setAvailableCommands(cmds); })
        .catch(() => { if (!cancelled) setAvailableCommands([]); });
      return () => { cancelled = true; };
    }
  }, [servicePath, serviceType]);

  // 监听命令输出事件
  useEffect(() => {
    const unlistenOutput = listen("command-output", (event) => {
      const payload = event.payload as { type: string; line: string };
      setOutput(prev => [...prev, { type: payload.type, text: payload.line }]);
    });

    const unlistenFinished = listen("command-finished", (event) => {
      const payload = event.payload as { success: boolean; code?: number; error?: string };
      setRunning(false);
      if (payload.success) {
        setOutput(prev => [...prev, { type: "info", text: `\n命令执行完成 (退出码: ${payload.code})` }]);
      } else {
        setOutput(prev => [...prev, { type: "error", text: `\n命令执行失败: ${payload.error || `退出码: ${payload.code}`}` }]);
      }
    });

    return () => {
      unlistenOutput.then(fn => fn());
      unlistenFinished.then(fn => fn());
    };
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const executeCommand = useCallback(async (command: string) => {
    if (running || !command.trim()) return;

    setRunning(true);
    setOutput(prev => [...prev, { type: "command", text: `$ ${command}` }]);

    try {
      await invoke("execute_command", {
        command: command.trim(),
        workDir: servicePath,
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setOutput(prev => [...prev, { type: "error", text: `错误: ${error}` }]);
      setRunning(false);
    }
  }, [running, servicePath]);

  const handlePresetClick = (command: string) => {
    setCustomCommand(command);
    executeCommand(command);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeCommand(customCommand);
  };

  const handleClear = () => {
    setOutput([]);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[700px] h-[80vh] bg-[#0f0f14] rounded-xl border border-white/[0.06] shadow-2xl overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h3 className="text-[14px] font-semibold text-white">命令终端</h3>
            <span className="text-[11px] text-gray-500">- {serviceName}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 快速命令 */}
        {(serviceType === "npm" || serviceType === "maven") && (
          <div className="flex-shrink-0 px-5 py-3 border-b border-white/[0.06]">
            <div className="text-[11px] text-gray-500 mb-2">快速命令</div>
            <div className="flex flex-wrap gap-1.5">
              {/* npm install（仅 npm 类型显示） */}
              {serviceType === "npm" && (
                <button
                  onClick={() => handlePresetClick("npm install")}
                  disabled={running}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                >
                  npm install
                </button>
              )}
              {/* 动态命令列表 */}
              {availableCommands.map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => handlePresetClick(serviceType === "npm" ? `npm run ${cmd}` : `mvn ${cmd}`)}
                  disabled={running}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-mono bg-white/[0.04] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.12] transition-colors disabled:opacity-50"
                >
                  {serviceType === "npm" ? `npm run ${cmd}` : `mvn ${cmd}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 自定义命令输入 */}
        <form onSubmit={handleSubmit} className="flex-shrink-0 px-5 py-3 border-b border-white/[0.06]">
          <div className="flex gap-2">
            <input
              type="text"
              value={customCommand}
              onChange={(e) => setCustomCommand(e.target.value)}
              placeholder="输入自定义命令..."
              disabled={running}
              className="flex-1 h-9 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/90 placeholder-gray-600 font-mono focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={running || !customCommand.trim()}
              className="h-9 px-4 flex items-center gap-1.5 rounded-lg bg-blue-600 text-white text-[12px] font-medium hover:bg-blue-500 transition-colors disabled:opacity-50"
            >
              {running ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              运行
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="h-9 px-3 rounded-lg border border-white/[0.08] text-gray-400 text-[12px] hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              清空
            </button>
          </div>
        </form>

        {/* 输出区域 */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <div
            ref={outputRef}
            className="h-full overflow-y-auto p-4 font-mono text-[12px] leading-relaxed bg-black/30"
          >
            {output.length > 0 ? (
              output.map((line, index) => (
                <div
                  key={index}
                  className={`whitespace-pre-wrap break-all ${
                    line.type === "command" ? "text-blue-400 font-semibold" :
                    line.type === "error" ? "text-red-400" :
                    line.type === "info" ? "text-emerald-400" :
                    line.type === "stderr" ? "text-yellow-400" :
                    "text-gray-300"
                  }`}
                >
                  {line.text}
                </div>
              ))
            ) : (
              <div className="text-gray-600 text-center py-8">
                选择或输入命令运行，输出将实时显示在这里
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
