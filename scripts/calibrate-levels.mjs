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
      if (!seenBottleSetsByTier.has(level.chapterId)) {
        seenBottleSetsByTier.set(level.chapterId, new Set());
      }
      seenBottleSetsByTier.get(level.chapterId).add(bottleSetKey);

      rows.push({
        levelId: level.id,
        levelNumber: level.levelNumber,
        chapterId: level.chapterId,
        chapterName: chapter ? chapter.displayName : level.chapterId,
        challengeMode: level.challengeMode,
        difficulty: level.difficulty,
        bottleCount: level.bottleCount,
        timeLimitSeconds: level.timeLimitSeconds,
        moveLimit: level.moveLimit,
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

    // Aggregate statistics per chapter
    const chapters = catalog.getAllChapters();
    const chapterStats = [];

    for (const chapter of chapters) {
      const chapterRows = rows.filter((r) => r.chapterId === chapter.id);
      if (chapterRows.length === 0) {
        continue;
      }
      const matches = chapterRows.map((r) => r.initialMatches);
      const swaps = chapterRows.map((r) => r.minSwaps);
      const avgMatches = matches.reduce((a, b) => a + b, 0) / matches.length;
      const avgSwaps = swaps.reduce((a, b) => a + b, 0) / swaps.length;
      const uniqueBottleSets = seenBottleSetsByTier.get(chapter.id)?.size ?? 0;

      chapterStats.push({
        chapterId: chapter.id,
        chapterName: chapter.displayName,
        challengeMode: chapter.challengeMode,
        levels: chapterRows.length,
        bottles: `${String(chapter.minBottleCount)}-${String(chapter.maxBottleCount)}`,
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
      console.log(
        `# Level Calibration Report — Bottle Shuffle (50-Level Catalogue v${core.CAMPAIGN_CATALOG_VERSION})`,
      );
      console.log('');
      console.log(
        'Generated directly by `npm run levels:calibrate -- --markdown` against the deterministic `PuzzleGenerator` (`v1.0.0`) and `CampaignBalanceConfig`.',
      );
      console.log('');
      console.log(
        '> **Note:** Initial aggregate match count and minimum swap distance (full-information permutation cycle distance) are structural complexity indicators only. Because Bottle Shuffle is a hidden-target deduction game, they do **not** represent expected player move counts. Time and move limits are configured centrally in `src/core/levels/CampaignBalanceConfig.ts`, verified mathematically and via an automated blind-deduction heuristic (`npm run validate:campaign`), and remain subject to real human playtesting.',
      );
      console.log('');
      console.log('## Aggregate Summary');
      console.log('');
      console.log(`- **Campaign Catalogue Version:** \`${core.CAMPAIGN_CATALOG_VERSION}\``);
      console.log(`- **Total Levels:** ${String(rows.length)}`);
      console.log(
        `- **Valid Puzzles:** ${String(rows.length - invalidCount)}/${String(rows.length)}`,
      );
      console.log(`- **Duplicate Complete Puzzles:** ${String(duplicateCount)}`);
      console.log('');
      console.log('## Chapter Statistics');
      console.log('');
      console.log(
        '| Chapter | Display Name | Mode | Levels | Bottles | Min Matches | Max Matches | Avg Matches | Min Swaps | Max Swaps | Avg Min Swaps | Unique Bottle Sets |',
      );
      console.log(
        '| --- | --- | --- | ---: | :---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
      );
      for (const s of chapterStats) {
        console.log(
          `| \`${s.chapterId}\` | ${s.chapterName} | \`${s.challengeMode}\` | ${String(s.levels)} | ${s.bottles} | ${String(s.minMatches)} | ${String(s.maxMatches)} | ${s.avgMatches.toFixed(2)} | ${String(s.minSwaps)} | ${String(s.maxSwaps)} | ${s.avgSwaps.toFixed(2)} | ${String(s.uniqueBottleSets)} |`,
        );
      }
      console.log('');
      console.log('## Per-Level Calibration Table');
      console.log('');
      console.log(
        '| Level | Chapter | Mode | Bottles | Time Limit | Move Limit | Difficulty | Seed | Init Matches | Min Swaps | Valid | Duplicate |',
      );
      console.log('| --- | --- | --- | ---: | ---: | ---: | --- | --- | ---: | ---: | --- | --- |');
      for (const r of rows) {
        console.log(
          `| ${r.levelId} | ${r.chapterName} | \`${r.challengeMode}\` | ${String(r.bottleCount)} | ${r.timeLimitSeconds !== null ? `${String(r.timeLimitSeconds)}s` : '-'} | ${r.moveLimit !== null ? String(r.moveLimit) : '-'} | ${r.difficulty} | \`${r.seed}\` | ${String(r.initialMatches)}/${String(r.bottleCount)} | ${String(r.minSwaps)} | ${r.valid ? 'PASS' : 'FAIL'} | ${r.duplicateOf ?? 'None'} |`,
        );
      }
    } else {
      console.log(
        `=== Bottle Shuffle 50-Level Calibration Report (v${core.CAMPAIGN_CATALOG_VERSION}, DEV ONLY) ===`,
      );
      console.log(
        `Total: ${String(rows.length)} | Valid: ${String(rows.length - invalidCount)} | Duplicates: ${String(duplicateCount)}`,
      );
      console.log('');
      console.log('--- Chapter Aggregate Statistics ---');
      console.table(chapterStats);
      console.log('--- Representative Golden Fixtures ---');
      for (const idx of [0, 7, 8, 16, 24, 32, 40, 49]) {
        const r = rows[idx];
        if (r) {
          console.log(
            `${r.levelId} (${r.challengeMode}, ${String(r.bottleCount)}B, ${r.seed}): start=[${r.starting}] -> target=[${r.target}] (matches=${String(r.initialMatches)}, minSwaps=${String(r.minSwaps)})`,
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
