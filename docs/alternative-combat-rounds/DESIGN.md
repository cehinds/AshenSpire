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

- Each enemy has an SP pool and a limited hidden deck of cards with SP costs.
  Each round it plays as many cards as its SP affords, the same rule the player
  follows (see Resources). Each played card is one intent slot.
- The number of slots per round is not fixed. It is the total of what the
  enemies played, so it can be one slot or many. (Owner, 2026-10-11.)
- The slots form one queue for the round, in play order. Each slot names its
  enemy, so slots from different enemies can sit side by side in the queue.
  A slot's index is its position in that queue, from 0 to n-1.
- Perception decides how many slots are visible to the player. The visible
  slots are the first ones in play order, so perception is a count (a prefix
  of the queue), not a set of chosen slots. Perception still hides details:
  each visible slot is revealed only to the stage described below.
- Visible slots show as action icons, in play order.
- When the player plays a card, it is played against one of the enemy's
  queued slots (one of the visible ones, or any, see Open questions).
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

## Resources (SP/MP)

- Actions and Stamina are one resource, SP. SP and MP are stat-driven, with
  base values of 3 (SP) and 1 (MP). (Owner, 2026-10-11.)
- For testing, SP is fixed at 3 for the player and for each enemy.
- Every card has its own SP cost, `sp` (default 1), and may also have an MP cost.
- The player plays as many cards as SP affords. The same rule applies to each
  enemy, with that enemy's own SP pool and hidden deck. Each card it plays is
  one intent slot (see Round flow and perception).
- Whether MP also limits how many cards a side plays is not stated yet. See
  Open questions, t.
- Unanswered slots resolve against the player as already specified (see
  Pairing and resolution order: unpaired slots).
- Costs are a caller concern for now. `resolveRound()` takes the cards already
  chosen and the queue already built. It does not check SP or MP, and it does
  not spend them. The caller must enforce the SP and MP limits before it calls
  `resolveRound()`. Modelling costs inside the resolver is deferred unless it
  stays trivial.

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
- Duplicate slots are decided in the order the cards are listed: the first card
  on a slot wins, and the rest are rejected. Rejected events come first, in
  input order, and move nothing.
- Accepted pairings then resolve in slot order, ascending, whatever order the
  cards were listed in. Shared state (the player's intangible pool, the poise
  flag, RNG draws) therefore never depends on the caller's array order.
- Unpaired enemy actions resolve after all pairings, also in slot order. This
  is not interleaved by slot: an unpaired slot 0 still resolves after a
  paired slot 2. Interleaving was not chosen because it would reorder the
  events of every mixed round.

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
- In a paired slot, any miss is the defender's success. In an unpaired slot (no
  player card), an enemy attack that misses or is avoided gives the player
  nothing (owner, 2026-10-11).
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
  A counter that ties the attack and staggers it counts too (as in the timeline model).
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
- The breakdown always sums to the player total: with a `speed` field it is
  the speed term plus the momentum term, otherwise the component terms.
- Left-edge arrow, from the speed difference (player minus enemy):
  - `>>` green, `>` yellow, none at 0, `<` yellow, `<<` red.
  - Thresholds are in `SPEED_TIERS`: strong 2, slight 1 (owner, open question s).
- If speed values are shown, the value is green when the card is faster and red
  when slower.
- Tapping a speed value shows the breakdown: base, weapon, armor, range, attack
  type, skill, initiative, and momentum (trunc(M_e / 2)).

## Hit roll (owner-approved model, 2026-10-11)

Hit when:

    d20 + Accuracy >= 8 + Evasion

The required die is need = clamp(8 + Evasion − Accuracy, 2, 16), and the hit
is d20 >= need. Code: `hitRoll()` in `resolver.mjs`, with `HIT_NEED_MIN` 2 and
`HIT_NEED_MAX` 16. The clamp is the 75% cap: the chance to be missed is at most
75%, so a hit is at least 25%.

- Natural 1 always misses (need is at least 2). Natural 20 always hits (need is at most 16).
- The 75% cap, boundary: Accuracy 0 against Evasion 20 needs 16, not 28.
- Target 8 at Evasion 0 (AC base 8).

