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
| D3 | Add a Ward stage with physical/magical typing | "if core doesn't have damage typing, then remove ward then and just use poise" | Core's defense stages have no Ward and no damage-type split, but actions do carry a physical/spell `camp` (`combatMatchups.js`). Whether that counts as damage typing: **open**. Until answered: no Ward; Poise is the only protection pool. |
| D4 | Poise becomes a depleting pool restored by Block | "block restores poise" | Option A as asked (Poise becomes a depleting pool that Block restores); restore rule detailed by the owner under D13. |
| D5 | Matching-stance effectiveness 1.25 (A) or 1.0025 (B) | "A" | Keep `advantageMultiplier 1.25`. |
| D6 | Matching-stance cost discount lane | "if it has mp then mp first, if it is only sp, then sp" | The question's discount `max(cost−1, 1)` applies to MP when the card costs MP; else to SP. |
| D7 | d20 + Precision vs AC, nat 1 miss / nat 20 hit, every attack | "yes" | Yes. |
| D8 | Perception base DC and hit-% badge gating | "A, so that it's easier to pass the perception roll so DC = 5 + int + wis" | Base DC 5; DC adds INT and WIS. Whose INT/WIS, the roll, and badge gating: **open** (see below). |
| D9 | Reward group weights; same for shops | "your call but I should be more likely to [get] more cards than equipment or relics, or shops, but I'd like to split that 30% so that shops are 15%" | Starting from the question's 60/10/30 (cards incl. weapon arts / weapons+armor+relics / potions), the 30 splits: potions 15, shop 15. Per offer slot; empty groups renormalise (as asked). |
| D10 | Rest before the boss | "there should always be 3 rest spots, with 1 guaranteed before the boss. Also, deck editing is now at will, so strategize should be removed. It should just be smith now. Level up will also be free at rest spots too. … just smith for now. with an option to go back, so no automatic end after choice. player will be given a continue instead" | Always 3 rest sites, one guaranteed before the boss. Exact floor (immediately before, i.e. the floor-8 option asked): **open**. Rest site: Strategize removed; Smith offered; level-up free there; no auto-close after an action, a Continue button leaves. Whether rest still heals: **open**. |
| D11 | Action pacing | "a noticeable (1 second by default) pause between what a character is doing, their animation, the result (hit or miss or blocked, or countered) then sprite reaction, then damage, then reset, then start loop with next on the stack" + "give me the option to edit the speed" + "auto combat … speed up the game to a configurable rate, default to 1.5" | Stages: action → animation → result → sprite reaction → damage → reset → next. 1 s default gap, player-editable. Auto-combat runs at a configurable ×1.5 default. |
| D12 | Auto-combat scope | "just for reaction choices for now, favoring appropriate reaction depending on player's perceived action being countered, if not known, then the last associated stance taken's card type" | Auto-combat picks reactions only (never plays the player's turn). Prefer the reaction that counters the perceived incoming action; if unknown, the card type of the last stance taken. Adapts to the player's previous choices. |
| D13 | Staggered | "make staggered be a stance for now … that reduces sp by 1 and adds 1 stack of vulnerable. repeated poise breaks can stack more vulnerabilities but that only increases duration for each subsequent stack. by default poise damage is floor(.2 of the total damage) inflicted and calculated before damage, however poise will not regenerate until a defensive card is played restoring poise to min(block, max poise) and adding block." | Poise break → Staggered stance: −1 SP, +1 Vulnerable. Further breaks add Vulnerable stacks that extend duration only (so damage stays ×1.25, never ×1.25ⁿ). Poise damage = floor(0.2 × damage), applied before damage. No passive Poise regen; a defensive card restores Poise and grants its Block. Restore amount: **open**, either set to min(Block, max Poise) as worded (which can lower Poise) or add Block to current Poise, capped at max (as "restores" and D4 suggest). Not a stackable status yet. |
| D14 | Armor budget | "make it 3 for now until rarity is added with the bonus being included but set to default of 0" | Armor budget 3; add a rarity bonus field, default 0. |
| D15 | Deck editing in combat | "equipment and deck editing only can happen outside of combat. buttons to change this will be disabled until combat is resolved. also if there is a new item in the armory then the outline should glow blue, instead of black." | No in-combat editing; the equipment and deck buttons are disabled until combat resolves. Armory button outline glows blue when it holds a new item (black otherwise). |
| D16 | Vulnerable 1.25 for both profiles | "yes vulnerable means target with vulnerable stacks receive 1.25 damage (and cards values and inflicted damage should update to reflect this change automatically)" | Vulnerable ×1.25 damage taken, both profiles; card previews and dealt damage reflect it. |

## Follow-up rulings (owner, 2026-10-18, 13:56 AKDT)

These settle every item that was open above. Where a reading above says **open**, this section wins.

- D3: "No Ward, Poise only". Remove Ward from Core; Poise reduces all damage (the physical/spell `camp` stays for matchups).
- D13: "Add Block, cap max". A defensive card adds its Block to current Poise, capped at max Poise, and grants its Block.
- D10: "Heal + floor before boss". Rest sites heal, plus Smith and a free level-up; the guaranteed rest is on the floor directly before the boss.
- D8: "DC 5 + target INT + WIS + other bonuses". DC = 5 + target's INT + target's WIS + configured bonuses (default none); the observer rolls d20 + own WIS. Hit-% badge (owner, 13:59): "It shows when a card is selected that can inflict an effect or damage to a target, similar to how BG3 does it". The badge shows on each valid target while such a card is selected; Perception does not gate it.
- Alignment: "Yes, all". Bring Core 2 on `dev` (after #2129) in line with every ruling, one PR per ruling.

## #2129 assumptions that differ from these rulings

- Ward and damage typing (D3: remove Ward; Poise only).
- Same-stance effectiveness 1.0025 (D5: keep 1.25).
- Combat deck drafts taking effect next encounter (D15: no editing in combat).
- 60/10/30 rewards (D9: 60/10/15/15 with shops).
- 2 rests per act, Strategize, level-up as an exclusive service (D10: 3 rests, one directly before the boss, Strategize removed, heal + Smith + free level-up).
- Autoplay of whole turns (D12: reactions only).
- Staggered as a stacking status with Weak and a skipped turn (D13: a stance, −1 SP, +1 Vulnerable, repeats extend duration).
- Poise loss = the 25% it prevented (D13: floor(0.2 × damage) before damage).
- Pacing 0.5 s, auto ×1 (D11: 1 s, auto ×1.5).
- Vulnerable 1.5 in the Current profile (D16: 1.25).
