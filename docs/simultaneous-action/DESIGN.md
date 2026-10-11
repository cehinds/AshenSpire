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
- Momentum runs from -3 to +3 (see Momentum).

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

- Runs from -3 to +3. Clamped by the resolver.
- Rises when certain cards are played back to back (combo pairs, TBD list).
- Rises when the player correctly counters an enemy card.
- Placeholder rule used by `resolveRound()`: +1 for a correct counter or a
  listed combo pair, -1 when the player's card is countered.
- Per-card versus per-round application and decay are open (see Open
  questions).

## Hit roll

Hit when:

    d20 + accuracy + floor(1·STR + 1·DEX + 0.5·WIS + 0.5·INT) >= 8 + evasion

- AC is 8 at evasion +0.
- Example: Reaver with STR 3, DEX 1, WIS 1, INT 1 has floor(5) = 5, so with
  accuracy 0 and evasion 0 it needs 3 or more on the d20.

## Open questions

a. The owner's worked example says dagger +2, heavy -3, strike base 1,
   momentum +1 totals "+4". By the stated table it totals +1. Reaching +4
   would need armor +0. Which is meant?

b. Is momentum applied per card or per round, and how does it decay?

c. One player card per enemy slot, or several?

d. What happens to an unpaired enemy action?

e. What do perception thresholds reveal?

f. Does this replace the current Evade charges?
