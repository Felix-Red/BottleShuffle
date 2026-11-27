// Errors
export { PuzzleError, type PuzzleErrorCode } from './errors/PuzzleError';
export { GameError, type ActionRejectionReason, type GameErrorCode } from './errors/GameError';
export { ProgressionError, type ProgressionErrorCode } from './errors/ProgressionError';

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
export { GameEngine, type CompletedPuzzleScoringMetadata } from './engine/GameEngine';

// Levels & Chapters
export {
  formatChapterId,
  formatLevelId,
  isValidChapterId,
  isValidLevelId,
  type ChapterId,
  type LevelId,
} from './levels/LevelId';
export type { ChapterDefinition, ChapterSpec } from './levels/ChapterDefinition';
export {
  generateLevelPuzzle,
  toLevelPuzzleConfig,
  type LevelDefinition,
} from './levels/LevelDefinition';
export { CAMPAIGN_SEED_NAMESPACE, deriveCampaignLevelSeed } from './levels/LevelSeedGenerator';
export {
  assertValidLevelCatalog,
  validateLevelCatalog,
  type LevelCatalogValidationResult,
} from './levels/LevelValidator';
export { createLevelCatalog, LevelCatalog } from './levels/LevelCatalog';
export {
  buildCatalogFromChapterSpecs,
  DEFAULT_CHAPTER_SPECS,
  getDefaultLevelCatalog,
} from './levels/LevelFactory';

// Progression Engine
export type { LevelStatus } from './progression/LevelStatus';
export type { CompletionRecord } from './progression/CompletionRecord';
export {
  MAX_RECENT_ATTEMPT_IDS,
  PROGRESSION_SCHEMA_VERSION,
  type CampaignProgress,
  type ChapterProgress,
  type LevelProgressView,
  type ProgressionState,
  type RecommendedNextLevel,
} from './progression/ProgressionState';
export type {
  ProgressionEvent,
  ProgressionRejectionReason,
  ProgressionTransitionResult,
  RecordCompletionInput,
} from './progression/ProgressionEvent';
export {
  assertValidProgressionState,
  validateCompletionInput,
  validateProgressionState,
  type ProgressionStateValidationResult,
} from './progression/ProgressionValidator';
export { ProgressionEngine } from './progression/ProgressionEngine';

// Scoring, Star Ratings & Campaign Achievements
export {
  isEarnedStarRating,
  MAX_STARS_PER_LEVEL,
  type EarnedStarRating,
  type LevelStarRating,
} from './models/StarRating';
export type { ScoreBreakdown } from './models/ScoreBreakdown';
export type { AttemptResult, ScoredGameplayMode } from './models/AttemptResult';
export {
  comparePersonalBest,
  type PersonalBestCandidate,
  type PersonalBestComparison,
} from './models/PersonalBestResult';
export type {
  CampaignAchievementSummary,
  ChapterStarSummary,
} from './progression/CampaignAchievementSummary';
export {
  DEFAULT_SCORING_CONFIG,
  SCORING_POLICY_VERSION,
  type ScoringConfig,
} from './scoring/ScoringConfig';
export {
  assertValidDifficultyMultiplier,
  assertValidElapsedMs,
  assertValidMoveMetrics,
  assertValidScoringConfig,
} from './scoring/ScoreValidator';
export {
  calculateMoveEfficiency,
  formatEfficiencyPercentage,
} from './scoring/EfficiencyCalculator';
export { calculateStarRating } from './scoring/StarRatingCalculator';
export {
  calculateScoreBreakdown,
  createAttemptResult,
  type CreateAttemptResultInput,
  type ScoreCalculationInput,
} from './scoring/ScoreCalculator';

// Tutorial Domain & State Machine
export type {
  TutorialHighlightKind,
  TutorialHighlightTarget,
  TutorialInputPolicy,
  TutorialInstructionalStageId,
  TutorialPuzzleId,
  TutorialStageId,
  TutorialStepDefinition,
} from './tutorial/TutorialStep';
export {
  getTutorialStepDefinition,
  isInstructionalStage,
  TOTAL_INSTRUCTIONAL_STEPS,
  TUTORIAL_STEPS,
} from './tutorial/TutorialDefinition';
export {
  getAllTutorialPuzzles,
  getCounterDemoExamples,
  getTutorialPuzzle,
  type CounterDemoExample,
} from './tutorial/TutorialPuzzleFactory';
export {
  createInitialTutorialState,
  type CounterDemoPhase,
  type TutorialState,
} from './tutorial/TutorialState';
export type { TutorialAction } from './tutorial/TutorialAction';
export type {
  TutorialEvent,
  TutorialRejectionReason,
  TutorialTransitionResult,
} from './tutorial/TutorialEvent';
export { TutorialEngine } from './tutorial/TutorialEngine';

// Settings domain (Task 13)
export {
  isMotionPreference,
  MOTION_PREFERENCE_VALUES,
  resolveEffectiveReducedMotion,
  type MotionPreference,
} from './settings/MotionPreference';
export { SETTINGS_SCHEMA_VERSION, type GameSettings } from './settings/GameSettings';
export { createDefaultGameSettings, DEFAULT_GAME_SETTINGS } from './settings/SettingsDefaults';
export type { SettingsAction, SettingsRejectionReason } from './settings/SettingsAction';
export {
  assertValidGameSettings,
  deserializeGameSettings,
  isValidGameSettings,
  serializeGameSettings,
} from './settings/SettingsValidator';
export { reduceGameSettings, type SettingsTransitionResult } from './settings/SettingsReducer';

// Persistence domain (Task 15)
export {
  CURRENT_SAVE_SCHEMA_VERSION,
  MIN_SUPPORTED_SAVE_SCHEMA_VERSION,
  SAVE_GAME_ID,
  type SaveSchemaVersion,
} from './persistence/SaveSchemaVersion';
export type { SaveMetadata } from './persistence/SaveMetadata';
export type {
  PersistedLevelRecord,
  PersistedProgressionData,
  PersistedSettingsData,
  PersistedTutorialData,
  PersistedTutorialStatus,
  SaveData,
} from './persistence/SaveData';
export { SaveError, type SaveErrorCode } from './persistence/SaveError';
export type {
  SaveValidationDisposition,
  SaveValidationResult,
} from './persistence/SaveValidationResult';
export {
  createDefaultSaveData,
  DEFAULT_SAVE_TIMESTAMP,
  freezeSaveData,
} from './persistence/SaveDataFactory';
export {
  hasUnsafeObjectKeys,
  isValidSaveData,
  validateSaveData,
} from './persistence/SaveDataValidator';

// Monetisation & Advertising placement domain (Task 18)
export { AD_TYPES, type AdType } from './monetization/AdType';
export {
  AD_PLACEMENTS,
  type AdGameplayMode,
  type AdPlacement,
  type AdTransitionTrigger,
} from './monetization/AdPlacement';
export {
  AD_RESULT_STATUSES,
  type AdErrorCategory,
  type AdErrorDetails,
  type AdRequestOutcome,
  type AdResultStatus,
  type RewardedAdOutcome,
} from './monetization/AdResult';
export {
  evaluateInterstitialEligibility,
  evaluateRewardedEligibility,
  validateRewardIdentifier,
  type AdPlacementPolicyRules,
  type InterstitialPlacementContext,
  type InterstitialPolicyDecision,
  type InterstitialPolicyReason,
  type RewardedPlacementContext,
  type RewardedPolicyDecision,
  type RewardedPolicyReason,
} from './monetization/AdPlacementPolicy';
