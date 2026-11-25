import { describe, expect, it } from 'vitest';
import {
  Colors,
  darkenHex,
  hexToNumber,
  hexToRgb,
  hexToRgba,
  lightenHex,
  normalizeHex,
} from '../../src/design-system/tokens/Colors';

describe('Colors tokens and conversion utilities', () => {
  it('normalizes 3-digit and 6-digit hex strings and rejects invalid values', () => {
    expect(normalizeHex('#8b5cf6')).toBe('#8B5CF6');
    expect(normalizeHex('171126')).toBe('#171126');
    expect(normalizeHex('#abc')).toBe('#AABBCC');
    expect(() => normalizeHex('not-a-color')).toThrow(RangeError);
    expect(() => normalizeHex('#12345')).toThrow(RangeError);
  });

  it('converts hex colours to numeric values, RGB channels, and clamped RGBA strings', () => {
    expect(hexToNumber(Colors.Brand.Primary)).toBe(0x8b5cf6);
    expect(hexToNumber('#000')).toBe(0x000000);
    expect(hexToRgb(Colors.Surface.Background)).toEqual({ r: 23, g: 17, b: 38 });
    expect(hexToRgba('#000000', 0.7)).toBe('rgba(0, 0, 0, 0.7)');
    expect(hexToRgba('#FFFFFF', 2)).toBe('rgba(255, 255, 255, 1)');
    expect(hexToRgba('#FFFFFF', -0.5)).toBe('rgba(255, 255, 255, 0)');
  });

  it('lightens and darkens hex colours predictably', () => {
    expect(lightenHex('#000000', 0.5)).toBe('#808080');
    expect(darkenHex('#FFFFFF', 0.5)).toBe('#808080');
    expect(lightenHex('#8B5CF6', 0)).toBe('#8B5CF6');
    expect(darkenHex('#8B5CF6', 1)).toBe('#000000');
  });

  it('defines ten distinct bottle colours with unique accessibility symbols and patterns', () => {
    expect(Colors.BottleTokens).toHaveLength(10);

    const uniqueHex = new Set(Colors.BottleTokens.map((t) => t.hex));
    const uniqueSymbols = new Set(Colors.BottleTokens.map((t) => t.symbol));
    const uniquePatterns = new Set(Colors.BottleTokens.map((t) => t.pattern));

    expect(uniqueHex.size).toBe(10);
    expect(uniqueSymbols.size).toBe(10);
    expect(uniquePatterns.size).toBe(10);
  });
});
