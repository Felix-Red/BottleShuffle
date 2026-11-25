import Phaser from 'phaser';
import type { GamePlatform } from '../../platform/contracts/GamePlatform';
import { SCENE_KEYS } from './sceneKeys';

export class BootScene extends Phaser.Scene {
  private readonly platform: GamePlatform;

  public constructor(platform: GamePlatform) {
    super({ key: SCENE_KEYS.BOOT });
    this.platform = platform;
  }

  public create(): void {
    this.platform.notifyFirstFrameReady();
    this.scene.start(SCENE_KEYS.HOME);
  }
}
