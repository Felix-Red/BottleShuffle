import { describe, expect, it } from 'vitest';
import type { Puzzle } from '../../src/core';
import {
  AUDIO_ASSET_KEYS,
  type AudioAssetKey,
  type MusicAssetKey,
  type SfxAssetKey,
} from '../../src/game/assets/AssetKeys';
import { GameplayAudioController } from '../../src/game/audio/GameplayAudioController';
import { GameplayController } from '../../src/game/gameplay/GameplayController';
import { ProgressionController } from '../../src/game/progression/ProgressionController';
import { BrowserGamePlatform } from '../../src/platform/browser/BrowserGamePlatform';
import { SettingsService } from '../../src/services/SettingsService';
import type {
  AudioBackend,
  BackendMusicHandle,
  BackendMusicPlayRequest,
  BackendSfxPlayRequest,
  BackendSoundHandle,
} from '../../src/services/audio/AudioBackend';
import { AUDIO_CATALOG } from '../../src/services/audio/AudioCatalog';
import { AudioService } from '../../src/services/audio/AudioService';
import { PlatformHapticBackend } from '../../src/services/haptics/HapticBackend';
import { HapticService } from '../../src/services/haptics/HapticService';

class LifecycleFakeAudioBackend implements AudioBackend {
  public unlocked: boolean;
  public globalMuted = false;
  public readonly loaded = new Set<AudioAssetKey>();
  public readonly sfxLog: SfxAssetKey[] = [];
  public readonly activeSfxStopped: SfxAssetKey[] = [];
  public readonly musicLog: { key: MusicAssetKey; paused: boolean; stopped: boolean }[] = [];
  private readonly unlockListeners = new Set<() => void>();
  private nextId = 1;

  public constructor(options: { unlocked: boolean; loadMusic?: boolean }) {
    this.unlocked = options.unlocked;
    for (const entry of AUDIO_CATALOG) {
      if (entry.channel !== 'music' || options.loadMusic) {
        this.loaded.add(entry.id);
      }
    }
  }

  public isUnlocked(): boolean {
    return this.unlocked;
  }

  public unlock(): Promise<boolean> {
    this.unlocked = true;
    for (const listener of [...this.unlockListeners]) {
      listener();
    }
    return Promise.resolve(true);
  }

  public onUnlocked(listener: () => void): () => void {
    this.unlockListeners.add(listener);
    return () => {
      this.unlockListeners.delete(listener);
    };
  }

  public hasAsset(key: AudioAssetKey): boolean {
    return this.loaded.has(key);
  }

  public playSfx(request: BackendSfxPlayRequest): BackendSoundHandle | null {
    if (!this.loaded.has(request.key)) {
      return null;
    }
    this.sfxLog.push(request.key);
    let playing = true;
    return {
      id: this.nextId++,
      key: request.key,
      channel: request.channel,
      priority: request.priority,
      stop: (): void => {
        if (playing) {
          playing = false;
          this.activeSfxStopped.push(request.key);
          request.onEnded?.();
        }
      },
      setVolume: (): void => undefined,
      isPlaying: (): boolean => playing,
    };
  }

  public playMusic(request: BackendMusicPlayRequest): BackendMusicHandle | null {
    if (!this.loaded.has(request.key)) {
      return null;
    }
    const entry = { key: request.key, paused: false, stopped: false };
    this.musicLog.push(entry);
    return {
      key: request.key,
      stop: (): void => {
        entry.stopped = true;
        entry.paused = false;
      },
      pause: (): void => {
        if (!entry.stopped) {
          entry.paused = true;
        }
      },
      resume: (): void => {
        if (!entry.stopped) {
          entry.paused = false;
        }
      },
      setVolume: (): void => undefined,
      fadeTo: (_v, _ms, onComplete): void => {
        onComplete?.();
      },
      isPlaying: (): boolean => !entry.stopped && !entry.paused,
      isPaused: (): boolean => !entry.stopped && entry.paused,
    };
  }

  public setGlobalMute(muted: boolean): void {
    this.globalMuted = muted;
  }

  public dispose(): void {
    this.unlockListeners.clear();
  }
}

function createTwoMoveTestPuzzle(): Puzzle {
  // Initial: [blue, red, yellow, green], Target: [red, blue, green, yellow]
  // Swap (0, 1) -> +2 matches; Swap (2, 3) -> +2 matches (completed!)
  return Object.freeze({
    id: 'audio-integration-puzzle',
    seed: 'audio-integration-seed',
    generatorVersion: '1.0.0',
    difficulty: 'easy',
    bottleCount: 4,
    startingSequence: Object.freeze(['blue', 'red', 'yellow', 'green'] as const),
    targetSequence: Object.freeze(['red', 'blue', 'green', 'yellow'] as const),
  });
}

