import type { LevelCatalog } from '../levels/LevelCatalog';
import type { LevelDefinition } from '../levels/LevelDefinition';
import { getDefaultLevelCatalog } from '../levels/LevelFactory';
import type { ChapterId, LevelId } from '../levels/LevelId';
import { comparePersonalBest } from '../models/PersonalBestResult';
import { MAX_STARS_PER_LEVEL } from '../models/StarRating';
import { SCORING_POLICY_VERSION } from '../scoring/ScoringConfig';
import type { CampaignAchievementSummary, ChapterStarSummary } from './CampaignAchievementSummary';
import type { CompletionRecord } from './CompletionRecord';
import type {
  ProgressionEvent,
  ProgressionTransitionResult,
  RecordCompletionInput,
} from './ProgressionEvent';
import type { LevelStatus } from './LevelStatus';
import {
  MAX_RECENT_ATTEMPT_IDS,
  PROGRESSION_SCHEMA_VERSION,
  type CampaignProgress,
  type ChapterProgress,
  type LevelProgressView,
  type ProgressionState,
  type RecommendedNextLevel,
} from './ProgressionState';
import { assertValidProgressionState, validateCompletionInput } from './ProgressionValidator';

function freezeProgressionState(state: ProgressionState): ProgressionState {
  const frozenRecords: Record<LevelId, CompletionRecord> = {};
  for (const [id, rec] of Object.entries(state.completedLevels)) {
    frozenRecords[id] = Object.freeze({ ...rec });
  }
  return Object.freeze({
    schemaVersion: state.schemaVersion,
    completedLevels: Object.freeze(frozenRecords),
    lastPlayedLevelId: state.lastPlayedLevelId,
    selectedLevelId: state.selectedLevelId,
    recentProcessedAttemptIds: Object.freeze([...state.recentProcessedAttemptIds]),
  });
}

function appendBoundedAttemptId(existing: readonly string[], nextId: string): readonly string[] {
  const updated = [...existing, nextId];
  if (updated.length > MAX_RECENT_ATTEMPT_IDS) {
    return Object.freeze(updated.slice(updated.length - MAX_RECENT_ATTEMPT_IDS));
  }
  return Object.freeze(updated);
}

/**
 * Pure, immutable campaign progression engine independent of Phaser, DOM, and storage.
 * All derived views (level statuses, recommended next level, chapter & campaign percentages)
 * are computed dynamically from the LevelCatalog and CompletionRecord map.
 */
export class ProgressionEngine {
  private readonly catalog: LevelCatalog;

  public constructor(catalog: LevelCatalog = getDefaultLevelCatalog()) {
    this.catalog = catalog;
  }

  public getCatalog(): LevelCatalog {
    return this.catalog;
  }

  public createInitialState(): ProgressionState {
    const firstLevel = this.catalog.getFirstLevel();
    return freezeProgressionState({
      schemaVersion: PROGRESSION_SCHEMA_VERSION,
      completedLevels: {},
      lastPlayedLevelId: null,
      selectedLevelId: firstLevel.id,
      recentProcessedAttemptIds: [],
    });
  }

  public getLevelStatus(state: ProgressionState, levelId: LevelId): LevelStatus {
    const level = this.catalog.getLevelById(levelId);
    if (level === undefined) {
      return 'locked';
    }

    if (state.completedLevels[level.id] !== undefined) {
      return 'completed';
    }

    if (level.prerequisiteLevelId === null) {
      return 'unlocked';
    }

    return state.completedLevels[level.prerequisiteLevelId] !== undefined ? 'unlocked' : 'locked';
  }

  public canPlayLevel(state: ProgressionState, levelId: LevelId): boolean {
    return this.getLevelStatus(state, levelId) !== 'locked';
  }

  public getCompletionRecord(state: ProgressionState, levelId: LevelId): CompletionRecord | null {
    return state.completedLevels[levelId] ?? null;
  }

  public getLevelProgressView(
    state: ProgressionState,
    levelId: LevelId,
  ): LevelProgressView | undefined {
    const level = this.catalog.getLevelById(levelId);
    if (level === undefined) {
      return undefined;
    }
    return Object.freeze({
      level,
      status: this.getLevelStatus(state, level.id),
      record: state.completedLevels[level.id] ?? null,
    });
  }

