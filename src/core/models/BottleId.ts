export const CANONICAL_BOTTLE_IDS = Object.freeze([
  'red',
  'blue',
  'green',
  'yellow',
  'purple',
  'orange',
  'pink',
  'teal',
  'brown',
  'silver',
] as const);

export type BottleId = (typeof CANONICAL_BOTTLE_IDS)[number];

export const MIN_BOTTLE_COUNT = 3;
export const MAX_BOTTLE_COUNT = CANONICAL_BOTTLE_IDS.length;

const BOTTLE_ID_SET: ReadonlySet<string> = new Set<string>(CANONICAL_BOTTLE_IDS);

export function isBottleId(value: string): value is BottleId {
  return BOTTLE_ID_SET.has(value);
}
