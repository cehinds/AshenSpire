# Ashen Spire component collection

**300 reusable artwork files**, decomposed from all twelve original desktop/mobile boards: **27 new raster artworks, 71 new SVG components, 194 unchanged first-kit assets and 8 additional unchanged canonical objects**. Three existing fonts and their OFL license are included separately. Open **index.html** for screen breakdowns, individual-file downloads and editable HTML composition demonstrations.

This is an expanded art delivery begun October 3 and completed October 4, 2026. The original screenshots were visually inspected in full: 24 feature views, with 48 desktop/mobile renditions. **breakdown.json** records board coverage. **recipes/01a.json** through **recipes/12b.json** describe visible pieces, independent layer order, portable file paths, live fields, responsive composition and runtime binding constraints for each feature.

## New layers

| Family | Delivered pieces |
| --- | --- |
| Scene perspectives | 17 text-free paintings: Crownfall overview and street level, furnace chapel, clear-floor courtyard, chapel rest, rewards, fellowship and aftermath each in landscape/portrait; one square inn interior |
| Enemies | Wandering Soldier, Blight Hound and Charred Colossus each as a three-quarter body cutout and front inspector bust |
| Foreground decoration | Separate torn standard, hanging lantern and books/fieldcase/candle still life, all with actual alpha |
| Material | Weathered parchment cover surface; not seamless |
| Boxes and menus | Engraved folios, portrait/item mats, comparison/receipt/party/quest shells, action and focus/selection states, card aperture/cost pieces, chamber/talent sockets, meters/intents, pause/confirmation/dropdown/menu windows, navigation/settings/filter/search rows and visual motifs |

The supplied backgrounds and enemy cutouts were **reauthored at high resolution with the built-in image-generation tool**, using the screenshots and canonical identity art as references. They are not literal pixel-perfect screenshot extractions. Screenshot text and invented gameplay values are omitted. The first kit's paintings, 129 vectors and 49 canonical artwork copies remain byte-identical in **assets/reused/**. The additional eight canonical objects are in **assets/canonical-extra/**.

**masters/** preserves every new generator PNG unchanged. **assets/** holds game-facing WebP exports and independent vectors. WebP conversion changes format only: no crop, resize, recolor, background removal or invented pixels. Alpha cutouts use lossless WebP; scene/material exports use quality 92. Original alpha is retained, including a few near-opaque maxima of 254 rather than 255. **manifest.json** records dimensions, alpha ranges, source/master/export hashes and generation records. **generation.json** includes the exact prompts, local provenance, reference roles and built-in tool mode.

## Assemble the look

1. Choose the authored background. Keep canonical atlas/map artwork when existing coordinates or combat ground geometry matter. New Crownfall overview/street paintings are service/hero backgrounds; they do not share existing map pin coordinates.
2. Add separate canonical figures and objects with `object-fit: contain`. Select a new enemy cutout deliberately for an encounter inspector or compendium illustration. Combat sprite replacement needs authored floor/action anchors and pose routing; these single illustrations are not animation sets.
3. Place decorations at the edges. Fellowship travellers are baked into those scene paintings and are atmospheric figures, not player sprites. The other new scene paintings have no foreground combatant baked in.
4. Put the independent veil, material and frame under live text. Keep small labels over a quiet opaque/veiled surface. On parchment, use dark text. Leather/parchment materials are non-seamless cover surfaces.
5. Supply real names, costs, descriptions, resources, graph geometry, discovery, availability and receipts from game models. The original concept boards' inaccurate deck caps, seconds-based skills, merchant affordability, rest recovery and illustrative card effects are not game rules.
6. Compose selection and focus independently. Disabled action skins must override ready/selected skins. The existing Combat End Turn visual exception remains controlled by the game.

**components.css** provides scoped `sk-` composition classes for folios, actions, cards, slots, meters and desktop/mobile trays. **gallery-template.html** demonstrates real HTML labels over separate artwork, with painting/frame/text visibility controls. Its buttons and values are an art demonstration, not game behavior. Prefer the existing native game card/equipment renderer for actual variable text and binding. Long descriptions belong in an inspector; never crop or shrink important game text to fit a decorative sample card.

Desktop shows context, selection and comparison together. Portrait mobile keeps one open detail tray and reachable bottom actions; separate portrait paintings preserve the focal scene rather than shrinking a wide screen. Short landscape folds optional context and permits stage/detail scrolling. Keep the game's configured touch hit area, accessible text size, focus and reduced-motion preferences.

## Sizing and alpha

SVG **nineSliceInsets** are ordered **top, right, bottom, left** in source pixels. Use nine-slice/stretch caps for frame-only shells; preserve fixed separators inside the larger caps recorded for party/quest rows. Card frames, medallions, icons, ornaments and node sockets scale with their aspect ratio rather than nine-slicing. Artwork/name/type/body apertures for **card-engraved.svg** and object/portrait mats are recorded in the manifest. A transparent exterior does not imply an opaque backing has a transparent center.

The original SVG source is **build-collection.py**. Standalone SVG image files contain unique prefixed gradient/title IDs. When inlining the same SVG more than once, suffix all internal IDs and references per instance to avoid document-wide collisions. The static checker backgrounds in the catalog/review sheets are never part of the delivered alpha images.

## Find and export

- **index.html**: offline searchable component catalog, original references, recipes and editable-label layer demonstrations.
- **screen-recipes.json**, **recipes/**: all 24 screen inventories and desktop/mobile composition rules.
- **review/new-art.png**, **review/enemies.png**, **review/decorations.png**, **review/boxes-menus-*.png**: static visual inspection sheets, not runtime atlases.
- **manifest.json**, **generation.json**, **source-canonical-map.json**, **source-generation.json**: source identity, dimensions and hashes.
- **CREDITS.md**, **SOURCE-CREDITS.md**, **fonts/OFL.txt**: provenance and retained source licenses.
- **SHA256SUMS.txt**: the explicit owned package inventory and checksums.

The ZIP beside this folder contains the complete catalog, references, PNG masters, game-facing components, recipes, fonts, licenses and verification helpers. It is portable; displaying the delivered assets does not require repository files or network access. Rebuilding inherited sources with **build-collection.py** requires the checked-in sibling first kit and canonical repository sources. Normal delivery verification works standalone.

## Verification and rebuild

Run the scripts in this order from a compatible repository checkout:

```text
python build-collection.py
python build-recipes.py
python build-gallery.py
node render-previews.cjs
python verify-collection.py
```

Python requires Pillow. Static rendering requires Sharp through normal Node resolution, or `ASHENSPIRE_SHARP_MODULE` set to an installed module path. All new outputs stay under this D: workspace. The helpers do not call the image API; new raster generation requires the built-in tool and its saved prompts. The verifier checks every declared image, vector, master, font, recipe path, local HTML/CSS reference and script syntax, then writes a ZIP with fixed metadata. Owned paths come from explicit manifests/recipes and named package files; caches and unrelated local files are excluded even when they use a valid image extension. ZIP reproducibility is tied to identical package bytes and the same Python implementation.

Static visual and package evidence is in **VALIDATION.md**. Browser preview access was blocked by the app's URL policy, so interactive catalog behavior and the current game preview are not claimed as browser-verified. This collection does not register assets, change gameplay or replace the live UI; the separate conversion work can consume the delivered files and explicit recipes.
