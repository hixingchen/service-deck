import { useState, useCallback, useRef } from "react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
}

export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setOptions(opts);
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current(true);
      resolveRef.current = null;
    }
    setOptions(null);
  }, []);

  const handleCancel = useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current(false);
      resolveRef.current = null;
    }
    setOptions(null);
  }, []);

  return {
    options,
    confirm,
    handleConfirm,
    handleCancel,
  };
}
