# Third-Party Notices & Asset Attribution — Bottle Shuffle

Last audited: **2026-11-27** (Release `1.0.0-rc.1`).

This document records every third-party runtime dependency, font, and original asset shipped inside the Bottle Shuffle production package (`dist/` / `bottle-shuffle-1.0.0-rc.1.zip`).

---

## 1. Runtime JavaScript Dependencies

### Phaser (`^3.90.0`, resolved `3.90.0`)

- **Creator / Copyright:** Photon Storm Ltd. (Richard Davey and contributors)
- **Source:** https://github.com/phaserjs/phaser (`npm: phaser`)
- **Licence:** MIT License
- **Required Attribution:** MIT copyright and permission notice preserved.
- **Modifications:** None (bundled via Vite/Rolldown tree-shaking as `vendor-phaser-*.js`).
- **Distribution / Commercial Use:** Permitted without restriction under MIT.

```text
The MIT License (MIT)

Copyright (c) 2018-2025 Photon Storm Ltd.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

_(Transitive runtime packages included inside Phaser's dependency tree — `eventemitter3` (MIT) and `phaser3spectorjs` (MIT) — are likewise MIT-licensed.)_

---

## 2. Platform Runtime Script (External Authorised Dependency)

### YouTube Playables SDK v1

- **Provider:** Google LLC / YouTube
- **Source:** `https://www.youtube.com/game_api/v1` (loaded via `<script>` in `index.html`, never re-hosted or modified)
- **Terms:** Governed by the YouTube Developer Terms of Service and YouTube Playables SDK documentation.

---

## 3. Bundled Fonts

Full license texts are preserved inside the runtime distribution under `assets/fonts/fredoka/OFL.txt` and `assets/fonts/nunito/OFL.txt`, and credited in the in-game **Settings -> About Bottle Shuffle** dialog.

### Fredoka

- **Creator:** Milena Brandão / Hafontia
- **Files:** `public/assets/fonts/fredoka/fredoka-latin.woff2`, `fredoka-latin-ext.woff2`, `OFL.txt`
- **Licence:** SIL Open Font License 1.1 (OFL-1.1)
- **Modifications:** Subset WOFF2 weights (`600 700`, Latin + Latin-Ext); font names unchanged.
- **Distribution / Commercial Use:** Permitted under SIL OFL 1.1; font files may not be sold standalone and license notice is preserved in `assets/fonts/fredoka/OFL.txt`.

### Nunito

- **Creator:** Vernon Adams, Cyreal, Jacques Le Bailly
- **Files:** `public/assets/fonts/nunito/nunito-latin.woff2`, `nunito-latin-ext.woff2`, `OFL.txt`
- **Licence:** SIL Open Font License 1.1 (OFL-1.1)
- **Modifications:** Subset WOFF2 weights (`400 700`, Latin + Latin-Ext); font names unchanged.
- **Distribution / Commercial Use:** Permitted under SIL OFL 1.1; license notice is preserved in `assets/fonts/nunito/OFL.txt`.

---

## 4. Original Project Assets (No Third-Party Copyrighted Material)

| Category                                               | Source & Generator                                                                                                                       | Files                                                                                    | Licensing Notes                                                                                  |
| :----------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| **Bottle Artwork (10 bottles)**                        | Original procedural SVG vectors (`scripts/generate-assets.mjs` -> `artwork/bottles/*.svg` -> `scripts/rasterize-assets.mjs`)             | `public/assets/bottles/*.webp`                                                           | 100% original project assets; zero commercial trademarks or alcohol brand likenesses.            |
| **Environment, Effects & Icons**                       | Original procedural SVG vectors (`artwork/environment/`, `artwork/effects/`, `artwork/icons/lock.svg`, `public/favicon.svg`)             | `public/assets/environment/*`, `public/assets/effects/*`, `public/assets/icons/lock.svg` | 100% original project assets.                                                                    |
| **Background Music & Sound Effects (15 `.m4a` files)** | Original procedural synthesis (`scripts/generate-audio.mjs`)                                                                             | `public/assets/audio/music/*.m4a`, `public/assets/audio/sfx/*.m4a`                       | 100% original project audio; zero third-party samples. See `public/assets/audio/ATTRIBUTION.md`. |
| **Promotional Artwork & Screenshots**                  | Original SVG compositions reusing project bottle vectors (`scripts/generate-promotional-assets.mjs`) + real production build screenshots | `release/promotional/**` (excluded from runtime ZIP)                                     | 100% original project assets; zero YouTube logos or third-party branding.                        |

---

## 5. Development-Only Tooling (Excluded from Runtime Package)

Vite (MIT), Vitest & `@vitest/coverage-v8` (MIT), TypeScript (Apache-2.0), ESLint & `typescript-eslint` (MIT), Prettier (MIT), and Playwright (`@playwright/test`, Apache-2.0) are classified strictly under `devDependencies` and are never shipped in the runtime bundle.
