import type { LevelCatalog } from '../levels/LevelCatalog';
import { getDefaultLevelCatalog } from '../levels/LevelFactory';
import type { LevelId } from '../levels/LevelId';
import { isEarnedStarRating } from '../models/StarRating';
import { isMotionPreference } from '../settings/MotionPreference';
import { createDefaultGameSettings } from '../settings/SettingsDefaults';
import type {
  PersistedLevelRecord,
  PersistedSettingsData,
  PersistedTutorialData,
  PersistedTutorialStatus,
  SaveData,
} from './SaveData';
import { DEFAULT_SAVE_TIMESTAMP, freezeSaveData } from './SaveDataFactory';
import {
  CURRENT_SAVE_SCHEMA_VERSION,
  MIN_SUPPORTED_SAVE_SCHEMA_VERSION,
  SAVE_GAME_ID,
} from './SaveSchemaVersion';
import type { SaveValidationResult } from './SaveValidationResult';

const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_COMPLETION_TIME_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_SAFE_SCORE = 100_000_000;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function formatUnknown(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return typeof value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function hasUnsafeObjectKeys(value: unknown, depth = 0): boolean {
  if (depth > 8 || typeof value !== 'object' || value === null) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item) => hasUnsafeObjectKeys(item, depth + 1));
  }
  for (const key of Object.keys(value)) {
    if (UNSAFE_OBJECT_KEYS.has(key)) {
      return true;
    }
    const child = (value as Record<string, unknown>)[key];
    if (hasUnsafeObjectKeys(child, depth + 1)) {
      return true;
    }
  }
  return false;
}

function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_TIMESTAMP_PATTERN.test(value)) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function isPersistedTutorialStatus(value: unknown): value is PersistedTutorialStatus {
  return value === 'not_seen' || value === 'completed' || value === 'skipped';
}

function validateSingleLevelRecord(
  levelId: string,
  raw: unknown,
  catalog: LevelCatalog,
): { readonly record: PersistedLevelRecord | null; readonly errors: readonly string[] } {
  const errors: string[] = [];

  if (UNSAFE_OBJECT_KEYS.has(levelId)) {
    return { record: null, errors: [`Rejected unsafe level key "${levelId}".`] };
  }
  if (catalog.getLevelById(levelId) === undefined) {
    return { record: null, errors: [`Unknown level identifier "${levelId}".`] };
  }
  if (!isPlainRecord(raw)) {
    return { record: null, errors: [`Completion record for "${levelId}" must be an object.`] };
  }

  const completionCount = raw.completionCount;
  if (
    typeof completionCount !== 'number' ||
    !Number.isInteger(completionCount) ||
    completionCount < 1
  ) {
    errors.push(`Invalid completionCount for "${levelId}".`);
  }

  const bestMoveCount = raw.bestMoveCount;
  if (typeof bestMoveCount !== 'number' || !Number.isInteger(bestMoveCount) || bestMoveCount < 1) {
    errors.push(`Invalid bestMoveCount for "${levelId}".`);
  }

  const bestElapsedMs = raw.bestElapsedMs;
  if (
    typeof bestElapsedMs !== 'number' ||
    !Number.isFinite(bestElapsedMs) ||
    bestElapsedMs < 0 ||
    bestElapsedMs > MAX_COMPLETION_TIME_MS
  ) {
    errors.push(`Invalid bestElapsedMs for "${levelId}".`);
  }

  const bestScore = raw.bestScore;
  if (
    bestScore !== undefined &&
    (typeof bestScore !== 'number' ||
      !Number.isInteger(bestScore) ||
      bestScore < 1 ||
      bestScore > MAX_SAFE_SCORE)
  ) {
    errors.push(`Invalid bestScore for "${levelId}".`);
  }

  const bestStarRating = raw.bestStarRating;
  if (bestStarRating !== undefined && !isEarnedStarRating(bestStarRating)) {
    errors.push(`Invalid bestStarRating for "${levelId}".`);
  }

  const scoringPolicyVersion = raw.scoringPolicyVersion;
  if (
    scoringPolicyVersion !== undefined &&
    (typeof scoringPolicyVersion !== 'number' ||
      !Number.isInteger(scoringPolicyVersion) ||
      scoringPolicyVersion < 1)
  ) {
    errors.push(`Invalid scoringPolicyVersion for "${levelId}".`);
  }

  if (errors.length > 0) {
    return { record: null, errors };
  }

  return {
    record: Object.freeze({
      completionCount: completionCount as number,
      bestMoveCount: bestMoveCount as number,
      bestElapsedMs: Math.round(bestElapsedMs as number),
      ...(typeof bestScore === 'number' ? { bestScore } : {}),
      ...(isEarnedStarRating(bestStarRating) ? { bestStarRating } : {}),
      ...(typeof scoringPolicyVersion === 'number' ? { scoringPolicyVersion } : {}),
    }),
    errors: [],
  };
}

