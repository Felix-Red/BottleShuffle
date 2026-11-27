import type {
  YouTubePlayablesSdk,
  YouTubeSdkAdsNamespace,
  YouTubeSdkGameNamespace,
  YouTubeSdkSystemNamespace,
  YouTubeUnsetCallback,
} from '../../types/youtube-playables';

export interface YouTubeSdkClient {
  isInPlayablesEnv(): boolean;
  getSdkVersion(): string | null;
  hasRequiredCoreApis(): boolean;
  hasInterstitialAdApi(): boolean;
  hasRewardedAdApi(): boolean;
  firstFrameReady(): void;
  gameReady(): void;
  loadData(): Promise<string>;
  saveData(data: string): Promise<void>;
  requestInterstitialAd(): Promise<void>;
  requestRewardedAd(rewardId: string): Promise<boolean>;
  isAudioEnabled(): boolean;
  onAudioEnabledChange(callback: (isAudioEnabled: boolean) => void): YouTubeUnsetCallback;
  onPause(callback: () => void): YouTubeUnsetCallback;
  onResume(callback: () => void): YouTubeUnsetCallback;
  getLanguage(): Promise<string | null>;
  logHealthError(): void;
}

interface RuntimeSdkShape {
  readonly SDK_VERSION?: unknown;
  readonly IN_PLAYABLES_ENV?: unknown;
  readonly game?: Partial<YouTubeSdkGameNamespace>;
  readonly system?: Partial<YouTubeSdkSystemNamespace>;
  readonly health?: { readonly logError?: () => void };
  readonly ads?: Partial<YouTubeSdkAdsNamespace>;
}

function resolveGlobalSdk(): YouTubePlayablesSdk | undefined {
  if (typeof globalThis === 'undefined') {
    return undefined;
  }
  return globalThis.ytgame;
}

function asRuntimeShape(sdk: YouTubePlayablesSdk | undefined): RuntimeSdkShape | undefined {
  return sdk;
}

/**
 * Checks safely whether the official YouTube Playables SDK confirms the game is
 * running inside the YouTube Playables environment. Never uses UA, URL, or iframe heuristics.
 */
export function isYouTubePlayablesEnvironment(
  sdk: YouTubePlayablesSdk | undefined = resolveGlobalSdk(),
): boolean {
  return asRuntimeShape(sdk)?.IN_PLAYABLES_ENV === true;
}

/**
 * Thin, injectable boundary around the global `ytgame` object.
 * Isolates all direct SDK access to the platform integration layer and preserves
 * actual SDK errors while supporting deterministic mock injection in tests.
 */
export class GlobalYouTubeSdkClient implements YouTubeSdkClient {
  private readonly getSdk: () => YouTubePlayablesSdk | undefined;

  public constructor(sdkProvider?: () => YouTubePlayablesSdk | undefined) {
    this.getSdk = sdkProvider ?? resolveGlobalSdk;
  }

  public isInPlayablesEnv(): boolean {
    return isYouTubePlayablesEnvironment(this.getSdk());
  }

  public getSdkVersion(): string | null {
    const version = asRuntimeShape(this.getSdk())?.SDK_VERSION;
    return typeof version === 'string' && version.length > 0 ? version : null;
  }

  public hasRequiredCoreApis(): boolean {
    const sdk = asRuntimeShape(this.getSdk());
    if (sdk === undefined) {
      return false;
    }
    return (
      typeof sdk.game?.firstFrameReady === 'function' &&
      typeof sdk.game.gameReady === 'function' &&
      typeof sdk.game.loadData === 'function' &&
      typeof sdk.game.saveData === 'function' &&
      typeof sdk.system?.isAudioEnabled === 'function' &&
      typeof sdk.system.onAudioEnabledChange === 'function' &&
      typeof sdk.system.onPause === 'function' &&
      typeof sdk.system.onResume === 'function'
    );
  }

  public hasInterstitialAdApi(): boolean {
    const sdk = asRuntimeShape(this.getSdk());
    return sdk?.IN_PLAYABLES_ENV === true && typeof sdk.ads?.requestInterstitialAd === 'function';
  }

