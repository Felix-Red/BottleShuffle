import type { MusicAssetKey } from '../../game/assets/AssetKeys';
import type { AudioSuspensionReason, MusicContext } from './AudioChannel';

export interface AudioStateSnapshot {
  readonly unlocked: boolean;
  readonly unlockAttempted: boolean;
  readonly musicEnabled: boolean;
  readonly soundEffectsEnabled: boolean;
  readonly platformAudioEnabled: boolean;
  readonly activeSuspensionReasons: readonly AudioSuspensionReason[];
  readonly isFullySuspended: boolean;
  readonly isGameplayPaused: boolean;
  readonly desiredMusicContext: MusicContext;
  readonly activeMusicKey: MusicAssetKey | null;
  readonly isMusicPaused: boolean;
  readonly activeSfxCount: number;
  readonly loadedMusicReady: boolean;
}
