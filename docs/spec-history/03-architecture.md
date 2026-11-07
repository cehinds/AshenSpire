# SPEC history — §3 Architecture

Archive of history, rationale and provenance moved out of SPEC.md §3 when it was made concise (2026-11-07). Nothing here is a current rule; the rules are in [SPEC.md](../../SPEC.md).

## 3.2 File tree

The previous edition of this section was a hand-maintained inventory that had drifted to 52 files listed against 92 shipped, four of them dead paths (the three pre-scrub class card files, renamed, and `floorplan.js` filed under `engine/` while it lives in `model/`; §6 cited the right path all along, so the spec disagreed with itself), while `tools/`, `content/source/`, `build/` and `dist/` were absent entirely. That count was measured at `267397a`, and `src/` held 94 two commits later. An inventory is a cache with no write event; it rots while nobody edits it. Hence the section states the layer contract and prints the real tree by command.

## 3.3 Domain model

- Relic `passives`: the relic schema's `passives` node and the passive list were separate hand-typed lists until A8, and only the schema enforced anything; now one home (`PASSIVE_TYPES`).
- Enemy cap: owner, 2026-11-03.

## 3.4–3.7 DSL, formulas, triggers, statuses

- Effect DSL: `addCinders` was renamed from `addRunes` (old id no longer accepted; no reader remains in src/ or content/).
- Stat table: `energy` row history: DEX weight 0.2 to 0.25 (A3, FINISH D28, 2026-09-27). HP defaults are the owner's +1 main-bonus defaults (2026-10-06). Mana rounding decision: owner, 2026-09-24, answering "Per attribute (keep)"; rounding the total was declined.
- Derived-stat ruleset 7: owner 2026-09-24; current defaults 2026-10-06.
- Status model: the ratings-meter variant (a break applying no status, growth by `breaks.thresholdGrowth` in `applyRatingImpact`) was retired with the ratings meter (#2633). The `statRowsVersion` marker is gone (no longer detected).

## 3.8 Procedural systems and equipment composition

- Armaments swap-cost and shelf vocabularies: A8/A7, Constantine 2026-08-08. Before A8, an `apply` value outside the closed set validated clean and silently did nothing. The product of the two swap-cost rule fields being total is proven by test 28q.
- A weapon's category is its tags, never a `swapCost` column, because a column would compel an author to restate what the tags already imply (Law 0 clause 1).
- Card ownership ruling ("if the item is not equipped, its cards are gone"): owner, 2026-09-03.
- Pool-deck extraction refusal: owner, 2026-10-02 (extracting would hand the run a free copy of what Sealed/Draft modes exclude).
- Smithing services priced in Smithing Stones, "free by the owner's word".
- Dodge Roll for everyone: owner 2026-09-24, widening the 2026-09-02 empty-hand rule.
- Complete armament kits: #904, 0.6.0.115 (proved in `tests/framework.test.mjs`).
