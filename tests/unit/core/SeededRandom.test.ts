import { describe, expect, it } from 'vitest';
import { PuzzleError } from '../../../src/core/errors/PuzzleError';
import { createSeededRandom, normalizeSeed } from '../../../src/core/random/SeededRandom';

describe('SeededRandom', () => {
  it('produces identical sequences for identical seeds', () => {
    const rngA = createSeededRandom('bottle-shuffle-42');
    const rngB = createSeededRandom('bottle-shuffle-42');

    const seqA = Array.from({ length: 100 }, () => rngA.next());
    const seqB = Array.from({ length: 100 }, () => rngB.next());

    expect(seqA).toEqual(seqB);
  });

  it('produces distinct sequences for different seeds', () => {
    const rngA = createSeededRandom('seed-alpha');
    const rngB = createSeededRandom('seed-beta');
    const rngC = createSeededRandom(12345);

    const seqA = Array.from({ length: 20 }, () => rngA.next());
    const seqB = Array.from({ length: 20 }, () => rngB.next());
    const seqC = Array.from({ length: 20 }, () => rngC.next());

    expect(seqA).not.toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    expect(seqB).not.toEqual(seqC);
  });

  it('keeps generated values strictly within [0, 1)', () => {
    const rng = createSeededRandom('range-verification-seed');
    for (let i = 0; i < 5000; i += 1) {
      const value = rng.next();
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('normalises valid seeds and rejects invalid seeds according to documented policy', () => {
    expect(normalizeSeed('  hello-seed  ')).toBe('hello-seed');
    expect(normalizeSeed(42.9)).toBe('42');
    expect(normalizeSeed(-7.8)).toBe('-7');
    expect(normalizeSeed(-0)).toBe('0');

    expect(createSeededRandom('  42 ').seed).toBe(createSeededRandom(42).seed);

    for (const badSeed of [
      '',
      '   ',
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      expect(() => normalizeSeed(badSeed)).toThrow(PuzzleError);
      try {
        normalizeSeed(badSeed);
      } catch (err) {
        expect(err).toBeInstanceOf(PuzzleError);
        expect((err as PuzzleError).code).toBe('INVALID_SEED');
      }
    }
  });
});
