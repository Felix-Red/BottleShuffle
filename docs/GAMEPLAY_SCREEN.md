# Gameplay Screen & Engine Integration — Bottle Shuffle

This document describes the end-to-end architecture, scene initialisation flow, presentation controller, responsive landscape/portrait layouts across all four challenge modes, countdown timer lifecycle, contextual introductions, failure overlay, input handling, and engine boundaries for **Bottle Shuffle's** gameplay screen (`GameScene`).

---

## 1. Overview

`GameScene` (`src/game/scenes/GameScene.ts`) integrates the pure core domain (`PuzzleGenerator`, `GameEngine`, `LevelChallengeObjective`), design-system UI components (`MatchCounter`, `StatCard`, `ProgressBar`, `IconButton`, `Modal`, `ConfirmDialog`, `PrimaryButton`, `OutlineButton`, `TextButton`), visual bottle environment (`GameBackground`, `BottleRack`, `BottleSprite`, `HiddenSequenceRack`), active gameplay clock (`GameplayClock`), lifecycle coordination (`GameplayLifecycleCoordinator`), and overlays (`ChallengeIntroOverlay`, `PauseOverlay`, `VictoryOverlay`, `FailureOverlay`) into a cohesive casual puzzle experience across landscape and portrait viewports.

---

## 2. Scene Initialisation Flow

1. `HomeScene` or `LevelSelectionScene` (or dev-only `/?scene=tutorial`, `/?scene=game&level=level-001`, `/?scene=game&difficulty=...&seed=...`) starts `SCENE_KEYS.GAME` with typed `GameplaySceneData` distinguishing `mode: 'campaign'`, `mode: 'practice'`, and `mode: 'tutorial'`.
2. In **tutorial mode**, `GameScene` delegates instructional progression and input filtering to `TutorialController` while reusing the exact same `GameEngine`, `GameplayHUD`, `GameplayBoard`, curved swap animations, `AnimationCoordinator`, and `VictoryCelebration`. See [docs/TUTORIAL.md](./TUTORIAL.md).
3. In **campaign mode**, `GameplayController` calls `ProgressionController.beginCampaignAttempt(levelId)` to validate that the level is unlocked, issue a unique campaign `attemptId`, retrieve its `LevelDefinition` (including `challengeMode`, `timeLimitSeconds`, and `moveLimit`), and generate its deterministic puzzle on demand via `generateLevelPuzzle`. Locked or unknown levels show a player-friendly error recovery modal.
4. In **practice mode**, `GameplayController` resolves the chosen difficulty (`resolveGameplayLaunch`) and generates a standalone `classic` puzzle via `generatePuzzle` without touching campaign progression.
5. On success, `GameScene` computes the responsive `GameplayLayout` (including `showCountdownBar` for `timed` and `combined` levels), constructs `GameBackground`, `GameplayHeader`, `GameplayHUD`, `GameplayBoard`, `GameplayInstructions`, and overlays, binds resize/keyboard/platform lifecycle listeners, starts the `100ms` monotonic timer poll (`GameplayConfig.timerPollIntervalMs`), and calls `controller.start()`.
6. **Contextual Challenge Introduction:** If the level introduces a previously unseen challenge mode (`timed` at Level 9, `limited_moves` at Level 25, or `combined` at Level 33), `GameplayController` opens `ChallengeIntroOverlay` (`overlayMode: 'challenge_intro'`) and suspends `GameplayClock` via `GameplayLifecycleCoordinator` (`'challenge_intro'`) until the player dismisses it.
7. On attempt termination:
   - **Victory (Campaign):** freezes `GameplayClock` immediately upon swap acceptance, records completion idempotently through `ProgressionController.completeActiveAttempt(...)`, queues a high-priority save, plays `VictoryCelebration`, and presents `VictoryOverlay` with score, 1–3 stars, personal best badges, and **Next Level** / **Replay** / **Levels** / **Home**.
   - **Failure (Campaign — Time Expired or Out of Moves):** stops `GameplayClock`, cancels active board animations, abandons the active attempt without awarding stars/scores/unlocks or erasing prior records, and presents `FailureOverlay` with **Retry**, **Levels**, and **Home**.
   - **Practice Victory:** plays `VictoryCelebration` and presents **Play Again** and **Home** without altering campaign progression.

