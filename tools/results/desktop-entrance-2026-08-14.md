# The desktop entrance, measured at `dev = acb8ffe` — Sunna, 2026-08-14

Evidence for the design card in the family repo:
`commons/design/2026-08-14_the-desktop-entrance-card.md`. This file is the
game-side record — readings only, no verdicts. The verdict instrument is
`tools/actends.mjs` (observed red; 0/24 at the wide shapes at this ref).

**How to re-run everything here:**

```
CHROME=/usr/bin/chromium node tools/actends.mjs --shapes 1200x730,1366x768 --shots SHOTS_DIR
CHROME=/usr/bin/chromium node tools/results/desktop-entrance-probe.mjs
```

Headless Chromium, one Linux box, source tree via `tools/serve.mjs`; the
shipped bundle agrees (`--dist`, `dist/AshenSpire.html sha256 d3c78be7c0733965…`,
same 1678 px miss). Deterministic across all 12 seeds — the entrance geometry
is act-level (door row 1, boss row 13), not seed-level.

## The miss

| shape | uiZoom | camera zoom at entrance | `data-entrance-miss` (local px) | actends (device px) |
|---|---|---|---|---|
| 1200x730 | 1.00 | 2.000 (Fit at the ladder ceiling) | 1679 | 1678 |
| 1366x768 | 1.05 | 2.000 | 1676 | 1760 |

History of the same number, same instrument: dev pre-#126 **161 px** →
`89ec151` **392 px** → the zoom flip at dev's old pitch **1342 px** → head
(pitch 58 → ROW_H 79 merged) **1678 px**. Every phone improvement raised it;
nothing gates it.

## The geometry

Act 1: 585 x 1136 SVG units (aspect 0.51 — portrait). Ends span 997.7 units
vertical (door bottom row 1 → boss top row 13), 1069.3 with the act title.
Port `.map-scroll` at 1200x730: **1190 x 549 local px** (aspect 2.17 —
landscape). The map is phone-shaped; the desktop port is its transpose.

Zoom → what 549 local px of port delivers (node = 2 x 21.3 x z):

| zoom | node px | rows visible of 14 | boss on screen? |
|---|---|---|---|
| 2.00 (Fit) | 85.2 | 3.5 | no — miss 1679 |
| 1.15 | 49.0 | 6.0 | no — miss 849 |
| 1.00 (ladder floor) | 42.6 | 6.9 | no — miss 702, and the tapnote fires: "43 px — under your 44 px minimum tap size" |
| 0.55 (fits both ends — NOT a rung) | 23.4 | 12.6 | yes, title cut |
| 0.51 (fits ends + title — NOT a rung) | 21.9 | 13.5 | yes |

23.4 px is under every offering of `balance.ui.tapSize` (smallest 24). **No
legal zoom, and no ladder anyone should ship, shows both real ends here.**

## The chrome inventory, every vertical px named (1200x730, device px)

| element | px |
|---|---|
| `.topbar.map-header` | 52 |
| `.map-substrip` | 31 |
| `.map-frame` (the port) | **559** |
| `.hint-bar.hint-map` | 25 (+6 margin) |
| `.map-zoom` row | 57 |
| **total chrome** | **171 (23.4% of 730)** |

At 1366x768: 54.6 + 32.5 + 590.6 + 26.5 + 6.3 + 57.6 = 768; chrome 177.4.
Reclaiming the hint bar + zoom row (88 px) moves the fit-both-ends zoom from
0.55 to 0.64 → 27 px nodes. Reclaiming everything but the topbar (119 px):
0.67 → 28.5 px. **Chrome reclaim alone cannot reach any floor.**

## The strip that already exists

`.map-entrance-orientation` — the composition that makes the phone green —
is rendered in the markup at every shape and hidden by
`styles/map.css:16` + the `@media (max-width: 700px)` block: a width
breakpoint, not the measured condition. At 1200x730 the probe reads it
`display: none` while `data-entrance-ends="clipped"` sits on the scrollport
one element away.

## Mock

`docs/mockups/desktop-entrance.svg` — drawn, not built: the entrance band at
wide plus an inert climb rail spending the right 304 px (two lit ends, dotted
rail, folded footer chrome). Illustrative except where its numbers cite the
probe.

## Boundaries

- One machine, act 1, entrance frame only; 4K/1080p unmeasured (the aspect
  collision does not change sign until a portrait monitor).
- `actends`' orientation-acceptance branch has never been observed red at a
  wide shape through the real door — today the strip never shows there, so
  there is nothing to observe. Any change that shows it at wide must plant
  that red before citing the green (the instrument rule, same-door clause).
- The probe is a reporter. It asserts nothing and may not be cited as
  coverage of anything.
