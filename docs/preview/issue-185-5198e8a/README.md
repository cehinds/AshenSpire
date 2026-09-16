# Issue #185 exact-current screenshot receipt

Representative title, map, and combat captures for AshenSpire issue #185.

- Source ref: `dev@5198e8a3cbdedc37e08cd093d5e7da94b1a704e8`
- Captured artifact: `dist/AshenSpire.html`
- BUILD/source stamp: `0.4.0.1251 · src 3e9f7f9d1c`
- Artifact SHA-256: `4f11fdd50bf52c06a1bbfb2a6f93095650c54ff112f43a2986d9e0cf987fbfb6`
- Artifact size: `3,947,125` bytes
- Matching Pages deployment: [run 32745717500](https://github.com/cehinds/AshenSpire/actions/runs/32745717500)
- Capture time: `2026-08-24T15:48:16.059Z`
- Release boundary: **RED**

The local standalone artifact was byte-identical to repository root/build/dist
and to the deployed Pages response before capture. The nine full-viewport PNGs
were captured over CDP with `captureBeyondViewport: false`; no game source or
generated artifact was changed.

## Captures

| Surface | 390x844 phone | 1200x730 repository desktop | 1440x860 #185 historical desktop |
|---|---|---|---|
| Title | [PNG](title-390x844-build-0.4.0.1251-src-3e9f7f9d1c.png) | [PNG](title-1200x730-build-0.4.0.1251-src-3e9f7f9d1c.png) | [PNG](title-1440x860-build-0.4.0.1251-src-3e9f7f9d1c.png) |
| Map | [PNG](map-390x844-build-0.4.0.1251-src-3e9f7f9d1c.png) | [PNG](map-1200x730-build-0.4.0.1251-src-3e9f7f9d1c.png) | [PNG](map-1440x860-build-0.4.0.1251-src-3e9f7f9d1c.png) |
| Combat | [PNG](combat-390x844-build-0.4.0.1251-src-3e9f7f9d1c.png) | [PNG](combat-1200x730-build-0.4.0.1251-src-3e9f7f9d1c.png) | [PNG](combat-1440x860-build-0.4.0.1251-src-3e9f7f9d1c.png) |

## Verification

All 9 cells passed the capture contract recorded in
[`capture-results.json`](capture-results.json):

- viewport dimensions exactly matched the filename;
- the visible stamp exactly matched BUILD `0.4.0.1251 · src 3e9f7f9d1c`;
- no validation banner, uncaught runtime exception, or `console.error` occurred;
- representative controls were present, visible, and enabled: title-menu
  buttons; map node and Armoury; combat cards, End Turn, and Armoury;
- desktop document extent matched the viewport;
- at 390x844 Chromium reported a 43 px document extent, while both `html` and
  `body` used `overflow-x: hidden`. The visible out-of-viewport elements were
  the intentionally camera-clipped map SVG and horizontally scrollable combat
  hand; there was no page-level horizontal scrollbar or clipped required
  control in the inspected images.

The title made the expected static-host probes to `/api/lan/info` and
`/favicon.ico`. Both returned 404 through the local static server. The LAN probe
is handled by `src/net/lan.js` as the signal to keep Forsaken Together hidden;
neither request produced an uncaught exception, validation banner, or
`console.error`. The raw events remain in `capture-results.json` rather than
being reported as silence.

The PNGs were visually inspected after capture. Title controls and the complete
build stamp are readable; map navigation, Armoury, and map controls remain
reachable; combat cards, End Turn, Armoury, resources, and enemy/player states
remain visible at phone and desktop sizes. These screenshots are acceptance
evidence only and imply no release approval.

## SHA-256

| File | SHA-256 |
|---|---|
| `title-390x844-build-0.4.0.1251-src-3e9f7f9d1c.png` | `7839f2d0dbe8a82ee9dddb79a629b5554d25b4ca6a4f07addba125c1a4f8ca12` |
| `map-390x844-build-0.4.0.1251-src-3e9f7f9d1c.png` | `05b5bb6d1b305ff026dc8546b625cd8aa262488206df88a2baa040c74b335208` |
| `combat-390x844-build-0.4.0.1251-src-3e9f7f9d1c.png` | `e58c287d0b4c60911281e46b26563d586d53a8e02cba235fd7315283d1acdf19` |
| `title-1200x730-build-0.4.0.1251-src-3e9f7f9d1c.png` | `fd7bd0c8f051eaf58eb75bdf43dbf1d39643731238fb75938fc224d449ba4d1f` |
| `map-1200x730-build-0.4.0.1251-src-3e9f7f9d1c.png` | `98f4095cad863b68cf994a99d5887a48e7f8052767eafb7becfd0aad0bcff590` |
| `combat-1200x730-build-0.4.0.1251-src-3e9f7f9d1c.png` | `28470107da6cd65ea7e97f5dea292ebccd026a8849f452e2233c774f62088322` |
| `title-1440x860-build-0.4.0.1251-src-3e9f7f9d1c.png` | `156f1c211c0f34171a9be66970afa842a52ee863264a0952d4e0ea94bb72f3cd` |
| `map-1440x860-build-0.4.0.1251-src-3e9f7f9d1c.png` | `8208470eac5279f0d12b1093c164db983f8fb3ae1ac24b13815a91c41b0b2033` |
| `combat-1440x860-build-0.4.0.1251-src-3e9f7f9d1c.png` | `fe254d510a797211e5ce5efb1cd666ab287a1ea79ec2583c963f3fbc9a06c787` |
| `capture-results.json` | `c19b6d343e2640c9874f6af8fcdeeeec8a06e3d47200d6ddabc72c65f751ade30` |

## Instrument boundary

`tools/release-shots.mjs` refused before capture because its top-level state
denominator has not learned the newer `?shot=components` state. This receipt
does not repair or suppress that independent tool finding. The focused capture
used the repository's `serve.mjs`, `browser.mjs`, deterministic `?shot=` states,
and CDP screenshot path without modifying the artifact.
