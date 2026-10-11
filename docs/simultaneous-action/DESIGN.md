# Simultaneous action: design notes

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
- Momentum: the player adds M, the enemy adds -M, where M is the shared
  momentum value (see Momentum).

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

Momentum is one shared tug-of-war value, M. It is clamped to -3..+3. Every
fight starts at M = 0.

- The player side holds M. The enemy side holds -M.
- A gain for one side is the same loss for the other.
- Each side's momentum adds to that side's action speed: the player adds M,
  the enemy adds -M.
- Most successful actions move M by 1 toward the actor. Some card types and
  card tags move it by more on success.

### Owner's trace (2026-10-11)

| Step | What happens                                | M  | Player | Enemy |
|------|---------------------------------------------|----|--------|-------|
| 0    | Fight start                                 | 0  | 0      | 0     |
| 1    | Player's Strike hits first                  | +1 | +1     | -1    |
| 2    | Enemy counters the next attack successfully | 0  | 0      | 0     |
| 3    | Enemy succeeds again                        | -1 | -1     | +1    |

### Worked speed example (shared momentum)

The player side is at +1, so the enemy side is at -1.

    Player: dagger +2, heavy armor -3, Strike base 1, momentum +1
            = 2 - 3 + 1 + 1 = +1
    Enemy:  momentum -1 (the other half of the same M = +1)

### Placeholder rules

These are placeholders until the owner answers (see Open questions g to m).

- **Success means:** a landed hit, a counter that triggers, or a fully
  absorbed hit (Block >= damage). A miss or an interruption is not a success,
  and it does not move M on its own.
- **When M updates:** right after each pair resolves, in resolution order. A
  later pair in the same round uses the updated M.
- **Size of the move:** a card's `momentumGain` (default 1) applies on
  success. A tag can add to it.
- **Multiple enemies:** one M between the player side and the enemy side.
- **Between rounds:** M persists within a fight, with no decay. It resets to
  0 at fight start.

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

a. Resolved by the owner's 2026-10-11 correction. Momentum is shared, so the
   player at +1 means the enemy at -1. The example is dagger +2, heavy armor
   -3, Strike 1, momentum +1, total +1. The earlier "+4" reading is withdrawn.

b. Is momentum applied per card or per round, and how does it decay?

c. One player card per enemy slot, or several?

d. What happens to an unpaired enemy action?

e. What do perception thresholds reveal?

f. Does this replace the current Evade charges?
g. What counts as a success? (Placeholder: a landed hit, a triggered counter,
   or a fully absorbed hit.)
h. Does a whiff hand momentum to the other side?
i. Does momentum update mid-round or at round end? (Placeholder: after each
   pair, in resolution order.)
j. With several enemies, is momentum per pairing or per side? (Placeholder:
   one shared M between the two sides.)
k. Does momentum decay between rounds? (Placeholder: no decay within a fight.)
l. At +3 or -3, does a further success do anything extra?
m. Does the full +-3 speed swing (a 6-point gap between sides at the cap) feel
   too strong next to base speeds of 1 to 3?
