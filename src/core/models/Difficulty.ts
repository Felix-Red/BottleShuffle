export const DIFFICULTY_IDS = Object.freeze([
  'beginner',
  'easy',
  'normal',
  'intermediate',
  'hard',
  'expert',
] as const);

export type DifficultyId = (typeof DIFFICULTY_IDS)[number];

const DIFFICULTY_ID_SET: ReadonlySet<string> = new Set<string>(DIFFICULTY_IDS);

export function isDifficultyId(value: string): value is DifficultyId {
  return DIFFICULTY_ID_SET.has(value);
}
