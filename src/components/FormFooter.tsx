import { Check } from "lucide-react";

export function FormFooter({ onClose, onSubmit, submitLabel }: {
  onClose: () => void; onSubmit: () => void; submitLabel: string;
}) {
  return (
    <div className="flex-shrink-0 px-4 py-4 border-t border-white/[0.06] bg-[#0a0a0f]">
      <div className="max-w-lg mx-auto flex items-center justify-end gap-3">
        <button onClick={onClose}
          className="px-4 py-2 rounded-xl border border-white/[0.08] text-gray-400 hover:bg-white/[0.06] hover:text-gray-300 transition-colors text-[13px] font-medium"
        >
          取消
        </button>
        <button onClick={onSubmit}
          className="h-9 px-4 flex items-center gap-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-colors text-[13px] font-medium"
        >
          <Check className="w-4 h-4" />
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
