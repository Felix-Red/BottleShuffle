import { describe, expect, it } from 'vitest';
import {
  CURRENT_CAMPAIGN_CATALOG_VERSION,
  CURRENT_SAVE_SCHEMA_VERSION,
  formatLevelId,
  GameEngine,
  generateLevelPuzzle,
  getDefaultLevelCatalog,
  SAVE_GAME_ID,
  toLevelChallengeObjective,
  validateSaveData,
  type BottleId,
} from '../../../src/core';
import { GameplayController } from '../../../src/game/gameplay/GameplayController';
import { calculateGameplayLayout } from '../../../src/game/layout/GameplayLayout';
import { mapLevelSelectionViewState } from '../../../src/game/levels/LevelSelectionViewStateMapper';
import { ProgressionController } from '../../../src/game/progression/ProgressionController';
import { ChallengeIntroService } from '../../../src/services/ChallengeIntroService';
import {
  evaluateCountdownUrgency,
  formatCountdownTime,
  GameplayClock,
  type MonotonicClock,
} from '../../../src/services/GameplayClock';
import { SaveService } from '../../../src/services/persistence/SaveService';
import { SettingsService } from '../../../src/services/SettingsService';
import { TutorialPreferenceService } from '../../../src/services/TutorialPreferenceService';
import { InMemorySaveStorage } from '../../helpers/InMemorySaveStorage';

class FakeClock implements MonotonicClock {
  private ms = 0;
  public now(): number {
    return this.ms;
  }
  public advance(deltaMs: number): void {
    this.ms += deltaMs;
  }
}

function createKnownOneSwapPuzzle(): {
  readonly id: string;
  readonly seed: string;
  readonly generatorVersion: string;
  readonly difficulty: 'beginner';
  readonly bottleCount: number;
  readonly startingSequence: readonly BottleId[];
  readonly targetSequence: readonly BottleId[];
} {
  return {
    id: 'test-1swap',
    seed: 'test-1swap',
    generatorVersion: '1.0.0',
    difficulty: 'beginner',
    bottleCount: 3,
    startingSequence: ['red', 'blue', 'green'],
    targetSequence: ['blue', 'red', 'green'],
  };
}

function createKnownTwoSwapPuzzle(): {
  readonly id: string;
  readonly seed: string;
  readonly generatorVersion: string;
  readonly difficulty: 'beginner';
  readonly bottleCount: number;
  readonly startingSequence: readonly BottleId[];
  readonly targetSequence: readonly BottleId[];
} {
  return {
    id: 'test-2swap',
    seed: 'test-2swap',
    generatorVersion: '1.0.0',
    difficulty: 'beginner',
    bottleCount: 3,
    startingSequence: ['red', 'blue', 'green'],
    targetSequence: ['blue', 'green', 'red'],
  };
}

function unlockUpTo(progression: ProgressionController, count: number): void {
  for (let n = 1; n <= count; n += 1) {
    const id = formatLevelId(n);
    const att = progression.beginCampaignAttempt(id);
    if (att.accepted) {
      progression.completeActiveAttempt({
        attemptId: att.attempt.attemptId,
        levelId: id,
        moveCount: 3,
        elapsedMs: 12_000,
        score: 1000,
        starRating: 3,
        scoringPolicyVersion: 1,
      });
    }
  }
}

