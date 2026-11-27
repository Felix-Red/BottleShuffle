import { describe, expect, it } from 'vitest';
import { MONETIZATION_COPY } from '../../src/config/MonetizationConfig';
import { calculateScoreBreakdown, calculateStarRating } from '../../src/core';
import { LevelTransitionCoordinator } from '../../src/game/navigation/LevelTransitionCoordinator';
import { ProgressionController } from '../../src/game/progression/ProgressionController';
import { BrowserGamePlatform } from '../../src/platform/browser/BrowserGamePlatform';
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
import { SaveService } from '../../src/services/persistence/SaveService';
import { MockAdvertisingProvider } from '../helpers/MockAdvertisingProvider';
import { createMockSdkError, MockYouTubeSdk } from '../helpers/MockYouTubeSdk';

function createSilentMockAudioBackend(): AudioBackend & { readonly playCalls: string[] } {
  const playCalls: string[] = [];
  let handleCounter = 1;
  return {
    playCalls,
    isUnlocked: () => true,
    unlock: () => Promise.resolve(true),
    onUnlocked: () => () => undefined,
    hasAsset: () => true,
    playSfx: (request: BackendSfxPlayRequest) => {
      playCalls.push(`sfx:${request.key}`);
      return {
        id: handleCounter++,
        key: request.key,
        channel: request.channel,
        priority: request.priority,
        stop: () => undefined,
        setVolume: () => undefined,
        isPlaying: () => false,
      };
    },
    playMusic: (request: BackendMusicPlayRequest) => {
      playCalls.push(`music:${request.key}`);
      return {
        key: request.key,
        stop: () => undefined,
        pause: () => undefined,
        resume: () => undefined,
        setVolume: () => undefined,
        fadeTo: () => undefined,
        isPlaying: () => true,
        isPaused: () => false,
      };
    },
    setGlobalMute: () => undefined,
    dispose: () => undefined,
  };
}

function completeCampaignLevel(progression: ProgressionController, levelId: string): void {
  const levelDef = progression.getCatalog().getLevelById(levelId);
  expect(levelDef).toBeDefined();
  const attempt = progression.beginCampaignAttempt(levelId);
  expect(attempt.accepted).toBe(true);
  if (!attempt.accepted || levelDef === undefined) {
    return;
  }
  const minSwaps = Math.max(2, levelDef.bottleCount - 2);
  const breakdown = calculateScoreBreakdown({
    difficulty: levelDef.difficulty,
    actualMoves: minSwaps,
    minimumRequiredSwaps: minSwaps,
  });
  const stars = calculateStarRating(minSwaps, minSwaps);
  progression.completeActiveAttempt({
    attemptId: attempt.attempt.attemptId,
    levelId,
    moveCount: minSwaps,
    elapsedMs: 11_500,
    score: breakdown.totalScore,
    starRating: stars,
    scoringPolicyVersion: breakdown.scoringPolicyVersion,
  });
}

