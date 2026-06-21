import { useMemo, type ReactNode } from "react";
import { Star } from "lucide-react";
import type { Project } from "../types";
import { useI18n } from "../hooks/useI18n";

interface ProjectGroupsProps {
  projects: Project[];
  children: (project: Project) => ReactNode;
}

export function ProjectGroups({
  projects,
  children,
}: ProjectGroupsProps) {
  const { t } = useI18n();
  const favorites = useMemo(() => projects.filter(p => p.favorite), [projects]);
  const others = useMemo(() => projects.filter(p => !p.favorite), [projects]);

  return (
    <div className="space-y-4">
      {favorites.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Star className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-medium text-gray-400">{t.project.favorites}</span>
            <span className="text-sm text-gray-600 ml-auto">
              {t.project.projectCount.replace("{count}", String(favorites.length))}
            </span>
          </div>
          <div className="space-y-2 pl-2">
            {favorites.map(project => children(project))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div className="space-y-2">
          {favorites.length > 0 && (
            <div className="flex items-center gap-2 px-2 py-1.5">
              <span className="text-sm font-medium text-gray-400">{t.project.allProjects}</span>
              <span className="text-sm text-gray-600 ml-auto">
                {t.project.projectCount.replace("{count}", String(others.length))}
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
