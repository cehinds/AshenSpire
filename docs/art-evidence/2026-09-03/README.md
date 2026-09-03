# AS-HD-040 — runtime evidence for the class art swap

Exact-head captures of the shipped class sprites in the real app, at the two
sizes `RUNBOOKS/art.md` §§145-150, 181-192 asks for. Produced by
`node tools/screenshot.mjs --out <dir> [--viewport 390x844]`.

| file | shape | what it shows |
|---|---|---|
| `desktop-1440x860-customize.png` | desktop | **the class figure at full size** — painted Reaver, medallion overlay centred on the chest, class preview panel |
| `phone-390x844-customize.png` | phone | the same figure reflowed into the single-column layout, uncropped |
| `desktop-1440x860-combat.png` | desktop | a fight — see the finding below |
| `phone-390x844-combat.png` | phone | the same |
| `desktop-1440x860-title.png` | desktop | title screen, for context |
| `phone-390x844-title.png` | phone | title screen, for context |

## What capturing this actually found

**The class figure is not what you fight as.** `playerSprite()` in
`src/ui/assets.js:276` routes to `equippedFigure()` whenever the player has
equipment and the style is `rendered` — a different pipeline that composites
`assets/equipment/body_<class>_<set>.webp`. So the combat captures show the
**Blender equipment body**, not the concept art. The class sprites appear on the
character builder, the style picker and the LAN lobby.

This corrected a claim I had already written into `CHANGELOG.md` — that the
figure "you pick and fight as" had changed. Half of that was wrong, and only
photographing it showed so.

**Rogue's combat body is still built on the Reaver rig.** `tools/equipment-blender.py`
now maps `rogue` to `build_rogue` (landed in #580), but `assets/equipment/*.webp`
has not been regenerated since, so the shipped bodies predate the fix. Running
`blender --background --factory-startup --python tools/equipment-blender.py -- assets/equipment`
would close it; that is a separate change and is deliberately not folded in here.

**No shot state covered this screen.** `?shot=customize` has existed in
`src/main.js` for a long time and was never in `tools/screenshot.mjs`'s list, so
the one screen that draws the class figure at full size had **no photographic
coverage at all** — the sprites could be replaced wholesale and no capture would
show it. Added. Nine states in `main.js` are still uncaptured and are named in
that file.

## Boundary

These are captures of the working tree at this commit, on Linux/Chromium. They
show the art in the real layout at two sizes. They are not a QA verdict, they do
not prove the game plays, and they say nothing about the equipment pipeline
beyond the finding above.
