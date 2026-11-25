export const SCENE_KEYS = {
  BOOT: 'BootScene',
  HOME: 'HomeScene',
  SHOWCASE: 'ComponentShowcaseScene',
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];
