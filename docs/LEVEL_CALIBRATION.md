# Level Calibration Report — Bottle Shuffle (50-Level Initial Catalogue)

Generated directly by `npm run levels:calibrate` against the deterministic `PuzzleGenerator` (`v1.0.0`).

> **Note:** Initial aggregate match count and minimum swap distance (full-information permutation cycle distance) are structural complexity indicators only. Because Bottle Shuffle is a hidden-target deduction game, they do **not** represent expected player move counts; actual difficulty tuning requires playtesting or a hidden-information deduction solver.

## Aggregate Summary

- **Total Levels:** 50
- **Valid Puzzles:** 50/50
- **Duplicate Complete Puzzles:** 0

## Tier Statistics

| Difficulty   | Levels | Bottles | Min Matches | Max Matches | Avg Matches | Min Swaps | Max Swaps | Avg Min Swaps | Unique Bottle Sets |
| ------------ | -----: | ------: | ----------: | ----------: | ----------: | --------: | --------: | ------------: | -----------------: |
| beginner     |      5 |       3 |           0 |           1 |        0.60 |         1 |         2 |          1.40 |                  5 |
| easy         |      5 |       4 |           0 |           2 |        0.80 |         1 |         3 |          2.00 |                  5 |
| normal       |     10 |       5 |           0 |           2 |        0.80 |         2 |         4 |          2.70 |                  9 |
| intermediate |     10 |       6 |           0 |           3 |        1.00 |         2 |         5 |          3.50 |                 10 |
| hard         |     10 |       8 |           0 |           2 |        1.10 |         3 |         6 |          5.10 |                 10 |
| expert       |     10 |      10 |           0 |           4 |        1.70 |         5 |         8 |          6.40 |                  1 |

## Per-Level Calibration Table

