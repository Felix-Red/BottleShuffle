import Phaser from 'phaser';
import { createGameConfig } from './config/gameConfig';
import { resolveMonetizationConfig } from './config/MonetizationConfig';
import {
  calculateScoreBreakdown,
  calculateStarRating,
  formatLevelId,
  isDifficultyId,
  type TutorialStageId,
} from './core';
import { SceneAudioCoordinator } from './game/audio/SceneAudioCoordinator';
import type {
  DevGameplayOverlayPreviewKind,
  DevVictoryPreviewKind,
  GameplaySceneData,
} from './game/gameplay/GameplaySceneData';
import type { LevelSelectionSceneData } from './game/levels/LevelSelectionSceneData';
import { LevelUnlockTracker } from './game/levels/LevelUnlockTracker';
import { ProgressionController } from './game/progression/ProgressionController';
import { BootScene } from './game/scenes/BootScene';
import { GameScene } from './game/scenes/GameScene';
import { HomeScene, type HomeSceneOptions } from './game/scenes/HomeScene';
import { LevelSelectionScene } from './game/scenes/LevelSelectionScene';
import { SCENE_KEYS, type SceneKey } from './game/scenes/sceneKeys';
import { BrowserSaveStorage } from './platform/browser/BrowserSaveStorage';
import { BrowserViewportProvider } from './platform/browser/BrowserViewportProvider';
import { NoOpAdvertisingProvider } from './platform/browser/NoOpAdvertisingProvider';
import type { GamePlatform, Unsubscribe } from './platform/contracts/GamePlatform';
import type { SaveStorage } from './platform/contracts/SaveStorage';
import { createPlatform } from './platform/createPlatform';
import { InMemorySaveStorage } from './platform/memory/InMemorySaveStorage';
import { MotionPreferenceService } from './services/MotionPreferenceService';
import { ResponsiveLayoutService } from './services/ResponsiveLayoutService';
import { SettingsService } from './services/SettingsService';
import { TutorialPreferenceService } from './services/TutorialPreferenceService';
import { AdService } from './services/advertising/AdService';
import { RewardedAdService } from './services/advertising/RewardedAdService';
import { AudioService } from './services/audio/AudioService';
import { PhaserAudioBackend } from './services/audio/PhaserAudioBackend';
import { PlatformHapticBackend } from './services/haptics/HapticBackend';
import { HapticService } from './services/haptics/HapticService';
import { SaveCoordinator } from './services/persistence/SaveCoordinator';
import { SaveService } from './services/persistence/SaveService';
import type { SaveLifecycleStatus } from './services/persistence/SaveStatus';
import { GameReadinessService } from './services/platform/GameReadinessService';

/**
 * Binds authoritative platform pause/resume to the Phaser game loop, input, audio, and haptics.
 * When hostLifecycleControl is active (YouTube Playables), guards Phaser's built-in browser
 * VISIBLE/FOCUS hooks so browser visibility events can NEVER independently resume a
 * YouTube-suspended game.
 */
function bindPlatformLifecycle(
  game: Phaser.Game,
  platform: GamePlatform,
  audioService: AudioService,
  hapticService: HapticService,
): Unsubscribe {
  const isHostAuthoritative = platform.getCapabilities?.().hostLifecycleControl ?? false;
  let hostSuspended = false;

  const enforceHostSuspension = (): void => {
    audioService.suspend('platform_suspended');
    hapticService.suspend('platform_suspended');
    game.input.enabled = false;
    game.loop.sleep();
  };

  const unsubscribePause = platform.onPause(() => {
    hostSuspended = true;
    enforceHostSuspension();
  });

  const unsubscribeResume = platform.onResume(() => {
    hostSuspended = false;
    game.input.enabled = true;
    game.loop.wake();
    audioService.resume('platform_suspended');
    hapticService.resume('platform_suspended');
  });

  const guardBrowserWake = (): void => {
    if (isHostAuthoritative && hostSuspended) {
      enforceHostSuspension();
    }
  };

  if (isHostAuthoritative) {
    game.events.on(Phaser.Core.Events.VISIBLE, guardBrowserWake);
    game.events.on(Phaser.Core.Events.FOCUS, guardBrowserWake);
  }

  return () => {
    unsubscribePause();
    unsubscribeResume();
    if (isHostAuthoritative) {
      game.events.off(Phaser.Core.Events.VISIBLE, guardBrowserWake);
      game.events.off(Phaser.Core.Events.FOCUS, guardBrowserWake);
    }
  };
}

