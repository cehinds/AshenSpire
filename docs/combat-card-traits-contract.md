# Combat card traits and the reaction stack (reaction rules version 2)

Owner request, 2026-10-12: four card tags — **Reaction**, **Counter** (shown as
*Counterstrike*), **Impact N** and **Flux N** — and a last-in-first-out reaction
stack. SPEC.md §4.8 and §4.10 point here. Until the implementation lands, combat
follows §4.7–§4.10 and [combat-reaction-contract.md](combat-reaction-contract.md)
unchanged.

## Activation and compatibility

- New expanded runs (combat expansion version 2) snapshot **reaction rules
  version 2** and a frozen `reactionRules` tuning object. Version 2 enables both
  the card traits and the reaction stack.
- Saves and snapshots carrying reaction rules version 1, or none, keep their
  saved lifecycle exactly: one reaction per root, no trait tags, no trait effects.
- The `combatExpansionRules.matchups` snapshot gains no keys; trait tuning lives in
  its own snapshot so older matchup snapshots still validate.

## Tags

All four are children of the `trait` root in `content/source/nodes.csv`, so they
render through the existing trait chip path.

| Tag id | Chip | Meaning |
|---|---|---|
| `trait:reaction` | Reaction | Playable from hand during the opponent's turn, before the pending action resolves. |
| `trait:counterstrike` | Counterstrike | +50% effectiveness; +75% when the player's stance has advantage over the target's. |
| `trait:impact` | Impact N | On hit: N Poise damage, or double the Poise damage the card already deals. |
| `trait:flux` | Flux N | On hit: N Ward damage, or double the Ward damage the card already deals. |

The owner's "[counter]" tag uses the id `trait:counterstrike` and the label
*Counterstrike* because `maneuver:counter` already prints "Counter" on the type
line and `counter:melee|ranged|spell` already name Counter coverage; most
carriers are Counter cards, so a second "Counter" chip would be ambiguous.

**Where the tags come from.** The traits depend on a card's rank and must stay
invisible to version-1 saves, so they are applied by a runtime projection
(`applyCardTraits`) when reaction rules version 2 is active, not written in
`tagging.csv`. This follows the `trait:unreflectable` precedent in
`src/content/combatExpansionCards.js`. The projection adds the tag ids to
`tags`/`cardTags` and their values to `traitValues`
(`{ reaction, counterstrike, impact, flux }`).

**Tier.** `T = abilityRank` for graded (progression) cards; otherwise
`T = min(5, floor(rank / 2))` from the card's rank.

**Magnitudes.** Impact N = base + floor(T / 2), base 2 for Smash and 1 otherwise
(range 1–4). Flux N = 1 + floor(T / 2) (range 1–3). Chips and the version-2 face
summary read "Impact N" / "Flux N".

## Reaction stack

- An incoming enemy root opens a reaction window for each affected seat, in saved
  seat order, exactly where version 1 offers one (§4.10).
- Choosing a card **pushes** it onto the stack; nothing is paid yet. The same seat
  is offered again until it passes (Back), has no option left, or holds
  `maxDepth` (4) entries. Then the next seat is offered.
- **One stack per root, shared by the seats.** The cap counts each seat's own
  entries, so one seat cannot use up another's offers. Seats answer in saved seat
  order; the whole stack then resolves last pushed first, across seats.
- **Counter-return roots:** `maxDepth = 1` (one entry per seat, no re-offer),
  preserving the reaction contract's anti-chain rule.
- **At most one `maneuver:counter` card per seat on a stack.** SPEC §4.8 lets a
  new Counter replace the previous one and never stacks charges, so once a seat
  has pushed a Counter, its further Counter cards are not offered.
- When every seat has answered, the stack resolves **top first** (last played
  first). Each entry pays and resolves with today's single-reaction mechanics,
  then the next entry, and finally the paused enemy action.
- An option is offered only if playing it **and then every stacked entry in LIFO
  order** succeeds in a candidate state. Instances already on the stack are not
  offered again.
- An entry that can no longer be played when it is reached (the instance left
  the hand, the payment no longer fits) **fizzles**: it emits
  `combatReactionFizzled` and pays nothing. Because the offer check replays the
  whole stack, a solo run cannot reach this; it is a guard for co-op, where a
  later seat's entries resolve first and can change state an earlier seat's
  check assumed. The acceptance test reaches it that way.
