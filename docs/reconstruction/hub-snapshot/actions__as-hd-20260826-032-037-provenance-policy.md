# actions__as-hd-20260826-032-037-provenance-policy

> Recovered prose from the Review & Approval Hub's committed build output, extracted
> before that build output was retired. Source: `review-approval-hub/actions/as-hd-20260826-032-037-provenance-policy.html` at `docs/AS-HD-20260826-053-event0002`
> (PR #378). The Hub had no source on any branch, so this rendered text was the only
> surviving form. Issue #392 recorded this snapshot as the sole remaining source for
> the team census and could not locate it; this is that content, preserved verbatim.

P2 | AshenSpire — Review & Approval Hub
P2AshenSpire Review HubRead-only owner view
← All actions#032 / #037 · ALL-THREE-ABSENT PROVENANCE POLICY
Should the game guess when a character build is missing?
Three save fields preserve how the player built the character: the allocation method, the exact attribute values, and the rules snapshot. If all three are missing, the game can either refuse safely or invent a replacement from today’s class defaults.
Owner policy selected · Option 2 · Not implementedData Architecture + Main26 Aug 2026 · 20:14 AKDT
Illustrated quick read
A saved character is missing its attribute build
Imagine a customized Reaver whose saved HP, Mana, Actions, Draw, Stamina and related allocation facts are gone. The game must either protect the save and stop—or guess a replacement build.
Option 1 · RecommendedDo not guess
Repair only when a proven old save predates character builds.
If the save is current or its age is unknown, stop loading.
Keep the original save bytes unchanged and explain the problem.
Selected · Option 2Use today’s defaults
Create a replacement build from the current class preset.
The run may load immediately.
HP, Mana, Actions, Draw, Stamina, equipment eligibility and combat strength may change.
Decision recorded
SELECTED — Option 2 / B: also accept current-V5 all-three-absent saves and allocate the current class preset. The stable-ID architecture idea is recorded as a separate follow-up. No implementation, schema, source, migration, asset, integration, deployment, delivery, or release work is authorized by this record.
Quick read
The technical repairs already pass. This question is only about what the game should do with missing player-build data.
Constantine selected Option 2: current-V5 all-three-absent saves may receive today’s class defaults.
The stable-ID architecture idea is recorded separately for Data/App/Content review; it is not part of this policy authorization.
Details, limits, and authorization boundariesExpand when you want the exact technical context+Exact current statusThe all-three-absent positive case is synthesized from current V5. It does not prove a genuine historical writer shape.
Option A · RecommendedHeal only when the historical run version proves eligibility. Otherwise refuse without mutation.
Option BAlso accept current-V5 all-three-absent and allocate the current class preset.
Decision recordedConstantine selected Option 2 / B — use current defaults.
Owner follow-up · stable IDsKeep a stable character, class, or content ID while descriptive information and the mapped character asset may change independently. This is a separate Data/App/Content architecture request, not an implementation authorization.
Why this needs ConstantineOption B changes persisted-state compatibility policy and can silently convert a possibly corrupted current save.
Game Design fairness findingCustomized attributes are player-authored facts. Current-schema V5 was required to preserve them; allocating a class preset can silently replace authored mechanics.
Does not authorizeNo schema, save, runtime, source, fixture, integration, deployment, delivery, or release change follows from recording the policy choice.
Separate limitationsThis does not reopen #032/#037 fixture correctness or resolve the separate LAN/lobby all-members-refused visibility gap.
Exact compatibility rulingOpen more context ↗Game Design fairness recommendationOpen more context ↗Constantine decision receiptOpen more context ↗Return to all actionsOpen more context ↗Data compatibility ruling: SHA-256 5F7CFF155E78A0CC38D6019C169D20F713DA6DFB641C5E2C30A2D1AFCBE8D094. Game Design fairness recommendation: SHA-256 A6A0003EF60E41D74099D69E44556A37E0D619B6ED980F5B28058E4F642503AE.
