import { describe, expect, it, vi } from 'vitest';
import {
  calculateScoreBreakdown,
  calculateStarRating,
  createDefaultSaveData,
  generateLevelPuzzle,
  getDefaultLevelCatalog,
} from '../../src/core';
import { AUDIO_ASSET_KEYS } from '../../src/game/assets/AssetKeys';
import { AnimationCoordinator } from '../../src/game/animations/core/AnimationCoordinator';
import { GameplayController } from '../../src/game/gameplay/GameplayController';
import { calculateGameplayLayout } from '../../src/game/layout/GameplayLayout';
import { ProgressionController } from '../../src/game/progression/ProgressionController';
import { BrowserGamePlatform } from '../../src/platform/browser/BrowserGamePlatform';
import {
  BrowserSaveStorage,
  type BrowserStorageLike,
} from '../../src/platform/browser/BrowserSaveStorage';
import { createPlatformForEnvironment } from '../../src/platform/PlatformFactory';
import { YouTubePlatform } from '../../src/platform/youtube/YouTubePlatform';
import { GlobalYouTubeSdkClient } from '../../src/platform/youtube/YouTubeSdkClient';
import { SettingsService } from '../../src/services/SettingsService';
import { TutorialPreferenceService } from '../../src/services/TutorialPreferenceService';
import type {
  AudioBackend,
  BackendMusicHandle,
  BackendMusicPlayRequest,
  BackendSfxPlayRequest,
  BackendSoundHandle,
} from '../../src/services/audio/AudioBackend';
import { AudioService } from '../../src/services/audio/AudioService';
import { SaveCoordinator } from '../../src/services/persistence/SaveCoordinator';
import { serializeSaveData } from '../../src/services/persistence/SaveSerializer';
import { SaveService } from '../../src/services/persistence/SaveService';
import { GameReadinessService } from '../../src/services/platform/GameReadinessService';
import { createMockSdkError, MockYouTubeSdk } from '../helpers/MockYouTubeSdk';

class StubAudioBackend implements AudioBackend {
  public globalMuted = false;
  public musicPlays = 0;
  public activeMusicStopped = false;
  public activeMusicPaused = false;
  private unlockListeners = new Set<() => void>();

  public isUnlocked(): boolean {
    return true;
  }

