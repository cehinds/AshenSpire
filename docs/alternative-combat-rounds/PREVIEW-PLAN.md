# Combat Rounds Preview — plan

An opt-in setting that runs real fights on the alternative combat rounds
(timeline) engine in `docs/alternative-combat-rounds/`. Branch
`feature/CombatRoundsPreview`, PR into `feature/TagRefactor`.

## Owner decisions (2026-10-11)

- Reached through a Settings toggle in real runs: Advanced → Combat, on dev/test
  builds only (hidden on release), chosen at New Run and fixed for that run.
- Solo **and co-op/LAN** (co-op parity is built, not deferred).
- The fight uses the live hand rules: the configured `draw` row
  (base 4, +0.2 per INT above 4, so +1 per 5 INT), hand cap 15, unplayed cards
  shuffle back into the draw pile, Retain and Ethereal, the `handRules` settings.
  Resources are live: stamina is SP, mana is MP.
- The timeline decides order (initiative = base + momentum + d4, merge mode),
  hit or miss, and momentum. The **live engine applies effects**: a landed card
  or enemy move runs its real effects (damage math, statuses, draw, relics,
  triggers).
- Counter and Evade **work as they do live** (SPEC §4.7/§4.8: Counter halves the
  hit and hits back; live Evade), but they **have speed values** and take their
  place in the speed order. The timeline's own counter-cancel and evade-percent
  rules are not used in the preview.
- Enemy hidden queues: enemy SP is **stat-driven, base 3**; most enemies use the
  default. Each move costs 1 SP unless the move says otherwise.
- Perception: visible enemy actions = 1 + the player's perception level; each is
  shown at stage 3 when today's intent read is exact, `?` when hidden (reuses the
  §4.9 knowledge rolls).
- Initiative track: stage 0 (`?`) actions within the read count are left out of
  the order; stage 1 and up are placed; actions beyond the read count are placed as
  `?`.
- A queued card pays only its Stamina cost as SP (Mana as MP); live Actions costs
  are not paid in the preview.
- A queued Counter answers only the next attack from its target, then is spent.
- Co-op momentum is per seat, against each enemy.

## Architecture

- Engine code is copied into `src/engine/combatRounds/` (`resolver.js`,
  `timeline.js`, and a JSON-only `round.js` that can pause on a reaction and be
  saved mid-round). The docs prototypes become re-exports of the src copies, so
  the existing 279 tests check the engine copy. Tables move to
  `src/content/combatRounds.js` (content is data; a test checks they match the
  CSVs).
- `src/model/combatRounds.js` turns the setting into rules; `createRunCombat`
  reads it once and `createCombat` / `createCoopCombat` stamp
  `combat.combatRounds`. The field is absent when the toggle is off, so normal
  fights and saves are byte-identical.
- Player turn: playing a card queues it (cost paid at queue time; an unqueue
  intent refunds). End Turn keeps its label and commits the round: enemy queues adapt, the round steps
  through the timeline, a player-targeted attack can pause for a reaction through
  the existing `chooseReaction` intent, then the live turn-end hand rules run.
- Screen: see the Screen section below (intent box with follow-ups, card
  symbols, momentum on the turn banner, target outlines).
- Saves: the round state (queues, momentum, charges, cursor while paused) is
  snapshotted; a new RNG stream is appended so existing seeds keep their rolls.

## Phases

- [x] P0 SPEC change: new §4.11 Combat Rounds Preview, pointers from §4.1, §4.6,
  §4.7, §4.9, §4.10 (size S)
- [x] P1 Port the engine into `src/engine/combatRounds/` with a pausable,
  serialisable round (size M)
- [ ] P2 Rules model, Advanced → Combat setting row, RNG stream (size S)
- [ ] P3 Solo adapter in `combat.js`: queue, End Turn commits, reactions, live effects,
  live Counter/Evade with speed (size L)
- [ ] P4 Save and resume, mid-round included (size M)
- [ ] P5 UI per the Screen section: intent box follow-ups, card speed and hint
  symbols, momentum on the turn banner, target outlines, blue playable outline
  (size M)
- [ ] P6 Co-op/LAN parity: per-seat queues and momentum in `coopCombat.js`,
  lobby forwards the setting, LAN intent privacy kept (size L)

Each phase keeps `node tests/run-node.mjs` green and gets a review agent before
it is pushed.

## Screen (owner, 2026-10-11)

The preview screen is the live combat screen with only these additions:

- Enemy intent box: the current action at today's size, then that enemy's
  follow-up actions as smaller symbols in the same box.
- Small symbols on each hand card: its speed and the hint arrow against the
  target (› / » faster, ‹ / « slower).
- Momentum on the turn banner, for the targeted enemy (the first enemy when
  nothing is targeted): +2/+3 green outline with a "++" tab; ±1 orange outline
  with a "+-" tab; −2/−3 red outline with a "--" tab; 0 no outline and no tab.
- Target outline while choosing a target for a card: green when the card has the
  advantage in both speed and stance type, yellow when in only one (even if the
  other is a disadvantage), red when at a disadvantage in both, none otherwise.
  Only revealed dimensions count: stance from stage 2, speed only at stage 3 (as
  card hints). An unrevealed dimension counts as neither, so nothing hidden leaks
  through the colour, and a LAN peer computes it from what it was sent.
- The live green outline for the player's selection and playable cards becomes
  blue in the preview, so green only means advantage.
- No queue strip, no initiative track; End Turn stays as it is.
