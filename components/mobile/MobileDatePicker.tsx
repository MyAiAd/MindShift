'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Calendar } from 'lucide-react';
import { selectionFeedback } from '@/lib/haptics';

export interface MobileDatePickerProps {
  label?: string;
  value?: string; // ISO date string (YYYY-MM-DD)
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  min?: string; // ISO date string
  max?: string; // ISO date string
  className?: string;
}

export function MobileDatePicker({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  error,
  helperText,
  disabled = false,
  required = false,
  min,
  max,
  className,
}: MobileDatePickerProps) {
  const [isFocused, setIsFocused] = React.useState(false);
  const inputId = React.useId();
  const errorId = React.useId();
  const helperId = React.useId();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    selectionFeedback();
    onChange(e.target.value);
  };

  // Format date for display (native input shows native format)
  const displayValue = value || '';

  return (
    <div className={cn('w-full', className)}>
      {/* Label */}
      {label && (
        <label
          htmlFor={inputId}
          className={cn(
            'block text-sm font-medium mb-1.5 transition-colors',
            error
              ? 'text-red-600 dark:text-red-400'
              : 'text-foreground'
          )}
        >
          {label}
          {required && (
            <span className="text-red-500 ml-1" aria-label="required">
              *
            </span>
          )}
        </label>
      )}

      {/* Date Input Container */}
      <div className="relative">
        {/* Native Date Input */}
        <input
          id={inputId}
          type="date"
          value={displayValue}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          min={min}
          max={max}
          placeholder={placeholder}
          className={cn(
            // Base styles
            'w-full rounded-lg border bg-card dark:bg-background text-foreground shadow-sm transition-all',
            // Spacing - mobile-optimized touch targets
            'h-12 px-4 py-3 pr-10 text-base',
            // Focus states
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            // Error states
            error
              ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-500/30'
              : isFocused
              ? 'border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/30'
              : 'border-border focus:border-indigo-500 focus:ring-indigo-500/30',
            // Disabled states
            disabled && 'opacity-50 cursor-not-allowed bg-secondary/20',
            // Hide default calendar icon on some browsers, we'll show our own
            '[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:h-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer'
          )}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={
            error ? errorId : helperText ? helperId : undefined
          }
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />

        {/* Calendar Icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground dark:text-muted-foreground">
          <Calendar className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <p
          id={errorId}
          className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-start gap-1"
          role="alert"
        >
          <span className="inline-block mt-0.5">⚠</span>
          <span>{error}</span>
        </p>
      )}

      {/* Helper Text */}
      {helperText && !error && (
        <p
          id={helperId}
          className="mt-1.5 text-sm text-muted-foreground dark:text-muted-foreground"
        >
          {helperText}
        </p>
      )}
    </div>
  );
}

// Time Picker Component
export interface MobileTimePickerProps {
  label?: string;
  value?: string; // Time string (HH:MM)
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  min?: string; // Time string (HH:MM)
  max?: string; // Time string (HH:MM)
  step?: number; // Minutes (default: 1)
  className?: string;
}

export function MobileTimePicker({
  label,
  value,
  onChange,
  placeholder = 'Select time',
  error,
  helperText,
  disabled = false,
  required = false,
  min,
  max,
  step = 1,
  className,
}: MobileTimePickerProps) {
  const [isFocused, setIsFocused] = React.useState(false);
  const inputId = React.useId();
  const errorId = React.useId();
  const helperId = React.useId();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    selectionFeedback();
    onChange(e.target.value);
  };

  return (
    <div className={cn('w-full', className)}>
      {/* Label */}
      {label && (
        <label
          htmlFor={inputId}
          className={cn(
            'block text-sm font-medium mb-1.5 transition-colors',
            error
              ? 'text-red-600 dark:text-red-400'
              : 'text-foreground'
          )}
        >
          {label}
          {required && (
            <span className="text-red-500 ml-1" aria-label="required">
              *
            </span>
          )}
        </label>
      )}

      {/* Time Input */}
      <input
        id={inputId}
        type="time"
        value={value || ''}
        onChange={handleChange}
        disabled={disabled}
        required={required}
        min={min}
        max={max}
        step={step * 60} // Convert minutes to seconds
        placeholder={placeholder}
        className={cn(
          // Base styles
          'w-full rounded-lg border bg-card dark:bg-background text-foreground shadow-sm transition-all',
          // Spacing - mobile-optimized touch targets
          'h-12 px-4 py-3 text-base',
          // Focus states
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          // Error states
          error
            ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-500/30'
            : isFocused
            ? 'border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/30'
            : 'border-border focus:border-indigo-500 focus:ring-indigo-500/30',
          // Disabled states
          disabled && 'opacity-50 cursor-not-allowed bg-secondary/20'
        )}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={
          error ? errorId : helperText ? helperId : undefined
        }
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />

      {/* Error Message */}
      {error && (
        <p
          id={errorId}
          className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-start gap-1"
          role="alert"
        >
          <span className="inline-block mt-0.5">⚠</span>
          <span>{error}</span>
        </p>
      )}

      {/* Helper Text */}
      {helperText && !error && (
        <p
          id={helperId}
          className="mt-1.5 text-sm text-muted-foreground dark:text-muted-foreground"
        >
          {helperText}
        </p>
      )}
    </div>
  );
}
