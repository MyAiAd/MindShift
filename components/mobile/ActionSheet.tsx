'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { impactFeedback, selectionFeedback } from '@/lib/haptics';

export interface ActionSheetAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  actions: ActionSheetAction[];
  showCancelButton?: boolean;
  cancelLabel?: string;
  className?: string;
}

export function ActionSheet({
  isOpen,
  onClose,
  title,
  description,
  actions,
  showCancelButton = true,
  cancelLabel = 'Cancel',
  className,
}: ActionSheetProps) {
  const [isMounted, setIsMounted] = React.useState(false);
  const sheetRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handle Escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when sheet is open
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const handleClose = () => {
    impactFeedback('light');
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleActionClick = (action: ActionSheetAction) => {
    if (action.disabled) return;
    
    if (action.variant === 'destructive') {
      impactFeedback('medium');
    } else {
      selectionFeedback();
    }
    
    action.onClick();
    handleClose();
  };

  if (!isMounted) return null;

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center md:items-center"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'action-sheet-title' : undefined}
      aria-describedby={description ? 'action-sheet-description' : undefined}
    >
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200',
          isOpen ? 'animate-in fade-in-0' : 'animate-out fade-out-0'
        )}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          'relative w-full max-w-lg bg-card dark:bg-background shadow-xl',
          'md:rounded-lg md:mb-0',
          'rounded-t-2xl pb-safe',
          'transition-transform duration-300 ease-out',
          isOpen
            ? 'animate-in slide-in-from-bottom md:slide-in-from-bottom-4 md:fade-in-0'
            : 'animate-out slide-out-to-bottom md:slide-out-to-bottom-4 md:fade-out-0',
          className
        )}
      >
        {/* Handle (Mobile only) */}
        <div className="md:hidden flex justify-center pt-3 pb-2">
          <div
            className="w-10 h-1 bg-border rounded-full"
            aria-hidden="true"
          />
        </div>

        {/* Header */}
        {(title || description) && (
          <div className="px-4 pt-4 pb-3 border-b border-border">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {title && (
                  <h2
                    id="action-sheet-title"
                    className="text-lg font-semibold text-foreground"
                  >
                    {title}
                  </h2>
                )}
                {description && (
                  <p
                    id="action-sheet-description"
                    className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground"
                  >
                    {description}
                  </p>
                )}
              </div>
              
              {/* Close button (Desktop) */}
              <button
                onClick={handleClose}
                className="hidden md:block touch-target p-2 text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground rounded-md transition-colors active:scale-95"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="py-2">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleActionClick(action)}
              disabled={action.disabled}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors touch-target',
                'active:scale-[0.99] active:opacity-90',
                action.variant === 'destructive'
                  ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                  : 'text-foreground hover:bg-secondary/20 dark:hover:bg-card',
                action.disabled &&
                  'opacity-50 cursor-not-allowed hover:bg-transparent dark:hover:bg-transparent'
              )}
            >
              {/* Icon */}
              {action.icon && (
                <div
                  className={cn(
                    'flex-shrink-0',
                    action.variant === 'destructive'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-muted-foreground dark:text-muted-foreground'
                  )}
                >
                  {action.icon}
                </div>
              )}

              {/* Label */}
              <span
                className={cn(
                  'text-base font-medium',
                  action.variant === 'destructive' && 'font-semibold'
                )}
              >
                {action.label}
              </span>
            </button>
          ))}
        </div>

        {/* Cancel Button */}
        {showCancelButton && (
          <>
            <div className="h-2 bg-secondary" />
            <div className="p-2">
              <button
                onClick={handleClose}
                className="w-full touch-target px-4 py-3 text-base font-semibold text-foreground hover:bg-secondary/20 dark:hover:bg-card rounded-lg transition-colors active:scale-[0.99]"
              >
                {cancelLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
