# Animations and Interaction Feedback — Bottle Shuffle

This document describes the motion design principles, centralised motion tokens, curved bottle swap architecture, dynamic shadows, HUD feedback animations, particle budgets, completion celebration, cancellation guarantees, and reduced-motion policy implemented in **Bottle Shuffle**.

---

## 1. Animation Design Principles

Every motion in Bottle Shuffle communicates gameplay state rather than serving as pure decoration:

- **Anticipation:** Subtle vertical lift and travel-direction tilt prepare the player's eye before a bottle moves.
- **Curved movement & staging:** Opposing quadratic Bezier trajectories prevent colliding silhouettes and keep bottle identities clear during exchanges.
- **Squash and stretch:** Restrained relative landing deformation (`1.05 × 0.94`) gives bottles tactile weight without feeling rubbery.
- **Immediate tactile response:** Hover, press, selection, and button interactions respond immediately (`100–150ms`) while remaining interruptible.
- **No information leakage:** Animations and particles never reveal which individual bottles are correctly positioned during an incomplete puzzle.

---

## 2. Centralised Motion Tokens (`src/design-system/tokens/Motion.ts`)

### Semantic Durations (`MotionDurations`)

| Token                   | Duration | Usage                                           |
| ----------------------- | -------- | ----------------------------------------------- |
| `ButtonPress`           | `100ms`  | Button & bottle tactile press                   |
| `BottleHover`           | `120ms`  | Desktop pointer hover lift                      |
| `BottleSelection`       | `150ms`  | Selection lift & gold outline reveal            |
| `BottleDeselection`     | `150ms`  | Smooth return to resting pose                   |
| `SwapAnticipation`      | `70ms`   | Stage 1 pre-flight lift & tilt                  |
| `SwapMovement`          | `300ms`  | Stage 2 opposing Bezier flight                  |
| `BottleLanding`         | `100ms`  | Stage 3 slot snap, squash & settle              |
| `SwapTotal`             | `470ms`  | Complete normal-motion swap (`70 + 300 + 100`)  |
| `ReducedSwapMovement`   | `110ms`  | Direct reduced-motion swap glide                |
| `MatchCounterFeedback`  | `250ms`  | MatchCounter scale/nudge & segmented bar update |
| `MoveCounterFeedback`   | `150ms`  | Subtle move counter value pulse                 |
| `FloatingMatchFeedback` | `650ms`  | Aggregate delta badge float & fade              |
| `ModalEntrance`         | `250ms`  | Backdrop fade + `0.96 -> 1.00` scale ease-out   |
| `ModalDismissal`        | `150ms`  | Backdrop & modal fade-out                       |
| `VictoryCelebration`    | `800ms`  | Post-solve full-rack glow & confetti burst      |

### Easing Tokens (`MotionEasings`)

All easings map directly to built-in Phaser 3 `TweenManager` easing strings (no third-party animation library required):

- `Linear` (`Linear`)
- `EaseOut` (`Cubic.easeOut`)
- `EaseInOut` (`Cubic.easeInOut`)
- `SoftOvershoot` (`Back.easeOut`)
- `GentleSettle` (`Sine.easeOut`)

### Relative Motion Parameters (`MotionParams`)

Bottle elevation and arc heights are expressed as ratios of responsive bottle dimensions rather than fixed pixels:

- `hoverElevationRatio: 0.045`, `selectionElevationRatio: 0.095`, `swapAnticipationLiftRatio: 0.06`
- `maxBottleTiltRad: 0.11`, `swapAnticipationTiltRad: 0.075`
- `swapArcHeightRatio: 0.36` (clamped between `0.24` and `0.72` of bottle height)
- `pressScaleX: 1.03`, `pressScaleY: 0.95`
- `landingSquashX: 1.05`, `landingSquashY: 0.94`, `landingStretchX: 0.985`, `landingStretchY: 1.02`
- `selectionGlowOpacity: 0.65`, `selectionGlowPulseMin: 0.45`
- `particleLifetimeMs: 520`, `celebrationParticleLifetimeMs: 760`, `floatingFeedbackDisplacementPx: 26`

---

## 3. Bottle Interaction States

Implemented in `BottleSprite` (`src/game/components/bottles/BottleSprite.ts`) and `BottleSelectionIndicator`:

