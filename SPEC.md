# Ashen Spire — Detailed Specification

*(Formerly "Spire of the Erdtree / EldenSpire" — renamed in the IP scrub, `95c3b87`.)*

> **KNOWN DEBT, stated once here rather than apologised for per section: this spec's in-game
> vocabulary is still largely pre-scrub.** It says runes/Vagabond/Astrologer/Prophet/Erdtree
> where the tree ships cinders/Reaver/Starseer/Herald/Goldbough. **`docs/IP-SCRUB.md` is the
> authoritative old→new map** and every name in it is a shipped fact. This is **to-build**: one
> deliberate rename act, not per-section nibbles, which would leave the spec disagreeing with
> itself mid-document. Measure the remaining debt:
> `grep -cE "runes|Vagabond|Astrologer|Prophet|Erdtree|Scarlet Rot" SPEC.md`.

A single-player roguelike deckbuilder for the browser. Mechanically faithful to Slay the Spire; thematically inspired by (but legally distinct from) Elden Ring. Companion documents: [PROMPT.md](PROMPT.md) (the brief this spec expands), and — once implementation starts — `DEVELOPER.md` (how to extend) and `CREDITS.md` (asset licenses).

Numbers in this spec are the **initial balance targets**. They will move during the M3 balance pass, but the *structures* (formulas, orderings, state shapes) are contractual.

---

## 1. Product overview

| | |
|---|---|
| Title | **Ashen Spire** (`AshenSpire` — the bundle name; title screen `src/ui/screens/title.js:47`) |
| Platform | Modern evergreen browsers. 1280×720 is the **layout reference** (§7.2), not a minimum: a narrow layout ships and is selected once by `main.js` writing `data-layout` (§11). |
| Tech | Vanilla ES-module JS, HTML, CSS. No framework, no build step |
| Persistence | `localStorage`: three run slots, plus a **durable profile** (settings, unlocks, progress, last 20 results) with a verified-write mirror and a keyed archive drawer the player can open at Settings → Profile (§3.12) |
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

### 2.1 The AI-use acknowledgement — one home, two surfaces

The game was built by AI under human direction, and says so. **The text has exactly one home,
`src/content/aiDisclosure.js`, and nothing retypes it** — the two surfaces render it:

- **In-product:** Settings → **About** (`src/ui/screens/about.js`).
- **The store:** `node tools/ai-disclosure.mjs` prints the identical string for Steam's
  AI-disclosure field; the value pasted there is that output, not a paraphrase.

One fact with two hand-maintained copies is a player comparing the store page to the game and
reading two different claims about the same thing. So the arrangement is enforced rather than
intended: **`node tools/ai-disclosure.mjs --check` fails when a shipped bundle has drifted from
the module**, and the load-bearing runtime claim (*no AI runs while you play*) is a **single
named string** that both the player and the falsifier are given — it previously existed twice,
in different words, so no comparison could ever have caught them diverging.

**`approved: true` since 2026-08-07 — and this spec says so because it is true.** The wording
was Constantine's call at release and he made it; the flag records whose words these are and
**nothing reads it to decide whether to render** — the acknowledgement always shows. Approval
is a release gate (§9), not a display condition. **The flag is about THIS wording:** any edit
to the text returns it to `false` in the same act, or it stops recording anything.

> **This sentence is a SECOND COPY of a boolean and it went stale the day the boolean moved**
> *(Saga, 2026-08-07)*. `docs/SPEC-RECONCILE.md` carries a third. Nothing syncs the three —
> Law 1 clause 2, in the file that states the arrangement. **The honest fix is for the spec to
> cite the module rather than restate its value**; I am correcting the value rather than
> restructuring another seat's file, and naming the defect here so the next reader does not
> have to rediscover it.

*Falsify:* `node tools/ai-disclosure.mjs --check` after the last bundle rebuild — a stale
bundle ships an acknowledgement that disagrees with the store page. The runtime claim carries
its own two-command falsifier, stated in the module beside the sentence it defends.

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

### 3.2 File tree — the layer contract, not an inventory

