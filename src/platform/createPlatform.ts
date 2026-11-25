import { BrowserGamePlatform } from './browser/BrowserGamePlatform';
import type { GamePlatform } from './contracts/GamePlatform';

/**
 * Resolves the active GamePlatform adapter for the current runtime.
 *
 * Task 01 provides the local browser adapter. Future YouTube Playables
 * integration will select a YouTubeGamePlatform adapter here when running
 * inside the YouTube Playables environment.
 */
export function createPlatform(): GamePlatform {
  return new BrowserGamePlatform();
}
