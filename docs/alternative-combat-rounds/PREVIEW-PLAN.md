# Combat Rounds Preview — plan

An opt-in setting that runs real fights on the alternative combat rounds
(timeline) engine in `docs/alternative-combat-rounds/`. Branch
`feature/CombatRoundsPreview`, PR into `feature/TagRefactor`.

## Owner decisions (2026-10-11)

- Reached through a Settings toggle in real runs: Advanced → Combat, on dev/test
  builds only (hidden on release), chosen at New Run and fixed for that run.
- Solo **and co-op/LAN** (co-op parity is built, not deferred).
- The fight uses the live hand rules: draw 4 + INT, hand cap 15, unplayed cards
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
- Initiative track: only `?` (stage 0) actions are left out of the order; stage 1
  and up are placed.

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
  intent refunds). End Turn becomes Commit: enemy queues adapt, the round steps
  through the timeline, a player-targeted attack can pause for a reaction through
  the existing `chooseReaction` intent, then the live turn-end hand rules run.
- Intents: one icon per visible enemy action (reusing the intent presentation),
  card-hint borders and arrows, a momentum badge per enemy.
- Saves: the round state (queues, momentum, charges, cursor while paused) is
  snapshotted; a new RNG stream is appended so existing seeds keep their rolls.

## Phases

- [ ] P0 SPEC change: new §4.11 Combat Rounds Preview, pointers from §4.1, §4.6,
  §4.7, §4.9, §4.10 (size S)
- [ ] P1 Port the engine into `src/engine/combatRounds/` with a pausable,
  serialisable round (size M)
- [ ] P2 Rules model, Advanced → Combat setting row, RNG stream (size S)
- [ ] P3 Solo adapter in `combat.js`: queue, commit, reactions, live effects,
  live Counter/Evade with speed (size L)
- [ ] P4 Save and resume, mid-round included (size M)
- [ ] P5 UI: queue strip, slot icons, momentum badge, card hints, Commit (size L)
- [ ] P6 Co-op/LAN parity: per-seat queues and momentum in `coopCombat.js`,
  lobby forwards the setting, LAN intent privacy kept (size L)

Each phase keeps `node tests/run-node.mjs` green and gets a review agent before
it is pushed.
