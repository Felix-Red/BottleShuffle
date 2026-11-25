import Phaser from 'phaser';
import { COLORS } from '../design-system/tokens/colors';
import { APP_METADATA, REFERENCE_RESOLUTION } from './appConfig';

export interface GameConfigOptions {
  readonly scenes: Phaser.Types.Scenes.SceneType[];
  readonly parent?: string | HTMLElement;
}

export function createGameConfig(options: GameConfigOptions): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: options.parent ?? APP_METADATA.containerId,
    backgroundColor: COLORS.background,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: REFERENCE_RESOLUTION.width,
      height: REFERENCE_RESOLUTION.height,
    },
    input: {
      activePointers: 2,
      touch: {
        capture: true,
      },
      mouse: {
        preventDefaultWheel: true,
      },
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
    },
    scene: options.scenes,
  };
}
