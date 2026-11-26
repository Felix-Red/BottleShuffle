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

function formatEvents(events) {
  return events
    .map((evt) => {
      switch (evt.type) {
        case 'BOTTLES_SWAPPED':
          return `BOTTLES_SWAPPED(${String(evt.swap.firstIndex)}<->${String(evt.swap.secondIndex)}, matches=${String(evt.swap.currentMatchCount)}, delta=${evt.swap.matchDelta >= 0 ? '+' : ''}${String(evt.swap.matchDelta)}, moves=${String(evt.swap.moveCount)})`;
        case 'BOTTLE_SELECTED':
          return `BOTTLE_SELECTED(slot=${String(evt.slotIndex)})`;
        case 'SELECTION_CLEARED':
          return `SELECTION_CLEARED(prev=${String(evt.previousSlotIndex)})`;
        case 'ACTION_REJECTED':
          return `ACTION_REJECTED(${evt.actionType}: ${evt.reason})`;
        case 'PUZZLE_COMPLETED':
          return `PUZZLE_COMPLETED(totalMoves=${String(evt.totalMoves)})`;
        default:
          return evt.type;
      }
    })
    .join(' -> ');
}

function logTransition(stepLabel, result) {
  const pub = result.publicState;
  console.log(
    `[${stepLabel}] accepted=${String(result.accepted)} status=${pub.status} matches=${String(pub.currentMatchCount)}/${String(pub.totalBottleCount)} best=${String(pub.bestMatchCount)} moves=${String(pub.moveCount)} sel=${String(pub.selectedSlotIndex)} | events: ${formatEvents(result.events) || '(none)'}`,
  );
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(
      [
        'Bottle Shuffle — Development Gameplay Engine Diagnostics',
        '',
        'Usage:',
        '  npm run gameplay:simulate -- [options]',
        '',
        'Options:',
        '  --difficulty <beginner|easy|normal|intermediate|hard|expert>',
        '  --count <3..10>       Override bottle count',
        '  --seed <string>       Deterministic puzzle seed',
        '  --reveal-target       Dev-only: print hidden target sequence',
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
    const revealTarget = args.includes('--reveal-target');

    const puzzle = core.generatePuzzle(
      {
        difficulty,
        ...(countArg !== undefined ? { bottleCount: countArg } : {}),
        ...(seedArg !== undefined ? { seed: seedArg } : {}),
      },
      { seedProvider: () => `sim-${randomBytes(4).toString('hex')}` },
    );

    const engine = new core.GameEngine(puzzle);
    const initial = engine.getPublicState();

    console.log('=== Bottle Shuffle Gameplay Diagnostics (DEV ONLY) ===');
    console.log(`Puzzle ID:   ${initial.puzzleId}`);
    console.log(`Difficulty:  ${puzzle.difficulty} (${String(puzzle.bottleCount)} bottles)`);
    console.log(`Seed:        ${puzzle.seed}`);
    console.log(`Start:       [${initial.currentSequence.join(', ')}]`);
    if (revealTarget) {
      console.log(`Target(DEV): [${puzzle.targetSequence.join(', ')}]`);
    }
    console.log('');

    // Exercise lifecycle: start, select, deselect, pause, resume, restart, then solve
    logTransition('start', engine.start());
    logTransition('select(0)', engine.selectBottle(0));
    logTransition('select(0) deselect', engine.selectBottle(0));
    logTransition('select(0)', engine.selectBottle(0));
    logTransition('select(1) swap', engine.selectBottle(1));
    logTransition('pause', engine.pause());
    logTransition('swap while paused', engine.swapBottles(0, 1));
    logTransition('resume', engine.resume());
    logTransition('restart', engine.restart());

    // Solve deterministically using dev-only target access
    let step = 1;
    while (engine.getPublicState().status !== 'completed') {
      const current = engine.getPublicState().currentSequence;
      const firstMismatch = current.findIndex((id, idx) => id !== puzzle.targetSequence[idx]);
      if (firstMismatch === -1) {
        break;
      }
      const neededId = puzzle.targetSequence[firstMismatch];
      const currentIndexOfNeeded = current.indexOf(neededId);
      const res = engine.swapBottles(firstMismatch, currentIndexOfNeeded);
      logTransition(`solve swap #${String(step)}`, res);
      step += 1;
    }

    logTransition('post-complete swap', engine.swapBottles(0, 1));
    console.log(`Final Sequence: [${engine.getPublicState().currentSequence.join(', ')}]`);
  } finally {
    await server.close();
  }
}

void main();
