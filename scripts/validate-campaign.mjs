import { createServer } from 'vite';

/**
 * Test-only optimal swap solver using target index lookup.
 * Strictly confined to scripts/ and never bundled into production.
 */
function solveWithOptimalSwaps(engine, targetSequence) {
  const targetPos = new Map();
  targetSequence.forEach((id, idx) => targetPos.set(id, idx));

  let swaps = 0;
  let completionEvents = 0;
  const maxSteps = targetSequence.length * 2;

  while (engine.getPublicState().status !== 'completed' && swaps <= maxSteps) {
    const current = engine.getPublicState().currentSequence;
    let firstMismatch = -1;
    for (let i = 0; i < current.length; i += 1) {
      if (current[i] !== targetSequence[i]) {
        firstMismatch = i;
        break;
      }
    }
    if (firstMismatch === -1) {
      break;
    }
    const desiredBottle = targetSequence[firstMismatch];
    const sourceIdx = current.indexOf(desiredBottle);
    if (sourceIdx === -1 || sourceIdx === firstMismatch) {
      throw new Error(`Solver could not locate target bottle ${desiredBottle}`);
    }

    const sel = engine.selectBottle(firstMismatch);
    if (!sel.accepted) {
      throw new Error(`Failed selecting slot ${String(firstMismatch)}: ${sel.reason ?? 'unknown'}`);
    }
    const swapRes = engine.selectBottle(sourceIdx);
    if (!swapRes.accepted) {
      throw new Error(
        `Failed swapping ${String(firstMismatch)}<->${String(sourceIdx)}: ${swapRes.reason ?? 'unknown'}`,
      );
    }
    swaps += 1;
    for (const ev of swapRes.events) {
      if (ev.type === 'PUZZLE_COMPLETED') {
        completionEvents += 1;
      }
    }
  }

  return { swaps, completionEvents };
}

