# ENGINE-API.md — Model & Engine layer contract (M1)

Authoritative reference for everything under `src/model/` and `src/engine/`
(except `mapgen.js`, `encounters.js`, `save.js` — M2). Downstream agents
(content, UI, tests) build against this document. Where this document and
SPEC.md disagree, SPEC.md wins.

All modules are plain ES modules, dependency-free, and **headless**: they run
identically in Node (`node --experimental-default-type=module` not required —
use `.js` with `import`, or import via `file://` URLs / a `<script type="module">`)
and in the browser. Nothing references `document`, `window`, `localStorage`,
or timers.

Layer rule (SPEC §3.1): `content → model → engine → ui`, dependencies point
downward only. The engine imports from the model; the model imports nothing
above it.

---

## 1. Content bundle → registries

### `createRegistries(contentBundle)` — `src/model/registries.js`

```js
import { createRegistries } from './src/model/registries.js';

const bundle = {
  version: '1',                       // becomes registries.contentVersion
  balance: { energy: 3, draw: 5, handMax: 10, flaskSlots: 3,
             startingRunes: 0,
             poise: { growthMult: 1.25, onFill: [/* effects */] },
             /* ...every other tuning constant */ },
  cards: [ /* card defs */ ],
  relics: [], statuses: [], stances: [], keywords: [],
  enemies: [], encounters: [], events: [], flasks: [], classes: [],
  mapConfigs: { 1: {/*act 1*/}, 2: {}, 3: {} },
  scripts: { scriptName: (ctx, action) => { /* escape hatch */ } },
};
const registries = createRegistries(bundle);
```

- Missing collections default to empty. Duplicate ids **throw**.
- Every def is **deep-frozen**. Getters **throw** on unknown ids.
- Result shape (frozen):

| Property | API |
|---|---|
| `registries.cards` … `.relics`, `.statuses`, `.stances`, `.keywords`, `.enemies`, `.encounters`, `.events`, `.flasks`, `.classes` | `.get(id)` (throws), `.has(id)`, `.ids()`, `.all()`, `.size` |
| `registries.balance` | frozen constants object |
| `registries.mapConfig(act)` | throws on unknown act; `registries.mapConfigs` raw map |
| `registries.scripts` | frozen `{ name: fn }` |
| `registries.contentVersion` | string |

### `resolveCard(registries, { cardId, upgraded })` — `src/model/registries.js`

Returns the **effective card def** (frozen, cached). Upgrade merge rules:
- scalar fields in `upgrade` (cost, textTemplate, …) replace the base value;
- `upgrade.effects` **replaces** the whole effects array when present;
- `upgrade.keywords` **replaces** the base keywords when present (list the full
  upgraded set — this is how an upgrade removes Exhaust);
- name defaults to `base.name + '+'` unless `upgrade.name` given;
- resolved def carries `upgraded: true`.

### Engine-consulted balance keys (defaults in parentheses)

| Key | Meaning |
|---|---|
| `energy` (3) | player energy at turn start |
| `draw` (5) | cards drawn at player turn start |
| `handMax` (10) | hand limit; overflow draws go to discard |
| `flaskSlots` (3) | max flask slots (run-level `addFlask`) |
| `poise.growthMult` (1.25) | poiseMax multiplier after each Stagger (ceil) |
| `poise.onFill` ([]) | effects enqueued when a poise meter fills, `owner`/`self` = the Staggered enemy. **This is where content applies its "staggered" status** (e.g. `damageTakenMult: 1.5` + a `playerTurnEnd` hook that removes itself). The engine never names that status. |
| `startingRunes` (0) | initial runes in `createRunState` |

---

## 2. Entity schemas (content shapes)

Defined in `src/model/schemas.js` (`SCHEMAS`), enforced by
`validateContent`. **Unknown fields are validation errors.** All enum values
are lowercase.