### Accuracy and evasion values

Accuracy = floor(STR + DEX + ½·WIS + ½·INT) + floor(level / 5) + attack tag.

- Attack tag: `quick` +1, `telegraphed` −2, any other tag 0. Read from the attack's tags.
- `accuracyFor({attrs, level, tags, accuracy})` in `resolver.mjs`. `accuracy` is any
  extra flat bonus, and a plain numeric accuracy still works.
- Example: level 1 Reaver with STR 3, DEX 1, WIS 1, INT 1 has accuracy 5. At
  level 5 it has 6. A quick attack adds 1 (6 at level 1). A telegraphed one
  takes 2 (3 at level 1).

Evasion = armor base + min(DEX − 1, armor DEX cap) + shield + card bonus.
Its inputs are `evasionArmor`, `dex`, `shield` and `evasionCard`. These are not
the action's `armor` and `card`, which are speed-table ids (`actionSpeed`).

- Armor table, `evasion-armor.csv` (armor, base, DEX cap):

  | Armor   | Base | DEX cap |
  |---------|------|---------|
  | Cloth   | 0    | 4       |
  | Leather | 0    | 6       |
  | Studded | 1    | 3       |
  | Chain   | 1    | 2       |
  | Scale   | 1    | 1       |
  | Plated  | 1    | 0       |

- Shield: buckler +1. Any other shield 0.
- Card bonus table, `evasion-cards.csv` (card, bonus): Backstep 5, Shadowstep 4,
  Quickstep 3, Acrobatics 3, Dodge 3, Evasive Guard 2. A card not in the table throws,
  like an unknown armor. Names are case-sensitive.
- `evasionFor({evasionArmor, dex, shield, evasionCard, evasion}, tables)` in `resolver.mjs`.
  `evasion` is any extra flat bonus, and a plain numeric evasion still works.
- The armor formula runs when a side gives at least one of `evasionArmor`, `dex`,
  `shield`, `evasionCard` or `attrs.DEX` (owner, 2026-10-11). A side with none of
  them uses its plain `evasion` number. A side with `attrs` but no DEX also uses
  its plain `evasion` number.
- A side with `attrs.DEX` and no armor, shield, card or `dex` counts as Cloth:
  evasion = 0 + min(DEX − 1, 4), never below 0, plus the flat `evasion` (owner,
  2026-10-11). Cloth works with no tables: a missing `tables.armor`, or one with
  no Cloth row, uses the built-in row {base 0, dexCap 4}. An explicitly named
  unknown `evasionArmor` still throws.
- When the formula runs: the DEX term is never below 0, a missing armor counts
  as Cloth, and a missing `dex` takes `attrs.DEX` (a missing DEX adds 0).
- Examples: Cloth at DEX 1 is 0. Leather at DEX 3 is 0 + 2 = 2, and with a buckler
  it is 3 (the rogue check: enemy accuracy 5 misses 25% of faces). Plated at DEX 5
  is 1 (cap 0). A buckler adds 1, and Backstep adds 5.

The tables match the tag tables on feature/TagRefactor (owner, 2026-10-11).

### Expected results: enemy Accuracy 5

The miss chance is (2 + Evasion) / 20 for Evasion 0 to 13. Above that the cap holds it at 75%.

| Evasion | need | P(missed) |
|---------|------|-----------|
| 0       | 3    | 10%       |
| 1       | 4    | 15%       |
| 3       | 6    | 25%       |
| 8       | 11   | 50%       |

Tests compute these exhaustively over d20 faces 1..20 (`resolver.test.mjs`).

### Enemy examples

Enemy evasion from the owner's examples, with the miss chance against an
Accuracy 5 attacker. Each enemy's armor and card parts are not given, so these
are the totals only.

