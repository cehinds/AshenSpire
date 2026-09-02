# AS-HD-040 — UI crop / size / state receipt

Covers `docs/governance/RUNBOOKS/art.md` §10 (*Accessibility and responsive
notes* — crop/contain rules, aspect-ratio behavior, density/scale variants,
reflow, text-size interaction, touch targets, viewport extremes) for the frozen
four-crop successor packet.

This is one of the two items `SUCCESSOR-CONTRACT.md` §5.2 records as missing and
as blocking adoption. It is a **maker package item, not a QA verdict**, and it
adopts nothing: decision D1 authorises a proof-only successor.

- Evidence pin: `62f6867a` (git objects; the working-tree paths no longer exist
  on `dev` after the Hub rebuild `3e98769e`).
- Every number below is produced by `node assets/classes/measure-crop-state.mjs`
  decoding the pinned bytes. None is asserted by hand.
- Mask threshold: alpha ≥ 128, the same threshold the packet verifier uses.

## 1. Size

| class | canvas | aspect | content box (x0,x1,y0,y1) | content w×h | share of canvas |
|---|---|---|---|---|---|
| reaver | 512×512 | 1.0 | 156, 356, 79, 359 | 201×281 | 21.55 % |
| starseer | 512×512 | 1.0 | 170, 342, 57, 359 | 173×303 | 20.00 % |
| rogue | 512×512 | 1.0 | 130, 381, 85, 359 | 252×275 | 26.44 % |
| herald | 512×512 | 1.0 | 172, 340, 70, 359 | 169×290 | 18.70 % |

**Finding.** The figure occupies 18.7–26.4 % of the square it ships in. A slot
that renders the file at `contain` spends roughly three quarters of its area on
transparency, and the bottom 152 px is empty in all four (§2).

## 2. Crop / contain rules

Transparent margin inside the canvas, in source pixels:

| class | top | bottom | left | right |
|---|---|---|---|---|
| reaver | 79 | 152 | 156 | 155 |
| starseer | 57 | 152 | 170 | 169 |
| rogue | 85 | 152 | 130 | 130 |
| herald | 70 | 152 | 172 | 171 |

- **The bottom margin is 152 px for all four.** This is the shared deterministic
  cut at `y=359` that AC5 records; it is the evidence these are upper-body
  canvases and not full-body figures. It is a layout constant, not slack: a
  reader that trims it per-class breaks the shared baseline the four classes are
  aligned on.
- **Do not tight-crop to the alpha bounding box.** Sub-threshold alpha extends at
  most 2 px beyond the thresholded box (reaver top 2 px; every other edge 0–1 px),
  so a tight crop buys ≤ 2 px and destroys the shared frame. Crop, if ever, to the
  *shared* box across all four — never per class.
- Nothing extends below `y=359` at any alpha, in any of the four.

## 3. Aspect-ratio behavior

Widest and narrowest target aspect (`width ÷ height`) at which `object-fit: cover`
clips **no** thresholded content:

| class | min aspect (portrait limit) | max aspect (landscape limit) |
|---|---|---|
| reaver | 0.3906 | 1.4463 |
| starseer | 0.3359 | 1.2864 |
| rogue | **0.4922** | 1.4971 |
| herald | 0.3281 | 1.3763 |

**Shared safe band: 0.4922 … 1.2864** — portrait side bound by *rogue* (the
widest figure), landscape side bound by *starseer* (the tallest figure).

- A **square slot (1.0) sits inside the band**, so `cover` at 1:1 clips nothing
  for any class. 1:1 is the safe default.
- Outside the band, `cover` cuts the figure — the landscape limit bites first, at
  aspects wider than about **9:7**. A 16:9 slot (1.778) clips all four.
- `contain` never clips at any aspect, at the cost of the empty area in §1.

## 4. Density / scale variants

Only a 1× 512 px master exists; no 2× or 3× file ships in the packet.

| render density | largest slot that stays at or above native |
|---|---|
| 1× | 512 px |
| 2× | 256 px |
| 3× | 170 px |

Above those sizes the asset upscales. No downscale artefact is expected — the
source carries a real partial-alpha edge (2,787–4,812 semi-alpha px per file),
not a hard 1-bit matte, so it resamples cleanly.

## 5. States

`default` only. The packet ships one look per class.

`hover`, `selected`, `disabled`, `locked` and any focus treatment have **no
distinct asset and no catalog entry** — they are UNKNOWN, not "reuse default".
Naming them is a catalog decision, not a maker one.

## 6. Viewport extremes and reflow

Deterministic context proofs in the packet: 1× desktop `1440×900`, 3× mobile
`390×844`. Both viewports are verified by decode (AC7), not by filename.

- No proof exists for tablet widths, split-screen, landscape phone, or any
  viewport below 390 px. UNKNOWN.
- Reflow behaviour is a property of the card component, which does not exist
  yet. UNKNOWN.

## 7. Accessibility — recorded, not resolved

- **Semantic purpose / accessible name.** UNKNOWN. Whether a class portrait is
  decorative (empty `alt`) or carries the class identity to a screen reader is a
  catalog decision. The asset bakes no text, so no localisable equivalent is
  owed.
- **Contrast.** Not measurable from the asset alone: these are transparent PNGs
  and contrast depends on the card background the reader supplies. UNKNOWN.
- **Non-colour state cues.** Not applicable while `default` is the only state (§5).
- **Motion / reduced-motion.** Not applicable — static raster, no animation.
- **Text-size interaction.** Not applicable to the asset; it carries no text.
- **Touch targets.** The touch target is the card, not the figure. Card
  dimensions do not exist yet. UNKNOWN.

## 8. What this receipt does not close

1. **Per-file provenance** (`SUCCESSOR-CONTRACT.md` §5.1) is still absent.
   `class-assets.manifest.json` carries `provenance.blocking: true` on all four.
   Creator, method, licence, modification history and restrictions are UNKNOWN.
2. **The manifest/reader steward.** `class-assets.manifest.json` is the manifest
   half, on the path this lease holds. The reader belongs in `src/ui/**`, which
   this lease does not hold — assignment is the IT Manager III's.
3. Every UNKNOWN above. They are recorded so they stay visible as blockers; a
   green screenshot does not waive them.

## 9. Reproducing

```
node assets/classes/measure-crop-state.mjs           # table above
node assets/classes/measure-crop-state.mjs --check   # manifest vs pinned bytes
node assets/classes/verify-successor-packet.mjs      # the packet contract
```
