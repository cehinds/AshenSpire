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
| `pose-sprites.manifest.json` | one row per sprite: crop `offset`, `root` (pelvis) and `ground` line on the shared 1280×900 canvas |

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

**Fifth pass — measured against the paintings, and a route for painted
poses.** Every slot render was measured against its painting crop: the models
were sitting about twice as bright in median luminance as the art. The lights
came down (key 2.6 → 0.75, the orange rim 3.0 → 1.5, so it catches edges
instead of whole planes) and each class got a measured `TONE` factor that
scales its part colours in linear light. The whole set now sits within a few
per cent of the paintings' median. Shapes followed the same evidence: the
mantles are squared yokes that step down from the shoulder line to a V at the
chest (`yoke()`), not cones; hoods and the great helm are built from flat
planes (`loft(sq=)`); the face openings are hexagons with the hood's own lip
around them, matte black and specular-free; the gold pyramids sit corner-up
so they read as diamonds rather than squares; the rogue's chest is quilted with
seams laid on the surface; the reaver has a slitted visor, brass edging,
shoulder bosses and plate legs; the herald has a stole and rounder beads.

**Sixth pass — resolution.** The figures were built at the coarsest count that
still made a shape, and it showed: a hood was a seven-sided tent, a helm a
faceted bullet. `--res` (2.5 by default) now scales every ring count and
subdivides between the rings of a loft, and the body carries a second
subdivision level, so silhouettes curve instead of stepping. Faces still shade
flat and still take facet variation — this buys smoother outlines, not smooth
shading. Four-sided shapes are shapes rather than coarse circles, so pyramids
and blades keep their four sides at any resolution.

Resolution alone made the Reaver's ring-built pauldrons rounder rather than
better, so they were rebuilt: three shaped plates stepping down and outward
from the collar with a pointed outer corner and a brass edge under each,
bowed toward the camera (`curved_plate()`) so they catch light like armour.
The cape lost its slab shape for a drape that narrows at the shoulders and
flares to the hem.

**Cutting a painted sheet.** `tools/painted-poses.mjs` finds each figure, names
them in reading order and writes the same manifest the Blender script writes.
A figure ending above its row's floor keeps that gap. The floor comes from the
other figures in the row, so a sheet with one figure per row has nothing to
measure against and every pose stands on the floor; `--grid RxC` reads the
floors from the sheet's cells instead and recovers the lift. The tool says which
case it is on every run.

**Frame.** The canvas is 1280×900 with the floor at z = 0. It used to be 720
wide: a lunge with the greatsword reached past the right edge and the wind-up
reached past the top, so ten frames shipped with the weapon cut off. The
vertical span is what the orthographic scale fixes, so the extra width costs no
scale. The greatsword also lost 25cm, the follow-through steps less far, and the
Reaver's pauldrons hang off the spine rather than the arm bone — they are shaped
for the camera, and an arm swinging through a strike carried them out of place.

**These are the painted poses.** As of 2026-09-04 the sprites here are cut from
the owner's painted pose sheets, one sheet per class, nine figures on a 3x3 grid.
The modelled Blender figures they replaced are still buildable from
`tools/lowpoly-blender.py`; what is gone with them is `kneel` and `down`, which
the sheets do not carry and nothing draws.

Nine poses per class, named per class at cut time because the classes do not
idle the same way — a fighter stands ready, a caster stands. Reading the 3x3 in
order, the Rogue and Reaver are cut `stand, guard, attack1, attack2, attack3,
cast, hit, idle, idle2`, so their combat `idle` is figure 8, the braced stance;
the Starseer and Herald are cut `idle, guard, attack1, attack2, attack3, cast,
hit, brace, idle2`, so theirs is figure 1, standing. Combat ships six of the
names — `idle`, `guard`, the three attacks and `hit`.

Combat has the player facing right, and two Reaver figures were painted facing
left — the ones cut as `attack2` and `idle` — so those two are cut with
`--mirror`. Every other
figure in all four sheets is used as painted. Facing is read from the hood
opening, not from which way a weapon points: a wind-up pose draws the arm back
the other way and still faces forward.

```
# --poses names the 3x3 in reading order, and the two groups differ (above)
FIGHT=stand,guard,attack1,attack2,attack3,cast,hit,idle,idle2
MAGE=idle,guard,attack1,attack2,attack3,cast,hit,brace,idle2
node tools/painted-poses.mjs --sheet ROGUE.png    --class rogue    --out build/painted --append --grid 3x3 --canvas 560x680 --poses $FIGHT
node tools/painted-poses.mjs --sheet REAVER.png   --class reaver   --out build/painted --append --grid 3x3 --canvas 560x680 --poses $FIGHT --mirror attack2,idle
node tools/painted-poses.mjs --sheet STARSEER.png --class starseer --out build/painted --append --grid 3x3 --canvas 560x680
node tools/painted-poses.mjs --sheet HERALD.png   --class herald   --out build/painted --append --grid 3x3 --canvas 560x680 --poses $MAGE
node tools/pose-sprites.mjs --in build/painted --out art/poses
node tools/pose-ship.mjs
```

**Painted poses.** `tools/painted-poses.mjs` cuts a painted pose sheet — a
single image holding one figure per pose — into single-pose frames and writes
the same renders manifest the Blender script writes, so `tools/pose-sprites.mjs`
dyes, tints and encodes painted frames exactly as it does renders. It finds the
figures whether the sheet is transparent or flat, keeps small pieces (a spell
burst, a dropped blade) with the figure they belong to, and stands every pose on
one floor line.

`art/poses` is described entirely by its manifest, so every class and pose has to
be in the render folder before it is published — cut them all with `--append`,
then run the sprite step once. Publishing a folder that carries fewer than
`art/poses` already holds is refused rather than silently dropping the rest, and
that refusal counts poses, not only classes.

Every class in one manifest shares one canvas, and the first run would otherwise
set it from its own sheet alone — a later class whose lunge is wider is then
refused, with the frames already written too small to hold it. So name the canvas
up front, big enough for the widest pose of any class, and give every command the
same one:

```
node tools/painted-poses.mjs --sheet ROGUE.png    --class rogue    --out build/painted --append --canvas 1280x900
node tools/painted-poses.mjs --sheet REAVER.png   --class reaver   --out build/painted --append --canvas 1280x900
node tools/painted-poses.mjs --sheet STARSEER.png --class starseer --out build/painted --append --canvas 1280x900
node tools/painted-poses.mjs --sheet HERALD.png   --class herald   --out build/painted --append --canvas 1280x900
node tools/pose-sprites.mjs --in build/painted --out art/poses
```

1280x900 is what the Blender renders use, so painted sheets cut at that size line
up with them frame for frame. A run whose figures do not fit says the size they
need, so start there and raise it if it asks.

To replace only some classes, render the rest into the same folder first — the
Blender script writes the same manifest shape, so modelled and painted poses can
share one folder while the art is part-finished.

**Limits, stated.** Stand-ins for painted poses, not the paintings: faces are
the concept's dark hood-void, cloth is flat colour. Joint weights are by
distance, so a deep bend can pinch; soft robes can clip a stepping leg.
