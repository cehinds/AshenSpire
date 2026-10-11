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

### Perception stages

Each visible enemy action is revealed in up to four stages. `revealAction()`
in `resolver.mjs` returns only the fields visible at a stage. The stage is
clamped to 0..3.

- Stage 0: a "?". The player knows only that an action exists.
- Stage 1: the stance group (for example offense, defense or evade). The
  groups are in `STANCE_GROUPS`, and every group name is TBD.
- Stage 2: the stance and the damage.
- Stage 3: everything, including speed and tags.

`revealAction()` names the stage in the result: `stage: 0` to `3`. `cardHint()`
reads that field, so it does not guess from which keys are present. Speed is
known at stage 3 only. The stance is known from stage 2.

Flagged: at stage 1 and 2 the card hint cannot show a speed advantage.
- The border uses stance only from stage 2, because the exact stance is not
  known at stage 1.
- The left-edge arrow needs the enemy's total speed, so it appears only at
  stage 3.

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
- One player card per enemy action (owner, 2026-10-11). A second card on an
  already paired enemy action is rejected ('rejected' event).

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
  - The owner wrote "rounded down". Confirmed by the owner (2026-10-11) as
    truncation toward zero, so the shift is symmetric.

### Slot win and loss

- You win a slot when your action succeeds in its pairing: M_e moves +1
  toward you. You lose a slot when their action succeeds: M_e moves -1.
- Success means one of:
  - a landed hit
  - a counter that fires
  - a full block: Block >= damage and damage > 0. The attack does not land, the blocker wins
    the slot, and the resolver emits `absorbed`
  - an avoid: an `intangible` charge, or a successful `evadePct` roll (see
    Evasion). The resolver emits `evaded` with a `reason`
  - a miss, of any kind (natural 1 included), is the defender's success, whatever
    the defender did (owner, 2026-10-11). The resolver emits `hit` with `hit: false`.
    A miss against an evade action also emits `evaded`, but the slot is won once
- A side wins a slot at most once per pairing, however many of its successes
  the pair produces (for example, a full block followed by a landed hit, or a
  miss against an evade action).
- A card's `momentumGain` (default 1) is the base amount of the move.

### Stance advantage bonus

- Winning with a stance that beats the opposing stance adds that row's bonus
  from `stance-advantage.csv` (default 1 when blank). The bonus is added to
  the base gain, not a replacement (owner, 2026-10-11).
- Owner examples:
  - smash beats block and breaks it for +2. A smash win over block is worth
    1 + 2 = 3.
  - counter beats attack for +1. A counter win over attack is worth 1 + 1 = 2.
- Counter stagger (owner, 2026-10-11): if a counter that fires staggers the
  attacker, the counter-user's side adds 3 to its summed round delta, in their
  favour: +3 (player counter) or -3 (enemy counter). It is in addition to the
  normal slot win (gain plus stance bonus, once per side per pairing).
  - Example: from M_e -2, a player counter with gain 1 and a counter-beats-attack
    bonus of 1 gives clamp(-2 + 1 + 1 + 3) = +3.
  - The resolver emits `{type: 'momentum', reason: 'counterStagger', by, delta, enemyId}`,
    with `delta` = +3 or -3.
- Opposing counter staggers net (owner, 2026-10-11). If one enemy gets a +3 and
  a -3 in the same round, they add to the summed deltas like any other. There
  is no cancel rule and no set. Order of playerCards does not matter.
- The rest of the table is filled in with bonus 1 where the advantage looks
  obvious. Every such row is marked TBD.

### Timing: round start and round end

- Decay (owner, 2026-10-11): before any pairing, each enemy's M_e moves 1
  toward 0. Zero stays zero, and a value never moves past 0. The resolver's
  `options.decay` sets the step (default 1; 0 disables it). Enemies present only
  in the momentum input also decay. A change emits
  `{type: 'momentum', reason: 'decay', enemyId, from, to}`.
  - Example: +2 with no successes gives +1 at round end. -1 gives 0.
- Every pairing in a round uses the round's decayed starting M_e. Pairing speed
  uses that value too.
- Each enemy's deltas for the round are summed. The result is the decayed start
  plus that sum, clamped once to -3..+3.
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

