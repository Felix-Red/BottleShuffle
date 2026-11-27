# Visual Game Environment — Bottle Shuffle

This document defines the responsibilities, visual states, responsive layout rules, and integration boundaries for Bottle Shuffle's reusable visual game components.

---

## 1. Component Responsibilities

### `BottleSprite` (`src/game/components/bottles/BottleSprite.ts`)

- Renders one glossy bottle anchored at **bottom-centre** so its base rests cleanly on the shelf baseline.
- Composes `BottleShadow`, `BottleSelectionIndicator`, optional swapping motion trail dots, and the bottle texture resolved via `BottleCatalog`.
- Supports `bottleId`, position, responsive display dimensions (`setDisplayDimensions`), scale, visibility, opacity, enabled/disabled state, selection state, swapping visual state, texture updates (`setBottleId`), and pointer interaction callback (`onInteract`).
- Uses `ensureMinimumTouchTarget()` so touch targets remain comfortable across viewport sizes.
- Contains **no puzzle logic** and **no match-correctness visuals**.

### `BottleShadow` (`src/game/components/bottles/BottleShadow.ts`)

- Renders a lightweight pre-rendered elliptical contact shadow (`fx:bottle-shadow`) anchored at shelf level.
- Automatically scales and softens (`setElevation(liftPx)`) when a bottle lifts on hover, selection, or swapping.
- Uses zero real-time blur shaders.

### `BottleSelectionIndicator` (`src/game/components/bottles/BottleSelectionIndicator.ts`)

- Displays a surrounding rounded frame + soft glow (`fx:selection-glow`) tinted in gold (`Colors.Brand.Secondary`) or purple (`Colors.Brand.PrimaryLight`).
- **Never uses green** so selection cannot be mistaken for a correct bottle position.
- Supports subtle breathing pulse animation that cleanly disables when `GameTheme.reducedMotion` is enabled.

### `BottleRack` (`src/game/components/environment/BottleRack.ts`)

- Renders a polished wooden display shelf (`env:shelf` + `env:shelf-edge`) supporting **3 to 10 bottles** across landscape and portrait layouts.
- Delegates pure coordinate math to `calculateBottleRackLayout()` in `src/game/components/environment/bottleLayout.ts`.
- Provides deterministic slot world positions (`getSlotWorldPosition(slotIndex)`) and `BottleSlot` management without storing authoritative puzzle sequences.

### `BottleSlot` (`src/game/components/environment/BottleSlot.ts`)

- Lightweight visual guide representing a stable logical slot index (`0..N-1`).
- Supports `empty` vs `occupied` visual states and an optional neutral interaction highlight (purple tint, never green).
- Never stores or exposes any hidden target bottle identity.

### `HiddenSequenceRack` & `HiddenSequenceSlot` (`src/game/components/environment/HiddenSequenceRack.ts`, `HiddenSequenceSlot.ts`)

- Renders the recessed dark lower compartment (`env:hidden-compartment`) with `3..10` identical concealed slots (`env:hidden-slot` + `icon:lock`) and an optional `SECRET SEQUENCE` caption.
- During normal play, **every concealed slot looks identical** regardless of how many bottles are correctly positioned.
- Exposes `revealSequence(textureKeys)` and `concealAll()` as a clean visual interface for a future victory reveal sequence, without generating or storing puzzle answers internally.

### `GameBackground` (`src/game/components/environment/GameBackground.ts`)

- Renders the dark twilight purple ambient backdrop (`env:background`) with aspect-preserving cover scaling across landscape, portrait, and square viewports, keeping the central play area visually clean.

---

## 2. Visual Interaction States (`BottleSprite`)