**This section states where a thing BELONGS. It does not list what exists** — that list has a
home (the tree) and a command, and the previous edition of this section was a hand-maintained
copy of it that had drifted to **52 files listed against 92 shipped, four of them dead paths**
— the three pre-scrub class card files, renamed, and `floorplan.js` filed under `engine/`
while it lives in `model/` (§6 cited the right path all along, so the spec disagreed with
itself) — while `tools/`, `content/source/`, `build/` and `dist/` were absent entirely.
**That count was measured at `267397a` and `src/` held 94 two commits later**, which is the
point: an inventory is a cache, and even the sentence describing its rot has to name its own
expiry or it becomes the next one. A restatement of the tree is a cache with no write event; it rots while nobody edits
it. Print the real one:

```
find src tools content/source styles tests -type f | sort      # what exists
node tools/dirorder.mjs --selftest                             # the shape check, watched red first
```

| Directory | Contract — what may live here |
|---|---|
| `index.html` · `styles/` | Boot page and stylesheets. `base.css` owns the palette tokens, the root sizing anchor and `--ui-zoom`; `combat.css` / `map.css` / `ui.css` are screen-scoped and **measure nothing** — `main.js` decides layout once and writes `data-layout` (§7.2). |
| `src/model/` | Shape and meaning, no behaviour: schemas, registries, the formula evaluator, content validation, run/combat state + its persisted-shape declaration, `floorplan.js` (what a floor rule MEANS, §6), `loadout.js`, `unlocks.js`. Headless. |
| `src/engine/` | Behaviour over that shape, still headless — no DOM, storage, timers or randomness beyond the seeded streams: turn loop, opcodes, triggers, the status-model interpreter, mapgen, `actmap.js` (the one act-boot path — game and both harnesses import it, §6), encounters, rng, save. |
| `src/content/` | Pure data, no logic: cards, statuses, stances, relics, flasks, events, enemies, encounters, keywords, tags, classes, keepsakes, equipment, balance, mapconfig, music beds, SFX recipes, and the budgeted `scripts.js` hatch (<5%). `generated/` is compiled from `content/source/*.csv` — **never hand-edited**. |
| `src/ui/` | Everything that touches the DOM, and nothing the engine imports: screens, components, fx, audio, input/gesture, asset maps. |
| `src/net/` | LAN co-op client (§11). Absent behind the launcher → the feature hides itself. |
| `content/source/` | The authoring spreadsheets (CSV) that compile into `src/content/generated/`. |
| `tools/` | Node-run instruments and harnesses. The observed-red idiom (`--selftest` / `--mutate`) lives here and is wired in `.github/workflows/ci.yml`. |
| `tests/` | `index.html` (browser runner) and `run-node.mjs` (headless). Assertions against model + engine only — no UI imports. |
| `build/` · `dist/` | The single-file bundle emitted by `tools/bundle.mjs` and its shipped copy. Build artifacts; `node tools/verify-shipped.mjs` is what says they agree with source. |

**The one rule that makes the table enforceable:** imports point *inward* — `ui` may import
`engine`, `model` and `content`; `engine` may import `model` and `content`; `model` may import
`content`; **`content` imports nothing.** A content file that imports from `engine` is the
defect this layering exists to catch.

### 3.3 Domain model, registries, and state

**Entity types** (each with a schema in `schemas.js`):

| Entity | Key fields |
|---|---|
| Card | `id, class, rarity, cost (int \| 'X'), type, keywords[], effects[], textTemplate, upgrade` (partial override object) |
| Relic | `id, rarity, textTemplate, triggers[], passives?` — passives are a closed key set the run systems consult, and it has **one home**: `PASSIVE_TYPES` in `src/model/schemas.js`, which the relic schema's `passives` node is BUILT FROM rather than restating (the two were separate hand-typed lists until A8, and only the schema enforced anything). Today: `runeGainMult, eliteExtraCardReward, flaskPowerMult, revealUnknown, shrineHealMult, shrineNoRest, powerCostReduction, swapCostDelta` |
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

**Armaments: what a swap costs, and what is on the shelf** *(A8/A7, Constantine 2026-08-08)*

Two closed vocabularies, both in `balance.equipment`, both derived rather than authored per row:

| Question | Word | Chain |
|---|---|---|
| what does a mid-fight set-swap cost | `swapCostRule` — one of `swapCostRules[].id` | **base → gear → floor 0.** `base: 'category'` prices by the DRAWN piece's tags against `swapCostByCategory` (ordered, first match wins), falling through to `swapCost`; `base: 'default'` is `swapCost` for everything. `gear: true` adds the signed total of relic `swapCostDelta` passives and worn `self.swapCost` mods. The truth function is `swapCostFor()` in `model/loadout.js` and it returns the whole derivation; `engine/combat.js` charges it and the `armamentSwapped` event carries the number. |
| which pieces need no finding | `basicTag` | A piece carrying that tag answers the **found** gate for free (`ownership()`). It has no opinion about the **earned** gate; a row carrying both is refused by name. `persistence` remains the only scope word — profile-wide (`both`, the shipped default) vs this-run-only (`perRun`). |