The trace above predates decay, so it is shown with decay off (`decay: 0`).
With the default decay, round 2 would start at 0, not +1.

### Worked speed example

The player side is at M_e = +1 against this enemy, so the enemy side is at -1.

    Player: dagger +2, heavy armor -3, Strike base 1, momentum +1 (adds 0)
            = 2 - 3 + 1 + 0 = 0
    Enemy:  momentum -1 (adds 0)

Earlier this example gave +1, when momentum added its full value. Under the
half-value rule it is 0.

### Overflow and double poise (owner, 2026-10-11)

- At the cap, a success that would push M_e past +3 (player) or -3 (enemy) sets
  a flag. The overflow is judged on the summed round delta from the decayed
  start, so a start of +3 with a player success of +1 overflows.
- At round end the resolver emits `{type: 'momentum', reason: 'overflow', enemyId, side}`
  (`side` is 'player' or 'enemy') and returns `poiseDouble: { player, [enemyId]: bool }`.
- Consuming the flag: a side flagged in `options.poiseDouble` has its first landed
  hit that round carry `poiseMultiplier: 2`, and the flag is cleared in the
  returned map. A flag stays set until a landed hit spends it.
- Flag only: poise damage itself is not modelled in the prototype.

### Combos

No combos (owner, 2026-10-11). Only slot wins and stance advantage move momentum.

## Card hints (UI spec)

Computed by `cardHint()` in `resolver.mjs`. Terse spec, not final UI.

- Border, per enemy:
  - green: the card is faster and its stance beats the enemy's (both advantages).
  - yellow: one of the two.
  - red: neither.
  - blue: self-target card (skills). It highlights only the player.
- Perception limits the hint (see Perception stages):
  - stage 0 and stage 1: speed and stance are not shown. The border is `grey`
    (unknown), and the speed delta and arrow are null.
  - stage 2: the stance is known, but speed is not. The border is yellow when
    the card's stance has an advantage, otherwise red. Green is not possible,
    and the speed delta and arrow are null.
  - stage 3: the full border rules above, with speed and the arrow.
  - self-target (blue) cards: the speed delta is null below stage 3, as for
    other cards. A self-target card never shows an arrow.
- Selecting a card highlights each enemy in that card's colour. One card can be
  red on one foe and green on two others.
- Speed totals match the pairing in `resolveRound`: a `speed` field is used
  (the player adds momentum, the enemy subtracts it), and the component total
  is the fallback when there is no `speed` field. The M_e given to cardHint must be
  the decayed M_e for the round (`decayMomentum(stored)`), the same start that
  resolveRound pairs with. With the stored value, the totals can disagree.
- Callers pass the decayed (current-round) M_e to cardHint, not the stored one:
  `decayMomentum(stored M_e)`. resolveRound pairs with that decayed start (Timing),
  so a hint given the stored value can disagree with the pairing.
- The breakdown always sums to the player total: with a `speed` field it is
  the speed term plus the momentum term, otherwise the component terms.
- Left-edge arrow, from the speed difference (player minus enemy):
  - `>>` green, `>` yellow, none at 0, `<` yellow, `<<` red.
  - Thresholds are placeholders in `SPEED_TIERS` (see open question s).
- If speed values are shown, the value is green when the card is faster and red
  when slower.
- Tapping a speed value shows the breakdown: base, weapon, armor, range, attack
  type, skill, initiative, and momentum (trunc(M_e / 2)).

## Hit roll

Hit when:

    d20 + accuracy + floor(1·STR + 1·DEX + 0.5·WIS + 0.5·INT) >= 8 + evasion

- Natural 1 always misses. Natural 20 always hits, whatever the totals.
- AC is 8 at evasion +0.
- Example: Reaver with STR 3, DEX 1, WIS 1, INT 1 has floor(5) = 5, so with
  accuracy 0 and evasion 0 it needs 3 or more on the d20.

### Evasion

There are two ways to avoid an attack that would land. Both are defensive
successes for momentum (see Momentum).

