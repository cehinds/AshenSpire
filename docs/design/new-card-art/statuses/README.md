# Status art components

[Open the gallery and placement editor](index.html) · [Full JSON](manifest.json)

[Preview 12 examples](preview.png) · [All 71 labeled categories](overview.png)

71 current game statuses, ten assembled options each: **710 labeled proposals**.
Each status has ten object choices, ten unlit effect marks and ten luminous effects.
Related statuses reuse consistent object models: **290 unique objects across 29
families, 710 marks and 710 glow PNGs = 1,710 transparent components**.
The 30 reference-only statuses are excluded. Gameplay and runtime card art are unchanged.

## Downloads

- [Volume 1: 26 statuses / 260 options](statuses-01-png-json.zip)
- [Volume 2: 26 statuses / 260 options](statuses-02-png-json.zip)
- [Volume 3: 19 statuses / 190 options](statuses-03-png-json.zip)

Extract a volume and open `index.html`. PNGs, placement defaults and the viewer
work offline. Each ZIP includes only its statuses and the components they use;
shared objects can appear in multiple volumes. The complete raw source sheets
and the original reused assets stay in the repository, outside the ZIPs. Their
paths and hashes are provenance references, not viewer dependencies.

## Codes and layers

`statuses-01/A37` means volume 1, category A (Precision), object 3, effect pair 7.
Letters run A–Z in each volume. The ten starting recipes use matching digits
00, 11, …, 99; the editor supports all 100 object/effect combinations per status.
**0 is a real option.** Hide a layer with its visibility switch.

Every component is a separate 400×400 PNG with actual alpha:

1. `png/glows/`: luminous motif and aura, behind the object by default.
2. `png/objects/`: the physical symbol or reused weapon/mineral.
3. `png/effects/`: an unlit mark or decal, above the object by default.

The preview background is CSS and is never baked into these PNGs. Natural
material highlights remain in objects; the reused flame object is itself fire.
The glow PNG contains the luminous motif as well as its surrounding light.
Marks and glows are separately generated interpretations, not pixel-registered
masks. Adjust their positions and sizes when combining them.

The gallery provides ten options per selected status, an overview of all 71
categories, full-opacity isolated previews and individual PNG download links.
Each layer has independent X/Y position, size, rotation, opacity and visibility.
Placement JSON exports the current layers, component references and computed CSS.

## JSON and provenance

`manifest.json` contains status IDs/names, object families, variant lists,
710 starting recipes and all component metadata. Transforms use canvas percentages
for X/Y/size, degrees for rotation and 0–1 opacity. CSS uses a centered anchor.
`inventory.json` preserves the exact current status IDs and their catalog recipes.
`effect-briefs.json` and `object-briefs.json` record the visual vocabulary.

`generation-sources.json` records exact ImageGen prompts, source files, hashes and
atlas grids. The 21 new object families each have ten generated orientations or
silhouette variants. Eight existing weapon/mineral families provide the remaining
80 objects. Component references identify every reused original and its hash.
Effects originate in compact atlas cells (usually about 177 pixels square);
400×400 exports are normalized cutouts, not native 400-pixel source paintings.
Crop metadata records native dimensions. Raw sheets are preserved unchanged.

ImageMagick crops and normalizes the PNGs. Alpha analysis locates transparent
gutters and removes unused padding; it does not paint or recolor the artwork.
Some generated marks have relief-like material detail. These remain proposals
for selection, with restrained default glow opacity and separately adjustable marks.

## Rebuild and check

From the repository root, with Python, Pillow, NumPy, ImageMagick and Node installed:

```sh
python docs/design/new-card-art/statuses/export.py
python docs/design/new-card-art/statuses/package.py
python docs/design/new-card-art/statuses/validate.py
node --check docs/design/new-card-art/statuses/viewer.js
node --test workbench/tests/registry.test.mjs
```

Validation checks exact coverage against `src/content/statuses.js`, ten distinct
variants per layer/family, unique codes, nonempty transparency, dimensions,
provenance hashes, crop bounds and packaged component completeness.
