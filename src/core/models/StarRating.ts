export const MAX_STARS_PER_LEVEL = 3;

/** Star rating awarded to a legitimately completed puzzle attempt (always 1..3). */
export type EarnedStarRating = 1 | 2 | 3;

/** Star rating used in progression summaries where 0 represents an uncompleted level. */
export type LevelStarRating = 0 | EarnedStarRating;

export function isEarnedStarRating(value: unknown): value is EarnedStarRating {
  return value === 1 || value === 2 || value === 3;
}
