# Layered combat and dialogue scenes

Open `index.html` for the interactive gallery, or follow **View layered scene** from a dungeon node. Four scenes per dungeon: three shared key-location settings and a dedicated boss arena. All paintings were generated with built-in image_gen using the corresponding dungeon map as a style/architecture reference.

| Dungeon | Scene 01 | Scene 02 | Scene 03 | Scene 04 — dedicated boss |
| --- | --- | --- | --- | --- |
| BS — Briar Sanctum | Gate of Unkept Names | Chapel of Small Mercies | Bridge of Bound Vows | Heart of Briar Sanctum |
| HM — Hall of Mirrors | Gate of Second Faces | Shattered Conservatory | Bridge of Courtesy | Hall of Mirrors |
| FC — Furnace Chapel | Gate of Banked Coals | Quenching Yard | Iron Viaduct | Furnace Chapel |

Use exact IDs such as `FC-ENV-04` in revision requests. `sources/` holds 12 untouched PNG paintings. `layers/` holds 24 lossless WebPs with real alpha. `previews/` holds optimized complete paintings, thumbnails, the labeled contact sheet and browser screenshots. `provenance.json` records exact prompts, map references and generated source paths. `manifest.json` records dimensions, layer order, floor seam positions, node ranges and validation results.

## Layer contract

Each plate uses the same **1536 × 1024** canvas and origin. Draw **floor first**, then **background on top**, then actors and game UI. Both environment images must use identical scale, position and crop. The floor has transparent pixels above its authored seam; the upper scenery has transparent pixels below a 16-pixel overlap. The overlap uses the same source pixels so stacking does not introduce a visible join. Lossless WebP retains that alignment without separate lossy compression seams. Full-scene preview WebPs use quality 88.

These are horizontal stage plates extracted from purpose-composed paintings, matching the project's existing skyline/ground-band approach. They are not object-by-object depth cutouts or outpainted hidden terrain for independent parallax. Moving the layers independently would expose unpainted areas. The shared floor is open for combat formations and dialogue portraits; the gallery's character guides are explicitly layout markers, not new actor art.

## Validation and scope

Every exported layer was decoded and checked for dimensions and alpha. Recomposition differs from the source by at most 1/255 per color channel from alpha rounding. All 12 scene pairs were visually inspected; the interactive gallery checks cover all image loads, independent layer visibility, dialogue/position toggles, desktop/mobile layouts and links from dungeon nodes. Browser checks use local Edge via Playwright because the app browser connection previously timed out.

The map preview now displays scene thumbnails and links to the corresponding layered scene. This is an art/preview delivery: the live game's combat renderer, dialogue renderer and encounter logic are unchanged. Both generated masters and the original map art are preserved.

The preceding map/lore pack was merged into local dev as `819a8fc1`. No remote push or deployment was requested or performed.
