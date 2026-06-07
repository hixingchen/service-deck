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
    default: "text-gray-500 hover:text-white hover:bg-white/[0.08]",
    danger: "text-gray-500 hover:text-red-400 hover:bg-red-500/10",
    success: "text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10",
  };

  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${variantClasses[variant]} ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      {icon}
    </button>
  );
}
