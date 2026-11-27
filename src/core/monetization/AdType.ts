/**
 * Platform-supported in-game advertising formats requested via the SDK.
 * Pre-roll advertising is managed automatically by YouTube and is intentionally excluded.
 */
export const AD_TYPES = ['interstitial', 'rewarded'] as const;

export type AdType = (typeof AD_TYPES)[number];
