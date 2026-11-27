import { createServer } from 'vite';

/**
 * Test-only optimal swap solver using target index lookup (validates mathematical solvability).
 * Strictly confined to scripts/ and never bundled into production.
 */
function solveWithOptimalSwaps(engine, targetSequence) {
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
      throw new Error(
        `Failed selecting slot ${String(firstMismatch)}: ${sel.rejectionReason ?? 'unknown'}`,
      );
    }
    const swapRes = engine.selectBottle(sourceIdx);
    if (!swapRes.accepted) {
      throw new Error(
        `Failed swapping ${String(firstMismatch)}<->${String(sourceIdx)}: ${swapRes.rejectionReason ?? 'unknown'}`,
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

/**
 * Blind hidden-sequence deduction simulator.
 * NEVER reads `targetSequence` — interacts ONLY through PublicGameState.currentMatchCount
 * using systematic human-like exploratory pair probing and match locking.
 */
function simulateBlindHumanDeduction(engine) {
  const n = engine.getPublicState().totalBottleCount;
  const locked = new Set();
  const maxSafetySwaps = n * n + 20;

  const doSwap = (a, b) => {
    const before = engine.getPublicState().currentMatchCount;
    const res = engine.swapBottles(a, b);
    if (!res.accepted) {
      return { accepted: false, delta: 0, status: engine.getPublicState().status };
    }
    const after = res.publicState.currentMatchCount;
    return { accepted: true, delta: after - before, status: res.publicState.status };
  };

  while (
    engine.getPublicState().status === 'playing' &&
    engine.getPublicState().moveCount < maxSafetySwaps
  ) {
    const unlocked = [];
    for (let i = 0; i < n; i += 1) {
      if (!locked.has(i)) unlocked.push(i);
    }
    if (unlocked.length <= 1) break;

    if (unlocked.length === 2) {
      doSwap(unlocked[0], unlocked[1]);
      break;
    }

    const pivot = unlocked[0];
    let pivotResolved = false;

    for (
      let idx = 1;
      idx < unlocked.length && engine.getPublicState().status === 'playing';
      idx += 1
    ) {
      const partner = unlocked[idx];
      const probe = doSwap(pivot, partner);
      if (!probe.accepted || probe.status !== 'playing') {
        pivotResolved = true;
        break;
      }

      if (probe.delta === 2) {
        // Both pivot and partner landed directly in their target slots
        locked.add(pivot);
        locked.add(partner);
        pivotResolved = true;
        break;
      }

      if (probe.delta === -2) {
        // Both pivot and partner were already in their target slots! Undo and lock both.
        doSwap(pivot, partner);
        locked.add(pivot);
        locked.add(partner);
        pivotResolved = true;
        break;
      }

      if (probe.delta === 1) {
        // Either pivot or partner is now correct. Keep this improvement and probe a 3rd slot to verify pivot if needed.
        const remainingPartners = unlocked.filter((u) => u !== pivot && u !== partner);
        if (remainingPartners.length > 0 && engine.getPublicState().status === 'playing') {
          const third = remainingPartners[0];
          const verify = doSwap(pivot, third);
          if (!verify.accepted || verify.status !== 'playing') {
            pivotResolved = true;
            break;
          }
          if (verify.delta === -1) {
            // Moving pivot broke its match (and didn't create a new one) -> pivot was right; undo & lock pivot
            doSwap(pivot, third);
            locked.add(pivot);
            pivotResolved = true;
            break;
          }
          if (verify.delta === -2) {
            // Both pivot and third were right -> undo & lock both
            doSwap(pivot, third);
            locked.add(pivot);
            locked.add(third);
            pivotResolved = true;
            break;
          }
          if (verify.delta === 2) {
            locked.add(pivot);
            locked.add(third);
            pivotResolved = true;
            break;
          }
          if (verify.delta === 0) {
            // Undo test swap; partner was the match we gained earlier!
            doSwap(pivot, third);
            locked.add(partner);
            pivotResolved = true;
            break;
          }
          // verify.delta === 1 -> keep gaining matches, restart loop cleanly
          pivotResolved = true;
          break;
        }
        pivotResolved = true;
        break;
      }

      if (probe.delta === -1) {
        // One of pivot or partner was already correct! Undo the swap first.
        const undo = doSwap(pivot, partner);
        if (!undo.accepted || undo.status !== 'playing') {
          pivotResolved = true;
          break;
        }
        // Check whether pivot was the correct one by testing with a third unlocked slot
        const third = unlocked.find((u) => u !== pivot && u !== partner);
        if (third !== undefined && engine.getPublicState().status === 'playing') {
          const check = doSwap(pivot, third);
          if (!check.accepted || check.status !== 'playing') {
            pivotResolved = true;
            break;
          }
          if (check.delta === -1 || check.delta === -2) {
            doSwap(pivot, third);
            locked.add(pivot);
            if (check.delta === -2) locked.add(third);
            pivotResolved = true;
            break;
          }
          if (check.delta === 2) {
            locked.add(pivot);
            locked.add(third);
            pivotResolved = true;
            break;
          }
          if (check.delta === 0) {
            // Pivot wasn't matched, so partner MUST have been the matched slot!
            doSwap(pivot, third);
            locked.add(partner);
            pivotResolved = true;
            break;
          }
          // check.delta === 1 -> we improved! restart loop cleanly
          pivotResolved = true;
          break;
        }
      }
      if (probe.delta === 0) {
        // Neither slot matched before or after; undo so we keep exploring cleanly from a known baseline
        doSwap(pivot, partner);
      }
    }

    if (!pivotResolved) {
      // No partner with unlocked[0] gave a direct hit; perform one deterministic rotation among unlocked slots
      const rotated = doSwap(unlocked[0], unlocked[unlocked.length - 1]);
      if (!rotated.accepted || rotated.status !== 'playing') {
        break;
      }
      if (rotated.delta === -2) {
        doSwap(unlocked[0], unlocked[unlocked.length - 1]);
        locked.add(unlocked[0]);
        locked.add(unlocked[unlocked.length - 1]);
      } else if (rotated.delta === 2) {
        locked.add(unlocked[0]);
        locked.add(unlocked[unlocked.length - 1]);
      } else if (rotated.delta === -1) {
        doSwap(unlocked[0], unlocked[unlocked.length - 1]);
        // Rotate last two unlocked slots instead to escape local plateau
        if (unlocked.length >= 3) {
          doSwap(unlocked[1], unlocked[2]);
        }
      }
    }
  }

  const finalPub = engine.getPublicState();
  return {
    solved: finalPub.status === 'completed',
    moves: finalPub.moveCount,
    status: finalPub.status,
  };
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
    const seenConfigSignatures = new Set();
    const chapterCompletions = [];
    let campaignCompletedEvents = 0;

    const measureSaveSize = () => {
      const state = progression.getState();
      const saveData = core.freezeSaveData({
        schemaVersion: core.CURRENT_SAVE_SCHEMA_VERSION,
        gameId: core.SAVE_GAME_ID,
        campaignCatalogVersion: core.CURRENT_CAMPAIGN_CATALOG_VERSION,
        revision: 1,
        updatedAt: '2026-11-27T18:00:00.000Z',
        progression: {
          completedLevels: state.completedLevels,
          lastPlayedLevelId: state.lastPlayedLevelId,
        },
        settings: core.createDefaultGameSettings(),
        tutorial: { status: 'completed', completed: true },
        seenChallengeIntros: ['timed', 'limited_moves', 'combined'],
      });
      const serialized = saveMod.serializeSaveData(saveData);
      return saveMod.measureUtf8ByteSize(serialized);
    };

    const freshSaveBytes = measureSaveSize();
    let midSaveBytes = 0;
    const balanceRows = [];
    let blindFailuresUnderLimit = 0;

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

      // Verify Chapter 6 has zero repeated challenge configurations
      if (level.chapterId === 'chapter-06') {
        const cfgSig = `${level.challengeMode}:${String(level.bottleCount)}:${String(level.timeLimitSeconds)}:${String(level.moveLimit)}`;
        if (seenConfigSignatures.has(cfgSig)) {
          throw new Error(`Duplicate Chapter 6 configuration on ${level.id}: ${cfgSig}`);
        }
        seenConfigSignatures.add(cfgSig);
      }

      const viewBefore = progression.getLevelProgressView(level.id);
      if (!viewBefore || viewBefore.status === 'locked') {
        throw new Error(`Level ${level.id} is inaccessible when it should be unlocked`);
      }

      const puzzle = core.generateLevelPuzzle(level);
      const puzzleValidation = core.validatePuzzle(puzzle, core.toLevelPuzzleConfig(level));
      if (!puzzleValidation.valid) {
        throw new Error(`Level ${level.id} invalid puzzle: ${puzzleValidation.message}`);
      }

      const sig = `${puzzle.startingSequence.join(',')}=>${puzzle.targetSequence.join(',')}`;
      if (seenPuzzles.has(sig)) {
        throw new Error(`Duplicate puzzle signature on ${level.id}`);
      }
      seenPuzzles.add(sig);

      const diag = core.inspectPuzzleDiagnostics(puzzle);
      const objective = core.toLevelChallengeObjective(level);

      // 1. Mathematical optimal solvability under the level's exact challenge objective
      const engine = new core.GameEngine(puzzle, objective);
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

      // 2. Blind hidden-sequence deduction simulation (zero access to targetSequence)
      const blindEngine = new core.GameEngine(puzzle); // unconstrained to measure raw deduction swaps
      blindEngine.start();
      const blindResult = simulateBlindHumanDeduction(blindEngine);
      const withinMoveBudget =
        level.moveLimit === null
          ? true
          : blindResult.solved && blindResult.moves <= level.moveLimit;
      const estimatedSecondsAt3sPerSwap = Math.round(blindResult.moves * 3.0);
      const withinTimeBudget =
        level.timeLimitSeconds === null
          ? true
          : estimatedSecondsAt3sPerSwap <= level.timeLimitSeconds;

      if (!withinMoveBudget) {
        blindFailuresUnderLimit += 1;
      }

      balanceRows.push({
        level: level.levelNumber,
        chapter: level.chapterId,
        mode: level.challengeMode,
        bottles: level.bottleCount,
        minSwaps: diag.minimumSwapDistance,
        blindSwaps: blindResult.moves,
        moveLimit: level.moveLimit ?? '-',
        timeLimit: level.timeLimitSeconds !== null ? `${String(level.timeLimitSeconds)}s` : '-',
        est3s: `${String(estimatedSecondsAt3sPerSwap)}s`,
        moveOk: withinMoveBudget ? 'OK' : 'TIGHT',
        timeOk: withinTimeBudget ? 'OK' : 'TIGHT',
      });

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
        throw new Error(
          `Progression rejected ${level.id}: ${progResult.rejectionReason ?? 'unknown'}`,
        );
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

    console.log('=== Bottle Shuffle 50-Level Redesigned Campaign Validation (v2.0.0) ===');
    console.log('Levels validated & mathematically solved   : 50/50');
    console.log(`Unique puzzle signatures                   : ${String(seenPuzzles.size)}/50`);
    console.log(
      `Unique Chapter 6 challenge configs         : ${String(seenConfigSignatures.size)}/10`,
    );
    console.log(`Chapters completed                         : ${chapterCompletions.join(', ')}`);
    console.log(`Campaign completion events                 : ${String(campaignCompletedEvents)}`);
    console.log(
      `Blind-deduction heuristic tight move flags : ${String(blindFailuresUnderLimit)}/50`,
    );
    console.log('--- Measured Serialized Save Payload Sizes (UTF-8, Schema v2) ---');
    console.log(`Fresh installation (0/50)                  : ${String(freshSaveBytes)} B`);
    console.log(`Mid campaign (25/50)                       : ${String(midSaveBytes)} B`);
    console.log(`Full campaign (50/50)                      : ${String(fullSaveBytes)} B`);
    console.log(
      `Full campaign + replayed bests (50/50)     : ${String(fullWithBestRecordsSaveBytes)} B`,
    );

    if (process.argv.includes('--print-balance')) {
      console.table(balanceRows);
    }

    if (process.argv.includes('--print-golden')) {
      const sampleIds = [
        'level-001',
        'level-008',
        'level-009',
        'level-017',
        'level-025',
        'level-033',
        'level-041',
        'level-050',
      ];
      const golden = sampleIds.map((id) => {
        const lvl = catalog.getLevelById(id);
        const p = core.generateLevelPuzzle(lvl);
        return {
          levelId: id,
          seed: lvl.seed,
          starting: p.startingSequence,
          target: p.targetSequence,
        };
      });
      console.log(JSON.stringify(golden, null, 2));
    }

    console.log('Campaign validation PASSED.');
  } finally {
    await server.close();
  }
}

void main();
