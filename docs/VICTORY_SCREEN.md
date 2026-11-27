# Production Victory Screen & Cross-Screen Star Integration

This document describes the production Victory overlay, reveal animations, responsive layout, and star/score integration across `GameScene`, `LevelSelectionScene`, and `HomeScene` introduced in **Task 12**.

---

## 1. Architecture & Presentation Flow

The Victory experience is presented directly inside `GameScene` via `VictoryOverlay` (`src/game/components/victory/VictoryOverlay.ts`) over the dimmed completed gameplay board, replacing the temporary completion modal from Task 06.

1. **Immediate Authoritative Commit:** The instant `GameEngine` transitions to `completed`, `GameplayController` computes the immutable `AttemptResult` and (for campaign levels) commits score, star rating, moves, and time to `ProgressionController` once (`completionCommitted` guard). Progression never waits for animations to finish.
2. **Brief Post-Solve Celebration:** `VictoryCelebration` plays the full-rack success glow and bounded particle burst (`<= 22` particles), then reveals `VictoryOverlay` promptly (or immediately in `reducedMotion`).
3. **Interactive-First Controls:** All navigation buttons on `VictoryOverlay` are immediately interactive — players never have to wait for star or score animations to finish before tapping **Next Level**, **Replay**, **Levels**, or **Home**. Clicking any action cancels active reveal animations cleanly.

---

## 2. Victory Components

