REAR THREE-QUARTER WEAPON VIEWS - OCTOBER 6, 2026

25 newly painted rear-view masters cover all 28 canonical armaments.
Explicit existing aliases: frostSpear -> halberd, cinderAxe -> battleaxe,
duskChime -> boneSceptre. No additional named-variant design is claimed.

sources/<id>-rear.png contains the full-resolution transparent PNG masters.
sources/<id>.receipt.json contains each exact prompt, reference paths and
built-in image-generation output path. No CLI image API was used.
Image 1 preserved the painted weapon identity; image 2 established the
rear three-quarter character camera. Shields show inner backing and grips;
the skull sceptre shows the back of its cranium; other implements expose
their reverse surfaces while preserving their recognizable construction.

rear-weapon-views.spritepack.zip is the portable Sprite Workshop pack.
31 appearance projects cover 35 supported armor records, with 841 right/left
loadouts each (26,071 total), including empty hands. Source body/layer recipes
come from commit 4115a9c50d183abe64b897052ddd26da21f02a58 in the adjacent
class-armor-weapons-2026-10-06 package. That original pack is preserved.
The new pack ID isolates browser recovery from the previous artwork edition.

The normalized assets preserve aspect ratio and alpha on 512 x 512 canvases.
registration.json records manually authored painted grips and axis rotation.
Body, weapon and actual foreground finger pixels remain separate layers.
The v2 assembly follows the user-approved kite shield facing. facing.json
records all 28 orientation decisions: nine armament entries are mirrored
using Workshop's reversible layer.flipX about the grip; the kite is unchanged.
Both weapons draw first, hand cutouts next, and the complete body LAST,
making the full character the highest/frontmost layer in every loadout.
No source image is flipped or repainted. Use a Workshop with flipX support
(included in the updated local Editor) to retain the saved orientation.

VALIDATED
- 25 generated masters and 28 normalized armament assets.
- All 28 grip anchors lie on visible paint.
- No normalized-image clipping or clipping across 1,736 hand placements.
- All 26,071 poses pass Workshop schema and coverage checks, including
  50,344 grip-to-palm contacts and 126,759 separate layers.
- Review sheets show all 25 masters, all 25 designs held on every appearance,
  both hands for all five shields on every appearance, and 32 mixed
  loadouts across the four classes. Representative visual review only;
  every pose retains reviewed=false. These are editable idle art studies,
  not attack animations, physical 3D turntables or game runtime installation.

Use the running Editor at http://127.0.0.1:43287/ and choose
Poses & effects > Sprite Workshop > Bundled armor pack. The local Editor
bundle uses this rear-view edition. Individual source files remain here.

Rebuild with Python/Pillow and Node:
  python build.py
  node validate.mjs
  python review.py
  python checksum.py
Build/review reuse mechanical helpers from the preserved adjacent package.
validation.json covers pixels/bounds; geometry-validation.json covers poses.
SHA256SUMS.txt covers all package files except itself and bytecode caches.