  public unlock(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public onUnlocked(listener: () => void): () => void {
    this.unlockListeners.add(listener);
    return () => {
      this.unlockListeners.delete(listener);
    };
  }

  public hasAsset(): boolean {
    return true;
  }

  public setGlobalMute(muted: boolean): void {
    this.globalMuted = muted;
  }

  private nextSoundId = 1;

  public playSfx(request: BackendSfxPlayRequest): BackendSoundHandle {
    let playing = true;
    const id = this.nextSoundId;
    this.nextSoundId += 1;
    return {
      id,
      key: request.key,
      channel: request.channel,
      priority: request.priority,
      setVolume: () => undefined,
      isPlaying: () => playing,
      stop: () => {
        playing = false;
      },
    };
  }

  public playMusic(request: BackendMusicPlayRequest): BackendMusicHandle {
    this.musicPlays += 1;
    this.activeMusicStopped = false;
    this.activeMusicPaused = false;
    return {
      key: request.key,
      isPlaying: () => !this.activeMusicStopped && !this.activeMusicPaused,
      isPaused: () => this.activeMusicPaused,
      setVolume: () => undefined,
      fadeTo: (_v, _ms, onComplete) => {
        onComplete?.();
      },
      pause: () => {
        this.activeMusicPaused = true;
      },
      resume: () => {
        this.activeMusicPaused = false;
      },
      stop: () => {
        this.activeMusicStopped = true;
      },
    };
  }

  public dispose(): void {
    this.unlockListeners.clear();
  }
}

function createMapLocalStorage(): BrowserStorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

describe('YouTube Playables end-to-end platform integration journeys', () => {
  it('Journey 1: First YouTube launch verifies lifecycle subscriptions, firstFrameReady -> cloud load -> gameReady order', async () => {
    const mock = new MockYouTubeSdk({ inPlayablesEnv: true, initialCloudData: '' });
    const platform = createPlatformForEnvironment({
      youtubeSdkClient: new GlobalYouTubeSdkClient(() => mock.asSdk()),
    });
    expect(platform).toBeInstanceOf(YouTubePlatform);

    await platform.initialize();
    expect(mock.audioListenerRegistrations).toBe(1);
    expect(mock.pauseListenerRegistrations).toBe(1);
    expect(mock.resumeListenerRegistrations).toBe(1);

    const readiness = new GameReadinessService(platform);
    const progression = new ProgressionController();
    const settings = new SettingsService();
    const tutorial = new TutorialPreferenceService();
    const saveService = new SaveService({
      storage: platform.getSaveStorage?.() ?? new BrowserSaveStorage({ storage: null }),
      targets: {
        progressionController: progression,
        settingsService: settings,
        tutorialPreference: tutorial,
      },
      normalDebounceMs: 0,
      maxAutomaticRetries: 0,
    });

    // BootScene renders loading frame -> firstFrameReady fires before cloud load settles
    readiness.markFirstFrameRendered();
    expect(mock.firstFrameReadyCalls).toBe(1);
    expect(mock.gameReadyCalls).toBe(0);

    // Assets load + cloud load completes
    readiness.markAssetsLoaded();
    const initResult = await saveService.initialise();
    expect(initResult.outcome).toBe('missing');
    expect(mock.loadDataCalls).toBe(1);
    readiness.markSaveRestored();

    // HomeScreen becomes interactive -> gameReady fires once
    readiness.markInteractiveSceneReady();
    expect(mock.gameReadyCalls).toBe(1);
    expect(mock.readinessOrder).toEqual(['firstFrameReady', 'gameReady']);

    saveService.dispose();
    settings.dispose();
    tutorial.dispose();
    platform.dispose();
  });

  it('Journey 2: Existing cloud progress restores stars, personal bests, unlocks, settings, and tutorial without duplicate events', async () => {
    const base = createDefaultSaveData({ updatedAt: '2026-11-27T10:00:00.000Z' });
    const seededPayload = serializeSaveData({
      ...base,
      revision: 4,
      settings: {
        musicEnabled: false,
        soundEffectsEnabled: true,
        vibrationEnabled: false,
        motionPreference: 'reduced',
      },
      tutorial: { status: 'completed', completed: true },
      progression: {
        lastPlayedLevelId: 'level-002',
        completedLevels: {
          'level-001': {
            completionCount: 1,
            bestMoveCount: 2,
            bestElapsedMs: 9500,
            bestScore: 1500,
            bestStarRating: 3,
            scoringPolicyVersion: 1,
          },
        },
      },
    });

    const mock = new MockYouTubeSdk({ inPlayablesEnv: true, initialCloudData: seededPayload });
    const platform = new YouTubePlatform(new GlobalYouTubeSdkClient(() => mock.asSdk()));
    await platform.initialize();

    const progression = new ProgressionController();
    const settings = new SettingsService();
    const tutorial = new TutorialPreferenceService();
    const progressionChangeSpy = vi.fn();
    progression.onChange((_state, events) => {
      if (events.length > 0) {
        progressionChangeSpy(events);
      }
    });

    const saveService = new SaveService({
      storage: platform.getSaveStorage(),
      targets: {
        progressionController: progression,
        settingsService: settings,
        tutorialPreference: tutorial,
      },
      normalDebounceMs: 0,
    });
    const init = await saveService.initialise();
    expect(init.outcome).toBe('restored');

    expect(progression.getLevelStatus('level-001')).toBe('completed');
    expect(progression.getLevelStatus('level-002')).toBe('unlocked');
    expect(progression.getCompletionRecord('level-001')?.bestStarRating).toBe(3);
    expect(progression.getCompletionRecord('level-001')?.bestScore).toBe(1500);
    expect(settings.getSettings().musicEnabled).toBe(false);
    expect(settings.getSettings().motionPreference).toBe('reduced');
    expect(tutorial.shouldOfferFirstTimeTutorial()).toBe(false);
    expect(progressionChangeSpy).not.toHaveBeenCalled();

    saveService.dispose();
    settings.dispose();
    tutorial.dispose();
    platform.dispose();
  });

  it('Journey 3: Cloud completion persists latest snapshot and restores identically into fresh services', async () => {
    const mock = new MockYouTubeSdk({ inPlayablesEnv: true, initialCloudData: '' });
    const platformA = new YouTubePlatform(new GlobalYouTubeSdkClient(() => mock.asSdk()));
    await platformA.initialize();

    const progressionA = new ProgressionController();
    const settingsA = new SettingsService();
    const tutorialA = new TutorialPreferenceService();
    const saveServiceA = new SaveService({
      storage: platformA.getSaveStorage(),
      targets: {
        progressionController: progressionA,
        settingsService: settingsA,
        tutorialPreference: tutorialA,
      },
      normalDebounceMs: 0,
      maxAutomaticRetries: 0,
    });
    await saveServiceA.initialise();
    const coordinatorA = new SaveCoordinator({
      saveService: saveServiceA,
      progressionController: progressionA,
      settingsService: settingsA,
      tutorialPreference: tutorialA,
      platform: platformA,
    });

    // Complete level-001 via real GameplayController
    const catalog = getDefaultLevelCatalog();
    const levelDef = catalog.getLevelById('level-001');
    if (levelDef === undefined) {
      throw new Error('level-001 missing');
    }
    const puzzle = generateLevelPuzzle(levelDef);
    const gameplay = new GameplayController({
      puzzle,
      sceneData: { mode: 'campaign', levelId: 'level-001' },
      progressionController: progressionA,
    });
    gameplay.start();

    let guard = 0;
    while (gameplay.getViewState().overlayMode !== 'completed' && guard < 20) {
      const seq = gameplay.getViewState().currentSequence;
      const wrong = seq.findIndex((id, idx) => id !== puzzle.targetSequence[idx]);
      if (wrong === -1) {
        break;
      }
      const targetId = puzzle.targetSequence[wrong];
      const other = targetId !== undefined ? seq.indexOf(targetId) : -1;
      if (other === -1) {
        break;
      }
      gameplay.handleBottleTap(wrong);
      gameplay.handleBottleTap(other);
      gameplay.completeSwapTransition();
      guard += 1;
    }

    await saveServiceA.flush(1000);
    expect(mock.saveDataCalls).toBeGreaterThanOrEqual(1);
    expect(mock.cloudData.length).toBeGreaterThan(20);

    gameplay.dispose();
    coordinatorA.dispose();
    saveServiceA.dispose();
    platformA.dispose();

    // Recreate fresh session reading from same cloud payload
    const platformB = new YouTubePlatform(new GlobalYouTubeSdkClient(() => mock.asSdk()));
    await platformB.initialize();
    const progressionB = new ProgressionController();
    const settingsB = new SettingsService();
    const tutorialB = new TutorialPreferenceService();
    const saveServiceB = new SaveService({
      storage: platformB.getSaveStorage(),
      targets: {
        progressionController: progressionB,
        settingsService: settingsB,
        tutorialPreference: tutorialB,
      },
    });
    const restored = await saveServiceB.initialise();
    expect(restored.outcome).toBe('restored');
    expect(progressionB.getLevelStatus('level-001')).toBe('completed');
    expect(progressionB.getLevelStatus('level-002')).toBe('unlocked');

    saveServiceB.dispose();
    platformB.dispose();
    settingsA.dispose();
    settingsB.dispose();
    tutorialA.dispose();
    tutorialB.dispose();
  });

  it('Journey 4: Failed cloud load blocks auto-writes so existing cloud save is never overwritten', async () => {
    const existingCloud = '{"schemaVersion":1,"precious":"cloud-progress"}';
    const mock = new MockYouTubeSdk({ inPlayablesEnv: true, initialCloudData: existingCloud });
    mock.setNextLoadError(createMockSdkError('API_UNAVAILABLE', 'Cloud load failed'));

    const platform = new YouTubePlatform(new GlobalYouTubeSdkClient(() => mock.asSdk()));
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
      maxAutomaticRetries: 0,
    });

    const outcome = await saveService.initialise();
    expect(outcome.outcome).toBe('unavailable');
    expect(saveService.getStatus().autoWriteBlocked).toBe(true);

    // Attempting to save settings or completions must NEVER call ytgame.game.saveData
    settings.setMusicEnabled(false);
    expect(saveService.requestSave('settings_changed', 'high')).toBe(false);
    await saveService.flush(500);

    expect(mock.saveDataCalls).toBe(0);
    expect(mock.cloudData).toBe(existingCloud);

    saveService.dispose();
    settings.dispose();
    tutorial.dispose();
    platform.dispose();
  });

