import { useMemo } from "react";
import { Activity, Zap, Server, Wrench } from "lucide-react";
import type { Service } from "../types";

interface ServiceStatusDashboardProps {
  services: Service[];
  runningServices: string[];
}

export function ServiceStatusDashboard({ services, runningServices }: ServiceStatusDashboardProps) {
  const stats = useMemo(() => {
    const total = services.length;
    const running = runningServices.length;
    const stopped = total - running;
    const runningPercentage = total > 0 ? Math.round((running / total) * 100) : 0;

    // 按类型统计
    const byType = {
      normal: services.filter(s => s.service_type === "normal").length,
      npm: services.filter(s => s.service_type === "npm").length,
      maven: services.filter(s => s.service_type === "maven").length,
    };

    // 有依赖的服务数量
    const withDependencies = services.filter(s => s.depends_on && s.depends_on.length > 0).length;

    return {
      total,
      running,
      stopped,
      runningPercentage,
      byType,
      withDependencies,
    };
  }, [services, runningServices]);

  return (
    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-blue-400" />
        <h3 className="text-[13px] font-medium text-gray-400">服务状态</h3>
      </div>

      <div className="space-y-4">
        {/* 运行状态 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] text-gray-500">运行状态</span>
            <span className="text-[12px] text-gray-400">
              {stats.running}/{stats.total} ({stats.runningPercentage}%)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all duration-300"
              style={{ width: `${stats.runningPercentage}%` }}
            />
          </div>
        </div>

        {/* 按类型统计 */}
        <div>
          <div className="text-[12px] text-gray-500 mb-2">按类型</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-lg bg-white/[0.04] text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Wrench className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] text-gray-500">普通</span>
              </div>
              <div className="text-[16px] font-bold text-white/90">{stats.byType.normal}</div>
            </div>
            <div className="p-2 rounded-lg bg-white/[0.04] text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-[10px] text-gray-500">npm</span>
              </div>
              <div className="text-[16px] font-bold text-yellow-400">{stats.byType.npm}</div>
            </div>
            <div className="p-2 rounded-lg bg-white/[0.04] text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Server className="w-3.5 h-3.5 text-green-400" />
                <span className="text-[10px] text-gray-500">maven</span>
              </div>
              <div className="text-[16px] font-bold text-green-400">{stats.byType.maven}</div>
            </div>
          </div>
        </div>

        {/* 依赖统计 */}
        <div className="p-2 rounded-lg bg-white/[0.04]">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-gray-500">有依赖关系</span>
            <span className="text-[14px] font-bold text-purple-400">{stats.withDependencies}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
