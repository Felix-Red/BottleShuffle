# Production Home Screen — Bottle Shuffle

This document describes the visual identity, composition, view-state mapping, navigation architecture, responsive layouts, ambient motion, lifecycle integration, and testing strategy for **Bottle Shuffle's** production Home screen (`HomeScene`).

---

## 1. Objectives & Visual Direction

- Establish an unmistakable, playful casual puzzle identity using the established dark-purple ambient palette, warm gold & violet accents, rounded tactile controls, glossy bottle assets, and bundled **Fredoka** + **Nunito** typography.
- Give every player a single-interaction path into gameplay (`PLAY` for new players, `CONTINUE` for returning players, `PLAY AGAIN` for completed campaigns) with zero registration, zero splash delay, and zero development clutter.
- Keep all business rules inside `src/core/` and derive every label, count, and progress indicator dynamically from `ProgressionController` and `LevelCatalog`.

---

## 2. Screen Composition & Components (`src/game/components/home/`)

- **`GameLogo.ts`:** Original two-line dimensional wordmark (**BOTTLE** in warm gold with deep extrusion stroke; **SHUFFLE** in crisp white with violet-indigo stroke & shadow) rendered with local Fredoka typography, paired with configurable tagline (`Swap. Match. Master.`) and subtle publisher mark (`CROWDARCADE`). Plays a restrained one-shot entrance (`360ms` `Back.easeOut` settle; instant in reduced motion) without continuous bouncing.
- **`HomeHero.ts`:** Expressive 5-bottle hero composition reusing the real bundled glossy bottle textures (`red`, `blue`, `green`, `yellow`, `purple`) at staggered heights, subtle angles, scales, and depth planes with grounded shadows, radial ambient glow, subtle golden curved swap-arrow accent, and restrained sparkles. Decorative bottles respond to optional taps with a brief playful bounce + single sparkle without mutating puzzle or progression state, and gracefully degrade if a texture is unavailable.
- **`ContinueButton.ts`:** Dominant primary purple CTA button featuring the play icon, bold action label (`PLAY`, `CONTINUE`, or `PLAY AGAIN`), supporting level subtitle (`Level 1`, `Level N`, or `Choose a level`), hover/press/focus/disabled states, and duplicate-click cooldown.
- **Secondary Navigation:** Side-by-side tactile `OutlineButton` controls for **LEVELS** (`'grid'` icon) and **PRACTICE** (`'moves'` shuffle icon).
- **`CampaignProgressCard.ts`:** Reusable card displaying `CAMPAIGN PROGRESS`, `completed / total`, continuous `ProgressBar` (smoothly animating when returning home with newly solved levels), and `Chapter N · <Display Name>` (or `Campaign Complete!` in success green). Clicking the card also opens campaign level selection cleanly.
- **Dialogs & Navigation:**
  - `PracticeModeDialog.ts` — Modal with all 6 difficulty options (`Beginner (3)` .. `Expert (10)`), explicit check icon + colour selection state, and **Play Practice** launch.
  - **Levels Navigation (Task 10):** Clicking **LEVELS**, tapping `CampaignProgressCard`, or pressing **PLAY AGAIN** when the campaign is complete navigates directly to the dedicated chapter-based `LevelSelectionScene` via `SceneNavigator.openLevelSelection()`.
  - `TemporarySettingsDialog.ts` — Minimal modal exposing working session preferences (**Reduced Motion** `ToggleSwitch` wired to the shared `MotionPreferenceService`) and the **How to Play** button to manually replay the interactive tutorial.

---

## 3. Home View-State Model & Mapping (`src/game/home/`)

`mapHomeViewState()` (`HomeViewStateMapper.ts`) maps authoritative `CampaignProgress` + `LevelCatalog` into an immutable `HomeViewState`:

| Player State             | Primary Label | Supporting Text       | Primary Action                                                                               | Campaign Progress                                |
| ------------------------ | ------------- | --------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **New (`0` completed)**  | `PLAY`        | `Level 1`             | Launches `level-001` (with explicit `onBeforeFirstTimePlay` hook ready for Task 11 tutorial) | `0 / N` · `Chapter 1 · First Steps`              |
| **Returning (`1..N-1`)** | `CONTINUE`    | `Level <recommended>` | Launches first unlocked incomplete level from `ProgressionEngine` (never `lastPlayed + 1`)   | `X / N` · `Chapter K · <Name>`                   |
| **Completed (`N / N`)**  | `PLAY AGAIN`  | `Choose a level`      | Opens Levels selection (never launches nonexistent level `N+1`)                              | `N / N` · `Campaign Complete!` (success styling) |

Zero counts, chapter names, or level limits are hardcoded; appending levels to `LevelCatalog` updates the Home screen automatically.

---

