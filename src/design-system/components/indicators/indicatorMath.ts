export interface NormalizedProgress {
  readonly value: number;
  readonly max: number;
  readonly ratio: number;
  readonly percentage: number;
}

export interface NormalizedMatchState {
  readonly matched: number;
  readonly total: number;
  readonly ratio: number;
  readonly isComplete: boolean;
  readonly formatted: string;
}

export function normalizeProgress(value: number, max: number): NormalizedProgress {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1;
  const rawValue = Number.isFinite(value) ? value : 0;
  const clampedValue = Math.min(safeMax, Math.max(0, rawValue));
  const ratio = clampedValue / safeMax;

  return {
    value: clampedValue,
    max: safeMax,
    ratio,
    percentage: Math.round(ratio * 100),
  };
}

export function normalizeMatchState(matched: number, total: number): NormalizedMatchState {
  const safeTotal = Number.isFinite(total) ? Math.max(1, Math.floor(total)) : 1;
  const safeMatched = Number.isFinite(matched)
    ? Math.min(safeTotal, Math.max(0, Math.floor(matched)))
    : 0;

  return {
    matched: safeMatched,
    total: safeTotal,
    ratio: safeMatched / safeTotal,
    isComplete: safeMatched === safeTotal,
    formatted: `${String(safeMatched)}/${String(safeTotal)}`,
  };
}

export function normalizeStarCount(rating: number, maxStars = 3): number {
  const safeMax = Number.isFinite(maxStars) ? Math.max(1, Math.floor(maxStars)) : 3;
  if (!Number.isFinite(rating)) {
    return 0;
  }
  return Math.min(safeMax, Math.max(0, Math.round(rating)));
}
