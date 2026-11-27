import { PUZZLE_GENERATOR_VERSION } from '../engine/PuzzleGenerator';
import { hashStringToHex } from '../random/SeededRandom';
import type { LevelId } from './LevelId';

export const CAMPAIGN_SEED_NAMESPACE = 'bs-campaign-v1';

/**
 * Derives a stable, deterministic campaign seed purely from stable level identity,
 * generator version, and optional catalogue-authored variety salt.
 *
 * Guarantees:
 * - Never depends on current date, player progress, or total catalogue length.
 * - Appending new levels never alters seeds of existing levels.
 * - Identical across restarts, replays, and browser sessions.
 */
export function deriveCampaignLevelSeed(
  levelId: LevelId,
  generatorVersion: string = PUZZLE_GENERATOR_VERSION,
  varietySalt?: string,
): string {
  const canonicalInput =
    varietySalt !== undefined && varietySalt.trim().length > 0
      ? `${CAMPAIGN_SEED_NAMESPACE}|${generatorVersion}|${levelId}|${varietySalt.trim()}`
      : `${CAMPAIGN_SEED_NAMESPACE}|${generatorVersion}|${levelId}`;

  const digest = hashStringToHex(canonicalInput);
  return `${levelId}-${digest}`;
}
