# Gameplay Screen & Engine Integration — Bottle Shuffle

This document describes the end-to-end architecture, scene initialisation flow, presentation controller, responsive landscape/portrait layouts, timer lifecycle, input handling, and engine boundaries for **Bottle Shuffle's** gameplay screen (`GameScene`).

---

## 1. Overview

`GameScene` (`src/game/scenes/GameScene.ts`) integrates the pure core domain (`PuzzleGenerator`, `GameEngine`), design-system UI components (`MatchCounter`, `StatCard`, `IconButton`, `Modal`, `ConfirmDialog`, `PrimaryButton`, `OutlineButton`, `TextButton`), visual bottle environment (`GameBackground`, `BottleRack`, `BottleSprite`, `HiddenSequenceRack`), and active gameplay timer (`GameplayClock`) into a playable casual puzzle experience across landscape and portrait viewports.

---

## 2. Scene Initialisation Flow

1. `HomeScene` (or dev-only `/?scene=game&difficulty=...&seed=...`) starts `SCENE_KEYS.GAME` with typed `GameplaySceneData`.
2. `GameplayController` resolves the launch configuration (`resolveGameplayLaunch`), generates a puzzle via `generatePuzzle` (using an injected boundary `SeedProvider` if no explicit seed was provided), and creates an authoritative `GameEngine`.
3. If configuration validation or generation fails, `GameScene` displays a clean error recovery `Modal` with a **Return to Home** action without exposing stack traces.
4. On success, `GameScene` computes the responsive `GameplayLayout`, constructs `GameBackground`, `GameplayHeader`, `GameplayHUD`, `GameplayBoard`, `GameplayInstructions`, and overlays (`pauseModal`, `restartDialog`, `completionModal`), binds resize/keyboard/platform lifecycle listeners, starts the 250ms timer poll, and calls `controller.start()`.

---

## 3. GameplayController & View-State Model

- **`GameplayController` (`src/game/gameplay/GameplayController.ts`):** Pure TypeScript (zero Phaser imports, fully unit-testable in Node) orchestrating:
  - Delegation of all selection, swap, pause, resume, restart, and completion rules to `GameEngine`.
  - Swap transition locking (`isSwapping`) so rapid taps during a visual swap cannot queue unintended swaps.
  - Overlay coordination (`none | pause | restart_confirm | completed | error`), remembering whether restart confirmation was opened from `pause` or `playing`.
  - Active elapsed time coordination via `GameplayClock`.
  - Keyboard slot focus navigation (`ArrowLeft`, `ArrowRight`, `Enter`/`Space`, `Escape`).
- **`GameplayViewState` (`src/game/gameplay/GameplayViewState.ts`):** Contains strictly player-visible presentation fields (`currentSequence`, `selectedSlotIndex`, `focusedSlotIndex`, `displayedMatchCount`, `totalBottleCount`, `moveCount`, `bestMatchCount`, `formattedTime`, `status`, `inputEnabled`, `isSwapping`, `instructionText`, `matchFeedback`, `overlayMode`, `errorMessage`). Never includes `targetSequence`, individual match positions, `seed`, or swap distance.

---

## 4. Screen Regions & Reused Components

- **`GameplayHeader` (`src/game/components/gameplay/GameplayHeader.ts`):** Left Pause `IconButton`, centre level/difficulty title + bottle-count subtitle (never hardcoded to a fake level number), right Restart `IconButton`.
- **`GameplayHUD` (`src/game/components/gameplay/GameplayHUD.ts`):** Reuses `MatchCounter` (aggregate count + segmented progress bar with directional positive/negative feedback), two `StatCard`s (Move Counter with subtle post-swap pulse + Elapsed Timer), reusable `FloatingMatchFeedback` (`+2 matches`, `+1 match`, `No change`, `-1 match`, `-2 matches`), and a bounded positive aggregate sparkle burst (`ParticleBurst`).
- **`GameplayBoard` (`src/game/components/gameplay/GameplayBoard.ts`):** Reuses `BottleRack`, `BottleSprite`, and `HiddenSequenceRack`. Maps `BottleSprite` instances by stable `BottleId` and plays the 3-stage curved swap animation (`BottleSwapAnimation`: anticipation, opposing quadratic Bezier flight with dynamic shadows and optional long-swap trails, and relative squash-and-stretch landing) coordinated through `AnimationCoordinator`. Interrupted transitions (resize, pause, suspend, restart) immediately cancel active tweens/effects and reconcile sprite positions, scales, rotations, and shadows to authoritative `GameEngine` slot indices.
- **`GameplayInstructions` (`src/game/components/gameplay/GameplayInstructions.ts`):** Concise contextual bottom guidance (`Select two bottles to swap.`, `Select another bottle to swap.`, `Swapping bottles...`, `Perfect match!`).
- **Reduced Motion & Celebration:** `GameScene` subscribes to `MotionPreferenceService` (`prefers-reduced-motion` + programmatic overrides) and propagates `AnimationPolicy` live to HUD, board, and overlays. On solve, `VictoryCelebration` renders a short full-rack success glow and bounded star/confetti burst before presenting the completion modal. See [docs/ANIMATIONS.md](./ANIMATIONS.md).

