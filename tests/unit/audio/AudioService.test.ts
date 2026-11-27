import { describe, expect, it } from 'vitest';
import {
  AUDIO_ASSET_KEYS,
  type AudioAssetKey,
  type MusicAssetKey,
  type SfxAssetKey,
} from '../../../src/game/assets/AssetKeys';
import { BrowserGamePlatform } from '../../../src/platform/browser/BrowserGamePlatform';
import { SettingsService } from '../../../src/services/SettingsService';
import type {
  AudioBackend,
  BackendMusicHandle,
  BackendMusicPlayRequest,
  BackendSfxPlayRequest,
  BackendSoundHandle,
} from '../../../src/services/audio/AudioBackend';
import {
  AUDIO_CATALOG,
  getDeferredAudioEntries,
  getEssentialAudioEntries,
  getExpectedAudioAssetKeys,
} from '../../../src/services/audio/AudioCatalog';
import { AUDIO_CONFIG, clampVolume } from '../../../src/services/audio/AudioConfig';
import { AudioService } from '../../../src/services/audio/AudioService';

interface PlayedSfxRecord {
  readonly key: SfxAssetKey;
  readonly volume: number;
  readonly rate: number;
  readonly priority: number;
  stopped: boolean;
  ended: boolean;
  finish: () => void;
}

interface PlayedMusicRecord {
  readonly key: MusicAssetKey;
  volume: number;
  loop: boolean;
  stopped: boolean;
  paused: boolean;
  fadeCalls: { target: number; durationMs: number }[];
}

class FakeAudioBackend implements AudioBackend {
  public unlocked: boolean;
  public unlockShouldSucceed = true;
  public unlockShouldThrow = false;
  public globalMuted = false;
  public disposed = false;
  public readonly availableAssets = new Set<AudioAssetKey>();
  public readonly playedSfx: PlayedSfxRecord[] = [];
  public readonly playedMusic: PlayedMusicRecord[] = [];
  private readonly unlockListeners = new Set<() => void>();
  private nextId = 1;

  public constructor(options: { unlocked?: boolean; loadAllAssets?: boolean } = {}) {
    this.unlocked = options.unlocked ?? true;
    if (options.loadAllAssets ?? true) {
      for (const entry of AUDIO_CATALOG) {
        this.availableAssets.add(entry.id);
      }
    }
  }

  public isUnlocked(): boolean {
    return this.unlocked;
  }

