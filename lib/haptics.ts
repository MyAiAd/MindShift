/**
 * Haptic Feedback Utility
 * 
 * Provides a cross-platform wrapper for the Vibration API with iOS-style haptic patterns.
 * Gracefully falls back when vibration is not supported.
 */

type HapticFeedbackType = 'impact' | 'notification' | 'selection';
type HapticImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type HapticNotificationStyle = 'success' | 'warning' | 'error';

/**
 * Check if the Vibration API is supported
 */
function isVibrationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('vibrate' in navigator || 'mozVibrate' in navigator || 'webkitVibrate' in navigator)
  );
}

/**
 * Trigger a haptic vibration pattern
 */
function vibrate(pattern: number | number[]): boolean {
  if (!isVibrationSupported()) {
    return false;
  }

  try {
    if ('vibrate' in navigator) {
      return navigator.vibrate(pattern);
    } else if ('mozVibrate' in (navigator as any)) {
      return (navigator as any).mozVibrate(pattern);
    } else if ('webkitVibrate' in (navigator as any)) {
      return (navigator as any).webkitVibrate(pattern);
    }
    return false;
  } catch (error) {
    console.warn('Vibration API error:', error);
    return false;
  }
}

/**
 * Impact feedback - Used when UI elements collide or snap into place
 * 
 * @param style - The intensity of the impact
 * - light: Subtle feedback for lightweight UI interactions (10ms)
 * - medium: Standard feedback for most interactions (20ms)
 * - heavy: Strong feedback for significant interactions (30ms)
 * - rigid: Sharp, precise feedback (15ms, short)
 * - soft: Gentle, smooth feedback (25ms, medium)
 */
export function impactFeedback(style: HapticImpactStyle = 'medium'): boolean {
  const patterns: Record<HapticImpactStyle, number> = {
    light: 10,
    medium: 20,
    heavy: 30,
    rigid: 15,
    soft: 25,
  };

  return vibrate(patterns[style]);
}

/**
 * Notification feedback - Used to communicate success, warning, or error
 * 
 * @param style - The type of notification
 * - success: Double tap pattern [10, 50, 10]
 * - warning: Triple tap pattern [10, 30, 10, 30, 10]
 * - error: Harsh pattern [30, 50, 30]
 */
export function notificationFeedback(style: HapticNotificationStyle): boolean {
  const patterns: Record<HapticNotificationStyle, number[]> = {
    success: [10, 50, 10],         // Double tap
    warning: [10, 30, 10, 30, 10], // Triple tap
    error: [30, 50, 30],           // Harsh double
  };

  return vibrate(patterns[style]);
}

/**
 * Selection feedback - Used when a selection changes or values increment/decrement
 * Very light feedback (5ms) suitable for continuous interactions like scrolling through pickers
 */
export function selectionFeedback(): boolean {
  return vibrate(5);
}

/**
 * Cancel any ongoing vibration
 */
export function cancelFeedback(): void {
  if (isVibrationSupported()) {
    navigator.vibrate(0);
  }
}

/**
 * Main haptic feedback function with unified interface
 * 
 * @example
 * // Impact feedback
 * haptic('impact', 'heavy');
 * 
 * // Notification feedback
 * haptic('notification', 'success');
 * 
 * // Selection feedback
 * haptic('selection');
 */
export function haptic(
  type: HapticFeedbackType,
  style?: HapticImpactStyle | HapticNotificationStyle
): boolean {
  switch (type) {
    case 'impact':
      return impactFeedback((style as HapticImpactStyle) || 'medium');
    case 'notification':
      if (!style) {
        console.warn('Notification haptic requires a style parameter');
        return false;
      }
      return notificationFeedback(style as HapticNotificationStyle);
    case 'selection':
      return selectionFeedback();
    default:
      console.warn(`Unknown haptic type: ${type}`);
      return false;
  }
}

// Default export
export default {
  impact: impactFeedback,
  notification: notificationFeedback,
  selection: selectionFeedback,
  cancel: cancelFeedback,
  haptic,
  isSupported: isVibrationSupported,
};
