# Bottle Shuffle — Quality Assurance Test Plan

- **Version:** Task 19 (2026-11-27)
- **Scope:** Core puzzle engine, match calculator, state machine, 50-level campaign, scoring & stars, tutorial, settings, lifecycle, audio & haptics, persistence, responsive layouts, YouTube Playables SDK v1, advertising infrastructure, production build integrity, performance, memory, and accessibility.

---

## 1. Testing Architecture & Layers

| Layer                               | Tooling                                                                                         | Execution Target                                                                | Deterministic?                              |
| :---------------------------------- | :---------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------ | :------------------------------------------ |
| **Static Analysis**                 | TypeScript (`strict`), ESLint (`strictTypeChecked`), Prettier                                   | `src/`, `tests/`, `scripts/`                                                    | Yes                                         |
| **Unit & Property Tests**           | Vitest (`v5.1.2`) + `@vitest/coverage-v8`                                                       | `tests/unit/**/*.test.ts`                                                       | Yes (seeded RNG & fake clocks)              |
| **Integration Tests**               | Vitest + `MockYouTubeSdk` / `MockAdvertisingProvider` / `InMemorySaveStorage`                   | `tests/integration/**/*.test.ts`                                                | Yes                                         |
| **Campaign & Stress Verification**  | `scripts/validate-campaign.mjs`, `scripts/stress-test-puzzles.mjs`                              | 50 campaign levels + 12,000 generated puzzles                                   | Yes (fixed seeds)                           |
| **Long-Session Stability**          | `tests/performance/LongSessionAndAdversarialStability.test.ts`                                  | 120 repeated scene/lifecycle/ad/save cycles                                     | Yes                                         |
| **Production Build & Asset Audit**  | `scripts/verify-youtube-build.mjs`, `scripts/validate-assets.mjs`, `scripts/analyse-bundle.mjs` | `dist/` & `public/assets/`                                                      | Yes                                         |
| **End-to-End Browser Suite**        | Playwright (`@playwright/test`)                                                                 | Served `dist/` via `vite preview` (Desktop `1280×720` & Mobile Touch `390×844`) | Yes (fixture saves + route-intercepted SDK) |
| **Manual Playtesting & Partner QA** | Hosted YouTube Playables SDK Test Suite + physical devices + unfamiliar playtesters             | Staging release                                                                 | Manual gate                                 |

---

## 2. Test Environments & Fixtures

- **Automated Local & CI Environment:** Node.js 22/26, Vitest (Node environment), Playwright Chromium (local macOS Google Chrome 158; CI Chromium on `ubuntu-latest`), serving the actual Vite production build (`dist/`).
- **Deterministic Fixtures:**
  - `tests/helpers/MockYouTubeSdk.ts` — implements verified `ytgame` v1 (`game`, `system`, `health`, `ads`) without touching production builds.
  - `tests/helpers/MockAdvertisingProvider.ts` — deterministic interstitial/rewarded outcomes & host lifecycle interleaving.
  - `tests/helpers/InMemorySaveStorage.ts` — isolated storage adapter for persistence failure/corruption/migration testing.
  - Playwright E2E save fixtures (`0`, `49` completed levels, muted settings, completed tutorial).

---

## 3. Human Playtesting Checklist (Pre-Release Manual Gate)

Before public launch, conduct sessions with 5–10 unfamiliar players across desktop, iOS, and Android devices and evaluate:

1. **Objective Clarity:** Does the player understand within 10 seconds that they are matching a hidden bottle order using only the total match count?
2. **Tutorial Sufficiency:** Does the guided tutorial clearly demonstrate selection, swapping, and match counter deltas without confusion?
3. **Match Counter Comprehension:** Do players understand why a swap can increase, decrease, or leave the match counter unchanged?
4. **Bottle Symbol Distinguishability:** Are all 10 bottle colours and geometric label symbols immediately distinguishable, including for colour-vision-deficient players?
5. **Touch Responsiveness:** Do bottle taps, drag/selection states, and button targets feel crisp on mobile touchscreens (especially 8–10 bottle two-row racks)?
6. **Difficulty Pacing:** Does progression from 3-bottle Beginner levels through 10-bottle Expert levels feel fair and engaging?
7. **Victory Feedback:** Do stars, score count-up, personal bests, and chapter unlocks feel rewarding?
8. **Advertising Disruption:** Are interstitial transitions between campaign levels non-intrusive, with zero mid-puzzle interruptions?
9. **Progression Clarity:** Is it obvious how to resume the campaign, replay earlier levels, or start Practice mode?
10. **Settings Discoverability:** Can players easily mute music/SFX, toggle reduced motion, or replay How to Play?

_(No human playtesting was executed during this automated QA pass; observations must be recorded from actual player sessions.)_

---

## 4. Release Acceptance Criteria

- Zero open P0 (Critical) or P1 (High) defects.
- `npm run qa` exits `0` (format, lint, typecheck, unit/integration suite, 50-level campaign solver validation, YouTube production build audit, asset validation, bundle analysis).
- `npm run test:e2e` passes cleanly against `dist/`.
- `npm audit` reports zero unresolved critical/high runtime vulnerabilities.
- Official hosted YouTube Playables SDK Test Suite and physical-device QA checklists completed and signed off manually prior to Developer Portal release submission.
