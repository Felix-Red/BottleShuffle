import type { GamePlatform } from './contracts/GamePlatform';
import { createPlatformForEnvironment, type PlatformFactoryOptions } from './PlatformFactory';

/**
 * Resolves the active GamePlatform adapter for the current runtime environment.
 * Selects `YouTubePlatform` when `ytgame.IN_PLAYABLES_ENV === true` and
 * `BrowserGamePlatform` in standalone browser environments.
 */
export function createPlatform(options?: PlatformFactoryOptions): GamePlatform {
  return createPlatformForEnvironment(options);
}