- Entries carry a side (`player` or `enemy`). Enemy entries follow *Enemy
  reactions* below.
- Eligibility in version 2: a hand card needs `trait:reaction`. A
  `maneuver:counter` card also needs matching coverage; other cards need a
  positive incoming contact. Version 1 keeps its Counter / `defensiveReaction`
  Sweep rule.
- The stack, the pending offer's depth and the resolution cursor are saved and
  resume exactly, solo and co-op.

## Enemy reactions

Owner request, 2026-10-12: enemies react too, on the same stack. Enabled by
`reactionRules.enemyReactions: true`, which new version-2 rules carry; a
version-2 snapshot without the key has no enemy reactions.

- **Opt-in moves.** An enemy move with a `reaction` field is a *reaction move*:
  `reaction: { on: ['playerAction' | 'playerReaction', …], minIncoming = 1,
  chance = 1 }`. It carries `trait:reaction` in `tagging.csv`. Intent selection
  filters reaction moves out **before** weighting, `firstMove`, `maxConsecutive`
  or any pattern indexing, so seeds of enemies that gain one do not shift.
- **Windows.** Neither window opens for a Counter-return root, for any action
  whose carrier is a reaction (`combatReaction`, `reactionDepth`, or played while
  a stack resolves), or while a stack is resolving.
  - `playerAction`: a player card's root action group is about to begin and the
    enemy is one of its targets with a positive contact.
  - `playerReaction`: a player pushed a reaction onto a stack whose root is this
    enemy's own (non-Counter-return) action, or whose root is a player card that
    targets this enemy.
- **Order.** Eligible enemies decide in roster order, each at most once per
  window. After every enemy has decided, the seat is offered: on the player's
  turn only the seat that played the root card; on an enemy turn the seats in
  saved order as before. When a seat pushes, a `playerReaction` window opens for
  the enemies; this alternation continues until nobody pushes or the caps stop it.
- **Decision.** An eligible enemy is alive, not staggered or control-locked, and
  has an unused reaction move whose `on` lists the window. It considers its moves
  in authored order; a move qualifies when the incoming damage **against this
  enemy** is at least `minIncoming`: the largest positive contact of the root
  card (`playerAction`) or of the pushed reaction (`playerReaction`) whose target
  is this enemy. A window opened by a push the enemy is not targeted by, on a
  root it does not own, gives it nothing to qualify on. A qualifying move with `chance`
  1 is taken and one with 0 is not, without a draw; otherwise one draw on the new
  `enemyReaction` RNG stream (appended last) decides it. A move that is not taken
  passes to the enemy's next qualifying move in authored order; the first move
  taken ends the enemy's decision for that window. Draws are memoised in
  `combat.enemyReactionRolls["<group key>:<window>:<enemy id>:<move id>"]`, where
  `<window>` counts the windows opened on that root (0 for the first, +1 per
  push),, which is saved
  with the combat and cleared at each player-turn start. Candidate states
  (previews, offer checks) read the memo and never draw; an unmemoised decision
  counts as "does not react" there. An enemy with no reaction moves draws nothing.
- **Budget.** Each enemy takes at most one reaction per combat turn (the `turn`
  counter: one player turn and the enemy phase after it), recorded as
  `enemy.combatReactionTurn`. Player entries keep the per-seat `maxDepth` cap;
  enemy entries on one stack are capped at `maxDepth` in total.
- **Commit at push.** An enemy entry `{ side: 'enemy', ownerId: <enemy id>,
  moveId, targetPlayerId, plan }` commits its contact plan when pushed: the
  ordinary expanded planning (`enqueueExpandedAction`, including its crit draws)
  runs into the entry's `plan` (its actions and group) instead of the queue, and
  is saved with the stack. `targetPlayerId` is the seat whose card or reaction
  opened the window. It is announced as `combatEnemyReactionStacked`. Seats are
  offered against the plan's row, with the ordinary offer rules; a plan with no
  positive contact against the seat offers nothing.
- **Offer checks.** The LIFO replay of an offer check executes each enemy entry's
  committed plan in the candidate state in its stack position.
- **Resolution.** Entries still resolve last pushed first. An enemy entry
  enqueues its committed plan's actions, as a `combatReaction` carrier at the
  stack's depth: no riders, crits, automatic Counter returns or reaction windows
  chain from it. It pays nothing. It fizzles (`combatReactionFizzled`) when its
  enemy is dead, staggered or control-locked when reached, or its target seat is
  gone.
