export function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500">
      <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
        <div className="text-gray-600">{icon}</div>
      </div>
      <p className="text-[15px] font-medium text-gray-400">{title}</p>
      <p className="text-[13px] mt-1 text-gray-600">{subtitle}</p>
    </div>
  );
}
