import type { BottleId } from './BottleId';

/**
 * Pure domain representation of a bottle identity.
 * Visual metadata (colours, symbols, textures) lives outside src/core/.
 */
export interface Bottle {
  readonly id: BottleId;
}

export function createBottle(id: BottleId): Bottle {
  return Object.freeze({ id });
}
