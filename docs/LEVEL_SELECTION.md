# Production Level Selection Screen — Bottle Shuffle

This document describes the design, chapter presentation, view-state mapping, navigation architecture, animations, responsive layouts, accessibility, performance, and testing strategy for **Bottle Shuffle's** production Level Selection screen (`LevelSelectionScene`).

---

## 1. Objectives & Visual Direction

- Replace the temporary campaign dialog with a cohesive, chapter-organised campaign selection experience built directly on the established Bottle Shuffle design system (dark purple backgrounds, elevated purple cards, warm gold & violet accents, bundled **Fredoka** + **Nunito** typography, and glossy bottle artwork).
- Give players immediate orientation: open the chapter containing their recommended next level automatically while letting them inspect earlier and future chapters freely.
- Keep `ProgressionEngine` and `LevelCatalog` in `src/core/` as the single source of truth; derive all visual counts, statuses, and completion records dynamically without hardcoding chapter or level totals.

---

## 2. Screen Composition & Components (`src/game/components/levels/`)

- **`LevelSelectionHeader.ts`:** Back `IconButton` (returns to `HomeScene`), **Select Level** title, and live `CampaignProgressSummary`.
- **`CampaignProgressSummary.ts`:** Header pill displaying a trophy icon, aggregate `completed / total` count, and optional compact `ProgressBar` (turning success green when the campaign is complete). Displays zero unimplemented star or score totals.
- **`ChapterBanner.ts`:** Chapter badge (`CHAPTER K`) tinted with the chapter's visual accent, bold chapter display name, difficulty & bottle-count metadata (`Easy · 4 Bottles`), and subtle completed/locked chapter icon.
- **`ChapterArtwork.ts`:** Decorative bottle showcase reusing existing bundled bottle textures (`getBottleMetadata`) to visually communicate the chapter's bottle count (`3`, `4`, `5`, `6`, `8`, or `10` bottles) with grounded shadows, a chapter-accent halo, and optional gentle ambient drift paused on reduced motion or browser suspend. Never generates a puzzle or mirrors any hidden level sequence, and degrades gracefully if a texture is unavailable.
- **`ChapterProgress.ts`:** Elevated progress card displaying `CHAPTER PROGRESS`, `completed / total`, chapter-accent `ProgressBar`, and restrained success styling + check icon when complete.
- **`LevelGrid.ts`:** Renders **only** the currently selected chapter's `LevelCard` instances (up to 5 columns in landscape; 3–5 columns in portrait) with bounded in-canvas vertical scrolling and scrollbar when a future chapter exceeds viewport height.
- **`ChapterNavigation.ts`:** Bottom bar with Previous/Next `IconButton`s (disabled at first/final boundaries), `Chapter K of N` caption, and direct clickable pagination dots/pills (gracefully compressing to a proportional indicator bar for very large future chapter counts).
- **`LevelPreviewDialog.ts`:** Reusable `Modal` displaying level title, chapter + difficulty + bottle count, decorative bottle strip, short challenge description, and—for completed levels only—an authentic **PERSONAL BEST** section (`Best moves`, `Best time` formatted via `formatElapsedTime`, and `Cleared N×`).

---

## 3. Chapter Visual Identity (`src/config/ChapterVisualConfig.ts`)

Visual identity is bound to stable `ChapterId`s independently of `src/core/`:

| Chapter ID   | Name           | Bottles | Accent Token                    |
| ------------ | -------------- | ------: | ------------------------------- |
| `chapter-01` | First Steps    |       3 | `Colors.Bottle.Green`           |
| `chapter-02` | Getting Warmer |       4 | `Colors.Bottle.Blue`            |
| `chapter-03` | The Shuffle    |       5 | `Colors.Bottle.Teal`            |
| `chapter-04` | Mind Games     |       6 | `Colors.Brand.Secondary` (Gold) |
| `chapter-05` | Brain Teaser   |       8 | `Colors.Bottle.Orange`          |
| `chapter-06` | Mastermind     |      10 | `Colors.Brand.Primary` (Purple) |

Any future chapter (`chapter-07+`) automatically resolves a deterministic fallback accent and decorative bottle set via `getChapterVisualTheme(chapterId, bottleCount, chapterOrder)`.

---

## 4. Level Card Visual States (`src/design-system/components/cards/LevelCard.ts`)

- **Locked:** Muted surface, visible muted level number, lock icon, gameplay launch disabled; tapping triggers a non-blocking prerequisite toast (`"Complete Level X to unlock Level Y."`).
- **Unlocked:** Elevated surface, crisp level number, hover/press tactile scaling.
- **Recommended (`'current'`):** Dominant purple surface, lighter outline, `NEXT` badge, play icon, and subtle outline pulse (disabled in reduced motion).
- **Completed:** Elevated surface with emerald accent outline, visible level number, completion checkmark badge, and active replay interaction.
- **Selected / Focused:** Orthogonal gold outer emphasis outline that preserves the underlying progression status (a completed level can also be selected or focused).
- **No star ratings:** `LevelSelection` passes `showStars: false` until Task 12 implements scoring and star ratings.

---

## 5. View-State Mapping & Recommended Chapter Selection (`src/game/levels/`)

