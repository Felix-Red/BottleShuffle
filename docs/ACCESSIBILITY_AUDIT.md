# Bottle Shuffle — Accessibility Audit

- **Audit Date:** 2026-11-27
- **Disclaimer:** Automated checks and code review verify implemented accessibility features below, but do **not** constitute full WCAG 2.1 AA certification (which requires manual assistive-technology testing with VoiceOver, TalkBack, NVDA, and real users).

---

## 1. Verified Accessibility Features

| Area                                    | Verification Status     | Implementation Evidence                                                                                                                                                                                                                                                             |
| :-------------------------------------- | :---------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Colour-Blind Independence (Bottles)** | **Verified**            | Every one of the 10 bottles pairs a distinct colour palette with a high-contrast geometric label symbol (`circle`, `diamond`, `triangle`, `star`, `sparkle`, `hexagon`, `heart`, `square`, `ring`, `cross`) in `BottleCatalog.ts` and `artwork/bottles/*.svg`.                      |
| **Non-Colour Match Feedback**           | **Verified**            | `MatchCounter` and `GameplayHUD` convey match state via explicit numeric ratios (`3 / 6`), directional signed deltas (`+2`, `-1`, `No change`), and upward/downward icons — never colour alone.                                                                                     |
| **Reduced Motion Support**              | **Verified**            | OS `prefers-reduced-motion: reduce` is read by `MotionPreferenceService` and can never be weakened by an in-game toggle; players may also opt into Reduced Motion manually in `SettingsOverlay`. Verified in unit tests and Playwright `emulateMedia({ reducedMotion: 'reduce' })`. |
| **Minimum Touch Targets**               | **Verified**            | `Dimens.MinTouchTarget = 48` enforced in `BaseButton`, `BottleRackLayout` non-overlapping slot hit bounds, and responsive layout unit matrices across 14 viewports (`320×480` through `1920×1080`).                                                                                 |
| **Audio & Haptics Optionality**         | **Verified**            | Puzzles are 100% solvable with zero audio or vibration. Independent Music, SFX, and Vibration toggles exist in `SettingsOverlay`, and Vibration defaults to OFF.                                                                                                                    |
| **Keyboard Gameplay & Navigation**      | **Verified (Gameplay)** | `GameScene` (standard & tutorial modes) supports `ArrowLeft`/`ArrowRight` slot focus (with visible focus highlight in `BottleSprite`), `Enter`/`Space` selection/swap, and `Escape` to deselect, close dialogs, or toggle Pause.                                                    |
| **Browser Zoom & Viewport Policy**      | **Verified**            | `index.html` omits `maximum-scale=1.0, user-scalable=no`, never forces device orientation, and gives `#game-container` `role="application"`, `tabindex="0"`, and descriptive `aria-label`.                                                                                          |
| **Locked vs. Unlocked Clarity**         | **Verified**            | `LevelCard` communicates locked levels via both a padlock icon (`icon:lock`), muted surface contrast, and non-interactive state rather than opacity alone.                                                                                                                          |

---

## 2. Issues Identified & Resolved in Task 19

- **`DEF-002` (Resolved):** Added `tabindex="0"` and clearer control instructions to `#game-container`'s `aria-label` in `index.html` so keyboard focus lands predictably on the game application.

---

## 3. Known Canvas Accessibility Limitations (Honest Disclosure)

1. **Phaser Canvas Screen-Reader Opacity:** Because all UI buttons, HUD counters, overlays, and bottles are rendered inside a single HTML5 `<canvas>`, screen readers (VoiceOver, TalkBack, NVDA) cannot traverse individual in-canvas buttons or announce live match-counter updates automatically without a mirrored DOM accessibility layer.
2. **Menu Keyboard Tabbing:** Keyboard focus navigation is implemented inside `GameScene` (bottle slots and `Escape` overlays), whereas `HomeScene` and `LevelSelectionScene` buttons currently rely primarily on pointer/touch input.
3. **Manual Assistive-Tech QA Required:** Contrast spot checks on physical OLED/LCD screens under bright light and screen-reader usability testing remain manual pre-release steps.