- The `intangible` tag. A charge avoids the attack outright, and it is
  guaranteed. Charges are per side, per round: `resolveRound` keeps one pool
  for the player and one for each enemy (keyed by enemy id). Every queued
  action of an enemy draws on that enemy's pool, so one charge is spent at
  most once per round. The pool starts from `options.charges`, else from the
  side's pool: the largest `intangibleCharges` of that side's cards (player),
  or of that enemy's queued actions (an enemy id). A card or action with no
  `intangibleCharges` counts as 0. It is spent in place across the round's pairings, and the remaining
  counts are returned as `charges: { player, [enemyId]: n }`. At 0 charges
  the tag does nothing. Emits `evaded` with `reason: 'intangible'` and the
  pool left in `charges`.
- `resolvePair` takes the same pool as `options.charges: { player, enemy }`.
  A side missing from it falls back to that side's own `intangibleCharges`.
- The evasion percent, `evadePct`. After an attack would land, the defender
  rolls once. `evadePct` is `evadeBasePct` plus the live bonuses for this
  exchange, clamped to 0..95. The roll is floor(rng x 100), and a roll under
  `evadePct` avoids the attack. Emits `evaded` with `reason: 'evasion'`.
- Order for an attack that would land: a full block first (absorbed, no
  charge spent). Then `intangible`. Then the percent roll. Only an attack that
  would land spends a charge or draws the percent roll.
- `evadePct` is a new field. The hit roll still uses the `evasion` stat as
  before (8 + evasion), so its meaning does not change.

Owner's answer to open question f: the guaranteed evasion becomes the
`intangible` tag, and the percent chance is the separate `evadePct` roll.

#### Evade bonus scopes

Each bonus is `{ source, pct, scope, side?, appliesTo?, condition? }`.
`side` is the owner: `'player'` (the default when missing) or an enemy id. A
bonus helps only the defences of its owner, so an unowned run bonus never
helps an enemy. `appliesTo` still narrows an exchange bonus to one card or
action. The scope model is meant
for all tag bonuses, not only evasion. Flagged: no tag bonus other than evasion
uses it yet.

- `exchange`: live in this one exchange only. It does not carry to the next.
- `round`: live while a round is set.
- `combat`: live while a combat id is set.
- `run`: live for as long as the bonus is present.
- `condition` (optional): a function of the context. A bonus whose condition
  fails is dropped, whatever its scope.

`activeEvadeBonuses()` keeps only the live bonuses, and `evadePct` sums them.
Stance bonuses come from `evade-bonus.csv` as `exchange` bonuses (TBD values).
Card-tag bonuses are passed on the side as `evadeBonuses`.

#### Evade action and evade percent (owner, 2026-10-11)

- An evade action adds its `evade-bonus.csv` bonus to `evadePct` in the same
  exchange. The bonus adds to the percent. It does not replace it.
- The total is clamped to 0..95 (`EVADE_PCT_MAX`), and the cap of 95 is
  confirmed by the owner. Example: base 90 + evade 20 = 110, clamped to 95.

#### Flagged

- A dodge (a miss against an evade action) and `evadePct` never apply to the
  same attack. A dodge needs a miss, and the percent roll happens only on a
  hit. Whether the evade stance's bonus should also apply to a dodge is not
  decided.
