import { performance } from 'node:perf_hooks';
import { createServer } from 'vite';

const PER_TIER_DEFAULT = 2000;
const DIFFICULTIES = ['beginner', 'easy', 'normal', 'intermediate', 'hard', 'expert'];

async function main() {
  const countArg = process.argv.find((a) => a.startsWith('--per-tier='));
  const perTier = countArg ? Math.max(1, Number(countArg.split('=')[1])) : PER_TIER_DEFAULT;

  const server = await createServer({
    logLevel: 'silent',
    server: { middlewareMode: true },
    appType: 'custom',
  });

  try {
    const core = await server.ssrLoadModule('/src/core/index.ts');
    const summary = [];
    const failures = [];
    let totalGenerated = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let globalSlowestMs = 0;
    let globalSlowestInfo = '';

    for (const difficulty of DIFFICULTIES) {
      const def = core.getDifficultyDefinition(difficulty);
      let tierPassed = 0;
      let tierFailed = 0;
      let tierTotalMs = 0;
      let tierSlowestMs = 0;
      let sumInitialMatches = 0;
      let sumMinSwaps = 0;

      for (let i = 0; i < perTier; i += 1) {
        totalGenerated += 1;
        const seed = `qa-stress-${difficulty}-${String(i).padStart(5, '0')}`;
        const inputConfig = { difficulty, seed };
        const configBefore = JSON.stringify(inputConfig);

        const t0 = performance.now();
        try {
          const puzzle = core.generatePuzzle(inputConfig);
          const elapsedMs = performance.now() - t0;
          tierTotalMs += elapsedMs;
          if (elapsedMs > tierSlowestMs) {
            tierSlowestMs = elapsedMs;
          }
          if (elapsedMs > globalSlowestMs) {
            globalSlowestMs = elapsedMs;
            globalSlowestInfo = `${difficulty} (${seed})`;
          }

          const configAfter = JSON.stringify(inputConfig);
          if (configBefore !== configAfter) {
            throw new Error('Input configuration object was mutated by generatePuzzle()');
          }

          const validation = core.validatePuzzle(puzzle, inputConfig);
          if (!validation.valid) {
            throw new Error(`Puzzle validation failed: ${validation.errors.join('; ')}`);
          }

          if (puzzle.bottleCount !== def.bottleCount) {
            throw new Error(
              `Expected bottleCount=${String(def.bottleCount)}, got ${String(puzzle.bottleCount)}`,
            );
          }

          const startSet = new Set(puzzle.startingSequence);
          const targetSet = new Set(puzzle.targetSequence);
          if (startSet.size !== def.bottleCount || targetSet.size !== def.bottleCount) {
            throw new Error('Duplicate bottle identities detected');
          }
          for (const id of startSet) {
            if (!targetSet.has(id)) {
              throw new Error(`Mismatched bottle identity set: ${id}`);
            }
          }

          const diag = core.inspectPuzzleDiagnostics(puzzle);
          if (diag.initialMatchCount === puzzle.bottleCount) {
            throw new Error('Starting sequence identical to target sequence');
          }
          if (diag.minimumSwapDistance < 1) {
            throw new Error('Minimum swap distance < 1');
          }
          if (!puzzle.seed || puzzle.seed.trim().length === 0) {
            throw new Error('Invalid empty effective seed');
          }
          if (puzzle.generatorVersion !== core.PUZZLE_GENERATOR_VERSION) {
            throw new Error(`Unexpected generatorVersion: ${puzzle.generatorVersion}`);
          }

          sumInitialMatches += diag.initialMatchCount;
          sumMinSwaps += diag.minimumSwapDistance;
          tierPassed += 1;
          totalPassed += 1;
        } catch (err) {
          tierFailed += 1;
          totalFailed += 1;
          if (failures.length < 20) {
            failures.push({
              difficulty,
              seed,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      summary.push({
        difficulty,
        bottles: def.bottleCount,
        generated: perTier,
        passed: tierPassed,
        failed: tierFailed,
        totalMs: Number(tierTotalMs.toFixed(1)),
        avgMs: Number((tierTotalMs / perTier).toFixed(4)),
        slowestMs: Number(tierSlowestMs.toFixed(3)),
        avgInitialMatches: Number((sumInitialMatches / Math.max(1, tierPassed)).toFixed(2)),
        avgMinSwaps: Number((sumMinSwaps / Math.max(1, tierPassed)).toFixed(2)),
      });
    }

    console.log('=== Bottle Shuffle Puzzle Generation Stress Test ===');
    console.log(
      `Total Generated: ${String(totalGenerated)} | Passed: ${String(totalPassed)} | Failed: ${String(totalFailed)}`,
    );
    console.log(
      `Slowest Observed Generation: ${globalSlowestMs.toFixed(3)} ms (${globalSlowestInfo})`,
    );
    console.table(summary);

    if (failures.length > 0) {
      console.error('Sample failures:', failures);
      process.exitCode = 1;
    }
  } finally {
    await server.close();
  }
}

void main();