- **Cancellation.** If the stack's resolution kills the root card's targets,
  that card's actions follow the ordinary cancellation rules. If it leaves the
  root's acting seat dead (or disconnected), the root group is cancelled and none
  of its actions run.
- **Presentation.** An enemy reaction announces itself with
  `enemyMoveStarted { reaction: true }` and the log line "X reacts with Move."
- **First carriers.** Gilded Knight gains *Gilded Guard* (block 6, damage 3,
  `on: ['playerAction']`, `minIncoming: 8`); Court Duelist gains *Binding
  Riposte* (damage 4, `on: ['playerReaction']`, `chance: 0.5`).

## Counterstrike

- Applied when the card is prepared, after its stance is set, to the card's own
  effects (a Counter card's included). On a Counter card it also applies to the
  return payload when the return is built, against the attacker the return
  answers. Derived bonuses (such as the card rating bonus) are computed from the
  scaled amount.
- **Advantage.** The player's stance is the card's maneuver when the card sets a
  stance, otherwise the current tactical stance. The target is the chosen enemy;
  during a reaction, the incoming attacker; for a Counter return, the attacker it
  answers; otherwise none (50%). An enemy's stance is the maneuver of the move it
  is resolving, else its current tactical stance, else its shown intent's
  maneuver. Advantage holds when the target's stance is in the player stance's
  row:

  | Player stance | Has advantage over |
  |---|---|
  | attack | smash, casting |
  | smash | defend |
  | defend | sweep |
  | sweep | counter |
  | ranged | counter |
  | counter | attack, smash |
  | casting | — |

  The table restates the existing version-2 multipliers (Attack beats a prepared
  Smash or casting stance; Smash beats Defend; Defend reduces Sweep; Sweep and
  Ranged bypass melee Counter; Counter covers Attack and Smash).
- **Percentage.** 75% with advantage, otherwise 50%.
- **Effectiveness** is the positive amounts of `damage`, `block`, `gainBarrier`,
  `poiseDamage`, `wardDamage`, `gainPoise`, `gainWard`, `heal` and `buildup`, and
  the Counter payload's `hp`, `poise`, `ward` and `smashPoiseBonus`. Hit counts,
  repeats, draw, energy/mana, status stacks, durations and costs are unchanged.
- **Arithmetic.** Each amount `a > 0` becomes `a + max(floor(a × pct), 1)`; 0
  stays 0. Formula amounts are wrapped in a `traitBonus` formula op.

## Impact and Flux

- Applied once per action per target, when the action completes. A **hit** is a
  contact that was not avoided (Evade, miss, cancelled) and whose damage before
  Block, Barrier and Ward was greater than 0. A fully blocked hit still counts.
- **Cards that deal no damage** (status-only skills, Powers) apply Flux/Impact
  once to each enemy they successfully affected (a status applied, a debuff
  landed); a Power with Flux deals N Ward damage to every enemy when it is
  played.
- Let P be the Poise the action's own `poiseDamage` effects dealt to that target.
  If P > 0 the target takes P more Poise damage (doubling); otherwise N. Flux does
  the same for Ward with the action's own `wardDamage` effects.
- Implicit riders (blunt +2 Poise, Smash guard-break bonus) are not doubled.
- **Counter cards.** The hit is the return. For trait carriers this overrides
  SPEC §4.8's "an absent listed Poise value does not create reply Poise damage":
  the return's Poise becomes `2 × poise` if positive, otherwise N; Ward likewise
  with Flux. SPEC §4.8's explicit exclusions still win (a Spell Counter against a
  physical projectile deals no reply Poise). Order: Counterstrike scales the
  authored payload, then SPEC §4.8's return formulas run (`× 1.5` and the like),
  then Impact/Flux double the final Poise/Ward.
- **Defend cards.** Playing one arms a trait guard `{ poise: N, ward: F }`
  (max-merged, not stacked), saved on the player entity as `combatTraitGuard`,
  until the owner's next turn start. The first enemy direct-damage action whose
  receipt was reduced by Block, Barrier or Ward deals N Poise and F Ward to the
  attacker; the guard is then consumed.
- **Statuses.** A status may carry `fluxPerTurn`; at its owner's turn start it
  deals that much Ward damage (version 2 only). Burn and Crimson Blight carry 1.

