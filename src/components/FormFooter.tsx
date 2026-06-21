import { Check } from "lucide-react";
import { useI18n } from "../hooks/useI18n";

export function FormFooter({ onClose, onSubmit, submitLabel }: {
  onClose: () => void; onSubmit: () => void; submitLabel: string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex-shrink-0 flex items-center justify-end gap-3 px-4 py-4 border-t border-border/50">
      <button onClick={onClose}
        className="px-4 py-2 rounded-lg border border-border/50 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors text-sm font-medium"
      >
        {t.common.cancel}
      </button>
      <button onClick={onSubmit}
        className="h-9 px-5 flex items-center gap-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors text-sm font-medium shadow-lg shadow-blue-500/10"
      >
        <Check className="w-4 h-4" />
        {submitLabel}
      </button>
    </div>
  );
}
