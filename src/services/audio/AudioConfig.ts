import type { AudioChannel } from './AudioChannel';

export interface AudioMixConfig {
  readonly masterGain: number;
  readonly channelGains: Readonly<Record<AudioChannel, number>>;
  readonly musicFadeDurationMs: number;
  readonly maxConcurrentSfx: number;
  readonly maxConcurrentSameSfx: number;
  readonly defaultUiCooldownMs: number;
  readonly starRevealPitchRates: readonly [number, number, number];
  readonly selectPitchRange: { readonly min: number; readonly max: number };
  /**
   * Neutral (zero-delta) swaps already have tactile swap-whoosh and landing-tap audio.
   * Keeping neutral chime disabled by default prevents audio fatigue during rapid play
   * while preserving the asset in the catalog and showcase.
   */
  readonly playMatchUnchangedSound: boolean;
}

export const AUDIO_CONFIG: AudioMixConfig = Object.freeze({
  masterGain: 0.75,
  channelGains: Object.freeze({
    music: 0.25,
    ui: 0.35,
    gameplay: 0.55,
    feedback: 0.45,
    celebration: 0.6,
  }),
  musicFadeDurationMs: 400,
  maxConcurrentSfx: 6,
  maxConcurrentSameSfx: 2,
  defaultUiCooldownMs: 60,
  starRevealPitchRates: [1.0, 1.12, 1.26] as const,
  selectPitchRange: Object.freeze({ min: 0.96, max: 1.04 }),
  playMatchUnchangedSound: false,
});

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}
