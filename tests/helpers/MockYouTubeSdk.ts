import type {
  YouTubePlayablesSdk,
  YouTubeSdkErrorLike,
  YouTubeSdkErrorType,
  YouTubeUnsetCallback,
} from '../../src/types/youtube-playables';

export interface MockYouTubeSdkOptions {
  readonly inPlayablesEnv?: boolean;
  readonly sdkVersion?: string;
  readonly initialAudioEnabled?: boolean;
  readonly initialCloudData?: string;
  readonly language?: string;
  readonly includeAdsNamespace?: boolean;
  readonly includeInterstitialApi?: boolean;
  readonly includeRewardedApi?: boolean;
}

export function createMockSdkError(
  errorType: YouTubeSdkErrorType,
  message: string,
): YouTubeSdkErrorLike {
  const err = new Error(message) as YouTubeSdkErrorLike & {
    errorType: YouTubeSdkErrorType;
    description: string;
  };
  err.errorType = errorType;
  err.description = message;
  return err;
}

/**
 * Deterministic mock implementing the verified YouTube Playables SDK v1 contract.
 * Strictly confined to tests/helpers/ and never imported by production source code.
 */
export class MockYouTubeSdk {
  public inPlayablesEnv: boolean;
  public sdkVersion: string;
  public audioEnabled: boolean;
  public cloudData: string;
  public language: string;

  public firstFrameReadyCalls = 0;
  public gameReadyCalls = 0;
  public readonly readinessOrder: ('firstFrameReady' | 'gameReady')[] = [];
  public loadDataCalls = 0;
  public saveDataCalls = 0;
  public readonly savedPayloads: string[] = [];
  public healthLogErrorCalls = 0;
  public interstitialAdCalls = 0;
  public rewardedAdCalls = 0;
  public readonly requestedRewardIds: string[] = [];
  public includeAdsNamespace: boolean;
  public includeInterstitialApi: boolean;
  public includeRewardedApi: boolean;

  public audioListenerRegistrations = 0;
  public audioListenerDisposals = 0;
  public pauseListenerRegistrations = 0;
  public pauseListenerDisposals = 0;
  public resumeListenerRegistrations = 0;
  public resumeListenerDisposals = 0;

  private readonly audioListeners = new Set<(enabled: boolean) => void>();
  private readonly pauseListeners = new Set<() => void>();
  private readonly resumeListeners = new Set<() => void>();

  private nextLoadBehavior: (() => Promise<string>) | null = null;
  private nextSaveBehavior: ((data: string) => Promise<void>) | null = null;
  private nextInterstitialBehavior: (() => Promise<void>) | null = null;
  private nextRewardedBehavior: ((rewardId: string) => Promise<boolean>) | null = null;

  public constructor(options: MockYouTubeSdkOptions = {}) {
    this.inPlayablesEnv = options.inPlayablesEnv ?? true;
    this.sdkVersion = options.sdkVersion ?? '1.0.0-mock';
    this.audioEnabled = options.initialAudioEnabled ?? true;
    this.cloudData = options.initialCloudData ?? '';
    this.language = options.language ?? 'en-US';
    this.includeAdsNamespace = options.includeAdsNamespace ?? true;
    this.includeInterstitialApi = options.includeInterstitialApi ?? true;
    this.includeRewardedApi = options.includeRewardedApi ?? true;
  }

  public setNextInterstitialError(error: unknown): void {
    this.nextInterstitialBehavior = () =>
      new Promise<void>((_resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        reject(error);
      });
  }

  public setNextInterstitialDeferred(): {
    readonly resolve: () => void;
    readonly reject: (error?: unknown) => void;
  } {
    let resolveFn: () => void = () => undefined;
    let rejectFn: (error?: unknown) => void = () => undefined;
    const promise = new Promise<void>((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = (err?: unknown) => {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        reject(err);
      };
    });
    this.nextInterstitialBehavior = () => promise;
    return { resolve: resolveFn, reject: rejectFn };
  }

  public setNextRewardedResult(earned: boolean): void {
    this.nextRewardedBehavior = () => Promise.resolve(earned);
  }

  public setNextRewardedError(error: unknown): void {
    this.nextRewardedBehavior = () =>
      new Promise<boolean>((_resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        reject(error);
      });
  }

  public setNextRewardedDeferred(): {
    readonly resolve: (earned: boolean) => void;
    readonly reject: (error?: unknown) => void;
  } {
    let resolveFn: (earned: boolean) => void = () => undefined;
    let rejectFn: (error?: unknown) => void = () => undefined;
    const promise = new Promise<boolean>((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = (err?: unknown) => {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        reject(err);
      };
    });
    this.nextRewardedBehavior = () => promise;
    return { resolve: resolveFn, reject: rejectFn };
  }

  public setNextLoadError(error: unknown): void {
    this.nextLoadBehavior = () =>
      Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }

  public setNextLoadRawError(rawError: unknown): void {
    this.nextLoadBehavior = () =>
      new Promise<string>((_resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        reject(rawError);
      });
  }

  public setNextLoadDeferred(): {
    readonly resolve: (data: string) => void;
    readonly reject: (error: unknown) => void;
  } {
    let resolveFn: (data: string) => void = () => undefined;
    let rejectFn: (error: unknown) => void = () => undefined;
    const promise = new Promise<string>((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });
    this.nextLoadBehavior = () => promise;
    return { resolve: resolveFn, reject: rejectFn };
  }