  public getCompletedLevels(state: ProgressionState): readonly LevelDefinition[] {
    return Object.freeze(
      this.catalog
        .getAllLevels()
        .filter((level) => this.getLevelStatus(state, level.id) === 'completed'),
    );
  }

  public getUnlockedLevels(state: ProgressionState): readonly LevelDefinition[] {
    return Object.freeze(
      this.catalog
        .getAllLevels()
        .filter((level) => this.getLevelStatus(state, level.id) === 'unlocked'),
    );
  }

  public getLockedLevels(state: ProgressionState): readonly LevelDefinition[] {
    return Object.freeze(
      this.catalog
        .getAllLevels()
        .filter((level) => this.getLevelStatus(state, level.id) === 'locked'),
    );
  }

  public getRecommendedNextLevel(state: ProgressionState): RecommendedNextLevel {
    for (const level of this.catalog.getAllLevels()) {
      if (this.getLevelStatus(state, level.id) === 'unlocked') {
        return Object.freeze({ status: 'available', level });
      }
    }

    return Object.freeze({
      status: 'campaign_completed',
      finalLevel: this.catalog.getFinalLevel(),
    });
  }

  public getChapterProgress(
    state: ProgressionState,
    chapterId: ChapterId,
  ): ChapterProgress | undefined {
    const chapter = this.catalog.getChapterById(chapterId);
    if (chapter === undefined) {
      return undefined;
    }

    const chapterLevels = this.catalog.getLevelsByChapter(chapter.id);
    const totalLevels = chapterLevels.length;
    let completedLevels = 0;
    let unlockedLevels = 0;

    for (const level of chapterLevels) {
      const status = this.getLevelStatus(state, level.id);
      if (status === 'completed') {
        completedLevels += 1;
      } else if (status === 'unlocked') {
        unlockedLevels += 1;
      }
    }

    const completionPercentage =
      totalLevels > 0 ? Math.round((completedLevels / totalLevels) * 100) : 0;

    return Object.freeze({
      chapter,
      chapterId: chapter.id,
      totalLevels,
      completedLevels,
      unlockedLevels,
      completionPercentage,
      isComplete: totalLevels > 0 && completedLevels === totalLevels,
      hasPlayableLevel: completedLevels > 0 || unlockedLevels > 0,
    });
  }

  public getAllChapterProgress(state: ProgressionState): readonly ChapterProgress[] {
    const list: ChapterProgress[] = [];
    for (const chapter of this.catalog.getAllChapters()) {
      const progress = this.getChapterProgress(state, chapter.id);
      if (progress !== undefined) {
        list.push(progress);
      }
    }
    return Object.freeze(list);
  }

  public getCampaignProgress(state: ProgressionState): CampaignProgress {
    const totalLevels = this.catalog.getTotalLevelCount();
    let completedLevels = 0;

    for (const level of this.catalog.getAllLevels()) {
      if (state.completedLevels[level.id] !== undefined) {
        completedLevels += 1;
      }
    }

    const remainingLevels = Math.max(0, totalLevels - completedLevels);
    const completionPercentage =
      totalLevels > 0 ? Math.round((completedLevels / totalLevels) * 100) : 0;
    const recommendedNextLevel = this.getRecommendedNextLevel(state);

    return Object.freeze({
      totalLevels,
      completedLevels,
      remainingLevels,
      completionPercentage,
      recommendedNextLevel,
      isComplete: totalLevels > 0 && completedLevels === totalLevels,
    });
  }

  public isCampaignComplete(state: ProgressionState): boolean {
    return this.getCampaignProgress(state).isComplete;
  }

