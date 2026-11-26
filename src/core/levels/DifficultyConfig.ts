import { PuzzleError } from '../errors/PuzzleError';
import { isDifficultyId, type DifficultyId } from '../models/Difficulty';
import type { PuzzleConfig, ResolvedPuzzleConfig } from '../models/PuzzleConfig';

export interface DifficultyDefinition {
  readonly id: DifficultyId;
  readonly displayName: string;
  readonly bottleCount: number;
  readonly minInitialMatches: number;
  readonly maxInitialMatches: number;
  readonly minRequiredSwaps: number;
}

export const DIFFICULTY_DEFINITIONS: Readonly<Record<DifficultyId, DifficultyDefinition>> =
  Object.freeze({
    beginner: Object.freeze({
      id: 'beginner',
      displayName: 'Beginner',
      bottleCount: 3,
      minInitialMatches: 0,
      maxInitialMatches: 1,
      minRequiredSwaps: 1,
    }),
    easy: Object.freeze({
      id: 'easy',
      displayName: 'Easy',
      bottleCount: 4,
      minInitialMatches: 0,
      maxInitialMatches: 2,
      minRequiredSwaps: 1,
    }),
    normal: Object.freeze({
      id: 'normal',
      displayName: 'Normal',
      bottleCount: 5,
      minInitialMatches: 0,
      maxInitialMatches: 2,
      minRequiredSwaps: 2,
    }),
    intermediate: Object.freeze({
      id: 'intermediate',
      displayName: 'Intermediate',
      bottleCount: 6,
      minInitialMatches: 0,
      maxInitialMatches: 3,
      minRequiredSwaps: 2,
    }),
    hard: Object.freeze({
      id: 'hard',
      displayName: 'Hard',
      bottleCount: 8,
      minInitialMatches: 0,
      maxInitialMatches: 4,
      minRequiredSwaps: 3,
    }),
    expert: Object.freeze({
      id: 'expert',
      displayName: 'Expert',
      bottleCount: 10,
      minInitialMatches: 0,
      maxInitialMatches: 4,
      minRequiredSwaps: 4,
    }),
  });

export const ALL_DIFFICULTY_DEFINITIONS: readonly DifficultyDefinition[] = Object.freeze([
  DIFFICULTY_DEFINITIONS.beginner,
  DIFFICULTY_DEFINITIONS.easy,
  DIFFICULTY_DEFINITIONS.normal,
  DIFFICULTY_DEFINITIONS.intermediate,
  DIFFICULTY_DEFINITIONS.hard,
  DIFFICULTY_DEFINITIONS.expert,
]);

export function getDifficultyDefinition(difficulty: DifficultyId): DifficultyDefinition {
  if (!isDifficultyId(difficulty)) {
    throw new PuzzleError(
      'INVALID_DIFFICULTY',
      `Unsupported difficulty identifier: "${String(difficulty)}".`,
      { difficulty },
    );
  }

  return DIFFICULTY_DEFINITIONS[difficulty];
}

export function resolvePuzzleConfig(config: PuzzleConfig): ResolvedPuzzleConfig {
  const definition = getDifficultyDefinition(config.difficulty);
  const bottleCount = config.bottleCount ?? definition.bottleCount;
  const maxAllowedByCount = Math.max(0, bottleCount - 2);

  const defaultMaxMatches = Math.min(definition.maxInitialMatches, maxAllowedByCount);
  const defaultMinSwaps = Math.min(definition.minRequiredSwaps, Math.max(1, bottleCount - 1));

  return Object.freeze({
    difficulty: definition.id,
    bottleCount,
    minInitialMatches: config.minInitialMatches ?? definition.minInitialMatches,
    maxInitialMatches: config.maxInitialMatches ?? defaultMaxMatches,
    minRequiredSwaps: config.minRequiredSwaps ?? defaultMinSwaps,
  });
}