| Enemy           | Evasion | need | P(missed) |
|-----------------|---------|------|-----------|
| Husk Brute      | 0       | 3    | 10%       |
| Wandering Soldier | 1     | 4    | 15%       |
| Fell Warden     | 2       | 5    | 20%       |
| Blight Hound    | 3       | 6    | 25%       |

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
  rolls once. `evadePct` is the base percent (the `evadePct` field on the side,
  or `playerDefense.evadePct`) plus the live bonuses for this exchange, clamped
  to 0..95. `evadeBasePct` is accepted as an alias for the base field; if both
  are set, `evadeBasePct` wins. The roll is floor(rng x 100), and a roll under
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
- Charge pools persist between rounds, but the resolver does not keep them
  itself. The pools are an input (from
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
  `evasionArmor`, `dex`, `shield`, `evasionCard`, `attrs`, zero defaults). `attrs.DEX`
  runs the Cloth evasion formula here, the same as on a paired card. A landed hit wins the slot for that enemy (moves momentum by the enemy action's gain, default 1, against the
  player, once per pairing). A miss or an avoid (intangible, evadePct) gives the
  player no slot credit: an unanswered attack that does not land moves no momentum,
  and the events are still emitted (owner, 2026-10-11). Non-attack unpaired actions
  (block, evade, other) do nothing (owner, 2026-10-11).
- Perception only tags events as visible. It does not gate targeting.
- Momentum: per enemy, settled at round end. See Momentum.

## Timeline model (owner, 2026-10-11)

Status: prototype in `timeline.mjs` (tests in `timeline.test.mjs`). It is a new
model that replaces slot pairing for the next prototype. The slot model
(`resolveRound`, `resolvePair` and the slot rules above) is kept, unchanged, so the
two can be compared. Nothing here is engine code, and no game content changes.
Placeholder numbers are marked PLACEHOLDER in the code and below.

### Queues and SP

- Every combatant (the player and each enemy) builds a queue of cards each round.
  The number of cards varies.
- Each card has its own SP cost, `sp` (Strike 1, Smash 2). A card with no `sp`
  costs 1 (PLACEHOLDER, `DEFAULT_CARD_SP`). A combatant's SP budget is `sp` per
  round, 3 for testing (PLACEHOLDER, `DEFAULT_SP`), and it refills each round.
  A queue is valid when the sum of its cards' SP costs is at most `sp`. A queue
  that costs more is rejected. Example: three 1-SP cards fit in 3 SP; a 2-SP card
  and another 2-SP card do not.
- MP is separate and is not modelled here (open, see below).
- Each card has a target. The player targets a foe id (an enemy) or `self`. An
  enemy targets `player` or `self`. Attacks must target a foe. Guard and Evade
  must target `self`.

### Initiative and action speed

- A combatant rolls one d4 per round, from the injected rng, in combatant order
  (player first). d4 = floor(u * 4) + 1.
- Initiative of one action = base + d4 + momentum term.
  - base = floor(DEX / 2) (PLACEHOLDER).
  - Momentum term, per enemy M_X (decayed, see Momentum):
    - the player's action on foe X: +momentumSpeed(M_X);
    - an enemy X's action on the player: -momentumSpeed(M_X);
    - a `self` action: 0.
- Action speed = card speed + initiative. A queued defensive card (guard, evade,
  counter) is preemptive and gets the buff below.
- A combatant's initiative for ordering (roundRobin, wholeQueue) is the initiative
  of its lead, which is its first queued card. An empty queue uses base + d4
  (PLACEHOLDER: the lead rule is a choice, not owner-approved).

### Merge modes

`buildTimeline(queues, ctx)` returns `{ merge, initiative, entries }`. Each entry has
`speed = { card, buff, base, d4, momentum, initiative, total, effective }`, so a UI
can show the breakdown. `card` is the raw card speed; `buff` (REACTION_BUFF.speed for a
preemptive card, else 0) is added separately, so `total = card + buff + initiative`. `merge` is one of three modes, so the owner can compare:

- `speed` (default). Sort by action speed, highest first. A card's effective speed
  is the lesser of its own total and the previous card's effective in the same
  queue, so a later card never acts before an earlier one. Ties: higher initiative,
  then the player first. The implementation is a merge of the queue heads, which
  keeps every queue in its own order.
