// Errors
export { PuzzleError, type PuzzleErrorCode } from './errors/PuzzleError';
export { GameError, type ActionRejectionReason, type GameErrorCode } from './errors/GameError';

// Models
export {
  CANONICAL_BOTTLE_IDS,
  isBottleId,
  MAX_BOTTLE_COUNT,
  MIN_BOTTLE_COUNT,
  type BottleId,
} from './models/BottleId';
export { createBottle, type Bottle } from './models/Bottle';
export { DIFFICULTY_IDS, isDifficultyId, type DifficultyId } from './models/Difficulty';
export type { PuzzleConfig, PuzzleSeedInput, ResolvedPuzzleConfig } from './models/PuzzleConfig';
export { toPublicPuzzleView, type PublicPuzzleView, type Puzzle } from './models/Puzzle';
export { PUZZLE_STATUSES, type PuzzleStatus } from './models/PuzzleStatus';
export { createInitialPuzzleState, type PuzzleState } from './models/PuzzleState';
export { toPublicGameState, type PublicGameState } from './models/PublicGameState';
export type { SwapResult } from './models/SwapResult';
export type { GameAction, GameActionType } from './models/GameAction';
export type { GameEvent, GameTransitionResult } from './models/GameEvent';

// Difficulty definitions
export {
  ALL_DIFFICULTY_DEFINITIONS,
  DIFFICULTY_DEFINITIONS,
  getDifficultyDefinition,
  resolvePuzzleConfig,
  type DifficultyDefinition,
} from './levels/DifficultyConfig';

// Randomisation & shuffle
export type { RandomSource, SeedProvider } from './random/RandomSource';
export {
  createSeededRandom,
  hashStringToHex,
  hashStringToUint32,
  normalizeSeed,
  SeededRandom,
} from './random/SeededRandom';
export { shuffle } from './random/Shuffle';

// Engine — puzzle generation & validation
export { calculateMinimumSwapDistance, countMatchingPositions } from './engine/SwapDistance';
export {
  assertValidPuzzle,
  validateBottleCount,
  validateBottleSequence,
  validatePuzzle,
  validatePuzzleConfig,
  type PuzzleValidationResult,
} from './engine/PuzzleValidator';
export {
  DEFAULT_MAX_GENERATION_ATTEMPTS,
  generateStartingSequence,
  generateTargetSequence,
  selectUniqueBottles,
  type StartingSequenceConstraints,
  type StartingSequenceGenerationResult,
} from './engine/SequenceGenerator';
export {
  computeDeterministicPuzzleId,
  generatePuzzle,
  inspectPuzzleDiagnostics,
  PUZZLE_GENERATOR_VERSION,
  type PuzzleDiagnostics,
  type PuzzleGeneratorOptions,
} from './engine/PuzzleGenerator';

// Engine — gameplay mechanics & session orchestration
export { calculateCorrectMatches, isSequenceSolved } from './engine/MatchCalculator';
export { swapBottles } from './engine/BottleSwapper';
export {
  validatePlayingStatus,
  validateSelectionRequest,
  validateSlotIndex,
  validateSwapRequest,
  type ValidationOutcome,
} from './engine/SwapValidator';
export { createReadyGameState, createRestartedGameState } from './state/GameStateFactory';
export { reduceGameState } from './state/GameReducer';
export { GameEngine } from './engine/GameEngine';