- **Hover (`120ms`):** Mouse-only subtle lift (`4.5%` of bottle height), `1.025×` emphasis, softer shadow, pointer cursor. Ignored on touch pointers and never overrides active selection or swap state.
- **Press (`100ms`):** Subtle tactile compression (`1.03 × 0.95` relative scale) on pointer down. Pointer release outside the bottle restores exact resting/selected pose without firing duplicate interactions.
- **Selection (`150ms`):** Lifts bottle (`9.5%` of bottle height), shows crisp high-contrast gold rounded outline + subtle glow (`BottleSelectionIndicator`), softens contact shadow, and plays a restrained low-frequency glow pulse (disabled in reduced motion).
- **Deselection (`150ms`):** Cancels glow pulse, fades out indicator, settles bottle and shadow smoothly back to resting state.

---

## 4. Multi-Stage Bottle Swap Animation (`src/game/animations/bottle/BottleSwapAnimation.ts`)

1. **Stage 1 — Anticipation (`70ms`):** Both bottles lift slightly and tilt gently toward their travel direction while shadows soften.
2. **Stage 2 — Curved Movement (`300ms`):** Both bottles travel simultaneously along opposing quadratic Bezier curves with `Cubic.easeInOut`, dynamic mid-flight tilt (`sin(pi * t)`), depth staging (upper-arc bottle above lower-arc bottle), grounded shadow tracking, and an optional bounded motion trail (`BottleMotionTrail`, max 5 translucent dots per bottle) on longer swaps.
3. **Stage 3 — Landing (`100ms`):** Both bottles snap to exact destination slot coordinates, zero out tilt, compress slightly (`1.05 × 0.94` relative to their responsive display dimensions), settle back to `(1, 1)`, and trigger subtle shadow landing compression.

---

## 5. Curved Movement Mathematics (`src/game/animations/utils/`)

- `evaluateQuadraticBezier(P0, P1, P2, t)` implements `B(t) = (1 - t)^2 P0 + 2(1 - t)t P1 + t^2 P2` with exact endpoint guarantees at `t = 0` and `t = 1`.
- `computeSwapTrajectories()` computes opposing control points:
  - **Same-row horizontal swaps:** Bottle A arcs upward (`-Y`), Bottle B takes a shallower opposing lower arc (`+Y`).
  - **Cross-row, vertical, and diagonal swaps (portrait 2×5):** Control points offset along opposing perpendicular unit normals `(-dy/d, dx/d)` and `(dy/d, -dx/d)` so bottles bow cleanly apart.
- Sublinear distance scaling (`Math.sqrt`) prevents distant first-to-last swaps from flying excessively high, and `SafeTrajectoryBounds` clamps control points strictly below the HUD and inside the viewport.

---

## 6. Dynamic Bottle Shadows (`src/game/components/bottles/BottleShadow.ts`)

- Reuses the single locally bundled `fx:bottle-shadow` texture (zero real-time blur shaders).
- During curved swaps, `BottleShadow.setGroundOffset()` tracks the linear chord between source and target slots while `setElevationImmediate()` scales and softens the shadow based on vertical elevation above the shelf.
- On landing, `playLandingCompression()` applies a brief grounded contact compression before settling back to base alpha and scale.

---

## 7. HUD Feedback, Particles & Completion Celebration

- **MatchCounter (`src/design-system/components/indicators/MatchCounter.ts`):** Positive changes trigger a `250ms` scale-pop (`1.10×`, `1.16×` on solve) and brief `Success` colour emphasis; negative changes trigger a restrained `3px` horizontal nudge and brief muted `Error` tint; unchanged counts skip number animation. The segmented bar always remains strictly aggregate.
- **FloatingMatchFeedback (`src/game/components/effects/FloatingMatchFeedback.ts`):** Displays signed aggregate labels (`+2 matches`, `+1 match`, `No change`, `-1 match`, `-2 matches`) in a pill near `MatchCounter` over `650ms` (scale pop -> gentle upward float -> hold -> fade). Replaces any active message immediately so HUD labels never pile up.
- **Move Counter (`StatCard.pulseValue()`):** Applies a subtle `150ms` `1.08×` scale pulse on move increments after a completed swap (never on selection/deselection).
- **Particle Budgets (`src/game/components/effects/ParticleBurst.ts`):**
  - Positive aggregate match feedback near `MatchCounter`: **8 particles**, `520ms` lifetime.
  - Victory celebration near `MatchCounter` / rack top: **22 particles**, `760ms` lifetime.
  - Zero continuous emitters; self-cleaning and cancellable; disabled in reduced motion.
