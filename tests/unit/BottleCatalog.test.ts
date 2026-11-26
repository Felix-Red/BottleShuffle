import { describe, expect, it } from 'vitest';
import type { BottleColorId } from '../../src/design-system/tokens/Colors';
import {
  BOTTLE_CATALOG,
  BOTTLE_IDS,
  getAllBottleMetadata,
  getBottleMetadata,
  isValidBottleId,
} from '../../src/game/assets/BottleCatalog';

describe('BottleCatalog', () => {
  it('defines ten unique bottles with stable identifiers, texture keys, colours, and accessibility symbols', () => {
    const entries = getAllBottleMetadata();
    expect(entries).toHaveLength(10);
    expect(BOTTLE_IDS).toHaveLength(10);

    const ids = new Set(entries.map((e) => e.id));
    const names = new Set(entries.map((e) => e.displayName));
    const textureKeys = new Set(entries.map((e) => e.textureKey));
    const hexes = new Set(entries.map((e) => e.colorHex));
    const symbols = new Set(entries.map((e) => e.symbol));
    const labels = new Set(entries.map((e) => e.accessibleLabel));

    expect(ids.size).toBe(10);
    expect(names.size).toBe(10);
    expect(textureKeys.size).toBe(10);
    expect(hexes.size).toBe(10);
    expect(symbols.size).toBe(10);
    expect(labels.size).toBe(10);
  });

  it('matches the canonical bottle symbol mapping for accessibility', () => {
    const expected: Record<BottleColorId, string> = {
      red: 'circle',
      blue: 'diamond',
      green: 'triangle',
      yellow: 'star',
      purple: 'sparkle',
      orange: 'square',
      pink: 'heart',
      teal: 'cross',
      brown: 'stripes',
      silver: 'ring',
    };

    for (const [id, symbol] of Object.entries(expected)) {
      const entry = getBottleMetadata(id as BottleColorId);
      expect(entry.symbol).toBe(symbol);
      expect(entry.accessibleLabel).toContain(entry.displayName);
      expect(entry.accessibleLabel).toContain(entry.symbolLabel);
    }
  });

  it('validates bottle IDs and rejects unknown identifiers safely', () => {
    expect(isValidBottleId('purple')).toBe(true);
    expect(isValidBottleId('silver')).toBe(true);
    expect(isValidBottleId('magenta')).toBe(false);
    expect(isValidBottleId('')).toBe(false);

    expect(() => getBottleMetadata('unknown' as BottleColorId)).toThrow(RangeError);
    expect(BOTTLE_CATALOG.every((entry) => entry.textureKey === `bottle:${entry.id}`)).toBe(true);
  });
});
