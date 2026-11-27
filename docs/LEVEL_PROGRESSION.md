# Difficulty and Level Progression — Bottle Shuffle

This document describes the redesigned 50-level campaign catalogue (`v2.0.0`), chapter organisation, configurable challenge objectives, deterministic seed & versioning strategy, centralised difficulty balancing, pure progression engine, attempt idempotency, and campaign vs practice mode separation for **Bottle Shuffle**.

---

## 1. Progression Objectives

- Deliver **meaningful progression on every single level** instead of repeating the same bottle count across consecutive classic levels.
- Introduce the core deduction mechanic smoothly across `3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10` bottles in Chapter 1, then escalate through four distinct challenge modes (`classic`, `timed`, `limited_moves`, `combined`).
- Preserve the core hidden-target deduction mechanic at all times (never reveal which individual bottles are correctly positioned).
- Keep puzzles deterministic and reproducible across replays and restarts without any backend or authentication.
- Generate campaign puzzles **on demand** at level launch rather than generating all puzzles during application startup.
- Keep `src/core/` completely independent of Phaser, browser globals, storage, and platform SDKs.
- Support expanding the campaign beyond 50 levels by appending chapter specifications without rewriting gameplay or progression rules.

---

## 2. Redesigned 50-Level Distribution & Six Chapters (`v2.0.0`)

Defined declaratively in `src/core/levels/LevelFactory.ts` (`DEFAULT_CHAPTER_SPECS`) with configurable challenge limits centralised in `src/core/levels/CampaignBalanceConfig.ts` (`CAMPAIGN_CATALOG_VERSION = '2.0.0'`):

| Chapter ID   | Display Name      | Levels | Challenge Mode  | Bottles | Challenge Objectives                                                                                                                                                              | Focus                                                      |
| ------------ | ----------------- | ------ | --------------- | :-----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `chapter-01` | First Steps       | 1–8    | `classic`       |  3–10   | No time or move limit; +1 bottle every level (`3, 4, 5, 6, 7, 8, 9, 10`)                                                                                                          | Teaches core hidden-target deduction across all rack sizes |
| `chapter-02` | Beat the Clock    | 9–16   | `timed`         |  3–10   | Countdown limits: `30s, 45s, 60s, 90s, 120s, 150s, 180s, 210s`                                                                                                                    | Introduces countdown pressure with generous timers         |
| `chapter-03` | Speed Mastery     | 17–24  | `timed`         |  3–10   | Tighter countdown limits: `20s, 30s, 45s, 60s, 90s, 120s, 150s, 180s`                                                                                                             | Rewards fast, methodical deduction under tighter clocks    |
| `chapter-04` | Every Move Counts | 25–32  | `limited_moves` |  3–10   | Move allowances: `6, 10, 15, 20, 26, 32, 38, 45` swaps                                                                                                                            | Rewards disciplined deduction without wasted swaps         |
| `chapter-05` | Double Trouble    | 33–40  | `combined`      |  3–10   | `30s/7m, 45s/11m, 65s/16m, 95s/22m, 125s/28m, 155s/34m, 185s/40m, 215s/48m`                                                                                                       | Combines countdown timer and move budget simultaneously    |
| `chapter-06` | Shuffle Master    | 41–50  | `combined`      |  6–10   | 10 unique mastery configs (`6B 75s/19m`, `7B 105s/25m`, `7B 90s/24m`, `8B 135s/31m`, `8B 115s/29m`, `9B 160s/37m`, `9B 140s/35m`, `10B 195s/44m`, `10B 175s/42m`, `10B 160s/40m`) | High-intensity mastery finale with zero repeated configs   |

Chapter display names are presentation metadata; permanent identity uses stable `chapter-XX` and `level-XXX` identifiers.

---

## 3. Domain Models & Catalogue Architecture