  public unlock(): Promise<boolean> {
    if (this.unlockShouldThrow) {
      return Promise.reject(new Error('Autoplay blocked'));
    }
    if (this.unlockShouldSucceed) {
      this.unlocked = true;
      for (const listener of [...this.unlockListeners]) {
        listener();
      }
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }

  public onUnlocked(listener: () => void): () => void {
    this.unlockListeners.add(listener);
    return () => {
      this.unlockListeners.delete(listener);
    };
  }

  public hasAsset(key: AudioAssetKey): boolean {
    return this.availableAssets.has(key);
  }

  public playSfx(request: BackendSfxPlayRequest): BackendSoundHandle | null {
    if (!this.availableAssets.has(request.key)) {
      return null;
    }

    const id = this.nextId;
    this.nextId += 1;

    const record: PlayedSfxRecord = {
      key: request.key,
      volume: request.volume,
      rate: request.rate,
      priority: request.priority,
      stopped: false,
      ended: false,
      finish: (): void => {
        if (!record.ended) {
          record.ended = true;
          request.onEnded?.();
        }
      },
    };
    this.playedSfx.push(record);

    return {
      id,
      key: request.key,
      channel: request.channel,
      priority: request.priority,
      stop: (): void => {
        record.stopped = true;
        record.finish();
      },
      setVolume: (): void => undefined,
      isPlaying: (): boolean => !record.stopped && !record.ended,
    };
  }

  public playMusic(request: BackendMusicPlayRequest): BackendMusicHandle | null {
    if (!this.availableAssets.has(request.key)) {
      return null;
    }

    const record: PlayedMusicRecord = {
      key: request.key,
      volume: request.volume,
      loop: request.loop,
      stopped: false,
      paused: false,
      fadeCalls: [],
    };
    this.playedMusic.push(record);

    return {
      key: request.key,
      stop: (): void => {
        record.stopped = true;
        record.paused = false;
      },
      pause: (): void => {
        if (!record.stopped) {
          record.paused = true;
        }
      },
      resume: (): void => {
        if (!record.stopped) {
          record.paused = false;
        }
      },
      setVolume: (v: number): void => {
        record.volume = v;
      },
      fadeTo: (targetVolume: number, durationMs: number, onComplete?: () => void): void => {
        record.fadeCalls.push({ target: targetVolume, durationMs });
        record.volume = targetVolume;
        onComplete?.();
      },
      isPlaying: (): boolean => !record.stopped && !record.paused,
      isPaused: (): boolean => !record.stopped && record.paused,
    };
  }

  public setGlobalMute(muted: boolean): void {
    this.globalMuted = muted;
  }

  public dispose(): void {
    this.disposed = true;
    this.unlockListeners.clear();
  }
}

describe('AudioCatalog and asset bundle integrity', () => {
  it('registers every expected audio asset key with unique relative local .m4a paths', () => {
    const expectedKeys = getExpectedAudioAssetKeys();
    const catalogIds = AUDIO_CATALOG.map((e) => e.id);
    const catalogPaths = AUDIO_CATALOG.map((e) => e.path);

    expect(new Set(catalogIds).size).toBe(expectedKeys.length);
    expect(new Set(catalogPaths).size).toBe(expectedKeys.length);
    expect(catalogIds).toEqual(expect.arrayContaining([...expectedKeys]));

    for (const entry of AUDIO_CATALOG) {
      expect(entry.path.startsWith('./assets/audio/')).toBe(true);
      expect(entry.path.endsWith('.m4a')).toBe(true);
      expect(entry.path.includes('http://')).toBe(false);
      expect(entry.path.includes('https://')).toBe(false);
    }

    expect(getEssentialAudioEntries().every((e) => e.channel !== 'music')).toBe(true);
    expect(getDeferredAudioEntries().every((e) => e.channel === 'music')).toBe(true);
  });

  it('clamps volumes safely to [0, 1]', () => {
    expect(clampVolume(-0.5)).toBe(0);
    expect(clampVolume(1.8)).toBe(1);
    expect(clampVolume(Number.NaN)).toBe(0);
    expect(clampVolume(0.42)).toBe(0.42);
  });
});

describe('AudioService', () => {
  it('stays silent while locked and starts desired music automatically after unlock', async () => {
    const backend = new FakeAudioBackend({ unlocked: false });
    const settings = new SettingsService();
    const service = new AudioService({ backend, settingsService: settings });

    expect(service.getState().unlocked).toBe(false);
    expect(service.playSfx(AUDIO_ASSET_KEYS.SFX_UI_CLICK)).toBe(false);

    service.setMusicContext('menu');
    expect(backend.playedMusic).toHaveLength(0);
    expect(service.getState().desiredMusicContext).toBe('menu');

    const ok = await service.unlock();
    expect(ok).toBe(true);
    expect(service.getState().unlocked).toBe(true);
    expect(backend.playedMusic).toHaveLength(1);
    expect(backend.playedMusic[0]?.key).toBe(AUDIO_ASSET_KEYS.MUSIC_MENU);
    expect(backend.playedMusic[0]?.loop).toBe(true);

    expect(service.playSfx(AUDIO_ASSET_KEYS.SFX_UI_CLICK)).toBe(true);
    expect(backend.playedSfx).toHaveLength(1);

    service.dispose();
    settings.dispose();
  });

  it('handles blocked or throwing unlock attempts gracefully without crashing', async () => {
    const backend = new FakeAudioBackend({ unlocked: false });
    backend.unlockShouldThrow = true;
    const settings = new SettingsService();
    const service = new AudioService({ backend, settingsService: settings });

    const ok = await service.unlock();
    expect(ok).toBe(false);
    expect(service.getState().unlocked).toBe(false);
    expect(service.getState().unlockAttempted).toBe(true);
    expect(service.playSfx(AUDIO_ASSET_KEYS.SFX_BOTTLE_SELECT)).toBe(false);

    service.dispose();
    settings.dispose();
  });

  it('starts deferred music when notifyAssetsLoaded fires after unlock', () => {
    const backend = new FakeAudioBackend({ unlocked: true, loadAllAssets: false });
    backend.availableAssets.add(AUDIO_ASSET_KEYS.SFX_UI_CLICK);
    const settings = new SettingsService();
    const service = new AudioService({ backend, settingsService: settings });

    service.setMusicContext('menu');
    expect(backend.playedMusic).toHaveLength(0);

    backend.availableAssets.add(AUDIO_ASSET_KEYS.MUSIC_MENU);
    service.notifyAssetsLoaded();

    expect(backend.playedMusic).toHaveLength(1);
    expect(backend.playedMusic[0]?.key).toBe(AUDIO_ASSET_KEYS.MUSIC_MENU);

    service.dispose();
    settings.dispose();
  });

  it('does not restart the same music track across menu screens and fades across contexts', () => {
    const backend = new FakeAudioBackend({ unlocked: true });
    const settings = new SettingsService();
    const service = new AudioService({ backend, settingsService: settings });

    service.setMusicContext('menu');
    service.setMusicContext('menu');
    expect(backend.playedMusic).toHaveLength(1);

    service.setMusicContext('gameplay');
    expect(backend.playedMusic).toHaveLength(2);
    expect(backend.playedMusic[0]?.stopped).toBe(true);
    expect(
      backend.playedMusic[0]?.fadeCalls.some(
        (c) => c.target === 0 && c.durationMs === AUDIO_CONFIG.musicFadeDurationMs,
      ),
    ).toBe(true);
    expect(backend.playedMusic[1]?.key).toBe(AUDIO_ASSET_KEYS.MUSIC_GAMEPLAY);

    service.dispose();
    settings.dispose();
  });

  it('keeps Music and Sound Effects settings independent', () => {
    const backend = new FakeAudioBackend({ unlocked: true });
    const settings = new SettingsService();
    const service = new AudioService({ backend, settingsService: settings });

    service.setMusicContext('gameplay');
    expect(service.getState().activeMusicKey).toBe(AUDIO_ASSET_KEYS.MUSIC_GAMEPLAY);

    // Disable Music only -> music stops immediately, SFX still works
    settings.setMusicEnabled(false);
    expect(backend.playedMusic[0]?.stopped).toBe(true);
    expect(service.getState().activeMusicKey).toBeNull();
    expect(service.playSfx(AUDIO_ASSET_KEYS.SFX_BOTTLE_SELECT)).toBe(true);

    // Re-enable Music, disable SFX -> music restarts, SFX blocked
    settings.setMusicEnabled(true);
    settings.setSoundEffectsEnabled(false);
    expect(backend.playedMusic).toHaveLength(2);
    expect(service.playSfx(AUDIO_ASSET_KEYS.SFX_UI_CLICK)).toBe(false);

    service.dispose();
    settings.dispose();
  });

  it('respects platform audio permission without mutating player settings', () => {
    const backend = new FakeAudioBackend({ unlocked: true });
    const settings = new SettingsService();
    const platform = new BrowserGamePlatform({
      initialAudioEnabled: true,
      documentRef: null,
      storage: null,
    });
    const service = new AudioService({ backend, settingsService: settings, platform });

    service.setMusicContext('menu');
    expect(service.getState().activeMusicKey).toBe(AUDIO_ASSET_KEYS.MUSIC_MENU);

    platform.setAudioEnabled(false);
    expect(backend.globalMuted).toBe(true);
    expect(service.getState().platformAudioEnabled).toBe(false);
    expect(service.getState().activeMusicKey).toBeNull();
    expect(service.playSfx(AUDIO_ASSET_KEYS.SFX_UI_CLICK)).toBe(false);
    // Player settings remain untouched
    expect(settings.getSettings().musicEnabled).toBe(true);
    expect(settings.getSettings().soundEffectsEnabled).toBe(true);

    platform.setAudioEnabled(true);
    expect(backend.globalMuted).toBe(false);
    expect(service.getState().activeMusicKey).toBe(AUDIO_ASSET_KEYS.MUSIC_MENU);
    expect(service.playSfx(AUDIO_ASSET_KEYS.SFX_UI_CLICK)).toBe(true);

    service.dispose();
    settings.dispose();
    platform.dispose();
  });

  it('enforces cooldowns, max concurrency, and priority eviction cleanly', () => {
    let clock = 1000;
    const backend = new FakeAudioBackend({ unlocked: true });
    const settings = new SettingsService();
    const service = new AudioService({
      backend,
      settingsService: settings,
      now: () => clock,
    });

    // Cooldown suppresses duplicate UI clicks within 60ms
    expect(service.playSfx(AUDIO_ASSET_KEYS.SFX_UI_CLICK)).toBe(true);
    clock += 20;
    expect(service.playSfx(AUDIO_ASSET_KEYS.SFX_UI_CLICK)).toBe(false);
    clock += 50;
    expect(service.playSfx(AUDIO_ASSET_KEYS.SFX_UI_CLICK)).toBe(true);

    // Fill maxConcurrentSfx = 6 with lower-priority effects
    service.stopAllSfx();
    const keys: SfxAssetKey[] = [
      AUDIO_ASSET_KEYS.SFX_UI_CLICK,
      AUDIO_ASSET_KEYS.SFX_UI_BACK,
      AUDIO_ASSET_KEYS.SFX_BOTTLE_SELECT,
      AUDIO_ASSET_KEYS.SFX_BOTTLE_DESELECT,
      AUDIO_ASSET_KEYS.SFX_BOTTLE_SWAP,
      AUDIO_ASSET_KEYS.SFX_BOTTLE_LAND,
    ];
    for (const key of keys) {
      clock += 100;
      expect(service.playSfx(key)).toBe(true);
    }
    expect(service.getState().activeSfxCount).toBe(AUDIO_CONFIG.maxConcurrentSfx);

    // Higher priority Victory evicts lowest-priority active sound instead of being dropped
    clock += 100;
    expect(service.playSfx(AUDIO_ASSET_KEYS.SFX_VICTORY)).toBe(true);
    expect(service.getState().activeSfxCount).toBe(AUDIO_CONFIG.maxConcurrentSfx);

    service.dispose();
    settings.dispose();
  });

  it('handles missing or unknown SFX assets safely without throwing', () => {
    const backend = new FakeAudioBackend({ unlocked: true, loadAllAssets: false });
    const settings = new SettingsService();
    const service = new AudioService({ backend, settingsService: settings });

    expect(service.playSfx(AUDIO_ASSET_KEYS.SFX_BOTTLE_SELECT)).toBe(false);
    expect(service.playSfx('audio:sfx:non-existent' as SfxAssetKey)).toBe(false);

    service.dispose();
    expect(backend.disposed).toBe(true);
    expect(service.playSfx(AUDIO_ASSET_KEYS.SFX_UI_CLICK)).toBe(false);
    settings.dispose();
  });
});
