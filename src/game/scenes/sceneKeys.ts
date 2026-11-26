export const SCENE_KEYS = {
  BOOT: 'BootScene',
  HOME: 'HomeScene',
  GAME: 'GameScene',
  SHOWCASE: 'ComponentShowcaseScene',
  ASSET_SHOWCASE: 'AssetShowcaseScene',
  ANIMATION_SHOWCASE: 'AnimationShowcaseScene',
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];
