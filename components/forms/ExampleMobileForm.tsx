'use client';

import * as React from 'react';
import { MobileInput } from '@/components/mobile/MobileInput';
import { MobileSelect } from '@/components/mobile/MobileSelect';
import { MobileDatePicker, MobileTimePicker } from '@/components/mobile/MobileDatePicker';
import {
  MobileForm,
  FormSection,
  FormField,
  FormActions,
  FormGroup,
  FormError,
  FormSuccess,
  FormDivider,
} from '@/components/forms/MobileForm';
import { useForm, validations } from '@/lib/useForm';
import { Button } from '@/components/ui/button';
import { Mail, Phone, User, MapPin } from 'lucide-react';

/**
 * Example form demonstrating all mobile form components
 * This can be used as a reference for building mobile-optimized forms
 */
export function ExampleMobileForm() {
  const {
    formState,
    isSubmitting,
    submitError,
    submitSuccess,
    isDirty,
    isValid,
    handleSubmit,
    getFieldProps,
    resetForm,
  } = useForm({
    initialValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      country: '',
      state: '',
      city: '',
      dateOfBirth: '',
      appointmentTime: '',
      bio: '',
      agreeToTerms: false,
    },
    validations: {
      firstName: {
        ...validations.required('First name is required'),
        ...validations.minLength(2, 'First name must be at least 2 characters'),
      },
      lastName: {
        ...validations.required('Last name is required'),
        ...validations.minLength(2, 'Last name must be at least 2 characters'),
      },
      email: {
        ...validations.required('Email is required'),
        ...validations.email('Please enter a valid email address'),
      },
      phone: {
        ...validations.phone('Please enter a valid phone number'),
      },
      country: {
        ...validations.required('Please select a country'),
      },
      dateOfBirth: {
        ...validations.required('Date of birth is required'),
      },
      bio: {
        ...validations.maxLength(500, 'Bio must be no more than 500 characters'),
      },
      agreeToTerms: {
        required: 'You must agree to the terms and conditions',
      },
    },
    onSubmit: async (values) => {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log('Form submitted:', values);
      // Handle successful submission
    },
    validateOnBlur: true,
    validateOnChange: false,
  });

  const countryOptions = [
    { value: 'us', label: 'United States' },
    { value: 'ca', label: 'Canada' },
    { value: 'uk', label: 'United Kingdom' },
    { value: 'au', label: 'Australia' },
    { value: 'de', label: 'Germany' },
    { value: 'fr', label: 'France' },
  ];

  const stateOptions = [
    { value: 'ca', label: 'California' },
    { value: 'ny', label: 'New York' },
    { value: 'tx', label: 'Texas' },
    { value: 'fl', label: 'Florida' },
    { value: 'wa', label: 'Washington' },
  ];

  // Adapter function for components that expect onChange(value: string)
  const getSelectFieldProps = (name: string) => {
    const props = getFieldProps(name);
    return {
      value: props.value,
      onChange: (value: string) => {
        const event = { target: { value } } as React.ChangeEvent<HTMLSelectElement>;
        props.onChange(event);
      },
      error: props.error || undefined,
    };
  };

  return (
    <MobileForm
      onSubmit={handleSubmit}
      stickyFooter
      footer={
        <FormActions stack>
          <Button
            type="button"
            variant="outline"
            onClick={resetForm}
            disabled={isSubmitting || !isDirty}
            className="w-full sm:w-auto"
          >
            Reset
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !isValid}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </FormActions>
      }
    >
      {/* Form-level messages */}
      {submitError && <FormError message={submitError} />}
      {submitSuccess && <FormSuccess message={submitSuccess} />}

      {/* Personal Information Section */}
      <FormSection
        title="Personal Information"
        description="Please provide your basic details"
      >
        <FormGroup columns={2}>
          <FormField>
            <MobileInput
              label="First Name"
              placeholder="John"
              leftIcon={<User className="h-5 w-5" />}
              required
              value={formState.firstName?.value || ''}
              onChange={(e) => getFieldProps('firstName').onChange(e)}
              onBlur={getFieldProps('firstName').onBlur}
              error={getFieldProps('firstName').error || undefined}
            />
          </FormField>

          <FormField>
            <MobileInput
              label="Last Name"
              placeholder="Doe"
              required
              value={formState.lastName?.value || ''}
              onChange={(e) => getFieldProps('lastName').onChange(e)}
              onBlur={getFieldProps('lastName').onBlur}
              error={getFieldProps('lastName').error || undefined}
            />
          </FormField>
        </FormGroup>

        <FormField>
          <MobileInput
            type="email"
            label="Email Address"
            placeholder="john.doe@example.com"
            leftIcon={<Mail className="h-5 w-5" />}
            showClearButton
            onClear={() => {
              const event = { target: { value: '' } } as React.ChangeEvent<HTMLInputElement>;
              getFieldProps('email').onChange(event);
            }}
            required
            value={formState.email?.value || ''}
            onChange={(e) => getFieldProps('email').onChange(e)}
            onBlur={getFieldProps('email').onBlur}
            error={getFieldProps('email').error || undefined}
          />
        </FormField>

        <FormField>
          <MobileInput
            type="tel"
            label="Phone Number"
            placeholder="+1 (555) 123-4567"
            leftIcon={<Phone className="h-5 w-5" />}
            helperText="Optional - for appointment reminders"
            value={formState.phone?.value || ''}
            onChange={(e) => getFieldProps('phone').onChange(e)}
            onBlur={getFieldProps('phone').onBlur}
            error={getFieldProps('phone').error || undefined}
          />
        </FormField>
      </FormSection>

      <FormDivider />

      {/* Location Section */}
      <FormSection
        title="Location"
        description="Where are you located?"
      >
        <FormField>
          <MobileSelect
            label="Country"
            options={countryOptions}
            placeholder="Select your country"
            required
            {...getSelectFieldProps('country')}
          />
        </FormField>

        <FormGroup columns={2}>
          <FormField>
            <MobileSelect
              label="State/Province"
              options={stateOptions}
              placeholder="Select state"
              disabled={!formState.country?.value}
              helperText={!formState.country?.value ? 'Select a country first' : undefined}
              {...getSelectFieldProps('state')}
            />
          </FormField>

          <FormField>
            <MobileInput
              label="City"
              placeholder="San Francisco"
              leftIcon={<MapPin className="h-5 w-5" />}
              value={formState.city?.value || ''}
              onChange={(e) => getFieldProps('city').onChange(e)}
              onBlur={getFieldProps('city').onBlur}
              error={getFieldProps('city').error || undefined}
            />
          </FormField>
        </FormGroup>
      </FormSection>

      <FormDivider />

      {/* Appointment Section */}
      <FormSection
        title="Appointment Details"
        description="When would you like to schedule?"
      >
        <FormGroup columns={2}>
          <FormField>
            <MobileDatePicker
              label="Date of Birth"
              max={new Date().toISOString().split('T')[0]}
              required
              {...getSelectFieldProps('dateOfBirth')}
            />
          </FormField>

          <FormField>
            <MobileTimePicker
              label="Preferred Time"
              step={15}
              helperText="In 15-minute intervals"
              {...getSelectFieldProps('appointmentTime')}
            />
          </FormField>
        </FormGroup>
      </FormSection>

      <FormDivider />

      {/* Additional Information */}
      <FormSection
        title="Additional Information"
        description="Tell us more about yourself (optional)"
      >
        <FormField>
          <div className="w-full">
            <label
              htmlFor="bio"
              className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300"
            >
              Bio
            </label>
            <textarea
              id="bio"
              rows={4}
              placeholder="Share a bit about yourself..."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              value={formState.bio?.value || ''}
              onChange={(e) => getFieldProps('bio').onChange(e)}
              onBlur={getFieldProps('bio').onBlur}
            />
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
              {formState.bio?.value?.length || 0} / 500 characters
            </p>
          </div>
        </FormField>
      </FormSection>

      <FormDivider />

      {/* Terms and Conditions */}
      <FormField>
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="agreeToTerms"
            checked={formState.agreeToTerms?.value || false}
            onChange={(e) => {
              const event = { target: { value: e.target.checked, type: 'checkbox' } } as any;
              getFieldProps('agreeToTerms').onChange(event);
            }}
            onBlur={getFieldProps('agreeToTerms').onBlur}
            className="mt-1 h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500/30"
          />
          <label
            htmlFor="agreeToTerms"
            className="text-sm text-gray-700 dark:text-gray-300"
          >
            I agree to the{' '}
            <a href="#" className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 underline">
              terms and conditions
            </a>{' '}
            and{' '}
            <a href="#" className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 underline">
              privacy policy
            </a>
            . <span className="text-red-500">*</span>
          </label>
        </div>
        {formState.agreeToTerms?.touched && formState.agreeToTerms?.error && (
          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-start gap-1">
            <span className="inline-block mt-0.5">⚠</span>
            <span>{formState.agreeToTerms.error}</span>
          </p>
        )}
      </FormField>
    </MobileForm>
  );
}
