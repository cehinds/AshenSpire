# Combat pose sprites — low-poly figures, built and posed in Blender

Eight poses per class — `idle`, `guard`, `attack1`, `attack2`, `attack3`,
`hit`, `kneel`, `down` — in the five tints. The owner asked for low-poly
versions of the four class figures for combat, made in Blender, while painted
per-pose art waits on image-generation quota.

```
blender --background --factory-startup --python tools/lowpoly-blender.py -- build/lowpoly
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
`assets/` into the single-file game. These 160 sprites are 3.3 MB (4.4 MB
as base64) and nothing draws them yet; they move under `assets/` when the fight
draws them, and that move is the cost line in that change.

**Limits, stated.** Stand-ins for painted poses, not the paintings: faces are
the concept's dark hood-void, cloth is flat colour. Joint weights are by
distance, so a deep bend can pinch; soft robes can clip a stepping leg.