| Level     | Chapter        | Difficulty   | Bottles | Seed                         | Gen Ver | Init Matches | Min Swaps | Valid | Duplicate |
| --------- | -------------- | ------------ | ------: | ---------------------------- | ------- | -----------: | --------: | ----- | --------- |
| level-001 | First Steps    | beginner     |       3 | `level-001-f3d5e8e447e014dd` | 1.0.0   |          1/3 |         1 | PASS  | None      |
| level-002 | First Steps    | beginner     |       3 | `level-002-f6d5ed9d39bc58b6` | 1.0.0   |          1/3 |         1 | PASS  | None      |
| level-003 | First Steps    | beginner     |       3 | `level-003-f5d5ec0aff4cd363` | 1.0.0   |          1/3 |         1 | PASS  | None      |
| level-004 | First Steps    | beginner     |       3 | `level-004-2b9135e915bd9262` | 1.0.0   |          0/3 |         2 | PASS  | None      |
| level-005 | First Steps    | beginner     |       3 | `level-005-254088fdb3a75e7e` | 1.0.0   |          0/3 |         2 | PASS  | None      |
| level-006 | Getting Warmer | easy         |       4 | `level-006-f2d5e75178d8343a` | 1.0.0   |          0/4 |         3 | PASS  | None      |
| level-007 | Getting Warmer | easy         |       4 | `level-007-f1d5e5be3e68aee7` | 1.0.0   |          2/4 |         1 | PASS  | None      |
| level-008 | Getting Warmer | easy         |       4 | `level-008-ecd5dddf6403a6b0` | 1.0.0   |          1/4 |         2 | PASS  | None      |
| level-009 | Getting Warmer | easy         |       4 | `level-009-ebd5dc4cd2ada1c5` | 1.0.0   |          0/4 |         2 | PASS  | None      |
| level-010 | Getting Warmer | easy         |       4 | `level-010-eed3a26e2a1ccd9f` | 1.0.0   |          1/4 |         2 | PASS  | None      |
| level-011 | The Shuffle    | normal       |       5 | `level-011-efd3a401648c52f2` | 1.0.0   |          1/5 |         3 | PASS  | None      |
| level-012 | The Shuffle    | normal       |       5 | `level-012-ecd39f485261bdd9` | 1.0.0   |          0/5 |         3 | PASS  | None      |
| level-013 | The Shuffle    | normal       |       5 | `level-013-edd3a0db83b72ba4` | 1.0.0   |          0/5 |         3 | PASS  | None      |
| level-014 | The Shuffle    | normal       |       5 | `level-014-f2d3a8ba0b01247b` | 1.0.0   |          0/5 |         4 | PASS  | None      |
| level-015 | The Shuffle    | normal       |       5 | `level-015-f3d3aa4d4570a9ce` | 1.0.0   |          1/5 |         2 | PASS  | None      |
| level-016 | The Shuffle    | normal       |       5 | `level-016-f0d3a594b3454b35` | 1.0.0   |          1/5 |         3 | PASS  | None      |
| level-017 | The Shuffle    | normal       |       5 | `level-017-f1d3a727449b5020` | 1.0.0   |          1/5 |         2 | PASS  | None      |
| level-018 | The Shuffle    | normal       |       5 | `level-018-e6d395d6217ac157` | 1.0.0   |          1/5 |         3 | PASS  | None      |
| level-019 | The Shuffle    | normal       |       5 | `level-019-e7d39769596fddaa` | 1.0.0   |          1/5 |         2 | PASS  | None      |
| level-020 | The Shuffle    | normal       |       5 | `level-020-e8d15a65a554c63e` | 1.0.0   |          2/5 |         2 | PASS  | None      |
| level-021 | Mind Games     | intermediate |       6 | `level-021-e7d158d26ae540eb` | 1.0.0   |          2/6 |         2 | PASS  | None      |
| level-022 | Mind Games     | intermediate |       6 | `level-022-e6d1573f24803610` | 1.0.0   |          1/6 |         3 | PASS  | None      |
| level-023 | Mind Games     | intermediate |       6 | `level-023-e5d155acac76e625` | 1.0.0   |          0/6 |         5 | PASS  | None      |
| level-024 | Mind Games     | intermediate |       6 | `level-024-e4d154195dbdede2` | 1.0.0   |          1/6 |         4 | PASS  | None      |
| level-025 | Mind Games     | intermediate |       6 | `level-025-e3d15286234e688f` | 1.0.0   |          0/6 |         3 | PASS  | None      |
| level-026 | Mind Games     | intermediate |       6 | `level-026-e2d150f37ce8c694` | 1.0.0   |          3/6 |         2 | PASS  | None      |
| level-027 | Mind Games     | intermediate |       6 | `level-027-e1d14f604b9358c9` | 1.0.0   |          2/6 |         3 | PASS  | None      |
| level-028 | Mind Games     | intermediate |       6 | `level-028-f0d166fd7cb28796` | 1.0.0   |          1/6 |         4 | PASS  | None      |
| level-029 | Mind Games     | intermediate |       6 | `level-029-efd1656a42430243` | 1.0.0   |          0/6 |         5 | PASS  | None      |
| level-030 | Mind Games     | intermediate |       6 | `level-030-e2cf125c8c5bcc15` | 1.0.0   |          0/6 |         4 | PASS  | None      |
| level-031 | Brain Teaser   | hard         |       8 | `level-031-e3cf13ef9db10780` | 1.0.0   |          1/8 |         5 | PASS  | None      |
| level-032 | Brain Teaser   | hard         |       8 | `level-032-e4cf15826416dbdb` | 1.0.0   |          1/8 |         6 | PASS  | None      |
| level-033 | Brain Teaser   | hard         |       8 | `level-033-e5cf17159e86612e` | 1.0.0   |          1/8 |         6 | PASS  | None      |
| level-034 | Brain Teaser   | hard         |       8 | `level-034-decf0c10c4c42a39` | 1.0.0   |          1/8 |         5 | PASS  | None      |
| level-035 | Brain Teaser   | hard         |       8 | `level-035-dfcf0da3761a6184` | 1.0.0   |          0/8 |         6 | PASS  | None      |
| level-036 | Brain Teaser   | hard         |       8 | `level-036-e0cf0f3603334e7f` | 1.0.0   |          2/8 |         5 | PASS  | None      |
| level-037 | Brain Teaser   | hard         |       8 | `level-037-e1cf10c93da2d3d2` | 1.0.0   |          0/8 |         6 | PASS  | None      |
| level-038 | Brain Teaser   | hard         |       8 | `level-038-eacf1ef40408a82d` | 1.0.0   |          2/8 |         3 | PASS  | None      |
| level-039 | Brain Teaser   | hard         |       8 | `level-039-ebcf2087950efb38` | 1.0.0   |          2/8 |         4 | PASS  | None      |
| level-040 | Brain Teaser   | hard         |       8 | `level-040-5ccc00d3d3d01c84` | 1.0.0   |          1/8 |         5 | PASS  | None      |
| level-041 | Mastermind     | expert       |      10 | `level-041-5bcbff402279e539` | 1.0.0   |         0/10 |         8 | PASS  | None      |
| level-042 | Mastermind     | expert       |      10 | `level-042-5ecc03f99b588ed2` | 1.0.0   |         1/10 |         8 | PASS  | None      |
| level-043 | Mastermind     | expert       |      10 | `level-043-5dcc026660e9097f` | 1.0.0   |         3/10 |         6 | PASS  | None      |
| level-044 | Mastermind     | expert       |      10 | `level-044-60cc071ffb66c280` | 1.0.0   |         2/10 |         5 | PASS  | None      |
| level-045 | Mastermind     | expert       |      10 | `level-045-5fcc058cea118715` | 1.0.0   |         2/10 |         6 | PASS  | None      |
| level-046 | Mastermind     | expert       |      10 | `level-046-62cc0a45fc3c1c2e` | 1.0.0   |         1/10 |         7 | PASS  | None      |
| level-047 | Mastermind     | expert       |      10 | `level-047-61cc08b2c1cc96db` | 1.0.0   |         3/10 |         5 | PASS  | None      |
| level-048 | Mastermind     | expert       |      10 | `level-048-64cc0d6b8f66bfdc` | 1.0.0   |         1/10 |         7 | PASS  | None      |
| level-049 | Mastermind     | expert       |      10 | `level-049-63cc0bd87e5fa351` | 1.0.0   |         4/10 |         5 | PASS  | None      |
| level-050 | Mastermind     | expert       |      10 | `level-050-76c9eb2abafe31cb` | 1.0.0   |         0/10 |         7 | PASS  | None      |