  /**
   * Computes aggregate campaign star counts, best score totals (for comparable scoring
   * policy versions), and rating distribution dynamically from LevelCatalog.
   * Never fabricates stars for historical completion records without star data.
   */
  public getCampaignAchievementSummary(
    state: ProgressionState,
    expectedPolicyVersion = SCORING_POLICY_VERSION,
  ): CampaignAchievementSummary {
    const allLevels = this.catalog.getAllLevels();
    const totalLevels = allLevels.length;
    const maxAvailableStars = totalLevels * MAX_STARS_PER_LEVEL;

    let completedLevels = 0;
    let totalEarnedStars = 0;
    let totalBestScore = 0;
    let threeStarCount = 0;
    let twoStarCount = 0;
    let oneStarCount = 0;

    for (const level of allLevels) {
      const record = state.completedLevels[level.id];
      if (record === undefined) {
        continue;
      }
      completedLevels += 1;

      if (record.bestStarRating !== undefined) {
        totalEarnedStars += record.bestStarRating;
        if (record.bestStarRating === 3) {
          threeStarCount += 1;
        } else if (record.bestStarRating === 2) {
          twoStarCount += 1;
        } else {
          oneStarCount += 1;
        }
      }

      if (
        record.bestScore !== undefined &&
        (record.scoringPolicyVersion === undefined ||
          record.scoringPolicyVersion === expectedPolicyVersion)
      ) {
        totalBestScore += record.bestScore;
      }
    }

    const isCampaignComplete = totalLevels > 0 && completedLevels === totalLevels;
    const isPerfectCampaign = isCampaignComplete && threeStarCount === totalLevels;

    return Object.freeze({
      completedLevels,
      totalLevels,
      totalEarnedStars,
      maxAvailableStars,
      totalBestScore,
      threeStarCount,
      twoStarCount,
      oneStarCount,
      isCampaignComplete,
      isPerfectCampaign,
    });
  }

  public getChapterStarSummary(
    state: ProgressionState,
    chapterId: ChapterId,
    expectedPolicyVersion = SCORING_POLICY_VERSION,
  ): ChapterStarSummary | undefined {
    const chapter = this.catalog.getChapterById(chapterId);
    if (chapter === undefined) {
      return undefined;
    }

    const levels = this.catalog.getLevelsByChapter(chapter.id);
    let earnedStars = 0;
    let totalBestScore = 0;

    for (const level of levels) {
      const record = state.completedLevels[level.id];
      if (record === undefined) {
        continue;
      }
      if (record.bestStarRating !== undefined) {
        earnedStars += record.bestStarRating;
      }
      if (
        record.bestScore !== undefined &&
        (record.scoringPolicyVersion === undefined ||
          record.scoringPolicyVersion === expectedPolicyVersion)
      ) {
        totalBestScore += record.bestScore;
      }
    }

    return Object.freeze({
      chapterId: chapter.id,
      earnedStars,
      maxStars: levels.length * MAX_STARS_PER_LEVEL,
      totalBestScore,
    });
  }

  public setLastPlayedLevel(state: ProgressionState, levelId: LevelId): ProgressionState {
    if (this.catalog.getLevelById(levelId) === undefined) {
      return state;
    }
    return freezeProgressionState({
      ...state,
      lastPlayedLevelId: levelId,
    });
  }

  public setSelectedLevel(state: ProgressionState, levelId: LevelId): ProgressionState {
    if (this.catalog.getLevelById(levelId) === undefined) {
      return state;
    }
    return freezeProgressionState({
      ...state,
      selectedLevelId: levelId,
    });
  }