describe('Audio & Haptics lifecycle integration journeys', () => {
  it('Journey 1: unlocks on first user gesture, loads deferred music, and preserves menu track across screens', async () => {
    const backend = new LifecycleFakeAudioBackend({ unlocked: false, loadMusic: false });
    const settings = new SettingsService();
    const audioService = new AudioService({ backend, settingsService: settings });

    // Enter Home before unlock and before music finishes loading
    audioService.setMusicContext('menu');
    expect(backend.musicLog).toHaveLength(0);

    // User taps -> unlocks audio
    expect(await audioService.unlock()).toBe(true);
    expect(backend.musicLog).toHaveLength(0); // music still loading

    // Deferred music finishes loading -> menu theme begins automatically
    backend.loaded.add(AUDIO_ASSET_KEYS.MUSIC_MENU);
    backend.loaded.add(AUDIO_ASSET_KEYS.MUSIC_GAMEPLAY);
    audioService.notifyAssetsLoaded();
    expect(backend.musicLog).toHaveLength(1);
    expect(backend.musicLog[0]?.key).toBe(AUDIO_ASSET_KEYS.MUSIC_MENU);

    // Home -> LevelSelection keeps Menu theme seamless without restarting
    audioService.setMusicContext('menu');
    expect(backend.musicLog).toHaveLength(1);

    // LevelSelection -> Gameplay transitions cleanly to Gameplay theme
    audioService.setMusicContext('gameplay');
    expect(backend.musicLog).toHaveLength(2);
    expect(backend.musicLog[0]?.stopped).toBe(true);
    expect(backend.musicLog[1]?.key).toBe(AUDIO_ASSET_KEYS.MUSIC_GAMEPLAY);

    audioService.dispose();
    settings.dispose();
  });

  it('Journey 2 & 5: drives real GameplayController through swaps, victory, star reveals, unlock chime, and early navigation cleanup', () => {
    let nowMs = 1000;
    const vibrationCalls: (number | number[])[] = [];
    const platform = new BrowserGamePlatform({
      storage: null,
      documentRef: null,
      vibrationSupported: true,
      vibrateFn: (p) => {
        vibrationCalls.push(p);
        return true;
      },
    });
    const settings = new SettingsService();
    settings.setVibrationEnabled(true);
    const backend = new LifecycleFakeAudioBackend({ unlocked: true, loadMusic: true });
    const audioService = new AudioService({
      backend,
      settingsService: settings,
      platform,
      now: () => nowMs,
    });
    const hapticService = new HapticService({
      backend: new PlatformHapticBackend(platform),
      settingsService: settings,
      now: () => nowMs,
    });
    const progression = new ProgressionController();
    const gameplayAudio = new GameplayAudioController({
      audioService,
      hapticService,
      initialAttemptId: 1,
    });

    const controller = new GameplayController({
      sceneData: { mode: 'campaign', levelId: 'level-001' },
      progressionController: progression,
      puzzle: createTwoMoveTestPuzzle(),
      callbacks: {
        onPlayerGameEvents: (events) => {
          gameplayAudio.handlePlayerGameEvents(events);
        },
        onSwapStarted: (transition) => {
          gameplayAudio.handleSwapStarted(transition);
          nowMs += 250;
          gameplayAudio.handleSwapLanding(transition.transitionId, transition.attemptId);
          nowMs += 100;
          controller.completeSwapTransition(transition.transitionId);
        },
        onSwapCompleted: (transition) => {
          gameplayAudio.handleSwapReconciled(transition);
          if (transition.completedAfterSwap) {
            nowMs += 60;
            gameplayAudio.handleVictoryTriggered(transition.attemptId);
          }
        },
        onProgressionEvents: (events) => {
          nowMs += 120;
          gameplayAudio.handleProgressionEvents(events, 1);
        },
      },
    });

    controller.start();
    // Move 1: select 0, swap with 1 (+2 matches)
    controller.handleBottleTap(0);
    nowMs += 100;
    controller.handleBottleTap(1);

    // Move 2: select 2, swap with 3 (completes level-001 -> unlocks level-002!)
    nowMs += 100;
    controller.handleBottleTap(2);
    nowMs += 100;
    controller.handleBottleTap(3);

    expect(controller.getViewState().overlayMode).toBe('completed');
    expect(backend.sfxLog).toContain(AUDIO_ASSET_KEYS.SFX_BOTTLE_SELECT);
    expect(backend.sfxLog).toContain(AUDIO_ASSET_KEYS.SFX_BOTTLE_SWAP);
    expect(backend.sfxLog).toContain(AUDIO_ASSET_KEYS.SFX_BOTTLE_LAND);
    expect(backend.sfxLog).toContain(AUDIO_ASSET_KEYS.SFX_MATCH_INCREASE);
    expect(backend.sfxLog).toContain(AUDIO_ASSET_KEYS.SFX_VICTORY);
    expect(backend.sfxLog).toContain(AUDIO_ASSET_KEYS.SFX_LEVEL_UNLOCK);

    // Only one match-increase chime (Move 1); winning Move 2 suppressed duplicate match chime
    expect(backend.sfxLog.filter((k) => k === AUDIO_ASSET_KEYS.SFX_MATCH_INCREASE)).toHaveLength(1);
    expect(backend.sfxLog.filter((k) => k === AUDIO_ASSET_KEYS.SFX_VICTORY)).toHaveLength(1);

    // Early navigation stops obsolete celebration audio and cancels haptics
    gameplayAudio.stopObsoleteAudio();
    expect(backend.activeSfxStopped).toContain(AUDIO_ASSET_KEYS.SFX_VICTORY);
    expect(vibrationCalls[vibrationCalls.length - 1]).toBe(0);

    controller.dispose();
    gameplayAudio.dispose();
    audioService.dispose();
    hapticService.dispose();
    settings.dispose();
    platform.dispose();
  });

  it('Journey 4: handles overlapping manual pause and platform suspension without replaying missed SFX', () => {
    let nowMs = 1000;
    const backend = new LifecycleFakeAudioBackend({ unlocked: true, loadMusic: true });
    const settings = new SettingsService();
    const audioService = new AudioService({
      backend,
      settingsService: settings,
      now: () => nowMs,
    });

    audioService.setMusicContext('gameplay');
    expect(audioService.getState().isMusicPaused).toBe(false);

    // Manual pause pauses gameplay music, stops gameplay SFX, but STILL permits Pause UI clicks
    audioService.playSfx(AUDIO_ASSET_KEYS.SFX_BOTTLE_SWAP);
    audioService.suspend('manual_pause');
    expect(audioService.getState().isMusicPaused).toBe(true);
    expect(backend.activeSfxStopped).toContain(AUDIO_ASSET_KEYS.SFX_BOTTLE_SWAP);
    expect(audioService.playSfx(AUDIO_ASSET_KEYS.SFX_BOTTLE_SELECT)).toBe(false);
    nowMs += 100;
    expect(audioService.playSfx(AUDIO_ASSET_KEYS.SFX_UI_CLICK)).toBe(true);

    // Platform suspend while paused silences EVERYTHING including UI clicks
    audioService.suspend('platform_suspended');
    expect(backend.globalMuted).toBe(true);
    nowMs += 100;
    expect(audioService.playSfx(AUDIO_ASSET_KEYS.SFX_UI_CLICK)).toBe(false);

    // Resuming platform while manual pause is still open keeps gameplay music paused
    audioService.resume('platform_suspended');
    expect(backend.globalMuted).toBe(false);
    expect(audioService.getState().isMusicPaused).toBe(true);
    nowMs += 100;
    expect(audioService.playSfx(AUDIO_ASSET_KEYS.SFX_UI_CLICK)).toBe(true);

    // Resuming manual pause resumes gameplay music cleanly
    audioService.resume('manual_pause');
    expect(audioService.getState().isMusicPaused).toBe(false);

    audioService.dispose();
    settings.dispose();
  });

  it('Journey 6: completes a full puzzle smoothly in completely silent mode with zero audio or haptic calls', () => {
    const vibrationCalls: (number | number[])[] = [];
    const platform = new BrowserGamePlatform({
      storage: null,
      documentRef: null,
      vibrationSupported: true,
      vibrateFn: (p) => {
        vibrationCalls.push(p);
        return true;
      },
    });
    const settings = new SettingsService();
    settings.setMusicEnabled(false);
    settings.setSoundEffectsEnabled(false);
    settings.setVibrationEnabled(false);

    const backend = new LifecycleFakeAudioBackend({ unlocked: true, loadMusic: true });
    const audioService = new AudioService({ backend, settingsService: settings, platform });
    const hapticService = new HapticService({
      backend: new PlatformHapticBackend(platform),
      settingsService: settings,
    });
    const gameplayAudio = new GameplayAudioController({ audioService, hapticService });

    audioService.setMusicContext('gameplay');
    const controller = new GameplayController({
      puzzle: createTwoMoveTestPuzzle(),
      callbacks: {
        onPlayerGameEvents: (events) => {
          gameplayAudio.handlePlayerGameEvents(events);
        },
        onSwapStarted: (t) => {
          gameplayAudio.handleSwapStarted(t);
          gameplayAudio.handleSwapLanding(t.transitionId, t.attemptId);
          controller.completeSwapTransition(t.transitionId);
        },
        onSwapCompleted: (t) => {
          gameplayAudio.handleSwapReconciled(t);
          if (t.completedAfterSwap) {
            gameplayAudio.handleVictoryTriggered(t.attemptId);
          }
        },
      },
    });

    controller.start();
    controller.handleBottleTap(0);
    controller.handleBottleTap(1);
    controller.handleBottleTap(2);
    controller.handleBottleTap(3);

    expect(controller.getViewState().overlayMode).toBe('completed');
    expect(backend.sfxLog).toHaveLength(0);
    expect(backend.musicLog).toHaveLength(0);
    expect(vibrationCalls).toHaveLength(0);

    controller.dispose();
    gameplayAudio.dispose();
    audioService.dispose();
    hapticService.dispose();
    settings.dispose();
    platform.dispose();
  });
});
