# Regional environment art

Five original concept boards remain intact here. Their twenty combat locations
have been recomposed in `combat-fields/` as four equal, edge-to-edge paintings
per atlas, with wide clear floors and distant landmarks. These new sheets supply
the runtime combat textures; the region and scene IDs remain stable.

`src/content/environments.js` records each artwork rectangle and its measured
`floorStart` (the fraction of source height where clear ground begins). The
renderer maps that boundary to 40% of the battle view, reserving `fieldRatio: 0.6`
for the floor at every viewport size. Two continuous SVG viewports retain the
full scene width and adjust the vertical framing of architecture and ground
separately. The painting fits the actual battlefield, excluding the HUD and hand.
The shared stage aligns sprite foot anchors, reserves the tallest information
strip, and keeps intent/HUD clearance. Contrast edges follow image alpha before
soft shadows and compose with readiness auras and target effects.

Review all scenes with `node tools/combat-ground-qa.mjs` (Playwright/Edge), serving
the standalone game on port 8210. It checks 20 scenes at four viewport sizes,
authored foot anchors, the 60% floor, overflow and embedded art, plus reduced motion.

`worlds/` contains three connected mega maps, each combining all five biomes.
See [world-maps.md](world-maps.md) for their layouts and future junction design.
`maps/` preserves the earlier individual biome paintings for future local views.
Fog and node markers are not baked into these assets. The shared renderer
exposes soft circular areas around the existing discovered-node set, derived
from saved run history. No save format, navigation or node-knowledge rules change.

The seed selects one world for the whole run. Combat scenery still rotates
among each act's region and four locations by floor with a seed offset. These
cosmetic choices do not consume gameplay RNG. Solo and co-op share the resolvers.

Solo fog follows saved discovery. Co-op retains its existing full-map mode:
the host snapshot does not yet transmit the explored path needed for fog.

Rebuild textures with `node tools/environment-art-build.mjs` (requires sharp),
then rebuild the standalone game with `node tools/launch.mjs --build-only`.
Validate with `node --test tests/environment-art.test.mjs` and the normal game
checks. Source boards and maps were produced with the built-in image generator;
no third-party game map or screenshot is shipped.
