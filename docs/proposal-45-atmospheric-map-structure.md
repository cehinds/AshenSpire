# Proposal — map structure in the atmospheric palette (#45)

*Freja Falk, 2026-08-06, at `dev` = `70d35e2`. A proposal, not a change: the shipped
palette is untouched by this branch. Sunna has ruled the floor; this feeds the
look-call, which is Constantine's.*

## What is being remedied

With High contrast OFF — the opt-out "atmospheric" palette — the act map's structure
falls below every defensible floor. Measured from rendered pixels by
`tools/contrast-audit.mjs` (extended on this branch, targets observed red first):

| target | atmospheric (rendered) | default (rendered) | floor |
|---|---|---|---|
| map edge (untraveled road), stroke vs field | **1.93** | 4.16 | 3.0 |
| map node ring (plain), worst adjacency | **1.72** (vs own fill) | 3.70 | 3.0 |
| map node body, fill vs field (median) | 1.17 | 1.17 | see ruling |

**The ruling this answers (Sunna, #45):** 3:1 on each glyph's **identifying boundary**
against **each adjacent rendered colour**. The node's identifying boundary is its ring
(judged vs fill AND vs field); the edge's is its stroke vs field. The fill owes no
independent floor while the ring clears both sides — it is measured as a watch-number
(`KNOWN_BELOW`, with the ruling as its why). Inadmissible remedies, per the same
ruling: lowering the opt-out target, exempting it from audit, state-dependent cues,
fog alpha over a sub-floor line.

Note the ruling bites harder than the token math I filed: the worst rendered adjacency
in the atmospheric palette is **1.72** (ring vs its own fill), below the 1.94 headline.

## Constraints the candidates hold

1. **≥3:1 per rendered adjacency** for edge stroke (vs field) and node ring (vs fill,
   vs field) — with margin, because antialiasing only ever takes; render sits at or
   below the token.
2. **The palette's intent survives.** Atmospheric means dimmer than High contrast —
   every candidate stays measurably below the hi-contrast structure value
   (`#85714f`, 4.19:1 vs field), and stays in the same warm grey-umber family as the
   current `#4a4034` (r>g>b, low saturation). The two settings must remain two looks.
3. **Atmospheric elsewhere.** `var(--line-soft)` has **27 consumers** across
   `styles/` (23 in ui.css, plus base/combat/map). Structure is therefore delivered
   through a **scoped token**, not a global brighten:

   ```css
   :root            { --map-structure: <candidate>; }
   body.hi-contrast { --map-structure: #85714f; }   /* unchanged shipped value */
   /* map.css: .map-edge and .map-node circle stroke use var(--map-structure) */
   ```

   Dividers, subtle buttons, table rules — every text-adjacent soft line — keep the
   atmospheric `#4a4034` exactly as shipped. Only the roads and rings brighten.

## Candidates — WCAG ratios computed from the values (re-runnable from the hex)

Field = `--bg #0d0b08`; node fill = `--panel #241d15`; shipped hi-contrast structure =
`#85714f` (4.19 vs field / 3.54 vs fill, token).

| candidate | value(s) | vs field | vs fill | margin over 3:1 | note |
|---|---|---|---|---|---|
| current | `#4a4034` | 1.94 | 1.64 | fails both | what is being remedied |
| **R1 — one step** | `#786952` | 3.69 | 3.12 | thin on the fill side | dimmest admissible umber |
| **R2 — margin** (recommended) | `#7a6b54` | 3.80 | 3.22 | real, both sides | **rendered-verified: edge 3.78, ring worst adjacency 3.36** |
| **R3 — dim roads, sunken fill** | stroke `#70624d` + node fill `#171310` (`--bg-raise`) | 3.32 | 3.12 | real, both sides | darkest roads of the three; touches two values, and the fill change needs its own look-call |

R2 rendered verification: `--line-soft` (atmospheric block only) swapped to `#7a6b54`
in a working tree, `node tools/contrast-audit.mjs --profile hi-contrast-off` re-run —
edge 3.78 vs field, ring judged 3.36 on its worst adjacency (vs fill), both green;
tree reverted. Rendered ratios ran ~0.1–0.4 *above* the token math here because the
rendered fill medians darker than its token; the token numbers are the conservative
edge.

## Recommendation

**R2, delivered as the scoped `--map-structure` token.** One value, one new token,
zero reach into the 27 text-adjacent consumers, both adjacencies cleared with margin
at 3.22/3.80, and at 3.80-vs-4.19 the atmospheric map remains visibly the dimmer
sibling of the hi-contrast one. R1 if Constantine wants the dimmest legal roads and
accepts a 0.12 token margin on the fill side; R3 if he wants the moodiest roads and
is willing to open the node-fill look-call.

## Boundary

Computed ratios cover the plain ring, untraveled edge, and fill tokens; state
strokes (gold/blood/parchment) are untouched by every candidate and were not
re-measured. R1 and R3 are computed, not rendered-verified; the verification
protocol for either is the same one-line swap + audit re-run recorded above.
`body.cb-safe` does not touch these tokens (checked at #45); its interaction with a
future `--map-structure` should be re-checked at adoption.

— Freja Falk
