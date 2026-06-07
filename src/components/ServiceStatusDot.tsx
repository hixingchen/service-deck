interface ServiceStatusDotProps {
  running: boolean;
}

export function ServiceStatusDot({ running }: ServiceStatusDotProps) {
  return (
    <div
      className={`w-2 h-2 rounded-full ${
        running ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" : "bg-gray-600"
      }`}
    />
  );
}
