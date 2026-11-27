# Bottle Shuffle

Bottle Shuffle is a single-player logic and deduction puzzle game built with Phaser 3 and TypeScript, targeting distribution on **YouTube Playables** as well as desktop and mobile web browsers.

## Game Rules & Campaign Progression

- The player is presented with a row of differently coloured bottles arranged in a shuffled sequence.
- A hidden target sequence exists underneath the visible bottles.
- The player swaps bottles to deduce and match the hidden target order.
- After every swap, the game reports only the **total number of correctly positioned bottles** (for example `0/10`, `1/10`, `4/10`, `10/10`), never revealing which individual bottles are in the correct slot.
- The match count may increase, decrease, or stay the same after each swap.
- The puzzle is solved when every bottle occupies its target position.
- **Redesigned 50-Level Campaign (`v2.0.0`) across 6 Chapters & 4 Challenge Modes:**
  1. **Chapter 1 — First Steps (Levels 1–8):** Classic deduction scaling from `3` to `10` bottles (+1 bottle every level).
  2. **Chapter 2 — Beat the Clock (Levels 9–16):** Timed countdown challenges across `3–10` bottles (`30s`–`210s`).
  3. **Chapter 3 — Speed Mastery (Levels 17–24):** Tighter timed countdown challenges across `3–10` bottles (`20s`–`180s`).
  4. **Chapter 4 — Every Move Counts (Levels 25–32):** Move-limited challenges across `3–10` bottles (`6`–`45` moves).
  5. **Chapter 5 — Double Trouble (Levels 33–40):** Combined timer + move-limit challenges across `3–10` bottles.
  6. **Chapter 6 — Shuffle Master (Levels 41–50):** Ten unique high-intensity combined challenges (`6–10` bottles).

## Technology Stack

- **Game Engine:** Phaser 3
- **Language:** TypeScript (strict mode)
- **Bundler / Dev Server:** Vite
- **Unit Testing:** Vitest
- **Linting:** ESLint (`typescript-eslint` strict type-checked rules)
- **Formatting:** Prettier
- **Package Manager:** npm
- **Version Control:** Git

The game runs 100% client-side with locally bundled fonts and assets and zero runtime dependencies on external CDNs, backend servers, or databases.

## Architecture Overview

Bottle Shuffle follows pragmatic Clean Architecture and SOLID principles:

- **Core Game Logic (`src/core/`)** — Pure TypeScript puzzle generation engine, canonical `BottleId` models, Mulberry32 seeded PRNG, Fisher-Yates shuffle, permutation cycle swap-distance math, difficulty definitions, and centralised validation — zero Phaser or browser dependencies.
- **Game Presentation (`src/game/`)** — Phaser 3 scenes, visual assets (`AssetKeys`, `AssetManifest`, `BottleCatalog`), reusable bottle & environment components (`BottleSprite`, `BottleRack`, `HiddenSequenceRack`, `GameBackground`), and development-only showcase scenes.
- **Design System (`src/design-system/`)** — Centralised tokens (`Colors`, `Typography`, `Dimens`, `Shapes`, `Elevation`, `Motion`, `Breakpoints`), `GameTheme`, and reusable Phaser UI components.
- **Platform Layer (`src/platform/`)** — `GamePlatform` contract and environment-specific adapters (`BrowserGamePlatform` for local development, ready for future `YouTubeGamePlatform`).
- **Configuration (`src/config/`)** — Centralised Phaser game configuration, viewport metrics, and application metadata.

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md), [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md), [docs/ASSETS.md](./docs/ASSETS.md), and [docs/GAME_ENVIRONMENT.md](./docs/GAME_ENVIRONMENT.md) for full details.

## Target Platform: YouTube Playables