## 4. Home Controller & Typed Scene Navigation

- **`HomeController` (`src/game/home/HomeController.ts`):** Pure TypeScript presentation controller coordinating `ProgressionController`, `SceneNavigator`, overlays (`none | practice | settings | error`), duplicate-navigation prevention, error recovery modals, keyboard focus, and suspension state.
- **`PhaserSceneNavigator` (`src/game/navigation/SceneNavigator.ts`):** Typed navigation between `HomeScene`, `LevelSelectionScene`, and `GameScene` (`launchCampaignLevel`, `launchPracticePuzzle`, `openLevelSelection`, `returnToHome`) with a `140ms` camera fade (instant in reduced motion), transition lock against rapid taps, and automatic lock release if a transition throws.

---

## 5. Responsive Landscape & Portrait Layouts (`src/game/layout/HomeLayout.ts`)

- **Landscape (`1920×1080`, `1280×720`, `844×390`):** Two-region composition — left column houses Logo, Tagline, dominant `ContinueButton`, side-by-side `LEVELS` + `PRACTICE`, and `CampaignProgressCard`; right column showcases the 5-bottle `HomeHero`; top-right holds the Settings `IconButton`. Compact landscape viewports (`844×390`) simplify and scale down decorative hero artwork first so essential controls stay comfortably tappable with zero overlap.
- **Portrait (`540×960`, `390×844`, `360×640`):** Top bar (publisher + Settings) -> Logo -> Tagline -> Hero -> Primary CTA -> `LEVELS` + `PRACTICE` -> `CampaignProgressCard`. Short portrait viewports (`360×640`) reduce hero height first to keep all controls non-overlapping and scroll-free.
- **Resize safety:** `HomeScene.applyResponsiveLayout()` repositions and resizes existing components and open dialogs in place without recreating textures or resetting campaign progression.

---

## 6. Ambient Motion, Lifecycle, Accessibility & Development Controls

- **Ambient Hero & Reduced Motion:** `HomeHero` drifts bottles with staggered phases (`2200ms` `Cubic.easeInOut`), pausing immediately on browser blur, platform suspend (`GamePlatform.onPause`), reduced-motion toggle, or scene shutdown. Shared `MotionPreferenceService` carries the Reduced Motion setting seamlessly between `HomeScene` and `GameScene`.
- **Non-blocking Entrance:** Staggered fade/logo reveal runs without disabling controls so returning players can tap `PLAY`/`CONTINUE` immediately.
- **Keyboard & Accessibility:** Arrow keys cycle visible gold focus rings across Primary, Levels, Practice, and Settings; `Enter`/`Space` activates; `Escape` dismisses open dialogs. Canvas screen-reader semantics remain a known Phaser `<canvas>` limitation.
- **Development Controls:** All dev controls, showcases (`?scene=showcase|assets|animations`), and dev home fixtures (`?homeFixture=returning|completed`, `?homeDialog=practice|levels|settings`) are gated strictly behind `import.meta.env.DEV` in `src/main.ts` and excluded from production builds.

---

## 7. Testing & Known Limitations

- **Unit & Integration Tests:** `tests/unit/home/HomeViewStateMapper.test.ts`, `HomeController.test.ts`, `HomeLayout.test.ts`, and `tests/integration/HomeNavigation.test.ts` verify all three player states, catalogue expansion, duplicate-tap blocking, error recovery, non-overlapping layouts across 6 viewport sizes, practice isolation, and shared motion preferences.
- **Known limitations:** Final Settings/Pause menu (Task 13), audio assets (Task 14), persistent save storage (Task 15 — including tutorial completion and scoring persistence), and YouTube Playables SDK integration remain deferred to subsequent tasks. First-time players pressing **PLAY** enter the interactive tutorial (Task 11) via `SceneNavigator` before launching Level 1, and `CampaignProgressCard` now displays live earned/max stars (`★ earned / max`) from `CampaignAchievementSummary` (Task 12).

## Task 13 Update — Shared Production Settings Overlay

`TemporarySettingsDialog` has been removed and replaced with the shared production `SettingsOverlay` backed by application-wide `SettingsService`. As of Task 14–15, audio/haptics are active and campaign progress, earned stars, settings, and tutorial status are restored via `SaveService` before `HomeScene` renders.

---

## Responsive Home Adaptation (Task 16)

- `HomeLayout` resolves canonical `LayoutProfile` tokens and 4-sided `SafeAreaInsets`, dynamically compressing logo, gaps, and hero artwork (`HomeHero.visible`) on ultra-compact viewports (`320×480`, `568×320`) so the primary CTA, Levels, Practice, Settings, and Campaign Progress card always remain visible and `>= 44px` tall. See [RESPONSIVE_LAYOUT.md](./RESPONSIVE_LAYOUT.md).
