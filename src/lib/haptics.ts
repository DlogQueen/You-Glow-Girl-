/**
 * Triggers subtle haptic feedback on mobile devices.
 * 
 * @param duration - Duration of vibration in milliseconds. Default is 10ms.
 */
export const triggerHaptic = (duration: number = 15) => {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate(duration);
  }
};