| State      | Visual Treatment                                                                                       | Input Behaviour                                           |
| ---------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `default`  | Resting on shelf (`y = 0`, `scale = 1`), full soft contact shadow                                      | Interactive                                               |
| `hovered`  | Subtle upward lift (`-7px`), gentle `1.03×` scale, softer shadow                                       | Interactive (pointer cursor)                              |
| `pressed`  | Slight tactile downward press (`+2px`, `1.04× / 0.95×` squash)                                         | Captures press; fires on release                          |
| `selected` | Clear gold outline & halo (`BottleSelectionIndicator`), lifted `-16px`, `1.04×` scale, softened shadow | Interactive (toggle or swap target)                       |
| `swapping` | Elevated `-22px`, subtle tinted particle trail, softened shadow                                        | Configurable input blocking (`blockInput = true` default) |
| `disabled` | Reduced opacity (`45%`), muted tint, no lift or selection glow                                         | Non-interactive (blocks callbacks)                        |

All state transitions use `MotionDurations` / `MotionEasings`, honour `GameTheme.reducedMotion`, stop conflicting active tweens before starting new ones, and clean up tweens & listeners on `destroy()`.

---

## 3. Responsive Layout Behaviour (`bottleLayout.ts`)

Pure TypeScript calculations in `src/game/components/environment/bottleLayout.ts` ensure deterministic, unit-tested layouts independent of Phaser:

- **Landscape viewports:** Bottles render in **1 horizontal row** whenever available width keeps every bottle at or above the minimum interactive target width (`48px`).
- **Portrait & narrow viewports:** For 6–10 bottles (or whenever 1 row would drop below `minInteractionSize`), the rack automatically splits into **2 balanced rows** (e.g., 10 bottles → `5 + 5`, 8 bottles → `4 + 4`, 6 bottles → `3 + 3`).
- **Consistent slot ordering:** Logical indices `0..N-1` always flow **left-to-right, then top-to-bottom**, and resizing never mutates bottle identities or slot order.
- **Concealed rack alignment:** `HiddenSequenceRack` mirrors the visible rack's row count (`1` or `2`) and slot count (`3..10`).

---

## 4. Future Gameplay Integration Boundaries

When Task 04+ introduces the pure puzzle engine (`src/core/`):

1. `src/core/` will own the shuffled bottle sequence, hidden target sequence, swap validation, match count computation, and win detection using stable `BottleColorId` strings — **never importing Phaser or any visual component**.
2. A future gameplay scene in `src/game/scenes/` will coordinate:
   - Reading slot coordinates from `BottleRack.getSlotWorldPosition(slotIndex)`.
   - Positioning/tweening `BottleSprite` instances and toggling `setSelected` / `setSwapping`.
   - Feeding only the aggregate match count returned by `src/core/` into `MatchCounter.setMatches(matched, total)`.
   - Calling `HiddenSequenceRack.revealSequence(...)` only after the puzzle engine reports victory.
3. No visual component ever knows which individual bottles match the hidden sequence.

---

## 5. Accessibility Considerations

- Every bottle pairs a distinct colour with a bold white vector symbol on a high-contrast frosted label.
- Selected bottles combine upward elevation, subtle scale, and a gold outline frame (never relying on colour alone, and never using green).
- Interactive hit areas enforce ≥48px touch targets via `ensureMinimumTouchTarget()`.
- Reduced-motion settings disable continuous pulses and collapse pose transitions cleanly.
- **Known canvas limitation:** Individual Phaser canvas sprites are not natively exposed to browser screen readers or DOM Tab focus; `BottleCatalogEntry.accessibleLabel` provides structured labels ready for future keyboard navigation or DOM accessibility overlays.

---

## Responsive Bottle Rack & Non-Overlapping Hit Areas (Task 16)

- `src/game/layout/BottleRackLayout.ts` (consolidating `bottleLayout.ts`) evaluates 1-row vs 2-row visual sizing strictly within both width and height budgets, preserving the exact `1:2` bottle aspect ratio across all 14 viewports and `3–10` bottle counts.
- Visual bottle dimensions are separated from non-overlapping interactive hit rects (`hitWidth`, `hitHeight`, `hitRect`) wired into `BottleSprite` and `GameplayBoard`. See [RESPONSIVE_LAYOUT.md](./RESPONSIVE_LAYOUT.md).
