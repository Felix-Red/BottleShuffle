import {
  AUDIO_ASSET_KEYS,
  type AudioAssetKey,
  type MusicAssetKey,
  type SfxAssetKey,
} from '../../game/assets/AssetKeys';
import type { AudioChannel, AudioLoadTier } from './AudioChannel';

export interface AudioCatalogEntry {
  readonly id: AudioAssetKey;
  readonly displayName: string;
  readonly path: string;
  readonly channel: AudioChannel;
  readonly defaultVolume: number;
  readonly loop: boolean;
  readonly cooldownMs: number;
  readonly maxConcurrent: number;
  /** Higher value wins when concurrency limit is reached. */
  readonly priority: number;
  readonly loadTier: AudioLoadTier;
  readonly pitchRange?: { readonly min: number; readonly max: number };
}

export const AUDIO_CATALOG: readonly AudioCatalogEntry[] = Object.freeze([
  {
    id: AUDIO_ASSET_KEYS.MUSIC_MENU,
    displayName: 'Menu Theme',
    path: './assets/audio/music/menu-theme.m4a',
    channel: 'music',
    defaultVolume: 0.95,
    loop: true,
    cooldownMs: 0,
    maxConcurrent: 1,
    priority: 100,
    loadTier: 'deferred',
  },
  {
    id: AUDIO_ASSET_KEYS.MUSIC_GAMEPLAY,
    displayName: 'Gameplay Theme',
    path: './assets/audio/music/gameplay-theme.m4a',
    channel: 'music',
    defaultVolume: 0.9,
    loop: true,
    cooldownMs: 0,
    maxConcurrent: 1,
    priority: 100,
    loadTier: 'deferred',
  },
  {
    id: AUDIO_ASSET_KEYS.SFX_UI_CLICK,
    displayName: 'UI Click',
    path: './assets/audio/sfx/ui-click.m4a',
    channel: 'ui',
    defaultVolume: 0.85,
    loop: false,
    cooldownMs: 60,
    maxConcurrent: 2,
    priority: 20,
    loadTier: 'essential',
  },
  {
    id: AUDIO_ASSET_KEYS.SFX_UI_BACK,
    displayName: 'UI Back / Close',
    path: './assets/audio/sfx/ui-back.m4a',
    channel: 'ui',
    defaultVolume: 0.85,
    loop: false,
    cooldownMs: 60,
    maxConcurrent: 2,
    priority: 20,
    loadTier: 'essential',
  },
  {
    id: AUDIO_ASSET_KEYS.SFX_BOTTLE_SELECT,
    displayName: 'Bottle Select',
    path: './assets/audio/sfx/bottle-select.m4a',
    channel: 'gameplay',
    defaultVolume: 0.92,
    loop: false,
    cooldownMs: 60,
    maxConcurrent: 2,
    priority: 40,
    loadTier: 'essential',
    pitchRange: { min: 0.96, max: 1.04 },
  },
  {
    id: AUDIO_ASSET_KEYS.SFX_BOTTLE_DESELECT,
    displayName: 'Bottle Deselect',
    path: './assets/audio/sfx/bottle-deselect.m4a',
    channel: 'gameplay',
    defaultVolume: 0.72,
    loop: false,
    cooldownMs: 60,
    maxConcurrent: 2,
    priority: 35,
    loadTier: 'essential',
  },
  {
    id: AUDIO_ASSET_KEYS.SFX_BOTTLE_SWAP,
    displayName: 'Bottle Swap Whoosh',
    path: './assets/audio/sfx/bottle-swap.m4a',
    channel: 'gameplay',
    defaultVolume: 0.82,
    loop: false,
    cooldownMs: 80,
    maxConcurrent: 2,
    priority: 50,
    loadTier: 'essential',
  },
  {
    id: AUDIO_ASSET_KEYS.SFX_BOTTLE_LAND,
    displayName: 'Bottle Land Tap',
    path: './assets/audio/sfx/bottle-land.m4a',
    channel: 'gameplay',
    defaultVolume: 0.95,
    loop: false,
    cooldownMs: 80,
    maxConcurrent: 2,
    priority: 55,
    loadTier: 'essential',
  },
  {
    id: AUDIO_ASSET_KEYS.SFX_MATCH_INCREASE,
    displayName: 'Match Increase',
    path: './assets/audio/sfx/match-increase.m4a',
    channel: 'feedback',
    defaultVolume: 0.95,
    loop: false,
    cooldownMs: 80,
    maxConcurrent: 2,
    priority: 70,
    loadTier: 'essential',
  },
  {
    id: AUDIO_ASSET_KEYS.SFX_MATCH_DECREASE,
    displayName: 'Match Decrease',
    path: './assets/audio/sfx/match-decrease.m4a',
    channel: 'feedback',
    defaultVolume: 0.85,
    loop: false,
    cooldownMs: 80,
    maxConcurrent: 2,
    priority: 65,
    loadTier: 'essential',
  },
  {
    id: AUDIO_ASSET_KEYS.SFX_MATCH_UNCHANGED,
    displayName: 'Match Unchanged',
    path: './assets/audio/sfx/match-unchanged.m4a',
    channel: 'feedback',
    defaultVolume: 0.55,
    loop: false,
    cooldownMs: 80,
    maxConcurrent: 1,
    priority: 30,
    loadTier: 'essential',
  },
  {
    id: AUDIO_ASSET_KEYS.SFX_LEVEL_UNLOCK,
    displayName: 'Level Unlock',
    path: './assets/audio/sfx/level-unlock.m4a',
    channel: 'celebration',
    defaultVolume: 0.9,
    loop: false,
    cooldownMs: 120,
    maxConcurrent: 1,
    priority: 85,
    loadTier: 'essential',
  },
  {
    id: AUDIO_ASSET_KEYS.SFX_STAR_REVEAL,
    displayName: 'Star Reveal',
    path: './assets/audio/sfx/star-reveal.m4a',
    channel: 'celebration',
    defaultVolume: 0.92,
    loop: false,
    cooldownMs: 40,
    maxConcurrent: 3,
    priority: 88,
    loadTier: 'essential',
  },
  {
    id: AUDIO_ASSET_KEYS.SFX_VICTORY,
    displayName: 'Victory Flourish',
    path: './assets/audio/sfx/victory.m4a',
    channel: 'celebration',
    defaultVolume: 1.0,
    loop: false,
    cooldownMs: 250,
    maxConcurrent: 1,
    priority: 95,
    loadTier: 'essential',
  },
  {
    id: AUDIO_ASSET_KEYS.SFX_TUTORIAL_COMPLETE,
    displayName: 'Tutorial Complete',
    path: './assets/audio/sfx/tutorial-complete.m4a',
    channel: 'celebration',
    defaultVolume: 0.95,
    loop: false,
    cooldownMs: 250,
    maxConcurrent: 1,
    priority: 95,
    loadTier: 'essential',
  },
]);

