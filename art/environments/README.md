# Regional environment art

Five approved boards supply twenty combat paintings. The source PNGs are kept
intact; `src/content/environments.js` records the artwork rectangles, and the
runtime uses SVG viewBoxes to display them without board labels or borders.

`maps/` contains complete, unlabeled map paintings generated from the approved
map panels. Fog and node markers are not baked into those assets. The shared
map renderer exposes soft circular areas around the existing discovered-node
set. This set derives from saved run history; there is no new save format or
change to navigation, encounter generation, or node knowledge.

The seed selects the first region; subsequent acts rotate through the five
regions without repeats until the cycle restarts. Combat scenery rotates among
that region's four locations by floor with a seed offset. These cosmetic choices
do not consume gameplay RNG. Solo and co-op use the same resolver.

Solo fog follows saved discovery. Co-op retains its existing full-map mode:
the host snapshot does not yet transmit the explored path needed for fog.

Rebuild textures with `node tools/environment-art-build.mjs` (requires sharp),
then rebuild the standalone game with `node tools/launch.mjs --build-only`.
Validate with `node --test tests/environment-art.test.mjs` and the normal game
checks. Source boards and maps were produced with the built-in image generator;
no third-party game map or screenshot is shipped.
