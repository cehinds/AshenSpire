# Alternative combat rounds: design notes

Status: exploration only. Captures the owner's design of 2026-10-11. Nothing
here is engine code, and no game content changes. The numbers in this file
are the owner's unless marked TBD.

## Goal

Replace turn-by-turn exchange with a speed-ordered pairing. Each card the
player plays has a total action speed; each enemy action has one too. When
the two meet, the higher speed acts first, so speed decides whether an attack
lands, is countered, or trades with its opponent.

## Action speed

- Every card has a base action speed of 1, 2 or 3.
- A higher total speed acts first.
- Total action speed is the sum of:
  - card base
  - weapon mod
  - armor mod
  - range mod
  - attack-type mod
  - skill mod
  - initiative mod
  - momentum
- Armor mods: heavy -3, medium -2, light -1, clothing 0, magical armor +1,
  +2 or +3.
- Weapon: dagger +2. Other weapons are TBD.
- Range, attack-type, skill and initiative mods are TBD.
- Momentum: the player adds half of M_e, the enemy adds -half of M_e,
  truncated toward zero (see Momentum).

The table of values lives in `speed-mods.csv`. The total is computed by
`actionSpeed()` in `resolver.mjs`.

## Round flow and perception

- Each round the enemy queues 3 actions.
- Perception decides how many of those actions are visible to the player.
- Visible actions show as action icons.
- When the player plays a card, it is played against one of the enemy's
  queued actions (one of the visible ones, or any, see Open questions).
- Each pairing is resolved on its own, in the order described below.

## Pairing and resolution order

- Within a pairing, the higher total speed acts first.
- Owner's example: a counter with base 3 at total +5 beats a strike at +4, so
  the strike is countered.
- Second sentence of the owner's example, read as: a player strike at +4
  against an enemy action at +3 hits first. The enemy action loses the
  pairing. (The original wording is "If the enemy were at +3, the strike would
  hit first". This file reads "the strike" as the player's own strike. This
  reading is noted, not confirmed.)
- A counter resolves against a slower attack. It does not stop a faster one.

## Ties and tie tags

- Equal speed means both sides hit at the same time.
- On a tie, tags can add:
  - counter damage
  - hyper armor (the holder is not interrupted)
  - stagger
  - stun

## Momentum

Momentum is a tug-of-war value kept per enemy: M_e is the value between the
player and one enemy. It is clamped to -3..+3. Every enemy starts every fight
at M_e = 0.

- The player holds M_e. That enemy holds -M_e.
- A gain for one side is the same loss for the other (zero-sum).
- Momentum adds half its value to speed, truncated toward zero. The player
  adds trunc(M_e / 2). The enemy adds -trunc(M_e / 2).
  - +-1 gives 0. +-2 gives +-1. +-3 gives +-1.
  - The owner wrote "rounded down". This file reads it as truncation toward
    zero so the shift is symmetric. Flagged for confirmation.

### Slot win and loss

- You win a slot when your action succeeds in its pairing: M_e moves +1
  toward you. You lose a slot when their action succeeds: M_e moves -1.
- Success means one of:
  - a landed hit
  - a counter that fires
  - a full block: Block >= damage. The attack does not land, the blocker wins
    the slot, and the resolver emits `absorbed`
  - a dodge: a miss against an evade action. The resolver emits `evaded`
- A plain miss with no defensive action moves nothing.
- A card's `momentumGain` (default 1) is the base amount of the move.
- Flagged: a miss from the evasion stat alone is not a dodge. Only an evade
  action counts.

### Stance advantage bonus

- Winning with a stance that beats the opposing stance adds that row's bonus
  from `stance-advantage.csv` (default 1 when blank). The bonus is added to
  the base gain. Flagged: additive, not a replacement.
- Owner examples:
  - smash beats block and breaks it for +2. A smash win over block is worth
    1 + 2 = 3.
  - counter beats attack for +1. A counter win over attack is worth 1 + 1 = 2.
- Counter stagger: if a counter that fires staggers the attacker, the
  counter-user gains full momentum. M_e is set to +3 (player counter) or -3
  (enemy counter), in their favour.
- The rest of the table is filled in with bonus 1 where the advantage looks
  obvious. Every such row is marked TBD.

### Timing: round end

- Every pairing in a round uses the round's starting M_e.
- Each enemy's deltas for the round are summed. The total is applied once at
  round end, then clamped once to -3..+3.
  - Example: a tie that lands on both sides at +3 nets +1 - 1 = 0, so M_e
    stays at +3. The per-side shift-then-clamp reading gave +2 and was
    rejected (Codex finding 1).
