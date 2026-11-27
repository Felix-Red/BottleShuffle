import { describe, expect, it, vi } from 'vitest';
import {
  MONETIZATION_COPY,
  PRODUCTION_MONETIZATION_CONFIG,
} from '../../../src/config/MonetizationConfig';
import { LevelTransitionCoordinator } from '../../../src/game/navigation/LevelTransitionCoordinator';
import { ProgressionController } from '../../../src/game/progression/ProgressionController';
import { YouTubePlatform } from '../../../src/platform/youtube/YouTubePlatform';
import { GlobalYouTubeSdkClient } from '../../../src/platform/youtube/YouTubeSdkClient';
import { AdService } from '../../../src/services/advertising/AdService';
import { RewardedAdService } from '../../../src/services/advertising/RewardedAdService';
import { MockAdvertisingProvider } from '../../helpers/MockAdvertisingProvider';
import { MockYouTubeSdk } from '../../helpers/MockYouTubeSdk';

describe('RewardedAdService & LevelTransitionCoordinator', () => {
  it('enforces opt-in, valid reward IDs, single grant on true, zero grants on false/failure, and duplicate transaction protection', async () => {
    const sdk = new MockYouTubeSdk();
    const platform = new YouTubePlatform(new GlobalYouTubeSdkClient(() => sdk.asSdk()));
    await platform.initialize();

    const mockProvider = new MockAdvertisingProvider();
    const adService = new AdService({ provider: mockProvider, platform });
    const rewardedService = new RewardedAdService({ adService, platform });

    // Production config keeps rewarded UI disabled when not simulating
    expect(PRODUCTION_MONETIZATION_CONFIG.rewardedUiExposedInProduction).toBe(false);
    const prodBlocked = await rewardedService.requestOptionalReward({
      rewardId: MONETIZATION_COPY.reservedRewardIds.optionalHint,
      explicitUserOptIn: true,
      onGrantReward: () => {
        mockProvider.recordSyntheticRewardGrant();
      },
    });
    expect(prodBlocked.rewardGranted).toBe(false);
    expect(prodBlocked.outcome.status).toBe('suppressed_by_policy');

    // Missing opt-in rejected
    const noOptIn = await rewardedService.requestOptionalReward({
      rewardId: MONETIZATION_COPY.reservedRewardIds.devSyntheticReward,
      explicitUserOptIn: false,
      isDevelopmentSimulation: true,
      onGrantReward: () => {
        mockProvider.recordSyntheticRewardGrant();
      },
    });
    expect(noOptIn.rewardGranted).toBe(false);
    expect(noOptIn.outcome.reason).toBe('missing_explicit_user_opt_in');

    // Invalid reward ID rejected
    const badId = await rewardedService.requestOptionalReward({
      rewardId: 'bad email@user.com',
      explicitUserOptIn: true,
      isDevelopmentSimulation: true,
      onGrantReward: () => {
        mockProvider.recordSyntheticRewardGrant();
      },
    });
    expect(badId.rewardGranted).toBe(false);
    expect(badId.outcome.reason).toBe('invalid_reward_identifier');

    // Reward earned grants exactly once
    mockProvider.setDefaultRewardedStatus('reward_earned');
    const earned = await rewardedService.requestOptionalReward({
      rewardId: MONETIZATION_COPY.reservedRewardIds.devSyntheticReward,
      transactionId: 'tx-unique-1',
      explicitUserOptIn: true,
      isDevelopmentSimulation: true,
      onGrantReward: () => {
        mockProvider.recordSyntheticRewardGrant();
      },
    });
    expect(earned.rewardGranted).toBe(true);
    expect(mockProvider.syntheticRewardGrantCount).toBe(1);
    expect(rewardedService.getTotalRewardsGranted()).toBe(1);

    // Reusing the same transaction ID cannot grant twice
    const duplicate = await rewardedService.requestOptionalReward({
      rewardId: MONETIZATION_COPY.reservedRewardIds.devSyntheticReward,
      transactionId: 'tx-unique-1',
      explicitUserOptIn: true,
      isDevelopmentSimulation: true,
      onGrantReward: () => {
        mockProvider.recordSyntheticRewardGrant();
      },
    });
    expect(duplicate.rewardGranted).toBe(false);
    expect(duplicate.outcome.reason).toBe('duplicate_transaction_blocked');
    expect(mockProvider.syntheticRewardGrantCount).toBe(1);

    // Reward not earned grants nothing
    mockProvider.setDefaultRewardedStatus('reward_not_earned');
    const notEarned = await rewardedService.requestOptionalReward({
      rewardId: MONETIZATION_COPY.reservedRewardIds.devSyntheticReward,
      explicitUserOptIn: true,
      isDevelopmentSimulation: true,
      onGrantReward: () => {
        mockProvider.recordSyntheticRewardGrant();
      },
    });
    expect(notEarned.rewardGranted).toBe(false);
    expect(mockProvider.syntheticRewardGrantCount).toBe(1);

    // Failed rewarded request grants nothing
    mockProvider.setDefaultRewardedStatus('failed');
    const failed = await rewardedService.requestOptionalReward({
      rewardId: MONETIZATION_COPY.reservedRewardIds.devSyntheticReward,
      explicitUserOptIn: true,
      isDevelopmentSimulation: true,
      onGrantReward: () => {
        mockProvider.recordSyntheticRewardGrant();
      },
    });
    expect(failed.rewardGranted).toBe(false);
    expect(mockProvider.syntheticRewardGrantCount).toBe(1);

    rewardedService.dispose();
    adService.dispose();
    platform.dispose();
  });

  it('defers earned reward presentation while host is suspended and preserves out-of-context rewards', async () => {
    const sdk = new MockYouTubeSdk();
    const platform = new YouTubePlatform(new GlobalYouTubeSdkClient(() => sdk.asSdk()));
    await platform.initialize();

    const mockProvider = new MockAdvertisingProvider();
    const adService = new AdService({ provider: mockProvider, platform });
    const rewardedService = new RewardedAdService({ adService, platform });

    const deferred = mockProvider.setNextRewardedDeferred();
    let uiContextAlive = true;
    const onGrant = vi.fn();
    const onPreserve = vi.fn();

    const txPromise = rewardedService.requestOptionalReward({
      rewardId: MONETIZATION_COPY.reservedRewardIds.devSyntheticReward,
      explicitUserOptIn: true,
      isDevelopmentSimulation: true,
      onGrantReward: onGrant,
      isContextStillValid: () => uiContextAlive,
      onPreserveEarnedReward: onPreserve,
    });

    // Host pauses during ad, reward resolves while paused, original scene closes
    sdk.triggerPause();
    deferred.resolveEarned();
    const result = await txPromise;
    expect(result.deferredUntilResume).toBe(true);
    expect(onGrant).not.toHaveBeenCalled();

    uiContextAlive = false;
    sdk.triggerResume();

    expect(onGrant).not.toHaveBeenCalled();
    expect(onPreserve).toHaveBeenCalledTimes(1);
    expect(rewardedService.getTotalRewardsGranted()).toBe(1);

    rewardedService.dispose();
    adService.dispose();
    platform.dispose();
  });

  it('coordinates LevelTransitionCoordinator: launches once, blocks duplicates & invalid levels, recovers from failures, respects host pause', async () => {
    const sdk = new MockYouTubeSdk();
    const platform = new YouTubePlatform(new GlobalYouTubeSdkClient(() => sdk.asSdk()));
    await platform.initialize();

    const progression = new ProgressionController();
    // Unlock level-002 by completing level-001
    const attempt = progression.beginCampaignAttempt('level-001');
    expect(attempt.accepted).toBe(true);
    if (attempt.accepted) {
      progression.completeActiveAttempt({
        attemptId: attempt.attempt.attemptId,
        levelId: 'level-001',
        moveCount: 3,
        elapsedMs: 9000,
        score: 1000,
        starRating: 3,
        scoringPolicyVersion: 1,
      });
    }

    const mockProvider = new MockAdvertisingProvider();
    const adService = new AdService({ provider: mockProvider, platform });
    const launched: string[] = [];

    const coordinator = new LevelTransitionCoordinator({
      platform,
      adService,
      progressionController: progression,
      onLaunchCampaignLevel: (levelId) => {
        launched.push(levelId);
      },
    });

    // Invalid / locked level cannot launch or request an ad
    const lockedRes = await coordinator.requestCampaignNextLevel({
      sourceLevelId: 'level-001',
      destinationLevelId: 'level-010',
      puzzleCompleted: true,
      completionCommitted: true,
      victoryPresented: true,
    });
    expect(lockedRes.status).toBe('invalid_destination');
    expect(lockedRes.launched).toBe(false);
    expect(mockProvider.interstitialRequestCount).toBe(0);

    // Repeated taps while pending produce only 1 ad request and 1 launch
    const deferred = mockProvider.setNextInterstitialDeferred();
    const first = coordinator.requestCampaignNextLevel({
      sourceLevelId: 'level-001',
      destinationLevelId: 'level-002',
      puzzleCompleted: true,
      completionCommitted: true,
      victoryPresented: true,
    });
    const dup = await coordinator.requestCampaignNextLevel({
      sourceLevelId: 'level-001',
      destinationLevelId: 'level-002',
      puzzleCompleted: true,
      completionCommitted: true,
      victoryPresented: true,
    });
    expect(dup.status).toBe('duplicate_blocked');
    expect(mockProvider.interstitialRequestCount).toBe(1);

    // Host pauses before settle; settling while paused must NOT launch prematurely
    sdk.triggerPause();
    deferred.resolveFailed('Network error');
    await Promise.resolve();
    await Promise.resolve();
    expect(launched).toEqual([]);

    // Host resumes -> launches exactly once even though ad failed!
    sdk.triggerResume();
    const settled = await first;
    expect(settled.status).toBe('launched');
    expect(settled.launched).toBe(true);
    expect(settled.adOutcome?.status).toBe('failed');
    expect(launched).toEqual(['level-002']);

    // Obsolete callback after disposal cannot launch another scene
    const deferred2 = mockProvider.setNextInterstitialDeferred();
    const cancelledPromise = coordinator.requestCampaignNextLevel({
      sourceLevelId: 'level-001',
      destinationLevelId: 'level-002',
      puzzleCompleted: true,
      completionCommitted: true,
      victoryPresented: true,
    });
    coordinator.dispose();
    deferred2.resolveCompleted();
    const cancelledRes = await cancelledPromise;
    expect(cancelledRes.status).toBe('cancelled_disposed');
    expect(launched).toEqual(['level-002']);

    adService.dispose();
    platform.dispose();
  });
});
