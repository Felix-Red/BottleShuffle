import {
  generateLevelPuzzle,
  getDefaultLevelCatalog,
  ProgressionEngine,
  type CampaignAchievementSummary,
  type CampaignProgress,
  type ChapterId,
  type ChapterProgress,
  type ChapterStarSummary,
  type CompletionRecord,
  type EarnedStarRating,
  type LevelCatalog,
  type LevelDefinition,
  type LevelId,
  type LevelProgressView,
  type LevelStatus,
  type ProgressionEvent,
  type ProgressionRejectionReason,
  type ProgressionState,
  type ProgressionTransitionResult,
  type Puzzle,
  type RecommendedNextLevel,
} from '../../core';

export interface ActiveCampaignAttempt {
  readonly attemptId: string;
  readonly levelId: LevelId;
  readonly levelNumber: number;
}

export type BeginCampaignAttemptResult =
  | {
      readonly accepted: true;
      readonly attempt: ActiveCampaignAttempt;
      readonly level: LevelDefinition;
      readonly chapterName: string;
      readonly puzzle: Puzzle;
    }
  | {
      readonly accepted: false;
      readonly reason: Extract<ProgressionRejectionReason, 'UNKNOWN_LEVEL' | 'LEVEL_LOCKED'>;
    };

export type ProgressionChangeListener = (
  state: ProgressionState,
  events: readonly ProgressionEvent[],
) => void;

/**
 * Single authoritative application-level session owner for campaign progression.
 * Instantiated once at app bootstrap and injected into HomeScene and GameScene so
 * progression survives scene transitions without global mutable singletons or storage.
 */
export class ProgressionController {
  private readonly engine: ProgressionEngine;
  private readonly catalog: LevelCatalog;
  private state: ProgressionState;
  private activeAttempt: ActiveCampaignAttempt | null = null;
  private attemptCounter = 0;
  private readonly listeners = new Set<ProgressionChangeListener>();
  private readonly lastPlayedListeners = new Set<(levelId: LevelId) => void>();

  public constructor(
    catalog: LevelCatalog = getDefaultLevelCatalog(),
    initialState?: ProgressionState,
  ) {
    this.catalog = catalog;
    this.engine = new ProgressionEngine(catalog);
    this.state = initialState ?? this.engine.createInitialState();
  }

  public getCatalog(): LevelCatalog {
    return this.catalog;
  }

  public getEngine(): ProgressionEngine {
    return this.engine;
  }

  public getState(): ProgressionState {
    return this.state;
  }

  public getActiveAttempt(): ActiveCampaignAttempt | null {
    return this.activeAttempt;
  }

  public getLevelStatus(levelId: LevelId): LevelStatus {
    return this.engine.getLevelStatus(this.state, levelId);
  }

  public canPlayLevel(levelId: LevelId): boolean {
    return this.engine.canPlayLevel(this.state, levelId);
  }

  public getCompletionRecord(levelId: LevelId): CompletionRecord | null {
    return this.engine.getCompletionRecord(this.state, levelId);
  }

  public getLevelProgressView(levelId: LevelId): LevelProgressView | undefined {
    return this.engine.getLevelProgressView(this.state, levelId);
  }

  public getRecommendedNextLevel(): RecommendedNextLevel {
    return this.engine.getRecommendedNextLevel(this.state);
  }

  public getChapterProgress(chapterId: ChapterId): ChapterProgress | undefined {
    return this.engine.getChapterProgress(this.state, chapterId);
  }

  public getAllChapterProgress(): readonly ChapterProgress[] {
    return this.engine.getAllChapterProgress(this.state);
  }

  public getCampaignProgress(): CampaignProgress {
    return this.engine.getCampaignProgress(this.state);
  }

  public isCampaignComplete(): boolean {
    return this.engine.isCampaignComplete(this.state);
  }

  public getCampaignAchievementSummary(): CampaignAchievementSummary {
    return this.engine.getCampaignAchievementSummary(this.state);
  }

  public getChapterStarSummary(chapterId: ChapterId): ChapterStarSummary | undefined {
    return this.engine.getChapterStarSummary(this.state, chapterId);
  }

  public getNextPlayableLevelAfter(levelId: LevelId): LevelDefinition | undefined {
    const next = this.catalog.getNextLevel(levelId);
    if (next === undefined) {
      return undefined;
    }
    return this.canPlayLevel(next.id) ? next : undefined;
  }

  public selectLevel(levelId: LevelId): void {
    this.state = this.engine.setSelectedLevel(this.state, levelId);
  }

