# Actual PNG cutouts — selection set 03

Open [cutouts.html](cutouts.html) to select, layer, rotate, resize and keep multiple
choices. The downloadable `card-art-cutouts-v3.zip` includes the standalone
viewer, all PNGs and the JSON. Extract the ZIP and open `cutouts.html`
in a browser. It uses plain local scripts and needs no build step. If browser
policy blocks local files, run `python3 -m http.server 8765` in the extracted
folder and open `http://localhost:8765/cutouts.html`. Browser verification in
this environment used local HTTP because its policy blocks file URLs.

## Deliverables and codes

- **70 core object PNGs:** ten variants each of swords, scimitars, scythes, hammers, shields, cards, and leaves.
- An additional ten Cleansed fire objects, 80 effect PNG exports, and ten separate background PNGs.
- Some compatible families reuse an effect source; effect exports are not claimed to be 80 unique effect designs.
- All object/effect PNGs have a 512×512 transparent canvas and a clear outer margin.
- Background PNGs are 512×640. The composed art crop is also 512×640.
- `cutout-manifest.json` contains component references, dimensions, anchor,
  position, sizing, rotation, scale, opacity, blend mode, layer order and CSS.
- Labels live in the viewer/JSON, never inside a PNG.

| Letter | Category |
| --- | --- |
| A | Swords — ten alternatives |
| B | Scimitars — ten alternatives |
| C | Scythes — ten alternatives |
| D | Hammers — ten alternatives |
| E | Shields — ten alternatives |
| F | Cards — ten alternatives |
| G | Leaves — ten alternatives |
| H | Additional Cleansed fire — ten alternatives |

**0 is a real option, not absence.** Every selection code has one letter and two
digits. `A34` selects sword object 3 and effect 4. `A00` selects object 0 and
effect 0. Each category contains all 100 combinations, 00–99. Ten initial examples
pair matching digits: A00, A11, A22, …, A99.

An isolated view hides a layer; it does not replace its digit with “none.” The
object-only tile labeled `A30 · object view` shows the object from A30 while its
effect is hidden. `A04 · effect view` shows effect 4 while object 0 is hidden.
The component IDs `A.object.3` and `A.effect.4` and their file paths identify the
independent assets without ambiguity. You can keep objects, effects and assembled
combinations separately, and keep as many as you like.

## Style and reuse

The latest supplied Counter / Sweep / Sundering Art / Smash / Strike screenshot
is the visual target: worn weighty painted objects, strong diagonal placement,
dark material planes, close framing and directional local effects. It supersedes
the polished full-object sheets from the earlier proposal. Card borders, costs,
names, rules and other details are outside scope.

Objects and effects were generated on transparent source sheets, then exported
as individual PNGs. The sheets are provenance, not the deliverable format. PNG
normalization only crops, resizes and pads generated pixels; it does not invent
new art or remove a painted background. The exporter verifies the alpha channel.

The orientation miniatures rotate the exact same PNG −25°, 0°, and +25°. These
are two-dimensional rotation references, not additional three-dimensional camera
views. Once a candidate is chosen, its shared PNG is reused in every composition.
The alternative objects are candidates to select among, not replacements silently
swapped by card name.

**Cleansed is actual fire** with a warm ivory core and amber edges. Its base flame
and its secondary smoke/spark effects are separate files. No leaf icon stands in
for cleansing fire.

## JSON transform contract

`assets` owns each PNG's metadata and default transform. `compositions` references
those assets with layer overrides; it does not duplicate the pixels. The layer
stack is background → backEffect → object → optional secondaryObject → foreground. The two effect layers
may reference the same effect PNG but keep independent visibility and transforms.

`x` and `y` locate the image's center anchor in the **512×640** art crop. `width`
and `height` define its element box before scaling; `object-fit: contain` preserves
the PNG's aspect ratio. `rotationDeg` is clockwise. `scaleX` and `scaleY` allow
independent scaling. Defaults use a centered anchor `{ "x": 0.5, "y": 0.5 }`.

For example, an object transform can be:

```json
{
  "x": 256,
  "y": 320,
  "width": 460,
  "height": 460,
  "rotationDeg": -25,
  "scaleX": 1,
  "scaleY": 1,
  "opacity": 1,
  "blendMode": "normal",
  "anchor": { "x": 0.5, "y": 0.5 }
}
```

Its CSS includes:

```css
position: absolute;
left: 50%;
top: 50%;
width: 89.84375%;
height: 71.875%;
object-fit: contain;
transform-origin: 50% 50%;
transform: translate(-50%, -50%) rotate(-25deg) scale(1, 1);
opacity: 1;
mix-blend-mode: normal;
```

Numeric transform fields are authoritative. The viewer derives CSS from them
and includes the resolved CSS in **Export kept choices + edited JSON**. When
hand-editing defaults, regenerate the corresponding CSS instead of keeping two
contradictory values. The export includes the active composition plus all kept
compositions and assets. The full catalog remains in `cutout-manifest.json`.

Backgrounds are independent choices, not encoded into the two object/effect
digits. Each PNG also records its source-generation sheet hash and cell coordinates
for provenance. Generated source files remain in `/workspace/generated_images`;
the portable ZIP requires only the exported PNGs.

## Scope

The latest quantity clarification supersedes the earlier category-based counts. This round provides ten variants of each of seven core object families, plus Cleansed fire. The ten requested card types reference these shared families in `cardTypes`; they do not each receive ten unrelated mixed props.
Ten-option studies of every element/status family are deferred. Existing combat
identity mappings are referenced from the earlier catalog; no game IDs, mechanics
or card details are changed. These are real reusable proposal assets, not assets
already integrated into the game renderer or published to the art pack.


For Counter, use two independent object layers referencing E (shield) and A (sword). The optional second-object control can overlay any shared object, with its own visibility, position, size and rotation. Select it in Edit layer to adjust it. Spell, Power and Consumable object choices remain proposals within these seven families; orb, bottle and other new families are not part of the 70-object count.


## Verification

`python3 validate-cutouts.py` checks all 170 PNG files, real alpha, dimensions, hashes, 70 core-object counts and 800 combinations. Browser checks covered all families, image decoding, independent transforms, a second object, visibility, multiple kept choices, JSON download, persisted edits and 390px layouts. Existing combat identity validation also passes.
