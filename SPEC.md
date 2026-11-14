# Ashen Spire — Detailed Specification

Single-player browser roguelike deckbuilder, mechanically faithful to Slay the Spire, thematically inspired by (legally distinct from) Elden Ring. Companions: `DEVELOPER.md`, `CREDITS.md`.

- Numbers are **initial balance targets** (M3 pass may move them); structures (formulas, orderings, state shapes) are contractual.
- Two contracts supersede conflicting older prose:
  - [STANCE-COMBAT-RULES](docs/STANCE-COMBAT-RULES.md) (planned) supersedes conflicting older prose in this specification and its combat contracts: revised stance discounts, active ratings and entry grants, Defense restoration, maneuver matchups, Evade, hit previews, HUD/floaters.
    - Unrelated WardToBlock and reaction rules stay in force.
    - Implemented in a separate PR (CONTRIBUTING ground rule 1).
  - [combat-clarity-2026-10-20](docs/design/combat-clarity-2026-10-20.md) supersedes conflicting earlier rules for: Precision, reaction costs, per-hit Counters, combat feedback, progression presentation. Implementation tracked separately.

> **Known debt: vocabulary.** Largely pre-scrub names: runes/Vagabond/Astrologer/Prophet/Erdtree
> = cinders/Reaver/Starseer/Herald/Goldbough as shipped.
> - [docs/IP-SCRUB.md](docs/IP-SCRUB.md) is the authoritative old→new map; every name in it is a shipped fact.
> - No broad rename (owner, 2026-09-27); read historical prose through that map rather than sweeping it piecemeal.
> - When an audited section describes current shipped definitions, it uses the canonical names consistently throughout that section and records the reconciliation in its audit.
> - Old-name count: `grep -cE "runes|Vagabond|Astrologer|Prophet|Erdtree|Scarlet Rot" SPEC.md`.

### Scope status

**planned** = contract written before its code (CONTRIBUTING rule 1). **built** = features ship; "Left to do" is not exhaustive; a gap found later is a correction to this table, not a contradiction of it. Verdicts for §12, §14–§15: [docs/SPEC-RECONCILE.md](docs/SPEC-RECONCILE.md); release criteria: [docs/FINISH.md](docs/FINISH.md). Update a row in the PR that changes it.

| § | Area | Status | Left to do |
|---|---|---|---|
| top | Combat and equipment revision | **partly built** | Full framework cutover not performed; three-build prototype gate and 36→50 class pools post-1.0 (D3). |
| 1 | Product overview | **built** | — |
| 2 | Legal and asset constraints | **partly built** | §2.4 asset indirection: `styles/` `url('../assets/…)` references still bypass `assetUrl()`. |
| 3 | Architecture, DSLs, procedural systems, saves, validation | **built** | — |
| 4 | Combat rules | **built** | Ashen Blight stays a separate proposal. |
| 5 | Content | **built** | — |
| 6 | Map generation | **built** | — |
| 7 | UI/UX, HUD, input, feedback, visual style | **partly built** | §7.5 Cinzel/Inter **TO BUILD** (system fallbacks; later pack files, EXTERNAL-ASSETS-PLAN step 3b; only "AS Lore" copies ship). Release proofs: contrast, reduced motion, target size, Back-everywhere (FINISH §5–§9). |
| 8 | Testing | **built** | — |
| 9 | Milestones M1–M4 | M1, M2 **built**; M3, M4 **partly built** | M3: 7 cards unreachable (`tools/contentreach.mjs`), no balance gate (D1). M4: feel, performance, asset-pass items (FINISH §5, §7, §10). |
| 10 | Forward hooks | **seams built**, features **planned** | v1 keeps them empty by design. |
| 11 | Non-goals | — | — |
| 12 | Expansion (dodge, trader arts, HUD piles, branching bosses, roster, animation) | **built**, two items open | P6: 1–5 elites per seat averaging 3 (3 ship, one per seat). P8b: Power resting stance (`resolveCombatPose` returns `idle`). |
| 13 | Seats, zones, skill tracks, class card and tree, levels, recovery, Mana, attributes, quest board | **partly built** | Plan phases 1–10 of [plan-progression-and-property-system](docs/plan-progression-and-property-system.md); phase 2 only as 2a (2b, relic passives as property rules, unscheduled). Open: smithing re-point (4b-ii, §13.4e); tree screen (§13.4g); four ability-card sentences approximated (§13.4f); quest XP unpaid (§13.4n). **Post-1.0** (owner, 2026-09-27): 3b-ii (equipment rows join deck), class-swap boss-reward door (§13.4h), quest XP. Tower, city, later seat phases **planned**, no SPEC section; companions owned by §14.3. |
| — | World Journey, shared armour sets, legacy dungeons, opening prologue, configurable stat pools | **built**, one boundary | Stat-pool rules apply to the solo path only; the combat workshop path keeps its rules until given a rating context. |
| 14 | Deck editor and the three shops | **partly built** (steps 1–7 of 7 on `dev`) | FINISH §2 "Deck editor between runs" unticked (390×844 card move by mouse, touch, gamepad). |
| 13.4p–r | One break meter, class mastery, progression budgets | §13.4p, §13.4q **built**; §13.4r **partly built** | §13.4r: modular rewards, ability grades, class respec, XP presentation not re-checked. |
| 15 | Reward schedule, levelling pace, crafting drops, legendary sigils | **built** (steps 1–5 of 5) | — |

### Combat and equipment revision: implementation contract

Normative: [Combat and equipment rules](docs/COMBAT-EQUIPMENT-RULES.md) — categorized tags, typed damage and defenses, weapon impact, deterministic Evade, trigger/stacking semantics, the three-build prototype gate, accepted stance, grip, affinity, armor, rune, loot and empty-hand creation work.

- Not a claim the mechanics ship; existing runs keep their supported ruleset until an explicit migration.
- For the new ruleset the contract supersedes the conflicting parts of:
  - §3.3–3.7 (schemas/effects/triggers), §3.8 (equipment and rewards), §3.12 (saves)
  - §4.1–4.5 (combat), §5.1–5.4 (content), §6 (reward generation), §7.4 (stance animation)
  - Those sections describe legacy behavior during migration.
- New code must not silently combine legacy dodge, idle-only recovery, armor-weight coupling, or card-only poise with the replacement rules.
- **Scope for 1.0 (D3):** the prototype gate and the class reward-pool expansion 36→50 are **post-1.0** and stay the contract for later.
  - 1.0 ships the 36-card pools of §5.1 and does not wait on the gate.

#### Notes and history

- The scope table is project status, not rules; its evidence is archived.

Full history: [docs/spec-history/01-overview-legal.md](docs/spec-history/01-overview-legal.md).

---

## 1. Product overview

A run: pick 1 of 4 classes → traverse a branching map across 3 acts → fight monsters/elites/bosses, visit shrines/merchants/events → build a deck from the class's 36-card reward pool + colorless cards → win by defeating the Act 3 boss, or die and see "YOU PERISHED" with seed and stats.

| | |
|---|---|
| Title | **Ashen Spire** (`AshenSpire` bundle name; page title `index.html:8`; title screen `src/ui/screens/title.js`) |
| Platform | Modern evergreen browsers. 1280×800 is the **layout reference** (§7.2), not a minimum; a narrow layout ships, selected once by `main.js` writing `data-layout` (§11). |
| Tech | Vanilla ES-module JS, HTML, CSS. No framework, no build step. |
| Persistence | `localStorage`: three run slots plus a **durable profile** (settings, unlocks, progress, last 20 results) with a verified-write mirror and a keyed archive drawer, opened from **Profile on the title screen** (§3.12). |
| Entry point | `index.html` via `node tools/serve.mjs` (serves media). Any static server still boots and plays; after EXTERNAL-ASSETS-PLAN step 13 (media moves to the art repository) such a page has placeholders (§2.4), synthesized audio, system fonts, low-detail map. Only the built file opens by double-click (`file://` cannot load ES modules). |
| Session length | Run ≈ 45–90 min; combat ≈ 2–5 min. |

#### Notes and history

- No rules moved out of §1.

Full history: [docs/spec-history/01-overview-legal.md](docs/spec-history/01-overview-legal.md).

---

## 2. Legal and asset constraints

These override everything else in the spec.

1. **No FromSoftware assets or names**: no ripped sprites, music, logos, or exact proper nouns (no "Godrick", "Margit", "Malenia", "Limgrave"). Generic fantasy terms ("runes", "grace", "flask") are fine.
2. Every shipped asset is in `CREDITS.md` with source URL and license. Allowed: CC0, CC-BY (with attribution), OFL (fonts).
3. Planned sources:
   - **game-icons.net** (CC BY 3.0): card art, relic, status, intent icons (primary; ~4000 icons).
   - **Kenney.nl** (CC0): UI nine-slices, buttons, panel borders.
   - **OpenGameArt.org** (CC0/CC-BY only): combat backgrounds, enemy portraits if suitable ones exist.
   - **Google Fonts** (OFL): display serif (e.g. *Cinzel*) + body sans (e.g. *Inter*).
4. Every image is referenced through `src/ui/assets.js` (id → URL/inline-SVG map); game code never hardcodes an asset path.
   - **Not yet true until §2.4 lands:** CSS backdrops in `styles/` and several UI modules (e.g. `src/ui/components/scenePainting.js`, `src/ui/components/engravedIcon.js`, `src/ui/cardArtwork.js`, `src/ui/defaultCardArtwork.js`) still build `assets/…` paths directly.
   - Missing art falls back to a generated placeholder (colored rounded rect + icon glyph + name), so the game is fully playable with zero downloaded assets.
5. Third-party **code** only if MIT/BSD/Apache/CC0, in `src/vendor/`, attributed in `CREDITS.md`. Expected: none beyond possibly a PRNG snippet (mulberry32, public domain).

### 2.1 The AI-use acknowledgement — one home, two surfaces

The game was built by AI under human direction and says so. The text has exactly one home, `src/content/aiDisclosure.js`; nothing retypes it. Two surfaces render it:

- **In-product:** Settings → **About** (`src/ui/screens/about.js`).
- **Store:** `node tools/ai-disclosure.mjs` prints the identical string for Steam's AI-disclosure field; paste that output, not a paraphrase.

Rules:
- `node tools/ai-disclosure.mjs --check` fails when a shipped bundle has drifted from the module.
- The load-bearing runtime claim (*no AI runs while you play*) is a single named string given to both the player and the falsifier.
- The approval flag lives in `src/content/aiDisclosure.js`; this spec does not restate its value (read it there or run the tool).
  - It records whose words the wording is; nothing reads it to decide whether to render, since the acknowledgement always shows.
  - Approval is a release gate (§9), not a display condition.
  - The flag is about THIS wording: any edit to the text returns it to `false` in the same act.
- *Falsify:* `node tools/ai-disclosure.mjs --check` after the last bundle rebuild. The runtime claim's two-command falsifier is in the module beside the sentence.

#### Notes and history

- `docs/SPEC-RECONCILE.md` holds a prose copy of the approval flag that will go stale when the flag moves.

Full history: [docs/spec-history/01-overview-legal.md](docs/spec-history/01-overview-legal.md).

---

## 3. Architecture — data- and model-driven, procedural where it counts

Four layers, one-way dependencies. The engine knows only a closed set of primitives (opcodes, formula ops, triggers, a generic status model); all game content and tuning is validated data. Randomness is seeded and saved.

### 3.1 Layers and design laws

Dependencies point downward only: UI (`src/ui`: renders model state, dispatches player intents) → Systems (`src/engine`: generic interpreters + seeded procedural generators) → Model (`src/model`: schemas, registries, formulas, state, validation) → Content (`src/content`: pure data packs).

Design laws (contractual):

1. **Schema-first.** Every entity type has a schema in `model/schemas.js`. Content is validated at boot (dev mode) and in tests; unknown fields, bad enums and dangling ids fail loudly (§3.14).
2. **No entity-specific engine code.** No `if (status === 'bleed')`. The engine implements closed primitives: opcodes (§3.4), formula ops (§3.5), trigger events + predicates (§3.6), a generic status model (§3.7). All behavior is content data composing them.
3. **Procedural content stays procedural.** Map generation, encounter and reward rolls, and enemy move selection are seeded algorithms (§3.8); every knob they consume is content data.
4. **All tuning is data.** `src/content/balance.js` holds every global constant that is not a stat row (reward odds, cinder ranges, prices, flask drop decay); every stat is a row of `src/content/derivedStats.js` (§3.5). A balance change is a one-file data diff.
5. **Headless engine.** Nothing under `src/engine/` references `document`, `window`, `localStorage` or timers. Under `src/model/` only `offlineDownload.js` sets timers (request timeouts). A combat runs to completion from `tests/index.html` with no DOM; the suite it loads, `tests/engine.test.js`, also imports some UI presentation models and helpers but never mounts a screen.
6. **Budgeted escape hatch.** `src/content/scripts.js` registers named custom behaviors the DSL can't express: target <5% of content, each entry commented with why. A script pattern appearing twice becomes a DSL primitive (engine PR).

### 3.2 File tree — the layer contract, not an inventory

States where a thing BELONGS, not what exists. Print the real tree: `find src tools content/source styles tests -type f | sort`; shape check: `node tools/dirorder.mjs --selftest`.

| Directory | Contract |
|---|---|
| `index.html` · `styles/` | Boot page and stylesheets. `base.css` owns palette tokens, the root sizing anchor and `--ui-zoom`; `combat.css` / `map.css` / `ui.css` are screen-scoped and **measure nothing** (`main.js` decides layout once, writes `data-layout`, §7.2). |
| `src/model/` | Shape and meaning, no behaviour, headless: schemas, registries, formula evaluator, validation, run/combat state + persisted-shape declaration, `floorplan.js` (§6), `loadout.js`, `unlocks.js`. |
| `src/engine/` | Behaviour over that shape, headless (no DOM, storage, timers, or randomness beyond seeded streams): turn loop, opcodes, triggers, status interpreter, mapgen, `actmap.js` (the one act-boot path; game and both harnesses import it, §6), encounters, rng, save. |
| `src/content/` | Pure data, no logic: cards, statuses, stances, relics, flasks, events, enemies, encounters, keywords, tags, classes, equipment, balance, mapconfig, music beds, SFX recipes, `scripts.js` hatch (<5%). `generated/` is compiled from `content/source/*.csv`, **never hand-edited**. |
| `src/ui/` | Everything that touches the DOM, and nothing the engine imports: screens, components, fx, audio, input/gesture, asset maps. |
| `content/source/` | Authoring CSVs compiled into `src/content/generated/`. |
| `tools/` | Node instruments and harnesses; the observed-red idiom (`--selftest` / `--mutate`) is wired in `.github/workflows/ci.yml`. |
| `tests/` | `index.html` (browser) and `run-node.mjs` (headless). `engine.test.js` needs no DOM; other `*.test.mjs` may mount screens on a stub DOM (e.g. `card-rank.test.mjs`). |
| `build/` · `dist/` | Bundles from `tools/bundle.mjs` and shipped copies. Default: single-file. Web edition: `bundle.mjs --external-art` writes `build/web/` (game file, pinned pack indexes `packs/`, object store `objects/`), published by Pages (EXTERNAL-ASSETS-PLAN steps 3a, 6b). From step 8e the pack shape becomes the default beside a self-contained single file under `download/`. `node tools/verify-shipped.mjs` checks they agree with source. |

**Import rule:** imports point inward. `ui` → `engine`, `model`, `content`; `engine` → `model`, `content`; `model` → `content`. **`content` never imports `ui`** (it may import `model/` schemas/helpers and the `config/` and `framework/` data modules). A content file importing `engine` is the defect this layering catches.

### 3.3 Domain model, registries, and state

| Entity | Key fields (each has a schema in `schemas.js`) |
|---|---|
| Card | `id, class, rarity, cost (int \| 'X'), type, keywords[], effects[], textTemplate, upgrade` (partial override) |
| Relic | `id, rarity, textTemplate, triggers[], passives?` |
| PropertyRule | `tag, requires[], excludes[], textTemplate, passives?, triggers?` |
| Status | `id, name, icon, stackMode, decay, proc?, meter?, modifiers?, hooks?` (§3.7; `meter?` is the legacy build-up form) |
| Stance | `id, name, icon, onEnter?, modifiers?, hooks?` |
| Keyword | `id, name, tooltip` (display only) |
| Enemy | `id, name, hp: [min,max], poiseMax, moves{}, firstMove?, phases?[]` |
| Encounter | `id, enemies[], weight, minFloor?, pool: normal \| elite \| boss, act? (default 1)` |
| Event | `id, name, art, text, choices[]` (choice: `label, requires?, effects, resultText`) |
| Flask | `id, rarity, targeted?, effects[]` |
| Class | `id, name, maxHp, startingRelic, startingDeck[], cardPool[]` |
| MapConfig | per-act `floors, columns, pathCount, typeWeights, floorRules` |
| Balance | flat constants (odds, prices…; stats are `derivedStatRules` rows) |

- **Relic passives** are a closed key set with one home, `PASSIVE_TYPES` (`src/model/schemas.js:317-348`), from which the relic schema's `passives` node is built. Examples: `runeGainMult`, `restDenied`, `swapCostDelta`, `exposureBuildupMult` (Arcane Exposure buildup per hit ×, read for the hit's source).
  - `restDenied` is `true` or a list of location tags (§13.4j), the one passive that is not a number or flag.
  - `passiveMult` / `passiveSum` / `passiveFlag` also read the owner's **mounted property rules** (§3.6) when a combat caller passes them, so a property confers a passive exactly as an owned relic does.
- **PropertyRule** = what one `property`-domain node confers; exactly one per property node. A VIEW derived by `tools/content-build.mjs` from the tag tree (node row, `REQUIRES`/`CONFLICTS_WITH` edges in `nodeRelations.csv`, sentence in `nodeTerms.csv`, effects in `nodeEffects.json` with each `{variable}` replaced by the balance path its `default` binding names), joined in `src/content/propertyRules.js`, which resolves paths at load.
  - Its `passives` node is built from the same `PASSIVE_TYPES` fields.
  - Every family may carry a property node; what the mount path holds is the narrower `MOUNTABLE_KINDS` (`engine/properties.js`).
  - Property nodes are stamped onto `propertyTags`, never `tags`.
- **Tag tree** (`content/source/nodes.csv`: `id, parentId, label, color, glyph, visibility, priority, domain, aside, blurb`) is THE one tag vocabulary.
  - Every tag is a node; parentage is `parentId` only (a dotted id is an opaque key). Roots are domains; `domain` and `aside` (a root whose tags never join a tag list: `presentation`, `classification`) are written on roots only.
  - Companions: `nodeRelations.csv` (`sourceId, relation ∈ NODE_RELATIONS, targetId, precedence`), `familyNodes.csv` (family × subtree root), `nodeTerms.csv` (`playerTermId, tooltipTermId, template`), `nodeVariables.csv` (`nodeId, variable, role`; nodes carry no numbers), `variableBindings.csv` (`scope ∈ VARIABLE_SCOPES, scopeId, nodeId, variable, balancePath`; precedence `instance › upgrade › class › default`), `nodeEffects.json` (`{ [nodeId]: { passives?, triggers? } }`).
  - Derived: the five tag tables, the property rules, `src/framework/data/{properties,relations}.js`. Every collection-backed object carries exactly one `classification.*` node, stamped as `kindIds` (§3.14).
- **Enemy cap: a combat never has more than 3 enemies.** An encounter's `enemies[]` lists at most 3 ids (validator rejects more); `createCombat` / `createRunCombat` open with the first 3. No effect adds an enemy mid-fight today; any future summon, split or reinforcement must check `enemySlotFree` and do nothing at 3 alive. Lives in `MAX_ENEMIES_PER_COMBAT` (`src/model/combatLimits.js`); `?shotEnemies` and `?shotEnemyCount` fixtures obey it.
- `registries.js` loads content into typed, deep-frozen registries keyed by id; cross-references are by id only; getters throw on unknown ids.
- **Definitions vs instances:** state (`model/state.js`) holds instances referencing definitions by id: deck card `{ instanceId, cardId, upgraded }`; enemy `{ instanceId, enemyId, hp, block, statuses{}, poiseMeter, movesHistory[] }`. Saves serialize instances + RNG counters only, never definitions, so saves stay small and content patches apply to loaded runs (guarded by `contentVersion`, §3.12).
- **Player intents (closed set; dispatch `src/engine/combat.js:850-915`):** `setReactions`, `chooseReaction`, `predictIntent`, `recoverControl`, `chooseBlightFeat`, `chooseDiscard`, `moveCharacter`, `playCard(cardInstanceId, targetId?)`, `endTurn()`, `useFlask(slot, targetId?)`, `swapArmament`, `changeEquipment`. Run-level actions are not intents: each screen calls its own `src/engine/` function (e.g. `restAt(visit)`, `src/engine/locations.js:121`).

### 3.4 Effect DSL (opcodes)

An effect is an array of opcode objects, enqueued on the action queue (§3.9) when a card is played, a relic triggers or an event choice resolves.

**Opcodes** (closed; extending is an engine PR):
- **Combat:** `damage {hits?}`, `block`, `applyStatus`, `removeStatus`, `draw`, `discard {random?}`, `exhaust`, `addCard {card, pile, position}`, `gainEnergy` (adds Stamina; retired alias id), `restoreStamina`, `restoreMana`, `loseHp` (ignores block), `heal`, `shuffleDiscardIntoDraw`, `enterStance`, `poiseDamage`, `stagger`, `buildup`, `arcaneBuildup`, `gainBarrier`, `wardDamage`, `grantCardCharge`, `grantRollMode`, `retain`, `gainPoise`, `gainWard`, `dodgeRoll`.
- **Run-level** (events, shops, rewards reuse the DSL): `addCinders`, `addCardToDeck {card}`, `removeCardFromDeck`, `upgradeCard {random?}`, `addRelic {random? | id}`, `addFlask`, `addFlaskCapacity`, `refillFlasks`, `loseMaxHpPct`, `startCombat {encounterId}`, `swapClass {classId | random}` (§13.4h).
- `gainPoise` / `gainWard`: `amount` plus the card's Block rating bonus (DR on a physical skill, PR on a magical card), held as the target's Poise/Ward guard. It absorbs physical/magical impact before the matching meter fills; clears at the start of its owner's turn with Block. Emits `meterGuardGained`.
- `dodgeRoll`: player only, no fields. The die, Dexterity + Weight Class check, difficulty and temporary guard come from the framework's `dodgeRoll` rule over `mechanics.json`. Rolls on stream `misc`; success lands the guard as Block through the block door. Emits `dodgeRolled`.
- Engine-internal `completeCombatAction` (`src/engine/actions.js`, `completeExpandedAction`) closes an expanded combat action. Content must not author it; validation accepts it (`COMBAT_OPCODES`, `src/model/schemas.js`) and an authored one does nothing (no `expansionGroup`).

Common fields: `target: self | enemy | allEnemies | randomEnemy` (`enemy` on a card needs UI targeting), `amount: number | Formula` (§3.5), `if: Predicate` (§3.6), `repeat: n` (multi-hit).

**`removeStatus { status, amount? }`**
- No `amount`: remove the whole status and its application history.
- With `amount` (number or Formula): evaluate per target, clamp nonnegative, remove that many stacks (or build-up, for a status with `proc` or legacy `meter`); remove the status at zero magnitude. E.g. `amount: 1` cleanses one Weak stack, not every application.
- Absent status is a no-op. Receipts report the quantity actually removed.

**Card rating values are cost-derived.** Before cards enter the registries, primary values are recalculated:

`floor(global × (AP × action + MP × mana + SP × stamina) − statusReduction × Σ statusMultiplier[distinct applied status]) + ratingCardBonus[card]`, never below zero; the signed card bonus is added after flooring.

- `X`-cost attacks use one Action in the per-hit formula and retain one repeated hit per Action spent.
- Physical Attack damage uses the AR formula; damage and Block on magic-tagged cards use PR; physical Block uses DR.
- Physical/magical Attack impact use the Poise/Ward formulas, except a physical hit carrying its source weapon keeps that weapon's weight category (§13.4). An explicit `poiseDamage` effect uses the matching formula, carries the card's impact, gets no second per-hit value, and keeps the category default.
- A card a basic-card profile moves across the physical/magical line (a staff's Strike, Defend, technique, or a staff package's dealt card) is projected on both sides and resolves through the formulas of the school it resolves in.
- Conditional and formula-valued effects remain bonus values; only the primary/base component is replaced. A face whose only amount is a formula (Last Stand's missing HP) keeps it as authored, with no bonus row.
- Each rating owns configurable global, AP, MP, SP, status-reduction, per-status and per-card values under `balance.damage` (Advanced → Combat). A run snapshots them.

### 3.5 Formulas — structured objects, not strings

Every dynamic number is a JSON formula object evaluated by `model/formulas.js` (no string parsing).

Ops (closed): `add`, `mul` (nestable), `percentMaxHp {of, pct, min?, max?}`, `missingHp {of, max?}`, `missingMana {of, max?}`, `stacks {status, of, per?}`, `energySpent {per}`, `blockOf {of}`, `hpOf {of}`, `metric {metric, of, per?}`, `cardsPlayedThisTurn {per}`, `traitBonus {base, pct}`.
- `metric`: a combat counter × `per`; `sameCardPlays` = plays of this card this combat before the current one (first play reads 0).
- `traitBonus` (Counterstrike): `base + max(floor(base × pct), 1)` for positive base ([combat-card-traits-contract.md](docs/combat-card-traits-contract.md)).
- Every evaluation floors its final result. The **same evaluator** computes UI card previews (§3.13, §4.2).

#### Derived character stats

- Values are shipped defaults, authored as content data (bases, coefficients, divisors, rounding, reference maxima, flat-bonus folds); Settings/debug overrides layer over them, with no second formula in UI or engine. The run snapshots the resolved rules at birth, so tuning applies to new runs only. The structured formula table is the one authority.

**One row per stat** in `src/content/derivedStats.js` (HP, Mana, Stamina, opening hand, draw, hand size, AR, DR, PR, Ward, Poise):
`{ base, strength, dexterity, constitution, wisdom, intelligence, perLevel, min?, max? }`, priced by `statRowValue` (`model/derivedStats.js`):

`value = clamp(base + Σ floor(weight × attribute) + floor(perLevel × (level − 1)), min, max)`

- Rounding is per attribute, not on the total: each term floors alone (weight 0.125 adds nothing until the attribute reaches 8; Mana is 4, not 6, at every attribute 5). Mana's INT weight 0.125 follows the sum-to-1 formula `.5 w + 0.25 c + 0.125 str + 0.125 int = 1`.
- Hand rows (§4.1) may add `attributeBaseline` (term = floor(max(0, attribute − baseline) × weight)) and `byClass.<class>` (opening hand only: own base and weights over the row's bounds).
- External addends: armour `poiseThreshold`, item attack/defence ratings, relic adds, HP flat bonuses.
- Main-bonus defaults, per point: STR +1 AR; DEX +1 DR; CON +1 HP and +1 Poise; WIS +1 Ward; INT +1 PR. Mana and Stamina keep separate configurable weights. Existing saves keep their snapshotted rules.

| Row (id) | Base | STR | DEX | CON | WIS | INT | Per level | Min–max | Notes |
|---|---|---|---|---|---|---|---|---|---|
| HP (`hp`) | 51 | — | — | 1 | — | — | 2 | — | Stock pools incl. starting relics: Reaver 63, Starseer 66, Rogue and Herald 53. Max HP clamps to ≥ 1. |
| Mana (`mana`) | 1 | 0.125 | — | 0.25 | 0.5 | 0.125 | 0.2 | — | Wisdom leads. |
| Stamina (`stamina`) | 3 | — | 0.25 | 0.25 | 0.2 | 0.2 | 0.1 | — | The one turn budget (HUD: Actions); the DEX term adds its first Action at DEX 4. |
| Retired save row (`energy`) | 3 | 0.1 | 0.25 | — | 0.01 | 0.01 | 0.1 | — | Alias of `stamina` (`src/model/turnStamina.js`); combat reads Stamina. |
| Opening hand (`openingHand`) | 4 | — | — | — | — | 0.2 | — | 2–10 | Per-class overrides configurable. |
| Draw / turn (`draw`) | 4 | — | — | — | — | 0.2 | — | 2–10 | Full draw each turn, counted from INT 4; retained cards reduce it only at capacity. |
| Hand size (`handSize`) | 7 | — | — | — | — | 0.2 above 4 | — | 1–20 | `attributeBaseline` 4: +1 per five INT above 4. |
| AR (`ar`) | 0 | 1 | — | — | — | — | — | — | Read while combat ratings are on. |
| DR (`dr`) | 0 | — | 1 | — | — | — | — | — | 〃 |
| PR (`pr`) | 0 | — | — | — | — | 1 | — | — | 〃 |
| Ward (`ward`) | 1 | — | — | — | 1 | — | — | — | 〃 |
| Poise (`poise`) | 1 | — | — | 1 | — | — | — | — | ONE Poise: rating with ratings on, vessel with them off; armour and relics add. |

Basic-profile base values (data): guard profiles (`unarmedGuard` = 1, `ratingId` `dr`); attack profiles (`unarmedAttack` = 3, `ratingId` `ar`); magic profiles (`content/source/basicCardProfiles.csv`).

**Retired homes.** `validateContent` refuses by name: `balance.handMax`, `balance.combatRatings.multiplier`, `handRules.starting|turn|capacity`, `balance.poise.playerPerConstitution`. Their settings keys (`combatRatings.ratings.*`, `combatRatings.multiplier`, `handRules.*`, `balance.handMax`, per-item `combatRatings.bonuses.*`) are **dropped, never converted** on import and profile load/restore, with one warning per family (`model/advancedConfig.js` `normalizeAdvancedSettings`, `parseAdvancedConfigFile`). The `statRowsVersion` marker is gone, so any `derivedStatRules.rules.draw.*` or `.poise.*` key is read with its current meaning (`advancedConfig.js:225-235`).

**Pre-ruleset-7 runs are refused, not priced:** a run without a pinned Core 2 profile is refused at load (`engine/save.js` `retiredProfileReason`); bytes stay in the slot, never migrated. Tool/test snapshots older than ruleset 7 read missing rating and hand rows from the live table (`model/statRows.js` `statRow`).

### 3.6 Trigger DSL and predicates

Relics, powers, statuses, stances, mounted properties and enemy boss phases hook the engine through one declarative form, wired by `triggers.js` at combat start. Trigger fields: `on` (event from §3.10, plus `hpBelowPct`), `if?` (predicate), `do` (effects, §3.4), `once?`, `limitPerTurn?`. Enemy `phases` take `{ on: 'hpBelowPct', pct, once, do, unlockMoves }`.

**Predicates** (closed; combine with `all / any / not`): `inStance {stance}`, `hasStatus {of, status, atLeast?}`, `hasBlock {of}`, `hpBelowPct {of, pct}`, `firstCardThisTurn`, `firstAttackThisCombat`, `cardTypeIs {type}`, `everyNthCardThisCombat {n}`, `random {pct}` (named stream).
- `cardTagIs {tag}`: the contextual card's `tags` ∪ the snapshot's `derivedTags`, or the event's `cardTags` ∪ `derivedTags` (§13.4c).
- Event-payload gates: `eventIsAttack`, `hpDamagePositive`, `eventSourceIsOwner`, `eventTargetIsOwner`, `eventStatusIs {status}`.
  - `healPositive`: a `healed` event that healed something (`applyHeal` emits amount 0 at full HP).
  - `manaPositive`: a `manaRestored` event that restored something (`restoreMana` emits amount 0 at full Mana).
- Progression gates `skillLevelAtLeast {skill, level}`, `classLevelAtLeast {level}` read the skill/class ledger of plan phase 4 and are **false until that ledger exists** (a branch gated on them is inert).

**Property mounts — the one path a property reaches combat** (`src/engine/properties.js`)
- A carrier is `{ kind, id, instanceId, ownerKey, tagIds }`. `mountProperties` resolves its property tags to rules (kept only if its `requires` are on the same carrier and its `excludes` are not) into `ctx.propertyMounts[ownerKey][sourceKey]`, `sourceKey = kind:instanceId`; `unmountProperties` deletes it.
- **A source key mounts once**: re-mounting throws by name, so a re-equip never fires a trigger twice.
- Carriers: equipped armaments and armour. `createCombat` mounts worn pieces before any event; both equipment doors (`swapArmament`; `changeEquipment` after `equipPiece`) re-sync (outgoing leaves, incoming arrives).
- Mounts are **never saved**; `restoreCombatSnapshot` re-derives them from the restored loadout.
- `scanTriggers` walks mounted rules as its fourth source (after relics, stances, statuses) under gate key `property:<owner>:<sourceKey>:<i>`. Source keys are sorted (restored fights fire in live order); the key is stable across unequip/re-equip, so a `once` gate is not reset by swapping.
- Shipped rules:
  - **`siphon`** (both sceptres): when the holder's own hit causes an `arcaneBreak` (*`arcaneStagger` in §13.4p's scope*), restore `balance.exposure.siphonRefund` Mana (`siphonRefundMastered` once focus track `item:magic-focus` reaches `siphonMasteryLevel`, a `skillLevelAtLeast` gate, §13.4d).
  - **`overcharge`** (Blight Rod, Gorefire Brand): buildup per hit × `balance.exposure.overchargeBuildupMult`, via the `exposureBuildupMult` passive.
  - **`staggerBreak`** (plain staves), **`resonance`** (Goldbough Branch): §13.4k.

### 3.7 Status model — statuses are content, not code

`src/content/statuses.js` defines every status over a generic model interpreted by `src/engine/statuses.js`; adding a status needs no engine change. Schema:

```
{ id, name, icon,
  stackMode: 'add' | 'refresh' | 'unique',
  decay: 'none' | 'perTurnEnd' | { duration: n } | 'onConsume',
  proc?: { threshold, burstPercent, burstMin, burstMax, poiseDamage?, effects?, stagger?, resistance? },
  meter?: { max, growthMult, onFill },
  modifiers?: { damageDealtMult?, damageTakenMult?, blockGainedMult?, attackDamageAdd?, blockAdd? },
  hooks?: [triggers §3.6] }
```

- `proc`: build-up statuses; at `threshold` they burst, then reset to zero.
- `meter`: legacy build-up form, still accepted: on fill run `onFill`, emit `meterFilled`, grow max by `growthMult`.
- `modifiers` are consulted by §4.2 math.
- Examples: Bleed, Crimson Blight, Weak, Vulnerable, Frost (`src/content/statuses.js`).
- **Poise/Stagger** uses its own break meter (`src/model/breakMeter.js`), fed by `poiseDamage`. A full meter applies `staggered` (skipped turn, ×1.5 damage taken). After a break the threshold grows by `balance.poise.growthMult` (1.25, `dealPoiseDamage`). Core fights ship `dealPoiseDamage` only.
- **Stances** (`src/content/stances.js`) reuse `modifiers` + `hooks` + `onEnter`; exclusivity is the `enterStance` primitive.
- **Engine-primitive exceptions** (fixed behaviors, not data): **Exhaust, Ethereal, Innate, Retain, Unplayable, X-cost**. `src/content/keywords.js` supplies only their names and tooltips.

### 3.8 Procedural systems — kept procedural, parameterized by data

Algorithms are code; knobs are data. Every generator is a pure function of `(config, rngStream, runState)`, snapshot-testable with fixed seeds (§8).

| Generator | Algorithm (`src/engine/`) | Knobs (`src/content/`) |
|---|---|---|
| Act map | StS path-walk + typing constraints (§6), `mapgen.js` + `model/floorplan.js` | `mapconfig.js`: floors, columns, path count, type weights, `?`-node weights, per-floor rules **as anchors** |
| Encounters | weighted roll, no-repeat window, `encounters.js` | `encounters/<seat>.js` (marches, reach, weald): pools, weights, elite/boss lists |
| Rewards | rarity odds `model/rewardOdds.js`; flask decay `encounters.js` | `balance.js`: odds tables, cinder ranges (`rewards.cinders`), flask-drop decay |
| Enemy AI | weighted state machine + `maxConsecutive`, `combat.js` | each enemy's `moves` table |

#### Swap cost and equipment changes

Closed vocabularies in `balance.equipment`:
- **`swapCostRule`** (one of `swapCostRules[].id`) prices every mid-fight equipment action (prepared-set swaps and replace/move/unequip): **base → gear → floor 0**.
  - `base: 'category'`: destination piece's tags against ordered `swapCostByCategory` (first match wins), else `swapCost`. `base: 'default'`: `swapCost` for all.
  - `gear: true`: adds the signed total of relic `swapCostDelta` passives and worn `self.swapCost` mods.
  - Truth function `swapCostFor()` (`model/loadout.js`); `engine/combat.js` charges it and emits `armamentSwapped` or `equipmentRearmed` with the number. The fields are closed and their product total; a new rule is one `swapCostRules` row.
- **`allowChangesInCombat`**: true lets the player-turn Armoury replace, move or unequip carried gear via the `changeEquipment` intent (applies the price, updates resource maxima and Poise, reconciles equipment-granted cards, restamps every live pile, persists the same loadout); false closes UI and mutation paths.
- **`basicTag`**: a piece carrying it answers the **found** gate free (`ownership()`); no opinion on the **earned** gate (a row with both is refused by name). `persistence` is the only scope word: default `perRun`; any other value is profile-wide, and `unlocked` is also read (`model/loadout.js:820-821`).
- A weapon's category is its tags (`heavy`, `flourish`), never a `swapCost` column.
- `apply` in `equipMods.csv` is closed per scope (`CARD_MOD_APPLIES` / `RUN_MOD_APPLIES`, `model/loadout.js`); anything else fails validation.

#### The starting deck

`balance.startingDeckSize` caps the BASE cards (minted strikes and defends) at **character creation only**. Order:
1. **Bound cards first**, never capped, dropped or refused: cards from `bound`-tagged pieces (`equipmentGrants.csv`), a weapon package's `grantedCards` and `weaponArtDefaults`, the class signature, `startingDeck.global.grants`.
2. **Base cards fill the rest:** `filler = max(0, cap − bound)`, split attack/guard by the class's `strikeBias`; an odd remainder goes to `startingDeck.oddFillerGoesTo` (default `attack`).
3. **The equipped profile gives base cards their identity** (sword: Slashing Strikes; bare hand: `unarmedProfiles`); it never tops up a floor.

- Equipment alone ≥ cap: no base cards minted. A balance question for gear authors, not a validation failure; `startingDeckWarnings()` warns (class and loadout named), refuses nothing (`validateEquipment` returns problems only).
- After creation the cap does not apply: no re-minting, no holding a total.
- **Attack count holds mid-run:** a swap re-skins the birth attack slots (`equipmentAttackSlotCount`, recorded at creation, never re-derived) minus permanently removed ones.
  - `removedAttackSlotIds`: unique stable `attack:N` ids from the birth allocation; absent = none.
  - Merchant and event removal may remove run-owned basic attacks (including weapon-derived faces), retiring the slot without renumbering. Swaps, combat setup, save/load and restamping share the surviving slot plan and never restore a removed copy.
  - Item-owned grants cannot be permanently removed. The merchant revalidates instance, funds and nonempty-deck guard before charging.
- All authored: cap, per-class bias, odd-split winner, grant sources (rows in the `grantSource` tag domain). Bound cards mint at four seams (global, armor, weapon, class) reading tags from `startingDeck.sources` (map, tag row and `sourceOrder` move together); a binding naming no registered source, or an unbound seam, is refused by name.

**Card ownership: the run or one item.** Run-owned cards stay for good (base strikes/defends, class signature, global grants, rewards). Item-owned cards ride with the item: equip and they arrive, unequip and they leave, re-equip and they return identical; **an unequipped item's cards are gone**.
- Sources: weapon package `grantedCards`, `weaponArtDefaults`, and the `bound` table (`equipmentGrants.csv`, `bound` tag on any piece incl. armour). One reconcile applies it on every equip transition, in or out of combat; instances carry deterministic ids and the owner's namespaced ref (idempotent, stable saves).

#### Card mounts: the smith's services

Every card an item lends sits in a **mount** on that item, keyed by the composer-minted instance id (stable across restamp, save, fight). A smith (Shrine's, or one a merchant rolls) can **upgrade** an item (tier promotion), **extract** a card from a mount, **seat** a run-owned card in an emptied or open mount.
- **Extract:** the card becomes run-owned (joins the deck). The mount shows its kind's **fallback** until seated: weapon-art mounts fall back to the unarmed technique (Dodge Roll, from `unarmedProfiles`), granted mounts to nothing; override per item in `cardMounts.fallbackByItem`. A fallback is never extractable.
- **Extractable** = a card tag (`cardMounts.extractableTag`, `extractable`); strikes and defends lack it. A mount accepts any tag in its kind's `accepts`.
- **Seat:** the deck instance leaves, rides with the item, extractable again. Extra mounts (`cardMounts.extraMounts`, per item, a kind) sit behind a flag that is off.
- **Not in Sealed or Draft runs:** pool decks never get lent cards (`isPoolDeckRun`, `model/cardRemoval.js`). `extractionRefusal` answers `poolDeck` from Custom Climb rules or `run.poolDeck === true` on a fight's synthetic run; `extractionPlan` lists no candidate and carries the `refusal`; `commitExtraction` refuses by name (even a free grant) before touching the run. Every smith door (Shrine, merchant smith, blacksmith `extractArt`) shows the service unavailable with `blacksmith.refuse.extract.poolDeck`. Seating a card the run already owns is unchanged.
- **Prices:** Smithing Stones (`smithing.services.extract.cost`, `.install.cost`), free by owner's word. **Who offers:** `smithing.services.offeredAt` = node kind, chance, service list. Chance 100 consumes no roll; a merchant's 25 rolls once per visit on the smith's RNG stream and rides with the stock (reload doesn't re-roll; no later reward shifts).
- `run.itemMounts` (per item, per mount: emptied, or card seated) is read by the composer on every restamp and carried into combat and saved fights, so a swap or load cannot re-mint an extracted card. It never touches item authoring; absent = untouched.

#### Equipped weapon card packages

- `WeaponCardPackageModel` adapts `attackProfile` as an empty ordered priority list plus that profile as filler. `WeaponDeckCompositionService` builds an `EquippedWeaponCardPlan` and rebinds the stable generated attack instances in place.
- Slots: no eligible weapon → Unarmed in every slot; one eligible weapon (either hand) → owns all; two one-handed → right `ceil(N/2)`, left `floor(N/2)`. Within a hand, priority/effect references precede repeated filler. Shields and package-less items use no quota. `handsRequired: 2` claims the whole quota (never inferred from tags, names, art or kind).
- The plan keeps `equipmentAttackSlotId`, `instanceId`, upgrades and acquisition metadata; it changes only package-derived card/profile/receipt/mod fields.
- Equip, unequip, hand move and set swap apply it atomically and emit one post-commit `equipmentChanged` receipt; creation and load/continue call the same service.
- Combat rebinds generated attacks wherever they live (hand, draw, discard, exhaust) after the current card resolves. Legacy role-only attacks map once, in deck order, to `attack:0..N-1` and are never appended.
- A conflicting off-hand, a duplicate piece without distinct equipment instance identity, or a claimed-but-invalid package fails closed; Unarmed is only the valid zero-weapon plan.
- **Exact combat snapshots** use their own saved loadout as authority. After shape and reference validation the service migrates the generated attack set in pile order `draw`, `hand`, `discard`, `exhaust` (no card changes pile) and replaces the stale top-level run projection before continue. It must not replay combat, consume RNG, reset turn/enemy/event/trigger state, or mask an unknown card reference. Invalid duplicate or two-handed-plus-offhand snapshots are archived fail-closed, never normalized or replaced with Unarmed.

#### Complete armament kits

Every shipped hand-equipped armament authors `weaponCardPackage.combatKit: { attackProfileId, guardProfileId, artCardId }`.
- Weapons, shields and staves (sceptres are staves) each lend one Strike, one Guard and one signature Armament Art while equipped. Armour, talismans, consumables get none.
- Kit cards are guaranteed before the filler budget is divided (a shield supplies a Strike even beside a sword or at budget zero). A shield's Strike/Guard use its own profiles, scaling, damage school and smithing level. Attack modifiers are restricted to their source armament; Guard modifiers keep the loadout-wide rule.
- Filler attack slots and removals keep their identities. Shield + non-shield: the non-shield keeps the filler quota. Two other one-handed armaments split filler as before. A two-handed armament lends one kit.
- Kit basics use ids `kit:<item>:attack|guard`, are not smith mounts, cannot be extracted or permanently removed; recorded as `grantedBy`, `equipmentRole: granted`, `kitRole`, `profileId`.
- The signature Art uses the weapon-art mount and its extraction/fallback rules (a smith replacement can change it). Each item's signature mount installs independently even if two items author the same card; optional non-kit arts keep the shared-art rule.
- Reconciliation keeps cards already in discard or exhaust; unequip removes item-owned contributions, re-equip restores their ids.
- New armed starting decks omit the redundant global technique grant (`tests/framework.test.mjs`); unarmed behavior is unchanged. Existing saves keep run-owned cards and their attack-slot quota; reconciliation adopts missing kits without re-minting removed filler. Equipment previews use the same composer, counts included.

**Everyone has the Dodge Roll.** Every composed deck carries exactly one, as a `weaponArt` instance. An empty hand owns it (`grantedBy: unarmed:<hand>`, right before left); with no empty hand (both armed or two-handed) the body does (`unarmed:body`). Filling a hand moves it, never removes it. An art mount already holding it counts (one, not two). Like every bound card it is dealt before base cards and counts against `startingDeckSize`.

**Shield signature Arts**

| Shield | Art | Stamina | Block | Other |
|---|---|---|---|---|
| Round Shield | Shield Bash | — | — | — |
| Buckler | Riposte | — | — | — |
| Kite Shield | Guardian | 1 | 5 | Exhausts; adds temporary 1-Stamina Enter: Bulwark skill to hand |
| Tower Shield | Bastion | 1 | 12 | 1 Weak to self; Exhausts |
| Spiked Shield | Spiked Reprisal | 1 | 4 | 4 damage; 2 Bleed |

Guardian's generated skill Exhausts, is usable by every class, enters the Bulwark stance; a full hand sends it to discard; never enters the permanent deck; gone after combat. Other armament Arts use existing card effects.

### 3.9 Action queue

Combat resolves through a FIFO **action queue** (mirrors StS's GameActionManager).
- Playing a card enqueues its opcodes as actions; each executed action may emit events; triggers (§3.6) may enqueue further actions.
- The queue drains fully before control returns to the UI.
- **Nothing mutates HP/block/piles/statuses except an executed action.** Triggers react to events; they never mutate directly.

### 3.10 Event bus

Events are emitted by executed actions. Closed list: `EVENTS` in `src/model/schemas.js` (payloads in `docs/ENGINE-API.md`); an event marked † is specified ahead of implementation and joins `EVENTS` when it lands. `equipmentChanged` and `equipmentRearmed` are emitted outside `EVENTS`. Core events (not exhaustive):

`combatStart`, `combatEnd(victory)`, `playerTurnStart`, `playerTurnEnd`, `enemyTurnStart`, `enemyTurnEnd`, `cardDrawn`, `cardPlayed`, `cardExhausted`, `cardDiscarded`, `deckShuffled`, `damageDealt(source,target,amount,blocked,isAttack)`, `blockGained`, `hpLost`, `healed`, `statusApplied`, `statusExpired`, `meterFilled`, `stanceEntered`, `stanceExited`, `enemySpawned`, `enemyDied`, `enemyStaggered`, `energyGained` / `energySpent` (legacy names; `energy` is the retired alias of Stamina), `flaskUsed`, `relicTriggered(relicId)`, `equipmentChanged(reason,beforeLoadoutSignature,afterLoadoutSignature,changedPositions)`, `combatReactionOffered`, `combatReactionChosen`, `combatReactionUnavailable(ownerId,sourceId,reason,cardId,cardIds,attackKind)`, `combatGuardBroken(targetId,sourceId,poise,sourcePlayerId?,targetPlayerId?)`.

### 3.11 Seeded RNG

- `rng.js` is **mulberry32**. A run seed (uint32, shown base-35 like StS, e.g. `3LB6HXYD`) is rolled at run start or entered on class-select.
- **Named streams**, each from seed + stream salt + a monotonically increasing counter *saved with the run*. Closed set `STREAM_NAMES` (`src/engine/rng.js`; unknown name throws): `map`, `shuffle`, `cardRewards`, `relicRewards`, `flaskRewards`, `armaments`, `enemyAI`, `enemyHP`, `events`, `shop`, `misc`, `smith`, `combatProcs`, `seats`, `rewardRolls`, `shopOffers`, `sigils`, `enemyIntentVisibility`, `combatAvoidance`, `statusRecovery`, `statusPressure`, `ashenBlight`, `enemyIntentClue`, `enemyReaction`, `combatRounds`, `combatContest`.
  - `seats`: one shuffle at run creation for seat order (§13), n−1 counter steps, moving no other stream.
  - `combatContest`: the d20 of an insight contest (§17 Contests); appended last; a run that never plays a contest card writes no key for it.
- Consequences: re-fighting a combat after reload gives the same shuffles; a different path doesn't change what a later card reward would have been on another stream.

### 3.12 Save format, and the durable profile

Two schemas, one home each (never restated as values): `RUN_SCHEMA_VERSION` in `src/model/state.js`, `META_SCHEMA_VERSION` in `src/engine/save.js`.

#### The run

Key `sote_run_v1`; **three slots, one run each** (`SLOTS`, `save.js`). The persisted field list is data: `RUN_SHAPE` in `model/state.js`, checked by `validateRunShape()`; a floor, not a whitelist (unlisted keys pass through). Instances by id only (§3.3).
- **Saved** after every committed player choice (node chosen, reward taken).
  - Entering combat writes a deterministic `combatEntered` checkpoint (older ones without a snapshot restart the encounter deterministically).
  - **Save Game** / **Save and Quit** in a fully resolved combat replaces it with a versioned `CombatSnapshotService` record of the committed turn (phase, resources, hand and piles, enemies and intents, statuses, triggers, equipment, event log). Loading restores it without replaying start, draws or enemy rolls.
  - The saved event log keeps every row but drops per-event `abilityBefore`/`abilityEntities` (kept in the live log).
  - A live event buffer, or an action queue not held by a pending reaction or ability discard, is not a committed boundary: the save is refused.
- **Refused and archived, never repaired:** unknown older-or-invalid `schemaVersion`, malformed shape, or `contentVersion` mismatch with a dangling id. Healed case: a run saved before equipment existed gets a fresh loadout and re-stamped deck.
- **Newer `schemaVersion`:** refused and **preserved** (runStatus `newer`, nothing archived). Every older schema, v1 to current, loads and migrates forward (`tests/save-migration.test.mjs`, fixtures `tests/fixtures/run-save-schema-versions.json`).
- **Save-safe changes:**
  - A run carrying `attributeMode`, attributes, a flask capacity ledger, level receipts, equipment-profile rules or a `derivedStatRuleSnapshot` keeps them; new presets, formulas, flask allocations and level prices apply to new runs only. Live content tuning of existing ids is allowed.
  - New persisted state must be optional for older saves and deterministically migrated (or get a schema migration) before any current save is written; a missing new field never archives a valid save. Prefer existing opcodes/statuses/snapshots.
  - The Rogue/tuning addition is save-safe: the new creation mode gets a new stable id; `standard` and `pointbuy` stay valid with their old validation rules; Rogue adds ids and does not rename or delete any existing class, card, relic, kit, outfit or asset id. Adding those definitions alone needs no run- or profile-schema bump.
- **Pool-deck mark:** a Sealed or Draft run carries `poolDeckRule` (`RUN_SHAPE`; `POOL_DECK_RULE`, `model/cardRemoval.js`): its deck is held to the attack slots it was dealt. Standard runs never carry it. A pool save from schema ≤19 lacks the mark: the load door heals its quota to the dealt slots once, marks it, notes it. A schema-20+ pool save without the mark is refused by name.
- **Flask capacity ledger:** `flaskCharges` carries `base`, `grown` (possession door), `granted` (moment door); `validateRunShape` enforces `capacity === base + grown.hp + grown.mana + granted` (§5.5.2). A v2 save is attributed once at the load door (`initializeRunFlaskCharges`): unaccounted surplus goes to `granted`; `base` comes from `balance.flaskCapacity`, clamped so no charge is invented.

#### The profile

Key `sote_meta_v1`: settings, unlocks, durable progress, found armaments, last 20 run results. The one artifact a player cannot re-earn, so five durability properties:
1. **Versioned both ways:** older `schemaVersion` migrates or refuses by name; **newer** refuses and **preserves**.
2. **Verified write, then mirror:** `sote_meta_backup_v1` rotates only after the primary reads back cleanly; a failed read-back restores the primary from the last good.
3. **Archives are keyed and appended, never overwritten** (`sote_run_archived`, keyed by kind, slot, time). Runs age out and are capped. Profiles are never deleted, aged out or evicted by run pressure, and archiving never removes the primary; if profiles alone fill the drawer, the oldest moves to its own salvage key with a recorded notice.
4. **Never silently empty:** a failed load is a named, visible state (`profileStatus()`, `ui/screens/profileNotice.js`), never a fresh profile under the same filename. It is **quarantined**: the next settings write cannot overwrite the original bytes.
5. **The drawer has a handle:** `listArchives()` / `getArchive()` / `exportArchive()` / `restoreProfile(id)` from **Profile on the title screen** (`ui/screens/profileArchive.js`): inspect, export, or promote an archive (archives the outgoing primary, clears quarantine). `drawerNotices()` reports what the drawer did.

Falsify: `node tests/run-node.mjs` (no profile, corrupt, older, **newer**, two archives in a row).

### 3.13 Card text templating

- Card and relic `textTemplate`s carry tokens: `"Deal {damage}. Apply {bleed} Bleed."`
- Tokens bind to opcode values by op/status name, disambiguated by occurrence ordinal (first is bare, second is `{damage.2}`).
- The UI fills tokens via the **same formula evaluator and damage preview the engine executes** (§3.5, §4.2): a Strike in hand shows 9 with +3 Strength and shows it struck through to 6 when Weak.
- Validation (§3.14) rejects any template token that doesn't bind, and any player-visible numeric effect lacking a token.

### 3.14 Content validation

`model/validate.js` runs at every boot (`src/main.js`) and from the test page, across ALL registries:

1. Every content object conforms to its schema (fields, types, enums).
2. Every id cross-reference resolves (cards in pools/decks, statuses in effects, encounters on maps, moves in `unlockMoves`, …).
3. Every opcode, formula op, event name and predicate used is in the closed sets of §3.4–§3.6.
4. Every text-template token binds (§3.13).
5. `scripts.js` budget report: script-using content is listed; the count must stay <5% of total content objects.
6. Value-range and pairing rules a field-wise check cannot see, each failing **naming the entry** (Law 1 clause 5): a floor anchor outside its act's rollable band; a proc row whose `burstMin` exceeds its `burstMax`; a music bed that is quiet by accident rather than by the declared silence word (§7.4).
7. Property rules (§3.3 PropertyRule), each refusal naming its row (`tests/engine.test.js` test 80):
   - every `property` tag has exactly one rule; a rule's tag is a property tag;
   - `requires`/`excludes` name property tags; `requires` has no cycle;
   - a sidecar `{ "balance": "path" }` names a real balance number;
   - any family may carry a `property` tag.

**Content smoke (Law 1 clause 6)** is the standing check over observable outcome, in the observed-red idiom:

`node tools/content-build.mjs --selftest` (known-bad corpus: every case fails for its named reason); `--mutate` (reinstate each defect N ways; each must be caught).

- Both edges: one entry added by table + asset alone appears and plays; one deliberately broken entry fails with its id printed.
- A corpus nobody has watched go red is `unknown`, not green.

#### Notes and history

- Content is data; the engine knows only the closed primitive sets of §3.4–§3.7.

Full history: [docs/spec-history/03-architecture.md](docs/spec-history/03-architecture.md).

---

## 4. Combat rules (Slay-the-Spire-faithful)

Governs turns, cards, damage, statuses, stances, enemy intents and SP, tagged combat, and reactions. Costs and pools below apply to every fight.

**Card resource costs.** Costs are explicit card data: a Stamina cost (one turn pool; the HUD calls it Actions; `energy` is a retired alias of `stamina`) and an optional Mana cost. Rarity does not roll a cost at play time.
- Reward census, across the union of class reward pools: Common / Uncommon / Rare cards target 30 / 50 / 70 percent with a Stamina cost, including 15 / 30 / 50 percent with both Stamina and Mana, rounded to whole cards. Starter and equipment-only cards are outside it. Counts and verification: [balance receipt](docs/card-resource-balance.md).
- Class-specific reward rarity weights may override the default encounter weights; Chaos Rewards and skill rarity unlocks keep precedence.

**Pools between fights** (rules text: [Combat and equipment rules](docs/COMBAT-EQUIPMENT-RULES.md) §5).

| Pool | Rule |
|---|---|
| Stamina | Every fight opens at maximum (`mechanics.stamina.combatStartRefill: "full"`; `"carry"` has no effect on the Stamina a fight opens with). Every player turn start refills to maximum less any Stagger loss (`src/engine/combat.js`). A restored fight keeps its saved Stamina. The refill also clears the Stamina deficit an equipment swap carried. |
| Mana | Refills when a fight ends, victory or defeat: `runCombatEnd` writes Mana back through `manaAtCombatEnd` (`mechanics.mana.combatEndRefill: "full"`; `"carry"` restores carry-over Mana) and clears the Mana equipment deficit, so every fight opens on full Mana. |
| HP | Carries between fights; only rests, flasks and effects restore it. |

**Recovery.** After a won fight (applied after the fight's pools are written back) and at every Rest (on top of the place's own tags, §13.4j; included in the Rest preview), HP, Stamina and Mana restore the authored percent of maximum in `content/recoveryRules.js` (`model/recoveryRules.js`). Both default to 0, since a fight's end refills Mana (§4.1) and the turn-start refill restores Stamina (§4.1). There are no Settings rows for recovery, a stored legacy `recovery.*` key changes nothing, and a fight carries no recovery state.

### 4.1 Turn loop

Hand size, draw counts and cleanup are stat rows plus hand options, snapshotted per run.

| Row (§3.5 stat row; edited in Advanced → Stats → Draw & hand) | Id | Default | Scaling | Cap |
|---|---|---|---|---|
| Opening hand (also bounded by Hand size; per-class overrides allowed) | `openingHand` | 4 | +1 per five Intelligence above 4 | 10 |
| Draw / turn | `draw` | 4 | same | 10 |
| Hand size | `handSize` | 7 | same | 20 |

- Rows are priced by the one row formula and snapshotted with the run (existing runs keep theirs).
- Hand options (not stat rows; `content/handRules.js`): retain, optional discard prompt, discard limit, replacement draws, overflow, reshuffle, `shuffleHand`, draw mode. Settings changes apply next combat.

**Default rule: draw the full turn amount, retaining tagged cards, up to the Hand size limit.**
- *Turn end:* keep `Retain` cards; resolve `Ethereal` and other lifecycle rules; shuffle ordinary unplayed cards directly into the draw pile (`shuffleHand: true`). Played cards and forced or chosen discards go to the discard pile and return at its next reshuffle. Retain does not change a played card's destination.
- *Short draw pile:* if it holds fewer cards than the next draw, the whole discard pile joins the returned cards in that one shuffle (deck order under Play in deck order). Cards already in the draw pile stay on top in order; the shuffled cards go beneath.
- The authored Herald and Starseer pools give Retain to selected healing, ward, setup and costly spells, upgrades included.
- *Next draw* = `min(Draw / turn, max(0, Hand size − retained count))`: two retained plus Draw 4 gives 6 cards; five retained draw only 2 at Hand size 7. A full hand draws nothing and consumes no draw-pile cards; a depleted deck supplies fewer. When kept cards fill the hand, the turn-end discard prompt offers to discard any number before the next draw.

**Options**
- Play in deck order returns unplayed cards to the bottom in deck order without consuming shuffle RNG.
- `retain: true` keeps all ordinary unplayed cards. With `retain: false`, disabling `shuffleHand` restores discard cleanup. `drawMode: 'fill'` remains available. Forced overflow discards stay discards even with shuffle on.
- Optional discards are selected when ending a turn (cancel leaves the turn untouched). Turn-end effects resolve before selected cards move to discard and cleanup runs; Ethereal and lifecycle rules still apply.
- Optional replacement draws add to the next fixed draw, capped by capacity. Overflow either preserves existing cards or requires selecting the excess at turn end. Draw effects stop at capacity without consuming the draw pile. Reshuffling can be disabled.
- Saves: rules, pending replacement draws and RNG counters persist, so resume is deterministic. A saved fight without `shuffleHand` keeps its prior discard behaviour. Existing saved fights keep their snapshotted rules. Pre-ruleset-7 hand-group adapters remain.

Baseline sequence (saved stat rows and hand options override its draw and cleanup defaults):
1. **Combat start:** shuffle deck into draw pile; `Innate` cards go to top. `combatStart` triggers fire.
2. **Player turn start:** lose all block (unless modified), set Stamina to its maximum (Stamina row, less any Stagger loss), draw the Draw / turn row (Opening hand on turn 1), `playerTurnStart` triggers.
3. **Player acts:** play affordable cards, use flasks, inspect piles. Max hand is the Hand size row; with hand rules a draw stops at that size without consuming the draw pile (only a fight without hand rules sends excess drawn cards to discard with a "hand full" toast).
4. **Player turn end:** `playerTurnEnd` triggers; return unplayed cards except `Retain` (they shuffle into the draw pile by default); `Ethereal` cards in hand exhaust. Unspent Stamina is lost.
5. **Enemy turn:** each living enemy, in row order, executes its telegraphed intent; enemies lose their block at the start of *their* turn.
6. New intents are rolled (stream `enemyAI`), display updates, back to 2.
7. **End:** all enemies dead → victory (rewards); player HP ≤ 0 → death screen.

### 4.1a Ward and Barrier statuses

Ward and Barrier are stacked statuses (`ward`, `barrier`), not pools. The old numeric Barrier pool (`entity.barrier`, the `barrierGained` event, the `barrierMitigated` receipt line) no longer exists.

- **Ward** (`ward`)
  - Each stack decays by 1 at the start of its holder's turn (the same decay hook as every per-turn status).
  - While Ward is above 0, ALL incoming damage, physical and magical, goes to Poise first (100% of it); the overflow beyond Poise spills to Block; what is left reaches HP.
  - Applies to every damage path: single and multi-hit attacks, reactions and counter returns, enemy attacks on the player. Pierce still lets its fraction of what Block soaked through to HP. `loseHp` and damage over time ignore all of it.
  - The damage receipt and combat log show the Poise, Block and HP split.
  - While Ward is active the Poise badge is purple and a purple bar over the HP bar shows current Poise in HP points on the HP scale (10 Poise on a 50 HP bar covers 20%).
- **Barrier** (`barrier`)
  - Each stack gives +5 maximum Poise and +5 current Poise (`barrier.poisePerStack`, data).
  - Loses 1 stack per turn at the same hook as Ward; each stack lost removes its +5 maximum Poise, and current Poise is clamped to the new maximum.
- The `gainBarrier` opcode stays as a card's protection grant: every point is one Barrier stack. The same holds for stance-entry `protection.barrier`, enemy `barrier` grants and Ward overflow past a full pool. Barrier stacks also come from `applyStatus` of `barrier`.
- **Mote Shield** (`core.moteShield`) gains Ward 1 and Barrier 1 (Barrier 2 and Ward 2 upgraded).
- Saves: an old save or combat snapshot holding the numeric `barrier` loads and the number is dropped.

### 4.2 Damage math (order is contractual)

Order of the damage pipeline, block handling and the health-row display. Preview uses the same engine function as the hit.

For an attack dealing `base` damage:

```
dmg = base
dmg = dmg + card rating bonus                    // ratings (§13.4l) run first
dmg = dmg + school damage add                    // player cards with a damage school
dmg = dmg + attacker.Strength                    // may go below base
dmg = dmg * (attacker has Weak      ? 0.75 : 1)
dmg = dmg * (defender has Vulnerable? 1.25 : 1)   // D16
dmg = dmg * (defender is Staggered  ? 1.5  : 1)  // legacy ratings only (see below)
dmg = dmg * defender's Poise or Ward resistance  // ratings on; Ward for magical hits
dmg = dmg * (school resistance, then school vulnerability)
dmg = floor(dmg) + ceil(dmg × (tagged − 1))      // tag-scoped vulnerability, §3.7 (taggedBonusFloor); plain floor(dmg) when no tag applies
if dmg < 0 → 0
```

- The tactical matchup multipliers (§4.7) run after the floor.
- Staggered's ×1.5 is the `staggered` status's `damageTakenMult` and applies only under legacy ratings; with ratings on (the default) a break applies no status (§4.4).
- (§17, `docs/FIXCORE-DECISIONS.md` D17) In the configured Core path with Ward off, the magic part of a hit meets Poise first, then Block; the legacy order above is unchanged. *Superseded for new Core 2 fights (owner 2026-11-07, backlog #7): one damage kind; see §17, One damage kind in Core 2.*
- Multipliers and adders come from status `modifiers` (§3.7); the engine consults the status model, not named statuses. The order is `computeAttackDamage` in `src/engine/actions.js`.
- Multi-hit attacks compute per hit. Damage consumes Block first; the remainder hits HP.
- `loseHp` (Rot ticks, Bleed bursts, Madness) ignores Strength / Weak / Vulnerable / Stagger *and Block*.
- Block from a card = `base + Dexterity`, `× 0.75` if Frail, floored.
- Card preview numbers in the UI come from the same function (`previewCard(combat, cardInstanceId, targetId)`, which calls `computeAttackDamage`); no duplicated math in the UI (§3.13).

**Health row display**
- Ordinary Block is a blue shield beside HP; while positive, HP is blue (normal red or colorblind-safe color returns when it breaks).
- Block from a magical card carries optional `wardBlock` provenance inside the same Block total, shown as a purple Arcane Ward badge left of the shield with a gold HP outline. Ordinary Block is spent first for display; Ward is clamped to remaining Block after hits, caps and turn resets. Both badges sum to Block and absorb the same damage; Ward rating and its buildup meter are separate (no Ward meter in §13.4p's scope). Old saves without provenance show ordinary Block.
- Missing badges give their space to HP (stable row edge, readable minimum width for low-HP enemies). HP fraction is always current / maximum HP; narrow lanes show current HP alone (full value in the accessible label and tooltip). Solo playback and snapshots carry provenance with damage and guard receipts.

### 4.3 Card rules

- **Types:** Attack, Skill, Power, Curse, Status. Powers are removed from play when played (not exhausted; they don't hit the exhaust pile). Curses and Statuses are unplayable unless stated.
- **Keywords** (exact StS semantics; engine primitives per §3.7):

| Keyword | Meaning |
|---|---|
| Exhaust | Removed for the combat after play |
| Ethereal | Exhausts if in hand at end of turn |
| Innate | Starts on top of the draw pile |
| Retain | Not discarded at end of turn |
| Unplayable | Cannot be played |
| X-cost | Consumes all Stamina; effect scales via `{f:'energySpent'}` |

- **Upgrades:** every non-curse card has exactly one authored upgrade (`name+`), a partial override object on the card def (numbers, cost, keywords; a present `keywords` list replaces the base list, so upgrades can remove Exhaust). Ordinary cards keep a permanent per-copy run upgrade. Equipment-sourced basic cards instead resolve that upgrade from their source armament's run-owned Smithing tier, so every current and future copy from the armament changes together.
- **Draw:** empty draw pile + draw needed → the discard pile is shuffled (stream `shuffle`) into draw first.

**Smithing.** A run owns `smithingStones`, an `armamentLevels` map and idempotent reward claims.
- **Core:** armaments, armor pieces and shields level up 3 times. Steps +1, +1, +2 (effective bonus 1, 2, 4 after tiers 1, 2, 3; `equipment.upgradeBonuses.tierBonusSteps` = `[1,1,2]`); tiers 1, 2, 3 cost 1, 2, 3 Stones (`tierStoneCosts` = `[1,2,3]`).
- **Who reaches which tier:** a rest-site Smith reaches tier 2 at most (`shops.blacksmith.restSmithMaxTier`, 2; a rest row past it reads "Needs a Blacksmith"); a Blacksmith reaches tier 3. A Blacksmith takes `stoneDiscount` (1) Stone off every price here and in §13.4s, never below 0 (tiers 1, 2, 3 cost 0, 1, 2) and also charges cinders (§14.4).
- A weapon adds effective bonus × `weaponARPerTier` AR; armor and shield stat points follow the effective bonus (`armorBudget.perRank` per bonus point). Relics keep their authored cap. Core rank resolves at `rank + effective bonus`, never the raw tier. Existing tier-1 saves stay valid.
- Elite and boss victories award 1 Stone; normal and treasure reward pools award 0. Legacy equipment-card upgrade flags migrate to the source armament tier without granting Stones.

**Zero-cost cards and ramp**
- A card costing 0 SP and 0 MP sets `costRule: 'fixed'` (§4.3a) and keeps its authored cost and numbers. The same-stance SP bonus (§4.3a discount) never applies to it (a base of 0 is never discounted or repriced); the matching-stance effectiveness multiplier and the rating bonus still apply.
- It is not a cantrip and not a Basic: authored uncommon or rare, no `rank.cantrip` tag, very low damage or low Block. Upgrades may raise that number or add a **ramp**.
- `ramp` is an authored card field, allowed inside `upgrade`: `{ scope: 'combat' | 'run', stat: 'damage' | 'block', per: 1..3 }`. It grows the first `damage` (or `block`) effect (amount must be a plain number) by `per` for each earlier play of the card. Ramp lands last, after rank, upgrade and Smithing growth. It resolves in both card builders (`resolveCard`, game-profile `projectGameCard`) through `model/cardRamp.js`; the evaluated amount is `{ f: 'add', args: [base, { f: 'metric', metric: 'sameCardPlays', of: 'self', per }] }`.
- **Momentum** (`ramp.momentum`, scope `combat`): +`per` for each earlier play this combat. **Honed** (`ramp.honed`, scope `run`): the same, plus `per` for every play of this deck copy in earlier fights; usually paired with Exhaust. A card whose base or upgraded form has a `ramp` gets the matching tag when resolved.
- Run-wide count = the deck instance's `playsEver` (whole number from 0; absent is 0). Added from the fight's per-copy use counter at fight end (`src/main.js` onCombatEnd and `tools/runsim.mjs`, via `model/playsEver.js`), stamped back onto the fight's copies when a fight opens or is restored. Every card accumulates it; only Honed cards read it. `sameCardPlays` is keyed by card id, so two copies of one ramp card share the combat count.
- Core ramp cards (base → upgrade): Flick (3 damage → adds combat damage ramp), Pebble Throw (2 → 4), Brace (2 Block → adds combat Block ramp), Quick Guard (3 Block → 5), Whetstone Nick (rare, 2, Exhaust, run ramp → 3), Tempered Edge (rare, 1, Exhaust → adds run ramp 2).

### 4.3a Action costs

Every card's Stamina (SP) and Mana (MP) cost is derived by formula, in every fight. Tunables: `content/actionCosts.js`; rules: `model/actionCosts.js`. `registries.resolveCard` runs the derived step once per resolved card and rank, after the upgrade and before equipment and status mods. Weights and calibration: [docs/alternative-combat-rounds/COST-WEIGHTS.md](docs/alternative-combat-rounds/COST-WEIGHTS.md) (a test fails when it and the config disagree).

**Formula** (each resource priced on its own side)
- `S_sp` = `damageWeight` × physical damage steps + `rankWeight` × rank + Σ SP-side tag weights + range weight + `castingEffortWeight` (cast card) + SP-side statuses × stacks + drawback weights (negative).
- `S_mp` = `damageWeight` × magical damage steps + `rankWeightMp` × rank (magical card) + Σ MP-side tag weights + MP-side statuses × stacks.
- **SP** (`cost`) = floor(`S_sp` / `spDivisor`); **MP** (`manaCost`) = floor(`S_mp` / `mpDivisor`). Each sum is floored at 0 first.
  - If both are 0 after the maneuver floor, the larger side pays 1 (SP on a tie, and for a card that restores Mana). A floored smash or sweep already pays SP and is not also charged 1 MP.
- **Restores break even.** A card restoring Mana adds `restoreWeight` × that Mana to its MP; one restoring Stamina adds `restoreWeight` × that Stamina to its SP. The face shows the full price.
  - The card's own restore pays that part: `applyActionCosts` marks it `funded` on the restore effect; `resolvedCardPlayCosts` charges the price less `ownRestoreFunds(def)`; the restore gives back its amount less `funded`.
  - So it is castable at 0 of that pool and changes it by exactly 0 (Attune, Ember Communion: 1 SP, 1 Mana, net Mana 0).

**Terms**
- **Magical** card: carries any MP-side tag; its damage and applied statuses count on the MP side.
- **Damage** counts its hits; the `damageSteps` table turns it into points (each threshold reached adds `damageWeight`; an empty table means damage × `damageWeight`).
- A **tag** counts once per card, weight -3 to 3.
- **Range weight** = the largest range among the card's delivery and reach tags (melee 1, reach 2, ranged 3).
- An applied **status** (`applyStatus`, or `buildup` as one stack) weighs 2 or more × stacks; `statusStackCap` (none by default) caps priced stacks.
- **Cast card**: `camp:spell` or `maneuver:casting`.
- **Rank** = rank above the base: an ability grade's own rank (0–5), or a legacy instance rank minus 1 (§13.4o); a base card is rank 0. Each rank is priced; on a magical card it weighs on both sides.
- **Drawbacks** (negative SP-side weights; a side never goes below 0): Exhaust, Ethereal, a curse or status added to the player's piles (`addCard`), an HP or other resource cost (`loseHp`), a discard (`discard`), several turns to cast (`grantCardCharge`).

**Shipped tunables**: `spDivisor` 6; `mpDivisor` 8; `damageWeight` 1.5 on steps 1 / 3 / 5 / 8 / 12; `rankWeight` 1; `rankWeightMp` 4; `castingEffortWeight` 6; `restoreWeight` 1; `statusWeight` 2 (no stack cap); `smashPoiseBase` 3; Ethereal -1; smash, sweep and heavy tags 0 (the floor prices a base smash).

**Targets**: most basic and cantrip cards cost 1 Stamina and no Mana; smashes and sweeps cost 2; rank 1–2 cost 1 SP + 1 MP, or 2 SP; most rank 1–3 spells cost 1–2 Mana; many magic cards cost at least 1 SP (0-SP magic still possible); higher SP usually means lower MP.

**Layering and opt-outs**
- The derived SP and MP replace the authored `cost` and `manaCost`. Per-card rules then apply on top: relic and power reductions, Mana discounts, upcast surcharges. Equipment and status mods apply after, so a mod's flat bonus is added to the scaled number and not scaled.
- Opt-outs (keep authored cost, Mana and numbers): `costRule: 'fixed'` content, curses and statuses (by type), X costs. Every other card is priced, the Dodge Roll and powers included.
  - `costRule: 'fixed'`: warriorsVow, twinkling, shootingShard, bloodPact, bloodletting, painOffering, rogueShiv, smokePellet, setupRogue, prepare, hex, blindingSand, hamstring, masterOfStrategy, blightedTransmute, blightedSecondBloom, blightedBlightward; Core zero-cost cards (§4.3): core.flick, core.pebbleThrow, core.brace, core.quickGuard, core.whetstoneNick, core.temperedEdge.
  - By type: curses (guilt, wound, dazed), statuses (slimed).

**Smashes and sweeps**
- At rank 0 each costs at least its floor (`MANEUVER_SP_FLOORS`: 2). A higher rank has no floor; an authored upgrade that lowers the cost lowers the floor by as much.
- A smash at 2 SP or more scales its damage and Poise damage. A sweep at 2 SP or more keeps its damage unscaled (`SWEEP_UNSCALED_OPS`) and scales its other riders.
- Every smash adds `smashPoiseBase` (3) to its own Poise damage, or gains a Poise damage effect of that amount on its first damage target, at every rank; its face names it.

**Balance rule** (provisional default)
- A card with derived SP 2 or more has its numeric effect amounts multiplied by `twoCostMultiplier` = **1.8** and rounded. A 1-SP card keeps base values. Cost is priced on the unscaled face. Card text shows the scaled numbers.
- Scaled (`SCALED_EFFECT_OPS`): `damage`, `block`, `buildup`, `heal`, `gainBarrier`, `gainPoise`, `gainWard`, `poiseDamage`, `wardDamage`. Never scaled: costs, card counts (`draw`, `discard`, `addCard`), turns and durations, stack counts, hit counts, HP or Mana prices.
- Known gap (expanded rules v2): effects the projection adds after the derived step (e.g. Shield Bash's Block 5) are not scaled; its counter reply is projected from the scaled damage.

**Validation.** `validateCostConfig` refuses, by name: a tag weight outside -3..3 or not whole; a negative weight on a non-drawback tag; a side other than SP or MP; a range weight outside 1..3; a status weight outside 2..3; a non-positive budget number; a non-ascending damage step table. `validateActionCostTable` refuses a bad enemy stance price (§4.6a). The card schema admits `costRule`; only `'fixed'` is valid.

Falsify (tests: `action-costs-formula.test.mjs`, `action-costs-cards.test.mjs`, `action-costs-weights-doc.test.mjs`):
- A dry Herald cannot cast Ember Communion.
- A magic card's Mana does not rise with its rank.
- Ethereal never raises a cost; Exhaust never raises a cost.
- Sword Strike (3 damage, bladed, physical, slash, all weight 1, D = 20) sums to 6 and costs 1 SP.
- Moving points from the MP side to the SP side never lowers SP or raises MP.
- A grade's Mana in the framework cost profile is the formula's.

### 4.4 Status effects

All statuses, the Elden Ring layer included, are data objects in `content/statuses.js` over the generic status model (§3.7); none has engine-side special cases.

**Enemy weaknesses to a status**: an enemy authored weak to a status (`stacks`) takes extra stacks whenever an opponent applies it; one weak to its damage (`tick`) takes Burn and Venom ticks and Bleed and Frost bursts multiplied (default ×1.5).

**Common (StS layer)**

| Status | On whom | Effect | Decay |
|---|---|---|---|
| Strength | any | +N attack damage per hit | permanent |
| Dexterity | player | +N block from cards | permanent |
| Weak | any | deal 25% less attack damage | −1 stack at owner's turn end |
| Vulnerable | any | take 25% more attack damage | −1 stack at owner's turn end |
| Frail | player | 25% less block from cards | −1 stack at turn end |

**Threshold-proc statuses** (Bleed, Frost, Insanity)
- A proc status builds points toward a **constant** threshold; points do not decay.
- At the threshold the target takes percent-of-its-max-HP damage as **its own proc** (its own event and damage-record entry, never folded into the triggering hit). The build-up then **resets to zero** (overflow dropped).
- If the target carries a listed creature tag it gains a short resistance status (strength on the resist row, duration in its decay, gate in the proc row).
- Declared per row: `threshold, burstPercent (of target max HP), burstMin/burstMax, poiseDamage (per proc), stagger (direct), effects, resistance {status, tags}`. Schema and validator enforce every knob (`model/schemas.js`, `model/validate.js`).
- Tag-scoped extra vulnerability composes by a declared `stacking` rule (closed enum: additive | multiplicative). **Its bonus rounds up**: the hit's damage without the exposure floors as usual and the exposure's share is added rounded up (`taggedBonusFloor`, `model/combatRules.js`), so a base-3 tagged card still gains a point. Preview and hit share the one derivation. Every other multiplier, plain Vulnerable included, keeps its floor.
- Every threshold-proc number is PROVISIONAL in its own row and is not restated in this spec. Read them from the rows:

```
node -e "import('./src/content/statuses.js').then(m=>m.statuses.filter(s=>s.proc)\
  .forEach(s=>console.log(s.id, JSON.stringify(s.proc))))"
```

**Elden Ring layer**

| Status | Mechanic |
|---|---|
| **Bleed** (threshold-proc) | Fleshy targets (beast/humanoid) gain a bleed-resist status after a burst. Adds Poise damage per proc. |
| **Frost** (threshold-proc) | The smallest burst of the three. The proc leaves **Weak** plus a tag-scoped exposure that raises `starstone`-tagged damage. |
| **Insanity** (threshold-proc) | The largest burst, hardest to fill. Adds Poise damage **and a direct Stagger** that bypasses the meter (neither fills nor grows it) but is otherwise the same Stagger a full meter is: the skipped turn and the `staggered` status, so every Staggered-gated rider fires. Leaves an exposure on `ritual`/`blight`-tagged damage. **Not** the player-side Madness below. |
| **Crimson Blight** (`crimsonBlight`) | DoT on enemy: N `loseHp` at its turn start. Stacks **do not tick down**; it lasts **3 of its turns**, then expires entirely. Re-applying adds stacks and refreshes duration. Ignores block. |
| **Necrotic Blight** (`necroticBlight`) | Applied by the **Necrotic** damage type (§4.7) and nothing else. Same tick as Crimson Blight (N `loseHp` at its turn start, ignores block, no stack decay) but **lasts the whole fight** (decay `none`); only a cleanse removes it. All other Crimson Blight (enemy moves, Herald cards, relics, flasks, equipment mods) keeps the 3-turn duration. Herald payoffs that read Blight stacks count both rows. |
| **Venom** (`venom`) | DoT: at its turn start the owner loses HP equal to its stacks (ignores Block); one stack expires each turn. Applied by Poison-typed hits (§4.7) and `applyStatus`. |
| **Confused** (`confused`) | On enemy: deals 10% less damage; at its turn start 50% chance to take 3 Poise damage per stack. 1 stack expires each turn. Applied by Psychic hits (§4.7). |
| **Slowed** (`slowed`) | On enemy: deals 10% less damage and gains 25% less Block. 1 stack expires each turn. Applied by Earth hits (§4.7). |
| **Entombed** (`entombed`) | On enemy: skips its next turn and takes 25% less damage until it ends. Card-applied only; no damage type applies it. |
| **Burn** (`burn`) | Third damage-over-time row, applied by `burn`-tagged effects and equipment mods (`equipMods.csv`). |
| **Silenced** (`silenced`) | On enemy: spell-camp moves deal 50% less damage for 2 turns. Its only modifier is `spellDamageDealtMult` (closed `MODIFIER_TYPES`), which scales the spell-camp damage its owner deals and leaves physical damage alone; preview and hit read the same multiplier. |
| **Madness** | On player (from enemies/curses): at turn start lose 2 HP per stack but gain 1 Stamina per stack, then Madness clears. |
| **Poise / Stagger** | See below. |

No `frostbite` status ships; the frost identity is the **Frost** proc row and its `frostExposed` exposure.

**Poise / Stagger**
- Every enemy has an authored `poiseMax` (4–40 by enemy). Physical impact fills the Poise meter (shown under HP). The bar under HP shows Poise left in both modes: full when untouched and draining (the Core `persistentPoise` pool already counts down; the legacy fill-up meter is drawn inverted). Poise does not decay by default.
- When full the enemy becomes **Staggered**: its next turn is skipped (intent replaced by "Staggered"), the meter keeps any overflow, and its threshold grows ×1.25 (rounded up).
- A direct Stagger (Insanity's proc) uses the same break path but neither consumes nor grows the meter.
- Every enemy break (Insanity's and a status-gauge Poise break alike) also applies the `staggered` status: +50% attack damage taken until the end of the *player's* next turn.
- **The player has a meter too** (§13.4k): max = the one `poise` stat row (§3.5, §13.4l) + body armour + relics; impact fills it; a fill opens the next turn one Stamina short and applies `balance.stagger.player`'s statuses (2 Vulnerable, 2 Weak).

### 4.5 Stances (Reaver mechanic)

At most one stance is active; stances are combat-scoped. Entering a stance exits the previous (`stanceExited` then `stanceEntered`). Some cards read "If in [stance]: bonus" (predicate `inStance`). The stance icon shows beside the player's status row.

| Stance | While active | On entering |
|---|---|---|
| Gorefire | Your attacks apply +2 Bleed | Take 2 damage (ignores block) |
| Bulwark | Whenever you play a Skill, gain 2 Block | Gain 3 Block |
| Brace | Damage taken ×0.75 | Gain 4 Block; leaving it for another stance gives 1 Strength |

### 4.6 Enemy intents

What the player sees of an enemy's next action, and how enemies pick moves.
- Read Intent resolves by contest, not Accuracy or range (§17 Contests).
- Legacy unprofiled enemies show next action as icon + live number: Attack, Block, Buff, Debuff, Unknown or Staggered. Profiled enemy moves follow §4.7: stance stays visible, the engine may conceal the move and exact values. Revealed Attack values show exact total damage (`n×m` for multi-hit), including current attacker and defender modifiers.
- Move selection: per-enemy **weighted state machine** on stream `enemyAI`, with StS-style repeat constraints per move (`maxConsecutive: 1|2`).
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

### 4.6b Enemy intent commitment

The intent shown is what the enemy does.
- **Commitment.** The plan rolled at the start of the player's turn (the intent plus planned follow-ups, §4.6a) is the committed plan; no re-roll or re-plan between showing and acting.
  - Exception: a shown move that became impossible (target gone, out of range with no way to close, unaffordable). The intent then changes visibly, as soon as it becomes impossible and during the player's turn; an enemy never swaps or refuses a shown move silently at act time.
  - If the shown move needs an unaffordable Advance and the enemy has an affordable range-closing move, that move replaces it at that moment.
- **SP lost before acting** (Poise break or weakness, §4.6a). The queued plan is recomputed against the SP it will have.
  - Moves it can no longer afford leave the plan, the earliest affordable ones stay in order, and the intent updates at once; if none is affordable it shows **Staggered** with no number for the turn (2026-11-14; it read `?` before).
  - Trimming picks nothing new, draws no `enemyAI` roll, and removes dropped moves from `movesHistory` (so `maxConsecutive` reads what will play).
- **Reaction SP carries over.** The SP an enemy pays for a reaction during the player's turn is added to its `pendingStaminaLoss` as paid, so its next turn-start refill (max minus pending loss) is smaller by that amount. It is owed once (the stamina spent now only gates further reactions this turn). The plan is then trimmed as above.
  - The reaction's Advance surcharge (§4.6a) is owed the same way. A reaction or Advance in the enemy phase draws on that turn's own pool and carries nothing.
- The check runs after every player action. A saved fight carries no extra state for it (the plan is `intent` plus `plannedMoves`); a fight saved without a plan loads as before.

### 4.6a Enemy SP pool

Enemies act from an SP pool derived from their stats; each move has an SP price.

**Move prices**
- Base price = the move's authored `sp`, else the stance-table price (`ACTION_COST_TABLE`): attack 1, block 1, smash 2, counter 2, cast 2, sweep 2; a move with no priced stance costs 1.
- **Multi-hit floor.** A move making repeated hit contacts on one target costs at least max(hits − offset, 1) SP when that exceeds its price after discounts.
  - Offset: 0 ordinary (1 SP per hit), 1 `finesse`, 2 a move that costs Mana (largest that applies). Offsets and minimum: `MULTI_HIT_SP_FLOOR` in `content/source/actionCosts.json`.
  - Hit count: damage effects guarded by an `if` are separate branches and the largest branch counts (an either/or pair is one hit; a conditional bonus volley is not added). No cap; an authored price above the floor is not lowered. Charged once for the committed move.
  - Not multi-hit: one contact hitting several targets (area), one contact split into physical and magical damage, an ordinary one-hit root action in a multi-action turn.
  - Player cards use the same floor (`multiHitSpFloor`, `src/model/actionCosts.js`), applied to the paid price where the Core cost is read (`baseCardPriceReceipt`), never to the derived cost (so it never triggers the 2-SP damage multiplier).
  - The same-stance discount never raises an authored zero-cost move; the separate multi-hit price still applies to multi-hit moves.
- The multi-hit floor, finesse Dexterity scaling and the persistent paid Advance are Core 2 action rules version 2 (`CORE2_ACTION_RULES_VERSION`); a fight saved under version 1 keeps version 1 pricing and a temporary Advance until it ends.

**Pool size**
- SP = `ENEMY_SP_ROW` (1 + floor(0.25 × Dexterity) + floor(0.25 × Constitution) + floor(0.2 × Wisdom) + floor(0.2 × Intelligence), on the enemy's `attributes`) + `equipmentSp`, floored at 0. Core enemies carry the player's stat budget at their level (§17, *Enemy levels and stat budget*); legacy profiles keep their authored attributes.
- Bands (`ENEMY_SP_BANDS`, test-held for every shipped enemy): normal 1–2, elite 2–3, boss 3–4. A test fixture may fix a pool with `spPool`.
- **Blight:** a `blighted` enemy's attributes shift by `ENEMY_BLIGHT_SHIFT` (−2 Intelligence, Wisdom, Dexterity; +2 Strength, Constitution; floored at 0) wherever stats are read (Blight Hound, Blighted Valkyrie).
- **Live budget.** The pool is the enemy's actual Stamina budget and available SP at the turn-refill / pending-loss boundary used by execution.
  - Planning quotes which moves fit without spending or reserving SP; a quote includes any Advance surcharge. A scripted opener or first move whose full quote does not fit cannot be committed.
  - At the start of each move's execution, revalidate its quoted cost against current SP and pay only if it still fits. If no move can be committed the enemy has no move this turn (no unaffordable-first-move fallback).
  - Ordinary affordable root actions may chain while SP remains; no boss one-action cap.
- **Versioning.** Each new fight stores `core2ActionRulesVersion: 1` and uses these budgets and prices. An active saved fight without the field finishes under its previously accepted prices and queues: no repricing of pending quotes, no retroactive preparation charge, no second payment.

**Spending and reactions**
- SP is paid once when a move starts executing, before its effects or preparatory benefits; a charging move pays at the start of charge preparation. The committed-move receipt travels with its queue entry through resolution and save/resume (no second charge).
- An enemy reaction pays its quoted SP when enqueued, before effects; an unaffordable reaction is refused; its receipt prevents double payment; paid SP is not refunded if it later fizzles.
- A charging (delayed) move ends the enemy's turn; planned follow-ups do not play after it. A staggered enemy plays none of its plan that turn; a staggered or held enemy keeps the rest of its plan for its next turn.

**Plan and intent box**
- At the start of the player's turn each enemy plans the actions that fit its live SP. The first planned move is the intent; committed moves play in plan order in the enemy phase, each revealed as it plays. The plan is saved with the fight.
- The intent box shows the first move as the main intent and every committed follow-up as a symbol beside it at the same size, on the player's turn and through the enemy phase, under the per-slot concealment rule (§4.9). An unrevealed move shows `?` until it plays or is cancelled; its fate is never shown before its own event.
- **The row advances when each action resolves.** Once a move's animation and effects have resolved and the same actor announces another move, that move leaves the follow-up row and takes the head slot at once, drawn as its own symbol only (its icon if the Perception read of that move passed, else `?`; never a value, never more than the row showed). The next move's own announcement then replaces it with the real intent and does not advance the row again. The head shifts left and grows into place (about 220 ms, presentation only: nothing waits on it, and it is skipped under reduced motion or the Instant pace). With no further move the intent clears at resolution as before.
- The intent's damage number sits left of the stance icon; the hit-% badge is centered on the target's sprite in white text with a black outline.

**Other rules**
- **Silenced:** a spell-camp move costs one more SP per Silenced stack on the enemy, as a player's spell card does (`spellCostSurcharge`, `model/combatCardProfile.js`); affordability and the plan's spending both read the surcharged price.
- **Enemy schema:** `attributes` (whole numbers by attribute id), `equipmentSp` (whole number), `blighted` (true); a move may carry `sp` (whole number, 0 or more).

**Tier-1 targets** (greedy-bot win rate per class): bosses 10–25%, normals 50–75%, elite 25–50%. Tuned through enemy data only: stats (SP within the bands, HP, move damage), equipment, move SP. Every tier-1 minion has SP 2. Measured table: `docs/BALANCE.md` §5. Bosses (authored/base prices; no further class levers, bosses stay as tuned):

| Boss | SP | Str / Dex / Con / Wis / Int | Moves (SP) |
|---|---|---|---|
| Fell Warden | 3 | 9 / 4 / 4 / 3 / 3 | Cane Strike 1, Hammer Toss 1, Held Blade 1, Twin Daggers 3 |
| Bell Keeper | 4 | 10 / 4 / 4 / 5 / 3 | every move 1 |
| Thorn Matriarch | 4 | 6 / 4 / 3 / 5 / 5 | Root Crown 1, Thorn Needles 1, Entwining Roots 2 |

Shipped values live in `content/actionCosts.js` (stance table, 1.8 multiplier, card-cost tunables) and `content/derivedStats.js` (stamina row).

### 4.7 Tagged combat cards and readable enemy stances

**Contract status: implemented** (version-1 table; §4.8 carries version 2). It extends ordinary action resolution for authored tactical profiles; it does not replace persistent class stances (§4.5), add a card type, or claim the full combat/equipment cutover is complete. Design examples: [combat-cards-design](docs/combat-cards-design.md). Candidate rules, not in force: [Combat expansion notes](docs/combat-cards-expansion-proposal.md).

**Identity and authoring**
- Cards and enemy moves share combat camps `physical` and `spell`.
  - Physical maneuvers: `attack`, `defend`, `counter`, `sweep`, `ranged`, `smash`. Defensive or reactive spell cards may also carry `defend` or `counter`; utility cards may carry no maneuver.
  - Spell schools: `frost`, `fire`, `lightning`, `force`, `alteration`, `illusion` (the school of Psychic damage), `divine`, `decay`, `earth`. School describes an authored ability family; it does not silently create a status, refund, draw or defensive effect (those stay printed recipes).
  - Damage identity is independent: a physical weapon can inflict Cold, an Alteration spell can inflict Piercing.
- Authored tag source (only): `content/source/nodes.csv`, `familyNodes.csv`, `tagFamilies.csv`, `tagging.csv`.
  - Namespaces `camp:*`, `maneuver:*`, `school:*`, `counter:*` prevent collisions with `classification.attack` and class stances.
  - Each carrier has one camp, at most one maneuver, one school (a spell has one school). Counter reach is `melee`, `ranged` or `spell` and appears only on Counter carriers.
- Enemy actions are family `enemyMove`, source `enemyMoves`, scoped by `enemyId`; whole key `(enemyId, moveId)`. Flattening move tables for validation creates no second definition. Registered enemy moves get their own joined tags and never inherit creature identity as an attack profile.
- Runtime `combatProfile` = `{ camp, maneuver, school, damageType, counterMode }`; unassigned values are `null`.
  - Weapon attack cards carry a fixed `damage:*` tag in `tagging.csv` that sets their damage type; the equipped weapon still supplies the attack source and identity otherwise.
  - Active registry tags and equipment `cardTags` (explicit empty arrays included) are authoritative, with no global shipped fallback.
  - Expanded combat (v2): a spell's reach follows its delivery (`delivery:projectile` far, `delivery:melee` contact, otherwise near) unless its expansion row or the far list sets it.
- Stable damage IDs: `blunt`, `piercing`, `slashing`, `frost`, `fire`, `lightning`, `arcane`, `sacred`, `decay`, `poison`, `psychic`, `earth`. Player-facing labels: Cold (`frost`), Force (`arcane`), Holy (`sacred`), Necrotic (`decay`) (a later rename switches Cold to Frost). Accepted input aliases create no duplicate tag identities or damage components.

**Physical matchups and timing**

| Maneuver | Implemented matchup contract | Answer and limit |
|---|---|---|
| Attack | Against prepared Smash, delayed/charging action or spellcasting, multiply listed and ordinary Poise pressure by 1.5; HP damage gets no automatic bonus | Guard and eligible melee Counter answer Attack. The bonus does not itself cancel or stun; normal break rules decide that |
| Defend | Resolve printed protection/support normally | Smash rewards attacking physical Guard. No automatic immunity or free retaliation |
| Counter | Prepare one deferred reaction plus Guard/Ward support (below) | Sweep, Force, Piercing and physical Ranged bypass melee Counter; bypass does not consume it |
| Sweep | Windmill-style attack bypasses melee Counter | Guard can absorb it. Ranged cards avoid melee replies, not the damage of every enemy melee move |
| Ranged | Physical projectiles do not trigger melee Counter | Ranged Counter or Spell Counter can intercept them. Defensive Alteration uses its printed Ward/Guard effects |
| Smash | If physical Guard is positive before the hit, multiply HP damage by 1.5. Breaking that Guard adds 3 Poise damage | Fast Attack pressures preparation; eligible melee Counter halves and may return the hit. Ward alone does not grant the Smash multiplier |

- Tactical multipliers apply after normal damage / typed-defense calculation and critical resolution, before Block absorption; floor the nonnegative result. Preview uses the same calculation without consuming charges, draining Ward, applying statuses or advancing random streams.

**Counter**
- Immediate support stays: printed Block, draw, preparation, hostile statuses. Its `damage` and `poiseDamage` effects become deferred base reply values.
  - Their conditions are evaluated after normal card preparation / payment and before queuing the Counter's immediate support or granting its Guard/Ward; the Counter's own Block must not satisfy its deferred damage conditions.
  - Counter targeting excludes only those deferred effects: immediate hostile support still requires an eligible foe.
- Guard / Ward: a Counter without printed Block grants 4 base Guard; every Counter grants 2 base magical Ward (existing Block/rating rules apply). A card with no printed HP damage has default reply base 6 (configurable). A new Counter replaces the previous reaction; charges never stack.
- Lifetime:
  - Player Counter survives the ensuing enemy phase and expires at the player's next turn start.
  - Enemy Counter becomes active and grants its Guard/Ward once when its visible next stance is selected (protecting it through the player phase); executing that move does not grant it again; it expires at that enemy's next turn start.
  - Stagger immediately clears that entity's armed Counter (including a stance already prepared before the player phase); it cannot retaliate while interrupted. Death also prevents retaliation. Turn-skip and delayed-move cancellation rules remain authoritative.
- Trigger: the first eligible **positive** incoming attack consumes the single reaction and the hit is multiplied by 0.5.
  - Full absorption (`HP loss = 0` and blocked amount covers the reduced positive hit) queues retaliation against the attacker: `floor(baseReplyDamage × 1.5) + 5 + explicitBonus`. Partial absorption or a zero reduced hit gives no reply.
  - Listed positive reply Poise damage = `floor(baseReplyPoise × 1.5)`; an absent listed value creates none.
  - Reaction actions carry an explicit reaction marker and cannot start another Counter or damage-rider chain.
- Coverage:
  - Melee Counter: physical Attack/Smash except physical projectiles, Sweep and Force/Piercing.
  - Ranged Counter: physical projectiles only; suppresses Piercing's Guard bypass for the intercepted hit.
  - Spell Counter: incoming spells or physical projectiles, same Piercing interception. Against a physical projectile it drains Ward only (no HP / ordinary Guard spill, no reply Poise); against an incoming spell it may return ordinary Health-capable damage. The incoming move determines caster eligibility, so hybrid enemies behave correctly.
- Enemy Counter base damage = explicit `counterDamage` metadata, falling back to ordinary move damage, then the configured default. Optional `counterPoiseDamage` supplies its listed reply Poise. Existing support payloads and weighted move-selection numbers are retained.

**Damage riders.** (Legacy and expanded profiles; in Core 2, *School statuses* (§4.7) replaces them.) Riders resolve once per committed root action (player card or enemy move) and target, with no reaction chaining. Status riders require positive HP loss; an already printed matching status suppresses the extra automatic one. Multi-hit cards get no extra rider per hit.

| Damage label | Rider |
|---|---|
| Blunt | +2 Poise damage |
| Piercing | Bypass up to 2 physical Guard once; melee Counter bypass, except specialized ranged/spell interception |
| Slashing | Apply 1 Bleed after HP loss |
| Cold | Apply 1 Frost after HP loss |
| Fire | Apply 1 Burn after HP loss |
| Lightning | Apply 1 Weak, presented as Sap, after HP loss |
| Force | Strip up to 2 Ward; bypass melee Counter. Ward drain never spills into HP or ordinary Guard |
| Holy | After HP loss, cleanse one stack from the attacker's first eligible hostile status in configured priority order |
| Poison | Apply 1 Venom after HP loss (v2: 4 Venom build-up). Not reduced by armour class. Constructs halve Venom build-up; undead take it normally |
| Psychic | Apply 1 Confused after HP loss. Not reduced by armour class |
| Earth | Apply 1 Slowed after HP loss. Not reduced by armour class; absorbed by Ward |
| Necrotic | Apply 1 Necrotic Blight after HP loss; unlike Crimson Blight (3 turns) it lasts the rest of the fight (§4.4) and Holy cleanses remove it. Combat status buildup, not persistent run corruption |

**Technique riders** (`tagRiders`, beside `damageRiders` in both the v1 and v2 tables). Resolved with the damage riders (once per root action and target, sharing that budget, no reaction chaining). A frozen table without `tagRiders` has none.
- **Precision** attacks bypass up to 4 Block (the larger of this and a Piercing bypass, never the sum).
- **Gorefire** attacks apply 1 Burn after HP loss (v2: 4 Burn build-up) unless the card prints Burn.
- **Oath** is not a hit rider: while the player has not entered a stance earlier **this fight** , playing an Oath card grants 2 Block (`balance.tagMechanics.oath.block`). It is data: every class card carries the `oathKept` property rule, whose `stanceEntered` trigger sets the fight-long `stanceShifted` marker status (decay `none`) and whose `cardPreparing` trigger grants the Block while that marker is absent, so the card that enters the first stance still counts as kept.

**Enemy elemental resist**
- Under version 2, an enemy row in `combatExpansionEquipment.enemies` may carry a `resist` map beside `weak`, in percent (tiers 25 minor, 50 major; capped at 75 like armour resistances).
- Every damage path (live hit, foundation components, preview) applies one line per damage type: `amount = max(0, ceil(total × (1 + weak/100) × (1 − resist/100)) − flat)`.
- One row never both resists and is weak to the same type (the validator refuses it). About 10 to 15% of enemies resist an element, so a mono-element deck is dented, never walled.

**Enemy weaknesses in Core**
- Every enemy carries an authored `weaknesses` array (enemy schema; `content/source/act{1,2,3}Enemies.json` and the Core pack's `characters.json`; 1–3 rows, bosses exactly one): `[{ to, effect, amount? }]`. The expanded-path `weak`/`resist` maps are untouched; Core reads only this field.
- `to`: a physical type (`blunt`, `slashing`, `piercing`); `magic` (legacy and expanded profiles, and Core 2 fights saved before `damage.unified`: the hit has any magic share); `spell` (Core 2 under `damage.unified`, owner 2026-11-07: a hit from a spell-camp card or move only; an element-imbued weapon (Elemental Weapon, `imbuedElements`) triggers its element, not `spell`, and a melee-spell hybrid triggers `spell` only if it is spell-camp; this is intended; existing `to: "magic"` rows become `to: "spell"`, and a saved run's `weaknessDiscovery` keys `magic:*` become `spell:*` at load, idempotently, with no RNG draw; the rename skips fights still running on the old split, so a mid-fight save keeps its `magic:*` keys and its enemy rows still match); an element (`fire`, `frost`, `lightning`, `sacred`, `decay`, `arcane`, `earth`, `psychic`, `poison`); or, for the status effects, a status (`burn`, `bleed`, `paralysis`, `frost`, `chilled`, `venom`, `vulnerable`).
- A hit's triggers: its wielded weapon's physical type, `magic` (or, under `damage.unified`, `spell`; a spell hit then adds no default physical type), and each element it carries (its school or damage type, its damage components, any element an attacker status adds to weapon attacks; Elemental Weapon works in Core, the fire element is enabled for configured profiles).
- Effects:

| Effect | Rule |
|---|---|
| `damage` | Multiplies the hit by (1 + amount/100), default 25, as receipt stage "Weak to X" right after Vulnerable (each matching row multiplies; the chain floors once) |
| `stacks` | Adds amount stacks (default 1) when an opponent applies that status |
| `tick` | Multiplies that status's own damage (burn and venom ticks, bleed and frost bursts) by (1 + amount/100), default 50 |
| `mana` / `stamina` | Takes amount MP (SP next turn) from the enemy when the hit lands, default 1 |
| `stagger` | Staggers on a landed hit with amount percent chance (default 25, `combatProcs` stream); shares the one stagger per target per round |

- Shown as they land by the combat log, a `weaknessTriggered` event and the "Weak!" callout.
- **Discovery:** an enemy's weakness is hidden until the player triggers it.
  - The first `weaknessTriggered` event for a row records it in the run's `weaknessDiscovery` ledger, `{ [enemyId]: ['to:effect', ...] }`, keyed by enemy type: it then shows for every enemy of that type for the rest of the run, through save and load (a restored fight re-derives it from its event log). The title-screen bestiary lists none (the ledger is per run); the inspector's traits, the bestiary and two HUD chips are also listed as showing weaknesses.
  - Only a discovered weakness draws a HUD chip (up to two, under the nameplate) or a "Weak to X" inspector line; an undiscovered one shows nothing, not even a placeholder.
  - A chip is a fixed square, the size of a combat badge, holding the trigger's own mark (damage-type, element or status symbol, `model/weaknessIcons.js`, never a letter); tooltip on hover, focus and tap ("Weak to Piercing: +25% damage"), same text as its accessible name.

**Lightning, Shocked, Damp and Bedrock.** Core combat on the Lightning damage type; the Lightning rider (1 Weak after HP loss) is unchanged in the legacy and expanded profiles; in Core 2 the Weak comes from *School statuses* below.
- **Spark** (`core.spark`): Core Cantrip (tags `rank.cantrip`, `lightning`, `school:lightning`), 3 Lightning damage, 1 SP, 0 MP (a cantrip costs no Mana); upgraded 4.
- **Lightning hit** = a card or enemy move with the `lightning` tag or dealing Lightning damage.
  - *Metal conducts:* a target using metal equipment (row `material: metal`; Core weapons, shields, armour are tagged) takes the hit at +1 Precision for the attacker (+1 Accuracy on that hit).
  - *Shock contest* (stream `combatContest`): after HP loss the hit tries to inflict 1 Shocked. Roll d20 + (target's current Shocked stacks × (caster INT + WIS + card rank)) vs DC = target's current Poise + STR + DEX + CON + level (d20 helper `engine/d20Chance.js` and the roll log; the receipt shows total vs DC). Card rank = the played copy's `cardRank` (§13.4o; 1 when absent). Success: 1 Shocked.
  - A **Damp** target gives the caster advantage (roll twice, keep higher). A caster *wearing metal equipment* rolls with disadvantage (keep lower); a natural 1 on the kept die deals the spell's damage to the caster instead (target takes none, no Shocked). Advantage and disadvantage cancel.
- **Shocked:** stackable; each stack is -1 Precision (-1 Accuracy); -1 stack at the end of its holder's turn.
- **Damp:** stackable; -1 stack at the end of its holder's turn.
  - Lightning hit on a Damp holder: advantage on the shock contest. Burn stacks applied to a Damp holder are halved (rounded down, at least 1 when any were applied).
  - Any Fire hit (fire school or damage type, or a card applying Burn) that deals HP loss to a Damp holder removes all its Damp.
  - Enemies that open Damp say so in `startStatuses` (Stitch Crab: 2).
- **Bedrock** (earth, badge: a rock): stackable defence; each lightning hit on a holder is fully absorbed (no HP loss, no Shocked, no riders) and removes 1 stack. No decay. Earth-element enemies (authored `element: earth`; Charred Colossus) begin each fight with 3. The Shocked contest and Bedrock are Core combat only.

**School statuses (owner 2026-11-07).** In Core 2, after a hit from a card or move of a school deals HP damage, the target gains that school's status, once per action per target, and not when the card already prints that same status. The data is `schoolStatuses` in `content/source/fixCoreMechanics.json`, keyed by school; with no school, the damage type through the existing aliases decides. fire: 1 Burn. lightning: 1 Weak (the Shocked contest above still runs as today; the Weak comes from this table alone). frost: 1 Chilled (not the legacy `frost` gauge status). force: strip 1 Ward stack. divine: the caster cleanses 1 of its own statuses (the existing cleanse list). decay: 1 Necrotic Blight. poison damage type: 1 Venom. illusion: 1 Confused. earth: 1 Slowed. alteration (abjuration and transmutation): none, since its effects are protective or transforming and carry no damage rider. In Core 2, `schoolStatuses` replaces the damage-type riders (§4.7 table and `combatMatchups.damageRiders`), which apply to the legacy and expanded profiles only; the legacy Frost gauge and Cold rider do not run in Core 2, and Core frost cards that print `frost` move to Chilled. Weakness rows follow: a Core 2 weakness row `to: "frost"` with effect `stacks` becomes `to: "chilled"` (adds Chilled stacks when an opponent applies Chilled; Ember-Starved Pilgrim and Cinder Mantis), `chilled` joins the statuses a `stacks` row may name, and a `frost` `tick` row has no Core 2 effect (Chilled has no burst), so the content migration rewrites it to `stacks` on `chilled`.
- **Chilled and Frozen.** Core overrides Chilled to stack (the v2 `refresh`/`onConsume` rule stays for v2 only). At 2 Chilled the target becomes Frozen and all its Chilled is removed: it loses its next action (the existing Frozen action loss), then Frozen ends. Frozen never stacks above 1. A Damp target that gains Chilled becomes Frozen at once and loses all its Damp, so it cannot be frozen by every hit. Fire damage removes Chilled and Frozen (the existing thaw); Blunt shatters Frozen as today but no longer removes Chilled in Core. There is no immunity window. *Falsify:* a second 6-damage frost spell on a target that already has 1 Chilled makes it Frozen with no Chilled left; on a Damp target the first frost spell that deals HP damage makes it Frozen with no Damp left, and a second frost spell on it only applies 1 Chilled; a fire hit on a Chilled target leaves neither Chilled nor Frozen; a lightning spell with no printed status leaves exactly 1 Weak after HP loss (one source, never two), and one that already prints Weak adds no second.
- **Own-element bonus:** an enemy move whose school, damage type or element tag matches the enemy's `element` multiplies its damage, status stacks and other effect amounts by 1.25, floored (at least the printed amount). The same multiplier applies to element tags an elemental affinity adds to an armament's cards: affinity N adds N tags of that element to each card it grants (an enemy's attuned weapon: floor(N × 1.25)).

All tactical numbers remain authored/configurable; their defaults above establish the initial balance. Existing status thresholds, resistances and decay remain unchanged. Existing damage, source, delivery and theme tags retain their separate identities.

**Intent visibility and persistence**
- **Concealment roll:** 70% base chance to conceal the exact selected action (not a hit chance; attacks keep existing accuracy/evade rules). For profiled moves `hiddenChance = clamp(0.70 − Wisdom × 0.02 − Intelligence × 0.01, 0, 0.95)`; reductions are percentage points; configuration may override coefficients. Wisdom 10 / Intelligence 5 gives 45% hidden.
  - A configured profile whose intent module sets `reads: exact` skips the roll and shows every intent exactly; the Core preview route does.
- Always show a stance: Attack, Defend, Counter, Sweep, Ranged, Smash, Casting, Spell, Preparing or Staggered. Physical support actions use Preparing where no real attack/defense maneuver exists. Hidden previews expose camp/maneuver and stance only; selected move ID, exact damage/hits, Block, delay payload and school/type details are omitted through an allowlist.
- Visibility rolls once per newly selected intent on the independent deterministic stream `enemyIntentVisibility`; inspecting or previewing never rerolls. A delayed intent keeps its committed read until a new selection.
- Persist the committed Counter charge / carrier / lifetime and enemy visibility / read state with combat entities, plus random-stream counters. Reload restores decisions; it grants no additional reaction or reveal roll.
- The enemy move catalog may list its authored move set and base values while the selection is hidden, but must not highlight the selected entry or show its live preview.

**Out of scope:** new automatic school matchup loops, new feats/relics, school-specific deck-manipulation primitives, persistent Ashen Blight corruption ([Ashen Blight proposal](docs/ashen-blight-proposal.md) stays proposed until its own state/save/preview contract lands). Ordinary Exhaust and Crimson Blight must not acquire persistent corruption as a side effect of tagging existing cards.

---

### 4.8 Martial and Spell expansion (version 2)

Version-2 combat expansion: [docs/combat-expansion-contract.md](docs/combat-expansion-contract.md) and its referenced notes define version-2 ordering, state, defaults and acceptance. New runs snapshot version 2; older runs and snapshots keep §4.7's version-1 rules.
- It adds: one persistent tactical stance; authored Counter coverage and returns; persistent Ward; reach and area tradeoffs; seeded Evade / recovery checks; control recovery cards; opt-in upcasting; tag/status combos; run-lasting Ashen Blight with three feat milestones.
- Preview and rejected/cancelled actions are inert. Committed random outcomes and per-cycle budgets survive saves. Solo play, enemy actions, and both presentation variants share the headless contract.

**Card lifecycle and labels** (contract section of the same name; version 2 only, version-1 fights and snapshots unchanged)
- The bottom type line keeps authored Counter / Smash / Sweep / Ranged / Defend / Attack / Spell identities for maneuver / offensive cards and Power / Skill / Status for support; lifecycle is an independent property.
- A paid Power instance Exhausts after resolving while its installed effect lasts for that combat. Another owned copy or a legal Replica pays for its own cast unless an authored family limit applies.
- Skills normally remain reusable. Deck-added Status cards stay distinct from entity statuses and built-in recovery controls.

**Card traits (reaction rules version 2).** [docs/combat-card-traits-contract.md](docs/combat-card-traits-contract.md) defines four rank-scaled traits for new expanded runs (formulas, stance-advantage table, tiers and card picks are in the contract; runs and snapshots on reaction rules version 1 carry none):

| Trait | Effect |
|---|---|
| Reaction | Playable during the opponent's turn |
| Counterstrike | +50% effectiveness, +75% with stance advantage; each bonus at least 1 |
| Impact N | N Poise on hit, or double the card's own Poise damage |
| Flux N | The same for Ward |

### 4.9 Enemy knowledge, Perception and hidden-intent clues

- **Read Intent** reveal is an insight contest, not a hit roll, not range-gated: d20 + INT + WIS + rank vs the target's current Poise + WIS + level, ties pass (§17 Contests).
- **Intent box follow-ups**. In a Core 2 fight the intent box shows the planned follow-up actions after the current one as symbols shown beside the main intent at the same size, on the player's turn and through the enemy phase; the intent node itself carries them, so a rebuilt node never loses them.
  - The first 1 + Perception follow-ups show their icon when the intent read is exact; the rest, and every follow-up while the read is hidden, show `?`.
  - The read is the one §4.7 already rolls for the enemy; Perception adds no roll.
- **Always on, in every fight** (`styles/combat-visuals.css`):
  - The blue selection and playable outline (`--selection-color` is blue on the combat screen), so green only means advantage.
  - A soft dark drop-shadow on each intent glyph and each character sprite.
  - The thin target outline (a dark shadow hugging the sprite, then a coloured 1px ring) drawn while a card is aimed at an enemy: stance alone; green when the card's stance beats the enemy's revealed stance (attack beats smash and sweep, +1), red when it loses, none when neutral or unrevealed (`stance-advantage.csv`, `content/combatRounds.js`).
- [docs/enemy-knowledge-contract.md](docs/enemy-knowledge-contract.md) is a separately versioned extension to §4.8 (contract lands before its runtime, which depends on §4.8's runtime):
  - three saved visibility outcomes; a 30% base exact identification chance improved by Wisdom, Intelligence, character level and run Perception; accepted prediction/counter receipts; five-stage persistent bestiary knowledge.
  - Its allowlisted hidden projections supersede §4.7's precise hidden stances only for opted-in new runs; existing runs keep their carried rules.
  - Bestiary knowledge reveals static reference facts, never a future concealed action. Profile writes remain durable and idempotent.

### 4.10 Defensive reaction choices and actor-turn presentation

Reaction prompts, the combat log and enemy-action presentation. Detailed contract (persistence, privacy, accessibility, responsive geometry): [docs/combat-reaction-contract.md](docs/combat-reaction-contract.md).

**Reaction modal and log**
- The reaction modal uses **Skip, Play** (2026-11-14; the exit read Back before); Skip declines the offered reaction and resumes the incoming action. Its numbers are HP the player will lose (§17, *Plannable and quick turns*). A combat-scoped, owned Reaction switch controls optional prompts.
- The right-side combat log unfolds in place, groups completed public actions by round, and supports Small, Medium and Large heights bounded below the menu controls.
- Accuracy, contest, critical-hit, Intent-read perception, status buildup and status recovery rolls are logged as total vs DC ("Strike: 18 vs 9 · hit"). Dodge and Evade rows keep their sentences and gain an itemised receipt; range-distance rows keep their sentence alone. In Full detail mode each receipt is itemised (die, every bonus, the DC parts, the verdict) from the row's `rollReceipt`.

**Reaction rules version 1 (shipped, `src/engine/combatReactions.js`)**
- Sequential enemy action presentation with a distinct successful Counter return animation and impact; optional affordable in-hand Counter / defensive Sweep choices during incoming attacks or Counter returns; exact resumable continuation.
- New eligible expanded runs carry version 1; historical runs retain their saved mechanical lifecycle.
- Public actor-start revelation preserves original private prediction/learning receipts and cannot mark a cancelled action executed. Next planning intents refresh at player-turn start.
- Layout: the player mini HUD sits above visible artwork with a fixed 10 px bottom-to-art-top gap measured on the form factor's canvas (including selection growth); it scales with the canvas and equals 10 screen px at scale 1. The selected enemy's detail card prefers the left of a lone living enemy and the space below the selected enemy when several live, kept inside the visible area.
- Receipts (informational, change no rule):
  - `combatReactionUnavailable`: emitted once per root and seat when the seat holds a Counter or defensive Sweep but no reaction is offered, naming the first failing check (`switchOff`, `attackerStaggered`, `attackerControlled`, `notCovered`, `cost`, `controlled`, `unplayable`, `alreadyAnswered` or `other`). A seat with no such card, a dead seat and a disconnected seat get none.
  - `combatGuardBroken`: emitted once per break when a Smash breaks physical Guard.

**Reaction stack (reaction rules version 2).** New expanded runs snapshot version 2; version 1 keeps one reaction per root. Rules: [docs/combat-card-traits-contract.md](docs/combat-card-traits-contract.md).
- A seat may answer one incoming root with several Reaction cards: each choice is pushed without payment and the seat is offered again until it passes, runs out of options or reaches the depth cap. The stack resolves last played first, the paused action last.
- An uncommitted entry that can no longer be played fizzles (`combatReactionFizzled`) and pays nothing. Entries carry a side; opted-in enemy moves react too, on the player's turn and to player reactions.
- **Core 2 enemy-side entries** pay their quoted SP when enqueued, before effects; an unaffordable enemy reaction is refused. The payment receipt stays with the entry through resolution and save/resume (no second charge). A committed enemy reaction that later fizzles is not refunded.

#### Notes and history

- Hand rows, costs and the damage order are contractual; a few numbers (threshold-proc rows, the 1.8 multiplier, boss tuning) are provisional and live in data.
- §4.7 carries the version-1 tactical rules; §4.8 is the version-2 expansion.
- Heading anchors `#47-tagged-combat-cards-and-readable-enemy-stances`, `4.1a` and `4.7` are cited by tools and docs.

Full history: [docs/spec-history/04-combat.md](docs/spec-history/04-combat.md).

## 5. Content specification

### 5.1 Classes, creation presets, and levels

#### Creation modes and presets

- New runs default to `lean`, labelled Standard (`src/content/attributes.js:190`; `content/source/characterCreation.json:3`).
- `tuned`: stable mode id, not offered at creation, not the default.
  - Fixed total 53 across STR / DEX / CON / WIS / INT; the mode row owns its total and bounds.
  - `standard` and `pointbuy` keep validating as authored (saves persist the mode id).
- `tuned` presets (contractual, each sums to 53). A preset is an opening position, not a lock: redistribute within the mode's bounds.

| Class | STR / DEX / CON / WIS / INT | Starting HP/Mana flask allocation |
|---|---|---|
| Reaver | `13 / 11 / 11 / 8 / 10` | `2 / 1` |
| Starseer | `11 / 11 / 8 / 13 / 10` | `1 / 2` |
| Herald | `12 / 11 / 8 / 12 / 10` | `2 / 1` |
| Rogue | `11 / 13 / 10 / 9 / 10` | `2 / 1` |

- Starting derived values come only from §3.5 formulas.
- **Standard** (`opensOn: 'preset'`, §13.4m) seats the class preset with nothing to spend; *Edit points* reopens it as a revision.
- **Assign Points** starts a fresh allocation at the mode's baseline with the full bonus pool unspent; reopening refunds the same way.

#### Level curve

- Level starts at 1 and is EARNED (§13.4i): fights pay XP (`balance.xp`: a won fight, and each kill by the door's pool). No cinder buys a level.
- Curve from `balance.level.xp`; base, scaler, rounding and linear/exponential are configurable.
  - Exponential (default, `linear: false`; any table without `linear: true`): `xpToNext(n) = round(base × growth^(n − 1), roundTo)`.
  - Linear: `round(base + (n − 1) × base × multScaler, roundTo)`; base 100, `multScaler` 1.3 → 100, 230, 360, 490.
- Each track's max level costs about 100,000 XP (§13.4o):

| Track | Config key | Base | Growth | roundTo | Max level |
|---|---|---|---|---|---|
| Character | `balance.level.xp` | 200 | 1.5 | 10 | 20 |
| Class | `balance.skill.class.xp` | 400 | 1.224 | 5 | 20 |
| Equipment skill | `balance.skill.xp` | 100 | 1.995 | 5 | 10 |

- Character steps: 200, 300, 450, 680, 1,010, 1,520, 2,280, 3,420, 5,130, 7,690 (level 19 costs 295,580; 886,350 XP for 1 to 20).
- New runs record `advancedConfigSnapshot.xpCurveVersion: 1`.
  - Older snapshots without it use exponential defaults unless a linear override is set; live XP edits preserve its presence or absence.
- Each level grants `balance.levelUp.pointsPerLevel` attribute points, held on the run's ledger until assigned at a shrine.
- Levels per full run (11.5) predate this curve; re-measure: `tools/runsim.mjs --xp-levels`.

#### Cinders

- Start: `balance.startingCinders` 20.
- Combat rewards (`balance.rewards.cinders`): normal 45–75, elite 105–150, boss 225–270; scaled by the Advanced `cinderMultiplier` (default 1).
- Retired, dropped with a warning from any profile, run snapshot or import: `progression.rewardMultiplier: 20`, and the shared opening-hand `gameConfig.handRules.starting.base|stat` (§4.1; warned when not stock).

#### Rogue full parity slice

Rogue is a complete fourth class:

- 61 authored cards (`src/content/cards/rogue.js`), all upgradable: 57 in the reward pool (`cardPool`: 47 legacy = original 43 + four poison, plus ten expanded families), signature Ambush, ability Prepare (§13.4f), generated Shiv and Smoke Pellet.
- 11-card starting deck incl. signature and ability card (`balance.startingDeckSize`); one starter relic.
- Two starting kits; five Rogue outfits/armour sets plus the four `sharedSet` rows every class wears (`content/source/outfits.csv`: nine `rogue` rows), one free baseline per required kind; same unlock/discovery rules as other classes.
- Five stage/tint sprites plus art for every kit and outfit (ordinary missing-art fallback).
- Everything else (presets, flask allocation, rewards, draft/custom-run, history, compendium) derives from registries, no Rogue-only branches.
- Mechanics compose existing vocabularies; a new opcode/predicate only when unavoidable, as a specified closed-set extension with validation and engine tests, never per-card code.

### 5.2 Reaver card pool — M1 set (24 cards + upgrades)

Reward pool: 43 cards plus starters (`reaver` `cardPool`, `src/content/classes.js`); `composeProgressionContent` adds 10 class-mastery cards on unlock (53). Rarity S/C/U/R = starter/common/uncommon/rare; cost in Stamina (engine id `energy`); last column is the upgrade delta.

| Card | R | Cost | Type | Text | Upgrade |
|---|---|---|---|---|---|
| Strike | S | 1 | Attack | Deal 6. | Deal 9 |
| Defend | S | 1 | Skill | Gain 5 Block. | Gain 8 |
| Gorefire Slash | S | 1 + 1 Mana | Attack | Deal 5. Apply 3 Bleed. | 5 dmg, 5 Bleed |
| Crimson Cleave | C | 2 | Attack | Deal 5 to the selected enemy. | none; rank-up (§13.4o) |
| Shield Bash | C | 1 | Attack | Deal 3 to the selected enemy. | none; rank-up (§13.4o) |
| Quickstep | C | 1 | Skill | Gain 4 Block. | none; rank-up (§13.4o) |
| Guard Counter | C | 1 | Attack | Prepare Melee Counter. Prepare 3 base reply damage. | none; rank-up (§13.4o) |
| Iron Resolve | C | 1 | Skill | Gain 5 Block. If in Bulwark Stance: gain 9 instead. | 7 / 12 |
| Serrated Blade | C | 1 | Attack | Deal 7. If target has any Bleed: apply 3 Bleed. | 9 dmg, 4 Bleed |
| Enter: Gorefire | C | 1 | Skill | Enter Gorefire Stance. Draw 1. | cost 0 |
| Enter: Bulwark | C | 1 | Skill | Enter Bulwark Stance. | Gain 3 extra Block |
| Stomp | U | 1 + 1 Mana | Attack | Deal 9 to the selected enemy. | none; rank-up (§13.4o) |
| Rallying Standard | U | 1 | Power | At the start of your turn, gain 1 Strength. Take 1 damage. | no self-damage |
| War Surgeon | U | 1 | Skill | Exhaust. Heal 2 HP for every 4 Bleed on all enemies. | every 3 |
| Hemorrhage | U | 1 | Skill | Double the target's Bleed. Exhaust. | don't Exhaust |
| Twinblade Flurry | U | 1 | Attack | Deal 3×3. Gorefire applies per hit. | 4×3 |
| Shieldwall | U | 2 | Skill | Gain 12 Block. If in Bulwark: gain 4 Block next turn. | 16 Block |
| Kick Off | U | 1 + 1 Mana | Attack | Deal 3 to the selected enemy. Exhaust. | none; rank-up (§13.4o) |
| Executioner | R | 2 | Attack | Deal 10. If target is Staggered: deal 25 instead. | 14 / 32 |
| Goreblood | R | 3 | Power | Poise thresholds no longer increase after filling. | cost 2 |
| Unbreakable | R | 2 | Power | Block no longer expires at the start of your turn. (Cap 30.) | cap 40 |
| Stitched Arms | R | X | Attack | X-cost: Deal 6 per Stamina spent, split randomly among enemies as 6-damage hits. | 8 per |
| Last Stand | R | 1 | Skill | Ethereal. Gain Block equal to missing HP (max 20). | max 30 |
| Warrior's Vow | R | 0 | Skill | Innate. Enter a Stance of your choice. Exhaust. | draw 1 |

Colorless/curse/status M1 minimum (enemies and events inject these):

| Card | Kind | Rules |
|---|---|---|
| Wound | status | Unplayable. |
| Dazed | status | Unplayable, Ethereal. |
| Guilt | curse | Unplayable; at turn end in hand: lose 1 HP. |
| Slimed | status | Cost 1, Exhaust. |

### 5.3 Enemy roster — Act 1 (M1)

Weighted table: `src/content/encounters/weald.js` (§13.2). Act 2/3 rosters are M3 (mechanics in §10): a Grafted-King-inspired phase boss; a final Malenia-inspired boss that heals 3 per hit landed on you and inflicts Bleed on the *player*.

**Basics**

| Enemy | HP | Poise | Moves (weight) | Notes |
|---|---|---|---|---|
| Wandering Soldier | 31–36 | 10 | Slash 8 (45), Guard 6 Block (30), Warcry +2 Str (25, max1) | bread & butter |
| Blight Hound | 14–18 | 6 | Bite 6 (60), Lunge 3×2 (40) | fast, fragile; spawns in pairs |
| Husk Brute | 30–34 | 16 | Club 15 (50), Bellow: apply 1 Frail and add 1 Slimed (25), Brace 8 Block (25) | tanky |
| Grave Wisp | 12–14 | 4 | Curse: shuffle 1 Dazed into draw (50), Drain 8 + heals self 4 (50) | kill first |
| Pack encounter | — | — | 2× Blight Hound + 1 Grave Wisp | teaches targeting |

**Elite — Wyrm Aspirant** (HP 82–86, Poise 24). Opener always Consecrate (+3 Strength); then Halberd Sweep 17 (50) / Tail Slam 11 + 1 Weak (30) / Golden Guard 12 Block + 4 HP heal (20, max1). Drops a relic.

**Boss — The Fell Warden** (Margit-inspired, HP 120, Poise 30)

- Phase 1 (>50% HP): pattern cycle with a signature **delay** mechanic.
  - *Held Blade* shows "Attack 14 — Delayed". On its turn it does nothing (gains 8 Block); the **following** turn it attacks for 14 regardless of newly rolled intents.
  - Other moves: Cane Strike 8 (repeatable ×2), Hammer Toss 5×2.
- Phase 2 (≤50% HP, `phases` trigger, once): roars, applying 1 Frail + 1 Weak to the player; gains +2 Strength; unlocks *Twin Daggers 3×4*.
- Staggering him cancels a Held Blade in progress.
- Reward: 225–270 cinders, a choice of boss relics (§6), card reward with rare upgrade odds boosted.

**Authored weaknesses** (SPEC §4.7, *Enemy weaknesses in Core*): every enemy here and in later acts has them.

| Enemy kind | Weak to |
|---|---|
| Hounds, beasts | fire, blunt |
| Spirits, wisps | sacred, magic |
| Armoured soldiers, knights | blunt, lightning (lightning and blunt staggers) |
| Undead | sacred, burn ticks |
| Insects, vermin | frost, slashing |
| Constructs | blunt, lightning (Stamina loss) |
| Casters | piercing, Paralysis stacks |
| Each boss | one themed trigger |

### 5.4 Relics (M2 set of 16; 74 ship in all: 64 in `src/content/relics.js` plus 10 class-mastery relics in `src/content/progression/relics.js`)

Relic behavior uses the trigger DSL (§3.6).

| Relic | Rarity | Effect |
|---|---|---|
| Forsaken Medallion | starter | (class starter, see §5.1) |
| Golden Sprout | common | At the start of each combat, heal 3 HP. While carried, the Crimson flask pool holds 1 more charge (once, not per combat; `balance.flaskGrowth`). |
| Brimming Gourd | common | Picking it up refills your flasks; while carried, the Crimson flask pool holds 1 more charge (`balance.flaskGrowth`, Core). Pool `core2`: only the Core 2 reward and shop policy draws it (`eligibility.relics.pools`), never legacy rewards, the legacy merchant or Core 1. |
| Whetstone Fragment | common | Your first attack each combat deals +4. |
| Kindling Charm | common | At the start of each combat, draw 1 extra card. |
| Cinder Pouch | common | Gain 25% more Cinders from combats. |
| Feral Eye | common | Elites offer an extra card reward choice. |
| Cracked Tear | uncommon | Flasks are 50% stronger (rounded up). |
| Sealstone Key | uncommon | Unknown (?) nodes are revealed on the map. |
| Fell Warden Brand | uncommon | Whenever an enemy Staggers, draw 2. |
| Bloodied Talisman | uncommon | Bleed bursts make the victim lose 5 extra HP. |
| Grace Fragment | uncommon | Resting heals +15% more (shipped as Ember Fragment, §13.4j). |
| Twinned Armor | uncommon | Every 10th card you play each combat: gain 6 Block. |
| Goldbough Sapling | rare | At the start of your turn, if you have no Block: gain 4 Block. |
| Wyrm Heart | rare | +1 Stamina each turn. Shrines and chapels no longer offer Rest (`restDenied: ['restHpPartial']`, §13.4j). |
| Ancestral Horn | rare | Powers cost 1 less. |
| Ash of Remembrance | boss | **+1 Stamina each turn; at combat start, gain 1 Madness.** |

### 5.5 Flasks (potions)

- Crimson/Azure charges share one pool of capacity 3 (`balance.flaskCapacity`). Utility potions are separate entries sized by `balance.flaskSlots`; neither limit raises the other. Utility potions come from combats, shops and events.
- Crimson and Azure are permanent vessels in the potion tray: never dropped, no utility slot. A Gameplay setting (off by default) allows using them between combats (same effect, one charge).
- Charges refill at every grace (§5.5.1). **Act change:** in a configured run `advanceAct()` refills both pools to their allocation, whatever `routes.startNodeRefills` says.
  - That flag still governs the start node's own entry refill, which also restores HP.
  - A legacy/current-profile run never refilled between acts.
- **Kind:** closed set `FLASK_KINDS` (`hp`, `mana`, `utility`; `model/schemas.js`), derived in `model/gracerefill.js` `flaskKindOf`: `heal` is `hp`, the `restoreMana` opcode is `mana`, else `utility`; an explicit `kind:` overrides.

| Flask | Effect |
|---|---|
| Crimson Flask | Heal 25% max HP. |
| Azure Flask | Restore 1 Mana. |
| Flask of Ferocity | Gain 2 Strength this combat. |
| Flask of Stone | Gain 15 Block. |
| Blight Coating | Apply 4 Crimson Blight to target. |
| Blood Unction | Your attacks apply 2 extra Bleed per hit this turn. |
| Wondrous Draught (rare) | Two random flask effects at once. |

#### 5.5.1 The grace refill

The grace is the Shrine of Emberlight (there is no `grace` node type).

- Automatic on arrival, before the Rest/Smith choice; smith and rest are refilled alike.
- Capacity, class splits and reallocatable kinds are content rows; no screen copies 3, 2/1 or 1/2.
- A fill, not a grant: fills allocated HP and Mana vessels to their maxima; idempotent; never grows capacity.
- Free allocation (a committed run choice): redistribute all 3 between HP and Mana at no cost; any non-negative integer split summing to 3 is legal; current charges are bounded by the new maxima; utility potions untouched.
- Class openings (presets, not caps): Reaver, Herald, Rogue `2 HP / 1 Mana`; Starseer `1 HP / 2 Mana`.
- Debug controls edit the same data and show its lawful range.
- Refusals (`graceRefillRefusals`, boot; `node tools/gracerefill.mjs --selftest`): unknown/duplicate kind; malformed capacity/allocation; negative/fractional count; split not summing to capacity; dangling or wrong-kind override; refill altering utility inventory.
- Balance: the old no-Mana simulation is stale; a Mana-aware A/B balance run remains a release gate.

#### 5.5.2 The growth chain — how the maximum grows

`balance.flaskGrowth` rows `{ source, id, kind, amount }` (`model/flaskgrowth.js`): holding the source grows that kind's maximum by `amount`.

- Sources: closed set `FLASK_GROWTH_SOURCES` (`relic`, `questEvent`, `talisman`, `flaskSeed`; `model/schemas.js`); a fifth is an engine act.
- Derived, reversible: `flaskCharges.grown` holds the chain's contribution; `syncFlaskGrowth` reconciles at run birth, run load, relic gains and the equipment screen (gain grows, loss shrinks, currents bounded).
- Two doors: the chain (*possession*) and the `addFlaskCapacity` opcode (*moment*, quest-event choice effects). An event granting through both is a boot refusal.
- Capacity ledger (run schema v3): `flaskCharges.capacity` is one stored number; `grown` (per kind, reversible) and `granted` (permanent total) are its ledgers. `validateRunShape` refuses any save where `capacity ≠ base + grown.hp + grown.mana + granted`. Pre-ledger migration: §3.12.
- Not yet binding: `questEvent` rows validate but report NOT BINDING; any `flaskSeed` row refuses at boot; `talisman` rows refuse until the first talisman is authored.
- Optional `balance.flaskGrowthMax` arms an aggregate refusal only when authored (D19).
- Refusals (`flaskGrowthRefusals`, boot; `node tools/flaskgrowth.mjs --selftest`): unknown source; non-charge kind; negative/zero/fractional amount; duplicate grant; dangling relic/event/talisman ref; two-door collision; any seed row; cap malformed or exceeded.
- C1 seam, decided POOL: one freely reallocatable pool, approved new-run default 4 (contradiction kept: §5.5 and §5.5.1 say 3). Kind-delta binding stays in `syncFlaskGrowth`.
  - Overflow rule: reallocate a grown charge away, then lose the source: removal takes the row's kind first, overflows to the other, currents bounded.
- Live rows are in `balance.flaskGrowth` only (not restated; `node tools/flaskgrowth.mjs`); PROVISIONAL, the M3 balance pass owns weights. The relic tooltip derives from its row (`flaskGrowthClause`).

### 5.6 Events — Unknown nodes (M2: 4 minimum, M3: 10)

#### Unknown-node roll and M2 events

- Unknown nodes roll on stream `events`: 55% event, 25% normal fight, 12% shrine, 8% treasure (`mapConfigs[act].unknownWeights`, `src/content/mapconfig.js`).
- Event = data `{ id, name, art, text, choices: [{ label, requires?, effects, resultText }] }`; `effects` are §3.4 run-level opcodes.

| # | Event | Choices |
|---|---|---|
| 1 | Goldbough Avatar | *Offer a card* (remove 1 card, take 6 damage) / *Pray* (heal 20% max HP, gain 1 Guilt) / *Leave* |
| 2 | Abandoned Merchant Cart | *Loot* (gain 75 cinders, 50%: fight a Wandering Soldier ambush) / *Leave* |
| 3 | Wayward Pilgrim | *Give 50 cinders* (gain a random relic) / *Refuse* (nothing) |
| 4 | Ancient Cinder Stone | *Study* (upgrade a random card, lose 7% max HP) / *Smash* (gain 35 cinders) / *Leave* |

#### What changed receipt

- Every committed event choice (event screen, quest dialogue, quest-board, dungeon) snapshots the run first; if the run differs afterwards it opens the page-locked receipt (`ui/components/whatChangedModal.js`).
  - Title: event name; lead: `resultText`; one row per stat, resource, relic, card (before/after) or armament moved. No change, no receipt.
- It also follows a Core rest-site Smith or card upgrade (not level-up). The classic rest site's Smith keeps its own receipt line.

#### Quest chains

- Each committed choice is a run-history fact (`model/quests.js recordEventChoice`: `{ eventId, choiceId, actNumber, floor, mapNodeId }`).
- Two gates, sidecar data in `content/events.js`:
  - Choice: `eventChoiceHistoryRequirements[eventId][index]` = `{ all?, any?, none? }` of `{ eventId, choiceId }`; `availableEventChoices` hides unmet choices without reindexing. Leave is never gated.
  - Event: `eventHistoryRequirements[eventId]`, same grammar; `engine/encounters.js resolveUnknownNode` admits it only once satisfied, never as a repeat fallback. `buildActMap` carries `run.history` so an act answers earlier acts.
- Chain: Grave of the Nameless → The Keeper of the Nameless (any grave choice but Leave) → The Second Cairn (any keeper choice).
- A quest's named relic is `pool: 'quest'` (`RELIC_POOLS`, `model/schemas.js`): no generic pool may hand it out; validation refuses a quest-pool relic no choice grants.

#### Quest completion and dialogue

- One door: `engine/quests.js commitEventChoice` runs effects, then the history row, then the completion check.
- `questChains = { [questId]: { steps: [eventId], completes: [{ eventId, choiceId }] } }`; Grave of the Nameless ships as `nameless`, completed by any second-cairn answer but Leave.
- `completeQuest` appends `{ kind: 'questCompleted', questId, source }` to `run.history` at most once per quest per run and emits `questCompleted` (nothing else emits it). `RUN_SHAPE` is unchanged. Run-history rows carry no wall clock. An atlas quest's claimed reward completes the same way with `source: 'atlas'`.
- Chain steps open in the dialogue screen: text splits into beats on blank lines; the `eventSpeakers` speaker (`content/source/speakers.csv`: `id,name,portraitKey`; no portrait shows the name plate) stands right, the player left; choices are the responses on the last beat.
  - Back, Continue, Skip speech and speech ending move only the beat; only a response commits; binding responses keep the hold.
- Validation refuses by name: unresolved step or completion ref, step without speaker, unknown speaker, a Leave that completes a quest. One-off events keep the Event screen.

#### Notes and history

- Older XP curves and awards are archived, not rules.
- Flask growth rows live in `balance.flaskGrowth` only.

Full history: [docs/spec-history/05-content-map.md](docs/spec-history/05-content-map.md).

---

## 6. Map generation

Act-map generation (`engine/mapgen.js`; constants from `content/mapconfig.js`), the Core branched map, rewards, merchant prices.

### Grid, paths, anchors

- Per act a **`floors` × `columns`** grid (shipped 12 × 7). The top floor is always a single Shrine row, the Boss above it. Rules reach floors **1..`floors`-1** (the *rollable band*, the denominator for every fraction).
- **6 paths** bottom-to-top from a random floor-1 column (shipped `entries: 1`: one entrance column; the first 2 start at distinct columns only when `entries` is unset); each step moves column −1/0/+1; edges may merge, never cross (swap targets).
- Every floor a rule names is an ANCHOR, never an index. Kinds are a closed set in `model/floorplan.js` (a new kind is an engine change, Law 1):

| Anchor | Resolves to |
|---|---|
| `{ at: 'first' }` | floor 1 |
| `{ at: 'last' }` | last rollable floor (`floors`-1) |
| `{ at: 'floor', index: n }` | `n`; error outside 1..`floors`-1 |
| `{ at: 'fraction', of: f }` | `round(f × rollable)`, `f` ∈ (0, 1] |

  - `resolveFloorPlan()` alone turns an anchor into a floor (generator, validator, `tools/mapplan.mjs`). An unresolvable anchor is a boot error naming the entry (Law 1 clause 5); `mapgen` throws.

### Node typing

- Fixed ranks: Monster at `first`; Treasure at fraction 0.64 (floor 7 of 11 shipped).
- Rolled: Monster 45 %, Event(?) 22 %, Elite 8 %, Shrine 12 %, Merchant 5 %, remainder Monster.

| Constraint | Anchor | Shipped floor |
|---|---|---|
| No Shrine before `noShrineBefore` | fraction 0.27 | 3 |
| No Elite before `noEliteBefore` | fraction 0.43 | 5 |
| No Shrine on `noShrineOn` | `last` | 11 |

- No two identical non-Monster types adjacent along an edge. **`minElites` ≥ 2, `minMerchants` ≥ 1 per act**; if violated, regenerate typing (map RNG stream, bounded retries), then relax the weakest constraint.
- **`restBeforeElite`:** a map with an Elite has a Shrine on some EARLIER floor.
  - Gated by TWO anchors (`noShrineBefore`, `noEliteBefore`); the schema REJECTS `noEliteOrShrineBefore`.
  - The roll is barred; a final step on every exit path (fixed ranks bypass gates) opens a rest on a floor certified at boot.
  - Boot errors: a fixed Elite with no floor beneath it able to hold a rest; no rest floor at all. A fixed Shrine below the Elite gate is the rest.
  - A graph fact, not a path guarantee. Shortest act: 7 floors (narrows the debug run-shape cap).
- **`minElites` counts graph nodes, not reachability** (some starts reach no Elite; `tools/mapplan.mjs` prints it; nothing gates on it; making the generator honour `minElites` is an open design call).
- `?` nodes resolve via `mapConfigs[act].unknownWeights` (§5.6).
- Map claims are distributions, never seeds; `tools/mapplan.mjs` prints mean and range and refuses to report if its seeds did not vary. Stops per run = exactly **`floors` + 1**.

### Player view and camera

- Full act map visible; only nodes edge-connected to the current node are clickable. **Sealstone Key** shows `?` types.
- Camera opens framed on the current decision; grab-drag on both axes. **Settings → Advanced → Interface → Two-axis map dragging** (default on); off = vertical-only, horizontal centred. Zoom reset recentres; the saved camera keeps both axes.
- Acts 2/3 reuse the generator with other encounter tables and elite/boss pools (data only).
- Core preview route: opens on a fight (`firstFloor: fight`), rests on floors 3 and 6, whole map visible; the fixed-Monster rule above is the Current profile's.

### Core branched act map

`buildGameProfileActMap`, `routes.maxBranches`. A profile without `maxBranches` keeps the single-trunk map; stored graphs are never regenerated.

- Nine pre-boss depths; rests on depths 3, 6, 9.
- Depth 1: ONE centred start node `n1_0` (a fight under `firstFloor`, or a rest if authored) whose edges reach the first lane(s) of every branch. With `routes.startNodeRefills` (default true) it has `refill: true`: entering restores HP to max and refills both flask pools (a graph without the field does nothing new). Core 2 ships `startNodeRefills: false` (owner brief, 2026-11-14): its start node restores nothing.
- Branches `b = rng.int('map', 1, min(maxBranches, distinct bosses))`; Core `maxBranches` 3 (engine max 5). Bosses: first `b` of a seeded shuffle; the first boss beaten ends the act.
- From depth 2 each branch is a subgraph in up to `L = clamp(floor(2 * branchColumns / b), 1, branchColumns)` lanes (3, 3, 2, 1, 1 for b = 1..5; board at most `2 * branchColumns` wide). Edges after depth 1 never leave a branch.
- No forced rejoin: every lane on a rest depth has its own rest; each lane holds at least one elite on some non-rest depth at or past `minimumThreatFloor` (per lane, not per path: a remerge edge can carry a path past it; a lane with no such depth has none).
- Each branch is a tree:
  - Opens at depth 2 with ONE node, or TWO when it has three lanes (50% `map` draw).
  - Forks outward: each boundary node draws `FORK_PERCENT` (40%) per depth to grow a neighbouring lane; forced full by depth `prebossNodes - 3` (6 in Core).
  - Last two depths: a three-lane branch may narrow once (25%, an outer lane joins its neighbour), never below two lanes; once widened it never collapses to one path (before its first fork the trunk may be a single path, rest depths included). A one-lane branch (b 4–5) stays single. Every path ends at the branch's boss.
- Remerge: per branch and per gap between in-branch depths, one `map` draw (18%) may add ONE edge between neighbouring lanes existing on both depths; never into every rest depth.
- Ids: `n{depth}_{branchIndex * L + lane}`, column `branch * L + lane`. `bossId` `boss_0`; `bossIds` all `boss_k`; `shrineIds` every pre-boss rest (`shrineId` the first); nodes carry `branch` (null on depth 1).
- Visible forks (owner brief, 2026-11-14). Each key is read only when present; a profile without it keeps the draws above, draw for draw (`tests/core-map-legacy-golden.test.mjs`).
  - `typeWeights`: a free node (not a rest, the forced first node or a guaranteed slot) is a weighted draw over the listed types; `shopShare` is ignored. Core: fight 70, event 16, shop 9, treasure 5 (no random elites; the per-lane elite stays).
  - `variedNeighbours`: a free node never repeats the type of the lane beside it on the same depth when another type can roll.
  - `shopsPerBranch` 1: each branch holds one guaranteed shop on a non-rest depth 4–8, never on a guaranteed elite slot.
  - `forkPercent` replaces `FORK_PERCENT` (Core 70). `crossLinkPercent` replaces the remerge rule (Core 100): every pair of neighbouring lanes present on both depths of a gap draws ONE diagonal edge, direction 50/50, dropped if it would cross an edge already in that gap; the rest-depth exception does not apply.
  - Core 2 hides no node type (`hiddenTypes: []`) and draws the whole map (`mapMode: "path"`).
  - Measured over 300 Act 1 seeds (`tests/core-map-shape.test.mjs`): 5.0 fights per walk (was 4.5), a shop in every branch (was 47% of maps), 57% of type-free steps offer two or more node types (was 23%; rest rows and the boss cannot fork by type, and edges that never cross cap this near two thirds).

### Rewards after combat and merchant prices

- Cinders: Monster 45–75, Elite 105–150, Boss 225–270. Elites also drop a relic (Core 2: a choice of two, §15.1 *Elite spoils*). Flask roll: §5.5.
- Card reward on the §15.1 schedule: shipped 10% per won fight (`balance.rewards.cardRewards.chancePct`); choose 1 of 3–5 (random per combat door, `rewards.combatOfferCount` {min 3, max 5}, `cardRewards` stream; chests and level cards keep 3). Default odds common 60 / uncommon 35 / rare 5, Elite 45/40/15; a class's reward weights may override.
- Solo boss victory: up to `balance.rewards.bossRelicChoices` (3) distinct unowned boss relics (`rollRelicChoices`, `relicRewards` stream; one left gives a single `relicId`); pick one. Auto-collect picks randomly; with it off an unpicked choice is left behind.
- Merchant prices (cinders): cards 135–480 by rarity, relics 420–900, flasks 150–240, card removal 225 (+75 per purchase). All numbers: `balance.js`.

#### Notes and history

- Map figures come from `tools/mapplan.mjs`, never restated here.

Full history: [docs/spec-history/05-content-map.md](docs/spec-history/05-content-map.md).

---

## 7. UI/UX specification

Screens, the shared HUD and combat layout, Advanced Settings, input, feedback and visual style. Backticked component ids are contracts checked by `tools/ui-components.mjs`.

### 7.1 Screens & flow

Screen graph, router, and the cold-boot gate.

```
Cold Boot ──► Startup Gate ──► Title ──► Class Select (+ seed entry) ──► Map ──► [Combat | Shrine | Shop | Event | Treasure]
                              │                                        ▲              │
                              └── Continue (if save exists)            └──────────────┘ (reward screens between)
Death/Victory ──► run summary (seed, floor, runes, kills, deck) ──► Title
```

- Screen router in `main.js`. Routed full-screen modules export `mountX(app, opts)` (`mountMap`, `src/ui/screens/map.js`); a re-mount releases the previous handlers; no screen exports `unmount()`. Overlay and panel modules expose open/render helpers (`openCharacterSheet`; settings and profile-archive APIs).
- A Shrine, camp, inn or chapel is a location: a property carrier whose tag set says what it restores (§13.4j). Arriving at a Shrine refills flasks automatically before the Rest/Smith choice is offered (§5.5.1), because the Shrine carries `restFlasks`. The screen reports what it was handed and what the slots could not hold; silent when nothing to say.
- **Startup gate.** Cold boot mounts `startup-gate` before the Title DOM exists. It holds only the Ashen Spire wordmark, decorative ash/embers, the input-family prompt, and the shared BUILD/source stamp.
  - Click/tap, Enter, Space, controller A/Cross and controller Start/Menu are consumed by the gate and reveal Title exactly once; that physical press cannot activate a Title control.
  - Prompt copy follows the latest input family (pointer, touch, keyboard, controller).
  - Profile quarantine and recovery notices outrank the gate.
  - After reveal, focus lands on Title's first available save-slot action; every later return to Title in that boot bypasses the gate.
  - Reduced motion: same state and focus contract, no meaningful animation.

### 7.2 Shared run HUD and combat layout (1280×800 reference)

Component architecture and ids, the shared run HUD, creation/Shrine/Menu/Armoury surfaces, combat layout. Advanced Settings is §7.2.1.

#### Architecture

- **.NET-inspired application and Component Model contract.** Clean Architecture with an MVVM-shaped presentation layer:

| Layer | Role | Path today |
|---|---|---|
| Domain Models | pure game state and rules | `src/model/` |
| Application Interfaces | ports | |
| Application Services | orchestrate use cases | |
| Infrastructure | browser storage, audio, network, other platform adapters | |
| Presentation Models | immutable contracts, like C# records | `src/ui/models/` |
| Presentation ViewModels | project domain snapshots into screen/card compositions and named commands | `src/ui/viewModels/` |
| Views | thin full-screen hosts | `src/ui/screens/` |
| Components | reusable renderers | `src/ui/components/` |
| Behaviors | bind interactions and lifecycle | |

  `main.js` trends toward a composition root; existing paths migrate incrementally.
- Every reusable UI component receives an immutable **Component Model** that names its semantic component id and variant, owns only serializable presentation properties, declares named behaviors, and recursively composes child Component Models. Screen ViewModels compose those records; renderers translate them to DOM; behavior adapters connect declared commands to callbacks.
- Shared primitives are composed, not redefined. Component Models never own mutable simulation state or import engine rules; ViewModels project domain state into model properties. A component owns structure and accessibility; its screen supplies state and callbacks.
- A migrated surface has one ViewModel composition and one renderer, never a model path beside a hand-written fallback.

#### Component ids

Ids are stable semantic names, not screen-specific markup.

- **Shared primitives:** `panel`, `component-background`, `metadata-field`, `action-control`, `hotkey-badge`, `item-tray`, `item-slot`, `folding-tray`, `tray-header`, `tray-resize-handle`, `tray-content`, `tooltip`. Specialized models compose these and may add semantic variants; they do not clone their record shape, accessibility contract, token ownership or behavior vocabulary.

| Family | Ids and roles |
|---|---|
| Shared HUD | `shared-run-hud` contains `run-header-strip`, `primary-hud-row`, `inventory-belt`, `hud-quick-settings` |
| HUD leaves | `identity-cluster`, `portrait-badge`, `character-title`, `cinders-counter`, `build-metadata-trail`, `vitals-panel`, `resource-meter`, `quick-access-panel`, `armoury-control`, `quick-menu-control`, `fullscreen-control`, `music-control`, `crimson-flask-control`, `azure-flask-control`, `relic-tray`, `potion-tray` |
| Combat (adds) | `battlefield-stage`, `combatant-frame` (`player-combatant-frame` or `enemy-combatant-frame`), `player-hand-tray`, `combat-action-rail` |
| Map only | `act-route-strip`: sibling below `shared-run-hud`, never its child, never mounted by Combat; on narrow Map layouts about 80% of the viewport, reserving the HUD utility-control gutter on the right |
| Startup | `startup-gate` → `startup-ash-field` → `startup-ash-particle`; `startup-mark` → `startup-wordmark`, `startup-subtitle`, `startup-divider`, `startup-prompt` |
| Title | `title-brand-lockup` (`title-wordmark`, `title-subtitle`, `title-divider`); `title-menu` (six `title-menu-item`, each with `title-menu-gem`); independent `title-tagline`; `title-menu-modal` (see below) |

- **`hud-quick-settings`** (Title, Map, Combat) anchors beneath the top-right HUD edge as a vertical pair of live Fullscreen and Music controls. Music persists via the profile settings service; Fullscreen is read from the browser (no duplicate flag). Narrow screens: same composition, 44px square glyph controls. Without a fullscreen API, Fullscreen shows unavailable.

#### Startup Gate and Title components

- `startup-gate` is a boot-scoped component, not a Title variant. Its immutable model supplies wordmark copy, input-family prompts, deterministic particle records, accessibility metadata and the named reveal behavior.
  - Its renderer owns layout and temporary event binding, consumes the composition root's one first-input owner, and uses the shared build-stamp renderer.
  - It never imports simulation state, persists dismissal, or mounts Title controls behind itself. The mark's phone backing is transparent.
- Load and New share one `title-menu-modal`: `title-modal-close-control`, `title-modal-heading`, `title-modal-divider`, `title-save-slot-list`, `title-modal-actions`.
  - Each `title-save-slot` supplies `title-save-slot-copy`, `title-save-slot-state`, and `title-save-slot-delete` only when occupied; the actions supply `title-modal-back-control` and `title-modal-continue-control`.
  - The DOM-free `saveSlotSelectionModel` projects Load and New from the same slot records and Behavior Models; selected styling, `aria-pressed`, focus restoration target, primary-action availability and command payload resolve to one slot. Save data and callbacks stay screen inputs.
  - Every modal close control paints a square at 75% of its shared icon-button box, keeping the full authored tap target.

#### Character Creation components

- Ids: `character-disclosure`, `class-preview-pane`, `class-resource-grid`, `class-choice-card`, `view-mode-toggle`, `boolean-setting-toggle`, `selection-section-face`, `primary-stat-card`, `stat-allocation-row`, `resource-strip`, `mode-choice`, `sprite-choice`, `tint-choice`, `sigil-choice`, `equipment-choice-card`, `relic-choice-card`. `class-preview-pane` composes `class-resource-grid`; `character-disclosure` composes the stat and appearance choices.
- Presentation only (starting decks, unarmed fallback unchanged). Hand selectors include an Empty Hand card.
- The focused choice drives the detail panel and a compact two-column grid of its starting combat cards (quantities from the current loadout).
  - Choosing updates cards in place; the focused card lifts and enlarges over 180 ms (less on phones, none with reduced motion).
  - Only the focused candidate exposes Choose/Selected and Information.
- Layout: two columns of equipment choices beside details and card preview, Continue bottom-right (phones stack); Continue names the next section; automatic advancement optional, default off.
- Flavor is one ellipsized line (full text via inspection). In card and equipment inspection, lore is one identity line (flavor's first paragraph); when more follows it ellipsizes and opens the lore modal with the whole text. Typeface, size, spacing and slant: Advanced → Text & lore.
- A new character defaults to the Animated sprite style; an existing character's explicit style is kept.
- `primary-stat-card` is one attribute model and disclosure renderer for Character Creation, Shrine point assignment and the Armoury.
  - Folded face: short label, one-line summary, current value. Reveal and focus/hover tooltip: authored description plus benefits from stat rules and equipment gates.
- `stat-allocation-row` is the invisible composition parent for the attribute face, value, decrement/increment controls and a reveal spanning the whole row.
  - Opening or reopening Assign Points is a refund boundary: every attribute returns to the mode baseline first, making the full bonus pool available.
- Setting rows keep one equal positive inset on all four sides.

#### Shrine components

- `shrine-option-card` is the shared folded option footprint for Rest, Smith, Flask Allocation and Level Up. Its viewport-relative width and height are data-owned by `balance.ui.shrinePresentation`; expanding a disclosure adds content below the uniform face.
- Smith opens `smith-upgrade-modal`, composed from `smith-candidate-card` and `smith-upgrade-preview`. Each candidate is one distinct owned armament below the run's tier cap, never an individual deck copy.
- Choosing a candidate is presentation-only: it shows current and next tier, cost, Stone purse, shortfall and every grouped sourced-basic-card delta.
- `Back to Shrine` and Escape close the modal without changing the run. Only an affordable `Confirm` spends the cost, promotes the armament, updates its sourced basic cards and leaves the Shrine.
- The DOM-free `SmithSelectionModel` owns the choose/review state and player-facing consequence copy.

#### Combatant components

- `combatant-frame` may compose `component-background`, `combatant-sprite`, `combatant-nameplate`, `intent-indicator`, `block-badge`, `health-status-bar`, `poise-status-bar`, `proc-status-bar`, `arcane-exposure-bar` *(not drawn in §13.4p's scope)* and `status-effect-tray`.
- Hit feedback is `damage-feedback`, with distinct `guarded-damage-indicator` and `health-damage-indicator` channels so absorbed Guard and residual HP loss are never visually conflated.

#### Menu components

- Contextual launcher `quick-menu-panel` is composed from `quick-menu-caption` and `quick-menu-row`. The full in-run menu is `menu-overlay`, composed from `menu-tab-strip`, `menu-tab`, `menu-panel`, `menu-footer`; the footer composes `save-game-control` and `save-quit-control`.
- Records: `MenuModels.js`; renderers: `menuComponents.js`.
- **Confirmation.** Potentially destructive Load and Quit Without Saving enter one shared `confirmation-modal`, whose `confirmation-action` is the only commit door.
  - Danger variants are an `alertdialog`: focus starts on the neutral `confirmation-cancel-control` (Back), Tab is trapped, and Escape, Back or the scrim cancel without mutation and restore the invoking control. Over the in-run menu, one Escape removes only the top confirmation.
  - After a commit an empty top-layer input shield lasts the navigation activation window (600 ms default), so a second physical click cannot hit a new Title control or combatant; it releases after the destination paint.
  - Danger borders keep the blood/ember palette; action and eyebrow text use the parchment token at ≥4.5:1 against computed backgrounds.
- **Controls rebind capture.** `controls-rebind-capture` is the stable Controls component surface; `rebind-capture-service` ignores lone modifiers. Escape on an armed keyboard capture cancels it, restores `controls-key-rebind-control` from Press… to Key with focus intact, performs no binding mutation, and suppresses the event before the covered menu can close. With no capture armed, Escape keeps its ordinary one-layer Back behavior. A later re-arm accepts a free key; occupied-key conflict resolution is a separate, unspecified policy.

#### Armoury components

- Family: `armoury-overlay` → `armoury-panel`, with `armoury-header`, `armoury-view-switcher`, `armoury-body`, `armoury-figure`, `equipment-slot`, `equipment-set-cell`, `armoury-inventory`, `inventory-item-card`, `inventory-detail-card`, `equipment-comparison`, `armoury-stats-panel`, `armoury-card-strip`, `armoury-region-header`. Ids are stable.
- Records: `ArmouryModels.js`; renderers: `armouryComponents.js`. Armaments is a configured `folding-tray` instance.
- Persisted view ids `grid`, `rack`, `hybrid` are labelled **Character**, **Inventory**, **Hybrid**; region id `slots`, tray instance `armaments`.

Views project one loadout:

| View | Layout |
|---|---|
| **Character** (`grid`) | Full width, two columns: identity, class/level, sprite left; Combat Power, Attributes, Relics right. No Armaments, Inventory or Stats tray. |
| **Inventory** (`rack`) | Armaments left, exactly one shared Inventory right, resizable divider with authored ratios and snap stops. Stats is a context tray. No second Inventory below Armaments. |
| **Hybrid** (`hybrid`) | Compact Character/Armaments split with its own resizable, snapping divider. Inventory and Cards are compact trays below; no Stats tray. |

**Trays**
- Trays `armaments`, `inventory`, `cards`, `stats` use `folding-tray` → `tray-header` + optional expanded-only `tray-resize-handle` + `tray-content`.
- `trayModel` owns edge, expanded state, count/summary, resize capability and sort intent; `renderTray` owns DOM and accessibility. Sort controls show only while expanded.
- Closed arrows point inward; open arrows point to the anchored edge (open Right Tray: `> TRAY NAME`).
- Resizable trays expose a 44px mouse, touch-hold and keyboard surface (Top/Bottom vertical, Left/Right horizontal).
  - Size is kept in memory per tray id and edge for the session; reopening restores it; starting/resuming a run or returning to Title resets the default. Folding returns to the bar or rail.
  - Armoury trays open at 45vh, keep ≥30vh when another tray is expanded, snap every 10vh from 30vh to 90vh (the generic component may hug content before its first resize).
  - Armaments is non-resizable; Inventory has no height resize while filling the Inventory-view pane. Bottom trays stay bottom-anchored and grow upward.

**Equipment positions are procedural content**
- `content/source/equipSlots.csv` supplies slot id, label, position label/code, accepted kinds, hand/socket, set capacity, swap rule, storage behavior, order; `content/source/unlocks.csv` adds position rungs; `armouryUi.layout.equipment.slotOrder` sets preferred group order.
- One compact vertical list shows every authored position as locked, empty or occupied; empty ones follow occupied and locked. Each row is a button selecting it for the Inspect panel; Replace and Unequip are separate buttons. A new position needs no screen branch.
- Item kind decides eligibility only; the selected hand position owns the sprite socket.
- The figure composer draws armour/body, `head`, `hands`, `feet` (`assets/equipment/<slot>_<id>.webp`, nothing if absent) and hand layers; other attachments need an explicit composer extension.
- `model/zones.js` is the one slot→zone map (§13.4b); a slot it does not name is refused at boot.

**Armaments list and inventory faces**
- Occupied rows: scaled equipment-card thumbnail, position code, name, Equipped/Reserve badge, Inspect/Replace grouped, Unequip at right (`armouryUi.layout.equipment.compactList`). Inspect opens beside desktop rows, or in a separate mobile view with Back.
- Armament faces use read-only first-tap disclosure and never equip on hold (`armouryUi.layout.cardClasses.armamentItem`: `holdAction` false, inline comparison); other classes keep `inventoryItem`.
- An unassigned item needs an explicit compatible destination (choices show position, occupant, active/reserve, locked). Selecting never equips. Equip/Move/Unequip are named buttons; Make active is separate, including for empty reserves. Changes name item and destination.
- Requirements, grip and storage checks stay authoritative. Combat changes dispatch priced engine intents; inspection never mutates a loadout. Mouse/pen drag works; touch scrolls. Magic is the primary combat-power label (Potency its modifier).

**Equipment receipts** are read models, never re-derived in a screen. `.armoury-equipment-receipts` (Character view's Equipment cards card, Stats tray) shows card packages, equip requirements, the Poise threshold (`.player-poise-receipt`) and **Equip load** (`.player-load-receipt`, `model/statProjection.playerLoadReceipt`): load / capacity, percent, Weight Class word (`registries.framework.weightClass`; capacity from Constitution, Strength and `mechanics.weight.capacityBase`).
- Load sums each equipped armament's `weight`; armour weighs its `poiseThreshold` (`ARMOUR_WEIGHT_RULE`). Each piece is multiplied by `mechanics.weight.itemWeightScale` (0.2), kept to a tenth; the item card's Weight label reads the same `pieceWeight` rule.

#### Shared HUD composition and combat layout

- **One shared HUD on Map and Combat.** Neither screen hand-writes a second HUD. The one-row `run-header-strip` holds character identity left, Cinders truly centred, Act/Floor/Build/Seed/Source right.
  - Cinders track and right trail are each capped at 30% of the viewport (data-owned) and never overlap.
  - The five metadata items share one data-owned font size and one centred baseline.
  - When width is insufficient, the right trail hides Source, then Seed, then Build (Act and Floor last), including at the smallest supported width, before it may touch centred Cinders.
  - `metadataShowTotals` defaults to false: Act/Floor show current values (`ACT 1 · FLOOR 1`), not totals; enabling it is data-only.
  - No duplicate Act/Floor line beneath the character name.
- **Primary and inventory geometry.**
  - `vitals-panel` is one outer card holding the unchanged HP/MP stack; Stamina is the Stamina orb (below).
  - `quick-access-panel` is one outer square holding the Armoury and Menu controls: visible tiles 18 px inside ≥44 px accessible hit areas. The two panels have equal outer height.
  - Refillable HP/Mana flasks are controls (Potions projection), not utility potions, and are not in this panel.
  - `inventory-belt` places Relics beneath Vitals and utility Potions beneath Quick Access on the same row.
  - Utility potions form one horizontal tray packed flush to the Quick Access right edge, growing or scrolling left. Relic and Potion trays share one centred baseline and one data-owned item gap (default 2 px); potion tiles match relic tiles.
  - Vitals and Quick Access panel-background opacity is data-owned, default 0%: the Vitals shell and resource-card frames show no border or background, troughs and labels stay visible, and invisible reference frames do not size the panel.
  - The map's `− ⊙ + ?` controls stay a separate lower group.
- **Responsive combat composition.**
  - `battlefield-stage` vertically centres player and enemy combatant frames at every shape.
  - Narrow layouts keep larger accessible cards in the horizontal `player-hand-tray`, clear of combatants and `combat-action-rail`.
  - HUD and combat composition are verified at 1440×860, 1200×730, 844×390, 390×844 and 320×640.
- **Resource-bar length is data-scaled, not a cap.**
  - Default reference maxima: HP 200, MP 20, SP 20.
  - Fill is `current / maximum`; visual length compares the maximum with the data-owned reference, up to the shared viewport cap. Gameplay state is never clamped.

**Combat zones**
- **Enemy row (upper right 60%):** at most 3 enemies (see the Enemy cap rule under the Encounter schema).
  - Each shows sprite/placeholder, name, HP bar, **Poise meter** (thin amber bar under HP), **threshold-proc bars** and status icon row, and **intent icon + number above the head**.
  - Proc bars: up to two active proc statuses (e.g. Bleed, Frost), each with its status's own glyph and `tint`, only when >0 (`src/ui/screens/combat.js`).
- **Player zone (lower left):** stance icon, status row, Block shield badge overlapping HP.
- **Hand:** bottom center, fanned, up to the derived `handSize` (base 7, max 20; `src/content/derivedStats.js`); hover raises the card ×1.5 with full text.
- **Stamina orb:** bottom left, current Stamina only (no maximum), with a Mana ring unless the `manaRing` setting is off (`src/ui/components/staminaOrb.js`).
- **End Turn:** bottom right; pulses if Stamina remains and any card is playable; confirm-free.
- **Piles:** draw (bottom-left corner, count), discard (bottom-right, count), exhaust (small, appears once non-empty). Click opens a scrollable modal grid (draw pile view is order-shuffled for display).

#### 7.2.1 Advanced game configuration

Advanced Settings is the player-facing editor for authored configuration (not a second balance table): every safe flag, tuning value, default and presentation size that can change without replacing content identities.

**Descriptors**
- A descriptor names source path, label, explanation, type, domain, shipped default, reset behavior and application timing. The editor and runtime resolver share it; UI code never retypes a default, range, enum or formula. A new eligible descriptor adds its control with no hand-authored row.
- A generated row's domain is read off its shipped value unless validation is stricter: a percent capped at 100 offers 0–100; a cap that must be positive starts at 1.

**Tabs** (`ADVANCED_GROUPS`, `src/ui/screens/settings.js`), in order: Opening, Progression, Stats, Rewards, Shops, Deck, Equipment, World, Interface, Text, Wireframes, Export, Sync, Changelog, About.
- Retired tab ids open the first tab, except the merged `Ratings & Resistance` and `Hand & Draw` tabs and a `Progression`, `Combat` or retired `Rules` tab left on a moved topic, which open Stats (`MERGED_ADVANCED_GROUPS`, `MOVED_ADVANCED_TOPICS`).
- A release build shows only Deck, Interface, Text, Changelog, About (`RELEASE_ADVANCED_GROUP_IDS`); dev and test builds show all. Stored values are untouched.

**Areas**
- **Progression:** starting level; experience multiplier; XP curve (`balance.level.xp`); optional max level; attribute points per level; points per derived-stat tier. The level-pace preview (§15.2) shows the curve before a run.
- **Class defaults:** registry-derived starting STR, DEX, CON, WIS, INT, resource/flask allocation and other schema-valid values; they must satisfy the creation mode's bounds and totals, and invalid combinations are explained, not applied.
- **Cards and windows:** resting, selected and reading card sizes; phone sizes; modal, tray, HUD and window dimensions; UI scale and layout thresholds. Dependent constraints are enforced together (resting < selected < reading) and the editor names the blocking value.
- **World, economy and rewards:** encounter/reward odds, currency and experience multipliers, pricing, map-generation tuning, other global balance values with a runtime override.
- **Rules and accessibility:** eligible boolean flags and closed-set modes. Ordinary Display, Audio and Accessibility controls stay in their homes and appear in Advanced only in the searchable inventory; both resolve through one descriptor and one persisted value.

**Combat formation**: the perspective grid is the only combat layout.
- One sheared grid (rows slide right with depth; every cell the same parallelogram): three lanes, an enemy back and front rank, one player rank nearest the camera, open ground between (`teamGapRows` strip heights, default 0.6, no tiles). A cell's shadow is its foot anchor.
- The party has a front strip (nearer the enemies) and a back strip; the extra enemy strip needs Core's extra row.
- Enemies fill the back rank first (one in the middle, two on the outer lanes), then the front rank, up to six; the party shares its rank and the player starts in the left lane. More than six enemies widens the grid to more lanes, never two bodies on one anchor.
- Cells keep gameplay addresses (column is depth, outer = back; row is a lane); the player's front column is not a perspective destination. Pressing an occupied enemy cell acts on that enemy (select, or play the armed card or flask).
- Lane span, rank tops/heights, shear and foot fractions per phone, desktop and short strip are data (`combatFormationModel.positioning.perspectiveGrid`).
- A saved `classicAppearance: true` is ignored; an old profile loads as the grid.
- Supplied 1×1 and 2×2 layouts use responsive percentages (reference anchors at 1641×526 checked against the exports). Explicit saved group edits (percent offsets, optional snapping, default 50 CSS px step) take precedence. No in-battle positioning control.

**Rows, reset and persistence**
- Search and navigation work at every viewport and text size.
- Each row shows shipped default, resolved value, current-run vs new-run effect, and Reset; sections and the whole editor reset after confirmation.
- Invalid legacy or hand-edited values resolve to the authored default and are visibly reported; never accepted or dropped silently, never `NaN`/infinite state.
- A renamed balance path keeps its stored override: the retired key is read as the current one wherever settings are read (bundle, snapshot, imported file); the current key wins when both exist. Today: `balance.shrine.healPct` → `balance.rest.hpPartialPct` (§13.4j).
- Run-defining values are snapshotted at run creation and never recalculate an in-progress run unless the descriptor declares live application safe; older runs without a snapshot derive their version's shipped defaults.
- Profile settings store only overrides; Reset never writes a stale default.

**Portable export**
- One Export configuration action, debug pages only (`pageDebug()`, `src/ui/screens/settings.js`), serializes versioned JSON: schema/version marker, build/source info, explicit overrides and resolved values. Never run saves, profile progress, unlocks, history, file paths, or quarantine/archive data.
- Desktop with the File System Access API: Save As picker with a `.json` name. Otherwise (unavailable, declined, mobile): browser download/share fallback that never silently replaces an existing export.
- Export changes no settings; the format is deterministic and round-trippable (Import unspecified).

**Settings door geometry**
- Uses the maximum safe visual viewport after the shared outer inset (no fixed 90% cap). Header, navigation and footer stay fixed; the content pane is the single vertical scroll owner, with no second scrollport in ancestors or section lists.
- Narrow screens: compact section chooser. No private zoom.
- The active row, focus target, scroll cue, footer actions and close control stay reachable at the required desktop, landscape and phone shapes, including Text XL and the mobile on-screen keyboard.

**Delivery:** ships as one complete feature (inventory, persistence/snapshot, export fallback, single-scroll geometry, accessibility, repository checks together); each subsection gets a refreshed preview with desktop and phone screenshots.

### 7.3 Input

Full playability with mouse only. Keyboard (nice-to-have, M4): 1–9 select card, E end turn.

- **Selection and information are separate from play.** The focused card, selection glow, Information button and legal-target highlights are preserved; Information opens details without playing; tap, hold, keyboard, controller and direct-target drag confirmation remain.
  - A tap selects and never plays; play needs a second tap on the card or a target pick.
  - The "Tap a card to play it" setting (default off) restores one-tap play when the target is unambiguous (self and all-enemy cards; one living enemy).
  - Hold selects without playing (inspect, Upcast, target choice).
  - One select colour, the targeting colour (`--selection-color`), for armed, held, keyboard-focused and inspected cards; no gold select state on the hand.
- **End Turn:** a single press when no card in hand is playable; otherwise the configured second beat.
- **Card flick to play.** An upward or upward-diagonal primary-pointer flick from a playable hand card plays on release without reaching a combatant.
  - Profile setting, default on. Distance 32–160 CSS px (default 64) with synchronized slider, numeric entry, reset and a practice area accepting exactly the combat inputs. Saved `touchFlickPlay` and `touchFlickDistance` keep their meaning.
  - Distance is net upward displacement in viewport CSS px, independent of art/UI scale and of the 12 px drag-start slop. Also required: upward-dominant movement and ≥300 CSS px/s recent upward velocity (authored separately).
  - Touch, mouse, trackpad and pen share one recognizer and settings.
  - Preview selects the nearest legal target; release uses the same resolver and revalidates playability. Self cards select the player; all-enemy cards their legal group. Distance ties are deterministic.
  - Below-threshold return, downward release, information-button gesture, pointer cancellation, capture loss, blur or a blocking modal cannot flick-play; no gesture commits twice. Disabling flicks keeps direct drops.
- **Card rewards.** One touch, mouse, pen or Confirm activation selects without collecting and enables the footer Confirm; Back preserves selection. Confirmation persists once; a refused or throwing save restores the pending choice for retry.
- **Tooltips.** Statuses (current math), intents (exact post-modifier damage), relics, flasks and map nodes show a concise tooltip after 1 s of continuous hover (`tooltipDelay`, default `1s`).
  - Leaving early cancels; each new target and nested keyword waits the full delay. It stays visible over its owner or panel, dismisses 500 ms after leaving both, and re-entry cancels dismissal.
  - Touch does not synthesize hover. A tap on a non-control detail selects it (highlight); a second tap explains it at once. Selection ends on a press elsewhere, Escape, or the detail leaving.
  - Keyboard/gamepad focus explains after 500 ms regardless of hover delay; Enter or Space on a selectable detail explains at once.
  - Cards have no hover or tap tooltip: selecting reveals Information, which opens card inspection (nested keyword tooltips). Card tooltips open only there; on every other surface (hand, reward, shop, deck, upgrade faces) tag symbols, keywords and underlined numbers are plain decoration and a tap anywhere is the card's own action.
  - Inspections show complete effect text, decision-relevant values/requirements, classifications as explained tags and keyword definitions; nothing repeated (art descriptions, generic instructions, flavor explanations, identical effect text).
  - Deliberate reading surfaces may require a validated hold: the Armoury equipment-comparison tooltip uses `armouryUi.layout.comparison.holdPreviewDelayMs` (`160` ms) and never opens from hover or focus alone.

### 7.4 Feedback & animation rules

**Hit feedback**
- Floating damage/heal/block numbers; brief target flash on hit; Bleed burst and Stagger get distinct, slightly bigger effects.
- Screen shake on every hit that costs HP, by share of target max HP lost (after Block): 1 px under 2%, 2 px from 2%, 4 px from 8%, 7 px from 20%, 10 px from 35%; never over 10 px. Unknown max HP: 1–4 px by absolute HP. Phones keep the shake.
- Hit-stop: 60 ms on a hit of 6 HP or more, 120 ms on a hit of 35% of max HP or more (data rows; 0 disables). The attacker's impact frame and the target's recoil hold; only those two figures pause, and a click skips it.
- Damage numbers size by share of max HP: `pct20` from 20%, `pct35` from 35%, `crit` from 25 HP. Hits ≥20% fire the `bigHit` haptic.

**Beat order**
- The attacker's stance, attack clip and return play first; then the target's reaction (hurt pose and flash, shake, evade, block or Stagger wobble).
- `reactionMs` after the reaction starts (data row, default 180 ms at Normal; under Action pacing `actionPacing()` sets `reactionMs: gapMs`, so the 180 ms default applies only without it) the damage/guard/heal numbers fire with sound and haptic; then HP, Poise and Block bars update. Numbers never wait for a long fixed effect (heavy hit flash, Stagger wobble run underneath).
- Contact spark and attacker hit-stop stay at the impact frame; the target holds its rest pose until its reaction starts.
- Counter return beats use the same sequence: the attacker's return, then the reaction, then the numbers `reactionMs` later.

**Animation settings**
- Instant and Reduced motion drop the hit-stop; slow/normal/fast keep it. Reduced motion also drops the shake; the Screen shake setting drops only the shake; Reduce flashes suppresses flashes (`src/ui/fx.js`).
- No animation blocks input; a click always skips to end-state.
- Fixed effect durations: heavy hit flash 380 ms, cast glyph 450 ms, Stagger wobble 600 ms. The Animation speed setting (slow/normal/fast/instant) scales pacing (beat, step, lunge), never these.

**Action pacing**
- Each action plays: action word → animation → result (hit, miss, blocked, countered) → sprite reaction → damage and bars → reset → next action, one gap per step.
- The gap is **Pause between steps**: default 1000 ms, range 250–2000 ms; Instant and Reduced motion make it 0. **Auto combat speed** divides it during auto combat (default ×1.5).

**Defeat and Victory** (`src/ui/screens/gameover.js:58-65`)
- Defeat: dark fade, gold serif text, then stats card; title "Defeat", aria-label "You perished". Victory: title "Victory", aria-label "Ember restored".

**Sound** is shipped and procedural.
- `sfx.js` is the hook bus (`sfx.play(id)`); `main.js` wires it to `src/ui/audio.js`, a WebAudio engine synthesizing every SFX and per-context music bed (title/map/combat/elite/boss/shop/rest/victory).
- Content: `src/content/music.js` (scales, beds, `MUSIC_MANIFEST`) and `src/content/sfx.js` (`SFX_RECIPES`, `SFX_MANIFEST`).
- A recipe is layers in the closed vocabulary `tone` and `noise` (`SFX_LAYER_SCHEMAS`, `model/schemas.js`); a malformed layer fails validation naming its recipe id.
- `resolveRecipe`: exact id → family row (segment before the first `_`) → required `default` (audible, never silent: Law 1 clause 5). The fallback warns once per unknown id. A new family is one row; no engine change or registration list.
- Volumes/mute are settings; music defaults non-zero.
- A context's bed is a bed object or exactly `'silence'` (`MUSIC_SILENCE_WORD`, `src/model/schemas.js`). `validateContent` rejects quiet-shaped mistakes by name (null, missing variants, `[]`, zero gain, wrong or miscased word); an unknown context at runtime warns naming itself and plays nothing.
- Rendered tracks are the only shipped audio (offline from `music/score/<id>.mjs` by `tools/score/render.mjs`); tracks and manifest are `music/…` ids in the art repository's `common` pack (`common/music/`), scores and render tool under `art/music/`; `music/*.mp3` and `music/manifest.json` are gitignored.
- Overrides:
  - A music folder with `manifest.json` (the Settings folder or, blank on http(s), the shipped tracks via `SHIPPED_MUSIC_FOLDER`, `content/music.js`) replaces a context's bed; a missing/unplayable track falls back to the synth, as does a `file://` page.
  - `SFX_MANIFEST` (shipped empty) replaces a synth SFX id; `audio.js` `sfx()` short-circuits on a manifest entry, and a failed sample load falls back to the synth (`src/ui/audio.js:152-154`).
  - `MUSIC_MANIFEST` is imported and never read (dormant).

### 7.5 Visual style

Palette tokens, card rendering, fonts.

- **Palette:** semantic tokens in `base.css`; three sets: the default dark set, a **high-contrast** variant, and `body.cb-safe`, a colourblind-safe remap on Okabe-Ito hues (danger→vermillion, heal→bluish-green, frost→sky, blight→orange).
  - Map structure has its own token, `--map-structure`, so roads and rings re-level without touching text colour.
  - Hex values live in `styles/base.css`; `node tools/contrast-audit.mjs` gates both palettes.
- **Cards:** DOM elements (not canvas): rounded rect, rarity-coloured frame, cost orb top-left, type banner. Type presentation (geometry + banner colour per card type) is data: `balance.ui.cardTypes`.
- **Fonts (to build):** Cinzel (display) / Inter (body) are named in `font-family` with system fallbacks (Georgia / system-ui) and do not ship yet (`CREDITS.md`). They will load as pack files through the pack loader (EXTERNAL-ASSETS-PLAN step 3b moves only the "AS Lore" faces); fallbacks stay.

#### Notes and history

- Every public component id must stay backticked (`tools/ui-components.mjs`, C10).
- The perspective grid is the only combat layout; classic layout, the Battlefield tab and the formation editor are gone.

Full history: [docs/spec-history/07-ui.md](docs/spec-history/07-ui.md).

---

## 8. Testing

One suite, two runners; no hand-kept test list (the index is derived).

- Runners: `tests/index.html` (browser) and `node tests/run-node.mjs` (headless); both load `engine.test.js`.
- The suite needs no DOM.
  - It asserts model and engine code plus some UI presentation models and helpers, and never mounts a screen.
  - It says so in its boundary block.

```
node tests/run-node.mjs                       # the whole suite + its boundary block
grep -n "test('" tests/engine.test.js         # the index, derived
```

### Contract a test must meet

1. **Headless.**
   - Other `tests/*.test.mjs` may mount a screen on a stub DOM (`tests/card-rank.test.mjs`, `tests/blacksmith.test.mjs`).
   - A test needing a real browser belongs in `tools/`.
2. **Both edges:** empty/zero and cap/overflow (Charter quality gate).
3. **Content-driven mechanics are asserted through their data**, never a number hard-coded in the test.
   - A status test drives `content/statuses.js` rows.
4. **A check is trusted only after it has been watched to fail.**
   - `--selftest`: known-bad corpus; each case must fail for its named reason.
   - `--mutate`: reinstate the defect N ways; each must be caught.
   - CI runs these gates for, among others, `tools/verify-shipped.mjs`, `tools/fullscreen-control.mjs`, `tools/dirorder.mjs` and `tools/credits-check.mjs` (`.github/workflows/ci.yml`).
   - `tools/content-build.mjs` is not wired into CI.
5. **Every release-gating instrument prints what it did NOT check, in its run output**, not only its header.

### Release capture set

`tools/release-shots.mjs` is the release capture set; it is not `tools/screenshot.mjs`.

- `tools/screenshot.mjs` photographs the **source tree** over a local server.
  - Covers only the `?shot=` states that existed when written; **structurally blind** to any surface without one.
- `tools/release-shots.mjs` photographs the **built bundle** (`dist/AshenSpire.html`) at both shapes, with **two denominators, both printed**:
  1. **Top-level states**, derived from `main.js`'s `?shot=` states.
  2. **Navigable sub-surfaces** (tabs/panels inside a state), derived from `uiContent.js MENU_TABS`, `settings.js settingsCategories()` and `balance.equipment.views`.
     - One generated shot per member, each with an **assertion** that the surface both selected and painted.
     - Surfaces with no `?shot=` are reached by real clicks and seeded storage.
  - It **fails before the browser starts** on an unaccounted state, a **home that derives zero members**, or a sub-surface shot with no assertion.
- `src/ui/surfaces.js` is the one table of tabbed surfaces and holds no members.
  - Each row points at the home that defines its set and asks it at call time.
  - Denominator 2 enumerates the three sets the harness was told about, and prints the sets it knows exist and does not enumerate.
  - A fifth set no row names is invisible to the table.
- The artifact is **never modified** to reach a state: crisis states come from writing storage from outside and reloading.
- Failure lines name **floats and screens separately**.

### Browser-facing gates the suite cannot reach

- `node tools/verify-shipped.mjs`: bundle matches source.
- `node tools/mapplan.mjs`: map distributions at the current shape.
- `node tools/content-build.mjs --selftest --mutate` (§3.14).
- `node tools/contrast-audit.mjs`: palette targets.
- `node tools/release-shots.mjs`: run by hand before a release; no CI job runs it.
- `node tools/ai-disclosure.mjs --check` (§2.1).
- `node tools/screenreach.mjs`, `tools/zoomplace.mjs`, `tools/mapreach.mjs`, `tools/sfx-loudness.mjs`.

Standard: all green before a milestone is called done, on whichever runner you used.

#### Notes and history

- Rule 5 is house law: a green must say what it did not check.
- The old required-coverage list is gone; derive the index with the commands above.

Full history: [docs/spec-history/08-testing-milestones.md](docs/spec-history/08-testing-milestones.md).

---

## 9. Milestones & acceptance criteria

Four milestones, each with a build list and acceptance criteria (cited by CONTRIBUTING.md as "acceptance criteria (spec §9)").

### M1 — Combat vertical slice
- **Build:**
  - Model layer: schemas, registries, formulas, validation.
  - Engine core: queue, triggers, status-model interpreter.
  - All statuses/stances as content data.
  - Vagabond + 24-card set; 5 Act-1 encounters + elite + Watchful Omen boss.
  - Combat screen with full tooltips/targeting/piles.
  - Tests 1–11 + 14–17.
- **Accept when:**
  - `index.html` → class select (Vagabond only) → a fixed 4-fight gauntlet (2 monsters → elite → boss) is winnable and losable with zero console errors.
  - Every visible number matches engine math.
  - All listed tests green.

### M2 — The run
- **Build:**
  - Map gen + map screen.
  - Rewards (cards/runes/flasks/relics); 16 relics; 7 flasks.
  - Shrine/shop/treasure/4 events.
  - Save/continue; seed entry + display; death/victory screens.
  - Tests 12–13.
- **Accept when:**
  - A complete seeded Act-1 run works end-to-end.
  - Reload restores exactly.
  - Same seed twice → identical map, rewards, shuffles.
  - Abandoning mid-combat restarts that combat.

### M3 — Content pass
- **Build:**
  - Reaver, Starseer, Herald and the full-parity Rogue slice (§5.1).
  - Acts 2–3: rosters, elites, 2 bosses incl. phase mechanics and the heal-on-hit final boss.
  - Events to 10; relics to 40; colorless pool.
  - Balance pass: instrument run history to check; no win-rate target (owner ruling D1 governs).
- **Accept when:**
  - All 4 classes complete 3-act runs.
  - Every class owns its complete card/equipment/art slice.
  - Every card/relic/event is reachable.
  - No unbeatable-by-construction encounters (elite HP vs. average deck DPS sanity table in the balance notes).
  - `scripts.js` budget still < 5%.

### M4 — Polish
- **Build:**
  - Fx pass: floating numbers, shake, transitions.
  - Run-history screen; keyboard shortcuts.
  - First-run tooltip overlay (≤4 callouts).
  - Sfx hook wiring.
  - Asset pass replacing placeholders (CREDITS.md complete).
- **Accept when:** DEVELOPER.md documents the layer rules, state shape, every opcode/formula op/event/predicate, and "add a card/relic/status/enemy/event in <10 lines" walkthroughs.
  - Each is verified by actually adding a throwaway example.

#### Notes and history

- M3 has no win-rate target (D1).

Full history: [docs/spec-history/08-testing-milestones.md](docs/spec-history/08-testing-milestones.md).

---

## 10. Forward hooks (build the seam now, not the feature)

Seams that exist so later features need no engine redesign.

- Ascension-style difficulty
  - Ships as `run.custom.ascension`.
  - The `modifiers: []` slot is unused.
- Act 2/3 signature mechanics (engine support from M1)
  - Enemy phase-change interrupts (Watchful Omen already does this).
  - Enemy self-heal on dealing damage (final boss; status hook on `damageDealt`).
  - Enemy applying Bleed to the *player* (player-side meters exist; player Bleed threshold 15).
- Daily seed / run sharing
  - Seeds are displayed and enterable; nothing else needed in v1.
- Content packs / mods
  - A pack is one folder of content files passing validation.
  - No pack loader in v1.
- Second card pools per class ("Remembrance" variants)
  - Class def takes `cardPool: []`; alternate pools are content-only.

## 11. Non-goals (v1)

Non-goals:
- Accounts, monetization, a mod loader, Steam-style achievements.
- Localization (strings live in content files, so l10n is possible later).
- Multiplayer (the game is single-player).
- Audio bundled into the game file:
  - The rendered score loads at runtime: pack files through the common index in the web edition (EXTERNAL-ASSETS-PLAN step 3c); the `music/` folder beside the page in source and single-file builds.
  - The synth bed is the fallback.
  - SFX stay synthesized (§7.4; `SFX_MANIFEST` accepts real files).

#### Notes and history

- Narrow/mobile layout (`data-layout`, `balance.ui.uiScale`) and audio (§7.4) are shipped features, not non-goals.

Full history: [docs/spec-history/10-hooks-non-goals.md](docs/spec-history/10-hooks-non-goals.md).

## 12. Planned game expansion — proposed mechanics and acceptance

Shipped per item ([docs/SPEC-RECONCILE.md](docs/SPEC-RECONCILE.md) stage 3); changing a requirement is a spec change.

- Open: 1.0 elite target in §12.4 (row P6); Power resting stance in §12.5 (row P8b).
- Named verification boundary: rows P1 and P8.

### 12.1 Dodge and action feedback

- **Dodge Roll card** does not roll. (Under §13.4p the Ward guard is retired: it grants Block and a Poise guard.) Evasive Guard alone carries the roll.
  - Grants 3 Block, 3 Poise, 3 Ward, each plus the DR bonus a physical skill's Block reads (`cardRatingBonus`). Block also takes Dexterity and Frail; the guards do not.
  - Poise and Ward are guards (`gainPoise` / `gainWard`, §3.4): absorb physical or magical impact before the Poise or Ward meter fills; expire with Block at the player's next turn start.
  - No upgrade. Keeps live Weight Class action and stamina costs (`weightClassPriced: true`); compound cards keep their authored cost rules.
- **`dodgeRoll` opcode** (unchanged): roll the framework die on the deterministic `misc` stream; compare Dexterity and Weight Class to the framework difficulty; on success grant the framework's temporary guard through ordinary Block.
  - Not guaranteed avoidance, invulnerability, or cancellation of the enemy's next attack.
- **No dodge-result widget**: no receipt, float, dialog or live announcement for `dodgeRolled`. Success shows as Block gain plus the dodge visual; the event stays in the log.
- Previews, disabled reasons, tooltips and playback match the engine; no second damage rule.
  - Verify Light, Medium, and Heavy costs, resource sufficiency, success/failure, repeated plays, Block/status interactions.

### 12.2 Trader armaments, weapon arts, and transactions

Traders sell armaments and weapon arts; the combat HUD only exposes owned, available arts (no buying in combat without a mechanics amendment).

- **Stock:** data-priced armaments and eligible weapon-art cards, rolled deterministically once per visit and persisted.
  - Reload never rerolls or restores sold stock. Prices/sale fractions are balance data.
- **Buying an armament:** enters inventory and discovery only after successful collection.
  - Reject: already carried/equipped, full inventory, insufficient cinders, stale stock.
- **Weapon arts** use the loose-card and compatible item-mount model: no parallel unlock inventory, no auto-install, no bypass of extraction/seating rules.
  - HUD uses existing card identity, availability, targeting, payment rules; previews are not plays; unplayable cards cannot be activated.
- **Selling:** stored, unequipped armaments only; an equipped item explains it must be unequipped first. Never silently changes an equipment set. Profile discovery survives.
  - Smithing tiers and mount records stay bound to the armament identity in the run ledger: not deleted, not converted to loose cards, no usable cards while unowned; reacquiring restores them via existing reconciliation.
  - Preview discloses tier, attached cards and value before commitment.
  - No duplicated upgrades, mounts, cards or ownership; no profitable immediate buy/sell loop.
- **Transaction:** validate stock, ownership, capacity and funds at commitment, apply once. Refusal leaves cinders, stock, inventory, mounts and discovery unchanged.
- **Migration:** older shop saves without the new shelves load them empty for that open visit; no randomness consumed, no reroll.
- Verify repeated/stale activation, full inventory, equipped duplicates, upgraded/mounted armaments, save/reload, reacquisition.

### 12.3 Combat HUD, piles, and potions

- **Piles:** one entry showing both counts opens a shared modal with separately labelled Discard and Exhausted views. Presentation only: zones, exhaustion, reshuffle eligibility unchanged.
  - Keep keyboard/touch access, focus return, empty states, draw-order concealment.
- **Potions:** collection entry in the far-right bottom HUD slot; its menu lists health charges, mana charges, stamina potions and other utility potions via the existing action plan.
  - Selection and inspection are inert; only an enabled Use spends a charge or starts targeting; cancelling spends nothing.
  - Show quantity, effect, capacity, unavailability reason.
  - Health/mana refillable charges and utility-potion inventory stay separate domains with existing capacities and refill rules. Stamina potions never become a third refill pool; inventory never silently expands.
  - Keep resource shortcuts; the opening key must not consume a potion.
- Verify zero quantities, full resources, targeted-potion cancellation, playback, turn restrictions, save/resume.

### 12.4 Branching destinations and roster

- **Destinations:** new maps have multiple terminal boss destinations per act, with distinct legal routes through locations, fights, events, rewards and traders.
  - Node identity fixes its destination and boss encounter; no single global boss.
  - Completing the chosen terminal advances/completes the run once under existing act rules; not every terminal need be cleared.
  - Every offered path reaches a valid destination: no unintended dead ends, unreachable rewards or repeatable completion rewards. Every terminal route keeps an accessible pre-boss rest.
  - Persist topology, destination identity and encounter selection.
- **Legacy saves** keep topology and boss behavior.
  - An unentered legacy boss node with no stored boss identity maps explicitly to the original boss for that act; no RNG draw.
  - Loading never regenerates a map, moves the player, draws RNG or reinterprets an in-progress encounter; combat snapshots unchanged.
  - Validate connectivity, pre-boss rest, deterministic reloads over a seed corpus; play distinct terminal routes.
- **Roster targets** (elites do not count toward the other two): see table below.
  - Existing qualifying enemies count; recolors and numerical variants alone do not.
  - Each: stable ID, distinct identity/tactical role, authored card moveset, readable intents and counterplay, recognizable sprite, appropriate animations. Bosses add a signature encounter mechanic (phases optional).
- **Movesets** extend the existing seeded weighted move selector (authoring/presentation only).
  - Preserve repeat history, current intent, phase transitions, repeat limits, delayed-action state.
  - No plan cursor is shipped (#239/#241 proposed); ordered plans need their own verified change.
  - No parallel move picker; no intent reroll on card render or save load.
- **Coverage:** every counted entry reachable through normal progression, spread across suitable locations and difficulty.
  - Keep a roster checklist (identity, location, encounter, moveset, sprite, animations, rewards, verification).
  - Test every moveset and boss with Dodge, status, potion, weapon-art, victory/defeat, save/resume.
  - Prove foundations with two regular enemies and one boss first.

Roster targets:

| Class | Target |
|---|---|
| Regular enemies | 20 unique |
| Bosses | 10 unique |
| Elites | 1 to 5 per seat, averaging 3 (±0.5); owner ruling D4; open (`docs/FINISH.md`) |

### 12.5 Shared presentation and animation rules

- **Shared components** for armament/card faces, enemy frames, modals, tabs, counts, costs, tooltips; card categories and enemy silhouettes stay distinct.
  - Folded character-information cards: one full-width header geometry; one open at a time, siblings close without duplicate toggle work, focus/reveal keep the header visible without unnecessary scroll jumps.
- **Player animations** (owner-approved): see table below.

  - Guard skills and Powers replace the visual resting stance until that character's next turn begins; attacks, casts, hit reactions return to rest. Skipping and reduced motion give the same result.
  - Every action frame: paid stamina, mana, HP use green, blue, red silhouette auras (combined payments keep each). Guarded resting stances: faded blue outline.
  - Visual state is separate from mechanical stances and lives outside rebuilt DOM nodes.
- **Enemy animation precedence:** explicit actor-and-action override, first matching tag in the ordered table, authored intent, neutral fallback.
  - Multi-tag cards/moves pick one primary animation deterministically; extra cues may accompany without replaying it.
  - Families: slash, thrust, strike, projectile, spell, guard, dodge; character sprites where authored. Missing assets fall back safely.
- **Motion:** animate draw, selection, targeting, play, resolution, discard, exhaust, attack, hit and defeat as appropriate.
  - Resting fighters hold their authored pose, no idle bob, in every rendering style and performance mode; keep action/reaction clips and status/aura feedback.
  - Engine outcomes remain authoritative. Skipping, interrupting or disabling animation never alters state or strands input.
  - Reduced motion: brief static/opacity feedback instead of travel/shake/repeat; outcome info kept.
  - Non-color cues, focus-visible controls, viewport-contained tooltips, mouse/keyboard/touch on desktop and phone. Validate timing, handler cleanup, multi-enemy performance in browser playtests.

Player animations:

| Card | Animation |
|---|---|
| Attack-type | attack |
| Power | three silhouette-glow phases over combat idle |
| Skill with guard/block tag | defend |
| Other skill | cast over combat idle |
| Shield Bash, shield-profile/shield-tagged attack (physical shield equipped) | shield bash |
| Shield-tagged defensive card, `shieldGuard` profile | shield guard; parry with a Parrying Dagger |

### Approved poker equipment cards (#784)

- **Equipment card:** one 350 by 490 canvas, uniform 5:7 scaling. Armament art keyed by item id; armor uses its painted menu pose. `equipmentCardModel` reads canonical base facts, tags, requirements, modifier vocabulary.
  - Live comparison, upgrades, Equip/Move/Unequip stay separate existing receipts/actions.
  - Inspection: hover/keyboard explanations plus full-text disclosure for touch/long content; overfull regions point to details, not clip.
  - Player Poise is live (§13.4k): surfaces render the meter's max.
- **Inspection component** renders every registered weapon, shield and staff with search, type filter, enlarged view; merchant offers and buy/sell inspection use it. Prices, smithing tiers, mounted cards, transaction rules stay live receipts outside the base-value card (#799).
- **Item cards:** weapon, potion, relic faces share a 5:7 canvas; listing cards use a 280px track in a responsive grid, no last-row stretching.
  - Hold progress overlays the face; hold duration and commit/cancel unchanged. Potion/relic cards show authored effects with full-text inspection.
- **Combat hand:** solo card width 150–180 viewport px at 5:7; desktop/widescreen capped at 97 viewport px at 2:3 (`uiConfig.scenes.w4a.sizing.desktopFooter.cardMaxViewportPx`, `handGapPx`, `desktopHeader.splitHeightPx`).
  - End Turn, Reaction, Auto at 0.7 of former size (Reaction and Auto on widescreen too); desktop cards 0.8; lowest hand card 10 px above End Turn; top HUD band 44.8 px.
  - More cards overlap or scroll, never shrink. Combatants fill their cells, close to the hand, not overlapping cards or HUD.
  - Three enemies fit without horizontal scroll; four or more may scroll; short heights may scroll vertically. Inspection never plays a card.
- **HUD and floaters, all form factors**:
  - Every combatant, player included, shows only the overhead mini HUD (HP bar, action intent), never a selected panel (`ui/models/TargetHudModel.js`). Double click, double tap or hold on a non-target figure opens the inspect panel.
  - Poise is drawn as an always-visible bar under HP (an empty trough at 0/0), with no Poise badge or HP-bar overlay; AC is not drawn. The inspect panel still lists both.
  - Mini HUD layout, every combatant (owner, 2026-11-07, backlog #11/#4/#5/#6): intent row above, centred over the HP bar; a Block shield on the left (value inside, slot reserved at Block 0) as tall as the HP and Poise bars, then the HP bar and the Poise bar (same width and height) with the badge row below; the Poise bar shows Poise left (full when untouched, draining) in both modes.
  - Badge row: small round count badges for Precision, Evade, Ward, Counter, Reflect and every status and buff, fitted within the bar width; the rest collapse into +N, which opens the inspector.
  - Bar width and height are per-form-factor HUD layout tokens (`--hud-mini-bar-width`, `--hud-mini-bar-height`), never a function of max HP, Block or badge count.
  - Floaters are an allowlist (`ui/models/FloaterPolicyModel.js`):
    - Drawn: attack damage numbers (HP an attack deals; HP lost to an effect or proc tick draws none), Hit (and Hit — Evade Failed), Missed (dodge or evade reads as Missed), Blocked, Countered, Defeated.
    - Not drawn: cost, Block, heal, Poise, Ward, Barrier, pierce numbers; status/buff words; break, stagger, critical, resisted, immune, range, contest words.
    - Sounds and haptics play as before; combat log unchanged.
  - Phone: hand cards fill its full width, spaced evenly up to one card width apart (`ui/models/HandLayout.js responsiveHandLayout`); by-count overlap (five overlap, more compress) applies to other form factors only.
- **Card face rules**: glance face shrinks rules text first, to the 11 on-screen-pixel floor.
  - One or two lines at the floor: show it. A one-line rule always shows.
  - Three or more lines at the floor (or an uncarriable clause): show the Inspect cue instead.
  - The (i) Inspect badge over the selected hand card is centred on it.
- **Card face summaries**: the Inspect cue is a last resort. A card whose computed face cannot be said in five-word clauses authors an optional `faceTemplate`.
  - One to three lines, at most five words each, same `{token}` bindings as `textTemplate` (numbers stay live), naming the main effect: a tag or status is named ("Gain 3 Foresight."), a pile move is plain ("Return 1 exhausted card."). A `[v2:...]` span shows only under the expanded combat rules.
  - Shown instead of the Inspect cue, after any downside the computed face reserved (Exhaust, a payment); details stay in Information.
  - Ability cards may carry it per grade (`gradeProfiles[].faceTemplate`). No registry card shows the cue on its face in normal play (`tests/card-face-summaries.test.mjs`).
- **Mobile combat art:** at widths up to 640px figures render at 90% of fitted size (157.5px reference minimum, not 175px). Neighbor enemy art may overlap slightly; names, meters, intents keep layout and size.
- **Card actions:** selecting a card reveals a circular Information button centered above it (replaces hold-to-zoom for the solo hand).
  - Modal: card beside details, green Play card action or disabled gray one with a visible reason.
  - Stationary hold shows shared progress and uses the card on completion; early release cancels; targeted cards enter existing targeting.
- **Target preview:** selected cards preview legal targets without committing.
  - Pure friendly cards highlight the player blue; hostile cards highlight every living enemy red. Unavailable cards and dead enemies do not glow.
  - Selection changes and Escape clear stale highlights. Raster silhouettes keep transparent backgrounds so glow follows the artwork.

#### Notes and history

- Section 12 is shipped per item; open items are listed at the top of this section.

Full history: [docs/spec-history/12-expansion.md](docs/spec-history/12-expansion.md).

## 13. Seats — regions bound to content, order seeded

Seats bind a region's enemies, encounters, boss pool and scenery to the run; a seeded per-run seat order decides which seat each tier climbs. World: [docs/LORE.md](docs/LORE.md) §1, §6. Mechanics contract for the 0.7 line; every rule is stated so a command can falsify it.

### 13.1 What a seat is

A **seat** is a region with its content: enemies, encounters, boss pool, combat scenery (later: city, tower). The closed set lives in `SEATS` (`src/content/seats.js`); a row is `{ id, regionId, name, baseTier }`.

| seat id | region id (`content/environments.js`) | display name | authored baseline tier |
|---|---|---|---|
| `weald` | `hollow-weald` | The Hollow Weald | 1 |
| `marches` | `pale-marches` | The Pale Marches | 2 |
| `reach` | `cinder-reach` | The Cinder Reach | 3 |

- `validateContent` refuses a `regionId` that is not an `ENVIRONMENTS` id, a duplicate id, and any set other than exactly these three (a fourth seat is content, Law 1, but the three-seat run shape is a rule until §13.4 says otherwise).
- **An act is a seat at a tier.** `run.actNumber` (1–3, looping under Endless) is the **tier**; the seat climbed is `run.seatOrder[contentAct - 1]`. Nothing else derives one from the other. Difficulty is the tier's; place, roster, boss and scenery are the seat's.

### 13.2 Content binds to the seat, never to the act number

- **Encounters** carry `seat: ref('seats')` (schema `encounter.seat`, required). `act` is retired; the schema refuses it. Files are `content/encounters/{weald,marches,reach}.js` (old act 1/2/3 → `weald`/`marches`/`reach`). `floorBand` and `targetBand` keep their meaning (floors within the act).
- `rollEncounter(registries, rng, { pool, seat, exclude })` filters by `seat`; an `act` argument throws.
- `buildActMap(registries, rng, seat, tier, mapShape, { history })`: seat gives the boss pool, tier gives `mapConfigs[tier]` (geometry per tier: three identical `ACT_SHAPE`s).
- `resolveUnknownNode` takes `tier` for `unknownWeights` (events are seat-agnostic until Phase 3).
- **Enemies** have no seat field; they are reachable only through encounters. The Blighted Valkyrie's encounter (`a3_bossRotValkyrie`) is the one exception to the pool rule (§13.5).
- **Boss destinations** (§12.4): pool is `encounters where pool === 'boss' && seat === run seat`, chosen at act birth on the `map` stream. `LEGACY_ACT_BOSSES` stays keyed by act number and is used only for a legacy graph, whose run migrates to the default order (§13.4).
- **Combat scenery:** `regionForRun(run)` returns the seat's region (no seed hash, no rotation); `combatEnvironment` is otherwise unchanged. `ashen-crown` is not a seat: it is the scenery of the **boss node of the tier-3 act**, whichever seat holds it (LORE §1). `drowned-coast` stays a World Journey region only.
- **HUD and map:** the act header and map act title read `Act <tier> · <seat name>` from `SEATS` (`runHud.js`, `map.js`).

### 13.3 Tier scaling — the seat's numbers are authored at its baseline

Enemy HP and encounter bands are authored at the seat's `baseTier`; a different tier scales the roll, not the definition.

- `balance.seatTiers = { 1: 1.0, 2: 1.5, 3: 1.9 }` (data, `src/content/balance.js`). Fight `hpMult = seatTiers[tier] / seatTiers[seat.baseTier]`, composed with the Custom Climb and Endless multipliers where they already compose (`main.js` fight modifiers → `createCombat` `hpMult`), applied **after** the `enemyHP` roll (same seed, same base roll).
- A seat at its baseline tier scales by exactly 1 (`seatTiers[n] / seatTiers[n]`): the byte-identity claim of §13.6.
- **Bosses scale by the tier they are met at.** `balance.bossTiers = { 1: { hp, damage }, 2: …, 3: … }` (data); `bossTierScale` in `model/seats.js` is its one reader (`main.js` fight modifiers, sims). A `boss`-pool fight at tier T uses, instead of the seat ratio, `ratio × bossTiers[T].hp` on HP and `ratio × bossTiers[T].damage` on every move's damage, with `ratio = seatTiers[T] / seatTiers[encounter's own seat's baseTier]`. The causeway's null-seat boss (the Valkyrie) is authored at the final tier whichever seat holds it. Move damage reaches the engine as `createCombat`'s `enemyDamageMult`, stamped on each enemy entity (`damageMult`, rounded per hit, never below 1) so intent, hit, move card and saved fight agree. Other pools keep the seat ratio on HP alone.
- Shipped: tier 1 `{ 0.8, 0.8 }`; tiers 2 and 3 `{ 2.2, 1.5 }`. Tune with `node tools/runsim.mjs <n> --seeded-seats` (the real per-run order; the tool's default is the fixed weald → marches → reach order).
- No per-tier Strength scaling here: Endless owns per-loop Strength; a second knob on the same status is a balance-pass decision.

### 13.4 The run carries its order; the order is seeded

- **Run schemaVersion 6.** `run.seatOrder` is a persisted array of the three seat ids, each once (`RUN_SHAPE` row `{ key: 'seatOrder', type: 'array' }`; `validateRunShape` refuses missing, short, long, duplicated or unknown ids). `run.seatId` is not stored: it is `seatOrder[contentAct - 1]`, derived where `contentAct()` is.
- **Migration** (`migrateRunSchema`): schemaVersion ≤ 5 gains `seatOrder: ['weald', 'marches', 'reach']` and nothing else moves; no RNG draw (§12.4).
- **Creation:** `createRunState` sets the default order only. The run-start orchestrator (`src/main.js`) then draws the order **once** on the new `seats` stream: `drawSeatOrder(registries, rng, { firstSeat })` (`src/engine/actmap.js`) shuffles the default with `rng.shuffle('seats', …)`. No existing stream's counters or draws change for any seed (§13.6).
- **Custom Run** adds `run.custom.firstSeat: <id> | null`. When set, the drawn order is **rotated** until that seat is first (one draw either way, so pinning changes no later stream). The Custom Run screen lists the three seats by display name; the setting is saved with `run.custom`.
- **Endless** loops the order: loop `k` climbs `seatOrder[(contentAct - 1) % 3]` at the tier `endlessActInfo` computes; the Valkyrie rule (§13.5) applies to every third act.

### 13.4a The run carries its zones

Summary: `run.zones` and `run.collection` project the legacy fields (class, loadout, relics, deck) into zones; one writer keeps them true.

- **Run schemaVersion 7.** `run.zones` = `{ core: id|null, worn: { body, head, hands, feet, talisman }, hands: { main, off }, passive: [relicId] }`; `run.collection` = `[cardInstance]`. `RUN_SHAPE` rows `{ key: 'zones', type: 'object' }`, `{ key: 'collection', type: 'array' }`. `validateRunShape` refuses a missing zone, a worn slot outside `WORN_ZONE_SLOTS`, a hand outside `main`/`off`, a non-id in `passive`, and a collection entry without `instanceId`/`cardId`.
- **Authority stays with the legacy fields** (`class`, `loadout`, `relics`, `deck`, written by the game). `zones`/`collection` are their **projection** (`projectZones`, registry-free) with ONE writer, `syncZones`, called at `createRunState`, `serializeRun`, `migrateRunSchema` and at the end of the load doors that heal and re-stamp after migration (`save.js:loadRun`). `core` = class id; `worn.body` = active armour; `worn.head/hands/feet` hold the loadout's slots (§13.4b); `collection` = exactly the deck until a card can be owned and not decked.
- **Migration** (`migrateRunSchema`): schemaVersion ≤ 6 gains its projection from its own fields; no RNG draw.
  - Schema-7 save with a well-formed but **wrong** projection (disagrees with legacy fields): **re-projected and noted** on the load ledger (`save.js:loadRun`, field `zones`), never refused.
  - **Malformed** projection (`zones` missing/null, unknown worn slot, non-id in a hand): refused by `validateRunShape`. Shape is proven before any heal; a file failing its own shape is archived, not repaired.

### 13.4b The worn zone has four slots and the deck has a floor

- **Slots.** `content/source/equipSlots.csv` carries `head`, `hands`, `feet` beside `armor` and `talisman`: `swap: outOfCombat`, kinds `head`/`hands`/`feet`. No piece ships for them yet; the Armoury shows them as empty positions (as `talisman` did).
  - `zones.js` is the ONE map from zone to loadout slot: `WORN_SLOT_IDS` (body ← `armor`, the rest by name), `HAND_SLOT_IDS` (main ← `rightHand`, off ← `leftHand`). `projectZones` and `figureSpec` read it; `validateContent` refuses a slot row no zone names. The `armor` id stays for `body` (renaming would move every save's `loadout.sets.armor`).
- **The figure reads the zones.** `figureSpec(registries, loadout, classId)` projects the loadout to zones; body from `zones.worn.body`, `headId`/`handsId`/`feetId` from the other worn slots, each hand from the piece its hand zone names. `equippedFigure` layers feet, hands, head over the body and under held pieces; a layer with no art draws nothing.
- **The deck's floor.** `balance.deck = { minimum, minimumStepLevels, minimumPerStep }` = (8, 2, 1). `deckMinimum(registries, run)` = `minimum + ⌊characterLevel / minimumStepLevels⌋ × minimumPerStep`, with character level = `run.level.level` (§13.4i); a fresh run is level 1, so the floor first rises at level 2.
  - `loadoutLeaveRefusal(registries, run, { enteredWith })` returns the sentence refusing LEAVING the Armoury with fewer cards than the floor; every exit (Back, ✕, Escape, tap outside) asks it and shows it in place.
  - A run already under the floor when the screen opened may leave (the door refuses only what this screen did). Unequipping is never refused.
  - The floor is an OUT-OF-COMBAT door: a mid-fight equipment change re-stamps the combat piles and never moves `run.deck`, so the Armoury opened from a fight counts the same deck in and out.
  - A save from before a slot row existed gains that slot's empty cells at the load door (`healMissingSlotCells`, noted on the ledger as a heal of `loadout.sets`).
- **The lock is `grantedBy`.** A card an equipped piece lends carries `grantedBy`; `canRemoveDeckCard` refuses it; unequipping the piece removes the instance at the next reconcile. No separate `locked: true`.

### 13.4c The grip is read off the hands, and its tags ride the action snapshot

- **Grip.** `gripOf(registries, loadout, classId)` (`model/loadout.js`) reads the two hand slots → `{ mode, group, right, left }`:
  - `two`: either held piece's package requires both hands.
  - `dual`: both hands hold a piece, neither two-handed, sharing an item type tag (`group` is that tag).
  - `one`: otherwise.
  - The grip is never stored; it is a function of the hands.
- `gripRefusal` refuses the one illegal grip, a two-handed piece beside an occupied other hand, by name. It judges the loadout as the edit leaves it (candidate in its cell, every active index unchanged; a prepared set may hold a two-hander, and `cycleSet`'s deck-plan gate refuses the pair when it is reached). `canEquip` asks it when the caller says what it will put where (`equipPiece` and the Armoury's seal do). `dual` is legal on its own; its attribute gate is phase 9's row.
- **Derived tags.** `gripTags(grip)` yields `equipment.twoHanded` for `two` and `equipment.dualWield` for `dual` (nodes under the `equipment` root). Combat reads them ONCE where the card snapshot is built before payment, carried as `derivedTags` beside the card's `tags`; `cardPlayed` carries `cardTags` and `derivedTags` (so a saved fight replays the grip in force). Nothing writes them to a card definition, deck instance or run field. The snapshot keeps `authoredTags` apart from `tags` (a foundation carrier rewrites `tags` into the resolved attack tags: a Defend inherits the sword's `blade`). The preview builds its action card the same way, kind tag included.
- **Predicate.** `cardTagIs { tag }` is true when the tag is in the action card's `authoredTags ∪ derivedTags`, or in the event's `cardTags ∪ derivedTags` when no card is in context; a tag the attack inherited from the weapon is not the card's. `validateContent` refuses a `tag` that is not a node of `content/source/nodes.csv`, by name.

### 13.4d The skill tracks: one ledger, one curve, paid by the combat receipt

Summary: `run.skills` holds XP/level/drafts per derived track; combat records a receipt, the run's owner pays it into the ledger.

- No banked-XP claim (`bankSkillXp`, `claimBankedSkillLevel` are deleted; §13.4o). After §13.4q ships, the class track opens at the profile's class mastery and writes back to it at run end; skill tracks are unchanged.
- **Run schemaVersion 8.** `run.skills` = `{ [trackId]: { xp, level, pendingDrafts } }` (`RUN_SHAPE` row `{ key: 'skills', type: 'object' }`). `validateRunShape` refuses, by name, a non-object ledger, a negative or fractional field, and a field other than `xp`/`level`/`pendingDrafts`. A save ≤ 7 gains the empty ledger at migration. `model/skills.js awardSkillXp` is the one writer.
- **Tracks are derived** (`skillTracks(registries)`), no second list: one per `itemType` node except `item:armor` (`item:blade`, `item:shield`, … weapon tracks; `item:magic-focus` the focus track); one per framework weight class (`armour:light|medium|heavy`, `content/framework/mechanics.json`); `dualWield`; `class:<classId>` per class.
- **One curve.** `xpToNext(registries, kind, level)` reads `balance.skill.xp` (weapon, armour, focus, dual) or `balance.skill.class.xp` (class). A skill starts at level 0.
  - Linear table: `round(base + level × base × multScaler, roundTo)`. Otherwise (no `linear: true`): `round(base × growth^level, roundTo)`.
  - Shipped (§13.4o): skill base 100, growth 1.995, capped at level 10; class base 400, growth 1.224, capped at level 20.
  - Each step climbed queues one draft in `pendingDrafts` (spent per §13.4e).
  - Refused by name: `growth < 1` (e.g. `balance.skill.xp.growth: 0.5`).
- **Residual XP presentation.** Each manual claim (character or skill) spends exactly one step. The row resets to zero at the new level, then green fills to the remaining XP and yellow covers it; a full row turns blue and offers the next Level action, a partial row keeps its progress. Refill duration and the pause before the reward opens are configurable; reduced motion settles immediately; other claims are gated during the refill.
- **Hooks** are one bus listener (`engine/skillXp.js attachSkillXp`, wired in `createCombat`) reading the registry, never an entity:

| Event | Pays |
|---|---|
| `damageDealt` / `blockGained` by a card a piece lent (`sourceHand` or `grantedBy` on the event) | `perHit` to that piece's item type; also to `dualWield` while grip is `dual` |
| `combatEnd` with victory | `perWinEquipped` per held group, × `killMult` for the group whose hit killed |
| `impactDealt` to the wearer | `1 / impactPerXp` per impact to `armour:heavy` (half to medium) |
| `attackEvaded` by the wearer | `evadeXp` to `armour:light` (half to medium) |
| `arcaneExposureChanged` by the caster | `1 / buildupPerXp` per buildup to the focus track |

  - The receipt lives on the combat, keyed by owner, floored once (`skillXpReceipt`). The run's ledger is written once, by the run's owner (`main.js onCombatEnd`, `tools/runsim.mjs`), through `applySkillXp`. Combat never writes a run.
- **Which piece lent the card** comes from the event alone: `sourceHand` for a weapon's attack/guard cards, else `grantedBy` (bare armament id, or `armament/<id>` / `armor/<class>/<id>`, normalised by `cardMounts.ownerItemRef`). A run card, the empty hand's Dodge Roll and an armour-lent card have no group. The killing hit leaves the target at 0 HP (`damageDealt` fires before death is marked).
- **Dormant sources.** `attackEvaded` fired only under the removed foundation ruleset, so `armour:light` pay is dormant in shipped solo; `impactDealt` (every target in Core fights) and the focus buildup are live. The class track is paid at combat end by `awardClassXp`.
- **A save keeps the fight's earnings.** The combat snapshot carries `skills` and `skillXp`; `restoreCombatSnapshot` restores both (an older snapshot resumes with empty ones) and re-hooks the listener; `combatSnapshotProblems` refuses a malformed receipt by name.
- **Progression predicates** `skillLevelAtLeast` and `classLevelAtLeast` read `combat.skills` (the copy of `run.skills` handed in as `player.skills`); a never-touched track is level 0. A gate's `skill` must be a derived track id, else refused by name (`validate.js`); the shipped Siphon gates on `item:magic-focus`.
- `tools/runsim.mjs --skill-levels` prints the level each track reached, averaged per class.

### 13.4e Skill drafts: the level buys a pick from the track's own schools

Summary: each skill level queues a draft; the spoils door offers a card pick drawn from the track's schools.

- **The draft is a reward-door row.** The per-door cap is replaced by §13.4o. At the spoils door `main.js rollSkillDrafts` offers, per track with a draft queued, up to `balance.skill.draftsPerCombat` drafts (the rest wait). While a draft is offered the class-card offer is not rolled: `skillDraft` takes the `card` seat in `REWARD_KIND_ORDER`. The offer carries `skillDrafts: [{ skillId, level, cardIds }]`; a track whose schools offer nothing rolls no row and keeps its draft.
- **Schools are derived** (`skills.js skillSchools`), no second table:
  - Weapon or focus track: the card-domain tags in `tagging.csv` of its held pieces of that item type (straight sword: `blade`, `basic`; greatsword: `blade`, `heavy`).
  - A type no hand holds has no schools: its draft waits until one is held.
  - `dualWield` reads both hands. Armour and class tracks have no schools.
- **The roll** (`engine/encounters.js rollSkillDraftIds`): the class reward pool filtered to the track's schools and to the rarities the level opened, `balance.skill.rarityUnlock { common: 1, uncommon: 4, rare: 7 }` (no legendary rarity exists); weighted by the door's own odds (`rewards.rarityWeights[pool]`, the boss's at a boss door; equal odds under Chaos Rewards, as the card offer); `draftSize` distinct picks on the `cardRewards` stream. An empty pool draws nothing. A draft the ledger no longer holds is refused at Confirm with its own line and the chooser stays usable.
- **Pool depth.** Every hand a class can be created with (`characterCreation.classes.<id>.handIds`) has at least four distinct cards of its schools in the class reward pool at every `rarityUnlock` rarity (`tests/skill-draft-depth.test.mjs`); a card joins a school by its `tagging.csv` row.
- **Rows are keyed** (`rewardplan.js rowKey`): state lives under `states[row.key]`: the kind for once-per-offer kinds, `skillDraft:<skillId>:<ordinal>` for a draft (the ordinal separates two drafts of one track when `draftsPerCombat` allows); a pre-draft save's kind-keyed `states` still reads. `resolveContinue` resolves a draft as it does the card offer (the injected pick); `rewardClaimStatus.requiredChoice` names the first waiting choice, draft before card, with its key.
- **Taking a draft** (`reward.js apply.skillDraft`) pushes the card at its rolled rank, never upgraded (§13.4o), spends the queued draft (`spendSkillDraft`, the door's one ledger write) and records the pick in `pendingReward.chosenDraftCardIds[row.key]`. `validateRunShape` refuses, by name, a draft state key the offer lacks, a chosen card not of its draft, and a Taken draft without its card.
- Refused by name: `rarityUnlock.legendary`; `draftSize: 0`. Auto-collect honours a skipped draft and takes a one-card draft as itself.
- **No skill-level upgrades.** A level no longer upgrades the deck (§13.4o): `upgradeAt`, `applySkillUpgrades`, `reconcileSkillUpgrades` and its load-door heal row are gone; a draft and a lesson card join plain; upgrades a save already holds stay.
- Out of scope: the smithing re-point (tiers derived from skill level, Stones as a milestone skip) is separate (`model/smithing.js` has its own schema and transaction).

### 13.4f The class card: a derived core-zone card, its kit, its leaning

Summary: each class has a derived core-zone card carrying its kit (ability card + kit relic) and a `favored` skill-XP leaning.

- **The class card is derived** (`model/classCard.js classCard(registries, classId)`), read off the class row, its free starting kit and its tagging rows; `zones.core` names it (§13.4a).
  - Shape: `{ id, kind: 'class', zone: 'core', name, glyph, tint, description, kit: { weaponKitId, rightHand, leftHand, abilityCardId, signatureCardId, relicId, startingRelicId }, favored: [itemTypeId], schools: [cardSchool], propertyTags }`.
- **The kit is dealt at creation.** Each class row names:
  - an `abilityCard`: Brace (Reaver), Attune (Starseer), Warm Litany (Herald), Prepare (Rogue). Authored in the class's card file, `rarity: 'starter'`, 1 Stamina.
  - a `kitRelic`: Ashen Grip, Lodestar Shard, Waxen Seal, Whetstone Pouch (property-rule relics).
  - The ability card is a class grant beside the signature (`loadout.js grantRefsFor`, source `from:class`; `roleCopies.ability: 1`, `startingDeckSize` 11). The kit relic rides beside the starting relic: `run.relics = [startingRelic, kitRelic]`; the starting relic keeps its seat and pool modifiers.
  - Brace is a stance (`stances.js brace`): damage taken −25%, 4 Block on entering, 1 Strength on leaving.
- **The leaning is a property scoped by the card's own tags.**
  - One property node `favored` (passive `skillXpMult` ← `balance.skill.favoredXpMult`); tagging rows `class,,<id>,favored` beside `class,,<id>,item:<type>` (family gained `class → itemType`).
  - `properties.js classCarrier` presents the class as a carrier (kind `class`, source key `class:<id>`, `scopeTags` = the class's own tags), mounted by `syncClassProperties` in `createCombat` and `restoreCombatSnapshot`; `mountProperties` keeps `scopeTags`.
  - `engine/skillXp.js favoredMult` multiplies a track's pay by every mounted `skillXpMult` whose carrier's scope tags name that track (the Reaver's blade XP, not its shield's). One rule serves every class (no per-group `favored<Group>`).
- Kit behaviours: Ashen Grip refunds the first stance's Stamina once per turn; Brace adds Strength on leaving; Whetstone Pouch bleeds the first Prepared attack once; Waxen Seal heals more once; Lodestar Shard opens with extra Mana; Attune exhausts, Attune+ does not.
- **Validation, by name:** a class with `favored` and no item-type tag (`tagging.class.<id>`); `favored` on any non-class carrier; a `kitRelic` equal to the starting relic; `favoredXpMult` < 1; a dangling `abilityCard` or `kitRelic`; `roleCopies.ability` other than 1.
- **Heals are the healed seat's.** `applyHeal` emits `healed` with `targetPlayerId` beside `playerId`; the trigger scan walks every seat for `healed`; Waxen Seal gates on `healPositive` (a full-HP heal, amount 0, does not spend its once). Re-entering your current stance is a no-op (`enterStance`): Brace costs its Stamina and neither braces nor leaves.
- Ability-card clauses the engine lacks vocabulary for (Brace's impact reduction, Attune's stamina discount, Litany's overheal charge, Prepare's cost discount) are authored to the nearest shipped word.

### 13.4g The class tree: a level buys a node, the pick rides the core card

Summary: the tree rows, the class XP award and `run.coreTags` picks; the class-level draft that offered nodes is gone.

- After §13.4q ships, tiers open by class mastery, the player picks one node per open tier at run start and one more per class Level up; picks stay per run.
- **The tree is a table** (`content/source/classTree.csv`: `classId, nodeId, tier`): ten property nodes per class (tier 1: four, tier 2: four, tier 3: the subclass pair). A tier opens at the class level in `balance.skill.class.tierAt` (`[1, 3, 5]`).
  - Tier 1 modifies the ability card's loop, tier 2 the kit relic's, tier 3 is the subclass.
  - A node's effect is its property rule (`nodeEffects.json`, numbers via `balance.classTree.<node>`); its text is its term (`nodeTerms.csv`).
  - `validate.js` refuses, by name: unknown class; node outside the property subtree; tier the ladder lacks; node in two classes; two top-tier nodes of one class without a `CONFLICTS_WITH` row (the subclass is a choice, never a stack).
- **The class track is paid by the run's owner** (`classTree.js awardClassXp`, from `main.js onCombatEnd`, `tools/runsim.mjs`): `balance.skill.class.xp.perWin` for a won fight, `bossKill` on top at a boss door, nothing for a loss. A completed quest pays `perQuest` into class mastery and the class skill at completion (`src/engine/quests.js`). The combat does not know the door's pool, so this is not the bus listener's job.
- **The pick is the core card's tagging row:** `run.coreTags` (schema 9; a save ≤ 8 gains `[]` at migration; `validateRunShape` refuses a malformed or repeated pick by name), projected as `zones.coreTags`, written by `classSwap.js` (prune on swap), `save.js` (load door/stale heal), `classLibrary.js` and `gameProfileRun.js`; the deleted `pickClassNode` is not a writer. `properties.js classCarrier` mounts picked nodes that belong to the class's own tree beside the class's authored `favored` (`combat.coreTags`; the snapshot carries `coreTags`, restore re-mounts).
  - `loadRun` checks the tree by the run's class (`classTree.js coreTagsTreeProblems`), each refused by name: a pick (on the run or a carried fight snapshot) that is ANOTHER class's node; a pending class draft for another class; a draft naming a node outside its class's tree.
  - A pick no tree holds (content renamed or dropped the node) is stale, not a tamper: the door drops it with a heal-ledger row (`staleCoreTags`), from run and snapshot alike; the rest stay.
- **The subclass lends the card its face:** `classCard(registries, classId, coreTags)` carries `picked`, `subclassId` (the picked top-tier node) and `presentation { name, glyph }` from that node's row, else the class's own.
- Out of scope: character XP for quests (`questLevelXp`; post-1.0, owner 2026-09-27); no tree screen (the read-only Character sheet, `character-sheet`, shows each tier's opening level and nodes).

### 13.4h Unlocks and the swap: a class card is a profile unlock, and the mirror replaces the core card

Summary: class cards can be gated by profile unlocks; the `swapClass` opcode replaces a run's class mid-run.

- After §13.4q ships, a class swap no longer deletes class mastery; the new class opens at its own mastery with no back-dated level rewards.
- **Class unlocks.** A class card is gated by an unlock row (`content/source/unlocks.csv`, `kind: class`, `ref: <classId>`), read by `model/unlocks.js classUnlockRow` / `classAvailable(unlocks, classId, meta)`: no row = free (every shipped class); a row gates the card until `meta.unlocked` holds its id. Character creation (`customize.js`) lists a gated class locked, showing the row's `hint`.
  - Conditions (closed set): `winAsClass`, `beatBoss`, `reachAct`, `winRuns`, plus **`classLevel`** (`param` = level reached in any run) and **`bossWithGroup`** (`param` = `<enemyId>:<itemType>`: felled that boss holding a piece of that type).
  - Progress tally gains `maxClassLevel` and `bossGroups { [enemyId]: [itemType] }`, only ever growing; `main.js runResult` reports both; the boss door records the item types in hand as each boss fell (`run.bossGroups`, optional).
- **The swap is a run opcode `swapClass { classId } | { random: true }`** (`RUN_OPCODES`; `random` rolls on the `misc` stream among every class but the run's own), run by the run-effect door via `model/classSwap.js swapRunClass(registries, run, classId)`:
  - The run's `class` (the core card; `zones.core` projects it) is written; every `class:*` track is deleted (class level restarts); tree picks with no seat in the new class are dropped (`coreTags` pruned to the new class's `classTree.csv` rows); a `classSwapped` history row is written; the projection re-derived.
  - Deck, relics, armaments, attributes and weapon skills stay. The new class's kit is NOT dealt (the run was born once).
  - Armour is a class's (`equipment.armour` rows keyed `classId, id`; no two classes share a set): the run wears the new class's free set; old sets are set aside, named on the receipt and history row (`droppedArmour`).
  - The old class's level rides the history row (`fromLevel`); `runResult.maxClassLevel` reads the peak across live tracks and every swap (`classSwap.js peakClassLevel`), so an unlock earned before the mirror stays earned.
  - The starting kit, its snapshot and the creation armour grant are the birth's: `validateRunStartingKit` holds them to the class the run was born as (`startingKits.js bornClassOf`: the first `classSwapped` row's `from`), so a swapped run passes the load door.
  - An unknown class is refused by name; a swap to the run's own class changes nothing; validation requires exactly one of `classId` or `random: true`.
- **One shipped door: the Turncoat's Mirror** (`events.js turncoatMirror`): first choice `swapClass { random: true }`, second turns away; choices are durable (`eventChoiceIds`). A boss-reward swap door is not shipped (post-1.0, owner 2026-09-27).

### 13.4i The character level is earned: XP, the point ledger, the level's own term

Summary: `run.level` holds XP, level and waiting points; levels pay points that the player assigns to attributes; derived stats add a per-level term.

- Core pays levels with `awardLevelXp`; there is no banked-level claim, and no general feats.
- **The ledger is the run's:** `run.level = { xp, level, unspentPoints }` (schema 10), written only by `model/levelup.js`. `validateRunShape` refuses a malformed ledger by name. A save ≤ 9 arrives at level `1 + levelUps` (its cinder purchases), with no XP toward the next and nothing waiting.
  - `xpToNext(registries, level)` is the one curve shape (`balance.level.xp`).
  - `awardLevelXp` climbs as many steps as the XP buys at once. A level grants the level-up dial's points (`levelUpValue`, read where the level is reached) to `unspentPoints`; `balance.levelUp.maxLevels` caps levels (XP past it stays). The run's owner (`main.js onCombatEnd`, `tools/simrun.mjs`) awards through `awardLevelXp`; a QA fixture also calls it.
  - `applyLevelUp(registries, run, attributeId)` assigns ONE waiting point: the attribute moves; `levelUps`/`levelPoints` record the assignment for the load door's allocation check; pools re-derive from the run's own snapshot with the deficit carried (levelling is not a rest).
  - `levelUpPlan` offers the waiting points only (`blockedBy`: `points` | `cap` | null). The shrine's Level-up card assigns them (`rest.js`), as does the town's level-up service. Every level waits for the player's Level up press (§13.4o).
  - Cinders buy no level: no code path spends `run.cinders` on one.
  - Refused by name: a fresh run's shrine Level-up (nothing waiting); a zero curve base, a falling growth, a missing kill rate, a zero cadence, malformed ladder keys.
- **Deferred progression offers.** Unclaimed offers keep their rolled choices and absolute `requiredLevel` in optional `run.deferredProgression` (`levelCards`, `levelChoices`, `skillDrafts`, `classDrafts`; old saves may omit it).
  - They return at later victories and via Character → Level up & rewards outside combat.
  - Class-specific offers wait for their original class; a class switch cannot discard them or put a mismatched draft in a reward checkpoint.
  - Deferring cannot grant, reroll, duplicate or auto-collect a reward.
- **Awards are the run's owner's** (`main.js onCombatEnd`, `tools/runsim.mjs`): `combatLevelXp(registries, { victory, pool, kills })` = `xp.combatWin` for a won fight + `xp.kill.<pool>` per enemy felled (a kill counts won or lost; an unknown pool pays the normal rate). `questLevelXp` names `xp.quest` but nothing calls it (post-1.0).
- **The level's own term** rides the derived-stat rows (`perLevel`, one decimal per row, §3.5; a non-finite or negative value is refused by name): `deriveStat` adds `floor(perLevel × (level − 1))` at the character level it is handed (the ruleset 1–5 `{ every, gain }` shape is a carrier that older saves normalize onto, not authored). Every derivation of a run's pools (birth, the load door's integrity check, `reconcileRunLoadoutHp`, stat projection) passes the run's level. Values: §3.5. The term is snapshotted with the row: a run born under it keeps it whatever the table says later; a run born before it never gains it, so no old save is re-priced or refused.

### 13.4j Recovery is a location's property set: arrived, rested, and what a place carries

Summary: a place's tags decide what resting there restores; `engine/locations.js` runs a visit.

- **A location is a property carrier** (`content/source/tagFamilies.csv` family `location`, paired with the `property` subtree only; no collection). Its ids are the map's: a classic node type (`shrine`), `camp` (the Unknown node's rest outcome), an atlas rest service type (`inn`, `chapel`) or one atlas node by id; anything else is refused by `model/locations.js locationTaggingProblems`.
  - `resolveLocationId` picks a point's own row over its service type's over the node type's (one row per type covers eleven inns; a node row can override). A point resolved by its own row is still titled by its service type (`locationServiceTypeId`).
- **The visit** (`engine/locations.js`). `createLocationVisit({ run, registries, rng }, locationId, { healMult, refillCounts })` mounts the place's rules on the run-level context (`actions.js createRunContext`, the facade `executeRunEffects` builds: events, flasks, visits) under `location:<id>`. `MOUNTABLE_KINDS` includes `location`.
  - `arriveAt` emits **`arrived`**; `restAt` emits **`rested`** (both run-level `EVENTS`). Each re-reads the run into the facade first and writes pools back after the queue drains. The relic denial is re-read after arrival and before a rest.
  - `previewRest` runs the same rules on a clone (a copy of the streams, or a stream seeded from the run when the caller holds none) so screen line and button agree and nothing the real rest reads advances; the atlas preview arrives on its clone first, so a roll or restore on `arrived` is spent before the rest is previewed.
  - `createLocationVisit(…, { arrived: true })` rebuilds a saved visit as already arrived (an arrival rule runs once per stay).
  - Run-context emissions (`healed`, `manaRestored`, …) ride the trigger bus, so place rules compose through events. `leaveLocation` unmounts.
- **What a place restores is the sum of its tags** (property nodes, one rule each; `nodeEffects.json`, numbers in `balance.rest` via `variableBindings.csv`):

| Tag | Effect |
|---|---|
| `restHpSmall` / `restHpPartial` | heal `rest.hpSmallPct` / `rest.hpPartialPct` of max on `rested` (25 / 35) |
| `restHpFull` | heal to full (`missingHp`) |
| `restManaFlat` | restore `rest.mana.flat` |
| `restManaFloor` | restore TO `rest.mana.floorPct` of max, or to full when already there (`restoreMana` opcode `toFloorPct`; exactly one of `amount` \| `toFloorPct`, else refused) |
| `restManaFull` | restore to full (`missingMana`, a formula op) |
| `restMana` | DEFAULT: resolves to the tag `balance.rest.mana.mode` names (`flat` \| `floorOrFull` \| `full`; shipped `floorOrFull` at 50%); a place wanting another amount carries the fixed tag |
| `restFlasks` | run opcode `refillFlasks` on `arrived` (`applyGraceRefill`, a top-up: re-entry pours nothing twice; receipt rides the visit for the refill line); also opens the flask-reallocation fold (a place that pours nothing has no charges to move) |
| `smith`, `levelUp` | services the screen offers (smith services still from `balance.smithing.services`) |

  - Shipped sets (`tagging.csv`): **shrine** `restHpPartial, restMana, restFlasks, smith, levelUp, deckEdit`; **camp** `restHpSmall, restMana`; **inn** `restHpFull, restManaFull, restFlasks, levelUp, deckEdit` + `questBoard` (§13.4n); **chapel** `restHpPartial, restMana, restFlasks, levelUp, deckEdit`.
  - A `?` node revealed as a shrine on the classic map opens the camp when entered. The Rest screen (`rest.js`), atlas service preview (`LocalServiceModel`) and simulators walk the visit.
- Refused by name: a bundle with no shrine or camp row (the classic map opens them unconditionally); an unknown `balance.rest.mana.mode`; a percent off the scale; an id the map lacks.
- **Heal multipliers ride the context**, never the rule: `ctx.healMult` = the custom mod's `lessHealingMult` × the run's **`restHealMult`** passive, scaling every heal the visit applies, floored once after the multipliers (`formulas.js evaluateRaw`); Mana is untouched.
- **`restDenied`** is `true` (no rest anywhere) or a list of location tags denying only a place whose set holds one. The Wyrm Heart carries `['restHpPartial']`: the Shrine's and chapel's Rest are refused by relic name; the inn's bed and camp's rough rest stay open. A filter naming a tag no location carries is refused at validation.

### 13.4k Mana is the second cost line, a focus owns its break, and the player has a Poise meter

- **Mana is never the first cost line.** A card that costs Mana costs at least `balance.mana.minActionCost` (1) Stamina, base and upgrade alike. Actions and Stamina are one pool (`src/model/turnStamina.js`); `minStaminaCost` is retired at 0.
  - `validate.js` refuses a card under the floor BY NAME (`cards.<id>.cost: '<name>' costs Mana, so it costs at least 1 action …`); an upgrade inherits the base's lines where it leaves them unsaid.
  - The four signature arts cost 1 Stamina + 1 Mana (the 2 / 2 price waits on run-stamped card costs). Starstone Pebble, Comet Fragment, Starblade Phalanx, Starlance and Frost Nova cost Stamina only (Comet Fragment 1); their `cardExposure.csv` rows read 1. Seven Mana powers whose upgrade was "costs 0" drop the Mana line instead.
  - An X-cost Mana card passes the floor (`face.cost === 'X'`). Refused by name: a negative floor, a missing `balance.mana`, a `balance.stagger.player` status the bundle lacks.
  - A Mana spell (school builds Arcane Exposure) builds at least `balance.exposure.buildupPerManaSpell` (5) per hit, refused by name below it; every such `cardExposure.csv` row reads 5. A spell with no Mana line keeps 1 (Blight Touch: Stamina, no Mana).
- **Focus Mana discount.**
  - Applies only while the card's player is in the Prepared stance (`activeCombatStance`, maneuver `casting`/`prepared`); no discount in any other stance or none.
  - Needs an equipped armament with the Focus item type (`balance.mana.focusItemType`, tag `item:magic-focus`: staves, sceptres, rods, chimes). Then every magic card's Mana cost drops by `balance.mana.focusManaDiscount` (1), floored at 0: `max(MP − 1, 0)`.
  - Magic-only: a card is magic when it carries the `camp:spell` or `source:spell` tag; a non-magic Mana card (a weapon art) pays full price.
  - Does not stack: any number of Focus armaments gives a single −1. Stamina untouched; a 0-MP card stays 0.
  - Applied last to the final Mana price (after charges, stance, upcast) inside `resolvedCardPriceReceipt` (`src/engine/combat.js`), so the card badge, affordability, auto-combat and spent Mana read one number.
  - Helpers in `src/model/focusMana.js`: `focusManaDiscount(registries, loadout, classId, card, actor)`, `inPreparedStance(actor)`, `cardIsMagicTagged(card)`. Check: `tests/focus-mana-discount.test.mjs`.
- **A focus owns what its break does** (§3.6 property mounts; in §13.4p's scope these triggers move to `arcaneStagger`, a Stagger caused by the holder's magical hit). Beside the sceptres' `siphon` and the wand's `overcharge`:
  - **`staggerBreak`** (plain staves: Ash, Starstone, Wyrmhorn): `balance.exposure.staggerBreakPoise` (6) Poise damage to the foe whose Exposure the holder's own hit broke.
  - **`resonance`** (Goldbough Branch): pours `balance.exposure.resonanceSpreadPct` (50) of the broken foe's threshold into every OTHER foe as buildup, via opcode **`arcaneBuildup`** (`amount` | `pct`, exactly one) on target **`otherEnemies`** (every living enemy but the firing event's and the action's own target).
  - The Blight Rod and Gorefire Brand carry `overcharge`. Every focus is a `staff` kind; the staff / wand / orb reading is by item in `tagging.csv`.
  - Buildup has one path to a meter, `addArcaneExposure` (hit and pour alike): immune and locked foes refuse by name; a fill resets and breaks.
- **The player's Poise meter.**
  - Max = the one `poise` stat row (§3.5) + worn body armour's `poiseThreshold` + relic `poiseThresholdAdd` (`playerPoiseThresholdReceipt`, `active: true`). A weapon's `poiseThreshold` is its weight, not the wearer's footing. A restored fight re-derives the max from the receipt, never from the save.
  - Impact fills it: `dealPoiseDamage` takes the player as it takes an enemy; `impactDealt` is emitted for every target (armour skill hooks hear it, §13.4d). An enemy blow that draws blood rocks the player by `balance.poise.playerImpactPerHit` (2).
  - Under legacy ratings a fill Staggers the player: `balance.stagger.player` names the statuses and stacks (`vulnerable` 2, `weak` 2, ordinary decay; the engine names no status) and the actions owed to the NEXT turn (`actionLoss` 1: the turn opens `energyMax − pendingActionLoss`, once). Emits `meterFilled` and **`playerStaggered`** `{ targetId, actionLoss, statuses }`; the meter grows by `poise.growthMult` as an enemy's does.
  - The Constitution term is the derived `poise` row (§13.4l).

### 13.4l The attribute rebase: one derived ruleset, one equip gate

- **Derived rows.** Every derived stat is one calculation, `base + multiplier × Σ floor(weight × attribute)`, read against the attribute the character sheet shows; no creation mode converts an attribute on its way in. Mana and Stamina have no tier: a point of Wisdom IS a point of Mana, a point of Constitution IS a point of Stamina. Rows and values: §3.5.
  - The signature arts stay at 1/1 Stamina/Mana: a card resolves its cost from the live table while a run's pools are snapshotted, so raising it would strand every run under way (waits on run-stamped card costs, §13.4k).
- Refused by name: a bundle whose ruleset omits a row its version requires.
- **Poise is a derived row** (the ONE Poise, §3.5). `derivedStatRules.rules.poise` owns the Constitution term; `playerPoiseThresholdReceipt` reads it there, and `balance.poise.playerPerConstitution` is refused by name if it returns (one number, one home).
  - THE RUN'S OWN SNAPSHOT DECIDES: the rules travel into the fight through `createCombat` AND the combat snapshot, so a quit-and-load cannot re-price the vessel from the live table. The live table answers only a caller with no snapshot (headless fixture, creation preview).
- **Equip gate.** `equipPiece` refuses an item the attributes cannot hold and is the gate of record. `canEquip` answers the same question in words when a caller names both candidate and attributes, so a surface can say why before it tries; without item or attributes it keeps its old answer. It reads the same inputs the mutation reads (smithing tiers whose `requirement` deltas lower a minimum included), so seal and act never disagree. Minima: `equipmentRequirements.csv` (scale: §13.4m).
- **Preset gear check.** A preset that cannot hold its own class's starting gear (either hand of the baseline kit, or any outfit in `characterCreation.classes.<id>.armourIds`) is refused by name at BOTH doors that admit a preset:
  - content door: `validateContent`, via `presetGearProblems` in `model/attributes.js`;
  - Advanced settings door: `advancedConfigProblems` (per-cell kit floor for the two hands; `presetGearProblems` for outfits; both against the CONFIGURED minima).
  - A class whose Advanced preset fails either keeps its authored attributes on its own.

### 13.4m The lean scale: one in every stat, three to assign

Summary: creation offers two modes on the 1–4 scale, Standard (`lean`) and Assign points (`assign`); equipment minima and the Dodge Roll are tuned to it.

- **Creation modes.** `characterCreation.visibleModeIds` is `["lean", "assign"]`; `attributeRules.defaultMode` is `lean`. `tuned2`, `tuned`, `standard` and `pointbuy` remain in the table, out of creation: every in-flight save was admitted against its own mode's total at the load door.
  - Both modes: baseline **1** across the five attributes, **3** points to place, floor 1, ceiling 4, `belowBaseline: 'allow'`, `redistribution: 'fixedTotal'`, total **8**. The ceiling caps CREATION, not the character.
  - **Standard** = `lean` (label only; saves and exported configs key on `lean`). `opensOn: 'preset'`: choosing it seats the class preset with nothing left to spend, so the stats step can continue at once; *Edit points* reshapes the same fixed total. Presets (baseline 1 + three points): Reaver STR 3 / CON 2, Starseer INT 3 / WIS 2, Herald WIS 3 / CON 2, Rogue DEX 3 / CON 2.
  - **Assign points** = `assign`, `opensOn: 'baseline'`: every attribute opens at 1 with the whole pool unspent. A new id because `lean` is Standard's and `standard`/`pointbuy` keep their 10-scale totals. Its presets (class grain, equal to lean's) are the creation preview before the pool is spent and the load door's refill value. `opensOn` is optional; a mode without it opens on the baseline.
- Refused by name: a `lean` preset missing the total of 8 or outside 1–4; a preset that cannot hold its class's baseline kit (naming the kit); a total below 7 (naming the Starseer and the Ash Focus); an Assign points character with its pool unspent (total 5) at the run door. Stock Reaver, Rogue, Herald, Starseer open on 4, 5, 5, 6 cards (never more than 6); a stock lean Reaver opens on 3 Actions and 5 draw. Setting *Assign points — Points available to assign* to 5 makes that mode's total 10 and leaves Standard at 8; halving the equipment multiplier halves the table and kit floor.
- **No conversion scale.** Every derived row reads the attribute the character sheet shows (§13.4l); a run snapshotted under an older scale restores its own rows.
- **The Dodge Roll reads the lean scale.** For a run on the lean scale or created under `assign`, its Dexterity term is `floor((DEX − 3) / 2)` (`mechanics.dodgeRoll.dexterityCentreByMode.lean` / `.assign`, `dexterityPerModifier`; no sheet reads as no term).
  - A landed dodge's guard = `3 + DEX term + class guard`: 5 for Light at DEX 1, 2 for Heavy at DEX 1 (the least a creatable sheet can land).
  - Weight Class dodge price: Light 1 Stamina / 0 Actions, Medium 1 / 1, Heavy 2 / 1.
  - A run made under an older creation mode (`tuned2`, `tuned`, `standard`, `pointbuy`) keeps the d20-scale centre (`mechanics.dodgeRoll.dexterityCentre` 10, term `floor((DEX − 10) / 2)`); the mode rides the fight and the mid-fight save (`combat.attributeMode`, the run's mode for an older snapshot).
- A combat snapshot carries `derivedStatRuleSnapshot` (the Poise vessel is re-derived on restore from it, not the authored table).
- **Equipment minima are on 1–4.** `equipmentRequirements.csv` carries each old value through `round((old − 3) / 3) + 1`: the straight sword asks 2 Strength, the dagger 2 Dexterity, the greatsword 3, the Ash Focus staff 3, every outfit 3. The kit floor (`startingStatBounds`) puts the least a character can carry at **7** (Starseer's 3 Intelligence + a point in each other four).
- **Everything is a dial.** Advanced → Progression → *Starting stats*: six rows per offered mode, labelled with the mode (starting value per attribute, points to assign, total, floor, creation ceiling, take-back); *Equipment requirements*: one row per authored minimum plus an across-the-board multiplier.
  - Baseline and total are one fact: the baseline wins when set, else the total drives. *Points available to assign* alone decides the total on the authored starting value (baseline × attributes + pool).
  - The kit floor bounds the default mode's pool (Standard: at least 2, the Starseer's staff). The Mana floor check prices the weakest character of every offered mode.

### 13.4n The quest board: a place's service, spoken quests, the run's journal

- **The board is a location service.** `questBoard` is a property node (`nodes.csv`, no rule; a service marker like `smith`/`levelUp`); `locationServices` reports it. The shipped **inn** carries it (`tagging.csv`), so every inn point has a board; shrine, chapel and camp do not.
  - The Rest screen offers a *Quest board* card where the visit's place carries the tag and the run stands in an atlas town that posts at least one quest (a dungeon's rescue inn posts none: no card).
  - Reading the board takes nothing and ends nothing; leaving returns to the same visit (no second arrival).
- **What the board lists** (`ui/models/QuestBoardModel.js questBoardModel`): every atlas quest offered at a point of the town's local map (`node_quests`), in map order, in the state `questAction` plans: `open` (accept), `accepted` (explore the marked road), `ready` (collect), `done`, `closed` (road not open in this journey). Plus a **journal**:
  - the run's `questCompleted` rows in completion order (event chains titled by first step, atlas quests by survey writing);
  - quests under way: an event chain with an `eventChoice` row and no completion, and an atlas quest the journey holds as `accepted` (accepting writes no history row).
- **Accepting and collecting are spoken.** An `open` or `ready` quest opens the dialogue screen (W4c) with the quest row's `speakerId`: open speaks its survey description, offering *Accept the quest* / *Not now*; ready speaks the lore's report, offering *Collect N cinders* / *Not now*.
  - The response commits through `engine/quests.js boardQuestResponse`, closed set `accept`, `collect`, `leave`. `leave` changes nothing; `accept`/`collect` go through `atlasQuestAction` (`questAction` and the 10a completion door) only when the quest's plan is that move, else refused by name, so a quest rewards once across a reload.
  - Neither board nor exchange is saved; a reload reopens the place the board was read from.
- **The atlas quest list opens the board where the town has one** (`model/locations.js questBoardPointAt`: the first local point whose resolved rest location carries `questBoard`; `restLocationAtPoint` is the one resolution `main.js` also uses for the rest door). The warden's point offers *Quest board*, opening it from the map and returning there. A town without a board keeps inline Accept / Collect buttons.
- A completed quest pays `perQuest` into class mastery and the class skill (`src/engine/quests.js`); character XP for quests (`questLevelXp`) is unwired (post-1.0).

#### Notes and history — §13.1–13.4n

- Seat order is seeded per run on its own `seats` stream; difficulty comes from the tier, content from the seat (§13.1–13.4).
- The 2026-11-07 Unity-port cleanup (P4b) removed the banked-XP/level claims, the class-tree draft and the general feats; later work is §13.4o onward.
- Superseded derived-stat rulesets 1–5, the `tuned2` creation scale and ruleset-5 formulas are not restated; §3.5 owns the live rows.

Full history: [docs/spec-history/13a-seats.md](docs/spec-history/13a-seats.md).

### 13.4o Skill level rewards and the Level up door

Governs the character, class and skill XP tracks: curves and caps, the Level up door, and what each skill level pays. Every number is a `balance` setting. §13.4r amends the progression rules and XP presentation; the legacy mechanics here stand outside that scope.

Skill feats, passive tag effects, feat crits and XP banking no longer exist. Core pays skill XP with `awardSkillXp` and level XP with `awardLevelXp`. Saves carrying `skillFeats`, `pendingSkillFeats` or `feats` still load; nothing reads them.

#### Curves and caps

Class and skill tracks cost about 100,000 XP in total to their top level ("100k required, for all"); the character track is the exception.

| Track | Table | Base | Growth | roundTo | Max level | Total to max |
|---|---|---|---|---|---|---|
| Character (starts at 1) | `balance.level.xp` | 200 | 1.5 | 10 | 20 | 886,350 (19 steps) |
| Skill (starts at 0) | `balance.skill.xp` | 100 | 1.995 | 5 | 10 | 100,275 (10 steps) |
| Class (starts at 0) | `balance.skill.class.xp` | 400 | 1.224 | 5 | 20 | 99,940 (20 steps) |

- Character steps: 200, 260, 340, 440, 580, 750, 980, 1280, 1660, 2170, 2820, 3680, 4790, 6240, 8130, 10600, 13810, 17990, 23440.
- Skill steps: 100, 200, 400, 795, 1585, 3160, 6305, 12580, 25090, 50060.
- Class steps: 400, 490, 600, 735, 900, 1100, 1345, 1645, 2015, 2465, 3020, 3695, 4525, 5535, 6775, 8295, 10150, 12425, 15210, 18615.
- Caps: character `balance.levelUp.maxLevels` 20; skill `balance.skill.xp.maxLevel` 10 (the rank cap); class `balance.skill.class.xp.maxLevel` 20. XP past a cap stays on the ledger. An award, the pending count and a claim all stop at the cap (`skills.js skillMaxLevel`); the reward bar reads `capped`.

#### The Level up door

- XP fills a bar (character, class or skill). At a level the fill stops and the surplus is held, not applied.
- A blue **Level up** button covers the full bar and waits. Nothing claims a level on its own (XP is always banked; only a press claims).
- Pressing claims one level and opens the level popup (`levelView`, `ui/screens/reward.js`) listing that level's rewards as blue rows. Each row also stands in the victory list, lifted and blue, until accepted. A chooser's Back or confirmed pick returns to the popup; its Continue refills the held XP.
- Surplus XP is held until Level up is pressed; the modal's rows also stand lifted in the list until accepted; closing without accepting resumes the surplus. Unaccepted rows wait in the list and in `run.deferredProgression`.
- Several ready bars take turns: character, then class, then skills in track order. Only the bar whose turn it is shows blue; the fill plays in that order. The victory door opens once and only swaps contents (no re-fade).
- §13.4i's deferral and persistence rules stay (`run.deferredProgression`, absolute `requiredLevel`, class-gated offers, no reroll or duplicate). `awardLevelXp`/`awardSkillXp` pay the ledger at once.
- Supersedes §13.4i auto-claim and pausing; §13.4e's `draftsPerCombat` cap (every claimed level opens its own modal); §13.4e "armour and class tracks have no schools" (their every-level draft uses the class pool under the skill's rarity gate); §13.4g "ONE per door" (each class level's modal carries its tree-node pick); the per-level card draft and technique roll fold into the every-level card.
- The `draftsPerCombat` cap is still live in `src/model/abilityOffers.js`.
- The character bar keeps its own rewards (§13.4i: attribute points, the feat or class choice). Only skill and class bars use the table below; the class track also keeps §13.4g's tree node.

#### Skill level rewards

Every level gives something; no level is points-only. Rewards stack, repeated bonuses add with no cap, and a level with several entries grants all of them.

| Skill level | Rewards |
|---|---|
| every level | a card draft from the skill's schools at a rank, **and** an upgrade: raise one owned card of that skill by one rank |
| every 4th level | +1 to one attribute from the skill's linked set |
| every 5th level | +1 flat to the primary number of every card of that skill |

- A card meeting several tracks' schools takes the sum of their every-5th-level flats.
- **Linked attributes** (`balance.skill.linkedAttributes`): Blade STR, DEX; Shield STR, DEX, CON, WIS; Magic focus DEX, CON, WIS, INT; other tracks are authored with content.
- **Primary number.** Each card names one number in data (damage on an attack, Block on a defend, HP on a recovery card). The every-5th flat and odd rank steps land on it; the face shows the result. `primaryEffectIndex` is the first unconditional numeric effect of the card's best op, in the order damage, Block, heal, status stacks, poise damage. A cost (`loseHp`) or tempo (draw, energy, Mana, discard) is never primary. A card with no such number (stances, formula values, pure tempo) gains nothing until its skill's pool exists.
- **Percentage rolls are d20s.** Every percentage combat roll (crit, status application, avoidance, weakness stagger) is a d20 at 5% steps: success on d20 >= 21 - clamp(round(chance%/5), 0, 20), so 32% rolls and shows as 30%. Advantage keeps the higher die, disadvantage the lower (`src/engine/d20Chance.js`).

#### Card ranks

- A card has rank 1 to `balance.skill.rankMax` (10), never above its skill's level. A deck card's `rank` is a whole number >= 1 (absent = 1; `validateRunShape` and the combat snapshot refuse anything else).
- Rank steps by card type, overridable per card: odd ranks +1 primary number; even ranks one extra from the skill's pool (content; e.g. Blade a bleed or crit tag, Shield Poise or Block, Magic Mana or a heal). Until the pools exist every step is +1.
- `resolveCard` applies rank last (`registries.js applyCardRank`): steps = rank - 1 + `skillBonus`, added to the primary number so play, preview and face agree. A multi-hit effect splits steps across its hits, rounded up (`rankBonus`; an X-hit card counts as 3 hits). Ranks never raise a price or tempo.
- Face: upgraded ranks show "Rank X" centred above the effect panel as a separate top layer following adaptive expansion; authored Rank 0 and legacy unranked baselines are hidden.
- **Draft rank.** A skill draft rolls each offered card's rank (`skills.js rollDraftRank`) 1 to min(level, `rankMax` 10), weight of rank *r* proportional to *r*, on the `cardRewards` stream. The offer carries `ranks` (checked on load); the taken card keeps it. Rarity stays the gate for which cards are offered; the upgrade row raises rank, not rarity.
- **Rank-up row.** Each level from 2 on of a card-school track (weapon, focus, dual-wield) queues one rank-up (`skills.<id>.pendingRankUps`, absent on an older save; level 1 queues none). The door offers each as a `skillRankUp` row (`rewards.skillRankUps`, key `skillRankUp:<skillId>:<ordinal>`, deferred and reserved like a draft) beside that level's draft. It lists the run's ordinary cards of the track's schools with rank below the track level (`skills.js rankUpCandidates`: deck then sideboard; equipment-bound and item-owned cards excluded), each at the rank it would reach. Confirm raises the card one rank (`raiseCardRank`; pick kept in `pendingReward.chosenRankUps`). With no candidate the row says so and waits. A taken rank-up must name its card, and a saved rank-up's track must be a card-school track.
- **Rank-up bonus** (Core runs, card ranks on). A rank-up also offers 2 to 3 bonus options; the player picks one before confirming.
  - Rolled by the blacksmith's upgrade generator (damage, Block, Poise, Stamina or Mana cut, a tag, the rest of its pool) under the same eligibility rules (no cut below 1 SP or 1 Mana, none on a cantrip's Mana, the multi-hit floor, the +100% guard), with each numeric amount multiplied by `balance.skill.rankUpBonusScale` (shipped 2), rounded, and never past a normal upgrade's guards.
  - 3 options when the generator has 3 distinct ones, else 2 (1, or none, when that is all it has). Seeded by (run seed, card instance, step count) with its own salt, seeing the card at its new rank, so a reload shows the same options.
  - The pick is one ordinary upgrade step (`bonus: true`): a gift that does not use the free upgrade the new rank earns but counts toward the 10-step cap. The card's designed `authored` upgrade is not an option. The rank's upgrade range expansion is unchanged.
- **Respec.** Lowers queued rank-ups by the levels lost and drops the track's deferred drafts and rank-ups waiting for a level above 1 (the ledger re-offers what it still queues). Ranks already raised stay.
- `upgradeAt` is retired: no level upgrades cards; a draft, master lesson or book lesson card joins plain; the balance key is an unknown field and the load door no longer reconciles it.

#### Flat bonus and attribute picks

- **Every-5th flat.** Each owned card carries a derived `skillBonus` (`skills.js stampSkillBonuses`): the sum, over every card-school track whose schools (the held pieces' `skillSchools`) the card's tags meet, of floor(level / `balance.skill.flatEvery` (5)), capped at 99. A card in both hands' schools and the dual-wield union earns each. Every owned card counts, including equipment-bound and item-owned.
  - Stamped at each save (`main.js persist`), combat start (`createRunCombat`) and full restamp (`stampDeck`). A fight keeps the stamps its cards started with through a mid-fight swap or level gained; the next fight restamps. Carried into the fight's copies and carriers like rank; validated as a whole number 1-99; applied in `resolveCard` with rank.
  - A card offer's face shows the bonus it would be stamped with. The level popup names how many owned cards a claim raised.
- **Every-4th attribute pick.** Each track level that is a multiple of `balance.skill.attributeEvery` (4) and has a linked set queues `skills.<id>.pendingAttributePicks`. The door offers each as a `skillAttribute` row (`rewards.skillAttributes`, key `skillAttribute:<skillId>:<ordinal>`, deferred and reserved like a draft) beside that level's draft. The chooser lists the set's attributes, now to after; Confirm raises one by 1 (`levelup.js applySkillAttribute`), spends the pick and re-derives the pools.
  - The point is recorded in `run.skillAttributePoints` (added by `grantedAttributePoints` to the levelled points the load door judges the allocation against) and the granting track in `run.skillAttributeGrants` (track id to attribute ids; never naming more points than the run holds). A saved offer's own attribute list is honoured if the linked set later changes.
  - Respec lowers queued picks by the ones its lost levels queued, drops the track's deferred picks above level 1, and withdraws every point the track's picks granted (`levelup.js withdrawSkillAttributes`; FINISH D13a), re-deriving the pools. A save from before the record keeps its points.
- Not yet built: the rank-step pool content.

#### Falsify

- `xpToNext(registries, 'weapon', 9)` = 50060, `xpToNext(registries, 'class', 0)` = 400, the character's first step 200, and level 20 climbs no further.
- A rank-5 Slash is offered only at Blade 5 or above; skill level 4 grants a card, an upgrade and an attribute pick; level 10 the second +1 flat.

#### Notes and history

- `tests/xp-rates.test.mjs` pins the curves and caps.
- Skill feats, passives and crits were built, then removed (history file).

Full history: [docs/spec-history/13b-progression.md](docs/spec-history/13b-progression.md).

### 13.4p One break meter: Ward and Arcane Exposure fold into Poise

A fighter has one break meter, Poise. Magical impact fills it like physical impact; the Ward and Arcane Exposure meters are gone. Magic damage meets Poise first, 1:1, then Block; physical keeps Block first (Core 2, §17, `docs/FIXCORE-DECISIONS.md` D17). Where an earlier section disagrees, this one wins inside its scope. Pointers sit in §3.6, §4.2, §7.2 (`arcane-exposure-bar`), §12.1, §13.4k and the ratings section. *Superseded for new Core 2 fights (owner 2026-11-07, backlog #7): one damage kind; see §17, One damage kind in Core 2.*

- **Scope.** Retired with the ratings meter: it governed fights created with combat ratings (`ratingsRules`), which no longer ship, on runs whose snapshot carries `breakMeterVersion: 1`. New runs stamp it at creation. A stamp is still accepted on a saved run and changes nothing; Stagger is §4.4's `dealPoiseDamage`.
- **One meter: Poise.** In scope, every hit that deals HP damage deals impact into the target's Poise, physical or magical. Impact values are unchanged (weapon weight, a card's own Poise or Ward value, category defaults). A fill is the Poise break, **Stagger**, with its existing growth and overflow: an enemy loses its next move, the player loses `poiseActionLoss` actions next turn. Disruption is retired (no second break, no `wardActionLoss`).
- **Ward is a rating, not a meter.** It still reduces magical damage (Ward/(Ward+K)) and weighs in status resistance; its formula, item and relic contributions and settings rows are unchanged. A snapshot never carries `wardMeter`.
- **One guard.** Dodge Roll (§12.1) grants 3 Block and a **Poise guard** of 3 (each plus the DR bonus). The Ward guard is retired; the Poise guard absorbs impact before the meter fills. `gainWard` stays a valid opcode and grants Poise guard.
- **Arcane buildup is one formula.** A hit's added magical impact is `floor(exposureBuildupPerHit × schoolMult × target.buildupMultiplier × sourceExposureMult × foldScale)`: the first four factors are the old buildup factors (`cardExposure.csv`, `balance.arcaneExposure`, the enemy's multiplier, `exposureBuildupMult` passives such as Overcharge and Prismatic Thorn); `balance.exposure.foldScale` defaults to 0.5. It joins that hit's own magical impact before guards. An explicit `poiseDamage` effect stays authored impact and adds no buildup.
- **Arcane payoff.** A Stagger whose filling hit was magical (own impact or added buildup) emits **`arcaneStagger`** `{ targetId, sourceId }` after `meterFilled`, once per hit however many thresholds the overflow crosses.
  - An enemy's payoff is the `staggered` status every break applies ("any break but vulnerable to any damage type"); no `magicVulnerable`, authored `arcaneExposure.onBreak` or `exposure.defaultPayoff` row. `lockPolicy: whileMagicVulnerable` is dropped.
  - The player takes no payoff: their magical Stagger is ordinary.
- **Triggers.** Every `arcaneBreak` trigger moves to `arcaneStagger`: focus properties `siphon`, `overcharge`, `resonance` and the Starseer node `arcaneDraw` fire on an `arcaneStagger` whose `sourceId` is the holder. `staggerBreak` becomes +`balance.exposure.staggerBreakImpact` (2) magical impact on the holder's spell hits, added before the floor above.
- **`resonance`** pours its percentage of the broken foe's Poise threshold as it stood before the break's growth into every other living enemy as magical impact, spent on each target's Poise guard first. A Stagger it causes applies `staggered` but is not the holder's hit: no `arcaneStagger` with the holder as source, so no focus trigger and no chain.
- **Untouched:** `frostExposed` and `insanityExposed` are statuses from the Frost and Insanity procs, not meters.
- **Screen.** In scope, a combatant shows HP and one Poise bar; no Ward bar, Arcane Exposure bar or Disruption read-out. The Ward rating still shows wherever ratings show.
- **Configurable (D1).** `foldScale`, `staggerBreakImpact` and the default payoff are data rows; `foldScale` 0 makes buildup add nothing.

#### Notes and history

- Owner decision 2026-10-05 "Fold Ward+Exposure into Poise"; the reason is screen load, not balance.
- `arcane-exposure-bar` remains a registered component id (§7.2).

Full history: [docs/spec-history/13b-progression.md](docs/spec-history/13b-progression.md).

### 13.4q Class mastery: the class level lives on the profile, and each level unlocks one thing

Run-level and profile class mastery is not a live mode. Core runs do not open it; non-Core runs and saves are refused at load.

- What stays:
  - Authored mastery rows (`content/source/classMastery.csv`) remain data; Core's ability offers gate class cards by the class level they name (§13.4r).
  - A profile with `classMastery` or `classMasteryReceipts` still loads; the keys are ignored and never written.
- The class track is the per-run `class:<id>` track of §13.4o (curve and caps there); class levels unlock content on §13.4r's schedule.

#### Notes and history

- The mastery run and profile code, the profile bank and the `--class-mastery` simulator fleet were deleted (Unity-port cleanup P4); the full legacy contract is in the history file.

Full history: [docs/spec-history/13b-progression.md](docs/spec-history/13b-progression.md).

### 13.4r Modular class rewards, ability grades and XP presentation

Governs the class reward schedule, ability grades (rank 0-5), the Intelligence bonus option, gear gates and the XP reward presentation. It overrides §13.4q's rotation, §13.4o's ability-rank and class reward rules, and §13.4o's immediate first-ready-bar button. New progression mechanics are versioned in a run's snapshot; old saves keep earned items, reward receipts and unlock entitlements. Presentation ordering may apply to existing reward doors without rewriting the progression ledger.

#### Content modules

- Cards, feats and relics register definitions plus unlock metadata `{classId, level, kind, ref}`.
  - The shared catalogue composes installed modules with existing content and derives class pools and level lists from those registrations; it validates references, unique identities, prerequisites, supported kinds and class ownership.
  - Changing registered content updates its rewards and level descriptions with no separate UI list. Armour, weapons, shields and foci use the same metadata.
  - A module installs independently; disabled or absent modules contribute no offers. Saves with owned content need a stable content migration, never silent deletion.

#### Class milestones

Class milestones no longer queue. The table is the cadence `classMilestoneProblems` checks saved receipts against; it grants nothing to new runs.

| Category | Class levels |
|---|---|
| Cards | 2, 4, 6, 8, 10, 12, 14, 16, 18, 20 |
| Feats | 1, 4, 8, 12, 16, 20 |
| Armory | 3, 6, 9, 12, 15, 18 |
| Relics | 5, 8, 11, 14, 17, 20 |
| +1 class attribute choice | 5, 10, 15, 20 |

- A saved milestone row must carry exactly the categories its level lists.
- No reward or XP is replayed at run start, swap, reload or respec.
- Favored skills (other skills remain trainable):
  - Reaver: Combat Maneuvers, Blade, Shield, Heavy Armor.
  - Starseer: Spellcraft, Blade, Light Armor, Medium Armor.
  - Rogue: Combat Maneuvers, Blade, Dual Wield, Light Armor.
  - Herald: Spellcraft, Blade, Shield, Medium Armor.
- Class-tree choices keep their own earned budget. Combined reward doors preserve individually pending choices and replace conflicting old random class bonus rolls.
- Class milestones no longer queue or pay bonus skill XP.
  - `classMilestoneProblems` still validates saved receipts (`src/engine/save.js`).
  - `featChance` is a retired row, so an old export still imports (`advancedConfig.js`).

#### One action resource

- Actions, Stamina and SP name one pool. Each card charges its action cost once, plus separately authored Mana or HP costs.
  - The upcast surcharge (`def.upcastSurcharge`) is still paid: `resolvedCardPlayCosts` (`src/engine/combat.js`) adds it to both the Stamina and the Mana cost.
  - Recovery, discounts, maximum capacity, eligibility and save validation use the shared pool; keep the existing runtime action/Stamina binding where it supplies that identity.

#### Ability identity and grades

- Magic cards are Spells; rank-zero Spells are Cantrips. Physical Mana-costing cards are Combat Maneuvers; weapon-bound components are Weapon Arts; rank-zero physical actions are Techniques.
  - Spellcraft broadens the Magic Focus skill (stable internal identity); Combat Maneuvers is its physical counterpart.
  - Source identity, equipped carrier and armor/grip checks determine skill XP; a shared school tag alone is not enough.
- Six grade profiles, 0-5, replace the proposed 1-10 potency overlay for these families. Skill-level ceilings: rank 0 at level 1, then ranks 1-5 at levels 2, 4, 6, 8, 10. Class-level family unlocks and skill-level ceilings are separate. Legacy ranks and blacksmith tiers are not applied again to an ability profile.
- Base grade costs (a family authors an exact cost within its range):

  | Rank | Actions | Mana |
  |---|---|---|
  | 0 | 1-3 | 0 |
  | 1 | 1 | 1 |
  | 2 | 1-2 | 2 |
  | 3 | 1-3 | 3 |
  | 4 | 1-4 | 4 |
  | 5 | 1-5 | 5 |

- Grade effects raise damage, defense or utility and enable named riders; they are data, not per-card code. Cantrips and Techniques keep weaker Action-only fallbacks.
- Spellcraft and Combat Maneuvers activate at level 1 once per run and grant one guaranteed matching card per ability-skill level.
  - Ability-skill XP to next level = `100 + 50*(level-1)` (2,700 total to level 10); other skill curves are unchanged.
  - Magical resolutions train Spellcraft (extra for Spell identity); successful physical actions train Maneuvers. Award per play, not per hit or target; never feed skill rewards back into class XP.

#### Three choices and Intelligence

- An ability offer holds three distinct eligible families at the current normal grade.
  - One roll on the persisted card-reward stream adds a fourth option with probability `clamp(effectiveINT*0.05,0,1)`; its grade is chosen with equal weights from `rank+1` through `min(rank+3,5)`. Rank 5 has no higher option. Choose one card, even from four.
  - The earned higher-grade card is usable below its usual skill ceiling when its costs and other requirements are met; class-family and equipment gates remain.
  - The offer, INT snapshot and earned grade persist; reload, return navigation or later INT changes cannot reroll it.
  - Shared lessons keep at least three compatible families per rank, including nonfavored classes.

#### Authored expansion

- Register 40 new families (10 per class; six profiles each, 240 versions), 50 feats, 50 ability tags and 10 relics.
  - Existing plus new caster family defaults must print Mana costs on at least half of each caster catalogue (grade variants do not count). Normal rank-zero Cantrip offers are Action-only.
  - The 24 existing card-cost retunes, tag descriptions and named rewards are in the progression expansion plan.
- Conditional riders use shared generic predicates and effect operations (turn-history metrics, once-per-turn gates, one-charge next-card bonuses/discounts, nonlethal HP offerings, bounded status removal). Grade recipes execute their authored effects; no per-card callback.

#### Gear gates

- Hide locked nonstarter armor and held items from Armory, shop, drop, training and upgrade choices until the required class level is reached.
  - Default armor and baseline held items stay available; discovery, boss and attribute requirements remain.
  - Progression may show future items with requirements. Owned items and historical unlock entitlements survive by stable identity.

#### XP reward presentation

Core Victory receipt (§17) shows only the Character bar for now; these rules govern every other reward door.

- Show only tracks that gained XP in that award. Order: Class, Character, then skills by descending current level (stable name/id ties). A banked ready track without XP in this award stays claimable through the deferred progression door.
- Fill rows one at a time at the same normalized fraction-per-second velocity (not equal durations).
  - A bar stops at its next threshold; full bars turn blue but stay noninteractive while any row fills. Surplus stays banked. Reduced motion reaches identical states without delays.
- After all rows finish, reveal all ready blue Level Up buttons and rewards, then enable the green Continue button. A no-XP award proceeds immediately. No level is claimed automatically; Continue keeps unclaimed levels in the deferred ledger.
- A Level Up press claims exactly one level and opens its reward choices.
  - On return, quickly animate that track's residual XP from zero to its next fraction or threshold at a common faster refill rate; filled rows stay stable.
  - If another level is ready, reveal its button only after the refill. Continue stays disabled during a refill.
  - Multiple claims, chooser Back, reload and returning to the door cannot drop surplus, duplicate grants or restart earlier XP awards.

#### Notes and history

- Class-level feats and the milestone XP payment of earlier drafts are gone; class respec was removed with the legacy mastery runs.
- Cost of any future class rebuild is undecided.

Full history: [docs/spec-history/13b-progression.md](docs/spec-history/13b-progression.md).

### 13.5 The last seat opens the causeway to the Ashen Spire

The Blighted Valkyrie (`a3_bossRotValkyrie`) is the boss of the tier-3 act, whatever seat it is.

- She is in no seat's boss pool. `buildActMap` at tier 3 draws the seat's pool as usual and appends her encounter as one more destination, so the final act offers her beside the seat's own bosses; `restBeforeElite`/pre-boss-rest rules apply to her terminal.
- Her encounter row carries `seat: null`, the one row the schema admits `null` for; a second null is a validation error.
- Which terminal ends the run is the player's route (§12.4).

*Falsify:* tier-3 maps for each of the three seats: every graph's `bossIds` includes her node and at least one node from the seat's own pool; tier-1 and tier-2 maps never include her.

### 13.6 What does not change — the byte-identity claims

For every seed and every save written before this section:

1. Every act map is byte-identical for the same content act: geometry is per tier (`mapConfigs[tier]` = old `mapConfigs[act]`), unknown weights are per tier, and no draw on `map`, `events`, `enemyHP`, `shuffle` or any pre-existing stream is added, removed or reordered. The only new draw is on the `seats` stream.
2. A migrated save climbs the seats in its old order and fights the boss its graph already names.
3. A fight in a seat at its baseline tier rolls the same HP (§13.3 multiplier 1). Boss fights are the exception: `balance.bossTiers` scales a boss by the tier it is met at (§13.3).
4. World Journey is untouched: it never called `rollEncounter` or `buildActMap` (`journeyEncounter`, `journeyGraph`) and keeps `drowned-coast`.

- The one allowed change on an existing seed: which seat a new run opens in.
- Pinned by `tools/runsim.mjs` and `tests/branchingBosses.test.mjs` (claims 1-3) and `tests/world-atlas.test.mjs` (claim 4).

### 13.7 Version and delivery

- **Version: no bump** for this section (a SPEC change ships nothing).
- The delivering feature PR proposes `0.7.1` (`contentBundle.version`, `src/content/index.js`): a new run-order system with a save-schema migration is a MINOR (`docs/versioning.md` rule 2). It carries `content/seats.js`, `engine/encounters.js`, `engine/actmap.js`, `model/state.js` v6 and migration, `balance.seatTiers` and `tests/seats.test.mjs`.

#### Notes and history

- Release numbering is automatic (CLAUDE.md, docs/versioning.md).

Full history: [docs/spec-history/13b-progression.md](docs/spec-history/13b-progression.md).

## Shared armor sets
Four `sharedSet` outfits are in every class's Armoury after creation: one identical row per wearer class, on class-scoped armor save keys. Empty unlock means owned; excluded from starting-armour selection and exactly-one-baseline rule. Existing saves stay valid. Equip needs the listed stat at 3.

Bonuses (`outfits.csv`, existing modifiers): Wayfarer Plate (STR) +2 Defend Block, +4 max HP; Nightweave (INT) +1 class-power Potency, +1 max Mana; Rite Vestments (WIS) +1 Defend Block, +6 max HP; Gutter Leathers (DEX) +1 Strike Damage, +1 max Stamina.

- Tags stay in `tagging.csv`; `inventoryArtKey` picks the item illustration.
- `sharedOutfitArt.js` picks a distinct sprite collection per class/outfit combination (16, incl. readiness, defeat); `artClassId` plus `artKey` is the classic-rig fallback.
- Card review page shows all four wearers per outfit, with selectable combat poses.

#### Notes and history
Full history: [docs/spec-history/world-journey.md](docs/spec-history/world-journey.md).

## New-game opening presentation

Solo new games may show a configurable prologue after creation, starting draft and map generation, before map mounting. Five shipped scenes plus four empty editor slots that stay off (`PROLOGUE_DEFAULTS.scenes`, `src/model/prologue.js`); text and presentation overrides are in the advanced configuration snapshot/export.
- Optional `run.prologue` = `{version:2,status:'pending'|'complete',scene:0 to `scenes.length` - 1,reason?:'completed'|'skipped'}`.
- Pending saves resume at saved scene boundary; absent or completed state never replays; preview writes none. `settings.prologueSeen` is a profile playback preference, not gameplay RNG.
- Skip and Set forth each complete the presentation exactly once, without selecting or resolving a node. Default five-second transition and per-scene holds are independent; final arrival waits for the player; Settings and hidden pages suspend playback.

#### Notes and history
Full history: [docs/spec-history/world-journey.md](docs/spec-history/world-journey.md).

## Configurable stat pools, ratings, Poise and Ward

Ratings (AR, DR, PR, Poise, Ward) turn attributes and gear into damage, mitigation, impact meters and status resistance. Starting pools, formulas and caps are Settings.

### Snapshots and scope
- New runs snapshot the rating rules; snapshots without `ratingsVersion` 1 keep legacy combat arithmetic.
- New Settings values apply at new-run creation, not to a saved character.
- New combat snapshots persist ratings, both impact meters *(only Poise in §13.4p's scope)*, break growth and fractional status-resistance remainders.
- The shipped solo combat path adopts these rules. The foundation/combat-workshop path keeps its existing rules until supplied a compatible rating context.

### Starting stats and scaling
- **Advanced → Progression → Starting stats**, one row per creation mode (Standard, Assign points): starting value of every attribute; points to assign; total; lowest a stat may be set; highest at creation; whether points may be taken back.
- Setting the starting value decides the total (baseline × attributes + points). Leaving it lets the total drive and derives the baseline.
- **Advanced → Progression → Equipment requirements**: one row per authored item/attribute minimum, plus one table multiplier. The minima are the floor under the total (a class must hold its starting kit).
- Allocations, floors, ceilings and class presets scale to the chosen total, and scaling stops there: no conversion scale, no formula normalized back to an authored unit scale.
- Formulas and stat-driven hand sizes read the unscaled attribute the sheet shows, so a smaller pool buys smaller ratings, pools and hands; retune coefficients, never add a factor.
- **Advanced → Stats** owns: each HP and resource formula's base, attribute weights and growth per level; HP, Mana, Stamina, Draw and Poise conversions; hand rules; the five rating formulas; item ratings; relic and status bonuses; resistance weights; diminishing-return constants and caps; impact categories; attack overrides; break penalties.

### Rating formula
`rating = base + floor(global multiplier × rating multiplier × Σ floor(weight × attribute))`. Each attribute term is floored alone, then the product again (a 0.25 weight yields nothing until the attribute reaches 4). Each formula exposes base, weights and multiplier; one global multiplier scales all five; both default 1. Each ruleset-7 formula is a floored term of its own.

| Rating | Default, ruleset 7 (`src/content/derivedStats.js:101-107`) | Frozen for runs born before ruleset 7 (`src/model/statRows.js:37-44`) |
|---|---|---|
| AR | STR | 0.75 STR + 0.5 DEX + 0.25 CON + 0.25 WIS + 0.25 INT |
| DR | DEX | 0.5 STR + 0.75 DEX + 0.25 CON + 0.35 WIS + 0.15 INT |
| PR | INT | 0.25 DEX + 0.5 CON + 0.5 WIS + 0.75 INT |
| Poise | 1 + CON | 1 + 1 CON + 0.5 STR + 0.2 WIS + 0.1 INT |
| Ward | 1 + WIS | 1 + 0.2 DEX + 0.3 CON + 1 WIS + 0.5 INT |

**Sources** add together: equipped weapons and armour, relics, mounted properties, active status bonuses.
- Physical weapon Attack Rating → AR; magical weapon Attack Rating → PR; item Defense Rating → DR; body-armour Poise → Poise.
- Body armour's own DR is the optional `defenseRating` column of `outfits.csv` (blank = 0; the Reaver's starting Wayfarer Plate authors 1), not printed on the armour card.
- Item ratings are the item's OWN VALUES, not bonuses: the settings row opens on the authored number, which is the rating on the card, in the Armoury and in combat; attributes, relics, mounted properties and status bonuses add to it.
- A configured rating is written back to its source column: weapon Attack Rating (by its attack profile's school), item Defense Rating, body armour's Poise threshold (also its weight). A rating no column can hold (Ward, an armament's Poise, off-school Attack Rating, every body-armour rating but Poise) lives in the run's rating rules and reaches combat without appearing on the card.
- Item ratings apply only while the ratings system is enabled (body armour's Poise threshold is also its weight).
- Temporary status bonuses to Poise or Ward affect resistance, not the current break threshold.

### Card damage
- Card damage = base + AR (physical) or PR (magical); in Core 2 under `damage.unified`, PR applies to spell-camp attacks, and spell damage is otherwise ordinary damage.
- Physical defensive-skill Block gets DR; magical Block and healing get PR. Magical power hooks keep their originating card, so their damage, Block and healing get PR.
- Resource generation, buff duration, card draw and action costs get no PR.
- Profile-level attribute scaling is off for these runs (no double bonus). Authored card-specific modifiers still apply.

### Mitigation
After additive bonuses, percentage modifiers apply.
- Physical damage reduced by Poise/(Poise+K); magical by Ward/(Ward+K). Uses the rating, not accumulated impact.
- K defaults to 100; maximum reduction configurable, default 80%. K is an absolute rating threshold: retune it, never scale it, when the starting pool changes.
- Enemy Poise and Ward are independently configurable, defaulting to the enemy's authored Poise threshold (Core values halved, owner 2026-10-19).

### Impact and breaks
An attack that deals HP damage also deals impact: physical fills Poise, magical fills Ward. *(Superseded in §13.4p's scope: both fill Poise; Ward is a rating only.)*

| Hit | Impact |
|---|---|
| Physical hit carrying its source weapon (Strike and package cards) | Weapon weight: ≤3 → 1, ≤6 → 2, ≤8 → 3, above 8 → 4 |
| Any other card hit, weapon arts included | The card's own Poise or Ward value (§3.4) |
| No card value | Magic 1; unarmed physical 1; untyped enemy physical 2 |

- Configurable: weapon thresholds, per-enemy physical impact, per-enemy-move typing, per-card overrides. -1 inherits the category value; 0 disables impact.
- Fully blocked attacks cause no impact. Authored poise-damage effects remain additional physical impact.
- *(In §13.4p's scope: one Poise guard, one break, no Disruption; a magical Stagger is Staggered like any other, no `magicVulnerable`.)* A Poise or Ward guard (the Dodge Roll's, §12.1) is spent on impact before its meter fills, as Block before HP, and clears at the start of its owner's turn.
- Poise break = Stagger; Ward break = Disruption. Both default to losing one Action on the player's next turn; enemies lose their next move.
- Every enemy break also runs `balance.poise.onFill` (the `staggered` status, so Staggered-gated riders such as Executioner fire), once per impact however many thresholds it crosses (owner, 2026-10-12).
- The meter keeps overflow; its threshold grows 25%, rounded up. Breaks apply no extra Weak or Vulnerable. Meter recovery defaults to 0, configurable per player turn.

### Status resistance
Reduces hostile buildup or incoming stacks, not duration or proc severity. Self-applied beneficial effects are unaffected; other effects are unresisted until configured.
- Effective rating = Poise × physicalWeight + Ward × magicalWeight (both may be positive; need not sum to 1; e.g. Bleed's Ward weight is 0). Applied = base × K/(K + effective rating), subject to the resistance cap.
- Fractional applications carry forward per target/status.

| Status | Poise / Ward weight |
|---|---|
| Bleed, Venom | 100% / 0 |
| Insanity, Madness | 0 / 100% |
| Frost, Crimson Blight | 50% / 50% |
| Burn | 25% / 75% |

### 13.4s Core card upgrades: free by rank, a stone past that, ten at most

Core only (Legacy and Current keep the single authored upgrade). Design and build order: `docs/ai/tasks/CARD-UPGRADES-2026-10-28.md`. Ranks are on in Core (`progression.cardRanks`, §13.4o): a rank adds 1 to a card's primary number per step past 1.

- **Free allowance F.** Upgrade number n starts at 1 and is free while n ≤ F.
  - F = the instance's rank (default 1, at most 10); a Basic card or a cantrip gets F = 1.
  - For upgrades, Basic = a common card that is not a spell; cantrip = a card tagged `rank.cantrip`. Uncommon, rare and starter cards are not Basic. This is not the Martial Adept Basic rule.
- **Cost and cap.**
  - Each upgrade past F costs 1 Smithing Stone. A card takes at most 10 upgrades.
  - At a Blacksmith every upgrade, free or not, costs `blacksmith.prices.cardUpgrade` (40) cinders and no Smithing Stone (the 1 stone less the Blacksmith's stone discount, never below 0). A rest site is unchanged. A Blacksmith can also raise a card's rank (§14.4 `rankUp`).
  - A card with no eligible step left is fully upgraded: both refusals read "Fully upgraded" and cannot be bought again.
- **What a step does.**
  - Step 1 is the card's authored upgrade if it has one; otherwise, and for every later step, a seeded procedural step.
  - Caps: a status never past its cap; damage or block gain never past +100% of base; cost never below 1; cost and hits once per card. Never touches a conditional or HP-loss effect.
  - Power, status and curse cards take only a cost step. Retain is not offered (Core does not honour it at end of turn).
  - Roll = `mulberry32(hash(run.seed, instanceId, stepIndex))`, so preview equals commit. The step is stored on the card (`upgradeSteps`), never re-derived. Name: `Name+` for one upgrade, `Name+N` for N.
- **Where.**
  - Rest site: one card upgrade per visit, alongside the other services (it does not close them).
  - Blacksmith: any owned card (deck or sideboard; deck cards marked "In deck"), no limit per visit while the player can pay.
  - Event reward: one free step (still capped at 10).
  - Every picker shows the cost (Free, or 1 Smithing Stone) and the card before and after, from the same step the commit applies.
- **Blacksmith reach.** 25% of Core shop nodes are a Blacksmith instead of the merchandise shop (`shops.blacksmithChance`), decided once per node from the run seed.
- **Step options and weights.** Every step after the authored one draws from the table. A step that changes nothing is never offered. The vocabulary is the one `combatCardProfile.js` reads; saves and combat snapshots validate the `poise` and `tag` step kinds like the rest.

| Kind | Weight | Effect |
|---|---|---|
| dmg | 30 | +damage |
| blk | 25 | +block |
| stk | 20 | +status stacks |
| cost | 10 | -1 SP or MP |
| addStatus | 8 | an added status |
| hits | 5 | +hits |
| poise | 12 | +max(1, ceil 20%) on the first plain `poiseDamage` effect; only on a card that has one; never past +100% of base |
| range | 6 | melee → reach, reach → ranged, replacing the `range:` tag; on a card that attacks |
| targeting | 6 | first plain damage effect moves between one enemy and all enemies, `targeting:` tag swapped; single → area cuts the amount 25% (round up, min 1), area → single adds 25% (round up, never past +100% of base); never on a Sweep; once per card |
| stance | 5 | a physical attack's `maneuver:` tag changes among attack, smash, ranged (smash only on a card paying 2 SP or more); once per card; never a Sweep, Defend or Counter |
| school | 4 | a spell's `school:` tag set to another of frost, fire, lightning, force, alteration, illusion, divine, decay, earth; once per card |
| element | 6 | a physical attack's damage school becomes magic, arcane, holy or fire (a magical property); once per card |
| rank down | 3 | adds `rank.cantrip` (the copy counts as a cantrip, free allowance F = 1, from then on); once per card; only on a card not already Basic |

- **Cantrip and Basic Mana.** A cantrip or Basic costs no Mana, printed or upgrade-made (`core.mendingTouch` prints 0 MP; the validator refuses a `rank.cantrip` card with Mana).
  - Rank down sets the copy's Mana cost to 0 wherever the card resolves (saved copies included); the preview reads e.g. Mana 2 → 0.
  - No -1 Mana (`cost`) step is offered on a cantrip, a Basic or a copy that became one.
  - A card paying 0 Stamina is not offered rank down (a 0/0 cantrip is forbidden).
- **The choice (Blacksmith only).** The player picks one of several rolled options: 2 for a Basic card, 3 for a ranked (not Basic) card. Rest-site upgrades and event free upgrades keep the single roll.
  - Options are distinct kinds from the same per-step seeded stream; the first is exactly the single roll, so preview equals commit.
  - A card's first upgrade still offers its authored upgrade (one option), plus one rolled alternative at a Blacksmith.
  - A quote lists its options; the commit re-plans the same list and refuses a step not on it.
  - The dialog shows the after-faces side by side (stacked on a phone), the picked one highlighted.

#### Notes and history
- Runs born before ruleset 7 keep the frozen formulas in the rating table.
- In §13.4p's scope Ward is a rating only (no Ward meter).

Full history: [docs/spec-history/14-statpools-shops.md](docs/spec-history/14-statpools-shops.md).

## 14. The deck editor and the three shops

The deck editor lets the player move cards between the deck and a sideboard under size and copy rules. Core's shop is the configured shop plus a Blacksmith (§14.4). Every number a player could want tuned is a **Settings row with a default read from content data**, never a screen or engine literal.

**Four rules this section carries:**
1. Content is data: defaults live in `src/content/deckRules.js` and `src/content/shops.js`; `validateContent` refuses a malformed row by name.
2. Each rule is configurable: Settings reads its default from that data; a value the player picks is stored in the profile's `settings` (§3.12).
3. Reuse what exists: `buildShopStock` and `ShopWorkspaceModel`, `smithingPlan`/`commitItemUpgrade`, `cardExtraction`, `cardMounts`, the location visit (§13.4j), `run.skills` (§13.4d), the plan/commit transactions of `armamentTrading.js`, the save migration door. A second copy of any is a defect.
4. New run state is additive. A PR that adds a persisted field:
   - bumps `RUN_SCHEMA_VERSION` once, adds a `RUN_SHAPE` row and the default at `migrateRunSchema`;
   - appends one captured save of the new version to `tests/fixtures/run-save-schema-versions.json`, never editing an existing entry;
   - never archives a save for a missing field.

| Field | Default for an older save |
|---|---|
| `sideboard` | `[]` |
| `editMintCounter` | `0` |
| `equipmentGuardSlotCount`, `removedGuardSlotIds` | not added: the guard count is derived |
| shop `stock.kind`, `stock.offerings` | `'market'`, and today's shelves as offerings (read at the load door, no reroll) |
| `consumables` | `{}` |
| `sigils`, `sigilSlots` | `[]`, `{}` |
| `loadout.boughtArmour` (`[{ classId, id }]` armour sets bought at a market, read by `ownership()`; optional, no bump of its own) | absent (none bought) |
| `companions` | `[]` |
| `smithingStonesRefined` | `0` |
| atlas smith `serviceStates[pointId].stock` | absent, rolled on first entry |
| `trainingPool` | `0` |

### 14.1 The deck editor

**Settings.** Advanced group **Deck**. Each default is `deckRules.defaults.<key>`. They are plain profile settings read live (like `shrineMultiUse`), not `gameConfig.*` rows, so not copied into `run.advancedConfigSnapshot`: a change applies the next time the editor opens, and `playInDeckOrder` to the next combat created.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `deckEditing` | bool | on | The editor exists. Off: no door opens it; the deck changes only by rewards, removal and the Armoury. |
| `deckEditingWhere` | `free` \| `restOnly` | `free` | `free`: from the Armoury any time out of combat (including before the first node). `restOnly` ("Rest sites only"): only as an option card on the Rest screen of a place whose tags carry the `deckEdit` service tag (a marker like `smith`, no rule; `tagging.csv` gives it to shrine, inn, chapel, not camp). |
| `deckMinSize` | number ≥ 0 | 10 | Fewest cards the editor lets you confirm. |
| `deckMinUnlimited` | bool | off | On: no minimum, `deckMinSize` ignored (row shown disabled). |
| `deckMaxSize` | number ≥ 1 | `deckRules.defaults.deckMaxSize` | Most cards. A max below the effective min is refused in Settings by name. |
| `deckMaxUnlimited` | bool | on | On: no maximum (`deckMaxSize` row disabled). |
| `playInDeckOrder` | bool | off | Draw pile not shuffled (below). |

**The collection is what the run owns plus the unlimited basics.**

**Core 2 from 2026-11-14** (owner brief; §17 *Rest sites, progression and combat pacing*): the shipped profile ignores `deckEditingWhere` (its `cards.editorWhere: "rest"` opens the editor only from the Rest screen's free Edit deck door) and lists no unlimited rule, so the editor shows each owned card as an ordinary tile and mints nothing. The Adept entitlements below describe a run pinned to an earlier Core 2 profile.

**Core collection and Adept copies** (owner, 2026-10-23): uncollected cards stay hidden.
- Run-scoped, monotonic `collectedCardIds` ledger of loose card definitions the run has collected.
  - Seeded from the starter deck; updated when the run acquires an ordinary loose card.
  - Collection tiles include known definitions even after the last copy is removed or the class changes.
  - An older Core 2 save without the ledger initialises it from loose cards in deck and sideboard (removed historical copies cannot be reconstructed).
  - A temporary item-owned card (including one via a `grantedBy` source) does not enter the ledger by itself.
- Entitlements (tag IDs stable): the Reaver and Rogue's equipped class grants active `training.basic` (Martial Adept): unlimited pristine **Basic** copies of ledger definitions. The Starseer and Herald's equipped class grants active `training.graduate` (Magic Adept): unlimited pristine **Cantrip** copies of ledger definitions, except Mending Touch (`core.mendingTouch`), which they own only as copies they collect (owner, 2026-10-28; the bundle's graduate rule lists it in `excludeCards`).
  - Needs the matching class equipped. Only Basic or Cantrip qualifies; higher-rank spells, Powers, specials and weapon arts do not.
  - Ledger membership survives removal and class swaps, but minting stays gated by the equipped class and the normal equipment, range, source and deck-size rules.
  - A minted copy has a unique instance ID and default state; it never clones an upgraded or modified copy.
- Legacy, Current and archived Core 1 profiles keep the copy rules below.

**Core equipment grants** (owner, 2026-10-19): a Core gear row may author `grantedCards` (`[{card, copies}]`, validated against the Core card list).
- While worn, its cards ride in the deck as item-owned (`granted`) instances: added on equip, removed on unequip or swap, never duplicated, held aside like any granted card.
- Grants and weapon arts are on in Core; kits and the Dodge Roll stay off.

**Core weapon arts** (owner, 2026-11-01): on in Core and the default configured profile via the equipment module's `weaponArts` setting (`engine/modules/equipment/settings.schema.json`), `true` in the Core bundle, absent (off) elsewhere.
- A worn weapon lends its default art(s) (`weaponCardPackage.weaponArtDefaults`) to the deck as item-owned (`weaponArt`) instances: added on equip, removed on unequip, swapped on replace, never duplicated (two hands go through the framework split, so an art both author installs once), held aside like any item-owned card (a sideboarded art stays in `run.sideboard`, not re-minted).
- The kit's basic Attack and Guard cards and the Dodge Roll are still not minted.
- Core's Blacksmith withholds extraction and installation: no art mounts to edit, no mount overrides.
- A profile that turns a resource pool off prices an art's disabled pool at 0.
- The Bone Sceptre grants Mana Surge (1 SP, gain 2 Mana) to any class holding it, replacing the Resource Gain stand-in in the Starseer opening deck.

**Core weapon arts per weapon** (owner, 2026-11-05): each Core weapon has one default art (granted while worn) and two learnable arts (`weaponCardPackage.learnableArts`, authored in `content/source/weaponCardPackages.json`; distinct from the default and each other; no card on more than three weapons).
- Wearing a weapon never grants a learnable art. Rewards, shops and the Blacksmith offer the learnable arts (and defaults) of carried weapons (equipped hands, storage, sets) that the player does not own. Owned = in deck or sideboard, or granted by a worn weapon.
- `core.reaverSpecial` (Sundering Art) is a class card, not in the weapon-art pool.
- A bought or rewarded art is an ordinary deck card with no weapon-tied play gate.

**Unlimited basics (Legacy and Current), matched by role, not `cardId`.** A starting Strike is an attack-slot instance (`equipmentRole: 'attack'`, `equipmentAttackSlotId`) whose `cardId` is the weapon's face; a Defend is a guard instance (`equipmentRole: 'guard'`). `stampDeck` re-derives both from the slot plan (§3.8, §13.4b).
- **Removing a basic** retires its slot via `removeDeckCard`'s retirement (`removedAttackSlotIds`); the instance goes to `run.sideboard`.
- **Adding a basic** first un-retires a retired slot (its sideboarded instance returns). With none retired it grows the allocation: `equipmentAttackSlotCount` +1, and the next `stampDeck` stamps slot `attack:<count>` with the weapon's current face and modifiers.
- **Guard basics** have no allocation or slot count: adding a Defend mints a `defend` guard instance with no slot; the guard plan (`loadout.js`) derives the count.
- A run with no equipment (a pre-equipment save healed at the load door, §3.12) has plain `strike` and `defend` instances. `deckRules.unlimitedCardIds` (shipped `['strike', 'defend']`) names the unlimited ids; adding one mints a plain instance, `instanceId` `edit:<n>`, n = `run.editMintCounter`.
- Every basic with unlimited-copy entitlement shows ∞; in Core it needs an already-collected definition and the matching active Adept entitlement.

**Every other card is limited to the copies the run owns.** Owned = `run.deck` plus **`run.sideboard`** (`CardInstance[]` of owned cards out of the deck): weapon arts bought or extracted, skill-draft cards (§13.4e), class-tree cards, reward cards.
- Removing one in the editor moves the instance, with `upgraded`, `mods` and every field, to `run.sideboard`; adding moves it back. The editor never mints or destroys a limited card.
- The collection tile reads "N owned · M in deck" and greys out when M = N.
- **Owned means deck ∪ sideboard everywhere:** `projectZones` (so `run.collection` includes the sideboard, §13.4a); `cardExtraction`'s `installableCards` and `commitInstall` (the commit takes the instance from whichever pile holds it, so `restOnly` needs no editor visit first); `rankUpCandidates` (§13.4o). Combat reads only `run.deck`.

**Class spells and Powers: one copy in the deck** (owner, 2026-09-26), except an eligible collected Cantrip (Magic Adept) or Basic (Martial Adept) minted without limit in Core.
- Covers any class (not colorless) card whose type is `power` or that carries `source:spell` (`deckRules.singleCopy`). Limit = Settings row `classSpellPowerCopies` (default 1), answered by `deckCopyLimit(registries, cardId, settings)`.
- The editor refuses a copy past the limit and names the card; further owned copies stay in the sideboard.
- Legacy and Current Strike and Defend remain unlimited; weapon arts and techniques stay limited to copies owned.

**Every deck card can be set aside** (owner, 2026-10-03), item-owned included.
- Its instance and ownership metadata stay in `sideboard`; equipment reconciliation must not re-mint an instance held there.
- The same excluded instance ids travel into combat and its snapshot, so a mid-fight equipment swap or reload cannot restore a removed card.

**Adding requires compatible equipped tags.**
- Always available: unlimited Strike/Defend basics and `deckRules.equipmentEligibility.universalTags`. Cards with no equipment-associated school are universal.
- Other cards with equipment-associated school tags need a matching worn piece. Explicit weapon identity tags (`weaponTags`, shipped blade/bow/ranged) take precedence over secondary shared tags (a bow cannot unlock blade skills through pierce/flourish).
- Item-lent instances also need their exact active source mount and card identity. Extraction or installation updates a sideboarded mount to its current card before that entry suppresses the equipment deal; stale tile identities cannot restore a different card.
- Ineligible owned cards stay visible with "Equipment not found"; every add path refuses them. Copy limits still apply.

**The shop's Remove service** (`removeDeckCard`) still destroys a card, no sideboard. In Core it removes the instance but does not erase its definition from `collectedCardIds`.

**Size rules.** `effectiveMin = deckMinUnlimited ? 0 : deckMinSize`; `effectiveMax = deckMaxUnlimited ? ∞ : deckMaxSize`. `deckEditRefusal(count, settings)` returns `''` when `effectiveMin ≤ count ≤ effectiveMax`, else one sentence naming the count and the bound ("Your deck has 8 cards; it needs at least 10.").
- **Done** is disabled with that sentence shown as visible text beside it (FINISH §6), never only a colour.
- **Cancel** restores every field a session can change: deck and sideboard instance for instance, plus `equipmentAttackSlotCount`, `removedAttackSlotIds`, `editMintCounter`. It goes through `beginDeckEdit` and `cancelDeckEdit`, leaving no disagreeing slot allocation and no used mint number.
- Bounds are checked **only on confirm**. A reward, purchase or equipment swap may leave the deck outside them; the next visit shows the refusal until fixed.
- Independent of the Armoury floor of §13.4b (`deckMinimum`), which still governs leaving the Armoury; FINISH's Owner decisions list records whether to fold them together.

**Play in deck order.** Off: the deck list is one row per card variant (card id, upgrade and mods, plus owner for a locked card; `deckVariantKey`/`cardVariantKey`) with ×N, a row's － takes one copy. Collection tiles use the same variant key, so Strike and Strike+ stay separate rows. On: one row per instance with a reorder handle. `run.deck` array order is the arrangement (no new field).
- `createCombat` builds the draw pile in `run.deck` order instead of `rng.shuffle('shuffle', deck)`; drawn from the top, first card first. Innate cards still go on top, keeping relative order.
- When the draw pile empties, `drawCards` takes its own ordered path (not `reshuffleDiscardIntoDraw`, which `shuffleDiscardIntoDraw` also uses): the discard pile ordered by each instance's index in `run.deck`, then cards not in the deck (created in combat) in discard order.
- Combat start and the empty-pile return consume no `shuffle`-stream value while on; a seed played with it off is unchanged. Card effects that shuffle (`shuffleDiscardIntoDraw`, `addCard`'s random position) still use that stream.
- Read once at combat creation and carried on the combat as `orderedDraw`, so a saved fight resumes under its starting rule; a snapshot without the field restores as `orderedDraw: false`.

**UX.** `DeckEditorModel` plus `mountDeckEditor`, with an entry in `docs/component-catalog.html`.
- **Layout.** Reading Desk: collection left, persistent card inspection middle, deck right. Phones: one list (the collection) with － count ＋ steppers; inspection opens over it, Back returns; an ordered deck adds a Draw order view.
  - A selected card shows a round (i) on its art; the (i), or pressing the selected art again, opens the inspector; no row reserves room for it (owner, 2026-10-11).
  - Each row and the inspector name the stance: maneuver (Attack, Defend, Counter, Smash, Sweep, Ranged), otherwise Spell, Power, Consumable or Skill.
  - A row shows rank as an art badge (Rank N; rank 0 or unranked reads Cantrip for a magical card, Basic otherwise; powers, skills and consumables without a rank show none).
  - A card that attacks shows range after the stance (Melee, Reach or Ranged from contact, near or far reach). Untagged spell under expanded combat: projectile → Ranged, melee → Melee, otherwise Reach. Untagged physical card: combat's default (near for projectiles and ranged maneuvers, otherwise contact). A Ranged maneuver shows no separate range.
  - A mark precedes costs: Smash sigil in silver for physical, Spell flame in blue for magical.
  - Phone rows read grip, art, then name, stance and range, then rules; mark and MP/SP sprites top right, stepper bottom right, the same at every phone width (smaller phones shrink art, costs and stepper rather than moving them; owner, 2026-10-11).
  - Collection offers All/In Deck on its title row; the deck offers List/Cards presentation and collapsible type groups. Ordered decks keep exact sequence instead of type groups. Copy counts show for single and grouped copies. Text search is off for now (owner, 2026-10-11).
- **Undo** reverses the last successful add, removal or reorder, restoring the full Cancel state (allocation and mint counters included). Failed or unchanged actions create no history. Cancel restores the state at open; Done confirms the current valid state.
- **Header:** the run header never has an Edit Deck button, in any mode (`tests/deck-editor.test.mjs`); the door is the Armoury, or the Rest screen under `restOnly`. Live counter "N / min–max", red with the refusal sentence out of bounds; beside it a compact cost-curve histogram.
- **Filters and sort:** filter chips for type, cost, source (basic / weapon art / technique / reward / item-owned) and upgraded; sort chips for cost, name, type, source.
- **Every drag has two twins.** A tap on a tile or row inspects without changing the run. The inspector carries explicit Add to deck and Remove from deck; rows carry ＋ and －. Reordering is a handle drag or ▲/▼.
- **Gamepad:** D-pad moves grid focus; LB/RB switch panes (phone: list ↔ Draw order); A inspects or activates the focused Add/Remove; X picks up the focused deck row, D-pad moves it, X or A drops; Y cycles filters; B cancels; Start confirms (§7.3).
- **Target size:** every target ≥ 48 CSS px on a coarse pointer, ≥ 44 px otherwise; text ≥ 11 px at 360×640 (FINISH §8).
- Not adopted: crafting/dusting inside the editor, and auto-fill "complete my deck" (v1).

### 14.2 The shop kinds

Only Core ships; non-Core runs and saves are refused at load. Core's shop is the configured shop (`gameProfileShopStock`, `mountConfiguredShop`).
- A share of shop nodes is a Blacksmith (§14.4), decided from the run seed and the node (`configuredShopKind`); the rest sell the configured offer.
- The kind rides the persisted stock as `stock.kind`; a stock of a kind this build lacks is refused by name at load.
- `content/source/shops.json` authors the kind tables Core's validation reads (the Blacksmith's offerings); its market and master tables are kept only so existing validation and Settings rows resolve.
- All prices are in cinders unless stated, and all are data.

### 14.3 The market (usual shop)

Core's shop keeps: `gameProfileShopSales`, `shopOfferPrice`, `balance.shop.sellFraction` (sell price of an owned relic, flask or armament), the `shopSell` setting, `applyShopPriceMult` (a custom run's price multiplier) and `armamentTrading`'s sale. The [class-book rewards contract](docs/CLASS-BOOK-REWARDS-CONTRACT.md) does not depend on a market shelf.

### 14.4 The blacksmith

**What-changed receipt** (owner, 2026-10-31). Every committed Blacksmith purchase (armament, weapon art, tier upgrade, card upgrade, rank-up, stones, refine, sigil work) ends in a page-locked **What changed** receipt, opened after the screen redraws.
- Shows the run's before/after (`model/runChangeReceipt.js`): stat and resource deltas, card faces before and after, the armament's tier stat rows (`coreSmithingStats`), and a strip of cinders and stones spent. One Continue button closes it.
- A refusal keeps the inline `.bs-refusal` and opens nothing; a commit that changes nothing opens nothing.

**The Core Blacksmith** (owner, 2026-10-31). Core (`progression.cardRanks`) lays out a fixed workshop: `upgrade`, `upgradeArt` (card upgrade, §13.4s), `rankUp`, `armaments`, `weaponArts`; every other offering stays withheld (`blacksmithWithholds`), and an old saved stock that lists one is not drawn. About 25% of Core shop nodes are one (`shops.blacksmithChance`). Numbers are the profile's `shops.blacksmith` block (`games/ashenspire/packs/core/shops.json`). Every service is a plan/commit pair on the stock's `tradeRevision`; a stale quote is refused by name and one quote commits once; stock and prices persist across a reload.

| Offering | What it does | Reuses |
|---|---|---|
| `armaments` | Armament shelf (own stock key) | §12.2 transactions |
| `weaponArts` | Weapon arts for sale | Core `rewards.eligibility.weaponArts` list; each weapon's `learnableArts` |
| `rankUp` | Raise an owned card's `rank` by 1 | `blacksmithStock`, `rankUpPlan` / `commitRankUp` |
| `upgrade` | Item tier upgrade | `smithingPlan` / `commitItemUpgrade` |
| `upgradeArt` | Card upgrade of any deck card (§13.4s) | `cardUpgradeService` |

It is a screen of its own, reusing `SmithSelectionModel` and the smith modals.

- **Tier reach.** Equipment up to the ladder's top, tier 3; a rest-site Smith stops at tier 2 (`restSmithMaxTier`; §4).
- **Stones.** `stoneDiscount` (1) comes off every stone price, never below 0: tiers 1, 2, 3 cost 0, 1, 2 stones; a card upgrade costs 0 stones; `rankUp` costs `rankUpStones` (1).
- **Cinders.** Every service costs cinders, scaled by a custom run's shop price multiplier, rounding up. A rest site's Smith stays free.

| Service | Price key | Cinders |
|---|---|---|
| Tier upgrade (tier 1 / 2 / 3) | `prices.tierUpgrade` | 60 / 100 / 150 |
| Card upgrade | `prices.cardUpgrade` | 40 |
| Rank-up | `prices.rankUp` | 120 |

- **Rank-up.** Raises one run-owned card's `rank` by 1 (not an equipment-bound or granted card; never past rank 99).
- **Armaments.** The rack is `armamentStock` (6) distinct pieces drawn on `shopOffers` from the Core weapon pool the run does not carry.
  - Each is rolled at a tier from `tierWeights` (`{0: 20, 1: 40, 2: 30, 3: 10}`, capped at the piece's ladder top) and priced over the `priceTable.armament` row of its rarity × `tierPriceMult` (`[1, 1.4, 1.8, 2.3]`), rounded.
  - Stock entry `{ id, cost, tier }` (cost scaled once by the shop price multiplier when the visit opens).
  - Buying adds it to storage and, when tier > 0, writes `run.itemUpgradeLevels[armament/<id>] = tier`, never lowering a tier the run holds. The tile reads "Sold at tier N"; a piece the run carries is refused.
- **Weapon arts.** `weaponArts` sells the learnable arts of carried weapons not owned or granted (owner, 2026-11-05) at a price from `priceTable.weaponArt`, into the sideboard (`shop-art:<n>:<cardId>`); the shelf is not restocked.

### 14.5 The wise master

Not in the game: the wise master, its shop kind and `trainingPool` training/respec have no Core door. Class mastery and skills belong to the class-mastery lane. (`trainingPool` stays in the run shape, default `0`.)

### 14.6 Build order

Retired: the original seven-step delivery plan is complete or removed with the legacy shops. See the history file.

### 14.7 Deck-editor research

Surveyed deck builders and roguelikes; the adopted patterns are the rules of §14.1. Details in the history file.

#### Notes and history
- Core's shop is the configured shop; the legacy market and wise master are gone (§14.3, §14.5).
- Deck Settings rows are profile settings read live, not run-snapshotted.
- Legacy and Current basic-slot rules in §14.1 remain in code for non-Core profiles.

Full history: [docs/spec-history/14-statpools-shops.md](docs/spec-history/14-statpools-shops.md).

## 15. Reward schedule, levelling pace, crafting drops and legendary sigils

Governs when card rewards come and how often, the levelling curve and its preview and cap, armament, smithing-stone and refined-stone drops, and legendary sigils. Rewards are the configured door (`gameProfileRewards`, `rewardTransaction`, `rewardplan`); `reward.js` draws only the Victory receipt and the card rank-up chooser. Old saves carrying `run.pendingReward` or `run.deferredProgression` still load and validate (`engine/save.js`); nothing writes them. Where a rule below describes the removed legacy reward door (its pending-reward rows and the schedule it consumed), it is historical, not the live Core contract.

Rules from §14's preamble apply:
- Every number is a `balance.*` leaf with a `[NOTE]`, so its `gameConfig.*` Settings row is generated and frozen per run (`advancedConfigRows`, `run.advancedConfigSnapshot`).
- Shipped defaults reproduce earlier behaviour, so an existing seed rolls what it rolled before.
- New run state is additive, with a schema bump and a captured corpus save per PR.
- Every new percentage chance (`cardRewards.chancePct.*`, `equipment.drops.chance.normal`, `smithing.rewardChancePct.*`, `sigils.dropChancePct.*`) has an explicit 0-100 `BALANCE_DOMAINS` entry in `model/advancedConfig.js` (`leafRows` otherwise derives the range from the shipped value). `maxLevelsPerFight` gets 0-20.

"Runes" are named **sigils** here (§14.3).

### 15.1 The card reward schedule

Controls whether, when and how often a fight offers cards. Keys live in `balance.rewards.cardRewards`.

| Key | Default | Meaning |
|---|---|---|
| `afterCombat.normal` / `.elite` / `.boss` | `true` | A won fight of that pool offers a card row. |
| `chancePct.normal` / `.elite` / `.boss` | `10` | Chance 0-100 that an eligible fight offers the card row. 100 rolls nothing. |
| `onLevelUp` | `true` | A fight that raised the character level (§13.4i) adds a **level card** row. |
| `onLevelUpMaxPerFight` | `1` | Most level-card rows one fight adds, however many levels it gained. |

- **Offer size** is `rewards.cardChoices`.
  - Core 2 combat door: a random 3 to 5 choices (`combatOfferCount` in the core pack's `rewards.json`), rolled once on `cardRewards` when the offer is first made (owner, 2026-11-05).
  - `offerCount` (3) sizes chests, level cards and the shop's fallback; a settings `offerCount` other than `combatOfferCount.appliesAtOfferCount` overrides the range.
  - The Feral Eye relic adds +1 at elites.
- **Chance rolls.** Use the stream **`rewardRolls`**, appended to the end of `STREAM_NAMES`. A failed roll leaves no card row; the menu says "No card this time."
- **Level card row.**
  - Cards come from the class reward pool at the door's rarity odds via `rollCardRewardIds` on `cardRewards`.
  - `REWARD_KIND_ORDER` kind `levelCard`, after `card` and `levelChoice`; row key `levelCard:<ordinal>`; taken and skipped like the card offer.
  - Each row's pick persists in `pendingReward.chosenDraftCardIds[<rowKey>]` (not the single `chosenCardId`, which stays the `card` row's).
  - `validateRunShape` treats an absent map as `{}`, so a Taken level-card row with no pick is refused by name.
  - A save written before this section has no level-card rows and needs no migration.
  - A saved `pendingReward` written before this section reads as "card row as rolled".
- **October 3 owner defaults** (solo reward door; replaced where §13.4o says so).
  - Solo combat rolls its card independently of skill/class drafts.
  - Every non-class skill level queues a guaranteed card draft (class pool with the skill's rarity gate if its schools have no eligible cards); per-door draft limits still queue excess drafts.
  - `balance.rewards.sourceBonuses` gives independent chances: `combatFeatChancePct` 5, `classFeatChancePct` 100, `classCardChancePct` 25.
  - Each class level keeps its class-tree upgrade plus the guaranteed feat and a separate technique-card roll.
  - Bonuses are checkpointed in `levelChoices`/`levelCards` with `source: combat|class`; class rows carry `skillId` and `claimOrdinal` and unlock only after their class level is claimed.
  - `classRewardLevels` records issued class-level bonuses, including levels claimed outside combat.
  - Character-level reward switches do not remove class technique cards.
- **Consumers.** `main.js onCombatEnd` and `tools/simrun.mjs` read the schedule through `cardRewardPlan(balance, { pool, levelsGained }, rng)` in `model/rewardplan.js`.

#### Core 2 offer weighting

| Rule | Value |
|---|---|
| Stance coverage (Core, owner 2026-10-19) | Each card offer reserves `stanceCoverage.reservedSlots` (1) slot for a basic or cantrip card of a basic stance the character owns no card of (deck plus collection), drawn on `cardRewards`. Once every stance is owned, or none has such a card, offers roll as before. A missing stance is weighed by the sum of its cards' weights, so every eligible card is equally likely. (`reward-ranks` module, `src/model/stanceCoverage.js`, `tests/stance-coverage-rewards.test.mjs`) |
| Card pick weight | tag weight (product of the card's matching `tagWeights`, else `default`) x `ownedCopyWeight`^(copies owned, deck plus sideboard) x `offeredCopyWeight`^`timesOffered` x `typeWeights[type]` x recent-offer x depth bias. One `rng.float` on the offer's stream; when all weights are equal the draw is the plain `rng.pick`. |
| `tagWeights` | casting 1, `maneuver:smash/counter/sweep` 1.5, default 1.5 |
| `ownedCopyWeight` | 0.05 |
| `offeredCopyWeight` | 0.25 (range 0..1; Core 1 pinned to 1); applies to every card pick, including the reserved stance-coverage slot |
| `typeWeights` | attack 1, skill 2, power 2 (absent = 1; no guaranteed slot) |
| Recent offers | a card shown on one of the last `recentOfferWindow` (3) reward screens x `recentOfferWeight` 0.1; screens read from `run.gameProfileRewardOffers` (no save field) |
| `depthBias` by `run.floor` (the reward's node) | depth 1-3: basic or cantrip cards x1.8 (basic = named by a `cardPools` entry outside `special`; cantrip = tagged `rank.cantrip`), cards with `manaCost` > 0 x0.4. Depth 4+: mana cards x1.8, rank 2+ cards x1.5. |
| Relics | `eligibility.relics.weights` (Brimming Gourd 20, default 1) |
| Potions | a potion already in the belt (`run.flasks`) is offered at `ownedPotionWeight` (Core 0.05; Core 1 pinned to 1)^(copies held), one `rng.float`; a lower chance, not a skip; applies to combat rewards, chests and shops (`weightedPotionPick`, `tests/reward-potion-weights.test.mjs`). With nothing held the draw is the plain `rng.pick`. |
| Owned items | Owned cards weigh by `ownedCopyWeight` in every offer, shops and chests included; owned weapons, relics and armour are excluded outright. |
| Offer history | `run.rewardOfferHistory = { cards: { [cardId]: timesOffered } }`, bumped once per card when a combat, chest or shop offer is first created (offers cache per offerId, so a reload never counts twice); saved with the run (absent = empty). A shown-and-skipped card returns at lower chance, never a forced skip; a taken card stays under `ownedCopyWeight`. Shop card stock uses the same pick. With empty history or weight 1 the draw is the old uniform `rng.pick`. |
| Shop prices | Each Core 2 shop offer rolls its price once with `rng.int('shop', min, max)` from `shops.priceTable` by kind and rarity (e.g. common card 34-41, rare relic 203-225 cinders) and keeps it in the saved stock; an older save falls back to the single stock `price`. Legacy rewards and the legacy merchant are unchanged. |

Core 1 pins the card, potion and offer weights neutral (`tests/core-reward-mix.test.mjs`, `tests/reward-card-weights.test.mjs`).

#### Core 2 reward mix (owner, 2026-10-27)

Combat `rewardGroups` (`packs/core/rewards.json`); elites and bosses roll the same table. From 2026-11-14 (owner brief) every won fight offers a card choice: the door's 3–5 options are all cards or weapon arts, take one. Potions, weapons and armor come from chests and shops. The 2026-10-27 weights stay in the second column for runs pinned to them.

| Group | Weight | Until 2026-11-14 |
|---|---|---|
| Cards | 96 | 66 |
| Weapon arts | 4 | 4 (cards + arts = 70) |
| Potions | 0 | 18 |
| Flask relic | 0 | 2 (potions share = 20; `eligibility.relics.combatIds` admits only `brimmingGourd` among combat relics) |
| Weapons | 0 | 10 |
| Armor and every other relic | retired from combat rewards (the shop fills its own shelves per category) | the same |

- **Elite spoils** (`rewards.eliteRelic: { choices: 2 }`): after an elite's card door, a second door titled "Elite spoils" offers two distinct unowned relics from `eligibility.relics.allow`; take one. It is its own offer (`<combat offer id>:elite`, source `elite`), saved like any other, shown before level offers, and skipped when no allowed relic is left. A profile without the key has no elite relic.
- **Allowed relics** (`eligibility.relics.allow`, 28 ids): new offers from every source (elite, chest, shop) draw only from this list, the relics traced to have a working effect under Core 2 (Strength, Bleed-burst, legacy-passive and missing-tag relics are left out until they are reworked). A claim still accepts any relic, so an offer or shop shelf saved earlier stays claimable. The Brimming Gourd's weight among them is 1 (was 20, when it was the only combat relic).
- **Playable cards only** (`eligibility.playableOnly`): a new card or weapon-art offer never holds a card with a mana cost for a class whose base Mana is 0 (`stats.poolBasesByClass`, the Reaver), nor one whose mana cost exceeds the run's max Mana. Claims are not filtered.

- **Treasure chests** roll `source: 'treasure'` against `treasureRewardGroups`: cards and weapon arts 60, weapons, armor and relics 10, potions 30. A chest still offers relics, armor and weapons (`tests/core-reward-mix.test.mjs`).
- **Weapon arts.** A reward screen never offers an owned art (`eligibility.weaponArts.skipOwned`). The pool is the learnable arts of carried weapons the player does not own; `skipOwned` also applies to shops and the Blacksmith shelf; an art stocked in the visited shop or shown on the open reward door is not offered by the other (owner, 2026-11-05).

#### Elemental cantrip families (owner, 2026-11-01)

Each element has 3-5 Core cantrips. A family card is `colorless`, `rank.cantrip`, `camp:spell`, `source:spell`, 1 SP and 0 MP, carries one registered `school:` tag the weakness system reads, has an `upgrade` block, a face of 1-3 lines of at most 5 words with no tag effects written on it, and is offered as a Core reward like `core.frostNip`. Only existing ops and statuses are used; a role needing a missing rule is approximated with the nearest existing effect.

| Element | `school:` tag | Cards |
|---|---|---|
| Fire | `fire` | `core.cinderDart`, `core.emberFlick`, `core.dazzleFlare`, `core.palmFlame`, `core.cinderWard` |
| Frost | `frost` | `core.frostNip`, `core.rimeBite`, `core.brittleTouch` |
| Healing | `divine` | `core.mendingTouch`, `core.steadyHands`, `core.guidingWhisper`, `core.hallowedWard`, `core.dawnFlame` |
| Rot | `decay` | `core.venomSpray`, `core.graveToll`, `core.wearyingTouch`, `core.rendingHex`, `core.acidSplash` |
| Lightning | `lightning` | `core.jolt`, `core.shockingGrasp`, `core.stormLash` (authored with today's effects; gain Lightning tag behaviour when feature/ElementsLightning merges, where Spark is built) |

Healing cantrips that heal are not unlimited-copy for the Magic Adept: `core.steadyHands` joins `core.mendingTouch` in the graduate rule's `excludeCards` (2026-10-28 ruling).

*Falsify:*
- `afterCombat.normal: false`: a normal win offers no card row; an elite win still does.
- `chancePct.elite: 0`: an elite win never offers one. At 100, the `rewardRolls` counter does not move.
- `onLevelUp: true`: a fight that levels offers exactly one `levelCard` row; one that doesn't offers none.
- `onLevelUpMaxPerFight: 2`: a two-level fight offers `levelCard:0` and `levelCard:1`; taking both and reloading restores both picks.
- Every key at default: 50 fixed seeds offer byte-identical rewards to before this section.

### 15.2 Levelling pace you can see

Shows the configured levelling pace in Settings and optionally caps levels per fight. The curve is the base-200 x1.5 exponential `balance.level.xp` (`src/content/balance.js`), tabulated in §13.4o. `gameConfig.progression.xpMultiplier` scales each award (`configuredContentBundle` rounds the multiplied awards into the configured registries). `levelUpValue` **replaces** `pointsPerLevel` as the points per level. This section changes no curve or award number; the owner retunes them in Settings.

- **Levelling preview.** Settings -> Progression, `ui/models/LevelPacePreviewModel.js`, drawn live from the configured registries (`xpMultiplier` counted once, where `configuredContentBundle` applies it) and `levelUpValue`. It shows:
  - XP to reach each of levels 2-20;
  - "a normal fight (3 kills) gives N XP", and the same for an elite and a boss, with how many levels each is worth from level 1 and from level 10;
  - the stat points those levels grant.

  Numbers come from `levelPace(configuredRegistries, { pointsPerLevel })` in `model/levelup.js`, which `awardLevelXp` also uses, so preview and play cannot disagree.
- **Levelling cap.** `balance.level.maxLevelsPerFight`, default `0` = no cap (generated Settings row). Above 0, one award never raises the level by more than this and XP past the cap is **discarded**: `xp` is left at `xpToNext - 1` at most, so the progress bar never shows XP above the step. `validate.js`'s `balance.level` allowlist gains the key.

*Falsify:*
- The preview's "normal fight" line equals `combatLevelXp` on the configured registries for three normal kills, with `xpMultiplier: 2` counted exactly once.
- Its levels-gained figure equals what `awardLevelXp` awards from level 1.
- `maxLevelsPerFight: 1`: a boss kill from level 1 gains exactly one level and leaves `xp < xpToNext`. At 0 it gains 13.

### 15.3 Armament, equipment and crafting drops

Chances per reward pool; defaults reproduce today's drops.

| Drop | Key | Default | Rule |
|---|---|---|---|
| Armament | `balance.equipment.drops.chance` | `normal` 0, treasure 60, elite 30, boss 100 | `drops.rarityWeights` gains a `normal` row (copy of `elite`'s). Rolls on the `armaments` stream via `rollArmamentDrop`; a chance of 0 returns before any draw. |
| Smithing stone | `balance.smithing.rewardChancePct` `{ normal, elite, boss, treasure }` | all `100` | Paid when `rewardByPool[pool] > 0` and the chance passes, on the `smith` stream; 100 rolls nothing. The caller passes the RNG into `grantSmithingReward`. The claim is recorded in `smithingRewardClaims` pass or fail, so a retried door never rolls again. Treasure calls `grantSmithingReward` only when `rewardByPool.treasure` or `refinedRewardByPool.treasure` is above 0 (both ship 0, so treasure writes no claim and saves are unchanged). |
| Refined stone | `balance.smithing.refinedRewardByPool` `{ normal, elite, boss, treasure }` | all `0` | Pays `run.smithingStonesRefined` (§14.4) through the same door and chance. Spending arrives with §14.4's blacksmith (`refine.value`); §15 adds no second value key and no spending. The `smithingStone` reward row shows when the stone or refined amount is above 0 and names both. |

- **Armour does not drop.** `rollArmamentDrop` draws from `equipment.armaments` (weapons, shields, staves from weapons.csv). Armour (outfits.csv) has no run inventory; an armour drop needs one first and is a follow-up.

*Falsify:*
- Defaults: a seed's armament and stone drops are unchanged.
- `drops.chance.normal: 100`: every normal win drops an armament while one remains unfound.
- `rewardChancePct.elite: 0`: an elite pays no stone. At 100, the `smith` counter does not move.
- A refined stone reward pays and survives a reload.

### 15.4 Legendary sigils — unique properties through the tag system

A **legendary sigil** is a §14.3 sigil at a new rarity whose effect is a property rule; no engine code is written per sigil. It works only while **attuned**, is never shop stock, and drops only from rewards.

- **Rarities.** `SIGIL_RARITIES = ['common', 'uncommon', 'rare', 'legendary']` in `model/schemas.js`. Relic rarities are unchanged; `balance.js`'s note becomes "no legendary relic or card".
- **Amends §14.3.**
  - A sigil is authored as §14.3's `{ id, name, rarity, blurb, cost }` (works only while slotted) or, for `legendary` only, `{ id, name, rarity, blurb }` (works only while attuned).
  - A sigil's property is not authored on it: `tagging.csv`'s `family = sigil` row is the one home of the tag and `stampTags` derives `propertyTags` from it. `validateContent` refuses any sigil with `triggers`/`modifiers` by name.
  - A legendary has no `cost` and is never shop stock: §14.3's market `sigils` shelf and any blacksmith sigil stock draw only non-legendaries (§14.4 sells none).
- **Content.**
  - Each sigil's property node is a leaf in `content/source/nodes.csv` under a new `sigil` branch of `property`.
  - Its `family = sigil` row is in `tagging.csv`; the family is registered in `tagFamilies.csv`; `familyNodes.csv` gains `sigil,property` and `sigil,classification`; `nodes.csv` gains leaf `classification.sigil`; every sigil carries exactly one `classification.sigil` tagging row.
  - Its rule is in `nodeEffects.json`, variables declared in `nodeVariables.csv` and bound by `variableBindings.csv` to `balance.sigils.*`.
  - `validateContent` refuses, by name: a sigil that derives no property tag; a legendary that does not derive exactly one; a tag that is not a leaf under `sigil` with a `nodeEffects` entry (the `sigil` branch node has no rule and is not a valid tag).
  - The shipped set is at least three legendaries, each an `on`/`if` combination no relic uses, built from existing `EVENTS`.
- **Ownership.** `run.sigils: string[]` (§14.3). An attuned sigil stays in `run.sigils`; `run.attunedSigils` names a subset. §14.4's slots hold non-legendaries; a legendary is attuned, never slotted.

| Key | Meaning |
|---|---|
| `balance.sigils.attuneMax` (default 1) | Whole number from 0 (0 = nothing attunable). Most sigils attuned at once. |
| `balance.sigils.dropChancePct.normal` / `.elite` / `.boss` / `.treasure` (default 0) | Whole numbers 0-100, each with an explicit 0-100 `BALANCE_DOMAINS` entry. Shipped off; the owner enables them in Settings. |

Each carries a `[NOTE]`, so it gets a generated `gameConfig.balance.sigils.*` row and is frozen per run. `validateContent` refuses any other value by name.

#### Rarity at every door

Every persisted position holding a sigil id is in exactly one class; the lists are exhaustive.

| Class | Positions |
|---|---|
| Legendary only | `run.attunedSigils`; `combatEntered.snapshot.attunedSigils`; `pendingReward.rewards.sigilId` |
| Never legendary | `run.sigilSlots`; `combatEntered.snapshot.sigilSlots`; `run.shopStock.sigils`; an atlas point's `journey.serviceStates[pointId].stock.sigils` |
| Either | `run.sigils` (the inventory) |

- `run.attunedSigils` holds no more than the run's `attuneMax`.
- The `engine/save.js` load door checks both restricted classes via `sigilRarityProblems(registries, run)` in `model/sigils.js`. Each violation is refused by name and the save archived like any malformed reference.
- `sigilPurchasePlan` also refuses a legendary by name.
- A persisted sigil-id position added later must be assigned a class in the same PR.

#### Attunement and the model pair

- The player attunes in the **Armoury's Sigils panel**, out of combat only. `MOUNTABLE_KINDS` gains `sigil`; `syncSigilProperties` mounts each attuned sigil's property under `sigil:<id>` as `syncRelicProperties` does for relics.
- `attuneSigil(registries, run, id)` and `unattuneSigil(run, id)` in `model/sigils.js` return `{ ok, reason }` (one sentence from `uiStrings.csv`) and change the run only when `ok`. Neither draws randomness nor needs an equipped armament.
  - `attuneSigil` refuses: an id the registries do not hold or `run.sigils` does not carry; a non-legendary; one already attuned; an attune that would exceed `attuneMax`.
  - `unattuneSigil` refuses an id that is not attuned.

#### The field and schema

- `run.attunedSigils: string[]`: distinct ids, each also in `run.sigils`. `validateRunShape` is registry-free and refuses by name: a non-list; an id that is not a non-empty string; a duplicate; an id not in `run.sigils`.
- Both restore doors refuse by name an attuned id that is not legendary and a list longer than `attuneMax`, read from the run's frozen `advancedConfigSnapshot` override (`gameConfig.balance.sigils.attuneMax`), else the bundle default. An unknown id is refused through `unknownSigilId`. A legendary in `run.sigilSlots` is refused at the same doors (only a hand edit can put it there).
- Schema 18 -> 19: `attunedSigils` is a required `RUN_SHAPE` row; `migrateRunSchema` fills `[]` for v18-or-older saves and leaves `run.sigils` untouched; one captured schema-19 save is appended to the corpus, no existing entry edited.

#### Mounting and combat

- `sigilCarrier(registries, id, ownerKey)` returns `{ kind: 'sigil', id, instanceId: id, ownerKey, tagIds: propertyTags }` for a legendary, else null.
- `syncSigilProperties(combat, entity, attunedSigils?)` mounts each unmounted carrier (attunement never changes mid-fight, so it only adds). The mount has no `heldBy`, so `syncLoadoutProperties` never unmounts it; a `sigil:<id>` key never meets a slotted sigil's.
- `combat.attunedSigils: string[]`: `createCombat` copies it, `createRunCombat` takes it from `run.attunedSigils`; the snapshot serializes it. `combatSnapshotProblems` refuses a non-list or non-distinct or empty ids; `combatSnapshotReferenceProblems` refuses an unknown id and a non-legendary.
- The load door refuses by name a fight in progress whose `attunedSigils` (absent = `[]`) differs from `run.attunedSigils`; the save is archived. A snapshot without the field restores with `[]` and mounts none.

#### The drop

- Offer field `rewards.sigilId` (a sigil id, or absent). Reward kind `sigil`, after `relic`; stream **`sigils`**, appended to the end of `STREAM_NAMES`.
  - Taking the row appends the id to `run.sigils`, unattuned; taking an owned id adds nothing.
  - The load door refuses a `sigilId` that is unknown (`pendingRewardReferenceProblems`) or not legendary.
- **Pool:** legendaries the run does not own (owning covers `run.sigils`, every `run.sigilSlots` entry and `run.attunedSigils`), in authored order.
- **Not live yet:** the configured door does not roll sigils. `rollSigilDrop` (`model/sigils.js`) and the `dropChancePct.*` keys exist, but no door calls the function or sets `rewards.sigilId`. The rules below are the model-level contract.
- `rollSigilDrop` reads the door pool's chance:
  - chance 0 or an empty pool: none, no draw;
  - chance 100: no chance draw;
  - otherwise one `rng.chance('sigils', pct)` (a miss returns none), then one `rng.pick('sigils', pool)`.
- Intended placement, once a door calls it, per pool: a won normal or elite fight, a boss whose reward menu opens, a treasure room. The run's last boss rolls none (`finishRun(true)` runs before any reward is built).
- With all four chances 0, the `sigils` counter never moves; no other stream moves at any setting.

#### The Armoury's Sigils panel

`.armoury-sigils` in the Inventory view, below the item collection, shown while the run owns a legendary sigil.
- Shows "N / attuneMax attuned" and one row per owned legendary, in `run.sigils` order: name, blurb, rule sentence (`nodeTerms.csv`), attuned state.
- Out of combat each row has **Attune** or **Unattune**; a refusal shows as text in the panel. In combat rows show and no button is drawn.
- Buttons are at least 48 CSS px on a coarse pointer, 44 px otherwise.

*Falsify:*
- A sigil with a tag that is not a property node is refused by name.
- An attuned sigil's trigger fires in a fight; an unattuned owned sigil's does not.
- Attuning a second sigil while `attuneMax` is 1 is refused by name.
- A DOM test opens the Sigils panel, taps **Attune** on an owned legendary, sees it listed and in `run.attunedSigils`, taps **Unattune**, sees it removed; buttons are absent in combat.
- Market and blacksmith stock over 200 seeds never offers a legendary.
- Defaults: no sigil drops and no stream counter moves. Model level (`rollSigilDrop`) only: with `dropChancePct.boss: 100` a boss-pool roll returns one unowned legendary, never a duplicate.
- A save at §14's last schema loads with `attunedSigils: []` and `sigils` untouched.

### 15.5 Build order

Each item was one PR into `dev`, test-first, with a receipt and no built HTML:
1. This SPEC section.
2. Card reward schedule (§15.1).
3. Levelling preview and cap (§15.2).
4. Crafting drops (§15.3); the refined-stone field is `smithingStonesRefined`, the name §14 migrates.
5. Legendary sigils (§15.4), after §14 step 5 (which adds `sigils` and `sigilSlots`); adds only `attunedSigils`, one schema bump.

#### Notes and history

- Sigil drops are model-only; no door rolls them yet.

Full history: [docs/spec-history/15-rewards-profile.md](docs/spec-history/15-rewards-profile.md).

## 16. Versioned JSON game profile

Describes the configured Ashen profile branch. It does not change legacy game rules or reinterpret earlier sections as JSON-backed. Author entry: `games/ashenspire/game.json`; the `ashen.core@1.0.0` bundle selects a four-class run with cards, HP/SP/MP, fixed class loadouts, configured combat, routes, rests, shops and rewards. `games/ashenspire/presets/current.json` selects the original legacy behavior.

### Module resolution

- Entry shape: `{ "formatVersion": 1, "core": "ashen.core@1.0.0", "modules": {} }`.
- A missing module the bundle includes inherits its selection and settings; a missing non-bundled module is off.
  - `false` disables; `true` uses resolved bundle/default settings.
  - An object recursively overrides them; arrays replace the inherited array.
- Resolver schemas reject unknown properties, invalid IDs and unsupported configured modules or instances. Tags, cards and content references do not implicitly enable modules.

### Classes and start

| Class | Start | Selectable |
|---|---|---|
| Reaver | STR 2 | initially |
| Starseer | INT 2 | after a unique terminal full-run win or defeat |
| Rogue | DEX 2 | next unlock, in order |
| Herald | WIS 2 | last unlock |

- Each class has six starting attribute points; every other attribute is 1. Each has a fixed loadout and an eleven-card starter holding at least one Smash, one Sweep and two cards of its own class (owner brief, 2026-11-14; before that ten cards, and the Reaver held four Strike, four Defend and one Counter). The worn weapon's art (owner 2026-11-01, replacing the class special) and any gear-granted card count toward the eleven.
- Class lists are authored per class (`starterDeck.classDecks`), and every starter card is playable with the class's starting weapon and pools (`tests/core-starting-decks.test.mjs`):
  - Reaver: 2 Strike, 3 Defend, Counter, Smash, Sweep, Ironbreaker, Rallying Roar, and Sundering Hew from the greatsword. Ironbreaker and Rallying Roar cost 2 SP and no MP (were 1 SP and 1 MP; a Reaver's base Mana is 0).
  - Rogue: 2 Strike, 2 Defend, Counter, Evade, Smash, Sweep, Feint, Venomed Edge, and Twin Fang.
  - Starseer: 2 Arcane Spark, Star Spark, Astral Bolt, 3 Ethereal, Smash, Sweep, and Mana Surge and Blight Touch from the sceptre.
  - Herald: 2 Resource Echo, 2 Ethereal, Exhaust, Smash, Sweep, Smite, Sanctified Ward, and Mana Surge and Blight Touch.
- Opening hand: 4 + INT.
- Unified damage, Block then Poise, and the seven directed stance advantages in `docs/ai/json-game-modules/CORE-SPEC.md`.

### Routes, rests and runs

- Three deterministic acts, nine pre-boss depths, one boss per branch per act (§6).
- A rest visit commits exactly one of Strategize, Smith or Level Up.
  - Spending earned attribute points is no longer rest-only (owner 2026-10-27, §17).
  - Strategize is the only manual deck-editing service.
  - The chosen service restores full HP, SP, MP and both healing and MP flask pools.
- Equipment editing has an independent policy. Shop and reward content comes from the selected core pack.
- Each new run snapshots its resolved profile, runtime artifacts and hash.
  - Save schema v25 preserves that pin; a profile/runtime mismatch refuses to load without overwriting the stored save.
  - Editing game.json or rebuilding the current lock affects new runs only, with no hot-unload or migration of an existing run.
  - Any future save migration needs a separately tested, explicit atomic procedure.

### Status

- The JSON resolver, host adapter and author CLI are implemented in slices on the feature branch. Export requires `ashen.legacy-adapter@1`; it is not a portable rules VM or complete engine-neutral gameplay package. The legacy preset stays the compatibility path. Full browser acceptance is in progress.
- Numeric balance settings called provisional in the core product specification or `games/ashenspire/packs/core/provisionalPolicies.json` remain provisional even though working JSON supplies values; they are not additional permanent product approvals.
- Usage and checks: `games/ashenspire/guide.md`. Product rules and unresolved choices: `docs/ai/json-game-modules/CORE-SPEC.md`. Status and next acceptance work: `docs/ai/json-game-modules/README.md` and `CONTINUE.md`.

#### Notes and history

- Feature-branch status; browser acceptance in progress.

Full history: [docs/spec-history/15-rewards-profile.md](docs/spec-history/15-rewards-profile.md).

## 17. FixCore combat rules (new core rules version)

Rules for new runs on **`ashen.core@2.0.0`**, the FixCore rules version 1 profile ("Core 2"). They override earlier combat rules for those runs only (see Migration boundary). Behavior spec; implementation is separate and not claimed complete.

- Normative companions: the [FixCore design document](docs/design/FixCore-complete.md) (requirements, defaults, architecture contracts, behavior, falsification criteria; its snippets and method names are proposals, not shipped code) and the owner rulings in `docs/FIXCORE-DECISIONS.md`.
- [RangeAdvance contract](docs/design/RangeAdvance.md) (optional engagement, Advance, Throw, concise cards): normative amendment for Core; its compatibility boundary supersedes the no-migration rule only for the new range policy.

### Range

- **Persistence.** Once a player or enemy has paid an Advance, the pair stays at the closed distance; later actions against that opponent pay no Advance until the distance grows again. Committed in saved engagement state; enemy forecasts project it.
- **Enemy retreat.** A one-band retreat card (`moveEngagement`, `bands: 1`) costs its authored SP (Advance price + 1; 2 SP at defaults). Core enemies that start at Reach or beyond own one, plan it only while engaged closer than their starting range, and never twice in a row. See [RangeAdvance](docs/design/RangeAdvance.md).
- **Maximum range is Reach.** `range.maxRange` (`content/source/fixCoreMechanics.json`, authored `"reach"`) is snapshotted into the run and each fight.
  - A fight never stores an engagement band past the cap: starting bands (shortbow wearer, enemy that starts Ranged) are capped; a Retreat at the cap is a no-op; an enemy never plans a retreat past it.
  - Cards authored `ranged` keep their data and read as Reach on the card face, deck editor and upgrade preview; an upgrade never offers Reach to Ranged.
  - A policy with no `maxRange` (run or save from before the cap) keeps all three bands and replays unchanged.

**Spells are Reach by default (owner, 2026-11-06; recorded 2026-11-07).** In Core 2 a
spell-camp card or move, a projectile or a ranged maneuver is Reach unless tagged
`range:melee`; every other card or move is Melee. *Falsify:* an untagged spell-camp card
reads as Reach on its face and in the range check, and the same card tagged `range:melee`
reads as Melee.

### Damage, Block, Poise and statuses

All combat values are floored whole numbers. The attacker's chain (Vulnerable, stance) floors once to the **incoming damage**; Block and the physical/magic split use it; Poise or Ward mitigation floors once more.

| Rule | Value |
|---|---|
| Poise absorb | while Poise > 0, damage d becomes floor(d × 0.75) (active Poise reduces damage taken by 25%) |
| Poise cost | Poise loses d − floor(d × 0.75), capped at the Poise held, plus any extra Poise damage the card or trigger carries; hit reports "Poise absorbed N" |
| Weak | −25% AR; potency fixed while active, added stacks extend duration (default) |
| Vulnerable | +25% incoming damage (multiplier 1.25, every profile); potency fixed while active, added stacks extend duration (default) |
| Enemy STR, CON, DEX | authored `attributeOffset` −2 after gear and relics, floored at 0 |
| Boss SP | tuned through stats to at most 3 per turn |


**Order.** Physical part: Block, then Barrier and Poise. Magic part: Poise first. *Superseded for new Core 2 fights (owner 2026-11-07, backlog #7): one damage kind; see §17, One damage kind in Core 2.*
- **Magic hits Poise first:** the magic part meets Poise 1:1 (Poise loses up to the whole magic amount); only what Poise cannot cover meets the Block left after the physical part, then Barrier, then HP, with no further Poise absorb.
- A mixed hit (meleeSpell 0.7, arcane 0.5, technique 0.3) resolves the physical part first (Block, then Poise), then the magic part (Poise left, then Block left), on one shared Poise pool per hit.
- Magic lane shows a "Poise N" float and log line (`magicPoise` on `damageDealt`; receipt stages `poise-magic` "Poise meets the spell", `block-magic`). With Ward enabled, magic keeps the Block, Barrier, Ward order.
- Configured Core path (`profileDamageReceipt`) only; the expanded path (`prepareExpandedDefense`) is unchanged. Falsified by `tests/magic-poise-first.test.mjs`.

**One damage kind in Core 2 (owner 2026-11-07, backlog #7: "I'd like to change magic damage to just deal damage but are reach spells by default, with the school having its unique status effect").** In new Core 2 fights a hit's damage has no physical/magic split. Every hit meets Block first, then Barrier, then Poise (×0.75 while active), then HP, except that a target holding Ward stacks keeps §4.1a's Ward routing (the whole hit to Poise first, the remainder to Block and HP), which already ignored the split and is unchanged. This supersedes the 2026-10-31 "Magic hits Poise first" lane above, `magicPoise`, the `poise-magic` and `block-magic` receipt stages, and "Block soaks … its physical part first and then its magic part"; Pierce works on the whole hit. The rule is the versioned flag `damage.unified: true` in `content/source/fixCoreMechanics.json`, snapshotted per fight, so an already-saved Core 2 fight finishes under the split it started with; legacy and expanded profiles are unchanged. Spell-camp attacks keep reading PR (spell power) instead of AR: that is scaling, not a damage type, and Weak's ×0.75 still applies only to AR. The `magic` weakness trigger becomes `spell` (see *Enemy weaknesses in Core*), and Core 2 applies no school resist (it is display only, `src/model/enemyKnowledgeView.js`). No Core 2 content carries a magic resist or bonus; the legacy `magic` school key and `spellDamageDealtMult` are unchanged. Card faces and receipts show one damage number, never "magic · physical". *Falsify:* a Core 2 fight where a 6-damage frost spell hits a target with 4 Block and Poise active gives Block 0, HP loss floor(2×0.75) = 1, and 1 Chilled; a hit that shows a `poise-magic` stage or a "magic · physical" split under `damage.unified` fails.

**Pierce** (card tag `pierce`, `damage:piercing`, or a piercing damage type).
- Per hit, lets past up to floor(0.2 × the hit's damage) of what Block would have soaked (none with no Block), after stance and Smash bonuses, before Block, physical part first (`pierce.blockBypassFraction`, `content/source/fixCoreMechanics.json`).
- Block is spent as if the hit had not pierced; pierce never costs less HP than the same action without it.
- The pierced physical amount meets Poise first, 1:1 (not the 25% rule): Poise loses up to that amount, only the uncovered rest reaches HP; an emptied Poise is a normal break; no Poise means straight to HP. The unpierced part keeps the ordinary rule against the Poise left (no double count). A Smash vs a defensive stance gets no Poise absorption for its pierced part.
- Shows a "Pierced N" float and log line (with what Poise took). Expanded and legacy paths keep their Piercing/Precision guard-bypass amounts; Precision is a hit-roll status in Core and bypasses nothing.

**Poise and break.** No passive regeneration; a defensive card adds its final Block to current Poise (capped at max) and grants that Block. A break puts the target in the Staggered stance (not a stacking status): −1 SP, +1 Vulnerable; further breaks while Staggered add Vulnerable stacks that extend duration only.

**Statuses.** Stacks add. Natural decay removes one stack at the owner's turn start, at most once per round. The physical/spell `camp` is for matchups only.

**Ward** is off in Core 2 (`ward.enabled: false`, `content/source/fixCoreMechanics.json`): no Ward pool, Block cards restore only Poise.

**PIPs** show Block, Poise, Evasion stacks and active status stacks; never AC. HP stays in its health display.

### Defense, Smash and stance bonuses

- Base Defend gives 10 Block; Counter gives floor(Defend Block × 0.5) = 5, before DR, stance and other bonuses.
- Stance rating bonuses (+1 AR offensive stance, +3 DR defensive stance) apply to Block and damage alike; the card face and preview show the boosted value.
- Matching stance multiplies effectiveness by 1.25.
- **Smash vs a defensive stance** (Defend or Prepared, per the stances module's matchups): deals 1.25 × normal damage + floor(0.25 × the target's current Block, read before this hit's Block absorbs it). "Normal" is the Smash chain without the 1.25 offensive-advantage multiplier, which this ×1.25 replaces rather than stacks with; AR, matching stance and Vulnerable still apply. Block then absorbs the total as usual.
  - No 25% Poise absorption; the target's Poise loses floor(0.5 × the total), capped at the Poise held, with usual break/Staggered rules and one stagger per target per round.
  - Values: `smashVsDefensive` in `content/source/fixCoreMechanics.json`.

### Contests

A card authored `contest: 'mental'` or `'physical'` (`schemas.js`, `validate.js`; also in an `upgrade` block) never rolls Accuracy and ignores range. Enemy-targeted effects resolve one seeded contest per target per card play, rolled before the effects run (`src/engine/contest.js`, `combatMatchups.beginTacticalAction`; die: `combatContest` stream, §3.11).

- **Roll:** d20 + caster attributes + card rank (`cardRank`, 1 when absent) vs **DC** = target's CURRENT Poise (`persistentPoise.value`) + target attributes + target level. **A tie succeeds.**
  - Attribute pairs are data (`content/framework/mechanics.json` `contest`): mental = caster INT + WIS vs target WIS; physical = caster DEX + CON vs target CON.
  - Example: rank 1, INT 1, WIS 2, roll 5 gives 5 + 2 + 1 + 1 = 9 vs enemy Poise 7 + WIS 1 + level 1 = 9: succeeds (tie); roll 4 fails.
- **Events:** no range row (never an Advance or out of range); no `attackHit`/`attackMissed`; emits `contestPassed` or `contestFailed` with the receipt (roll, attribute parts, rank, total, DC parts, DC, `passed`).
- **Failure** avoids that target for enemy-targeted effects only; self effects (Read Intent's status, a draw) still happen.
- **Display:** log "Read Intent contest: 9 vs 9 · success"; full-detail row "d20 [5] + INT 1 + WIS 2 + rank 1 = 9 vs Poise 7 + WIS 1 + level 1 = 9"; callouts READ and RESISTED; hit badge "DC N", not a percentage.
- **Cards:** mental: Read Intent, Blight, Charm; physical: Weaken (Weak), Bind, Hexmark (Vulnerable and Weak). Foresight has no enemy target, no contest. Cards that also deal damage or add a burden card to the enemy keep the Accuracy roll.
- Core 2 only: Current/legacy ignores `contest`, keeps the Accuracy roll and range (RNG use unchanged).
- Intent knowledge: §4.9; the contest only decides whether Read Intent's reveal lands (§4.6).

### Accuracy, Evasion and Precision

**Shipped Core 2 draws no hit roll** (`accuracy.hitRoll: false`, owner brief 2026-11-14; *Plannable and quick turns* below). The rest of this section governs a fight whose rules snapshot lacks that key or sets it true (a fight saved before the change).

The attacker rolls d20 + Precision; the defender does not roll. Hit when the total is at least the defender's Evasion; natural 20 always hits, natural 1 always misses; advantage/disadvantage apply to the attacker's die.

| Value | Formula |
|---|---|
| Precision | 1 + floor(0.5·DEX + 0.1·STR + 0.2·(WIS + INT) + level) + Precision stacks, plus gear Precision and the Smash/Sweep maneuver bonus (flat) |
| Evasion | 8 + DEX + 2 × Evade stacks, plus equipped Evasion bonuses once; eligible prepared-Evade bonuses stay additive |
| Need | Evasion − Precision |

- Constants `evasionBase` 8, `evadePerStack` 2, `precisionStackValue` 1, `precisionDecayPerTurn` 3 are the `accuracy` block of `content/framework/mechanics.json` (not locked FixCore rules); weights and stack gain are configurable in `accuracy` in `content/source/fixCoreMechanics.json`.
- **Precision stacks:** an offensive stance entry grants exactly 1 (buff cards 1 to 3). They lose 3 at their owner's turn start (floored at 0; players and enemies; shown on the badge); Persistent stacks are exempt.
  - Older line, kept (conflicts with "exactly 1" and the formula above): a stance change grants 1 + floor(0.5·DEX + 0.1·STR + 0.2·(WIS + INT) + level) stacks and the same mix is the Precision multiplier base (DEX 2, level 1: 3 stacks give Precision 1 + 2 × 4 = 9).
- **Evade stacks:** one decays at the owner's turn start; a miss still consumes one. No stance multiplier. Disabling Evade suppresses stack and prepared bonuses, not DEX or equipped Evasion.
  - Older example (conflicts with the Evasion formula above): DEX 2, no gear: 0/1/2 stacks give Evasion 3/6/9.
- **Evade card:** 3 SP, 3 Evade stacks per play, independent of DEX (`accuracy.evadeStackBase = 3`, `accuracy.evadeStackDex = 0`); text "Gain 3 Evade."; the Evade keyword explains the defense bonus.
  - Entering a stance with any other card carrying the Evade tag or profile grants the same 3 (a resumed fight keeps its snapshotted value). Non-Core expanded combat keeps `stanceRules.evadeStacks = 1`.
- Core 2 only: legacy keeps the previous formulas (Precision = 1 + mix × (stacks + 1); Evasion = 1 + DEX + Evade stacks × (1 + DEX)) and no Precision decay.
- Hit-chance preview enumerates exact d20 outcomes (20; 400 with advantage/disadvantage), floored.
- Versioned migration: the former default gain pair (base 1, DEX 1), or an identical custom pair, becomes (1, 0) in existing Core runs; other saved pairs and versioned overrides keep their values.
- Enemy attributes come from their stats. Enemy level = its authored `level` when set, else its resolved `levelProfile` bound (`enemyLevel`), else 0; in Core every enemy's level is 1–5 (*Enemy levels and stat budget*).

### Perception and hit-chance display

Shipped Core 2 rolls no Perception for intents and shows no hit chance (`perception.roll: false`, `accuracy.hitRoll: false`; *Plannable and quick turns*). The first two bullets govern a snapshot without those keys.

- Perception: seeded `d20 + WIS` by the observer vs DC = 5 + target INT + target WIS + configured bonuses (default none).
- Hit chance shows on each valid target while a card that can damage it or apply an effect to it is selected, regardless of Perception.
- One tap or click selects a card; play needs a second tap or a target pick. One-tap play is an opt-in Settings switch, off by default.

### Stance discounts and spell cards

- **Adept discounts (Core 2).** Equipped Reaver/Rogue Martial Adept: −1 SP on a nonspell card. Equipped Starseer/Herald Magic Adept: −1 MP on a spell/Magic card per Core `isSpellCard`/the shared combat-profile rule (incl. mirrored Cantrips with profile camp Spell). Only when already in the matching stance before playing the card.
- **Defend stance (physical or spell):** every defensive card (Defend, Counter; an Evade card is a Defend card) takes the cut in the class's own lane (a physical Defend stance discounts a Ward cantrip and the reverse). Counter stance and every offensive stance keep the exact stance-and-camp match.
- Discounts apply on the player's turn (floor 1) and to enemy-turn reactions (floor 0). Exception: Counter, Reaction cost.
- Not discounted: the other resource lane, wrong-classification cards, a stance entered by that card, zero-cost and X-cost cards.
- At most one same-stance cut; Mana Surge's separate rule stays without stacking a reaction or Adept cut. The same-stance Magic Adept cut and the successive-Spell Mana cut are one MP reduction when both apply (successive-Spell timing unchanged across mirrored stance changes). Range/Advance charges and upcast prices are independent.
- **Mirrored spells** (sceptre/staff Strike, Ward, Channel; Arcane Spark) take the basic card's stance and type for matchups but stay Spells and Cantrips: corner shows the spell mark; footer shows the spell mark, the basic card's mark and its word (e.g. "ATTACK", "SMASH"); they count as Spells for the successive-Spell Mana cut. Others say "SPELL". Core 2 only (Current/v2 keeps the casting stance and old faces).

### Rest sites, progression and combat pacing

- **Rest sites:** 3 per act, one directly before the boss. A visit is ONE pick (owner brief, 2026-11-14; `rests.servicesPerVisit: 1` with the `rest` service listed): **Rest** (heal `recovery.hp`, shipped 0.3 = 30% of max HP rounded up, and refill MP, SP and both flask pools), **Smith** or **Upgrade Card**. Arriving heals nothing, and Smith and Upgrade Card restore nothing. The pick closes the visit; Continue leaves. Core Smith is free, tier 2 at most; higher needs a Blacksmith (§14.4), shown as "Needs a Blacksmith".
  - `recovery.hp` is `"full"` or a fraction in (0, 1]. A profile whose `services` lacks `rest` keeps the earlier rule, so a run saved under it does too: the rest heals on arrival and offers Smith, Level Up and Upgrade Card, none exclusive.
- **Level Up** is not a Core 2 rest service (it was until 2026-11-14): earned attribute points are spent as the next bullet says. Where an older profile lists it, it spends an already-earned level, not the rest visit; the rest grants no level.
- **Attribute points** are spent on the Core Victory receipt and the Armory character sheet through `allocateAttributePoint` (`src/model/levelup.js`), which neither heals nor uses up a rest visit; every other `applyLevelUp` caller stays rest-only, and the Level Up rest service stays.
  - Each attribute row shows its largest per-point gain (e.g. `+10 HP`), every gain in its tooltip, from `src/model/attributePointPreview.js`; the Rest card model carries the same `mainGain`.
- **Victory receipt** (one screen with the card choice since 2026-11-14: *Plannable and quick turns*) shows only the Character bar (class-named); class-mastery and weapon/skill tracks are still paid and banked, notices acknowledged silently. Character XP is paid at `modules.progression.settings.characterXpMultiplier` (1.5; older snapshot: 1).
- **Deck editing happens only at a rest site** (owner brief, 2026-11-14; `cards.editorWhere: "rest"`): the Rest screen carries a free **Edit deck** door that is not a service and does not spend the visit's pick. The Armory, character creation, the reward screen and combat open no deck editor. Acquiring a card is not editing: a card won at a reward door or bought in a shop may still go straight into the deck ("Add to deck") or into the collection, as before; the Armory's Deck tab shows the deck read-only. Equipment editing still happens at will outside combat, disabled in it. A profile with `editorWhere: "noncombat"` keeps the earlier rule (the deck is edited from the Armory at will). The Armory control outline is blue while it holds a new item, else black.
- **No unlimited copies** (owner brief, 2026-11-14; `deck-training.unlimited: []`): a card's copies are the copies the run owns, and the editor mints nothing. A profile that still lists the `basicTraining` and `graduate` rules keeps §14.1's Adept copies.
- Map node types and shops: §6, *Visible forks*. Reward groups: §15.1. Armor budget 3 + per-rarity bonus (default 0).
- **Combat speed** (configurable): auto-combat ×1.5, manual play ×1.25 by default. Step pacing: see Pacing controls below.
- **Auto-combat** picks the player's reactions and plays the player's turn.
  - Reaction: counters the perceived incoming action, else the card type of the last stance, ties toward past choices.
  - Each turn it plays (at most `maxActionsPerTurn`, via the click path) the playable card ranked by: fits the combat preference (offense/defense), counters the perceived incoming maneuver, costliest affordable, first in hand; then ends the turn via End Turn.
  - Stops at once when turned off, the fight ends or a prompt opens.

### Counter

Core 2 only; legacy keeps its rules (fully-resisted requirement; its reaction-cost behavior).

- **Incoming damage** = the hit after the attacker's whole chain (AR, matching stance, Vulnerable, stance advantage and defense) and its single floor, before Block, Barrier, Ward or Poise (the receipt's `incoming`).
- **Return:** the card's authored damage (the payload's `hp`, once per answered attack) + floor(`counterStacks` × 0.1 × incoming) per covered hit + (when the Counter beats the incoming maneuver) floor(0.25 × incoming).
- **Poise damage** of the return = floor(0.2 × return damage); floor(0.5 ×) with advantage.
- **Advantage** (`matchups.counter`: Counter beats Attack and Smash) also gives the Counter's owner floor(0.25 × incoming) Block before the hit is absorbed.
- The return fires whenever a covered incoming attack hits the armed Counter, even if some damage gets through; once per owner cycle; subject to coverage and range.
- Example: Attack 8 into a Counter played behind 9 Block (printed damage 4) returns 4 + 7 + 2 = 13 damage, 6 Poise damage.
- Card face, preview and log ("X countered Y for D (base B + stacks S×10% of I)") state the same numbers (previews skip the attack-rating bonus, as the live return does). Fractions: `counter` in `content/source/fixCoreMechanics.json`.
- **Counter stacks:** `counterStacks`, a whole-number count on the combat entity (absent = 0), not a status.
  - Playing a `maneuver:counter` card adds the player's current Block (read after the card's own Block grant) to it, uncapped, besides arming the single-use Counter.
  - Persist across stance changes; fade by 2 at each owner turn start after the single-use charge clears, never below 0 (the charge clears at owner turn start and on stance change). Clear when the fight ends.
  - Snapshot validates (type and sign) and restores them; absent field loads as 0; load ceiling 999 (not a rule).
- **Auto-Counter:** in Counter stance with none armed, a covered enemy hit may be answered with no card for 1 SP (reaction "Counter (1 SP)", taken by auto combat when SP allows), arming a Counter with authored damage 0 (returns only the stacks' share, plus advantage).
- Values in `counter` in `content/framework/mechanics.json`: `stackFraction` 0.1, `decayPerTurn` 2, `autoCounterStamina` 1.
- **Reaction cost:** a Counter card with the Reaction trait played from Counter stance on the enemy's turn costs max(SP − 1, 0), Adept or not. Every other card keeps the Adept rules.

### Reflect

Core 2 only. `reflectStacks`: whole number 0 to 10 (absent = 0) on the combat entity, not a status; clears at fight end; snapshots validate and restore it. The card "Mirror Guard" (`core.mirrorGuard`, 1 SP, "Gain 1 Reflect.") grants it via the `applyReflect` effect.

- A hit from another body on a Reflect holder: incoming damage (after the attacker's chain, before Block) is cut to floor(incoming × (1 − min(0.9, stacks × 0.3))). Once it lands the attacker takes floor(original incoming × min(0.9, stacks × 0.3)) of the same damage type, and the holder loses one stack.
- The returned hit needs no hit roll, takes the attacker's Block and Poise as any damage, and can neither reflect nor trigger a Counter.
- Counter returns, reflected returns and `unreflectable` hits are neither cut nor returned and spend no stack. Previews and forecasts use the same cut.
- Badge: stack count, tooltip "Cuts each hit by N% and sends N% of it back"; log "X reflected D back at Y (S stacks)".
- Values in `reflect` in `content/framework/mechanics.json`: `reducePerStack` 0.3, `returnPerStack` 0.3, `reduceCap` 0.9, `stackCap` 10.

### Stances and Evade

- Stances: **Attack, Smash, Sweep, Counter, Defend, Prepared, Idle (no stance)**. Internal id `casting` names Prepared; no id is renamed.
- Evade is a tag and status, not a stance. A card's stance comes from its maneuver alone; a card with the evade tag or profile keeps its Evade behaviour (stacks, entry grant of `accuracy.evadeStackBase`) whatever its maneuver. So an Evade card plays in Defend stance (an exact same-stance match), and a Counter card with the evade tag plays in Counter stance and still grants Evade stacks.
- Matchup tables name Defend, not Evade. The configured `sweep` edge beats Counter and Smash. The card footer keeps "DEFENSE".
- A saved `combatStance`/`concurrentStances` row with maneuver `evade` loads as Defend; a retired `counterStance` hybrid loads as Counter, flag dropped (`bringStancesForward`, `src/model/combatSnapshot.js`, at run load and snapshot restore).
- **Spell Counters** with Counter coverage (`frostCounter` and school siblings) arm in Core and keep the prepared stance they enter; `armsAsCoreCounter` (`src/model/profileStance.js`) arms them for live play, preview, card face and inspector help. Their return is a magical attack that rolls to hit, uses PR in place of AR, follows the same advantage, Poise and once-per-owner-cycle rules, and returns no authored Ward or Flux. The incoming hit is priced against Prepared; any card accepted after arming (Spell, Skill, maneuver or Evade) disarms it.

### Migration boundary

- Earlier-profile runs keep their snapshotted rules, except the Core progression policy below, the Core 2 collected-card/Adept editing migration (§14.1) and the per-fight action policy (§4.6a).
- New Core 2 fights (including from an existing run) stamp `core2ActionRulesVersion: 1`; an active fight without the field keeps its accepted prices and queues (no repricing, no retroactive charge).
- Runtime-hash checks stay: a save needing an earlier runtime keeps needing its matching build unless a tested adapter supports it.
- Selecting or editing `ashen.core@2.0.0` affects new runs only (except the per-fight policy). No automatic migration to FixCore; any later change to this contract or migration of an existing run needs a separate SPEC change and tested migration contract.
- The legacy preset keeps its prior rules, except Vulnerable is ×1.25 in every profile including `ashen.current@1.0.0` (D16); existing Current runs take it once loaded (no save migration).

### Enemy levels and stat budget

Core 2 only. Enemy levels 1–5; an enemy's stat budget follows the player's rule.

- **Levels 1–5.** Every Core enemy's `stats.levelProfile` and every encounter's `targetBand` lie within 1–5; the fight uses the bound `characters.levelFrom` names (`levelProfile.min`).
  - Exact `{min, max}` pairs, both ends:

    | Act | Minion | Elite | Boss |
    |---|---|---|---|
    | 1 (Weald) | 1–2 | 2–3 | 3–3 |
    | 2 (Marches) | 2–3 | 3–4 | 4–4 |
    | 3 (Reach) | 3–4 | 4–5 | 5–5 |
- **Budget.** The Core player's starting budget (upper bound of `tagRules["character.player"].attributeBudget`, `[6, 6]`) + `progression.attributePointsPerLevel` (1) per level after the first: a level-L enemy carries 5 + L points (6 at level 1, 10 at level 5).
  - Both numbers are read from config, not copied.
  - Tiers no longer set a stat budget; they still differ in pools, hand and deck.
  - An authored `attributePoints` still wins.
- **Floors.** Every enemy attribute starts at 1 (`characters.attributeFill.floor`); the remaining points follow `attributePriority`.
  - The enemy `attributeOffset` (−2 Strength, Dexterity, Constitution) and the Constitution fill cap are removed, so no enemy reads 0 in a stat before gear and relics.
- *Falsify (once built):* `tests/enemy-level-budget.test.mjs` fails a Core enemy whose `levelProfile` is not exactly its act/tier pair, an encounter `targetBand` outside 1–5, an own attribute total other than 5 + level (no authored `attributePoints`), or any own attribute below 1; raising `attributePointsPerLevel` to 2 makes a level-3 enemy carry 10.

### Core clarity, progression and editing amendment

- **Core card face.** The damage number on a combat card face is the HP one hit will take from a reference enemy (*Plannable and quick turns*, rule 1; it was the hit before Block until 2026-11-14).
  - Reference: the aimed living enemy, else the frontmost living enemy; with none, or outside combat (deck view, rewards, shop, codex, smithing receipts), the raw number.
  - Only damage aimed at an enemy takes it; self and ally damage keep the raw number.
- **Multi-hit.** `5 × 3` is three contacts of 5 (15 before defenses and modifiers); a total never becomes each contact's base damage. Each contact resolves defenses, statuses and accuracy independently and offers its own eligible paid Counter (amends once-per-owner-cycle: a newly paid manual Counter may answer each contact; automatic Counter returns keep the owner-cycle limit). Unequal contacts show their sequence, not a uniform multiplier. Receipts match the revealed projection.
- **Boss action previews.** Revealed boss moves expose their payload as well as damage (Block, healing, statuses, card additions, charging) with readable descriptions. Formula-backed values are projected on detached state, consuming no RNG and selecting no move or executing a script. HP-triggered phase changes stay distinct from a selected move. Perception and concealment still govern unrevealed choices. Once played, the current or last action is inspectable.
- **Enemy inspection.** Show solo enemies' current/max SP, authored deck or move-set composition (kept distinct) and public current/last action with costs and effects; never fabricate draw order or reveal an unrevealed choice.
- **Card readability.** Target three concise effect lines.
  - Hand-face rules shrink to the readable floor (13 px effective since 2026-11-14) and show at one or two lines; three or more at the floor show the Inspect cue.
  - Text wraps in a fixed-size panel and shrinks its font, never stretching the panel or taking artwork space; keep a font floor and an in-panel inspection cue.
  - A standard Counter face says Gain X Block and Counter X; tag and inspection explain the mechanics and automatic Poise rider.
  - Inspection and full Rules keep every effect, amount, condition, duration.
  - Visible tags may carry repeated mechanic definitions, with prose retained when the explaining tag is unavailable.
- **Opening and progression.** Core enables the existing intro flow and settings. New Core runs grow only the active class and weapons used (no armor, accessory or character-level progression), on the slow curves, with separate nonnegative class/weapon XP multipliers (default 1; older snapshot: 1). Crossing presentation stays on.
- **Bounded existing-Core progression policy, version 1.** Core 2 (including older snapshots) stops future character-level XP and new character-level reward doors. Snapshot hashes, earned levels, attributes, XP ledger and earned pending rewards or unspent attribute points are preserved; pending claims are grandfathered until spent. It does not migrate a legacy or future non-Core profile, rewrite its combat rules, replay the intro mid-run, or grant rewards.
- **Pacing controls.** Enemy turns use their own shorter timings (*Plannable and quick turns*, rule 5). Persisted, independent controls for the pause between combat steps (default 500 ms) and action/reaction animation step duration. A mobile-fast preset visibly sets both; manual edits remain possible. Speed multipliers and reduced motion compose. Report intentional pauses separately from input latency, main-thread stalls and processing time.
- **Editing and archive boundaries.** Preserve the public launch doors and architecture layers. Editable source uses readable named icon identifiers and asset references (centralized legacy aliases may keep old data). Authored content/configuration stays authoritative, with Visual Studio editing recipes and validation commands. Archive code only after checking runtime, dynamic, tooling and test references; keep provenance and restoration instructions.
- Mobile goal: at least 2× faster interactions, stretch 4× throughput; report baseline, device/emulation, action correctness and remaining stalls (a timing preset alone does not meet it).

### Plannable and quick turns amendment

Owner brief, 2026-11-14 ("make a turn plannable and quick"). Rules 1, 3 (display), 4 to 9 are presentation and apply to every Core 2 run, saved or new. Rule 2 and the intent read of rule 3 are keyed on new rule keys that a fight copies when it is created (`combat.fixCoreRules`): a fight saved before them keeps rolling and may hide intents when it is loaded, and the next fight of that run takes the new rules (checked in the browser with a save from the build before).

1. **One number per hit: the HP that will change.** The card face, the enemy intent, the floater, the reaction prompt and the inspector all read the same evaluator (`profileDamageReceipt`) at the same stage, `hpLoss`. This replaces the 2026-11-02 and 2026-11-03 rulings (face before Block; intent as the raw hit).
   - **Card face:** the HP the reference enemy will lose from one hit now, after its defensive stance, Reflect, Block, Poise and Evade. Equal hits read `N × M`, unequal hits their sequence; a card that hits every enemy shows one number when all would lose the same, else `min–max`. Aiming at another enemy updates the face before the play is committed, by click, focus or drag.
   - **Intent:** the HP the player will lose if the move resolved now, given the player's Block, Poise, stance and Evade; it changes as those change during the turn. A later attacker is priced after the earlier enemies' shown actions. Multi-hit keeps `× N` with per-hit HP.
   - **Floater:** the HP lost. A hit that takes no HP shows "Blocked". No Poise or Block floater.
   - **Reaction prompt:** the incoming action reads "Lose N HP" and each option the HP lost after it, with the option's real cost (a Counter's range cost included).
   - **Inspector:** keeps its breakdown and ends on the face's number. A weakness not yet discovered is priced and its row reads "Unknown weakness".
   - **Cost:** the Stamina and Mana on a face are what the play charges for the reference target, Advance included; what is deducted at commit equals what the face showed at commit. A Counter in hand shows no Advance (its range is paid when it answers).
   - A plan cancelled by a Poise break reads "Staggered" with no number. Clicking or tapping the damage number selects the card; the inspector opens from the info badge, hover or long-press.
   - *Falsify:* `tests/core-shown-equals-dealt.test.mjs` (152 seeded fights, four classes) fails when a hit's HP loss differs from the face or intent number, a floater differs from the HP lost, or the Stamina or Mana spent differs from the face cost.
2. **Attacks hit** (`accuracy.hitRoll: false` in `content/source/fixCoreMechanics.json`). No d20 is drawn for a hit, so no attack by either side misses by chance and no hit chance is shown.
   - **Evade is the only miss, and it is visible.** A target with an Evade stack (or a prepared Evade) cancels the next attack against it and spends one stack; a multi-hit attack is evaded hit by hit. The Evade card grants `accuracy.evadeStacksPerCard` (1) stack. The stack shows on the target and the aimed face reads the result.
   - **Precision does nothing without a roll:** no Precision is granted on entering an offensive stance, no face prints an "Entry: Precision" line, and the four Core cards that granted it lose that effect. `core.guidingWhisper` and `base.evade` leave the reward pool (`rewards.eligibility.excludeCardIds`).
   - A snapshot without the key keeps *Accuracy, Evasion and Precision* as written.
3. **Every enemy move is shown, exactly** (`perception.roll: false`). At the start of each player turn every living enemy shows its move, its exact value by rule 1, its planned follow-ups and a readied Counter. Nothing is concealed and no Perception is rolled for the read; §4.9's hidden-intent clues apply only to a snapshot without the key. *Falsify:* `tests/core-intents-exact.test.mjs`, `tests/core-attacks-hit.test.mjs`.
4. **Only destructive actions ask.** A tap commits; the hold or review dialog stays only for delete save, fresh profile, profile restore, removing a card at a shop, shrine level up, smith upgrade, extract and install, leaving a reward door with nothing taken ("Leave without taking a reward?"), and the Load and Quit Without Saving doors of §7. End Turn never asks: while a playable card remains the button changes colour (`end-turn--cards-left`). *Falsify:* `tests/confirm-only-destructive.test.mjs` pins the set.
5. **Enemy turns are short.** Enemy playback uses `motion.enemyTurn` in `content/config/ui/presentation/actionPacing.json` (stage gap 100 ms, sprite rate 1.25, telegraph 250 ms, floater interval 375 ms, turn banner ×0.35); the player's own steps keep *Pacing controls*.
   - Budgets from End Turn to a playable hand, median / max (`npm run probe:enemy-turn`): one enemy action 2.6 / 3.5 s, two 4.0 / 4.5 s, a non-damaging action 1.2 / 1.6 s. Measured before: 6.2, 8.2 and 4.6 s medians.
   - A press during enemy playback finishes it, and the screen says "Tap to skip". The reaction window is kept: it opens only when the player holds a card that can answer, has no timer, and its exit reads "Skip".
6. **Four clicks from the title to the first hand** on a fresh profile (budget in `tools/core-entry-fixture.mjs`, 8 inputs): New Game opens creation for the first slot (the slot picker returns once any slot holds a save); the Class step carries Begin, with Customise as the secondary door to Review; any key, click or tap skips the opening after 600 ms; a new run's single start node is preselected so the first press is Enter; Enter shows "Entering…" in the frame it is pressed.
7. **One victory screen; victory to map in two clicks.** A won fight shows one door: the title, a spoils strip (Cinders gained and the new total, a smithing stone if one dropped, the Character bar, and "N points to spend" when attribute points are banked) and the card choice. Taking (select, then Add to deck or Add to library) or leaving (Skip, then confirm) goes straight on; no Continue. An armament keeps Equip now / Continue. Elite spoils, level notices and rank-ups stay separate doors, shown only with content. The spoils are recorded on the receipt when the fight ends, so a reload shows the same numbers and pays nothing twice. Nothing from the fight draws above a reward door's controls. *Falsify:* `tests/victory-one-screen.test.mjs`.
8. **Sizes** (effective px, 1280×800 and 390×844; `npm run probe:text-size`). No visible text under 11. Hand and reward faces: effect text 13 or more, name 12, type label 11, cost 16; tag counts and the range chip show only on a hovered, focused, selected or inspected card. The player's HP in the field HUD and the enemy intent number are the two largest numbers on the combat screen (22 or more; no other number as large), with at most 8 number sizes. Every combat control on a phone is at least 44 px in both directions (`--tap-floor`); a smaller glyph extends its hit area.
9. **Rest and header fixes.** Upgrade Card lists copies of a card at the same upgrade state as one row with a count, and lists a weapon-granted card disabled with "Upgrades with its weapon (Smith)". The run header's Cinders and HP update on the screen where an event, a dialogue or a won fight changes them.

### Reward inspection and earned-effect feedback

- Reward choices keep a separate Inspect action (existing read-only inspectors) before collection and during confirmation review. Closing it preserves the selection and review stage; an in-flight claim disables it until the save succeeds or fails.
- Class and used-weapon level notices show the level transition, visible progression, resolved card-value changes and new unlocks the active rules grant; a level with none says so. Next-benefit previews follow the active authored rules and owned-card context. A saved notice resumes without paying XP or granting effects again. Reduced motion keeps final values visible.
- Positive status grants (self-buffs and grants from another actor, player or enemy) show `+N Status name` above the recipient, using the registry's displayed name. N is the actual increase after caps and refresh/unique stacking (none shown if nothing added). Buildup and hostile feedback keep their channels. Labels share the overhead queue and add no combat steps or waits.

#### Notes and history

- The Precision stance-gain line and Evasion example under Accuracy use previous formulas, kept beside the current ones.

Full history: [docs/spec-history/17-fixcore.md](docs/spec-history/17-fixcore.md).
