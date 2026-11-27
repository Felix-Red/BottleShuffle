import { describe, expect, it } from 'vitest';
import {
  buildCatalogFromChapterSpecs,
  DEFAULT_CHAPTER_SPECS,
  formatLevelId,
} from '../../../src/core';
import { getChapterVisualTheme } from '../../../src/config/ChapterVisualConfig';
import {
  mapLevelSelectionViewState,
  resolveDefaultChapterId,
} from '../../../src/game/levels/LevelSelectionViewStateMapper';
import { ProgressionController } from '../../../src/game/progression/ProgressionController';

function completeLevelsUpTo(controller: ProgressionController, count: number): void {
  for (let n = 1; n <= count; n += 1) {
    const levelId = formatLevelId(n);
    const started = controller.beginCampaignAttempt(levelId);
    if (started.accepted) {
      controller.completeActiveAttempt({
        attemptId: started.attempt.attemptId,
        levelId,
        moveCount: 4 + (n % 3),
        elapsedMs: 10000 + n * 1000,
      });
    }
  }
}

describe('LevelSelectionViewStateMapper', () => {
  it('maps new, returning, and completed players accurately and exposes zero hidden puzzle data', () => {
    const progression = new ProgressionController();

    // New player opens Chapter 1 with Level 1 unlocked & recommended, Levels 2-5 locked
    const newState = mapLevelSelectionViewState({
      progressionController: progression,
      selectedChapterId: null,
      selectedLevelId: null,
      focusedLevelIndex: null,
      previewLevelId: 'level-001',
      pendingUnlockLevelIds: new Set(),
      canNavigate: true,
      chapterCompletedBanner: null,
      lockedFeedbackMessage: null,
      errorMessage: null,
    });

    expect(newState.selectedChapterId).toBe('chapter-01');
    expect(newState.recommendedChapterId).toBe('chapter-01');
    expect(newState.recommendedLevelId).toBe('level-001');
    expect(newState.completedCampaignLevels).toBe(0);
    expect(newState.totalCampaignLevels).toBe(50);
    expect(newState.canGoPreviousChapter).toBe(false);
    expect(newState.canGoNextChapter).toBe(true);
    expect(newState.levelCards).toHaveLength(5);
    expect(newState.levelCards[0]?.status).toBe('unlocked');
    expect(newState.levelCards[0]?.isRecommended).toBe(true);
    expect(newState.levelCards[1]?.status).toBe('locked');
    expect(newState.levelCards[1]?.prerequisiteLevelNumber).toBe(1);
    expect(newState.previewLevel?.levelId).toBe('level-001');
    expect(newState.previewLevel?.isCompleted).toBe(false);
    expect(newState.previewLevel?.bestMoveCount).toBeNull();
    expect(newState.previewLevel?.formattedBestTime).toBeNull();

    // Verify zero hidden target sequence, seed, or swap-distance fields leak into public view states
    const serialized = JSON.stringify(newState);
    expect(serialized).not.toContain('targetSequence');
    expect(serialized).not.toContain('minimumSwapDistance');
    expect(serialized).not.toContain('seed');

    // Returning player (7 completed -> Chapter 2, Level 8)
    completeLevelsUpTo(progression, 7);
    expect(resolveDefaultChapterId(progression)).toBe('chapter-02');
    const returningState = mapLevelSelectionViewState({
      progressionController: progression,
      selectedChapterId: null,
      selectedLevelId: 'level-007',
      focusedLevelIndex: null,
      previewLevelId: 'level-007',
      pendingUnlockLevelIds: new Set(['level-008']),
      canNavigate: true,
      chapterCompletedBanner: null,
      lockedFeedbackMessage: null,
      errorMessage: null,
    });

    expect(returningState.selectedChapterId).toBe('chapter-02');
    expect(returningState.recommendedLevelId).toBe('level-008');
    expect(returningState.currentChapter.completedLevels).toBe(2);
    expect(returningState.currentChapter.totalLevels).toBe(5);
    expect(returningState.chapters[0]?.isCompleted).toBe(true);
    expect(returningState.chapters[2]?.isLocked).toBe(true);
    expect(returningState.levelCards[2]?.shouldAnimateUnlock).toBe(true);
    expect(returningState.previewLevel?.isCompleted).toBe(true);
    expect(returningState.previewLevel?.bestMoveCount).toBe(5);
    expect(returningState.previewLevel?.formattedBestTime).toBe('00:17');
    expect(returningState.previewLevel?.primaryActionLabel).toBe('Replay Level');

    // Check 20 completed -> Chapter 4 Level 21, and 40 completed -> Chapter 6 Level 41
    completeLevelsUpTo(progression, 20);
    expect(resolveDefaultChapterId(progression)).toBe('chapter-04');
    completeLevelsUpTo(progression, 40);
    expect(resolveDefaultChapterId(progression)).toBe('chapter-06');

    // Campaign complete -> opens final chapter, no nonexistent next level recommended
    completeLevelsUpTo(progression, 50);
    const completeState = mapLevelSelectionViewState({
      progressionController: progression,
      selectedChapterId: null,
      selectedLevelId: null,
      focusedLevelIndex: null,
      previewLevelId: null,
      pendingUnlockLevelIds: new Set(),
      canNavigate: true,
      chapterCompletedBanner: null,
      lockedFeedbackMessage: null,
      errorMessage: null,
    });

    expect(completeState.isCampaignComplete).toBe(true);
    expect(completeState.selectedChapterId).toBe('chapter-06');
    expect(completeState.recommendedLevelId).toBeNull();
    expect(completeState.completedCampaignLevels).toBe(50);
    expect(completeState.campaignCompletionPercentage).toBe(100);
    expect(completeState.canGoNextChapter).toBe(false);
    expect(completeState.canGoPreviousChapter).toBe(true);
  });

  it('supports expanded catalogues beyond 6 chapters with deterministic fallback visual themes', () => {
    const extendedSpecs = [
      ...DEFAULT_CHAPTER_SPECS,
      {
        id: 'chapter-07',
        displayName: 'Grandmaster',
        order: 7,
        difficulty: 'expert' as const,
        bottleCount: 10,
        startLevelNumber: 51,
        levelCount: 10,
        minInitialMatches: 0,
        maxInitialMatches: 4,
        minRequiredSwaps: 4,
      },
    ];
    const catalog = buildCatalogFromChapterSpecs(extendedSpecs);
    const progression = new ProgressionController(catalog);

    const view = mapLevelSelectionViewState({
      progressionController: progression,
      selectedChapterId: 'chapter-07',
      selectedLevelId: null,
      focusedLevelIndex: null,
      previewLevelId: null,
      pendingUnlockLevelIds: new Set(),
      canNavigate: true,
      chapterCompletedBanner: null,
      lockedFeedbackMessage: null,
      errorMessage: null,
    });

    expect(view.totalCampaignLevels).toBe(60);
    expect(view.totalChapters).toBe(7);
    expect(view.currentChapter.chapterId).toBe('chapter-07');
    expect(view.currentChapter.isLocked).toBe(true);
    expect(view.levelCards).toHaveLength(10);

    const visual = getChapterVisualTheme('chapter-07', 10, 7);
    expect(visual.accentHex).toMatch(/^#[0-9A-F]{6}$/i);
    expect(visual.decorativeBottleIds).toHaveLength(10);
  });
});
