# Design System — Bottle Shuffle

This document defines the visual identity, design tokens, reusable Phaser 3 UI components, responsive rules, and accessibility considerations for **Bottle Shuffle**.

---

## 1. Visual Identity

Bottle Shuffle uses a playful, polished casual mobile puzzle aesthetic built around:

- **Deep twilight purple environment** (`#171126`) so vibrant bottles stand out as the unmistakable visual focal point.
- **Tactile rounded controls** with crisp corners, subtle drop shadows, top specular lips, and bottom-edge depth rims.
- **Approachable, legible typography** pairing **Fredoka** (display/headings) with **Nunito** (body/labels).
- **Snappy, purposeful motion** that acknowledges input without blocking interaction and honours reduced-motion preferences.
- **Lightweight rendering** using native Phaser 3 vector `Graphics` primitives and minimal tweens — zero expensive blur/postFX shaders for smooth 60 fps performance on lower-end mobile devices.

---

## 2. Colour Palette

All colour tokens and conversion utilities (`hexToNumber`, `hexToRgb`, `hexToRgba`, `lightenHex`, `darkenHex`, `mixHex`) are centralised in `src/design-system/tokens/Colors.ts`.

### Brand, Surface, Semantic & Text Colours

| Group    | Token                            | Hex                   | Usage                                                  |
| -------- | -------------------------------- | --------------------- | ------------------------------------------------------ |
| Brand    | `Colors.Brand.Primary`           | `#8B5CF6`             | Primary buttons, active highlights, focus/progress     |
| Brand    | `Colors.Brand.PrimaryLight`      | `#A78BFA`             | Hover states, borders, text actions                    |
| Brand    | `Colors.Brand.PrimaryDark`       | `#6D28D9`             | Primary pressed state and tactile bottom rim           |
| Brand    | `Colors.Brand.Secondary`         | `#FBBF24`             | Secondary buttons, stars, reward accents               |
| Brand    | `Colors.Brand.SecondaryDark`     | `#D97706`             | Secondary pressed state and tactile bottom rim         |
| Surface  | `Colors.Surface.Background`      | `#171126`             | Canvas and global screen backdrop                      |
| Surface  | `Colors.Surface.Surface`         | `#29203D`             | Cards, panels, headers, default tracks                 |
| Surface  | `Colors.Surface.ElevatedSurface` | `#35294D`             | Modals, toasts, elevated tiles, hover fills            |
| Surface  | `Colors.Surface.Border`          | `#4C405F`             | Dividers, outlines, subtle container borders           |
| Surface  | `Colors.Surface.Overlay`         | `#000000` (70% alpha) | Modal dimming scrim                                    |
| Semantic | `Colors.Semantic.Success`        | `#4ADE80`             | 100% match state, completed checkmarks, success toasts |
| Semantic | `Colors.Semantic.Warning`        | `#FBBF24`             | Cautionary prompts and warning toasts                  |
| Semantic | `Colors.Semantic.Error`          | `#F87171`             | Validation errors and error toasts                     |
| Semantic | `Colors.Semantic.Info`           | `#60A5FA`             | Neutral guidance and info toasts                       |
| Text     | `Colors.Text.Primary`            | `#F8FAFC`             | Headings, values, primary labels                       |
| Text     | `Colors.Text.Secondary`          | `#B4A8CC`             | Subtitles, supporting copy, metadata                   |
| Text     | `Colors.Text.Disabled`           | `#81788E`             | Disabled labels and locked icons                       |

### Bottle Colour Tokens (Accessible by Design)

Ten distinct bottle colour tokens are defined in `Colors.BottleTokens`, each paired with a unique `symbol` and `pattern` identifier so future bottle art can convey identity without relying solely on colour:

| Bottle | Hex       | Symbol     | Pattern    |
| ------ | --------- | ---------- | ---------- |
| Red    | `#EF4444` | `circle`   | `stripes`  |
| Blue   | `#3B82F6` | `triangle` | `waves`    |
| Green  | `#22C55E` | `square`   | `dots`     |
| Yellow | `#EAB308` | `star`     | `zigzag`   |
| Purple | `#A855F7` | `diamond`  | `diamonds` |
| Orange | `#F97316` | `plus`     | `chevron`  |
| Pink   | `#EC4899` | `heart`    | `hearts`   |
| Teal   | `#14B8A6` | `hexagon`  | `rings`    |
| Brown  | `#92400E` | `pentagon` | `grid`     |
| Silver | `#94A3B8` | `moon`     | `diagonal` |