| Component                | Path                                                    | Responsibility                                                                                                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VictoryOverlay`         | `src/game/components/victory/VictoryOverlay.ts`         | Elevated card + dimmed input-blocking scrim, celebratory top accent, header label, stars, title, optimal badge, score, personal best, stats, milestone banner, and mode-aware navigation buttons.                                                 |
| `ScoreDisplay`           | `src/game/components/victory/ScoreDisplay.ts`           | Prominent formatted score with `SCORE` caption driven by `ScoreRevealAnimator`.                                                                                                                                                                   |
| `AttemptStatistics`      | `src/game/components/victory/AttemptStatistics.ts`      | Compact recessed bar (`4` columns) or `2×2` grid showing `Moves`, `Optimal`, `Efficiency`, and `Time`.                                                                                                                                            |
| `PersonalBestIndicator`  | `src/game/components/victory/PersonalBestIndicator.ts`  | Single restrained pill badge (`First Completion`, `New Best Score`, `New Best Rating`, `New Best Moves`, `New Best Time`, or `New Personal Best!`). Hidden in Practice mode and on non-improving replays.                                         |
| `VictoryMilestoneBanner` | `src/game/components/victory/VictoryMilestoneBanner.ts` | Displays the single highest-priority progression milestone without competing banners: Campaign Completion (`Shuffle Master!`, totals, optional `Perfect Campaign`), Chapter Completion (chapter stars + next chapter preview), or Level Unlocked. |

---

## 3. Reveal Animations & Reduced Motion

- **Star Reveal (`StarRevealAnimator` + `StarRating.playSequentialReveal`):**
  - Earned stars reveal sequentially (`170ms` stagger, `260ms` `Back.easeOut` scale pop from `0.38 -> 1.0`) with a subtle 4-sparkle gold pop per earned star (`EFFECT_TEXTURE_KEYS.SPARKLE`).
  - Unearned stars render with a crisp hollow 5-point outline so earned vs unearned stars remain unmistakable without relying solely on colour.
- **Score Count-Up (`ScoreRevealAnimator`):**
  - Animates displayed score from `0` to `totalScore` over `520ms` (`Cubic.easeOut`). Purely presentational; cancelling immediately reconciles to the exact final formatted score.
- **Reduced Motion:** Both animators display the exact final star rating and final score immediately with zero particles or scale bounce.

---

## 4. Mode-Specific Actions

- **Campaign (Intermediate Level):** Primary `Next Level: N` (`PrimaryButton`), Secondary row `Replay`, `Levels`, `Home` (`OutlineButton`).
- **Campaign Complete (Final Level):** Title becomes `Shuffle Master!`, Primary `View Levels`, Secondary row `Replay`, `Home`.
- **Practice Mode:** Primary `New Puzzle` (generates a fresh unseeded puzzle at the same difficulty), Secondary row `Replay` (replays the exact same puzzle), `Home`. Never mutates campaign progression or personal bests.
- **Tutorial Mode:** Continues to use its dedicated `TutorialCompletionOverlay`, completely isolated from scoring and campaign progression.

---

## 5. Responsive Layout (`VictoryLayout`)

`computeVictoryLayout` (`src/game/layout/VictoryLayout.ts`) is pure and Phaser-free, supporting three adaptive modes while keeping every button `>= 44px` tall:

- **Standard Landscape (`1920×1080`, `1280×720`):** Centred elevated single-column card with generous hierarchy.
- **Compact Landscape (`844×390`, viewport height `<= 480px`):** Two-column layout placing label, stars, title, score, and personal best on the left and `2×2` stats, milestone banner, and action buttons on the right — zero vertical overflow.
- **Portrait (`540×960`, `390×844`, `360×640`):** Single-column card scaling vertical gaps and star sizing smoothly to fit short screens cleanly.

---

## 6. Cross-Screen Integration

- **Level Selection (`LevelSelectionScene`):**
  - `LevelCard` shows earned `StarRating` on completed levels that have a recorded `bestStarRating` (never on locked or uncompleted unlocked levels, and never fabricating stars for legacy records).
  - `LevelPreviewDialog` displays the level's recorded `StarRating`, formatted `Score`, `Moves`, `Time`, and clear count.
  - `ChapterProgress` shows chapter earned/max stars alongside level counts (`X / Y · ★ E/M`).
  - `CampaignProgressSummary` surfaces campaign earned stars in the header pill when horizontal space permits.
- **Home Screen (`HomeScene`):**
  - `CampaignProgressCard` shows `X / Y` levels and `★ earned / max` derived from `CampaignAchievementSummary`.

## Task 13 Update — Victory Lifecycle Protection

Once `GameplayLifecycleCoordinator.markCompleted()` fires, completed attempts cannot resume into active gameplay and platform suspension preserves the committed `AttemptResult` and progression records cleanly. As of Task 15, campaign completion commits immediately trigger a high-priority save via `SaveCoordinator` before the player selects Next Level or Home, and navigation triggers a bounded best-effort flush.

---

## Responsive Victory Overlay Hardening (Task 16)

- `VictoryLayout` consumes `computeModalBounds` and 4-sided `SafeAreaInsets`, tightening ultra-compact portrait (`320×480`) and compact landscape (`568×320`) spacing so stars, score, optimal/personal-best badges, 2×2 statistics, milestone banner, and primary/secondary actions never overlap or clip, while live resizes never re-trigger victory audio or progression commits. See [RESPONSIVE_LAYOUT.md](./RESPONSIVE_LAYOUT.md).

---

## Next-Level Transition & Advertising Integration (Task 18)

- Campaign **Next Level** actions route through `LevelTransitionCoordinator` (`src/game/navigation/LevelTransitionCoordinator.ts`), which validates destination accessibility, prevents duplicate taps/transitions, flushes pending saves (`<= 300 ms`), and delegates eligible interstitial requests to `AdService`.
- While an eligible transition is awaiting settlement, `VictoryOverlay.setTransitionPending(true, "Preparing next level...")` disables duplicate navigation buttons and displays restrained copy directly on the primary CTA while preserving the Victory panel intact — never displaying a fake ad screen or countdown.
- **Replay**, **New Puzzle**, **Levels**, and **Home** actions remain 100% ad-free, and unavailable/failed ad requests never block next-level launch or alter committed stars, scores, or personal bests. See [MONETIZATION.md](./MONETIZATION.md).
