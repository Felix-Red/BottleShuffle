import { PuzzleError } from '../errors/PuzzleError';
import type { PuzzleSeedInput } from '../models/PuzzleConfig';
import type { RandomSource } from './RandomSource';

const FNV_OFFSET_BASIS_A = 0x811c9dc5;
const FNV_OFFSET_BASIS_B = 0x9e3779b9;
const FNV_PRIME = 0x01000193;
const UINT32_MODULO = 0x100000000;

/**
 * Normalises a caller-supplied seed into a canonical non-empty string.
 *
 * Policy:
 * - Finite numbers are truncated toward zero (with -0 normalised to "0").
 * - Non-finite numbers (NaN, Infinity, -Infinity) are rejected with INVALID_SEED.
 * - Strings are trimmed; empty or whitespace-only strings are rejected with INVALID_SEED.
 */
export function normalizeSeed(seed: PuzzleSeedInput): string {
  if (typeof seed === 'number') {
    if (!Number.isFinite(seed)) {
      throw new PuzzleError(
        'INVALID_SEED',
        `Seed must be a finite number or non-empty string; received ${String(seed)}.`,
        { seed },
      );
    }
    const truncated = Math.trunc(seed);
    return String(Object.is(truncated, -0) ? 0 : truncated);
  }

  if (typeof seed === 'string') {
    const trimmed = seed.trim();
    if (trimmed.length === 0) {
      throw new PuzzleError('INVALID_SEED', 'Seed string must not be empty or whitespace-only.', {
        seed,
      });
    }
    return trimmed;
  }

  throw new PuzzleError(
    'INVALID_SEED',
    `Unsupported seed type "${typeof seed}". Expected a non-empty string or finite number.`,
  );
}

/**
 * Computes a deterministic 32-bit unsigned FNV-1a hash from a string.
 */
export function hashStringToUint32(input: string, offsetBasis = FNV_OFFSET_BASIS_A): number {
  let hash = offsetBasis >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Computes a deterministic 16-character lowercase hex digest (two independent
 * 32-bit FNV-1a lanes) suitable for stable puzzle identifiers.
 */
export function hashStringToHex(input: string): string {
  const high = hashStringToUint32(input, FNV_OFFSET_BASIS_A);
  const low = hashStringToUint32(`${input}|v1`, FNV_OFFSET_BASIS_B);
  return `${high.toString(16).padStart(8, '0')}${low.toString(16).padStart(8, '0')}`;
}

/**
 * Lightweight, deterministic Mulberry32 pseudorandom number generator.
 * Suitable for reproducible game puzzle generation (not cryptographic use).
 */
export class SeededRandom implements RandomSource {
  public readonly seed: string;
  public readonly numericSeed: number;
  private state: number;

  public constructor(seed: PuzzleSeedInput) {
    this.seed = normalizeSeed(seed);
    this.numericSeed = hashStringToUint32(this.seed);
    this.state = this.numericSeed;
  }

  public next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const output = (t ^ (t >>> 14)) >>> 0;
    return output / UINT32_MODULO;
  }
}

export function createSeededRandom(seed: PuzzleSeedInput): SeededRandom {
  return new SeededRandom(seed);
}
