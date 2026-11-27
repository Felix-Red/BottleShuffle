# Implementation Progress — Bottle Shuffle

This document tracks completed milestones, technical notes, and planned upcoming tasks.

## Completed Tasks

### Task 01: Project Setup and Architecture — Completed

- Initialised Git repository and Vite + TypeScript + Phaser 3 project.
- Configured strict TypeScript, Vite (relative asset paths, local bundling), ESLint (strict type-checked), Prettier, and Vitest.
- Defined `GamePlatform` contract and `BrowserGamePlatform` local adapter.
- Created centralised Phaser configuration (`1280 × 720` landscape-first reference, `Phaser.Scale.RESIZE`), pure viewport scaling helpers, `BootScene`, and temporary `HomeScene`.
- Authored `README.md`, `AGENTS.md`, `docs/ARCHITECTURE.md`, and `docs/PROGRESS.md`.

### Task 02: Design System and Reusable Components — Completed

- Bundled open-source **Fredoka** and **Nunito** variable WOFF2 fonts locally in `public/assets/fonts/` with SIL Open Font License notices (`OFL.txt`).
- Implemented centralised, Phaser-free design tokens (`Colors`, `Typography`, `Dimens`, `Shapes`, `Elevation`, `Motion`, `Breakpoints`), `GameTheme`, and barrel export `src/design-system/index.ts`.
- Built reusable Phaser 3 UI components: Buttons (`Primary`, `Secondary`, `Outline`, `Text`, `Icon`), Cards (`GameCard`, `LevelCard`, `StatCard`), Indicators (`ProgressBar`, `MatchCounter`, `StarRating`, `LoadingIndicator`), Controls (`ToggleSwitch`), Overlays (`Modal`, `ConfirmDialog`, `Toast`), and Layout (`GameHeader`, `GamePanel`).
- Built development-only `ComponentShowcaseScene` (`/?scene=showcase`) and authored `docs/DESIGN_SYSTEM.md`.

### Task 03: Bottle Assets and Visual Environment — Completed

- Aligned canonical accessibility symbol identifiers across `Colors.ts` and `BottleCatalog.ts` (`circle`, `diamond`, `triangle`, `star`, `sparkle`, `square`, `heart`, `cross`, `stripes`, `ring`).
- Authored reproducible original vector generation (`scripts/generate-assets.mjs`) and rasterisation (`scripts/rasterize-assets.mjs`) pipeline producing editable SVG source artwork under `artwork/` and 20 optimised local runtime assets under `public/assets/` (`10` bottles at `256×512`, `background.webp`, `shelf.png`, `shelf-edge.png`, `hidden-compartment.png`, `hidden-slot.png`, `bottle-shadow.png`, `selection-glow.png`, `sparkle.png`, `particle.png`, `lock.svg`; total visual footprint `1.39 MB`).
- Created centralised `AssetKeys.ts`, `BottleCatalog.ts`, and `AssetManifest.ts`, integrated into `BootScene.preload()` with duplicate-load prevention and missing-asset error diagnostics.
- Implemented pure, Phaser-free responsive layout math (`bottleLayout.ts`) supporting 3–10 bottles in landscape (1 row) and portrait (2 rows for 6–10 bottles) with deterministic left-to-right, top-to-bottom slot ordering.
- Built reusable visual components:
  - Bottles: `BottleSprite` (all 6 visual states: `default`, `hovered`, `pressed`, `selected`, `swapping`, `disabled`), `BottleShadow`, `BottleSelectionIndicator` (gold/purple outline, never green).
  - Environment: `GameBackground`, `BottleRack`, `BottleSlot`, `HiddenSequenceRack`, `HiddenSequenceSlot`.
- Built development-only `AssetShowcaseScene` (`/?scene=assets`) excluded from production builds via `import.meta.env.DEV` dynamic import.
- Added unit tests for `BottleCatalog`, `AssetManifest`, and `bottleLayout` (all 33 tests passing).
- Authored `docs/ASSETS.md` and `docs/GAME_ENVIRONMENT.md`, and updated `README.md` and `docs/PROGRESS.md`.

#### Known Limitations & Assumptions (Task 03)

- **PNG compression headroom:** Bottle PNGs (~100–118 KB each) and `selection-glow.png` (~236 KB) are currently lossless RGBA PNGs encoded via Chromium Canvas (`1.39 MB` total across 20 visual files). Switching to WebP or running lossless PNG compression optimisation can shrink this significantly if future YouTube Playables bundle budgets tighten.
- **No gameplay or puzzle rules yet:** All visual components are strictly presentational; puzzle generation, match counting, bottle swapping logic, and level progression are intentionally deferred to Task 04+.
- **Canvas accessibility:** Phaser renders inside a single `<canvas>`; `BottleCatalogEntry.accessibleLabel` provides structured labels for future keyboard navigation or DOM accessibility overlays.
- **YouTube Playables SDK:** `YouTubeGamePlatform` and official SDK Test Suite verification remain deferred to the dedicated platform integration task.

### Task 04: Puzzle Generation Engine — Completed

- Implemented pure TypeScript domain engine under `src/core/` with zero Phaser, DOM, or browser dependencies:
  - Canonical bottle identity ownership in `src/core/models/BottleId.ts`, referenced by `Colors.ts`, `AssetKeys.ts`, and `BottleCatalog.ts` as a single source of truth.
  - Immutable models (`Bottle`, `Difficulty`, `PuzzleConfig`, `Puzzle`, `PublicPuzzleView`, `PuzzleStatus`, `PuzzleState`) and typed `PuzzleError`.
  - Centralised difficulty definitions in `src/core/levels/DifficultyConfig.ts` (`beginner: 3`, `easy: 4`, `normal: 5`, `intermediate: 6`, `hard: 8`, `expert: 10`).
  - Deterministic seeded PRNG (`SeededRandom` using Mulberry32 + FNV-1a seed hashing and explicit seed validation/normalisation policy) and generic Fisher-Yates `shuffle`.
  - Pure permutation cycle decomposition (`calculateMinimumSwapDistance`) and match counting (`countMatchingPositions`).
  - Bounded `SequenceGenerator` with deterministic `O(n)` constructive fallback for rare valid constraints and strict rejection of impossible configurations (including `n - 1` match counts and infeasible swap/match combinations).
  - Centralised `PuzzleValidator` and `PuzzleGenerator` producing deeply frozen deterministic puzzles and `PublicPuzzleView` / `PuzzleState` projections.
- Added development-only diagnostic CLI (`npm run puzzle:inspect`, `scripts/inspect-puzzle.mjs`) completely outside the production bundle.
- Added 6 core test suites in `tests/unit/core/` including a deterministic **1,260-puzzle stress test** across all 6 difficulties and custom constraints.
- Authored `docs/PUZZLE_ENGINE.md` and updated `docs/ARCHITECTURE.md`, `README.md`, and `docs/PROGRESS.md`.

#### Known Limitations & Assumptions (Task 04)

- **Non-cryptographic PRNG:** Mulberry32 + FNV-1a is intended for reproducible game puzzles, not cryptographic security; because the game is client-side, target sequences are protected against accidental UI leakage rather than browser DevTools inspection.
- **No gameplay loop yet:** Bottle swapping state transitions, timers, move history, scoring, level unlocking, and gameplay scene wiring are intentionally deferred to Task 05+.

### Task 05: Bottle Swapping and Match Calculation — Completed

