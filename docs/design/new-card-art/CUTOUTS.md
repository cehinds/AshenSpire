# Actual PNG cutouts — selection set 07

Open [cutouts.html](cutouts.html) to select, layer, rotate, resize and keep multiple
choices. The downloadable `card-art-cutouts-v9.zip` includes the standalone
viewer, all PNGs and the JSON. Extract the ZIP and open `cutouts.html`
in a browser. It uses plain local scripts and needs no build step. If browser
policy blocks local files, run `python3 -m http.server 8765` in the extracted
folder and open `http://localhost:8765/cutouts.html`. Browser verification in
this environment used local HTTP because its policy blocks file URLs.

## Deliverables and codes

- **212 object PNGs:** the original 70, 50 later spellbook/weapon options, 12 components from existing artwork, and 80 objects in Q–X.
- An additional ten Cleansed fire objects, 120 effect PNG exports, and twenty separate background PNGs.
- Some compatible families reuse an effect source; effect exports are not claimed to be 120 unique effect designs.
- A–N and Q–Z object/effect PNGs use 512×512 transparent canvases. O uses 512×640; P preserves native 256×256 pixels. Backgrounds are opaque; object/effect layers have real alpha.
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
| I | Spellbooks — ten new open, closed and half-open alternatives |
| J | Swords II — ten new alternatives |
| K | Hammers II — ten new alternatives |
| L | Scythes II — ten new alternatives |
| M | Shields II — ten new alternatives |
| N | Counter — ten starting shield-and-sword pairs using M and J |
| O | Existing card art — ten reconstructed objects, effects and backgrounds |
| P | Native inventory sword and shield — two unchanged objects |
| Q | Broken swords — counterparts of J |
| R | Broken hammers — counterparts of K |
| S | Broken shields — counterparts of M |
| T | Ruined spellbooks — counterparts of I |
| U | Sweep scythes — ten new intact candidates |
| V | Magic scepters — ten bases with stone-head anchors |
| W | Broken scythes — counterparts of L |
| X | Broken scimitars — counterparts of B |
| Y | Ethereal melee — V scepter + separate weapon overlay |
| Z | Ranged magic — V scepter + separate projectile overlay |

**0 is a real option, not absence.** New weapon groups reuse compatible earlier effect files; isolated effect tiles retain the original component letter. Every selection code has one letter and two
digits. `A34` selects sword object 3 and effect 4. `A00` selects object 0 and
effect 0. A–O and Q–Z contain 100 combinations each, 00–99. P has two native objects and ten effects: P00–P19. Ten initial examples
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

The original seven families and Cleansed fire remain available with their existing IDs. Revision 4 adds 50 objects in I–M and Counter presets in N. The ten requested card types reference these shared families in `cardTypes`; they do not each receive ten unrelated mixed props.
Ten-option studies of every element/status family are deferred. Existing combat
identity mappings are referenced from the earlier catalog; no game IDs, mechanics
or card details are changed. These are real reusable proposal assets, not assets
already integrated into the game renderer or published to the art pack.


For Counter, use two independent object layers referencing E (shield) and A (sword). The optional second-object control can overlay any shared object, with its own visibility, position, size and rotation. Select it in Edit layer to adjust it. Spells now use the I spellbook family. Orb and bottle families are still outside this expansion.


## Verification

`python3 validate-cutouts.py` checks all 362 PNG files, real alpha, dimensions, hashes, 212 physical objects plus ten cleansing fires and 2,520 combinations. Browser checks covered all families, image decoding, independent transforms, a second object, visibility, multiple kept choices, JSON download, persisted edits and 390px layouts. Existing combat identity validation also passes.


## Counter pair codes

`N34` means starting pair 3 with effect 4: `M.object.3` is the shield and `J.object.3` is the sword. The sword sits behind the shield. Both remain standalone PNG files with independent position, rotation, size, visibility and opacity. N never introduces a flattened shield-and-sword image. Replacing the optional sword is an override saved in exported JSON.

## Rebuilding the expansion

`export-cutouts.py` rebuilds the original revision 3 catalog. For revision 4, run `expand-cutouts.py --family I` (then J, K, L and M) using `generation-sources-v4.json`, and run `expand-cutouts.py` to assemble the expanded manifest. Source sheets remain provenance; object crops follow complete connected-object bounding boxes to avoid clipping objects that drift across nominal grid lines. `package-cutouts.py` builds the current portable ZIP.

## Existing-art reuse (revision 5)

Open [source-breakdown.html](source-breakdown.html) to compare original artwork, individual PNGs and recompositions. O digits 0–4 are silver-blue Attack, Smash, Sweep, Defend and Counter; digits 5–9 are their red-black variants. Their sources are the repository's actual `assets-mobile/cards/library/physical-*-01/03-1024.webp` files. Despite the filenames, these local light-tier images are **480×720**. Source release: `hd-assets-v23`.

The original cards are flattened. O components are image-edit reconstructions referenced to that artwork, not exact recovered source layers. Backgrounds contain reconstructed obscured pixels; object proportions and fog may differ. Object crops preserve complete silhouettes and normalize them onto transparent canvases. CSS transforms remain editable. Counter reuses a matching Attack sword behind its extracted shield; it does not claim to recover the original occluded sword.

P converts `icon_straightSwordInventory2026.webp` and `icon_kiteShieldInventory2026.webp` to PNG without altering decoded RGBA pixels, verified byte for byte. These remain 256×256. No matching painted spellbook was found in the existing library, so the I spellbooks remain the proposal options.