  public setNextSaveError(error: unknown): void {
    this.nextSaveBehavior = () =>
      Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }

  public setNextSaveDeferred(): {
    readonly resolve: () => void;
    readonly reject: (error: unknown) => void;
  } {
    let resolveFn: () => void = () => undefined;
    let rejectFn: (error: unknown) => void = () => undefined;
    const promise = new Promise<void>((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });
    this.nextSaveBehavior = (data: string) => {
      this.savedPayloads.push(data);
      this.cloudData = data;
      return promise;
    };
    return { resolve: resolveFn, reject: rejectFn };
  }

  public triggerAudioChange(enabled: boolean): void {
    this.audioEnabled = enabled;
    for (const listener of [...this.audioListeners]) {
      listener(enabled);
    }
  }

  public triggerPause(): void {
    for (const listener of [...this.pauseListeners]) {
      listener();
    }
  }

  public triggerResume(): void {
    for (const listener of [...this.resumeListeners]) {
      listener();
    }
  }

  public getActiveListenerCounts(): {
    readonly audio: number;
    readonly pause: number;
    readonly resume: number;
  } {
    return {
      audio: this.audioListeners.size,
      pause: this.pauseListeners.size,
      resume: this.resumeListeners.size,
    };
  }

  public asSdk(): YouTubePlayablesSdk {
    return {
      SDK_VERSION: this.sdkVersion,
      IN_PLAYABLES_ENV: this.inPlayablesEnv,
      SdkErrorType: {
        UNKNOWN: 'UNKNOWN',
        API_UNAVAILABLE: 'API_UNAVAILABLE',
        INVALID_PARAMS: 'INVALID_PARAMS',
        SIZE_LIMIT_EXCEEDED: 'SIZE_LIMIT_EXCEEDED',
      },
      game: {
        firstFrameReady: (): void => {
          this.firstFrameReadyCalls += 1;
          this.readinessOrder.push('firstFrameReady');
        },
        gameReady: (): void => {
          this.gameReadyCalls += 1;
          this.readinessOrder.push('gameReady');
        },
        loadData: (): Promise<string> => {
          this.loadDataCalls += 1;
          if (this.nextLoadBehavior !== null) {
            const fn = this.nextLoadBehavior;
            this.nextLoadBehavior = null;
            return fn();
          }
          return Promise.resolve(this.cloudData);
        },
        saveData: (data: string): Promise<void> => {
          this.saveDataCalls += 1;
          if (this.nextSaveBehavior !== null) {
            const fn = this.nextSaveBehavior;
            this.nextSaveBehavior = null;
            return fn(data);
          }
          this.savedPayloads.push(data);
          this.cloudData = data;
          return Promise.resolve();
        },
      },
      system: {
        isAudioEnabled: (): boolean => this.audioEnabled,
        onAudioEnabledChange: (callback: (enabled: boolean) => void): YouTubeUnsetCallback => {
          this.audioListenerRegistrations += 1;
          this.audioListeners.add(callback);
          let disposed = false;
          return () => {
            if (!disposed) {
              disposed = true;
              this.audioListenerDisposals += 1;
              this.audioListeners.delete(callback);
            }
          };
        },
        onPause: (callback: () => void): YouTubeUnsetCallback => {
          this.pauseListenerRegistrations += 1;
          this.pauseListeners.add(callback);
          let disposed = false;
          return () => {
            if (!disposed) {
              disposed = true;
              this.pauseListenerDisposals += 1;
              this.pauseListeners.delete(callback);
            }
          };
        },
        onResume: (callback: () => void): YouTubeUnsetCallback => {
          this.resumeListenerRegistrations += 1;
          this.resumeListeners.add(callback);
          let disposed = false;
          return () => {
            if (!disposed) {
              disposed = true;
              this.resumeListenerDisposals += 1;
              this.resumeListeners.delete(callback);
            }
          };
        },
        getLanguage: (): Promise<string> => Promise.resolve(this.language),
      },
      health: {
        logError: (): void => {
          this.healthLogErrorCalls += 1;
        },
      },
      ...(this.includeAdsNamespace
        ? {
            ads: {
              ...(this.includeInterstitialApi
                ? {
                    requestInterstitialAd: (): Promise<void> => {
                      this.interstitialAdCalls += 1;
                      if (this.nextInterstitialBehavior !== null) {
                        const fn = this.nextInterstitialBehavior;
                        this.nextInterstitialBehavior = null;
                        return fn();
                      }
                      return Promise.resolve();
                    },
                  }
                : {}),
              ...(this.includeRewardedApi
                ? {
                    requestRewardedAd: (rewardId: string): Promise<boolean> => {
                      this.rewardedAdCalls += 1;
                      this.requestedRewardIds.push(rewardId);
                      if (this.nextRewardedBehavior !== null) {
                        const fn = this.nextRewardedBehavior;
                        this.nextRewardedBehavior = null;
                        return fn(rewardId);
                      }
                      return Promise.resolve(true);
                    },
                  }
                : {}),
            },
          }
        : {}),
    };
  }
}
