import type { KeyboardEvent } from "react";

export function FormField({ label, placeholder, value, onChange, onKeyDown }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">{label}</label>
      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className="w-full px-3 py-2.5 rounded-xl bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 text-sm transition-colors"
      />
    </div>
  );
}
