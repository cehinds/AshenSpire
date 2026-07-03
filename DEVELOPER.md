# DEVELOPER.md — extending EldenSpire

How to run, test, and add content. The architecture contract lives in
[SPEC.md §3](SPEC.md); exact engine signatures in
[docs/ENGINE-API.md](docs/ENGINE-API.md). This file is the practical guide.

## Run & test

```
# play (no build step — any static server, or open index.html directly)
npx serve .            # then http://localhost:3000

# tests (22 assertions, SPEC §8)
node tests/run-node.mjs        # CI-style, exits 1 on failure
# or open tests/index.html in a browser — same suite, green/red list
```

## The four layers (dependencies point down only)

```
src/ui/       renders model state, dispatches player intents  (DOM lives here ONLY)
src/engine/   generic interpreters + seeded procedural systems (headless)
src/model/    schemas, registries, formulas, validation, state (headless)
src/content/  pure data — every card/status/enemy/relic and every tuning number
```

Rules that keep this honest:

1. **No entity ids in engine/model.** There is no `if (status === 'bleed')`
   anywhere below `src/content/`. If you need new behavior, either compose it
   from the existing primitives (opcodes/formulas/triggers/status model) or
   extend a closed set — which is an engine PR with SPEC + ENGINE-API updates.
2. **All content is schema-validated** at boot (dev banner + console) and by
   test 15. Unknown fields, dangling ids, unknown opcodes all fail loudly.
3. **Every number a player sees comes from the engine** (`previewCard` /
   `previewIntent`). The UI never does math.

## Add a card (one file: `src/content/cards/<class>.js`)

```js
{
  id: 'moonSlash', name: 'Moon Slash', class: 'vagabond', rarity: 'common',
  cost: 1, type: 'attack', keywords: [], icon: '🌙',
  effects: [
    { op: 'damage', target: 'enemy', amount: 6 },
    { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1 },
  ],
  textTemplate: 'Deal {damage} damage. Apply {weak} Weak.',
  upgrade: { effects: [
    { op: 'damage', target: 'enemy', amount: 9 },
    { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 2 },
  ] },
}
```

Then add its id to the class `cardPool` in `src/content/classes.js` if it
should appear in rewards. Notes:

- `{damage}` tokens bind to effects **in order**; repeats are `{damage.2}`.
  `applyStatus` binds under its **status id** (`{weak}`). A literal number on a
  player-visible op without a token is a validation error.
- Powers whose stack count is invisible ("gain the power", not "gain N")
  use formula-valued stacks to opt out of the token rule:
  `stacks: { f: 'add', args: [1] }` — see Rallying Standard.
