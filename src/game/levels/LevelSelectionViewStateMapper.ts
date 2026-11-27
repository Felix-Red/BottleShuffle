import {
  getChallengeModeDisplayName,
  getDifficultyDefinition,
  MAX_STARS_PER_LEVEL,
  type ChallengeMode,
  type ChapterId,
  type LevelDefinition,
  type LevelId,
} from '../../core';
import {
  CHALLENGE_MODE_LEVEL_DESCRIPTIONS,
  LEVEL_SELECTION_COPY,
} from '../../config/ChapterVisualConfig';
import { formatScoreNumber } from '../../config/VictoryConfig';
import { formatElapsedTime, formatTimeLimitShort } from '../../services/GameplayClock';
import type { ProgressionController } from '../progression/ProgressionController';
import type { ChapterViewState } from './ChapterViewState';
import type { LevelCardViewState } from './LevelCardViewState';
import type { LevelPreviewViewState, LevelSelectionViewState } from './LevelSelectionViewState';

export interface MapLevelSelectionViewStateInput {
  readonly progressionController: ProgressionController;
  readonly selectedChapterId: ChapterId | null;
  readonly selectedLevelId: LevelId | null;
  readonly focusedLevelIndex: number | null;
  readonly previewLevelId: LevelId | null;
  readonly pendingUnlockLevelIds: ReadonlySet<LevelId>;
  readonly canNavigate: boolean;
  readonly chapterCompletedBanner: string | null;
  readonly lockedFeedbackMessage: string | null;
  readonly errorMessage: string | null;
}

function formatBottleRangeLabel(minCount: number, maxCount: number): string {
  if (minCount === maxCount) {
    return `${String(minCount)} Bottles`;
  }
  return `${String(minCount)}–${String(maxCount)} Bottles`;
}

function formatLevelCardConstraintSummary(level: LevelDefinition): string {
  const parts: string[] = [`${String(level.bottleCount)}B`];
  if (level.timeLimitSeconds !== null) {
    parts.push(formatTimeLimitShort(level.timeLimitSeconds));
  }
  if (level.moveLimit !== null) {
    parts.push(`${String(level.moveLimit)}m`);
  }
  return parts.join(' · ');
}

function formatPreviewObjectiveSummary(
  mode: ChallengeMode,
  timeLimitSeconds: number | null,
  moveLimit: number | null,
): string {
  const modeLabel = getChallengeModeDisplayName(mode);
  if (mode === 'classic') {
    return `${modeLabel} · No timer or move limit`;
  }
  const restrictions: string[] = [];
  if (timeLimitSeconds !== null) {
    restrictions.push(`${formatTimeLimitShort(timeLimitSeconds)} timer`);
  }
  if (moveLimit !== null) {
    restrictions.push(`${String(moveLimit)} moves`);
  }
  return `${modeLabel} · ${restrictions.join(' · ')}`;
}

/**
 * Resolves the default chapter to open when no valid explicit chapter/level is requested:
 * - Recommended next level's chapter for new and returning players.
 * - Final chapter when the campaign is complete.
 */
export function resolveDefaultChapterId(progressionController: ProgressionController): ChapterId {
  const recommended = progressionController.getRecommendedNextLevel();
  if (recommended.status === 'available') {
    return recommended.level.chapterId;
  }
  return recommended.finalLevel.chapterId;
}

/**
 * Pure mapper deriving LevelSelectionViewState from authoritative ProgressionController + LevelCatalog.
 * Never unlocks levels, mutates progression, fabricates missing star data, or exposes hidden targets.
 */
