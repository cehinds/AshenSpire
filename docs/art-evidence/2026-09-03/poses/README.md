# Full-body combat poses — generated sources

AI-generated paintings of the four classes in combat positions, made from the
approved concept designs so the poses match the figures the owner approved.
These are the SOURCES. Nothing here ships; the shipped sprite is cut from a
source by `node tools/pose-cutout.mjs`, which uses the same matte, dye and rim
as the class sprites (`tools/concept-cutout.mjs` exports them).

## Provenance (RUNBOOKS/art.md §11)

- Model: `gemini-3-pro-image` (Google Nano Banana Pro) via the ElevenLabs
  image service, flow `BVqsBGDnFY84dS2vSBOE`, 2026-09-03.
- Reference: the class's own approved concept
  (`docs/art-evidence/2026-09-03/concepts/<class>-concept-v1.png`), fetched
  by the service straight from this repository — no file was uploaded.
- Cost: ~1827 credits (≈ 18¢) per image.
- Licence: as the concepts — AI-generated for this project, CC0 (CREDITS.md).
- Prompt shape, for every frame: identity from the reference; full body head
  to boots; the named pose; single centred figure, nothing cropped; plain flat
  off-white backdrop, no floor, no shadow; rendering identical to the reference.

## What is here

| file | pose | notes |
|---|---|---|
| `rogue/guard-a.png` | Guard | weight back, daggers crossed — frame 1 and 5 of the attack strip |
| `rogue/idle-a.png` | Idle, take A | at ease, three-quarter |
| `rogue/idle-b.png` | Idle, take B | at ease, three-quarter — pairs with A for a breathing loop |

Three of twenty. The first three were framed 16:9 by the service's default, so
about 60% of each image is empty backdrop; later frames are requested at 2:3.

## The attack strip

Five frames that read as one motion and loop: **Guard → Attack 1 (wind-up) →
Attack 2 (strike) → Attack 3 (follow-through) → Guard**. Each attack frame is
generated with TWO references — the concept for identity and the previous
frame for camera, scale, lighting and foot placement — so the strip does not
jitter. Mirrored facings are a code flip, never a generated frame.

Evidence of the cut on the game's ground, both facings:
`docs/art-evidence/2026-09-03/poses-pilot-rogue.png`.
