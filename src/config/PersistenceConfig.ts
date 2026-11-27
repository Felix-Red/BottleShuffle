export const PERSISTENCE_CONFIG = Object.freeze({
  storageKey: 'bottle-shuffle.save',
  normalDebounceMs: 300,
  startupLoadTimeoutMs: 2000,
  flushTimeoutMs: 1200,
  maxAutomaticRetries: 2,
  retryBackoffMs: [1500, 4000] as const,
  /** Internal engineering target for a fully completed 50-level campaign (not a verified platform limit). */
  sizeTargetBytes: 32 * 1024,
  copy: Object.freeze({
    saving: 'Saving...',
    saved: 'Progress saved',
    unavailableWarning:
      'Progress cannot be saved right now. You can keep playing, but changes may be lost when you leave.',
    corruptedWarning:
      'Saved progress could not be read. You can keep playing in a temporary session while your original save is preserved.',
    unsupportedVersionWarning:
      'Saved progress is from a newer version of Bottle Shuffle. Playing in a temporary session to protect your existing save.',
    conflictWarning:
      'Progress was updated in another tab. Automatic saving is paused here to avoid overwriting newer progress.',
  }),
});
