import { useMemo } from "react";
import { Activity, CheckCircle } from "lucide-react";
import type { Service } from "../types";

interface ServiceDashboardProps {
  services: Service[];
  runningServices: string[];
  projects: { id: string; name: string; services: Service[] }[];
}

export function ServiceDashboard({ services, runningServices }: ServiceDashboardProps) {
  const total = useMemo(() => services.length, [services]);
  const running = useMemo(() => runningServices.length, [runningServices]);

  return (
    <div className="space-y-4">
      {/* 总体统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px] text-gray-500">总服务数</span>
          </div>
          <div className="text-[20px] font-bold text-white/90">{total}</div>
        </div>
        <div className="p-3 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] text-emerald-400/70">运行中</span>
          </div>
          <div className="text-[20px] font-bold text-emerald-400">{running}</div>
        </div>
      </div>
    </div>
  );
}