---

## 3. Typography

- **Display typeface:** **Fredoka** (variable WOFF2 bundled locally in `public/assets/fonts/fredoka/` with `OFL.txt`).
- **Body typeface:** **Nunito** (variable WOFF2 bundled locally in `public/assets/fonts/nunito/` with `OFL.txt`).
- **Zero external CDN requests:** Fonts are loaded via relative `@font-face` rules in `index.html` and awaited with a short timeout in `src/main.ts` before Phaser starts.
- **Anti-clipping protection:** `createTextStyle()` automatically applies vertical canvas padding proportional to font size so ascenders and descenders never clip on canvas.

Reference scale at `1280 × 720` (`src/design-system/tokens/Typography.ts`):

| Token            | Font Family | Size (ref) | Weight |
| ---------------- | ----------- | ---------: | -----: |
| `Display`        | Fredoka     |         64 |    700 |
| `HeadlineLarge`  | Fredoka     |         48 |    700 |
| `HeadlineMedium` | Fredoka     |         36 |    700 |
| `HeadlineSmall`  | Fredoka     |         28 |    600 |
| `TitleLarge`     | Fredoka     |         24 |    700 |
| `TitleMedium`    | Nunito      |         20 |    600 |
| `BodyLarge`      | Nunito      |         20 |    400 |
| `BodyMedium`     | Nunito      |         18 |    400 |
| `BodySmall`      | Nunito      |         16 |    400 |
| `LabelLarge`     | Nunito      |         18 |    700 |
| `LabelMedium`    | Nunito      |         16 |    600 |
| `LabelSmall`     | Nunito      |         14 |    600 |

---

## 4. Dimensions, Shapes, Elevation & Motion

### Dimension Tokens (`src/design-system/tokens/Dimens.ts`)

- Numeric scale: `None (0)`, `Space2 (2)`, `Space4 (4)`, `Space6 (6)`, `Space8 (8)`, `Space10 (10)`, `Space12 (12)`, `Space16 (16)`, `Space20 (20)`, `Space24 (24)`, `Space32 (32)`, `Space40 (40)`, `Space48 (48)`, `Space56 (56)`, `Space64 (64)`, `Space72 (72)`, `Space80 (80)`, `Space96 (96)`.
- Semantic dimensions: `ScreenPadding (24)`, `ScreenPaddingCompact (16)`, `ComponentSpacing (16)`, `CardPadding (20)`, `ButtonHeightSmall (44)`, `ButtonHeightMedium (52)`, `ButtonHeightLarge (60)`, `IconSmall (18)`, `IconMedium (24)`, `IconLarge (32)`, `ModalPadding (24)`, `BorderThin (1)`, `BorderMedium (2)`, `BorderThick (3)`, `ProgressBarHeight (12)`, `ProgressBarHeightLarge (16)`, `HeaderHeight (68)`, `HeaderHeightCompact (56)`, `MinTouchTarget (48)`.

### Shapes (`src/design-system/tokens/Shapes.ts`)

- `None (0)`, `ExtraSmall (4)`, `Small (8)`, `Medium (12)`, `Large (16)`, `ExtraLarge (24)`, `Rounded (32)`.

### Elevation (`src/design-system/tokens/Elevation.ts`)

- Five lightweight elevation styles (`flat`, `low`, `medium`, `high`, `floating`) rendered by `drawElevatedSurface` using soft offset shadow rectangles, tactile bottom rims, and subtle top highlights.

### Motion (`src/design-system/tokens/Motion.ts`)

- Durations: `Instant (0ms)`, `Fast (100ms)`, `Short (150ms)`, `Normal (250ms)`, `Medium (350ms)`, `Long (500ms)`, `Celebration (800ms)`.
- Presets: `ButtonPress`, `ButtonRelease`, `Hover`, `Selection`, `FadeIn`, `FadeOut`, `ScaleIn`, `ModalEntrance`, `ModalDismissal`, `SuccessFeedback`, `ErrorFeedback`.
- Reduced motion: `resolveMotionDuration(duration, theme.reducedMotion)` collapses transitions to `0ms` when `GameTheme.reducedMotion` is enabled. Every animated component stops and disposes active tweens on `destroy()`.

