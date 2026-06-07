interface ServiceTypeBadgeProps {
  serviceType: string;
}

export function ServiceTypeBadge({ serviceType }: ServiceTypeBadgeProps) {
  if (serviceType === "normal") return null;

  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] bg-orange-500/20 text-orange-400">
      {serviceType}
    </span>
  );
}
