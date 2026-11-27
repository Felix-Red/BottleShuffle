# Centralised Settings System

This document describes the application-wide settings architecture, immutable preferences model, capability detection, motion resolution, and shared `SettingsOverlay` introduced in **Task 13**.

---

## 1. Architecture & Ownership

Settings follow a strict unidirectional state flow with a single source of truth:

- **Pure Domain (`src/core/settings/`):** `GameSettings`, `MotionPreference`, `DEFAULT_GAME_SETTINGS`, `SettingsAction`, `SettingsReducer`, and `SettingsValidator`. Contains zero Phaser, DOM, or platform SDK dependencies.
- **Shared Runtime Service (`src/services/SettingsService.ts`):** One instance is created in `src/main.ts` and shared across `HomeScene` and `GameScene`. It holds the latest frozen `GameSettings` snapshot, validates transitions via `reduceGameSettings`, suppresses duplicate subscriber notifications when values do not change, and cleans up subscriptions on disposal.
- **Motion Resolution (`src/services/MotionPreferenceService.ts`):** Observes the browser's `(prefers-reduced-motion: reduce)` media query once at the application boundary and combines it with `SettingsService.getSettings().motionPreference`.
- **Presentation (`src/game/settings/` & `src/game/components/settings/`):** `SettingsController`, `SettingsViewStateMapper`, `SettingsLayout`, and `SettingsOverlay` provide the identical settings UI from both `HomeScene` and the gameplay pause menu.

---

## 2. Settings Model & Defaults

`GameSettings` is versioned (`schemaVersion: 1`), deeply frozen, and JSON-serialisable (`serializeGameSettings` / `deserializeGameSettings`):

| Field                 | Type                    | Default    | Notes                                                                                   |
| --------------------- | ----------------------- | ---------- | --------------------------------------------------------------------------------------- |
| `musicEnabled`        | `boolean`               | `true`     | Controls looping background music playback via `AudioService` (Task 14).                |
| `soundEffectsEnabled` | `boolean`               | `true`     | Controls UI, gameplay, feedback, and celebration SFX via `AudioService` (Task 14).      |
| `vibrationEnabled`    | `boolean`               | `false`    | Defaults off; controls optional capability-aware haptics via `HapticService` (Task 14). |
| `motionPreference`    | `'system' \| 'reduced'` | `'system'` | Follows OS preference or explicitly forces reduced motion.                              |
| `schemaVersion`       | `1`                     | `1`        | Supports future persistence migration in **Task 15**.                                   |

Tutorial completion history remains exclusively in `TutorialPreferenceService`; campaign progression remains exclusively in `ProgressionController`.

---

## 3. Motion Preference & Accessibility Invariant

```ts
effectiveReducedMotion = systemPrefersReducedMotion || motionPreference === 'reduced';
```

- When the operating system or browser enables `prefers-reduced-motion: reduce`, `effectiveReducedMotion` is **always `true`**. There is deliberately no `'full'` option that could silently weaken an OS accessibility preference.
- Changing reduced motion applies immediately across scenes without resetting the active gameplay attempt; active swaps are safely reconciled via `AnimationCoordinator`.
- Every `SettingsToggleRow` pairs `ToggleSwitch` with explicit `ON`/`OFF` labels and distinct switch positions so settings never rely on colour alone.

---

## 4. Platform Capability Handling (Vibration)

`GamePlatform.isVibrationSupported?()` (implemented in `BrowserGamePlatform` by checking `typeof navigator.vibrate === 'function'` without invoking `vibrate()`) determines whether tactile vibration may be available on the host device. When unsupported, the Vibration row displays disabled with the clear explanation `"Not supported on this device"` and rejects attempts to enable it.

---

## 5. Settings Navigation & Sub-Overlays

- **From `HomeScene`:** Opens `SettingsOverlay` (`origin: 'home'`) without initialising gameplay or touching progression. Closing returns to `HomeScene`.
- **From Pause Menu:** Opens `SettingsOverlay` (`origin: 'pause'`) over the paused gameplay overlay (`depth: 980 > 940`). Closing returns to `PauseOverlay` without auto-resuming gameplay.
- **How to Play:** From Home, launches manual tutorial replay directly. From paused gameplay, requests confirmation (`Open How to Play?`) before abandoning the incomplete attempt.
- **About Bottle Shuffle:** Displays the game description, actual build version (`0.1.0` from `APP_METADATA.version`), and font licensing attribution (`Fredoka & Nunito`, SIL OFL 1.1) with zero external links.
- **Reset Settings:** Requires confirmation and restores only player preferences; never erases campaign levels, stars, scores, or tutorial completion history.

---

## 6. Deferred Scope & Known Limitations

- **Persistence (Task 15):** Settings changes are automatically persisted via `SaveService` (`normal` 300 ms debounce) and restored on startup before music, sound effects, haptics, or decorative animations start. Standalone browser builds use `BrowserSaveStorage`; YouTube Playables cloud/host storage integration is deferred to Task 17.
- **YouTube Playables Host Audio (Task 17):** `AudioService` already enforces `GamePlatform.isAudioEnabled()` / `onAudioEnabledChange(...)` without mutating player settings; concrete `ytgame.system` integration is deferred to Task 17.
- **Canvas Accessibility:** Phaser renders controls inside a single `<canvas>`, so native DOM screen-reader traversal of individual rows is not available; keyboard navigation (`Escape` hierarchy, clear contrast, `ON`/`OFF` labels, `>= 44px` touch targets) is provided inside the canvas UI.

---

## Responsive Settings & Pause Adaptation (Task 16)

- `PauseLayout` and `SettingsLayout` consume `computeModalBounds` and 4-sided `SafeAreaInsets`.
- Compact landscape (`568×320`, `600×340`, `844×390`) fits all Settings rows cleanly in two columns with `>= 44px` touch targets; ultra-short portrait (`320×480`) automatically activates a bounded geometry-masked scroll body inside `SettingsOverlay` with Header and Done pinned and always reachable. See [RESPONSIVE_LAYOUT.md](./RESPONSIVE_LAYOUT.md).

---

## YouTube Playables Settings Behaviour (Task 17)

- In-game Music and Sound Effects settings remain independent of YouTube's host mute toggle (never persisted as host state and never overriding host mute).
- Vibration automatically shows as unsupported on YouTube Playables (`isVibrationSupported() === false`) without altering stored preference compatibility. See [YOUTUBE_PLAYABLES.md](./YOUTUBE_PLAYABLES.md).
