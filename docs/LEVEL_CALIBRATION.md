# Level Calibration Report — Bottle Shuffle (50-Level Catalogue v2.0.0)

Generated directly by `npm run levels:calibrate -- --markdown` against the deterministic `PuzzleGenerator` (`v1.0.0`) and `CampaignBalanceConfig`.

> **Note:** Initial aggregate match count and minimum swap distance (full-information permutation cycle distance) are structural complexity indicators only. Because Bottle Shuffle is a hidden-target deduction game, they do **not** represent expected player move counts. Time and move limits are configured centrally in `src/core/levels/CampaignBalanceConfig.ts`, verified mathematically and via an automated blind-deduction heuristic (`npm run validate:campaign`), and remain subject to real human playtesting.

## Aggregate Summary

- **Campaign Catalogue Version:** `2.0.0`
- **Total Levels:** 50
- **Valid Puzzles:** 50/50
- **Duplicate Complete Puzzles:** 0

## Chapter Statistics

| Chapter      | Display Name      | Mode            | Levels | Bottles | Min Matches | Max Matches | Avg Matches | Min Swaps | Max Swaps | Avg Min Swaps | Unique Bottle Sets |
| ------------ | ----------------- | --------------- | -----: | :-----: | ----------: | ----------: | ----------: | --------: | --------: | ------------: | -----------------: |
| `chapter-01` | First Steps       | `classic`       |      8 |  3-10   |           0 |           1 |        0.63 |         1 |         8 |          4.38 |                  8 |
| `chapter-02` | Beat the Clock    | `timed`         |      8 |  3-10   |           0 |           2 |        1.13 |         1 |         7 |          3.63 |                  8 |
| `chapter-03` | Speed Mastery     | `timed`         |      8 |  3-10   |           0 |           2 |        0.75 |         2 |         8 |          4.38 |                  8 |
| `chapter-04` | Every Move Counts | `limited_moves` |      8 |  3-10   |           0 |           1 |        0.75 |         1 |         7 |          4.25 |                  8 |
| `chapter-05` | Double Trouble    | `combined`      |      8 |  3-10   |           0 |           3 |        1.13 |         1 |         7 |          3.75 |                  8 |
| `chapter-06` | Shuffle Master    | `combined`      |     10 |  6-10   |           0 |           3 |        0.70 |         4 |         8 |          5.90 |                  7 |

## Per-Level Calibration Table

