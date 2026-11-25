import Phaser from 'phaser';
import type { GamePlatform } from '../../platform/contracts/GamePlatform';
import { SCENE_KEYS, type SceneKey } from './sceneKeys';

export class BootScene extends Phaser.Scene {
  private readonly platform: GamePlatform;
  private readonly initialSceneKey: SceneKey;

  public constructor(platform: GamePlatform, initialSceneKey: SceneKey = SCENE_KEYS.HOME) {
    super({ key: SCENE_KEYS.BOOT });
    this.platform = platform;
    this.initialSceneKey = initialSceneKey;
  }

  public create(): void {
    this.platform.notifyFirstFrameReady();
    this.scene.start(this.initialSceneKey);
  }
}