- A later slot in the same round does not see the change.

### Owner's trace, per enemy, at round end

The same enemy faces all three rounds. The player's Strike, the enemy's
attack and the enemy's counter are the actions in each round.

| Round | M_e at start | What happens                                | M_e at end | Player | Enemy |
|-------|--------------|---------------------------------------------|------------|--------|-------|
| 1     | 0            | Player's Strike hits first                  | +1         | +1     | -1    |
| 2     | +1           | Enemy counters the next attack successfully | 0          | 0      | 0     |
| 3     | 0            | Enemy succeeds again                        | -1         | -1     | +1    |

In round 2 the half-value rule adds trunc(+1 / 2) = 0 to either side's speed.

### Worked speed example

The player side is at M_e = +1 against this enemy, so the enemy side is at -1.

    Player: dagger +2, heavy armor -3, Strike base 1, momentum +1 (adds 0)
            = 2 - 3 + 1 + 0 = 0
    Enemy:  momentum -1 (adds 0)

Earlier this example gave +1, when momentum added its full value. Under the
half-value rule it is 0. Flagged for confirmation.

### Combos: undecided

Combos are left out of the momentum rules. The resolver does not give
momentum for them. Open question n lists the examples that need an answer.

## Hit roll

Hit when:

    d20 + accuracy + floor(1·STR + 1·DEX + 0.5·WIS + 0.5·INT) >= 8 + evasion

- Natural 1 always misses. Natural 20 always hits, whatever the totals.
- AC is 8 at evasion +0.
- Example: Reaver with STR 3, DEX 1, WIS 1, INT 1 has floor(5) = 5, so with
  accuracy 0 and evasion 0 it needs 3 or more on the d20.

## Resolver placeholder rules (prototype)

These are the rules `resolver.mjs` implements where the owner's design is
silent. They are placeholders for testing the shape, not decisions.

- Faster counter cancels a slower attack ('countered'). A counter does not
  cancel a tied attack.
- A faster attack's hit interrupts a slower action unless the slower action's
  holder has `hyperArmor`.
- On a tie, both attacks hit. `counterDamage`, `stagger` and `stun` apply
  only on a tie; `stagger` and `stun` are resisted by `hyperArmor`.
- Each non-cancelled attack rolls the hit roll. The d20 comes from an injected
  RNG.
- One player card per enemy slot. A second card on a paired slot is rejected.
- An enemy slot with no player card is unpaired and has no effect.
- Perception only tags events as visible. It does not gate targeting.
- Momentum: one shared value, updated per pair. See the Momentum section for
  the placeholder rules.

## Open questions

a. Resolved (2026-10-11). The example reads dagger +2, heavy armor -3, Strike
   1, momentum +1. Under the half-value speed rule, momentum adds 0, so the
   total is 0. The earlier "+4" reading is withdrawn.
b. Resolved (2026-10-11). Momentum is applied per slot, with a round-end
   total per enemy. Decay is open (k).
c. One player card per enemy slot, or several?
d. What happens to an unpaired enemy action?
e. What do perception thresholds reveal?
f. Does this replace the current Evade charges?
g. Resolved (2026-10-11). Success is a landed hit, a counter that fires, a
   full block (Block >= damage), or a dodge (a miss against an evade action).
h. Resolved (2026-10-11). A whiff hands nothing to the other side, unless it
   is a dodge against an evade action.
i. Resolved (2026-10-11). Momentum updates at round end, once per enemy.
j. Resolved (2026-10-11). Momentum is per enemy: M_e between the player and
   each enemy.
k. Does momentum decay between rounds? Not answered. Today it has no decay.
l. At +3 or -3, does a further success do anything extra? Not answered.
m. Does the speed effect (half of M, truncated, so at most +-1) feel right next
   to base speeds of 1 to 3? Not answered.
n. Combos: undecided. Examples to decide: a quickstep followed by a shieldBash
   in the same round, or a listed pair of card ids played back to back. Left
   out of the momentum rules until the owner answers.
o. Does a miss from the evasion stat alone count as a dodge? Current reading:
   no. Only an evade action counts. Flagged.
p. Speed effect: is "rounded down" truncation toward zero (current reading,
   symmetric) or floor? Flagged.
q. Stance bonus: is it added to the base gain (current reading) or does it
   replace it? Smash over block would be 3 or 2. Flagged.
r. Counter stagger: does it set M_e to +-3 (current reading) or add to it?
   Flagged.
