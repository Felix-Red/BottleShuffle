# Bottle Shuffle — Known Limitations (`v1.0.0-rc.1`)

Last updated: **2026-11-27**.

This document transparently lists all known technical limitations, accepted low-severity defects, testing environment boundaries, and external dependencies remaining in **Bottle Shuffle `1.0.0-rc.1`**.

---

## 1. Accepted Low-Severity Defects

| ID        | Severity | Description                                                                                                       | Rationale                                                                                                                    |
| :-------- | :------: | :---------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| `DEF-004` | P3 (Low) | `dist/assets/audio/ATTRIBUTION.md` (`3.2 KiB`) ships inside the packaged bundle alongside font `OFL.txt` notices. | Negligible size (`0.14%` of bundle); preserves transparent third-party/CC0 asset attribution directly alongside media files. |

Zero P0 (Critical), zero P1 (High), and zero open P2 (Medium) defects remain.

---

## 2. Bundle & Soft-Guideline Trade-Offs

- **Phaser Vendor Chunk Size (`vendor-phaser-*.js`):** The code-split Phaser 3.90 runtime chunk is **`1.14 MiB` raw (`306.52 KiB` gzipped)**. This is well below YouTube Playables' **`30 MiB` hard individual-file limit** (and total initial bundle is `1.68 MiB` raw / `435.91 KiB` gzipped vs `< 15 MiB` recommended), though the uncompressed Phaser file exceeds YouTube's `< 512 KiB` soft per-file recommendation. Retaining stock Phaser 3.90 avoids fragile custom engine forks while keeping total gzipped transfer under `1 MiB` (`999.02 KiB`).

---

## 3. Feature & Platform Scope Limitations

- **Language Support (`en` only):** All UI copy is currently English (`en`). `YouTubePlatform.getLanguage()` reads the host language and safely falls back to `'en'` without errors; non-English locales would require future localisation packs.
- **Single-Player Only:** No multiplayer, leaderboards, cloud score reporting (`ytgame.engagement.sendScore`), user accounts, or social sharing are implemented.
- **Haptics Disabled on YouTube Playables:** `YouTubeCapabilities` intentionally disables `navigator.vibrate` haptics (`hapticsSupported: false`) inside YouTube Playables because no verified official haptic SDK API exists; standalone mobile browsers may opt in via Settings.
- **Rewarded Ads Not Exposed in Production (`v1.0.0-rc.1`):** `RewardedAdService` is implemented and unit-tested for future opt-in assistance features, but `rewardedUiExposedInProduction` is `false` so zero unfinished reward buttons appear in production. Only natural campaign-transition interstitials (`ytgame.ads.requestInterstitialAd`) are active on YouTube Playables.

---

## 4. Accessibility Limitations

- **Canvas Screen-Reader Traversal:** Bottle Shuffle renders its UI inside a single HTML5 `<canvas>` managed by Phaser 3. While `#game-container` provides `role="application"`, `tabindex="0"`, and descriptive control guidance (`aria-label`), individual buttons, bottles, and modals inside the canvas are **not individually traversable by screen readers** (VoiceOver/NVDA/TalkBack) without a mirrored DOM accessibility layer.
- **Implemented Accessibility Supports:** All 10 bottles pair distinct colours with unique high-contrast geometric symbols (colour-blind safe), full desktop keyboard navigation (`ArrowLeft`/`ArrowRight`, `Enter`/`Space`, `Escape`), OS `prefers-reduced-motion` + in-game Reduced Motion toggle, and ≥48px touch targets. See `docs/ACCESSIBILITY_AUDIT.md`.

---

## 5. Testing Environment & Verification Gaps (Pre-Launch Blockers)

The following verification steps could **not** be executed inside the automated CLI workspace and must be completed prior to public launch:

1. **Official Hosted YouTube Playables SDK Test Suite:** Requires an interactive signed-in Google browser session pointing `https://developers.google.com/youtube/gaming/playables/test_suite` at the served release build.
2. **Cross-Browser Verification:** Playwright Firefox and WebKit projects are configured (`PLAYWRIGHT_ALL_BROWSERS=1`) but were not executed locally without those browser binaries installed.
3. **Physical Mobile Device & YouTube App WebView QA:** Physical iOS and Android devices (including YouTube app WebView containers, low-end mobile GPU/FPS profiling, 3G/4G throttled startup timing, and 30-minute thermal/memory soak) were not tested.
4. **Live Interstitial Ad Delivery:** Live ad fill, real host suspension during live video ads, Developer Portal monetisation toggles, advertiser-friendly review, and revenue-sharing eligibility require YouTube staging/partner access.
5. **Human Playtesting & Subjective Audio Review:** Automated tests verified solvability and audio decoding/routing, but live human playtesting with unfamiliar players and subjective volume/music-balance listening have not yet been performed.

---

## 6. External Owner & Portal Dependencies

- **`release/metadata/game-metadata.json` Placeholders:** `supportContact` (`[OWNER_SUPPORT_EMAIL_REQUIRED]`) and `privacyPolicyUrl` (`[OWNER_PRIVACY_POLICY_URL_REQUIRED]`) must be supplied by the owner, and provisional publisher label `CrowdArcade` must be confirmed.
- **Portal Promotional Pixel Slots:** Public YouTube Playables documentation specifies multi-aspect thumbnails without publishing fixed pixel tables outside the authenticated portal. Confirm exact slot pixel constraints inside the Developer Portal **Details** step (editable SVG masters are provided under `release/promotional/`).
- **Content / Age Rating & Certification:** Must be completed manually inside the YouTube Playables Developer Portal.