  public recordCompletion(
    state: ProgressionState,
    input: RecordCompletionInput,
  ): ProgressionTransitionResult {
    const rejection = validateCompletionInput(
      input,
      this.catalog,
      (id) => this.canPlayLevel(state, id),
      state.recentProcessedAttemptIds,
    );

    if (rejection !== null) {
      return Object.freeze({
        accepted: false,
        state,
        events: Object.freeze([]),
        rejectionReason: rejection,
      });
    }

    const level = this.catalog.getLevelById(input.levelId);
    if (level === undefined) {
      return Object.freeze({
        accepted: false,
        state,
        events: Object.freeze([]),
        rejectionReason: 'UNKNOWN_LEVEL',
      });
    }

    const normalizedAttemptId = input.attemptId.trim();
    const normalizedElapsedMs = Math.round(input.elapsedMs);
    const previousRecord = state.completedLevels[level.id];
    const personalBest = comparePersonalBest(previousRecord, {
      moveCount: input.moveCount,
      elapsedMs: normalizedElapsedMs,
      ...(input.score !== undefined ? { score: input.score } : {}),
      ...(input.starRating !== undefined ? { starRating: input.starRating } : {}),
    });
    const firstTime = personalBest.isFirstCompletion;

    const resolvedPolicyVersion =
      input.scoringPolicyVersion ?? previousRecord?.scoringPolicyVersion;

    const nextRecord: CompletionRecord = Object.freeze({
      levelId: level.id,
      completionCount: previousRecord !== undefined ? previousRecord.completionCount + 1 : 1,
      bestMoveCount: personalBest.bestMoves,
      bestElapsedMs: personalBest.bestElapsedMs,
      ...(personalBest.bestScore !== null ? { bestScore: personalBest.bestScore } : {}),
      ...(personalBest.bestStars !== null ? { bestStarRating: personalBest.bestStars } : {}),
      ...(resolvedPolicyVersion !== undefined
        ? { scoringPolicyVersion: resolvedPolicyVersion }
        : {}),
    });

    const nextCompletedLevels: Record<LevelId, CompletionRecord> = {
      ...state.completedLevels,
      [level.id]: nextRecord,
    };

    const nextState = freezeProgressionState({
      schemaVersion: state.schemaVersion,
      completedLevels: nextCompletedLevels,
      lastPlayedLevelId: level.id,
      selectedLevelId: state.selectedLevelId,
      recentProcessedAttemptIds: appendBoundedAttemptId(
        state.recentProcessedAttemptIds,
        normalizedAttemptId,
      ),
    });

    const events: ProgressionEvent[] = [
      Object.freeze({
        type: 'LEVEL_COMPLETED',
        levelId: level.id,
        levelNumber: level.levelNumber,
        firstTime,
        completionCount: nextRecord.completionCount,
        moveCount: input.moveCount,
        elapsedMs: normalizedElapsedMs,
        ...(input.score !== undefined ? { score: input.score } : {}),
        ...(input.starRating !== undefined ? { starRating: input.starRating } : {}),
      }),
    ];

    if (firstTime) {
      // Unlock immediate successor if it was previously locked and is now unlocked
      const successor = this.catalog.getNextLevel(level.id);
      if (
        successor !== undefined &&
        this.getLevelStatus(state, successor.id) === 'locked' &&
        this.getLevelStatus(nextState, successor.id) === 'unlocked'
      ) {
        events.push(
          Object.freeze({
            type: 'LEVEL_UNLOCKED',
            levelId: successor.id,
            levelNumber: successor.levelNumber,
            unlockedByLevelId: level.id,
          }),
        );
      }

      // Check chapter completion transition
      const prevChapter = this.getChapterProgress(state, level.chapterId);
      const nextChapter = this.getChapterProgress(nextState, level.chapterId);
      if (
        prevChapter !== undefined &&
        nextChapter !== undefined &&
        !prevChapter.isComplete &&
        nextChapter.isComplete
      ) {
        events.push(
          Object.freeze({
            type: 'CHAPTER_COMPLETED',
            chapterId: nextChapter.chapterId,
            chapterName: nextChapter.chapter.displayName,
          }),
        );
      }

      // Check campaign completion transition
      if (!this.isCampaignComplete(state) && this.isCampaignComplete(nextState)) {
        events.push(
          Object.freeze({
            type: 'CAMPAIGN_COMPLETED',
            totalLevels: this.catalog.getTotalLevelCount(),
          }),
        );
      }
    } else if (personalBest.hasAnyImprovement) {
      events.push(
        Object.freeze({
          type: 'LEVEL_RECORD_IMPROVED',
          levelId: level.id,
          improvedMoves: personalBest.improvedMoves,
          improvedTime: personalBest.improvedTime,
          improvedScore: personalBest.improvedScore,
          improvedStars: personalBest.improvedStars,
          bestMoveCount: nextRecord.bestMoveCount,
          bestElapsedMs: nextRecord.bestElapsedMs,
          ...(nextRecord.bestScore !== undefined ? { bestScore: nextRecord.bestScore } : {}),
          ...(nextRecord.bestStarRating !== undefined
            ? { bestStarRating: nextRecord.bestStarRating }
            : {}),
        }),
      );
    }

    return Object.freeze({
      accepted: true,
      state: nextState,
      events: Object.freeze(events),
      personalBest,
    });
  }

  /**
   * Produces a clean JSON-serialisable snapshot suitable for future Task 15 persistence.
   */
  public serializeState(state: ProgressionState): string {
    assertValidProgressionState(state, this.catalog);
    return JSON.stringify(state);
  }

  /**
   * Deserialises and validates a saved ProgressionState snapshot against the active catalogue.
   */
  public deserializeState(serialized: string): ProgressionState {
    const parsed: unknown = JSON.parse(serialized);
    assertValidProgressionState(parsed, this.catalog);
    return freezeProgressionState(parsed);
  }
}
