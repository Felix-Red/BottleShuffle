/**
 * Player-configurable motion preference.
 * - `'system'`: Follows the host device/browser prefers-reduced-motion setting.
 * - `'reduced'`: Explicitly requests reduced motion regardless of system setting.
 *
 * Notice there is deliberately no `'full'` override so an in-game setting can
 * never silently weaken an operating-system accessibility preference.
 */
export type MotionPreference = 'system' | 'reduced';

export const MOTION_PREFERENCE_VALUES: readonly MotionPreference[] = Object.freeze([
  'system',
  'reduced',
]);

export function isMotionPreference(value: unknown): value is MotionPreference {
  return value === 'system' || value === 'reduced';
}

/**
 * Resolves the effective reduced-motion boolean from the player preference and
 * the host system's accessibility preference. System reduced motion is always honoured.
 */
export function resolveEffectiveReducedMotion(
  preference: MotionPreference,
  systemPrefersReducedMotion: boolean,
): boolean {
  return systemPrefersReducedMotion || preference === 'reduced';
}