- **Victory Celebration (`src/game/animations/celebration/VictoryCelebration.ts`):** Triggered only after the full puzzle is solved (`N/N`). Renders a full-rack success perimeter glow plus star/confetti burst and opens the completion overlay promptly (~440ms normal, ~80ms reduced motion).

---

## 8. Animation Coordination, Cancellation & Interruption

- `AnimationCoordinator` (`src/game/animations/core/AnimationCoordinator.ts`) is pure TypeScript with zero Phaser imports.
- Every swap receives a unique `transitionId` and `attemptEpoch`. Duplicate swap requests while active are rejected; completion callbacks execute at most once.
- **Interruption safety:** Pausing, resizing, rotating, platform suspension, restarting, returning Home, or destroying `GameScene` cancels active tweens/trails/particles, restores exact bottle scales/rotations/shadows, reconciles visual positions with the authoritative `GameEngine` sequence, and invalidates stale callbacks so previous attempts can never mutate a restarted puzzle.
- **Presentation sequence on valid swap:**
  1. Engine accepts swap synchronously (`GameEngine` remains Phaser-free).
  2. `GameplayController` locks input (`isSwapping = true`), holding displayed HUD counters at pre-swap values.
  3. `GameplayBoard` plays the 3-stage curved swap animation via `AnimationCoordinator`.
  4. On landing (or interruption reconciliation), board reconciles positions, `MatchCounter` & `MoveCounter` update with feedback, `FloatingMatchFeedback` (+ positive sparkle burst) displays, and input restores if gameplay is still active and no modal is open.
  5. If solved, `VictoryCelebration` plays and opens the completion modal.

---

## 9. Reduced-Motion Policy (`MotionPreferenceService` & `AnimationPolicy`)

- `MotionPreferenceService` (`src/services/MotionPreferenceService.ts`) observes `window.matchMedia('(prefers-reduced-motion: reduce)')` and supports programmatic overrides (`setOverride`) with automatic listener cleanup on `dispose()`.
- `resolveAnimationPolicy(reducedMotion, timeScale)` configures:
  - **Normal motion:** full lift, tilt, curved Bezier swaps (`470ms`), landing squash, long-swap trails, subtle selection pulse, particles, and modal scale transitions.
  - **Reduced motion:** removes lift, tilt, rotation, squash-and-stretch, motion trails, continuous pulses, and decorative particles; simplifies swaps to a short direct `110ms` glide and simplifies modal/feedback transitions while preserving every gameplay rule and visual indicator.

---

## 10. Responsive & Performance Notes

- All curve trajectories and elevation ratios compute dynamically from current responsive bottle dimensions and `GameplayLayout` safe bounds across landscape (`1280×720`, `1920×1080`, `844×390`) and portrait (`540×960`, `390×844`, `360×640`).
- Bottle sprites and textures are reused across swaps and resizes; particles and trail dots are strictly bounded and auto-destroyed on completion or cancellation.
- **Development Showcase:** Available in dev mode only at `http://localhost:5173/?scene=animations` (with optional `&reduced=1` and `&slow=1`), excluded from production bundles via `import.meta.env.DEV`.

---

## 11. Testing Strategy & Known Limitations

- **Unit tests (`tests/unit/animations/`):** Deterministic coverage for Bezier/curve math & bounds clamping, shadow/deformation/tilt math, normal vs reduced vs slow-motion policies, `MotionPreferenceService` listener lifecycle, `AnimationCoordinator` cancellation/epoch guards, and aggregate match-feedback labels.
- **Integration tests (`tests/integration/AnimationIntegration.test.ts`):** Verifies swap sequencing, rapid tap blocking, mid-swap pause/resize/suspend/restart/shutdown reconciliation, single completion per attempt, and reduced-motion rule parity.
- **Known limitations:** Interactive pointer/touch drag-and-drop swapping, audio SFX/music, final victory screen, scoring/star ratings, and persistent reduced-motion settings storage remain intentionally deferred to later tasks.
