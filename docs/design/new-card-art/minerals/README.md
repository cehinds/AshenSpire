# Mineral component proposals

Open [the gallery and placement editor](index.html), or download [the PNG/JSON/viewer bundle](minerals-png-json.zip).

Ten variations each: **A shard, B pebble, C stone, D crystal, E diamond**. This is a separate `minerals/` namespace; existing weapon A–Z codes are unchanged. `minerals/B37` means pebble object 3 with effect pair 7. Zero is a real variant. The 50 initial previews use matched digits (A00, A11 … E99); the editor allows all 500 combinations.

Each option has three independent transparent 400×400 PNGs:

- `png/B3-object.png`: base material, without magical illumination. Natural material texture stays in the object.
- `png/B3-cracks.png`: unlit branching fissure decal, without the aura.
- `png/B3-glow.png`: blue/mint edge aura, without the object or crack decal.

Labels and preview backgrounds are outside the artwork. Isolated previews show the raw PNG at full opacity; assembled previews use subdued glow at 18%. Use the layer checkboxes to hide components, and the individual X/Y, size, rotation and opacity fields to place them. Download placement JSON to save edits; changing selections or resetting reloads defaults. PNGs remain unchanged by the controls.

`manifest.json` records every PNG reference, dimensions, hash, CSS, transform and source crop. X/Y/size use percentages of the square stage; rotations use degrees about the center. Layer order is object → cracks → glow. Standalone JSON exports include current visibility and computed CSS, with `assetBase` identifying the repository-relative directory for component URLs. The browser's transparent background checker is not an export layer.

These are generated art proposals. Overlay alignment is approximate and editable; effect pairs mixed across shapes may need adjustment. No gameplay tags, card selections or runtime images are changed by this collection.

## Reproduction

`sources.json` records the generated source sheets, references, source hashes, effect prompts and the base-art brief (the original base prompt is not archived here). The 15 original RGBA sheets are in `sources/`. `python export.py` uses ImageMagick to extract a fixed 5×2 grid, normalize all cells to 400×400 and regenerate the manifest and browser data. This is technical extraction; the object, crack and glow artwork was generated with OpenAI ImageGen.

`isolation-crops.json` records additional crop rectangles that remove small neighboring atlas fragments while retaining the main sprite's original canvas position.

The download bundle contains the 150 cutouts, manifest, viewer and README; master sheets and exporter remain in the repository.