function bindHealthDiagnostics(platform: GamePlatform): Unsubscribe {
  const isYouTube = platform.getCapabilities?.().environment === 'youtube';
  if (!isYouTube || typeof globalThis.window === 'undefined') {
    return () => undefined;
  }

  const reportError = (): void => {
    platform.logHealthError?.();
  };

  globalThis.window.addEventListener('error', reportError);
  globalThis.window.addEventListener('unhandledrejection', reportError);

  return () => {
    globalThis.window.removeEventListener('error', reportError);
    globalThis.window.removeEventListener('unhandledrejection', reportError);
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

function applyDevHomeFixture(progressionController: ProgressionController, fixture: string): void {
  const catalog = progressionController.getCatalog();
  const count =
    fixture === 'completed' ? catalog.getTotalLevelCount() : fixture === 'returning' ? 7 : 0;

  for (let n = 1; n <= count; n += 1) {
    const levelId = formatLevelId(n);
    const levelDef = catalog.getLevelById(levelId);
    const attempt = progressionController.beginCampaignAttempt(levelId);
    if (attempt.accepted && levelDef !== undefined) {
      const minSwaps = Math.max(2, Math.min(6, levelDef.bottleCount - 2));
      const extraMoves = n % 3 === 0 ? 2 : n % 2 === 0 ? 1 : 0;
      const moveCount = minSwaps + extraMoves;
      const breakdown = calculateScoreBreakdown({
        difficulty: levelDef.difficulty,
        actualMoves: moveCount,
        minimumRequiredSwaps: minSwaps,
      });
      const starRating = calculateStarRating(minSwaps, moveCount);
      progressionController.completeActiveAttempt({
        attemptId: attempt.attempt.attemptId,
        levelId,
        moveCount,
        elapsedMs: 12000 + n * 1500,
        score: breakdown.totalScore,
        starRating,
        scoringPolicyVersion: breakdown.scoringPolicyVersion,
      });
    }
  }
}

const VALID_DEV_VICTORY_PRESETS: readonly DevVictoryPreviewKind[] = [
  '3star',
  '2star',
  '1star',
  'practice',
  'chapter',
  'campaign',
];

function parseDevVictoryPreview(value: string | null): DevVictoryPreviewKind | undefined {
  if (value === null) {
    return undefined;
  }
  return VALID_DEV_VICTORY_PRESETS.find((preset) => preset === value);
}

const VALID_DEV_OVERLAY_PRESETS: readonly DevGameplayOverlayPreviewKind[] = [
  'pause',
  'settings',
  'restart',
  'exit',
];

function parseDevOverlayPreview(value: string | null): DevGameplayOverlayPreviewKind | undefined {
  if (value === null) {
    return undefined;
  }
  return VALID_DEV_OVERLAY_PRESETS.find((preset) => preset === value);
}

const VALID_DEV_TUTORIAL_STAGES: readonly TutorialStageId[] = [
  'introduction',
  'guided_selection',
  'guided_swap',
  'counter_explanation',
  'independent_puzzle',
  'completed',
];

function parseDevTutorialStage(value: string | null): TutorialStageId | undefined {
  if (value === null) {
    return undefined;
  }
  return VALID_DEV_TUTORIAL_STAGES.find((stage) => stage === value);
}

async function bootstrap(): Promise<void> {
  // 1. Detect environment and initialise authoritative platform adapter first.
  const platform = createPlatform();
  await platform.initialize();
  const isYouTubeEnv = platform.getCapabilities?.().environment === 'youtube';

  // 2. Single authoritative application-level service owners shared across all scenes.
  const progressionController = new ProgressionController();
  const settingsService = new SettingsService();
  const tutorialPreference = new TutorialPreferenceService();
  const shownSaveWarnings = new Set<SaveLifecycleStatus>();
  const readinessService = new GameReadinessService(platform);

  const devParams =
    import.meta.env.DEV && !isYouTubeEnv ? new URLSearchParams(globalThis.location.search) : null;
  const usesDevFixture =
    devParams !== null &&
    (devParams.get('homeFixture') === 'returning' ||
      devParams.get('homeFixture') === 'completed' ||
      devParams.get('scene') === 'save');

  // Inside YouTube Playables, strictly use the exclusive YouTubeSaveStorage (never LocalStorage).
  const saveStorage: SaveStorage = usesDevFixture
    ? new InMemorySaveStorage()
    : (platform.getSaveStorage?.() ?? new BrowserSaveStorage());

  const saveService = new SaveService({
    storage: saveStorage,
    targets: {
      progressionController,
      settingsService,
      tutorialPreference,
    },
  });

  const containerEl =
    typeof globalThis.document !== 'undefined'
      ? globalThis.document.getElementById('game-container')
      : null;
  const viewportProvider = new BrowserViewportProvider({ container: containerEl });
  const responsiveService = new ResponsiveLayoutService(viewportProvider);

  const motionPreference = new MotionPreferenceService(undefined, settingsService);
  const unlockTracker = new LevelUnlockTracker(progressionController);
  const audioBackend = new PhaserAudioBackend();
  const audioService = new AudioService({
    backend: audioBackend,
    settingsService,
    platform,
  });
  const audioCoordinator = new SceneAudioCoordinator(audioService);
  const hapticService = new HapticService({
    backend: new PlatformHapticBackend(platform),
    settingsService,
  });
  const monetizationConfig = resolveMonetizationConfig(import.meta.env.DEV);
  const advertisingProvider = platform.getAdvertisingProvider?.() ?? new NoOpAdvertisingProvider();
  const adService = new AdService({
    provider: advertisingProvider,
    platform,
    config: monetizationConfig,
  });
  const rewardedAdService = new RewardedAdService({
    adService,
    platform,
  });

  let saveCoordinator: SaveCoordinator | undefined;

  // 3. Kick off cloud/local save restoration & font loading concurrently while Phaser renders BootScene.
  const startupBarrierPromise = Promise.all([waitForLocalFonts(), saveService.initialise()]).then(
    () => {
      if (devParams !== null) {
        const homeFixture = devParams.get('homeFixture');
        if (devParams.get('reduced') === '1') {
          motionPreference.setOverride(true);
        }
        if (homeFixture === 'returning' || homeFixture === 'completed') {
          applyDevHomeFixture(progressionController, homeFixture);
          tutorialPreference.markCompleted();
        }
      }

      // Prevent stale unlock animations for already-unlocked saved levels.
      unlockTracker.clearAll();

      // Wire automatic saving strictly AFTER startup load/restoration completes.
      saveCoordinator = new SaveCoordinator({
        saveService,
        progressionController,
        settingsService,
        tutorialPreference,
        platform,
      });

      readinessService.markSaveRestored();
    },
  );

  let initialSceneKey: SceneKey = SCENE_KEYS.HOME;
  let devGameLaunchData: GameplaySceneData | undefined;
  let devLevelSelectionData: LevelSelectionSceneData | undefined;
  let devHomeOptions: HomeSceneOptions = {};
  const scenes: Phaser.Scene[] = [];

  const createBootScene = (targetScene: SceneKey): BootScene =>
    new BootScene(platform, targetScene, {
      readinessService,
      waitForStartupReady: () => startupBarrierPromise,
    });

  const createCoreScenes = (): Phaser.Scene[] => [
    new HomeScene(
      platform,
      progressionController,
      motionPreference,
      devHomeOptions,
      tutorialPreference,
      settingsService,
      audioCoordinator,
      saveService,
      shownSaveWarnings,
      responsiveService,
      readinessService,
    ),
    new LevelSelectionScene(
      platform,
      progressionController,
      motionPreference,
      unlockTracker,
      devLevelSelectionData,
      tutorialPreference,
      audioCoordinator,
      responsiveService,
      readinessService,
    ),
    new GameScene(
      platform,
      progressionController,
      devGameLaunchData,
      motionPreference,
      tutorialPreference,
      settingsService,
      audioCoordinator,
      hapticService,
      saveService,
      shownSaveWarnings,
      responsiveService,
      readinessService,
      adService,
    ),
  ];

  if (import.meta.env.DEV && devParams !== null) {
    const params = devParams;
    const requestedScene = params.get('scene');
    const homeDialog = params.get('homeDialog');

    if (homeDialog === 'practice' || homeDialog === 'settings') {
      devHomeOptions = { devInitialDialog: homeDialog };
    }

    if (requestedScene === 'tutorial') {
      const stage = parseDevTutorialStage(params.get('stage'));
      devGameLaunchData = {
        mode: 'tutorial',
        tutorialOrigin: 'first_time',
        returnTo: 'home',
        nextCampaignLevelId: 'level-001',
        ...(stage !== undefined ? { devTutorialStage: stage } : {}),
      };
      initialSceneKey = SCENE_KEYS.GAME;
    } else if (requestedScene === 'levels') {
      const chapterParam = params.get('chapter');
      const levelParam = params.get('level');
      const previewParam = params.get('preview');
      devLevelSelectionData = {
        ...(chapterParam !== null && chapterParam.trim().length > 0
          ? { chapterId: chapterParam.trim() }
          : {}),
        ...(levelParam !== null && levelParam.trim().length > 0
          ? { levelId: levelParam.trim() }
          : {}),
        ...(previewParam !== null && previewParam.trim().length > 0
          ? { devPreviewLevelId: previewParam.trim() }
          : {}),
      };
      initialSceneKey = SCENE_KEYS.LEVEL_SELECTION;
    } else if (requestedScene === 'showcase') {
      const { ComponentShowcaseScene, parseShowcasePageParam } =
        await import('./game/scenes/ComponentShowcaseScene');
      const initialPage = parseShowcasePageParam(params.get('page'));
      initialSceneKey = SCENE_KEYS.SHOWCASE;
      scenes.push(
        createBootScene(initialSceneKey),
        ...createCoreScenes(),
        new ComponentShowcaseScene(platform, initialPage),
      );
    } else if (requestedScene === 'assets') {
      const { AssetShowcaseScene, parseAssetShowcasePageParam } =
        await import('./game/scenes/AssetShowcaseScene');
      const initialPage = parseAssetShowcasePageParam(params.get('page'));
      initialSceneKey = SCENE_KEYS.ASSET_SHOWCASE;
      scenes.push(
        createBootScene(initialSceneKey),
        ...createCoreScenes(),
        new AssetShowcaseScene(platform, initialPage),
      );
    } else if (requestedScene === 'animations') {
      const { AnimationShowcaseScene } = await import('./game/scenes/AnimationShowcaseScene');
      initialSceneKey = SCENE_KEYS.ANIMATION_SHOWCASE;
      scenes.push(
        createBootScene(initialSceneKey),
        ...createCoreScenes(),
        new AnimationShowcaseScene(platform, {
          reducedMotion: params.get('reduced') === '1',
          slowMotion: params.get('slow') === '1',
        }),
      );
    } else if (requestedScene === 'audio') {
      const { AudioShowcaseScene } = await import('./game/scenes/AudioShowcaseScene');
      initialSceneKey = SCENE_KEYS.AUDIO_SHOWCASE;
      scenes.push(
        createBootScene(initialSceneKey),
        ...createCoreScenes(),
        new AudioShowcaseScene(platform, settingsService, audioCoordinator, hapticService),
      );
    } else if (requestedScene === 'save') {
      const { SaveShowcaseScene } = await import('./game/scenes/SaveShowcaseScene');
      initialSceneKey = SCENE_KEYS.SAVE_SHOWCASE;
      scenes.push(createBootScene(initialSceneKey), new SaveShowcaseScene(platform));
    } else if (requestedScene === 'responsive') {
      const { ResponsiveShowcaseScene } = await import('./game/scenes/ResponsiveShowcaseScene');
      initialSceneKey = SCENE_KEYS.RESPONSIVE_SHOWCASE;
      scenes.push(
        createBootScene(initialSceneKey),
        new ResponsiveShowcaseScene(platform, responsiveService, motionPreference),
      );
    } else if (requestedScene === 'ads') {
      const { AdvertisingShowcaseScene, ADVERTISING_SHOWCASE_SCENE_KEY } =
        await import('./game/scenes/AdvertisingShowcaseScene');
      const adsKey = ADVERTISING_SHOWCASE_SCENE_KEY as SceneKey;
      initialSceneKey = adsKey;
      scenes.push(createBootScene(adsKey), new AdvertisingShowcaseScene(platform));
    } else if (requestedScene === 'game') {
      const levelParam = params.get('level');
      const diffParam = params.get('difficulty');
      const seedParam = params.get('seed');
      const countParam = params.get('count');
      const victoryPreset = parseDevVictoryPreview(params.get('devVictory'));
      const overlayPreset = parseDevOverlayPreview(params.get('devPause'));
      const devVictoryViewState =
        victoryPreset !== undefined
          ? (await import('./game/victory/DevVictoryPreview')).buildDevVictoryPreview(
              victoryPreset,
              progressionController.getCatalog(),
            )
          : undefined;
      const parsedCount = countParam !== null ? Number(countParam) : undefined;

      if (levelParam !== null && levelParam.trim().length > 0) {
        devGameLaunchData = {
          mode: 'campaign',
          levelId: levelParam.trim(),
          ...(devVictoryViewState !== undefined ? { devVictoryViewState } : {}),
          ...(overlayPreset !== undefined ? { devOverlayPreview: overlayPreset } : {}),
        };
      } else {
        devGameLaunchData = {
          mode: 'practice',
          ...(diffParam !== null && isDifficultyId(diffParam) ? { difficulty: diffParam } : {}),
          ...(seedParam !== null && seedParam.trim().length > 0 ? { seed: seedParam.trim() } : {}),
          ...(parsedCount !== undefined && Number.isInteger(parsedCount)
            ? { bottleCount: parsedCount }
            : {}),
          ...(devVictoryViewState !== undefined ? { devVictoryViewState } : {}),
          ...(overlayPreset !== undefined ? { devOverlayPreview: overlayPreset } : {}),
        };
      }
      initialSceneKey = SCENE_KEYS.GAME;
    }
  }

  if (scenes.length === 0) {
    scenes.push(createBootScene(initialSceneKey), ...createCoreScenes());
  }

  const game = new Phaser.Game(createGameConfig({ scenes }));
  audioBackend.attachGame(game);
  const unbindLifecycle = bindPlatformLifecycle(game, platform, audioService, hapticService);
  const unbindHealth = bindHealthDiagnostics(platform);
  const unbindResponsiveScale = responsiveService.subscribe((snapshot) => {
    if (
      game.scale.width !== snapshot.viewport.width ||
      game.scale.height !== snapshot.viewport.height
    ) {
      game.scale.resize(snapshot.viewport.width, snapshot.viewport.height);
    }
  });

  game.events.once(Phaser.Core.Events.DESTROY, () => {
    unbindResponsiveScale();
    unbindHealth();
    unbindLifecycle();
    responsiveService.dispose();
    saveCoordinator?.dispose();
    saveService.dispose();
    saveStorage.dispose?.();
    rewardedAdService.dispose();
    adService.dispose();
    audioCoordinator.dispose();
    audioService.dispose();
    hapticService.dispose();
    unlockTracker.dispose();
    tutorialPreference.dispose();
    motionPreference.dispose();
    settingsService.dispose();
    platform.dispose();
  });
}

void bootstrap();
