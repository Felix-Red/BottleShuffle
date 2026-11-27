import { ProgressionError } from '../errors/ProgressionError';
import type { LevelCatalog } from '../levels/LevelCatalog';
import type { LevelId } from '../levels/LevelId';
import { isEarnedStarRating } from '../models/StarRating';
import type { CompletionRecord } from './CompletionRecord';
import type { ProgressionRejectionReason, RecordCompletionInput } from './ProgressionEvent';
import {
  MAX_RECENT_ATTEMPT_IDS,
  PROGRESSION_SCHEMA_VERSION,
  type ProgressionState,
} from './ProgressionState';

export interface ProgressionStateValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

interface RawProgressionCandidate {
  readonly schemaVersion?: unknown;
  readonly completedLevels?: unknown;
  readonly lastPlayedLevelId?: unknown;
  readonly selectedLevelId?: unknown;
  readonly recentProcessedAttemptIds?: unknown;
}

function formatUnknownValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return typeof value;
}

export function validateCompletionInput(
  input: RecordCompletionInput,
  catalog: LevelCatalog,
  isLevelPlayable: (levelId: LevelId) => boolean,
  recentAttemptIds: readonly string[],
): ProgressionRejectionReason | null {
  if (typeof input.attemptId !== 'string' || input.attemptId.trim().length === 0) {
    return 'INVALID_ATTEMPT_ID';
  }

  if (catalog.getLevelById(input.levelId) === undefined) {
    return 'UNKNOWN_LEVEL';
  }

  if (!isLevelPlayable(input.levelId)) {
    return 'LEVEL_LOCKED';
  }

  if (!Number.isInteger(input.moveCount) || input.moveCount < 1) {
    return 'INVALID_MOVE_COUNT';
  }

  if (!Number.isFinite(input.elapsedMs) || input.elapsedMs < 0) {
    return 'INVALID_ELAPSED_TIME';
  }

  if (input.score !== undefined && (!Number.isInteger(input.score) || input.score < 1)) {
    return 'INVALID_SCORE';
  }

  if (input.starRating !== undefined && !isEarnedStarRating(input.starRating)) {
    return 'INVALID_STAR_RATING';
  }

  if (recentAttemptIds.includes(input.attemptId.trim())) {
    return 'DUPLICATE_ATTEMPT';
  }

  return null;
}

export function validateProgressionState(
  state: unknown,
  catalog: LevelCatalog,
): ProgressionStateValidationResult {
  const errors: string[] = [];

  if (typeof state !== 'object' || state === null) {
    return Object.freeze({
      valid: false,
      errors: Object.freeze(['Progression state must be an object.']),
    });
  }

  const candidate = state as RawProgressionCandidate;
  if (candidate.schemaVersion !== PROGRESSION_SCHEMA_VERSION) {
    errors.push(
      `Unsupported progression schemaVersion: ${formatUnknownValue(candidate.schemaVersion)} (expected ${String(PROGRESSION_SCHEMA_VERSION)}).`,
    );
  }

  const rawCompleted = candidate.completedLevels;
  if (typeof rawCompleted !== 'object' || rawCompleted === null || Array.isArray(rawCompleted)) {
    errors.push('completedLevels must be a record object.');
  } else {
    for (const [key, value] of Object.entries(rawCompleted as Record<string, unknown>)) {
      if (catalog.getLevelById(key) === undefined) {
        errors.push(`Unknown completed level ID: "${key}".`);
        continue;
      }
      if (typeof value !== 'object' || value === null) {
        errors.push(`Invalid completion record for level "${key}".`);
        continue;
      }
      const record = value as Partial<CompletionRecord>;
      if (record.levelId !== key) {
        errors.push(`Completion record levelId mismatch for key "${key}".`);
      }
      if (!Number.isInteger(record.completionCount) || (record.completionCount ?? 0) < 1) {
        errors.push(
          `Invalid completionCount for level "${key}": ${String(record.completionCount)}.`,
        );
      }
      if (!Number.isInteger(record.bestMoveCount) || (record.bestMoveCount ?? 0) < 1) {
        errors.push(`Invalid bestMoveCount for level "${key}": ${String(record.bestMoveCount)}.`);
      }
      if (
        typeof record.bestElapsedMs !== 'number' ||
        !Number.isFinite(record.bestElapsedMs) ||
        record.bestElapsedMs < 0
      ) {
        errors.push(`Invalid bestElapsedMs for level "${key}": ${String(record.bestElapsedMs)}.`);
      }
      if (
        record.bestScore !== undefined &&
        (!Number.isInteger(record.bestScore) || record.bestScore < 1)
      ) {
        errors.push(`Invalid bestScore for level "${key}": ${String(record.bestScore)}.`);
      }
      if (record.bestStarRating !== undefined && !isEarnedStarRating(record.bestStarRating)) {
        errors.push(`Invalid bestStarRating for level "${key}": ${String(record.bestStarRating)}.`);
      }
      if (
        record.scoringPolicyVersion !== undefined &&
        (!Number.isInteger(record.scoringPolicyVersion) || record.scoringPolicyVersion < 1)
      ) {
        errors.push(
          `Invalid scoringPolicyVersion for level "${key}": ${String(record.scoringPolicyVersion)}.`,
        );
      }
    }
  }

  const lastPlayed = candidate.lastPlayedLevelId;
  if (
    lastPlayed !== null &&
    (typeof lastPlayed !== 'string' || catalog.getLevelById(lastPlayed) === undefined)
  ) {
    errors.push(`Unknown lastPlayedLevelId: "${formatUnknownValue(lastPlayed)}".`);
  }

  const selected = candidate.selectedLevelId;
  if (
    selected !== null &&
    (typeof selected !== 'string' || catalog.getLevelById(selected) === undefined)
  ) {
    errors.push(`Unknown selectedLevelId: "${formatUnknownValue(selected)}".`);
  }

  const recentAttempts = candidate.recentProcessedAttemptIds;
  if (
    !Array.isArray(recentAttempts) ||
    recentAttempts.length > MAX_RECENT_ATTEMPT_IDS ||
    recentAttempts.some((item) => typeof item !== 'string' || item.trim().length === 0)
  ) {
    errors.push('recentProcessedAttemptIds must be a bounded string array.');
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  });
}

export function assertValidProgressionState(
  state: unknown,
  catalog: LevelCatalog,
): asserts state is ProgressionState {
  if (typeof state === 'object' && state !== null) {
    const schema = (state as RawProgressionCandidate).schemaVersion;
    if (schema !== PROGRESSION_SCHEMA_VERSION) {
      throw new ProgressionError(
        'UNSUPPORTED_SCHEMA_VERSION',
        `Unsupported progression schemaVersion: ${formatUnknownValue(schema)}.`,
        { schemaVersion: schema, expectedSchemaVersion: PROGRESSION_SCHEMA_VERSION },
      );
    }
  }

  const result = validateProgressionState(state, catalog);
  if (!result.valid) {
    throw new ProgressionError(
      'INVALID_PROGRESSION_STATE',
      `Invalid progression state: ${result.errors[0] ?? 'Unknown validation failure'}`,
      { errors: result.errors },
    );
  }
}
