# Class card actions

Four base-armour classes, eight card motions, 90 unique transparent poses.
Open the [atelier](../index.html) to select a class and card type, inspect every
frame, change game pace, test the red hit flash or download an editable project.

| Class | Melee | Physical ranged | Casting and magic ranged |
| --- | --- | --- | --- |
| Reaver | Two-handed greatsword; full crimson cape | Crossbow | Free-hand magic |
| Rogue | Twin daggers | Bow in left hand; right hand draws | Free-hand magic |
| Starseer | Staff | Magic default | Open book left; staff right, pointing upward |
| Herald | Unarmed | Magic default | Open book left; right hand casts |

`maneuver:attack/smash/sweep/counter/defend/ranged` selects the motion.
Spell-source/camp cards cast; ranged spells use `rangedMagic`. Defensive
maneuvers retain their guard/counter motion even when magical. Equipped gear
never changes these class defaults. Later weapon-tag combinations and the
three stance families are separate work.

Each sequence has five exposures and reuses its ready/contact frames. Normal
playback is 260 ms, Fast 160 ms, with impact at 115 ms at Normal. Heavy and sweep
attacks have separate preparation/contact/recovery art. Counter deflects before
riposting. Melee advances and returns; ranged stays planted with subtle recoil.
Instant/reduced motion settles without travel or hit flashing. Existing effects
and aura colours remain in use; the new silhouette supplies the outline mask.

## Rebuild and inspect

`python tools/alternative-card-actions-build.py` extracts connected alpha
silhouettes, retains their antialiasing, normalizes a common body scale and foot
anchor, writes both WebP tiers, portable Workshop/Pose Studio projects and the
hashed runtime registry. Run `node --test tests/alternative-card-animation.test.mjs
pose-studio/tests/base-actions.test.mjs tests/deck-card-animation-preview.test.mjs`
for source/portable-project/timing/routing checks.

Original source sheets and prompts remain in this folder. The older base-action
study is preserved outside `cards/`. Runtime copies live under
`assets-alternative/card-*.webp` and enter both common web packs and the portable
single-file edition through the existing alternative-art loaders. The Workshop
projects include body travel; Pose Studio projects carry the poses and effects
for effect editing. Their manual card bindings are empty because built-in card
routing is owned by the runtime model. Existing defeat artwork remains in use.
