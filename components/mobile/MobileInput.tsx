'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, X } from 'lucide-react';
import { impactFeedback, selectionFeedback } from '@/lib/haptics';

export interface MobileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  showClearButton?: boolean;
  onClear?: () => void;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const MobileInput = React.forwardRef<HTMLInputElement, MobileInputProps>(
  (
    {
      className,
      type,
      label,
      error,
      helperText,
      showClearButton = false,
      onClear,
      leftIcon,
      rightIcon,
      disabled,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const [isFocused, setIsFocused] = React.useState(false);
    const inputId = React.useId();
    const errorId = React.useId();
    const helperId = React.useId();

    const isPasswordType = type === 'password';
    const currentType = isPasswordType && showPassword ? 'text' : type;

    const handleClear = () => {
      impactFeedback('light');
      onClear?.();
    };

    const togglePasswordVisibility = () => {
      selectionFeedback();
      setShowPassword(!showPassword);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      props.onBlur?.(e);
    };

    return (
      <div className="w-full">
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'block text-sm font-medium mb-1.5 transition-colors',
              error
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-700 dark:text-gray-300'
            )}
          >
            {label}
            {props.required && (
              <span className="text-red-500 ml-1" aria-label="required">
                *
              </span>
            )}
          </label>
        )}

        {/* Input Container */}
        <div className="relative">
          {/* Left Icon */}
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none">
              {leftIcon}
            </div>
          )}

          {/* Input Field */}
          <input
            ref={ref}
            id={inputId}
            type={currentType}
            disabled={disabled}
            className={cn(
              // Base styles
              'flex w-full rounded-lg border bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm transition-all',
              // Spacing - mobile-optimized touch targets
              'h-12 px-4 py-3 text-base',
              // Add padding for icons
              leftIcon && 'pl-10',
              (rightIcon || showClearButton || isPasswordType) && 'pr-10',
              // Focus states
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              // Error states
              error
                ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-500/30'
                : isFocused
                ? 'border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/30'
                : 'border-gray-300 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500/30',
              // Disabled states
              disabled && 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800',
              // Placeholder
              'placeholder:text-gray-400 dark:placeholder:text-gray-500',
              className
            )}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={
              error ? errorId : helperText ? helperId : undefined
            }
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...props}
          />

          {/* Right Icons */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {/* Clear Button */}
            {showClearButton && props.value && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="touch-target p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-md active:scale-95"
                aria-label="Clear input"
                tabIndex={-1}
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {/* Password Toggle */}
            {isPasswordType && (
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="touch-target p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-md active:scale-95"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            )}

            {/* Custom Right Icon */}
            {rightIcon && !isPasswordType && !showClearButton && (
              <div className="text-gray-400 dark:text-gray-500 pointer-events-none px-2">
                {rightIcon}
              </div>
            )}
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
            className="mt-1.5 text-sm text-gray-500 dark:text-gray-400"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

MobileInput.displayName = 'MobileInput';

export { MobileInput };