| Level     | Chapter           | Mode            | Bottles | Time Limit | Move Limit | Difficulty   | Seed                         | Init Matches | Min Swaps | Valid | Duplicate |
| --------- | ----------------- | --------------- | ------: | ---------: | ---------: | ------------ | ---------------------------- | -----------: | --------: | ----- | --------- |
| level-001 | First Steps       | `classic`       |       3 |          - |          - | beginner     | `level-001-1c4caebc8abf56f5` |          1/3 |         1 | PASS  | None      |
| level-002 | First Steps       | `classic`       |       4 |          - |          - | easy         | `level-002-8b20f40fd2a69490` |          0/4 |         3 | PASS  | None      |
| level-003 | First Steps       | `classic`       |       5 |          - |          - | normal       | `level-003-24aef56ee3a018cf` |          1/5 |         2 | PASS  | None      |
| level-004 | First Steps       | `classic`       |       6 |          - |          - | intermediate | `level-004-fe2726d98610c362` |          0/6 |         4 | PASS  | None      |
| level-005 | First Steps       | `classic`       |       7 |          - |          - | hard         | `level-005-1c84d3100e55e1f9` |          0/7 |         6 | PASS  | None      |
| level-006 | First Steps       | `classic`       |       8 |          - |          - | hard         | `level-006-64751193d7d75e44` |          1/8 |         4 | PASS  | None      |
| level-007 | First Steps       | `classic`       |       9 |          - |          - | expert       | `level-007-352f6632fda9d173` |          1/9 |         7 | PASS  | None      |
| level-008 | First Steps       | `classic`       |      10 |          - |          - | expert       | `level-008-07f6bc1d88d2a5b6` |         1/10 |         8 | PASS  | None      |
| level-009 | Beat the Clock    | `timed`         |       3 |        30s |          - | beginner     | `level-009-ea44115303711e84` |          1/3 |         1 | PASS  | None      |
| level-010 | Beat the Clock    | `timed`         |       4 |        45s |          - | easy         | `level-010-d6a8d34914316d12` |          2/4 |         1 | PASS  | None      |
| level-011 | Beat the Clock    | `timed`         |       5 |        60s |          - | normal       | `level-011-5a697df05e9a6629` |          2/5 |         2 | PASS  | None      |
| level-012 | Beat the Clock    | `timed`         |       6 |        90s |          - | intermediate | `level-012-1b3b2d87ae1bcd60` |          2/6 |         2 | PASS  | None      |
| level-013 | Beat the Clock    | `timed`         |       7 |       120s |          - | hard         | `level-013-721749c625dc282f` |          0/7 |         5 | PASS  | None      |
| level-014 | Beat the Clock    | `timed`         |       8 |       150s |          - | hard         | `level-014-e63fe29d51dfd966` |          0/8 |         6 | PASS  | None      |
| level-015 | Beat the Clock    | `timed`         |       9 |       180s |          - | expert       | `level-015-1ed476941e489d2d` |          0/9 |         7 | PASS  | None      |
| level-016 | Beat the Clock    | `timed`         |      10 |       210s |          - | expert       | `level-016-6ea2710b86a346b4` |         2/10 |         5 | PASS  | None      |
| level-017 | Speed Mastery     | `timed`         |       3 |        20s |          - | beginner     | `level-017-78137bfeab1a7df7` |          0/3 |         2 | PASS  | None      |
| level-018 | Speed Mastery     | `timed`         |       4 |        30s |          - | easy         | `level-018-7247c8593b9c2b0a` |          0/4 |         3 | PASS  | None      |
| level-019 | Speed Mastery     | `timed`         |       5 |        45s |          - | normal       | `level-019-89f3fe486ad2b8b9` |          2/5 |         2 | PASS  | None      |
| level-020 | Speed Mastery     | `timed`         |       6 |        60s |          - | intermediate | `level-020-31d3fac4ae0e5b3d` |          1/6 |         4 | PASS  | None      |
| level-021 | Speed Mastery     | `timed`         |       7 |        90s |          - | hard         | `level-021-1d578395ad2ce2ee` |          0/7 |         6 | PASS  | None      |
| level-022 | Speed Mastery     | `timed`         |       8 |       120s |          - | hard         | `level-022-f05657e6bfc1b707` |          2/8 |         3 | PASS  | None      |
| level-023 | Speed Mastery     | `timed`         |       9 |       150s |          - | expert       | `level-023-bb6d442f2f4506d0` |          1/9 |         7 | PASS  | None      |
| level-024 | Speed Mastery     | `timed`         |      10 |       180s |          - | expert       | `level-024-10be6198bbd6ef01` |         0/10 |         8 | PASS  | None      |
| level-025 | Every Move Counts | `limited_moves` |       3 |          - |          6 | beginner     | `level-025-42f56c5071650d01` |          1/3 |         1 | PASS  | None      |
| level-026 | Every Move Counts | `limited_moves` |       4 |          - |         10 | easy         | `level-026-e5bbe62f10373de0` |          1/4 |         2 | PASS  | None      |
| level-027 | Every Move Counts | `limited_moves` |       5 |          - |         15 | normal       | `level-027-1e7b2d62bd79020b` |          0/5 |         4 | PASS  | None      |
| level-028 | Every Move Counts | `limited_moves` |       6 |          - |         20 | intermediate | `level-028-50ac2c797e466022` |          1/6 |         4 | PASS  | None      |
| level-029 | Every Move Counts | `limited_moves` |       7 |          - |         26 | hard         | `level-029-96a0f8ac4bcd835d` |          1/7 |         5 | PASS  | None      |
| level-030 | Every Move Counts | `limited_moves` |       8 |          - |         32 | hard         | `level-030-9e634b56a0f2a44f` |          1/8 |         5 | PASS  | None      |
| level-031 | Every Move Counts | `limited_moves` |       9 |          - |         38 | expert       | `level-031-58d533b3d45a0834` |          1/9 |         6 | PASS  | None      |
| level-032 | Every Move Counts | `limited_moves` |      10 |          - |         45 | expert       | `level-032-0a72121433e2d945` |         0/10 |         7 | PASS  | None      |
| level-033 | Double Trouble    | `combined`      |       3 |        30s |          7 | beginner     | `level-033-fd384724befc6945` |          1/3 |         1 | PASS  | None      |
| level-034 | Double Trouble    | `combined`      |       4 |        45s |         11 | easy         | `level-034-403f7cf55afdfd8e` |          1/4 |         2 | PASS  | None      |
| level-035 | Double Trouble    | `combined`      |       5 |        65s |         16 | normal       | `level-035-f0677092ada9603b` |          0/5 |         4 | PASS  | None      |
| level-036 | Double Trouble    | `combined`      |       6 |        95s |         22 | intermediate | `level-036-0d8eabcb4b2e19d4` |          2/6 |         2 | PASS  | None      |
| level-037 | Double Trouble    | `combined`      |       7 |       125s |         28 | hard         | `level-037-1c506be05c31c2a1` |          1/7 |         5 | PASS  | None      |
| level-038 | Double Trouble    | `combined`      |       8 |       155s |         34 | hard         | `level-038-50ab0da1c78f478a` |          1/8 |         5 | PASS  | None      |
| level-039 | Double Trouble    | `combined`      |       9 |       185s |         40 | expert       | `level-039-3b7714eeff3fadc7` |          3/9 |         4 | PASS  | None      |
| level-040 | Double Trouble    | `combined`      |      10 |       215s |         48 | expert       | `level-040-b1c48ae251b4733b` |         0/10 |         7 | PASS  | None      |
| level-041 | Shuffle Master    | `combined`      |       6 |        75s |         19 | intermediate | `level-041-2718de78264821c1` |          0/6 |         4 | PASS  | None      |
| level-042 | Shuffle Master    | `combined`      |       7 |       105s |         25 | hard         | `level-042-c0f2f7e05f638449` |          0/7 |         5 | PASS  | None      |
| level-043 | Shuffle Master    | `combined`      |       7 |        90s |         24 | hard         | `level-043-87ef201011975899` |          0/7 |         5 | PASS  | None      |
| level-044 | Shuffle Master    | `combined`      |       8 |       135s |         31 | hard         | `level-044-6c2aefa80be45521` |          1/8 |         6 | PASS  | None      |
| level-045 | Shuffle Master    | `combined`      |       8 |       115s |         29 | hard         | `level-045-16686908d91d9f71` |          1/8 |         5 | PASS  | None      |
| level-046 | Shuffle Master    | `combined`      |       9 |       160s |         37 | expert       | `level-046-e8c33810df80b4d9` |          0/9 |         8 | PASS  | None      |
| level-047 | Shuffle Master    | `combined`      |       9 |       140s |         35 | expert       | `level-047-905641a0ac8b0349` |          0/9 |         7 | PASS  | None      |
| level-048 | Shuffle Master    | `combined`      |      10 |       195s |         44 | expert       | `level-048-98c8cd18c17dc551` |         0/10 |         8 | PASS  | None      |
| level-049 | Shuffle Master    | `combined`      |      10 |       175s |         42 | expert       | `level-049-6e495aa87c861111` |         2/10 |         6 | PASS  | None      |
| level-050 | Shuffle Master    | `combined`      |      10 |       160s |         40 | expert       | `level-050-f6cfafce8e6caaef` |         3/10 |         5 | PASS  | None      |

