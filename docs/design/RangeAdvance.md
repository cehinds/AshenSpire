# Optional engagement, Advance and Throw

Owner-approved direction, 2026-10-20. This is a normative amendment to SPEC §17
for Core; implementation follows in a separate PR. Current and Legacy retain
their historical mechanics.

## Policy and compatibility

New Core fights capture a versioned range policy. Authored, run-snapshotted
settings expose Range mechanics (default on), Advance SP per band (1), Reach
Precision bonus (1), and Throw Precision penalty (1). Off removes distance
gates, approach surcharges, range movement and range-dependent Precision extras;
ordinary Precision, Evade and Counter delivery/coverage rules remain. Settings
state their new-run scope. An active saved fight without the policy keeps its
historical behavior until it ends. The tested compatibility adapter may adopt
the new policy at the next newly created Core encounter, using the run's explicit
setting or authored default when absent; it never rewrites an active fight.
Unknown versions and malformed policy, engagement or action data are rejected.

## Engagement and coverage

Persist an unordered band for every opposing actor pair: 0 Melee, 1 Reach,
2 Ranged. Initialize it to the greater of the actors' starting weapon bands.
The designated primary active weapon determines the starting band; missing or
unarmed coverage defaults to Melee. Enemy starting bands are authored explicitly.
Pairs are unique and symmetric with known opposing actor IDs; retain inert
pairs after death until fight end and initialize summons without reusing IDs.
This is abstract engagement, not world coordinates or formation-grid movement.
Stance changes and weapon swaps never move a pair.

The committed source determines attack coverage: swords/daggers Melee,
halberds/chained weapons Reach, bows Ranged, from authored data, not name tests.
Use the existing source-weapon snapshot/identity, not another held weapon.
An independent card or spell delivery keeps its authored coverage. Only explicit
supported range-bypass traits, such as adequate reach/range override, waive
approach. Precision, animation, camp and the spell Target tag do not imply it.
A bypass does not move the pair.

## Advance and Throw

For each affected opponent, missing bands are
`max(0, engagement band - attack coverage)`. Automatic Advance costs the greatest
missing count across targets times the SP-per-band setting. At defaults this is
+1 SP for Melee to Reach, +2 SP for Melee to Ranged, and +1 SP for Reach to Ranged.
Apply it after all base-card reductions; reaction/stance discounts cannot reduce
it and it never costs MP. Pay once per action, not per target or hit. It is a
temporary green action modifier, never an automatically generated card. Approach
reduces effective distance for that action and its nested reactions without
changing persistent engagement. Restore the outer context after each reaction.

A Reach weapon gains the configured flat Precision bonus at actual persistent
Melee engagement, normal Precision at Reach. Temporary Advance cannot manufacture
this bonus. Precision changes hit chance only, never damage/protection bypass.

An explicitly Throw-capable weapon attack can instead extend coverage by one
band, capped at Ranged, with the configured flat Precision penalty and no Advance
surcharge. Within ordinary coverage, use the ordinary attack without penalty.
Beyond that one-band extension Throw is unavailable; ordinary Advance remains
available for the full gap. Never silently combine Throw and Advance or sacrifice
Precision. Advance is the ordinary out-of-range route; a player explicitly selects
Throw and sees its chance and full cost before commitment. AI follows a deterministic
authored route policy. Throw neither consumes equipment/ammunition nor adds hits.

## Transactions and reactions

One pure planner supplies legal routes, target-specific chances and total SP to
UI, solo/co-op play and AI. Validate source, route, targets and complete affordability
atomically. Refusal changes no card, resource, action, charge or gameplay RNG.
Random targets are sampled once using transactional RNG; an unaffordable action
discards that fork. Freeze source, targets, selected route, approach, effective
distance, Precision adjustment and paid cost in the accepted action receipt.
Reuse it across hits and serialized reaction pauses; do not reprice after a swap,
death or later movement.

A separate offensive Counter return has its own plan using the incoming action's
temporary engagement. A paid hand reaction quotes/reserves its known return
approach with the card payment, never charging it again. A previously armed or
automatic Counter without a reservation pays only its approach surcharge when
the return is accepted. If unaffordable, skip the offensive return before RNG or
consuming its return charge, keep defense already resolved, and continue the
incoming sequence. Failed returns must neither loop nor repeat incoming hits.

## Authored movement

Author Advance, Closing Dodge and Backstep through an explicit validated effect.
Do not generate movement cards after draw. Advance/Closing Dodge reduce the
selected opposing pair by one band; Backstep increases it by one, clamped 0..2.
Reaction movement may explicitly target the pending attacker. Changes persist
until further movement/fight end and affect subsequently accepted actions.
Movement does not reprice or invalidate an already committed multi-hit action;
its Evade/defense payload provides immediate protection. Other pairs change only
when explicitly targeted. Extend existing card identities where appropriate
without silently changing historical profiles. Movement uses ordinary authored
prices and does not inherit attack-only stance/damage triggers.

Enemy move sets need an authored closing option and deterministic affordable
selection, so low-SP melee enemies can approach ranged opponents over successive
turns instead of stalling. Do not fix this by silently inflating their SP pools.

## Presentation and acceptance

An unreachable selected opponent shows `Out of range · 0%`. The selected card
shows the remedy and resulting chance: green `Advance · +N SP`, or an explicitly
selected `Throw · -N Precision`. The cost display/confirmation includes the full
payable total; insufficient SP is visible. Distinguish unmodified 0% from the
chosen route's chance. Show distance relative to the selected opponent, rather
than one misleading global range per actor.

Standard effects use truthful amount tags, such as `Evade 1` or `Precision 1`.
Do not duplicate their explanation or automatic Entry bonuses in card prose.
Tags/inspection retain conditions, duration, target and exact live amounts;
outside combat qualify a value/formula that cannot yet be known. Prefer at most
three lines for ordinary effects using concise wording and semantic wrapping.
Never clip rules, split units from numbers, or shrink below the readable floor
to satisfy the preference.

Acceptance covers preview/payment/chance parity; one/two-band approaches;
explicit Throw and unsupported-route refusal; multi-target/multi-hit one-time
payment; each Counter payment path; movement timing; low-SP enemy progress;
co-op source ownership; special bypasses; toggle scope; old-fight continuation;
save/reload at reaction boundaries; and native touch/keyboard use with readable,
unclipped cards and route controls at narrow phone, landscape and desktop widths.