- **`ChallengeMode` & `LevelChallengeObjective` (`src/core/models/ChallengeMode.ts`):** Pure domain definition of `'classic' | 'timed' | 'limited_moves' | 'combined'`, failure reasons (`'time_expired' | 'moves_exhausted'`), and `validateChallengeObjective()` enforcing mode-specific invariants (e.g., `classic` forbids limits, `timed` requires `timeLimitSeconds > 0`, `limited_moves` requires `moveLimit >= 1`, `combined` requires both).
- **`CampaignBalanceConfig` (`src/core/levels/CampaignBalanceConfig.ts`):** Single source of truth for `CAMPAIGN_CATALOG_VERSION = '2.0.0'`, per-bottle-count structural puzzle defaults (`3..10` bottles including `7 -> hard` and `9 -> expert` scoring difficulty mapping), and all Chapter 2–6 time/move limits so future playtesting adjustments edit one pure data file.
- **`LevelId` & `ChapterId` (`src/core/levels/LevelId.ts`):** Stable identifiers (`level-001`..`level-050`, `chapter-01`..`chapter-06`) decoupled from array positions.
- **`LevelDefinition` (`src/core/levels/LevelDefinition.ts`):** Immutable record storing `id`, `levelNumber`, `chapterId`, `difficulty`, `bottleCount`, `challengeMode`, `timeLimitSeconds`, `moveLimit`, `seed`, `generatorVersion`, optional match/swap constraints, and `prerequisiteLevelId`, plus `toLevelChallengeObjective(level)`.
- **`ChapterDefinition` (`src/core/levels/ChapterDefinition.ts`):** Immutable metadata storing `id`, `displayName`, `order`, `difficulty`, `challengeMode`, `bottleCount` (starting bottle count), `minBottleCount`, `maxBottleCount`, `levelIds`, and `description`. Never stores mutable player completion flags.
- **`LevelCatalog` (`src/core/levels/LevelCatalog.ts`):** Immutable, centrally validated lookup repository validated by `LevelValidator` against duplicate IDs/numbers, invalid challenge objectives, impossible `moveLimit < minimumRequiredSwaps`, broken prerequisites, cycles, and unreachable levels.

---

## 4. Deterministic Seed Strategy & Generator Versioning

- `deriveCampaignLevelSeed(levelId, generatorVersion, varietySalt?)` (`src/core/levels/LevelSeedGenerator.ts`) hashes `bs-campaign-v1|<generatorVersion>|<levelId>[|<salt>]` via `hashStringToHex`.
- All 50 redesigned levels carry an explicit `v2` catalogue salt (`v2`, or `v2-c1` etc. when variety salting is applied) so Catalogue `v2.0.0` produces 50 deterministic, verified unique puzzles distinct from legacy pre-redesign development layouts.
- Seeds never depend on dates, player progress, or total catalogue size — appending Chapter 7 (`level-051+`) never alters seeds for Levels 1–50.
- `generateLevelPuzzle(level)` explicitly verifies `level.generatorVersion === PUZZLE_GENERATOR_VERSION` (`1.0.0`).
- Representative golden fixtures across all 6 chapters are locked in `tests/unit/levels/DeterministicLevels.test.ts`.

---

## 5. Difficulty-Balancing, Validation & Contextual Intros

- Bottle count (`3..10`) and challenge mode (`classic`, `timed`, `limited_moves`, `combined`) jointly drive difficulty progression.
- Initial aggregate matches and minimum permutation swap distance act as **structural** safeguards only — because players deduce a hidden target, `moveLimit` values are calibrated for hidden-sequence deduction rather than full-information optimal swap counts.
- All 50 generated levels are automatically validated by `npm run validate:campaign` for:
  - `50/50` valid puzzles with `0` duplicate complete puzzles (`starting=>target`) and `10/10` unique Chapter 6 challenge configurations;
  - `50/50` mathematical solvability within each level's `moveLimit` and `timeLimitSeconds`;
  - Automated blind-deduction heuristic analysis (never accessing `targetSequence`) to inspect time and move headroom before human playtesting.
- **Contextual Challenge Introductions:** The first time a player launches a `timed` (Level 9), `limited_moves` (Level 25), or `combined` (Level 33) level, `ChallengeIntroOverlay` briefly explains the new rule while keeping the countdown paused until dismissed. Completion is tracked per mode in `ChallengeIntroService` and persisted in Save Schema `v2`.
- See [docs/LEVEL_CALIBRATION.md](./LEVEL_CALIBRATION.md) for the complete `v2.0.0` 50-level calibration report and honest playtesting notes.

---

## 6. Progression Engine, Unlocking & Completion Records

