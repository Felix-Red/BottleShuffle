import { describe, expect, it } from 'vitest';
import { GameplayController } from '../../src/game/gameplay/GameplayController';
import { LevelTransitionCoordinator } from '../../src/game/navigation/LevelTransitionCoordinator';
import { ProgressionController } from '../../src/game/progression/ProgressionController';
import { YouTubePlatform } from '../../src/platform/youtube/YouTubePlatform';
import { GlobalYouTubeSdkClient } from '../../src/platform/youtube/YouTubeSdkClient';
import { SettingsService } from '../../src/services/SettingsService';
import { TutorialPreferenceService } from '../../src/services/TutorialPreferenceService';
import { AdService } from '../../src/services/advertising/AdService';
import { RewardedAdService } from '../../src/services/advertising/RewardedAdService';
import type {
  AudioBackend,
  BackendMusicPlayRequest,
  BackendSfxPlayRequest,
} from '../../src/services/audio/AudioBackend';
import { AudioService } from '../../src/services/audio/AudioService';
import { SaveCoordinator } from '../../src/services/persistence/SaveCoordinator';
import { SaveService } from '../../src/services/persistence/SaveService';
import { MockAdvertisingProvider } from '../helpers/MockAdvertisingProvider';
import { MockYouTubeSdk } from '../helpers/MockYouTubeSdk';

function createStubAudioBackend(): AudioBackend {
  let id = 1;
  return {
    isUnlocked: () => true,
    unlock: () => Promise.resolve(true),
    onUnlocked: () => () => undefined,
    hasAsset: () => true,
    playSfx: (req: BackendSfxPlayRequest) => ({
      id: id++,
      key: req.key,
      channel: req.channel,
      priority: req.priority,
      stop: () => undefined,
      setVolume: () => undefined,
      isPlaying: () => false,
    }),
    playMusic: (req: BackendMusicPlayRequest) => ({
      key: req.key,
      stop: () => undefined,
      pause: () => undefined,
      resume: () => undefined,
      setVolume: () => undefined,
      fadeTo: () => undefined,
      isPlaying: () => true,
      isPaused: () => false,
    }),
    setGlobalMute: () => undefined,
    dispose: () => undefined,
  };
}

describe('Long-session stability & adversarial rapid-interaction soak test (120 cycles)', () => {
  it('survives 120 repeated gameplay/transition/pause/settings/ad cycles with zero listener leaks and stable state', async () => {
    const sdk = new MockYouTubeSdk();
    const platform = new YouTubePlatform(new GlobalYouTubeSdkClient(() => sdk.asSdk()));
    await platform.initialize();

    const progression = new ProgressionController();
    const settings = new SettingsService();
    const tutorial = new TutorialPreferenceService();
    const saveService = new SaveService({
      storage: platform.getSaveStorage(),
      targets: {
        progressionController: progression,
        settingsService: settings,
        tutorialPreference: tutorial,
      },
      normalDebounceMs: 0,
    });
    await saveService.initialise();

    const saveCoordinator = new SaveCoordinator({
      saveService,
      progressionController: progression,
      settingsService: settings,
      tutorialPreference: tutorial,
      platform,
    });

    const audioService = new AudioService({
      backend: createStubAudioBackend(),
      settingsService: settings,
      platform,
    });

    const mockAds = new MockAdvertisingProvider();
    const adService = new AdService({ provider: mockAds, platform });
    const rewardedService = new RewardedAdService({ adService, platform });

    let totalAcceptedSwaps = 0;
    let totalLaunches = 0;

    for (let cycle = 0; cycle < 120; cycle += 1) {
      const controller = new GameplayController({
        sceneData: { mode: 'campaign', levelId: 'level-001' },
        progressionController: progression,
        callbacks: {
          onViewStateChange: () => undefined,
          onSwapStarted: (transition) => {
            totalAcceptedSwaps += 1;
            // Adversarial: tap rapidly during an active swap — must be ignored
            controller.handleBottleTap(0);
            controller.handleBottleTap(1);
            controller.completeSwapTransition(transition.transitionId);
          },
          onSwapCompleted: () => undefined,
          onPlayerGameEvents: () => undefined,
          onProgressionEvents: () => undefined,
          onExitConfirmed: () => undefined,
          onTutorialConfirmed: () => undefined,
        },
      });
      controller.start();

      // Perform several swaps, rapid deselects, pause/resume, settings open/close, and restart
      controller.handleBottleTap(0);
      controller.handleBottleTap(0); // deselect
      controller.handleBottleTap(0);
      controller.handleBottleTap(1); // swap 1
      controller.handleBottleTap(1);
      controller.handleBottleTap(2); // swap 2

      // Repeated pause/settings/cancel/resume + host suspension interleaving
      controller.requestPause();
      controller.openSettingsFromPause();
      settings.setSoundEffectsEnabled(cycle % 2 === 0);
      controller.closeSettings();
      controller.requestRestartConfirmation();
      controller.cancelRestartConfirmation();
      sdk.triggerPause();
      sdk.triggerResume();
      // Manual pause must still be preserved after host resume!
      expect(controller.getViewState().overlayMode).toBe('pause');
      controller.resumeFromPause();
      expect(controller.getViewState().overlayMode).toBe('none');

      // Simulate level transition coordinator creation, transition, duplicate block, and disposal
      const coordinator = new LevelTransitionCoordinator({
        platform,
        adService,
        progressionController: progression,
        saveService,
        isDestinationAccessible: () => true,
        onLaunchCampaignLevel: () => {
          totalLaunches += 1;
        },
      });

      mockAds.setDefaultInterstitialStatus(
        cycle % 3 === 0 ? 'request_completed' : cycle % 3 === 1 ? 'unavailable' : 'failed',
      );
      const res = await coordinator.requestCampaignNextLevel({
        sourceLevelId: 'level-001',
        destinationLevelId: 'level-002',
        puzzleCompleted: true,
        completionCommitted: true,
        victoryPresented: true,
      });
      expect(res.launched).toBe(true);

      coordinator.dispose();
      controller.dispose();
    }

    expect(totalAcceptedSwaps).toBe(240);
    expect(totalLaunches).toBe(120);
    expect(mockAds.interstitialRequestCount).toBe(120);

    // Host SDK registrations stay strictly single-registered (no leak per cycle!)
    expect(sdk.getActiveListenerCounts()).toEqual({ audio: 1, pause: 1, resume: 1 });

    // Clean disposal releases every host SDK listener
    rewardedService.dispose();
    adService.dispose();
    audioService.dispose();
    saveCoordinator.dispose();
    saveService.dispose();
    settings.dispose();
    tutorial.dispose();
    platform.dispose();

    expect(sdk.getActiveListenerCounts()).toEqual({ audio: 0, pause: 0, resume: 0 });
  });
});
