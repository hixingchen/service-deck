import { useState, useEffect, useRef, useMemo } from "react";
import { Search, FolderOpen, Wrench, Play, Square, Star } from "lucide-react";
import type { Service, Project } from "../types";

interface QuickSwitcherProps {
  services: Service[];
  projects: Project[];
  runningServices: string[];
  onClose: () => void;
  onSwitchToServices: () => void;
  onSwitchToProjects: () => void;
}

export function QuickSwitcher({
  services,
  projects,
  runningServices,
  onClose,
  onSwitchToServices,
  onSwitchToProjects,
}: QuickSwitcherProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 过滤结果，收藏和运行中优先
  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    const items: Array<{
      type: "project" | "service";
      id: string;
      name: string;
      running?: boolean;
      favorite?: boolean;
      action?: () => void;
    }> = [];

    // 添加项目（收藏优先排序）
    const filteredProjects = projects
      .filter(p => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
        return 0;
      });

    filteredProjects.forEach(project => {
      const running = project.services.some(s => runningServices.includes(s.name));
      items.push({
        type: "project",
        id: project.id,
        name: project.name,
        running,
        favorite: project.favorite,
        action: () => {
          onSwitchToProjects();
          onClose();
        },
      });
    });

    // 添加服务（运行中优先排序）
    const filteredServices = services
      .filter(s => !q || s.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aRunning = runningServices.includes(a.name);
        const bRunning = runningServices.includes(b.name);
        if (aRunning && !bRunning) return -1;
        if (!aRunning && bRunning) return 1;
        return 0;
      });

    filteredServices.forEach(service => {
      items.push({
        type: "service",
        id: service.id,
        name: service.name,
        running: runningServices.includes(service.name),
        action: () => {
          onSwitchToServices();
          onClose();
        },
      });
    });

    return items;
  }, [query, services, projects, runningServices, onSwitchToServices, onSwitchToProjects, onClose]);

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]) {
            results[selectedIndex].action?.();
          }
          break;
        case "Escape":
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [results, selectedIndex, onClose]);

  // 自动聚焦
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* 搜索框 */}
      <div className="relative w-full max-w-md mx-4 rounded-2xl bg-[#1a1a2e] border border-white/[0.1] shadow-2xl overflow-hidden">
        {/* 输入框 */}
        <div className="flex items-center gap-3 px-4 h-12 border-b border-white/[0.06]">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="搜索项目或服务..."
            className="flex-1 bg-transparent text-[14px] text-white/90 placeholder-gray-600 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-white/[0.06] text-gray-500">ESC</kbd>
        </div>

        {/* 结果列表 */}
        <div className="max-h-64 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-gray-600">
              未找到匹配项
            </div>
          ) : (
            results.map((item, index) => (
              <button
                key={`${item.type}-${item.id}`}
                onClick={() => item.action?.()}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  index === selectedIndex
                    ? "bg-blue-500/20"
                    : "hover:bg-white/[0.04]"
                }`}
              >
                {/* 图标 */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  item.type === "project"
                    ? "bg-blue-500/20"
                    : "bg-emerald-500/20"
                }`}>
                  {item.type === "project" ? (
                    <FolderOpen className="w-4 h-4 text-blue-400" />
                  ) : (
                    <Wrench className="w-4 h-4 text-emerald-400" />
                  )}
                </div>

                {/* 名称 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] text-white/90 truncate">{item.name}</span>
                    {item.favorite && <Star className="w-3 h-3 text-yellow-400 flex-shrink-0" />}
                  </div>
                  <div className="text-[11px] text-gray-600">
                    {item.type === "project" ? "项目" : "服务"}
                  </div>
                </div>

                {/* 状态 */}
                {item.running !== undefined && (
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${
                    item.running
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-white/[0.06] text-gray-500"
                  }`}>
                    {item.running ? (
                      <>
                        <Play className="w-3 h-3" />
                        运行中
                      </>
                    ) : (
                      <>
                        <Square className="w-3 h-3" />
                        已停止
                      </>
                    )}
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* 底部提示 */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.06] text-[11px] text-gray-600">
          <div className="flex items-center gap-2">
            <kbd className="px-1 py-0.5 rounded bg-white/[0.06]">↑↓</kbd>
            <span>导航</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-1 py-0.5 rounded bg-white/[0.06]">↵</kbd>
            <span>选择</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-1 py-0.5 rounded bg-white/[0.06]">esc</kbd>
            <span>关闭</span>
          </div>
        </div>
      </div>
    </div>
  );
}
