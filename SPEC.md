# Ashen Spire — Detailed Specification

*(Formerly "Spire of the Erdtree / EldenSpire" — renamed in the IP scrub, `95c3b87`; `docs/IP-SCRUB.md` maps every old name to its shipped one. This spec's in-game vocabulary below is still largely pre-scrub; the scrub doc is authoritative for shipped names until the document-wide rename lands.)*

A single-player roguelike deckbuilder for the browser. Mechanically faithful to Slay the Spire; thematically inspired by (but legally distinct from) Elden Ring. Companion documents: [PROMPT.md](PROMPT.md) (the brief this spec expands), and — once implementation starts — `DEVELOPER.md` (how to extend) and `CREDITS.md` (asset licenses).

Numbers in this spec are the **initial balance targets**. They will move during the M3 balance pass, but the *structures* (formulas, orderings, state shapes) are contractual.

---

## 1. Product overview

| | |
|---|---|
| Title | **Ashen Spire** (`AshenSpire` — the bundle name; title screen `src/ui/screens/title.js:47`) |
| Platform | Modern evergreen desktop browsers, 1280×720 minimum |
| Tech | Vanilla ES-module JS, HTML, CSS. No framework, no build step |
| Persistence | `localStorage` (run save + settings + run history) |
| Entry point | `index.html` opened directly or via any static server |
| Session length | One full run ≈ 45–90 minutes; one combat ≈ 2–5 minutes |

A **run**: pick 1 of 3 classes → traverse a branching node map across 3 acts → fight monsters/elites/bosses, visit shrines/merchants/events → build a deck from ~75 class cards + colorless cards → win by defeating the Act 3 boss, or die and see the "YOU PERISHED" screen with seed and stats.

---

## 2. Legal and asset constraints

These override everything else in the spec.

1. **No FromSoftware assets or names.** No ripped sprites, music, logos, or exact proper nouns (no "Godrick", "Margit", "Malenia", "Limgrave"). Generic fantasy terms ("runes", "grace", "flask") are fine.
2. Every shipped asset is listed in `CREDITS.md` with source URL and license. Allowed licenses: CC0, CC-BY (with attribution), OFL for fonts.
3. Planned sources:
   - **game-icons.net** (CC BY 3.0) — card art, relic icons, status icons, intent icons. This is the primary art source; its ~4000 flat fantasy icons cover nearly everything.
   - **Kenney.nl** (CC0) — UI nine-slices, buttons, panel borders.
   - **OpenGameArt.org** (filter CC0/CC-BY) — combat backgrounds, enemy portraits if suitable ones exist.
   - **Google Fonts** (OFL) — display serif (e.g. *Cinzel*) + body sans (e.g. *Inter*).
4. Every image is referenced through `src/ui/assets.js` (an id → URL/inline-SVG map). Game code never hardcodes an asset path. Missing art falls back to a generated placeholder (colored rounded rect + icon glyph + name) so the game is fully playable with zero downloaded assets.
5. Third-party **code** may be vendored only if MIT/BSD/Apache/CC0, kept in `src/vendor/`, attributed in `CREDITS.md`. Expected: none beyond possibly a PRNG snippet (mulberry32 is public domain).

---

## 3. Architecture — data- and model-driven, procedural where it counts

### 3.1 Layers and design laws

Four layers; dependencies point downward only:

```
┌─ UI        (src/ui)      renders model state; dispatches player intents
├─ Systems   (src/engine)  generic interpreters (action queue, triggers,
│                          status model) + seeded PROCEDURAL GENERATORS
├─ Model     (src/model)   schemas, registries, formulas, state, validation
└─ Content   (src/content) pure data packs — all game content and tuning
```

Design laws (contractual):

1. **Schema-first.** Every entity type has a schema in `model/schemas.js`. All content is validated at boot (dev mode) and in tests — unknown fields, bad enums, and dangling id references fail loudly (§3.14).
2. **The engine contains no entity-specific code.** There is no `if (status === 'bleed')` anywhere. The engine implements a closed set of primitives — effect opcodes (§3.4), formula ops (§3.5), trigger events + predicates (§3.6), and a generic status model (§3.7) — and *all* game behavior is content data composing those primitives. Adding a card, relic, status, stance, enemy, or event = adding data.
3. **Procedural content stays procedural.** Map generation, encounter rolls, reward rolls, and enemy move selection are seeded algorithms (§3.8) — but every knob they consume lives in content data, never as code constants.
4. **All tuning is data.** `content/balance.js` holds every global constant (energy 3, draw 5, hand 10, reward odds, rune ranges, prices, flask drop decay). A balance change is a one-file data diff.
5. **Headless engine.** Nothing under `src/engine/` or `src/model/` references `document`, `window`, `localStorage`, or timers. A combat runs to completion from `tests/index.html` with no UI imports.
6. **Budgeted escape hatch.** `content/scripts.js` is a registry of named custom behaviors for what the DSL can't express. Target <5% of content; every entry carries a comment justifying why the DSL couldn't do it. A script pattern appearing twice gets promoted to a DSL primitive (engine PR).

### 3.2 File tree

```
index.html              boot + <main id="app">, loads src/main.js as module
styles/
  base.css              reset, palette variables, typography
  combat.css            combat screen
  map.css               map screen
  ui.css                tooltips, buttons, modals, piles
src/
  main.js               boot: validate content (dev), load save, mount router
  model/
    schemas.js          entity schemas for every content type
    registries.js       typed id → definition registries, frozen at load
    formulas.js         structured formula evaluator (§3.5)
    validate.js         content validation (boot in dev mode, and from tests)
    state.js            run/combat state factories + (de)serialization
  engine/
    combat.js           action queue + turn loop (generic interpreter)
    actions.js          opcode implementations (§3.4)
    triggers.js         event bus + declarative trigger wiring (§3.6)
    statuses.js         status-model interpreter: meters, decay, modifiers (§3.7)
    mapgen.js           procedural act-map generator (§3.8, §6)
    floorplan.js        anchors → floors: the one home for what a floor rule MEANS (§6)
    encounters.js       encounter + reward rolls (§3.8)
    rng.js              mulberry32 + named streams (§3.11)
    save.js             localStorage, schema + content versioning (§3.12)
  content/
    balance.js          every global tuning constant
    classes.js          class defs: starting deck, relic, HP, card pool ids
    cards/vagabond.js   card defs (pure data)
    cards/astrologer.js
    cards/prophet.js
    cards/colorless.js  colorless + curses + statuses (the card kind)
    statuses.js         ALL combat statuses as data — incl. Bleed/Rot/Poise
    stances.js          stance defs (same trigger/modifier shapes)
    keywords.js         keyword names + tooltip text (semantics: §3.7 note)
    enemies/act1.js     enemy defs incl. move tables and phase triggers
    enemies/act2.js
    enemies/act3.js
    encounters/act1.js  weighted encounter pools, elite + boss lists
    encounters/act2.js
    encounters/act3.js
    relics.js
    flasks.js
    events.js
    mapconfig.js        per-act map-generation knobs
    music.js            the score as data: scales, per-context beds, sample manifests (§7.4)
    scripts.js          budgeted escape-hatch behaviors (<5% of content)
  ui/
    screens/title.js    title / continue / class select
    screens/map.js
    screens/combat.js
    screens/reward.js   card reward, chest, boss reward
    screens/shop.js
    screens/event.js
    screens/rest.js
    screens/gameover.js death + victory
    components/card.js  card renderer (DOM, not canvas)
    components/tooltip.js
    components/piles.js pile viewer modal
    assets.js           asset id → URL/SVG map + placeholder generator
    sfx.js              sound hook bus — sfx.play(id) at every call site, sink = audio.js
    audio.js            procedural WebAudio engine: synth SFX + music beds (§7.4)
    fx.js               floating numbers, shake, flash (skippable; paced by the animation-speed setting)
tests/
  index.html            headless test runner page
  engine.test.js        assertions against model + engine
DEVELOPER.md
CREDITS.md
```

### 3.3 Domain model, registries, and state

**Entity types** (each with a schema in `schemas.js`):

| Entity | Key fields |
|---|---|
| Card | `id, class, rarity, cost (int \| 'X'), type, keywords[], effects[], textTemplate, upgrade` (partial override object) |
| Relic | `id, rarity, textTemplate, triggers[], passives?` — passives are a closed key set the run systems consult (`runeGainMult, eliteExtraCardReward, flaskPowerMult, revealUnknown, shrineHealMult, shrineNoRest, powerCostReduction`) |
| Status | `id, name, icon, stackMode, decay, meter?, modifiers?, hooks?` (§3.7) |
| Stance | `id, name, icon, onEnter?, modifiers?, hooks?` |
| Keyword | `id, name, tooltip` (display only; semantics are engine primitives) |
| Enemy | `id, name, hp: [min,max], poiseMax, moves{}, firstMove?, phases?[]` |
| Encounter | `id, enemies[], weight, minFloor?, pool: normal \| elite \| boss, act? (default 1)` |
| Event | `id, name, art, text, choices[]` (each choice: `label, requires?, effects, resultText`) |
| Flask | `id, rarity, targeted?, effects[]` |
| Class | `id, name, maxHp, startingRelic, startingDeck[], cardPool[]` |
| MapConfig | per-act: `floors, columns, pathCount, typeWeights, floorRules` |
| Balance | flat constants object (energy, draw, handMax, odds tables, prices…) |

- `registries.js` loads all content into typed, deep-frozen registries keyed by id. **Cross-references are by id only**; registry getters throw on unknown ids (caught by validation before runtime).
- **Definitions vs instances:** state (`model/state.js`) stores instance data referencing definitions by id — a deck card is `{ instanceId, cardId, upgraded }`, an enemy is `{ instanceId, enemyId, hp, block, statuses{}, poiseMeter, movesHistory[] }`. Saves serialize instances + RNG counters only, **never definitions** — saves stay small and content patches apply to loaded runs (guarded by `contentVersion`, §3.12).
- **Player intents are a closed set** (everything the UI may ask the engine to do): `playCard(cardInstanceId, targetId?)`, `endTurn()`, `useFlask(slot, targetId?)`, `discardFlask(slot)`, `chooseMapNode(nodeId)`, `chooseReward(choice)`, `restAction('rest'|'smith', cardId?)`, `shopAction(...)`, `eventChoice(index)`, `abandonRun()`.

### 3.4 Effect DSL (opcodes)

An effect is an array of opcode objects; playing a card, triggering a relic, or resolving an event choice enqueues them onto the action queue (§3.9).

```js
// Bloodflame Slash: "Deal 5 damage. Apply 3 Bleed."
effects: [
  { op: 'damage',      target: 'enemy', amount: 5 },
  { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3 },
]

// Last Stand: "Gain Block equal to missing HP (max 20)."
effects: [
  { op: 'block', target: 'self',
    amount: { f: 'missingHp', of: 'self', max: 20 } },
]
```

**Opcode list** (closed set; extending it is an engine PR):

- Combat: `damage {hits?}`, `block`, `applyStatus`, `removeStatus`, `draw`, `discard {random?}`, `exhaust`, `addCard {card, pile, position}`, `gainEnergy`, `loseHp` (ignores block), `heal`, `shuffleDiscardIntoDraw`, `enterStance`, `poiseDamage`.
- Run-level (events, shops, rewards reuse the same DSL): `addRunes`, `addCardToDeck {card}`, `removeCardFromDeck`, `upgradeCard {random?}`, `addRelic {random? | id}`, `addFlask`, `loseMaxHpPct`, `startCombat {encounterId}`.

Common fields on any opcode: `target: self | enemy | allEnemies | randomEnemy` (cards with an `enemy` target require UI targeting), `amount: number | Formula` (§3.5), `if: Predicate` (§3.6) to gate the opcode, `repeat: n` for multi-hit.

### 3.5 Formulas — structured objects, not strings

Every dynamic number is a JSON formula object evaluated by `model/formulas.js`. No string parsing — formulas are validatable data:

```js
{ f: 'percentMaxHp', of: 'owner', pct: 15, min: 8, max: 35 }   // Bleed burst
{ f: 'missingHp', of: 'self', max: 20 }                        // Last Stand
{ f: 'stacks', status: 'bleed', of: 'allEnemies', per: 4 }     // War Surgeon
{ f: 'energySpent', per: 6 }                                   // X-cost scaling
{ f: 'add', args: [ 3, { f: 'stacks', status: 'strength', of: 'self' } ] }
```

Op set (closed): `add`, `mul` (nestable), `percentMaxHp {of, pct, min?, max?}`, `missingHp {of, max?}`, `stacks {status, of, per?}`, `energySpent {per}`, `blockOf {of}`, `hpOf {of}`, `cardsPlayedThisTurn {per}`. Every evaluation floors its final result (StS integer math). The **same evaluator** computes card-preview numbers for the UI (§3.13, §4.2).

### 3.6 Trigger DSL and predicates

Relics, powers, statuses, stances, and enemy boss phases all hook the engine through one declarative form, wired by `triggers.js` at combat start:

```js
// Fell Omen Brand: "Whenever an enemy Staggers, draw 2."
triggers: [{ on: 'enemyStaggered', do: [{ op: 'draw', amount: 2 }] }]

// Watchful Omen, phase 2 at 50% HP (defined on the enemy):
phases: [{ on: 'hpBelowPct', pct: 50, once: true,
  do: [ { op: 'applyStatus', target: 'player', status: 'frail', stacks: 1 },
        { op: 'applyStatus', target: 'player', status: 'weak',  stacks: 1 },
        { op: 'applyStatus', target: 'self',   status: 'strength', stacks: 2 } ],
  unlockMoves: ['twinDaggers'] }]
```

Trigger fields: `on` (event name from §3.10, plus `hpBelowPct`), `if?` (predicate), `do` (effects, §3.4), `once?`, `limitPerTurn?`.

Predicates (closed set, combinable): `{ p: 'inStance', stance }`, `{ p: 'hasStatus', of, status, atLeast? }`, `{ p: 'hasBlock', of }`, `{ p: 'hpBelowPct', of, pct }`, `{ p: 'firstCardThisTurn' }`, `{ p: 'firstAttackThisCombat' }`, `{ p: 'cardTypeIs', type }`, `{ p: 'everyNthCardThisCombat', n }`, `{ p: 'random', pct }` (uses a named stream), `{ p: 'eventIsAttack' }` / `{ p: 'eventSourceIsOwner' }` / `{ p: 'eventTargetIsOwner' }` / `{ p: 'eventStatusIs', status }` (gate a trigger on its firing event's payload — e.g. a stance that reacts only to the owner's own attack hits, or a relic reacting to Bleed meter fills), and `all / any / not` combinators.

### 3.7 Status model — statuses are content, not code

`content/statuses.js` defines every status over a generic model interpreted by `engine/statuses.js`. **Adding a status requires no engine change.** Schema:

```
{ id, name, icon,
  stackMode: 'add' | 'refresh' | 'unique',
  decay: 'none' | 'perTurnEnd' | { duration: n } | 'onConsume',
  meter?: { max: n, growthMult: x, onFill: [effects] },   // build-up statuses
  modifiers?: { damageDealtMult?, damageTakenMult?, blockGainedMult?,
                attackDamageAdd?, blockAdd? },             // consulted by §4.2 math
  hooks?: [triggers §3.6] }                                // ownerTurnStart etc.
```

The Elden Ring layer, fully as data — no engine special cases:

```js
bleed: {
  stackMode: 'add', decay: 'none',
  meter: { max: 12, growthMult: 1.5,
    onFill: [{ op: 'loseHp', target: 'owner',
      amount: { f: 'percentMaxHp', of: 'owner', pct: 15, min: 8, max: 35 } }] },
},
scarletRot: {
  stackMode: 'add', decay: { duration: 3 },   // re-apply adds stacks + refreshes
  hooks: [{ on: 'ownerTurnStart',
    do: [{ op: 'loseHp', target: 'owner',
      amount: { f: 'stacks', status: 'scarletRot', of: 'owner' } }] }],
},
weak:       { stackMode: 'add', decay: 'perTurnEnd', modifiers: { damageDealtMult: 0.75 } },
vulnerable: { stackMode: 'add', decay: 'perTurnEnd', modifiers: { damageTakenMult: 1.5 } },
frostbite:  { stackMode: 'unique', decay: 'onConsume', /* +30% on next big hit: hook on damaged ≥10 */ },
```

Poise/Stagger uses the same meter model (owner-side meter fed by `poiseDamage`, `onFill` applies a `staggered` status whose modifiers/hooks implement the skipped turn and +50% window; `growthMult: 1.25`). Stances (`content/stances.js`) reuse `modifiers` + `hooks` + `onEnter` effects; exclusivity is handled by the `enterStance` primitive.

**Engine-primitive exceptions:** card-zone/turn semantics that genuinely can't be data — **Exhaust, Ethereal, Innate, Retain, Unplayable, X-cost** — are fixed engine behaviors. `content/keywords.js` supplies only their display names and tooltip text.

### 3.8 Procedural systems — kept procedural, parameterized by data

| Generator | Algorithm (code, in `src/engine/`) | Knobs (data, in `src/content/`) |
|---|---|---|
| Act map | StS path-walk + typing constraints (§6), `mapgen.js` + `floorplan.js` | `mapconfig.js`: floors, columns, path count, type weights, `?`-node weights, per-floor rules **as anchors** |
| Encounters | weighted roll with no-repeat window, `encounters.js` | `encounters/actN.js`: pools, weights, elite/boss lists |
| Rewards | rarity rolls + pity/decay counters, `encounters.js` | `balance.js`: odds tables, rune ranges, flask-drop decay |
| Enemy AI | weighted state machine + `maxConsecutive`, `combat.js` | each enemy's `moves` table |

Every generator is a pure function of `(config, rngStream, runState)` → snapshot-testable with fixed seeds (§8).

### 3.9 Action queue

Combat resolves through a FIFO **action queue** (mirrors StS's GameActionManager). Playing a card enqueues its opcodes as actions; each executed action may emit events; triggers (§3.6) may enqueue further actions. The queue drains fully before control returns to the UI.

Rule: **nothing mutates HP/block/piles/statuses except an executed action.** Triggers react to events; they never mutate directly.

### 3.10 Event bus

Events emitted by executed actions (closed list; `DEVELOPER.md` documents payloads):

```
combatStart, combatEnd(victory)
playerTurnStart, playerTurnEnd, enemyTurnStart, enemyTurnEnd
cardDrawn, cardPlayed, cardExhausted, cardDiscarded, deckShuffled
damageDealt(source,target,amount,blocked,isAttack)
blockGained, hpLost, healed
statusApplied, statusExpired, meterFilled, stanceEntered, stanceExited
enemySpawned, enemyDied, enemyStaggered
energyGained, energySpent
flaskUsed, relicTriggered(relicId)
```

### 3.11 Seeded RNG

- `rng.js` implements **mulberry32**. A run seed (uint32, displayed base-35 like StS, e.g. `3LB6HXYD`) is rolled at run start or entered manually on the class-select screen.
- **Named streams**, each independently derived from the seed + a stream salt + a monotonically increasing counter that is *saved with the run*:
  `map`, `shuffle`, `cardRewards`, `relicRewards`, `flaskRewards`, `armaments`, `enemyAI`, `enemyHP`, `events`, `shop`, `misc` (the closed set is `STREAM_NAMES`, `src/engine/rng.js` — an unknown stream name throws).
- Consequence (StS-faithful): re-fighting the same combat after reload produces the same shuffles; choosing a different path doesn't change what a later card reward would have been on another stream.

### 3.12 Save format

- Key `sote_run_v1` — run state JSON: `{ schemaVersion, contentVersion, seed, streamCounters, class, floor, mapNodeId, hp, maxHp, runes, deck[], relics[], flasks[], mapGraph, actNumber, combatEntered?, history[] }`. Instances by id only (§3.3).
- Saved after **every** committed player choice (node chosen, reward taken). **Mid-combat**: only `combatEntered: nodeId` is saved — reload restarts that combat from its start with the same shuffle-stream state (StS behavior). Abandoning mid-combat = same.
- Key `sote_meta_v1` — settings + last 20 run results for the history screen.
- `save.js` refuses (and archives) saves with an unknown `schemaVersion`; a `contentVersion` mismatch warns and re-validates the deck/relic ids against current registries (unknown ids → refuse and archive).

### 3.13 Card text templating

Card and relic `textTemplate`s carry tokens: `"Deal {damage}. Apply {bleed} Bleed."` Tokens bind to opcode values by op/status name (disambiguated by index when repeated: `{damage.2}`). The UI fills tokens via the **same formula evaluator and damage preview the engine executes** (§3.5, §4.2) — so a Strike in hand shows 9 when you have +3 Strength and shows it struck through to 6 when Weak. A validation rule (§3.14) rejects any template token that doesn't bind, and any player-visible numeric effect lacking a token.

### 3.14 Content validation

`model/validate.js` runs at boot in dev mode and from the test page. It checks, across ALL registries:

1. Every content object conforms to its schema (fields, types, enums).
2. Every id cross-reference resolves (cards in pools/decks, statuses in effects, encounters on maps, moves in `unlockMoves`, …).
3. Every opcode, formula op, event name, and predicate used anywhere is in the closed sets of §3.4–§3.6.
4. Every text-template token binds (§3.13).
5. `scripts.js` budget report: script-using content is listed; the count must stay <5% of total content objects.

---

## 4. Combat rules (Slay-the-Spire-faithful)

### 4.1 Turn loop

1. **Combat start:** shuffle deck into draw pile; `Innate` cards go to top. `combatStart` triggers fire.
2. **Player turn start:** lose all block (unless modified), set energy to 3 (base), draw 5, `playerTurnStart` triggers.
3. **Player acts:** play any affordable cards, use flasks, inspect piles. Max hand size **10** — excess drawn cards go to discard with a "hand full" toast (StS behavior).
4. **Player turn end:** `playerTurnEnd` triggers; discard hand except `Retain` cards; `Ethereal` cards in hand exhaust instead. Unspent energy is lost.
5. **Enemy turn:** each living enemy, in row order, executes its telegraphed intent; enemies lose their block at the start of *their* turn.
6. New intents are rolled (stream `enemyAI`), display updates, back to 2.
7. **End:** all enemies dead → victory (rewards); player HP ≤ 0 → death screen.

### 4.2 Damage math (order is contractual)

For an attack dealing `base` damage:

```
dmg = base
dmg = dmg + attacker.Strength                    // may go below base
dmg = dmg * (attacker has Weak      ? 0.75 : 1)
dmg = dmg * (defender has Vulnerable? 1.5  : 1)
dmg = dmg * (defender is Staggered  ? 1.5  : 1)
dmg = floor(dmg); if dmg < 0 → 0
```

(The multipliers/adders come from status `modifiers` (§3.7); the engine consults the status model, not named statuses.) Multi-hit attacks compute per hit. Damage consumes block first; remainder hits HP. `loseHp` (Rot ticks, Bleed bursts, Madness) ignores Strength/Weak/Vulnerable/Stagger *and block*. Block from a card: `base + Dexterity`, `× 0.75` if Frail, floored.

**Card preview numbers in the UI are computed by the same engine function** (`previewDamage(card, source, target)`); no duplicated math in the UI (§3.13).

### 4.3 Card rules

- Types: **Attack, Skill, Power, Curse, Status**. Powers are removed from play when played (not exhausted — they don't hit the exhaust pile). Curses/Statuses are unplayable unless stated.
- Keywords (exact StS semantics; engine primitives per §3.7): **Exhaust** (removed for the combat after play), **Ethereal** (exhausts if in hand at end of turn), **Innate** (starts on top of draw pile), **Retain** (not discarded at end of turn), **Unplayable**, **X-cost** (consumes all energy; effect scales via `{f:'energySpent'}`).
- Upgrades: every non-curse card has exactly one upgrade (`name+`), a partial override object on the card def (numbers, cost, keywords — a present `keywords` list replaces the base list, so upgrades can remove Exhaust). Upgrading is permanent for the run.
- Empty draw pile + draw needed → discard pile is shuffled (stream `shuffle`) into draw first.

### 4.4 Status effects

Common (StS layer):

| Status | On whom | Effect | Decay |
|---|---|---|---|
| Strength | any | +N attack damage per hit | permanent |
| Dexterity | player | +N block from cards | permanent |
| Weak | any | deal 25% less attack damage | −1 stack at owner's turn end |
| Vulnerable | any | take 50% more attack damage | −1 stack at owner's turn end |
| Frail | player | 25% less block from cards | −1 stack at turn end |

Elden Ring layer (the thematic differentiator — these must feel distinct):

| Status | Mechanic |
|---|---|
| **Bleed (build-up)** | A meter on each enemy, threshold starts at **12**. Cards add Bleed points; points do **not** decay during combat. On reaching threshold: burst `loseHp` = **15% of target's max HP (min 8, max 35)**, meter resets, threshold ×1.5 (rounded up). Ignores block. |
| **Scarlet Rot** | DoT on enemy: take N `loseHp` at its turn start. Unlike StS Poison, stacks **do not tick down** — instead Rot has a duration of **3 of its turns**, then expires entirely. Re-applying adds stacks and refreshes duration. Ignores block. |
| **Frostbite** | On enemy: next time it takes attack damage ≥ 10 in one hit, it takes +30% (floored) and Frostbite is consumed. One stack max. |
| **Madness** | On player (from enemies/curses): at turn start, lose 2 HP per stack but gain 1 energy per stack, then Madness clears. Risk/reward, mostly enemy-inflicted. |
| **Poise / Stagger** | Every enemy has `poiseMax` (8–40 by enemy). `poiseDamage` fills the meter (shown under HP). When full: enemy becomes **Staggered** — its next turn is skipped (intent replaced by "Staggered"), it takes +50% attack damage until the end of the *player's* next turn, then meter empties and `poiseMax` ×1.25 (rounded up). Poise meter does not decay. |

All of the above — including the whole Elden Ring layer — are data objects in `content/statuses.js` over the generic status model (§3.7); none has engine-side special cases.

### 4.5 Stances (Vagabond mechanic)

At most one stance active. Entering a stance exits the previous (`stanceExited` then `stanceEntered`). Stances are combat-scoped.

- **Bloodflame Stance:** your attacks apply +2 Bleed. On entering: take 2 damage (ignores block).
- **Bulwark Stance:** whenever you play a Skill, gain 2 Block. On entering: gain 3 Block.

Some cards read "If in [stance]: bonus" (predicate `inStance`). Stance icon shows beside the player's status row.

### 4.6 Enemy intents

- Every enemy shows next action as icon + number: **Attack (exact total damage, `n×m` for multi-hit — numbers already include its Strength and your Vulnerable, recomputed live)**, Block, Buff, Debuff, Unknown (rare, for one scripted boss move), Staggered.
- Move selection: per-enemy **weighted state machine** on stream `enemyAI`, with StS-style repeat constraints declared per move (`maxConsecutive: 1|2`).
- Bosses declare phase triggers (`phases`, §3.6) keyed on HP thresholds.

Enemy definition shape (content file):

```js
{
  id: 'wandering_soldier', name: 'Wandering Soldier',
  hp: [22, 26],            // rolled on stream enemyHP
  poiseMax: 10,
  moves: {
    slash:   { intent: 'attack', damage: 7,  weight: 45, maxConsecutive: 2 },
    guard:   { intent: 'block',  block: 6,   weight: 30, maxConsecutive: 1 },
    warcry:  { intent: 'buff',   weight: 25, maxConsecutive: 1,
               effects: [{ op: 'applyStatus', target: 'self',
                           status: 'strength', stacks: 2 }] },
  },
  firstMove: 'slash',      // optional scripted opener
}
```

---

## 5. Content specification

### 5.1 Classes

| | Vagabond | Astrologer | Prophet |
|---|---|---|---|
| Milestone | **M1** | M3 | M3 |
| Max HP | 78 | 66 | 72 |
| Identity | Weapon arts: stances, Bleed, Poise damage | Sorcery combos: "Glintstone" (2nd+ spell each turn is empowered), scaling Powers | HP-as-resource, Scarlet Rot, healing synergy |
| Starting relic | **Tarnished Medallion**: at combat start, gain 1 Poise damage on your first attack each combat → (real text finalized in content) | **Glintstone Shard**: first Power each combat costs 1 less | **Gold Figurine**: healing above max HP converts to Block (max 10) |
| Starting deck | 5× Strike, 4× Defend, 1× Bloodflame Slash | 5× Strike, 4× Defend, 1× Glintstone Pebble | 5× Strike, 4× Defend, 1× Urgent Heal |

(Astrologer/Prophet card pools are designed in M3; their identities above are contractual so M1/M2 systems — stances, Rot, heal triggers — get engine support early.)

### 5.2 Vagabond card pool — M1 set (24 cards + upgrades)

Rarity: S = starter, C = common, U = uncommon, R = rare. Cost in energy. `+` column = upgrade delta.

| Card | R | Cost | Type | Text | Upgrade |
|---|---|---|---|---|---|
| Strike | S | 1 | Attack | Deal 6. | Deal 9 |
| Defend | S | 1 | Skill | Gain 5 Block. | Gain 8 |
| Bloodflame Slash | S | 1 | Attack | Deal 5. Apply 3 Bleed. | 5 dmg, 5 Bleed |
| Crimson Cleave | C | 2 | Attack | Deal 8 to ALL enemies. Apply 2 Bleed to ALL. | 11 dmg |
| Shield Bash | C | 1 | Attack | Deal 5. 4 Poise damage. | 8 dmg, 5 Poise |
| Quickstep | C | 1 | Skill | Gain 6 Block. Draw 1. | 8 Block |
| Guard Counter | C | 1 | Attack | Deal 4. If you have Block: deal 10 instead. | 6 / 14 |
| Iron Resolve | C | 1 | Skill | Gain 5 Block. If in Bulwark Stance: gain 9 instead. | 7 / 12 |
| Serrated Blade | C | 1 | Attack | Deal 7. If target has any Bleed: apply 3 Bleed. | 9 dmg, 4 Bleed |
| Enter: Bloodflame | C | 1 | Skill | Enter Bloodflame Stance. Draw 1. | cost 0 |
| Enter: Bulwark | C | 1 | Skill | Enter Bulwark Stance. Gain 3 Block. | +6 Block total |
| Stomp | U | 2 | Attack | Deal 12. 8 Poise damage. | 16 dmg, 10 Poise |
| Rallying Standard | U | 1 | Power | At the start of your turn, gain 1 Strength. Take 1 damage. | no self-damage |
| War Surgeon | U | 1 | Skill | Exhaust. Heal 2 HP for every 4 Bleed on all enemies. | every 3 |
| Hemorrhage | U | 1 | Skill | Double the target's Bleed. Exhaust. | don't Exhaust |
| Twinblade Flurry | U | 1 | Attack | Deal 3×3. Bloodflame applies per hit. | 4×3 |
| Shieldwall | U | 2 | Skill | Gain 12 Block. If in Bulwark: Retain 4 of it next turn. | 16 Block |
| Kick Off | U | 0 | Attack | Deal 4. 3 Poise damage. Exhaust. | 7 dmg, don't Exhaust |
| Executioner | R | 2 | Attack | Deal 10. If target is Staggered: deal 25 instead. | 14 / 32 |
| Lord's Blood | R | 3 | Power | Bleed thresholds no longer increase after bursting. | cost 2 |
| Unbreakable | R | 2 | Power | Block no longer expires at the start of your turn. (Cap 30.) | cap 40 |
| Grafted Arms | R | 1 | Attack | X-cost: Deal 6 per energy spent, split randomly among enemies as 6-damage hits. | 8 per |
| Last Stand | R | 1 | Skill | Ethereal. Gain Block equal to missing HP (max 20). | max 30 |
| Warrior's Vow | R | 0 | Skill | Innate. Enter a Stance of your choice. Exhaust. | draw 1 |

Colorless/curse/status M1 minimum: **Wound** (status, unplayable), **Dazed** (status, unplayable, Ethereal), **Guilt** (curse, unplayable, at turn end in hand: lose 1 HP), **Slimed** (status, cost 1, Exhaust) — enemies and events inject these.

### 5.3 Enemy roster — Act 1 (M1)

Basics (encounters roll from the weighted table in `content/encounters/act1.js`):

| Enemy | HP | Poise | Moves (weight) | Notes |
|---|---|---|---|---|
| Wandering Soldier | 22–26 | 10 | Slash 7 (45), Guard 6 Block (30), Warcry +2 Str (25, max1) | bread & butter |
| Rot Hound | 12–15 | 6 | Bite 6 (60), Lunge 3×2 (40) | fast, fragile; spawns in pairs |
| Demi-Brute | 30–34 | 16 | Club 9 (50), Bellow: apply 1 Frail (25), Brace 8 Block (25) | tanky |
| Grave Wisp | 10–12 | 4 | Curse: shuffle 1 Dazed into draw (50), Drain 4 + heals self 4 (50) | kill first |
| Pack encounter | — | — | 2× Rot Hound + 1 Grave Wisp | teaches targeting |

Elite — **Crucible Aspirant** (HP 68–72, Poise 24): opener always Consecrate (+3 Strength); then Halberd Sweep 11 (50) / Tail Slam 7 + 1 Weak (30) / Golden Guard 12 Block + 4 HP heal (20, max1). Drops a relic.

Boss — **The Watchful Omen** (Margit-inspired, HP 140, Poise 30):
- **Phase 1 (>50% HP):** pattern cycle with a signature **delay** mechanic: move *Held Blade* shows "Attack 16 — Delayed"; on its turn it does nothing (gains 8 Block instead); the **following** turn it attacks for 16 regardless of newly rolled intents. Teaches intent-reading. Other moves: Cane Strike 9 (repeatable ×2), Hammer Toss 6×2.
- **Phase 2 (≤50% HP, `phases` trigger, once):** roars — apply 1 Frail + 1 Weak to player, gains +2 Strength, unlocks *Twin Daggers 4×4*.
- Staggering him cancels a Held Blade in progress (satisfying counterplay).
- Reward: 75–90 runes, rare relic choice, card reward with rare upgrade odds boosted.

(Act 2/3 rosters — including the Grafted-King-inspired phase boss and the final Malenia-inspired boss that heals for 3 per hit landed on you and inflicts Bleed on the *player* — are designed in M3; their signature mechanics are listed in §10 so engine hooks exist.)

### 5.4 Relics (M2 set, 16)

| Relic | Rarity | Effect |
|---|---|---|
| Tarnished Medallion | starter | (class starter, see §5.1) |
| Golden Seed | common | At combat start, heal 3 HP. |
| Whetstone Fragment | common | Your first attack each combat deals +4. |
| Kindling Charm | common | At the start of each combat, draw 1 extra card. |
| Rune Pouch | common | Gain 25% more runes from combats. |
| Beast Eye | common | Elites drop an extra card reward. |
| Cracked Tear | uncommon | Flasks are 50% stronger (rounded up). |
| Stonesword Key | uncommon | Unknown (?) nodes are revealed on the map. |
| Fell Omen Brand | uncommon | Whenever an enemy Staggers, draw 2. |
| Bloodied Talisman | uncommon | Bleed bursts deal +25%. |
| Grace Fragment | uncommon | Shrines heal +15% more. |
| Twinned Armor | uncommon | Every 10th card you play each combat: gain 6 Block. |
| Erdtree Sapling | rare | At the start of your turn, if you have no Block: gain 4 Block. |
| Dragon Heart | rare | +1 energy each turn. Shrines no longer offer Rest (smith only). |
| Ancestral Horn | rare | Powers cost 1 less. |
| Ash of Remembrance | boss | **+1 energy each turn; at combat start, gain 1 Madness.** |

Relic behavior uses the trigger DSL (§3.6) — the same declarative form as powers, statuses, and boss phases.

### 5.5 Flasks (potions)

3 slots. Found from combats (~35% drop, decaying like StS's potion chance: −10% per drop, +10% per miss), shops, events.

| Flask | Effect |
|---|---|
| Crimson Flask | Heal 25% max HP. |
| Cerulean Flask | Gain 2 energy. |
| Flask of Ferocity | Gain 2 Strength this combat. |
| Flask of Stone | Gain 15 Block. |
| Rot Coating | Apply 4 Scarlet Rot to target. |
| Blood Grease | Your attacks apply +2 Bleed this turn. |
| Wondrous Physick (rare) | Two random flask effects at once. |

### 5.6 Events — Unknown nodes (M2: 4 minimum, M3: 10)

Unknown nodes roll on stream `events`: 55% event, 25% normal fight, 12% shrine, 8% treasure (M2 tuning, in `balance.js`). Every event is a real trade-off, StS-style. M2 launch set:

1. **Erdtree Avatar** — *Offer a card* (remove 1 card from deck, take 6 damage) / *Pray* (heal 20% max HP, gain 1 Guilt curse) / *Leave*.
2. **Abandoned Merchant Cart** — *Loot* (gain 60–90 runes, 50% chance: fight a Wandering Soldier ambush) / *Leave*.
3. **Weeping Peninsula Pilgrim** — *Give 50 runes* (gain a random uncommon relic) / *Refuse* (nothing).
4. **Ancient Rune Stone** — *Study* (upgrade a random card, lose 7% max HP) / *Smash* (gain 35 runes) / *Leave*.

Event definition = data object: `{ id, name, art, text, choices: [{ label, requires?, effects, resultText }] }` where `effects` are run-level opcodes from the one effect DSL (§3.4).

---

## 6. Map generation

Faithful to StS's published algorithm, simplified where invisible to the player. Algorithm lives in `engine/mapgen.js`; every constant below comes from `content/mapconfig.js`:

- Per act: **`floors` × `columns`** grid (shipped: 12 × 7). The **top floor is always a single Shrine** row and the Boss sits above it — typed by the generator before any rule runs, so the floors a rule can reach are **1..`floors`-1**. That band is called the **rollable band** and it is the denominator for every fraction below.
- Generate **6 paths** bottom-to-top: each starts at a random column on floor 1 (first 2 paths must start at distinct columns); each step moves to column −1/0/+1 on the next floor; edges may merge but must not cross (swap targets when a crossing would occur — StS's rule).
- **Every floor a rule names is an ANCHOR, never an index.** An absolute floor number is a constant whose *meaning* moves when `floors` changes while the constant does not — measured: `9: 'treasure'` deletes the treasure rank entirely below 10 floors (**4.00 → 0.00 nodes per act, 24 seeds**), `noEliteOrShrineBefore: 6` gates **36 % of a 15-floor act and 56 % of a 10-floor one**, and `15: 'shrine'` **never fired at any shipped act length** because floor 15 is not rollable. The closed set of anchor kinds lives in `model/floorplan.js` and a new kind is an engine change (Law 1):

  | anchor | resolves to |
  |---|---|
  | `{ at: 'first' }` | floor 1 |
  | `{ at: 'last' }` | the last rollable floor (`floors`-1) |
  | `{ at: 'floor', index: n }` | `n` — **an error** if outside 1..`floors`-1 |
  | `{ at: 'fraction', of: f }` | `round(f × rollable)`, `f` ∈ (0, 1] |

  `resolveFloorPlan()` is the **only** place an anchor becomes a floor; the generator, the boot validator and `tools/mapplan.mjs` all read that one resolution, so they cannot disagree about what a rule meant. An anchor that will not resolve is a **boot error naming the entry** (Law 1 clause 5) and `mapgen` throws rather than generating an unauthored map.
- **Node typing** (StS proportions): fixed ranks — Monster at `{ at: 'first' }`, Treasure at `{ at: 'fraction', of: 0.64 }` (floor 7 of 11 at the shipped shape). Remaining nodes rolled: Monster 45 %, Event(?) 22 %, Elite 8 %, Shrine 12 %, Merchant 5 %, remainder Monster; with constraints: no Elite/Shrine before `noEliteOrShrineBefore` (`{ at: 'fraction', of: 0.43 }` → floor 5), no Shrine on `noShrineOn` (`{ at: 'last' }` → floor 11), no two identical non-Monster types adjacent along an edge, **`minElites` ≥ 2 and `minMerchants` ≥ 1 per act** (regenerate typing if violated, map RNG stream, bounded retries → relax weakest constraint).
- **`minElites` counts nodes in the graph; it is not a reachability promise.** It was called `minReachableElites` and never measured reachability — a measurable fraction of starts can reach no Elite at the shipped shape, and the fraction **grows as the act shortens**. The numbers are deliberately not restated here: a sample restated in prose drifts (three homes carried three different samples within a day of each other). **`node tools/mapplan.mjs` measures and prints them on every run**; nothing gates on them, and making the generator honour it is an open design call.
- **What a `?` node resolves to is `mapConfigs[act].unknownWeights`** — beside the geometry it describes, per act. It was `balance.unknownNode`, a flat global that could not vary per act while the map it belongs to does.
- **Any claim about generated maps is a distribution, never a seed.** Node count's mean and range are **deliberately not restated here** — the previous edition of this sentence carried 59.2 over 50–69, which the 12-floor act made false the moment it landed, which is this rule proving itself two bullets after it was written. `tools/mapplan.mjs` prints them at the current shape on every run. Stops per run is exactly **`floors` + 1** at every shape measured — that one is a formula, not a sample, and a formula does not drift. A tool that generates one map and reports a number has said nothing — the same green a tool gives when it checked nothing. `tools/mapplan.mjs` prints mean and range for every figure and refuses to report at all if its own seeds did not vary.
- Player sees the full act map; only nodes connected by an edge from the current node are clickable. With **Stonesword Key** relic, `?` nodes render their resolved type.
- Acts 2/3 reuse the generator with different encounter tables and elite/boss pools (data only).

Rewards after combat: runes (Monster 15–25, Elite 35–50, Boss 75–90) + card reward (choose 1 of 3: common 60% / uncommon 35% / rare 5%; Elite shifts to 45/40/15) + flask roll (§5.5). Elites additionally drop a relic; bosses drop a boss-relic choice of 3. Merchant prices: cards 45–160 runes by rarity, relics 140–300, flasks 50–80, card removal 75 (+25 per purchase). All numbers: `balance.js`.

---

## 7. UI/UX specification

### 7.1 Screens & flow

```
Title ──► Class Select (+ seed entry) ──► Map ──► [Combat | Shrine | Shop | Event | Treasure]
  │                                        ▲              │
  └── Continue (if save exists)            └──────────────┘ (reward screens between)
Death/Victory ──► run summary (seed, floor, runes, kills, deck) ──► Title
```

Screen router in `main.js`; each screen module exports `mount(state, dispatch)` / `unmount()`.

### 7.2 Combat layout (1280×720 reference)

- **Top bar:** class portrait, HP bar (`current/max`), rune count, flask slots ×3, relic strip (icons, hover for text), deck button, settings.
- **Enemy row (upper right 60%):** up to 5 enemies; each shows sprite/placeholder, name, HP bar, **Poise meter** (thin amber bar under HP), **Bleed meter** (thin red bar, only when >0), status icon row, and **intent icon + number above the head**.
- **Player zone (lower left):** stance icon, status row, Block shield badge overlapping HP.
- **Hand:** bottom center, fanned, max 10; hover raises card ×1.5 with full text.
- **Energy orb:** bottom left, `n/3`. **End Turn** button bottom right — pulses if energy remains and any card is playable; confirm-free.
- **Piles:** draw (bottom-left corner, count) / discard (bottom-right, count) / exhaust (small, appears once non-empty). Click opens a scrollable modal grid (draw pile view is order-shuffled for display, like StS).

### 7.3 Input

- **Both** targeting modes: (a) drag card onto a target/board, (b) click card → targeting arrow → click target. Esc/right-click cancels. Non-targeted cards: drag anywhere above the hand or click-then-click the board.
- Full playability with mouse only. Keyboard shortcuts (nice-to-have, M4): 1–9 select card, E end turn.
- Every interactive element has a tooltip within 150 ms of hover: cards (with nested keyword tooltips), statuses (name, current math), intents (exact damage after modifiers), relics, flasks, map nodes.

### 7.4 Feedback & animation rules

- Floating damage/heal/block numbers; brief target flash on hit; ≤4 px screen shake for hits ≥15 damage. **No animation blocks input, and a click always skips to end-state.** At the default animation speed, most effects run ≤300 ms and queued events play out at ≤80 ms intervals — but a few big-moment effects are hardcoded past that bound (heavy hit flash 380 ms, cast glyph 450 ms, Stagger wobble 600 ms) and the Animation speed setting (slow / normal / fast / instant) scales the *pacing* (beat, step, lunge), never those fixed effect durations. The Screen shake, Reduced motion, and Reduce flashes settings each suppress their effect entirely (`src/ui/fx.js`).
- Bleed burst and Stagger get distinct, slightly bigger effects (they're the theme).
- "YOU PERISHED" screen: dark fade, gold serif text, then stats card. Victory: "EMBER RESTORED". (Renamed from the pre-scrub strings in `95c3b87` — `docs/IP-SCRUB.md`.)
- Sound: shipped, and procedural. `sfx.js` is the hook bus — every feedback moment calls `sfx.play(id)` (card play, hit, stagger, death, buy, shrine, …) — and `main.js` wires its sink to `src/ui/audio.js`, a WebAudio engine that synthesizes every SFX and per-context music bed (title/map/combat/elite/boss/shop/rest/victory). What the score *is* lives as content in `src/content/music.js` (scales, beds, sample manifests); volumes/mute are settings. No audio asset files ship, and the two override paths fail differently: a music folder with `manifest.json` (Settings) replaces a context's procedural bed and a missing/unplayable track **falls back to the synth bed**; `SFX_MANIFEST` (shipped empty) replaces a synth SFX id, but `audio.js` `sfx()` short-circuits on a manifest entry and a failed sample load is cached as a miss and plays **silence, not the synth**. `MUSIC_MANIFEST` is imported and never read — a dormant slot, not a path.

### 7.5 Visual style

- Palette (CSS variables in `base.css`): near-black `#0d0b08` background, parchment `#e8dcc0` text, Erdtree gold `#c9a227` accents, blood red `#8a1a1a`, rot crimson-orange `#b5541c`, frost `#7fa8c9`, grace blue `#9fc3e8`.
- Cards: DOM elements (not canvas) — rounded rect, rarity-colored frame (grey/blue/gold), icon art from game-icons.net, cost orb top-left, type banner.
- Fonts: Cinzel (titles/card names), Inter (body/tooltips). Self-host the woff2 files, list in CREDITS.md.

---

## 8. Testing

`tests/index.html` loads `engine.test.js` (tiny `assert(name, cond)` helper, results as a DOM list + console). Required coverage (all headless, no UI imports):

1. Damage order: 6 base + 2 Str, Weak, Vulnerable → `floor(floor(8×0.75)×1.5)` = 9. Edge: negative → 0.
2. Block absorbs before HP; block expires at player turn start; Unbreakable power keeps it (cap applied).
3. Frail + Dexterity block math.
4. Draw 5 with 3 in draw pile → reshuffle discard, order from seeded stream is deterministic (fixed seed snapshot).
5. Hand-limit: drawn cards beyond 10 go to discard.
6. Exhaust, Ethereal-at-end-of-turn, Retain, Innate-on-top, X-cost consumes all energy and scales via `energySpent`.
7. Bleed: accumulation, burst at 12, damage clamp, threshold ×1.5, Lord's Blood freezes threshold — all driven purely by the `content/statuses.js` data.
8. Scarlet Rot: ticks at enemy turn start, expires after 3, refresh on re-apply.
9. Poise: fill → Stagger skips enemy move, +50% damage window, poiseMax growth; Stagger cancels Held Blade.
10. Stances: exclusivity, Bloodflame per-hit Bleed on multi-hit, Bulwark on-Skill block.
11. Intent constraint: with a forced RNG stream, `maxConsecutive` is never violated over 1000 rolls.
12. Map gen: fixed seed → snapshot graph; constraints hold over 200 random seeds (no early elites, no crossing edges, boss reachable from every floor-1 node).
13. Save round-trip: serialize → deserialize → identical state; unknown schemaVersion refused and archived; contentVersion mismatch with a dangling card id refused and archived.
14. Full headless auto-run: a scripted bot (plays leftmost affordable card, ends turn) completes a seeded M1 combat without throwing.
15. **Content validation (§3.14):** every shipped content object passes its schema; every id cross-reference resolves; every opcode/formula op/event/predicate used is in the closed sets; `scripts.js` budget < 5%.
16. **Text templating (§3.13):** every template token binds to an effect value; no player-visible numeric effect lacks a token; Strike's preview shows 9 with +3 Strength and 6 under Weak via the shared evaluator.
17. **Status-model generality:** define a throwaway status (in test code, not shipped content) with a meter + hook + modifier; verify it behaves per schema with zero engine changes — proving law §3.1(2).

CI-less workflow: opening `tests/index.html` must show all green before any milestone is called done.

---

## 9. Milestones & acceptance criteria

### M1 — Combat vertical slice
Build: model layer (schemas, registries, formulas, validation), engine core (queue, triggers, status-model interpreter), all statuses/stances as content data, Vagabond + 24-card set, 5 Act-1 encounters + elite + Watchful Omen boss, combat screen with full tooltips/targeting/piles, tests 1–11 + 14–17.
**Accept when:** `index.html` → class select (Vagabond only) → a fixed 4-fight gauntlet (2 monsters → elite → boss) is winnable and losable with zero console errors; every visible number matches engine math; all listed tests green.

### M2 — The run
Build: map gen + map screen, rewards (cards/runes/flasks/relics), 16 relics, 7 flasks, shrine/shop/treasure/4 events, save/continue, seed entry + display, death/victory screens, tests 12–13.
**Accept when:** a complete seeded Act-1 run works end-to-end; reload restores exactly; same seed twice → identical map, rewards, and shuffles; abandoning mid-combat restarts that combat.

### M3 — Content pass
Build: Astrologer + Prophet pools (~50 cards each + starters), Acts 2–3 (rosters, elites, 2 bosses incl. phase mechanics and the heal-on-hit final boss), events to 10, relics to 40, colorless pool, balance pass (target: experienced-player win rate ~35–50% at v1 tuning; instrument run history to check).
**Accept when:** all 3 classes can complete 3-act runs; every card/relic/event reachable; no unbeatable-by-construction encounters (elite HP vs. average deck DPS sanity table included in the balance notes); `scripts.js` budget still < 5%.

### M4 — Polish
Build: fx pass (floating numbers, shake, transitions), run-history screen, keyboard shortcuts, first-run tooltip overlay (≤4 callouts), sfx hook wiring, asset pass replacing placeholders (CREDITS.md complete), performance check (60 fps on a mid-range laptop; no per-frame allocations in fx loops).
**Accept when:** DEVELOPER.md documents the layer rules, state shape, every opcode/formula op/event/predicate, and "add a card/relic/status/enemy/event in <10 lines" walkthroughs — each verified by actually adding a throwaway example.

---

## 10. Forward hooks (build the seam now, not the feature)

- **Ascension-style difficulty:** run state carries `modifiers: []` consulted by `balance.js` lookups (enemy HP ×, gold ×, starting curse). v1 always empty.
- **Act 2/3 signature mechanics needing engine support from M1:** enemy phase-change interrupts (Watchful Omen already exercises this), enemy self-heal on dealing damage (final boss — a status hook on `damageDealt`), enemy applying Bleed to the *player* (player-side meters already exist in the status model; player Bleed threshold 15).
- **Wondrous Physick crafting** (combine two flasks at shrines): flask effects are already composable data; UI only.
- **Daily seed / run sharing:** seeds are already displayed and enterable; nothing else needed in v1.
- **Content packs / mods:** the data/model split makes a pack = one folder of content files passing validation; a pack loader is out of scope for v1 but requires no engine redesign.
- **Second card pools per class ("Remembrance" variants):** class def already takes `cardPool: []`, so alternate pools are content-only.

## 11. Non-goals (v1)

Still non-goals: accounts, monetization, localization (strings live in content files, so l10n is possible later), a mod loader, Steam-style achievements, and bundled audio asset files (the score and SFX are synthesized at runtime — §7.4; the manifests accept real files).

Three things this list once excluded have since shipped and are no longer non-goals: **multiplayer** (Forsaken Together LAN co-op — `docs/MULTIPLAYER.md`, `src/net/lan.js`, served by the launcher's own Node server; the feature hides itself when no launcher is behind the page, so a `file://`-opened dist stays single-player), a **narrow/mobile layout** (`data-layout`, `balance.ui.uiScale`), and **audio** (§7.4).