- Extended pure TypeScript gameplay domain in `src/core/` with zero Phaser, browser, or platform dependencies:
  - Extended `PuzzleState` with `selectedSlotIndex`, `currentMatchCount`, `bestMatchCount`, and `lastSwap` (all immutable and accurately derived from the puzzle's starting vs target sequences).
  - Added `PublicGameState` (`toPublicGameState`), `SwapResult`, discriminated `GameAction` union (7 actions), typed `GameEvent` union (9 events), `GameTransitionResult`, and structured `ActionRejectionReason` / `GameError`.
  - Implemented pure `MatchCalculator` (reusing Task 04's `countMatchingPositions`), `BottleSwapper` (`swapBottles`), and non-throwing `SwapValidator`.
  - Implemented `GameStateFactory`, single authoritative `GameReducer` (unifying tap-to-swap `SELECT_BOTTLE` and direct `SWAP_BOTTLES`, full `ready | playing | paused | completed` transition rules, deterministic `[BOTTLES_SWAPPED, PUZZLE_COMPLETED]` event ordering), and `GameEngine` session orchestrator with private validated `Puzzle` retention.
- Added development-only gameplay diagnostics CLI (`npm run gameplay:simulate`, `scripts/simulate-gameplay.mjs`).
- Added 6 new core unit & integration test suites (`MatchCalculator`, `BottleSwapper`, `SwapValidator`, `GameStateFactory`, `GameReducer`, `GameEngine`), including programmatic solving of 60 deterministic puzzles across all 6 difficulties.
- Authored `docs/GAMEPLAY_ENGINE.md` and updated `README.md` and `docs/PROGRESS.md`.

#### Known Limitations & Assumptions (Task 05)

- **Client-side boundary:** Isolating `targetSequence` inside `GameEngine` prevents accidental disclosure through UI contracts, not browser DevTools inspection.
- **Deferred features:** Visual gameplay scene, swap animations, timers, scoring/stars, level unlocking, undo, persistence, audio, and YouTube Playables SDK integration remain deferred to subsequent tasks.

### Task 06: Gameplay Screen and Engine Integration — Completed

- Integrated pure `PuzzleGenerator` and `GameEngine` with Phaser 3 into a playable end-to-end `GameScene` (`src/game/scenes/GameScene.ts`):
  - Implemented monotonic `GameplayClock` (`src/services/GameplayClock.ts`) tracking active elapsed time with independent manual-pause, modal-suspension, platform-suspension, and completion states (`MM:SS` formatting).
  - Implemented pure responsive `calculateGameplayLayout` (`src/game/layout/GameplayLayout.ts`) supporting landscape and portrait viewports across 3–10 bottles (including 2×5 cross-row portrait layouts).
  - Implemented pure `GameplayController` (`src/game/gameplay/GameplayController.ts`) and `GameplayViewState` strictly consuming public gameplay data without duplicating domain rules or exposing hidden target sequences.
  - Built reusable gameplay UI components (`GameplayHeader`, `GameplayHUD`, `GameplayBoard`, `GameplayInstructions`) reusing `MatchCounter`, `StatCard`, `IconButton`, `Modal`, `ConfirmDialog`, `BottleRack`, `BottleSprite`, and `HiddenSequenceRack`, and added the `'pause'` vector icon to `IconGraphic.ts`.
  - Wired tap-to-select/swap, tap-outside-to-deselect, simple interruptible swap position tweens, aggregate match-delta feedback, pause overlay, restart confirmation, completion overlay, keyboard navigation (`ArrowLeft`/`ArrowRight`/`Enter`/`Space`/`Escape`), browser/platform lifecycle suspension, and error recovery modal.
  - Updated temporary `HomeScene` with a difficulty selector driven directly by `ALL_DIFFICULTY_DEFINITIONS` (3, 4, 5, 6, 8, 10 bottles) and a Play button launching `GameScene` (plus dev-only `/?scene=game` direct launch route).
- Added unit and integration test suites (`GameplayClock.test.ts`, `GameplayLayout.test.ts`, `GameplayController.test.ts`, `GameplayIntegration.test.ts`).
- Authored `docs/GAMEPLAY_SCREEN.md` and updated `README.md` and `docs/PROGRESS.md`.

#### Known Limitations & Assumptions (Task 06)

- **Simple swap presentation (upgraded in Task 07):** Task 06 used a lightweight position tween; Task 07 replaced it with multi-stage curved swap trajectories, dynamic shadows, and HUD feedback.
- **Temporary overlays & home screen:** Pause, completion, and home screens are intentionally functional development layouts; final home design, scoring/stars, level unlocking, settings persistence, drag-and-drop swapping, and YouTube Playables SDK integration remain deferred to subsequent tasks.
- **Canvas accessibility:** Basic keyboard slot navigation and focus highlighting are implemented, while full screen-reader accessibility over canvas remains a known Phaser limitation.

### Task 07: Animations and Interaction Feedback — Completed

- Extended centralised design-system motion tokens (`src/design-system/tokens/Motion.ts`) with semantic gameplay durations (`470ms` swap total, `100–150ms` interactions, `250ms` match feedback, `650ms` floating delta, `800ms` celebration), native Phaser easing aliases, relative `MotionParams`, and `0.96 -> 1.00` ease-out modal transitions.
- Implemented pure animation architecture in `src/game/animations/`:
  - `AnimationMath.ts` & `AnimationCurves.ts`: quadratic Bezier evaluation, opposing horizontal/vertical/diagonal/cross-row swap trajectories with sublinear scaling and safe playfield bounds clamping, relative squash-and-stretch deformation, shadow elevation math, and mid-flight tilt.
  - `AnimationPolicy.ts` & `src/services/MotionPreferenceService.ts`: centralised reduced-motion policy observing `prefers-reduced-motion` + programmatic overrides with clean listener disposal.
  - `AnimationHandle.ts` & `AnimationCoordinator.ts`: epoch-scoped transition coordination preventing duplicate swaps, stale completion callbacks, and leaked decorative effects on pause, resize, platform suspend, restart, or shutdown.
- Upgraded visual components and effects:
  - `BottleSprite`, `BottleShadow`, and `BottleSelectionIndicator`: relative hover/selection lifts, tactile press feedback with outside-release recovery, grounded dynamic swap shadows, and landing compression.
  - `BottleSwapAnimation.ts`: 3-stage swap (`70ms` anticipation + `300ms` opposing Bezier flight + `100ms` relative squash-and-stretch landing; `110ms` direct glide in reduced motion) plus optional bounded `BottleMotionTrail` for longer swaps.
  - `MatchCounter`, `StatCard`, `FloatingMatchFeedback`, `ParticleBurst`, and `VictoryCelebration`: directional aggregate match feedback, subtle move counter pulse, bounded sparkle/confetti bursts (`8` match / `22` victory), and post-solve full-rack success glow.
  - Integrated into `GameplayController`, `GameplayHUD`, `GameplayBoard`, and `GameScene`.
- Added development-only `AnimationShowcaseScene` (`/?scene=animations`, gated behind `import.meta.env.DEV` with Reduced-Motion & Slow-Motion toggles).
- Added unit and integration test suites (`tests/unit/animations/*` and `tests/integration/AnimationIntegration.test.ts`).
- Authored `docs/ANIMATIONS.md` and updated `docs/DESIGN_SYSTEM.md`, `docs/GAMEPLAY_SCREEN.md`, `docs/PROGRESS.md`, and `README.md`.

#### Known Limitations & Assumptions (Task 07)

- **No persistent motion settings yet:** `MotionPreferenceService` supports runtime overrides and system `prefers-reduced-motion`, while persisting user settings remains deferred to the future persistence/settings task.
- **Deferred features:** Audio SFX/music, drag-and-drop swapping, scoring/stars, level progression/unlocking, final Home & Victory screens, and YouTube Playables SDK integration remain deferred to subsequent tasks.

### Task 08: Difficulty and Level Progression — Completed

- Implemented the pure TypeScript 50-level campaign catalogue and 6-chapter progression architecture in `src/core/`:
  - `LevelId.ts`, `ChapterDefinition.ts`, `LevelDefinition.ts`, `LevelSeedGenerator.ts`, `LevelValidator.ts`, `LevelCatalog.ts`, `LevelFactory.ts`, and `ProgressionError.ts`.
  - Configured 6 chapters (**First Steps** 1–5 Beginner 3, **Getting Warmer** 6–10 Easy 4, **The Shuffle** 11–20 Normal 5, **Mind Games** 21–30 Intermediate 6, **Brain Teaser** 31–40 Hard 8, **Mastermind** 41–50 Expert 10) with versioned deterministic seeds (`v1.0.0`) generated on demand at launch.
  - Implemented immutable, serialisable `ProgressionState` (`schemaVersion: 1`), `CompletionRecord` (independent `bestMoveCount` & `bestElapsedMs`), `ProgressionEvent`, `ProgressionValidator`, and `ProgressionEngine` with sequential unlocking, chapter/campaign derived progress, recommended next level, and bounded attempt deduplication (`MAX_RECENT_ATTEMPT_IDS = 32`).
- Implemented application-level `ProgressionController` (`src/game/progression/ProgressionController.ts`) owned once in `src/main.ts` and injected into `HomeScene` and `GameScene` so progression survives scene transitions without global mutable singletons or storage.
- Integrated **Campaign Mode** and **Practice Mode** into `GameplaySceneData`, `GameplayController`, `GameScene` (including **Next Level** / **Replay** / **Campaign Complete!** completion modal variants), and updated temporary `HomeScene` (**Continue**, campaign progress bar, chapter tabs, `LevelCard` level grid with disabled locked levels & replayable completed levels, and preserved Practice Mode difficulty selector).
- Added dev calibration CLI (`npm run levels:calibrate`, `scripts/calibrate-levels.mjs`) confirming 50/50 valid puzzles, 0 duplicates, and strong tier variety; generated [docs/LEVEL_CALIBRATION.md](./LEVEL_CALIBRATION.md).
- Added comprehensive unit, golden-fixture, and full 50-level campaign integration tests (`tests/unit/levels/*`, `tests/unit/progression/*`, `tests/integration/LevelProgression.test.ts`).
- Authored `docs/LEVEL_PROGRESSION.md` and `docs/LEVEL_CALIBRATION.md` and updated `docs/ARCHITECTURE.md`, `docs/GAMEPLAY_SCREEN.md`, `docs/PROGRESS.md`, and `README.md`.

#### Known Limitations & Assumptions (Task 08)

- **In-memory session progression:** Progression survives all scene transitions, replays, and restarts while the page stays open, but refreshing or closing the browser resets progress until Task 15 implements persistent save storage (`ProgressionState` is already JSON-serialisable with `schemaVersion: 1`).
- **Temporary hub UI:** The updated `HomeScene` campaign browser and practice panel are temporary development layouts; final Home screen, final Level Selection UI, scoring/star ratings, audio, and YouTube Playables SDK integration remain deferred to subsequent tasks.

### Task 09: Production Home Screen — Completed

- Replaced the temporary development hub with the production-quality `HomeScene` (`src/game/scenes/HomeScene.ts`):
  - Added pure presentation modules: `HomeConfig.ts`, `HomeViewState.ts`, `HomeViewStateMapper.ts`, `HomeController.ts`, `HomeLayout.ts`, and typed `SceneNavigator.ts` (`PhaserSceneNavigator`).
  - Built reusable Home UI components in `src/game/components/home/`: `GameLogo` (dimensional Fredoka gold/white wordmark + tagline), `HomeHero` (expressive 5-bottle composition reusing bundled glossy textures, curved swap-arrow accent, optional tactile tap bounce, staggered ambient float with lifecycle & reduced-motion pause), `ContinueButton` (dominant primary CTA), `CampaignProgressCard` (live progress bar & chapter label), `PracticeModeDialog` (all 6 difficulties with non-colour check indicator), `TemporaryLevelsDialog` (chapter tabs + `LevelCard` grid preserving unlock validation until Task 10), and `TemporarySettingsDialog` (exposing only working **Reduced Motion** toggle).
  - Promoted `MotionPreferenceService` to a shared application-level session owner in `src/main.ts` so toggling Reduced Motion in Home Settings applies live across both `HomeScene` and `GameScene`.
  - Removed all development controls from the player-facing Home screen while preserving dev-only showcases and dev preview query parameters strictly behind `import.meta.env.DEV`.
  - Added `grid` vector icon to `IconGraphic.ts` for the **LEVELS** button.
- Added comprehensive unit and integration tests (`HomeViewStateMapper.test.ts`, `HomeController.test.ts`, `HomeLayout.test.ts`, `HomeNavigation.test.ts`).
- Authored `docs/HOME_SCREEN.md` and updated `docs/ARCHITECTURE.md`, `docs/PROGRESS.md`, and `README.md`.

#### Known Limitations & Assumptions (Task 09)

- **Temporary dialogs for upcoming dedicated screens:** Level selection and Settings currently open clean temporary modals (`TemporaryLevelsDialog`, `TemporarySettingsDialog`) that keep navigation contracts stable for Task 10 (Level Selection Screen) and Task 13 (Pause & Settings).
- **In-memory session preferences & progress:** Both campaign progression and reduced-motion override persist across scenes within the active browser session; persistent storage across page refreshes remains deferred to Task 15.

### Task 10: Production Level Selection Screen — Completed

- Replaced the temporary `TemporaryLevelsDialog` with the dedicated chapter-based `LevelSelectionScene` (`src/game/scenes/LevelSelectionScene.ts`):
  - Added chapter visual theming (`src/config/ChapterVisualConfig.ts`) mapping Chapters 1–6 to design-system accents (Green, Blue, Teal, Gold, Orange, Purple) plus deterministic fallbacks for future Chapters 7+.
  - Built pure Phaser-free presentation layer in `src/game/levels/`: `LevelCardViewState`, `ChapterViewState`, `LevelSelectionViewState`, `LevelSelectionSceneData`, `LevelSelectionViewStateMapper`, session-scoped bounded `LevelUnlockTracker`, and `LevelSelectionController`.
  - Extended reusable `LevelCard` (`src/design-system/components/cards/LevelCard.ts`) with visible locked level numbers, `onLockedSelect` callback, recommended play icon + subtle pulse, orthogonal `selected`/`focused` gold outlines, `setCardSize`, and optional `showStars` (disabled until Task 12); added `'next'` chevron to `IconGraphic.ts`.
  - Implemented pure responsive `LevelSelectionLayout` (`src/game/layout/LevelSelectionLayout.ts`) adapting cleanly across landscape (`1920×1080`, `1280×720`, `844×390`) and portrait (`540×960`, `390×844`, `360×640`) viewports, including bounded in-canvas scrolling for future large chapters.
  - Built reusable level selection components (`LevelSelectionHeader`, `CampaignProgressSummary`, `ChapterBanner`, `ChapterArtwork`, `ChapterProgress`, `ChapterNavigation`, `LevelGrid`, `LevelPreviewDialog`) and restrained animations (`ChapterTransition`, `LevelUnlockAnimation`, `LevelCompletionAnimation`).
  - Wired `HomeScene` (`LEVELS`, `CampaignProgressCard`, completed `PLAY AGAIN`) to `LevelSelectionScene`, extended `SceneNavigator` and `GameScene` (`Back to Levels` return path preserving chapter context and Next Level flow), and removed `TemporaryLevelsDialog.ts`.
- Added comprehensive unit & integration test suites (`tests/unit/level-selection/*` and `tests/integration/LevelSelection.test.ts`).
- Authored `docs/LEVEL_SELECTION.md` and updated `docs/HOME_SCREEN.md`, `docs/DESIGN_SYSTEM.md`, `docs/ARCHITECTURE.md`, `docs/PROGRESS.md`, and `README.md`.

#### Known Limitations & Assumptions (Task 10)

- **No star ratings or scoring yet:** `LevelCard` renders clean completion checkmarks without stars until Task 12 implements scoring and star calculation.
- **In-memory session progress & unlock tracking:** Campaign completion records and unlock animation tracking remain session-scoped until Task 15 implements persistent storage.

### Task 11: Interactive Tutorial and First-Time Player Experience — Completed

- Implemented pure TypeScript tutorial domain and state machine under `src/core/tutorial/` (`TutorialStep`, `TutorialPuzzleFactory`, `TutorialDefinition`, `TutorialState`, `TutorialAction`, `TutorialEvent`, `TutorialEngine`) with 4 handcrafted, `assertValidPuzzle`-verified fixtures and `MatchCalculator`-verified counter demonstration examples (increase, decrease, genuinely unchanged).
- Built session-scoped `TutorialPreferenceService` (`not_seen` / `completed` / `skipped`) and centralised first-time player routing inside `SceneNavigator.ts` (`resolveCampaignLaunchSceneData`) so first-time campaign launches from `HomeScene` or `LevelSelectionScene` automatically present the interactive tutorial while preserving the exact requested destination.
- Extended `GameScene` with explicit `mode: 'tutorial'` reusing the authoritative `GameEngine`, `GameplayBoard`, `GameplayHUD`, curved swap animations, `AnimationCoordinator`, and `VictoryCelebration`, orchestrated by pure `TutorialController`, `TutorialViewStateMapper`, and responsive `TutorialLayout`.
- Created reusable tutorial UI components (`TutorialHeader`, `TutorialProgressIndicator`, `TutorialInstructionPanel`, `TutorialSpotlight`, `TutorialPointer`, `TutorialCompletionOverlay`) and restrained reduced-motion-aware animations (`SpotlightAnimation`, `PointerAnimation`), plus a working **How to Play** replay button inside `TemporarySettingsDialog`.
- Added unit and end-to-end integration tests (`tests/unit/tutorial/*`, `tests/integration/TutorialFlow.test.ts`), authored `docs/TUTORIAL.md` (with Mermaid state diagram), and updated `ARCHITECTURE.md`, `GAMEPLAY_SCREEN.md`, `HOME_SCREEN.md`, `LEVEL_SELECTION.md`, `PROGRESS.md`, and `README.md`.

#### Known Limitations & Assumptions (Task 11)

- **Session-only tutorial preference:** Tutorial completion/skip status persists across scenes during the active browser session and resets on page reload until Task 15 implements persistent storage.

### Task 12 — Victory Screen, Scoring and Achievement Feedback

**Status:** Complete

#### Completed Work

- Added pure, Phaser-free scoring and rating modules under `src/core/scoring/` (`ScoringConfig`, `ScoreValidator`, `EfficiencyCalculator`, `StarRatingCalculator`, `ScoreCalculator`) and domain models under `src/core/models/` (`StarRating`, `ScoreBreakdown`, `AttemptResult`, `PersonalBestResult`) with `scoringPolicyVersion: 1`, difficulty multipliers (`1.0×`–`3.0×`), move-efficiency scoring (`elapsedMs` excluded), minimum score floor of `1`, and strict three-star thresholds (`actualMoves <= minSwaps + 1` → 3★, `<= minSwaps * 2` → 2★, else 1★; `Optimal Solution` badge strictly when `actualMoves === minSwaps`).
- Extended `GameEngine` with `getCompletedScoringMetadata()` so `minimumRequiredSwaps` remains completely hidden during active/paused play and is exposed only once `status === 'completed'`.
- Extended `CompletionRecord`, `ProgressionEvent`, `ProgressionValidator`, `ProgressionEngine`, and `ProgressionController` with backwards-compatible optional `bestScore`, `bestStarRating`, `scoringPolicyVersion`, deterministic `comparePersonalBest()`, and dynamic `CampaignAchievementSummary` / `ChapterStarSummary` (`maxAvailableStars = totalLevels * 3`).
- Extended `StarRating` (`src/design-system/components/indicators/StarRating.ts`) with hollow outlined empty stars and `playSequentialReveal()`, built pure `VictoryLayout` (including two-column compact landscape mode), reveal animators (`StarRevealAnimator`, `ScoreRevealAnimator`), and production Victory components (`VictoryOverlay`, `ScoreDisplay`, `AttemptStatistics`, `PersonalBestIndicator`, `VictoryMilestoneBanner`).
- Replaced the temporary completion modal in `GameScene` with `VictoryOverlay`, committing deterministic attempt results immediately upon completion and supporting Campaign, Practice (`New Puzzle` vs `Replay`), Chapter Completion, and Campaign Completion (`Shuffle Master!` + optional `Perfect Campaign`) flows.
- Integrated real earned stars and personal best scores into `LevelSelectionScene` (`LevelCard` star display on completed levels, `LevelPreviewDialog`, `ChapterProgress`, `CampaignProgressSummary`) and `HomeScene` (`CampaignProgressCard`), without fabricating stars for legacy records.
- Added comprehensive unit and end-to-end integration tests (`tests/unit/scoring/*`, `tests/unit/victory/*`, `tests/integration/VictoryFlow.test.ts`), authored `docs/SCORING.md` and `docs/VICTORY_SCREEN.md`, and verified all screens visually in headless Chrome.

#### Known Limitations & Assumptions (Task 12)

- **Session-only scoring & progression records:** All earned stars, personal best scores, and campaign achievement summaries remain in memory via `ProgressionController` and reset on page reload until **Task 15** implements persistent storage.
- **No audio or haptic playback yet:** Star reveal, score count-up, and victory celebrations are visual-only until **Task 14** integrates audio playback.

### Task 13 — Production Pause Menu and Centralised Settings

**Status:** Complete

#### Completed Work

- Implemented pure, Phaser-free settings domain under `src/core/settings/` (`GameSettings`, `MotionPreference`, `SettingsDefaults`, `SettingsAction`, `SettingsValidator`, `SettingsReducer`) with immutable snapshots, `schemaVersion: 1`, JSON serialisation, and the accessibility invariant that OS `prefers-reduced-motion: reduce` is never weakened by an in-game toggle.
- Added shared application-level `SettingsService`, extended `MotionPreferenceService` to resolve effective reduced motion from `SettingsService` + browser media query, added capability-aware `GamePlatform.isVibrationSupported?()` on `BrowserGamePlatform` (without invoking `navigator.vibrate()`), and created `GameplayLifecycleCoordinator` managing an idempotent set of overlapping suspension reasons (`manual_pause`, `settings_overlay`, `confirmation_dialog`, `browser_hidden`, `platform_suspended`, `scene_inactive`).
- Refactored `GameplayController` and `TutorialController` onto `GameplayLifecycleCoordinator` so overlapping manual pause + browser/platform suspension never contradict one another and `GameplayClock` accurately excludes all suspended durations.
- Built production pause & settings components (`PauseOverlay`, `PauseStatistics`, `RestartConfirmation`, `ExitConfirmation`, `SettingsOverlay`, `SettingsSection`, `SettingsToggleRow`, `SettingsNavigationRow`), pure responsive layouts (`PauseLayout`, `SettingsLayout`, including compact two-column landscape mode), and destructive confirmation emphasis in `Modal`/`ConfirmDialog`.
- Replaced temporary pause modals in `GameScene` and removed superseded `TemporarySettingsDialog` from `HomeScene`, sharing one `SettingsService` and `SettingsOverlay` across Home, Gameplay Pause, and Tutorial Pause (including `How to Play` replay confirmation during active gameplay, `About Bottle Shuffle`, and `Reset Settings` confirmation).
- Added unit and end-to-end integration tests (`tests/unit/settings/*`, `tests/unit/lifecycle/*`, `tests/integration/PauseSettingsFlow.test.ts`), authored `docs/SETTINGS.md` and `docs/GAMEPLAY_LIFECYCLE.md`, and verified all overlays visually in headless Chrome.

#### Known Limitations & Assumptions (Task 13)

- **Audio & vibration playback deferred (Task 14):** Music, Sound Effects, and Vibration toggles manage shared preferences only; actual audio assets, playback, and haptic API calls will be added in **Task 14**.
- **Session-only settings (Task 15):** Settings persist across scene transitions, overlays, restarts, and replays within the active session, and reset on page reload until **Task 15** implements persistent save storage.

### Task 14 — Sound Effects, Background Music and Haptic Feedback

**Status:** Complete

#### Completed Work

- Generated 15 original, zero-copyright-risk audio assets via `scripts/generate-audio.mjs` (13 tactile SFX totaling **77.2 KB** and 2 seamless stereo music loops — `menu-theme.m4a` and `gameplay-theme.m4a` — totaling **208.9 KB**; **286.2 KB** combined) under `public/assets/audio/`, documented in `public/assets/audio/ATTRIBUTION.md`.
- Added `AUDIO_ASSET_KEYS` to `src/game/assets/AssetKeys.ts`, centralised `AudioCatalog` and `AudioConfig` under `src/services/audio/`, and wired `queueEssentialAudioAssets` (preloaded in `BootScene`) and `queueDeferredMusicAssets` (non-blocking post-boot load via `SceneAudioCoordinator`) into `AssetManifest.ts`.
- Implemented shared application-level `AudioService`, `PhaserAudioBackend` (scene-independent crossfade timers, WebAudio/Phaser unlock handling, safe missing-asset isolation), and pure `AudioFeedbackMapper`, bound to `SettingsService` (`musicEnabled`, `soundEffectsEnabled`) and `GamePlatform` (`isAudioEnabled`, `onAudioEnabledChange`, `onPause`, `onResume`) with concurrency limits (max 6 SFX, max 2 per sound), cooldowns, priority eviction, and overlapping suspension (`manual_pause` pauses music and gameplay SFX while permitting Pause UI clicks; `browser_hidden`/`platform_suspended` silences everything).
- Extended `GamePlatform` / `BrowserGamePlatform` with safe optional `vibrate?()` and `cancelVibration?()`, and implemented optional capability-aware `HapticService` + `PlatformHapticBackend` (`bottle_select: 10ms`, `bottle_land: 15ms`, `match_positive: 20ms`, `victory: [30, 40, 30]`) defaulting to disabled, cancelling on disable/suspend, and prioritising victory cues.
- Added animation-synchronised landing (`BottleSwapAnimation.onLanding` / `GameplayBoard.animateSwap`) and star-reveal (`StarRevealAnimator.onStarRevealed` / `VictoryOverlay`) hooks, implemented `GameplayAudioController` and `SceneAudioCoordinator`, and integrated audio & haptics across `HomeScene`, `LevelSelectionScene`, `GameScene` (standard & tutorial modes), `SettingsOverlay`, and `main.ts`.
- Built development-only `AudioShowcaseScene` (`?scene=audio`, dynamically imported inside `import.meta.env.DEV` and excluded from production builds).
- Added unit and integration tests (`tests/unit/audio/AudioService.test.ts`, `tests/unit/audio/AudioFeedbackMapper.test.ts`, `tests/unit/haptics/HapticService.test.ts`, `tests/integration/AudioLifecycle.test.ts`) and authored `docs/AUDIO.md` and `docs/HAPTICS.md`.

#### Known Limitations & Assumptions (Task 14)

- **Original procedural audio synthesis:** All 15 audio files are generated offline via `scripts/generate-audio.mjs` (100% original, zero external dependencies). Studio-composed acoustic loops or foley recordings can drop in cleanly later via `public/assets/audio/` without code changes.
- **Session-only settings (Task 15):** Audio and vibration toggles persist across scenes during the active session and reset on reload until **Task 15** implements persistent storage.
- **YouTube Playables SDK audio binding (Task 17):** `AudioService` already enforces `GamePlatform.isAudioEnabled()` / `onAudioEnabledChange`; concrete `ytgame.system` wiring is deferred to **Task 17**.
- **Physical device verification:** Automated tests and headless Chrome verified asset loading, showcase rendering, and logic paths; subjective audio listening and physical Android vibration hardware checks require manual device testing.

### Task 15 — Progress Persistence and Save-Data Architecture

**Status:** Complete

#### Completed Work

- Implemented pure, Phaser-free persistence domain under `src/core/persistence/` (`SaveSchemaVersion`, `SaveMetadata`, `SaveData`, `SaveError`, `SaveValidationResult`, `SaveDataFactory`, `SaveDataValidator`) using authoritative `schemaVersion: 1`, `gameId: 'bottle-shuffle'`, compact `PersistedLevelRecord` maps without redundant derived fields, campaign prerequisite consistency checks, unsafe object-key rejection, and partial-section recovery.
- Added platform-independent asynchronous `SaveStorage` contract (`src/platform/contracts/SaveStorage.ts`), standalone browser LocalStorage adapter (`BrowserSaveStorage`, key `bottle-shuffle.save`, safe availability probing, quota/security error mapping, multi-tab `storage` event notifications, never auto-deletes unreadable saves), and deterministic `InMemorySaveStorage` (`src/platform/memory/InMemorySaveStorage.ts` & `tests/helpers/InMemorySaveStorage.ts`).
- Implemented `SaveSerializer`, sequential non-mutating `SaveMigrationRegistry`, `SaveStateMapper`, `SaveStatus`, shared application-owned `SaveService` (bounded 2000 ms startup load with stale-response `initEpoch` guard, single-writer serialized write queue with revision coalescing, 300 ms normal debounce vs immediate high-priority saves, unchanged-content skipping, bounded retries, multi-tab conflict protection, corrupted/future-version preservation), and `SaveCoordinator` bound to `ProgressionController`, `SettingsService`, `TutorialPreferenceService`, and `GamePlatform` pause/resume lifecycle.
- Integrated startup restoration into `src/main.ts` ahead of `MotionPreferenceService`, `AudioService`, `HapticService`, `LevelUnlockTracker`, and scene creation, plus unobtrusive one-time warning toasts via `SaveStatusToastCoordinator` in `HomeScene` and `GameScene`.
- Built development-only `SaveShowcaseScene` (`?scene=save`, dynamically imported inside `import.meta.env.DEV`, isolated in-memory storage, excluded from production bundles).
- Measured actual UTF-8 serialized payload sizes: **323 bytes** (empty campaign) and **7,080 bytes / 6.91 KiB** (fully completed 50-level campaign, well below the 32 KiB engineering target).
- Added comprehensive unit & integration tests (`tests/unit/persistence/*`, `tests/integration/SaveRestoreFlow.test.ts`), authored `docs/PERSISTENCE.md` (with 3 Mermaid diagrams), and updated all architecture and feature docs.

#### Known Limitations & Assumptions (Task 15)

- **Unfinished attempts not persisted:** Reloading mid-puzzle starts a fresh attempt of the same deterministic puzzle with 0 moves and 0 active time while preserving all historical completed levels, stars, scores, settings, and tutorial completion.
- **Standalone browser storage only (Task 17):** `BrowserSaveStorage` uses `localStorage` for standalone web development; verified YouTube Playables host storage integration and platform quota verification are deferred to **Task 17**.
- **Single-writer multi-tab policy:** If another tab writes a newer save revision, automatic writes pause (`status: 'conflict'`) rather than performing complex multi-tab merges or silently overwriting newer progress.

### Task 16 — Responsive Layouts and Cross-Device Optimisation

**Status:** Complete

#### Completed Work

- Centralised responsive configuration (`src/config/ResponsiveConfig.ts`), immutable viewport measurement & safe-area normalisation (`src/game/layout/ViewportMetrics.ts`, capping `effectiveDpr` at `2`), canonical 5-profile classifier (`compact-portrait`, `standard-portrait`, `compact-landscape`, `standard-landscape`, `expanded-landscape` in `LayoutProfile.ts` / `LayoutProfileResolver.ts`), responsive typography & spacing tokens (`src/design-system/layout/ResponsiveTokens.ts`), and shared modal constraints (`src/design-system/layout/LayoutConstraints.ts`).
- Implemented `ViewportProvider` contract (`src/platform/contracts/ViewportProvider.ts`), RAF-coalesced `BrowserViewportProvider` (`ResizeObserver` + `window` resize + `visualViewport` + CSS `--sat`/`--sar`/`--sab`/`--sal` safe-area reading), and shared application-owned `ResponsiveLayoutService` (`src/services/ResponsiveLayoutService.ts`), wired into `src/main.ts`, `HomeScene`, `LevelSelectionScene`, and `GameScene` with clean disposal on shutdown/destroy.
- Updated `index.html` to remove global browser zoom locks (`maximum-scale=1.0, user-scalable=no`), declare `:root` safe-area CSS custom properties, and scope `touch-action: none` / `user-select: none` cleanly to `#game-container` and its canvas.
- Consolidated `BottleRackLayout` (`src/game/layout/BottleRackLayout.ts` / `src/game/components/environment/bottleLayout.ts`) to evaluate 1-row vs 2-row visual bottle sizing strictly within both width and height budgets (preserving exact `1:2` ratio) while separating visual dimensions from non-overlapping slot interaction bounds (`hitWidth`, `hitHeight`, `hitRect`) wired into `BottleSprite` and `GameplayBoard`.
- Hardened all screen layout calculators (`GameplayLayout`, `HomeLayout`, `LevelSelectionLayout`, `TutorialLayout`, `VictoryLayout`, `PauseLayout`, `SettingsLayout`) plus `GameplayHeader`, `HomeHero`, `ChapterProgress`, `SettingsOverlay` (bounded scroll mask on ultra-short `320×480` portrait with pinned Header & Done button), and `Modal` across all 14 verification viewports (`320×480` through `1920×1080`) and 4-sided safe areas.
- Built development-only `ResponsiveShowcaseScene` (`?scene=responsive`, dynamically imported inside `import.meta.env.DEV` and verified excluded from production bundles).
- Added deterministic unit & integration tests (`tests/unit/layout/ViewportAndProfile.test.ts`, `tests/unit/layout/BottleRackLayoutMatrix.test.ts`, `tests/unit/layout/ScreenLayoutsMatrix.test.ts`, `tests/integration/ResponsiveGameplay.test.ts`), verified all 14 viewports + live orientation rotations in headless Chrome CDP (`25/25` checks, `0` console/page errors, `0` unintended scrollbars), and authored `docs/RESPONSIVE_LAYOUT.md`.

#### Known Limitations & Assumptions (Task 16)

- **Headless emulation vs physical devices:** All 14 viewports, safe-area computations, and live orientation transitions were verified via Vitest and headless Chrome CDP emulation; physical iOS notch / Android gesture-bar validation remains a manual device-testing step.
- **HiDPI canvas resolution:** With `Phaser.Scale.RESIZE`, logical coordinates stay 1:1 with CSS pixels while `effectiveDpr` is capped at `2` via `clampEffectiveDpr`; future YouTube Playables WebView hosting integration is deferred to **Task 17**.

### Task 17 — YouTube Playables SDK Integration

**Status:** Complete

#### Completed Work

- Loaded the official YouTube Playables SDK v1 (`https://www.youtube.com/game_api/v1`) before application scripts in `index.html`, verified execution order in production `dist/index.html`, and observed live SDK version `1.20261116.0100` in headless Chrome preview.
- Added verified TypeScript declarations (`src/types/youtube-playables.d.ts`), centralised platform configuration (`src/config/PlatformConfig.ts`), explicit `PlatformCapabilities` (`src/platform/contracts/PlatformCapabilities.ts`), injectable `YouTubeSdkClient` (`src/platform/youtube/YouTubeSdkClient.ts`), `YouTubeErrorMapper`, `YouTubeCapabilities`, `YouTubeSaveStorage` (with mandatory load-before-save state machine, well-formed UTF-16 & 3 MiB validation, and zero LocalStorage access), `YouTubePlatform`, `PlatformFactory`, and `GameReadinessService`.
- Upgraded `BootScene` with a lightweight branded loading screen firing `firstFrameReady()` on Phaser's first `POST_RENDER` milestone while cloud/local save restoration runs concurrently, and wired `GameReadinessService` into `HomeScene`, `LevelSelectionScene`, `GameScene`, and `src/main.ts` so `gameReady()` fires once strictly after assets, save restoration, and interactive scene readiness.
- Isolated browser visibility/blur/focus pause listeners from YouTube mode (`useBrowserVisibilityLifecycle: false`) and added Phaser `VISIBLE`/`FOCUS` re-suspension guards in `main.ts` so browser events can never resume a YouTube-suspended loop.
- Added `npm run build:youtube` and `scripts/verify-youtube-build.mjs` verifying SDK script order, zero unauthorized external URLs, zero dev showcases/mocks/source maps, and measured bundle sizes (`1.65 MiB` initial / `430.13 KiB` gzip; `3.44 MiB` total / `2.14 MiB` gzip; `16.18–21.90 MB` JS heap; `firstFrameReady` `611 ms` / `gameReady` `694 ms`).
- Added `tests/helpers/MockYouTubeSdk.ts`, unit suites (`YouTubePlatformAndCapabilities.test.ts`, `YouTubeSaveStorage.test.ts`), and 8-journey + 9-aspect-ratio integration suite (`YouTubePlatformIntegration.test.ts`) bringing total coverage to **69 test files / 285 tests**.
- Authored `docs/YOUTUBE_PLAYABLES.md`, `docs/PLATFORM_COMPLIANCE.md`, and `docs/SDK_TEST_REPORT.md`, and updated all architecture and feature docs.

#### Known Limitations & Assumptions (Task 17)

- **Official hosted Playables SDK Test Suite:** Requires an interactive signed-in browser session pointing `https://developers.google.com/youtube/gaming/playables/test_suite` at `http://localhost:4173/`; manual verification steps are documented in `docs/YOUTUBE_PLAYABLES.md`.
- **Publishing & Certification:** Developer Portal onboarding (Interest Form), store metadata, promotional assets, age ratings, and Google certification review remain manual partner steps outside Task 17.
- **Deferred features:** Advertising, external authentication, multiplayer, score reporting (`ytgame.engagement.sendScore`), and additional language packs remain intentionally disabled for Task 17.

### Task 18 — Advertising and Monetisation Integration

**Status:** Complete

#### Completed Work

- Reviewed official English YouTube Playables monetisation, SDK reference, certification requirements, Developer Portal docs, FAQ, and YouTube Advertiser-Friendly Content Guidelines (verified 2026-11-27), confirming `ytgame.ads.requestInterstitialAd(): Promise<void>`, `ytgame.ads.requestRewardedAd(rewardId: string): Promise<boolean>`, automatic platform pre-roll ads, and strict prohibition of third-party ad networks/IAPs.
- Implemented pure, Phaser/DOM/SDK-free monetisation domain under `src/core/monetization/` (`AdType`, `AdPlacement`, `AdResult`, `AdPlacementPolicy`) enforcing eligible interstitial triggers strictly on completed campaign Victory -> Next Level transitions (coalescing chapter + level boundaries into a single `chapter_transition` opportunity) and keeping active gameplay, pause, settings, tutorial, practice, restart, and replay 100% ad-free.
- Added centralised `src/config/MonetizationConfig.ts`, verified `YouTubeSdkAdsNamespace` declarations in `src/types/youtube-playables.d.ts`, extended `PlatformCapabilities` (`advertisingEnabled`, `interstitialAds`, `rewardedAds`), defined `AdvertisingProvider` (`src/platform/contracts/AdvertisingProvider.ts`), implemented `YouTubeAdvertisingProvider` (delegating exclusively via `YouTubeSdkClient`) and `NoOpAdvertisingProvider` (ad-free standalone browser fallback), and wired both into `YouTubePlatform` and `BrowserGamePlatform`.
- Built single app-owned `AdService`, `AdRequestState`, `AdErrorMapper`, reusable opt-in `RewardedAdService` (with `rewardedUiExposedInProduction: false` and zero unfinished reward buttons in production), and `LevelTransitionCoordinator` (`src/game/navigation/LevelTransitionCoordinator.ts`) orchestrating destination validation, duplicate-tap blocking, bounded `saveService.flush(300)`, restrained `"Preparing next level..."` `VictoryOverlay` transition state, host pause/resume launch deferral, and failure recovery.
- Built isolated development-only `AdvertisingShowcaseScene` (`?scene=ads`, dynamically imported inside `if (import.meta.env.DEV)` and verified absent from production `dist/`), extended `scripts/verify-youtube-build.mjs` to reject leaked dev mocks, unfinished reward copy, and third-party ad SDK strings, and verified `npm run build:youtube` (`1.68 MiB` initial / `435.27 KiB` gzip; `3.47 MiB` total / `2.15 MiB` gzip).
- Added `tests/helpers/MockAdvertisingProvider.ts`, extended `tests/helpers/MockYouTubeSdk.ts`, added unit suites (`tests/unit/advertising/*`) and 9-journey integration suite (`tests/integration/AdvertisingIntegration.test.ts`), verified **73/73 test files (311/311 tests)** and headless Chrome dev/production captures (`0` console/page errors, `?scene=ads` inaccessible in production), and authored `docs/MONETIZATION.md` (with 5 Mermaid diagrams) and `docs/ADVERTISING_TEST_REPORT.md`.

#### Known Limitations & Assumptions (Task 18)

- **Official Playables SDK Test Suite & Live Ad Fill:** Automated verification used deterministic mocks and local headless Chrome preview; live interstitial delivery, ad fill, host suspension timing during real ads, and official Test Suite validation require an interactive signed-in Google session and Developer Portal staging release.
- **Rewarded Mechanics Deferred:** `RewardedAdService` is tested and ready for future explicitly approved opt-in assistance mechanics, but zero rewarded buttons or hint/undo features are exposed in production (`rewardedUiExposedInProduction: false`).
- **Portal Approval & Revenue-Sharing Eligibility:** Developer Portal monetisation toggles, advertiser-friendly content review, and revenue-sharing eligibility remain manual partner processes managed by Google/YouTube.

### Task 19 — Comprehensive Testing, Quality Assurance and Performance Optimisation

**Status:** Complete

#### Completed Work

- Captured full pre-optimisation QA baseline (`docs/QA_BASELINE.md`) including build, test, startup (`firstFrameReady` `216 ms`, `gameReady` `301 ms`), 90-frame distribution (`60.0 FPS`), JS heap (`17.39 MB`), and dependency audit (`0` vulnerabilities).
- Built deterministic QA scripts under `scripts/`: `validate-campaign.mjs` (validates & programmatically solves all **50/50** campaign levels in exact `minimumSwapDistance` swaps, verifies 6 chapters + 1 campaign completion + no `level-051`, measures UTF-8 save sizes `323 B`–`8,179 B`), `stress-test-puzzles.mjs` (**12,000/12,000** puzzles across all 6 tiers with `0` failures and `0.581 ms` slowest generation), `validate-assets.mjs` (`39` runtime assets verified, `0` missing/unused/duplicates), and `analyse-bundle.mjs`.
- Expanded Vitest suite to **77/77 test files (323/323 tests)** with exhaustive small-permutation match verification (`3!`, `4!`, `5!` + sampled `6/8/10`), 150-sequence state-machine fuzzing, scoring/progression boundary matrices, persistence serializer/storage edge cases, and a **120-cycle long-session & adversarial soak test** verifying zero SDK listener leaks.
- Configured `@vitest/coverage-v8` in `vitest.config.ts` achieving **83.85% overall line coverage** (**95.32%** core puzzle engine, **88.10%** scoring & progression, **82.66%** platform & advertising, **93.75%** `GameplayLifecycleCoordinator`).
- Introduced `@playwright/test` (`playwright.config.mjs`, `tests/e2e/bottle-shuffle.spec.ts`) verifying **10/10** production-build E2E tests across Desktop (`1280×720`) and Mobile Touch (`390×844`), including returning-player 49-level fixture restore, YouTube Playables ordered readiness & zero-LocalStorage enforcement, extreme aspect ratios (`9:32`, `32:9`, `1:1`), reduced motion, and dev showcase exclusion.
- Resolved all discovered P2 defects (`DEF-001` favicon 404 via `public/favicon.svg`, `DEF-002` `#game-container` `tabindex="0"` + `aria-label`, `DEF-003` asset & chunk optimisation): converted 10 bottle sprites + `selection-glow` to RGBA WebP (`-84.2%` image payload) and split `vendor-phaser` chunk in `vite.config.ts`, shrinking total `dist/` from `3.47 MiB` (`2.15 MiB` gzip) to **`2.29 MiB` (`999.02 KiB` gzip, `-54.5%` gzipped)** with `0` Vite warnings and `0` failed network requests.
- Configured GitHub Actions CI (`.github/workflows/ci.yml`, `.github/workflows/nightly-stress.yml`), added full npm QA scripts (`test:coverage`, `test:e2e`, `test:stress`, `validate:campaign`, `validate:assets`, `analyse:bundle`, `verify:build`, `qa`), and authored `docs/QA_BASELINE.md`, `docs/QA_TEST_PLAN.md`, `docs/DEFECT_REGISTER.md`, `docs/PERFORMANCE_REPORT.md`, `docs/ACCESSIBILITY_AUDIT.md`, and `docs/QA_REPORT.md`.

#### Known Limitations & Release Blockers (Task 19)

- **Official Hosted Playables SDK Test Suite:** Blocked in automated CLI environment; requires interactive signed-in desktop browser session and staging release verification before launch.
- **Cross-Browser & Physical Mobile QA:** Firefox, WebKit/Safari, and physical iOS/Android YouTube WebView testing (plus low-end mobile FPS/3G startup profiling) were not executed in this environment.
- **Human Playtesting & Subjective Audio Review:** Pre-release manual checklist documented in `docs/QA_TEST_PLAN.md`; not yet executed with human testers.
- **Canvas Accessibility Limitations:** Full screen-reader traversal of Phaser in-canvas UI controls is not available without a mirrored DOM accessibility layer (honestly documented in `docs/ACCESSIBILITY_AUDIT.md`).

### Task 20 — Production Release, Packaging and YouTube Playables Certification Preparation

**Status:** Complete (`1.0.0-rc.1` Release Candidate Generated & Internally Verified)

#### Completed Work

- Reviewed current official English YouTube Playables packaging, certification, Developer Portal, and monetisation documentation (verified 2026-11-27).
- Centralised release version **`1.0.0-rc.1`** across `package.json`, `src/config/appConfig.ts` (`APP_VERSION`, `CAMPAIGN_CATALOG_VERSION`), `release/metadata/game-metadata.json`, and `CHANGELOG.md`, while keeping Save Schema (`v1`), Puzzle Generator (`1.0.0`), Scoring Policy (`v1`), and Campaign Catalogue (`1.0.0`) decoupled.
- Authored `THIRD_PARTY_NOTICES.md` (Phaser 3.90 MIT full text, YouTube Playables SDK v1, Fredoka & Nunito SIL OFL 1.1, original project artwork/audio, dev-only tooling) and `CHANGELOG.md`.
- Generated original promotional icons (`512×512`, `1024×1024`) and multi-aspect thumbnails (`16:9`, `1:1`, `3:4`) with editable SVG masters (`scripts/generate-promotional-assets.mjs`), visually verified zero third-party/YouTube branding, and registered all 11 promotional assets (5 artwork PNGs + 6 real production screenshots) in `release/promotional/promotional-manifest.json`.
- Built reproducible release validation, packaging, and smoke-testing scripts (`scripts/validate-metadata.mjs`, `scripts/verify-release.mjs`, `scripts/package-release.mjs`, `scripts/smoke-test-release.mjs`) and npm scripts (`validate:metadata`, `verify:release`, `package:release`, `smoke:release`, `release:check`).
- Packaged **`release/packages/bottle-shuffle-1.0.0-rc.1.zip`** (`0.98 MiB` compressed / `2.29 MiB` uncompressed across `47` files, `index.html` at archive root), `.sha256` (`51713cb9e8c935ae340d51dc50371df9fa50b79fbb4e09070f0c708c66f91466`), and `-manifest.json`.
- Executed extracted-ZIP HTTP smoke test (`npm run smoke:release`), confirming SHA-256 integrity, real Home/Levels/Campaign/Expert/Portrait rendering, 6 production screenshots captured directly from the extracted archive, ordered `firstFrameReady -> gameReady`, `0` console errors, and `0` failed requests.
- Added manual/tag-triggered `.github/workflows/release.yml` (minimal `contents: read` permissions; uploads ZIP/SHA/manifest artefacts; never auto-publishes) and authored `docs/RELEASE_PROCESS.md`, `docs/CERTIFICATION_CHECKLIST.md`, `docs/SUBMISSION_GUIDE.md` (including draft owner-review privacy policy), `docs/KNOWN_LIMITATIONS.md`, and `docs/RELEASE_REPORT.md`.

#### Remaining External Gates (Owner Actions Before Public Submission)

- Replace `[OWNER_SUPPORT_EMAIL_REQUIRED]` and `[OWNER_PRIVACY_POLICY_URL_REQUIRED]` in `release/metadata/game-metadata.json` (and confirm provisional publisher name `CrowdArcade`).
- Run Google's hosted **YouTube Playables SDK Test Suite** in an interactive signed-in browser session.
- Execute Firefox, WebKit/Safari, physical iOS/Android YouTube app WebView QA, and human playtesting.
- Confirm exact per-slot thumbnail pixel dimensions inside the authenticated Developer Portal **Details** step, complete Age Rating, and submit manually for Google certification review.

## Roadmap Status

All 20 planned engineering tasks (**Tasks 01–20**) are complete.

---

## Post-Task-20 — Campaign Progression Redesign (`Catalogue v2.0.0`, `Save Schema v2`)

### Completed

- **Core Challenge Engine (`src/core/`):**
  - Added `src/core/models/ChallengeMode.ts` defining `'classic' | 'timed' | 'limited_moves' | 'combined'`, `AttemptFailureReason` (`'time_expired' | 'moves_exhausted'`), and `validateChallengeObjective`.
  - Extended `PuzzleStatus` (`'failed'`), `GameAction` (`'EXPIRE_TIMER'`), `GameEvent` (`'PUZZLE_FAILED'`), `GameError` (`'PUZZLE_ALREADY_FAILED'`, `'MOVE_LIMIT_REACHED'`), `PuzzleState`, `PublicGameState`, `SwapValidator`, `GameStateFactory`, `GameReducer`, and `GameEngine` while keeping `src/core/` 100% pure TypeScript.
  - Enforced move-limit semantics (selection/deselection free, `movesRemaining >= 0`, winning on the final permitted move succeeds, unsolved 0-move swaps fail) and timer-vs-completion race protection.
- **Redesigned 50-Level Campaign (`v2.0.0`):**
  - Added `src/core/levels/CampaignBalanceConfig.ts` (`CAMPAIGN_CATALOG_VERSION = '2.0.0'`, `BOTTLE_COUNT_PUZZLE_DEFAULTS` for `3..10` bottles, and configurable Chapter 2–6 time/move limits).
  - Rebuilt `DEFAULT_CHAPTER_SPECS` in `src/core/levels/LevelFactory.ts`:
    - **Ch 1 — First Steps (1–8):** Classic, `3..10` bottles (+1 bottle per level).
    - **Ch 2 — Beat the Clock (9–16):** Timed, `3..10` bottles (`30, 45, 60, 90, 120, 150, 180, 210`s).
    - **Ch 3 — Speed Mastery (17–24):** Timed, `3..10` bottles (`20, 30, 45, 60, 90, 120, 150, 180`s).
    - **Ch 4 — Every Move Counts (25–32):** Limited Moves, `3..10` bottles (`6, 10, 15, 20, 26, 32, 38, 45` moves).
    - **Ch 5 — Double Trouble (33–40):** Combined, `3..10` bottles (`30s/7m` through `215s/48m`).
    - **Ch 6 — Shuffle Master (41–50):** Ten unique high-intensity combined challenges (`6..10` bottles).
- **Persistence `v2` & Migration:**
  - Bumped `CURRENT_SAVE_SCHEMA_VERSION` to `2`, added `campaignCatalogVersion: '2.0.0'` and `seenChallengeIntros` to `SaveData`, added `ChallengeIntroService`, and registered `MIGRATE_V1_TO_V2_CAMPAIGN_REDESIGN` in `SaveMigrationRegistry.ts`.
  - Pre-release `v1` saves preserve player `settings` and `tutorial` completion while cleanly resetting incompatible pre-redesign `v1` campaign progression so old records are never silently bound to materially different levels.
- **Countdown Timer, HUD, Failure & Challenge Intro UI:**
  - Extended `GameplayClock` with monotonic countdown support, `GameplayLifecycleCoordinator` with `'challenge_intro'` suspension, `GameplayController` with race-free deadline checks and failure handling, `GameplayLayout` with countdown bar geometry, and `GameplayHUD` across all four challenge modes with amber/red urgency feedback respecting Reduced Motion.
  - Added reusable `FailureOverlay` (`"Time's Up!"` / `"Out of Moves!"`, Retry / Levels / Home, zero lives/energy/mandatory ads) and `ChallengeIntroOverlay` (shown once per mode with countdown paused).
  - Updated `LevelSelectionViewStateMapper`, `LevelCard`, `LevelGrid`, `ChapterBanner`, and `LevelPreviewDialog` with chapter challenge modes, bottle ranges, and per-level time/move indicators.
- **Validation, Regression Tests & Documentation:**
  - Extended `scripts/validate-campaign.mjs` with both mathematical optimal solving and an automated blind hidden-sequence deduction simulator (zero access to `targetSequence`), updated `scripts/calibrate-levels.mjs`, added `tests/unit/campaign/CampaignRedesignRegression.test.ts`, and updated all 10 campaign/engine/UI/persistence/QA docs.

### Trade-Offs & Remaining Limitations

- **Human Playtesting Pending:** Automated mathematical and blind-deduction heuristic simulations confirmed `50/50` solvability, `50/50` unique puzzles, `10/10` unique Chapter 6 configs, and reasonable time budgets (`49/50` `OK` at `3 s/swap`, Level 24 `186s` vs `180s` tight under naive probing), while flagging `13/50` tight heuristic move counts (primarily Chapter 6 mastery). Real human playtesting has **not** yet been conducted; all tuning numbers remain centralised in `src/core/levels/CampaignBalanceConfig.ts` for fast iteration.
- **Release Package Refresh:** Because `dist/` changed with Catalogue `v2.0.0` / Save Schema `v2`, the existing `1.0.0-rc.1` ZIP archive reflects the pre-redesign build and should be re-packaged (`1.0.0-rc.2`) once human playtesting and tuning are finalised. No release has been published automatically.
