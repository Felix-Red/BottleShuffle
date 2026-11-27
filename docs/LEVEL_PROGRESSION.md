# Difficulty and Level Progression — Bottle Shuffle

This document describes the scalable 50-level campaign catalogue, chapter organisation, deterministic seed & versioning strategy, difficulty balancing, pure progression engine, attempt idempotency, campaign vs practice mode separation, and future persistence/expansion plans for **Bottle Shuffle**.

---

## 1. Progression Objectives

- Introduce the deduction mechanic gently with 3-bottle puzzles before scaling smoothly to 10 bottles.
- Keep puzzles deterministic and reproducible across replays and restarts without any backend or authentication.
- Generate campaign puzzles **on demand** at level launch rather than generating all puzzles during application startup.
- Keep `src/core/` completely independent of Phaser, browser globals, storage, and platform SDKs.
- Support expanding the campaign to hundreds or thousands of levels by appending chapter specifications without rewriting gameplay or progression rules.

---

## 2. Initial 50-Level Distribution & Six Chapters

Defined declaratively in `src/core/levels/LevelFactory.ts` (`DEFAULT_CHAPTER_SPECS`):

| Chapter ID   | Display Name   | Levels | Difficulty     | Bottles | Allowed Initial Matches | Min Required Swaps | Focus                                               |
| ------------ | -------------- | ------ | -------------- | ------: | ----------------------- | -----------------: | --------------------------------------------------- |
| `chapter-01` | First Steps    | 1–5    | `beginner`     |       3 | `0–1`                   |                `1` | Introduces selection, swapping, and 3-bottle cycles |
| `chapter-02` | Getting Warmer | 6–10   | `easy`         |       4 | `0–2`                   |                `1` | Introduces a larger 4-bottle deduction space        |
| `chapter-03` | The Shuffle    | 11–20  | `normal`       |       5 | `0–2`                   |                `2` | Encourages deliberate experimentation               |
| `chapter-04` | Mind Games     | 21–30  | `intermediate` |       6 | `0–3`                   |                `2` | Requires structured reasoning across 6 bottles      |
| `chapter-05` | Brain Teaser   | 31–40  | `hard`         |       8 | `0–3`                   |                `3` | Introduces deeper 8-bottle arrangements             |
| `chapter-06` | Mastermind     | 41–50  | `expert`       |      10 | `0–4`                   |                `4` | Full 10-bottle deduction challenge                  |

Chapter display names are presentation metadata; permanent identity uses stable `chapter-XX` and `level-XXX` identifiers.

---

## 3. Domain Models & Catalogue Architecture

- **`LevelId` & `ChapterId` (`src/core/levels/LevelId.ts`):** Stable identifiers (`level-001`..`level-050`, `chapter-01`..`chapter-06`) decoupled from array positions and display numbers.
- **`LevelDefinition` (`src/core/levels/LevelDefinition.ts`):** Immutable record storing `id`, `levelNumber`, `chapterId`, `difficulty`, `bottleCount`, `seed`, `generatorVersion`, optional match/swap constraints, and `prerequisiteLevelId`.
- **`ChapterDefinition` (`src/core/levels/ChapterDefinition.ts`):** Immutable metadata storing `id`, `displayName`, `order`, `difficulty`, `bottleCount`, `levelIds`, and `description`. Never stores mutable player completion flags.
- **`LevelCatalog` (`src/core/levels/LevelCatalog.ts`):** Immutable, centrally validated lookup repository (`getLevelById`, `getLevelByNumber`, `getAllLevels`, `getLevelsByChapter`, `getNextLevel`, `getPreviousLevel`, `getFirstLevel`, `getFinalLevel`, `getTotalLevelCount`, `getChapterById`, `getAllChapters`, `getChapterForLevel`). Validated by `LevelValidator` against duplicate IDs/numbers, invalid constraints, broken prerequisites, cycles, and unreachable levels.

---

## 4. Deterministic Seed Strategy & Generator Versioning

- `deriveCampaignLevelSeed(levelId, generatorVersion, varietySalt?)` (`src/core/levels/LevelSeedGenerator.ts`) hashes `bs-campaign-v1|<generatorVersion>|<levelId>[|<salt>]` via `hashStringToHex` to produce stable seeds such as `level-001-f3d5e8e447e014dd`.
- Seeds never depend on dates, player progress, or total catalogue size — appending Chapter 7 (`level-051+`) never alters seeds for Levels 1–50.
- `generateLevelPuzzle(level)` explicitly checks `level.generatorVersion === PUZZLE_GENERATOR_VERSION` (`1.0.0`).
- **Future generator migration strategy:** If a future `2.0.0` generator algorithm is introduced, keep `1.0.0` available as a versioned dispatcher (or explicitly migrate and re-verify golden fixtures) so completed/published levels never silently change arrangements.
- Representative golden fixtures across all 6 chapters are locked in `tests/unit/levels/DeterministicLevels.test.ts`.

---

## 5. Difficulty-Balancing & Variety Strategy

- Bottle count is the primary complexity lever; initial aggregate matches and minimum permutation swap distance act only as **structural** safeguards (not expected player move counts, since players deduce a hidden target).
- All 50 generated levels are validated for zero duplicate complete puzzles (`starting=>target`) and strong bottle-set variety (`5/5` unique bottle sets in Beginner, `5/5` in Easy, `9/10` in Normal, `10/10` in Intermediate, `10/10` in Hard, `10/10` unique permutations in Expert).
- Beginner Levels 4–5 carry explicit catalogue-authored variety salts (`c1`, `c2`) so Chapter 1 ramps from 1-swap transpositions (Levels 1–3) to 2-swap 3-bottle cycles (Levels 4–5) with 5 distinct 3-bottle colour sets.
- See [docs/LEVEL_CALIBRATION.md](./LEVEL_CALIBRATION.md) for the complete 50-level calibration table generated by `npm run levels:calibrate`.

