import {
  AUDIO_ASSET_KEYS,
  type MusicAssetKey,
  type SfxAssetKey,
} from '../../game/assets/AssetKeys';
import type { GamePlatform, Unsubscribe } from '../../platform/contracts/GamePlatform';
import type { SettingsService } from '../SettingsService';
import type { AudioBackend, BackendMusicHandle, BackendSoundHandle } from './AudioBackend';
import { getAudioCatalogEntry, getMusicAudioEntries } from './AudioCatalog';
import type { AudioChannel, AudioSuspensionReason, MusicContext } from './AudioChannel';
import { AUDIO_CONFIG, clampVolume, type AudioMixConfig } from './AudioConfig';
import type { AudioStateSnapshot } from './AudioState';

export interface PlaySfxOptions {
  readonly rate?: number;
  readonly volumeScale?: number;
  readonly ignoreCooldown?: boolean;
}

export interface AudioServiceOptions {
  readonly backend: AudioBackend;
  readonly settingsService: SettingsService;
  readonly platform?: GamePlatform;
  readonly config?: AudioMixConfig;
  readonly now?: () => number;
  readonly random?: () => number;
}

export type AudioStateListener = (snapshot: AudioStateSnapshot) => void;

const FULL_SUSPENSION_REASONS: readonly AudioSuspensionReason[] = [
  'browser_hidden',
  'platform_suspended',
];

function resolveTrackForContext(context: MusicContext): MusicAssetKey | null {
  if (context === 'menu') {
    return AUDIO_ASSET_KEYS.MUSIC_MENU;
  }
  if (context === 'gameplay') {
    return AUDIO_ASSET_KEYS.MUSIC_GAMEPLAY;
  }
  return null;
}

/**
 * Single application-level audio service shared across all scenes.
 * Owns sound-effect playback, seamless background music transitions, browser autoplay
 * unlocking, settings synchronisation, platform audio permission enforcement, concurrency
 * limits, cooldowns, and lifecycle suspension.
 */
export class AudioService {
  private readonly backend: AudioBackend;
  private readonly settingsService: SettingsService;
  private readonly config: AudioMixConfig;
  private readonly now: () => number;
  private readonly random: () => number;

  private readonly activeSfx = new Set<BackendSoundHandle>();
  private readonly lastPlayedAt = new Map<SfxAssetKey, number>();
  private readonly suspensionReasons = new Set<AudioSuspensionReason>();
  private readonly listeners = new Set<AudioStateListener>();

  private activeMusic: BackendMusicHandle | null = null;
  private fadingOutMusic = new Set<BackendMusicHandle>();
  private desiredMusicContext: MusicContext = 'none';
  private platformAudioEnabled: boolean;
  private unlocked: boolean;
  private unlockAttempted = false;
  private disposed = false;

  private readonly unsubscribeSettings: Unsubscribe;
  private readonly unsubscribePlatformAudio?: Unsubscribe;
  private readonly unsubscribeBackendUnlock: Unsubscribe;

  public constructor(options: AudioServiceOptions) {
    this.backend = options.backend;
    this.settingsService = options.settingsService;
    this.config = options.config ?? AUDIO_CONFIG;
    this.now = options.now ?? (() => Date.now());
    this.random = options.random ?? (() => Math.random());

    this.platformAudioEnabled = options.platform?.isAudioEnabled() ?? true;
    this.unlocked = this.backend.isUnlocked();

    this.unsubscribeSettings = this.settingsService.subscribe(() => {
      this.reconcilePlaybackState(true);
    });

    if (options.platform !== undefined) {
      this.unsubscribePlatformAudio = options.platform.onAudioEnabledChange((enabled) => {
        this.setPlatformAudioEnabled(enabled);
      });
    }

    this.unsubscribeBackendUnlock = this.backend.onUnlocked(() => {
      if (this.disposed) {
        return;
      }
      if (!this.unlocked) {
        this.unlocked = true;
        this.reconcilePlaybackState(false);
        this.notify();
      }
    });

    this.syncGlobalMute();
  }

  public getState(): AudioStateSnapshot {
    const settings = this.settingsService.getSettings();
    const reasons = Object.freeze([...this.suspensionReasons]);
    const isFullySuspended = this.isFullySuspended();
    const isGameplayPaused = this.suspensionReasons.has('manual_pause');
    const loadedMusicReady = getMusicAudioEntries().some((entry) =>
      this.backend.hasAsset(entry.id),
    );

    return Object.freeze({
      unlocked: this.unlocked,
      unlockAttempted: this.unlockAttempted,
      musicEnabled: settings.musicEnabled,
      soundEffectsEnabled: settings.soundEffectsEnabled,
      platformAudioEnabled: this.platformAudioEnabled,
      activeSuspensionReasons: reasons,
      isFullySuspended,
      isGameplayPaused,
      desiredMusicContext: this.desiredMusicContext,
      activeMusicKey: this.activeMusic?.key ?? null,
      isMusicPaused: this.activeMusic?.isPaused() ?? false,
      activeSfxCount: this.activeSfx.size,
      loadedMusicReady,
    });
  }

