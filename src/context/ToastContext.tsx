import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

export interface ToastOptions {
  title?: string;
  duration?: number;
}

export interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (type: ToastType, message: string, options?: ToastOptions) => string;
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  dismissToast: (id: string) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Global imperative toast bridge for non-React contexts
let globalToastEmitter: ((type: ToastType, message: string, options?: ToastOptions) => string) | null = null;

export const toast = {
  success: (message: string, options?: ToastOptions) => {
    if (globalToastEmitter) return globalToastEmitter('success', message, options);
    console.log('[Toast:success]', message);
    return '';
  },
  error: (message: string, options?: ToastOptions) => {
    if (globalToastEmitter) return globalToastEmitter('error', message, options);
    console.error('[Toast:error]', message);
    return '';
  },
  info: (message: string, options?: ToastOptions) => {
    if (globalToastEmitter) return globalToastEmitter('info', message, options);
    console.info('[Toast:info]', message);
    return '';
  },
  warning: (message: string, options?: ToastOptions) => {
    if (globalToastEmitter) return globalToastEmitter('warning', message, options);
    console.warn('[Toast:warning]', message);
    return '';
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, options?: ToastOptions): string => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      // Default duration: 4.5s for success/info, 6s for errors/warnings to ensure readability
      const duration = options?.duration ?? (type === 'error' || type === 'warning' ? 6000 : 4500);

      const newItem: ToastItem = {
        id,
        type,
        title: options?.title,
        message,
        duration,
      };

      setToasts((prev) => {
        // Keep at most 4 simultaneous toasts to avoid viewport clutter
        const next = [...prev, newItem];
        if (next.length > 4) {
          const removed = next.shift();
          if (removed) {
            const timer = timersRef.current.get(removed.id);
            if (timer) clearTimeout(timer);
            timersRef.current.delete(removed.id);
          }
        }
        return next;
      });

      if (duration > 0) {
        const timer = setTimeout(() => {
          dismissToast(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismissToast]
  );

  const success = useCallback(
    (message: string, options?: ToastOptions) => showToast('success', message, options),
    [showToast]
  );
  const error = useCallback(
    (message: string, options?: ToastOptions) => showToast('error', message, options),
    [showToast]
  );
  const info = useCallback(
    (message: string, options?: ToastOptions) => showToast('info', message, options),
    [showToast]
  );
  const warning = useCallback(
    (message: string, options?: ToastOptions) => showToast('warning', message, options),
    [showToast]
  );

  // Link global toast emitter
  globalToastEmitter = showToast;

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        success,
        error,
        info,
        warning,
        dismissToast,
        clearAll,
      }}
    >
      {children}
      {/* Toast Render Viewport Container */}
      <aside
        aria-live="polite"
        aria-label="Notifications"
        className="fixed top-4 right-4 z-[99999] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-[calc(100vw-2rem)] pointer-events-none"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            role="alert"
            className={`pointer-events-auto transform transition-all duration-300 ease-out translate-y-0 opacity-100 flex items-start gap-3 p-3.5 rounded-xl border shadow-2xl backdrop-blur-md ${
              item.type === 'success'
                ? 'bg-slate-900/95 border-emerald-500/50 text-emerald-100 shadow-emerald-950/40 ring-1 ring-emerald-500/20'
                : item.type === 'error'
                ? 'bg-slate-900/95 border-rose-500/50 text-rose-100 shadow-rose-950/40 ring-1 ring-rose-500/20'
                : item.type === 'warning'
                ? 'bg-slate-900/95 border-amber-500/50 text-amber-100 shadow-amber-950/40 ring-1 ring-amber-500/20'
                : 'bg-slate-900/95 border-blue-500/50 text-blue-100 shadow-blue-950/40 ring-1 ring-blue-500/20'
            }`}
          >
            {/* Type Icon */}
            <div className="shrink-0 mt-0.5">
              {item.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {item.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400" />}
              {item.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
              {item.type === 'info' && <Info className="w-5 h-5 text-blue-400" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 text-left">
              {item.title && (
                <div
                  className={`text-xs font-bold tracking-tight mb-0.5 ${
                    item.type === 'success'
                      ? 'text-emerald-300'
                      : item.type === 'error'
                      ? 'text-rose-300'
                      : item.type === 'warning'
                      ? 'text-amber-300'
                      : 'text-blue-300'
                  }`}
                >
                  {item.title}
                </div>
              )}
              <p className="text-xs text-slate-200 leading-snug break-words">{item.message}</p>
            </div>

            {/* Dismiss Button */}
            <button
              type="button"
              onClick={() => dismissToast(item.id)}
              className="shrink-0 p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </aside>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    // Graceful fallback if invoked outside Provider
    return {
      toasts: [],
      showToast: (type, msg, opt) => toast[type](msg, opt),
      success: (msg, opt) => toast.success(msg, opt),
      error: (msg, opt) => toast.error(msg, opt),
      info: (msg, opt) => toast.info(msg, opt),
      warning: (msg, opt) => toast.warning(msg, opt),
      dismissToast: () => {},
      clearAll: () => {},
    };
  }
  return context;
};