async function main() {
  const server = await createServer({
    logLevel: 'silent',
    server: { middlewareMode: true },
    appType: 'custom',
  });

  try {
    const core = await server.ssrLoadModule('/src/core/index.ts');
    const progMod = await server.ssrLoadModule('/src/game/progression/ProgressionController.ts');
    const saveMod = await server.ssrLoadModule('/src/services/persistence/SaveSerializer.ts');

    const catalog = core.getDefaultLevelCatalog();
    const catalogValidation = core.validateLevelCatalog(
      catalog.getAllLevels(),
      catalog.getAllChapters(),
    );
    if (!catalogValidation.valid) {
      throw new Error(`Catalog validation failed: ${catalogValidation.errors.join('; ')}`);
    }

    const levels = catalog.getAllLevels();
    if (levels.length !== 50) {
      throw new Error(`Expected 50 campaign levels, found ${String(levels.length)}`);
    }
    if (catalog.getLevelById('level-051') !== undefined) {
      throw new Error('Unexpected nonexistent level-051 found in catalog');
    }

    const progression = new progMod.ProgressionController(catalog);
    const seenIds = new Set();
    const seenPuzzles = new Set();
    const chapterCompletions = [];
    let campaignCompletedEvents = 0;

    const measureSaveSize = () => {
      const state = progression.getState();
      const saveData = {
        schemaVersion: core.CURRENT_SAVE_SCHEMA_VERSION,
        gameId: core.SAVE_GAME_ID,
        revision: 1,
        updatedAt: '2026-11-27T18:00:00.000Z',
        progression: {
          completedLevels: state.completedLevels,
          lastPlayedLevelId: state.lastPlayedLevelId,
        },
        settings: core.createDefaultGameSettings(),
        tutorial: { status: 'completed', completed: true },
      };
      const serialized = saveMod.serializeSaveData(saveData);
      return saveMod.measureUtf8ByteSize(serialized);
    };

    const freshSaveBytes = measureSaveSize();
    let midSaveBytes = 0;

    for (let i = 0; i < levels.length; i += 1) {
      const level = levels[i];
      const expectedNum = i + 1;

      if (level.levelNumber !== expectedNum) {
        throw new Error(
          `Level ordering mismatch at index ${String(i)}: got ${String(level.levelNumber)}`,
        );
      }
      if (seenIds.has(level.id)) {
        throw new Error(`Duplicate level ID: ${level.id}`);
      }
      seenIds.add(level.id);

      const viewBefore = progression.getLevelProgressView(level.id);
      if (!viewBefore || viewBefore.status === 'locked') {
        throw new Error(`Level ${level.id} is inaccessible when it should be unlocked`);
      }

      const puzzle = core.generateLevelPuzzle(level);
      const puzzleValidation = core.validatePuzzle(puzzle, core.toLevelPuzzleConfig(level));
      if (!puzzleValidation.valid) {
        throw new Error(`Level ${level.id} invalid puzzle: ${puzzleValidation.errors.join('; ')}`);
      }

      const sig = `${puzzle.startingSequence.join(',')}=>${puzzle.targetSequence.join(',')}`;
      if (seenPuzzles.has(sig)) {
        throw new Error(`Duplicate puzzle signature on ${level.id}`);
      }
      seenPuzzles.add(sig);

      const diag = core.inspectPuzzleDiagnostics(puzzle);
      const engine = new core.GameEngine(puzzle);
      engine.start();

      const { swaps, completionEvents } = solveWithOptimalSwaps(engine, puzzle.targetSequence);
      const finalState = engine.getPublicState();

      if (finalState.status !== 'completed') {
        throw new Error(`Level ${level.id} did not reach completed status`);
      }
      if (finalState.currentMatchCount !== puzzle.bottleCount) {
        throw new Error(`Level ${level.id} completed with wrong match count`);
      }
      if (completionEvents !== 1) {
        throw new Error(`Level ${level.id} emitted ${String(completionEvents)} completion events`);
      }
      if (swaps !== diag.minimumSwapDistance) {
        throw new Error(
          `Level ${level.id} optimal solver took ${String(swaps)} swaps vs minSwapDistance=${String(diag.minimumSwapDistance)}`,
        );
      }

      const beginAttempt = progression.beginCampaignAttempt(level.id);
      if (!beginAttempt.accepted) {
        throw new Error(`Unable to begin campaign attempt for ${level.id}`);
      }

      const scoringMeta = engine.getCompletedScoringMetadata();
      const attemptResult = core.createAttemptResult({
        attemptId: beginAttempt.attempt.attemptId,
        mode: 'campaign',
        levelId: level.id,
        puzzleId: puzzle.id,
        difficulty: level.difficulty,
        bottleCount: puzzle.bottleCount,
        actualMoves: swaps,
        minimumRequiredSwaps: scoringMeta.minimumRequiredSwaps,
        elapsedMs: 12_000 + expectedNum * 250,
      });

      const progResult = progression.completeActiveAttempt({
        attemptId: attemptResult.attemptId,
        levelId: level.id,
        moveCount: attemptResult.actualMoves,
        elapsedMs: attemptResult.elapsedMs,
        score: attemptResult.totalScore,
        starRating: attemptResult.starRating,
        scoringPolicyVersion: attemptResult.scoringPolicyVersion,
      });

      if (!progResult.accepted) {
        throw new Error(`Progression rejected ${level.id}: ${progResult.reason ?? 'unknown'}`);
      }

      for (const ev of progResult.events) {
        if (ev.type === 'CHAPTER_COMPLETED') {
          chapterCompletions.push(ev.chapterId);
        } else if (ev.type === 'CAMPAIGN_COMPLETED') {
          campaignCompletedEvents += 1;
        }
      }

      if (expectedNum < 50) {
        const nextLevelId = core.formatLevelId(expectedNum + 1);
        const nextView = progression.getLevelProgressView(nextLevelId);
        if (!nextView || nextView.status === 'locked') {
          throw new Error(`Completing ${level.id} failed to unlock ${nextLevelId}`);
        }
      }

      if (expectedNum === 25) {
        midSaveBytes = measureSaveSize();
      }
    }

    const fullSaveBytes = measureSaveSize();

    // Replay all 50 levels with faster time to confirm personal best records save cleanly
    for (let i = 0; i < levels.length; i += 1) {
      const level = levels[i];
      const puzzle = core.generateLevelPuzzle(level);
      const diag = core.inspectPuzzleDiagnostics(puzzle);
      const breakdown = core.calculateScoreBreakdown({
        difficulty: level.difficulty,
        actualMoves: diag.minimumSwapDistance,
        minimumRequiredSwaps: diag.minimumSwapDistance,
      });
      const replayBegin = progression.beginCampaignAttempt(level.id);
      if (replayBegin.accepted) {
        progression.completeActiveAttempt({
          attemptId: replayBegin.attempt.attemptId,
          levelId: level.id,
          moveCount: diag.minimumSwapDistance,
          elapsedMs: 8_000 + i * 100,
          score: breakdown.totalScore,
          starRating: 3,
          scoringPolicyVersion: breakdown.scoringPolicyVersion,
        });
      }
    }
    const fullWithBestRecordsSaveBytes = measureSaveSize();

    const campaignProgress = progression.getCampaignProgress();
    if (!campaignProgress.isComplete || campaignProgress.completedLevels !== 50) {
      throw new Error('Campaign did not report complete after Level 50');
    }
    if (campaignProgress.recommendedNextLevel.status !== 'campaign_completed') {
      throw new Error('Recommended next level after Level 50 was not campaign_completed');
    }
    if (chapterCompletions.length !== 6) {
      throw new Error(`Expected 6 chapter completions, got ${String(chapterCompletions.length)}`);
    }
    if (campaignCompletedEvents !== 1) {
      throw new Error(
        `Expected 1 campaign completion event, got ${String(campaignCompletedEvents)}`,
      );
    }

    console.log('=== Bottle Shuffle 50-Level Campaign Validation ===');
    console.log(`Levels validated & programmatically solved : 50/50`);
    console.log(`Unique puzzle signatures                   : ${String(seenPuzzles.size)}/50`);
    console.log(`Chapters completed                         : ${chapterCompletions.join(', ')}`);
    console.log(`Campaign completion events                 : ${String(campaignCompletedEvents)}`);
    console.log(`Nonexistent level-051 guard                : PASS`);
    console.log('--- Measured Serialized Save Payload Sizes (UTF-8) ---');
    console.log(`Fresh installation (0/50)                  : ${String(freshSaveBytes)} B`);
    console.log(`Mid campaign (25/50)                       : ${String(midSaveBytes)} B`);
    console.log(`Full campaign (50/50)                      : ${String(fullSaveBytes)} B`);
    console.log(
      `Full campaign + replayed bests (50/50)     : ${String(fullWithBestRecordsSaveBytes)} B`,
    );
    console.log('Campaign validation PASSED.');
  } finally {
    await server.close();
  }
}

void main();
