'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check, ChevronDown } from 'lucide-react';
import { selectionFeedback } from '@/lib/haptics';

export interface MobileSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface MobileSelectProps {
  label?: string;
  value?: string;
  options: MobileSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  /**
   * Use native select on mobile devices for better UX
   * Set to false to always use custom dropdown
   */
  useNativeOnMobile?: boolean;
}

export function MobileSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  error,
  helperText,
  disabled = false,
  required = false,
  className,
  useNativeOnMobile = true,
}: MobileSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const selectId = React.useId();
  const errorId = React.useId();
  const helperId = React.useId();
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Detect if we should use native select
  const useNative = useNativeOnMobile && typeof window !== 'undefined' && 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const handleNativeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    selectionFeedback();
    onChange(e.target.value);
  };

  const handleCustomSelect = (optionValue: string) => {
    selectionFeedback();
    onChange(optionValue);
    setIsOpen(false);
  };

  const toggleDropdown = () => {
    if (!disabled) {
      selectionFeedback();
      setIsOpen(!isOpen);
    }
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on Escape key
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  return (
    <div className={cn('w-full', className)}>
      {/* Label */}
      {label && (
        <label
          htmlFor={selectId}
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

      {/* Native Select (Mobile) */}
      {useNative ? (
        <div className="relative">
          <select
            id={selectId}
            value={value || ''}
            onChange={handleNativeChange}
            disabled={disabled}
            required={required}
            className={cn(
              // Base styles
              'w-full appearance-none rounded-lg border bg-card dark:bg-background text-foreground shadow-sm transition-all',
              // Spacing - mobile-optimized touch targets
              'h-12 px-4 py-3 pr-10 text-base',
              // Focus states
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              // Error states
              error
                ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-500/30'
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
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>

          {/* Chevron Icon */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground dark:text-muted-foreground">
            <ChevronDown className="h-5 w-5" />
          </div>
        </div>
      ) : (
        /* Custom Dropdown (Desktop) */
        <div ref={dropdownRef} className="relative">
          {/* Trigger Button */}
          <button
            type="button"
            id={selectId}
            onClick={toggleDropdown}
            disabled={disabled}
            className={cn(
              // Base styles
              'w-full flex items-center justify-between rounded-lg border bg-card dark:bg-background text-foreground shadow-sm transition-all',
              // Spacing
              'h-12 px-4 py-3 text-base text-left',
              // Focus states
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              // Error states
              error
                ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-500/30'
                : isOpen || isFocused
                ? 'border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/30'
                : 'border-border focus:border-indigo-500 focus:ring-indigo-500/30',
              // Disabled states
              disabled && 'opacity-50 cursor-not-allowed bg-secondary/20',
              // Active states
              !disabled && 'active:scale-[0.99]'
            )}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={
              error ? errorId : helperText ? helperId : undefined
            }
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          >
            <span className={selectedOption ? '' : 'text-muted-foreground dark:text-muted-foreground'}>
              {selectedOption?.label || placeholder}
            </span>
            <ChevronDown
              className={cn(
                'h-5 w-5 text-muted-foreground dark:text-muted-foreground transition-transform duration-200',
                isOpen && 'rotate-180'
              )}
            />
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <div
              className={cn(
                'absolute z-50 w-full mt-2 bg-card dark:bg-background border border-border rounded-lg shadow-lg overflow-hidden',
                'animate-in fade-in-0 slide-in-from-top-2 duration-200'
              )}
              role="listbox"
              aria-labelledby={selectId}
            >
              <div className="max-h-60 overflow-y-auto py-1">
                {options.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={option.disabled}
                      onClick={() => handleCustomSelect(option.value)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 text-left text-base transition-colors touch-target',
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                          : 'text-foreground hover:bg-secondary/20 dark:hover:bg-card',
                        option.disabled && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <span>{option.label}</span>
                      {isSelected && <Check className="h-5 w-5" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

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
