# Bottle Shuffle

Bottle Shuffle is a single-player logic and deduction puzzle game built with Phaser 3 and TypeScript, targeting distribution on **YouTube Playables** as well as desktop and mobile web browsers.

## Game Rules

- The player is presented with a row of differently coloured bottles arranged in a shuffled sequence.
- A hidden target sequence exists underneath the visible bottles.
- The player swaps bottles to deduce and match the hidden target order.
- After every swap, the game reports only the **total number of correctly positioned bottles** (for example `0/10`, `1/10`, `4/10`, `10/10`), never revealing which individual bottles are in the correct slot.
- The match count may increase, decrease, or stay the same after each swap.
- The puzzle is solved when every bottle occupies its target position.

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

> **Note:** Actual YouTube Playables SDK (`ytgame`) integration is intentionally deferred to a later task.

## Getting Started

### Prerequisites

- Node.js (LTS recommended; verified on Node 26)
- npm

### Installation

```bash
npm install
```

### Development Commands

| Command                                                                        | Description                                                 |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `npm run dev`                                                                  | Start the Vite development server                           |
| `npm run typecheck`                                                            | Run strict TypeScript type checking (`tsc --noEmit`)        |
| `npm run lint`                                                                 | Run ESLint across the codebase                              |
| `npm run lint:fix`                                                             | Automatically fix fixable ESLint issues                     |
| `npm run format`                                                               | Format files with Prettier                                  |
| `npm run format:check`                                                         | Verify formatting with Prettier                             |
| `npm test`                                                                     | Run unit tests once via Vitest                              |
| `npm run test:watch`                                                           | Run Vitest in watch mode                                    |
| `npm run build`                                                                | Type-check and create a production build in `dist/`         |
| `npm run preview`                                                              | Preview the production build locally                        |
| `npm run puzzle:inspect -- --difficulty expert --seed demo-1`                  | Inspect a deterministically generated puzzle in development |
| `npm run gameplay:simulate -- --difficulty normal --seed demo --reveal-target` | Simulate a full gameplay engine session in development      |

### Playing the Current Development Build

```bash
npm install
npm run dev
```

Open `http://localhost:5173/` in a desktop or mobile browser:

1. Choose a difficulty on the temporary home screen (**Beginner 3**, **Easy 4**, **Normal 5**, **Intermediate 6**, **Hard 8**, or **Expert 10** bottles) and press **Play Puzzle**.
2. Tap or click any bottle to select it, then tap a second bottle to swap their positions (or use `ArrowLeft`/`ArrowRight` + `Enter`/`Space` on keyboard, and `Escape` to deselect or pause).
3. Watch the aggregate **Correct Matches** counter update after each swap and deduce the hidden sequence until all bottles match.
4. Use the top-left **Pause** button or top-right **Restart** button (with confirmation) at any time, and resize the window freely between landscape and portrait orientations.

In development mode only, you can also launch directly into a seeded puzzle via:

```text
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

Audio, scoring, level progression, persistence, final screens, and YouTube Playables SDK integration are tracked in [docs/PROGRESS.md](./docs/PROGRESS.md).
