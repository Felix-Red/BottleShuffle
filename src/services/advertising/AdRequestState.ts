import type { AdPlacement, AdRequestOutcome, AdType } from '../../core';
import type { AdvertisingCapabilities } from '../../platform/contracts/AdvertisingProvider';

/**
 * Application-level advertising request lifecycle state.
 *
 * Intentionally models only application request states — never invents an unverified
 * `ad_playing` state because the YouTube Playables SDK does not expose a separate
 * ad-impression or ad-playback callback.
 */
export const AD_REQUEST_STATES = ['idle', 'requesting', 'settled', 'failed', 'disposed'] as const;

export type AdRequestState = (typeof AD_REQUEST_STATES)[number];

export interface AdServiceDiagnosticSnapshot {
  readonly state: AdRequestState;
  readonly providerName: string;
  readonly capabilities: AdvertisingCapabilities;
  readonly activeRequestId: number | null;
  readonly activeAdType: AdType | null;
  readonly activePlacement: AdPlacement | null;
  readonly hostSuspended: boolean;
  readonly totalInterstitialRequests: number;
  readonly totalRewardedRequests: number;
  readonly delayedWarningCount: number;
  readonly lastOutcome: AdRequestOutcome | null;
}
