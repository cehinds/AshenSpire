# Integration policy decisions for PR #2980

The owner authorized repairing inherited failures before promotion through dev, review and test. These are game-rule choices found during that work, not requests for another merge approval.

## Settled

- Resource and hand tuning: one increase per relevant attribute point.
- Damage protection: Block, then Ward, then Poise/HP.
- New Core progression: one class-primary point at levels 2, 6, 10, 14 and 18; one freely allocated point at 4, 12 and 20; one card rank-up at each level after creation. Existing saved progression remains intact.
- Starter policy: basic cards and starting armor are unranked; the rare weapon art starts at Rank 1. Existing saved card ranks remain intact.
- Damage at least 2.5 times Strike's damage per paid resource requires an HP cost, Exhaust or Ethereal. Existing authored HP costs remain.

## Awaiting owner answers

| Choice | Observed conflict | Answers offered |
| --- | --- | --- |
| Temporary attribute pools | Current combat attributes change ratings and hand rules, while old tests expect maximum HP/SP/MP to move too. Three W25 checks remain unresolved. | Keep pools unchanged; or change maximums without refilling current resources. |
| Version-1 gear saves | Original and later equipment tables share the same saved version. The old Sage robe expectation includes a flat group Mana bonus removed by the rework; the version alone cannot identify which table created a save. | Restore the original version-1 bonuses; or retain the current equipment rework. New runs can use a distinct version. |
| Reward repetition | Mana Surge occurs in 184 of 500 level-one offers (36.8%); the existing variety limit is 35%. Both required missing-stance selection and ordinary low-rank fallback contribute. | Reduce the low-rank fallback from 10% to 5%; or retain current reward odds. |

These dependent changes are held pending an answer. Independent source repairs, reviews and tests continue. No failing check has been waived, and the PR has not been merged.
