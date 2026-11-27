export type ActionRejectionReason =
  | 'INVALID_SLOT_INDEX'
  | 'IDENTICAL_SWAP_INDICES'
  | 'PUZZLE_NOT_STARTED'
  | 'PUZZLE_PAUSED'
  | 'PUZZLE_ALREADY_COMPLETED'
  | 'INVALID_STATE_TRANSITION';

export type GameErrorCode =
  | 'INVALID_PUZZLE'
  | 'INVALID_SWAP_INDEX'
  | 'INVALID_SEQUENCE'
  | 'INVALID_SCORING_INPUT'
  | 'INVALID_SETTINGS_INPUT';

export class GameError extends Error {
  public readonly code: GameErrorCode;
  public readonly details?: Readonly<Record<string, unknown>>;

  public constructor(
    code: GameErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = 'GameError';
    this.code = code;
    if (details !== undefined) {
      this.details = Object.freeze({ ...details });
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
