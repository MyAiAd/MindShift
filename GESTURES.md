# Touch Gestures & Interactions

## Overview
This document details all touch gestures and interactions implemented in the MindShifting PWA. These gestures provide a native app-like experience on mobile devices while remaining accessible via keyboard and mouse on desktop.

## Design Philosophy

### Core Principles
1. **Discoverability**: Visual affordances (drag handles, swipe indicators)
2. **Predictability**: Consistent gesture patterns across the app
3. **Forgiveness**: Easy to cancel gestures mid-interaction
4. **Feedback**: Haptic, visual, and audio cues for actions
5. **Accessibility**: Keyboard alternatives for all gestures

### Platform Consistency
- **iOS**: Follow iOS Human Interface Guidelines
- **Android**: Follow Material Design motion principles
- **Desktop**: Support mouse/trackpad equivalents

## Gesture Catalog

### 1. Pull-to-Refresh

#### Overview
Pull down from the top of a scrollable area to reload content.

#### Component
`components/mobile/PullToRefresh.tsx`

#### Visual Affordance
- Loading spinner appears as you pull
- Rotation animation during refresh
- Release animation when completing

#### Physics
```typescript
// Distance calculations
const pullDistance = Math.min(touchY - startY, maxPullDistance);
const threshold = 80; // px to trigger refresh
const maxPull = 150; // px max visual feedback
const resistance = 2.5; // Harder to pull further
```

#### States
1. **Idle**: No pull, content at rest
2. **Pulling**: User dragging down, spinner visible
3. **Threshold Reached**: Pulled past 80px, haptic feedback
4. **Release to Refresh**: User can release to trigger
5. **Refreshing**: API call in progress, spinner rotating
6. **Complete**: Snap back to top

#### Haptic Feedback
- **Threshold reached**: Medium impact (20ms)
- **Released**: Heavy impact (30ms)

#### Cancellation
- Pull less than threshold and release
- Scroll down before releasing
- Touch another area

#### Keyboard Alternative
- Focus refresh button in toolbar
- Press Enter/Space

#### Usage
```tsx
<PullToRefresh onRefresh={async () => {
  await fetchNewData();
}}>
  <div className="content">
    {/* Your scrollable content */}
  </div>
</PullToRefresh>
```

#### Best Practices
- ✅ Only at top of scroll (scrollTop === 0)
- ✅ Show spinner state during refresh
- ✅ Handle errors gracefully
- ✅ Provide alternative refresh button
- ❌ Don't use on horizontal scrolls
- ❌ Don't trigger multiple refreshes

---

### 2. Swipe to Delete/Archive

#### Overview
Swipe left or right on cards to reveal actions (delete, archive, favorite).

#### Component
`components/ui/card.tsx` (enhanced)

#### Visual Affordance
- Card translates horizontally as you swipe
- Action icon/text revealed behind card
- Color-coded backgrounds (red for delete, blue for archive)

#### Physics
```typescript
const swipeThreshold = 100; // px to trigger action
const maxSwipe = 200; // px max translation
const snapSpeed = 200; // ms to animate back

// Resistance beyond threshold
if (distance > threshold) {
  translation = threshold + (distance - threshold) / 2;
}
```

#### States
1. **Idle**: Card at rest position
2. **Swiping**: Card following finger
3. **Threshold Reached**: Haptic + action revealed
4. **Released (past threshold)**: Execute action
5. **Released (before threshold)**: Snap back
6. **Animating**: Smooth return to position

#### Haptic Feedback
- **Threshold reached**: Medium impact (20ms)
- **Action executed**: Heavy impact (30ms)

#### Cancellation
- Swipe back to starting position
- Release before threshold
- Tap anywhere to cancel

#### Keyboard Alternative
- Focus card
- Press Delete key (delete action)
- Press A key (archive action)
- Press F key (favorite action)

