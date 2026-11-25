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

The game runs 100% client-side with locally bundled assets and zero runtime dependencies on external CDNs, backend servers, or databases.

## Architecture Overview

Bottle Shuffle follows pragmatic Clean Architecture and SOLID principles:

- **Core Game Logic (`src/core/`)** — Planned pure TypeScript domain logic (puzzle generation, swap validation, match counting, scoring, levels) completely independent of Phaser, browser APIs, and platform SDKs.
- **Game Presentation (`src/game/`)** — Phaser 3 scenes, visual components, animations, and input adapters. Currently contains `BootScene` and a temporary `HomeScene`.
- **Design System (`src/design-system/`)** — Centralised visual tokens (colours, typography) and future reusable UI primitives so design values are never hardcoded in scenes.
- **Platform Layer (`src/platform/`)** — `GamePlatform` contract and environment-specific adapters. Currently provides `BrowserGamePlatform` for local development, structured so a future `YouTubeGamePlatform` adapter can plug in cleanly.
- **Configuration (`src/config/`)** — Centralised Phaser game configuration, viewport metrics, and application metadata.

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed module responsibilities, dependency boundaries, and the full planned directory layout.

## Target Platform: YouTube Playables

The architecture is designed from the outset around the [YouTube Playables technical and certification requirements](https://developers.google.com/youtube/gaming/playables):

- Relative asset paths (`base: './'`) and locally bundled dependencies (no external CDN runtime calls).
- Landscape-first reference resolution (`1280 × 720`) with responsive `Phaser.Scale.RESIZE` scaling that adapts to both landscape and portrait viewports without forcing device orientation.
- Touch and mouse input support.
- Platform lifecycle hooks (`initialize`, `notifyFirstFrameReady`, `notifyGameReady`, `onPause`, `onResume`, `isAudioEnabled`, `onAudioEnabledChange`, `loadData`, `saveData`) abstracted behind `GamePlatform`.

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

| Command                | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| `npm run dev`          | Start the Vite development server                    |
| `npm run typecheck`    | Run strict TypeScript type checking (`tsc --noEmit`) |
| `npm run lint`         | Run ESLint across the codebase                       |
| `npm run lint:fix`     | Automatically fix fixable ESLint issues              |
| `npm run format`       | Format files with Prettier                           |
| `npm run format:check` | Verify formatting with Prettier                      |
| `npm test`             | Run unit tests once via Vitest                       |
| `npm run test:watch`   | Run Vitest in watch mode                             |
| `npm run build`        | Type-check and create a production build in `dist/`  |
| `npm run preview`      | Preview the production build locally                 |

### Production Build

```bash
npm run build
```

The compiled bundle is emitted to `dist/` using relative asset paths (`./assets/...`) suitable for static hosting and YouTube Playables packaging.

## Current Implementation Status

**Task 01 — Project Setup and Architecture** is complete:

- Vite + TypeScript + Phaser 3 + Vitest + ESLint + Prettier project setup.
- Centralised Phaser configuration (`1280 × 720` landscape-first reference, responsive canvas sizing, touch & mouse input).
- `GamePlatform` abstraction and `BrowserGamePlatform` local adapter.
- Minimal `BootScene` → temporary `HomeScene` rendering verification.
- Unit tests and architectural documentation.

Gameplay mechanics, final UI screens, assets, audio, and YouTube Playables SDK integration are tracked in [docs/PROGRESS.md](./docs/PROGRESS.md).
