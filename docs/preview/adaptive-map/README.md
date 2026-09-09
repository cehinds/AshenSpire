# Adaptive map presentation

All four map modes share vector nodes, outlined routes, engraved unexplored parchment and viewport-selected image detail. The original close-up remains the default; manual zoom can go one step closer. Discovery, graph positions, inspection and travel are unchanged.

## Content and rendering

- `src/content/mapPresentation.js`: detail levels, tile size, density cap, concurrent request and decoded-cache budgets, route widths, close-node scale and maximum atlas zoom.
- `src/content/mapArt.generated.js`: painting URI -> content hash and available native dimensions. Tile addresses and placements are derived from these records, not duplicated per node or region.
- `tools/map-detail-build.mjs`: rebuild the fallback and immutable external tile pyramid from project-owned PNGs. It is also called by the existing environment-art build. Add larger registered masters here to extend available detail; no upscaled tier is mislabeled as native detail.
- `src/ui/models/MapDetailModel.js`: resolution selection, stable thresholds and clipped tile bounds.
- `src/ui/components/mapDetail.js`: up to three concurrent fetches, decode before replacement, retained fallback, bounded cache, cancellation and object-URL cleanup on leaving the map.
- `src/ui/components/mapFog.js`: original vector engraving, kept fine at changing zoom. Decorative contours contain no hidden route information.

The fallback is capped at 512px. Present masters provide 1024px and 1254px/1536px detail tiers. The square map has a cleaner project-owned redraw, but imagegen returned the original 1254px dimensions; this change does not claim a 4K or 8K master. Texture detail remains limited at extreme zoom.

## Builds and offline behavior

Keep `map-detail/` beside a hosted `AshenSpire.html` or `index.html`. The launcher copies it into `dist/`; the PR preview artifact and Pages assembly carry the tile files from that exact commit. Every image uses the same coordinates under the existing reveal mask. Missing optional detail leaves a usable fallback.

Opening the HTML alone with `file://` intentionally uses bundled imagery without external requests. For local high-detail play, serve the full folder using `node tools/serve.mjs --root dist --no-open`. No remote asset service is required.

## Evidence

Validation covers source and built map controls at 390x844, 844x390 and 1440x900; adaptive loading additionally checks every mode at 390x844 and 1440x900. The detailed feature checks hold network responses, verify retained fallback and at most three concurrent requests, release responses, inspect revealed detail, exercise closer zoom and overview, and check failed-detail fallback still permits location inspection.

Screenshots in this folder show each feature on the phone. The local preview package contains all phone and desktop feature captures. These are Edge/Playwright checks with touch emulation, not physical-phone performance measurements.

| Feature | Screenshot |
| --- | --- |
| Pending higher detail; bundled map remains visible | [Loading](screenshots/wanderer-390-loading.png) |
| Sharper tiles, outlined paths and engraved fog | [Detail](screenshots/wanderer-390-detail-routes-fog.png) |
| Extra manual zoom | [Closer](screenshots/wanderer-390-closer.png) |
| Overview switches to a lower detail tier | [Overview](screenshots/wanderer-390-overview.png) |
| Optional detail fails; map stays usable | [Fallback](screenshots/offline-fallback-phone.png) |
| Traditional | [Traditional](screenshots/traditional-390-detail-routes-fog.png) |
| Co-op | [Co-op](screenshots/coop-390-detail-routes-fog.png) |
| Long Expedition | [Expedition](screenshots/expedition-390-detail-routes-fog.png) |