#### Usage
```tsx
<Card
  onSwipeLeft={() => handleDelete(item.id)}
  onSwipeRight={() => handleArchive(item.id)}
  swipeThreshold={100}
>
  <CardContent>
    {/* Card content */}
  </CardContent>
</Card>
```

#### Configuration
```typescript
interface SwipeableCardProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  swipeThreshold?: number; // Default: 100
  leftActionIcon?: React.ReactNode;
  leftActionColor?: string; // Default: 'red'
  rightActionIcon?: React.ReactNode;
  rightActionColor?: string; // Default: 'blue'
}
```

#### Best Practices
- ✅ Show action preview as user swipes
- ✅ Use consistent directions (left = delete, right = archive)
- ✅ Confirm destructive actions
- ✅ Provide undo option
- ❌ Don't swipe on horizontal scrolls
- ❌ Don't use for primary actions

---

### 3. Swipeable Bottom Sheet

#### Overview
Drag sheet up/down to different heights or dismiss.

#### Component
`components/mobile/SwipeableSheet.tsx`

#### Visual Affordance
- Rounded top corners
- Drag handle (horizontal pill shape)
- Shadow/backdrop
- Smooth spring animations

#### Snap Points
```typescript
const snapPoints = [
  0.3,  // Collapsed (30% of screen)
  0.6,  // Half (60% of screen)
  1.0   // Full (100% of screen)
];
```

#### Physics
```typescript
// Velocity-based snapping
if (velocity > 500) {
  // Fast swipe: snap to next point
  snapTo(nextSnapPoint);
} else {
  // Slow drag: snap to nearest point
  snapTo(nearestSnapPoint);
}

// Resistance at boundaries
if (y < minY) {
  translation = minY + (y - minY) / 4; // Rubber band
}
```

#### States
1. **Closed**: Sheet not visible
2. **Opening**: Animating to initial snap
3. **Collapsed**: At 30% height
4. **Half**: At 60% height
5. **Full**: At 100% height
6. **Dragging**: User controlling position
7. **Snapping**: Animating to snap point
8. **Closing**: Animating to dismiss

#### Haptic Feedback
- **Snap point reached**: Light impact (10ms)
- **Dismissed**: Medium impact (20ms)

#### Gestures
- **Drag down**: Move between snap points or dismiss
- **Drag up**: Expand to larger snap point
- **Fast swipe down**: Dismiss immediately
- **Fast swipe up**: Expand to full
- **Tap backdrop**: Dismiss
- **Tap drag handle**: Hint animation

#### Cancellation
- Drag back to previous snap point
- Press Escape key
- Tap backdrop

#### Keyboard Alternative
- Tab to navigate content
- Escape to close
- Arrow keys to change snap point

#### Usage
```tsx
const [isOpen, setIsOpen] = useState(false);

<SwipeableSheet
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  snapPoints={[0.3, 0.6, 1.0]}
  initialSnap={1} // Start at half
>
  <div className="p-4">
    {/* Sheet content */}
  </div>
</SwipeableSheet>
```

#### Configuration
```typescript
interface SwipeableSheetProps {
  isOpen: boolean;
  onClose: () => void;
  snapPoints?: number[]; // Default: [0.3, 0.6, 1.0]
  initialSnap?: number; // Default: 1 (middle)
  showDragHandle?: boolean; // Default: true
  closeOnBackdrop?: boolean; // Default: true
  closeThreshold?: number; // Default: 0.2
}
```

#### Best Practices
- ✅ Show drag handle for discoverability
- ✅ Start at logical snap point
- ✅ Disable body scroll when open
- ✅ Return focus to trigger on close
- ❌ Don't use for critical forms
- ❌ Don't nest swipeable sheets

---

### 4. Tap & Hold (Long Press)

#### Overview
Press and hold on an item to reveal contextual menu.

#### Implementation
Custom hook: `lib/useLongPress.ts`

#### Timing
```typescript
const longPressDuration = 500; // ms
const movementThreshold = 10; // px (cancel if moved)
```

