import {
  comparePersonalBest,
  createAttemptResult,
  type CampaignAchievementSummary,
  type ChapterStarSummary,
  type LevelCatalog,
  type ProgressionEvent,
} from '../../core';
import type { DevVictoryPreviewKind } from '../gameplay/GameplaySceneData';
import type { VictoryViewState } from './VictoryViewState';
import { mapVictoryViewState } from './VictoryViewStateMapper';

/**
 * Development-only helper producing realistic, formula-accurate VictoryViewStates
 * for headless visual verification across all victory presets. Dynamically imported
 * under `import.meta.env.DEV` so production bundles exclude it completely.
 */
export function buildDevVictoryPreview(
  preset: DevVictoryPreviewKind,
  catalog: LevelCatalog,
): VictoryViewState {
  const totalLevels = catalog.getTotalLevelCount();
  const maxAvailableStars = totalLevels * 3;

  switch (preset) {
    case '3star': {
      const level = catalog.getLevelByNumber(12) ?? catalog.getAllLevels()[0];
      const levelId = level?.id ?? 'level-012';
      const levelNumber = level?.levelNumber ?? 12;
      const attemptResult = createAttemptResult({
        attemptId: 'dev-preview-3star',
        puzzleId: 'dev-puzzle-3star',
        mode: 'campaign',
        levelId,
        difficulty: level?.difficulty ?? 'normal',
        bottleCount: level?.bottleCount ?? 6,
        actualMoves: 4,
        minimumRequiredSwaps: 4,
        elapsedMs: 18400,
      });
      const personalBest = comparePersonalBest(
        {
          levelId,
          bestMoveCount: 6,
          bestElapsedMs: 24500,
          completionCount: 1,
          bestScore: 1000,
          bestStarRating: 2,
          scoringPolicyVersion: 1,
        },
        {
          score: attemptResult.totalScore,
          starRating: attemptResult.starRating,
          moveCount: attemptResult.actualMoves,
          elapsedMs: attemptResult.elapsedMs,
        },
      );
      const events: ProgressionEvent[] = [
        {
          type: 'LEVEL_UNLOCKED',
          levelId: 'level-013',
          levelNumber: 13,
          unlockedByLevelId: levelId,
        },
      ];
      return mapVictoryViewState({
        attemptResult,
        headerTitle: `Level ${String(levelNumber)}`,
        levelNumber,
        chapterId: level?.chapterId ?? 'normal',
        nextLevelId: 'level-013',
        nextLevelNumber: 13,
        progressionEvents: events,
        personalBest,
        campaignSummary: null,
        chapterStarSummary: null,
        catalog,
      });
    }

    case '2star': {
      const level = catalog.getLevelByNumber(8) ?? catalog.getAllLevels()[0];
      const levelId = level?.id ?? 'level-008';
      const levelNumber = level?.levelNumber ?? 8;
      const attemptResult = createAttemptResult({
        attemptId: 'dev-preview-2star',
        puzzleId: 'dev-puzzle-2star',
        mode: 'campaign',
        levelId,
        difficulty: level?.difficulty ?? 'easy',
        bottleCount: level?.bottleCount ?? 5,
        actualMoves: 6,
        minimumRequiredSwaps: 4,
        elapsedMs: 31200,
      });
      const personalBest = comparePersonalBest(null, {
        score: attemptResult.totalScore,
        starRating: attemptResult.starRating,
        moveCount: attemptResult.actualMoves,
        elapsedMs: attemptResult.elapsedMs,
      });
      const events: ProgressionEvent[] = [
        {
          type: 'LEVEL_UNLOCKED',
          levelId: 'level-009',
          levelNumber: 9,
          unlockedByLevelId: levelId,
        },
      ];
      return mapVictoryViewState({
        attemptResult,
        headerTitle: `Level ${String(levelNumber)}`,
        levelNumber,
        chapterId: level?.chapterId ?? 'easy',
        nextLevelId: 'level-009',
        nextLevelNumber: 9,
        progressionEvents: events,
        personalBest,
        campaignSummary: null,
        chapterStarSummary: null,
        catalog,
      });
    }

    case '1star': {
      const level = catalog.getLevelByNumber(22) ?? catalog.getAllLevels()[0];
      const levelId = level?.id ?? 'level-022';
      const levelNumber = level?.levelNumber ?? 22;
      const attemptResult = createAttemptResult({
        attemptId: 'dev-preview-1star',
        puzzleId: 'dev-puzzle-1star',
        mode: 'campaign',
        levelId,
        difficulty: level?.difficulty ?? 'intermediate',
        bottleCount: level?.bottleCount ?? 7,
        actualMoves: 13,
        minimumRequiredSwaps: 5,
        elapsedMs: 68400,
      });
      const personalBest = comparePersonalBest(
        {
          levelId,
          bestMoveCount: 7,
          bestElapsedMs: 41000,
          completionCount: 2,
          bestScore: 1429,
          bestStarRating: 2,
          scoringPolicyVersion: 1,
        },
        {
          score: attemptResult.totalScore,
          starRating: attemptResult.starRating,
          moveCount: attemptResult.actualMoves,
          elapsedMs: attemptResult.elapsedMs,
        },
      );
      return mapVictoryViewState({
        attemptResult,
        headerTitle: `Level ${String(levelNumber)}`,
        levelNumber,
        chapterId: level?.chapterId ?? 'intermediate',
        nextLevelId: 'level-023',
        nextLevelNumber: 23,
        progressionEvents: [],
        personalBest,
        campaignSummary: null,
        chapterStarSummary: null,
        catalog,
      });
    }

    case 'practice': {
      const attemptResult = createAttemptResult({
        attemptId: 'dev-preview-practice',
        puzzleId: 'dev-puzzle-practice',
        mode: 'practice',
        levelId: null,
        difficulty: 'hard',
        bottleCount: 8,
        actualMoves: 6,
        minimumRequiredSwaps: 5,
        elapsedMs: 42800,
      });
      return mapVictoryViewState({
        attemptResult,
        headerTitle: 'Hard Practice',
        levelNumber: null,
        chapterId: null,
        nextLevelId: null,
        nextLevelNumber: null,
        progressionEvents: [],
        personalBest: null,
        campaignSummary: null,
        chapterStarSummary: null,
        catalog,
      });
    }

    case 'chapter': {
      const chapter = catalog.getChapterById('chapter-01') ?? catalog.getAllChapters()[0];
      const chapterLevels = chapter !== undefined ? catalog.getLevelsByChapter(chapter.id) : [];
      const finalLevel = chapterLevels[chapterLevels.length - 1] ?? catalog.getAllLevels()[0];
      const levelId = finalLevel?.id ?? 'level-005';
      const levelNumber = finalLevel?.levelNumber ?? 5;
      const attemptResult = createAttemptResult({
        attemptId: 'dev-preview-chapter',
        puzzleId: 'dev-puzzle-chapter',
        mode: 'campaign',
        levelId,
        difficulty: finalLevel?.difficulty ?? 'beginner',
        bottleCount: finalLevel?.bottleCount ?? 4,
        actualMoves: 3,
        minimumRequiredSwaps: 3,
        elapsedMs: 14200,
      });
      const personalBest = comparePersonalBest(null, {
        score: attemptResult.totalScore,
        starRating: attemptResult.starRating,
        moveCount: attemptResult.actualMoves,
        elapsedMs: attemptResult.elapsedMs,
      });
      const chapterStarSummary: ChapterStarSummary = {
        chapterId: chapter?.id ?? 'chapter-01',
        earnedStars: Math.max(0, chapterLevels.length * 3 - 1),
        maxStars: chapterLevels.length * 3,
        totalBestScore: 4850,
      };
      const events: ProgressionEvent[] = [
        {
          type: 'LEVEL_UNLOCKED',
          levelId: 'level-006',
          levelNumber: 6,
          unlockedByLevelId: levelId,
        },
        {
          type: 'CHAPTER_COMPLETED',
          chapterId: chapter?.id ?? 'chapter-01',
          chapterName: chapter?.displayName ?? 'Chapter 1: Beginner',
        },
      ];
      return mapVictoryViewState({
        attemptResult,
        headerTitle: `Level ${String(levelNumber)}`,
        levelNumber,
        chapterId: chapter?.id ?? 'chapter-01',
        nextLevelId: 'level-006',
        nextLevelNumber: 6,
        progressionEvents: events,
        personalBest,
        campaignSummary: null,
        chapterStarSummary,
        catalog,
      });
    }

    case 'campaign': {
      const allLevels = catalog.getAllLevels();
      const finalLevel = allLevels[allLevels.length - 1];
      const levelId = finalLevel?.id ?? 'level-050';
      const levelNumber = finalLevel?.levelNumber ?? totalLevels;
      const attemptResult = createAttemptResult({
        attemptId: 'dev-preview-campaign',
        puzzleId: 'dev-puzzle-campaign',
        mode: 'campaign',
        levelId,
        difficulty: finalLevel?.difficulty ?? 'expert',
        bottleCount: finalLevel?.bottleCount ?? 10,
        actualMoves: 7,
        minimumRequiredSwaps: 7,
        elapsedMs: 52100,
      });
      const personalBest = comparePersonalBest(null, {
        score: attemptResult.totalScore,
        starRating: attemptResult.starRating,
        moveCount: attemptResult.actualMoves,
        elapsedMs: attemptResult.elapsedMs,
      });
      const campaignSummary: CampaignAchievementSummary = {
        totalLevels,
        completedLevels: totalLevels,
        totalEarnedStars: maxAvailableStars,
        maxAvailableStars,
        totalBestScore: 98750,
        threeStarCount: totalLevels,
        twoStarCount: 0,
        oneStarCount: 0,
        isCampaignComplete: true,
        isPerfectCampaign: true,
      };
      const events: ProgressionEvent[] = [
        {
          type: 'CAMPAIGN_COMPLETED',
          totalLevels,
        },
      ];
      return mapVictoryViewState({
        attemptResult,
        headerTitle: `Level ${String(levelNumber)}`,
        levelNumber,
        chapterId: finalLevel?.chapterId ?? 'expert',
        nextLevelId: null,
        nextLevelNumber: null,
        progressionEvents: events,
        personalBest,
        campaignSummary,
        chapterStarSummary: null,
        catalog,
      });
    }
  }
}
