export type ProgressionErrorCode =
  | 'INVALID_CATALOG'
  | 'INVALID_LEVEL_DEFINITION'
  | 'INVALID_CHAPTER_DEFINITION'
  | 'UNKNOWN_LEVEL'
  | 'LEVEL_LOCKED'
  | 'INVALID_PROGRESSION_STATE'
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'INVALID_COMPLETION_DATA'
  | 'STALE_ATTEMPT'
  | 'LEVEL_MISMATCH'
  | 'UNSUPPORTED_GENERATOR_VERSION';

export class ProgressionError extends Error {
  public readonly code: ProgressionErrorCode;
  public readonly details?: Readonly<Record<string, unknown>>;

  public constructor(
    code: ProgressionErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = 'ProgressionError';
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}
