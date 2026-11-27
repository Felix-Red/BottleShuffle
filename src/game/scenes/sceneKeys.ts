export const SCENE_KEYS = {
  BOOT: 'BootScene',
  HOME: 'HomeScene',
  LEVEL_SELECTION: 'LevelSelectionScene',
  GAME: 'GameScene',
  SHOWCASE: 'ComponentShowcaseScene',
  ASSET_SHOWCASE: 'AssetShowcaseScene',
  ANIMATION_SHOWCASE: 'AnimationShowcaseScene',
  AUDIO_SHOWCASE: 'AudioShowcaseScene',
  SAVE_SHOWCASE: 'SaveShowcaseScene',
  RESPONSIVE_SHOWCASE: 'ResponsiveShowcaseScene',
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];
