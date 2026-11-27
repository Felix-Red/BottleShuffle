# Scoring, Star Rating, and Achievement System

This document defines the deterministic scoring engine, three-star rating model, personal best tracking, and campaign achievement aggregation implemented in **Task 12**.

All scoring logic lives inside pure TypeScript modules under `src/core/scoring/` and `src/core/models/` with zero Phaser, DOM, or platform SDK dependencies.

---

## 1. Scoring Formula

Each legitimately completed puzzle produces an immutable `AttemptResult` tagged with `scoringPolicyVersion: 1`:

```text
moveEfficiency = minimumRequiredSwaps / actualMoves
score          = max(1, round(baseScore * difficultyMultiplier * moveEfficiency))
```

- `baseScore = 1000`
- `minimumAwardedScore = 1` (prevents `0`-point completed attempts even on extreme move counts)
- `minimumRequiredSwaps` is the exact permutation swap distance between the puzzle's original `startingSequence` and `targetSequence`. It is **never** exposed in public gameplay state while a puzzle is active or paused; `GameEngine.getCompletedScoringMetadata()` returns it only after `status === 'completed'`.
- **Elapsed time is intentionally excluded** from both score and star rating (`scoringPolicyVersion: 1` preserved across the Campaign Progression Redesign). On `timed` and `combined` levels, beating the countdown timer is a pass/fail completion requirement rather than a score multiplier, keeping scoring transparent and consistent across all four challenge modes. Elapsed time continues to be tracked as an informational personal best metric.
- **Failed Attempts:** Attempts that fail due to `time_expired` or `moves_exhausted` never produce an `AttemptResult`, never award stars or scores, never unlock levels, and never weaken or erase previously earned personal best records.

### Difficulty Multipliers & Bottle-Count Mapping (`Catalogue v2.0.0`)

| Difficulty   | Bottles | Multiplier | Optimal (100%) Score |
| ------------ | :-----: | ---------: | -------------------: |
| Beginner     |    3    |     `1.0×` |              `1,000` |
| Easy         |    4    |    `1.25×` |              `1,250` |
| Normal       |    5    |     `1.5×` |              `1,500` |
| Intermediate |    6    |     `2.0×` |              `2,000` |
| Hard         |  7 – 8  |     `2.5×` |              `2,500` |
| Expert       | 9 – 10  |     `3.0×` |              `3,000` |

### Worked Examples

| Scenario               | Difficulty | Multiplier | `minSwaps` | `actualMoves` | Efficiency |   Score | Stars | Optimal Badge |
| ---------------------- | ---------- | ---------: | ---------: | ------------: | ---------: | ------: | :---: | :-----------: |
| Optimal Beginner       | Beginner   |      `1.0` |          3 |             3 |     `100%` | `1,000` |  ★★★  |      Yes      |
| 1 extra move on Normal | Normal     |      `1.5` |          4 |             5 |      `80%` | `1,200` |  ★★★  |      No       |
| Moderate moves on Hard | Hard       |      `2.5` |          5 |             8 |      `63%` | `1,563` |  ★★☆  |      No       |
| Many moves on Expert   | Expert     |      `3.0` |          6 |            15 |      `40%` | `1,200` |  ★☆☆  |      No       |
| Optimal Expert         | Expert     |      `3.0` |          7 |             7 |     `100%` | `3,000` |  ★★★  |      Yes      |
| Extreme moves floor    | Beginner   |      `1.0` |          1 |        50,000 |      `~0%` |     `1` |  ★☆☆  |      No       |

---

## 2. Three-Star Rating Rules

Stars are awarded purely from move efficiency relative to `minimumRequiredSwaps`:

|  Stars  | Rule (Evaluated in Strict Precedence)            | Performance Title  |
| :-----: | ------------------------------------------------ | ------------------ |
| ★★★ (3) | `actualMoves <= minimumRequiredSwaps + 1`        | `Perfect Shuffle!` |
| ★★☆ (2) | `actualMoves <= minimumRequiredSwaps * 2`        | `Great Shuffle!`   |
| ★☆☆ (1) | Any completed attempt above the 2-star threshold | `Puzzle Solved!`   |

### Optimal Solution Distinction

- A level completed in `minimumRequiredSwaps + 1` moves earns **3 stars** (`Perfect Shuffle!`), recognising near-optimal deduction.
- The **`Optimal Solution`** badge is displayed **only** when `actualMoves === minimumRequiredSwaps` (`extraMoves === 0`).

### Small-Puzzle Threshold Overlap (`minimumRequiredSwaps === 1`)

When a short introductory puzzle requires only `1` swap (`minimumRequiredSwaps === 1`):

- The 3-star threshold is `1 + 1 = 2`.
- The 2-star threshold is `1 * 2 = 2`.
- Because 3-star evaluation takes strict precedence, `1` or `2` moves award **3 stars**, and `3+` moves award **1 star** (there is no 2-star outcome for 1-swap puzzles). This edge case is intentional, deterministic, and covered by unit tests.

---

## 3. Personal Best Tracking & Backwards Compatibility

`comparePersonalBest(previousRecord, candidate)` evaluates campaign completions deterministically:

- **First completion:** Flagged separately (`isFirstCompletion: true`, `hasAnyImprovement: false`) so first clears display `First Completion` rather than implying a beaten prior record.
- **Independent metrics:** `bestScore` (higher wins), `bestStarRating` (higher wins), `bestMoveCount` (lower wins), and `bestElapsedMs` (lower wins) are tracked independently. Equal values are never flagged as improvements.
- **No weakening on replay:** Replaying a 3-star level and finishing with 1 star increments `completionCount` while preserving the player's best 3-star rating, best score, best moves, and best time.
- **Historical record compatibility:** Older `CompletionRecord` objects lacking `bestScore`, `bestStarRating`, or `scoringPolicyVersion` remain valid. Missing star ratings are never fabricated as 0 or 1 stars; the first scored replay populates them cleanly.

---

## 4. Campaign Achievement Aggregation

`ProgressionEngine.getCampaignAchievementSummary(state)` and `getChapterStarSummary(state, chapterId)` derive all totals dynamically from `LevelCatalog`:

- `maxAvailableStars = catalog.getTotalLevelCount() * 3` (never hardcoded to `150`; scales automatically when new chapters/levels are added).
- `totalEarnedStars` sums each completed level's `bestStarRating` once per level (replays never double-count).
- `totalBestScore` sums each completed level's `bestScore` once per level.
- `isPerfectCampaign` is `true` only when every level in the catalogue is completed with `3` stars.

> **Persistence Update (Task 15):** Committed personal best scores, earned stars, move counts, and active completion times are automatically persisted via `SaveService` (`docs/PERSISTENCE.md`) and restored on startup without duplicating completion events. Practice mode completions remain non-persistent and independent of campaign progression.
