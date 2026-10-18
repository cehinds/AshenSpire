# Map and battlefield source-art library

**251 retained source drafts across eleven batches.** Preserved in the dedicated art repository. The game publishes reviewed components as separate WebP runtime exports; other paintings remain authoring drafts.

| Batch | Source count | Contents |
| --- | --- | --- |
| [01](batch-01/README.md) | 8 | Five map props and a daytime forest stack |
| [02](batch-02/README.md) | 10 | Six map props, night forest stack, misty sky |
| [03](batch-03/README.md) | 8 | Four travel landmarks, independent misty tent/arch, clearing and road grounds |
| [04](batch-04-atmosphere/README.md) | 15 | Oversized tint/fog fields, repeating particles and distant lightning |
| [05](batch-05-regions/README.md) | 32 | Five regional sets, shared dungeon/mine layers and editable location mappings |
| [06](batch-06-settlements/README.md) | 17 | Regional settlement buildings/streets, five dungeon floors and clearer frozen shore |
| [07](batch-07-map-icons/README.md) | 25 | Complete matching painted map-icon collection and editable style guide |
| [08](batch-08-style-alignment/README.md) | 4 | Style corrections for the ice floor, daylight sky and distant lightning |
| [09](batch-09-biome-architecture/README.md) | 45 | Near/distant mountains, desert/jungle/snowy architecture, streets and dungeons in day/rain/night conditions |
| [10](batch-10-location-streets/README.md) | 86 | 25 backdrops, 19 grounds and 42 props for close streets, interiors and landmarks; 28 scenes and 12 intro-map candidates |
| [11](batch-11-floor-props/README.md) | 1 | Separate transparent rug for floor decoration; reused with bare ground and a separate throne |

![Regional settlement combinations](batch-06-settlements/preview-settlements.png)

- [Shared art direction for every component](style-system/README.md) maps 231 approved sources to eight role profiles, with hash-bound visual reviews and explicit historical exclusions.
- [catalog.json](catalog.json) links the batch manifests and editable scene recipes.
- [Map components and all object mappings](hex-world-module/MAP-COMPONENTS.md) connect 25 object types, 25 active matching icons and 39 historical variants to tile/discovery definitions.
- [Standalone hex world module](hex-world-module/README.md) defines six-sided tile tags, rotation, art pools, encounters and discovery examples.
- [Latest modular JSON](batch-06-settlements/modules/README.md) separates region pools/scenes from shared camera and selection rules, with portable single-file exports.
- [Close-location modules](batch-10-location-streets/modules/index.json) define 28 scenes; [intro-map mappings](batch-10-location-streets/modules/intro-map.json) cover all 12 Crownfall nodes with editable art candidates.
- Manifest IDs are local to their batch; use the batch ID plus asset ID as a library key. Revised subjects can exist in multiple batches.
- Source PNGs, prompts, provenance and measured dimensions are retained together. Previews demonstrate composition and small-size readability; they are not production exports.
- Scene source canvases currently reach about 1672 × 941; more overscan and registration are still required for wider camera motion. Map masters are 1254px square; 512px/256px exports remain pending.
- Existing issues include low-alpha edge dust, colored fringes and some small-size silhouette ambiguity. Each batch records its own findings.

Next art families: regional dungeon backdrops/props, coastal dock connections, expanded panoramic masters, and alpha/contact-shadow cleanup. Production integration continues through the [shared handoff](https://github.com/cehinds/AshenSpire/blob/dev/docs/design/improve-map-battlefield-art/HANDOFF.md) and the project's art-repository intake.

Atmosphere fields now use 4096px square vector masters and a 2× viewport coverage rule; seamless particle tiles cover arbitrary field sizes. The earlier painted scene layers still need expanded edges. See batch 04 for crop checks and motion preview.

## Validation dependencies and paired game

Use Node.js 20+ and Python 3 (`python` on PATH). Install schema validation with
`python -m pip install -r art/map-battlefield-drafts/requirements.txt`.
The location scenes validate their source atlas against the paired game checkout,
which defaults to sibling `../AshenSpire` relative to the art repository. Set
`ASHENSPIRE_DIR` to the absolute game checkout path when using another layout.
The regional preview renderer uses the same setting for game map images and
requires Playwright with Chromium. Technical map icon sources are local in
`technical-map-icons`; their PNG and SVG bytes are preserved from the game gallery.

Run all authoring tests from the art repository root:
`node --test art/map-battlefield-drafts/*/*.test.mjs`.
