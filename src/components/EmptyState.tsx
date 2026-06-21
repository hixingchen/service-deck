import type { ReactNode } from "react";

export function EmptyState({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
      <div className="w-20 h-20 rounded-2xl bg-card border border-border flex items-center justify-center mb-4">
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <p className="text-base font-medium text-foreground">{title}</p>
      <p className="text-sm mt-1 text-muted-foreground">{subtitle}</p>
    </div>
  );
}
