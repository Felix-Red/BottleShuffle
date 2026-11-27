import { describe, expect, it } from 'vitest';
import { CURRENT_SAVE_SCHEMA_VERSION, SAVE_GAME_ID } from '../../../src/core';
import { SaveMigrationRegistry } from '../../../src/services/persistence/SaveMigrationRegistry';

describe('SaveMigrationRegistry', () => {
  it('returns an unmodified clone when already at current schema version', () => {
    const registry = new SaveMigrationRegistry();
    const input = {
      schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      gameId: SAVE_GAME_ID,
      revision: 1,
    };

    const res = registry.migrate(input, CURRENT_SAVE_SCHEMA_VERSION, CURRENT_SAVE_SCHEMA_VERSION);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.appliedVersions).toEqual([]);
      expect(res.data).toEqual(input);
      expect(res.data).not.toBe(input);
    }
  });

  it('applies multiple synthetic sequential migrations deterministically without mutating input', () => {
    const registry = new SaveMigrationRegistry([
      {
        fromVersion: 1,
        toVersion: 2,
        description: 'Synthetic v1 -> v2 adds tutorial.status from tutorial.completed',
        migrate: (input) => {
          const tutorial = (input.tutorial as Record<string, unknown> | undefined) ?? {};
          const completed = Boolean(tutorial.completed);
          return {
            ...input,
            tutorial: {
              completed,
              status: completed ? 'completed' : 'not_seen',
            },
          };
        },
      },
      {
        fromVersion: 2,
        toVersion: 3,
        description: 'Synthetic v2 -> v3 adds migratedTag',
        migrate: (input) => ({
          ...input,
          migratedTag: 'v3-ready',
        }),
      },
    ]);

    const original = Object.freeze({
      schemaVersion: 1,
      gameId: SAVE_GAME_ID,
      tutorial: Object.freeze({ completed: true }),
    });

    const result = registry.migrate(original, 1, 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.appliedVersions).toEqual([2, 3]);
      expect(result.data.schemaVersion).toBe(3);
      expect(result.data.tutorial).toEqual({ completed: true, status: 'completed' });
      expect(result.data.migratedTag).toBe('v3-ready');
    }
    // Original input was never mutated
    expect(original.schemaVersion).toBe(1);
    expect('status' in original.tutorial).toBe(false);
  });

  it('fails safely on missing intermediate migration step, throwing step, or future version downgrade', () => {
    const registry = new SaveMigrationRegistry([
      {
        fromVersion: 1,
        toVersion: 2,
        description: 'v1 -> v2',
        migrate: (input) => ({ ...input }),
      },
    ]);

    // Missing v2 -> v3
    const missingStep = registry.migrate({ schemaVersion: 1 }, 1, 3);
    expect(missingStep.ok).toBe(false);
    if (!missingStep.ok) {
      expect(missingStep.errorCode).toBe('MIGRATION_FAILED');
      expect(missingStep.failedAtVersion).toBe(2);
    }

    // Future schema downgrade refused
    const downgrade = registry.migrate({ schemaVersion: 4 }, 4, 1);
    expect(downgrade.ok).toBe(false);
    if (!downgrade.ok) {
      expect(downgrade.errorCode).toBe('UNSUPPORTED_SCHEMA_VERSION');
    }

    // Throwing migration caught cleanly
    const throwingRegistry = new SaveMigrationRegistry([
      {
        fromVersion: 1,
        toVersion: 2,
        description: 'broken step',
        migrate: () => {
          throw new Error('Synthetic transform boom');
        },
      },
    ]);
    const failed = throwingRegistry.migrate({ schemaVersion: 1 }, 1, 2);
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.errorCode).toBe('MIGRATION_FAILED');
      expect(failed.message).toContain('Synthetic transform boom');
    }
  });
});