describe('Advertising end-to-end integration journeys (Task 18)', () => {
  it('Journey 1: Successful campaign transition commits score/progression, flushes save, requests eligible interstitial, and launches next level once', async () => {
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
    });
    await saveService.initialise();

    const adService = new AdService({
      provider: platform.getAdvertisingProvider(),
      platform,
    });

    const launchedLevels: string[] = [];
    const coordinator = new LevelTransitionCoordinator({
      platform,
      adService,
      progressionController: progression,
      saveService,
      onLaunchCampaignLevel: (levelId) => {
        launchedLevels.push(levelId);
      },
    });

    completeCampaignLevel(progression, 'level-001');
    saveService.requestSave('campaign_completion', 'high');

    const result = await coordinator.requestCampaignNextLevel({
      sourceLevelId: 'level-001',
      destinationLevelId: 'level-002',
      puzzleCompleted: true,
      completionCommitted: true,
      victoryPresented: true,
    });

    expect(result.status).toBe('launched');
    expect(result.launched).toBe(true);
    expect(result.adOutcome?.status).toBe('request_completed');
    expect(sdk.interstitialAdCalls).toBe(1);
    expect(sdk.saveDataCalls).toBeGreaterThanOrEqual(1);
    expect(launchedLevels).toEqual(['level-002']);

    coordinator.dispose();
    adService.dispose();
    saveService.dispose();
    platform.dispose();
  });

  it('Journey 2: Unavailable advertisement still navigates cleanly and preserves completion records', async () => {
    const sdk = new MockYouTubeSdk();
    sdk.setNextInterstitialError(createMockSdkError('API_UNAVAILABLE', 'No inventory'));
    const platform = new YouTubePlatform(new GlobalYouTubeSdkClient(() => sdk.asSdk()));
    await platform.initialize();

    const progression = new ProgressionController();
    completeCampaignLevel(progression, 'level-001');

    const adService = new AdService({ provider: platform.getAdvertisingProvider(), platform });
    const launched: string[] = [];
    const coordinator = new LevelTransitionCoordinator({
      platform,
      adService,
      progressionController: progression,
      onLaunchCampaignLevel: (id) => launched.push(id),
    });

    const res = await coordinator.requestCampaignNextLevel({
      sourceLevelId: 'level-001',
      destinationLevelId: 'level-002',
      puzzleCompleted: true,
      completionCommitted: true,
      victoryPresented: true,
    });

    expect(res.status).toBe('launched');
    expect(res.adOutcome?.status).toBe('unavailable');
    expect(launched).toEqual(['level-002']);
    expect(progression.getLevelProgressView('level-001')?.status).toBe('completed');
    expect(progression.getLevelProgressView('level-001')?.record?.bestStarRating).toBe(3);

    coordinator.dispose();
    adService.dispose();
    platform.dispose();
  });

  it('Journey 3: Failed advertising request causes zero retry loops, preserves progression, and launches next level', async () => {
    const sdk = new MockYouTubeSdk();
    sdk.setNextInterstitialError(new Error('Transient ad error'));
    const platform = new YouTubePlatform(new GlobalYouTubeSdkClient(() => sdk.asSdk()));
    await platform.initialize();

    const progression = new ProgressionController();
    completeCampaignLevel(progression, 'level-001');

    const adService = new AdService({ provider: platform.getAdvertisingProvider(), platform });
    const launched: string[] = [];
    const coordinator = new LevelTransitionCoordinator({
      platform,
      adService,
      progressionController: progression,
      onLaunchCampaignLevel: (id) => launched.push(id),
    });

    const res = await coordinator.requestCampaignNextLevel({
      sourceLevelId: 'level-001',
      destinationLevelId: 'level-002',
      puzzleCompleted: true,
      completionCommitted: true,
      victoryPresented: true,
    });

    expect(res.status).toBe('launched');
    expect(res.adOutcome?.status).toBe('failed');
    expect(sdk.interstitialAdCalls).toBe(1);
    expect(launched).toEqual(['level-002']);
    expect(progression.getCampaignAchievementSummary().completedLevels).toBe(1);

    coordinator.dispose();
    adService.dispose();
    platform.dispose();
  });

  it('Journey 4: Repeated Next Level button presses create only 1 ad request, 1 transaction, and 1 launch', async () => {
    const sdk = new MockYouTubeSdk();
    const deferred = sdk.setNextInterstitialDeferred();
    const platform = new YouTubePlatform(new GlobalYouTubeSdkClient(() => sdk.asSdk()));
    await platform.initialize();

    const progression = new ProgressionController();
    completeCampaignLevel(progression, 'level-001');

    const adService = new AdService({ provider: platform.getAdvertisingProvider(), platform });
    const launched: string[] = [];
    const coordinator = new LevelTransitionCoordinator({
      platform,
      adService,
      progressionController: progression,
      onLaunchCampaignLevel: (id) => launched.push(id),
    });

    const p1 = coordinator.requestCampaignNextLevel({
      sourceLevelId: 'level-001',
      destinationLevelId: 'level-002',
      puzzleCompleted: true,
      completionCommitted: true,
      victoryPresented: true,
    });
    const r2 = await coordinator.requestCampaignNextLevel({
      sourceLevelId: 'level-001',
      destinationLevelId: 'level-002',
      puzzleCompleted: true,
      completionCommitted: true,
      victoryPresented: true,
    });
    const r3 = await coordinator.requestCampaignNextLevel({
      sourceLevelId: 'level-001',
      destinationLevelId: 'level-002',
      puzzleCompleted: true,
      completionCommitted: true,
      victoryPresented: true,
    });

    expect(r2.status).toBe('duplicate_blocked');
    expect(r3.status).toBe('duplicate_blocked');
    expect(sdk.interstitialAdCalls).toBe(1);

    deferred.resolve();
    const r1 = await p1;
    expect(r1.status).toBe('launched');
    expect(launched).toEqual(['level-002']);

    coordinator.dispose();
    adService.dispose();
    platform.dispose();
  });

  it('Journey 5: Host lifecycle interruption defers next-level launch until host onResume', async () => {
    const sdk = new MockYouTubeSdk();
    const deferred = sdk.setNextInterstitialDeferred();
    const platform = new YouTubePlatform(new GlobalYouTubeSdkClient(() => sdk.asSdk()));
    await platform.initialize();

    const progression = new ProgressionController();
    completeCampaignLevel(progression, 'level-001');

    const adService = new AdService({ provider: platform.getAdvertisingProvider(), platform });
    const launched: string[] = [];
    const coordinator = new LevelTransitionCoordinator({
      platform,
      adService,
      progressionController: progression,
      onLaunchCampaignLevel: (id) => launched.push(id),
    });

    const transitionPromise = coordinator.requestCampaignNextLevel({
      sourceLevelId: 'level-001',
      destinationLevelId: 'level-002',
      puzzleCompleted: true,
      completionCommitted: true,
      victoryPresented: true,
    });

    sdk.triggerPause();
    deferred.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Must not launch while host is suspended
    expect(launched).toEqual([]);

    sdk.triggerResume();
    const result = await transitionPromise;
    expect(result.status).toBe('launched');
    expect(launched).toEqual(['level-002']);

    coordinator.dispose();
    adService.dispose();
    platform.dispose();
  });

  it('Journey 6: Host audio mute remains strictly authoritative across ad transition and next level launch', async () => {
    const sdk = new MockYouTubeSdk({ initialAudioEnabled: false });
    const platform = new YouTubePlatform(new GlobalYouTubeSdkClient(() => sdk.asSdk()));
    await platform.initialize();

    const settings = new SettingsService();
    const backend = createSilentMockAudioBackend();
    const audioService = new AudioService({ backend, settingsService: settings, platform });

    const progression = new ProgressionController();
    completeCampaignLevel(progression, 'level-001');

    const adService = new AdService({ provider: platform.getAdvertisingProvider(), platform });
    const coordinator = new LevelTransitionCoordinator({
      platform,
      adService,
      progressionController: progression,
      onLaunchCampaignLevel: () => {
        audioService.playSfx('audio:sfx:ui-click');
        audioService.setMusicContext('gameplay');
      },
    });

    const res = await coordinator.requestCampaignNextLevel({
      sourceLevelId: 'level-001',
      destinationLevelId: 'level-002',
      puzzleCompleted: true,
      completionCommitted: true,
      victoryPresented: true,
    });

    expect(res.status).toBe('launched');
    expect(platform.isAudioEnabled()).toBe(false);
    expect(backend.playCalls).toEqual([]);

    coordinator.dispose();
    adService.dispose();
    audioService.dispose();
    settings.dispose();
    platform.dispose();
  });

  it('Journey 7: Tutorial and Practice transitions never trigger interstitial requests and leave campaign progression untouched', async () => {
    const sdk = new MockYouTubeSdk();
    const platform = new YouTubePlatform(new GlobalYouTubeSdkClient(() => sdk.asSdk()));
    await platform.initialize();

    const progression = new ProgressionController();
    const adService = new AdService({ provider: platform.getAdvertisingProvider(), platform });

    const tutOutcome = await adService.requestInterstitial({
      mode: 'tutorial',
      trigger: 'next_level',
      puzzleCompleted: true,
      completionCommitted: true,
      victoryPresented: true,
      sourceLevelId: null,
      destinationLevelId: 'level-001',
      destinationAccessible: true,
      isChapterBoundary: false,
    });
    expect(tutOutcome.status).toBe('suppressed_by_policy');

    const practiceOutcome = await adService.requestInterstitial({
      mode: 'practice',
      trigger: 'new_practice_puzzle',
      puzzleCompleted: true,
      completionCommitted: true,
      victoryPresented: true,
      sourceLevelId: null,
      destinationLevelId: null,
      destinationAccessible: false,
      isChapterBoundary: false,
    });
    expect(practiceOutcome.status).toBe('suppressed_by_policy');
    expect(sdk.interstitialAdCalls).toBe(0);
    expect(progression.getCampaignAchievementSummary().completedLevels).toBe(0);

    adService.dispose();
    platform.dispose();
  });

  it('Journey 8: Standalone browser completes and navigates campaign levels ad-free without external requests', async () => {
    const browserPlatform = new BrowserGamePlatform({ storage: null, documentRef: null });
    await browserPlatform.initialize();

    const progression = new ProgressionController();
    const adService = new AdService({
      provider: browserPlatform.getAdvertisingProvider(),
      platform: browserPlatform,
    });

    const launched: string[] = [];
    const coordinator = new LevelTransitionCoordinator({
      platform: browserPlatform,
      adService,
      progressionController: progression,
      onLaunchCampaignLevel: (id) => launched.push(id),
    });

    completeCampaignLevel(progression, 'level-001');
    const r1 = await coordinator.requestCampaignNextLevel({
      sourceLevelId: 'level-001',
      destinationLevelId: 'level-002',
      puzzleCompleted: true,
      completionCommitted: true,
      victoryPresented: true,
    });
    expect(r1.status).toBe('launched');
    expect(r1.adOutcome).toBeNull();

    completeCampaignLevel(progression, 'level-002');
    const r2 = await coordinator.requestCampaignNextLevel({
      sourceLevelId: 'level-002',
      destinationLevelId: 'level-003',
      puzzleCompleted: true,
      completionCommitted: true,
      victoryPresented: true,
    });
    expect(r2.status).toBe('launched');
    expect(launched).toEqual(['level-002', 'level-003']);
    expect(progression.getCampaignAchievementSummary().completedLevels).toBe(2);

    coordinator.dispose();
    adService.dispose();
    browserPlatform.dispose();
  });

  it('Journey 9: Isolated rewarded advertising simulation grants once on earned, zero on not-earned/failure, without mutating campaign progression', async () => {
    const progression = new ProgressionController();
    const mockProvider = new MockAdvertisingProvider();
    const adService = new AdService({ provider: mockProvider });
    const rewardedService = new RewardedAdService({ adService });

    mockProvider.setDefaultRewardedStatus('reward_earned');
    const earned = await rewardedService.requestOptionalReward({
      rewardId: MONETIZATION_COPY.reservedRewardIds.devSyntheticReward,
      explicitUserOptIn: true,
      isDevelopmentSimulation: true,
      onGrantReward: () => {
        mockProvider.recordSyntheticRewardGrant();
      },
    });
    expect(earned.rewardGranted).toBe(true);
    expect(mockProvider.syntheticRewardGrantCount).toBe(1);

    mockProvider.setDefaultRewardedStatus('reward_not_earned');
    const skipped = await rewardedService.requestOptionalReward({
      rewardId: MONETIZATION_COPY.reservedRewardIds.devSyntheticReward,
      explicitUserOptIn: true,
      isDevelopmentSimulation: true,
      onGrantReward: () => {
        mockProvider.recordSyntheticRewardGrant();
      },
    });
    expect(skipped.rewardGranted).toBe(false);

    mockProvider.setDefaultRewardedStatus('failed');
    const failed = await rewardedService.requestOptionalReward({
      rewardId: MONETIZATION_COPY.reservedRewardIds.devSyntheticReward,
      explicitUserOptIn: true,
      isDevelopmentSimulation: true,
      onGrantReward: () => {
        mockProvider.recordSyntheticRewardGrant();
      },
    });
    expect(failed.rewardGranted).toBe(false);
    expect(mockProvider.syntheticRewardGrantCount).toBe(1);

    // Campaign progression untouched
    expect(progression.getCampaignAchievementSummary().completedLevels).toBe(0);

    rewardedService.dispose();
    adService.dispose();
    mockProvider.dispose();
  });
});
