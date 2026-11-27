/**
 * Centralised platform integration configuration and verified official limits.
 *
 * Official YouTube Playables references verified 2026-11-27:
 * - https://developers.google.com/youtube/gaming/playables/reference/sdk
 * - https://developers.google.com/youtube/gaming/playables/certification/requirements_stability
 */
export const PLATFORM_CONFIG = Object.freeze({
  youtube: Object.freeze({
    /** Official YouTube Playables SDK v1 script URL. */
    sdkScriptUrl: 'https://www.youtube.com/game_api/v1',
    /** Hard official SDK maximum for saveData UTF-16 string payload (3 MiB). */
    sdkMaxSavePayloadBytes: 3 * 1024 * 1024,
    /** Official stability recommendation for saveData size (500 KiB). */
    recommendedMaxSavePayloadBytes: 500 * 1024,
    /** Best-effort exit/pause flush budget documented by platform guidance (64 KiB). */
    exitFlushMaxBytes: 64 * 1024,
    /** Internal Bottle Shuffle target for a fully completed 50-level campaign (32 KiB). */
    internalTargetSaveBytes: 32 * 1024,
    /** Default fallback language tag when host language is unsupported or unavailable. */
    defaultLanguage: 'en',
    /** Supported locales in the current release. */
    supportedLanguages: Object.freeze(['en'] as const),
    /** Minimum interval between best-effort ytgame.health.logError() calls to avoid flooding. */
    healthErrorCooldownMs: 10_000,
    /** Score reporting remains explicitly disabled in Task 17. */
    scoreReportingEnabled: false,
  }),
  browser: Object.freeze({
    defaultLanguage: 'en',
  }),
});
