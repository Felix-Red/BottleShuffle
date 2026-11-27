import {
  CURRENT_CAMPAIGN_CATALOG_VERSION,
  CURRENT_SAVE_SCHEMA_VERSION,
  type SaveErrorCode,
} from '../../core';

export interface SaveMigrationStep {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly description: string;
  migrate(input: Readonly<Record<string, unknown>>): Record<string, unknown>;
}

export type SaveMigrationResult =
  | {
      readonly ok: true;
      readonly data: Record<string, unknown>;
      readonly appliedVersions: readonly number[];
    }
  | {
      readonly ok: false;
      readonly errorCode: Extract<SaveErrorCode, 'MIGRATION_FAILED' | 'UNSUPPORTED_SCHEMA_VERSION'>;
      readonly message: string;
      readonly failedAtVersion: number;
    };

function cloneJsonRecord(input: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
}

/**
 * Deterministic sequential schema migration registry.
 * Production currently uses schema version 1 (no historical production schemas exist yet);
 * supports registering step-by-step v -> v + 1 transforms for future versions and synthetic tests.
 */
export class SaveMigrationRegistry {
  private readonly stepsByFromVersion = new Map<number, SaveMigrationStep>();

  public constructor(steps: readonly SaveMigrationStep[] = []) {
    for (const step of steps) {
      this.register(step);
    }
  }

  public register(step: SaveMigrationStep): void {
    if (!Number.isInteger(step.fromVersion) || step.fromVersion < 1) {
      throw new Error(`Invalid migration fromVersion: ${String(step.fromVersion)}`);
    }
    if (step.toVersion !== step.fromVersion + 1) {
      throw new Error(
        `Migrations must advance sequentially by 1 (received ${String(step.fromVersion)} -> ${String(step.toVersion)}).`,
      );
    }
    if (this.stepsByFromVersion.has(step.fromVersion)) {
      throw new Error(`Duplicate migration registered for version ${String(step.fromVersion)}.`);
    }
    this.stepsByFromVersion.set(step.fromVersion, step);
  }

  public hasStepFrom(version: number): boolean {
    return this.stepsByFromVersion.has(version);
  }

  public migrate(
    rawData: Readonly<Record<string, unknown>>,
    fromVersion: number,
    targetVersion: number = CURRENT_SAVE_SCHEMA_VERSION,
  ): SaveMigrationResult {
    if (!Number.isInteger(fromVersion) || fromVersion < 1) {
      return Object.freeze({
        ok: false,
        errorCode: 'UNSUPPORTED_SCHEMA_VERSION',
        message: `Invalid source schema version: ${String(fromVersion)}.`,
        failedAtVersion: fromVersion,
      });
    }

    if (fromVersion > targetVersion) {
      return Object.freeze({
        ok: false,
        errorCode: 'UNSUPPORTED_SCHEMA_VERSION',
        message: `Cannot downgrade future schema version ${String(fromVersion)} to ${String(targetVersion)}.`,
        failedAtVersion: fromVersion,
      });
    }

    let working = cloneJsonRecord(rawData);
    const appliedVersions: number[] = [];

    if (fromVersion === targetVersion) {
      return Object.freeze({
        ok: true,
        data: working,
        appliedVersions: Object.freeze(appliedVersions),
      });
    }

    let current = fromVersion;
    while (current < targetVersion) {
      const step = this.stepsByFromVersion.get(current);
      if (step === undefined) {
        return Object.freeze({
          ok: false,
          errorCode: 'MIGRATION_FAILED',
          message: `No save migration registered from schema version ${String(current)} to ${String(current + 1)}.`,
          failedAtVersion: current,
        });
      }

      try {
        // Clone before invoking the step so a migration can never mutate the caller's object.
        const stepInput = cloneJsonRecord(working);
        const migrated: unknown = step.migrate(stepInput);
        if (typeof migrated !== 'object' || migrated === null || Array.isArray(migrated)) {
          return Object.freeze({
            ok: false,
            errorCode: 'MIGRATION_FAILED',
            message: `Migration from v${String(current)} returned a non-object result.`,
            failedAtVersion: current,
          });
        }
        working = cloneJsonRecord({
          ...(migrated as Record<string, unknown>),
          schemaVersion: step.toVersion,
        });
        appliedVersions.push(step.toVersion);
        current = step.toVersion;
      } catch (error) {
        return Object.freeze({
          ok: false,
          errorCode: 'MIGRATION_FAILED',
          message:
            error instanceof Error
              ? error.message
              : `Migration from v${String(current)} threw an error.`,
          failedAtVersion: current,
        });
      }
    }

    return Object.freeze({
      ok: true,
      data: working,
      appliedVersions: Object.freeze(appliedVersions),
    });
  }
}

/**
 * Pre-release development migration (v1 -> v2):
 * Because Bottle Shuffle has not yet been publicly released and Catalogue v2.0.0 redesigns
 * all 50 level definitions (varying bottle counts & challenge modes), v1 development saves
 * preserve player settings and tutorial completion while explicitly resetting incompatible
 * campaign progression rather than associating old records with materially different puzzles.
 */
export const MIGRATE_V1_TO_V2_CAMPAIGN_REDESIGN: SaveMigrationStep = Object.freeze({
  fromVersion: 1,
  toVersion: 2,
  description:
    'Migrate pre-release v1 save to v2 redesigned campaign catalogue (preserve settings & tutorial, reset incompatible progression).',
  migrate(input: Readonly<Record<string, unknown>>): Record<string, unknown> {
    return {
      ...input,
      schemaVersion: 2,
      campaignCatalogVersion: CURRENT_CAMPAIGN_CATALOG_VERSION,
      progression: {
        completedLevels: {},
        lastPlayedLevelId: null,
      },
      seenChallengeIntros: [],
    };
  },
});

export function createDefaultMigrationRegistry(): SaveMigrationRegistry {
  return new SaveMigrationRegistry([MIGRATE_V1_TO_V2_CAMPAIGN_REDESIGN]);
}
