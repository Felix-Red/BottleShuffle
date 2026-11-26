# Puzzle Generation Engine — Bottle Shuffle

This document defines the pure TypeScript domain models, deterministic randomisation, validation rules, constraint solver, minimum swap distance algorithm, and public/private boundaries for **Bottle Shuffle's** puzzle generation engine (`src/core/`).

---

## 1. Domain Purity & Architecture Boundary

Everything inside `src/core/` is pure TypeScript with **zero imports** from:

- Phaser (`phaser`)
- Browser / DOM globals (`window`, `document`, `localStorage`)
- Visual layers (`src/design-system/`, `src/game/`)
- Platform adapters or YouTube Playables SDK (`src/platform/`, `ytgame`)
- Uncontrolled randomness (`Math.random()` is never called inside `src/core/`)

---

## 2. Domain Models

- **`BottleId` (`src/core/models/BottleId.ts`):** Canonical union of the 10 stable bottle identities (`red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `teal`, `brown`, `silver`), owned by `src/core/`. Visual metadata (`Colors.ts`, `BottleCatalog.ts`) references `BottleId` rather than duplicating identity sets.
- **`Bottle` (`src/core/models/Bottle.ts`):** Pure readonly domain entity `{ readonly id: BottleId }`.
- **`DifficultyId` (`src/core/models/Difficulty.ts`):** Canonical difficulty identifiers: `beginner`, `easy`, `normal`, `intermediate`, `hard`, `expert`.
- **`PuzzleConfig` & `ResolvedPuzzleConfig` (`src/core/models/PuzzleConfig.ts`):** Strongly typed caller configuration supporting `difficulty`, optional `bottleCount`, `seed`, `minInitialMatches`, `maxInitialMatches`, and `minRequiredSwaps`.
- **`Puzzle` (`src/core/models/Puzzle.ts`):** Deeply frozen immutable puzzle definition containing `id`, `seed`, `generatorVersion`, `difficulty`, `bottleCount`, `startingSequence`, and `targetSequence`.
- **`PublicPuzzleView` (`src/core/models/Puzzle.ts`):** Player-visible projection (`toPublicPuzzleView`) containing only `id`, `difficulty`, `bottleCount`, and `startingSequence` — omitting `targetSequence` and `seed`.
- **`PuzzleStatus` & `PuzzleState` (`src/core/models/PuzzleStatus.ts`, `PuzzleState.ts`):** Minimal immutable session model (`ready | playing | paused | completed`, `puzzleId`, `currentSequence`, `moveCount`). `createInitialPuzzleState(puzzle)` returns a frozen `ready` state with `0` moves and a copy of `startingSequence`.

---

## 3. Difficulty Configuration

Defined centrally in `src/core/levels/DifficultyConfig.ts`:

| Difficulty   | ID             | Bottle Count | Default Initial Matches | Default Min Swaps |
| ------------ | -------------- | -----------: | ----------------------- | ----------------: |
| Beginner     | `beginner`     |            3 | `0..1`                  |                 1 |
| Easy         | `easy`         |            4 | `0..2`                  |                 1 |
| Normal       | `normal`       |            5 | `0..2`                  |                 2 |
| Intermediate | `intermediate` |            6 | `0..3`                  |                 2 |
| Hard         | `hard`         |            8 | `0..4`                  |                 3 |
| Expert       | `expert`       |           10 | `0..4`                  |                 4 |

Future levels can override `bottleCount`, initial match bounds, or `minRequiredSwaps` via `PuzzleConfig`; every override is strictly validated before generation.

---

## 4. Seeded Randomisation & Fisher-Yates Shuffle

- **`RandomSource` (`src/core/random/RandomSource.ts`):** Minimal contract `{ next(): number }` returning values strictly in `0 <= value < 1`, plus `SeedProvider` (`() => string | number`) for injecting seeds at the application boundary when callers omit `config.seed`.
- **`SeededRandom` (`src/core/random/SeededRandom.ts`):** Lightweight deterministic **Mulberry32** PRNG (suitable for reproducible game puzzles, not cryptographic security).
  - **Seed policy (`normalizeSeed`):**
    - Finite numbers are truncated toward zero (`-0` normalised to `"0"`).
    - Non-finite numbers (`NaN`, `Infinity`, `-Infinity`) throw `PuzzleError('INVALID_SEED')`.
    - Strings are trimmed; empty/whitespace-only strings throw `PuzzleError('INVALID_SEED')`.
    - Canonical seed strings are hashed into Mulberry32's 32-bit state via deterministic FNV-1a (`hashStringToUint32`).
- **`shuffle<T>` (`src/core/random/Shuffle.ts`):** Generic pure **Fisher-Yates** shuffle operating on a copy of any `readonly T[]`, validating `RandomSource.next() ∈ [0, 1)`, preserving all elements without mutating inputs, and safely handling empty/single-element arrays.

---

## 5. Puzzle Generation Flow (`PuzzleGenerator.ts`)

`generatePuzzle(config, options)` executes 9 deterministic steps:

1. **Validate configuration** via `validatePuzzleConfig(config)` (never silently correcting invalid inputs).
2. **Resolve effective seed** from `config.seed` or injected `options.seedProvider()` (throws `MISSING_SEED` if neither is provided).
3. **Initialise `SeededRandom`** with the normalised seed.
4. **Select unique bottles** (`selectUniqueBottles`) by Fisher-Yates shuffling `CANONICAL_BOTTLE_IDS` and taking the first `bottleCount` entries (ensuring different seeds choose varied bottle subsets for `< 10` bottles).
5. **Generate hidden target sequence** (`generateTargetSequence`) via deterministic Fisher-Yates shuffle of the selected bottles.
6. **Generate unsolved starting sequence** (`generateStartingSequence`) using bounded random shuffles (`DEFAULT_MAX_GENERATION_ATTEMPTS = 256`) with a **deterministic constructive fallback** when random trials exhaust on valid but statistically rare constraints.
7. **Compute deterministic Puzzle ID** (`computeDeterministicPuzzleId`) via dual-lane FNV-1a hex digest (`hashStringToHex`) over `generatorVersion`, `difficulty`, `bottleCount`, effective constraints, and `seed` — zero timestamps.
8. **Construct deeply frozen `Puzzle`** (`Object.freeze` on the puzzle and both sequence arrays).
9. **Validate final puzzle** via `assertValidPuzzle(puzzle, resolvedConfig)` before returning.

---

## 6. Constraint Validation & Permutation Properties

Centralised in `src/core/engine/PuzzleValidator.ts`:

- **Bottle count:** Must be an integer in `[3, 10]`.
- **No `n - 1` match count:** For `n` unique bottles, if `n - 1` bottles match their target positions, the remaining bottle must also match (`n` matches / solved). Therefore valid unsolved initial match bounds must satisfy:
  `0 <= minInitialMatches <= maxInitialMatches <= n - 2`.
- **Minimum swap distance coupling:** A permutation of `n` elements with `k` fixed points leaves `m = n - k >= 2` deranged elements, which can form at minimum `1` cycle (`m`-cycle), yielding at most `n - k - 1` swaps. Therefore:
  `1 <= minRequiredSwaps <= n - minInitialMatches - 1`.
- **Constructive fallback:** When random attempts reach `maxAttempts`, `constructConstrainedStartingSequence` deterministically selects a feasible `k ∈ [minInitialMatches, min(maxInitialMatches, n - 2, n - 1 - minRequiredSwaps)]`, keeps `k` shuffled slots fixed, and arranges the remaining `n - k` slots into a single `(n - k)`-cycle, guaranteeing exact match count `k` and exact swap distance `n - k - 1 >= minRequiredSwaps` in `O(n)` time.

---

## 7. Minimum Swap Distance Algorithm (`SwapDistance.ts`)

For two valid permutations of the same `n` unique bottle identities, `calculateMinimumSwapDistance(fromSequence, toSequence)` decomposes the permutation into disjoint cycles:

```text
minimumSwaps = bottleCount - numberOfPermutationCycles
```

- Identical sequences have `n` cycles of length 1 → `n - n = 0` swaps.
- Swapping one pair produces `(n - 2)` fixed 1-cycles + one 2-cycle (`n - 1` cycles) → `1` swap.
- A single 3-cycle (`[blue, green, red]` vs `[red, blue, green]`) has `1` cycle → `3 - 1 = 2` swaps.

---

## 8. Public vs Private Data Boundaries

- **Internal (`Puzzle`, `PuzzleDiagnostics`):** Retains `targetSequence`, `seed`, and internal generation diagnostics. Owned exclusively by domain/controller logic.
- **Player-visible (`PublicPuzzleView`, `PuzzleState`):** Exposes only `startingSequence` / `currentSequence`, `moveCount`, and `status`. Reusable visual components (`BottleSprite`, `BottleRack`, `MatchCounter`, `HiddenSequenceRack`) never receive `targetSequence`.
- **Future match evaluation:** When gameplay is implemented in Task 05+, the controller will invoke `countMatchingPositions(currentSequence, puzzle.targetSequence)` and pass only the aggregate integer (`matched` / `total`) to `MatchCounter`.
- **Client-side honesty note:** Because Bottle Shuffle runs entirely client-side, the hidden target sequence exists in browser memory and is not cryptographically concealed from browser developer tools; the separation prevents accidental leakage through normal UI and component contracts.

---

## 9. Error Handling Strategy

All domain validation and generation failures throw typed `PuzzleError` instances (`src/core/errors/PuzzleError.ts`) carrying a machine-readable `code` (`INVALID_BOTTLE_COUNT`, `INVALID_DIFFICULTY`, `INVALID_SEED`, `MISSING_SEED`, `INVALID_MATCH_CONSTRAINTS`, `INVALID_SWAP_CONSTRAINTS`, `DUPLICATE_BOTTLE`, `UNSUPPORTED_BOTTLE`, `MISMATCHED_SEQUENCES`, `SOLVED_STARTING_SEQUENCE`, `GENERATION_EXHAUSTED`), descriptive message, and frozen diagnostic `details`. `validatePuzzle()` also provides a non-throwing discriminated-union result for callers that prefer structured inspection.

---

## 10. Example Usage & Development Diagnostics

```ts
import { createInitialPuzzleState, generatePuzzle, toPublicPuzzleView } from './src/core';

const puzzle = generatePuzzle({
  difficulty: 'expert',
  seed: 'daily-2026-11-26',
});

const publicPuzzle = toPublicPuzzleView(puzzle);
const initialState = createInitialPuzzleState(puzzle);
```

Run the development-only CLI inspector (outside the production bundle):

```bash
npm run puzzle:inspect -- --difficulty expert --seed demo-2026
npm run puzzle:inspect -- --count 6 --seed custom-42 --min-matches 1 --max-matches 2 --min-swaps 3
```

---

## 11. Testing Strategy & Known Limitations

- **Unit & stress tests (`tests/unit/core/`):** Covers `SeededRandom`, `Shuffle`, `DifficultyConfig`, `SequenceGenerator`, `PuzzleValidator`, `SwapDistance`, and `PuzzleGenerator`, including a deterministic **1,260-puzzle stress test** across all 6 difficulties and 60 strict custom-constraint permutations.
- **Known limitations:**
  - `Mulberry32` + FNV-1a is designed for fast, deterministic puzzle reproducibility, not cryptographic security.
  - Gameplay state transitions (bottle swapping, timers, move history, win transitions) and level progression are intentionally deferred to subsequent tasks.
