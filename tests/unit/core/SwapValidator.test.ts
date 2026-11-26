import { describe, expect, it } from 'vitest';
import {
  validateSelectionRequest,
  validateSlotIndex,
  validateSwapRequest,
} from '../../../src/core/engine/SwapValidator';

describe('SwapValidator', () => {
  it('validates playing status and rejects ready, paused, and completed statuses with specific reasons', () => {
    expect(validateSelectionRequest('playing', 0, 5)).toEqual({ valid: true });
    expect(validateSwapRequest('playing', 0, 4, 5)).toEqual({ valid: true });

    const readyCheck = validateSwapRequest('ready', 0, 1, 5);
    expect(readyCheck.valid).toBe(false);
    if (!readyCheck.valid) {
      expect(readyCheck.reason).toBe('PUZZLE_NOT_STARTED');
    }

    const pausedCheck = validateSwapRequest('paused', 0, 1, 5);
    expect(pausedCheck.valid).toBe(false);
    if (!pausedCheck.valid) {
      expect(pausedCheck.reason).toBe('PUZZLE_PAUSED');
    }

    const completedCheck = validateSwapRequest('completed', 0, 1, 5);
    expect(completedCheck.valid).toBe(false);
    if (!completedCheck.valid) {
      expect(completedCheck.reason).toBe('PUZZLE_ALREADY_COMPLETED');
    }
  });

  it('rejects out-of-range, negative, fractional, non-finite, and identical indices', () => {
    for (const badIndex of [-1, 5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const check = validateSlotIndex(badIndex, 5);
      expect(check.valid).toBe(false);
      if (!check.valid) {
        expect(check.reason).toBe('INVALID_SLOT_INDEX');
      }
    }

    const sameIndex = validateSwapRequest('playing', 2, 2, 5);
    expect(sameIndex.valid).toBe(false);
    if (!sameIndex.valid) {
      expect(sameIndex.reason).toBe('IDENTICAL_SWAP_INDICES');
    }
  });
});
