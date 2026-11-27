import type { HapticEvent } from './HapticPattern';

export interface HapticPatternSpec {
  readonly pattern: number | readonly number[];
  readonly priority: number;
}

export interface HapticMixConfig {
  readonly minCooldownMs: number;
  readonly patterns: Readonly<Record<HapticEvent, HapticPatternSpec>>;
}

export const HAPTIC_CONFIG: HapticMixConfig = Object.freeze({
  minCooldownMs: 45,
  patterns: Object.freeze({
    bottle_select: Object.freeze({ pattern: 10, priority: 10 }),
    bottle_land: Object.freeze({ pattern: 15, priority: 20 }),
    match_positive: Object.freeze({ pattern: 20, priority: 30 }),
    victory: Object.freeze({ pattern: Object.freeze([30, 40, 30]), priority: 100 }),
  }),
});
