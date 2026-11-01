# FixCore owner decisions (2026-10-18)

The owner's answers to the sixteen FixCore questions (D1–D16), recorded
2026-10-18. "Owner" lines quote the answer as given. "Reading" lines are how
implementers apply it. A reading marked **open** waits on the owner and is not
a ruling. The question column is shortened; the questions the owner answered
carried the option details referenced below (e.g. D4 A, D6 `max(cost−1, 1)`,
D9 groups).

Contract: #2127 (merged). Implementation: #2129 `feature/FixCore`. Where a
#2129 assumption differs from a ruling below, the ruling wins.

| # | Question (short) | Owner | Reading |
|---|---|---|---|
| D1 | Core only (A) or Core + Current/v2 (B) | "a" | FixCore combat rules target the Core configured profile; Current/v2 untouched (except D16). |
| D2 | JSON modules/content are the one authority; tag-binding runtime is its own epic | "y" | Yes. |
| D3 | Add a Ward stage with physical/magical typing | "if core doesn't have damage typing, then remove ward then and just use poise" | Core's defense stages have no Ward and no damage-type split, but actions do carry a physical/spell `camp` (`combatMatchups.js`). Whether that counts as damage typing: **open**. Until answered: no Ward; Poise is the only protection pool. Owner, 2026-10-18 15:55: "I like ward I just want it toggled off in the json for now"; Ward is kept and switched off by `ward.enabled: false` in `content/source/fixCoreMechanics.json`. |
| D4 | Poise becomes a depleting pool restored by Block | "block restores poise" | Option A as asked (Poise becomes a depleting pool that Block restores); restore rule detailed by the owner under D13. |
| D5 | Matching-stance effectiveness 1.25 (A) or 1.0025 (B) | "A" | Matching-stance effectiveness 1.25: `stance.effectivenessMultiplier` in `content/source/fixCoreMechanics.json` (read by `src/model/stanceRules.js`). `advantageMultiplier` is a separate matchup modifier. |
| D6 | Matching-stance cost discount lane | "if it has mp then mp first, if it is only sp, then sp" | The question's discount `max(cost−1, 1)` applies to MP when the card costs MP; else to SP. |
| D7 | d20 + Precision vs AC, nat 1 miss / nat 20 hit, every attack | "yes" | Yes. |
| D8 | Perception base DC and hit-% badge gating | "A, so that it's easier to pass the perception roll so DC = 5 + int + wis" | Base DC 5; DC adds INT and WIS. Whose INT/WIS, the roll, and badge gating: **open** (see below). |
| D9 | Reward group weights; same for shops | "your call but I should be more likely to [get] more cards than equipment or relics, or shops, but I'd like to split that 30% so that shops are 15%" | Starting from the question's 60/10/30 (cards incl. weapon arts / weapons+armor+relics / potions), the 30 splits: potions 15, shop 15. Per offer slot; empty groups renormalise (as asked). |
| D10 | Rest before the boss | "there should always be 3 rest spots, with 1 guaranteed before the boss. Also, deck editing is now at will, so strategize should be removed. It should just be smith now. Level up will also be free at rest spots too. … just smith for now. with an option to go back, so no automatic end after choice. player will be given a continue instead" | Always 3 rest sites, one guaranteed before the boss. Exact floor (immediately before, i.e. the floor-8 option asked): **open**. Rest site: Strategize removed; Smith offered; level-up free there; no auto-close after an action, a Continue button leaves. Whether rest still heals: **open**. |
| D11 | Action pacing | "a noticeable (1 second by default) pause between what a character is doing, their animation, the result (hit or miss or blocked, or countered) then sprite reaction, then damage, then reset, then start loop with next on the stack" + "give me the option to edit the speed" + "auto combat … speed up the game to a configurable rate, default to 1.5" | Stages: action → animation → result → sprite reaction → damage → reset → next. 1 s default gap, player-editable. Auto-combat runs at a configurable ×1.5 default. |
| D12 | Auto-combat scope | "just for reaction choices for now, favoring appropriate reaction depending on player's perceived action being countered, if not known, then the last associated stance taken's card type" | Auto-combat picks reactions only (never plays the player's turn). Prefer the reaction that counters the perceived incoming action; if unknown, the card type of the last stance taken. Adapts to the player's previous choices. Overridden by the owner on 2026-10-26: auto-combat also plays the player's cards and ends the turn (`chooseCardPlay`). |
| D13 | Staggered | "make staggered be a stance for now … that reduces sp by 1 and adds 1 stack of vulnerable. repeated poise breaks can stack more vulnerabilities but that only increases duration for each subsequent stack. by default poise damage is floor(.2 of the total damage) inflicted and calculated before damage, however poise will not regenerate until a defensive card is played restoring poise to min(block, max poise) and adding block." | Poise break → Staggered stance: −1 SP, +1 Vulnerable. Further breaks add Vulnerable stacks that extend duration only (so damage stays ×1.25, never ×1.25ⁿ). Poise damage = floor(0.2 × damage), applied before damage. No passive Poise regen; a defensive card restores Poise and grants its Block. Restore amount: **open**, either set to min(Block, max Poise) as worded (which can lower Poise) or add Block to current Poise, capped at max (as "restores" and D4 suggest). Not a stackable status yet. |
| D14 | Armor budget | "make it 3 for now until rarity is added with the bonus being included but set to default of 0" | Armor budget 3; add a rarity bonus field, default 0. |
| D15 | Deck editing in combat | "equipment and deck editing only can happen outside of combat. buttons to change this will be disabled until combat is resolved. also if there is a new item in the armory then the outline should glow blue, instead of black." | No in-combat editing; the equipment and deck buttons are disabled until combat resolves. Armory button outline glows blue when it holds a new item (black otherwise). |
| D16 | Vulnerable 1.25 for both profiles | "yes vulnerable means target with vulnerable stacks receive 1.25 damage (and cards values and inflicted damage should update to reflect this change automatically)" | Vulnerable ×1.25 damage taken, both profiles; card previews and dealt damage reflect it. |

## Follow-up rulings (owner, 2026-10-18, 13:56 AKDT)

These settle every item that was open above. Where a reading above says **open**, this section wins.

- D3: "No Ward, Poise only". Remove Ward from Core; Poise reduces all damage (the physical/spell `camp` stays for matchups). Follow-up (owner, 2026-10-18 15:55): "I like ward I just want it toggled off in the json for now". Ward code stays; `ward.enabled: false` in `content/source/fixCoreMechanics.json` switches it off in Core 2.
- D13: "Add Block, cap max". A defensive card adds its Block to current Poise, capped at max Poise, and grants its Block.
- D10: "Heal + floor before boss". Rest sites heal, plus Smith and a free level-up; the guaranteed rest is on the floor directly before the boss.
- D8: "DC 5 + target INT + WIS + other bonuses". DC = 5 + target's INT + target's WIS + configured bonuses (default none); the observer rolls d20 + own WIS. Hit-% badge (owner, 13:59): "It shows when a card is selected that can inflict an effect or damage to a target, similar to how BG3 does it". The badge shows on each valid target while such a card is selected; Perception does not gate it.
- D9 (owner, 14:01): "chance a map node is a shop"; then "Keep 60/10/30". Reward groups stay cards 60 / equipment + relics 10 / potions 30. Separately, 15% of randomly typed map nodes are shops.
- One-tap (owner, 14:15 and 14:32): "make sure I don't auto play a card when I click on it once"; "keep the switch but make it default to not be 1 tap". A single tap selects; play needs a second tap or a target pick; the one-tap Settings switch stays, off by default.
- Alignment: "Yes, all". Bring Core 2 on `dev` (after #2129) in line with every ruling, one PR per ruling.

## #2129 assumptions that differ from these rulings

- Ward and damage typing (D3: remove Ward; Poise only).
- Same-stance effectiveness 1.0025 (D5: keep 1.25).
- Combat deck drafts taking effect next encounter (D15: no editing in combat).
- Shop node chance (D9: 15% of randomly typed map nodes; rewards stay 60/10/30).
- 2 rests per act, Strategize, level-up as an exclusive service (D10: 3 rests, one directly before the boss, Strategize removed, heal + Smith + free level-up).
- Autoplay of whole turns (D12: reactions only).
- Staggered as a stacking status with Weak and a skipped turn (D13: a stance, −1 SP, +1 Vulnerable, repeats extend duration).
- Poise loss = the 25% it prevented (D13: floor(0.2 × damage) before damage).
- Pacing 0.5 s, auto ×1 (D11: 1 s, auto ×1.5).
- Vulnerable 1.5 in the Current profile (D16: 1.25).

## Stance bonus reduction (2026-10-23)

Owner: "Update stance bonuses to reduce it to 1.25 instead of 2x".

Core matching-stance effectiveness and ordinary offensive stance advantage are
already 1.25. Reduce the remaining Core Smash-versus-Defend/Prepared damage
multiplier from 2 to 1.25, for players and enemies. This replaces the ordinary
advantage multiplier; do not apply both. Keep the 25% current-Block contribution,
50% total-damage Poise drain, flooring and all other stance effects. The current
JSON default and the fallback for a missing `smashVsDefensive` block must agree.
Persisted explicit rule values remain snapshots; this does not rewrite custom
configuration or historical non-Core profiles.

## Counter stacks (2026-10-31)

Owner: Counter becomes a stack badge. Playing a Counter adds the Block you hold
as `counterStacks` (owner, later 2026-10-31: no cap; they fade by 2 at each owner turn start, never below 0, and clear at fight end). A covered hit returns the
card's own damage plus 10% of the incoming hit per stack, replacing the old
floor(0.5 x incoming) share (the stance-advantage share and Block are unchanged).
In Counter stance a card-less auto-Counter answers a covered hit for 1 SP with
base 0, and a Counter reaction from that stance costs one less SP regardless of
the Adept gate. Reflect (see SPEC.md section 17) is a separate stack count.

## Reflect stacks (2026-10-31)

Owner: Reflect is its own stack count, `reflectStacks` (cap 10, cleared at fight
end), granted by the new Mirror Guard card (`applyReflect`). Each stack cuts an
incoming hit by 30% before Block (cap 90%, rounded down) and, once the hit lands,
sends 30% of the original incoming damage back as a flagged hit that cannot reflect
or counter again, costing one stack. Counter returns, reflected returns and
`unreflectable` hits are untouched. Values: `reflect` in `content/framework/mechanics.json`.

## Magic hits Poise first (owner, 2026-10-31)

- D17: "Magic damage hits Poise first and then Block; physical damage hits Block first and then Poise." Core (Ward off): the magic part of a hit meets Poise 1:1 (full amount as Poise damage), then the Block left after the physical part, then Barrier, then HP, with no further Poise absorb; the physical part is unchanged (Block, then the 75/25 Poise absorb). A mixed hit resolves physical first, then magic, on one shared Poise pool. Amends the 2026-10-25 Block-soaks-whole-hit order (SPEC §17) for magic; D3/D4/D13 are otherwise unchanged. Tested by `tests/magic-poise-first.test.mjs`.

## Precision as stacks, Evasion base 8 (owner, 2026-10-31)

- Owner decision: enemies hit too easily (any Precision of 1 or more hit 95% because the miss threshold was Evasion 1 + DEX). Core 2 only. Precision = 1 + statMix + stacks (was 1 + mix × (stacks + 1)); Evasion = 8 + DEX + gear + 2 × Evade stacks (was 1 + DEX + (1 + DEX) × stacks). The constants live in the `accuracy` block of `content/framework/mechanics.json` (`evasionBase` 8, `evadePerStack` 2, `precisionStackValue` 1, `precisionDecayPerTurn` 3, was 1 until owner 2026-11-01), read in `src/engine/stanceHit.js`, because the locked `fixCoreMechanics.json` cannot change. A stance entry grants exactly 1 stack; Precision loses 1 stack at the owner's turn start (Persistent exempt) and the badge tooltip is `accuracy.precisionTooltip` (the `statuses.json` Precision row feeds a locked mechanic manifest and is unchanged). SPEC §17 Accuracy paragraph amended.

## Insight contests (2026-10-31)

Owner: "Read Intent, Foresight and that kind of spell should not need a hit chance or care about range."
They resolve a contest: d20 + caster INT + WIS + card rank against DC = the target's current Poise +
target WIS + target level; a tie succeeds. Example: rank 1, INT 1, WIS 2, roll 5 gives 9 against Poise 7 +
WIS 1 + level 1 = 9, a success; a roll of 4 fails. More status-inflicting spells work this way, with
attributes by school: physical effects use DEX + CON (against CON), mental effects INT + WIS (against WIS),
and every DC includes current Poise first.

Implemented as an authored card field `contest: 'mental' | 'physical'`, constants in
`content/framework/mechanics.json`, a new last RNG stream `combatContest`, and `src/engine/contest.js`.
Foresight targets only the caster, so it carries no contest. The cards converted are listed in SPEC §17
Contests. Rallying Roar and Smoke Veil (physical-camp Core skills that apply Weak) and Restrained
(which also adds a burden card) were left on the Accuracy roll.
The contest applies in Core 2 only; Current/v2 combats ignore the `contest` field (D1).
