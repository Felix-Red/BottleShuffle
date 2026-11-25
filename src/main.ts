import Phaser from 'phaser';
import { createGameConfig } from './config/gameConfig';
import { BootScene } from './game/scenes/BootScene';
import { HomeScene } from './game/scenes/HomeScene';
import type { GamePlatform, Unsubscribe } from './platform/contracts/GamePlatform';
import { createPlatform } from './platform/createPlatform';

function bindPlatformLifecycle(game: Phaser.Game, platform: GamePlatform): Unsubscribe {
  const applyAudioPreference = (enabled: boolean): void => {
    game.sound.mute = !enabled;
  };

  applyAudioPreference(platform.isAudioEnabled());

  const unsubscribeAudio = platform.onAudioEnabledChange(applyAudioPreference);
  const unsubscribePause = platform.onPause(() => {
    game.sound.pauseAll();
    game.loop.sleep();
  });
  const unsubscribeResume = platform.onResume(() => {
    game.loop.wake();
    game.sound.resumeAll();
  });

  return () => {
    unsubscribeAudio();
    unsubscribePause();
    unsubscribeResume();
  };
}

async function bootstrap(): Promise<void> {
  const platform = createPlatform();
  await platform.initialize();

  const scenes = [new BootScene(platform), new HomeScene(platform)];
  const game = new Phaser.Game(createGameConfig({ scenes }));
  const unbindLifecycle = bindPlatformLifecycle(game, platform);

  game.events.once(Phaser.Core.Events.DESTROY, () => {
    unbindLifecycle();
    platform.dispose();
  });
}

void bootstrap();
