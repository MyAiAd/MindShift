'use client';

import * as React from 'react';

export type ValidationRule<T = any> = {
  validate: (value: T) => boolean;
  message: string;
};

export type FieldValidation = {
  required?: boolean | string;
  minLength?: number | { value: number; message?: string };
  maxLength?: number | { value: number; message?: string };
  min?: number | { value: number; message?: string };
  max?: number | { value: number; message?: string };
  pattern?: RegExp | { value: RegExp; message?: string };
  email?: boolean | string;
  url?: boolean | string;
  custom?: ValidationRule | ValidationRule[];
};

export interface FieldState {
  value: any;
  error: string | null;
  touched: boolean;
  dirty: boolean;
}

export interface FormState {
  [key: string]: FieldState;
}

export interface UseFormOptions {
  initialValues?: Record<string, any>;
  validations?: Record<string, FieldValidation>;
  onSubmit?: (values: Record<string, any>) => void | Promise<void>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

export function useForm({
  initialValues = {},
  validations = {},
  onSubmit,
  validateOnChange = false,
  validateOnBlur = true,
}: UseFormOptions = {}) {
  const [formState, setFormState] = React.useState<FormState>(() => {
    const state: FormState = {};
    Object.keys(initialValues).forEach((key) => {
      state[key] = {
        value: initialValues[key],
        error: null,
        touched: false,
        dirty: false,
      };
    });
    return state;
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = React.useState<string | null>(null);

  // Validate a single field
  const validateField = React.useCallback(
    (name: string, value: any): string | null => {
      const rules = validations[name];
      if (!rules) return null;

      // Required validation
      if (rules.required) {
        const isEmpty =
          value === undefined ||
          value === null ||
          value === '' ||
          (Array.isArray(value) && value.length === 0);

        if (isEmpty) {
          return typeof rules.required === 'string'
            ? rules.required
            : 'This field is required';
        }
      }

      // Skip other validations if empty and not required
      if (!value && !rules.required) return null;

      // Min length validation
      if (rules.minLength) {
        const minLength =
          typeof rules.minLength === 'number'
            ? rules.minLength
            : rules.minLength.value;
        const message =
          typeof rules.minLength === 'object' && rules.minLength.message
            ? rules.minLength.message
            : `Must be at least ${minLength} characters`;

        if (String(value).length < minLength) {
          return message;
        }
      }

      // Max length validation
      if (rules.maxLength) {
        const maxLength =
          typeof rules.maxLength === 'number'
            ? rules.maxLength
            : rules.maxLength.value;
        const message =
          typeof rules.maxLength === 'object' && rules.maxLength.message
            ? rules.maxLength.message
            : `Must be no more than ${maxLength} characters`;

        if (String(value).length > maxLength) {
          return message;
        }
      }

      // Min value validation
      if (rules.min !== undefined) {
        const min = typeof rules.min === 'number' ? rules.min : rules.min.value;
        const message =
          typeof rules.min === 'object' && rules.min.message
            ? rules.min.message
            : `Must be at least ${min}`;

        if (Number(value) < min) {
          return message;
        }
      }

      // Max value validation
      if (rules.max !== undefined) {
        const max = typeof rules.max === 'number' ? rules.max : rules.max.value;
        const message =
          typeof rules.max === 'object' && rules.max.message
            ? rules.max.message
            : `Must be no more than ${max}`;

        if (Number(value) > max) {
          return message;
        }
      }

      // Email validation
      if (rules.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const message =
          typeof rules.email === 'string' ? rules.email : 'Invalid email address';

        if (!emailRegex.test(String(value))) {
          return message;
        }
      }

      // URL validation
      if (rules.url) {
        try {
          new URL(String(value));
        } catch {
          const message =
            typeof rules.url === 'string' ? rules.url : 'Invalid URL';
          return message;
        }
      }

      // Pattern validation
      if (rules.pattern) {
        const pattern =
          rules.pattern instanceof RegExp ? rules.pattern : rules.pattern.value;
        const message =
          !(rules.pattern instanceof RegExp) && rules.pattern.message
            ? rules.pattern.message
            : 'Invalid format';

        if (!pattern.test(String(value))) {
          return message;
        }
      }

      // Custom validation
      if (rules.custom) {
        const customRules = Array.isArray(rules.custom)
          ? rules.custom
          : [rules.custom];

        for (const rule of customRules) {
          if (!rule.validate(value)) {
            return rule.message;
          }
        }
      }

      return null;
    },
    [validations]
  );

  // Validate all fields
  const validateForm = React.useCallback((): boolean => {
    let isValid = true;
    const newState = { ...formState };

    Object.keys(formState).forEach((name) => {
      const error = validateField(name, formState[name].value);
      newState[name] = {
        ...newState[name],
        error,
        touched: true,
      };
      if (error) isValid = false;
    });

    setFormState(newState);
    return isValid;
  }, [formState, validateField]);

  // Set field value
  const setFieldValue = React.useCallback(
    (name: string, value: any) => {
      setFormState((prev) => {
        const newState = {
          ...prev,
          [name]: {
            ...prev[name],
            value,
            dirty: true,
            error: validateOnChange ? validateField(name, value) : prev[name].error,
          },
        };
        return newState;
      });
    },
    [validateField, validateOnChange]
  );

  // Set field touched
  const setFieldTouched = React.useCallback(
    (name: string, touched: boolean = true) => {
      setFormState((prev) => ({
        ...prev,
        [name]: {
          ...prev[name],
          touched,
          error:
            touched && validateOnBlur
              ? validateField(name, prev[name].value)
              : prev[name].error,
        },
      }));
    },
    [validateField, validateOnBlur]
  );

  // Handle field change
  const handleChange = React.useCallback(
    (name: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = e.target.type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : e.target.value;
      setFieldValue(name, value);
    },
    [setFieldValue]
  );

  // Handle field blur
  const handleBlur = React.useCallback(
    (name: string) => () => {
      setFieldTouched(name, true);
    },
    [setFieldTouched]
  );

  // Reset form
  const resetForm = React.useCallback(() => {
    const state: FormState = {};
    Object.keys(initialValues).forEach((key) => {
      state[key] = {
        value: initialValues[key],
        error: null,
        touched: false,
        dirty: false,
      };
    });
    setFormState(state);
    setSubmitError(null);
    setSubmitSuccess(null);
  }, [initialValues]);

  // Handle form submission
  const handleSubmit = React.useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();

      const isValid = validateForm();
      if (!isValid) {
        setSubmitError('Please fix the errors above');
        setSubmitSuccess(null);
        return;
      }

      if (!onSubmit) return;

      setIsSubmitting(true);
      setSubmitError(null);
      setSubmitSuccess(null);

      const values: Record<string, any> = {};
      Object.keys(formState).forEach((key) => {
        values[key] = formState[key].value;
      });

      const result = onSubmit(values);

      if (result instanceof Promise) {
        result
          .then(() => {
            setIsSubmitting(false);
            setSubmitSuccess('Form submitted successfully');
          })
          .catch((error) => {
            setIsSubmitting(false);
            setSubmitError(error.message || 'An error occurred');
          });
      } else {
        setIsSubmitting(false);
        setSubmitSuccess('Form submitted successfully');
      }
    },
    [formState, onSubmit, validateForm]
  );

  // Get field props
  const getFieldProps = React.useCallback(
    (name: string) => ({
      value: formState[name]?.value ?? '',
      onChange: handleChange(name),
      onBlur: handleBlur(name),
      error: formState[name]?.touched ? formState[name]?.error : null,
    }),
    [formState, handleChange, handleBlur]
  );

  // Get form values
  const getValues = React.useCallback(() => {
    const values: Record<string, any> = {};
    Object.keys(formState).forEach((key) => {
      values[key] = formState[key].value;
    });
    return values;
  }, [formState]);

  // Check if form is dirty
  const isDirty = React.useMemo(() => {
    return Object.values(formState).some((field) => field.dirty);
  }, [formState]);

  // Check if form is valid
  const isValid = React.useMemo(() => {
    return Object.values(formState).every((field) => !field.error);
  }, [formState]);

  return {
    formState,
    isSubmitting,
    submitError,
    submitSuccess,
    isDirty,
    isValid,
    setFieldValue,
    setFieldTouched,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    validateForm,
    getFieldProps,
    getValues,
    setSubmitError,
    setSubmitSuccess,
  };
}

// Common validation rules
export const validations = {
  required: (message?: string): FieldValidation => ({
    required: message || 'This field is required',
  }),

  email: (message?: string): FieldValidation => ({
    email: message || 'Invalid email address',
  }),

  minLength: (length: number, message?: string): FieldValidation => ({
    minLength: {
      value: length,
      message: message || `Must be at least ${length} characters`,
    },
  }),

  maxLength: (length: number, message?: string): FieldValidation => ({
    maxLength: {
      value: length,
      message: message || `Must be no more than ${length} characters`,
    },
  }),

  min: (value: number, message?: string): FieldValidation => ({
    min: {
      value,
      message: message || `Must be at least ${value}`,
    },
  }),

  max: (value: number, message?: string): FieldValidation => ({
    max: {
      value,
      message: message || `Must be no more than ${value}`,
    },
  }),

  pattern: (regex: RegExp, message?: string): FieldValidation => ({
    pattern: {
      value: regex,
      message: message || 'Invalid format',
    },
  }),

  phone: (message?: string): FieldValidation => ({
    pattern: {
      value: /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/,
      message: message || 'Invalid phone number',
    },
  }),

  url: (message?: string): FieldValidation => ({
    url: message || 'Invalid URL',
  }),

  match: (fieldName: string, message?: string): ValidationRule => ({
    validate: (value: any) => {
      // Note: This is a simplified version. In a real app, you'd pass formValues
      // or implement a more sophisticated validation context
      return true; // Placeholder - requires form context to properly compare fields
    },
    message: message || `Must match ${fieldName}`,
  }),
};
