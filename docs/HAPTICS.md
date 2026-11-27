# Haptic Feedback System (`docs/HAPTICS.md`)

Bottle Shuffle provides strictly optional, capability-aware tactile feedback designed to reinforce key gameplay moments without disturbing players on unsupported or desktop platforms.

## Architecture Overview

- **`src/platform/contracts/GamePlatform.ts`**: Exposes optional platform capability and execution hooks (`isVibrationSupported?()`, `vibrate?(pattern)`, `cancelVibration?()`).
- **`src/platform/browser/BrowserGamePlatform.ts`**: Isolates all `navigator.vibrate` access inside safe `try/catch` guards. Gameplay scenes and components never call `navigator.vibrate` directly.
- **`src/services/haptics/HapticPattern.ts` & `HapticConfig.ts`**: Defines restrained vibration events, millisecond patterns, cooldown (`45 ms`), and priorities.
- **`src/services/haptics/HapticBackend.ts` (`PlatformHapticBackend`)**: Adapter connecting `HapticService` to `GamePlatform`.
- **`src/services/haptics/HapticService.ts`**: Shared application-level service subscribed to `SettingsService.vibrationEnabled` and suspension reasons (`manual_pause`, `browser_hidden`, `platform_suspended`).

## Haptic Event Patterns

| Event            | Trigger                                  | Pattern           | Priority |
| ---------------- | ---------------------------------------- | ----------------- | -------- |
| `bottle_select`  | Player selects a bottle                  | `10 ms`           | 10       |
| `bottle_land`    | Swapped bottles land on the shelf        | `15 ms`           | 20       |
| `match_positive` | Swap increases match count (non-winning) | `20 ms`           | 30       |
| `victory`        | Puzzle or tutorial completed             | `[30, 40, 30] ms` | 100      |

- **Negative / unchanged match deltas** intentionally do not trigger vibration.
- **Victory priority**: `victory` overrides active weaker patterns even within the cooldown window so completion feedback is never masked by landing or match pulses.

## Capability & Settings Guarantees

- **Disabled by default**: `GameSettings.vibrationEnabled` defaults to `false`.
- **Unsupported devices**: When `isVibrationSupported()` returns `false` (such as desktop browsers or iOS Safari), the Vibration toggle in Settings displays `"Not supported on this device"` and `HapticService.trigger(...)` is a guaranteed silent no-op.
- **Immediate cancellation**: Turning Vibration off, pausing, hiding the browser tab, suspending the host platform, or disposing `HapticService` immediately invokes `cancelVibration()`.
- **Failure isolation**: Any host error or rejected vibration call is caught and returns `false` without disrupting gameplay.

## Deferred Work

- **Task 15 (Persistence)**: `vibrationEnabled` is stored in-memory via `SettingsService` until persistence is added in Task 15.
- **Physical Mobile Verification**: Automated unit/integration tests verify pattern dispatch, capability gating, cancellation, and error isolation with deterministic fake/adapter backends; subjective tactile testing on physical Android devices requires a physical handset.

---

## YouTube Playables Haptic Restrictions (Task 17)

- `YouTubePlatform` explicitly disables tactile vibration (`capabilities.haptics === false`, `isVibrationSupported() === false`, `vibrate() === false`) until platform compatibility and permission are established. Settings cleanly display vibration as unsupported while preserving player preference state. See [YOUTUBE_PLAYABLES.md](./YOUTUBE_PLAYABLES.md).
