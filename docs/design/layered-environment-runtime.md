# Layered environment runtime

Combat and the world atlas location inspector now consume reusable component recipes. Editable authoring JSON remains in `art/map-battlefield-drafts/batch-10-location-streets/modules/`; `tools/layered-environment-build.mjs` publishes a runtime catalog and95 native-size WebP exports from reviewed original PNGs. Source originals stay unchanged. Runtime exports preserve transparency and are separate from the pinned external classic art pack.

## Component ownership

| Component | Runtime meaning |
| --- | --- |
| Skybox / backdrop | Outdoor sky and distant scenery; indoor back wall or fixed room shell |
| Rear props | Separate buildings, trees, pillars, bookshelves, stairs, chairs/thrones |
| Ground | Bare floor plane, above rear prop bases |
| Floor props | Separate rugs and other flat decoration, above ground and below actors |
| Time filter | One adjustable translucent day/night tint; indoor rooms keep local ambient by default |
| Weather | Independent tint plus rain/snow/ash particles; excluded indoors |

The throne-room recipe uses a bare floor, independent rug and independent throne. The original combined floor/runner painting remains authoring history. Backdrops contain fixed architectural detail; not every distant feature is isolated.

## Selection

`src/model/layeredEnvironments.js` reads current journey/node IDs, authored location profiles, setting tags, time and weather. It does not mutate runs, alter travel/discovery, consume gameplay RNG or replace saved atlas selections. All12 Crownfall bindings are explicit; the gates remain in Crownfall. Node `layeredSceneId` can explicitly name any published recipe.

Only compatible region/setting mappings select new art. Examples: Ashen Crown city/road, Hollow Weald forest/village, Pale Marches town, and explicitly tagged Cinder castle/tower. Unknown/unsupported combinations retain existing art. Explicit legacy dungeons and existing art previews retain precedence. City night uses painted night layers; other time adjustments are tints and do not invent night windows.

## Runtime and builds

- `src/content/layeredEnvironments.js`: generated28 recipes,95 source metrics, intro bindings, shared time and weather components.
- `src/ui/components/layeredEnvironment.js`: alpha-bound responsive placement, independent scenery/effects DOM, reduced-motion lifecycle.
- `assets-display/layered/manifest.json`: native dimensions, byte counts, source hashes and encoded export hashes.
- `tools/layered-art.mjs`: rejects missing manifests, unlisted references, unsafe paths, changed bytes and collisions with pinned art IDs.
- Portable builds inject verified bytes through `src/ui/layeredArt.js`; web builds add the same IDs to the common content-addressed pack. Both resolve through the existing asset source system.
- The HUD stays outside the scene tint; actors remain in their existing formation and input layers. Particle overlays are pointer-inert. Existing skyline/floor switches still work.

To refresh JSON without re-encoding unchanged art:

```sh
node tools/layered-environment-build.mjs --catalog-only
```

To re-encode reviewed PNGs at native size, omit `--catalog-only`. This authoring command needs the source-art checkout and Sharp. Ordinary game builds use committed exports and require no image tooling.

## Evidence and limits

Run `node --test tests/layered-environments.test.mjs tests/layered-environment.test.mjs tests/layered-art-pack.test.mjs` and build through `node tools/launch.mjs --build-only`. The browser suite `tests/layered-environment.browser.mjs` checks four viewport sizes plus Crownfall map inspection without travel. It accepts `LAYERED_GAME_URL` for web or standalone builds.

This integration does not replace the world atlas with the separate procedural hex authoring prototype. Floor/backdrop seams and wider moving-camera overscan still need art polish. Native layer exports add about28.6 MiB to the common art pack; individual source PNGs are not loaded by the game.