---

## 3. GameplayController & View-State Model

- **`GameplayController` (`src/game/gameplay/GameplayController.ts`):** Pure TypeScript (zero Phaser imports, fully unit-testable in Node) orchestrating:
  - Delegation of all selection, swap, pause, resume, timer expiry, failure, restart, and completion rules to `GameEngine`.
  - Swap transition locking (`isSwapping`) so rapid taps during a visual swap cannot queue unintended swaps.
  - Race-free deadline checks before tap acceptance and immediate clock freezing upon winning swap acceptance.
  - Overlay coordination (`none | challenge_intro | pause | settings | restart_confirm | exit_confirm | completed | failed | error`).
  - Active elapsed & countdown time coordination via `GameplayClock` and `GameplayLifecycleCoordinator`.
  - Keyboard slot focus navigation (`ArrowLeft`, `ArrowRight`, `Enter`/`Space`, `Escape`).
- **`GameplayViewState` (`src/game/gameplay/GameplayViewState.ts`):** Contains strictly player-visible presentation fields (`currentSequence`, `selectedSlotIndex`, `focusedSlotIndex`, `displayedMatchCount`, `totalBottleCount`, `moveCount`, `bestMatchCount`, `challengeMode`, `timeLimitSeconds`, `moveLimit`, `movesRemaining`, `remainingTimeMs`, `countdownProgress`, `countdownUrgency`, `isLowMoves`, `failureReason`, `formattedTime`, `status`, `inputEnabled`, `isSwapping`, `instructionText`, `matchFeedback`, `overlayMode`, `challengeIntroMode`, `errorMessage`). Never includes `targetSequence`, individual match positions, `seed`, or swap distance.

---

## 4. Gameplay HUD Across All Four Challenge Modes

`GameplayHUD` (`src/game/components/gameplay/GameplayHUD.ts`) adapts cleanly to each level's `challengeMode` without visual clutter:

| Challenge Mode  | Left `StatCard`        | Centre `MatchCounter`       | Right `StatCard`                | Countdown `ProgressBar`   |
| --------------- | ---------------------- | --------------------------- | ------------------------------- | ------------------------- |
| `classic`       | `MOVES` (`N`)          | Aggregate matches (`M / K`) | `TIME` (`MM:SS` elapsed)        | Hidden                    |
| `timed`         | `MOVES` (`N`)          | Aggregate matches (`M / K`) | `TIME LEFT` (`MM:SS` remaining) | Visible beneath HUD cards |
| `limited_moves` | `MOVES LEFT` (`R / L`) | Aggregate matches (`M / K`) | `TIME` (`MM:SS` elapsed)        | Hidden                    |
| `combined`      | `MOVES LEFT` (`R / L`) | Aggregate matches (`M / K`) | `TIME LEFT` (`MM:SS` remaining) | Visible beneath HUD cards |

### Urgency & Reduced-Motion Feedback

- **Countdown bar & warning thresholds (`GameplayConfig.ts`):**
  - `normal`: default cyan/teal accent when `remainingRatio > 0.30` and `remainingMs > 10,000`.
  - `warning` (amber): when `remainingRatio <= 0.30` or `remainingMs <= 10,000`.
  - `critical` (crimson/red): when `remainingRatio <= 0.15` or `remainingMs <= 5,000`, adding a subtle scale pulse on the timer card **only when `reducedMotion` is disabled** (colour and progress-bar changes always remain visible).
- **Low-moves warning:** On `limited_moves` and `combined` levels, the `MOVES LEFT` card shifts to warning amber when `movesRemaining <= max(2, ceil(moveLimit * 0.25))` and crimson when `movesRemaining <= 1`.
- **Countdown redraw efficiency:** Timer card text updates only when the formatted `MM:SS` string changes, while the countdown progress bar smoothly tracks remaining ratio.

---

## 5. Failure Overlay & Challenge Intro Overlay

