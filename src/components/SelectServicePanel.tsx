import { useState, useMemo } from "react";
import { ArrowLeft, X, Plus, Wrench, Star } from "lucide-react";
import type { Service } from "../types";
import { useI18n } from "../hooks/useI18n";

interface Props {
  services: Service[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

function ServiceItem({ service, onSelect }: { service: Service; onSelect: (id: string) => void }) {
  return (
    <div
      onClick={() => onSelect(service.id)}
      className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-emerald-500/30 hover:bg-emerald-500/[0.04] cursor-pointer transition-all duration-200 group"
    >
      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
        <Wrench className="w-5 h-5 text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-base font-medium text-foreground">{service.name}</span>
          {service.favorite && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
        </div>
        <div className="text-sm text-muted-foreground truncate font-mono mt-0.5">{service.command}</div>
      </div>
      <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
        <Plus className="w-4 h-4" />
      </div>
    </div>
  );
}

export function SelectServicePanel({ services, onSelect, onClose }: Props) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");

  // 收藏服务优先排序
  const sortedServices = useMemo(() => {
    return [...services].sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return 0;
    });
  }, [services]);

  const filteredFavorites = useMemo(() => {
    const favs = sortedServices.filter(s => s.favorite);
    if (!search.trim()) return favs;
    return favs.filter(s => s.name.toLowerCase().includes(search.trim().toLowerCase()));
  }, [sortedServices, search]);

  const filteredOthers = useMemo(() => {
    const others = sortedServices.filter(s => !s.favorite);
    if (!search.trim()) return others;
    return others.filter(s => s.name.toLowerCase().includes(search.trim().toLowerCase()));
  }, [sortedServices, search]);

  const noResults = search.trim() && filteredFavorites.length === 0 && filteredOthers.length === 0;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background">
      <div className="flex-shrink-0 flex items-center h-14 px-4 border-b border-border">
        <button onClick={onClose}
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-border hover:bg-card-hover transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <h2 className="ml-3 text-base font-semibold text-foreground">{t.selectService.title}</h2>
      </div>

      {/* 搜索框 */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.selectService.searchPlaceholder}
            className="w-full h-9 px-3 pl-9 rounded-lg bg-card border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-blue-500/50 transition-colors"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {services.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mb-3">
              <Wrench className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-base text-muted-foreground font-medium">{t.selectService.noAvailable}</p>
            <p className="text-sm text-muted-foreground mt-1">{t.selectService.noAvailableHint}</p>
          </div>
        ) : noResults ? (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">{t.selectService.noResults}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 收藏服务 */}
            {filteredFavorites.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Star className="w-3.5 h-3.5 text-yellow-400" />
                  <h3 className="text-sm font-semibold text-muted-foreground">{t.selectService.favorites}</h3>
                  <span className="text-sm text-muted-foreground">({filteredFavorites.length})</span>
                </div>
                <div className="space-y-2">
                  {filteredFavorites.map((service) => <ServiceItem key={service.id} service={service} onSelect={onSelect} />)}
                </div>
              </div>
            )}

            {/* 全部服务 */}
            {filteredOthers.length > 0 && (
              <div>
                {filteredFavorites.length > 0 && (
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <h3 className="text-sm font-semibold text-muted-foreground">{t.selectService.allServices}</h3>
                    <span className="text-sm text-muted-foreground">({filteredOthers.length})</span>
                  </div>
                )}
                <div className="space-y-2">
                  {filteredOthers.map((service) => <ServiceItem key={service.id} service={service} onSelect={onSelect} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
