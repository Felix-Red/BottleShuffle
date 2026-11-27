export const PUZZLE_STATUSES = Object.freeze([
  'ready',
  'playing',
  'paused',
  'completed',
  'failed',
] as const);

export type PuzzleStatus = (typeof PUZZLE_STATUSES)[number];