---

## 5. Component Inventory & Usage Examples

All components are exported from `src/design-system/index.ts`:

| Category       | Components                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| **Buttons**    | `PrimaryButton`, `SecondaryButton`, `OutlineButton`, `TextButton`, `IconButton` (shared logic in `BaseButton`) |
| **Cards**      | `GameCard`, `LevelCard`, `StatCard`                                                                            |
| **Indicators** | `ProgressBar`, `MatchCounter`, `StarRating`, `LoadingIndicator`                                                |
| **Controls**   | `ToggleSwitch`                                                                                                 |
| **Overlays**   | `Modal`, `ConfirmDialog`, `Toast`                                                                              |
| **Layout**     | `GameHeader`, `GamePanel`                                                                                      |

### Example: Buttons

```ts
import { PrimaryButton, IconButton } from '../design-system';

const playButton = new PrimaryButton(this, {
  x: 640,
  y: 420,
  width: 240,
  label: 'Play',
  icon: 'play',
  onClick: () => {
    // handle play
  },
});

const settingsButton = new IconButton(this, {
  x: 1220,
  y: 44,
  icon: 'settings',
  variant: 'surface',
  onClick: () => {
    // open settings
  },
});
```

### Example: MatchCounter (External State Only)

```ts
import { MatchCounter } from '../design-system';

const counter = new MatchCounter(this, {
  x: 640,
  y: 120,
  width: 360,
  matched: 3,
  total: 10,
});

// Later, after an external puzzle engine evaluates a swap:
counter.setMatches(7, 10, true); // neutral progress styling
counter.setMatches(4, 10, true); // smoothly animates downward
counter.setMatches(10, 10, true); // transitions to success styling
```

### Example: ConfirmDialog & Toast

```ts
import { ConfirmDialog, Toast } from '../design-system';

const toast = new Toast(this, { position: 'bottom' });
const dialog = new ConfirmDialog(this, {
  title: 'Restart Level?',
  message: 'Your current moves will be reset.',
  confirmLabel: 'Restart',
  cancelLabel: 'Cancel',
  onConfirm: () => {
    toast.show({ message: 'Level restarted', variant: 'info' });
  },
});

dialog.open();
```

---

## 6. Responsive Design Principles

- **Viewport-driven breakpoints (`src/design-system/tokens/Breakpoints.ts`):** `resolveLayoutContext(width, height)` classifies layouts into `compact`, `medium`, and `expanded` breakpoints and `portrait`, `square`, `standard`, and `wide` aspect categories without relying on user-agent sniffing.
- **No forced orientation:** Both landscape (`1280 × 720` reference) and portrait (`720 × 1280` reference) are supported equally.
- **Preserved state on resize:** Components expose `.resize(...)` / `.setButtonSize(...)` / `.setCardSize(...)` methods and scenes retain state across `Phaser.Scale.Events.RESIZE` events.
- **Minimum touch targets:** `ensureMinimumTouchTarget()` guarantees hit zones remain at least `48px` even when scaled down.

---

## 7. Accessibility Considerations & Current Limitations

- **High-contrast palette:** Primary text (`#F8FAFC`) on Surface (`#29203D`) and Background (`#171126`) exceeds WCAG AAA contrast (>12:1). Secondary text (`#B4A8CC`) exceeds WCAG AA (>6.5:1).
- **Non-colour differentiation:** Bottle tokens include distinct `symbol` and `pattern` identifiers for future colour-blind-friendly rendering, and `MatchCounter` displays both numeric count (`3/10`) and segmented fill.
- **Reduced motion:** Supported across buttons, indicators, switches, modals, and toasts via `GameTheme.reducedMotion`.
- **Known canvas limitations:** Because Phaser renders to a single `<canvas>` element, native browser screen readers and DOM Tab focus traversal cannot inspect individual canvas controls automatically. Focus ring styling (`setFocused(true)`) is implemented on buttons so keyboard navigation and optional DOM accessibility overlays can be wired in a future pass.