  public hasRewardedAdApi(): boolean {
    const sdk = asRuntimeShape(this.getSdk());
    return sdk?.IN_PLAYABLES_ENV === true && typeof sdk.ads?.requestRewardedAd === 'function';
  }

  public requestInterstitialAd(): Promise<void> {
    const fn = asRuntimeShape(this.getSdk())?.ads?.requestInterstitialAd;
    if (typeof fn !== 'function') {
      return Promise.reject(
        Object.assign(new Error('YouTube Playables requestInterstitialAd API is unavailable.'), {
          errorType: 'API_UNAVAILABLE',
        }),
      );
    }
    return fn();
  }

  public requestRewardedAd(rewardId: string): Promise<boolean> {
    const fn = asRuntimeShape(this.getSdk())?.ads?.requestRewardedAd;
    if (typeof fn !== 'function') {
      return Promise.reject(
        Object.assign(new Error('YouTube Playables requestRewardedAd API is unavailable.'), {
          errorType: 'API_UNAVAILABLE',
        }),
      );
    }
    return fn(rewardId);
  }

  public firstFrameReady(): void {
    const fn = asRuntimeShape(this.getSdk())?.game?.firstFrameReady;
    if (typeof fn === 'function') {
      fn();
    }
  }

  public gameReady(): void {
    const fn = asRuntimeShape(this.getSdk())?.game?.gameReady;
    if (typeof fn === 'function') {
      fn();
    }
  }

  public loadData(): Promise<string> {
    const fn = asRuntimeShape(this.getSdk())?.game?.loadData;
    if (typeof fn !== 'function') {
      return Promise.reject(
        Object.assign(new Error('YouTube Playables loadData API is unavailable.'), {
          errorType: 'API_UNAVAILABLE',
        }),
      );
    }
    return fn();
  }

  public saveData(data: string): Promise<void> {
    const fn = asRuntimeShape(this.getSdk())?.game?.saveData;
    if (typeof fn !== 'function') {
      return Promise.reject(
        Object.assign(new Error('YouTube Playables saveData API is unavailable.'), {
          errorType: 'API_UNAVAILABLE',
        }),
      );
    }
    return fn(data);
  }

  public isAudioEnabled(): boolean {
    const fn = asRuntimeShape(this.getSdk())?.system?.isAudioEnabled;
    if (typeof fn !== 'function') {
      // Conservative silent fallback if initial audio permission cannot be established.
      return false;
    }
    try {
      return fn();
    } catch {
      return false;
    }
  }

  public onAudioEnabledChange(callback: (isAudioEnabled: boolean) => void): YouTubeUnsetCallback {
    const fn = asRuntimeShape(this.getSdk())?.system?.onAudioEnabledChange;
    if (typeof fn !== 'function') {
      return () => undefined;
    }
    const unset: unknown = fn(callback);
    return typeof unset === 'function' ? (unset as YouTubeUnsetCallback) : () => undefined;
  }

  public onPause(callback: () => void): YouTubeUnsetCallback {
    const fn = asRuntimeShape(this.getSdk())?.system?.onPause;
    if (typeof fn !== 'function') {
      return () => undefined;
    }
    const unset: unknown = fn(callback);
    return typeof unset === 'function' ? (unset as YouTubeUnsetCallback) : () => undefined;
  }

  public onResume(callback: () => void): YouTubeUnsetCallback {
    const fn = asRuntimeShape(this.getSdk())?.system?.onResume;
    if (typeof fn !== 'function') {
      return () => undefined;
    }
    const unset: unknown = fn(callback);
    return typeof unset === 'function' ? (unset as YouTubeUnsetCallback) : () => undefined;
  }

  public async getLanguage(): Promise<string | null> {
    const fn = asRuntimeShape(this.getSdk())?.system?.getLanguage;
    if (typeof fn !== 'function') {
      return null;
    }
    try {
      const lang: unknown = await fn();
      return typeof lang === 'string' && lang.trim().length > 0 ? lang.trim() : null;
    } catch {
      return null;
    }
  }

  public logHealthError(): void {
    const fn = asRuntimeShape(this.getSdk())?.health?.logError;
    if (typeof fn !== 'function') {
      return;
    }
    try {
      fn();
    } catch {
      // Best-effort health reporting must never throw into application flows.
    }
  }
}
