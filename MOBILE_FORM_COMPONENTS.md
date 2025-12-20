# Mobile Form Components Documentation

## Overview
This document describes the mobile-optimized form system built for the MindShifting PWA. All components are designed with mobile-first principles, accessibility, and native mobile patterns in mind.

## Component Library

### 1. MobileInput
**Location**: `components/mobile/MobileInput.tsx`

**Features**:
- 48px height for optimal touch targets
- Built-in label, error, and helper text
- Clear button (optional)
- Password toggle with show/hide
- Left and right icon slots
- Haptic feedback on interactions
- Full ARIA support
- Dark mode compatible

**Usage**:
```tsx
import { MobileInput } from '@/components/mobile/MobileInput';

<MobileInput
  label="Email"
  type="email"
  leftIcon={<Mail className="h-5 w-5" />}
  showClearButton
  onClear={() => setValue('')}
  error={errors.email}
  helperText="We'll never share your email"
  required
/>
```

**Props**:
- `label?: string` - Field label
- `error?: string` - Error message
- `helperText?: string` - Helper text below input
- `showClearButton?: boolean` - Show clear button when has value
- `onClear?: () => void` - Callback when clear button clicked
- `leftIcon?: ReactNode` - Icon on left side
- `rightIcon?: ReactNode` - Icon on right side
- All standard input props

### 2. MobileSelect
**Location**: `components/mobile/MobileSelect.tsx`

**Features**:
- Native `<select>` on mobile devices
- Custom dropdown on desktop
- Auto-detection of mobile devices
- Check icon for selected option
- Keyboard accessible (Escape to close)
- Click outside to close
- Haptic feedback on selection
- ARIA listbox/option roles

**Usage**:
```tsx
import { MobileSelect } from '@/components/mobile/MobileSelect';

const options = [
  { value: 'us', label: 'United States' },
  { value: 'ca', label: 'Canada' },
];

<MobileSelect
  label="Country"
  options={options}
  value={country}
  onChange={(value) => setCountry(value)}
  placeholder="Select a country"
  error={errors.country}
  required
/>
```

**Props**:
- `label?: string` - Field label
- `value?: string` - Selected value
- `options: Array<{value: string, label: string, disabled?: boolean}>` - Options array
- `onChange: (value: string) => void` - Change handler
- `placeholder?: string` - Placeholder text
- `error?: string` - Error message
- `helperText?: string` - Helper text
- `disabled?: boolean` - Disable the select
- `required?: boolean` - Mark as required
- `useNativeOnMobile?: boolean` - Use native select on mobile (default: true)

### 3. MobileDatePicker & MobileTimePicker
**Location**: `components/mobile/MobileDatePicker.tsx`

**Features**:
- Native date/time inputs for mobile
- Calendar icon visual indicator
- Min/max date/time constraints
- Step interval for time picker
- ISO date format (YYYY-MM-DD)
- Proper focus management

**Usage**:
```tsx
import { MobileDatePicker, MobileTimePicker } from '@/components/mobile/MobileDatePicker';

<MobileDatePicker
  label="Date of Birth"
  value={dateOfBirth}
  onChange={(value) => setDateOfBirth(value)}
  max={new Date().toISOString().split('T')[0]}
  required
/>

<MobileTimePicker
  label="Appointment Time"
  value={time}
  onChange={(value) => setTime(value)}
  step={15}
  min="09:00"
  max="17:00"
/>
```

### 4. MobileForm Layout Components
**Location**: `components/forms/MobileForm.tsx`

#### MobileForm
Container component with optional sticky footer.

```tsx
<MobileForm
  onSubmit={handleSubmit}
  stickyFooter
  footer={
    <Button type="submit">Submit</Button>
  }
>
  {/* Form content */}
</MobileForm>
```

**Props**:
- `contained?: boolean` - Adds max-width and padding (default: true)
- `stickyFooter?: boolean` - Sticky footer on mobile (default: false)
- `footer?: ReactNode` - Footer content (buttons)

#### FormSection
Groups related fields with optional title and description.

```tsx
<FormSection
  title="Personal Information"
  description="Please provide your details"
>
  <MobileInput label="First Name" />
  <MobileInput label="Last Name" />
</FormSection>
```

#### FormGroup
Multi-column grid layout for desktop.

```tsx
<FormGroup columns={2}>
  <MobileInput label="First Name" />
  <MobileInput label="Last Name" />
</FormGroup>
```

#### FormActions
Button group with alignment options.

```tsx
<FormActions stack align="right">
  <Button variant="outline">Cancel</Button>
  <Button type="submit">Save</Button>
</FormActions>
```

#### FormError / FormSuccess
Message components with appropriate styling.

```tsx
<FormError message="Please fix the errors above" />
<FormSuccess message="Changes saved successfully" />
```

#### FormDivider
Section separator with optional label.

```tsx
<FormDivider label="Additional Information" />
```

## Form Validation Hook

### useForm
**Location**: `lib/useForm.ts`

Comprehensive form state and validation management.

**Features**:
- Field-level validation
- Multiple validation rules
- Validation triggers (onChange, onBlur, onSubmit)
- Built-in validation rules
- Custom validation functions
- Form state management
- Submission handling
- Error and success messages

