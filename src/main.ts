import Phaser from 'phaser';
import { createGameConfig } from './config/gameConfig';
import { isDifficultyId } from './core';
import type { GameplaySceneData } from './game/gameplay/GameplaySceneData';
import { BootScene } from './game/scenes/BootScene';
import { GameScene } from './game/scenes/GameScene';
import { HomeScene } from './game/scenes/HomeScene';
import { SCENE_KEYS, type SceneKey } from './game/scenes/sceneKeys';
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

async function waitForLocalFonts(): Promise<void> {
  if (typeof globalThis.document === 'undefined' || !('fonts' in globalThis.document)) {
    return;
  }

  const fontLoadPromises = [
    globalThis.document.fonts.load('700 32px "Fredoka"'),
    globalThis.document.fonts.load('400 18px "Nunito"'),
    globalThis.document.fonts.load('700 18px "Nunito"'),
  ];

  const timeout = new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, 600);
  });

  await Promise.race([Promise.allSettled(fontLoadPromises).then(() => undefined), timeout]);
}

async function bootstrap(): Promise<void> {
  const platform = createPlatform();
  await Promise.all([platform.initialize(), waitForLocalFonts()]);

  let initialSceneKey: SceneKey = SCENE_KEYS.HOME;
  let devGameLaunchData: GameplaySceneData | undefined;
  const scenes: Phaser.Scene[] = [];

  if (import.meta.env.DEV) {
    const params = new URLSearchParams(globalThis.location.search);
    const requestedScene = params.get('scene');

    if (requestedScene === 'showcase') {
      const { ComponentShowcaseScene, parseShowcasePageParam } =
        await import('./game/scenes/ComponentShowcaseScene');
      const initialPage = parseShowcasePageParam(params.get('page'));
      initialSceneKey = SCENE_KEYS.SHOWCASE;
      scenes.push(
        new BootScene(platform, initialSceneKey),
        new HomeScene(platform),
        new GameScene(platform),
        new ComponentShowcaseScene(platform, initialPage),
      );
    } else if (requestedScene === 'assets') {
      const { AssetShowcaseScene, parseAssetShowcasePageParam } =
        await import('./game/scenes/AssetShowcaseScene');
      const initialPage = parseAssetShowcasePageParam(params.get('page'));
      initialSceneKey = SCENE_KEYS.ASSET_SHOWCASE;
      scenes.push(
        new BootScene(platform, initialSceneKey),
        new HomeScene(platform),
        new GameScene(platform),
        new AssetShowcaseScene(platform, initialPage),
      );
    } else if (requestedScene === 'animations') {
      const { AnimationShowcaseScene } = await import('./game/scenes/AnimationShowcaseScene');
      initialSceneKey = SCENE_KEYS.ANIMATION_SHOWCASE;
      scenes.push(
        new BootScene(platform, initialSceneKey),
        new HomeScene(platform),
        new GameScene(platform),
        new AnimationShowcaseScene(platform, {
          reducedMotion: params.get('reduced') === '1',
          slowMotion: params.get('slow') === '1',
        }),
      );
    } else if (requestedScene === 'game') {
      const diffParam = params.get('difficulty');
      const seedParam = params.get('seed');
      const countParam = params.get('count');
      const parsedCount = countParam !== null ? Number(countParam) : undefined;

      devGameLaunchData = {
        ...(diffParam !== null && isDifficultyId(diffParam) ? { difficulty: diffParam } : {}),
        ...(seedParam !== null && seedParam.trim().length > 0 ? { seed: seedParam.trim() } : {}),
        ...(parsedCount !== undefined && Number.isInteger(parsedCount)
          ? { bottleCount: parsedCount }
          : {}),
      };
      initialSceneKey = SCENE_KEYS.GAME;
    }
  }

  if (scenes.length === 0) {
    scenes.push(
      new BootScene(platform, initialSceneKey),
      new HomeScene(platform),
      new GameScene(platform, devGameLaunchData),
    );
  }

  const game = new Phaser.Game(createGameConfig({ scenes }));
  const unbindLifecycle = bindPlatformLifecycle(game, platform);

  game.events.once(Phaser.Core.Events.DESTROY, () => {
    unbindLifecycle();
    platform.dispose();
  });
}

void bootstrap();
