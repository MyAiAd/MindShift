# Mobile Component Library

## Overview
Complete reference guide for all mobile-optimized React components in the MindShifting PWA. This document consolidates usage patterns, props APIs, and best practices for quick reference.

## Quick Links
- [Layout Components](#layout-components)
- [Navigation Components](#navigation-components)
- [Form Components](#form-components)
- [Feedback Components](#feedback-components)
- [Gesture Components](#gesture-components)
- [State Components](#state-components)
- [Utility Components](#utility-components)

---

## Layout Components

### MobileHeader
**Path**: `components/layout/MobileHeader.tsx`

**Purpose**: Fixed top header with back button, title, and actions.

**Props**:
```typescript
interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: React.ReactNode;
  className?: string;
}
```

**Usage**:
```tsx
<MobileHeader
  title="Profile Settings"
  showBack
  onBack={() => router.back()}
  actions={
    <Button variant="ghost" size="sm">
      <Edit size={20} />
    </Button>
  }
/>
```

**Features**:
- Fixed position with backdrop blur
- Safe area insets (status bar)
- Auto router.back() if no onBack provided
- Right-side actions slot

**Styling**:
- Height: 56px (14 = h-14)
- Background: white/gray-900 with blur
- Z-index: 40

---

### MobileNav
**Path**: `components/layout/MobileNav.tsx`

**Purpose**: Bottom navigation bar with 4 tabs.

**Props**:
```typescript
interface MobileNavProps {
  currentPath: string;
}
```

**Usage**:
```tsx
<MobileNav currentPath={pathname} />
```

**Tabs**:
- Home (`/dashboard`) - Home icon
- Treatments (`/dashboard/treatments`) - Brain icon
- Profile (`/dashboard/profile`) - User icon
- Menu (`/dashboard/menu`) - Menu icon

**Features**:
- Fixed bottom position
- Active state indication
- Safe area insets (home indicator)
- ARIA navigation role

**Styling**:
- Height: 64px (16 = h-16)
- Safe bottom padding: pb-safe
- Active: primary color
- Inactive: gray-600

---

### SkipNavigation
**Path**: `components/layout/SkipNavigation.tsx`

**Purpose**: Skip to main content link for keyboard users.

**Props**:
```typescript
interface SkipNavigationProps {
  targetId?: string;
}
```

**Usage**:
```tsx
// In layout
<SkipNavigation targetId="main-content" />

// Target element
<main id="main-content" tabIndex={-1}>
  {children}
</main>
```

**Features**:
- Hidden until keyboard focus
- Visible focus indicator
- Smooth scroll to target
- High z-index (9999)

**Accessibility**:
- First focusable element
- Screen reader friendly
- `sr-only` + `focus:not-sr-only`

---

## Navigation Components

### Link (Enhanced)
**Path**: `next/link`

**Usage**:
```tsx
<Link
  href="/dashboard/profile"
  className="touch-target" // 44×44px minimum
>
  View Profile
</Link>
```

**Mobile Enhancements**:
- Minimum touch target: 44×44px
- Active state styling
- Haptic feedback on tap
- Focus visible indicator

---

## Form Components

### MobileInput
**Path**: `components/mobile/MobileInput.tsx`

**Purpose**: Text input optimized for mobile keyboards.

**Props**:
```typescript
interface MobileInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showClearButton?: boolean;
  onClear?: () => void;
}
```

**Usage**:
```tsx
<MobileInput
  label="Email Address"
  type="email"
  inputMode="email"
  placeholder="you@example.com"
  error={errors.email}
  helperText="We'll never share your email"
  leftIcon={<Mail size={20} />}
  showClearButton
  required
/>
```

**Features**:
- 48px height (optimal touch target)
- Built-in label, error, helper text
- Clear button (X icon)
- Password toggle (eye icon)
- Left/right icon slots
- Proper inputMode for keyboards

**Input Modes**:
- `text` - Standard keyboard
- `email` - Email keyboard (@, .com)
- `tel` - Phone number keypad
- `numeric` - Number keypad
- `decimal` - Decimal keypad
- `url` - URL keyboard (/, .com)
- `search` - Search keyboard (Go button)

---

### MobileSelect
**Path**: `components/mobile/MobileSelect.tsx`

**Purpose**: Select dropdown with native mobile picker.

**Props**:
```typescript
interface MobileSelectProps {
  label?: string;
  options: Array<{ value: string; label: string }>;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  useNativeOnMobile?: boolean;
}
```

**Usage**:
```tsx
<MobileSelect
  label="Country"
  options={[
    { value: 'us', label: 'United States' },
    { value: 'uk', label: 'United Kingdom' },
    { value: 'ca', label: 'Canada' }
  ]}
  value={country}
  onChange={setCountry}
  placeholder="Select country"
  error={errors.country}
  required
/>
```

**Features**:
- Native `<select>` on mobile
- Custom dropdown on desktop
- Auto device detection
- Check icon on selected
- Keyboard accessible

---

### MobileDatePicker
**Path**: `components/mobile/MobileDatePicker.tsx`

**Purpose**: Date input with native picker.

**Props**:
```typescript
interface MobileDatePickerProps {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}
```

**Usage**:
```tsx
<MobileDatePicker
  label="Appointment Date"
  value={date}
  onChange={setDate}
  min={today}
  max={maxDate}
  required
/>
```

**Features**:
- Native date picker
- Calendar icon
- Min/max constraints
- ISO format (YYYY-MM-DD)

---

### MobileTimePicker
**Path**: `components/mobile/MobileDatePicker.tsx`

**Purpose**: Time input with native picker.

**Props**:
```typescript
interface MobileTimePickerProps {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  step?: number;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}
```

**Usage**:
```tsx
<MobileTimePicker
  label="Appointment Time"
  value={time}
  onChange={setTime}
  step={15} // 15-minute intervals
  required
/>
```

**Features**:
- Native time picker
- Clock icon
- Step intervals (minutes)
- 24-hour or 12-hour format

---

### Form Layout Components
**Path**: `components/forms/MobileForm.tsx`

#### MobileForm
Container with sticky footer.

```tsx
<MobileForm onSubmit={handleSubmit}>
  <div className="form-content">
    {/* Form fields */}
  </div>
  <FormActions>
    <Button type="submit">Save</Button>
  </FormActions>
</MobileForm>
```

#### FormSection
Group fields with title and description.

```tsx
<FormSection
  title="Personal Information"
  description="Tell us about yourself"
>
  <MobileInput label="First Name" />
  <MobileInput label="Last Name" />
</FormSection>
```

#### FormGroup
Multi-column grid for related fields.

```tsx
<FormGroup columns={2}>
  <MobileInput label="City" />
  <MobileInput label="State" />
</FormGroup>
```

**Column options**: 1, 2, 3, 4 (responsive)

#### FormActions
Button group for form actions.

```tsx
<FormActions>
  <Button variant="outline" onClick={handleReset}>
    Reset
  </Button>
  <Button type="submit">
    Save Changes
  </Button>
</FormActions>
```

#### FormError / FormSuccess
Alert messages for form state.

```tsx
<FormError message="Please fix the errors above" />
<FormSuccess message="Changes saved successfully" />
```

---

### useForm Hook
**Path**: `lib/useForm.ts`

**Purpose**: Form state and validation management.

**Usage**:
```tsx
const { values, errors, getFieldProps, handleSubmit } = useForm({
  initialValues: {
    email: '',
    password: ''
  },
  validation: {
    email: {
      required: true,
      email: true
    },
    password: {
      required: true,
      minLength: 8
    }
  },
  onSubmit: async (values) => {
    await saveUser(values);
  }
});

return (
  <form onSubmit={handleSubmit}>
    <MobileInput
      {...getFieldProps('email')}
      label="Email"
      type="email"
    />
    <MobileInput
      {...getFieldProps('password')}
      label="Password"
      type="password"
    />
    <Button type="submit">Sign In</Button>
  </form>
);
```

**Validation Rules**:
- `required: boolean`
- `email: boolean`
- `minLength: number`
- `maxLength: number`
- `min: number`
- `max: number`
- `pattern: RegExp`
- `phone: boolean`
- `url: boolean`
- `custom: (value) => string | undefined`

**State**:
- `values` - Current form values
- `errors` - Validation errors
- `touched` - Fields user interacted with
- `isSubmitting` - Submission in progress
- `isValid` - All fields valid
- `isDirty` - Any field changed

**Methods**:
- `getFieldProps(name)` - Get props for field
- `handleSubmit` - Form submit handler
- `resetForm()` - Reset to initial values
- `validateForm()` - Validate all fields
- `getValues()` - Get current values

---

## Feedback Components

### Toast
**Path**: `components/mobile/Toast.tsx`

**Purpose**: Temporary notification messages.

**Setup**:
```tsx
// In app/layout.tsx
import { ToastProvider } from '@/components/mobile/Toast';

<ToastProvider>
  {children}
</ToastProvider>
```

**Usage**:
```tsx
import { useToast } from '@/components/mobile/Toast';

function MyComponent() {
  const toast = useToast();

  const handleSave = async () => {
    try {
      await saveData();
      toast.success('Changes saved');
    } catch (error) {
      toast.error('Failed to save changes');
    }
  };

  return <Button onClick={handleSave}>Save</Button>;
}
```

**API**:
```typescript
toast.success(message, options?)
toast.error(message, options?)
toast.warning(message, options?)
toast.info(message, options?)

toast.showToast({
  message: string;
  variant: 'success' | 'error' | 'warning' | 'info';
  duration?: number; // ms, default 5000
  action?: {
    label: string;
    onClick: () => void;
  };
})
```

**Features**:
- 4 variants with color coding
- Auto-dismiss (default 5s)
- Action button support
- Haptic feedback
- Max 3 toasts
- Positioned above mobile nav

---

### ActionSheet
**Path**: `components/mobile/ActionSheet.tsx`

**Purpose**: iOS-style bottom action menu.

**Props**:
```typescript
interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  actions: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    variant?: 'default' | 'destructive';
  }>;
  showCancel?: boolean;
}
```

**Usage**:
```tsx
const [isOpen, setIsOpen] = useState(false);

<ActionSheet
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Choose an action"
  actions={[
    {
      label: 'Edit',
      icon: <Edit size={20} />,
      onClick: handleEdit
    },
    {
      label: 'Share',
      icon: <Share size={20} />,
      onClick: handleShare
    },
    {
      label: 'Delete',
      icon: <Trash size={20} />,
      onClick: handleDelete,
      variant: 'destructive'
    }
  ]}
  showCancel
/>
```

**Features**:
- Bottom sheet on mobile
- Centered modal on desktop
- Destructive variant (red)
- Backdrop dismiss
- Escape key close
- Portal rendering

---

## Gesture Components

### PullToRefresh
**Path**: `components/mobile/PullToRefresh.tsx`

**Purpose**: Pull-down to reload content.

**Props**:
```typescript
interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
  maxPullDistance?: number;
  resistance?: number;
}
```

**Usage**:
```tsx
<PullToRefresh onRefresh={async () => {
  await fetchNewData();
}}>
  <div className="content">
    {items.map(item => <Card key={item.id} />)}
  </div>
</PullToRefresh>
```

**Features**:
- iOS-style rubber-band
- Threshold: 80px
- Max pull: 150px
- Haptic feedback

---

### SwipeableSheet
**Path**: `components/mobile/SwipeableSheet.tsx`

**Purpose**: Bottom sheet with drag interaction.

**Props**:
```typescript
interface SwipeableSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  snapPoints?: number[];
  initialSnap?: number;
  showDragHandle?: boolean;
  closeOnBackdrop?: boolean;
}
```

**Usage**:
```tsx
<SwipeableSheet
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  snapPoints={[0.3, 0.6, 1.0]}
  initialSnap={1}
>
  <div className="p-4">
    {/* Sheet content */}
  </div>
</SwipeableSheet>
```

**Features**:
- Drag to resize
- Snap points (30%, 60%, 100%)
- Velocity-based snapping
- Focus trap
- Backdrop dismiss

---

### Card (Swipeable)
**Path**: `components/ui/card.tsx`

**Purpose**: Card with swipe gestures.

**Props**:
```typescript
interface CardProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  swipeThreshold?: number;
  children: React.ReactNode;
}
```

**Usage**:
```tsx
<Card
  onSwipeLeft={() => handleDelete(item.id)}
  onSwipeRight={() => handleArchive(item.id)}
>
  <CardContent>
    <h3>{item.title}</h3>
    <p>{item.description}</p>
  </CardContent>
</Card>
```

**Features**:
- Swipe threshold: 100px
- Haptic feedback
- Action preview
- Cancellable

---

## State Components

### LoadingState
**Path**: `components/mobile/LoadingState.tsx`

**Purpose**: Skeleton loading screens.

**Props**:
```typescript
interface LoadingStateProps {
  variant: 'card' | 'list' | 'table' | 'profile' | 'dashboard';
  count?: number;
}
```

**Usage**:
```tsx
{isLoading ? (
  <LoadingState variant="card" count={3} />
) : (
  items.map(item => <Card key={item.id} />)
)}
```

**Variants**:
- **card**: Card skeleton with title/text
- **list**: List items with avatar/text
- **table**: Table rows with columns
- **profile**: Profile header with avatar
- **dashboard**: Dashboard metrics grid

**Features**:
- Pulse animation
- Responsive sizing
- Dark mode support

---

### EmptyState
**Path**: `components/mobile/EmptyState.tsx`

**Purpose**: Friendly empty state messages.

**Props**:
```typescript
interface EmptyStateProps {
  variant?: 'default' | 'search' | 'error' | 'success';
  icon?: React.ReactNode;
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
}
```

**Usage**:
```tsx
<EmptyState
  variant="search"
  title="No results found"
  description="Try adjusting your search terms"
  action={{
    label: 'Clear filters',
    onClick: handleClearFilters
  }}
/>
```

**Helper Components**:
```tsx
<NoResultsEmptyState searchTerm={query} />
<NoDataEmptyState
  title="No treatments yet"
  action={{ label: 'Create one', onClick: handleCreate }}
/>
<ErrorEmptyState error={error} onRetry={handleRetry} />
<SuccessEmptyState message="All done!" />
```

**Features**:
- Icon variants
- Action buttons
- Responsive sizing
- ARIA status announcements

---

## Utility Components

### Button
**Path**: `components/ui/button.tsx`

**Props**:
```typescript
interface ButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}
```

**Usage**:
```tsx
<Button
  variant="default"
  size="lg"
  fullWidth
  loading={isSubmitting}
  leftIcon={<Save size={20} />}
  onClick={handleSave}
>
  Save Changes
</Button>
```

**Mobile Enhancements**:
- Minimum height: 44px
- Touch-friendly padding
- Haptic feedback on tap
- Loading state with spinner
- Disabled state handling

---

### Image (Optimized)
**Path**: `next/image`

**Usage**:
```tsx
<Image
  src="/logo.jpg"
  alt="MindShifting Logo"
  width={120}
  height={120}
  priority // Above fold images
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
/>
```

**Mobile Optimizations**:
- Responsive srcset
- WebP/AVIF conversion
- Lazy loading
- Priority loading
- Blur placeholder

---

## Hooks Reference

### useLongPress
**Path**: `lib/useLongPress.ts`

**Purpose**: Long press gesture detection.

**Usage**:
```tsx
const longPressProps = useLongPress(() => {
  showContextMenu();
}, {
  threshold: 500, // ms
  onStart: () => setPressed(true),
  onCancel: () => setPressed(false)
});

<div {...longPressProps}>
  Long press me
</div>
```

---

### useHaptic
**Path**: `lib/haptics.ts`

**Purpose**: Haptic feedback helper.

**Usage**:
```tsx
import { impactFeedback, notificationFeedback } from '@/lib/haptics';

// On button tap
const handleTap = () => {
  impactFeedback('medium');
  // Do action
};

// On success
const handleSuccess = () => {
  notificationFeedback('success');
  toast.success('Done!');
};
```

**API**:
- `impactFeedback('light' | 'medium' | 'heavy')`
- `selectionFeedback()`
- `notificationFeedback('success' | 'warning' | 'error')`

---

## Best Practices

### Touch Targets
```tsx
// ✅ Good: 44×44px minimum
<button className="min-h-[44px] min-w-[44px] p-3">

// ❌ Bad: Too small
<button className="p-1">
```

### Loading States
```tsx
// ✅ Good: Show skeleton
{isLoading ? <LoadingState variant="card" /> : <Card />}

// ❌ Bad: Blank screen
{!isLoading && <Card />}
```

### Error Handling
```tsx
// ✅ Good: Friendly empty state
{items.length === 0 && <NoDataEmptyState />}

// ❌ Bad: No feedback
{items.map(item => <Card />)}
```

### Form Validation
```tsx
// ✅ Good: Inline errors
<MobileInput
  {...getFieldProps('email')}
  error={errors.email}
/>

// ❌ Bad: Alert on submit
if (errors) alert('Fix errors');
```

### Accessibility
```tsx
// ✅ Good: ARIA labels
<Button aria-label="Close menu">
  <X size={20} />
</Button>

// ❌ Bad: Icon without label
<Button><X size={20} /></Button>
```

### Haptic Feedback
```tsx
// ✅ Good: Appropriate impact
<Button onClick={() => {
  impactFeedback('medium');
  handleSave();
}}>

// ❌ Bad: No haptics
<Button onClick={handleSave}>
```

---

## Component Checklist

When creating new components:

- [ ] Minimum 44×44px touch targets
- [ ] Responsive sizing (mobile-first)
- [ ] Dark mode support
- [ ] Loading states
- [ ] Error states
- [ ] Empty states
- [ ] Haptic feedback
- [ ] ARIA attributes
- [ ] Keyboard navigation
- [ ] Focus indicators
- [ ] Screen reader announcements
- [ ] TypeScript types
- [ ] JSDoc comments
- [ ] Example usage

---

## Related Documentation

- **[MOBILE_FEATURES.md](./MOBILE_FEATURES.md)** - Complete feature catalog
- **[GESTURES.md](./GESTURES.md)** - Touch gesture reference
- **[MOBILE_FORM_COMPONENTS.md](./MOBILE_FORM_COMPONENTS.md)** - Detailed form guide
- **[ACCESSIBILITY_TESTING_GUIDE.md](./ACCESSIBILITY_TESTING_GUIDE.md)** - A11y testing

---

**Last Updated**: Mobile-first transformation phase  
**Component Count**: 25+ mobile-optimized components  
**Maintained By**: Development team
