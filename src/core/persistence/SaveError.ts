export type SaveErrorCode =
  | 'STORAGE_UNAVAILABLE'
  | 'STORAGE_READ_FAILED'
  | 'STORAGE_WRITE_FAILED'
  | 'STORAGE_QUOTA_EXCEEDED'
  | 'STORAGE_TIMEOUT'
  | 'SERIALIZATION_FAILED'
  | 'INVALID_JSON'
  | 'INVALID_SAVE_DATA'
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'MIGRATION_FAILED'
  | 'EXTERNAL_CONFLICT';

export class SaveError extends Error {
  public readonly code: SaveErrorCode;
  public readonly details?: Readonly<Record<string, unknown>>;

  public constructor(
    code: SaveErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = 'SaveError';
    this.code = code;
    if (details !== undefined) {
      this.details = Object.freeze({ ...details });
    }
  }
}