The architecture is designed from the outset around the [YouTube Playables technical and certification requirements](https://developers.google.com/youtube/gaming/playables):

- Relative asset paths (`base: './'`, `./assets/...`) and locally bundled fonts and textures (zero external CDN runtime calls).
- Landscape-first reference resolution (`1280 × 720`) with responsive `Phaser.Scale.RESIZE` scaling that adapts to both landscape and portrait viewports without forcing device orientation.
- Touch and mouse input support with ≥48px minimum interactive touch targets.
- Platform lifecycle hooks abstracted behind `GamePlatform`.

> **Note:** Official YouTube Playables SDK v1 (`https://www.youtube.com/game_api/v1`) is integrated behind `PlatformFactory` / `YouTubePlatform` / `YouTubeSaveStorage`, while standalone local development runs cleanly on `BrowserGamePlatform` / `BrowserSaveStorage`. See [docs/YOUTUBE_PLAYABLES.md](./docs/YOUTUBE_PLAYABLES.md) for Test Suite verification and publishing prerequisites.

## Getting Started

### Prerequisites

- Node.js (LTS recommended; verified on Node 26)
- npm

### Installation

```bash
npm install
```

### Development Commands

| Command                                                                        | Description                                                    |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `npm run dev`                                                                  | Start the Vite development server                              |
| `npm run typecheck`                                                            | Run strict TypeScript type checking (`tsc --noEmit`)           |
| `npm run lint`                                                                 | Run ESLint across the codebase                                 |
| `npm run lint:fix`                                                             | Automatically fix fixable ESLint issues                        |
| `npm run format`                                                               | Format files with Prettier                                     |
| `npm run format:check`                                                         | Verify formatting with Prettier                                |
| `npm run test`                                                                 | Run unit & integration tests once via Vitest                   |
| `npm run test:coverage`                                                        | Run Vitest suite with v8 line & branch coverage report         |
| `npm run test:e2e`                                                             | Run Playwright E2E suite against served production `dist/`     |
| `npm run test:stress`                                                          | Run 12,000-puzzle deterministic stress test                    |
| `npm run validate:campaign`                                                    | Validate & programmatically solve all 50 campaign levels       |
| `npm run validate:assets`                                                      | Verify all runtime assets (no missing/unused/duplicates)       |
| `npm run analyse:bundle`                                                       | Print detailed production `dist/` category & file breakdown    |
| `npm run verify:build`                                                         | Run YouTube Playables production bundle compliance audit       |
| `npm run validate:metadata`                                                    | Validate release metadata, version sync & promo PNGs           |
| `npm run verify:release`                                                       | Run release notice, changelog, dependency & dist audit         |
| `npm run package:release`                                                      | Package reproducible YouTube Playables ZIP, SHA-256 & manifest |
| `npm run smoke:release`                                                        | Verify SHA-256 & smoke-test extracted release ZIP over HTTP    |
| `npm run release:check`                                                        | Run full pre-packaging release verification gate               |
| `npm run qa`                                                                   | Run full deterministic QA gate (lint, types, tests, build)     |
| `npm run test:watch`                                                           | Run Vitest in watch mode                                       |
| `npm run build`                                                                | Type-check and create a production build in `dist/`            |
| `npm run build:youtube`                                                        | Build and audit the YouTube Playables bundle in `dist/`        |
| `npm run preview`                                                              | Preview the production build locally                           |
| `npm run puzzle:inspect -- --difficulty expert --seed demo-1`                  | Inspect a deterministically generated puzzle in development    |
| `npm run gameplay:simulate -- --difficulty normal --seed demo --reveal-target` | Simulate a full gameplay engine session in development         |
| `npm run levels:calibrate`                                                     | Generate and calibrate all 50 campaign levels in development   |

### Playing the Current Development Build

```bash
npm install
npm run dev
```

Open `http://localhost:5173/` in a desktop or mobile browser:

1. **Immediate Campaign Play & Onboarding:** On the production Home screen, press the primary **PLAY** (or **CONTINUE** / **PLAY AGAIN**) button. First-time players automatically experience the short interactive tutorial (with **Skip** always available) before launching directly into their requested campaign level.
2. **Level Selection & Chapters:** Press **LEVELS** (or tap the **Campaign Progress** card) to open the dedicated chapter-based Level Selection screen (`Chapter 1`–`Chapter 6`), browse chapter artwork and progress, preview unlocked or completed levels with personal best records, and launch or replay any unlocked puzzle.
3. **Practice Mode:** Press **PRACTICE** to pick any of the 6 difficulties (**Beginner 3** through **Expert 10**) and play standalone puzzles without affecting campaign progress.
4. **Settings & Replay Tutorial:** Press the top-right gear icon to toggle **Reduced Motion** across all scenes or select **How to Play** to replay the interactive tutorial at any time without affecting campaign progress.
5. **Gameplay Controls:** Tap or click two bottles to swap them (or use `ArrowLeft`/`ArrowRight` + `Enter`/`Space` on keyboard, and `Escape` to deselect, close dialogs, or pause).

In development mode only, you can also launch directly into the tutorial, level selection, a campaign level, or a seeded practice puzzle via:

```text
http://localhost:5173/?scene=tutorial
http://localhost:5173/?scene=levels
http://localhost:5173/?scene=game&level=level-001
http://localhost:5173/?scene=game&difficulty=expert&seed=demo-2026
```

### Development Showcases (Development Only)

While running `npm run dev`, three development-only inspection scenes are available (all gated behind `import.meta.env.DEV` dynamic imports and excluded from production builds):

#### Design System Component Showcase

```text
http://localhost:5173/?scene=showcase
```

Optional `?page=` values: `colors`, `typography`, `buttons`, `cards`, `indicators`, `overlays`.

#### Bottle Assets & Environment Showcase

```text
http://localhost:5173/?scene=assets
```

Optional `?page=` values:

- `/?scene=assets&page=environment` — Complete playing environment (background, 10 bottles on wooden shelf, concealed compartment, demo MatchCounter)
- `/?scene=assets&page=collection` — All 10 bottles with names, hex tokens, and accessibility symbols
- `/?scene=assets&page=states` — All 6 `BottleSprite` interaction states (`default`, `hovered`, `pressed`, `selected`, `swapping`, `disabled`)
- `/?scene=assets&page=rack` — Interactive `BottleRack` & `HiddenSequenceRack` switcher (`3`, `4`, `5`, `6`, `8`, `10` bottles) plus empty/highlighted slot toggles

#### Animation & Interaction Feedback Showcase

```text
http://localhost:5173/?scene=animations
```

Supports live previews for hover, press, select/deselect, adjacent/long-distance/cross-row curved swaps, dynamic shadows, match counter deltas (`+2`, `-1`, `No change`), move counter pulse, bounded sparkle/confetti bursts, victory celebration, modal transitions, plus **Reduced Motion** (`&reduced=1`) and **Slow Motion (0.35×)** (`&slow=1`) toggles.

#### Audio & Haptics Showcase

```text
http://localhost:5173/?scene=audio
```

Previews all 13 registered sound effects, Menu/Gameplay music loops, autoplay unlock status, independent Music/SFX/Vibration settings toggles, simulated platform audio mute, lifecycle suspension/resumption, and capability-aware haptic patterns.

#### Save-Data Diagnostics Showcase

```text
http://localhost:5173/?scene=save
```

Runs against an isolated in-memory storage adapter (never touching player `localStorage`) to inspect schema version, revisions, UTF-8 byte sizes, save status, and simulate valid fixtures, missing saves, corrupted JSON, invalid settings, unsupported future `v99` schemas, write failures, delayed writes, and resets.

#### Responsive Layout Diagnostics Showcase

```text
http://localhost:5173/?scene=responsive
```

Previews simulated viewport presets (`320×480` through `1280×720` or live container), bottle counts (`3..10`), simulated notch safe-area insets, cyan region bounds and green non-overlapping hit-area outlines, effective DPR capping, and reduced-motion state.

#### Advertising Diagnostics Showcase

```text
http://localhost:5173/?scene=ads
```

Runs against an isolated mock advertising provider and synthetic transition/progression context (never mutating real saves or campaign progress) to inspect platform capabilities, placement policy, `AdRequestState`, navigation transactions, and simulate eligible/ineligible interstitials, unavailability, SDK rejection, delayed responses, synthetic rewarded grants, and host pause/resume.

### Production Build

```bash
npm run build
```

The compiled bundle is emitted to `dist/` using relative asset paths (`./assets/...`) suitable for static hosting and YouTube Playables packaging.

## Current Implementation Status

- **Task 01 — Project Setup and Architecture:** Complete.
- **Task 02 — Design System and Reusable Components:** Complete.
- **Task 03 — Bottle Assets and Visual Environment:** Complete.
- **Task 04 — Puzzle Generation Engine:** Complete.
- **Task 05 — Bottle Swapping and Match Calculation:** Complete.
- **Task 06 — Gameplay Screen and Engine Integration:** Complete.
- **Task 07 — Animations and Interaction Feedback:** Complete.
- **Task 08 — Difficulty and Level Progression:** Complete.
- **Task 09 — Production Home Screen:** Complete.
- **Task 10 — Production Level Selection Screen:** Complete.
- **Task 11 — Interactive Tutorial and First-Time Player Experience:** Complete.
- **Task 12 — Victory Screen, Scoring and Achievement Feedback:** Complete.
- **Task 13 — Production Pause Menu and Centralised Settings:** Complete.
- **Task 14 — Sound Effects, Background Music and Haptic Feedback:** Complete.
- **Task 15 — Progress Persistence and Save-Data Architecture:** Complete.
- **Task 16 — Responsive Layouts and Cross-Device Optimisation:** Complete.
- **Task 17 — YouTube Playables SDK Integration:** Complete.
- **Task 18 — Advertising and Monetisation Integration:** Complete.
- **Task 19 — Comprehensive Testing, Quality Assurance and Performance Optimisation:** Complete.
- **Task 20 — Production Release, Packaging and YouTube Playables Certification Preparation (`v1.0.0-rc.1`):** Complete (release candidate generated and internally verified; pending manual official Playables Test Suite, owner metadata values, physical mobile QA, human playtesting, and Developer Portal submission).

See [docs/RELEASE_REPORT.md](./docs/RELEASE_REPORT.md), [docs/RELEASE_PROCESS.md](./docs/RELEASE_PROCESS.md), [docs/CERTIFICATION_CHECKLIST.md](./docs/CERTIFICATION_CHECKLIST.md), [docs/SUBMISSION_GUIDE.md](./docs/SUBMISSION_GUIDE.md), [docs/KNOWN_LIMITATIONS.md](./docs/KNOWN_LIMITATIONS.md), [CHANGELOG.md](./CHANGELOG.md), [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md), [docs/QA_REPORT.md](./docs/QA_REPORT.md), [docs/PERFORMANCE_REPORT.md](./docs/PERFORMANCE_REPORT.md), [docs/DEFECT_REGISTER.md](./docs/DEFECT_REGISTER.md), [docs/ACCESSIBILITY_AUDIT.md](./docs/ACCESSIBILITY_AUDIT.md), [docs/QA_TEST_PLAN.md](./docs/QA_TEST_PLAN.md), [docs/MONETIZATION.md](./docs/MONETIZATION.md), [docs/ADVERTISING_TEST_REPORT.md](./docs/ADVERTISING_TEST_REPORT.md), [docs/YOUTUBE_PLAYABLES.md](./docs/YOUTUBE_PLAYABLES.md), [docs/PLATFORM_COMPLIANCE.md](./docs/PLATFORM_COMPLIANCE.md), [docs/SDK_TEST_REPORT.md](./docs/SDK_TEST_REPORT.md), [docs/RESPONSIVE_LAYOUT.md](./docs/RESPONSIVE_LAYOUT.md), [docs/PERSISTENCE.md](./docs/PERSISTENCE.md), [docs/AUDIO.md](./docs/AUDIO.md), [docs/SCORING.md](./docs/SCORING.md), [docs/VICTORY_SCREEN.md](./docs/VICTORY_SCREEN.md), [docs/SETTINGS.md](./docs/SETTINGS.md), and [docs/GAMEPLAY_LIFECYCLE.md](./docs/GAMEPLAY_LIFECYCLE.md) for system documentation.
