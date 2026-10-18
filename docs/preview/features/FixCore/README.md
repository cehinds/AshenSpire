# FixCore capture record

Feature: `feature/FixCore`, implementation PR #2129.

- Source: `f3929892c4d1e6e37173bcf73d0ae076dc3f99ce`.
- Captured 2026-10-18 UTC; completed at 19:49:18 UTC.
- Build generated from that source: **0.7.1.1616**, digest **19ba0b31fa**.
- Capture harness: `tests/fixcore-combat-ui.browser.mjs`, Chromium, repository source served through `tools/serve.mjs`. These are posed Core 2 fixtures over the real engine and renderer, not an earned encounter or captures of the standalone HTML. The combat HUD does not display the build version.
- Selected-card inspection explicitly uses `oneTapPlay:false`. The separate default-one-tap browser suite also passed, including damage-number inspection without playing a card.
- Four viewports and hidden/resumed planned-round autoplay passed with no page errors. Images were inspected by the coordinator. Full raw evidence remains outside the source tree.

| Image | Viewport | Subject |
| --- | --- | --- |
| mobile.png | 390 × 844 | Selected multi-hit card, known hit odds and protection/status PIPs |
| desktop.png | 1440 × 900 | Damage calculation with named equipment, attribute and protection sources |
| wide.png | 1920 × 1080 | Multi-hit totals, Perception-gated odds and combat layout |
| tablet.png | 1024 × 768 | Damage calculation and tablet layout |

Publication target: https://cehinds.github.io/AshenSpire/branches/feature/FixCore/latest/

Public delivery verification is pending. The environment blocks direct GitHub Pages access; use the trusted `pages-builds` public-delivery check before calling this URL verified. The verified CI build artifact is [feature-preview-97d7b1117](https://github.com/cehinds/AshenSpire/actions/runs/39162279251/artifacts/12149103656): source `97d7b111779a5fca67007917264217f59c7cdd09`, version **0.7.1.1620**, digest **9bfa453b97**. Its later build number reflects the dev receipt restamp; gameplay/UI source is unchanged from the captured integration. GitHub sign-in is required for artifact downloads; the artifact expires on 2026-11-01.

The Release gallery remains separate at 0.7.1.1517, source `d310c277fffaaec6ec7a58a87de846577f12312d`. No Release or Main promotion is part of this change.
