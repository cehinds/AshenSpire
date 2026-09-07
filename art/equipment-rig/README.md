# Painted equipment rig prototype

Issue #785. This isolated preview demonstrates reusable equipment attachment on
Reaver and Starseer. It does not replace live combat or change equipment rules.

Run from the repository root:

    node art/equipment-rig/serve.mjs 4291

Open http://127.0.0.1:4291/equipment-rig-preview.html. Choose equipment, play,
scrub the timeline, and enable joints to see each hand target.

## Asset and motion contract

- `parts/<class>/`: twelve painted puppet parts, shared by every loadout.
- `catalog.mjs`: character proportions and weapon grip metadata. Source image
  coordinates are measured in the existing 512px inventory artwork.
- `kinematics.mjs`: shared family keyframes, interpolation, weapon transforms and
  two-bone inverse kinematics. Item IDs never select a unique animation here.
- `renderer.mjs`: body assembly, per-frame grip solving, explicit drawing order
  and independent procedural effects. Weapon art is not baked into the body.
- `preview.mjs`: isolated controls. No imports into live game screens.

All motion frames use right-facing characters. Feet and lower-body artwork share
one planted anchor. Arms bend to their targets without changing bone lengths.
Two-handed equipment obtains its support-hand position by transforming the second
local grip through the same weapon transform, keeping both hands attached.
Sword and katana share identical blade keyframes. Greatsword uses heavy timing;
guard and cast have separate shared curves. Dual blades move the offhand through
an offset attack, while mixed and dual focus loadouts retain separate equipment
and effect transforms. Shield art draws in front of the torso.

## Add a weapon without drawing body frames

1. Supply transparent item artwork. This prototype reuses `icon_<id>.webp`.
2. Add a `WEAPONS` entry: name, family, grip `[x,y]`, tip `[x,y]`, and scale.
   Add `support` for a two-handed grip. These are presentation values only.
3. Add a preview setup selecting the item and optional offhand. Use `grip:'two'`
   only for the demonstrated two-hand configuration.
4. Run reach tests and scrub the entire action. Check the silhouette and handle
   angle, foreground fingers, item depth, and effect trajectory visually.

The katana is the included proof: its own artwork and coordinates reuse the
straight sword's movement without adding or changing any character frames.
New weapon families (a bow, whip, chain, etc.) need new motion constraints; they
should not be forced into the blade family just to avoid authoring.

## Add a character

Author a matching twelve-part skin and a `RIGS` entry with segment lengths,
shoulder positions, body anchors and part dimensions. Reuse the existing motion
families. Validate reach for all motion samples and visually inspect joins. A
non-humanoid needs another skeleton topology; this humanoid solver is not a
universal creature rig. Class-specific timings and footwork can be layered on
later without duplicating motions for each weapon.

## Art preparation

`masters/` preserves images made with the built-in image-generation tool. Prompts
and provenance are in `prompts.json`. The tool returned RGB checkerboards even
after a transparency edit. `normalize.mjs` removes only edge-connected pale
neutral matte and extracts each part; enclosed metallic highlights are retained.
Cropping and matte cleanup use Sharp. Inspect pale edges on dark backgrounds:
these are prototype cutouts, not final production mattes.

    node art/equipment-rig/normalize.mjs

Sharp and Playwright must be available to Node for the asset and browser scripts.
They are provided by this workspace's bundled Node dependency runtime.

## Validation

    node --test art/equipment-rig/kinematics.test.mjs
    node art/equipment-rig/playtest.mjs

The focused tests sample 4,848 character/loadout/action poses, check bone length,
reach, primary and support grips, idle closure, and blade motion reuse. Browser
checks cover all eight loadouts, playback and controls, desktop and phone
viewports, and edge clipping in 24 representative captured frames. Actual visual
review sheets are `inspection/reaver-motions.png` and `starseer-motions.png`:
rows are greatsword, shield guard, focus cast, katana; columns are 20%, 46%, 69%.

## Boundaries before production integration

Only the two base outfits are converted. The lower body stays planted; this does
not yet reproduce the approved lunges or full-body recoil. The closed gauntlet
covers the weapon handle; future near/far finger masks and alternative hand
angles would improve extreme poses. Inventory icons demonstrate attachment but
purpose-painted side-view held art will improve perspective. Foreground depth
is currently a renderer rule, not a per-frame depth track. Parry, bows, hit
reactions, stance persistence and live combat routing are not implemented here.

The production adapter must consume the canonical resolved loadout and legal
hand occupancy. It must not derive permission to one-hand a greatsword from
artwork or this setup list. Strength-based exceptions need authored game rules;
this prototype introduces no threshold and grants no gameplay eligibility.
