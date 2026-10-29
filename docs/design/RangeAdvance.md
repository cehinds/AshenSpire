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
The canonical primary/right active weapon determines the starting band, falling
back to an active left weapon and then unarmed Melee. Enemy starting bands are
authored explicitly.
Pairs are unique and symmetric with known opposing actor IDs; retain inert
pairs after death until fight end and initialize summons without reusing IDs.
This is abstract engagement, not world coordinates or formation-grid movement.
Stance changes and weapon swaps never move a pair.

The committed source determines attack coverage: swords/daggers Melee,
halberds/chained weapons Reach, bows Ranged, from authored data, not name tests.
Use the existing source-weapon snapshot/identity, not another held weapon.
For mixed-source actions, retain each planned contact's own source and coverage;
do not collapse a bow/dagger or weapon/spell combination to the first source.
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
reduces effective distance for that action and its nested reactions. Restore the
outer context after each reaction.

**Paid Advance persists (owner, 2026-10-25).** Once an Advance has been paid, it is
not paid again unless the enemy increases the distance again: when an action pays
a positive Advance, the pair is committed at the distance that action closed to,
for the player and for enemies alike, and later actions against that opponent
quote no Advance. The committed state is ordinary saved engagement state, so
saves, snapshots, forecasts and co-op seats all agree. Reaction contexts that only
borrow a temporary distance, and a prepaid reaction return, never commit.

**Enemy retreat (owner, 2026-10-25).** An enemy increasing the distance works like
Advance in the other direction: a `moveEngagement` card with `bands: 1` moves the
pair one band out (clamped at Ranged) and costs its authored SP, usually the
Advance price plus one (2 SP at defaults). Core authors a retreat card for each
enemy that starts at Reach or beyond. The enemy plans it only while the fight is
closer than its starting range, with a lower weight than its attacks, and never
twice in a row, so the player must pay Advance again but is never pushed out of
reach forever.

A Reach weapon gains the configured flat Precision bonus at actual persistent
Melee engagement, normal Precision at Reach. The Advance that an action pays cannot
manufacture this bonus for that same action (the committed distance applies to later actions). Precision changes hit chance only, never damage/protection bypass.

An explicitly Throw-capable weapon attack can instead extend coverage by one
band, capped at Ranged, with the configured flat Precision penalty and no Advance
surcharge. Within ordinary coverage, use the ordinary attack without penalty.
Beyond that one-band extension Throw is unavailable; ordinary Advance remains
available for the full gap. Never silently combine Throw and Advance or sacrifice
Precision. Advance is the ordinary out-of-range route; a player explicitly selects
Throw and sees its chance and full cost before commitment. A mixed-source action
offers Throw only if every planned contact is reachable without Advance; each
extended contact needs its own Throw-capable source and only those contacts take
the penalty. Paid hand Counter choices may explicitly offer the same Throw route
before payment. Unchosen automatic returns never silently Throw. AI follows a
deterministic authored route policy. Throw neither consumes equipment/ammunition
nor adds hits.

## Transactions and reactions

One pure planner supplies legal routes, target-specific chances and total SP to
UI, solo/co-op play and AI. Validate source, route, targets and complete affordability
atomically. Refusal changes no card, resource, action, charge or gameplay RNG.
Random targets are sampled once using transactional RNG; an unaffordable action
discards that fork. Freeze source, targets, selected route, approach, effective
distance, Precision adjustment and paid cost in the accepted action receipt.
Reuse it across hits and serialized reaction pauses; do not reprice after a swap,
death or later movement. The receipt covers the finite target envelope of the
root card/move/Counter and its inherited damage/status riders, including possible
conditional riders, as exposed by its quote. A condition failing later does not
refund approach. Descendants reuse that receipt without extra charges; a separate
accepted offensive action gets a new receipt. An unplanned hostile target cannot
receive free inherited reach or cause a late charge: it must belong to a separately
validated action. Preserve per-contact source/coverage within that root plan and
aggregate the greatest required approach once.

A separate offensive Counter return has its own plan using the incoming action's
temporary engagement. A paid hand reaction quotes/reserves its known return
approach with the card payment, never charging it again. This is a nonrefundable
payment for the attempted return, not an escrow: an incoming miss, uncovered hit,
death or other reason no return occurs does not refund it. Bind it to exactly one
incoming contact, attacker, defender and return; consume or discard it at that
contact's completion. A lingering prepared charge cannot reuse it for a later hit.
A previously armed or
automatic Counter without a reservation pays only its approach surcharge when
the return is accepted. If unaffordable, skip the offensive return before RNG or
consuming its offensive once-per-cycle/return-serial budget, keep defense already
resolved, and continue the incoming sequence. A defensive Counter charge already
consumed for interception stays consumed; never restore it on return refusal.
Failed returns must neither loop nor repeat incoming hits.

## Authored movement

Author Advance, Closing Dodge and Backstep through an explicit validated effect.
Do not generate movement cards after draw. Advance/Closing Dodge reduce the
selected opposing pair by one band; Backstep increases it by one, clamped 0..2.
Reaction movement may explicitly target the pending attacker. Changes persist
until further movement/fight end and affect subsequent independent root actions.
The active root's frozen engagement context, including its nested reactions and
Counter returns, remains authoritative until that root completes; then the
changed persistent pair supplies future action plans.
Movement does not reprice or invalidate an already committed multi-hit action;
its Evade/defense payload provides immediate protection. Other pairs change only
when explicitly targeted. Extend existing card identities where appropriate
without silently changing historical profiles. Movement uses ordinary authored
prices and does not inherit attack-only stance/damage triggers. With range disabled,
range-only cards are ineligible for offers/deck inclusion and any preexisting
instance refuses play without spending; combined Evade/movement cards retain their
ordinary defense while the movement effect is inactive. Do not sell a paid blank
movement card under the disabled policy.

Enemy move sets need an authored closing option and deterministic affordable
selection, so low-SP melee enemies can approach ranged opponents over successive
turns instead of stalling. Do not fix this by silently inflating their SP pools.

## Presentation and acceptance

An unreachable selected opponent shows `Out of range · 0%`. The selected card
shows the remedy and resulting chance: green `Advance · +N SP`, or an explicitly
selected `Throw · -N Precision`. The cost display/confirmation includes the full
payable total; insufficient SP is visible. Distinguish unmodified 0% from the
chosen route's chance. Show distance relative to the selected opponent, rather
than one misleading global range per actor. Route chances retain the existing
observer-knowledge projection; do not leak hidden enemy information.

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
