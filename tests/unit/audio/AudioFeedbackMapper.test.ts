import { describe, expect, it } from 'vitest';
import {
  AUDIO_ASSET_KEYS,
  type AudioAssetKey,
  type SfxAssetKey,
} from '../../../src/game/assets/AssetKeys';
import { GameplayAudioController } from '../../../src/game/audio/GameplayAudioController';
import type { PendingSwapTransition } from '../../../src/game/gameplay/GameplayViewState';
import { SettingsService } from '../../../src/services/SettingsService';
import type {
  AudioBackend,
  BackendMusicHandle,
  BackendMusicPlayRequest,
  BackendSfxPlayRequest,
  BackendSoundHandle,
} from '../../../src/services/audio/AudioBackend';
import { AUDIO_CATALOG } from '../../../src/services/audio/AudioCatalog';
import {
  computeSelectPitchRate,
  computeStarRevealRate,
  mapMatchDeltaToFeedback,
} from '../../../src/services/audio/AudioFeedbackMapper';
import { AudioService } from '../../../src/services/audio/AudioService';
import type { HapticBackend } from '../../../src/services/haptics/HapticBackend';
import { HapticService } from '../../../src/services/haptics/HapticService';

class RecordingAudioBackend implements AudioBackend {
  public readonly events: { key: SfxAssetKey; rate: number }[] = [];
  private readonly loaded = new Set<AudioAssetKey>(AUDIO_CATALOG.map((e) => e.id));
  private nextId = 1;

  public isUnlocked(): boolean {
    return true;
  }
  public unlock(): Promise<boolean> {
    return Promise.resolve(true);
  }
  public onUnlocked(): () => void {
    return () => undefined;
  }
  public hasAsset(key: AudioAssetKey): boolean {
    return this.loaded.has(key);
  }
  public playSfx(request: BackendSfxPlayRequest): BackendSoundHandle {
    this.events.push({ key: request.key, rate: request.rate });
    const id = this.nextId++;
    return {
      id,
      key: request.key,
      channel: request.channel,
      priority: request.priority,
      stop: (): void => undefined,
      setVolume: (): void => undefined,
      isPlaying: (): boolean => false,
    };
  }
  public playMusic(request: BackendMusicPlayRequest): BackendMusicHandle {
    return {
      key: request.key,
      stop: (): void => undefined,
      pause: (): void => undefined,
      resume: (): void => undefined,
      setVolume: (): void => undefined,
      fadeTo: (): void => undefined,
      isPlaying: (): boolean => true,
      isPaused: (): boolean => false,
    };
  }
  public setGlobalMute(): void {
    // no-op
  }
  public dispose(): void {
    // no-op
  }
}

class RecordingHapticBackend implements HapticBackend {
  public readonly patterns: (number | readonly number[])[] = [];
  public cancelCount = 0;

  public isSupported(): boolean {
    return true;
  }
  public vibrate(pattern: number | readonly number[]): boolean {
    this.patterns.push(pattern);
    return true;
  }
  public cancel(): void {
    this.cancelCount += 1;
  }
}

function makeSwapTransition(
  overrides: Partial<PendingSwapTransition> & { matchDelta?: number } = {},
): PendingSwapTransition {
  const matchDelta = overrides.matchDelta ?? 1;
  return {
    transitionId: overrides.transitionId ?? 1,
    attemptId: overrides.attemptId ?? 1,
    firstIndex: overrides.firstIndex ?? 0,
    secondIndex: overrides.secondIndex ?? 1,
    completedAfterSwap: overrides.completedAfterSwap ?? false,
    swap: {
      firstIndex: overrides.firstIndex ?? 0,
      secondIndex: overrides.secondIndex ?? 1,
      previousMatchCount: 1,
      currentMatchCount: 1 + matchDelta,
      matchDelta,
      moveCount: 1,
      isCompleted: overrides.completedAfterSwap ?? false,
    },
  };
}

describe('AudioFeedbackMapper', () => {
  it('maps positive, negative, unchanged, and victory-suppressed match deltas cleanly', () => {
    expect(mapMatchDeltaToFeedback(2)).toEqual({
      sfx: AUDIO_ASSET_KEYS.SFX_MATCH_INCREASE,
      haptic: 'match_positive',
    });
    expect(mapMatchDeltaToFeedback(-1)).toEqual({
      sfx: AUDIO_ASSET_KEYS.SFX_MATCH_DECREASE,
      haptic: null,
    });
    expect(mapMatchDeltaToFeedback(0)).toEqual({
      sfx: null,
      haptic: null,
    });
    expect(mapMatchDeltaToFeedback(0, { playUnchanged: true })).toEqual({
      sfx: AUDIO_ASSET_KEYS.SFX_MATCH_UNCHANGED,
      haptic: null,
    });
    expect(mapMatchDeltaToFeedback(2, { suppressForVictory: true })).toEqual({
      sfx: null,
      haptic: null,
    });
  });

  it('computes escalating star reveal pitch rates and bounded selection pitch variation', () => {
    const r0 = computeStarRevealRate(0);
    const r1 = computeStarRevealRate(1);
    const r2 = computeStarRevealRate(2);
    expect(r0).toBeLessThan(r1);
    expect(r1).toBeLessThan(r2);
    expect(computeStarRevealRate(99)).toBe(r2);

    const low = computeSelectPitchRate(0);
    const high = computeSelectPitchRate(1);
    expect(low).toBeGreaterThanOrEqual(0.96);
    expect(high).toBeLessThanOrEqual(1.04);
    expect(low).toBeLessThan(high);
  });
});

