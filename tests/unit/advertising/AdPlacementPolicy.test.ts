import { describe, expect, it } from 'vitest';
import { PRODUCTION_MONETIZATION_CONFIG } from '../../../src/config/MonetizationConfig';
import {
  evaluateInterstitialEligibility,
  evaluateRewardedEligibility,
  validateRewardIdentifier,
  type InterstitialPlacementContext,
} from '../../../src/core';

function createEligibleCampaignContext(
  overrides: Partial<InterstitialPlacementContext> = {},
): InterstitialPlacementContext {
  return {
    mode: 'campaign',
    trigger: 'next_level',
    puzzleCompleted: true,
    completionCommitted: true,
    victoryPresented: true,
    sourceLevelId: 'level-001',
    destinationLevelId: 'level-002',
    destinationAccessible: true,
    isChapterBoundary: false,
    hostSuspended: false,
    ...overrides,
  };
}

describe('AdPlacementPolicy (pure domain)', () => {
  it('permits an eligible completed campaign transition to a different accessible level', () => {
    const decision = evaluateInterstitialEligibility(
      createEligibleCampaignContext(),
      PRODUCTION_MONETIZATION_CONFIG,
    );

    expect(decision.eligible).toBe(true);
    expect(decision.placement).toBe('campaign_level_transition');
    expect(decision.coalescedChapterTransition).toBe(false);
  });

  it('coalesces chapter and level transition at a chapter boundary into ONE chapter_transition opportunity', () => {
    const decision = evaluateInterstitialEligibility(
      createEligibleCampaignContext({
        sourceLevelId: 'level-008',
        destinationLevelId: 'level-009',
        isChapterBoundary: true,
      }),
      PRODUCTION_MONETIZATION_CONFIG,
    );

    expect(decision.eligible).toBe(true);
    expect(decision.placement).toBe('chapter_transition');
    expect(decision.coalescedChapterTransition).toBe(true);
    expect(decision.reason).toBe('eligible_chapter_transition');
  });

  it('suppresses interstitials during active gameplay, pause, resume, settings, restart, replay, resize, and boot', () => {
    const blockedTriggers = [
      'active_gameplay',
      'pause',
      'resume',
      'settings',
      'restart',
      'replay',
      'new_practice_puzzle',
      'view_levels',
      'home',
      'resize',
      'boot',
    ] as const;

    for (const trigger of blockedTriggers) {
      const decision = evaluateInterstitialEligibility(
        createEligibleCampaignContext({ trigger }),
        PRODUCTION_MONETIZATION_CONFIG,
      );
      expect(decision.eligible, `expected trigger ${trigger} to be ineligible`).toBe(false);
      expect(decision.placement).toBeNull();
    }
  });

  it('suppresses interstitials in tutorial and practice modes', () => {
    const tutorialDecision = evaluateInterstitialEligibility(
      createEligibleCampaignContext({ mode: 'tutorial' }),
      PRODUCTION_MONETIZATION_CONFIG,
    );
    expect(tutorialDecision.eligible).toBe(false);
    expect(tutorialDecision.reason).toBe('tutorial_mode_ineligible');

    const practiceDecision = evaluateInterstitialEligibility(
      createEligibleCampaignContext({ mode: 'practice' }),
      PRODUCTION_MONETIZATION_CONFIG,
    );
    expect(practiceDecision.eligible).toBe(false);
    expect(practiceDecision.reason).toBe('practice_mode_ineligible');
  });

  it('suppresses interstitials when puzzle is unfinished, uncommitted, or victory screen not yet shown', () => {
    expect(
      evaluateInterstitialEligibility(
        createEligibleCampaignContext({ puzzleCompleted: false }),
        PRODUCTION_MONETIZATION_CONFIG,
      ).eligible,
    ).toBe(false);

    expect(
      evaluateInterstitialEligibility(
        createEligibleCampaignContext({ completionCommitted: false }),
        PRODUCTION_MONETIZATION_CONFIG,
      ).reason,
    ).toBe('completion_not_committed');

    expect(
      evaluateInterstitialEligibility(
        createEligibleCampaignContext({ victoryPresented: false }),
        PRODUCTION_MONETIZATION_CONFIG,
      ).reason,
    ).toBe('victory_not_presented');
  });

  it('suppresses interstitials when destination is invalid, locked, or identical to source level', () => {
    expect(
      evaluateInterstitialEligibility(
        createEligibleCampaignContext({ destinationLevelId: null }),
        PRODUCTION_MONETIZATION_CONFIG,
      ).reason,
    ).toBe('destination_invalid_or_inaccessible');

    expect(
      evaluateInterstitialEligibility(
        createEligibleCampaignContext({ destinationAccessible: false }),
        PRODUCTION_MONETIZATION_CONFIG,
      ).reason,
    ).toBe('destination_invalid_or_inaccessible');

    expect(
      evaluateInterstitialEligibility(
        createEligibleCampaignContext({
          sourceLevelId: 'level-003',
          destinationLevelId: 'level-003',
        }),
        PRODUCTION_MONETIZATION_CONFIG,
      ).reason,
    ).toBe('destination_same_as_source');
  });

  it('suppresses interstitials when host is suspended or master/interstitial config is disabled', () => {
    expect(
      evaluateInterstitialEligibility(
        createEligibleCampaignContext({ hostSuspended: true }),
        PRODUCTION_MONETIZATION_CONFIG,
      ).reason,
    ).toBe('host_suspended');

    expect(
      evaluateInterstitialEligibility(createEligibleCampaignContext(), {
        ...PRODUCTION_MONETIZATION_CONFIG,
        advertisingEnabled: false,
      }).reason,
    ).toBe('advertising_disabled');

    expect(
      evaluateInterstitialEligibility(createEligibleCampaignContext(), {
        ...PRODUCTION_MONETIZATION_CONFIG,
        interstitialEnabled: false,
      }).reason,
    ).toBe('interstitial_disabled');
  });

  it('enforces strict rewarded policy: disabled in production UI, requires opt-in and non-PII reward ID', () => {
    expect(
      evaluateRewardedEligibility(
        {
          rewardId: 'bottle-shuffle.optional-hint.v1',
          explicitUserOptIn: true,
          hostSuspended: false,
        },
        PRODUCTION_MONETIZATION_CONFIG,
      ).reason,
    ).toBe('rewarded_ui_not_exposed_in_production');

    expect(
      evaluateRewardedEligibility(
        {
          rewardId: 'bottle-shuffle.dev-synthetic-reward.v1',
          explicitUserOptIn: false,
          hostSuspended: false,
          isDevelopmentSimulation: true,
        },
        PRODUCTION_MONETIZATION_CONFIG,
      ).reason,
    ).toBe('missing_explicit_user_opt_in');

    expect(
      evaluateRewardedEligibility(
        {
          rewardId: 'player@example.com',
          explicitUserOptIn: true,
          hostSuspended: false,
          isDevelopmentSimulation: true,
        },
        PRODUCTION_MONETIZATION_CONFIG,
      ).reason,
    ).toBe('invalid_reward_identifier');

    expect(
      evaluateRewardedEligibility(
        {
          rewardId: '21403813-2e22-4316-a8b2-7d4f52a6f6fb',
          explicitUserOptIn: true,
          hostSuspended: false,
          isDevelopmentSimulation: true,
        },
        PRODUCTION_MONETIZATION_CONFIG,
      ).eligible,
    ).toBe(true);
  });

  it('validates non-PII reward identifiers strictly', () => {
    expect(validateRewardIdentifier('bottle-shuffle.optional-hint.v1')).toBe(true);
    expect(validateRewardIdentifier('21403813-2e22-4316-a8b2-7d4f52a6f6fb')).toBe(true);
    expect(validateRewardIdentifier('')).toBe(false);
    expect(validateRewardIdentifier('ab')).toBe(false);
    expect(validateRewardIdentifier('user@domain.com')).toBe(false);
    expect(validateRewardIdentifier('{"level":1}')).toBe(false);
    expect(validateRewardIdentifier('space not allowed')).toBe(false);
  });
});