- `upgrade` is a partial override: present fields replace base ones;
  `keywords` replaces the whole list (that's how Kick Off+ drops Exhaust).

## Add a status (one file: `src/content/statuses.js`)

```js
{
  id: 'frostbite', name: 'Frostbite', icon: '❄',
  stackMode: 'unique', decay: 'onConsume',
  modifiers: { damageTakenMult: 1.3 },
  tooltip: 'Takes 30% more attack damage until consumed.',
}
```

The engine interprets `stackMode` (add/refresh/unique), `decay`
(none / perTurnEnd / {duration:n} / onConsume), build-up `meter`s
(max, growthMult, onFill effects), stat `modifiers`, and trigger `hooks`.
Bleed, Scarlet Rot, and Staggered are all plain data here — test 17 proves a
brand-new status needs zero engine changes.

## Add a relic (one file: `src/content/relics.js`)

```js
{
  id: 'whetstoneFragment', name: 'Whetstone Fragment', rarity: 'common', icon: '🪨',
  triggers: [{
    on: 'damageDealt', once: true,
    if: { p: 'all', preds: [{ p: 'eventIsAttack' }, { p: 'eventSourceIsOwner' }] },
    do: [{ op: 'damage', amount: 4 }],
  }],
  textTemplate: 'Your first attack each combat deals {damage} extra damage.',
}
```

## Add an enemy (one file: `src/content/enemies/act<N>.js`)

```js
{
  id: 'gildedKnight', name: 'Gilded Knight', hp: [40, 44], poiseMax: 18, art: '♞',
  moves: {
    thrust: { intent: 'attack', damage: 10, weight: 55, maxConsecutive: 2 },
    parry:  { intent: 'block', block: 9, weight: 45, maxConsecutive: 1 },
  },
}
```

Add it to an encounter in `src/content/encounters/act<N>.js` so it can appear.
Special moves: `delay: { turns, whileCharging }` makes a telegraphed
delayed attack (Held Blade pattern — Stagger cancels it); `locked: true` +
`phases[].unlockMoves` gates moves behind HP-threshold phase changes.

## Add an event (one file: `src/content/events.js`)

```js
{
  id: 'testShrine', name: 'Test Shrine', art: '🕯',
  text: 'A quiet shrine offers a choice.',
  choices: [
    { label: 'Pray (heal 10% max HP)',
      effects: [{ op: 'heal', target: 'self', amount: { f: 'percentMaxHp', of: 'self', pct: 10 } }],
      resultText: 'You are mended.' },
    { label: 'Leave', effects: [], resultText: 'You leave it be.' },
  ],
}
```

Events fire on `?` (Unknown) map nodes. `effects` are the **same DSL** as cards,
but run-level (SPEC §3.4): `addRunes`, `addRelic {random?|id}`,
`removeCardFromDeck`, `upgradeCard {random?}`, `loseMaxHpPct`,
`startCombat {encounterId}`, plus `heal`/`damage`/`addCardToDeck`. `requires?`
(e.g. `{ runes: 50 }`) gates a choice; a `startCombat` effect hands control to
the combat orchestrator after `resultText` shows. Nothing to register — every
shipped event is reachable via Unknown nodes.

> Each walkthrough above is **validation-checked**: add the snippet and run the
> suite — test 15 (content validation) rejects unknown fields, bad enums,
> dangling ids, out-of-set opcodes/formulas/predicates, and unbound template
> tokens. All six types (card, status, relic, enemy, encounter, event) are
> confirmed to validate from these exact examples.

## Reference — the closed sets (extend = engine PR)

| Set | Where defined | Contents |
|---|---|---|
| Combat opcodes | `model/schemas.js` `COMBAT_OPCODES` | damage, block, applyStatus, removeStatus, draw, discard, exhaust, addCard, gainEnergy, loseHp, heal, shuffleDiscardIntoDraw, enterStance, poiseDamage |
| Run opcodes | `RUN_OPCODES` | addRunes, addCardToDeck, removeCardFromDeck, upgradeCard, addRelic, addFlask, loseMaxHpPct, startCombat |
| Targets | `TARGETS` | self, enemy, allEnemies, randomEnemy, player, owner |
| Formula ops | `model/formulas.js` `FORMULA_OPS` | add, mul, percentMaxHp, missingHp, stacks, energySpent, blockOf, hpOf, cardsPlayedThisTurn |
| Trigger events | `TRIGGER_EVENTS` | every bus event (ENGINE-API §7) + ownerTurnStart/ownerTurnEnd + hpBelowPct |
| Predicates | `PREDICATES` | inStance, hasStatus, hasBlock, hpBelowPct, firstCardThisTurn, firstAttackThisCombat, cardTypeIs, everyNthCardThisCombat, random, eventIsAttack, eventSourceIsOwner, eventTargetIsOwner, eventStatusIs, all, any, not |
| Relic passives | `PASSIVE_KEYS` | runeGainMult, eliteExtraCardReward, flaskPowerMult, revealUnknown, shrineHealMult, shrineNoRest, powerCostReduction |
| Modifier keys | `MODIFIER_KEYS` | damageDealtMult, damageTakenMult, blockGainedMult, attackDamageAdd, blockAdd, skipTurn, retainBlock, blockCap, meterMaxGrowthDisabled |

Escape hatch: `src/content/scripts.js` (named functions callable as
`{ script: 'name' }` effects). Budget < 5% of content, each entry justified in
a comment. Current usage: **one** (Wondrous Physick — dynamic meta-selection
of other flasks' effect lists, which the DSL cannot reference).

## Performance (SPEC §9 M4)

Combat feedback is **CSS-driven**: JS only toggles short-lived classes and
appends floating numbers/banners that self-remove after ≤320 ms (`src/ui/fx.js`),
staggered `STEP_MS` apart and skippable on click. There are **no
`requestAnimationFrame` / `setInterval` render loops** anywhere — the single
`rAF` in the codebase fires *one* frame to kick a CSS transition (the played-card
ghost). So there are **no per-frame JS allocations**; frame rate is just the
browser compositing a handful of transitions, comfortably 60 fps on mid-range
hardware. Ambient title effects (embers, gold glow) are pure CSS and honor
`prefers-reduced-motion` (`styles/ui.css`).

## Balance & telemetry

`node tools/balance.mjs` regenerates [docs/BALANCE.md](docs/BALANCE.md): enemy
intent-DPS vs. HP sanity table, measured starting-deck DPS per class, and an
empirical Act-1 win-rate pass (the naive bot). The **Run History** screen
(Title → Run History) shows per-run outcomes and overall/per-class win rates —
the live win-rate telemetry the balance pass is tuned against. Re-run the harness
after any content or tuning change to catch regressions.

`node tools/runsim.mjs [N]` goes further: it plays **whole seeded runs** (map
path → encounters → combats → rewards → shrines/events/ambushes → act bosses,
Acts 1–3) with the same greedy bot plus a simple pilot. Any crash is a real
integration bug; the win rate is a completability **floor**, not a balance
target (the bot can't pilot combos or curate a deck). Baseline at 30 runs/class:
zero crashes, and the Prophet completes full 3-act runs even naively.

## M1 known deviations (tracked for M2/M3)

1. **Frostbite** is specced (SPEC §4.4) but not shipped — its
   "next big hit +30%, then consumed" needs a conditional-consume hook no M1
   content uses. Lands with the M2 flask that applies it.
2. **Guilt** ships as an inert unplayable curse — its "lose 1 HP at turn end
   while in hand" needs an in-hand card hook (engine seam planned with M2's
   event system, which is the first thing that can grant Guilt).
3. **Warrior's Vow** enters Bloodflame instead of "a stance of your choice" —
   a generic choose-one UI primitive is an M2/M3 feature.
4. **Lord's Blood** freezes Poise thresholds as well as Bleed (the
   `meterMaxGrowthDisabled` flag is global by design — strictly a buff; the
   card text says so honestly).