/**
 * Validates untrusted parsed save data against schema version, metadata, progression
 * rules (including campaign prerequisite consistency), settings, and tutorial state.
 *
 * Distinguishes:
 * - 'valid': complete, strictly valid SaveData.
 * - 'repaired': partially invalid SaveData where independently valid sections were safely recovered.
 * - 'unsupported_future_version': schemaVersion > CURRENT_SAVE_SCHEMA_VERSION (must be preserved).
 * - 'unsupported_legacy_version': schemaVersion < MIN_SUPPORTED_SAVE_SCHEMA_VERSION.
 * - 'corrupted': unrecoverable root/metadata structure (must not be silently overwritten).
 */
export function validateSaveData(
  raw: unknown,
  catalog: LevelCatalog = getDefaultLevelCatalog(),
): SaveValidationResult {
  if (!isPlainRecord(raw)) {
    return Object.freeze({
      valid: false,
      disposition: 'corrupted',
      data: null,
      errors: Object.freeze(['Save payload root must be a plain JSON object.']),
      repairs: Object.freeze([]),
      detectedSchemaVersion: null,
    });
  }

  if (hasUnsafeObjectKeys(raw)) {
    return Object.freeze({
      valid: false,
      disposition: 'corrupted',
      data: null,
      errors: Object.freeze(['Save payload contains prohibited object keys.']),
      repairs: Object.freeze([]),
      detectedSchemaVersion: null,
    });
  }

  const rawSchema = raw.schemaVersion;
  if (typeof rawSchema !== 'number' || !Number.isInteger(rawSchema) || rawSchema < 1) {
    return Object.freeze({
      valid: false,
      disposition: 'corrupted',
      data: null,
      errors: Object.freeze(['Missing or invalid schemaVersion.']),
      repairs: Object.freeze([]),
      detectedSchemaVersion: null,
    });
  }

  if (rawSchema > CURRENT_SAVE_SCHEMA_VERSION) {
    return Object.freeze({
      valid: false,
      disposition: 'unsupported_future_version',
      data: null,
      errors: Object.freeze([
        `Unsupported future save schemaVersion ${String(rawSchema)} (current is ${String(CURRENT_SAVE_SCHEMA_VERSION)}).`,
      ]),
      repairs: Object.freeze([]),
      detectedSchemaVersion: rawSchema,
    });
  }

  if (rawSchema < MIN_SUPPORTED_SAVE_SCHEMA_VERSION) {
    return Object.freeze({
      valid: false,
      disposition: 'unsupported_legacy_version',
      data: null,
      errors: Object.freeze([`Unsupported legacy save schemaVersion ${String(rawSchema)}.`]),
      repairs: Object.freeze([]),
      detectedSchemaVersion: rawSchema,
    });
  }

  if (raw.gameId !== SAVE_GAME_ID) {
    return Object.freeze({
      valid: false,
      disposition: 'corrupted',
      data: null,
      errors: Object.freeze([`Unexpected gameId "${String(raw.gameId)}".`]),
      repairs: Object.freeze([]),
      detectedSchemaVersion: rawSchema,
    });
  }

  const errors: string[] = [];
  const repairs: string[] = [];

  // Metadata: revision & updatedAt
  const rawRevision = raw.revision;
  let revision = 0;
  if (typeof rawRevision === 'number' && Number.isInteger(rawRevision) && rawRevision >= 0) {
    revision = rawRevision;
  } else {
    errors.push('Invalid save revision.');
    repairs.push('Reset invalid save revision to 0.');
  }

  const rawUpdatedAt = raw.updatedAt;
  let updatedAt = DEFAULT_SAVE_TIMESTAMP;
  if (isValidIsoTimestamp(rawUpdatedAt)) {
    updatedAt = rawUpdatedAt;
  } else {
    errors.push('Invalid updatedAt timestamp.');
    repairs.push('Reset invalid updatedAt timestamp to epoch fallback.');
  }

  // Track whether at least one major section was valid so completely scrambled objects stay 'corrupted'
  let validSectionCount = 0;

  // 1. Progression section
  const completedLevels: Record<LevelId, PersistedLevelRecord> = {};
  let lastPlayedLevelId: LevelId | null = null;
  const rawProgression = raw.progression;

  if (!isPlainRecord(rawProgression)) {
    errors.push('Missing or invalid progression section.');
    repairs.push('Recovered empty default progression section.');
  } else {
    const rawCompleted = rawProgression.completedLevels;
    if (!isPlainRecord(rawCompleted)) {
      errors.push('progression.completedLevels must be an object.');
      repairs.push('Recovered empty completedLevels map.');
    } else {
      validSectionCount += 1;
      for (const [levelId, recordValue] of Object.entries(rawCompleted)) {
        const res = validateSingleLevelRecord(levelId, recordValue, catalog);
        if (res.record !== null) {
          completedLevels[levelId] = res.record;
        } else {
          errors.push(...res.errors);
          repairs.push(`Dropped invalid completion record "${levelId}".`);
        }
      }

      // Enforce campaign prerequisite consistency: a level cannot be completed if its prerequisite is missing
      for (const level of catalog.getAllLevels()) {
        if (completedLevels[level.id] === undefined) {
          continue;
        }
        if (
          level.prerequisiteLevelId !== null &&
          completedLevels[level.prerequisiteLevelId] === undefined
        ) {
          errors.push(
            `Completion record "${level.id}" is missing prerequisite "${level.prerequisiteLevelId}".`,
          );
          Reflect.deleteProperty(completedLevels, level.id);
          repairs.push(`Removed orphan completion record "${level.id}" without prerequisite.`);
        }
      }
    }

    const rawLastPlayed = rawProgression.lastPlayedLevelId;
    if (rawLastPlayed === null || rawLastPlayed === undefined) {
      lastPlayedLevelId = null;
      if (rawLastPlayed === undefined) {
        errors.push('Missing progression.lastPlayedLevelId.');
        repairs.push('Defaulted missing lastPlayedLevelId to null.');
      }
    } else if (
      typeof rawLastPlayed === 'string' &&
      catalog.getLevelById(rawLastPlayed) !== undefined
    ) {
      lastPlayedLevelId = rawLastPlayed;
    } else {
      errors.push(`Invalid lastPlayedLevelId "${formatUnknown(rawLastPlayed)}".`);
      repairs.push('Reset invalid lastPlayedLevelId to null.');
    }
  }

  // 2. Settings section
  const defaultSettings = createDefaultGameSettings();
  let settings: PersistedSettingsData = {
    musicEnabled: defaultSettings.musicEnabled,
    soundEffectsEnabled: defaultSettings.soundEffectsEnabled,
    vibrationEnabled: defaultSettings.vibrationEnabled,
    motionPreference: defaultSettings.motionPreference,
  };
  const rawSettings = raw.settings;
  if (!isPlainRecord(rawSettings)) {
    errors.push('Missing or invalid settings section.');
    repairs.push('Recovered default player settings.');
  } else {
    let settingsValidFields = 0;

    if (typeof rawSettings.musicEnabled === 'boolean') {
      settings = { ...settings, musicEnabled: rawSettings.musicEnabled };
      settingsValidFields += 1;
    } else {
      errors.push('Invalid settings.musicEnabled.');
      repairs.push('Reset invalid settings.musicEnabled to default.');
    }

    if (typeof rawSettings.soundEffectsEnabled === 'boolean') {
      settings = { ...settings, soundEffectsEnabled: rawSettings.soundEffectsEnabled };
      settingsValidFields += 1;
    } else {
      errors.push('Invalid settings.soundEffectsEnabled.');
      repairs.push('Reset invalid settings.soundEffectsEnabled to default.');
    }

    if (typeof rawSettings.vibrationEnabled === 'boolean') {
      settings = { ...settings, vibrationEnabled: rawSettings.vibrationEnabled };
      settingsValidFields += 1;
    } else {
      errors.push('Invalid settings.vibrationEnabled.');
      repairs.push('Reset invalid settings.vibrationEnabled to default.');
    }

    if (isMotionPreference(rawSettings.motionPreference)) {
      settings = { ...settings, motionPreference: rawSettings.motionPreference };
      settingsValidFields += 1;
    } else {
      errors.push('Invalid settings.motionPreference.');
      repairs.push('Reset invalid settings.motionPreference to default.');
    }

    if (settingsValidFields > 0) {
      validSectionCount += 1;
    }
  }

  // 3. Tutorial section
  let tutorial: PersistedTutorialData = { status: 'not_seen', completed: false };
  const rawTutorial = raw.tutorial;
  if (!isPlainRecord(rawTutorial)) {
    errors.push('Missing or invalid tutorial section.');
    repairs.push('Recovered default tutorial state.');
  } else {
    const rawStatus = rawTutorial.status;
    const rawCompletedFlag = rawTutorial.completed;

    if (isPersistedTutorialStatus(rawStatus)) {
      validSectionCount += 1;
      const expectedCompleted = rawStatus === 'completed';
      if (typeof rawCompletedFlag !== 'boolean' || rawCompletedFlag !== expectedCompleted) {
        errors.push('Inconsistent tutorial.completed flag.');
        repairs.push('Aligned tutorial.completed with tutorial.status.');
      }
      tutorial = { status: rawStatus, completed: expectedCompleted };
    } else if (typeof rawCompletedFlag === 'boolean') {
      validSectionCount += 1;
      errors.push('Missing or invalid tutorial.status.');
      repairs.push('Derived tutorial.status from tutorial.completed boolean.');
      tutorial = {
        status: rawCompletedFlag ? 'completed' : 'not_seen',
        completed: rawCompletedFlag,
      };
    } else {
      errors.push('Invalid tutorial completion state.');
      repairs.push('Recovered default tutorial state.');
    }
  }

  if (validSectionCount === 0) {
    return Object.freeze({
      valid: false,
      disposition: 'corrupted',
      data: null,
      errors: Object.freeze(errors),
      repairs: Object.freeze([]),
      detectedSchemaVersion: rawSchema,
    });
  }

  const normalized = freezeSaveData({
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    gameId: SAVE_GAME_ID,
    revision,
    updatedAt,
    progression: {
      completedLevels,
      lastPlayedLevelId,
    },
    settings,
    tutorial,
  });

  if (errors.length === 0) {
    return Object.freeze({
      valid: true,
      disposition: 'valid',
      data: normalized,
      errors: Object.freeze([]),
      repairs: Object.freeze([]),
      detectedSchemaVersion: rawSchema,
    });
  }

  return Object.freeze({
    valid: false,
    disposition: 'repaired',
    data: normalized,
    errors: Object.freeze(errors),
    repairs: Object.freeze(repairs),
    detectedSchemaVersion: rawSchema,
  });
}

export function isValidSaveData(
  raw: unknown,
  catalog: LevelCatalog = getDefaultLevelCatalog(),
): raw is SaveData {
  return validateSaveData(raw, catalog).disposition === 'valid';
}
