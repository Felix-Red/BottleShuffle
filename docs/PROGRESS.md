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

- **Simple swap presentation:** Swaps currently use a clean linear/cubic position tween; curved swap arcs, celebratory effects, and audio feedback are deferred to Task 07+.
- **Temporary overlays & home screen:** Pause, completion, and home screens are intentionally functional development layouts; final home design, scoring/stars, level unlocking, settings persistence, drag-and-drop swapping, and YouTube Playables SDK integration remain deferred to subsequent tasks.
- **Canvas accessibility:** Basic keyboard slot navigation and focus highlighting are implemented, while full screen-reader accessibility over canvas remains a known Phaser limitation.

## Upcoming Tasks (Planned)

- **Polish, Animations & Audio (`src/game/` & `src/services/`):** Curved swap trajectories, juice/celebration feedback, drag-and-drop support, and locally bundled SFX/music respecting `GamePlatform` audio preferences.
- **Level & Difficulty Progression:** Level definitions, bottle counts, scoring/move tracking, and persistence service built on `GamePlatform`.
- **Interactive Gameplay Scene:** Wiring `BottleRack`, `BottleSprite`, `HiddenSequenceRack`, `MatchCounter`, swap animations, and input handling to `src/core/`.
- **Audio System:** Local SFX/music playback respecting `GamePlatform` audio preferences and pause/resume lifecycle events.
- **Final Screens & Flows:** Production Home screen, level selection, settings, and victory reveal flows.
- **YouTube Playables Integration & Certification Readiness:** `YouTubeGamePlatform` adapter, SDK script integration, bundle optimisation, and SDK Test Suite compliance checks.
