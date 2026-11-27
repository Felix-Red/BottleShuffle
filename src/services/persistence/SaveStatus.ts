import type { SaveErrorCode } from '../../core';

export type SaveLifecycleStatus =
  | 'initialising'
  | 'ready'
  | 'dirty'
  | 'saving'
  | 'saved'
  | 'unavailable'
  | 'failed'
  | 'recovery_required'
  | 'unsupported_version'
  | 'conflict';

export type SavePriority = 'high' | 'normal';

export type SaveReason =
  | 'campaign_completion'
  | 'record_improved'
  | 'tutorial_completion'
  | 'settings_changed'
  | 'last_played_changed'
  | 'repaired_save'
  | 'manual'
  | 'lifecycle_flush'
  | 'retry';

export interface SaveStatusSnapshot {
  readonly status: SaveLifecycleStatus;
  readonly schemaVersion: number;
  readonly currentRevision: number;
  readonly lastSavedRevision: number;
  readonly hasUnsavedChanges: boolean;
  readonly lastSavedAt: string | null;
  readonly lastSerializedBytes: number;
  readonly autoWriteBlocked: boolean;
  readonly isDurable: boolean;
  readonly storageName: string;
  readonly lastErrorCode: SaveErrorCode | null;
  readonly lastErrorMessage: string | null;
  readonly repairs: readonly string[];
  readonly detectedExternalRevision: number | null;
}
