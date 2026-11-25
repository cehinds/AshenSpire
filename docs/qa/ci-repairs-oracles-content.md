# Inherited CI repairs for oracles and card content

| Suite | Cause and repair | Verification |
| --- | --- | --- |
| Card value tag index | The fixture preceded the equipment and card content changes. Regenerated with the pinned unindexed implementation at `04adc68513b3f13f2b5c28702edce4ec513202a1`. The validation and error rows and oracle provenance match the previous fixture. | `node tools/card-value-index-oracle.mjs` then `node --test tests/card-value-tag-index.test.mjs`. 32/61 before and 61/61 after `516d0e4510b`. |
| Tree equivalence | Equipment commit `057fbe0905a` changed four Strength relics. Commit `15d221435dc` added Recurring and Deft. Assert the exact four trigger payloads and the two tag identities and their metadata. The pre-tree captures are intact. | `node --test tests/tree-equivalence.test.mjs`. 6/8 before and 8/8 after `b017147472d`. |
| Reward card ranks | `15d221435dc` added a character-level cap to the draft rank. The same tests now exercise level 1 with the rare boost ceiling, and level 5 with the original per-card track, high rank and deterministic offer assertions. | `node --test tests/core-card-ranks-draft.test.mjs`. 2/3 before and 3/3 after `a4c2792aeb`. |
| JS01 native, production and save baselines | The historical scenario creates a new run from an older profile that did not include the rules supplied by the game at creation. Explicitly supply the exact old derived-stat table and Poise data from `c18f0d0cdb6`, plus the old class-level stamp. Its original complete digest reproduces. The three current lanes use a new fixture from independent pre-feature Dev source archive `7dff4b03a1783054a4ed807f4d45db028b104343`. Its raw events and snapshots match the current tree at all five checkpoints in all three scenarios. The earlier captures remain available. | `node --test tests/core2-cleanup-baseline.test.mjs`. 3/8 before and 8/8 after. Native and production still compare before each fixture assertion. |

## Remaining replay checks

- `tests/engine-transaction-determinism.test.mjs` failed 22 of 25 cases. Source archive `c18f0d0cdb6` reproduces all 25. A scratch run with archived creation inputs restores 18 old cases; in the last four, combat adds Strength status damage that the older arithmetic did not apply. The old digests are intact.
