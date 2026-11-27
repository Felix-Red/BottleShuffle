import { createServer } from 'vite';

async function main() {
  const args = process.argv.slice(2);
  const asMarkdown = args.includes('--markdown');

  const server = await createServer({
    logLevel: 'silent',
    server: { middlewareMode: true },
    appType: 'custom',
  });

  try {
    const core = await server.ssrLoadModule('/src/core/index.ts');
    const catalog = core.getDefaultLevelCatalog();
    const levels = catalog.getAllLevels();

    const rows = [];
    const seenCompleteSignatures = new Map();
    const seenBottleSetsByTier = new Map();
    let invalidCount = 0;
    let duplicateCount = 0;

    for (const level of levels) {
      const chapter = catalog.getChapterForLevel(level.id);
      const puzzle = core.generateLevelPuzzle(level);
      const validation = core.validatePuzzle(puzzle, core.toLevelPuzzleConfig(level));
      const diag = core.inspectPuzzleDiagnostics(puzzle);

      const signature = `${puzzle.startingSequence.join(',')}=>${puzzle.targetSequence.join(',')}`;
      const duplicateOf = seenCompleteSignatures.get(signature) ?? null;
      if (duplicateOf !== null) {
        duplicateCount += 1;
      } else {
        seenCompleteSignatures.set(signature, level.id);
      }

      if (!validation.valid) {
        invalidCount += 1;
      }

      const bottleSetKey = [...puzzle.targetSequence].sort().join(',');
      if (!seenBottleSetsByTier.has(level.difficulty)) {
        seenBottleSetsByTier.set(level.difficulty, new Set());
      }
      seenBottleSetsByTier.get(level.difficulty).add(bottleSetKey);

      rows.push({
        levelId: level.id,
        levelNumber: level.levelNumber,
        chapterId: level.chapterId,
        chapterName: chapter ? chapter.displayName : level.chapterId,
        difficulty: level.difficulty,
        bottleCount: level.bottleCount,
        seed: level.seed,
        generatorVersion: level.generatorVersion,
        initialMatches: diag.initialMatchCount,
        minSwaps: diag.minimumSwapDistance,
        valid: validation.valid,
        duplicateOf,
        starting: puzzle.startingSequence.join(', '),
        target: puzzle.targetSequence.join(', '),
      });
    }

    // Aggregate statistics per difficulty tier
    const tierOrder = ['beginner', 'easy', 'normal', 'intermediate', 'hard', 'expert'];
    const tierStats = [];

    for (const tier of tierOrder) {
      const tierRows = rows.filter((r) => r.difficulty === tier);
      if (tierRows.length === 0) {
        continue;
      }
      const matches = tierRows.map((r) => r.initialMatches);
      const swaps = tierRows.map((r) => r.minSwaps);
      const avgMatches = matches.reduce((a, b) => a + b, 0) / matches.length;
      const avgSwaps = swaps.reduce((a, b) => a + b, 0) / swaps.length;
      const uniqueBottleSets = seenBottleSetsByTier.get(tier)?.size ?? 0;

      tierStats.push({
        difficulty: tier,
        levels: tierRows.length,
        bottles: tierRows[0].bottleCount,
        minMatches: Math.min(...matches),
        maxMatches: Math.max(...matches),
        avgMatches: Number(avgMatches.toFixed(2)),
        minSwaps: Math.min(...swaps),
        maxSwaps: Math.max(...swaps),
        avgSwaps: Number(avgSwaps.toFixed(2)),
        uniqueBottleSets,
      });
    }

    if (asMarkdown) {
      console.log('# Level Calibration Report — Bottle Shuffle (50-Level Initial Catalogue)');
      console.log('');
      console.log(
        'Generated directly by `npm run levels:calibrate` against the deterministic `PuzzleGenerator` (`v1.0.0`).',
      );
      console.log('');
      console.log(
        '> **Note:** Initial aggregate match count and minimum swap distance (full-information permutation cycle distance) are structural complexity indicators only. Because Bottle Shuffle is a hidden-target deduction game, they do **not** represent expected player move counts; actual difficulty tuning requires playtesting or a hidden-information deduction solver.',
      );
      console.log('');
      console.log('## Aggregate Summary');
      console.log('');
      console.log(`- **Total Levels:** ${String(rows.length)}`);
      console.log(
        `- **Valid Puzzles:** ${String(rows.length - invalidCount)}/${String(rows.length)}`,
      );
      console.log(`- **Duplicate Complete Puzzles:** ${String(duplicateCount)}`);
      console.log('');
      console.log('## Tier Statistics');
      console.log('');
      console.log(
        '| Difficulty | Levels | Bottles | Min Matches | Max Matches | Avg Matches | Min Swaps | Max Swaps | Avg Min Swaps | Unique Bottle Sets |',
      );
      console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
      for (const s of tierStats) {
        console.log(
          `| ${s.difficulty} | ${String(s.levels)} | ${String(s.bottles)} | ${String(s.minMatches)} | ${String(s.maxMatches)} | ${s.avgMatches.toFixed(2)} | ${String(s.minSwaps)} | ${String(s.maxSwaps)} | ${s.avgSwaps.toFixed(2)} | ${String(s.uniqueBottleSets)} |`,
        );
      }
      console.log('');
      console.log('## Per-Level Calibration Table');
      console.log('');
      console.log(
        '| Level | Chapter | Difficulty | Bottles | Seed | Gen Ver | Init Matches | Min Swaps | Valid | Duplicate |',
      );
      console.log('| --- | --- | --- | ---: | --- | --- | ---: | ---: | --- | --- |');
      for (const r of rows) {
        console.log(
          `| ${r.levelId} | ${r.chapterName} | ${r.difficulty} | ${String(r.bottleCount)} | \`${r.seed}\` | ${r.generatorVersion} | ${String(r.initialMatches)}/${String(r.bottleCount)} | ${String(r.minSwaps)} | ${r.valid ? 'PASS' : 'FAIL'} | ${r.duplicateOf ?? 'None'} |`,
        );
      }
    } else {
      console.log('=== Bottle Shuffle 50-Level Calibration Report (DEV ONLY) ===');
      console.log(
        `Total: ${String(rows.length)} | Valid: ${String(rows.length - invalidCount)} | Duplicates: ${String(duplicateCount)}`,
      );
      console.log('');
      console.log('--- Tier Aggregate Statistics ---');
      console.table(tierStats);
      console.log('--- Representative Golden Fixtures ---');
      for (const idx of [0, 4, 5, 10, 20, 30, 40, 49]) {
        const r = rows[idx];
        if (r) {
          console.log(
            `${r.levelId} (${r.difficulty}, ${r.seed}): start=[${r.starting}] -> target=[${r.target}] (matches=${String(r.initialMatches)}, minSwaps=${String(r.minSwaps)})`,
          );
        }
      }
    }

    if (invalidCount > 0 || duplicateCount > 0) {
      process.exitCode = 1;
    }
  } finally {
    await server.close();
  }
}

void main();
