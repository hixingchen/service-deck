export function StartupTypeButton({ label, value, current, onClick }: {
  label: string; value: string; current: string; onClick: (v: string) => void;
}) {
  const isActive = value === current;
  return (
    <button
      onClick={() => onClick(value)}
      className={`flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
        isActive
          ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
          : "bg-white/[0.04] text-gray-500 border border-white/[0.08] hover:border-white/[0.12] hover:text-gray-400"
      }`}
    >
      {label}
    </button>
  );
}
