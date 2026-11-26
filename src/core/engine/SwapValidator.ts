import type { ActionRejectionReason } from '../errors/GameError';
import type { PuzzleStatus } from '../models/PuzzleStatus';

export type ValidationOutcome =
  | { readonly valid: true }
  | {
      readonly valid: false;
      readonly reason: ActionRejectionReason;
      readonly message: string;
    };

export function validatePlayingStatus(status: PuzzleStatus): ValidationOutcome {
  switch (status) {
    case 'playing':
      return { valid: true };
    case 'ready':
      return {
        valid: false,
        reason: 'PUZZLE_NOT_STARTED',
        message: 'Action requires the puzzle to be started before interacting with bottles.',
      };
    case 'paused':
      return {
        valid: false,
        reason: 'PUZZLE_PAUSED',
        message: 'Action cannot be performed while the puzzle is paused.',
      };
    case 'completed':
      return {
        valid: false,
        reason: 'PUZZLE_ALREADY_COMPLETED',
        message: 'Action cannot be performed after the puzzle has already been completed.',
      };
  }
}

export function validateSlotIndex(slotIndex: number, sequenceLength: number): ValidationOutcome {
  if (!Number.isFinite(slotIndex) || !Number.isInteger(slotIndex)) {
    return {
      valid: false,
      reason: 'INVALID_SLOT_INDEX',
      message: `Slot index must be a finite integer; received ${String(slotIndex)}.`,
    };
  }

  if (slotIndex < 0 || slotIndex >= sequenceLength) {
    return {
      valid: false,
      reason: 'INVALID_SLOT_INDEX',
      message: `Slot index ${String(slotIndex)} is outside valid bounds [0, ${String(sequenceLength - 1)}].`,
    };
  }

  return { valid: true };
}

export function validateSelectionRequest(
  status: PuzzleStatus,
  slotIndex: number,
  sequenceLength: number,
): ValidationOutcome {
  const statusCheck = validatePlayingStatus(status);
  if (!statusCheck.valid) {
    return statusCheck;
  }

  return validateSlotIndex(slotIndex, sequenceLength);
}

export function validateSwapRequest(
  status: PuzzleStatus,
  firstIndex: number,
  secondIndex: number,
  sequenceLength: number,
): ValidationOutcome {
  const statusCheck = validatePlayingStatus(status);
  if (!statusCheck.valid) {
    return statusCheck;
  }

  const firstCheck = validateSlotIndex(firstIndex, sequenceLength);
  if (!firstCheck.valid) {
    return firstCheck;
  }

  const secondCheck = validateSlotIndex(secondIndex, sequenceLength);
  if (!secondCheck.valid) {
    return secondCheck;
  }

  if (firstIndex === secondIndex) {
    return {
      valid: false,
      reason: 'IDENTICAL_SWAP_INDICES',
      message: `Cannot swap slot ${String(firstIndex)} with itself.`,
    };
  }

  return { valid: true };
}
