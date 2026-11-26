import { randomBytes } from 'node:crypto';
import { createServer } from 'vite';

function parseArg(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) {
    return undefined;
  }
  return args[index + 1];
}

function parseOptionalNumber(raw) {
  if (raw === undefined) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? undefined : parsed;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(
      [
        'Bottle Shuffle — Development Puzzle Diagnostics',
        '',
        'Usage:',
        '  npm run puzzle:inspect -- [options]',
        '',
        'Options:',
        '  --difficulty <beginner|easy|normal|intermediate|hard|expert>',
        '  --count <3..10>           Override bottle count',
        '  --seed <string|number>    Deterministic puzzle seed (auto-generated if omitted)',
        '  --min-matches <number>    Override minimum initial correct matches',
        '  --max-matches <number>    Override maximum initial correct matches',
        '  --min-swaps <number>      Override minimum required swap distance',
      ].join('\n'),
    );
    return;
  }

  const server = await createServer({
    logLevel: 'silent',
    server: { middlewareMode: true },
    appType: 'custom',
  });

  try {
    const core = await server.ssrLoadModule('/src/core/index.ts');

    const countArg = parseOptionalNumber(parseArg(args, '--count'));
    const rawDifficulty = parseArg(args, '--difficulty');
    let difficulty = 'normal';

    if (rawDifficulty !== undefined) {
      difficulty = rawDifficulty;
    } else if (countArg !== undefined) {
      const matched = core.ALL_DIFFICULTY_DEFINITIONS.find((def) => def.bottleCount === countArg);
      difficulty = matched ? matched.id : 'normal';
    }

    const seedArg = parseArg(args, '--seed');
    const minMatches = parseOptionalNumber(parseArg(args, '--min-matches'));
    const maxMatches = parseOptionalNumber(parseArg(args, '--max-matches'));
    const minSwaps = parseOptionalNumber(parseArg(args, '--min-swaps'));

    const config = {
      difficulty,
      ...(countArg !== undefined ? { bottleCount: countArg } : {}),
      ...(seedArg !== undefined ? { seed: seedArg } : {}),
      ...(minMatches !== undefined ? { minInitialMatches: minMatches } : {}),
      ...(maxMatches !== undefined ? { maxInitialMatches: maxMatches } : {}),
      ...(minSwaps !== undefined ? { minRequiredSwaps: minSwaps } : {}),
    };

    const puzzle = core.generatePuzzle(config, {
      seedProvider: () => `dev-${randomBytes(4).toString('hex')}`,
    });

    const regenerated = core.generatePuzzle({
      ...config,
      seed: puzzle.seed,
    });

    const diagnostics = core.inspectPuzzleDiagnostics(puzzle);
    const deterministicMatch =
      puzzle.id === regenerated.id &&
      puzzle.startingSequence.join(',') === regenerated.startingSequence.join(',') &&
      puzzle.targetSequence.join(',') === regenerated.targetSequence.join(',');

    console.log('=== Bottle Shuffle Puzzle Diagnostics (DEV ONLY) ===');
    console.log(`Puzzle ID:             ${diagnostics.id}`);
    console.log(`Generator Version:     ${diagnostics.generatorVersion}`);
    console.log(`Difficulty:            ${diagnostics.difficulty}`);
    console.log(`Bottle Count:          ${String(diagnostics.bottleCount)}`);
    console.log(`Effective Seed:        ${diagnostics.seed}`);
    console.log(`Starting Sequence:     [${diagnostics.startingSequence.join(', ')}]`);
    console.log(`Target Sequence:       [${diagnostics.targetSequence.join(', ')}]`);
    console.log(
      `Initial Match Count:   ${String(diagnostics.initialMatchCount)}/${String(diagnostics.bottleCount)}`,
    );
    console.log(`Minimum Swap Distance: ${String(diagnostics.minimumSwapDistance)}`);
    console.log(
      `Deterministic Replay:  ${deterministicMatch ? 'VERIFIED (identical)' : 'MISMATCH'}`,
    );
  } finally {
    await server.close();
  }
}

void main();