### Card
```js
{ id, name, class,           // class id or 'colorless'
  rarity,                    // starter|common|uncommon|rare|special
  cost,                      // integer ≥ 0, or 'X'
  type,                      // attack|skill|power|curse|status
  keywords: [],              // keyword ids; engine semantics for:
                             // exhaust, ethereal, innate, retain, unplayable
  effects: [],               // effect DSL, §4 below
  textTemplate,              // '{token}' templating, §8 below
  upgrade?: { name?, cost?, effects?, keywords?, textTemplate? },
  icon?, flavor?, script? }
```
Unplayability is **keyword-driven**: give curses/statuses the `unplayable`
keyword; a playable status card (cost + effects) simply omits it.

### Relic
```js
{ id, name, rarity,          // starter|common|uncommon|rare|boss
  textTemplate, triggers: [ /* trigger DSL, §5 */ ], icon?, flavor?, script? }
```

### Status (SPEC §3.7 — statuses are content, not code)
```js
{ id, name, icon?,
  stackMode: 'add'|'refresh'|'unique',
  decay: 'none'|'perTurnEnd'|'onConsume'|{ duration: n },
  meter?: { max, growthMult, onFill: [effects] },   // build-up statuses
  modifiers?: { damageDealtMult?, damageTakenMult?, blockGainedMult?,
                attackDamageAdd?, blockAdd?,
                skipTurn?, retainBlock?, blockCap?, meterMaxGrowthDisabled? },
  hooks?: [triggers], tooltip?, script? }
```
Semantics implemented by `src/engine/statuses.js`:
- `stackMode` — `add`: stacks (or meter points) accumulate; `refresh`:
  `max(existing, applied)`; `unique`: pinned to 1 stack.
- `decay` — `perTurnEnd`: −1 stack at the **owner's** turn end, expires at 0;
  `{duration:n}`: expires entirely after n of the owner's turns (re-applying
  **adds stacks and refreshes the duration**); `onConsume`: never auto-decays —
  content removes it via a hook (`removeStatus`); `none`: permanent.