**Usage**:
```tsx
import { useForm, validations } from '@/lib/useForm';

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
    email: '',
    password: '',
  },
  validations: {
    email: {
      ...validations.required('Email is required'),
      ...validations.email(),
    },
    password: {
      ...validations.required('Password is required'),
      ...validations.minLength(8),
    },
  },
  onSubmit: async (values) => {
    await api.login(values);
  },
  validateOnBlur: true,
  validateOnChange: false,
});

// In JSX:
<MobileInput {...getFieldProps('email')} label="Email" />
```

### Built-in Validation Rules

```tsx
// Required field
validations.required(message?: string)

// Email validation
validations.email(message?: string)

// Min length
validations.minLength(length: number, message?: string)

// Max length
validations.maxLength(length: number, message?: string)

// Min value
validations.min(value: number, message?: string)

// Max value
validations.max(value: number, message?: string)

// Regex pattern
validations.pattern(regex: RegExp, message?: string)

// Phone number
validations.phone(message?: string)

// URL
validations.url(message?: string)
```

### Custom Validation

```tsx
const passwordMatch: ValidationRule = {
  validate: (value) => value === password,
  message: 'Passwords must match',
};

const validations = {
  confirmPassword: {
    required: true,
    custom: passwordMatch,
  },
};
```

## Feedback Components

### Toast Notifications
**Location**: `components/mobile/Toast.tsx`

**Usage**:
```tsx
import { useToast } from '@/components/mobile/Toast';

function MyComponent() {
  const toast = useToast();

  const handleSave = async () => {
    try {
      await saveData();
      toast.success('Changes saved successfully');
    } catch (error) {
      toast.error('Failed to save changes');
    }
  };

  // With action button
  toast.showToast({
    message: 'Item deleted',
    variant: 'success',
    duration: 5000,
    action: {
      label: 'Undo',
      onClick: () => restoreItem(),
    },
  });
}
```

**Variants**: `success`, `error`, `warning`, `info`

### ActionSheet
**Location**: `components/mobile/ActionSheet.tsx`

**Usage**:
```tsx
import { ActionSheet } from '@/components/mobile/ActionSheet';

<ActionSheet
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Choose an action"
  description="What would you like to do?"
  actions={[
    {
      label: 'Edit',
      icon: <Edit className="h-5 w-5" />,
      onClick: () => handleEdit(),
    },
    {
      label: 'Delete',
      icon: <Trash className="h-5 w-5" />,
      variant: 'destructive',
      onClick: () => handleDelete(),
    },
  ]}
/>
```

## Best Practices

### 1. Touch Targets
- All interactive elements are minimum 48px height
- Buttons use `touch-target` class for proper sizing
- Adequate spacing between tappable elements

### 2. Validation UX
- Validate on blur by default (less intrusive)
- Show errors only after field is touched
- Clear, specific error messages
- Required fields marked with asterisk (*)

### 3. Mobile Patterns
- Native inputs (date, time, select) on mobile devices
- Sticky footers for primary actions
- Stack fields vertically on mobile
- Full-width buttons on mobile

### 4. Accessibility
- All inputs have associated labels
- Error messages use `role="alert"`
- ARIA attributes on custom components
- Keyboard navigation supported
- Screen reader friendly

### 5. Performance
- Haptic feedback on interactions
- Smooth animations (200-300ms)
- Debounced validation where appropriate
- Optimized re-renders

## Example: Complete Form

See `components/forms/ExampleMobileForm.tsx` for a comprehensive example demonstrating:
- All form components
- Validation patterns
- Multi-column layouts
- Conditional fields
- Success/error handling
- Sticky footer
- Character counters
- Terms checkbox

## Styling Guidelines

### Colors
- Primary: Indigo 600 (`#4f46e5`)
- Error: Red 600
- Success: Green 600
- Warning: Yellow 600
- Info: Blue 600

### Focus States
- 2px ring with indigo color
- 30% opacity for rings (`ring-indigo-500/30`)
- Smooth transitions (200ms)

### Dark Mode
- All components support dark mode
- Uses Tailwind's `dark:` modifier
- Maintains proper contrast ratios

## Testing

All form components should be tested for:
1. Keyboard navigation
2. Screen reader compatibility
3. Touch interaction on mobile devices
4. Validation logic
5. Error state display
6. Dark mode appearance
7. Responsive breakpoints

## Migration Guide

### From Standard Input to MobileInput

Before:
```tsx
<input
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  className="..."
/>
{error && <p className="error">{error}</p>}
```

After:
```tsx
<MobileInput
  type="email"
  label="Email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={error}
/>
```

### From Standard Form to MobileForm

Before:
```tsx
<form onSubmit={handleSubmit}>
  <div className="space-y-4">
    {/* fields */}
  </div>
  <div className="flex gap-2">
    <button>Submit</button>
  </div>
</form>
```

After:
```tsx
<MobileForm
  onSubmit={handleSubmit}
  stickyFooter
  footer={
    <FormActions>
      <Button type="submit">Submit</Button>
    </FormActions>
  }
>
  <FormSection>
    {/* fields */}
  </FormSection>
</MobileForm>
```

## Support

For questions or issues with form components:
1. Check `ExampleMobileForm.tsx` for usage patterns
2. Review `ACCESSIBILITY_TESTING_GUIDE.md` for testing procedures
3. Consult Tailwind documentation for styling
4. Test on real mobile devices before deployment