#### Visual Feedback
- Scale animation (0.95x) during press
- Haptic at trigger
- Context menu appears

#### States
1. **Idle**: No press
2. **Pressing**: Finger down, timer started
3. **Triggered**: 500ms elapsed, menu shown
4. **Moved**: Cancelled due to movement
5. **Released Early**: Cancelled, regular tap

#### Haptic Feedback
- **Long press triggered**: Medium impact (20ms)
- **Menu item selected**: Light impact (10ms)

#### Cancellation
- Release before 500ms (becomes regular tap)
- Move finger > 10px
- Second finger touches screen

#### Usage
```tsx
const longPressProps = useLongPress(() => {
  showContextMenu();
}, {
  threshold: 500,
  onStart: () => console.log('Press started'),
  onCancel: () => console.log('Cancelled')
});

<div {...longPressProps}>
  <Card>Long press me</Card>
</div>
```

#### Use Cases
- Context menus on list items
- Quick actions on cards
- Copy/paste operations
- Preview/peek actions

#### Best Practices
- ✅ Show visual feedback immediately
- ✅ Provide tap alternative
- ✅ Clear indication of long-press ability
- ❌ Don't use for primary actions
- ❌ Don't require long press for critical features

---

### 5. Pinch to Zoom

#### Overview
Two-finger pinch to zoom images and charts.

#### Component
`components/mobile/ZoomableImage.tsx`

#### Gestures
- **Pinch out**: Zoom in (increase scale)
- **Pinch in**: Zoom out (decrease scale)
- **Double tap**: Toggle between 1x and 2x
- **Pan**: Move zoomed image

#### Physics
```typescript
const minScale = 1;
const maxScale = 4;
const doubleTapZoom = 2;

// Calculate scale from pinch
const distance = Math.hypot(
  touch1.x - touch2.x,
  touch1.y - touch2.y
);
const scale = initialScale * (distance / startDistance);
```

#### States
1. **Normal**: 1x scale, no zoom
2. **Zooming**: Pinching gesture active
3. **Zoomed**: Scale > 1x
4. **Panning**: Moving zoomed image
5. **Animating**: Smooth zoom/reset

#### Haptic Feedback
- **Double tap zoom**: Light impact (10ms)
- **Max/min zoom reached**: Selection feedback (5ms)

#### Keyboard Alternative
- Plus/Minus keys to zoom
- Arrow keys to pan
- 0 key to reset
- Double-click to toggle zoom

#### Usage
```tsx
<ZoomableImage
  src="/path/to/image.jpg"
  alt="Description"
  minScale={1}
  maxScale={4}
/>
```

#### Best Practices
- ✅ Reset zoom on close
- ✅ Constrain pan to image bounds
- ✅ Smooth animations
- ✅ Show zoom level indicator
- ❌ Don't apply to decorative images
- ❌ Don't prevent pinch-zoom on entire page

---

### 6. Scroll Behavior

#### Overview
Enhanced scrolling with momentum, snap points, and pull resistance.

#### Implementations

##### 6.1 Infinite Scroll
```tsx
<InfiniteScroll
  loadMore={fetchNextPage}
  hasMore={hasNextPage}
  threshold={300} // px from bottom
>
  {items.map(item => <Card key={item.id} />)}
</InfiniteScroll>
```

##### 6.2 Snap Scroll (Carousels)
```tsx
<div className="snap-x snap-mandatory overflow-x-auto flex">
  {slides.map(slide => (
    <div key={slide.id} className="snap-center shrink-0 w-full">
      {slide.content}
    </div>
  ))}
</div>
```

##### 6.3 Sticky Headers
```tsx
<div className="sticky top-0 z-10 bg-white dark:bg-gray-900">
  <h2>Section Title</h2>
</div>
```

#### Scroll Restoration
- Browser remembers scroll position
- Restore on back navigation
- Opt-out for modals/sheets

