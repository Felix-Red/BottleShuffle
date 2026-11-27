export const CURRENT_SAVE_SCHEMA_VERSION = 1 as const;
export const MIN_SUPPORTED_SAVE_SCHEMA_VERSION = 1 as const;
export const SAVE_GAME_ID = 'bottle-shuffle' as const;

export type SaveSchemaVersion = typeof CURRENT_SAVE_SCHEMA_VERSION;