  public subscribe(listener: AudioStateListener): Unsubscribe {
    if (this.disposed) {
      return () => undefined;
    }
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Attempts to unlock browser/WebAudio playback on a valid user gesture.
   * Safe to call repeatedly; fails gracefully without throwing if blocked.
   */
  public async unlock(): Promise<boolean> {
    if (this.disposed) {
      return false;
    }
    this.unlockAttempted = true;

    if (this.unlocked || this.backend.isUnlocked()) {
      this.unlocked = true;
      this.reconcilePlaybackState(false);
      this.notify();
      return true;
    }

    let ok: boolean;
    try {
      ok = await this.backend.unlock();
    } catch {
      ok = false;
    }

    if (this.isDisposed()) {
      return false;
    }

    this.unlocked = ok || this.backend.isUnlocked();
    if (this.unlocked) {
      this.reconcilePlaybackState(false);
    }
    this.notify();
    return this.unlocked;
  }

  /**
   * Called once deferred audio assets finish loading so desired background music
   * begins smoothly if unlocked and permitted.
   */
  public notifyAssetsLoaded(): void {
    if (this.disposed) {
      return;
    }
    this.reconcilePlaybackState(false);
    this.notify();
  }

  /**
   * Updates platform-level audio permission (e.g. YouTube host mute or showcase simulation)
   * without mutating the player's own Music or Sound Effects settings.
   */
  public setPlatformAudioEnabled(enabled: boolean): void {
    if (this.disposed || this.platformAudioEnabled === enabled) {
      return;
    }
    this.platformAudioEnabled = enabled;
    this.reconcilePlaybackState(true);
    this.notify();
  }

  public suspend(reason: AudioSuspensionReason): void {
    if (this.disposed || this.suspensionReasons.has(reason)) {
      return;
    }
    this.suspensionReasons.add(reason);

    if (this.isFullySuspended()) {
      this.stopAllSfx();
      this.activeMusic?.pause();
      this.stopAllFadingOutMusic();
    } else if (reason === 'manual_pause') {
      this.stopGameplayAudio();
      this.activeMusic?.pause();
    }

    this.syncGlobalMute();
    this.notify();
  }

  public resume(reason: AudioSuspensionReason): void {
    if (this.disposed || !this.suspensionReasons.has(reason)) {
      return;
    }
    this.suspensionReasons.delete(reason);
    this.reconcilePlaybackState(false);
    this.notify();
  }

  public setMusicContext(
    context: MusicContext,
    options: { readonly immediate?: boolean } = {},
  ): void {
    if (this.disposed) {
      return;
    }

    const immediate = options.immediate ?? false;
    this.desiredMusicContext = context;
    const targetTrack = resolveTrackForContext(context);

    if (targetTrack === null) {
      this.stopMusic(immediate);
      return;
    }

    if (!this.canPlayMusic()) {
      // Remember desired track for later unlock/resume/re-enable.
      if (this.activeMusic !== null && this.activeMusic.key !== targetTrack) {
        this.activeMusic.stop();
        this.activeMusic = null;
      }
      this.notify();
      return;
    }

    if (this.activeMusic !== null && this.activeMusic.key === targetTrack) {
      if (this.activeMusic.isPaused()) {
        this.activeMusic.resume();
      }
      this.activeMusic.setVolume(this.computeMusicVolume(targetTrack));
      this.notify();
      return;
    }

    this.transitionMusicTo(targetTrack, immediate);
  }

  public stopMusic(immediate = false): void {
    if (this.disposed) {
      return;
    }
    this.desiredMusicContext = 'none';
    if (this.activeMusic === null) {
      this.stopAllFadingOutMusic();
      this.notify();
      return;
    }

    const current = this.activeMusic;
    this.activeMusic = null;

    if (immediate || this.config.musicFadeDurationMs <= 0) {
      current.stop();
      this.stopAllFadingOutMusic();
    } else {
      this.fadeOutAndStop(current, this.config.musicFadeDurationMs);
    }
    this.notify();
  }

  public playSfx(key: SfxAssetKey, options: PlaySfxOptions = {}): boolean {
    if (this.disposed) {
      return false;
    }

    const entry = getAudioCatalogEntry(key);
    if (entry === undefined || entry.channel === 'music') {
      return false;
    }

    if (!this.canPlaySfxOnChannel(entry.channel)) {
      return false;
    }

    if (!this.backend.hasAsset(key)) {
      return false;
    }

    const currentTime = this.now();
    if (!options.ignoreCooldown && entry.cooldownMs > 0) {
      const last = this.lastPlayedAt.get(key);
      if (last !== undefined && currentTime - last < entry.cooldownMs) {
        return false;
      }
    }

    if (!this.enforceConcurrencyBudget(key, entry.maxConcurrent, entry.priority)) {
      return false;
    }

    const volume = this.computeSfxVolume(entry.channel, entry.defaultVolume, options.volumeScale);
    if (volume <= 0) {
      return false;
    }

    const rate = this.resolvePlaybackRate(entry.pitchRange, options.rate);

    let handleRef: BackendSoundHandle | null = null;
    handleRef = this.backend.playSfx({
      key,
      channel: entry.channel,
      volume,
      rate,
      priority: entry.priority,
      onEnded: () => {
        if (handleRef !== null && this.activeSfx.delete(handleRef)) {
          this.notify();
        }
      },
    });

    if (handleRef === null) {
      return false;
    }

    this.lastPlayedAt.set(key, currentTime);
    if (handleRef.isPlaying()) {
      this.activeSfx.add(handleRef);
    }
    this.notify();
    return true;
  }

  public stopChannel(channel: AudioChannel): void {
    if (this.disposed) {
      return;
    }
    if (channel === 'music') {
      this.stopMusic(true);
      return;
    }

    let changed = false;
    for (const handle of [...this.activeSfx]) {
      if (handle.channel === channel) {
        this.activeSfx.delete(handle);
        handle.stop();
        changed = true;
      }
    }
    if (changed) {
      this.notify();
    }
  }

  /** Stops active gameplay, feedback, and celebration SFX (preserving menu/pause UI clicks). */
  public stopGameplayAudio(): void {
    if (this.disposed) {
      return;
    }
    let changed = false;
    for (const handle of [...this.activeSfx]) {
      if (handle.channel !== 'ui') {
        this.activeSfx.delete(handle);
        handle.stop();
        changed = true;
      }
    }
    if (changed) {
      this.notify();
    }
  }

  public stopAllSfx(): void {
    if (this.disposed) {
      return;
    }
    if (this.activeSfx.size === 0) {
      return;
    }
    for (const handle of [...this.activeSfx]) {
      this.activeSfx.delete(handle);
      handle.stop();
    }
    this.notify();
  }

  public computeEffectiveGain(channel: AudioChannel, defaultVolume: number): number {
    const channelGain = this.config.channelGains[channel];
    return clampVolume(this.config.masterGain * channelGain * defaultVolume);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.unsubscribeSettings();
    this.unsubscribePlatformAudio?.();
    this.unsubscribeBackendUnlock();

    for (const handle of [...this.activeSfx]) {
      handle.stop();
    }
    this.activeSfx.clear();

    this.activeMusic?.stop();
    this.activeMusic = null;
    this.stopAllFadingOutMusic();

    this.suspensionReasons.clear();
    this.lastPlayedAt.clear();
    this.listeners.clear();
    this.backend.dispose();
  }

  private isDisposed(): boolean {
    return this.disposed;
  }

  private isFullySuspended(): boolean {
    return FULL_SUSPENSION_REASONS.some((reason) => this.suspensionReasons.has(reason));
  }

  private canPlayMusic(): boolean {
    if (this.disposed || !this.unlocked || !this.platformAudioEnabled) {
      return false;
    }
    if (this.isFullySuspended() || this.suspensionReasons.has('manual_pause')) {
      return false;
    }
    return this.settingsService.getSettings().musicEnabled;
  }

  private canPlaySfxOnChannel(channel: AudioChannel): boolean {
    if (this.disposed || !this.unlocked || !this.platformAudioEnabled) {
      return false;
    }
    if (this.isFullySuspended()) {
      return false;
    }
    if (!this.settingsService.getSettings().soundEffectsEnabled) {
      return false;
    }
    // During manual pause, allow Pause/Settings UI feedback while keeping gameplay SFX silent.
    if (this.suspensionReasons.has('manual_pause') && channel !== 'ui') {
      return false;
    }
    return true;
  }

  private reconcilePlaybackState(immediateDisable: boolean): void {
    if (this.disposed) {
      return;
    }

    const settings = this.settingsService.getSettings();
    this.syncGlobalMute();

    if (!this.platformAudioEnabled || !settings.soundEffectsEnabled || this.isFullySuspended()) {
      this.stopAllSfx();
    } else if (this.suspensionReasons.has('manual_pause')) {
      this.stopGameplayAudio();
    }

    const targetTrack = resolveTrackForContext(this.desiredMusicContext);
    if (!this.canPlayMusic() || targetTrack === null) {
      if (this.activeMusic !== null) {
        if (!this.platformAudioEnabled || !settings.musicEnabled || immediateDisable) {
          this.activeMusic.stop();
          this.activeMusic = null;
          this.stopAllFadingOutMusic();
        } else {
          this.activeMusic.pause();
        }
      }
      return;
    }

    if (this.activeMusic !== null && this.activeMusic.key === targetTrack) {
      if (this.activeMusic.isPaused()) {
        this.activeMusic.resume();
      }
      const targetVol = this.computeMusicVolume(targetTrack);
      this.activeMusic.fadeTo(targetVol, Math.min(250, this.config.musicFadeDurationMs));
      return;
    }

    this.transitionMusicTo(targetTrack, false);
  }

  private transitionMusicTo(targetTrack: MusicAssetKey, immediate: boolean): void {
    const previous = this.activeMusic;
    this.activeMusic = null;

    if (previous !== null) {
      if (immediate || this.config.musicFadeDurationMs <= 0) {
        previous.stop();
      } else {
        this.fadeOutAndStop(previous, this.config.musicFadeDurationMs);
      }
    }

    if (!this.backend.hasAsset(targetTrack)) {
      this.notify();
      return;
    }

    const targetVolume = this.computeMusicVolume(targetTrack);
    const fadeDuration = immediate ? 0 : this.config.musicFadeDurationMs;
    const initialVolume = fadeDuration > 0 ? 0 : targetVolume;

    const handle = this.backend.playMusic({
      key: targetTrack,
      volume: initialVolume,
      loop: true,
    });

    if (handle === null) {
      this.notify();
      return;
    }

    this.activeMusic = handle;
    if (fadeDuration > 0) {
      handle.fadeTo(targetVolume, fadeDuration);
    }
    this.notify();
  }

  private fadeOutAndStop(handle: BackendMusicHandle, durationMs: number): void {
    this.fadingOutMusic.add(handle);
    handle.fadeTo(0, durationMs, () => {
      this.fadingOutMusic.delete(handle);
      handle.stop();
    });
  }

  private stopAllFadingOutMusic(): void {
    for (const handle of [...this.fadingOutMusic]) {
      this.fadingOutMusic.delete(handle);
      handle.stop();
    }
  }

  private syncGlobalMute(): void {
    const shouldMute = !this.platformAudioEnabled || this.isFullySuspended();
    this.backend.setGlobalMute(shouldMute);
  }

  private computeMusicVolume(key: MusicAssetKey): number {
    const entry = getAudioCatalogEntry(key);
    const defaultVol = entry?.defaultVolume ?? 1;
    return this.computeEffectiveGain('music', defaultVol);
  }

  private computeSfxVolume(
    channel: AudioChannel,
    defaultVolume: number,
    volumeScale?: number,
  ): number {
    const scale = volumeScale !== undefined && Number.isFinite(volumeScale) ? volumeScale : 1;
    return clampVolume(this.computeEffectiveGain(channel, defaultVolume) * scale);
  }

  private resolvePlaybackRate(
    pitchRange: { readonly min: number; readonly max: number } | undefined,
    explicitRate: number | undefined,
  ): number {
    if (explicitRate !== undefined && Number.isFinite(explicitRate)) {
      return Math.max(0.5, Math.min(2, explicitRate));
    }
    if (pitchRange !== undefined) {
      const u = Math.max(0, Math.min(1, this.random()));
      return pitchRange.min + (pitchRange.max - pitchRange.min) * u;
    }
    return 1;
  }

  private enforceConcurrencyBudget(
    key: SfxAssetKey,
    perSoundLimit: number,
    incomingPriority: number,
  ): boolean {
    const effectiveSameLimit = Math.min(perSoundLimit, this.config.maxConcurrentSameSfx);
    const sameHandles: BackendSoundHandle[] = [];
    for (const handle of this.activeSfx) {
      if (handle.key === key) {
        sameHandles.push(handle);
      }
    }

    if (sameHandles.length >= effectiveSameLimit) {
      const oldestSame = sameHandles[0];
      if (oldestSame !== undefined) {
        this.activeSfx.delete(oldestSame);
        oldestSame.stop();
      }
    }

    if (this.activeSfx.size < this.config.maxConcurrentSfx) {
      return true;
    }

    // Evict lowest-priority active sound if incoming sound has equal or higher priority.
    let victim: BackendSoundHandle | null = null;
    for (const handle of this.activeSfx) {
      if (victim === null || handle.priority < victim.priority) {
        victim = handle;
      }
    }

    if (victim !== null && incomingPriority >= victim.priority) {
      this.activeSfx.delete(victim);
      victim.stop();
      return true;
    }

    return false;
  }

  private notify(): void {
    if (this.listeners.size === 0) {
      return;
    }
    const snapshot = this.getState();
    for (const listener of [...this.listeners]) {
      listener(snapshot);
    }
  }
}
