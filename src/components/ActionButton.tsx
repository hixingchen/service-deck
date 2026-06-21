import type { ReactNode } from "react";

interface ActionButtonProps {
  icon: ReactNode;
  onClick: () => void;
  title: string;
  variant?: "default" | "danger" | "success";
  disabled?: boolean;
}

export function ActionButton({
  icon,
  onClick,
  title,
  variant = "default",
  disabled = false,
}: ActionButtonProps) {
  const variantClasses = {
    default: "text-muted-foreground hover:text-foreground hover:bg-card-hover",
    danger: "text-muted-foreground hover:text-red-400 hover:bg-red-500/10",
    success: "text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10",
  };

  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${variantClasses[variant]} ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      {icon}
    </button>
  );
}
