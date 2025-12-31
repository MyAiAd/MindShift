'use client';

import * as React from 'react';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { impactFeedback } from '@/lib/haptics';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => void;
  hideToast: (id: string) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
  maxToasts?: number;
}

export function ToastProvider({ children, maxToasts = 3 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const duration = toast.duration ?? 5000;

    // Haptic feedback based on variant
    switch (toast.variant) {
      case 'success':
        impactFeedback('light');
        break;
      case 'error':
        impactFeedback('heavy');
        break;
      case 'warning':
        impactFeedback('medium');
        break;
      default:
        impactFeedback('light');
    }

    setToasts((prev) => {
      const newToasts = [...prev, { ...toast, id }];
      // Limit number of toasts
      if (newToasts.length > maxToasts) {
        return newToasts.slice(-maxToasts);
      }
      return newToasts;
    });

    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        hideToast(id);
      }, duration);
    }
  }, [maxToasts]);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Convenience methods
  const success = useCallback(
    (message: string, duration?: number) => {
      showToast({ message, variant: 'success', duration });
    },
    [showToast]
  );

  const error = useCallback(
    (message: string, duration?: number) => {
      showToast({ message, variant: 'error', duration });
    },
    [showToast]
  );

  const warning = useCallback(
    (message: string, duration?: number) => {
      showToast({ message, variant: 'warning', duration });
    },
    [showToast]
  );

  const info = useCallback(
    (message: string, duration?: number) => {
      showToast({ message, variant: 'info', duration });
    },
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{ toasts, showToast, hideToast, success, error, warning, info }}
    >
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

function ToastContainer() {
  const { toasts, hideToast } = useToast();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="container mx-auto px-4 pb-safe mb-20 md:mb-4 flex flex-col gap-2 items-center">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={hideToast} />
        ))}
      </div>
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [isExiting, setIsExiting] = React.useState(false);

  const handleDismiss = () => {
    impactFeedback('light');
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 200); // Match exit animation duration
  };

  const handleAction = () => {
    toast.action?.onClick();
    handleDismiss();
  };

  const variantConfig = {
    success: {
      icon: CheckCircle2,
      bgClass: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
      textClass: 'text-green-800 dark:text-green-200',
      iconClass: 'text-green-600 dark:text-green-400',
    },
    error: {
      icon: AlertCircle,
      bgClass: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
      textClass: 'text-red-800 dark:text-red-200',
      iconClass: 'text-red-600 dark:text-red-400',
    },
    warning: {
      icon: AlertTriangle,
      bgClass: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800',
      textClass: 'text-yellow-800 dark:text-yellow-200',
      iconClass: 'text-yellow-600 dark:text-yellow-400',
    },
    info: {
      icon: Info,
      bgClass: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
      textClass: 'text-blue-800 dark:text-blue-200',
      iconClass: 'text-blue-600 dark:text-blue-400',
    },
  };

  const config = variantConfig[toast.variant];
  const Icon = config.icon;

  return (
    <div
      role="alert"
      className={cn(
        'pointer-events-auto w-full max-w-md rounded-lg border shadow-lg overflow-hidden',
        'transition-all duration-200 ease-out',
        config.bgClass,
        isExiting
          ? 'animate-out fade-out-0 slide-out-to-bottom-full'
          : 'animate-in fade-in-0 slide-in-from-bottom-full'
      )}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        <Icon
          className={cn('h-5 w-5 flex-shrink-0 mt-0.5', config.iconClass)}
          aria-hidden="true"
        />

        {/* Message */}
        <div className={cn('flex-1 text-sm font-medium min-w-0', config.textClass)}>
          {toast.message}
        </div>

        {/* Action Button */}
        {toast.action && (
          <button
            onClick={handleAction}
            className={cn(
              'text-sm font-semibold touch-target px-3 py-1 rounded-md transition-colors',
              config.textClass,
              'hover:bg-black/10 dark:hover:bg-card/10 active:scale-95'
            )}
          >
            {toast.action.label}
          </button>
        )}

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className={cn(
            'touch-target p-1 rounded-md transition-colors flex-shrink-0',
            config.textClass,
            'hover:bg-black/10 dark:hover:bg-card/10 active:scale-95'
          )}
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