- Charges are not carried between rounds. The pools are an input (from
  `options.charges` or the sides' `intangibleCharges`), and `resolveRound`
  returns what is left in `charges`. The caller stores that for the next
  round. Every side in `options.charges` is returned, even an enemy with no
  queued action this round, so its charges carry over. Whether a charge refills over time is not decided.
- The values in `evade-bonus.csv` are TBD.

## Resolver placeholder rules (prototype)

These are the rules `resolver.mjs` implements where the owner's design is
silent. They are placeholders for testing the shape, not decisions.

- Faster counter cancels a slower attack ('countered'). A counter does not
  cancel a tied attack. A counter that fires also applies its `stagger` and
  `stun` tags to the attacker it cancelled ('status', or 'resisted' if that
  attacker has `hyperArmor`).
- A faster attack interrupts a slower action only if its hit lands. A missed
  faster attack does not interrupt. If the slower action's holder has
  `hyperArmor`, a landed hit emits 'hyperArmor' (ignored: 'interrupt') instead
  of 'interrupted'.
- On a tie, both attacks roll their hit roll (player first, then enemy). Neither
  is cancelled. The tie tags then apply: `counterDamage` emits a
  'counterDamage' event (no damage is computed here). `stagger` and `stun`
  emit 'status', or 'resisted' when the opponent has `hyperArmor`.
- Each attack that is not cancelled rolls the hit roll. The d20 comes from an
  injected RNG.
- A full block (Block >= damage and damage > 0) turns a landed hit into 'absorbed' for the
  blocker. A miss against an evade action emits 'evaded'. Any miss is the
  defender's momentum success (Momentum section).
- An attack that would land can be avoided by an `intangible` charge, or by the
  `evadePct` roll. Each emits 'evaded' with a `reason`, and each counts as a
  defensive success. The `evadeRoll` event reports the roll.
- An enemy slot with no player card is unpaired ('unpaired' event). Its
  events carry `unpaired: true`. An unpaired enemy attack rolls its hit against
  the player's defence (`options.playerDefense`: `evasion`, `evadePct`, `tags`,
  zero defaults). A landed hit wins the slot for that enemy (momentum -1 for the
  player, once per pairing). A miss or an avoid (intangible, evadePct) wins the
  slot for the player, as for any defender. Non-attack unpaired actions (block,
  evade, other) do nothing (owner, 2026-10-11).
- Perception only tags events as visible. It does not gate targeting.
- Momentum: per enemy, settled at round end. See Momentum.

## Open questions

a. Resolved (2026-10-11). The example reads dagger +2, heavy armor -3, Strike
   1, momentum +1. Under the half-value speed rule, momentum adds 0, so the
   total is 0. The earlier "+4" reading is withdrawn.
b. Resolved (2026-10-11). Momentum is applied per slot, with a round-end
   total per enemy. Decay is resolved (k).
c. Resolved (2026-10-11): one player card per enemy action. A second card is
   rejected.
d. What happens to an unpaired enemy action?
e. Resolved (2026-10-11): four perception stages, as in "Perception stages".
   The card hint consequence is flagged there.
f. Resolved (2026-10-11): the guaranteed evasion becomes the `intangible` tag
   with side charges. The percent chance is a separate `evadePct` roll. Whether
   this retires today's Evade charges in src/ is not decided in this prototype.
g. Resolved (2026-10-11). Success is a landed hit, a counter that fires, a
   full block (Block >= damage and damage > 0), an avoid by an `intangible`
   charge or an `evadePct` roll, or any miss (for the defender, see o).
h. Resolved (2026-10-11, updated by owner's answer o). A whiff is not free: any
   miss is the defender's success, not only a dodge against an evade action.
i. Resolved (2026-10-11). Momentum updates at round end, once per enemy.
j. Resolved (2026-10-11). Momentum is per enemy: M_e between the player and
   each enemy.
k. Resolved (owner, 2026-10-11). Momentum decays 1 toward 0 each round, before
   pairings (see Timing). `options.decay` 0 turns it off.
l. Resolved (owner, 2026-10-11): a success that overflows the cap sets double
   poise on that side's next landed hit (see Overflow and double poise). It is a
   flag only: poise is not yet modelled in the prototype.
m. Resolved (owner, 2026-10-11): the speed effect stays at most +-1, that is
   trunc(M / 2), against base speeds of 1 to 3.
n. Resolved (2026-10-11): no combos. Only slot wins and stance advantage move
   momentum. Examples such as a quickstep followed by a shieldBash are not
   counted.
o. Resolved (owner, 2026-10-11). Any miss is the defender's success, whatever
   the defender's action. It is not limited to an evade action. The defender
   wins the slot once per pairing.
p. Resolved (2026-10-11): truncation toward zero.
q. Resolved (owner, 2026-10-11). The stance bonus is added to the base gain.
   Smash over block is 1 + 2 = 3.
r. Resolved (owner, 2026-10-11). Counter stagger adds +-3 to the counter-user's
   side of the summed round delta. It is in addition to the normal slot win.
   Opposing staggers net naturally (+3 and -3), with no cancel rule.
s. Card hint speed tiers: thresholds (placeholder >=2 strong, >=1 slight)?
