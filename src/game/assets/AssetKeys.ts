import type { BottleColorId } from '../../design-system/tokens/Colors';

export const BOTTLE_TEXTURE_KEYS: Readonly<Record<BottleColorId, `bottle:${BottleColorId}`>> = {
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

export const ASSET_KEYS = {
  Bottles: BOTTLE_TEXTURE_KEYS,
  Environment: ENVIRONMENT_TEXTURE_KEYS,
  Effects: EFFECT_TEXTURE_KEYS,
  Icons: ICON_TEXTURE_KEYS,
} as const;

export type BottleTextureKey = (typeof BOTTLE_TEXTURE_KEYS)[BottleColorId];
export type EnvironmentTextureKey =
  (typeof ENVIRONMENT_TEXTURE_KEYS)[keyof typeof ENVIRONMENT_TEXTURE_KEYS];
export type EffectTextureKey = (typeof EFFECT_TEXTURE_KEYS)[keyof typeof EFFECT_TEXTURE_KEYS];
export type IconTextureKey = (typeof ICON_TEXTURE_KEYS)[keyof typeof ICON_TEXTURE_KEYS];
export type AssetKey = BottleTextureKey | EnvironmentTextureKey | EffectTextureKey | IconTextureKey;
