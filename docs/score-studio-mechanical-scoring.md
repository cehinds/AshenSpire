# Score Studio mechanical scoring

Card CP now uses the same neutral mechanical values as the static card face. The shared projection applies the existing profile, class reference, equipment and rounding before the unchanged scoring weights. Sampled combat damage, temporary stances and enemy mitigation do not define this baseline. Conditional effects and next-card charges retain their estimated reliability.

An authored amount is a model input. For example, Serrated Cut authored damage 8 and 7 both display 3 damage and have the same CP; authored 16 displays 5 damage and changes CP. Rebalance comparisons show the mechanical numbers. Generation, subclass preview/download/export, upgrade eligibility and the command-line report use this shared projection.

The official `combat-power` and `level-lists` builders refreshed only the existing 109 card rows and 181 item rows. Card membership and authored overrides remain intact. Of those card rows, 101 changed, including 96 CP values and 54 ranks. Item scores did not change. Act 1's derived card list changed from 90 to 86 entries; Act 2 from 109 to 108; Act 3 remains 109. These recalculated ranks affect reward eligibility. Scoring weights, costs, rarity discounts, authored cards and class pools were not edited by this refresh.

The 180 subclass cards remain an opt-in Studio catalog. They were not installed into the task checkout's canonical game content. A separate temporary fixture verifies export, both content pipelines, all four builders, idempotency and score agreement after reload. Forced low-rank recipes report an actionable miss or unavailable signature upgrade when their actual mechanical ceilings cannot accommodate the request; no CP pins hide that result.

Verification includes 900 requested-rank variants, 180 default authored upgrades with actual mechanical changes, shared renderer/export metadata checks, and the official freshness checks.