  it('Journey 5: Host mute immediately silences playback, overrides in-game settings, and unmute restores only permitted audio', async () => {
    const mock = new MockYouTubeSdk({ inPlayablesEnv: true, initialAudioEnabled: true });
    const platform = new YouTubePlatform(new GlobalYouTubeSdkClient(() => mock.asSdk()));
    await platform.initialize();

    const settings = new SettingsService();
    const backend = new StubAudioBackend();
    const audio = new AudioService({ backend, settingsService: settings, platform });

    audio.setMusicContext('gameplay', { immediate: true });
    expect(backend.globalMuted).toBe(false);
    expect(backend.musicPlays).toBe(1);

    // Host mute
    mock.triggerAudioChange(false);
    expect(backend.globalMuted).toBe(true);
    expect(backend.activeMusicStopped).toBe(true);

    // Player toggles in-game music/SFX -> host mute remains authoritative
    settings.setMusicEnabled(false);
    settings.setMusicEnabled(true);
    expect(audio.playSfx(AUDIO_ASSET_KEYS.SFX_UI_CLICK)).toBe(false);
    expect(backend.globalMuted).toBe(true);

    // Player disables music while muted, then host unmutes -> SFX permitted, music remains off!
    settings.setMusicEnabled(false);
    mock.triggerAudioChange(true);
    expect(backend.globalMuted).toBe(false);
    expect(audio.getState().activeMusicKey).toBeNull();
    expect(audio.playSfx(AUDIO_ASSET_KEYS.SFX_UI_CLICK)).toBe(true);

    audio.dispose();
    settings.dispose();
    platform.dispose();
  });