- `mapLevelSelectionViewState()` (`LevelSelectionViewStateMapper.ts`) produces immutable `LevelSelectionViewState`, `ChapterViewState`, `LevelCardViewState`, and `LevelPreviewViewState` models strictly from `ProgressionController` + `LevelCatalog`.
- Hidden target sequences, deterministic seeds, minimum swap distances, and debug data are never included in public view states.
- **Recommended Chapter Selection:** Opening Level Selection from `HomeScene` opens the chapter containing `ProgressionEngine.getRecommendedNextLevel()` (`Chapter 1` for new players, `Chapter 2` at 7 completed levels, `Chapter 4` at 20 completed, `Chapter 6` at 40 completed, and the final chapter when all levels are complete). Optional typed navigation payloads (`LevelSelectionSceneData`) validate requested `chapterId` / `levelId` / `returnFromLevelId` against `LevelCatalog` before use.

---

## 6. Level Preview, Launch Integration & Replay Behaviour

- Selecting any unlocked or completed level opens `LevelPreviewDialog` without generating the puzzle.
- Completed levels display only real stored `CompletionRecord` values (`bestMoveCount` and `bestElapsedMs` are tracked independently and may come from different attempts). Missing records are never fabricated.
- Selecting **Play Level** or **Replay Level** revalidates `canPlayLevel(levelId)`, engages the duplicate-launch lock, closes the dialog, and calls `SceneNavigator.launchCampaignLevel(levelId, 'level_selection')` (which transparently routes first-time players through the interactive tutorial before launching the exact requested level).
- `GameScene` generates the deterministic puzzle on demand via `ProgressionController.beginCampaignAttempt(levelId)`, preserves the **Next Level** button in the completion modal, and provides **Back to Levels** to return smoothly to `LevelSelectionScene` with refreshed completion records and unlocks.
- Replaying completed levels preserves their original deterministic puzzles, updates personal bests only when improved, and never inflates campaign completion counts or percentages.

---

## 7. Animations & Bounded Unlock Tracking (`src/game/animations/levels/`)

- **`LevelUnlockTracker.ts`:** Session-scoped, bounded (`MAX_PENDING_UNLOCKS = 16`) presentation observer subscribed to `ProgressionController.onChange`. Records `LEVEL_UNLOCKED` and `CHAPTER_COMPLETED` events without mutating progression or using persistent storage.
- **`LevelUnlockAnimation.ts`:** Restrained `420ms` unlock reveal (fading lock lift, soft scale pop, gold outline flash, and 4 bounded sparkles; immediate in reduced motion). Consumed immediately once shown so returning or switching chapters never replays it.
- **`ChapterTransition.ts`:** `240ms` directional slide + crossfade (`0ms` in reduced motion) guarded by monotonic transition tokens so rapid chapter taps or scene shutdown safely cancel stale callbacks.
- **`LevelCompletionAnimation.ts`:** Subtle non-blocking scale pulse on `ChapterProgress` paired with a success `Toast` announcing when the next chapter becomes available.

---

## 8. Responsive Layouts, Accessibility & Performance

- **`LevelSelectionLayout.ts`:** Pure layout calculator supporting `1920×1080`, `1280×720`, `844×390`, `540×960`, `390×844`, and `360×640` with zero forced orientation:
  - **Landscape:** Header across the top; left column hosts `ChapterBanner`, `ChapterArtwork`, and `ChapterProgress`; right column gives priority width to `LevelGrid` (up to 5 columns); bottom bar hosts `ChapterNavigation` + pagination. Compact heights (`≤440px`) scale/simplify artwork first.
  - **Portrait:** Stacked vertical flow (Header -> Chapter Banner -> compact Chapter Artwork -> Chapter Progress -> 3–5 column Level Grid with bounded vertical scroll if needed -> Chapter Navigation).
- **Accessibility & Input:** Supports mouse, touch, keyboard grid navigation (`ArrowLeft`/`Right`/`Up`/`Down`), chapter shortcuts (`[`/`]`, `PageUp`/`PageDown`), `Enter`/`Space` activation, `Escape` dismissal/back-to-home, minimum `44px` touch targets, non-colour icons (lock, check, play), modal blocking, and `MotionPreferenceService` reduced-motion sync. Canvas screen-reader semantics remain a known Phaser `<canvas>` limitation.
- **Performance:** Only the active chapter's cards are instantiated, zero puzzles are generated on screen entry or chapter browsing, existing bundled textures are reused, and all tweens/listeners/masks clean up deterministically on `SHUTDOWN`.

---

## 9. Testing & Known Limitations

- **Tests:** `tests/unit/level-selection/LevelSelectionViewStateMapper.test.ts`, `LevelSelectionController.test.ts`, `LevelSelectionLayout.test.ts`, and `tests/integration/LevelSelection.test.ts` verify all view-state projections, hidden-data concealment, chapter navigation boundaries, locked-level rejection, replay records, chapter completion, 7-chapter expansion, responsive non-overlapping layouts, and all 5 end-to-end player journeys.
- **Persistence (Task 15):** Completed levels, earned stars, personal best records, and derived unlock states are persisted automatically via `SaveService` and restored prior to `LevelSelectionScene` creation without duplicating unlock animations. Standalone browser storage uses `BrowserSaveStorage`; YouTube Playables storage integration is deferred to Task 17.

---

## Responsive Level Selection Improvements (Task 16)

- `LevelSelectionLayout` integrates `LayoutProfileResolver` and `ResponsiveTokens` across all 14 verified viewports, and `ChapterProgress` adapts to narrow compact-landscape columns (`width < 250px`) with concise `PROGRESS` / `0/5 ★0/15` labels to prevent text overlap. See [RESPONSIVE_LAYOUT.md](./RESPONSIVE_LAYOUT.md).
