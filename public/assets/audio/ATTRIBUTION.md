# Audio Assets Attribution & Licensing

All audio assets in `public/assets/audio/` are **100% original works** procedurally synthesised offline for **Bottle Shuffle** using the repository generator script [`scripts/generate-audio.mjs`](../../../scripts/generate-audio.mjs) and encoded to MPEG-4 AAC (`.m4a`) via macOS CoreAudio (`afconvert`).

- **Author / Origin:** Original project assets created for Bottle Shuffle
- **Third-Party Copyrighted Material:** None (zero external downloads, zero royalty-encumbered samples, zero external CDN dependencies)
- **Redistribution & Commercial Use:** Unrestricted for Bottle Shuffle (including YouTube Playables packaging)

## Asset Inventory and Measured Sizes

### Background Music Loops (`public/assets/audio/music/`)

| File                 | Key                          | Duration                                  | Encoding            | Size                     |
| -------------------- | ---------------------------- | ----------------------------------------- | ------------------- | ------------------------ |
| `menu-theme.m4a`     | `audio:music:menu-theme`     | 10.435 s (4 bars @ 92 BPM, seamless loop) | AAC 112 kbps Stereo | 103,728 bytes (101.3 KB) |
| `gameplay-theme.m4a` | `audio:music:gameplay-theme` | 11.429 s (4 bars @ 84 BPM, seamless loop) | AAC 112 kbps Stereo | 110,222 bytes (107.6 KB) |

**Total Music:** 213,950 bytes (**208.9 KB**)

### Sound Effects (`public/assets/audio/sfx/`)

| File                    | Key                           | Duration | Encoding         | Size                 |
| ----------------------- | ----------------------------- | -------- | ---------------- | -------------------- |
| `ui-click.m4a`          | `audio:sfx:ui-click`          | 0.075 s  | AAC 96 kbps Mono | 4,763 bytes (4.7 KB) |
| `ui-back.m4a`           | `audio:sfx:ui-back`           | 0.090 s  | AAC 96 kbps Mono | 4,991 bytes (4.9 KB) |
| `bottle-select.m4a`     | `audio:sfx:bottle-select`     | 0.110 s  | AAC 96 kbps Mono | 4,832 bytes (4.7 KB) |
| `bottle-deselect.m4a`   | `audio:sfx:bottle-deselect`   | 0.095 s  | AAC 96 kbps Mono | 4,701 bytes (4.6 KB) |
| `bottle-swap.m4a`       | `audio:sfx:bottle-swap`       | 0.220 s  | AAC 96 kbps Mono | 7,527 bytes (7.4 KB) |
| `bottle-land.m4a`       | `audio:sfx:bottle-land`       | 0.125 s  | AAC 96 kbps Mono | 4,936 bytes (4.8 KB) |
| `match-increase.m4a`    | `audio:sfx:match-increase`    | 0.320 s  | AAC 96 kbps Mono | 5,954 bytes (5.8 KB) |
| `match-decrease.m4a`    | `audio:sfx:match-decrease`    | 0.250 s  | AAC 96 kbps Mono | 5,867 bytes (5.7 KB) |
| `match-unchanged.m4a`   | `audio:sfx:match-unchanged`   | 0.085 s  | AAC 96 kbps Mono | 4,557 bytes (4.5 KB) |
| `level-unlock.m4a`      | `audio:sfx:level-unlock`      | 0.420 s  | AAC 96 kbps Mono | 7,168 bytes (7.0 KB) |
| `star-reveal.m4a`       | `audio:sfx:star-reveal`       | 0.280 s  | AAC 96 kbps Mono | 5,649 bytes (5.5 KB) |
| `victory.m4a`           | `audio:sfx:victory`           | 0.960 s  | AAC 96 kbps Mono | 9,737 bytes (9.5 KB) |
| `tutorial-complete.m4a` | `audio:sfx:tutorial-complete` | 0.680 s  | AAC 96 kbps Mono | 8,419 bytes (8.2 KB) |

**Total SFX:** 79,101 bytes (**77.2 KB**)  
**Combined Audio Footprint:** 293,051 bytes (**286.2 KB**)