  it('Journey 6 & 7: Host pause reconciles active swaps, freezes clock, blocks input, and preserves manual pause across host resume', async () => {
    let nowMs = 1000;
    const mock = new MockYouTubeSdk({ inPlayablesEnv: true });
    const platform = new YouTubePlatform(new GlobalYouTubeSdkClient(() => mock.asSdk()));
    await platform.initialize();

    const coordinator = new AnimationCoordinator();
    const cancelSpy = vi.fn();

    const controller = new GameplayController({
      sceneData: { mode: 'practice', bottleCount: 4, seed: 'yt-lifecycle' },
      clock: { now: () => nowMs },
      callbacks: {
        onSwapStarted: (t) => {
          coordinator.beginSwap(
            () => cancelSpy,
            () => {
              controller.completeSwapTransition(t.transitionId);
            },
          );
        },
      },
    });
    controller.start();

    platform.onPause(() => {
      const cancelled = coordinator.cancelActiveSwap();
      if (cancelled || controller.getViewState().isSwapping) {
        controller.completeSwapTransition();
      }
      controller.handlePlatformSuspend();
    });
    platform.onResume(() => {
      controller.handlePlatformResume();
    });

    // Advance 5s and start a swap
    nowMs += 5000;
    controller.handleBottleTap(0);
    controller.handleBottleTap(1);
    expect(controller.getViewState().isSwapping).toBe(true);

    // Host pause mid-swap
    mock.triggerPause();
    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(controller.getViewState().isSwapping).toBe(false);
    expect(controller.getViewState().moveCount).toBe(1);
    expect(controller.getViewState().inputEnabled).toBe(false);

    // Time passes while host suspended; taps ignored
    nowMs += 12_000;
    controller.handleBottleTap(2);
    expect(controller.getViewState().selectedSlotIndex).toBeNull();

    // Host resume restores gameplay with frozen clock preserved
    mock.triggerResume();
    expect(controller.getViewState().inputEnabled).toBe(true);
    expect(controller.getElapsedMs()).toBe(5000);

    // Journey 7: Manual pause + host pause + host resume -> manual pause MUST stay active
    controller.requestPause();
    expect(controller.getViewState().overlayMode).toBe('pause');
    mock.triggerPause();
    nowMs += 8000;
    mock.triggerResume();
    expect(controller.getViewState().overlayMode).toBe('pause');
    expect(controller.getViewState().status).toBe('paused');
    expect(controller.getElapsedMs()).toBe(5000);

    // Manual resume finally resumes gameplay
    controller.resumeFromPause();
    expect(controller.getViewState().overlayMode).toBe('none');
    expect(controller.getViewState().status).toBe('playing');

    coordinator.dispose();
    controller.dispose();
    platform.dispose();
  });

