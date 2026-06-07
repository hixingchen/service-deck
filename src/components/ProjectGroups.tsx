import { useMemo, type ReactNode } from "react";
import { Star } from "lucide-react";
import type { Project } from "../types";

interface ProjectGroupsProps {
  projects: Project[];
  runningServices: string[];
  children: (project: Project) => ReactNode;
}

export function ProjectGroups({
  projects,
  runningServices,
  children,
}: ProjectGroupsProps) {
  // 收藏项目
  const favorites = useMemo(() => projects.filter(p => p.favorite), [projects]);
  // 其他项目
  const others = useMemo(() => projects.filter(p => !p.favorite), [projects]);

  const getRunningCount = (projectList: Project[]) => {
    return projectList.filter(p =>
      p.services.some(s => runningServices.includes(s.name))
    ).length;
  };

  return (
    <div className="space-y-4">
      {/* 收藏项目 */}
      {favorites.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Star className="w-4 h-4 text-yellow-400" />
            <span className="text-[13px] font-medium text-gray-400">收藏</span>
            <span className="text-[11px] text-gray-600 ml-auto">
              {favorites.length} 个项目
            </span>
          </div>
          <div className="space-y-2 pl-2">
            {favorites.map(project => children(project))}
          </div>
        </div>
      )}

      {/* 其他项目 */}
      {others.length > 0 && (
        <div className="space-y-2">
          {favorites.length > 0 && (
            <div className="flex items-center gap-2 px-2 py-1.5">
              <span className="text-[13px] font-medium text-gray-400">全部项目</span>
              <span className="text-[11px] text-gray-600 ml-auto">
                {others.length} 个项目
              </span>
            </div>
          )}
          <div className="space-y-2">
            {others.map(project => children(project))}
          </div>
        </div>
      )}
    </div>
  );
}
