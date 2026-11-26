export type PuzzleErrorCode =
  | 'INVALID_CONFIG'
  | 'INVALID_BOTTLE_COUNT'
  | 'INVALID_DIFFICULTY'
  | 'INVALID_SEED'
  | 'MISSING_SEED'
  | 'INVALID_MATCH_CONSTRAINTS'
  | 'INVALID_SWAP_CONSTRAINTS'
  | 'INVALID_SEQUENCE'
  | 'DUPLICATE_BOTTLE'
  | 'UNSUPPORTED_BOTTLE'
  | 'MISMATCHED_SEQUENCES'
  | 'SOLVED_STARTING_SEQUENCE'
  | 'GENERATION_EXHAUSTED';

export class PuzzleError extends Error {
  public readonly code: PuzzleErrorCode;
  public readonly details?: Readonly<Record<string, unknown>>;

  public constructor(
    code: PuzzleErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = 'PuzzleError';
    this.code = code;
    if (details !== undefined) {
      this.details = Object.freeze({ ...details });
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
