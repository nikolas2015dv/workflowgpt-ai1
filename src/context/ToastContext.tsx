import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  text: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toasts: ToastMessage[];
  showToast: (text: string, tone?: ToastTone) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (text: string, tone: ToastTone = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev, { id, text, tone }]);
      window.setTimeout(() => dismissToast(id), 3200);
    },
    [dismissToast]
  );

  const value = useMemo(
    () => ({ toasts, showToast, dismissToast }),
    [toasts, showToast, dismissToast]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toasts: [],
      showToast: () => {},
      dismissToast: () => {},
    };
  }
  return ctx;
}

export const ToastViewport: React.FC = () => {
  const { toasts, dismissToast } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div className="toast-viewport" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast--${toast.tone}`}
          role={toast.tone === 'error' ? 'alert' : 'status'}
        >
          <span>{toast.text}</span>
          <button type="button" className="toast__close" onClick={() => dismissToast(toast.id)} aria-label="Закрыть">
            ×
          </button>
        </div>
      ))}
    </div>
  );
};
