# AS-HD-040 — runtime evidence for the class art swap

Exact-head captures of the shipped class sprites in the real app, at the two
sizes `RUNBOOKS/art.md` §§145-150, 181-192 asks for, covering **every class** and
an off-default tint.

```
node tools/screenshot.mjs --out <dir>                      # desktop 1440x860
node tools/screenshot.mjs --out <dir> --viewport 390x844   # phone
```

| file | shows |
|---|---|
| `*-class-reaver.png` | Reaver, gold tint |
| `*-class-starseer.png` | Starseer, gold tint |
| `*-class-rogue.png` | Rogue, gold tint |
| `*-class-herald.png` | Herald, gold tint |
| `*-class-rogue-ember.png` | Rogue on the **ember** tint — the accent rim is not gold |
| `*-combat.png` | a fight — see the finding below |

Each exists at `desktop-1440x860-` and `phone-390x844-`. Twelve captures.

Posed with `?shot=customize&shotClass=<id>&shotTint=<id>`, added in this change.
Without it the screen could only ever photograph the first class in the first
tint — evidence for one of the twenty replaced files.

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

**The capture harness was racing the fade-in.** At the old 8s virtual-time
budget, successive runs caught a *different* screen mid-fade each time — mean
brightness 24 then 21, against 39.6 settled. A half-faded frame is not evidence,
and nothing about it looks wrong unless you measure. Budget raised to 20s; all
twelve captures here measure 39-41.

## Boundary

Captures of the working tree at this commit, on Linux/Chromium. They show the
art in the real layout, at two sizes, for every class and one off-default tint.
They are not a QA verdict, they do not prove the game plays, and the remaining
sixteen class×tint combinations are covered by the rim being generated from one
code path rather than by a photograph of each.
