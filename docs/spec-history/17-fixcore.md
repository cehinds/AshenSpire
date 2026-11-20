# SPEC history — §17 FixCore combat rules

Archive of provenance and superseded text moved out of SPEC.md §17. Not rules.

## §17 intro and Range
- RangeAdvance contract: owner, 2026-10-20. "Does not claim the feature is shipped by this documentation."
- Range persistence and enemy retreat: owner, 2026-10-25.
- Maximum range is Reach: owner, 2026-11-05: "Let's configure max range to be reach".

## Damage, Block, Poise
- Block soaks whole hit incl. magic (owner, 2026-10-25: magic no longer bypasses Block); amended 2026-10-31 by Magic hits Poise first (Ward off).
- Pierce: owner, 2026-10-26: "pierce should be about floor(.2 * damage)"; Poise meets pierced amount 1:1 (2026-10-26).
- Poise absorb, owner 2026-10-18 20:09: "poise takes damage equal to the amount it reduces. so if poise reduces damage by .25 then what ever that value is, that character's poise is reduced by that amount, plus any additional poise damage assocaited with the trigger. e.g. a slash does 8 damage, if there is poise, then the damage is reduced to 6 (must say poised or soaked or absorbed 2 or something so the player knows why the damage is reduced), and then poise meter is reduced by 2."
- Ward off: owner, 2026-10-18 15:55: "I like ward I just want it toggled off in the json for now".
- Whole numbers: owner, 2026-10-18 16:05: "Floor operator so that there are no decimal values".
- Defense and Smash: owner 2026-10-19, multiplier reduced 2026-10-23. Stance bonuses: 2026-10-19 "stance bonuses must improve cards".

## Contests (owner, 2026-10-31)
- Owner's example (rank 1, INT 1 WIS 2, roll 5) restored in the rules after review.

## Accuracy
- Fixed Evasion defense: owner correction 2026-10-21. Amended 2026-10-31: enemies hit too easily, any Precision of 1 or more hit 95%.
- Precision decay 3 per turn: owner 2026-11-01 "precision is growing too fast" (was 1).
- Evade card 3 stacks: owner 2026-10-25 (entry grant was 1).
- Gain-pair migration (1,1) -> (1,0); Precision stack gains "unchanged from 2026-10-19".

## Stance discounts
- Owner 2026-11-01: "Any defensive card", narrowed same day to "To be clear just for defense stance". Counter-with-Reaction exception: 2026-10-31.
- Mirrored spells, owner 2026-10-18 20:14: "spells from sceptors that mirror basic attacks are actually going to take the stance for the card but will be labeled as a spell and cantrip with the tags so the icon on the top right of the card will be the magic icon, but at the bottom if it's teh sword it will be attack, if it's the aetherial hammer, it's smash, and so on and so forth. they will be the attack type of their breathern, but projectile spells, or other buffs will say spell" ... "since they are technically spells, the mana reduction of successive spells still applies". Reached Arcane Spark and any sceptre/staff basic a Core loadout projects.
- Older Core 2 generic `trait:reaction` SP cut superseded by the same-stance, class-entitled, lane-specific discount.

## Rest sites and pacing
- Needs a Blacksmith row: owner ask 2026-10-31. Level earned only: owner 2026-10-18 20:09. Attribute points amendment: owner 2026-10-27 "for now disable all but class level. also increase xp gained and allow attribute level up to be applied at the victory screen and on the character sheet in the amory"; per-point gain preview 2026-10-31.
- Combat presentation formerly paused 1 s by default between action, animation, result, sprite reaction, damage and reset; superseded by the 500 ms pacing controls (2026-10-22).
- Auto-combat plays the player's turn since owner ruling 2026-10-26 (overrode D12).

## Counter
- Owner 2026-10-19 (cost update 2026-10-23). Superseded base formula: return damage floor(0.5 x incoming), Poise damage floor(0.2 x return); advantage adds floor(0.25 x incoming), Poise damage floor(0.5 x return), Block floor(0.25 x incoming). Worked: Attack 8 into Counter with 5 Block (printed 4) left 7 Block, returned 6 damage (4 + 2) and 3 Poise; vs Sweep returned 4 and 0 Poise. Superseded by Counter stacks (owner 2026-10-31).
- Former generic Core 2 `trait:reaction` SP discount superseded.
- Reflect: owner 2026-10-31. Spell Counters: owner 2026-10-19.
- Evade is not a stance (owner 2026-11-01): "All the evade stance cards were acting as defend cards so just migrate them all as defend cards"; "So stances are attack, smash, sweep, counter, defend, prepare, idle"; "Since evade is a tag I can eventually add counter cards with the evade tag". Sweep beats Counter and Smash (owner 2026-11-01: "Counter and smash"). Old non-Core Evade-stance dodge roll (hit 0.75 +/- AR/DR, damage x2 on failed dodge) retired: "Remove it".

## Migration, amendments
- D16 (2026-10-18) Vulnerable x1.25. Core clarity amendment owner 2026-10-22; card face 2026-10-28; readability 2026-10-31 and clarification 2026-10-23; reward inspection 2026-10-23. The amendment preceded its implementation and claimed no performance improvement or completed verification. Pacing: 500 ms default "supersedes the historical 1 s description".
- Contest wording: Counter once-per-owner-cycle explicitly amended for paid manual Counters in multi-hit.

## Enemy levels and stat budget (owner, 2026-11-07, #2682)
The owner: *"enemies levels are way too high and need to be reduced to 1 through 5 level with reasonable stats per level … the enemies should follow that rule too."* Owner answers, 2026-11-07: the budget is the Core player's 6 for both; points per level follow the player's rule; the act/tier map in SPEC.