**A weapon's category is its tags** — `heavy`, `flourish` — never a `swapCost` column, because a
column would compel an author to restate what the tags already imply (Law 0 clause 1). The two
rule fields are closed and **their product is total**: all four cells price a swap, and a fourth
rule is one row of `swapCostRules` with no code (proven by test 28q).

`apply` in `equipMods.csv` is a closed set **per scope** — `CARD_MOD_APPLIES` / `RUN_MOD_APPLIES`
in `model/loadout.js`, beside the functions that branch on them. A row naming anything else is a
validation failure; before A8 it validated clean and silently did nothing.

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

### 3.12 Save format, and the durable profile

**Two schemas, one home each — this is the contract, and the values are not restated here.**
`RUN_SCHEMA_VERSION` lives in `src/model/state.js`; `META_SCHEMA_VERSION` lives in
`src/engine/save.js`. Neither number appears anywhere else, and a second copy of either is a
defect.

**The run.** Key `sote_run_v1`, **three slots, one run each** (`SLOTS`, `save.js`). The
persisted field list is **declared as data** — `RUN_SHAPE` in `model/state.js`, with
`validateRunShape()` checking it — so the save contract is a table, not whatever
`createRunState` happens to set, and this spec points at it rather than carrying a copy that
drifts. It is a **floor, not a whitelist**: unlisted keys pass through untouched. Instances by
id only (§3.3).

- Saved after **every** committed player choice (node chosen, reward taken). **Mid-combat**:
  only `combatEntered` is saved — reload restarts that combat from its start with the same
  shuffle-stream state (StS behaviour). Abandoning mid-combat = same.
- An unknown `schemaVersion`, a parseable-but-malformed shape, or a `contentVersion` mismatch
  with a dangling id → the save is **refused and archived**, never silently repaired. A run
  saved before equipment existed is the one healed case: it gets a fresh loadout and a
  re-stamped deck rather than being thrown away.

