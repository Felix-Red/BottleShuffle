# Audio System (`docs/AUDIO.md`)

Bottle Shuffle implements a lightweight, deterministic, Phaser-integrated audio architecture designed for casual mobile/desktop web play and YouTube Playables compatibility.

## Architecture Overview

- **`src/game/assets/AssetKeys.ts` (`AUDIO_ASSET_KEYS`)**: Single source of truth for all 15 audio asset identifiers.
- **`src/services/audio/AudioCatalog.ts`**: Central catalogue mapping every `AudioAssetKey` to its relative `./assets/audio/...m4a` path, `AudioChannel`, default volume, looping flag, cooldown, concurrency limit, priority, pitch range, and `loadTier` (`'essential'` for SFX, `'deferred'` for music).
- **`src/services/audio/AudioConfig.ts`**: Centralised gain hierarchy (`masterGain: 0.75`, `music: 0.25`, `ui: 0.35`, `gameplay: 0.55`, `feedback: 0.45`, `celebration: 0.60`), fade duration (`400 ms`), concurrency limits (`maxConcurrentSfx: 6`, `maxConcurrentSameSfx: 2`), and star/select pitch rates.
- **`src/services/audio/AudioBackend.ts` & `PhaserAudioBackend.ts`**: Minimal playback interface wrapping Phaser's sound manager with scene-independent music fade timers and safe missing-asset / no-audio error isolation.
- **`src/services/audio/AudioService.ts`**: Single application-level owner shared across all scenes, bound to `SettingsService` and `GamePlatform` audio permissions.
- **`src/services/audio/AudioFeedbackMapper.ts`**: Pure mapping from public swap deltas and star indices to audio/haptic cues (never inspects hidden secret sequences).
- **`src/game/audio/SceneAudioCoordinator.ts`**: Handles first-gesture autoplay unlock, one-time non-blocking deferred music loading, and seamless menu/gameplay music contexts.
- **`src/game/audio/GameplayAudioController.ts`**: Synchronises gameplay events, swap animation landing milestones, match deltas, victory flourishes, star reveals, first-time milestones, and pause/restart/exit cleanup.

## Loading Strategy

1. **Essential SFX (`BootScene.preload`)**: All 13 SFX (~77.2 KB total) are queued alongside visual assets in `BootScene` via `queueEssentialAudioAssets`.
2. **Deferred Music (`SceneAudioCoordinator.ensureDeferredMusicLoaded`)**: The 2 looping music tracks (~208.9 KB total) load asynchronously after `notifyFirstFrameReady()` so initial frame presentation is never blocked. Once loaded, `AudioService.notifyAssetsLoaded()` fades in the active scene's desired track automatically if audio is unlocked and enabled.

## Autoplay Unlocking

- Before the first user gesture, `AudioService` tracks `desiredMusicContext` without throwing or triggering premature playback errors.
- `SceneAudioCoordinator` listens once (capture phase) for `pointerdown`, `keydown`, or `touchstart` on `window`, invokes `audioService.unlock()`, and immediately unbinds listeners once unlocked.
- If a browser blocks unlock, gameplay remains 100% functional and silent until a valid gesture succeeds.

## Settings & Platform Permission Model

Effective audio playback always respects **both** layers independently:

- **Music plays iff:** `unlocked && platformAudioEnabled && settings.musicEnabled && !isFullySuspended && !isGameplayPaused`
- **SFX plays iff:** `unlocked && platformAudioEnabled && settings.soundEffectsEnabled && !isFullySuspended && (!isGameplayPaused || channel === 'ui')`

Platform audio mute (`platform.isAudioEnabled() === false` or `onAudioEnabledChange(false)`) silences all audio immediately **without mutating** the player's own Music or Sound Effects settings.

## Gameplay Event & Animation Synchronisation

- **Bottle Select**: Tactile soft glass tap (`bottle-select`) with subtle random pitch (`0.96–1.04`, strictly independent of correctness).
- **Bottle Deselect**: Quieter, slightly lower settle (`bottle-deselect`), fired **only** on player-initiated deselection — never on pause, restart, or scene shutdown.
- **Swap Start**: Soft airy swoosh (`bottle-swap`).
- **Swap Landing**: Single combined shelf/glass landing sound (`bottle-land`) triggered directly from `BottleSwapAnimation`'s landing milestone (`onLanding`), avoiding hardcoded timeouts.
- **Match Delta**: Fired on swap reconciliation when counters update (`match-increase` for `+delta`, restrained `match-decrease` for `-delta`, omitted by default for `0` delta to prevent fatigue during rapid swaps — configurable via `AUDIO_CONFIG.playMatchUnchangedSound`). Suppressed on the winning swap so `victory` takes precedence cleanly.
- **Victory & Star Reveals**: `victory` plays once per attempt. Each earned star triggers `star-reveal` via `StarRevealAnimator`'s `onStarRevealed` callback with escalating pitch rates (`1.0`, `1.12`, `1.26`). In Reduced Motion mode, a single concise `star-reveal` chime plays instead of a cascade.
- **Level Unlock / Milestone**: `level-unlock` plays once per newly unlocked batch or first-time progression milestone.

## Lifecycle & Concurrency Rules

- **Manual Pause (`manual_pause`)**: Pauses gameplay music and stops active gameplay/feedback SFX while keeping Pause and Settings UI clicks audible.
- **Browser Hidden / Platform Suspended (`browser_hidden`, `platform_suspended`)**: Immediately mutes backend, pauses music, and stops all active SFX. Resuming never replays missed SFX and respects overlapping pause reasons.
- **Concurrency & Cooldowns**: Enforces max 6 concurrent SFX, max 2 per sound, per-effect cooldowns (60 ms UI/select), and priority eviction so victory/celebration audio is never starved by rapid clicks.

## Development Inspection Tool

Run the dev server and open `?scene=audio` to launch the development-only `AudioShowcaseScene` (dynamically imported behind `import.meta.env.DEV` and excluded from production builds).

## Deferred Work

- **Task 15 (Persistence)**: Music and Sound Effects settings are automatically persisted via `SaveService` (`docs/PERSISTENCE.md`) and restored on startup before `AudioService` starts playback.
- **Task 17 (YouTube Playables SDK)**: `AudioService` already integrates with `GamePlatform.isAudioEnabled()` and `onAudioEnabledChange`; actual `ytgame.system.isAudioEnabled()` / `onAudioEnabledChange` integration will be wired in Task 17.

---

## YouTube Playables Host Audio Integration (Task 17)

- `YouTubePlatform.initialize()` reads initial host permission via `ytgame.system.isAudioEnabled()` (defaulting conservatively to silent on failure) and registers `ytgame.system.onAudioEnabledChange(callback)` once with unsubscribe disposal on shutdown.
- Host mute always overrides player Music and Sound Effects settings in `AudioService` without mutating persisted preferences. See [YOUTUBE_PLAYABLES.md](./YOUTUBE_PLAYABLES.md).

---

## Audio Authority Across Advertising Transitions (Task 18)

- `AudioService` preserves YouTube host mute (`ytgame.system.isAudioEnabled()` / `onAudioEnabledChange`) and host suspension (`onPause` / `onResume`) as strictly authoritative before, during, and after `ytgame.ads` requests.
- Completing an interstitial or rewarded ad request never automatically unmutes the game, and Bottle Shuffle never attempts to manipulate host advertisement audio. See [MONETIZATION.md](./MONETIZATION.md).