## Card picks

Ids are card ids in `src/content/cards/*.js`, `src/content/progression/cards.js`
and `src/content/combatExpansionCards.js`. T is the tier above.

**Reaction**
- Every `maneuver:counter` card (28): shieldBash, guardCounter, riposte,
  spikedReprisal, progression-crimson-reprisal, evasiveGuard, dodgeRoll,
  quickstep, rondelParry, backstep, acrobaticsRogue, shadowstep, nockAndWait,
  bindingParry, lowGuardRiposte, progression-nightstep, umbralWard, wardingStar,
  frostCounter, fireCounter, lightningCounter, forceCounter, alterationCounter,
  illusionCounter, divineCounter, decayCounter, barrageCounter,
  progression-rime-mirror.
- Every card with an `evade` payload (adds crawlingShot).
- Sweeps: whirlingGuard, sweepingBlow (any tier); crimsonCleave,
  progression-ashen-cleaver at T ≥ 3.
- Defends at T ≥ 4: bracingStance, smokeBomb, vanish, progression-cinder-guard,
  progression-warbound-defiance, progression-pocket-coil, crystalBarrier,
  blightward, progression-lunar-aegis, progression-firmament-ward.

**Counterstrike**
- Every Counter card except dodgeRoll, evasiveGuard, backstep, acrobaticsRogue,
  nockAndWait and barrageCounter (22 of 28).
- crimsonCleave and progression-ashen-cleaver at T ≥ 4.

**Impact**
- Every Smash card (12): stomp, kickOff, ruinousBlow, poiseBreaker, sunderplate,
  sunderingChop, shieldCrash, greatswordSunderingHew, bashingBlow, colossusSmash,
  kilnCleave, progression-breaker-s-toll.
- Counters (20 of 28): the physical Counters except dodgeRoll and evasiveGuard,
  plus frostCounter, forceCounter, alterationCounter, illusionCounter,
  umbralWard, progression-rime-mirror.
- Physical `maneuver:attack` cards at T ≥ 3; every Sweep at T ≥ 2.
- Spell Defend cards with a block, barrier or Ward effect (any tier).
- Physical Defends at T ≥ 4: bracingStance, progression-cinder-guard,
  progression-warbound-defiance, progression-red-standard,
  progression-crown-of-cinders.

**Flux**
- Every `camp:spell` card with an enemy-targeted damage effect.
- Spell Counters with a Ward payload: umbralWard, wardingStar, frostCounter,
  fireCounter, lightningCounter, alterationCounter, illusionCounter,
  divineCounter, decayCounter, barrageCounter, progression-rime-mirror.
- At T ≥ 2: hex, contagion, butterflyPlague, gravityWell, blightBloom.
- Physical attacks whose resolved damage type is fire or arcane, at T ≥ 3.
- Statuses: burn, crimsonBlight.
- Powers: `camp:spell` Powers at T ≥ 4.

## Acceptance

- Projection: tags and N for graded ranks 0–5 and ungraded ranks; no tags under
  reaction rules version 1.
- Counterstrike 50% / 75%, minimum bonus 1, zero unchanged, formula amounts,
  scaled Counter payload, untouched draw and hit counts.
- Impact and Flux: N with no own Poise/Ward, doubling with it, once per target on
  an area hit, nothing on an avoided hit, doubled Counter return, defend guard
  consumed once, status Ward tick.
- Stack: two reactions resolve last-played-first and both before the enemy
  contact; Back with an empty stack equals version 1's Back; stacked instances
  are not re-offered; the LIFO affordability check; depth cap; fizzle pays
  nothing; save/restore mid-offer and mid-resolution with identical RNG counters;
  co-op seat order, per-seat cap, one Counter per seat, a co-op fizzle, and
  stale/foreign offers rejected; enemy reactions: Gilded Guard pushes before a
  heavy player hit and resolves first, the acting seat can answer it (and only
  that seat in co-op), Binding Riposte answers a player reaction at its chance,
  no window on Counter-return roots or reaction plays, one reaction per enemy
  per turn, a memoised roll and a committed plan survive save/restore, offer
  checks never draw, a fight without reaction moves keeps its RNG counters and
  intent sequences, and `enemyReactions` absent disables them;
  a version-1 snapshot replays unchanged.
