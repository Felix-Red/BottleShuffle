export const CHALLENGE_MODES = Object.freeze([
  'classic',
  'timed',
  'limited_moves',
  'combined',
] as const);

export type ChallengeMode = (typeof CHALLENGE_MODES)[number];

export const CHALLENGE_INTRO_MODES = Object.freeze(['timed', 'limited_moves', 'combined'] as const);

export type ChallengeIntroMode = (typeof CHALLENGE_INTRO_MODES)[number];

export type AttemptFailureReason = 'time_expired' | 'moves_exhausted';

export interface LevelChallengeObjective {
  readonly challengeMode: ChallengeMode;
  readonly timeLimitSeconds: number | null;
  readonly moveLimit: number | null;
}

export const DEFAULT_CLASSIC_OBJECTIVE: LevelChallengeObjective = Object.freeze({
  challengeMode: 'classic',
  timeLimitSeconds: null,
  moveLimit: null,
});

const CHALLENGE_MODE_SET: ReadonlySet<string> = new Set<string>(CHALLENGE_MODES);
const CHALLENGE_INTRO_MODE_SET: ReadonlySet<string> = new Set<string>(CHALLENGE_INTRO_MODES);

export function isChallengeMode(value: string): value is ChallengeMode {
  return CHALLENGE_MODE_SET.has(value);
}

export function isChallengeIntroMode(value: string): value is ChallengeIntroMode {
  return CHALLENGE_INTRO_MODE_SET.has(value);
}

export function getChallengeModeDisplayName(mode: ChallengeMode): string {
  switch (mode) {
    case 'classic':
      return 'Classic';
    case 'timed':
      return 'Timed';
    case 'limited_moves':
      return 'Limited Moves';
    case 'combined':
      return 'Timed + Moves';
  }
}

export function hasTimeLimit(mode: ChallengeMode): boolean {
  return mode === 'timed' || mode === 'combined';
}

export function hasMoveLimit(mode: ChallengeMode): boolean {
  return mode === 'limited_moves' || mode === 'combined';
}

export function resolveChallengeObjective(
  input?: Partial<LevelChallengeObjective>,
): LevelChallengeObjective {
  const challengeMode: ChallengeMode = input?.challengeMode ?? 'classic';
  const timeLimitSeconds = input?.timeLimitSeconds ?? null;
  const moveLimit = input?.moveLimit ?? null;
  return Object.freeze({
    challengeMode,
    timeLimitSeconds,
    moveLimit,
  });
}

export function validateChallengeObjective(
  objective: LevelChallengeObjective,
  minRequiredSwaps = 1,
): readonly string[] {
  const errors: string[] = [];

  if (!isChallengeMode(objective.challengeMode)) {
    errors.push(`Invalid challengeMode "${String(objective.challengeMode)}".`);
    return Object.freeze(errors);
  }

  const expectsTime = hasTimeLimit(objective.challengeMode);
  const expectsMoves = hasMoveLimit(objective.challengeMode);

  if (expectsTime) {
    if (
      objective.timeLimitSeconds === null ||
      !Number.isInteger(objective.timeLimitSeconds) ||
      objective.timeLimitSeconds <= 0
    ) {
      errors.push(
        `Challenge mode "${objective.challengeMode}" requires a positive integer timeLimitSeconds (received ${String(objective.timeLimitSeconds)}).`,
      );
    }
  } else if (objective.timeLimitSeconds !== null) {
    errors.push(
      `Challenge mode "${objective.challengeMode}" must not specify a timeLimitSeconds (received ${String(objective.timeLimitSeconds)}).`,
    );
  }

  if (expectsMoves) {
    if (
      objective.moveLimit === null ||
      !Number.isInteger(objective.moveLimit) ||
      objective.moveLimit <= 0
    ) {
      errors.push(
        `Challenge mode "${objective.challengeMode}" requires a positive integer moveLimit (received ${String(objective.moveLimit)}).`,
      );
    } else if (objective.moveLimit < Math.max(1, minRequiredSwaps)) {
      errors.push(
        `moveLimit (${String(objective.moveLimit)}) cannot be smaller than minRequiredSwaps (${String(minRequiredSwaps)}).`,
      );
    }
  } else if (objective.moveLimit !== null) {
    errors.push(
      `Challenge mode "${objective.challengeMode}" must not specify a moveLimit (received ${String(objective.moveLimit)}).`,
    );
  }

  return Object.freeze(errors);
}
