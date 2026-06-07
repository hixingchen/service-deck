import { useState, useEffect, useRef, useMemo } from "react";
import { Rocket, Play, Square, Star } from "lucide-react";
import type { Project } from "../types";

interface QuickProjectSwitcherProps {
  projects: Project[];
  runningServices: string[];
  runningProjects: string[];
  onClose: () => void;
  onStartProject: (id: string) => void;
  onStopProject: (id: string) => void;
}

export function QuickProjectSwitcher({
  projects,
  runningServices,
  runningProjects,
  onClose,
  onStartProject,
  onStopProject,
}: QuickProjectSwitcherProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 过滤结果，收藏项目优先排序
  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    return projects
      .filter(p => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => {
        // 收藏项目优先
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
        // 运行中的项目优先
        const aRunning = runningProjects.includes(a.id);
        const bRunning = runningProjects.includes(b.id);
        if (aRunning && !bRunning) return -1;
        if (!aRunning && bRunning) return 1;
        return 0;
      })
      .map(project => {
        const runningCount = project.services.filter(s => runningServices.includes(s.name)).length;
        const isRunning = runningProjects.includes(project.id);
        return {
          project,
          runningCount,
          isRunning,
        };
      });
  }, [query, projects, runningServices, runningProjects]);

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
            const { project, isRunning } = results[selectedIndex];
            if (isRunning) {
              onStopProject(project.id);
            } else {
              onStartProject(project.id);
            }
            onClose();
          }
          break;
        case "Escape":
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [results, selectedIndex, onClose, onStartProject, onStopProject]);

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
          <Rocket className="w-4 h-4 text-blue-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="搜索项目..."
            className="flex-1 bg-transparent text-[14px] text-white/90 placeholder-gray-600 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-white/[0.06] text-gray-500">ESC</kbd>
        </div>

        {/* 结果列表 */}
        <div className="max-h-64 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-gray-600">
              未找到匹配的项目
            </div>
          ) : (
            results.map(({ project, runningCount, isRunning }, index) => (
              <button
                key={project.id}
                onClick={() => {
                  if (isRunning) {
                    onStopProject(project.id);
                  } else {
                    onStartProject(project.id);
                  }
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  index === selectedIndex
                    ? "bg-blue-500/20"
                    : "hover:bg-white/[0.04]"
                }`}
              >
                {/* 图标 */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isRunning
                    ? "bg-emerald-500/20"
                    : "bg-blue-500/20"
                }`}>
                  <Rocket className={`w-4 h-4 ${
                    isRunning ? "text-emerald-400" : "text-blue-400"
                  }`} />
                </div>

                {/* 名称 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-white/90 truncate">{project.name}</span>
                    {project.favorite && <Star className="w-3 h-3 text-yellow-400" />}
                  </div>
                  <div className="text-[11px] text-gray-600">
                    {project.services.length} 个服务
                    {runningCount > 0 && ` · ${runningCount} 运行中`}
                  </div>
                </div>

                {/* 状态 */}
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${
                  isRunning
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-white/[0.06] text-gray-500"
                }`}>
                  {isRunning ? (
                    <>
                      <Square className="w-3 h-3" />
                      停止
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      启动
                    </>
                  )}
                </div>
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
            <span>启动/停止</span>
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
