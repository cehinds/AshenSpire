# AS-HD-040 — approved look reference: Rogue

**Owner ruling, 2026-09-02:** of the four frozen crops, only **rogue** carries the
approved look. **reaver, starseer and herald must be remodelled to match it.**

This supersedes the packet's recorded status. `SUCCESSOR-CONTRACT.md` §2 carried
the hub's *Proof Accepted · 20/20 gates · findings 0* for all four; that reading
is now known-wrong for three of them. See §4 below.

Verify with `node assets/classes/check-look-conformance.mjs`. The reference
envelope is re-measured from the pinned rogue blob on every run, so it cannot
drift away from the asset it describes.

## 1. The approved look, measured

From `8359517b` (rogue) at pin `62f6867a`, over pixels with alpha ≥ 200:

| trait | rogue | what it means |
|---|---|---|
| deep shadow, v<0.3 | **88.6 %** | the figure is overwhelmingly dark |
| highlights, v>0.5 | **4.0 %** | light is rare and earned |
| mean value | **0.153** | low-key throughout |
| mean saturation | **0.565** | high chroma, but crushed dark — rich, not bright |
| warm earth hue 20–80° | **78.1 %** | browns, olives, leather greens |
| gold accent | **0.6 %** | a clasp, not a costume |
| cool rim light 200–220° | **4.8 %** | the blue edge separating figure from ground |

**The look in one line:** deeply shadowed, richly saturated warm leather, lit by a
warm key and a cool rim, with gold used once.

The combination that matters is **high saturation with low value**. Turning the
brightness down on a gold-heavy design does not produce this; the hue family has
to change too.

## 2. How the other three miss

Ranked by distance from the approved look:

### starseer — 5 of 6 traits off (largest rework)
- **Hue family is wrong.** 13.0 % warm earth against rogue's 78.1 %; 61.9 % of the
  figure sits at 220–240° blue. This is a different palette, not a darker one.
- Too bright: 70.0 % deep shadow vs 88.6 %; mean value 0.264 vs 0.153.
- Rim light over-applied at 14.9 % vs 4.8 % — reads as blue body colour, not rim.
- Gold at 1.7 %, ~3× the reference.

### herald — 4 of 6 traits off
- **Brightest of the four**: 14.4 % highlights vs 4.0 %; mean value 0.274.
- **Gold at 3.7 %, ~6× the reference** — the halo and star sash are costume, not accent.
- Hue is flat: 80.9 % crammed into a single 20–40° band, where rogue spreads
  across 20–80° (41 % / 27 % / 10 %). Monotone rather than layered.
- Rim light already correct at 4.5 %.

### reaver — 2 of 6 traits off (closest)
- Too bright: 10.8 % highlights vs 4.0 %; mean value 0.215 vs 0.153.
- Hue family and gold restraint are already right (70.0 % warm earth, 0.8 % gold).
- Missing rogue's 60–80° olive band (2.8 % vs 10.2 %) — all steel, no leather.
- **Rim light already correct at 4.6 %.** The nearest of the three to conforming.

## 3. Already correct in all four — do not change

The cool rim light at 200–220° measures 4.5–4.8 % across every asset including
the reference. `tools/sprites-blender.py` names this convention in its header
("warm key + cool rim light"). It is the one thing the whole set agrees on.

## 4. What this ruling breaks

1. **`SUCCESSOR-CONTRACT.md` AC6 overstated its evidence.** It cited rogue-vs-reaver
   silhouette IoU 0.7052 as proof the Rogue/Reaver failure was fixed. Silhouette
   overlap cannot see a look mismatch: all four are upper-body torsos, so pairwise
   IoU sits in a narrow 0.6533–0.7990 band regardless of art direction. The
   original defect (rogue rendered from the Reaver rig) is genuinely gone, but IoU
   is not what shows it — the art differing is. AC6 should not be read as a look gate.
2. **The packet is not 4/4 approved.** Any downstream reading of *20/20 gates,
   findings 0* as covering the look of all four is wrong as of this ruling.

## 5. The blocker this exposes — no generator exists

`tools/sprites-blender.py` builds the class sprites procedurally in Blender. It
defines `build_reaver`, `build_starseer` and `build_herald`. Two facts follow:

- **There is no `build_rogue` anywhere in the repository.** `tools/equipment-blender.py:408`
  maps `"rogue": lib["build_reaver"]` — the original defect.
- **The pipeline renders 300×380.** No file under `tools/` emits 512×512.

So the four crops in this packet were **not produced by any pipeline in this
repository**, and the one asset the owner approved is the one with no builder at
all. Nobody can currently regenerate rogue — the approved look exists only as
80,807 bytes of PNG at blob `8359517b`.

This sharpens `SUCCESSOR-CONTRACT.md` §5.1 from a missing-paperwork item to a
reproducibility gap: per-file provenance is UNKNOWN *because the source is
outside the repository*, not because it went unrecorded.

**The pipeline covers exactly the three classes that need remodelling, and does
not cover the one that is correct.**

## 6. Scope note

`tools/**` is held by `lease-AS-HD-057-it-support`. This lease holds
`assets/classes/**` only. Editing the Blender builders — the natural way to
remodel three procedural figures — is not this seat's to do; the assignment is
the IT Manager III's.

What this seat can supply, and has: the measured target, the ranked deltas, and
a checker that gates any candidate against the approved look.

## 7. Reproducing

```
node assets/classes/check-look-conformance.mjs                # all four vs rogue
node assets/classes/check-look-conformance.mjs cand.png       # score a candidate
```
Exit code is 0 only when every scored asset conforms.