describe('GameplayAudioController', () => {
  it('plays selection, deselection, swap, single landing, and match feedback in order', () => {
    let nowMs = 1000;
    const audioBackend = new RecordingAudioBackend();
    const hapticBackend = new RecordingHapticBackend();
    const settings = new SettingsService();
    settings.setVibrationEnabled(true);

    const audioService = new AudioService({
      backend: audioBackend,
      settingsService: settings,
      now: () => nowMs,
      random: () => 0.5,
    });
    const hapticService = new HapticService({
      backend: hapticBackend,
      settingsService: settings,
      now: () => nowMs,
    });
    const controller = new GameplayAudioController({
      audioService,
      hapticService,
      initialAttemptId: 1,
    });

    controller.handlePlayerGameEvents([{ type: 'BOTTLE_SELECTED', slotIndex: 0 }]);
    nowMs += 100;
    controller.handlePlayerGameEvents([{ type: 'SELECTION_CLEARED', previousSlotIndex: 0 }]);
    nowMs += 100;

    const transition = makeSwapTransition({ transitionId: 1, attemptId: 1, matchDelta: 1 });
    controller.handleSwapStarted(transition);
    nowMs += 300;
    controller.handleSwapLanding(1, 1);
    controller.handleSwapLanding(1, 1); // duplicate ignored
    nowMs += 100;
    controller.handleSwapReconciled(transition);
    controller.handleSwapReconciled(transition); // duplicate ignored

    expect(audioBackend.events.map((e) => e.key)).toEqual([
      AUDIO_ASSET_KEYS.SFX_BOTTLE_SELECT,
      AUDIO_ASSET_KEYS.SFX_BOTTLE_DESELECT,
      AUDIO_ASSET_KEYS.SFX_BOTTLE_SWAP,
      AUDIO_ASSET_KEYS.SFX_BOTTLE_LAND,
      AUDIO_ASSET_KEYS.SFX_MATCH_INCREASE,
    ]);
    expect(hapticBackend.patterns).toEqual([10, 15, 20]);

    controller.dispose();
    audioService.dispose();
    hapticService.dispose();
    settings.dispose();
  });

  it('plays victory flourish once per attempt and suppresses redundant positive match chime', () => {
    let nowMs = 2000;
    const audioBackend = new RecordingAudioBackend();
    const hapticBackend = new RecordingHapticBackend();
    const settings = new SettingsService();
    settings.setVibrationEnabled(true);

    const audioService = new AudioService({
      backend: audioBackend,
      settingsService: settings,
      now: () => nowMs,
    });
    const hapticService = new HapticService({
      backend: hapticBackend,
      settingsService: settings,
      now: () => nowMs,
    });
    const controller = new GameplayAudioController({
      audioService,
      hapticService,
      initialAttemptId: 1,
    });

    const winningSwap = makeSwapTransition({
      transitionId: 5,
      attemptId: 1,
      matchDelta: 2,
      completedAfterSwap: true,
    });
    controller.handleSwapStarted(winningSwap);
    nowMs += 200;
    controller.handleSwapLanding(5, 1);
    nowMs += 80;
    controller.handleSwapReconciled(winningSwap);
    nowMs += 20;
    controller.handleVictoryTriggered(1);
    controller.handleVictoryTriggered(1); // duplicate ignored

    expect(audioBackend.events.map((e) => e.key)).toEqual([
      AUDIO_ASSET_KEYS.SFX_BOTTLE_SWAP,
      AUDIO_ASSET_KEYS.SFX_BOTTLE_LAND,
      AUDIO_ASSET_KEYS.SFX_VICTORY,
    ]);
    expect(audioBackend.events.some((e) => e.key === AUDIO_ASSET_KEYS.SFX_MATCH_INCREASE)).toBe(
      false,
    );
    expect(hapticBackend.patterns).toEqual([15, [30, 40, 30]]);

    // Sequential star reveals escalate pitch
    controller.handleStarRevealed(0);
    controller.handleStarRevealed(1);
    controller.handleStarRevealed(2);
    const starEvents = audioBackend.events.filter(
      (e) => e.key === AUDIO_ASSET_KEYS.SFX_STAR_REVEAL,
    );
    expect(starEvents).toHaveLength(3);
    expect(starEvents[0]?.rate).toBeLessThan(starEvents[1]?.rate ?? 0);
    expect(starEvents[1]?.rate).toBeLessThan(starEvents[2]?.rate ?? 0);

    // Reduced-motion star summary plays once per attempt
    controller.resetForAttempt(2);
    nowMs += 300;
    controller.handleReducedMotionStarsPresented(2, 2);
    controller.handleReducedMotionStarsPresented(2, 2);
    const allStars = audioBackend.events.filter((e) => e.key === AUDIO_ASSET_KEYS.SFX_STAR_REVEAL);
    expect(allStars).toHaveLength(4);

    // Stale transition from attempt 1 is ignored during attempt 2
    const before = audioBackend.events.length;
    controller.handleSwapLanding(99, 1);
    controller.handleSwapReconciled(makeSwapTransition({ transitionId: 99, attemptId: 1 }));
    expect(audioBackend.events.length).toBe(before);

    controller.dispose();
    audioService.dispose();
    hapticService.dispose();
    settings.dispose();
  });
});
