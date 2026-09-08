# Regional environment art

Five approved boards supply twenty combat paintings. The source PNGs are kept
intact; `src/content/environments.js` records the artwork rectangles, and the
runtime uses SVG viewBoxes to display them without board labels or borders.

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