#### Best Practices
- ✅ Smooth momentum scrolling
- ✅ Overscroll bounce on iOS
- ✅ Scroll-to-top on tab re-tap
- ❌ Don't hijack scroll behavior
- ❌ Don't create scroll conflicts

---

## Haptic Feedback Reference

### Impact Levels

#### Light (10ms)
**Use for:**
- Selections in lists
- Toggle switches
- Tab changes
- Minor confirmations

```typescript
impactFeedback('light');
```

#### Medium (20ms)
**Use for:**
- Button taps
- Gesture thresholds
- Modal opens
- Form submissions

```typescript
impactFeedback('medium');
```

#### Heavy (30ms)
**Use for:**
- Destructive actions
- Gesture completions
- Major state changes
- Error actions

```typescript
impactFeedback('heavy');
```

### Notification Patterns

#### Success (10ms, 5ms)
**Use for:**
- Form submitted
- Item saved
- Action completed

```typescript
notificationFeedback('success');
```

#### Warning (10ms, 5ms, 10ms)
**Use for:**
- Non-blocking errors
- Warnings
- Reversible actions

```typescript
notificationFeedback('warning');
```

#### Error (20ms, 10ms, 20ms)
**Use for:**
- Form validation errors
- Failed API calls
- Blocked actions

```typescript
notificationFeedback('error');
```

### Selection Feedback (5ms)
**Use for:**
- Picking from a list
- Checkbox/radio selection
- Slider value changes

```typescript
selectionFeedback();
```

## Gesture Conflicts & Resolution

### Common Conflicts

#### Pull-to-Refresh vs Scroll
**Solution**: Only trigger at scrollTop === 0
```typescript
if (element.scrollTop > 0) {
  return; // Don't pull-to-refresh
}
```

#### Swipe vs Horizontal Scroll
**Solution**: Require minimum horizontal movement
```typescript
const angle = Math.atan2(deltaY, deltaX);
if (Math.abs(angle) < 30) {
  // Likely a swipe, not scroll
}
```

#### Pinch Zoom vs Page Zoom
**Solution**: preventDefault on image container only
```typescript
imageContainer.addEventListener('touchstart', (e) => {
  if (e.touches.length > 1) {
    e.preventDefault(); // Allow pinch zoom on image
  }
}, { passive: false });
```

#### Long Press vs Scroll
**Solution**: Cancel long press if moved > 10px
```typescript
if (Math.hypot(deltaX, deltaY) > 10) {
  cancelLongPress();
}
```

## Accessibility Alternatives

### Keyboard Equivalents

| Gesture | Keyboard Alternative |
|---------|---------------------|
| Pull-to-refresh | F5 or Ctrl+R |
| Swipe left | Delete key |
| Swipe right | A key (archive) |
| Long press | Context menu key |
| Pinch zoom | Ctrl + Plus/Minus |
| Double tap | Double-click |
| Drag sheet | Arrow Up/Down |
| Dismiss sheet | Escape |

### Screen Reader Announcements

```typescript
// Announce gesture availability
<div
  aria-label="Swipe left to delete, swipe right to archive"
  role="listitem"
>
```

```typescript
// Announce gesture result
const toast = useToast();
toast.success('Item archived', {
  aria: 'Item has been archived. Undo?'
});
```

## Testing Gestures

### Manual Testing Checklist

#### Pull-to-Refresh
- [ ] Only triggers at top of scroll
- [ ] Spinner animates smoothly
- [ ] Haptic feedback at threshold
- [ ] Handles failed refresh gracefully
- [ ] Works with keyboard (F5)

#### Swipe Actions
- [ ] Threshold is comfortable (not too easy/hard)
- [ ] Action preview visible during swipe
- [ ] Haptic at trigger point
- [ ] Cancellable by swiping back
- [ ] Keyboard alternative works

