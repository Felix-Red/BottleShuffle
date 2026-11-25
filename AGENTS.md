# AGENTS.md — Instructions for AI Coding Agents

This file defines persistent engineering standards and working rules for all AI coding agents contributing to **Bottle Shuffle**.

## 1. Inspect Before Editing

- Always inspect existing files, `docs/ARCHITECTURE.md`, and `docs/PROGRESS.md` before designing or implementing any change.
- Understand existing contracts, tokens, configuration helpers, and tests so new code aligns seamlessly with established patterns.

## 2. Preserve the Established Architecture

- Maintain strict separation of concerns and dependency boundaries defined in `docs/ARCHITECTURE.md`:
  - `src/core/` **must never** import `phaser`, browser globals (`window`, `document`, `localStorage`), or platform SDKs (`ytgame`).
  - `src/game/` orchestrates Phaser rendering, animations, and input; it delegates rules and state transitions to `src/core/` and platform concerns to `src/platform/contracts/GamePlatform.ts`.
  - `src/platform/` isolates browser and YouTube Playables runtime details behind `GamePlatform`.
- Prefer composition over inheritance. Avoid speculative abstractions, overengineering, and empty placeholder classes.

## 3. Follow SOLID Principles

- **Single Responsibility:** Keep modules, classes, and functions focused on one clear job.
- **Open/Closed:** Extend behaviour via clean interfaces and adapters (e.g. adding `YouTubeGamePlatform` without modifying scene logic).
- **Liskov Substitution:** Platform and service implementations must honour their contract invariants (including error handling and idempotency).
- **Interface Segregation:** Keep contracts minimal and cohesive; never add speculative methods for unverified external APIs.
- **Dependency Inversion:** Depend on interfaces (`GamePlatform`) rather than concrete implementations (`BrowserGamePlatform`).

## 4. Reuse Existing Components and Tokens

- Reuse existing design tokens (`src/design-system/tokens/`), layout utilities (`src/config/appConfig.ts`), and shared components rather than duplicating logic.
- **Never hardcode design values** (colours, typography families/sizes, spacing scales, magic dimensions) inside scenes or components when a design token or configuration constant belongs in `src/design-system/` or `src/config/`.

## 5. TypeScript and Dependency Discipline

- Keep TypeScript `strict` checks clean. **Never use `any`** unless explicitly justified and documented.
- Do not introduce unnecessary third-party dependencies (no UI frameworks, state libraries, external CDNs, or backend SDKs).
- Keep all runtime assets and dependencies locally bundled with relative production paths for YouTube Playables compatibility.
- Do not force device orientation; all screens and gameplay layouts must adapt cleanly to landscape and portrait viewports.

## 6. Testing and Verification

- Add focused unit tests in `tests/unit/` for all new core game logic, configuration helpers, services, and platform adapters.
- Before marking any task complete, actually run and verify:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run format:check`
  - `npm test`
  - `npm run build`
- Never claim a check, test, or build passed unless you executed it and observed it succeed.

## 7. Scope Control and Documentation

- Implement **only** the requirements defined in the active task. Never implement future features, unrelated refactors, or unapproved gameplay mechanics prematurely.
- Never invent unverified YouTube Playables SDK methods or behaviours; verify against official documentation before integrating.
- Document any assumptions, trade-offs, and technical limitations clearly in `docs/PROGRESS.md` and in your final summary.