  /**
   * Validates level accessibility, creates a fresh unique attempt identifier, and
   * generates the level's deterministic puzzle on demand.
   */
  public beginCampaignAttempt(levelId: LevelId): BeginCampaignAttemptResult {
    const level = this.catalog.getLevelById(levelId);
    if (level === undefined) {
      return Object.freeze({ accepted: false, reason: 'UNKNOWN_LEVEL' });
    }

    if (!this.engine.canPlayLevel(this.state, level.id)) {
      return Object.freeze({ accepted: false, reason: 'LEVEL_LOCKED' });
    }

    const previousLastPlayed = this.state.lastPlayedLevelId;
    const attempt = this.createNextAttempt(level);
    this.activeAttempt = attempt;
    this.state = this.engine.setLastPlayedLevel(
      this.engine.setSelectedLevel(this.state, level.id),
      level.id,
    );

    if (previousLastPlayed !== level.id) {
      for (const listener of [...this.lastPlayedListeners]) {
        listener(level.id);
      }
    }

    const chapter = this.catalog.getChapterById(level.chapterId);
    const puzzle = generateLevelPuzzle(level);

    return Object.freeze({
      accepted: true,
      attempt,
      level,
      chapterName: chapter?.displayName ?? level.chapterId,
      puzzle,
    });
  }

  /**
   * Rotates the active campaign attempt identifier when the player restarts or replays
   * the same level, invalidating any stale completion callbacks from the prior attempt.
   */
  public restartActiveAttempt(expectedLevelId?: LevelId): ActiveCampaignAttempt | null {
    const targetLevelId = expectedLevelId ?? this.activeAttempt?.levelId;
    if (targetLevelId === undefined) {
      return null;
    }
    const level = this.catalog.getLevelById(targetLevelId);
    if (level === undefined || !this.engine.canPlayLevel(this.state, level.id)) {
      return null;
    }

    const attempt = this.createNextAttempt(level);
    this.activeAttempt = attempt;
    return attempt;
  }

  /**
   * Records a campaign completion ONLY if it matches the currently active attempt and level.
   * Clears the active attempt upon acceptance so duplicate completion events cannot advance progression.
   */
  public completeActiveAttempt(params: {
    readonly attemptId: string;
    readonly levelId: LevelId;
    readonly moveCount: number;
    readonly elapsedMs: number;
    readonly score?: number;
    readonly starRating?: EarnedStarRating;
    readonly scoringPolicyVersion?: number;
  }): ProgressionTransitionResult {
    if (this.activeAttempt?.attemptId !== params.attemptId) {
      return Object.freeze({
        accepted: false,
        state: this.state,
        events: Object.freeze([]),
        rejectionReason: 'INACTIVE_ATTEMPT',
      });
    }

    if (this.activeAttempt.levelId !== params.levelId) {
      return Object.freeze({
        accepted: false,
        state: this.state,
        events: Object.freeze([]),
        rejectionReason: 'LEVEL_MISMATCH',
      });
    }

    const result = this.engine.recordCompletion(this.state, {
      levelId: params.levelId,
      attemptId: params.attemptId,
      moveCount: params.moveCount,
      elapsedMs: params.elapsedMs,
      ...(params.score !== undefined ? { score: params.score } : {}),
      ...(params.starRating !== undefined ? { starRating: params.starRating } : {}),
      ...(params.scoringPolicyVersion !== undefined
        ? { scoringPolicyVersion: params.scoringPolicyVersion }
        : {}),
    });

    if (result.accepted) {
      this.activeAttempt = null;
      this.state = result.state;
      this.notifyListeners(result.state, result.events);
    }

    return result;
  }

  /**
   * Abandons an active campaign attempt (e.g. Return Home or scene shutdown)
   * without unlocking levels or modifying completion records.
   */
  public abandonActiveAttempt(attemptId?: string): void {
    if (this.activeAttempt === null) {
      return;
    }
    if (attemptId === undefined || this.activeAttempt.attemptId === attemptId) {
      this.activeAttempt = null;
    }
  }

  public onChange(listener: ProgressionChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onLastPlayedChange(listener: (levelId: LevelId) => void): () => void {
    this.lastPlayedListeners.add(listener);
    return () => {
      this.lastPlayedListeners.delete(listener);
    };
  }

  public serializeState(): string {
    return this.engine.serializeState(this.state);
  }

  public hydrateSerializedState(serialized: string): void {
    this.activeAttempt = null;
    this.state = this.engine.deserializeState(serialized);
    this.notifyListeners(this.state, Object.freeze([]));
  }

  /**
   * Restores a validated ProgressionState snapshot during startup persistence loading.
   * Deliberately clears any active attempt and emits ZERO completion/unlock/milestone events
   * so loading historical progress never replays celebrations or duplicates records.
   */
  public restoreState(nextState: ProgressionState): void {
    this.activeAttempt = null;
    this.state = nextState;
    this.notifyListeners(this.state, Object.freeze([]));
  }

  private createNextAttempt(level: LevelDefinition): ActiveCampaignAttempt {
    this.attemptCounter += 1;
    return Object.freeze({
      attemptId: `att-${String(this.attemptCounter)}-${level.id}`,
      levelId: level.id,
      levelNumber: level.levelNumber,
    });
  }

  private notifyListeners(state: ProgressionState, events: readonly ProgressionEvent[]): void {
    for (const listener of [...this.listeners]) {
      listener(state, events);
    }
  }
}
