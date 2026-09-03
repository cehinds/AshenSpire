# AS-HD-040 — runtime evidence for the class art swap

Exact-head captures of the shipped class sprites in the real app, at the two
sizes `RUNBOOKS/art.md` §§145-150, 181-192 asks for, covering **all twenty
replaced files** — four classes × five tints — at both sizes.

```
node tools/screenshot.mjs --out <dir> --class-matrix                      # desktop 1440x860
node tools/screenshot.mjs --out <dir> --class-matrix --viewport 390x844   # phone
```

| file | shows |
|---|---|
| `*-class-<class>-<tint>.png` | that exact sprite, in the character builder |
| `*-combat.png` | a fight — see the finding below |

`<class>` is reaver, starseer, rogue, herald; `<tint>` is gold, ember, frost,
rot, grace. Each exists at `desktop-1440x860-` and `phone-390x844-`, so twenty
sprites become **forty captures**, plus two of combat.

Posed with `?shot=customize&shotClass=<id>&shotTint=<id>`, added in this change.
Without it the screen could only ever photograph the first class in the first
tint — evidence for one of the twenty replaced files.

**The matrix is read from `assets/sprites/class-sprites.manifest.json`, not
listed in the tool.** A hand-written list of twenty would be right the day it
was typed and wrong the first time a class or a tint is added, and the coverage
gap would reappear silently — which is how the first version of this folder,
photographing one variant of twenty, came about. The evidence set is the
inventory: add a sprite and the run that photographs it already asks for it.

Two things this set is checked for, rather than assumed:

* every capture is a **settled** frame (see the harness section below);
* the five tints of a class are **byte-distinct** from one another, so a tint
  that silently failed to apply would show up as two identical files.

## What capturing this actually found

**The class figure is not what you fight as.** `playerSprite()` in
`src/ui/assets.js:276` routes to `equippedFigure()` whenever the player has
equipment and the style is `rendered` — a different pipeline that composites
`assets/equipment/body_<class>_<set>.webp`. The combat captures show the
**Blender equipment body**, not the concept art. The class sprites appear on the
character builder, the style picker and the LAN lobby.

This corrected a claim already written into `CHANGELOG.md` — that the figure
"you pick and fight as" had changed. Half of that was wrong, and only
photographing it showed so.

**Rogue's combat body is still built on the Reaver rig.** `tools/equipment-blender.py`
maps `rogue → build_rogue` since #580, but `assets/equipment/*.webp` has not been
regenerated since, so the shipped bodies predate the fix. Closing it:
`blender --background --factory-startup --python tools/equipment-blender.py -- assets/equipment`.
Separate pipeline, deliberately not folded into this change.

**No shot state covered this screen.** `?shot=customize` had existed in
`src/main.js` for a long time and was never in `tools/screenshot.mjs`'s list, so
the one screen that draws the class figure at full size had **no photographic
coverage at all** — the sprites could be replaced wholesale and no capture would
show it. Added. Nine states in `main.js` are still uncaptured and are named there.

**The medallion sat on two of the four faces.** The sigil overlay was one shared
`top:53%` for all four classes — a claim that every figure keeps its chest at
the same height. True of the Blender builders, which were one rig in four
palettes; false of four separately painted figures. At 53% the disc landed on
the Starseer's face under the hat brim, and inside the Herald's hood opening.
The anchors are now measured per class in `src/content/classArtAnchors.js`
(Reaver 53, Starseer 62, Rogue 53, Herald 61) and emitted into the sprite
manifest as `anchor.medallion_center_pct`, so the inventory records the anchor
the game actually uses. The Starseer and Herald captures here are the proof;
Reaver and Rogue are unchanged, because 53% was already right for them.

A width-profile scan was tried first and abandoned: it finds the shoulder line
on the Reaver and the Rogue and is defeated by the Starseer's staff and the
Herald's halo, which widen the row profile far above the shoulders. Wrong on two
of four is the same defect with more machinery behind it.

**The capture harness was racing the fade-in, AND MY FIRST FIX DID NOT WORK.**
At the old 8s virtual-time budget, successive runs caught a different screen
mid-fade each time. I raised the budget to 20s and reported it fixed. Measured
afterwards over five full runs, **3 of 5 still produced one dim frame** — a
different shot each time — and raising the budget further does not converge it:
the capture fires when virtual time expires, not when the page is ready.

So the harness no longer tries to out-wait it. Shots marked `stable` in
`tools/screenshot.mjs` are **captured twice and kept only if the two frames are
byte-identical**; after four tries the run fails and deletes the frame rather
than committing one it cannot reproduce. Byte-identity is a real bar here —
measured across three clean runs, every `stable` shot is identical run to run.
**Across the two runs that produced this folder the gate rejected and retook
seven frames** — four on desktop, three on phone — every one of which would
otherwise have shipped as evidence.

Every exit that is not "reproduced" deletes both files, including the path where
the probe capture itself fails to launch or write. A nonzero exit does not undo
an unverified PNG sitting in the evidence folder; the file is what people look at.

Settled values, for anyone re-measuring: desktop 30.9–31.1, phone 32.1–32.5 mean
brightness; a dim frame reads 16–18. *(An earlier revision of this file said 39–41.
That number was wrong — it did not come from this measurement.)*

The animated screens — `map`, `combat`, `fx`, the ambient embers — cannot pass a
byte-identity gate and are not marked `stable`. **They still carry the race.**
Fixing it at source means waiting on a readiness signal from the app rather than
on a timer, which changes the shot states themselves and is not in this change.

## Boundary

Captures of the working tree at this commit, on Linux/Chromium. They show the
art in the real layout, at two sizes, for **every one of the twenty shipped
class sprites** — no variant is represented here by its generator rather than by
a photograph.

They are still not a QA verdict and they do not prove the game plays. What they
do not cover: one browser engine, one platform, two viewport sizes, and the
character-builder screen — the style picker and the LAN lobby also draw these
sprites and are not photographed here.