Every new asset records its source path, original asset ID, source SHA-256, conversion/reconstruction method and CSS transform. Source copies are included in the portable pack. `reuse-v5.json` records the audit choices; `generation-sources-v5.json` records reconstruction sheets. Run `reuse-cutouts.py` against revision 4 or 5 to rebuild the new entries while preserving A–N. Then run the validator and package script. Source generation files live outside the portable pack.

## Broken variants and scepter magic (revision 6)

[expansion-v6.html](expansion-v6.html) shows the new 80 objects, intact references for the 60 broken versions, and assembled magic previews. Broken variants preserve recognizable designs and carry `intactAssetId` plus the original asset hash. They are generated interpretations, not pixel-identical edits. This is a visual condition only; no gameplay status is introduced.

**Scythes are preferred for Sweep (`U`); scepters are preferred for magic (`V`).** Spellbooks remain alternatives. `Yxy` uses V scepter x with ethereal effect y: digits 0–4 are sword, hammer, scythe, scimitar and shield ward in blue; 5–9 repeat the shapes in violet. `Zxy` uses the same scepter x with a separate elemental projectile y. The ranged composition contains one scepter and one projectile above its background; no projectile is baked into the object.

The scepter has a normalized `anchors.stoneHead` and each magic overlay has `anchors.emissionRoot`. `attachment` connects those points. `layer-math.js` resolves parent translation, rotation, scale and size into an affine CSS matrix. The matrix also supports unequal scales without losing alignment. Child rotation is relative to the scepter while attached. The stone and projection remain separate PNGs and JSON references.

In the composer, select the foreground layer to toggle **Attach magic to scepter stone**. Disabling it preserves the current world position and affine pose. Changing X or Y also detaches it. Rotation/scale edits after detaching establish a new independent pose. Reattaching restores the prior relative overrides. Ranged projectiles use an explicit forward offset to read as fired shots. Resolved exports include CSS, matrix, attachment point, anchor data and source references.

`tagReferences` uses IDs from the pinned combat catalog. The ten projectile visual proposals are Divine, Necrotic, Force, Earth, Frost, Fire, Lightning, Psychic, Alteration and Wind. Necrotic and Wind have no exact matching element identity in that catalog, so their metadata uses existing spell/magic/ranged tags and explicitly marks the element as a proposal. No new gameplay tags are fabricated.

Rebuild individual sheets with `python3 expand-v6.py --family Q` (through Z), then `python3 expand-v6.py` to assemble. Run `python3 validate-cutouts.py`, `node validate-layer-math.mjs`, and `node validate.mjs`. `package-cutouts.py` builds the full portable pack. Generation source files remain external provenance. The source reference sheets are included in the pack. All 262 revision-five assets and 1,520 compositions remain unchanged.

## Annotated proportions and labels (revision 7)

The ten Y melee overlays now use broad blades and heads that surround the stone. The sword is longer and wider, the hammer has a large block head, and the scythe has a dominant hooked crescent. The scepter remains its handle. Their anchors sit inside the broad mounting heels, and Y compositions use larger per-shape transforms. Ranged projectile geometry stays unchanged.

Every component has `displayCode` and `displayLabel`; every composition has `displayName` and `displayLabel`. The gallery labels assembled art, backgrounds, base objects, magic overlays and intact references. Thumbnails and the full object overview also display code, name and role. Labels are outside the PNG pixels, preserving reusable transparent cutouts.

Y00 in an **assembled** title selects scepter 0 plus effect 0. Y01 in an **effect** label identifies effect 1 with object 0 hidden; V10 identifies scepter object 1 with effect 0 hidden. The explicit role disambiguates component and composition labels. The underlying IDs (for example `Y.effect.1`) remain authoritative in JSON. Zero is always a real option.

This revision replaces ten Y PNGs and keeps the other 352 PNGs unchanged. V names now identify their stones. Earlier full packs preserve the previous proposals. Saved custom placements remain available; reset a composition to adopt the revised default proportions. `revise-v7.py` rebuilds this revision from the source sheet recorded in `revision-v7.json`, after revision 6 has been assembled.

## Reference silhouettes and full grips (revision 8)

The ten Y overlays now depict the supplied models: O.object.0 sword, O.object.1 hammer, L.object.4 scythe (L40), O.object.2 scimitar and O.object.4 shield. Digits 0–4 are blue; 5–9 are violet. Their full outlines retain the original guards, shafts and pommels, with transparent interiors and flowing energy. Each weapon and physical scepter remain independent PNGs. The shield silhouette encloses the scepter as a ward.

The composition fits the scepter inside the spectral grip. Each shape has its own parent size, angle, stone position, relative projection angle and `referenceParentSize`; these remain editable numeric transforms in JSON. The foreground attaches to the gem and follows the parent's transform. Disabling attachment allows independent positioning. Reset a saved composition to adopt these defaults.

`references.baseAssetId`, `baseAssetSha256`, `sourceReference`, `referenceSha256`, source atlas hash and extraction crop identify each model and generated interpretation. `revision-v8.json` records the ten replacements. The PNGs were generated with alpha; export only crops, resizes and pads them. `revise-v8.py` rebuilds the set from the recorded external source atlases. Labels remain outside PNGs; zero is a real variant. The complete pack contains 362 PNGs and 2,520 compositions.

## Larger scythe projections (revision 9)

Y effect digits 2 and 7 now use `scaleX: 1.2` and `scaleY: 1.35` in all 20 scepter combinations. The projection anchor moves along the spectral shaft to keep the enlarged outline reaching the physical pommel. The assembly moves right to keep the full blade within the 512 × 640 art area. The original transparent PNGs are unchanged. Reset saved scythe placements to adopt these defaults. `revision-v9.json` records the change; `resize-scythes-v9.py` reapplies it after revision 8.
