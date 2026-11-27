import { describe, expect, it, vi } from 'vitest';
import { BrowserGamePlatform } from '../../../src/platform/browser/BrowserGamePlatform';
import { createPlatformForEnvironment } from '../../../src/platform/PlatformFactory';
import { YouTubePlatform } from '../../../src/platform/youtube/YouTubePlatform';
import { GlobalYouTubeSdkClient } from '../../../src/platform/youtube/YouTubeSdkClient';
import { GameReadinessService } from '../../../src/services/platform/GameReadinessService';
import type { YouTubePlayablesSdk } from '../../../src/types/youtube-playables';
import { MockYouTubeSdk } from '../../helpers/MockYouTubeSdk';

describe('Environment detection, YouTubePlatform, capabilities, and readiness', () => {
  it('selects BrowserGamePlatform when SDK is absent or IN_PLAYABLES_ENV is false, and YouTubePlatform when confirmed', () => {
    const absentClient = new GlobalYouTubeSdkClient(() => undefined);
    const browserWhenAbsent = createPlatformForEnvironment({
      youtubeSdkClient: absentClient,
      browserOptions: { storage: null, documentRef: null },
    });
    expect(browserWhenAbsent).toBeInstanceOf(BrowserGamePlatform);
    expect(browserWhenAbsent.getCapabilities?.().environment).toBe('browser');
    expect(browserWhenAbsent.getCapabilities?.().useBrowserVisibilityLifecycle).toBe(true);
    browserWhenAbsent.dispose();

    const outsideMock = new MockYouTubeSdk({ inPlayablesEnv: false });
    const outsideClient = new GlobalYouTubeSdkClient(() => outsideMock.asSdk());
    const browserWhenOutside = createPlatformForEnvironment({
      youtubeSdkClient: outsideClient,
      browserOptions: { storage: null, documentRef: null },
    });
    expect(browserWhenOutside).toBeInstanceOf(BrowserGamePlatform);
    browserWhenOutside.dispose();

    const ytMock = new MockYouTubeSdk({ inPlayablesEnv: true });
    const ytClient = new GlobalYouTubeSdkClient(() => ytMock.asSdk());
    const ytPlatform = createPlatformForEnvironment({ youtubeSdkClient: ytClient });
    expect(ytPlatform).toBeInstanceOf(YouTubePlatform);
    expect(ytPlatform.getCapabilities?.().environment).toBe('youtube');
    ytPlatform.dispose();
  });

  it('never silently falls back to BrowserGamePlatform/LocalStorage when inside YouTube with incomplete SDK APIs', () => {
    const partialSdk = {
      IN_PLAYABLES_ENV: true,
      game: {} as YouTubePlayablesSdk['game'],
      system: {} as YouTubePlayablesSdk['system'],
    } as YouTubePlayablesSdk;

    const client = new GlobalYouTubeSdkClient(() => partialSdk);
    const platform = createPlatformForEnvironment({ youtubeSdkClient: client });
    expect(platform).toBeInstanceOf(YouTubePlatform);
    expect(platform.getCapabilities?.().localStoragePersistence).toBe(false);
    expect(platform.getCapabilities?.().cloudSave).toBe(false);
    expect(platform.isAudioEnabled()).toBe(false);
    platform.dispose();
  });

  it('supports explicit mock platform injection via PlatformFactory', () => {
    const injected = new BrowserGamePlatform({ storage: null, documentRef: null });
    const resolved = createPlatformForEnvironment({ overridePlatform: injected });
    expect(resolved).toBe(injected);
    injected.dispose();
  });

  it('enforces YouTube capability policy (no LocalStorage, no haptics, no score reporting, technical ads detection, language fallback)', async () => {
    const mock = new MockYouTubeSdk({ inPlayablesEnv: true, language: 'ja-JP' });
    const client = new GlobalYouTubeSdkClient(() => mock.asSdk());
    const platform = new YouTubePlatform(client);
    await platform.initialize();

    const caps = platform.getCapabilities();
    expect(caps.environment).toBe('youtube');
    expect(caps.localStoragePersistence).toBe(false);
    expect(caps.cloudSave).toBe(true);
    expect(caps.hostAudioControl).toBe(true);
    expect(caps.hostLifecycleControl).toBe(true);
    expect(caps.useBrowserVisibilityLifecycle).toBe(false);
    expect(caps.haptics).toBe(false);
    expect(caps.scoreReporting).toBe(false);
    expect(caps.advertising).toBe(true);
    expect(caps.advertisingEnabled).toBe(true);
    expect(caps.interstitialAds).toBe(true);
    expect(caps.rewardedAds).toBe(true);
    expect(caps.externalAuth).toBe(false);

    expect(platform.isVibrationSupported()).toBe(false);
    expect(platform.vibrate()).toBe(false);
    expect(await platform.getLanguage()).toBe('en');

    platform.dispose();
  });

  it('enforces readiness order (firstFrameReady -> gameReady), idempotency, and prerequisite gating', async () => {
    const mock = new MockYouTubeSdk({ inPlayablesEnv: true });
    const client = new GlobalYouTubeSdkClient(() => mock.asSdk());
    const platform = new YouTubePlatform(client);
    await platform.initialize();

    let nowMs = 100;
    const readiness = new GameReadinessService(platform, () => nowMs);

    // Marking interactive scene before assets & save restore MUST NOT fire gameReady yet
    expect(readiness.markInteractiveSceneReady()).toBe(false);
    expect(mock.gameReadyCalls).toBe(0);

    // First frame renders
    nowMs = 250;
    expect(readiness.markFirstFrameRendered()).toBe(true);
    expect(readiness.markFirstFrameRendered()).toBe(false); // idempotent
    expect(mock.firstFrameReadyCalls).toBe(1);
    expect(mock.gameReadyCalls).toBe(0);

    // Assets finish, still waiting for save restore
    readiness.markAssetsLoaded();
    expect(mock.gameReadyCalls).toBe(0);

    // Save finishes -> gameReady fires once!
    nowMs = 420;
    readiness.markSaveRestored();
    expect(mock.firstFrameReadyCalls).toBe(1);
    expect(mock.gameReadyCalls).toBe(1);
    expect(mock.readinessOrder).toEqual(['firstFrameReady', 'gameReady']);

    // Subsequent scene transitions / resizes never repeat either notification
    readiness.markFirstFrameRendered();
    readiness.markInteractiveSceneReady();
    platform.notifyFirstFrameReady();
    platform.notifyGameReady();
    expect(mock.firstFrameReadyCalls).toBe(1);
    expect(mock.gameReadyCalls).toBe(1);

    const snap = readiness.getSnapshot();
    expect(snap.firstFrameReadyAtMs).toBe(250);
    expect(snap.gameReadyAtMs).toBe(420);

    platform.dispose();
  });

  it('registers host audio/pause/resume listeners once, deduplicates callbacks, throttles health errors, and disposes cleanly', async () => {
    let clockMs = 0;
    const mock = new MockYouTubeSdk({ inPlayablesEnv: true, initialAudioEnabled: false });
    const client = new GlobalYouTubeSdkClient(() => mock.asSdk());
    const platform = new YouTubePlatform(client, { now: () => clockMs });

    await platform.initialize();
    await platform.initialize(); // idempotent

    expect(mock.audioListenerRegistrations).toBe(1);
    expect(mock.pauseListenerRegistrations).toBe(1);
    expect(mock.resumeListenerRegistrations).toBe(1);
    expect(platform.isAudioEnabled()).toBe(false);

    const onAudio = vi.fn();
    const onPause = vi.fn();
    const onResume = vi.fn();
    platform.onAudioEnabledChange(onAudio);
    platform.onPause(onPause);
    platform.onResume(onResume);

    // Duplicate audio false ignored, true fires once
    mock.triggerAudioChange(false);
    mock.triggerAudioChange(true);
    mock.triggerAudioChange(true);
    expect(onAudio).toHaveBeenCalledTimes(1);
    expect(onAudio).toHaveBeenCalledWith(true);

    // Duplicate pause/resume deduplicated
    mock.triggerResume(); // not paused yet -> ignored
    mock.triggerPause();
    mock.triggerPause();
    mock.triggerResume();
    mock.triggerResume();
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onResume).toHaveBeenCalledTimes(1);

    // Rate-limited health error reporting
    platform.logHealthError();
    clockMs += 500;
    platform.logHealthError();
    expect(mock.healthLogErrorCalls).toBe(1);
    clockMs += 15_000;
    platform.logHealthError();
    expect(mock.healthLogErrorCalls).toBe(2);

    platform.dispose();
    expect(mock.getActiveListenerCounts()).toEqual({ audio: 0, pause: 0, resume: 0 });
    expect(mock.audioListenerDisposals).toBe(1);
    expect(mock.pauseListenerDisposals).toBe(1);
    expect(mock.resumeListenerDisposals).toBe(1);
  });
});
