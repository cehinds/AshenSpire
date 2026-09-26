# Full-body class figures — generated sources

The combat figure the game ships is a **waist-up crop**. Its source
(`../../2026-09-03/concepts/<class>-concept-v1.png`) is a bust: it ends at the
ribs, which is why the packet's own receipt measures the figure at 18.7–26.4 %
of its canvas with 152 px of empty bottom in all four
(`assets/classes/CROP-SIZE-STATE-RECEIPT.md`). Owner, 2026-09-04: *"use full
body sprites"*, *"should be full body"*.

These are the SOURCES for the replacement. Nothing here ships; the shipped
sprite is cut from a source by `node tools/pose-cutout.mjs`, which uses the
same matte, dye and rim as the class sprites (`tools/concept-cutout.mjs`
exports them), so a full-body figure and the bust it replaces were cut by the
same code.

## Provenance (RUNBOOKS/art.md §11)

- Model: `gemini-3-pro-image` (Google Nano Banana Pro) via the ElevenLabs
  image service, flow `RMIA1mZgs2IZw91ShugZ`, 2026-09-04.
- Reference: the class's own approved concept, as the workspace asset the
  2026-09-03 packet uploaded (`tlgTl0R887jeLGVkNmRs` reaver,
  `GgB5OxtMRFUpeElZNZKi` starseer, `AZtJOPxCkc42xLrmOWxY` rogue) — the same
  bytes as the concept PNGs in this repo, so identity carries over.
- Cost: 1827.09 credits (18.27¢) per image, priced with `estimate_only`
  before the run and confirmed in each generation's own receipt.
- Licence: as the concepts — AI-generated for this project, CC0 (CREDITS.md).
- Prompt shape, for every frame: identity from the reference; FULL BODY head
  to boots with the boots and their ground-line both inside the frame; a named
  idle stance; single centred figure; plain flat off-white backdrop, no floor,
  no shadow; faceted low-poly rendering identical to the reference.

## What is here

| file | class | pose | figure after the cut |
|---|---|---|---|
| `reaver/idle-full.png` | Reaver | Idle — both hands on the pommel, blade grounded | 397×768 |
| `starseer/idle-full.png` | Starseer | Idle — staff upright beside him | 399×768 |
| `rogue/idle-full.png` | Rogue | Idle — a dagger point-down in each hand | 373×717 |
| `herald/idle-full.png` | Herald | Idle — standing square, hands clasped before the waist | 286×735 |

**All four.** The Herald landed 2026-09-23, after nineteen days in which every
retry was refused — first `free_tier_image_limit_reached`, then `quota_exceeded`
against a zero credit balance. All four now ship in ONE `--ship` run, which is
what the shared scale requires.

## The shed count measures the SOURCE, not the result

`dropGroundShadow` reports how many pale pixels it removed from the bottom band
of each source plate, and that number has been read as the quality bar — a clean
source sheds under ~100 px. The four cut together on 2026-09-23 say it does not
predict what actually ships:

| class | shed from source | pale rim left in the 450×570 sprite |
|---|---|---|
| Herald | **3955** | **133** |
| Reaver | 88 | 219 |
| Rogue | 3574 | **605** |
| Starseer | 78 | 230 |

The Herald's plate shed the most of any of the four and cut the *cleanest* — its
shadow was broad and diffuse, so the drop took all of it. The Rogue's sheds less
and leaves 605 px, nearly three times the clean pair, because its shadow has a
hard enough outer edge for the rim to trace under the boots. That traced rim is
the defect the owner reported, and it is visible in the shipped sprite rather
than in the shed count.

So a plate is judged on the **pale rim of the cut result**, against the ~220 px
the two accepted figures carry. A high shed is not by itself a reason to reject
a source, and a low one is not a pass.

## Why the fourth one blocked shipping

`tools/concept-cutout.mjs` frames every class at ONE SHARED SCALE — derived
from the tallest and widest figure across the whole set, so no class arrives
on the board bigger than another. Framing three and scaling the Herald against
a different set later would break exactly the property that scale exists to
hold. The frame itself (450×570) does not need to change: a 768 px full-body
figure fits it at the shared scale with side margin to spare.

Two things needed re-measuring once the fourth source landed:

- **Medallion anchors** (`src/content/classArtAnchors.js`). `medallionPct` is a
  measured per-class chest height, and it was measured on busts. The chest of a
  full-body figure sits far higher in its own frame; shipping without
  re-measuring would put each class's sigil somewhere it was never checked.
  A missing anchor means no overlay, which is the designed failure — so a
  wrong one is worse than none. **The Herald's is now an explicit null**: its 61
  was the bust's number, and 61 % of a full-body Herald is lower robe. It draws
  no medallion until someone holds candidate discs against the new painting.
  The other three keep the values re-measured on 2026-09-07.
- **The facing rule.** `styles/ui.css` mirrors every player figure via
  `.class-sprite { transform: scaleX(-1) }`. That rule is a weapon-socket
  correction for Blender-rendered layered art, and it argues its own safety
  from measuring the Blender bodies' silhouette symmetry at 0.0–0.3 %. The
  paintings it now governs measure 10.2 % (herald), 13.8 % (reaver), 40.7 %
  (starseer) and 61.3 % (rogue) — past the 14.9–16 % the rule itself calls
  "the armament, the thing that must move". It is stale on paper. It was left
  alone because rendering the board both ways showed that removing it points
  the figure's lead shoulder AWAY from the enemies. With these sources the
  question stops being a blanket flip and becomes what the 2026-09-03 README
  already specifies — *"Mirrored facings are a code flip, never a generated
  frame"* — driven by one fact: which side the fighter stands on against which
  way the frame was drawn.
