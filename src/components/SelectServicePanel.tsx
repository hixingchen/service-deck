import { useState, useMemo } from "react";
import { ArrowLeft, X, Plus, Wrench } from "lucide-react";
import type { Service } from "../types";

interface Props {
  services: Service[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function SelectServicePanel({ services, onSelect, onClose }: Props) {
  const [search, setSearch] = useState("");

  const filteredBasic = useMemo(() => {
    const basic = services.filter(s => s.category === "basic");
    if (!search.trim()) return basic;
    return basic.filter(s => s.name.toLowerCase().includes(search.trim().toLowerCase()));
  }, [services, search]);

  const filteredProject = useMemo(() => {
    const project = services.filter(s => s.category === "project");
    if (!search.trim()) return project;
    return project.filter(s => s.name.toLowerCase().includes(search.trim().toLowerCase()));
  }, [services, search]);

  const noResults = search.trim() && filteredBasic.length === 0 && filteredProject.length === 0;

  function ServiceItem({ service }: { service: Service }) {
    return (
      <div
        onClick={() => onSelect(service.id)}
        className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-emerald-500/30 hover:bg-emerald-500/[0.04] cursor-pointer transition-all duration-200 group"
      >
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
          <Wrench className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-medium text-white/90">{service.name}</div>
          <div className="text-[12px] text-gray-500 truncate font-mono mt-0.5">{service.command}</div>
        </div>
        <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
          <Plus className="w-4 h-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#0a0a0f]">
      <div className="flex-shrink-0 flex items-center h-14 px-4 border-b border-white/[0.06]">
        <button onClick={onClose}
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-white/[0.08] hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </button>
        <h2 className="ml-3 text-[15px] font-semibold text-white/90">选择服务</h2>
      </div>

      {/* 搜索框 */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索服务名称..."
            className="w-full h-9 px-3 pl-9 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white/90 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {services.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3">
              <Wrench className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-[14px] text-gray-400 font-medium">没有可用的服务</p>
            <p className="text-[12px] text-gray-600 mt-1">请先在服务列表中添加服务</p>
          </div>
        ) : noResults ? (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-[13px] text-gray-600">未找到匹配的服务</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 基础服务 */}
            {filteredBasic.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                  <h3 className="text-[13px] font-semibold text-gray-400">基础服务</h3>
                  <span className="text-[11px] text-gray-600">({filteredBasic.length})</span>
                </div>
                <div className="space-y-2">
                  {filteredBasic.map((service) => <ServiceItem key={service.id} service={service} />)}
                </div>
              </div>
            )}

            {/* 项目服务 */}
            {filteredProject.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                  <h3 className="text-[13px] font-semibold text-gray-400">项目服务</h3>
                  <span className="text-[11px] text-gray-600">({filteredProject.length})</span>
                </div>
                <div className="space-y-2">
                  {filteredProject.map((service) => <ServiceItem key={service.id} service={service} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
