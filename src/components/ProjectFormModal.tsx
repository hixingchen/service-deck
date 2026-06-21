import { useState, useMemo } from "react";
import { Plus, ArrowLeft, X, Wrench } from "lucide-react";
import type { Service } from "../types";
import { FormField } from "./FormField";
import { FormFooter } from "./FormFooter";
import { SelectServicePanel } from "./SelectServicePanel";
import { useI18n } from "../hooks/useI18n";

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
  const { t } = useI18n();
  const [showSelect, setShowSelect] = useState(false);
  const [nameError, setNameError] = useState("");
  const addedIds = useMemo(() => new Set(projectServices.map(s => s.id)), [projectServices]);
  const availableServices = useMemo(() => allServices.filter(s => !addedIds.has(s.id)), [allServices, addedIds]);

  const handleSubmit = () => {
    if (!name.trim()) {
      setNameError(t.project.form.nameRequired);
      return;
    }
    onSubmit();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl max-h-[90vh] rounded-2xl border-[3px] border-white/30 bg-card shadow-[0_0_0_2px_rgba(255,255,255,0.15),0_0_20px_rgba(0,0,0,0.3),0_25px_50px_-12px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3.5 border-b border-border/50">
          <button onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
        </div>

        {/* 表单内容 */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-6">
          <FormField
            label={t.project.name}
            placeholder={t.project.form.namePlaceholder}
            value={name}
            onChange={(v) => { onNameChange(v); if (nameError) setNameError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          {nameError && <p className="text-sm text-red-400 -mt-4">{nameError}</p>}

          {/* 已添加服务 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-400">{t.project.form.addedServices}</label>
              <button onClick={() => setShowSelect(true)}
                className="h-7 px-2.5 flex items-center gap-1 rounded-md bg-emerald-600/20 text-emerald-400 text-sm font-medium hover:bg-emerald-600/30 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> {t.project.form.addService}
              </button>
            </div>

            {projectServices.length === 0 ? (
              <div className="py-8 rounded-xl border border-dashed border-border flex flex-col items-center justify-center">
                <Wrench className="w-8 h-8 text-gray-600 mb-2" />
                <p className="text-sm text-gray-500">{t.project.form.noServicesHint}</p>
                <p className="text-sm text-gray-600 mt-0.5">{t.project.form.noServicesSubtext}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {projectServices.map((service) => (
                  <div key={service.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border bg-white/[0.02] group hover:border-border transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <Wrench className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground">{service.name}</div>
                      <div className="text-[13px] text-muted-foreground truncate font-mono mt-0.5">{service.command}</div>
                    </div>
                    <button onClick={() => onRemoveService(service.id)}
                      className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
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
        <FormFooter onClose={onClose} onSubmit={handleSubmit} submitLabel={submitLabel} />
      </div>

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
