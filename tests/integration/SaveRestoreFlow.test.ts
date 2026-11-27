import { describe, expect, it } from 'vitest';
import {
  calculateScoreBreakdown,
  calculateStarRating,
  type ProgressionTransitionResult,
  type Puzzle,
} from '../../src/core';
import { GameplayController } from '../../src/game/gameplay/GameplayController';
import { ProgressionController } from '../../src/game/progression/ProgressionController';
import { BrowserGamePlatform } from '../../src/platform/browser/BrowserGamePlatform';
import { MotionPreferenceService } from '../../src/services/MotionPreferenceService';
import { SettingsService } from '../../src/services/SettingsService';
import { TutorialPreferenceService } from '../../src/services/TutorialPreferenceService';
import { SaveCoordinator } from '../../src/services/persistence/SaveCoordinator';
import { SaveService } from '../../src/services/persistence/SaveService';
import { InMemorySaveStorage } from '../helpers/InMemorySaveStorage';

interface TestSession {
  readonly init: Awaited<ReturnType<SaveService['initialise']>>;
  readonly platform: BrowserGamePlatform;
  readonly progressionController: ProgressionController;
  readonly settingsService: SettingsService;
  readonly tutorialPreference: TutorialPreferenceService;
  readonly saveService: SaveService;
  readonly coordinator: SaveCoordinator;
  readonly motionPreference: MotionPreferenceService;
  readonly dispose: () => void;
}

function createSession(storage: InMemorySaveStorage): {
  readonly initAndConnect: () => Promise<TestSession>;
} {
  const platform = new BrowserGamePlatform({ storage: null, documentRef: null });
  const progressionController = new ProgressionController();
  const settingsService = new SettingsService();
  const tutorialPreference = new TutorialPreferenceService();
  const saveService = new SaveService({
    storage,
    targets: {
      progressionController,
      settingsService,
      tutorialPreference,
    },
    normalDebounceMs: 0,
    maxAutomaticRetries: 0,
  });

  const initAndConnect = async (): Promise<TestSession> => {
    const init = await saveService.initialise();
    const coordinator = new SaveCoordinator({
      saveService,
      progressionController,
      settingsService,
      tutorialPreference,
      platform,
    });
    const motionPreference = new MotionPreferenceService(undefined, settingsService);
    return {
      init,
      platform,
      progressionController,
      settingsService,
      tutorialPreference,
      saveService,
      coordinator,
      motionPreference,
      dispose: () => {
        coordinator.dispose();
        saveService.dispose();
        motionPreference.dispose();
        settingsService.dispose();
        tutorialPreference.dispose();
        platform.dispose();
      },
    };
  };

  return { initAndConnect };
}

function completeCampaignLevel(
  progression: ProgressionController,
  levelId: string,
  extraMoves: number,
  elapsedMs: number,
): ProgressionTransitionResult {
  const begin = progression.beginCampaignAttempt(levelId);
  if (!begin.accepted) {
    throw new Error(`Expected ${levelId} to be playable`);
  }
  const minSwaps = Math.max(2, begin.level.bottleCount - 2);
  const actualMoves = minSwaps + extraMoves;
  const breakdown = calculateScoreBreakdown({
    difficulty: begin.level.difficulty,
    actualMoves,
    minimumRequiredSwaps: minSwaps,
  });
  const stars = calculateStarRating(minSwaps, actualMoves);
  return progression.completeActiveAttempt({
    attemptId: begin.attempt.attemptId,
    levelId,
    moveCount: actualMoves,
    elapsedMs,
    score: breakdown.totalScore,
    starRating: stars,
    scoringPolicyVersion: breakdown.scoringPolicyVersion,
  });
}

