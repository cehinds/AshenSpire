# Oversized neutral fog field

Original editable vector illustration with a native transparent **4096 × 4096 PNG**. Broad diffuse wisps cover the center and accumulate more around the perimeter. Alpha is deliberately low; outer frame masks fade the complete boundary to zero. This field becomes a main overscan fog draft without changing the separately preserved generated-fog alternate.

Reproduce sources, PNG, provenance, 27 crop checks and the QA preview:

```sh
node art/map-battlefield-drafts/batch-04-atmosphere/fog-vector/render.mjs
```

Requires Node.js, Playwright, Sharp and `/usr/bin/chromium` (override with `PARTICLE_CHROMIUM_PATH`). Chromium rasterizes the original SVG at its native size through Canvas 2D. Sharp only decodes the result to measure alpha. `render.mjs` is the canonical deterministic source; direct SVG edits are overwritten when it runs.

Center the square at a display side of `2 * max(viewportWidth, viewportHeight)`. For a viewport with a maximum edge of 2048 px, this uses the source at 1:1. Translate by no more than ±0.2 of viewport width horizontally and ±0.2 of viewport height vertically. Worst-case source edge clearance remains about 614 px. Scale uniformly for other viewport sizes. Use gentle bounded sine oscillation, for example 34 s horizontally and 47 s vertically, with different phases.

**The field is not tileable. Do not repeat it or use modulo scrolling.** Crop coverage is tested at center and all combinations of the motion limits for portrait, widescreen and ultrawide viewports. Every crop must remain inside the source, retain nonzero fog coverage and show soft alpha variation. The entire source boundary must have zero alpha. Full per-crop measurements, PNG/SVG hashes and the observed maximum alpha are recorded in the provenance sidecar.

`qa-crops.png` compares centered dark-background crops with extreme-offset light-background crops, keeping the actual fog opacity. Only the crop carries fog; surrounding space letterboxes the crop. The field is intentionally subtle and requires final scene/motion review. No generated image, terrain, runtime weather logic or other assets were edited.