---

## 5. Responsive Landscape & Portrait Layouts

Calculated by pure Phaser-free `calculateGameplayLayout()` (`src/game/layout/GameplayLayout.ts`):

- **Landscape (`width >= height`, e.g. `1280×720`, `1920×1080`, `844×390`):**
  - Header across top.
  - HUD row: Move Counter (left), Match Counter (centre), Timer (right), with temporary delta feedback directly below Match Counter.
  - Main board: Single horizontal row of 3–10 bottles on wooden shelf (automatically splitting to 2 rows only if width would drop bottles below minimum touch size) with aligned `HiddenSequenceRack` directly below.
  - Concise instructions along bottom edge.
- **Portrait (`width < height`, e.g. `390×844`, `360×640`):**
  - Header across top.
  - Prominent Match Counter centred below header, followed by Move Counter and Timer side-by-side.
  - Responsive `BottleRack` (2×5 for 10 bottles, 2×4 for 8, 2×3 for 6, 1 row for 3–5) preserving logical slot order `0..N-1` left-to-right then top-to-bottom, supporting cross-row swapping, with aligned 2-row or 1-row `HiddenSequenceRack` directly below.
  - Concise instructions at bottom.
- **Resizing safety:** Viewport resizes recalculate layout coordinates and reposition/resize existing sprites and modals without regenerating the puzzle, resetting moves/timer, or mutating the hidden sequence.

---

## 6. Timer, Pause, Restart, Completion & Browser Lifecycle

- **Active Timer (`src/services/GameplayClock.ts`):** Uses an injectable `MonotonicClock` (`performance.now()` in browsers, fake clock in unit tests) rather than counting frames or assuming fixed `setInterval` ticks. Independently tracks `manualPaused`, `modalSuspended`, `platformSuspended`, and `completed` so **platform resume never overrides a player's manual pause**. HUD text only redraws when the `MM:SS` string changes.
- **Pause:** Opens `Modal` (`Game paused`) with Resume, Restart, and Return to Home without pausing Phaser's scene input pipeline so modal buttons remain fully responsive while board interactions and timer pause.
- **Restart:** Opens `ConfirmDialog` (`Restart puzzle?`), suspending timing and board input. Cancelling returns to the prior state (playing or pause). Confirming calls `GameEngine.restart()`, preserving the same puzzle ID and hidden target sequence while resetting moves, timer, selection, and feedback.
- **Completion:** After the winning swap finishes, updates MatchCounter to success styling (`N/N`), freezes the timer, blocks further swaps, and displays the temporary `Puzzle complete!` modal once per attempt with `Play Again` (restarts same puzzle) and `Return to Home`.
- **Browser Lifecycle:** Subscribes to `GamePlatform.onPause` / `onResume` plus `window` `blur` / `focus` and detaches all listeners, keyboard handlers, timers, and overlays on `SHUTDOWN`.

---

## 7. Input Handling & Accessibility Notes

- Supports touch and mouse tap-to-select / tap-to-swap, tap-outside-rack to clear selection, and modal input blocking.
- Supports keyboard navigation (`ArrowLeft` / `ArrowRight` to highlight logical bottle slots, `Enter` / `Space` to select/swap, `Escape` to clear selection or toggle pause/cancel dialogs) without calling `preventDefault()` on reserved host shortcuts.
- **Known limitations:** Because Phaser renders onto a single `<canvas>`, native browser screen readers do not inspect individual bottle sprites automatically; drag-and-drop swapping, advanced curved swap animations, audio SFX, scoring/stars, level unlocking, and YouTube Playables SDK integration are deferred to later tasks.
