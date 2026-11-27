import { hasUnsafeObjectKeys, SaveError, type SaveData } from '../../core';

export type SaveParseResult =
  | { readonly ok: true; readonly value: Record<string, unknown> }
  | { readonly ok: false; readonly error: SaveError };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Serialises a validated SaveData snapshot to compact JSON.
 * Client-side JSON is for portability and reliability, not tamper-proof encryption.
 */
export function serializeSaveData(data: SaveData): string {
  try {
    return JSON.stringify({
      schemaVersion: data.schemaVersion,
      gameId: data.gameId,
      campaignCatalogVersion: data.campaignCatalogVersion,
      revision: data.revision,
      updatedAt: data.updatedAt,
      progression: {
        completedLevels: data.progression.completedLevels,
        lastPlayedLevelId: data.progression.lastPlayedLevelId,
      },
      settings: {
        musicEnabled: data.settings.musicEnabled,
        soundEffectsEnabled: data.settings.soundEffectsEnabled,
        vibrationEnabled: data.settings.vibrationEnabled,
        motionPreference: data.settings.motionPreference,
      },
      tutorial: {
        status: data.tutorial.status,
        completed: data.tutorial.completed,
      },
      seenChallengeIntros: data.seenChallengeIntros,
    });
  } catch (error) {
    throw new SaveError('SERIALIZATION_FAILED', 'Unable to serialize save data.', {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Parses untrusted serialized JSON safely without unsafe type assertions.
 * Rejects malformed JSON, non-object roots, and prototype-polluting keys.
 */
export function parseRawSaveJson(serialized: string): SaveParseResult {
  if (typeof serialized !== 'string' || serialized.trim().length === 0) {
    return {
      ok: false,
      error: new SaveError('INVALID_JSON', 'Save payload is empty or not a string.'),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    return {
      ok: false,
      error: new SaveError('INVALID_JSON', 'Save payload is not valid JSON.', {
        cause: error instanceof Error ? error.message : String(error),
      }),
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      ok: false,
      error: new SaveError('INVALID_SAVE_DATA', 'Save payload root must be a plain JSON object.'),
    };
  }

  if (hasUnsafeObjectKeys(parsed)) {
    return {
      ok: false,
      error: new SaveError('INVALID_SAVE_DATA', 'Save payload contains prohibited object keys.'),
    };
  }

  return { ok: true, value: parsed };
}

/**
 * Computes a deterministic signature of persisted gameplay content (excluding revision and
 * updatedAt metadata) so SaveService avoids redundant writes when nothing changed.
 */
export function computeSaveContentSignature(data: SaveData): string {
  const sortedLevels: Record<string, unknown> = {};
  for (const key of Object.keys(data.progression.completedLevels).sort()) {
    sortedLevels[key] = data.progression.completedLevels[key];
  }

  return JSON.stringify({
    campaignCatalogVersion: data.campaignCatalogVersion,
    progression: {
      completedLevels: sortedLevels,
      lastPlayedLevelId: data.progression.lastPlayedLevelId,
    },
    settings: data.settings,
    tutorial: data.tutorial,
    seenChallengeIntros: [...data.seenChallengeIntros].sort(),
  });
}

/** Measures the exact UTF-8 byte length of a serialized save string. */
export function measureUtf8ByteSize(serialized: string): number {
  if (typeof globalThis.TextEncoder !== 'undefined') {
    return new globalThis.TextEncoder().encode(serialized).byteLength;
  }
  // Fallback UTF-8 length calculation
  let bytes = 0;
  for (let i = 0; i < serialized.length; i += 1) {
    const code = serialized.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i += 1;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}