const CATALOG_BY_ID = new Map<AudioAssetKey, AudioCatalogEntry>(
  AUDIO_CATALOG.map((entry) => [entry.id, entry]),
);

export function getAudioCatalogEntry(id: AudioAssetKey): AudioCatalogEntry | undefined {
  return CATALOG_BY_ID.get(id);
}

export function isAudioAssetKey(value: string): value is AudioAssetKey {
  return CATALOG_BY_ID.has(value as AudioAssetKey);
}

export function getEssentialAudioEntries(): readonly AudioCatalogEntry[] {
  return AUDIO_CATALOG.filter((entry) => entry.loadTier === 'essential');
}

export function getDeferredAudioEntries(): readonly AudioCatalogEntry[] {
  return AUDIO_CATALOG.filter((entry) => entry.loadTier === 'deferred');
}

export function getSfxAudioEntries(): readonly (AudioCatalogEntry & {
  readonly id: SfxAssetKey;
})[] {
  return AUDIO_CATALOG.filter(
    (entry): entry is AudioCatalogEntry & { readonly id: SfxAssetKey } => entry.channel !== 'music',
  );
}

export function getMusicAudioEntries(): readonly (AudioCatalogEntry & {
  readonly id: MusicAssetKey;
})[] {
  return AUDIO_CATALOG.filter(
    (entry): entry is AudioCatalogEntry & { readonly id: MusicAssetKey } =>
      entry.channel === 'music',
  );
}

export function getExpectedAudioAssetKeys(): readonly AudioAssetKey[] {
  return Object.values(AUDIO_ASSET_KEYS);
}