- `roundRobin`. Combatants in lead-initiative order. Pass 1 plays each combatant's
  first card, pass 2 the second, and so on. Inside a pass, card speed breaks a tie
  in lead initiative.
- `wholeQueue`. The highest-initiative combatant plays its whole queue, then the
  next, and so on.

### Round resolution

`createRound(state, options)` starts a round and returns a step-able resolver:
`next()` resolves one timeline entry and returns `{ entry, events, state, done }`,
where `state` is a copy after that action. `resolveAll()` runs to the end and
returns `{ events, state, timeline }`. The round ends after its last entry, and
then the round-end settle runs (see Momentum).

- A defeated combatant (hp 0) skips its remaining actions (`skipped`,
  `reason: 'defeated'`).
  A defeated combatant's counters (queued or reaction) do not fire or cancel: the
  counter's owner must have hp above 0 when it would act. An attack on a defeated target is skipped
  (`reason: 'targetDefeated'`).
- An attack rolls its hit with `hitRoll` (Accuracy from `accuracyFor`, evasion from
  `evasionFor`). A miss ends the attack.
- A full block is checked next: the active block covers the whole hit (block >= damage,
  damage > 0). The hit is absorbed, and no evade is rolled.
- Otherwise an intangible charge avoids the hit and is spent. Otherwise the target
  rolls its evadePct (`evadePctFor`, base plus the active evade bonus) against
  `floor(u * 100)`. A roll below evadePct avoids the hit.
- Damage = attack damage - the active block. The block is a pool: it absorbs up
  to its amount and is spent as it absorbs (until used up or the round ends).
  Remaining damage reduces hp. Hp at 0 is defeated.

### Defensive cards

Each defensive card has base values (PLACEHOLDER, `DEFENSE_BASE`): guard block 6,
evade 20 percentage points, counter damage 2. The owner may give a card its own
value. A card's `block`, `evadePct` and `counterDamage`, when present, must be finite
numbers of 0 or more; otherwise the timeline throws a TypeError naming the field.

- Preemptive (queued). The card resolves in its place in the queue, and it becomes
  active for its owner until it is used up or the round ends. It gets the buff
  `REACTION_BUFF` (PLACEHOLDER, one object, all in one place): +1 speed, +2 block,
  +10 evade points, +1 counter damage.
  - Guard: the block pool absorbs the next attacks' damage.
  - Evade: adds its evade bonus to the next incoming attack's evadePct roll. The
    card is spent on the next attack, whether or not that attack hits.
  - Counter: fires on the next attack from its chosen foe, or from any foe when
    its target is `self`. A counter faster than the attack (strictly higher effective
    speed, the capped speed the merge uses, not the raw total) cancels it (`countered`), and deals its damage to the attacker. Otherwise
    the attack resolves, and the counter fires after it (`counterFired`), dealing
    its damage. A tie does not cancel.
- Reaction (in hand). A player may play an unplayed defensive card from `hand` as a
  reaction, when an attack targets that player, if SP is left for the card: the
  card's `sp` must be at most the SP left after the queue. With 0 SP left, only a
  0-SP card can react (a free reaction is a deliberate card design, not a loophole). The player's `onReaction(attack, eligibleCards)` callback
  returns a card, or null. The card must be eligible. A reaction uses base values,
  no buff, and spends the card's `sp` from what is left. A reaction's effect (guard block,
  evade bonus, counter) applies only to the attack it answers and is used before queued
  defences: a reaction guard's block is spent first on that attack, then queued block, and any
  guard remainder is discarded once the attack is over. A reaction evade is used by it first, and
  a reaction counter fires after it. None of them is left active, and queued defences stay for later attacks. A reaction counter never cancels its attack,
  so a queued counter does not cancel the attack a reaction counter answers (PLACEHOLDER: a choice, not
  owner-approved). Enemies never react.
- Eligible cards are defensive cards in hand that are not queued this round and not
  already played as a reaction this round.

### Momentum (per enemy, settled once per round)

The rules are the Momentum section above, applied to the timeline's exchanges. Each
enemy has one M, and each attack is one exchange:

