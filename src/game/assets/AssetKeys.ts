import type { BottleId } from '../../core/models/BottleId';

export const BOTTLE_TEXTURE_KEYS: Readonly<Record<BottleId, `bottle:${BottleId}`>> = {
  red: 'bottle:red',
  blue: 'bottle:blue',
  green: 'bottle:green',
  yellow: 'bottle:yellow',
  purple: 'bottle:purple',
  orange: 'bottle:orange',
  pink: 'bottle:pink',
  teal: 'bottle:teal',
  brown: 'bottle:brown',
  silver: 'bottle:silver',
} as const;

export const ENVIRONMENT_TEXTURE_KEYS = {
  BACKGROUND: 'env:background',
  SHELF: 'env:shelf',
  SHELF_EDGE: 'env:shelf-edge',
  HIDDEN_COMPARTMENT: 'env:hidden-compartment',
  HIDDEN_SLOT: 'env:hidden-slot',
} as const;

export const EFFECT_TEXTURE_KEYS = {
  BOTTLE_SHADOW: 'fx:bottle-shadow',
  SELECTION_GLOW: 'fx:selection-glow',
  SPARKLE: 'fx:sparkle',
  PARTICLE: 'fx:particle',
} as const;

export const ICON_TEXTURE_KEYS = {
  LOCK: 'icon:lock',
} as const;

export const AUDIO_ASSET_KEYS = {
  MUSIC_MENU: 'audio:music:menu-theme',
  MUSIC_GAMEPLAY: 'audio:music:gameplay-theme',
  SFX_UI_CLICK: 'audio:sfx:ui-click',
  SFX_UI_BACK: 'audio:sfx:ui-back',
  SFX_BOTTLE_SELECT: 'audio:sfx:bottle-select',
  SFX_BOTTLE_DESELECT: 'audio:sfx:bottle-deselect',
  SFX_BOTTLE_SWAP: 'audio:sfx:bottle-swap',
  SFX_BOTTLE_LAND: 'audio:sfx:bottle-land',
  SFX_MATCH_INCREASE: 'audio:sfx:match-increase',
  SFX_MATCH_DECREASE: 'audio:sfx:match-decrease',
  SFX_MATCH_UNCHANGED: 'audio:sfx:match-unchanged',
  SFX_LEVEL_UNLOCK: 'audio:sfx:level-unlock',
  SFX_STAR_REVEAL: 'audio:sfx:star-reveal',
  SFX_VICTORY: 'audio:sfx:victory',
  SFX_TUTORIAL_COMPLETE: 'audio:sfx:tutorial-complete',
} as const;

export const ASSET_KEYS = {
  Bottles: BOTTLE_TEXTURE_KEYS,
  Environment: ENVIRONMENT_TEXTURE_KEYS,
  Effects: EFFECT_TEXTURE_KEYS,
  Icons: ICON_TEXTURE_KEYS,
  Audio: AUDIO_ASSET_KEYS,
} as const;

export type BottleTextureKey = (typeof BOTTLE_TEXTURE_KEYS)[BottleId];
export type EnvironmentTextureKey =
  (typeof ENVIRONMENT_TEXTURE_KEYS)[keyof typeof ENVIRONMENT_TEXTURE_KEYS];
export type EffectTextureKey = (typeof EFFECT_TEXTURE_KEYS)[keyof typeof EFFECT_TEXTURE_KEYS];
export type IconTextureKey = (typeof ICON_TEXTURE_KEYS)[keyof typeof ICON_TEXTURE_KEYS];
export type AudioAssetKey = (typeof AUDIO_ASSET_KEYS)[keyof typeof AUDIO_ASSET_KEYS];
export type MusicAssetKey =
  typeof AUDIO_ASSET_KEYS.MUSIC_MENU | typeof AUDIO_ASSET_KEYS.MUSIC_GAMEPLAY;
export type SfxAssetKey = Exclude<AudioAssetKey, MusicAssetKey>;
export type AssetKey = BottleTextureKey | EnvironmentTextureKey | EffectTextureKey | IconTextureKey;