- `meter` — applied stacks feed `meter.value`. On `value >= max`: emit
  `meterFilled`, enqueue `onFill` (with `owner`/`self` = the meter's carrier),
  carry overflow into the reset value, then `max = ceil(max × growthMult)`
  unless any living combatant has `meterMaxGrowthDisabled`. A meter status's
  "stacks" (for formulas/predicates) **is** its meter value.
- `modifiers` — `*Mult` keys are **flat** (not scaled by stacks) and multiply
  across statuses; `*Add` keys are **per-stack** (value × stacks) and sum.
  `skipTurn` (bool): the owning enemy skips its move. `retainBlock` (bool):
  block survives the owner's turn start. `blockCap` (number): hard cap on the
  owner's block (max of caps wins; also clamps retained block). 
- `hooks` — trigger DSL; `on: 'ownerTurnStart'|'ownerTurnEnd'` fire relative
  to the status's owner; any bus event name also works (fires whoever owns it).

### Stance
```js
{ id, name, icon?, onEnter?: [effects], modifiers?, hooks?, tooltip?, script? }
```
Same modifier/hook shapes as statuses (stacks = 1). Exclusivity is handled by
the `enterStance` opcode (exit event → enter event → onEnter effects).

### Keyword
`{ id, name, tooltip }` — display only.

### Enemy
```js
{ id, name, hp: [min, max],  // rolled on stream 'enemyHP'
  poiseMax,                  // engine poise meter threshold
  moves: {
    moveId: { intent: 'attack'|'block'|'buff'|'debuff'|'unknown',
              damage?, hits?, block?, weight, maxConsecutive?,
              effects?: [effects],
              locked?: true,               // unavailable until unlockMoves
              delay?: { turns,             // ≥1: resolves that many turns later
                        whileCharging?: { block?, effects?, intent? } } },
  },
  firstMove?,                // scripted opener (turn-1 intent)
  phases?: [ { on: 'hpBelowPct', pct, once?, if?, do: [effects],
               unlockMoves?: [moveId] } ],
  art?, script? }
```
**Delayed moves (generic — any enemy may use them):** when a move with `delay`
is executed, the enemy instead performs `whileCharging` (block/effects), keeps
the original intent telegraphed (`intent.pending = true`), and records
`pendingMove`. `delay.turns` enemy turns later the main payload
(damage/block/effects) resolves **regardless of newly rolled intents**.
A poise-meter fill (Stagger) **cancels** the pending move.

`phases` with `on:'hpBelowPct'` default to `once: true` and are checked after
every HP change; other `on` values behave like normal triggers owned by the
enemy.

### Encounter
`{ id, enemies: [enemyIds], weight, minFloor?, pool: 'normal'|'elite'|'boss' }`

### Event
`{ id, name, art?, text, choices: [{ label, requires?, effects, resultText }] }`

### Flask
`{ id, name, rarity, targeted?, effects, icon?, textTemplate?, script? }`

### Class
`{ id, name, maxHp, startingRelic, startingDeck: [cardIds], cardPool: [cardIds], description? }`

### MapConfig (per act)
`{ floors, columns, pathCount, typeWeights: { type: weight }, floorRules? }`

---

## 3. Formulas — `src/model/formulas.js`

`evaluate(formula, ctx) → integer` (floors once at the end; `min`/`max`
clamps on any node apply before the floor; throws on unknown ops / NaN /
unresolvable refs).

```js
ctx = { entities: { self, owner, target, enemy, player, allEnemies: [] },
        energySpent, cardsPlayedThisTurn }
```

Closed op set (`FORMULA_OPS`):

| Formula | Value |
|---|---|
| plain number | itself |
| `{ f:'add', args:[...] }` / `{ f:'mul', args:[...] }` | sum / product (nestable) |
| `{ f:'percentMaxHp', of, pct, min?, max? }` | `of.maxHp × pct/100`, clamped |
| `{ f:'missingHp', of, max? }` | `of.maxHp − of.hp`, clamped |
| `{ f:'stacks', status, of, per? }` | total stacks on `of` (sum for `allEnemies`); with `per`, **`floor(total / per)`** (whole chunks) |
| `{ f:'energySpent', per? }` | `energySpent × per` (per defaults 1 — "N per energy") |
| `{ f:'blockOf', of }` / `{ f:'hpOf', of }` | current block / HP |
| `{ f:'cardsPlayedThisTurn', per? }` | `count × per` |

Note the deliberate asymmetry: `stacks.per` **divides** ("heal 2 per 4
stacks" → `mul[2, stacks(per:4)]`), while `energySpent.per` /
`cardsPlayedThisTurn.per` **multiply** ("deal 6 per energy" →
`energySpent(per:6)`).

`of` refs: `self` (effect source), `owner` (status/trigger owner), `target` /
`enemy` (contextual target), `player`, `allEnemies` (only `stacks` accepts the
group). Exports: `evaluate`, `isFormula`, `FORMULA_OPS`, `FORMULA_OF`.

---

## 4. Effect DSL (opcodes) — executed by `src/engine/actions.js`

An effect list is an array of opcode objects. Common fields on any opcode:
`target`, `amount` (number | formula), `if` (predicate), `repeat` (number |
formula). Targets (closed set): `self | enemy | allEnemies | randomEnemy |
player | owner`. An omitted `target` falls back to the action's contextual
target, then its source — content should be explicit. `'enemy'` from a
player-sourced effect uses the aimed target (UI must supply `targetId` for
such cards; the engine falls back to the first living enemy); from an
enemy-sourced effect it resolves to the player.

| Opcode | Fields | Behavior / events |
|---|---|---|
| `damage` | `amount`, `hits?` | full §4.2 attack math per hit; block absorbs first. `hits` may be a formula; targets re-resolve per hit (so `randomEnemy` splits). → `damageDealt`, `hpLost`, maybe `enemyDied` |
| `block` | `amount` | `(base + blockAdd×stacks) × blockGainedMult`, floored, min 0, `blockCap` honored → `blockGained` |
| `applyStatus` | `status`, `stacks?`(1) | status model §2 → `statusApplied`, maybe `meterFilled` |
| `removeStatus` | `status` | → `statusExpired` (reason `'consumed'`) |
| `draw` | `amount` | reshuffles discard (stream `shuffle`) when needed; overflow past `handMax` → discard → `cardDrawn` / `cardDiscarded(handFull)` / `deckShuffled` |
| `discard` | `amount?`(1), `random?` | from hand (random uses stream `misc`; otherwise rightmost) → `cardDiscarded(effect)` |
| `exhaust` | `amount?`(1), `random?` | from hand → `cardExhausted(effect)` |
| `addCard` | `card`, `pile?`('discard'), `position?`('random'), `count?`(1) | creates fresh instances; `position: top|bottom|random`; adding to a full hand overflows to discard |
| `gainEnergy` | `amount` | → `energyGained` |
| `loseHp` | `amount` | direct HP loss — ignores all attack modifiers **and block** → `hpLost` |
| `heal` | `amount` | capped at maxHp → `healed` (amount = actual gained) |
| `shuffleDiscardIntoDraw` | — | → `deckShuffled` |
| `enterStance` | `stance` | no-op if already in that stance (StS); else exits previous → `stanceExited`, `stanceEntered`, then enqueues the stance's `onEnter` effects |
| `poiseDamage` | `amount` | feeds the enemy's poise meter; on fill: skip flag set, pending delayed move cancelled, `meterFilled(meter:'poise')` + `enemyStaggered` emitted, `balance.poise.onFill` enqueued, `poiseMax ×= growthMult` (ceil) unless growth disabled |

Run-level opcodes (`addRunes {amount}`, `removeCardFromDeck {card?|random?}`,
`upgradeCard {card?|random?}`, `addRelic {id?|random?}`, `addFlask
{id?|random?}`, `loseMaxHpPct {pct}`, `startCombat {encounterId}`) require a
run context — use:

```js
import { executeRunEffects } from './src/engine/actions.js';
const { events } = executeRunEffects({ run, registries, rng }, choice.effects);
```

Inside a run context, `damage`/`loseHp`/`heal` apply to the run's HP through a
player facade (for events like "take 6 damage"). `startCombat` sets
`run.combatEntered`; the orchestrator starts the combat. Random picks use
streams `relicRewards` / `flaskRewards` / `misc`.

**Escape hatch:** anywhere an effect is legal, `{ script: 'name', ...args }`
calls `registries.scripts.name(ctx, action)`. Budgeted <5% (validated).

---

## 5. Trigger DSL — `src/engine/triggers.js`

One declarative shape for relics, status hooks, stance hooks, boss phases:

```js
{ on: '<event name>', if?: <predicate>, do: [effects], once?: true, limitPerTurn?: n }
```

- Sources are scanned **live** on every emit — statuses applied mid-combat
  hook up automatically; removed statuses stop firing.
- `do` effects are **enqueued** (FIFO) with `source = owner = the trigger's
  owner` and `target =` the event's subject entity when the payload names one
  (`targetId`/`enemyId`), else null. Triggers never mutate directly (SPEC §3.9).
- `once` is per combat per source; `limitPerTurn` resets each turn.
- Relic trigger fires additionally emit `relicTriggered { relicId }`.
- `on: 'ownerTurnStart' | 'ownerTurnEnd'` fire per entity in the turn loop.
- Recursion guard: emit depth > 64 throws.

Predicates (`evalPredicate(ctx, pred, pctx)`, closed set):

| Predicate | True when |
|---|---|
| `{ p:'inStance', stance }` | player's stance is `stance` |
| `{ p:'hasStatus', of, status, atLeast? }` | stacks (or meter value) ≥ atLeast (default 1) |
| `{ p:'hasBlock', of }` | `of.block > 0` |
| `{ p:'hpBelowPct', of, pct }` | `of.hp ≤ of.maxHp × pct/100` |
| `{ p:'firstCardThisTurn' }` | gated card was the 1st played this turn |
| `{ p:'firstAttackThisCombat' }` | gated attack was the 1st this combat |
| `{ p:'cardTypeIs', type }` | the contextual card's type matches |
| `{ p:'everyNthCardThisCombat', n }` | card ordinal this combat ≡ 0 (mod n) |
| `{ p:'random', pct }` | roll on stream `misc` |
| `{ p:'eventIsAttack' }` | the trigger's firing event has `isAttack: true` (damageDealt) |
| `{ p:'eventSourceIsOwner' }` | the firing event's `sourceId` is the trigger's owner |
| `{ p:'all'/'any', preds: [] }`, `{ p:'not', pred }` | combinators |

`cardTypeIs` works in card-effect `if`s (contextual card) AND in triggers on
`cardPlayed` (falls back to the event's `cardType`).

Predicate `of` refs: `self | owner | player | enemy | target`.

---

## 6. Combat — `src/engine/combat.js`

### `createCombat({ registries, rng, player, enemyIds })` → combat state

```js
import { createRng } from './src/engine/rng.js';
import { createCombat, dispatch, previewCard, previewIntent } from './src/engine/combat.js';

const rng = createRng(seed /*, savedCounters */);
const combat = createCombat({
  registries, rng,
  player: { classId, maxHp, hp,
            deck: [{ instanceId, cardId, upgraded }],
            relicIds: [...], flasks: [{ flaskId }] /* optional */ },
  enemyIds: ['<enemyDefId>', ...],   // row order; instances become 'e1','e2',…
});
```

Runs the full combat-start sequence (SPEC §4.1): enemy HP rolled on
`enemyHP`; deck shuffled on `shuffle` with **Innate** cards moved (stably) to
the top; `combatStart` emitted (relic combat-start triggers fire and drain);
initial intents rolled on `enemyAI` (honoring `firstMove`); player turn 1
starts (block expiry → energy → draw 5 → `playerTurnStart` + owner hooks).
Setup events are in `combat.eventLog`.

### Combat state shape (read freely; MUTATE ONLY via dispatch)

```js
{
  registries, rng,
  turn: 1,                    // player-turn counter
  phase: 'player'|'enemy'|'ended',
  result: null|'victory'|'defeat',
  handMax, drawPerTurn,
  player: {
    id:'player', kind:'player', classId, hp, maxHp, block,
    energy, energyMax,
    statuses: { [statusId]: { stacks, duration?, meter?: {value,max} } },
    stanceId: null|string, relicIds: [], flasks: [{flaskId}],
    counters: { cardsPlayedThisTurn, cardsPlayedThisCombat, attacksPlayedThisCombat },
    alive: true,
  },
  enemies: [{
    id:'e1', kind:'enemy', enemyId, hp, maxHp, block, statuses:{},
    poiseMeter: { value, max },
    movesHistory: ['moveId', ...],          // rolled intents, in order
    intent: { kind, moveId, damage, hits, block, delayed, pending } | {kind:'staggered'},
    pendingMove: null | { moveId, resolveOnTurn },
    skipNextTurn: false, unlockedMoves: [], alive: true,
  }],
  piles: { draw: [cardInstance], hand: [], discard: [], exhaust: [] },
  //      draw[0] is the TOP of the draw pile.
  eventLog: [ every event since combat creation ],
}
```
Powers leave play entirely when played (they appear in **no** pile — StS
behavior). `combat.queue`, `triggerState`, `_`-prefixed fields, and the
`emit`/`enqueue`/`nextInstanceId` methods are engine-internal.

### `dispatch(combat, intent)` → `{ events }`

Combat intents (closed set for M1):

| Intent | Effect |
|---|---|
| `{ type:'playCard', cardInstanceId, targetId? }` | validates phase / hand / `unplayable` keyword / cost (X-cost = all current energy, always affordable); pays cost (`energySpent`), removes from hand, bumps counters, enqueues card effects then emits `cardPlayed`, drains the queue; then places the card (Exhaust keyword → exhaust pile + `cardExhausted(played)`; power → removed from play; else → discard, silently). `targetId` required semantics: cards with any `target:'enemy'` effect should get one from the UI (engine falls back to the first living enemy). |
| `{ type:'endTurn' }` | `playerTurnEnd` + owner hooks → player decay → discard hand except **Retain**, **Ethereal** in hand exhausts (`cardExhausted(ethereal)`) → energy zeroed → enemy phase (below) → intents rerolled → next player turn starts. Returns after the whole cycle. |
| `{ type:'useFlask', slot, targetId? }` | consumes `player.flasks[slot]`, emits `flaskUsed`, enqueues the flask's effects, drains. Throws on empty slot (no-op registries are fine — just don't give the player flasks). |

Enemy phase order (per SPEC §4.1(5)): `enemyTurnStart` → all living enemies
lose block (unless `retainBlock`) → for each enemy in row order:
`ownerTurnStart` hooks (DoTs) → act (skip if `skipNextTurn`/`skipTurn`;
resolve `pendingMove` if due; commit a `delay` move; else execute the
telegraphed move — damage hits, block, effects, all through the queue) →
`ownerTurnEnd` hooks → decay. Then `enemyTurnEnd`.

Illegal intents **throw** (wrong phase, not in hand, unplayable, not enough
energy, invalid target, combat over). `{ events }` contains exactly the events
emitted during that dispatch, in order — the UI's animation script.

### `previewCard(combat, cardInstanceId, targetId?)`

Returns resolved numbers using the **same math as execution** (SPEC §3.13, §4.2):

```js
{ cardId, upgraded, name, type,
  cost,                    // number; for X-cost, the player's current energy
  costIsX, needsTarget,
  values: [ { op, token?, value, hits?, status?, target, perTarget? } ],
  tokens: { damage: 9, hits: 3, someStatusId: 5, ... } }   // template fill-ins
```
Damage entries include `perTarget: { enemyInstanceId: dmg }` for every living
enemy. `randomEnemy` previews against the first living enemy **without
consuming RNG**. Substitute `tokens` into the card's `textTemplate` for display.

### `previewIntent(combat, enemyInstanceId)`

`{ kind, moveId, damage, hits, totalDamage, block, delayed, pending }` —
attack numbers recomputed live through §4.2 (enemy attack modifiers + player
damage-taken modifiers). `kind === 'staggered'` renders the Staggered intent.

### `getEntity(combat, id)` → entity or null (`'player'`, `'e1'`, …).

---

## 7. Events — full list with payloads

Every event is `{ type, ...payload }`. Emitted into `combat.eventLog` and the
current dispatch's `events`.

| type | payload |
|---|---|
| `combatStart` | `{}` |
| `combatEnd` | `{ victory: bool }` (triggers on it cannot enqueue combat actions) |
| `playerTurnStart` / `playerTurnEnd` | `{ turn }` |
| `enemyTurnStart` / `enemyTurnEnd` | `{ turn }` |
| `cardDrawn` | `{ cardInstanceId, cardId }` |
| `cardPlayed` | `{ cardInstanceId, cardId, cardType, targetId, ordinalThisTurn, ordinalThisCombat, energySpent }` |
| `cardExhausted` | `{ cardInstanceId, cardId, reason: 'played'\|'ethereal'\|'effect' }` |
| `cardDiscarded` | `{ cardInstanceId, cardId, reason: 'turnEnd'\|'handFull'\|'effect' }` |
| `deckShuffled` | `{ size }` |
| `damageDealt` | `{ sourceId, targetId, amount, blocked, isAttack }` — amount is final post-modifier damage; `amount − blocked` hit HP |
| `blockGained` | `{ targetId, amount }` (post-modifier, post-cap) |
| `hpLost` | `{ targetId, amount, cause: 'attack'\|'effect' }` |
| `healed` | `{ targetId, amount, requested }` |
| `statusApplied` | `{ targetId, sourceId, status, stacks, total }` |
| `statusExpired` | `{ targetId, status, reason: 'decayed'\|'expired'\|'consumed'\|'removed' }` |
| `meterFilled` | `{ targetId, status, threshold }` for status meters; `{ targetId, meter:'poise', threshold }` for poise |
| `stanceEntered` / `stanceExited` | `{ stance }` |
| `enemySpawned` | `{ targetId, enemyId }` |
| `enemyDied` | `{ targetId, enemyId }` |
| `enemyStaggered` | `{ targetId, enemyId, cancelledMove: moveId\|null }` |
| `energyGained` / `energySpent` | `{ amount }` |
| `flaskUsed` | `{ flaskId, slot, targetId }` |
| `relicTriggered` | `{ relicId }` |

(Run-level `executeRunEffects` additionally emits a non-bus `runesChanged
{ amount, total }`.)

---

## 8. Text templating (SPEC §3.13)

Tokens `{name}` / `{name.N}` bind to effect values **in effect order** via
`computeTokenBindings(effects)` (`src/model/validate.js`, also used by
`previewCard`):

- token base = op name (`damage`, `block`, `heal`, `loseHp`, `poiseDamage`,
  `draw`, `gainEnergy`, `addRunes`, `loseMaxHpPct`) — **except** `applyStatus`,
  which binds under its **status id** (`{someStatusId}` = the stacks applied);
- a `damage` op's `hits` binds as `{hits}`;
- repeats get `.2`, `.3`… suffixes (`{damage}`, `{damage.2}`).

Validation rejects (cards + relics; relics bind across all `triggers[].do`
concatenated): (a) any template token that doesn't bind, and (b) any
**literal-number** value on ops `damage, block, heal, loseHp, applyStatus,
poiseDamage, draw, gainEnergy` whose token doesn't appear in the template.
Formula-valued effects are exempt from (b) ("Gain Block equal to missing HP").
Upgraded variants (`upgrade.textTemplate` ?? base vs `upgrade.effects` ?? base)
are validated too.

---

## 9. Validation — `src/model/validate.js`

```js
import { validateContent } from './src/model/validate.js';
const { ok, errors, scriptReport } = validateContent(bundle);
// errors: [{ path: 'cards.someId.effects[1].status', msg: '...' }]
// scriptReport: { count, total, pct, users: ['cards.x', ...] }
```
Run it at boot in dev mode and from tests **before** `createRegistries`.
Checks: schemas (unknown fields/enums/types), all id cross-references
(including `card.class` ∈ class ids ∪ `'colorless'`, `firstMove`/`unlockMoves`
∈ the enemy's own moves, formula/predicate status+stance refs), closed sets
(opcodes, formula ops, trigger events, predicates, targets, modifier keys),
template binding (§8), and the <5% scripts budget (≥5% is an error).

---

## 10. RNG — `src/engine/rng.js`

```js
import { createRng, mulberry32, seedToString, seedFromString, STREAM_NAMES } from './src/engine/rng.js';
const rng = createRng(seedUint32, savedCounters /* optional */);
rng.float(stream); rng.int(stream, min, max /*inclusive*/);
rng.pick(stream, arr); rng.shuffle(stream, arr /*returns new array*/);
rng.chance(stream, pct); rng.getCounters(); // persist with the run
```
Streams (closed set; unknown names throw): `map, shuffle, cardRewards,
relicRewards, flaskRewards, enemyAI, enemyHP, events, shop, misc`.
Restoring `getCounters()` output reproduces the exact sequence (O(1) seek).
Engine stream usage: deck shuffles/reshuffles + `addCard` random insertion →
`shuffle`; enemy HP rolls → `enemyHP`; move selection → `enemyAI`;
`randomEnemy`, random discard/exhaust, `{p:'random'}` → `misc`; run-level
random relic/flask → `relicRewards`/`flaskRewards`.
`seedToString`/`seedFromString`: base-35 display (StS-style, no letter O).

---

## 11. Run state — `src/model/state.js`

```js
import { createRunState, serializeRun, deserializeRun,
         createIdGen, createCardInstance, createDeck,
         RUN_SCHEMA_VERSION } from './src/model/state.js';

const run = createRunState({ seed, classId, registries });
// { schemaVersion, contentVersion, seed, streamCounters, class, floor,
//   actNumber, mapNodeId, hp, maxHp, runes, deck:[{instanceId,cardId,upgraded}],
//   relics:[relicIds], flasks:[{flaskId}], mapGraph, combatEntered, history,
//   modifiers }
```
`serializeRun`/`deserializeRun` are plain JSON round-trips; `deserializeRun`
throws on unknown `schemaVersion`. Persist `rng.getCounters()` into
`run.streamCounters` before saving (M2's `save.js` owns localStorage +
archiving). Also exports `createPlayerCombatEntity` / `createEnemyCombatEntity`
(used by `createCombat`; UI/tests rarely need them directly).

---

## 12. Driving a combat (UI) & headless tests

**UI loop:**
1. `validateContent(bundle)` (dev) → `createRegistries(bundle)` → `createRng(run.seed, run.streamCounters)`.
2. `createCombat({ registries, rng, player: {...from run...}, enemyIds: encounter.enemies })`.
3. Render from combat state: `piles.hand` (resolve visuals via
   `resolveCard(registries, inst)` + `previewCard` for live numbers/tokens),
   enemies (`hp/maxHp/block/statuses/poiseMeter` + `previewIntent`), player
   row, energy `player.energy / player.energyMax`.
4. On input, `dispatch(combat, intent)` inside try/catch (throws = illegal
   input, show nothing); animate the returned `events` in order; re-render.
5. Stop when `combat.result` is set (`'victory'` → rewards, `'defeat'` → death
   screen). Persist `rng.getCounters()` with the run after committed choices.

**Headless in Node** (`tests/engine.test.js` and `tests/index.html` both work —
same imports, no UI modules):

```js
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';

const registries = createRegistries(bundle);
const combat = createCombat({ registries, rng: createRng(0xC0FFEE), player, enemyIds });
while (!combat.result) {
  const card = combat.piles.hand.find(/* leftmost affordable */);
  if (card) dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: 'e1' });
  else dispatch(combat, { type: 'endTurn' });
}
```
Fixed seed ⇒ identical shuffles, enemy HP, moves, and events every run.

---

## 13. Contract notes & deviations (deliberate, with reasons)

1. **Stagger split (engine vs content):** the poise meter, its fill, the
   one-turn skip (`skipNextTurn`), delayed-move cancellation, and threshold
   growth are engine primitives (`poiseMeter` is in the SPEC §3.3 instance
   shape; `poiseDamage`/`enemyStaggered` are spec'd opcode/event). The
   damage-taken window (+50%) and its expiry are a content status applied by
   `balance.poise.onFill` — the engine never names it (law §3.1(2)).
2. **Generic modifier extensions** (`skipTurn`, `retainBlock`, `blockCap`,
   `meterMaxGrowthDisabled`) were added to the closed modifier set so
   spec-required content (Unbreakable's kept-block-with-cap, Lord's-Blood-style
   threshold freezing, Stagger turn-skip) stays pure data. They are generic
   capabilities, not entity behavior.
3. **`stacks.per` floors immediately** (chunked "per N" semantics); all other
   evaluation floors once at the end per SPEC §3.5.
4. **`refresh`/`unique` stack modes** are defined as `max(existing, applied)` /
   pinned-to-1 respectively (SPEC names but does not define them).
5. **Meter overflow carries** into the reset value (points aren't lost when a
   big application crosses the threshold); the while-loop can double-fill.
6. **cardPlayed ordering:** the card's own effects enqueue before `cardPlayed`
   is emitted, so on-play trigger effects resolve after the card's (FIFO); the
   event still appears first in the log.
7. **Curse/status unplayability is keyword-driven** (`unplayable`), not
   type-driven — "unless stated" (SPEC §4.3) is expressed by content omitting
   the keyword.
8. **`useFlask`** is fully implemented; with no flasks in the player state it
   simply can't be issued (empty slot throws).
9. **Run-level opcodes** execute via `executeRunEffects` (player HP facade);
   inside a combat dispatch they throw — combats never mutate the run directly.