describe('Campaign Progression Redesign — All 50 Levels & Structure', () => {
  const catalog = getDefaultLevelCatalog();

  it('increases bottle count by 1 per level in Chapter 1 (Levels 1-8, 3..10 bottles, classic)', () => {
    const ch1 = catalog.getLevelsByChapter('chapter-01');
    expect(ch1).toHaveLength(8);
    expect(ch1.map((l) => l.levelNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(ch1.map((l) => l.bottleCount)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    for (const lvl of ch1) {
      expect(lvl.challengeMode).toBe('classic');
      expect(lvl.timeLimitSeconds).toBeNull();
      expect(lvl.moveLimit).toBeNull();
    }
  });

  it('configures Chapter 2 (Beat the Clock) and Chapter 3 (Speed Mastery) with exact countdowns', () => {
    const ch2 = catalog.getLevelsByChapter('chapter-02');
    expect(ch2.map((l) => l.bottleCount)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    expect(ch2.map((l) => l.timeLimitSeconds)).toEqual([30, 45, 60, 90, 120, 150, 180, 210]);
    expect(ch2.every((l) => l.challengeMode === 'timed' && l.moveLimit === null)).toBe(true);

    const ch3 = catalog.getLevelsByChapter('chapter-03');
    expect(ch3.map((l) => l.bottleCount)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    expect(ch3.map((l) => l.timeLimitSeconds)).toEqual([20, 30, 45, 60, 90, 120, 150, 180]);
    expect(ch3.every((l) => l.challengeMode === 'timed' && l.moveLimit === null)).toBe(true);
  });

  it('configures Chapter 4 (Every Move Counts), Chapter 5 (Double Trouble), and Chapter 6 (Shuffle Master) with realistic budgets and zero repeated Ch6 configs', () => {
    const ch4 = catalog.getLevelsByChapter('chapter-04');
    expect(ch4.map((l) => l.bottleCount)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    expect(
      ch4.every((l) => l.challengeMode === 'limited_moves' && l.timeLimitSeconds === null),
    ).toBe(true);
    // Every limited-move allowance must strictly exceed bottleCount for realistic blind deduction
    for (const lvl of ch4) {
      expect(lvl.moveLimit).not.toBeNull();
      expect(lvl.moveLimit ?? 0).toBeGreaterThan(lvl.bottleCount);
    }

    const ch5 = catalog.getLevelsByChapter('chapter-05');
    expect(ch5.map((l) => l.bottleCount)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    expect(
      ch5.every(
        (l) =>
          l.challengeMode === 'combined' && l.timeLimitSeconds !== null && l.moveLimit !== null,
      ),
    ).toBe(true);

    const ch6 = catalog.getLevelsByChapter('chapter-06');
    expect(ch6).toHaveLength(10);
    const seenConfigs = new Set<string>();
    for (const lvl of ch6) {
      expect(lvl.challengeMode).toBe('combined');
      expect(lvl.timeLimitSeconds).not.toBeNull();
      expect(lvl.moveLimit).not.toBeNull();
      const sig = `${String(lvl.bottleCount)}:${String(lvl.timeLimitSeconds)}:${String(lvl.moveLimit)}`;
      expect(seenConfigs.has(sig)).toBe(false);
      seenConfigs.add(sig);
    }
    expect(seenConfigs.size).toBe(10);
  });

  it('validates mathematical solvability of all 50 levels under their own challenge objectives', () => {
    for (const level of catalog.getAllLevels()) {
      const puzzle = generateLevelPuzzle(level);
      const engine = new GameEngine(puzzle, toLevelChallengeObjective(level));
      engine.start();

      while (engine.getPublicState().status === 'playing') {
        const cur = engine.getPublicState().currentSequence;
        const mismatch = cur.findIndex((id, idx) => id !== puzzle.targetSequence[idx]);
        if (mismatch < 0) break;
        const needed = puzzle.targetSequence[mismatch];
        const source = needed !== undefined ? cur.indexOf(needed) : -1;
        engine.swapBottles(mismatch, source);
      }

      expect(engine.getPublicState().status).toBe('completed');
    }
  });
});

describe('Domain Challenge Rules — Move Limits & Timer Expiration', () => {
  it('does not deduct moves for selection or deselection, prevents negative remaining moves, and fails on exhaustion', () => {
    const puzzle = createKnownTwoSwapPuzzle();
    // Engine rejects impossible moveLimit < minRequiredSwaps
    expect(
      () =>
        new GameEngine(puzzle, {
          challengeMode: 'limited_moves',
          moveLimit: 1,
          timeLimitSeconds: null,
        }),
    ).toThrow();

    const engine = new GameEngine(puzzle, {
      challengeMode: 'limited_moves',
      moveLimit: 2,
      timeLimitSeconds: null,
    });
    engine.start();

    expect(engine.getPublicState().remainingMoves).toBe(2);

    // Selection and deselection do not consume moves
    engine.selectBottle(0);
    expect(engine.getPublicState().remainingMoves).toBe(2);
    engine.selectBottle(0); // deselect
    expect(engine.getPublicState().remainingMoves).toBe(2);
    engine.selectBottle(1);
    engine.clearSelection();
    expect(engine.getPublicState().remainingMoves).toBe(2);

    // First non-winning swap consumes 1 move (2 -> 1)
    const firstSwap = engine.swapBottles(0, 1);
    expect(firstSwap.accepted).toBe(true);
    expect(firstSwap.publicState.status).toBe('playing');
    expect(firstSwap.publicState.remainingMoves).toBe(1);

    // Second non-winning swap (reversing 0<->1) exhausts move limit -> failed with moves_exhausted
    const swapRes = engine.swapBottles(0, 1);
    expect(swapRes.accepted).toBe(true);
    expect(swapRes.publicState.status).toBe('failed');
    expect(swapRes.publicState.failureReason).toBe('moves_exhausted');
    expect(swapRes.publicState.remainingMoves).toBe(0);
    expect(swapRes.events.map((e) => e.type)).toEqual(['BOTTLES_SWAPPED', 'PUZZLE_FAILED']);

    // Further swaps are rejected and remainingMoves never becomes negative
    const afterFail = engine.swapBottles(1, 2);
    expect(afterFail.accepted).toBe(false);
    expect(afterFail.rejectionReason).toBe('PUZZLE_ALREADY_FAILED');
    expect(engine.getPublicState().remainingMoves).toBe(0);
    expect(engine.getCompletedScoringMetadata()).toBeNull();
  });

  it('allows a successful final permitted move to complete rather than fail', () => {
    const puzzle = createKnownOneSwapPuzzle();
    const engine = new GameEngine(puzzle, {
      challengeMode: 'limited_moves',
      moveLimit: 1,
      timeLimitSeconds: null,
    });
    engine.start();

    const res = engine.swapBottles(0, 1);
    expect(res.accepted).toBe(true);
    expect(res.publicState.status).toBe('completed');
    expect(res.publicState.remainingMoves).toBe(0);
    expect(res.publicState.failureReason).toBeNull();
    expect(res.events.map((e) => e.type)).toEqual(['BOTTLES_SWAPPED', 'PUZZLE_COMPLETED']);
    expect(engine.getCompletedScoringMetadata()).not.toBeNull();
  });

  it('prevents timer expiration from overwriting a completed puzzle and resets cleanly on restart', () => {
    const puzzle = createKnownOneSwapPuzzle();
    const engine = new GameEngine(puzzle, {
      challengeMode: 'timed',
      timeLimitSeconds: 20,
      moveLimit: null,
    });
    engine.start();
    engine.swapBottles(0, 1);
    expect(engine.getPublicState().status).toBe('completed');

    const lateExpire = engine.expireTimer();
    expect(lateExpire.accepted).toBe(false);
    expect(engine.getPublicState().status).toBe('completed');

    // Restarting from failed restores exact original restrictions
    const failEngine = new GameEngine(puzzle, {
      challengeMode: 'combined',
      timeLimitSeconds: 20,
      moveLimit: 3,
    });
    failEngine.start();
    const expired = failEngine.expireTimer();
    expect(expired.accepted).toBe(true);
    expect(expired.publicState.status).toBe('failed');
    expect(expired.publicState.failureReason).toBe('time_expired');

    const restarted = failEngine.restart();
    expect(restarted.accepted).toBe(true);
    expect(restarted.publicState.status).toBe('playing');
    expect(restarted.publicState.remainingMoves).toBe(3);
    expect(restarted.publicState.timeLimitSeconds).toBe(20);
    expect(restarted.publicState.failureReason).toBeNull();
  });
});

describe('Countdown Clock, Race Safety, Lifecycle Suspension & Challenge Intros', () => {
  it('tracks countdown accurately with monotonic clock, ceiling formatting, amber/red urgency, and pause/resume', () => {
    const fake = new FakeClock();
    const clock = new GameplayClock(fake, 30_000);
    clock.start();

    expect(clock.getDisplayTime()).toBe('00:30');
    expect(clock.getCountdownUrgency()).toBe('normal');
    expect(evaluateCountdownUrgency(30_000, 30_000)).toBe('normal');
    expect(evaluateCountdownUrgency(10_000, 30_000)).toBe('warning');
    expect(evaluateCountdownUrgency(4_000, 30_000)).toBe('critical');

    fake.advance(18_000); // 12s remaining -> warning (amber)
    expect(clock.getDisplayTime()).toBe('00:12');
    expect(clock.getCountdownUrgency()).toBe('warning');

    // Pause for 60s — remaining time must NOT decrease while paused
    clock.setManualPaused(true);
    fake.advance(60_000);
    expect(clock.getRemainingMs()).toBe(12_000);
    clock.setManualPaused(false);

    // Advance 8s -> 4s remaining -> critical (red)
    fake.advance(8_000);
    expect(clock.getDisplayTime()).toBe('00:04');
    expect(clock.getCountdownUrgency()).toBe('critical');

    // Advance 3900ms -> 100ms remaining -> still displays 00:01 and NOT expired
    fake.advance(3_900);
    expect(formatCountdownTime(clock.getRemainingMs() ?? 0)).toBe('00:01');
    expect(clock.isExpired()).toBe(false);

    // Advance final 100ms -> expired at 00:00
    fake.advance(100);
    expect(clock.isExpired()).toBe(true);
    expect(clock.getDisplayTime()).toBe('00:00');
  });

  it('holds countdown paused during challenge intro overlay, starts on dismiss, and completes safely near timer expiration', () => {
    const fake = new FakeClock();
    const progression = new ProgressionController();
    unlockUpTo(progression, 8); // Unlock Level 9 (3 bottles, 30s timed)
    const introService = new ChallengeIntroService();

    const puzzle = createKnownOneSwapPuzzle();
    const controller = new GameplayController({
      sceneData: { mode: 'campaign', levelId: 'level-009' },
      progressionController: progression,
      challengeIntroService: introService,
      puzzle,
      clock: fake,
    });

    const started = controller.start();
    expect(started.overlayMode).toBe('challenge_intro');
    expect(started.challengeIntro?.mode).toBe('timed');

    // Waiting 45 seconds with intro open must NOT drain the 30s countdown!
    fake.advance(45_000);
    expect(controller.getRemainingMs()).toBe(30_000);
    const introPoll = controller.pollTimer();
    expect(introPoll?.expired ?? false).toBe(false);
    expect(introPoll?.remainingTimeMs ?? 30_000).toBe(30_000);
    expect(controller.getViewState().overlayMode).toBe('challenge_intro');

    // Dismiss intro -> countdown begins and mode is marked seen
    const afterDismiss = controller.dismissChallengeIntro();
    expect(afterDismiss.overlayMode).toBe('none');
    expect(introService.hasSeen('timed')).toBe(true);

    // Host pause/resume suspension freezes timer reliably
    fake.advance(10_000); // 20s left
    controller.handlePlatformSuspend();
    fake.advance(25_000);
    controller.handlePlatformResume();
    expect(controller.getRemainingMs()).toBe(20_000);

    // Advance to 29,950ms (50ms remaining) and accept winning swap right before deadline
    fake.advance(19_950);
    controller.handleBottleTap(0);
    controller.handleBottleTap(1); // accepted BEFORE 30,000ms!
    // Even if swap animation takes 500ms (crossing 30,000ms), accepted winning swap MUST complete!
    fake.advance(500);
    controller.pollTimer();
    const finalView = controller.completeSwapTransition();
    expect(finalView.status).toBe('completed');
    expect(finalView.overlayMode).toBe('completed');
    expect(progression.getLevelStatus('level-009')).toBe('completed');
    controller.dispose();
  });

  it('protects campaign progression on failed attempts (Time Up & Out of Moves) and supports immediate retry', () => {
    const fake = new FakeClock();
    const progression = new ProgressionController();
    unlockUpTo(progression, 8); // Level 9 unlocked, Level 10 locked

    // First verify failed new level does NOT unlock Level 10 or award stars
    const timedController = new GameplayController({
      sceneData: { mode: 'campaign', levelId: 'level-009' },
      progressionController: progression,
      puzzle: createKnownOneSwapPuzzle(),
      clock: fake,
    });
    timedController.start();
    fake.advance(30_000);
    timedController.pollTimer();

    const failedView = timedController.getViewState();
    expect(failedView.status).toBe('failed');
    expect(failedView.overlayMode).toBe('failed');
    expect(failedView.failure?.title).toBe("Time's Up!");
    expect(progression.getLevelStatus('level-009')).toBe('unlocked');
    expect(progression.getLevelStatus('level-010')).toBe('locked');
    expect(progression.getCompletionRecord('level-009')).toBeNull();

    // Retry restarts same puzzle with full 30s and clears failure overlay
    const retried = timedController.confirmRestart();
    expect(retried.status).toBe('playing');
    expect(retried.overlayMode).toBe('none');
    expect(timedController.getRemainingMs()).toBe(30_000);

    // Complete Level 9 cleanly -> Level 10 unlocks
    timedController.handleBottleTap(0);
    timedController.handleBottleTap(1);
    timedController.completeSwapTransition();
    expect(progression.getLevelStatus('level-009')).toBe('completed');
    expect(progression.getLevelStatus('level-010')).toBe('unlocked');
    const savedRecordBeforeFail = progression.getCompletionRecord('level-009');
    timedController.dispose();

    // Replaying completed Level 9 and failing must NEVER erase earned stars or completion record
    const replayFail = new GameplayController({
      sceneData: { mode: 'campaign', levelId: 'level-009' },
      progressionController: progression,
      puzzle: createKnownOneSwapPuzzle(),
      clock: fake,
    });
    replayFail.start();
    fake.advance(31_000);
    replayFail.pollTimer();
    expect(replayFail.getViewState().overlayMode).toBe('failed');
    expect(progression.getCompletionRecord('level-009')).toEqual(savedRecordBeforeFail);
    replayFail.dispose();
  });
});

describe('Persistence v1 -> v2 Migration & Responsive HUD / Level Selection Layouts', () => {
  it('migrates pre-redesign v1 saves cleanly: preserves settings & tutorial, resets incompatible v1 progression', async () => {
    const legacyV1Save = JSON.stringify({
      schemaVersion: 1,
      gameId: SAVE_GAME_ID,
      revision: 12,
      updatedAt: '2026-11-20T12:00:00.000Z',
      progression: {
        completedLevels: {
          'level-001': {
            completionCount: 2,
            bestMoveCount: 1,
            bestElapsedMs: 6000,
            bestScore: 1000,
            bestStarRating: 3,
            scoringPolicyVersion: 1,
          },
          'level-006': {
            completionCount: 1,
            bestMoveCount: 3,
            bestElapsedMs: 12000,
            bestScore: 1250,
            bestStarRating: 3,
            scoringPolicyVersion: 1,
          },
        },
        lastPlayedLevelId: 'level-006',
      },
      settings: {
        musicEnabled: false,
        soundEffectsEnabled: true,
        vibrationEnabled: true,
        motionPreference: 'reduced',
      },
      tutorial: { status: 'completed', completed: true },
    });

    const storage = new InMemorySaveStorage({ initialPayload: legacyV1Save });
    const progression = new ProgressionController();
    const settings = new SettingsService();
    const tutorial = new TutorialPreferenceService();
    const challengeIntro = new ChallengeIntroService();

    const saveService = new SaveService({
      storage,
      targets: {
        progressionController: progression,
        settingsService: settings,
        tutorialPreference: tutorial,
        challengeIntroService: challengeIntro,
      },
    });

    const outcome = await saveService.initialise();
    expect(outcome.outcome).toBe('restored');
    expect(outcome.data.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(outcome.data.campaignCatalogVersion).toBe(CURRENT_CAMPAIGN_CATALOG_VERSION);
    // Settings & tutorial preserved!
    expect(settings.getSettings().musicEnabled).toBe(false);
    expect(settings.getSettings().motionPreference).toBe('reduced');
    expect(tutorial.getStatus()).toBe('completed');
    // Old incompatible v1 level records reset cleanly!
    expect(progression.getCampaignProgress().completedLevels).toBe(0);
    expect(progression.getLevelStatus('level-006')).toBe('locked');
    saveService.dispose();

    // Direct v2 save with stale campaignCatalogVersion also resets progression safely
    const staleCatalogSave = validateSaveData({
      schemaVersion: 2,
      gameId: SAVE_GAME_ID,
      campaignCatalogVersion: '1.0.0',
      revision: 4,
      updatedAt: '2026-11-27T10:00:00.000Z',
      progression: {
        completedLevels: {
          'level-001': { completionCount: 1, bestMoveCount: 2, bestElapsedMs: 5000 },
        },
        lastPlayedLevelId: 'level-001',
      },
      settings: {
        musicEnabled: true,
        soundEffectsEnabled: true,
        vibrationEnabled: false,
        motionPreference: 'system',
      },
      tutorial: { status: 'completed', completed: true },
      seenChallengeIntros: ['timed'],
    });
    expect(staleCatalogSave.disposition).toBe('repaired');
    expect(Object.keys(staleCatalogSave.data?.progression.completedLevels ?? {})).toHaveLength(0);
    expect(staleCatalogSave.data?.seenChallengeIntros).toEqual(['timed']);
  });

  it('positions countdown progress bar cleanly without overlapping board in landscape and portrait viewports', () => {
    const viewports = [
      { width: 1280, height: 720 },
      { width: 844, height: 390 },
      { width: 390, height: 844 },
      { width: 320, height: 480 },
    ];

    for (const vp of viewports) {
      const layout = calculateGameplayLayout({
        width: vp.width,
        height: vp.height,
        bottleCount: 10,
        showCountdownBar: true,
      });

      expect(layout.hud.countdownBar.visible).toBe(true);
      expect(layout.hud.countdownBar.width).toBeGreaterThan(120);
      const barBottom = layout.hud.countdownBar.y + layout.hud.countdownBar.height / 2;
      const rackTop = layout.board.rackY - layout.board.rackLayout.rackHeight / 2;
      expect(barBottom).toBeLessThanOrEqual(rackTop + 2);
    }

    // Verify Level Selection exposes chapter & level challenge indicators clearly
    const progression = new ProgressionController();
    unlockUpTo(progression, 32); // Unlock Chapter 5 (Double Trouble)
    const lsState = mapLevelSelectionViewState({
      progressionController: progression,
      selectedChapterId: 'chapter-05',
      selectedLevelId: 'level-033',
      focusedLevelIndex: 0,
      previewLevelId: 'level-033',
      pendingUnlockLevelIds: new Set(),
      canNavigate: true,
      chapterCompletedBanner: null,
      lockedFeedbackMessage: null,
      errorMessage: null,
    });
    expect(lsState.currentChapter.displayName).toBe('Double Trouble');
    expect(lsState.currentChapter.challengeModeLabel).toBe('Timed + Moves');
    expect(lsState.currentChapter.bottleRangeLabel).toBe('3–10 Bottles');
    expect(lsState.levelCards[0]?.constraintSummary).toContain('3B');
    expect(lsState.levelCards[0]?.constraintSummary).toContain('30s');
    expect(lsState.levelCards[0]?.constraintSummary).toContain('7m');
    expect(lsState.previewLevel?.objectiveSummary).toContain('Timed + Moves');
  });
});
