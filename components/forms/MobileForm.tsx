'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface MobileFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
  /**
   * Adds padding and max-width for better mobile UX
   */
  contained?: boolean;
  /**
   * Shows a sticky footer with action buttons
   */
  stickyFooter?: boolean;
  /**
   * Footer content (typically buttons)
   */
  footer?: React.ReactNode;
}

export function MobileForm({
  children,
  contained = true,
  stickyFooter = false,
  footer,
  className,
  ...props
}: MobileFormProps) {
  return (
    <form
      className={cn(
        'w-full',
        contained && 'max-w-2xl mx-auto px-4 sm:px-6',
        className
      )}
      {...props}
    >
      <div className={cn('space-y-6', stickyFooter && footer && 'pb-24 md:pb-6')}>
        {children}
      </div>

      {footer && (
        <div
          className={cn(
            'flex gap-3 pt-6',
            stickyFooter &&
              'fixed bottom-0 left-0 right-0 bg-card dark:bg-background border-t border-border p-4 pb-safe md:relative md:border-t-0 md:bg-transparent md:dark:bg-transparent md:pb-0'
          )}
        >
          {footer}
        </div>
      )}
    </form>
  );
}

export interface FormSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({
  title,
  description,
  children,
  className,
}: FormSectionProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h3 className="text-base sm:text-lg font-semibold text-foreground">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export interface FormFieldProps {
  children: React.ReactNode;
  /**
   * Use horizontal layout on larger screens
   * Label on left, input on right
   */
  horizontal?: boolean;
  className?: string;
}

export function FormField({ children, horizontal = false, className }: FormFieldProps) {
  return (
    <div
      className={cn(
        'w-full',
        horizontal && 'md:grid md:grid-cols-3 md:gap-4 md:items-start',
        className
      )}
    >
      {children}
    </div>
  );
}

export interface FormActionsProps {
  children: React.ReactNode;
  /**
   * Align buttons (default: right on desktop, full-width on mobile)
   */
  align?: 'left' | 'center' | 'right';
  /**
   * Stack buttons vertically on mobile
   */
  stack?: boolean;
  className?: string;
}

export function FormActions({
  children,
  align = 'right',
  stack = false,
  className,
}: FormActionsProps) {
  const alignmentClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  };

  return (
    <div
      className={cn(
        'flex gap-3 w-full',
        stack ? 'flex-col sm:flex-row' : 'flex-row',
        alignmentClasses[align],
        className
      )}
    >
      {children}
    </div>
  );
}

export interface FormGroupProps {
  children: React.ReactNode;
  /**
   * Number of columns on desktop (1-4)
   */
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export function FormGroup({ children, columns = 1, className }: FormGroupProps) {
  const columnClasses = {
    1: '',
    2: 'sm:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'lg:grid-cols-4',
  };

  return (
    <div
      className={cn(
        'grid gap-4',
        columns > 1 && columnClasses[columns],
        className
      )}
    >
      {children}
    </div>
  );
}

export interface FormErrorProps {
  message: string;
  className?: string;
}

export function FormError({ message, className }: FormErrorProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className={cn(
        'rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-red-600 dark:text-red-400 text-lg">⚠</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

export interface FormSuccessProps {
  message: string;
  className?: string;
}

export function FormSuccess({ message, className }: FormSuccessProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className={cn(
        'rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-green-600 dark:text-green-400 text-lg">✓</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

export interface FormDividerProps {
  label?: string;
  className?: string;
}

export function FormDivider({ label, className }: FormDividerProps) {
  return (
    <div className={cn('relative py-4', className)}>
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-border" />
      </div>
      {label && (
        <div className="relative flex justify-center">
          <span className="bg-card dark:bg-background px-3 text-sm text-muted-foreground dark:text-muted-foreground">
            {label}
          </span>
        </div>
      )}
    </div>
  );
}
