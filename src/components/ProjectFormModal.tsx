import { useState, useMemo } from "react";
import { Plus, ArrowLeft, X, Wrench } from "lucide-react";
import type { Service } from "../types";
import { FormField } from "./FormField";
import { FormFooter } from "./FormFooter";
import { SelectServicePanel } from "./SelectServicePanel";

interface Props {
  title: string;
  name: string;
  projectServices: Service[];
  allServices: Service[];
  onNameChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  onAddService: (serviceId: string) => void;
  onRemoveService: (serviceId: string) => void;
  submitLabel: string;
}

export function ProjectFormModal({ title, name, projectServices, allServices, onNameChange, onClose, onSubmit, onAddService, onRemoveService, submitLabel }: Props) {
  const [showSelect, setShowSelect] = useState(false);
  const addedIds = useMemo(() => new Set(projectServices.map(s => s.id)), [projectServices]);
  const availableServices = useMemo(() => allServices.filter(s => !addedIds.has(s.id)), [allServices, addedIds]);

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#0a0a0f]" style={{ top: '2.75rem' }}>
      {/* 头部 */}
      <div className="flex-shrink-0 flex items-center h-14 px-4 border-b border-white/[0.06]">
        <button onClick={onClose}
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-white/[0.08] hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </button>
        <h2 className="ml-3 text-[15px] font-semibold text-white/90">{title}</h2>
      </div>

      {/* 表单内容 */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="space-y-6 max-w-lg mx-auto">
          <FormField
            label="项目名称"
            placeholder="请输入项目名称"
            value={name}
            onChange={onNameChange}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          />

          {/* 已添加服务 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[13px] font-medium text-gray-400">已添加服务</label>
              <button onClick={() => setShowSelect(true)}
                className="h-7 px-2.5 flex items-center gap-1 rounded-md bg-emerald-600/20 text-emerald-400 text-[12px] font-medium hover:bg-emerald-600/30 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> 添加
              </button>
            </div>

            {projectServices.length === 0 ? (
              <div className="py-8 rounded-xl border border-dashed border-white/[0.08] flex flex-col items-center justify-center">
                <Wrench className="w-8 h-8 text-gray-600 mb-2" />
                <p className="text-[13px] text-gray-500">暂无服务</p>
                <p className="text-[12px] text-gray-600 mt-0.5">点击上方按钮添加</p>
              </div>
            ) : (
              <div className="space-y-2">
                {projectServices.map((service) => (
                  <div key={service.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] group hover:border-white/[0.1] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <Wrench className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-white/90">{service.name}</div>
                      <div className="text-[11px] text-gray-500 truncate font-mono mt-0.5">{service.command}</div>
                    </div>
                    <button onClick={() => onRemoveService(service.id)}
                      className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 底部按钮 */}
      <FormFooter onClose={onClose} onSubmit={onSubmit} submitLabel={submitLabel} />

      {/* 选择服务弹窗 */}
      {showSelect && (
        <SelectServicePanel
          services={availableServices}
          onSelect={(id) => { onAddService(id); setShowSelect(false); }}
          onClose={() => setShowSelect(false)}
        />
      )}
    </div>
  );
}