describe('Save & Restore end-to-end integration journeys', () => {
  it('Journey 1 & 2: first installation defaults -> level 1 completion -> reload restores stars, bests, and unlocks', async () => {
    const storage = new InMemorySaveStorage();
    const session1 = await createSession(storage).initAndConnect();

    expect(session1.init.outcome).toBe('missing');
    expect(session1.settingsService.getSettings().musicEnabled).toBe(true);
    expect(session1.settingsService.getSettings().vibrationEnabled).toBe(false);
    expect(session1.tutorialPreference.shouldOfferFirstTimeTutorial()).toBe(true);
    expect(session1.progressionController.getLevelStatus('level-001')).toBe('unlocked');
    expect(session1.progressionController.getLevelStatus('level-002')).toBe('locked');

    // Complete level 1 -> high-priority save triggers automatically
    const res = completeCampaignLevel(session1.progressionController, 'level-001', 0, 14500);
    expect(res.accepted).toBe(true);
    await session1.saveService.flush();
    expect(session1.saveService.getStatus().status).toBe('saved');
    expect(storage.getWriteCount()).toBeGreaterThanOrEqual(1);
    const savedRecord = session1.progressionController.getCompletionRecord('level-001');
    session1.dispose();

    // Recreate all services and reload from storage
    const session2 = await createSession(storage).initAndConnect();
    expect(session2.init.outcome).toBe('restored');
    expect(session2.progressionController.getLevelStatus('level-001')).toBe('completed');
    expect(session2.progressionController.getLevelStatus('level-002')).toBe('unlocked');
    expect(session2.progressionController.getCompletionRecord('level-001')).toEqual(savedRecord);
    expect(session2.progressionController.getCampaignAchievementSummary().totalEarnedStars).toBe(3);
    session2.dispose();
  });

  it('Journey 3: replay improvement persists while worse replay never overwrites historical personal bests', async () => {
    const storage = new InMemorySaveStorage();
    const session1 = await createSession(storage).initAndConnect();

    // First attempt: 2 stars (extraMoves = 2), 30s
    completeCampaignLevel(session1.progressionController, 'level-001', 2, 30000);
    // Replay 1 (better): 3 stars (extraMoves = 0), 15s
    completeCampaignLevel(session1.progressionController, 'level-001', 0, 15000);
    // Replay 2 (worse): 1 star (extraMoves = 10), 60s
    completeCampaignLevel(session1.progressionController, 'level-001', 10, 60000);

    await session1.saveService.flush();
    const beforeReload = session1.progressionController.getCompletionRecord('level-001');
    session1.dispose();

    const session2 = await createSession(storage).initAndConnect();
    const afterReload = session2.progressionController.getCompletionRecord('level-001');
    expect(afterReload).toEqual(beforeReload);
    expect(afterReload?.completionCount).toBe(3);
    expect(afterReload?.bestStarRating).toBe(3);
    expect(afterReload?.bestElapsedMs).toBe(15000);
    session2.dispose();
  });

  it('Journey 4: settings persist and restore before presentation; Reset Settings preserves campaign progression', async () => {
    const storage = new InMemorySaveStorage();
    const session1 = await createSession(storage).initAndConnect();

    completeCampaignLevel(session1.progressionController, 'level-001', 0, 12000);
    session1.settingsService.setMusicEnabled(false);
    session1.settingsService.setSoundEffectsEnabled(false);
    session1.settingsService.setMotionPreference('reduced');
    await session1.saveService.flush();
    session1.dispose();

    const session2 = await createSession(storage).initAndConnect();
    expect(session2.settingsService.getSettings().musicEnabled).toBe(false);
    expect(session2.settingsService.getSettings().soundEffectsEnabled).toBe(false);
    expect(session2.motionPreference.isReducedMotion()).toBe(true);

    // Reset Settings restores defaults ONLY and preserves completed campaign level
    session2.settingsService.resetToDefaults();
    await session2.saveService.flush();
    session2.dispose();

    const session3 = await createSession(storage).initAndConnect();
    expect(session3.settingsService.getSettings().musicEnabled).toBe(true);
    expect(session3.settingsService.getSettings().motionPreference).toBe('system');
    expect(session3.progressionController.getLevelStatus('level-001')).toBe('completed');
    session3.dispose();
  });

  it('Journey 5: tutorial completion persists and manual replay never erases campaign records', async () => {
    const storage = new InMemorySaveStorage();
    const session1 = await createSession(storage).initAndConnect();

    completeCampaignLevel(session1.progressionController, 'level-001', 0, 12000);
    session1.tutorialPreference.markCompleted();
    await session1.saveService.flush();
    session1.dispose();

    const session2 = await createSession(storage).initAndConnect();
    expect(session2.tutorialPreference.getStatus()).toBe('completed');
    expect(session2.tutorialPreference.shouldOfferFirstTimeTutorial()).toBe(false);

    // Skipping during a manual replay must never downgrade 'completed' or erase campaign progress
    session2.tutorialPreference.markSkipped();
    await session2.saveService.flush();
    expect(session2.tutorialPreference.getStatus()).toBe('completed');
    expect(session2.progressionController.getLevelStatus('level-001')).toBe('completed');
    session2.dispose();
  });

  it('Journey 6: unfinished attempts are not persisted and practice mode never mutates campaign saves', async () => {
    const storage = new InMemorySaveStorage();
    const session1 = await createSession(storage).initAndConnect();

    completeCampaignLevel(session1.progressionController, 'level-001', 0, 12000);
    await session1.saveService.flush();

    // Launch level 2, make a swap, then close without finishing
    const gc1 = new GameplayController({
      sceneData: { mode: 'campaign', levelId: 'level-002' },
      progressionController: session1.progressionController,
    });
    gc1.start();
    const initialSeq = [...gc1.getViewState().currentSequence];
    gc1.handleBottleTap(0);
    gc1.handleBottleTap(1);
    gc1.completeSwapTransition();
    expect(gc1.getViewState().moveCount).toBe(1);
    gc1.dispose();

    // Complete a standalone practice puzzle -> must NOT modify campaign progression
    const practicePuzzle: Puzzle = Object.freeze({
      id: 'practice-check',
      seed: 'practice-seed',
      generatorVersion: '1.0.0',
      difficulty: 'easy',
      bottleCount: 4,
      startingSequence: Object.freeze(['blue', 'red', 'green', 'yellow'] as const),
      targetSequence: Object.freeze(['red', 'blue', 'green', 'yellow'] as const),
    });
    const practiceGc = new GameplayController({
      sceneData: { mode: 'practice' },
      progressionController: session1.progressionController,
      puzzle: practicePuzzle,
    });
    practiceGc.start();
    practiceGc.handleBottleTap(0);
    practiceGc.handleBottleTap(1);
    practiceGc.completeSwapTransition();
    expect(practiceGc.getViewState().overlayMode).toBe('completed');
    practiceGc.dispose();

    await session1.saveService.flush();
    session1.dispose();

    // Reload -> level 1 still completed, level 2 starts fresh with identical deterministic sequence
    const session2 = await createSession(storage).initAndConnect();
    expect(session2.progressionController.getLevelStatus('level-001')).toBe('completed');
    expect(session2.progressionController.getLevelStatus('level-002')).toBe('unlocked');

    const gc2 = new GameplayController({
      sceneData: { mode: 'campaign', levelId: 'level-002' },
      progressionController: session2.progressionController,
    });
    gc2.start();
    expect(gc2.getViewState().currentSequence).toEqual(initialSeq);
    expect(gc2.getViewState().moveCount).toBe(0);
    gc2.dispose();
    session2.dispose();
  });

  it('Journey 7, 8 & 9: corrupted save protection, concurrent coalesced saves, and storage failure recovery', async () => {
    // 7. Corrupted save stays untouched and game remains playable
    const corruptStorage = new InMemorySaveStorage({ initialPayload: '%%%corrupt%%%' });
    const corruptSession = await createSession(corruptStorage).initAndConnect();
    expect(corruptSession.saveService.getStatus().status).toBe('recovery_required');
    expect(corruptSession.saveService.getStatus().autoWriteBlocked).toBe(true);
    completeCampaignLevel(corruptSession.progressionController, 'level-001', 0, 10000);
    expect(corruptSession.progressionController.getLevelStatus('level-001')).toBe('completed');
    expect(corruptStorage.getCurrentPayload()).toBe('%%%corrupt%%%');
    corruptSession.dispose();

    // 8. Concurrent saves during delayed write coalesce latest progression + settings
    const delayedStorage = new InMemorySaveStorage();
    const sessionA = await createSession(delayedStorage).initAndConnect();
    delayedStorage.setManualWriteControl(true);

    completeCampaignLevel(sessionA.progressionController, 'level-001', 0, 12000);
    completeCampaignLevel(sessionA.progressionController, 'level-002', 0, 14000);
    sessionA.settingsService.setMusicEnabled(false);

    // Resolve write #1, then resolve coalesced latest write #2
    delayedStorage.getPendingManualWrites()[0]?.resolve();
    await new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, 0);
    });
    expect(delayedStorage.getPendingManualWrites()).toHaveLength(2);
    delayedStorage.getPendingManualWrites()[1]?.resolve();
    await new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, 0);
    });
    expect(sessionA.saveService.getStatus().status).toBe('saved');
    sessionA.dispose();

    const sessionB = await createSession(delayedStorage).initAndConnect();
    expect(sessionB.progressionController.getLevelStatus('level-001')).toBe('completed');
    expect(sessionB.progressionController.getLevelStatus('level-002')).toBe('completed');
    expect(sessionB.settingsService.getSettings().musicEnabled).toBe(false);
    sessionB.dispose();

    // 9. Storage write failure preserves in-memory progress and succeeds on retry after recovery
    const failingStorage = new InMemorySaveStorage();
    const sessionC = await createSession(failingStorage).initAndConnect();
    failingStorage.setFailAllSaves('STORAGE_WRITE_FAILED');

    completeCampaignLevel(sessionC.progressionController, 'level-001', 0, 11000);
    await sessionC.saveService.flush();
    expect(sessionC.saveService.getStatus().status).toBe('failed');
    expect(sessionC.saveService.getStatus().hasUnsavedChanges).toBe(true);
    expect(sessionC.progressionController.getLevelStatus('level-001')).toBe('completed');

    // Restore storage availability & retry
    failingStorage.setFailAllSaves(null);
    sessionC.saveService.retryIfEligible();
    await sessionC.saveService.flush();
    expect(sessionC.saveService.getStatus().status).toBe('saved');
    sessionC.dispose();

    const sessionD = await createSession(failingStorage).initAndConnect();
    expect(sessionD.progressionController.getLevelStatus('level-001')).toBe('completed');
    sessionD.dispose();
  });
});