---

## 6. Progression Engine, Unlocking & Completion Records

- **Level Statuses (`LevelStatus`):** `'locked' | 'unlocked' | 'completed'`, always derived from `ProgressionState.completedLevels` and each level's `prerequisiteLevelId`.
- **Initial State:** Level 1 unlocked (`prerequisiteLevelId === null`), Levels 2–50 locked, `0/50 (0%)`, recommended next level = Level 1.
- **Sequential Unlocking:** Solving level `N` marks `N` completed and unlocks `N + 1` (including across chapter boundaries `5->6`, `10->11`, `20->21`, `30->31`, `40->41`). Completing the final level emits `CAMPAIGN_COMPLETED` without attempting to unlock a nonexistent level.
- **Completion Records (`CompletionRecord`):** Stores `levelId`, `completionCount`, `bestMoveCount`, and `bestElapsedMs`. `bestMoveCount` and `bestElapsedMs` are tracked **independently** and may originate from different attempts. Worse replay runs never overwrite better records.
- **Deterministic Events (`ProgressionEvent`):**
  - First-time completion: `LEVEL_COMPLETED` -> `LEVEL_UNLOCKED` (when applicable) -> `CHAPTER_COMPLETED` (when applicable) -> `CAMPAIGN_COMPLETED` (when applicable).
  - Replay completion: `LEVEL_COMPLETED` (`firstTime: false`) -> `LEVEL_RECORD_IMPROVED` (if moves or time improved). Never emits duplicate unlock or chapter/campaign completion events.
- **Derived Progress:** `getRecommendedNextLevel`, `getChapterProgress`, and `getCampaignProgress` compute percentages dynamically against `catalog.getTotalLevelCount()` (never hardcoded to 50). Replaying completed levels never inflates unique completed counts or moves the recommended next level backwards.

---

## 7. Attempt Identity & Completion Idempotency

- `ProgressionController` (`src/game/progression/ProgressionController.ts`) issues a unique monotonic `attemptId` (`att-<counter>-<levelId>`) whenever a campaign level launches or restarts.
- `completeActiveAttempt()` verifies both `attemptId` and `levelId` match the currently active attempt, delegates to `ProgressionEngine.recordCompletion()`, and clears the active attempt on acceptance.
- `ProgressionState.recentProcessedAttemptIds` maintains a bounded ring buffer (`MAX_RECENT_ATTEMPT_IDS = 32`) preventing duplicate processing without unbounded memory growth.
- Restarting a level rotates the attempt ID (invalidating any stale callback from the prior attempt) while preserving the deterministic puzzle. Returning Home or destroying `GameScene` calls `abandonActiveAttempt()` without advancing progression.

---

## 8. Campaign vs Practice Mode & Scene Integration

- **Campaign Mode (`{ mode: 'campaign', levelId }`):** Verifies unlock status, generates the deterministic level puzzle, displays `Level N` and `<Chapter Name> · <K> Bottles`, records valid completion, and displays **Next: Level N+1**, **Replay**, and **Return to Home** (or **Campaign Complete!** without Next Level on Level 50).
- **Practice Mode (`{ mode: 'practice', difficulty }`):** Launches standalone puzzles for any of the 6 difficulty tiers without requiring unlocking and **never** alters campaign progression, unlock states, or completion records.
- **Session Lifetime & Future Persistence:** A single `ProgressionController` instance is created in `src/main.ts` and shared by `HomeScene` and `GameScene`, preserving progression across scene transitions, replays, and restarts. `ProgressionState` is pure JSON with `schemaVersion: 1` and `serializeState` / `deserializeState` helpers ready for Task 15 persistence (`localStorage` / `ytgame.game.saveData`). Until Task 15, refreshing or closing the page resets in-memory session progression.

---

## 9. Catalogue Expansion Strategy

To add Chapter 7 (Levels 51–60) in the future:

1. Append a new `ChapterSpec` entry to `DEFAULT_CHAPTER_SPECS` in `src/core/levels/LevelFactory.ts` (preserving all existing chapter specs and level IDs).
2. Run `npm run levels:calibrate` to verify 100% puzzle validity, zero duplicate puzzles, and balanced tier metrics.
3. Run `npm test` to confirm golden fixtures for Levels 1–50 remain bit-for-bit unchanged.

No changes are required in `GameEngine`, `PuzzleGenerator`, `BottleSprite`, `GameplayBoard`, `ProgressionEngine`, or `GameScene`.

## Task 12 Extensions — Scores, Stars, and Achievement Summaries

`CompletionRecord` stores optional `bestScore`, `bestStarRating`, and `scoringPolicyVersion` while remaining fully backwards-compatible with historical records. `ProgressionEngine` exposes `getCampaignAchievementSummary(state)` and `getChapterStarSummary(state, chapterId)` derived dynamically from `LevelCatalog` (`maxAvailableStars = totalLevels * 3`). As of Task 15, committed progression records are automatically persisted via `SaveService` and restored on startup without replaying completion events; unfinished attempts are not persisted.
