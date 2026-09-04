# Combat pose sprites — low-poly figures, built and posed in Blender

Eight poses per class — `idle`, `guard`, `attack1`, `attack2`, `attack3`,
`hit`, `kneel`, `down` — in the five tints. The owner asked for low-poly
versions of the four class figures for combat, made in Blender, while painted
per-pose art waits on image-generation quota.

```
node tools/component-refs.mjs
blender --background --factory-startup --python tools/lowpoly-blender.py -- build/lowpoly --palette build/components/palette.json
node tools/pose-sprites.mjs --in build/lowpoly --out art/poses
```

| file | what it is |
|---|---|
| `tools/lowpoly-blender.py` | the figures: a skin-modifier body over a stick skeleton, an armature with distance weights, class dressing as separate low-poly pieces, poses as world directions per bone |
| `tools/pose-sprites.mjs` | dyes and rims each render with the class-sprite functions, cuts below the floor, crops, encodes WebP |
| `pose-sprites.manifest.json` | one row per sprite: crop `offset`, `root` (pelvis) and `ground` line on the shared 720×900 canvas |

**Why a body and not cards.** The first attempt cut the paintings into flat
parts on joints. The owner rejected it: arms came out of the torso, poses were
wrong, cut edges showed. A skin mesh grown over one skeleton has no seams to
show — an arm is the same surface as the shoulder it hangs from — and an
armature moves it at real joints.

**Registration.** Every pose is rendered on one canvas with the floor at
`ground`; each crop records where it sits on that canvas and where the pelvis
is, so a renderer lines up every pose of a class to the same feet and floor
without a fixed frame that would shrink the idle to fit a lunge.

**Why `art/` and not `assets/`.** The bundler inlines every file under
`assets/` into the single-file game. These 160 sprites are 3.6 MB (4.8 MB
as base64) and nothing draws them yet; they move under `assets/` when the fight
draws them, and that move is the cost line in that change.

**Second pass.** The first bodies were tubes: uniform limbs, no shoulders, no
hips, blob hands. The skeleton now carries shaping joints (deltoid, biceps,
forearm, thigh, calf) with anatomical radii, every figure has boots and fists,
and the dressing is layered — two-tier mantles with gold studs, three-plate
pauldrons and tassets with gold edges, wrapped bracers, a split tunic flap, a
drooping hat brim. Ambient occlusion and a stronger key light give the facets
their read.

**Third pass.** Cloth pleats: lofted rings swing in and out so robes, skirts,
hoods, capes and mantle tiers hang in folds instead of smooth cones. Facet
variation: every face gets one of four lighter or darker copies of its
material, chosen deterministically, so a flat plane reads as low-poly facets
rather than a smear. The rogue got bulk (wider chest and shoulders, leather
shoulder plates, a third mantle tier) and a shorter hood; gold has a faint
glow; the staff's star core is lit.

**Fourth pass — part by part from the painting.** Each painting is broken
into its costume parts in `tools/lowpoly-components.json` (a crop box, the
bone it hangs on, its equipment slot: head, shoulders, chest, belt, coat,
arms, legs, feet, weapon). `tools/component-refs.mjs` cuts the reference
crops and samples each part's palette; `tools/lowpoly-blender.py` builds
every part as its own registered function, coloured from that crop (pinned
by eye where the painting's rim light fools the sampler), and `--parts`
renders each slot alone for a painting-beside-model table. Mantles now come
to hanging points with gold pyramids, hoods have a real opening with the
face in shadow, the starseer's brim droops and the crown bends, the reaver's
pauldrons are the painting's size, the rogue has trousers, a green tunic, a
split skirt, spiral-wrapped bracers and wider daggers.

**Limits, stated.** Stand-ins for painted poses, not the paintings: faces are
the concept's dark hood-void, cloth is flat colour. Joint weights are by
distance, so a deep bend can pinch; soft robes can clip a stepping leg.
