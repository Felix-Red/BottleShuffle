import type { SaveData } from './SaveData';

export type SaveValidationDisposition =
  'valid' | 'repaired' | 'corrupted' | 'unsupported_future_version' | 'unsupported_legacy_version';

export interface SaveValidationResult {
  readonly valid: boolean;
  readonly disposition: SaveValidationDisposition;
  readonly data: SaveData | null;
  readonly errors: readonly string[];
  readonly repairs: readonly string[];
  readonly detectedSchemaVersion: number | null;
}
