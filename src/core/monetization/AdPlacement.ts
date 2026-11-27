/**
 * Explicit application-level advertising opportunity placements.
 *
 * Initial release policy:
 * - Only `campaign_level_transition` and `chapter_transition` (when advancing to a
 *   different accessible campaign level) are eligible for interstitial requests.
 * - Chapter and level transitions at a chapter boundary are coalesced into a single
 *   `chapter_transition` opportunity per navigation transaction.
 * - All other placements remain reserved or disabled in the initial release.
 */
export const AD_PLACEMENTS = [
  'campaign_level_transition',
  'campaign_replay_transition',
  'chapter_transition',
  'campaign_completion',
  'optional_reward',
] as const;

export type AdPlacement = (typeof AD_PLACEMENTS)[number];

export type AdGameplayMode = 'campaign' | 'practice' | 'tutorial';

export type AdTransitionTrigger =
  | 'next_level'
  | 'replay'
  | 'restart'
  | 'pause'
  | 'resume'
  | 'settings'
  | 'active_gameplay'
  | 'new_practice_puzzle'
  | 'view_levels'
  | 'home'
  | 'resize'
  | 'boot';