## Balancing Methodology & Empirical Validation Notes

- **Centralised Tuning Configuration:** All Chapter 2–6 time limits and move limits live in `src/core/levels/CampaignBalanceConfig.ts` (`CAMPAIGN_CATALOG_VERSION = '2.0.0'`), enabling fast post-playtest iteration without modifying gameplay engine or scene code.
- **Automated Verification (`npm run validate:campaign -- --print-balance`):**
  1. **Mathematical Solvability:** Verified `50/50` levels are mathematically solvable within their exact `moveLimit` (`minimumRequiredSwaps <= moveLimit`) and `timeLimitSeconds`, with `50/50` unique complete puzzles and `10/10` unique Chapter 6 challenge configurations.
  2. **Blind Hidden-Sequence Deduction Simulation:** Executed an automated slot-locking deduction heuristic that has **zero access to `targetSequence`** and reads only `PublicGameState.currentMatchCount`. At `3.0 s/swap`, `49/50` timed/combined levels finished cleanly within their time limits (with Level 24 `10B / 180s` estimating `186s` under naive probing). For move limits, `13/50` levels were flagged `TIGHT` under the naive heuristic (primarily Chapter 6 `Shuffle Master` 8–10 bottle mastery levels, which intentionally reward more disciplined deduction than mechanical slot probing).
- **Human Playtesting Status:** **Not yet performed.** Automated blind-deduction results are **not** a substitute for real human playtesting. Before shipping a public `1.0.0` release, unfamiliar human players should playtest Chapters 2–6 to empirically tune move allowances and timers in `CampaignBalanceConfig.ts`.