- **Level Statuses (`LevelStatus`):** `'locked' | 'unlocked' | 'completed'`, always derived from `ProgressionState.completedLevels` and each level's `prerequisiteLevelId`.
- **Initial State:** Level 1 unlocked (`prerequisiteLevelId === null`), Levels 2–50 locked, `0/50 (0%)`, recommended next level = Level 1.
- **Sequential Unlocking:** Solving level `N` marks `N` completed and unlocks `N + 1` (including across chapter boundaries `8->9`, `16->17`, `24->25`, `32->33`, `40->41`). Completing Level 50 emits `CAMPAIGN_COMPLETED`.
- **Failed Attempts Never Award or Revoke Progress:** Running out of time (`time_expired`) or moves (`moves_exhausted`) transitions `GameEngine` to `'failed'`, abandons the active attempt in `ProgressionController`, never unlocks levels, never awards stars or scores, and never overwrites previously earned stars or personal best records.
- **Completion Records (`CompletionRecord`):** Stores `levelId`, `completionCount`, `bestMoveCount`, `bestElapsedMs`, and optional `bestScore`, `bestStarRating`, and `scoringPolicyVersion`. Metrics are tracked independently; worse replays never weaken existing bests.
- **Deterministic Events (`ProgressionEvent`):**
  - First-time completion: `LEVEL_COMPLETED` -> `LEVEL_UNLOCKED` -> `CHAPTER_COMPLETED` -> `CAMPAIGN_COMPLETED` (when applicable).
  - Replay completion: `LEVEL_COMPLETED` (`firstTime: false`) -> `LEVEL_RECORD_IMPROVED` (if any metric improved).
- **Derived Progress:** `getRecommendedNextLevel`, `getChapterProgress`, `getChapterStarSummary`, `getCampaignProgress`, and `getCampaignAchievementSummary` compute all totals dynamically against `catalog.getTotalLevelCount()` (`maxAvailableStars = totalLevels * 3`).

---

## 7. Attempt Identity & Completion Idempotency

- `ProgressionController` (`src/game/progression/ProgressionController.ts`) issues a unique monotonic `attemptId` (`att-<counter>-<levelId>`) whenever a campaign level launches or restarts.
- `completeActiveAttempt()` verifies both `attemptId` and `levelId` match the currently active attempt, delegates to `ProgressionEngine.recordCompletion()`, and clears the active attempt on acceptance.
- `ProgressionState.recentProcessedAttemptIds` maintains a bounded ring buffer (`MAX_RECENT_ATTEMPT_IDS = 32`) preventing duplicate processing without unbounded memory growth.
- Restarting a level (from HUD, pause menu, or `FailureOverlay`) rotates the attempt ID while preserving the deterministic puzzle. Returning Home, navigating to Levels, failing an attempt, or destroying `GameScene` abandons the active attempt without advancing progression.

---

## 8. Campaign vs Practice Mode & Persistence

- **Campaign Mode (`{ mode: 'campaign', levelId }`):** Verifies unlock status, generates the deterministic level puzzle with its configured `LevelChallengeObjective`, displays level/chapter/mode context, records valid completion, and persists committed records via `SaveService` (Save Schema `v2`, `campaignCatalogVersion: '2.0.0'`).
- **Practice Mode (`{ mode: 'practice', difficulty }`):** Launches standalone classic puzzles for any of the 6 difficulty tiers without requiring unlocking and **never** alters campaign progression, unlock states, or completion records.
- See [docs/PERSISTENCE.md](./PERSISTENCE.md) for the `v1 -> v2` save migration policy introduced with the campaign redesign.

---

## 9. Catalogue Expansion Strategy

To add Chapter 7 (Levels 51–60) in the future:

1. Add balancing parameters in `src/core/levels/CampaignBalanceConfig.ts` and append a new `ChapterSpec` entry to `DEFAULT_CHAPTER_SPECS` in `src/core/levels/LevelFactory.ts` (preserving all existing level IDs and seeds).
2. Run `npm run levels:calibrate` and `npm run validate:campaign` to verify 100% puzzle validity, zero duplicate puzzles, and balanced challenge limits.
3. Run `npm test` to confirm golden fixtures for Levels 1–50 remain bit-for-bit unchanged.

No changes are required in `GameEngine`, `PuzzleGenerator`, `BottleSprite`, `GameplayBoard`, `ProgressionEngine`, or `GameScene`.