- **`FailureOverlay` (`src/game/components/failure/FailureOverlay.ts`):**
  - Reuses the Design System `Modal`, `PrimaryButton`, and `OutlineButton` components.
  - Displays a clear failure title (`"Time's Up!"` for `time_expired`, `"Out of Moves!"` for `moves_exhausted`), level number, final match count (`M / K`), moves used, and time used.
  - Actions: **Retry** (immediate restart of the same deterministic level without lives, cooldowns, energy systems, or mandatory ads), **Levels** (return to `LevelSelectionScene`), and **Home** (return to `HomeScene`).
- **`ChallengeIntroOverlay` (`src/game/components/gameplay/ChallengeIntroOverlay.ts`):**
  - Reuses `Modal` with mode-specific concise copy for `timed`, `limited_moves`, and `combined`.
  - Shown at most once per challenge mode (persisted in `seenChallengeIntros` inside Save Schema `v2`).
  - Suspends `GameplayClock` while visible so players can read calmly without losing seconds.

---

## 6. Responsive Landscape & Portrait Layouts & Safe Areas

Calculated by pure Phaser-free `calculateGameplayLayout()` (`src/game/layout/GameplayLayout.ts`), consuming `createViewportMetrics`, `resolveLayoutProfile`, and `getResponsiveTokens` with 4-sided `SafeAreaInsets`:

- **Landscape (`width >= height`, e.g. `1280×720`, `1920×1080`, `844×390`, `568×320`):**
  - Header across top (`GameplayHeader` with Pause, Level/Chapter/Mode subtitle, Restart).
  - HUD row: Moves / Moves Left (left), Match Counter (centre), Time / Time Left (right), with optional full-width countdown `ProgressBar` tucked cleanly beneath the HUD row on `timed` and `combined` levels.
  - Main board: Single horizontal row of 3–10 bottles on wooden shelf with aligned `HiddenSequenceRack` directly below.
  - Concise instructions along bottom edge.
- **Portrait (`width < height`, e.g. `390×844`, `360×640`, `320×480`):**
  - Header across top.
  - Prominent Match Counter centred below header, followed by Moves / Timer cards side-by-side and optional countdown `ProgressBar` beneath them.
  - Responsive `BottleRack` (2×5 for 10 bottles, 2×4 for 8, 2×3 for 6, 1 row for 3–5, balanced 2-row for 7 and 9) preserving logical slot order `0..N-1` left-to-right then top-to-bottom.
  - Concise instructions at bottom.
- **Resizing safety:** Viewport resizes recalculate layout coordinates and reposition/resize existing sprites, countdown bar, and active overlays without regenerating the puzzle, resetting moves/timer, or mutating the hidden sequence.

---

## 7. Timer, Pause, Restart, Completion & Lifecycle Coordination

- **Active Timer (`src/services/GameplayClock.ts`):** Uses an injectable `MonotonicClock` (`performance.now()` in browsers, fake clock in unit tests). Supports both elapsed tracking (`classic`, `limited_moves`) and countdown tracking (`timed`, `combined`) via optional `timeLimitMs`.
- **Authorised Pause & Suspension:** `GameplayLifecycleCoordinator` independently tracks `manual_pause`, `challenge_intro`, `restart_confirm`, `exit_confirm`, `settings_modal`, `platform_pause`, `window_blur`, `visibility_hidden`, `interstitial_ad`, and `rewarded_ad`. Platform resume never overrides a player's manual pause or active challenge intro.
- **Production Pause & Settings:** `PauseOverlay`, `RestartConfirmation`, `ExitConfirmation`, and `SettingsOverlay` are coordinated through `GameplayLifecycleCoordinator`. See [docs/GAMEPLAY_LIFECYCLE.md](./GAMEPLAY_LIFECYCLE.md) and [docs/SETTINGS.md](./SETTINGS.md).
- **Input & Accessibility:** Supports touch and mouse tap-to-select / tap-to-swap, keyboard slot navigation (`ArrowLeft`/`ArrowRight`, `Enter`/`Space`, `Escape`), and live OS + manual Reduced Motion propagation. See [docs/RESPONSIVE_LAYOUT.md](./RESPONSIVE_LAYOUT.md) and [docs/ANIMATIONS.md](./ANIMATIONS.md).
