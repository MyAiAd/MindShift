'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { 
  Inbox, 
  Search, 
  AlertCircle, 
  FileQuestion, 
  CheckCircle2,
  LucideIcon 
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface EmptyStateProps {
  variant?: 'default' | 'search' | 'error' | 'success' | 'custom';
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  children?: React.ReactNode;
}

const defaultIcons: Record<string, LucideIcon> = {
  default: Inbox,
  search: Search,
  error: AlertCircle,
  success: CheckCircle2,
  custom: FileQuestion,
};

export function EmptyState({
  variant = 'default',
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  children,
}: EmptyStateProps) {
  const Icon = icon || defaultIcons[variant];

  const variantColors = {
    default: 'text-gray-400 dark:text-gray-600',
    search: 'text-blue-400 dark:text-blue-600',
    error: 'text-red-400 dark:text-red-600',
    success: 'text-green-400 dark:text-green-600',
    custom: 'text-gray-400 dark:text-gray-600',
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-6 sm:p-8 lg:p-12 min-h-[300px] sm:min-h-[400px]',
        className
      )}
      role="status"
      aria-live="polite"
    >
      {/* Icon */}
      <div className="mb-4 sm:mb-6" aria-hidden="true">
        <Icon className={cn('w-12 h-12 sm:w-16 sm:h-16', variantColors[variant])} strokeWidth={1.5} />
      </div>

      {/* Title */}
      <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-md mb-6">
          {description}
        </p>
      )}

      {/* Custom Content */}
      {children && (
        <div className="mb-6 w-full max-w-md">
          {children}
        </div>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {action && (
            <Button
              onClick={action.onClick}
              className="w-full sm:w-auto touch-target"
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="outline"
              className="w-full sm:w-auto touch-target"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Preset empty states for common scenarios
export function NoResultsEmptyState({ 
  searchQuery, 
  onClear 
}: { 
  searchQuery?: string; 
  onClear?: () => void;
}) {
  return (
    <EmptyState
      variant="search"
      title={searchQuery ? `No results for "${searchQuery}"` : 'No results found'}
      description="Try adjusting your search or filters to find what you're looking for."
      action={onClear ? { label: 'Clear Search', onClick: onClear } : undefined}
    />
  );
}

export function NoDataEmptyState({ 
  title, 
  description, 
  actionLabel, 
  onAction 
}: { 
  title: string; 
  description: string; 
  actionLabel?: string; 
  onAction?: () => void;
}) {
  return (
    <EmptyState
      variant="default"
      icon={Inbox}
      title={title}
      description={description}
      action={actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined}
    />
  );
}

export function ErrorEmptyState({ 
  title = 'Something went wrong', 
  description = 'We encountered an error loading this content. Please try again.', 
  onRetry 
}: { 
  title?: string; 
  description?: string; 
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      variant="error"
      title={title}
      description={description}
      action={onRetry ? { label: 'Try Again', onClick: onRetry } : undefined}
    />
  );
}

export function SuccessEmptyState({ 
  title, 
  description, 
  onContinue 
}: { 
  title: string; 
  description: string; 
  onContinue?: () => void;
}) {
  return (
    <EmptyState
      variant="success"
      title={title}
      description={description}
      action={onContinue ? { label: 'Continue', onClick: onContinue } : undefined}
    />
  );
}