- Round start: each enemy's M moves 1 toward 0 (decay). Every action in the round
  uses this decayed M for its momentum term. M does not change during the round.
- Each exchange credits each side at most once. A landed hit wins for the attacker.
  A full block, an avoid (intangible or evadePct), or a miss wins for the defender.
  A full block's winning card is the guard card that holds the block (its `momentumGain` and
  `stance`; guard cards spend their block first-in, first-out). A block with no guard card uses the gain 1.
  A landed hit through a partial block scores its stance against the first guard card that absorbed part of it, unless an evade card was spent on that attack.
  A fired or cancelling counter wins for its owner. The gain is the winner's card
  `momentumGain` (default 1) plus the stance bonus against the other side's card.
  When an attack does not land and the defender's counter fires on it, the defender's one credit uses the counter card.
- A counter with the `stagger` tag adds +-3 to its side's summed delta, on top of
  its slot win.
- Round end: the summed delta is added to each enemy's M once, then clamped to
  -3..3. A raw total past the cap sets that side's `poiseDouble` flag. The flag
  gives the side's next landed hit `poiseMultiplier: 2`. Poise damage is not
  modelled.

### Enemy adaptation (WIS)

`adaptEnemyQueues(queues, playerQueue, rng, { wis })`, after the player commits
(PLACEHOLDER numbers):

- Chance = clamp(wis * 15%, 0, 60%). A wis of 0 never changes and draws no rng.
- A change touches only the third queued action (index 2). It becomes a counter at
  the player, and only when the player's queue attacks that enemy. Otherwise the
  action is kept.
- Returns `{ queues, changed }`. `changed` lists the enemies that changed, so a UI
  can show "The Husk Brute shifts its stance!".

### UI API

- `makeCombatant(spec, tables)`, `makeFight(specs, tables)`: the state.
- `buildTimeline(queues, { combatants, rng, momentum?, merge? })`: the ordered
  entries with the speed breakdown, for a card hint or a preview.
- `createRound(state, { queues, rng, merge?, decay?, stanceAdvantage?, evadeTable?, onReaction? })`
  with `next()`, `resolveAll()` and `state`.
- `adaptEnemyQueues(queues, playerQueue, rng, { wis })`.
- Tables from resolver.mjs: `parseStanceAdvantage`, `parseEvadeBonus`,
  `parseEvasionArmor`, `parseEvasionCards`.

### Open in the timeline model

- MP limits and MP costs (open, see question t). Not modelled.
- Whether a combatant's initiative for ordering is its lead card (as built), its
  best card, or base + d4 only (PLACEHOLDER choice).
- Reaction counters (fire after, never cancel) and the replacement counter used by
  adaptation are placeholders.
- Interrupts (a landed faster hit interrupting a slower action, and hyperArmor)
  are not in the timeline model. Poise damage is not modelled.

## Open questions

a. Resolved (2026-10-11). The example reads dagger +2, heavy armor -3, Strike
   1, momentum +1. Under the half-value speed rule, momentum adds 0, so the
   total is 0. The earlier "+4" reading is withdrawn.
b. Resolved (2026-10-11). Momentum is applied per slot, with a round-end
   total per enemy. Decay is resolved (k).
c. Resolved (2026-10-11): one player card per enemy action. A second card is
   rejected.
d. Resolved (owner, 2026-10-11): an unpaired enemy attack rolls its hit against
   the player's defence. A landed hit wins the slot for that enemy (by the enemy action's gain, default 1, against
   the player). An unpaired miss or avoid gives the player no slot credit (owner,
   2026-10-11). Non-attack unpaired actions do nothing. See "Resolver placeholder
   rules" and item 1.
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
s. Resolved (owner, 2026-10-11): arrow tiers stay >=2 strong and >=1 slight.
t. Open (owner, 2026-10-11): does MP limit how many cards a side plays, as SP
   does? The owner's rule names SP as the play limit and gives MP only a base
   of 1 and optional card costs. Blocks any caller that enforces MP limits.
u. Open: how enemy SP pools and hidden decks are built per enemy. For testing,
   SP is fixed at 3 for every side. Blocks real enemy queues with varying length.
