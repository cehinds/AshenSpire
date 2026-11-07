# SPEC history — §3 Architecture

Archive of history, rationale and provenance moved out of SPEC.md §3 when it was made concise (2026-11-07). Nothing here is a current rule; the rules are in [SPEC.md](../../SPEC.md).

## 3.2 File tree

The previous edition of this section was a hand-maintained inventory that had drifted to 52 files listed against 92 shipped, four of them dead paths (the three pre-scrub class card files, renamed, and `floorplan.js` filed under `engine/` while it lives in `model/`; §6 cited the right path all along, so the spec disagreed with itself), while `tools/`, `content/source/`, `build/` and `dist/` were absent entirely. That count was measured at `267397a`, and `src/` held 94 two commits later. An inventory is a cache with no write event; it rots while nobody edits it. Hence the section states the layer contract and prints the real tree by command.

## 3.3 Domain model

- Relic `passives`: the relic schema's `passives` node and the passive list were separate hand-typed lists until A8, and only the schema enforced anything; now one home (`PASSIVE_TYPES`).
- Enemy cap: owner, 2026-11-03.
