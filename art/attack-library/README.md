# Equipped animation studies

Experimental work for the existing equipment-animation task (issue #785), on
`codex/painted-equipment-rig`. It has not been integrated into combat, approved
for production, pushed, or merged. Open `animation-library-preview.html` through
the existing preview server (`node art/equipment-rig/serve.mjs 4291`).

## Design and implementation order

1. Resolve the action from the card/event, then the actual equipped hand
   configuration. The equipment system supplies effective hand requirements
   and any Strength-based one-handed allowance; presentation does not decide
   character eligibility. The workshop grip override is only a preview control.
2. Author complete painted body poses for each class, outfit, and motion family.
   Start every attack in guard. Use seven frames for this first batch: guard,
   preparation, windup, strike, follow-through, recovery, guard. Twin attacks
   alternate hands. Casting has gather, channel and release phases instead.
3. Attach interchangeable weapon images to per-frame grip sockets. Draw fingers
   over the grip and shield faces over their strap hand. Preserve the original
   painted body; do not stretch its arms with the rejected procedural rig.
4. Review representative weapon sizes and both normal and quarter-speed motion.
   Fix the pose family before multiplying it across the remaining outfits.
5. Complete weapon-specific families (cut, thrust, heavy swing, polearm sweep,
   bow draw/release, bash) and hand configurations. The current attack studies
   distinguish grip configurations, but do not yet distinguish all these
   techniques. An axe and a rapier must eventually select different techniques.
6. Finish casting, defense, reactions and separate effect assets. Only then
   connect the reviewed library and stance controller to live combat.

The attachment approach is comparable to the reusable slots described in
[Spine's skins documentation](https://esotericsoftware.com/spine-skins). That is
an architecture reference, not evidence that these drafts match professional
animation quality. Existing approved painted poses remain the visual reference.

## Action families

| Family | Planned variants and behavior |
| --- | --- |
| Attack | One hand with empty offhand, shield cover, offhand focus/tool; alternating twin attacks; two-handed weapons; bow; shield/tool bash |
| Cast | One-hand release; casting with an occupied offhand; two-hand channel; dual-focus casting |
| Guard | Weapon, two-hand, shield and parrying-dagger stances, retained when a guard skill is played |
| Block / parry | Short impact or deflection, then return to the currently retained stance |
| Dodge | Sidestep/backstep appropriate to free, occupied and supporting hands; equipment remains attached |
| Hurt | Light flinch and heavy stagger; free, occupied and two-hand grips |
| Negative status | Brief onset reaction, with persistent poison/burn/etc. effects on separate stackable layers |
| Buff | Activation gesture plus a separate effect layer; power cards retain their casting stance |
| Dice | Equipment-aware gesture plus independent dice objects; animation displays the game result and never rerolls it |

Additional useful families: interrupted cast, knockdown/get-up, defeat, healing,
item use, and victory. Critical-hit and miss feedback should usually reuse the
attack with different timing/effects rather than duplicate every body atlas.
Persistent status effects must coexist with attacks and defense, not immobilize
the character in a status animation.

## What exists in this batch

The catalog contains all 25 current armaments and all 16 outfits. Four outfits
are grouped together under each class in the preview. Fourteen source sheets
contain seven columns and four outfits each (392 drawn cells / 56 sequences):

| Class | Drawn studies, each in all four outfits |
| --- | --- |
| Reaver | Empty-offhand attack, shield-cover attack, offhand-focus attack, twin attack, two-hand attack, shield impact, hurt |
| Rogue | Empty-offhand attack, dodge |
| Starseer | Empty-offhand attack, one-hand cast, two-hand cast |
| Herald | Empty-offhand attack, buff |

The exact first frame closes each loop, so these are seven playback frames with
six distinct used drawings, not seven independently approved keyframes. All
raw seventh drawings remain in the masters for comparison. Missing sequences
are displayed as missing; no unrelated animation is silently substituted.
Registration completion is not art approval. No sequence is approved yet.

`action-resolver.mjs` also prototypes the requested retained stance: guard
skills and powers hold guard/cast until that character's next turn. Hurt and
block reactions temporarily override it. This controller is unit-tested but
is not wired into the game. Status and dice metadata are present; their effects
and missing body sequences have not been drawn.

## Asset contract and review limits

- Source RGB atlases and prompts are retained in `masters/` and `sources.json`;
  rejected revisions remain in `rejected/`. Absolute generation paths record
  provenance. Normalization falls back to retained masters on another machine.
- Normalized frames are 640 square, with common scale per sheet and a registered
  foot baseline. `manifest.json` records both hand sockets and foreground crops.
- Colored marks are temporary registration guides. Extraction is a prototype;
  residual colored edges, holes in open palms and uncertain sockets still need
  artist cleanup. Do not mistake a detected mark for a verified anatomical grip.
- Reaver closed/open hand parts are reused for compatible dark gauntlets. Gold
  Oathsworn keeps its own hands. Further hand angles and wrist blending are
  needed; the reused palms currently have only one orientation each.
- Current held items reuse inventory art. Grip coordinates are estimates for
  all 25 items. Grip-transform math is tested, but that does not certify every
  weapon/class/outfit combination visually. Bow strings, shield backs and
  foreshortened weapons need dedicated held-item variants.
- Two-hand placement matches the two sockets by scaling a support grip. This
  can change apparent weapon length between frames; use calibrated rigid grip
  spacing and authored per-family poses before production.
- Some frames have weak hand silhouettes or small outfit/silhouette shifts.
  Seven distinct poses alone do not establish fluid animation. Review contact,
  weapon arcs, weight transfer, foot sliding and guard-loop continuity before
  accepting a strip.

## Rebuild and verify

Run from the worktree root with `sharp` and `playwright` available to Node:

```powershell
node art/attack-library/prepare.mjs
node art/attack-library/prepare-hands.mjs
node art/attack-library/normalize.mjs
node --test art/attack-library/library.test.mjs
node art/equipment-rig/serve.mjs 4291
# In another terminal, while the server runs:
node art/attack-library/browser-check.mjs
```

The browser check uses installed Microsoft Edge and captures nine examples at
key moments, exercises normal and quarter-speed playback, checks a missing
sequence, and checks phone overflow. Captures and evidence are in `inspection/`.
These are interaction and inspection aids, not an automated visual-quality pass.

No generated game HTML, content tables, mechanics, or version files changed.
The full game's release checks must still run before any future PR is ready.
