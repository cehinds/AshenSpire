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
| Persistence | `localStorage`: three run slots, plus a **durable profile** (settings, unlocks, progress, last 20 results) with a verified-write mirror and a keyed archive drawer the player can open from **Profile on the title screen** (§3.12) |
| Entry point | `index.html` opened directly or via any static server |
| Session length | One full run ≈ 45–90 minutes; one combat ≈ 2–5 minutes |

A **run**: pick 1 of 4 classes → traverse a branching node map across 3 acts → fight monsters/elites/bosses, visit shrines/merchants/events → build a deck from that class's 36-card reward pool + colorless cards → win by defeating the Act 3 boss, or die and see the "YOU PERISHED" screen with seed and stats.

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

- Combat: `damage {hits?}`, `block`, `applyStatus`, `removeStatus`, `draw`, `discard {random?}`, `exhaust`, `addCard {card, pile, position}`, `gainEnergy`, `loseHp` (ignores block), `heal`, `shuffleDiscardIntoDraw`, `enterStance`, `poiseDamage`, `dodgeRoll` (player only; no fields — the die, the Dexterity + Weight Class check, the difficulty and the temporary guard are the framework's `dodgeRoll` rule over `mechanics.json`; rolls on stream `misc`; success lands the guard as Block through the block door; emits `dodgeRolled`).
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

**Approved configurable character defaults.** These are the shipped defaults, not engine
constants. Every base, coefficient, divisor, rounding rule, reference maximum and flat-bonus
fold is authored in content data; Settings/debug overrides layer over that data rather than
adding a second formula in UI or engine code. The run snapshots the resolved formula rules at
birth, so later tuning applies to new runs and never silently re-stats an in-progress save.

| Output | Default formula | Meaning |
|---|---|---|
| Maximum HP | `30 + 2 × CON + flat bonuses` | Flat bonuses are the declared relic/equipment/run folds, not class-id branches. |
| Opening hand / draw | `4 + floor(INT / 10)` | One value owns both the opening hand and cards drawn per turn. |
| Defense | `-6 + DEX` | The data-owned base value used by the basic guard/defense profile. |
| Actions / turn | `2 + floor(DEX / 10)` | The player-facing Actions value; engine naming may migrate separately. |
| Strike | `-6 + STR` | The data-owned base value used by the basic physical strike profile. |
| Magic | `-6 + WIS` | The data-owned base value used by the basic magic profile. |

The defaults above are independently configurable rows. “Configurable” never means parsing
formula strings or letting a screen recompute them: the structured formula table remains the
one authority, uses the shared floor rule, and is validated/snapshotted through the existing
model door.

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

**Equipped weapon card packages.** The authored attack-slot count is fixed by
`balance.equipment.roleCopies.attack`; changing equipment never changes that count or the total
deck size. `WeaponCardPackageModel` adapts the existing `attackProfile` as an empty ordered
priority list plus that profile as filler. `WeaponDeckCompositionService` builds an
`EquippedWeaponCardPlan`, then rebinds the stable generated attack instances in place. No eligible
weapon produces Unarmed in every attack slot; one eligible weapon in either hand owns every slot;
two eligible one-handed weapons split right `ceil(N/2)` then left `floor(N/2)`. Within a hand,
ordered priority/effect references precede repeated filler. Shields and other items without a
weapon package consume no quota.

The plan preserves `equipmentAttackSlotId`, `instanceId`, upgrades, and acquisition metadata and
changes only package-derived card/profile/receipt/mod fields. Equip, unequip, hand move, and active
set swap apply the plan atomically and emit one post-commit `equipmentChanged` receipt; creation
and load/continue call the same composition service directly. Combat rebinds generated attack
instances wherever they currently live in hand, draw, discard, or exhaust after the current card
resolution. Legacy role-only generated attacks map once in deck order to `attack:0..N-1` and are
never appended. Explicit `handsRequired: 2` claims the whole attack quota and is never inferred
from tags, names, art, or kind. A conflicting off-hand, duplicate piece without distinct equipment
instance identity, or a claimed but invalid package fails closed; Unarmed is only the valid
zero-weapon plan.

An exact active-combat snapshot uses its own saved loadout as the authority. After snapshot shape
and content-reference validation, the same service migrates the complete generated attack set in
the fixed pile order `draw`, `hand`, `discard`, `exhaust`; no card moves between piles. The migrated
snapshot loadout replaces the stale top-level run projection before continue. Package migration
must not replay combat, consume RNG, reset turn/enemy/event/trigger state, or mask an unknown card
reference. Invalid duplicate or explicit two-handed-plus-offhand snapshot loadouts are archived
fail-closed rather than normalized or replaced with Unarmed.

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
equipmentChanged(reason,beforeLoadoutSignature,afterLoadoutSignature,changedPositions)
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

- Saved after **every** committed player choice (node chosen, reward taken). Entering combat
  first writes a deterministic `combatEntered` recovery checkpoint. Choosing **Save Game** or
  **Save and Quit** during a fully resolved combat replaces that checkpoint with a versioned
  `CombatSnapshotService` record of the exact committed turn: phase, resources, hand and all
  piles, enemies and intents, statuses, triggers, equipment state, and event log. Loading that
  record restores it without replaying combat start, draws, or enemy rolls. A live action queue
  or event buffer is not a committed boundary and refuses the save. Older `combatEntered`
  records without a snapshot remain compatible and restart the encounter deterministically.
- An unknown `schemaVersion`, a parseable-but-malformed shape, or a `contentVersion` mismatch
  with a dangling id → the save is **refused and archived**, never silently repaired. A run
  saved before equipment existed is the one healed case: it gets a fresh loadout and a
  re-stamped deck rather than being thrown away.
- **This tuning/Rogue addition is additive and save-safe.** The new creation mode gets a new
  stable id; `standard` and `pointbuy` remain valid and keep their old validation rules. Rogue
  adds ids and does not rename or delete any existing class, card, relic, kit, outfit or asset
  id. Adding those definitions alone does not justify a run- or profile-schema bump.
- A run already carrying `attributeMode`, attributes, a flask capacity ledger, level receipts,
  equipment-profile rules or a `derivedStatRuleSnapshot` keeps those persisted facts. New
  default presets, formulas, flask allocations and level prices are read at new-run creation;
  they do not rewrite an in-progress run on load. Existing definition ids may still receive
  ordinary live content tuning under the content-version rule above.
- If implementation discovers genuinely new persisted state, the field is optional for older
  saves and deterministically migrated (or receives an explicit schema migration) before any
  current save is written. A missing new field may never make an otherwise valid current save
  archive. Prefer existing opcodes/statuses/snapshots so no new persisted field is needed.
- **Run schemaVersion 3** (2026-08-14): `flaskCharges` carries its **capacity ledger** —
  `base` (born), `grown` (possession door), `granted` (moment door) — and
  `validateRunShape` enforces `capacity === base + grown.hp + grown.mana + granted`
  (§5.5.2). A v2 save is admitted and **attributed once** at the load door
  (`initializeRunFlaskCharges`), by a stated rule, never silently: chain growth always
  wrote `grown`, so the surplus base and chain cannot account for is attributed to the
  untracked moment door (`granted`); `base` is witnessed by the current authored
  `balance.flaskCapacity`, clamped so the attribution can invent no charge.

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
   `replacePrimaryWith()` are reachable by the player from **Profile on the title screen**
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
- Upgrades: every non-curse card has exactly one authored upgrade (`name+`), a partial override object on the card def (numbers, cost, keywords — a present `keywords` list replaces the base list, so upgrades can remove Exhaust). Ordinary cards retain a permanent per-copy run upgrade. Equipment-sourced basic cards instead resolve that authored upgrade from their source armament's run-owned Smithing tier, so every current and future copy from the same armament changes together.
- Smithing: a run owns `smithingStones`, an `armamentLevels` map, and idempotent reward claims. The shipped tier cap is 1 and promoting an armament to tier 1 costs 1 Smithing Stone. Elite and boss victories award 1 Stone; normal and treasure reward pools award 0. Legacy equipment-card upgrade flags migrate to the corresponding source armament tier without granting Stones.
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

### 5.1 Classes, creation presets, and levels

**New default creation mode.** Add a new stable mode id, `tuned`, and make it the default for
new runs. Its configurable fixed total is 53 across STR / DEX / CON / WIS / INT; the mode row
owns its total and allocation bounds. This is a new mode, not a mutation or rename of
`standard` or `pointbuy`, because saved runs persist the mode id and both older modes must
continue to validate exactly as authored.

The `tuned` opening presets are contractual and each sums to 53:

| Class | STR / DEX / CON / WIS / INT | Starting HP/Mana flask allocation |
|---|---|---|
| Reaver | `13 / 11 / 11 / 8 / 10` | `3 / 1` |
| Starseer | `11 / 11 / 8 / 13 / 10` | `2 / 2` |
| Herald | `12 / 11 / 8 / 12 / 10` | `3 / 1` |
| Rogue | `11 / 13 / 10 / 9 / 10` | `3 / 1` |

The preset is an editor opening position, not a lock: players may redistribute the fixed
total within the mode's data-authored bounds. Starting derived values come only from the
formulas in §3.5; classes do not carry a second hidden HP/Actions/hand formula.

**Level curve.** A fresh run starts at displayed level 1. A purchase increments the displayed
level by one and grants exactly 1 configurable attribute point by default. Price purchase
`n` (zero-based) as `firstCost + costStep × n`, with `firstCost = 20` and `costStep = 4`
(retuned from 800 / 200 in #522: the fleet simulator measured the shipped ladder at under one
level-up per full run against the owner's 10–20 per run; 20 / 4 measures 14.8 — see
`docs/asks/asks-ledger.md` E13 and `tools/runsim.mjs --level-cost`).
Therefore five purchases cost `20 + 24 + 28 + 32 + 36 = 140` and produce level 6.
The starting level, first cost, step, points per level and any maximum are content data; the
worked level-6 result is a curve receipt, not a second hard-coded total or an implied cap.

**Rogue full parity slice.** Rogue ships as a complete fourth class, not a selectable shell:

- 39 authored Rogue cards, of which exactly 36 are in its ordinary reward pool, all with
  upgrades and validation-clean player text;
- one class signature card and one starter relic, both reachable in a new Rogue run;
- two starting equipment kits and four Rogue outfits/armour sets, including one free baseline
  of each required kind and the same unlock/discovery rules as the existing classes;
- five stage/tint class sprites plus the equipment/body/armament art needed for every authored
  Rogue kit and outfit, with ordinary missing-art refusal/fallback behavior;
- class presets, flask allocation, rewards, draft/custom-run, history, co-op and compendium
  participation derived from the registries rather than new Rogue-only branches.

Rogue mechanics should compose the existing effect, formula, trigger, status, equipment and
resource vocabularies. A new opcode/predicate is allowed only when the approved class identity
cannot be expressed by those primitives, and then it is a separately specified closed-set
extension with validation and engine tests—not imperative per-card code.

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

The Crimson/Azure charge pool's shared capacity is 4 (`balance.flaskCapacity`). Utility
potions remain separate inventory entries sized by `balance.flaskSlots`; increasing one does
not silently increase the other. Utility potions are found from combats, shops and events,
while Crimson/Azure charges refill at every grace (§5.5.1).

**Kind.** Every flask has a `kind` from the closed set `FLASK_KINDS` (`hp`, `mana`, `utility`, `model/schemas.js`). It is **derived, not authored** (`model/gracerefill.js` `flaskKindOf`): `heal` is `hp`, the real `restoreMana` opcode is `mana`, everything else is `utility`, and an explicit `kind:` overrides an ambiguous entry.

#### 5.5.1 The grace refill

The earlier “3 HP and 3 Mana” vessel reading is superseded by the approved shared pool of 4.
It remains history, not a second implementable mode.

**The grace is the Shrine of Emberlight** — this game has no separate `grace` node type and does not invent one.

- **Automatic, on arrival, before the Rest/Smith choice.** A run that comes to smith is refilled exactly like a run that comes to rest. Co-op refills every living member at `enterShrine`.
- **Data driven.** Capacity, each class's starting split and the set of reallocatable charge
  kinds are content rows. Screens read those rows; no screen owns a copied 4, 3/1 or 2/2.
- **A fill, not a grant.** A grace fills the run's currently allocated HP and Mana vessels up
  to their maxima. Re-mounting the shrine is idempotent and can never grow capacity.
- **Free allocation.** At a grace the player may redistribute all 4 capacity between HP and
  Mana at no cinder, action or item cost. Every split whose non-negative integers sum to 4 is
  legal; reallocating is a committed run choice, and current charges are bounded by the new
  per-kind maxima. Utility potions are untouched.
- **Class openings.** Reaver, Herald and Rogue start `3 HP / 1 Mana`; Starseer starts `2 HP /
  2 Mana`. These are presets over the same freely reallocatable pool, not class caps.
- **Configurable in debug settings.** Debug controls edit the same capacity/allocation data
  domain and show its lawful range; they do not author an independent ladder or refill count.
- **Refusals** (`graceRefillRefusals`, run from `validateContent` at boot; corpus
  `node tools/gracerefill.mjs --selftest`): unknown/duplicate kind, malformed capacity or
  allocation, negative/fractional count, a split that does not sum to capacity, dangling or
  wrong-kind override, and any refill that would silently alter utility inventory.
- **Balance boundary:** the old no-Mana simulation is stale. This merged preview is for watching and mechanical validation; a Mana-aware A/B balance run remains a release gate.

#### 5.5.2 The growth chain — how the maximum grows

> Constantine, 2026-08-08 (D17 message 6): *"…those two are locked in with 3 charges, with upgrade options via relics or quest events or talismans or flask seeds to increase the amount of charges"*.

**One chain, data rows, one truth function** (`model/flaskgrowth.js`). `balance.flaskGrowth` is a table of `{ source, id, kind, amount }` rows: holding the named source grows the named kind's maximum by `amount`. Sources are the closed set `FLASK_GROWTH_SOURCES` (`relic`, `questEvent`, `talisman`, `flaskSeed` — his four words, `model/schemas.js`); a fifth source is an engine act, never a row.

- **Derived, so reversible.** `flaskCharges.grown` records what the chain currently contributes; `syncFlaskGrowth` reconciles at every door a source changes through (run birth, run load, the relic-gain sites, the equipment screen). Gaining a source grows the maximum; losing one shrinks it back, currents bounded.
- **Two doors, one grant each.** The chain is the *possession* door. The `addFlaskCapacity` opcode remains the *moment* door (keepsakes, quest-event choice effects). An event granting through both is a boot refusal — one grant may not land twice under two names.
- **The capacity accounts for itself — machine-enforced since run schema v3.** `flaskCharges.capacity` is one stored number fed by both doors, and each door writes its ledger line: the chain in `grown` (per kind, reversible), the moment door in `granted` (a total, permanent — under pool the grant's kind is spent the moment it lands, so only the sum is history). `validateRunShape` refuses, by name, any save where `capacity ≠ base + grown.hp + grown.mana + granted` — so a "cleanup" that re-derives capacity from the chain alone, silently deleting every keepsake charge, goes red on the first save it touches instead of reading green while it wipes them. Corpus: `node tools/flaskgrowth.mjs --selftest` (both doors, observed red first); migration attribution for pre-ledger saves is stated at §3.12.
- **Declared ahead of content, on purpose:** `questEvent` rows validate but report **NOT BINDING** (no run event history exists yet — the moment door is the live mechanism); any `flaskSeed` row refuses at boot (no seed item vocabulary exists; the word is reserved, not invented). `talisman` rows refuse until the first talisman piece is authored, then bind with no code change.
- **The optional hard cap** `balance.flaskGrowthMax` arms an aggregate refusal only when authored — the unlock ceiling is Constantine's number to author (D19's *"future unlocks for larger total amount"*), never invented here.
- **Refusals** (`flaskGrowthRefusals`, run from `validateContent` at boot; corpus `node tools/flaskgrowth.mjs --selftest`): unknown source · non-charge kind · negative, zero or fractional amount · duplicate grant · dangling relic/event/talisman ref · the two-door collision · any seed row · cap malformed or exceeded.
- **THE C1 SEAM — DECIDED: POOL.** Capacity is one freely reallocatable pool; its approved
  new-run default is 4. The older 3-total and 3-each readings are superseded history, not
  alternatives. The binding of a kind-delta into stored capacity stays in `syncFlaskGrowth`
  alone. **The overflow rule is load-bearing**: reallocate a grown charge away, then lose the
  source—removal takes from the row's kind first and overflows to the other, currents bounded;
  gated in the corpus, both edges, observed red first.
- **Live rows ship under D19's parenthesis** (*"future unlocks for larger total amount"*). The rows and their numbers live in `balance.flaskGrowth` alone — read them there or run `node tools/flaskgrowth.mjs`; this spec deliberately does not restate them (a row copied into prose is a number nothing syncs). PROVISIONAL: the M3 balance pass owns the weights. The relic's tooltip sentence is **derived** from its row (`flaskGrowthClause`), so a retune retunes the tooltip. Law 0's falsifier is proven both ways in the corpus: fictional relic + row, zero code, the maximum grows; and the live plant re-derives its expectations from the shipped table itself.

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

**Quest chains (E12, #257).** Every committed choice is a run-history fact (`model/quests.js recordEventChoice`: `{ eventId, choiceId, actNumber, floor, mapNodeId }`, no wall clock). Two gates read those facts, both authored as sidecar data beside the events (`content/events.js`) so the validated event schema stays closed:

- **Choice-level** — `eventChoiceHistoryRequirements[eventId][index]` = `{ all?, any?, none? }` of `{ eventId, choiceId }` refs; `availableEventChoices` hides a choice whose requirement is unmet without reindexing the rest. Leave stays requirement-free so a branch can never trap.
- **Event-level (quest steps)** — `eventHistoryRequirements[eventId]`, the same grammar; `engine/encounters.js resolveUnknownNode` admits a gated event to an Unknown node's pool only once the run's history satisfies it, and never as a repeat fallback. `buildActMap` carries `run.history` to map birth, so an act answers the acts before it; an ungated event behaves exactly as before.

The first chain shipped: **Grave of the Nameless** (step one, ungated) → **The Keeper of the Nameless** (gated on any grave choice but Leave; the digger may repay or fight, the mourner is thanked) → **The Nameless at Rest** (gated on any keeper choice; the vigil, the rest, or a second looting answer the branch taken). `tools/quest-choice-contract.mjs` proves the gates, the ids and the engine door. A quest's named relic reward is authored `pool: 'quest'` (`RELIC_POOLS`, `model/schemas.js`): no generic pool — elite or boss drop, shop stock, an event's random relic — may hand it over first, so the choice that promises it always delivers, and validation refuses a quest-pool relic no event choice grants.

---

## 6. Map generation

Faithful to StS's published algorithm, simplified where invisible to the player. Algorithm lives in `engine/mapgen.js`; every constant below comes from `content/mapconfig.js`:

- Per act: **`floors` × `columns`** grid (shipped: 12 × 7). The **top floor is always a single Shrine** row and the Boss sits above it — typed by the generator before any rule runs, so the floors a rule can reach are **1..`floors`-1**. That band is called the **rollable band** and it is the denominator for every fraction below.
- Generate **6 paths** bottom-to-top: each starts at a random column on floor 1 (first 2 paths must start at distinct columns); each step moves to column −1/0/+1 on the next floor; edges may merge but must not cross (swap targets when a crossing would occur — StS's rule).
- **Every floor a rule names is an ANCHOR, never an index.** An absolute floor number is a constant whose *meaning* moves when `floors` changes while the constant does not — measured: `9: 'treasure'` deletes the treasure rank entirely below 10 floors (**4.00 → 0.00 nodes per act, 24 seeds**), `noEliteOrShrineBefore: 6` (the single gate these two replaced) gated **36 % of a 15-floor act and 56 % of a 10-floor one**, and `15: 'shrine'` **never fired at any shipped act length** because floor 15 is not rollable. The closed set of anchor kinds lives in `model/floorplan.js` and a new kind is an engine change (Law 1):

  | anchor | resolves to |
  |---|---|
  | `{ at: 'first' }` | floor 1 |
  | `{ at: 'last' }` | the last rollable floor (`floors`-1) |
  | `{ at: 'floor', index: n }` | `n` — **an error** if outside 1..`floors`-1 |
  | `{ at: 'fraction', of: f }` | `round(f × rollable)`, `f` ∈ (0, 1] |

  `resolveFloorPlan()` is the **only** place an anchor becomes a floor; the generator, the boot validator and `tools/mapplan.mjs` all read that one resolution, so they cannot disagree about what a rule meant. An anchor that will not resolve is a **boot error naming the entry** (Law 1 clause 5) and `mapgen` throws rather than generating an unauthored map.
- **Node typing** (StS proportions): fixed ranks — Monster at `{ at: 'first' }`, Treasure at `{ at: 'fraction', of: 0.64 }` (floor 7 of 11 at the shipped shape). Remaining nodes rolled: Monster 45 %, Event(?) 22 %, Elite 8 %, Shrine 12 %, Merchant 5 %, remainder Monster; with constraints: no Shrine before `noShrineBefore` (`{ at: 'fraction', of: 0.27 }` → floor 3), no Elite before `noEliteBefore` (`{ at: 'fraction', of: 0.43 }` → floor 5), no Shrine on `noShrineOn` (`{ at: 'last' }` → floor 11), no two identical non-Monster types adjacent along an edge, **`minElites` ≥ 2 and `minMerchants` ≥ 1 per act** (regenerate typing if violated, map RNG stream, bounded retries → relax weakest constraint).
- **`restBeforeElite`: a map that holds an Elite holds a Shrine on some EARLIER floor.** E13 — Constantine asked for a rest "so eletes, maybe shop, and definitely before a boss"; before-a-boss the top-floor Shrine always kept, before-elites nothing did (**124 of 180 maps over the canonical seed stream carried an Elite with no Shrine below it**; 0 of 180 now). It is why the gate is TWO anchors and not one: a single `noEliteOrShrineBefore` opened rests and Elites on the same floor, so a rest could never sit below the first Elite, and the schema now REJECTS that key rather than reading it as both. Kept the way the counts are kept — the roll is barred, and the relax path opens the rest before it places any Elite, on one of the floors `resolveFloorPlan` certified at boot (it refuses when the act's own other rules leave none free). Two things it does not claim: it is a fact about the GRAPH, not a path — a walker may still route past the rest to an Elite, and `tools/mapplan.mjs` measures how often rather than this line promising otherwise — and it moved the shortest act these rules describe from 4 floors to 7, which narrows the debug run-shape cap.
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
Cold Boot ──► Startup Gate ──► Title ──► Class Select (+ seed entry) ──► Map ──► [Combat | Shrine | Shop | Event | Treasure]
                              │                                        ▲              │
                              └── Continue (if save exists)            └──────────────┘ (reward screens between)
Death/Victory ──► run summary (seed, floor, runes, kills, deck) ──► Title
```

Screen router in `main.js`; each screen module exports `mount(state, dispatch)` / `unmount()`. **Arriving at a Shrine refills flasks automatically before the Rest/Smith choice is offered** (§5.5.1); the screen reports what it was handed and what the slots could not hold, and is silent when there is nothing to say.

Cold boot mounts the `startup-gate` component before the Title DOM exists. It contains only the
Ashen Spire wordmark, decorative ash/embers, the input-family prompt, and the shared BUILD/source
stamp. Click/tap, Enter, Space, controller A/Cross, and controller Start/Menu are consumed by the
gate and reveal Title exactly once; that physical press cannot activate a Title control. Prompt
copy follows the most recent pointer, touch, keyboard, or controller family. Profile quarantine
and recovery notices outrank the gate. After reveal, focus lands on Title's first available save
slot action, and every later return to Title in that boot bypasses the gate. Reduced-motion mode
keeps the same state and focus contract without meaningful animation.

### 7.2 Shared run HUD and combat layout (1280×720 reference)

- **.NET-inspired application and Component Model contract.** Architecture follows Clean
  Architecture with an MVVM-shaped presentation layer. Domain Models own pure game state and rules;
  Application Interfaces define ports; Application Services orchestrate use cases; Infrastructure
  implements browser storage, audio, network, and other platform adapters; Presentation Models are
  immutable contracts analogous to C# records; Presentation ViewModels project domain snapshots
  into screen/card compositions and named commands; Views are thin full-screen hosts; Components
  are reusable renderers; Behaviors bind interactions and lifecycle; and `main.js` trends toward a
  composition root. The existing paths migrate incrementally: `src/model/` is Domain,
  `src/ui/models/` and `src/ui/viewModels/` are Presentation models and projections,
  `src/ui/screens/` is Views, and `src/ui/components/` plus `src/ui/behaviors/` are reusable
  presentation implementation. Every reusable UI component receives an immutable Component
  Model that names its semantic component id and variant, owns only serializable presentation
  properties, declares named behaviors, and recursively composes child Component Models. Screen
  ViewModels compose those records; renderers translate them to DOM, and behavior adapters connect
  declared commands to callbacks. Shared primitives such as panels, metadata fields, meters, trays,
  slots, action controls, and hotkey badges are composed rather than redefined. Component Models
  never own mutable simulation state or import engine rules: ViewModels project current domain state
  into model properties. A migrated surface has one ViewModel composition and one renderer, never a
  model path beside a hand-written fallback.
- **Shared Presentation primitives.** The public primitive Component Model ids are `panel`,
  `component-background`, `metadata-field`, `action-control`, `hotkey-badge`, `item-tray`,
  `item-slot`, `folding-tray`, `tray-header`, `tray-resize-handle`, `tray-content`, and `tooltip`. Specialized
  models compose these primitives and may add semantic variants; they do not clone their record
  shape, accessibility contract, token ownership, or behavior vocabulary.
- **Reusable component contract.** UI pieces are referenced by stable semantic ids rather than
  screen-specific markup. The shared composition is `shared-run-hud`, containing
  `run-header-strip`, `primary-hud-row`, `inventory-belt`, `hud-quick-settings`, and
  `hud-mode-grip`. The grip remembers either the Expanded HUD or the 132px Razor Strip.
  Its reusable children are
  `identity-cluster`, `portrait-badge`, `character-title`, `cinders-counter`,
  `build-metadata-trail`, `vitals-panel`, `resource-meter`, `quick-access-panel`,
  `armoury-control`, `quick-menu-control`, `fullscreen-control`, `music-control`,
  `crimson-flask-control`, `azure-flask-control`,
  `relic-tray`, and `potion-tray`. Combat additionally composes `battlefield-stage`,
  `combatant-frame` (`player-combatant-frame` or `enemy-combatant-frame`),
  `player-hand-tray`, and `combat-action-rail`. A component owns structure and accessibility;
  its screen supplies state and callbacks. UI components never own simulation state.
  `act-route-strip` is a Map-only sibling below `shared-run-hud`, never one of its children and
  never mounted by Combat. On narrow Map layouts it occupies about 80% of the viewport while
  reserving the HUD utility-control gutter on the right.
  `hud-quick-settings` is shared by Title, Map, and Combat. It anchors beneath the top-right
  HUD edge as a vertical pair, exposes live positive-state Fullscreen and Music controls,
  persists Music through the profile settings service, and reads Fullscreen from the browser
  instead of storing a duplicate flag. On narrow screens it keeps the same composition but
  presents 44px square glyph controls so enemy intent remains unobscured. Browsers without a
  fullscreen API expose the Fullscreen control as unavailable rather than drawing a dead switch.
- **Startup Gate Component Model.** `startup-gate` is a boot-scoped presentation component, not a
  variant of the Title screen. Its immutable model supplies wordmark copy, input-family prompts,
  deterministic decorative-particle records, accessibility metadata, and the named reveal
  behavior. Its renderer owns layout and temporary event binding, consumes the one first-input
  owner supplied by the composition root, and uses the shared build-stamp renderer. It never
  imports simulation state, persists dismissal, or mounts Title controls behind itself.
  The gate composes `startup-ash-field` → `startup-ash-particle` and `startup-mark` →
  `startup-wordmark`, `startup-subtitle`, `startup-divider`, and `startup-prompt`. The mark's
  phone backing is transparent; the content remains centered and opaque.
- **Title Menu components.** The revealed Title composes `title-brand-lockup` from
  `title-wordmark`, `title-subtitle`, and `title-divider`; `title-menu` from six
  `title-menu-item` controls, each with a `title-menu-gem`; and the independent
  `title-tagline`. Load and New reuse one `title-menu-modal`, composed from
  `title-modal-close-control`, `title-modal-heading`, `title-modal-divider`,
  `title-save-slot-list`, and `title-modal-actions`. Each `title-save-slot` supplies
  `title-save-slot-copy` and `title-save-slot-state`, plus `title-save-slot-delete` only when
  occupied; the action group supplies `title-modal-back-control` and
  `title-modal-continue-control`. The DOM-free `saveSlotSelectionModel` projects Load and New
  from the same immutable slot records and Behavior Models: selected styling, `aria-pressed`,
  the selected-focus restoration target, primary-action availability, and the load/create
  command payload all resolve to one slot. Save data and callbacks remain screen inputs rather
  than being owned by these presentation components.
- **Character Creation components.** The reusable creation family is `character-disclosure`,
  `class-preview-pane`, `class-resource-grid`, `class-choice-card`, `view-mode-toggle`,
  `boolean-setting-toggle`, `selection-section-face`, `primary-stat-card`, `stat-allocation-row`, `resource-strip`,
  `mode-choice`, `sprite-choice`, `tint-choice`, `sigil-choice`, `keepsake-choice`,
  `equipment-choice-card`, and `relic-choice-card`. `class-preview-pane` composes
  `class-resource-grid`; `character-disclosure` composes the stat, appearance, and keepsake
  choices. `primary-stat-card` is one shared attribute model and disclosure renderer across
  Character Creation, Shrine point assignment, and the Armoury: its folded face carries the
  short label, one-line summary, and current value; its reveal and focus/hover tooltip carry the
  authored description plus benefits derived from stat rules and equipment gates. Art and copy
  arrive through content/asset inputs, while screens own mutable selection state and callbacks.
  In Assign Points surfaces, `stat-allocation-row` is the invisible composition parent for the
  attribute face, current value, decrement/increment controls, and a reveal that spans the whole
  row instead of inheriting the face column width.
- **Shrine components.** `shrine-option-card` is the shared folded option footprint for Rest,
  Smith, Flask Allocation, and Level Up. Its viewport-relative width and height are data-owned by
  `balance.ui.shrinePresentation`; expanding a disclosure adds its content below the uniform face.
  Smith opens the dedicated `smith-upgrade-modal`, composed from
  `smith-candidate-card` and `smith-upgrade-preview`. Each candidate is one distinct owned
  armament below the run's tier cap, never an individual deck copy. Choosing a candidate is a
  presentation-only operation that shows its current and next tier, cost, Stone purse,
  shortfall, and every grouped sourced-basic-card delta. `Back to Shrine` and Escape close the
  modal without changing the run; only an affordable enabled `Confirm` spends the shown cost,
  promotes the selected armament, updates all of its sourced basic cards, and leaves the Shrine.
  The DOM-free `SmithSelectionModel` owns the choose/review state and player-facing consequence
  copy.
- **Combatant Component Model.** `combatant-frame` may compose `component-background`,
  `combatant-sprite`, `combatant-nameplate`, `intent-indicator`, `block-badge`,
  `health-status-bar`, `poise-status-bar`, `proc-status-bar`, `arcane-exposure-bar`, and
  `status-effect-tray`. Combat hit feedback is `damage-feedback`, with distinct
  `guarded-damage-indicator` and `health-damage-indicator` channels so absorbed Guard and
  residual HP loss cannot be visually conflated. These are independently referenceable
  components; the catalog may expand other components later without declaring them leaves.
- **Menu and Armoury Component Models.** The contextual launcher is `quick-menu-panel`,
  composed from `quick-menu-caption` and `quick-menu-row`; the full in-run menu is
  `menu-overlay`, composed from `menu-tab-strip`, `menu-tab`, `menu-panel`, and `menu-footer`;
  the footer composes `save-game-control` and `save-quit-control`. Potentially destructive
  Load and Quit Without Saving commands enter one shared `confirmation-modal`, whose
  `confirmation-action` is the only commit door. It is an `alertdialog` for danger variants,
  focuses the neutral `confirmation-cancel-control` Back action first, traps Tab, and lets Escape, Back, or the scrim cancel
  without mutation and restore the invoking control. When it is stacked over the in-run menu,
  one Escape removes only the top confirmation. After a commit, the service retains an empty
  top-layer input shield for the bounded navigation activation window (600 ms by default) so a
  physical second click cannot activate a newly rendered Title control or combatant beneath the
  removed action; the shield releases after the destination paint settles. Danger borders retain
  the blood/ember palette, while confirmation action and eyebrow text use the authored parchment
  token and must measure at least 4.5:1 against their computed backgrounds. The equipment
  family is `armoury-overlay` → `armoury-panel`, with `armoury-header`,
  `armoury-view-switcher`, `armoury-body`, `armoury-figure`, `equipment-slot`,
  `equipment-set-cell`, `armoury-inventory`, `inventory-item-card`, `inventory-detail-card`,
  `equipment-comparison`, `armoury-stats-panel`, `armoury-card-strip`, and
  `armoury-region-header`. These public Component Model ids remain stable; Armaments is a
  configured `folding-tray` instance, not a second public primitive or a parallel equipment
  implementation. The persisted view ids also remain `grid`, `rack`, and `hybrid` for save and
  content compatibility, while their player-facing labels are respectively **Character**,
  **Inventory**, and **Hybrid**. The equipment subject retains the compatibility region id
  `slots`; the visible tray instance is `armaments`.

  The three Armoury views are projections of the same loadout, not separate stores or screens:

  - **Character** (`grid`) is character-only and fills the available body width. It uses two
    columns: identity, class/level text, and the responsive character sprite on the left; Combat
    Power, Attributes, and Relics on the right. It does not mount an Armaments, Inventory, or
    Stats tray.
  - **Inventory** (`rack`) is the full-width equipment workspace. Armaments occupies the left
    pane and exactly one shared Inventory occupies the right pane; their resizable divider uses
    the authored ratios and snap stops. Stats is available as a context tray. There is never a
    second, hand-specific Inventory below Armaments.
  - **Hybrid** (`hybrid`) uses the authored compact Character/Armaments split, with its own
    resizable and snapping divider. Inventory and Cards remain available as compact context
    trays below; the separate Stats tray is not part of this view.

  Armaments, Inventory, Cards, and Stats all use the shared `folding-tray` → `tray-header` +
  optional expanded-only `tray-resize-handle` + `tray-content` grammar. Their stable tray instance
  ids are `armaments`, `inventory`, `cards`, and `stats`. The `trayModel` factory owns the edge,
  expanded state, count/summary semantics, resize capability, and optional list/grid sort intent;
  `renderTray` owns the uniform DOM and accessibility grammar. Sort controls appear only while
  their tray is expanded. Closed arrows point inward and open arrows point back to the anchored
  edge, including the open Right Tray form `> TRAY NAME`. A tray that declares the optional resize
  capability exposes a 44px mouse, touch-hold, and keyboard surface: Top/Bottom resize vertically
  and Left/Right resize horizontally. Size is remembered in memory by stable tray id and edge for
  the current play session only; folding always returns to the standard bar or rail, reopening
  restores the last expanded size, and starting/resuming a run or returning to Title resets the
  authored default. Armoury supporting trays open at 45vh, retain at least 30vh when another tray
  is expanded, and snap at every 10vh stop from 30vh through 90vh. The generic component may hug
  content before its first resize, while Armoury supporting trays intentionally apply the
  configured default ratio immediately. Armaments
  is non-resizable, and Inventory disables height resizing while it fills the Inventory-view pane.
  Bottom trays remain bottom-anchored and grow upward.

  Equipment positions are procedural content. `content/source/equipSlots.csv` supplies each slot
  id, label, position label/code, accepted kinds, physical hand/socket, set capacity, swap rule,
  storage behavior, and order; `content/source/unlocks.csv` supplies any additional position rungs;
  and `armouryUi.layout.equipment.slotOrder` supplies preferred group order without defining the
  set of slots. The Armoury iterates every authored position in vertical list or configured grid
  form and renders its locked, empty, or occupied state. Adding an authored position or slot group
  must not require a branch in the screen. Item kind determines eligibility only: the selected
  hand equipment position owns the character-sprite socket, so placing a shield in a right-hand
  position renders it in the right hand and placing a sword in a left-hand position renders it in
  the left hand. The current figure composer supports armour/body plus authored left/right-hand
  layers; a future foot, back, or other visible attachment also requires an explicit asset-composer
  and configuration extension rather than an inferred screen coordinate.

  Inventory owns one logical item-card action surface in both folded and expanded forms. The
  `armouryUi.layout.cardClasses.inventoryItem.holdAction` class capability opts action-capable
  `inventory-item-card` and `inventory-detail-card` models into the shared `equipInventory`
  action. When the universal hold-confirm setting has a positive duration, the whole folded face
  and whole expanded reveal use the same `armHold` timing, progress fill, keyboard/gamepad path,
  and mutation callback; an early release aborts, and pointer movement beyond
  `HOLD_POINTER_SLOP` aborts the hold so scrolling or dragging can take ownership. A completed
  hold commits once. When hold-confirm is off, ordinary immediate-action and disclosure behavior
  remains. Selecting an equipment position opens this same Inventory, filters it to compatible
  items, exposes the contextual Equip/Move/Unequip action, and accepts either that selection or a
  drag to the selected position; a successful replacement clears the selection and folds the
  Inventory back to its default state.

  Equipment comparison is information, not confirmation. The data-owned
  `armouryUi.layout.comparison.presentation` is `tooltip` or `inline`. Tooltip mode presents the
  full comparison after the configured `hoverDelayMs` on pointer hover, or after the shared focus
  delay on keyboard/gamepad focus, above its card when space permits, using `tooltipWidthRem` and `tooltipMaxHeightRatio` to remain readable and
  viewport-safe; inline mode embeds the same information in the expanded card. Comparison must
  not borrow the action's hold gesture: an action-owning card holds to equip or unequip, while
  hover/focus remains the comparison path. The primary combat-power term shown to players is
  **Magic**. The existing combat-card id `potency` and role `technique` remain compatibility keys;
  **Potency** means a modifier to Magic damage, never the primary Magic value or its visible label.

  Equipment receipts are read models, never re-derived in a screen: the equipment receipt panel
  (`.armoury-equipment-receipts`, mounted in the Character view's Equipment cards card and in the
  Stats tray) renders the exact equipment card packages, the equip requirements, the Poise
  threshold (`.player-poise-receipt`) and the **Equip load** (`.player-load-receipt`,
  `model/statProjection.playerLoadReceipt`): load / capacity, percent, and the Weight Class word
  decided by the framework Weight Class service (`registries.framework.weightClass`, capacity from
  Constitution and Strength plus `mechanics.weight.capacityBase`). Load counts each equipped
  armament's authored `weight`; armour weighs its `poiseThreshold` (`ARMOUR_WEIGHT_RULE`), and the
  item card's Weight label reads the same `pieceWeight` rule, so item and total agree by
  construction.

  These ids and keys describe the existing data-driven Quick Menu and Armoury structures. Menu
  records are constructed in `MenuModels.js` and rendered by `menuComponents.js`; Armoury records
  are constructed in `ArmouryModels.js` and rendered by `armouryComponents.js`. Screen hosts bind
  commands and lifecycle callbacks, while presentation models remain immutable, serializable,
  and DOM-free.
- **One shared HUD composition on Map and Combat.** The one-row `run-header-strip` contains
  character identity left, Cinders truly centred, and Act/Floor/Build/Seed/Source right.
  The center Cinders track and right metadata trail are each capped at 30% of the
  viewport by data-owned settings; the three tracks negotiate rather than overlap.
  Those five metadata items share one data-owned font size, one horizontal baseline, and one
  vertically centred row; no item may stagger above or below another. When width is insufficient,
  the right trail progressively hides Source, then Seed, then Build; Act and Floor remain visible
  longest. `metadataShowTotals` defaults to false, so Act/Floor show current values (`ACT 1 · FLOOR 1`)
  rather than totals; enabling it is a data-only setting. At the smallest supported width, the
  right trail progressively hides Source, then Seed, then Build before it may touch centred Cinders. There is no duplicate Act/Floor
  line beneath the character name. Neither screen hand-writes a second HUD.
- **Primary and inventory geometry.** `vitals-panel` is one outer card containing the unchanged
  HP/MP/SP stack. `quick-access-panel` is one outer square containing a 2×2 grid: Armoury/Menu,
  then HP/Mana flasks. Its visible tiles are 30–32 px inside at least 44 px accessible hit areas.
  The two panels have equal outer height and the flask row aligns with the bottom of SP within
  one CSS pixel. `inventory-belt` places Relics beneath Vitals and utility Potions beneath Quick
  Access on the same row. Utility potions form one right-anchored horizontal tray that grows or
  scrolls left. Relic and Potion trays share one vertically centred baseline and one data-owned
  narrow item gap (default 2 px); utility potion tiles remain the same size as relic tiles.
  The Vitals and Quick Access component-panel background opacity is data-owned and defaults to
  0%. The Vitals shell and its resource-card frames have no visible border or background at the
  default; the resource troughs and labels remain visible and their invisible reference frames do
  not visually size the panel. Refillable HP/Mana
  flasks are controls, not utility potions. The map's `− ⊙ + ?` controls remain the board's
  separate lower control group. Utility potion tiles are packed from the Quick Access right edge
  toward the left, so the tray's visible right edge is flush with that panel.
- **Responsive combat composition.** `battlefield-stage` vertically centres player and enemy
  combatant frames at every supported shape rather than bottom-aligning them. Narrow layouts keep
  larger, accessible player cards in the horizontal `player-hand-tray` without colliding with the
  combatants or `combat-action-rail`. The shared HUD and combat composition are verified at
  1440×860, 1200×730, 844×390, 390×844, and 320×640.
- **Resource-bar length is data-scaled, not a cap.** The default reference maxima are HP 200,
  MP 20, SP 20. A bar's fill remains `current / maximum`; its visual length compares that
  maximum with the data-owned reference and obeys the shared viewport cap. A character may
  exceed a reference—it lengthens only to the layout cap and never clamps gameplay state.
- **Enemy row (upper right 60%):** up to 5 enemies; each shows sprite/placeholder, name, HP bar, **Poise meter** (thin amber bar under HP), **Bleed meter** (thin red bar, only when >0), status icon row, and **intent icon + number above the head**.
- **Player zone (lower left):** stance icon, status row, Block shield badge overlapping HP.
- **Hand:** bottom center, fanned, max 10; hover raises card ×1.5 with full text.
- **Energy orb:** bottom left, `n/3`. **End Turn** button bottom right — pulses if energy remains and any card is playable; confirm-free.
- **Piles:** draw (bottom-left corner, count) / discard (bottom-right, count) / exhaust (small, appears once non-empty). Click opens a scrollable modal grid (draw pile view is order-shuffled for display, like StS).

### 7.3 Input

- **Both** targeting modes: (a) drag card onto a target/board, (b) click card → targeting arrow → click target. Esc/right-click cancels. Non-targeted cards: drag anywhere above the hand or click-then-click the board.
- Full playability with mouse only. Keyboard shortcuts (nice-to-have, M4): 1–9 select card, E end turn.
- **Controls rebind capture owns its armed keydown.** `rebind-capture-service`
  ignores lone modifiers. Escape cancels an armed keyboard capture, restores the
  `controls-key-rebind-control` from Press… to Key with focus intact, performs
  no binding mutation, and suppresses the same event before the covered menu can
  close. With no capture armed, Escape retains its ordinary one-layer Back
  behavior. A later re-arm accepts a free key; occupied-key conflict resolution
  is a separate policy and is not implied by this contract. The containing
  `controls-rebind-capture` is the stable Controls component surface.
- Ordinary interactive elements expose their concise tooltip within 150 ms of
  hover: cards (with nested keyword tooltips), statuses (name, current math),
  intents (exact damage after modifiers), relics, flasks, and map nodes.
  Deliberate reading surfaces may author a longer validated delay; the Armoury
  equipment-comparison tooltip currently uses `armouryUi.layout.comparison.hoverDelayMs`
  (`550` ms) and remains immediately reachable through keyboard/gamepad focus.

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
Build: Reaver, Starseer, Herald and the full-parity Rogue slice (§5.1), Acts 2–3 (rosters, elites, 2 bosses incl. phase mechanics and the heal-on-hit final boss), events to 10, relics to 40, colorless pool, balance pass (target: experienced-player win rate ~35–50% at v1 tuning; instrument run history to check).
**Accept when:** all 4 classes can complete 3-act runs; every class owns its complete card/equipment/art slice; every card/relic/event is reachable; no unbeatable-by-construction encounters (elite HP vs. average deck DPS sanity table included in the balance notes); `scripts.js` budget still < 5%.

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