**The profile** — key `sote_meta_v1`: settings, unlocks, durable progress, found armaments,
and the last 20 run results. **It is the one artifact a player cannot re-earn**, so it carries
five durability properties (#66/#67), each of which is a claim a command can falsify:

1. **Versioned both ways.** An older `schemaVersion` migrates or refuses **by name**; a
   **newer** one refuses and **preserves** — the case a stamp alone cannot catch, and the one
   that silently destroys a profile when a player opens an old build after a new one.
2. **A verified write, then a mirror.** `sote_meta_backup_v1` is rotated **only after the
   primary is read back cleanly** — a mirror of bytes never proved readable is not a backup.
   A write that fails read-back restores the primary from the last known good.
3. **Archives are keyed and appended, never overwritten** — `sote_run_archived` is the index
   for both kinds, entries keyed by kind, slot and time. **Runs** age out and are capped;
   **profiles are never deleted, never aged out, and never evicted by run pressure**, and a
   profile archive **never removes the primary** (the bytes are the evidence). If profiles
   alone ever fill the drawer, the oldest is **moved to its own salvage key with a recorded
   notice** — not silently dropped — so the browser's storage quota is the only real ceiling
   and it is named rather than hidden.
4. **Never silently empty.** A failed load is a **named, visible state** (`profileStatus()`,
   surfaced by `ui/screens/profileNotice.js`), never a fresh profile wearing the same
   filename. While in that state the profile is **quarantined**: the next ordinary settings
   write cannot overwrite the original bytes, which are the evidence of every other failure.
5. **The drawer has a handle.** `listArchives()` / `getArchive()` / `exportArchive()` /
   `replacePrimaryWith()` are reachable by the player at **Settings → Profile**
   (`ui/screens/profileArchive.js`): inspect, export to a file, or promote an archive back to
   primary — which archives the outgoing one and clears the quarantine. An archive nothing can
   open is a promise, not a feature.

*Falsify the set:* `node tests/run-node.mjs` (the profile-durability cases: no profile, corrupt
profile, older version, **newer** version, two archives in a row) — and the drawer's own
notices (`drawerNotices()`) are how the screen reports what it had to do to itself.

### 3.13 Card text templating

Card and relic `textTemplate`s carry tokens: `"Deal {damage}. Apply {bleed} Bleed."` Tokens bind to opcode values by op/status name (disambiguated by index when repeated: `{damage.2}`). The UI fills tokens via the **same formula evaluator and damage preview the engine executes** (§3.5, §4.2) — so a Strike in hand shows 9 when you have +3 Strength and shows it struck through to 6 when Weak. A validation rule (§3.14) rejects any template token that doesn't bind, and any player-visible numeric effect lacking a token.

### 3.14 Content validation

`model/validate.js` runs at boot in dev mode and from the test page. It checks, across ALL registries:

1. Every content object conforms to its schema (fields, types, enums).
2. Every id cross-reference resolves (cards in pools/decks, statuses in effects, encounters on maps, moves in `unlockMoves`, …).
3. Every opcode, formula op, event name, and predicate used anywhere is in the closed sets of §3.4–§3.6.
4. Every text-template token binds (§3.13).
5. `scripts.js` budget report: script-using content is listed; the count must stay <5% of total content objects.
6. Value-range and pairing rules that a field-wise check cannot see — a floor anchor outside
   its act's rollable band, a proc row whose `burstMin` exceeds its `burstMax`, a music bed
   that is quiet by accident rather than by the declared silence word (§7.4) — each failing
   **naming the entry**, per Law 1 clause 5.

**Law 1 clause 6 — the content smoke — is built and runnable** (#64). Validation only covers
failures *downstream of itself*, so the standing check is over observable outcome, in the
repo's existing observed-red idiom:

```
node tools/content-build.mjs --selftest    # the known-bad corpus: every case fails for its named reason
node tools/content-build.mjs --mutate      # reinstate each defect N ways; each must be caught
```

Both edges, in clause 6's own words: **one entry added by table + asset alone appears and
plays; one deliberately broken entry fails with its id printed.** A corpus nobody has watched
go red is `unknown`, not green.

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

**Threshold-proc statuses** *(#61, Constantine's direction 2026-08-06 — supersedes the
earlier Bleed row; every number is a PROVISIONAL table knob in the row itself)*: a proc
status builds points toward a **constant** threshold; points do not decay. At the
threshold the target takes percent-of-its-max-HP damage as **its own proc** — its own
event and damage-record entry, never folded into the triggering hit — then the build-up
**resets to zero** (overflow dropped; the old carry-and-escalate ×1.5 is gone), and, if
the target carries a listed creature tag, it gains a short resistance status (strength on
the resist row, duration in its decay, gate in the proc row). Declared per row:
`threshold, burstPercent (of target max HP), burstMin/burstMax, poiseDamage (per proc),
stagger (direct), effects, resistance {status, tags}`. Schema + validator enforce every
knob (`model/schemas.js`, `model/validate.js`); tag-scoped extra vulnerability composes
by a declared `stacking` rule (closed enum: additive | multiplicative).

**The numbers are deliberately NOT restated in this spec.** Every knob above is marked
PROVISIONAL in its own row and is expected to move — Bleed's threshold was picked against the
sim after this section was first written, and the prose here said `12` while the shipped row
said `7` until this pass caught it. A restated provisional value is a cache guaranteed to rot;
§6 already refuses to restate its samples for the same reason. **Read them from the rows:**

```
node -e "import('./src/content/statuses.js').then(m=>m.statuses.filter(s=>s.proc)\
  .forEach(s=>console.log(s.id, JSON.stringify(s.proc))))"
```

| Status | Mechanic |
|---|---|
| **Bleed (threshold-proc)** | The build-up the Reaver's kit is written around; fleshy targets (beast/humanoid) gain a bleed-resist status after a burst. Adds Poise damage per proc. |
| **Frost (threshold-proc)** | Deliberately the smallest burst of the three; the proc leaves **Weak** plus a tag-scoped exposure that raises `starstone`-tagged damage. |
| **Insanity (threshold-proc)** | The largest burst and the hardest to fill; adds Poise damage **and a direct Stagger** that bypasses the meter, and leaves an exposure on `ritual`/`blight`-tagged damage. **Not** the player-side Madness below — two words, two mechanics, on purpose. |
| **Crimson Blight** *(`crimsonBlight`; "Scarlet Rot" pre-scrub)* | DoT on enemy: take N `loseHp` at its turn start. Unlike StS Poison, stacks **do not tick down** — instead it has a duration of **3 of its turns**, then expires entirely. Re-applying adds stacks and refreshes duration. Ignores block. |
| **Burn** *(`burn`)* | The third damage-over-time row, applied by `burn`-tagged effects and by equipment mods (`equipMods.csv`). |
| ~~Frostbite~~ | **CUT — describes nothing.** No `frostbite` status ships; the frost identity is carried by the **Frost** threshold-proc row above and its `frostExposed` exposure. Falsify: `node -e "import('./src/content/statuses.js').then(m=>console.log(m.statuses.some(s=>s.id==='frostbite')))"` → `false`. |
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

3 slots (`balance.flaskSlots`). Found from combats (~35% drop, decaying like StS's potion chance: −10% per drop, +10% per miss), shops, events — **and refilled at every grace** (§5.5.1).

**Kind.** Every flask has a `kind` from the closed set `FLASK_KINDS` (`hp`, `mana`, `utility`, `model/schemas.js`). It is **derived, not authored** (`model/gracerefill.js` `flaskKindOf`): `heal` is `hp`, the real `restoreMana` opcode is `mana`, everything else is `utility`, and an explicit `kind:` overrides an ambiguous entry.

#### 5.5.1 The grace refill

> Constantine, 2026-08-08: *"at every grace all characters should restore 3 hp flasks, and 3 mana flasks (this should be configurable in teh debug settings and be data driven)"*.

**The grace is the Shrine of Emberlight** — this game has no separate `grace` node type and does not invent one.

- **Automatic, on arrival, before the Rest/Smith choice.** A run that comes to smith is refilled exactly like a run that comes to rest. Co-op refills every living member at `enterShrine`.
- **Data driven.** `balance.graceRefill` is a table of `{ kind, count, flaskId? }` rows. A row names a KIND; the kind resolves to its first authored member (`flaskId` overrides which one). Adding a refilled kind is a row plus one word in `FLASK_KINDS`; adding a second HP flask is neither.
- **A top-up, not a grant.** A grace brings you **up to** `count` of the kind — arriving with two Crimson Flasks gets you one. Therefore idempotent: a re-mounted shrine cannot double-pour.
- **Configurable in the debug settings.** Settings ▸ Advanced carries **one chip row per table row**, generated from the table, with the ladder `0 … balance.flaskSlots` derived from the carry cap. Nothing about those rows is authored in `settings.js`.
- **Both authored rows bind.** Crimson Flask supplies the HP row and Azure Flask supplies the Mana row. The shared inventory is data-sized to six slots so a fresh character can hold the authored 3+3 allocation; utility flasks are preserved, so an occupied belt produces a visible shortfall instead of deleting inventory.
- **Refusals** (`graceRefillRefusals`, run from `validateContent` at boot; corpus `node tools/gracerefill.mjs --selftest`): a kind outside the closed set · two rows for one kind · a non-numeric, negative or fractional count · a count above the carry cap · a `flaskId` override that dangles or is of another kind · **and the aggregate** — satisfiable rows summing past `balance.flaskSlots`, which names `balance.flaskSlots` as the fix.
- **Balance boundary:** the old no-Mana simulation is stale. This merged preview is for watching and mechanical validation; a Mana-aware A/B balance run remains a release gate.

| Flask | Effect |
|---|---|
| Crimson Flask | Heal 25% max HP. |
| Azure Flask | Restore 20 Mana. |
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

Screen router in `main.js`; each screen module exports `mount(state, dispatch)` / `unmount()`. **Arriving at a Shrine refills flasks automatically before the Rest/Smith choice is offered** (§5.5.1); the screen reports what it was handed and what the slots could not hold, and is silent when there is nothing to say.

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
- Sound: shipped, and procedural. `sfx.js` is the hook bus — every feedback moment calls `sfx.play(id)` (card play, hit, stagger, death, buy, shrine, …) — and `main.js` wires its sink to `src/ui/audio.js`, a WebAudio engine that synthesizes every SFX and per-context music bed (title/map/combat/elite/boss/shop/rest/victory). What the sound *is* lives as content in two files, one home each: **`src/content/music.js`** (scales, per-context beds, `MUSIC_MANIFEST`) and **`src/content/sfx.js`** (`SFX_RECIPES` plus `SFX_MANIFEST`). A recipe is a list of layers in the engine's **two-word closed vocabulary, `tone` and `noise`** (schema `SFX_LAYER_SCHEMAS`, `model/schemas.js`), so retuning a sound is a table edit and never an engine edit, and a malformed layer fails validation **naming its recipe id**.

  **Ids are composed, and resolution is one pure function with three steps** (`resolveRecipe`, `content/sfx.js`): **exact id → the FAMILY row** (the segment before the first `_`) **→ `default`**. So `procBurst_bleed` plays its own row, a proc with no row of its own falls to the `procBurst` family and still sounds like a burst, and anything unrecognised plays the required `default` — audible, never silent (Law 1 clause 5) — while **the fallback warns once per unknown id**, so an orphan is reported without becoming a per-frame noise. Authoring a new family is one row named for the segment before the underscore; **no engine change and no registration list.** *(Falsify: `node -e "import('./src/content/sfx.js').then(m=>console.log(m.resolveRecipe('procBurst_nosuch')))"` → matched `procBurst`, `fellBack: false`.)* Volumes/mute are settings, and the score **ships audible** (music default is non-zero; the testing mute is gone). A context's bed value is either a bed object or the exact word `'silence'` (one home: `MUSIC_SILENCE_WORD`, `src/model/schemas.js`) — deliberate quiet a human typed on purpose; the beds and scales ride the content bundle and `validateContent` rejects every quiet-shaped mistake by name (null, missing variants, `[]`, a zero gain, a wrong or miscased word), while an unknown context at runtime warns in the console naming itself and plays nothing — quiet-by-intent and quiet-by-bug are never the same shape. No audio asset files ship, and the two override paths fail differently: a music folder with `manifest.json` (Settings) replaces a context's procedural bed and a missing/unplayable track **falls back to the synth bed**; `SFX_MANIFEST` (shipped empty, now in `content/sfx.js`) replaces a synth SFX id, but `audio.js` `sfx()` short-circuits on a manifest entry and a failed sample load is cached as a miss and plays **silence, not the synth**. `MUSIC_MANIFEST` is **still imported and never read** — a dormant slot, not a path, unchanged since the stage-1 sweep flagged it. Falsify: `grep -n "MUSIC_MANIFEST" src/ui/audio.js` → one import line, zero uses.

### 7.5 Visual style

- **Palette: semantic tokens in `base.css`, and there are THREE of them, not one** — the
  default dark set, a **high-contrast** variant, and `body.cb-safe`, a colourblind-safe
  remap on Okabe-Ito hues (danger→vermillion, heal→bluish-green, frost→sky, blight→orange).
  Map structure has its own token, `--map-structure`, so roads and rings can be re-levelled
  without touching text colour. **The hex values are not restated here** — a colour restated
  in prose is a copy nothing syncs, and any variant would make it wrong in two directions
  at once. Read them: `grep -nE "^\s*--" styles/base.css`. The gate that says they *pass* is
  `node tools/contrast-audit.mjs`, which carries targets for both palettes.
- Cards: DOM elements (not canvas) — rounded rect, rarity-coloured frame, cost orb top-left,
  type banner. Type presentation (geometry + banner colour per card type) is data:
  `balance.ui.cardTypes`.
- **Fonts — TO BUILD, and the shipped state is the opposite of what this line used to
  claim.** Cinzel (display) / Inter (body) are named in `font-family` **with system fallbacks
  (Georgia / system-ui) and are NOT bundled**; `CREDITS.md` is the authoritative home and says
  so. Self-hosting the `woff2` under `assets/fonts/` is unfinished work, not a shipped fact.
  Falsify: `ls assets/fonts` and `grep -n "not bundled" CREDITS.md`.

---

## 8. Testing

**Two runners, one suite:** `tests/index.html` in a browser, `node tests/run-node.mjs`
headless — both load `engine.test.js`. All assertions are against model + engine with **no UI
imports**, so nothing in this file has seen a screen; the suite says so in its own boundary
block when it finishes.

**The required-coverage list that used to live here is gone, and deliberately.** It named 17
tests against a suite that had already grown past it — **47 cases over 43 declared blocks at
`267397a`, 48 over 44 two commits later, and it will have moved again by the time you read
this** — and two of its entries had gone false without anybody editing them — test 7 restated Bleed's threshold as `12` with an escalating `×1.5`
(both superseded by the constant-threshold proc vocabulary, §4.4) and test 8 named "Scarlet
Rot", renamed at the IP scrub. **A hand-kept index of tests is a cache of `grep`**, and this
one rotted exactly the way §3.2's file inventory did. The list has a home:

```
node tests/run-node.mjs                       # the whole suite + its boundary block
grep -n "test('" tests/engine.test.js         # the index, derived
```

**What this section states instead is the contract a test must meet, which cannot rot:**

1. **Headless and UI-free.** A test that needs a DOM belongs in `tools/`, not here.
2. **Both edges** — the empty/zero case and the cap/overflow case (Charter quality gate).
3. **Content-driven mechanics are asserted through their data**, never against a number
   hard-coded in the test: a status test drives `content/statuses.js` rows, so retuning a knob
   moves the test with it instead of breaking it.
4. **A check is trusted only after it has been watched to fail.** The observed-red idiom is
   `--selftest` (a known-bad corpus, every case must fail for its named reason) and `--mutate`
   (reinstate the defect N ways, each must be caught), carried by the `tools/` instruments and
   wired in `.github/workflows/ci.yml`.
5. **Every release-gating instrument prints what it did NOT check, in its run output — not
   only in its header.** *(House law, adopted 2026-08-07 out of the instrument audit. It was
   triggered by three greens that lied in one week: a screenshot harness blind to five
   player-facing surfaces, a driver returning exit 0 against broken code, and a disclosure
   check that covered one text of seven. Each was accurate about what it measured and silent
   about its own hole — and a boundary in a file header is read by the author, while a
   boundary in the output is read by whoever is about to trust the green.)*

**The release capture set is `tools/release-shots.mjs`, and it is not
`tools/screenshot.mjs`.** The distinction is the third lying green above, so it belongs in a
spec rather than in tribal memory:

| | photographs | coverage |
|---|---|---|
| `tools/screenshot.mjs` | the **source tree** over a local server | the `?shot=` states that existed when it was written — **structurally blind** to any surface without one |
| `tools/release-shots.mjs` | the **built bundle** (`dist/AshenSpire.html`), at both shapes | **two denominators, both printed.** (1) **Top-level states**, derived from `main.js`'s `?shot=` states, so a new state cannot be silently missed; five co-op states **excluded by name**. (2) **Navigable sub-surfaces** — the tabs and panels reachable *inside* a state — derived from the three homes that define them (`uiContent.js MENU_TABS`, `settings.js settingsCategories()`, `balance.equipment.views`), one generated shot per member, each carrying an **assertion** that the surface both selected and painted. Surfaces with no `?shot=` are reached by real clicks and seeded storage; an unaccounted state, a **home that derives zero members**, or a sub-surface shot with no assertion all **fail before the browser starts** |

**There is no single home that defines the tabbed surfaces**, only three homes each defining
its own members — so denominator 2 enumerates the three sets the harness was told about, and
prints the sets it knows exist and does not enumerate (co-op's per-player seat tabs). Closing
that hole is a change to the tree, not to the harness: one declarative surface table, in the
content layer beside `MENU_TABS`, naming every navigable set and its members.

The artifact is **never modified** to reach a state — crisis states are produced by writing
storage from outside and reloading, because a shot of a patched bundle is a shot of something
we do not ship. Failure lines name **floats and screens separately**, so a red says which
thing broke.

**The browser-facing gates that the suite cannot reach**, each a command rather than a
promise: `node tools/verify-shipped.mjs` (the bundle matches source), `node tools/mapplan.mjs`
(map distributions at the current shape), `node tools/content-build.mjs --selftest --mutate`
(§3.14), `node tools/contrast-audit.mjs` (palette targets), `node tools/release-shots.mjs` (the release
capture set — see above), `node tools/ai-disclosure.mjs --check` (§2.1),
`node tools/screenreach.mjs`, `tools/zoomplace.mjs`, `tools/mapreach.mjs`,
`tools/sfx-loudness.mjs`.

*(The previous edition of this section ended "CI-less workflow: opening `tests/index.html`
must show all green before any milestone is called done." **CI exists** —
`.github/workflows/ci.yml` — and the sentence had been false since it landed. What survives is
the standard: all green before a milestone is called done, on whichever runner you used.)*

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
