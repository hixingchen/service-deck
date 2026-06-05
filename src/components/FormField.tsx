export function FormField({ label, placeholder, value, onChange, onKeyDown }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-gray-400 mb-2">{label}</label>
      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/90 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 text-[13px] transition-colors"
      />
    </div>
  );
}
