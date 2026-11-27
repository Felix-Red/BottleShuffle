import { AUDIO_ASSET_KEYS, type SfxAssetKey } from '../../game/assets/AssetKeys';
import type { HapticEvent } from '../haptics/HapticPattern';
import { AUDIO_CONFIG } from './AudioConfig';

export interface FeedbackCue {
  readonly sfx: SfxAssetKey | null;
  readonly haptic: HapticEvent | null;
  readonly rate?: number;
}

export interface MatchDeltaMappingOptions {
  readonly playUnchanged?: boolean;
  readonly suppressForVictory?: boolean;
}

/**
 * Pure, deterministic mapper translating public gameplay outcomes into audio & haptic cues.
 * Operates exclusively on public deltas/events and NEVER inspects secret target sequences.
 */
export function mapMatchDeltaToFeedback(
  matchDelta: number,
  options: MatchDeltaMappingOptions = {},
): FeedbackCue {
  if (options.suppressForVictory) {
    return Object.freeze({ sfx: null, haptic: null });
  }

  if (matchDelta > 0) {
    return Object.freeze({
      sfx: AUDIO_ASSET_KEYS.SFX_MATCH_INCREASE,
      haptic: 'match_positive',
    });
  }

  if (matchDelta < 0) {
    return Object.freeze({
      sfx: AUDIO_ASSET_KEYS.SFX_MATCH_DECREASE,
      haptic: null,
    });
  }

  const playUnchanged = options.playUnchanged ?? AUDIO_CONFIG.playMatchUnchangedSound;
  return Object.freeze({
    sfx: playUnchanged ? AUDIO_ASSET_KEYS.SFX_MATCH_UNCHANGED : null,
    haptic: null,
  });
}

/**
 * Computes gently escalating playback rate for earned Victory star reveals (0-based index).
 */
export function computeStarRevealRate(starIndex: number): number {
  const rates = AUDIO_CONFIG.starRevealPitchRates;
  const clampedIndex = Math.max(0, Math.min(rates.length - 1, Math.floor(starIndex)));
  return rates[clampedIndex] ?? 1;
}

/**
 * Computes subtle pitch variation for bottle selection from a random unit value [0, 1].
 * Strictly independent of bottle identity or secret target correctness.
 */
export function computeSelectPitchRate(randomUnit: number): number {
  const u = Number.isFinite(randomUnit) ? Math.max(0, Math.min(1, randomUnit)) : 0.5;
  const { min, max } = AUDIO_CONFIG.selectPitchRange;
  return min + (max - min) * u;
}