  it('Journey 8: Browser regression outside YouTube selects BrowserGamePlatform and persists via BrowserSaveStorage', async () => {
    const fakeLocal = createMapLocalStorage();
    const browserStorageA = new BrowserSaveStorage({ storage: fakeLocal, windowRef: null });
    const platform = createPlatformForEnvironment({
      youtubeSdkClient: new GlobalYouTubeSdkClient(() => undefined),
      browserOptions: { storage: fakeLocal, documentRef: null },
    });
    expect(platform).toBeInstanceOf(BrowserGamePlatform);
    await platform.initialize();

    const progressionA = new ProgressionController();
    const settingsA = new SettingsService();
    const tutorialA = new TutorialPreferenceService();
    const saveServiceA = new SaveService({
      storage: browserStorageA,
      targets: {
        progressionController: progressionA,
        settingsService: settingsA,
        tutorialPreference: tutorialA,
      },
      normalDebounceMs: 0,
    });
    await saveServiceA.initialise();

    const begin = progressionA.beginCampaignAttempt('level-001');
    if (begin.accepted) {
      const bd = calculateScoreBreakdown({
        difficulty: begin.level.difficulty,
        actualMoves: 2,
        minimumRequiredSwaps: 2,
      });
      progressionA.completeActiveAttempt({
        attemptId: begin.attempt.attemptId,
        levelId: 'level-001',
        moveCount: 2,
        elapsedMs: 7000,
        score: bd.totalScore,
        starRating: calculateStarRating(2, 2),
        scoringPolicyVersion: bd.scoringPolicyVersion,
      });
    }
    saveServiceA.requestSave('campaign_completion', 'high');
    await saveServiceA.flush(1000);

    // Reload into fresh browser services
    const progressionB = new ProgressionController();
    const settingsB = new SettingsService();
    const tutorialB = new TutorialPreferenceService();
    const saveServiceB = new SaveService({
      storage: new BrowserSaveStorage({ storage: fakeLocal, windowRef: null }),
      targets: {
        progressionController: progressionB,
        settingsService: settingsB,
        tutorialPreference: tutorialB,
      },
    });
    const initB = await saveServiceB.initialise();
    expect(initB.outcome).toBe('restored');
    expect(progressionB.getLevelStatus('level-001')).toBe('completed');

    saveServiceA.dispose();
    saveServiceB.dispose();
    browserStorageA.dispose();
    settingsA.dispose();
    settingsB.dispose();
    tutorialA.dispose();
    tutorialB.dispose();
    platform.dispose();
  });

  it('Certification aspect ratios (9:32, 9:21, 9:16, 3:4, 1:1, 4:3, 16:9, 21:9, 32:9) and zero-sized container remain finite and usable', () => {
    const certViewports = [
      { label: '9:32', w: 280, h: 996 },
      { label: '9:21', w: 360, h: 840 },
      { label: '9:16', w: 390, h: 693 },
      { label: '3:4', w: 768, h: 1024 },
      { label: '1:1', w: 600, h: 600 },
      { label: '4:3', w: 1024, h: 768 },
      { label: '16:9', w: 1280, h: 720 },
      { label: '21:9', w: 1680, h: 720 },
      { label: '32:9', w: 1920, h: 540 },
      { label: '0x0 temporary embedded', w: 0, h: 0 },
    ] as const;

    for (const vp of certViewports) {
      const gp = calculateGameplayLayout({ width: vp.w, height: vp.h, bottleCount: 8 });
      expect(Number.isFinite(gp.board.rackLayout.bottleWidth), vp.label).toBe(true);
      expect(gp.board.rackLayout.bottleWidth, vp.label).toBeGreaterThanOrEqual(16);
      expect(gp.board.rackLayout.slots, vp.label).toHaveLength(8);
      for (const slot of gp.board.rackLayout.slots) {
        expect(Number.isFinite(slot.x), vp.label).toBe(true);
        expect(Number.isFinite(slot.y), vp.label).toBe(true);
      }
    }
  });
});
