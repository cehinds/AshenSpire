# Original seamless particle drafts

`rain`, `snow` and `ash` each have a transparent 1024 × 1024 PNG, an editable SVG and a provenance JSON. These are original simple vector illustrations: no image generation service, existing-image editing, terrain or opaque background is involved. `qa-preview.png` shows 1:1 samples on dark and light backgrounds; it is a review sheet, not an overlay asset.

Reproduce all sources, browser exports and numerical checks from the repository root:

```sh
node art/map-battlefield-drafts/batch-04-atmosphere/particles/render.mjs
```

Requires Node.js, Playwright, Sharp and `/usr/bin/chromium`; override Chromium with `PARTICLE_CHROMIUM_PATH`. Chromium loads the SVG into an image and draws it onto a transparent Canvas 2D surface, then exports PNG. Sharp only decodes PNGs for pixel checks. No game files or runtime weather logic are changed.

The seeded geometry in `render.mjs` is the canonical source for regeneration. Each SVG remains directly editable in vector software; direct changes are overwritten on regeneration. Each 256 × 256 repeat unit is repeated four times per axis. Every particle has nine neighbor copies before pattern clipping, including particles deliberately crossing the boundary. Snow blur is applied before clipping. The particles remain sparse, with varied opacity and muted colors.

Validation compares every RGBA pixel with its counterpart one period away in both axes, checks that the outer seam's adjacent edge pair equals an internal repeat join, and compares a second browser render translated by one full period. Opposite first/last pixels are adjacent samples and are not expected to be equal to one another. Exact periodicity and equivalent seam adjacency are the relevant equality checks.

Suggested motion at 1:1 display scale (screen x right, y down):

| Asset | Velocity, px/s | Direction | Loop | Suggested layer opacity |
| --- | --- | --- | --- | --- |
| Rain | `(64, 256)` | Down/right, along streaks | 4 s | 0.45 |
| Snow | `(8, 32)` | Slowly down/right | 32 s | 0.65 |
| Ash | `(-16, -8)` | Slowly up/left | 32 s | 0.50 |

Each full loop translates by integer multiples of the 256 px periods. Adjust speed with texture scale. Treat density, opacity and speed as starting points requiring actual scene review; a small repeat can become visible at high opacity. These drafts are not registered production assets.