#### Bottom Sheet
- [ ] Snap points feel natural
- [ ] Drag handle visible
- [ ] Fast swipe dismisses
- [ ] Backdrop dismisses
- [ ] Escape key works
- [ ] Focus trap active
- [ ] Returns focus on close

#### Long Press
- [ ] 500ms duration feels right
- [ ] Visual feedback immediate
- [ ] Haptic on trigger
- [ ] Cancels if moved
- [ ] Doesn't conflict with scroll

### Automated Testing

```typescript
// Example: Test pull-to-refresh
import { render, fireEvent } from '@testing-library/react';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';

test('triggers refresh after pull threshold', async () => {
  const onRefresh = jest.fn();
  const { container } = render(
    <PullToRefresh onRefresh={onRefresh}>
      <div>Content</div>
    </PullToRefresh>
  );

  const element = container.firstChild;

  // Simulate touch start
  fireEvent.touchStart(element, {
    touches: [{ clientY: 0 }]
  });

  // Simulate pull down 100px (past 80px threshold)
  fireEvent.touchMove(element, {
    touches: [{ clientY: 100 }]
  });

  // Release
  fireEvent.touchEnd(element);

  // Expect refresh to be called
  expect(onRefresh).toHaveBeenCalled();
});
```

## Performance Considerations

### Touch Event Listeners

#### Use Passive Listeners
```typescript
// Good: Passive listener (won't block scroll)
element.addEventListener('touchstart', handler, { passive: true });

// Bad: Active listener (blocks scroll)
element.addEventListener('touchstart', handler);
```

#### Only Prevent Default When Needed
```typescript
// Only prevent for custom gestures
if (isCustomGesture) {
  e.preventDefault();
}
```

### Animation Performance

#### Use Transform & Opacity
```css
/* Good: GPU-accelerated */
.sheet {
  transform: translateY(var(--y));
  will-change: transform;
}

/* Bad: Triggers layout */
.sheet {
  top: var(--y);
}
```

#### Debounce Expensive Operations
```typescript
const debouncedUpdate = useMemo(
  () => debounce(updatePosition, 16), // 60fps
  []
);
```

### Memory Management

#### Clean Up Listeners
```typescript
useEffect(() => {
  const handleTouch = (e) => {
    // Handle touch
  };

  element.addEventListener('touchstart', handleTouch);

  return () => {
    element.removeEventListener('touchstart', handleTouch);
  };
}, []);
```

## Best Practices Summary

### Do's ✅
- Provide visual affordances (drag handles, indicators)
- Give immediate feedback (haptics, animations)
- Make gestures cancellable
- Provide keyboard alternatives
- Test on real devices
- Follow platform conventions
- Use appropriate haptic patterns
- Announce to screen readers
- Handle conflicts gracefully
- Optimize performance

### Don'ts ❌
- Don't hijack native gestures
- Don't use gestures for critical actions only
- Don't create gesture conflicts
- Don't forget keyboard users
- Don't skip haptic feedback
- Don't use non-standard patterns
- Don't block scroll unnecessarily
- Don't forget ARIA labels
- Don't use active listeners without cause
- Don't animate layout properties

## References

### Platform Guidelines
- [iOS Human Interface Guidelines - Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures)
- [Material Design - Gestures](https://m3.material.io/foundations/interaction/gestures)
- [MDN Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)

### Our Implementation Files
- `lib/haptics.ts` - Haptic feedback utility
- `lib/useLongPress.ts` - Long press hook
- `components/mobile/PullToRefresh.tsx`
- `components/mobile/SwipeableSheet.tsx`
- `components/ui/card.tsx` - Swipeable cards

### Testing Resources
- [Playwright Touch API](https://playwright.dev/docs/api/class-touchscreen)
- [Testing Library User Events](https://testing-library.com/docs/user-event/intro)

---

**Last Updated**: Mobile-first transformation phase
**Maintained By**: Development team
**Related Docs**: MOBILE_FEATURES.md, ACCESSIBILITY_TESTING_GUIDE.md