export function mapLevelSelectionViewState(
  input: MapLevelSelectionViewStateInput,
): LevelSelectionViewState {
  const { progressionController } = input;
  const catalog = progressionController.getCatalog();
  const campaignProgress = progressionController.getCampaignProgress();
  const achievementSummary = progressionController.getCampaignAchievementSummary();
  const recommended = progressionController.getRecommendedNextLevel();
  const allChapters = catalog.getAllChapters();

  const recommendedLevelId: LevelId | null =
    recommended.status === 'available' ? recommended.level.id : null;
  const recommendedLevelNumber: number | null =
    recommended.status === 'available' ? recommended.level.levelNumber : null;
  const recommendedChapterId: ChapterId =
    recommended.status === 'available'
      ? recommended.level.chapterId
      : recommended.finalLevel.chapterId;

  const resolvedChapterId: ChapterId =
    input.selectedChapterId !== null &&
    catalog.getChapterById(input.selectedChapterId) !== undefined
      ? input.selectedChapterId
      : recommendedChapterId;

  const chapterViews: ChapterViewState[] = allChapters.map((chapter) => {
    const chapterProgress = progressionController.getChapterProgress(chapter.id);
    const chapterStars = progressionController.getChapterStarSummary(chapter.id);
    const levels = catalog.getLevelsByChapter(chapter.id);
    const difficultyDef = getDifficultyDefinition(chapter.difficulty);
    const isCurrentChapter = chapter.id === resolvedChapterId;

    let hasPlayableLevels = false;
    const levelCards: LevelCardViewState[] = levels.map((level, index) => {
      const status = progressionController.getLevelStatus(level.id);
      const isPlayable = status !== 'locked';
      if (isPlayable) {
        hasPlayableLevels = true;
      }
      const record = progressionController.getCompletionRecord(level.id);
      const prereqLevel =
        level.prerequisiteLevelId !== null
          ? catalog.getLevelById(level.prerequisiteLevelId)
          : undefined;

      return Object.freeze({
        levelId: level.id,
        levelNumber: level.levelNumber,
        bottleCount: level.bottleCount,
        challengeMode: level.challengeMode,
        timeLimitSeconds: level.timeLimitSeconds,
        moveLimit: level.moveLimit,
        constraintSummary: formatLevelCardConstraintSummary(level),
        status,
        isPlayable,
        isRecommended: recommendedLevelId === level.id,
        isSelected: input.selectedLevelId === level.id,
        isFocused: isCurrentChapter && input.focusedLevelIndex === index,
        completionCount: record?.completionCount ?? 0,
        bestMoveCount: record?.bestMoveCount ?? null,
        bestElapsedMs: record?.bestElapsedMs ?? null,
        bestStarRating: record?.bestStarRating ?? null,
        bestScore: record?.bestScore ?? null,
        prerequisiteLevelNumber: prereqLevel?.levelNumber ?? null,
        shouldAnimateUnlock: isPlayable && input.pendingUnlockLevelIds.has(level.id),
      });
    });

    const totalLevels = chapterProgress?.totalLevels ?? levels.length;
    const completedLevels = chapterProgress?.completedLevels ?? 0;
    const completionPercentage = chapterProgress?.completionPercentage ?? 0;
    const isCompleted = chapterProgress?.isComplete ?? false;

    return Object.freeze({
      chapterId: chapter.id,
      chapterNumber: chapter.order,
      displayName: chapter.displayName,
      description: chapter.description ?? CHALLENGE_MODE_LEVEL_DESCRIPTIONS[chapter.challengeMode],
      difficulty: chapter.difficulty,
      difficultyDisplayName: difficultyDef.displayName,
      bottleCount: chapter.bottleCount,
      minBottleCount: chapter.minBottleCount,
      maxBottleCount: chapter.maxBottleCount,
      bottleRangeLabel: formatBottleRangeLabel(chapter.minBottleCount, chapter.maxBottleCount),
      challengeMode: chapter.challengeMode,
      challengeModeLabel: getChallengeModeDisplayName(chapter.challengeMode),
      totalLevels,
      completedLevels,
      earnedStars: chapterStars?.earnedStars ?? 0,
      maxStars: chapterStars?.maxStars ?? totalLevels * MAX_STARS_PER_LEVEL,
      completionPercentage,
      hasPlayableLevels,
      isLocked: !hasPlayableLevels,
      isCompleted,
      isRecommendedChapter: chapter.id === recommendedChapterId,
      levelCards: Object.freeze(levelCards),
    });
  });

  const selectedChapterIndex = Math.max(
    0,
    chapterViews.findIndex((c) => c.chapterId === resolvedChapterId),
  );
  const currentChapter = chapterViews[selectedChapterIndex];
  if (currentChapter === undefined) {
    throw new Error('LevelSelectionViewStateMapper invariant violated: no chapters in catalogue.');
  }

  let previewLevel: LevelPreviewViewState | null = null;
  if (input.previewLevelId !== null) {
    const levelDef = catalog.getLevelById(input.previewLevelId);
    if (levelDef !== undefined) {
      const status = progressionController.getLevelStatus(levelDef.id);
      if (status !== 'locked') {
        const chapterDef = catalog.getChapterById(levelDef.chapterId);
        const difficultyDef = getDifficultyDefinition(levelDef.difficulty);
        const record = progressionController.getCompletionRecord(levelDef.id);
        const isCompleted = status === 'completed';

        previewLevel = Object.freeze({
          levelId: levelDef.id,
          levelNumber: levelDef.levelNumber,
          chapterId: levelDef.chapterId,
          chapterNumber: chapterDef?.order ?? 1,
          chapterName: chapterDef?.displayName ?? levelDef.chapterId,
          difficulty: levelDef.difficulty,
          difficultyDisplayName: difficultyDef.displayName,
          bottleCount: levelDef.bottleCount,
          challengeMode: levelDef.challengeMode,
          challengeModeLabel: getChallengeModeDisplayName(levelDef.challengeMode),
          timeLimitSeconds: levelDef.timeLimitSeconds,
          formattedTimeLimit:
            levelDef.timeLimitSeconds !== null
              ? formatTimeLimitShort(levelDef.timeLimitSeconds)
              : null,
          moveLimit: levelDef.moveLimit,
          objectiveSummary: formatPreviewObjectiveSummary(
            levelDef.challengeMode,
            levelDef.timeLimitSeconds,
            levelDef.moveLimit,
          ),
          description: CHALLENGE_MODE_LEVEL_DESCRIPTIONS[levelDef.challengeMode],
          status,
          isCompleted,
          completionCount: record?.completionCount ?? 0,
          bestMoveCount: record?.bestMoveCount ?? null,
          bestElapsedMs: record?.bestElapsedMs ?? null,
          bestStarRating: record?.bestStarRating ?? null,
          bestScore: record?.bestScore ?? null,
          formattedBestScore:
            record?.bestScore !== undefined ? formatScoreNumber(record.bestScore) : null,
          formattedBestTime: record !== null ? formatElapsedTime(record.bestElapsedMs) : null,
          primaryActionLabel: isCompleted
            ? LEVEL_SELECTION_COPY.replayLevelButton
            : LEVEL_SELECTION_COPY.playLevelButton,
        });
      }
    }
  }

  return Object.freeze({
    totalCampaignLevels: campaignProgress.totalLevels,
    completedCampaignLevels: campaignProgress.completedLevels,
    totalEarnedStars: achievementSummary.totalEarnedStars,
    maxAvailableStars: achievementSummary.maxAvailableStars,
    totalBestScore: achievementSummary.totalBestScore,
    campaignCompletionPercentage: campaignProgress.completionPercentage,
    isCampaignComplete: campaignProgress.isComplete,
    chapters: Object.freeze(chapterViews),
    selectedChapterId: currentChapter.chapterId,
    selectedChapterIndex,
    totalChapters: chapterViews.length,
    recommendedLevelId,
    recommendedLevelNumber,
    recommendedChapterId,
    canGoPreviousChapter: selectedChapterIndex > 0,
    canGoNextChapter: selectedChapterIndex < chapterViews.length - 1,
    currentChapter,
    levelCards: currentChapter.levelCards,
    selectedLevelId: input.selectedLevelId,
    focusedLevelIndex: input.focusedLevelIndex,
    previewLevel,
    canNavigate: input.canNavigate,
    chapterCompletedBanner: input.chapterCompletedBanner,
    lockedFeedbackMessage: input.lockedFeedbackMessage,
    errorMessage: input.errorMessage,
  });
}
