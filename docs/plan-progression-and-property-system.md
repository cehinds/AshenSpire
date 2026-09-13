# Implementation plan: progression, equipment-as-cards, and the property system

Executes [proposal-progression-and-property-system.md](proposal-progression-and-property-system.md).
Each phase is one or more pull requests into `dev`, each with a CHANGELOG
receipt and rebuild. Paths and symbols below are the seams as they exist at
`0.6.0.160`; a phase that finds a seam moved re-anchors and says so in its PR.

Conventions that apply to every phase:

- Content is CSV/JSON under `content/source/`, compiled by
  `tools/content-build.mjs` into `src/content/generated/`. Never hand-edit
  generated files.
- Every closed set lives in `src/model/schemas.js` and is checked by
  `tools/closedsets.mjs` (run from `tests/run-node.mjs`).
- Every number is a row in `src/content/balance.js`; the proposal §10 table is
  the key list.
- Every refusal is named and has a test that asserts the name, in the style of
  `tests/engine.test.js` test 15.
- Migrations: `RUN_SCHEMA_VERSION` in `src/model/state.js:37` and
  `migrateRunSchema` (`:911`) use era flags; each phase that changes
  `RUN_SHAPE` (`:508`) bumps the version and adds one flag.

## Phase 1 — Property system (2 PRs)

**PR 1a: registry and rules table.**

| Change | Where |
|---|---|
| New tag domain `property` | `content/source/tagDomains.csv` |
| Family×domain rows: `armament`, `armour`, `relic`, `class` may carry `property`; `card` may not | `content/source/tagFamilyDomains.csv` |
| New source `content/source/propertyRules.csv` → `src/content/generated/propertyRules.js`; columns `tag,requires,excludes,textTemplate` plus a JSON sidecar `propertyRuleEffects.json` for `passives`/`triggers` (same shape as `SCHEMAS.relic`) | `tools/content-build.mjs` compiles both; `src/content/propertyRules.js` re-exports and indexes by tag |
| Schema `SCHEMAS.propertyRule` built from the relic passives/triggers nodes (single home, `PASSIVE_TYPES` at `schemas.js:184`) | `src/model/schemas.js` |
| Validation: every `property` tag has exactly one rule; `requires`/`excludes` resolve; no cycles; a `card`-family tagging row with a `property` tag is refused by name | `src/model/validate.js` |
| Predicates `skillLevelAtLeast`, `classLevelAtLeast` added to `PREDICATES` (`schemas.js:146`) and `evalPredicate` (`src/engine/triggers.js:240`); they read the ledger from phase 4 and return false until it exists | |

Tests: `engine.test.js` new numbered tests for each refusal; `closedsets`
gate sees the new predicate ids.

**PR 1b: mount path.**

| Change | Where |
|---|---|
| `mountProperties(ctx, carrier)` / `unmountProperties(ctx, carrier)` in a new `src/engine/properties.js`. A carrier is `{kind, id, instanceId, ownerKey, tagIds}`. Mount records `ctx.propertyMounts[ownerKey][sourceKey] = {rules}`; unmount deletes it | new file |
| `scanTriggers` (`triggers.js:58`) gains a fourth scan over `ctx.propertyMounts`, key `property:<owner>:<sourceKey>:<i>`, beside relic/stance/status scans | `src/engine/triggers.js` |
| Passive readers `passiveMult` / `passiveSum` / `passiveFlag` (`src/model/registries.js:362-385`) read mounted property passives in addition to relic passives | |
| Carriers today: equipped armaments and armour. `createCombat` (`src/engine/combat.js:121`) mounts the loadout's pieces; `doChangeEquipment` (`:702`) unmounts the outgoing piece and mounts the incoming one after `equipPiece` | |
| Tagging rows: `armament,,scepter,siphon` and the three other focus rows; `siphon` rule: `on arcaneBreak, if eventSourceIsOwner → restoreMana 1`, second branch `if skillLevelAtLeast focus 7 → restoreMana 2` (branch is inert until phase 4) | `content/source/tagging.csv`, `propertyRules.csv` |

Acceptance test: a scepter-wielding player's arcane break restores 1 mana;
after `changeEquipment` to a sword the same break restores 0; a wand's
`overcharge` multiplies buildup by the balance row. Engine suite headless.

## Phase 2 — Relics become carriers (1 PR)

| Change | Where |
|---|---|
| For each relic in `src/content/relics.js`, move `passives` and `triggers` into one or more property rule rows (`hp10`, `openingPoise`, …) and add tagging rows `relic,,<relicId>,<tag>` | content only |
| Relic schema drops `passives`/`triggers` (kept optional for one release behind a validation warning, then removed) | `schemas.js:623` |
| `scanTriggers` relic scan (`triggers.js:73`) is replaced by mounting relics as carriers at `createCombat`; `addRelic` (`actions.js:735`) mounts at acquisition | |
| `resolveRelicModifiers` (`src/model/relicModifiers.js:49`) reads rule passives through the same reader as equipment | |
| Text: `textTemplate` moves to the rule; relic text is the join of its rules' templates | tooltip/compendium |

Acceptance: a fixture test iterates every shipped relic and asserts its
rendered text and each trigger's behavior are byte-identical before and after
(snapshot recorded in the PR). Old saves with `run.relics` ids load unchanged
(relic id → carrier is derivation, not migration).

## Phase 3 — Cards in zones; collection and deck (3 PRs)

**PR 3a: zones in run state.**

| Change | Where |
|---|---|
| `RUN_SHAPE` gains `zones: {core: id|null, worn: {body,head,hands,feet}, hands: {main,off}, passive: [relicIds]}` and `collection: [cardInstance]`; `deck` becomes the edited subset | `src/model/state.js:508`, `RUN_SCHEMA_VERSION` 6, era flag `preZones` |
| Migration: `loadout` slots → `zones.hands`/`zones.worn`; `relics` → `zones.passive`; `deck` copied to `collection`; `class` → `zones.core` (a class card id equal to the class id, phase 5 gives it content) | `migrateRunSchema` |
| `serializeRun`/`deserializeRun` and `validateRunShape` updated | |

**PR 3b: equipment rows become cards.**

| Change | Where |
|---|---|
| `src/content/equipment.js` armament and armour rows gain `cardType: 'equipment'`, `slot` (existing `SLOTS`), and are registered in the card registry with a `zone` field; `SCHEMAS.card` gains `zone?: en('draw','core','worn','hands','passive')` | schemas, registries |
| Armour slots split: `body`, `head`, `hands`, `feet` in `SLOTS`; existing armour rows map to `body`; new head/hands/feet rows ship as data with the slot→layer table from proposal §4 as mods | content |
| `reconcileGrantedCards` (`loadout.js:2011`) and `reconcileGrantedCardsInCombat` (`:2212`) reconcile against `collection`, and mark granted instances `locked: true` while their source is equipped | |
| Deck minimum: `balance.deck.minimum`, `balance.deck.minimumPerLevel`; `deckMinimum(registries, run)` in `src/model/loadout.js`; the loadout screen's leave door refuses under-minimum by name | `src/ui/screens/equipment.js` |
| `figureSpec` (`loadout.js:2280`) reads `zones.worn` and `zones.hands`; `equippedFigure` (`assets.js:558`) accepts head/hands/feet layer ids and falls back to nothing when art is missing | |

**PR 3c: dynamic tags at snapshot.**

| Change | Where |
|---|---|
| Action snapshot (the resolver's one-snapshot-before-payment rule) computes `derivedTags` from `zones.hands` grip mode; `dual` when both hands hold the same armament group | `src/engine/actions.js` snapshot site |
| Grip mode on the armament instance: `grip: 'one'|'two'|'dual'` in the hands zone; `canEquip` (`loadout.js:2958`) validates `dual` | |
| Predicates that read card tags read `card.tags ∪ snapshot.derivedTags`; nothing writes to the card | `triggers.js` |

Acceptance: loadout screen edits a deck against the minimum; a base card
locks on equip and unlocks on unequip; dual daggers show `dual` in the
snapshot and not on the card definition; `figureSpec` test covers four worn
slots.

## Phase 4 — Skill tracks (2 PRs)

**PR 4a: ledger and curve.**

| Change | Where |
|---|---|
| `RUN_SHAPE.skills: { [skillId]: {xp, level, pendingDrafts} }`, `RUN_SCHEMA_VERSION` 7, flag `preSkills` | `state.js` |
| Skill ids: one per armament group tag, per armour group tag, per focus group tag, `dualWield`, and `class:<id>` | derived from tag registry, validated |
| `src/model/skills.js`: `xpToNext(registries, trackKind, level)` (one curve shape, keys from proposal §10), `awardSkillXp(run, skillId, amount)` returning level-ups, `skillLevel(run, id)` | new |
| XP hooks in the engine: `damageDealt`/`blockGained` with a card tagged by group → `perHit`; `combatEnd` win → `perWinEquipped` per equipped group × `killMult` if that group dealt the killing hit; `impactDealt` to owner while heavy armour worn → `armorAbsorbPer`; `attackEvaded` while light → `armorEvadePer`; `arcaneExposureChanged` by owner → `focusBuildupPer` | `src/engine/combat.js` event listeners, no entity-specific code: the hooks read the tag registry |
| Predicates `skillLevelAtLeast` now read the ledger | |
| Simulator: `tools/runsim.mjs --skill-levels` reports levels per track per run | tools |

**PR 4b: drafts and rarity.**

| Change | Where |
|---|---|
| `rollSkillDraftIds(registries, rng, {skillId, level})` beside `rollCardRewardIds` (`src/engine/encounters.js:62`): filters the reward pool by group tag, unlocks rarity by `balance.skill.rarityUnlock`, weights by existing odds | |
| Reward literal in `src/main.js:1936` gains one `skillDraft` row per skill with `pendingDrafts > 0`, capped by `draftsPerCombat`; `REWARD_KIND_ORDER` (`src/model/rewardplan.js:31`) places it where the class-card row sits and the class-card row is omitted when a skill draft is present | |
| `mountRewards` (`src/ui/screens/reward.js:67`) renders the skill draft with the same pick-1-of-N component | |
| Auto-upgrade: on a skill reaching a `balance.skill.upgradeAt` level, every collection card tagged with the group gets `upgraded: true` | `skills.js` |
| Smithing: `armamentLevels` tier is derived from skill level; `smithingStones` become a `skipToNextMilestone` purchase; `balance.smithing` rows re-pointed | `src/model/armamentSmithing` and the rest screen's smith panel |

Acceptance: headless run reaches greatsword level 2 after N hits and offers
one draft with three greatsword-tagged commons; a second level-up in the
same combat queues to the next reward; simulator prints per-track levels.

## Phase 5 — Class card, kits, tree, unlocks, swap (3 PRs)

**PR 5a: class card and kits.**

| Change | Where |
|---|---|
| `src/content/classes.js` rows become core-zone cards: `cardType: 'class'`, `zone: 'core'`, `kit: [weaponId, abilityCardId, relicId]`, `favored: [groupTag]`; `favored<Group>` property rules (`skillXpMult` passive scoped to a group) and tagging rows `class,,<classId>,favored<Group>` | content, schemas |
| Four ability cards and four relics from proposal §4 authored in the class card CSVs and `relics.js` (as carriers) | content |
| `createRunState` (`state.js:63`) builds `zones.core` and injects the kit through the existing starting-kit path (`startingDeckPlan`, `loadout.js:1801`) | |
| `mountProperties` mounts the core card at run start and combat start | |

**PR 5b: class tree.**

| Change | Where |
|---|---|
| Node = property tag with `requires: classLevelAtLeast N` and optional `excludes`; three tiers per class in `propertyRules.csv`; a tier-3 node may carry `presentation: {artKey, name}` which the core card renders instead of its own | content |
| Class XP source: `combatEnd` win, `questCompleted` (new event, fired by `completeJourneyNode` in `src/model/worldAtlas.js:654` when the node is a quest), boss kill | engine |
| Draft screen for class level-ups reuses `rollSkillDraftIds` with the node list as the pool; picking writes a tagging row into `run.zones.coreTags` | `reward.js` |

**PR 5c: unlocks and swap.**

| Change | Where |
|---|---|
| Profile unlock table (`src/model/unlocks.js`) keyed by class card id; conditions as data rows (`winAs`, `classLevel`, `bossWithGroup`) | |
| Class-swap item: a run opcode `swapClass {classId}` in `RUN_OPCODES`; authored on one event and one boss reward; replaces `zones.core`, clears `coreTags` not permitted by the new class, resets `skills['class:*']` | `actions.js:810` run-effect door |
| Character-creation screen lists unlocked class cards from the profile | `src/ui/screens/` creation |

Acceptance: four classes start from core cards with kits; a tier-3 node
swaps art and name; an old save with `run.class` loads with its core card
mounted; class swap removes disallowed tags and keeps weapon skills.

## Phase 6 — Character level and cinders (1 PR)

| Change | Where |
|---|---|
| `RUN_SHAPE.level: {xp, level, unspentPoints}`, `RUN_SCHEMA_VERSION` 8, flag `preXpLevels`; migration sets `level` from `levelUps.length` | `state.js` |
| `levelCost` / `levelsAffordable` (`src/model/levelup.js:63,83`) replaced by `xpToNext` on the `level.xp.*` rows; `applyLevelUp` no longer touches `run.cinders` | |
| XP awards on `combatEnd` win, `enemyDied` by tier, `questCompleted` | engine |
| Threshold bumps: `derivedStats.js` rules gain `perLevelThreshold: {every: 5, hp, mana, stamina, draw}` | content |
| Level-up panel in `src/ui/screens/rest.js:133` becomes the town/level-up service (phase 7 places it); no cinder line | UI |
| `balance.levelUp.firstCost/costStep` removed; `tools/runsim.mjs --level-cost` replaced by `--xp-levels` with the 10–20 band assertion | |

Acceptance: simulator measures levels per run in band; no code path spends
cinders on a level.

## Phase 7 — Recovery as location properties (1 PR)

| Change | Where |
|---|---|
| Location family in `tagFamilies.csv` (`location` → `worldAtlas.nodes` and classic `NODE_TYPES`), allowed domain `property`; rest and service tags from proposal §7.4 as rule rows | content |
| Events `arrived`, `rested` in `EVENTS` (`schemas.js:91`) | |
| `showRest` (`src/main.js:2025`) and the `case 'shrine'` path (`:1641`) become `enterLocation(node)`: mount the location's rules, emit `arrived`, render services from its tags, emit `rested` on Rest, unmount on leave | main + `rest.js` |
| `applyGraceRefill` (`encounters.js:328`) is the `restFlasks` rule's effect; `shrineHealAmount` (`:339`) becomes the `restHpPartial` rule reading `rest.hpPartialPct`; `balance.shrine.healPct` removed | |
| `restMana` rule: mode from `balance.rest.mana.mode`; `floorOrFull` reads `rest.mana.floorPct`; fixed-mode tags override | content + one opcode option on `restoreMana` (`toFloorPct`) |
| Passives `shrineHealMult` → `restHealMult`, `shrineNoRest` → `restDenied` with optional `tags` filter in `PASSIVE_TYPES` | schemas |
| Atlas: `nodes` rows gain tagging rows; `atlas.townsPerActMax` enforced in `generateJourney` (`worldAtlas.js:110`) | |

Acceptance: shrine restores exactly its tag set; town restores everything and
mana to full; camp with `restMana` at default restores to 50% or full; a
`restDenied` relic filtered to `restHpPartial` still allows town rest.

## Phase 8 — Mana costing and Exposure properties (1 PR, can run beside 4)

| Change | Where |
|---|---|
| Validation: a card with `restoreMana`-cost > 0 must have action ≥ `mana.minActionCost` and stamina ≥ `mana.minStaminaCost`; refusal names the card | `validate.js` |
| Re-cost pass over `content/source/*cards*.csv`; signature arts to 2/2 | content |
| Focus properties `staggerBreak`, `overcharge`, `resonance` rule rows and tagging rows (phase 1b shipped `siphon`) | content |
| Action-only spells carry `exposureBuildupPerHit` | content |
| Player poise: `createPlayerCombatEntity` (`state.js:953`) gains `poiseMax` from `derivedStats` (CON) plus body armour mods; `dealPoiseDamage` (`actions.js:289`) drops its enemy-only gate; player `staggered` payload from `balance.stagger.player.*` | engine + content |

Acceptance: validation refuses a 0-stamina mana card by name; four focus
properties behave per row; a staggered player loses one action and shows 2
Vulnerable and 2 Weak.

## Phase 9 — Attribute rebase (1 PR, last)

| Change | Where |
|---|---|
| `creationModes` (`src/content/attributes.js:31`): one mode `tuned2` with baseline 5, bonusPool 10, min 3, max 12; `standard`, `pointbuy`, `tuned` retained for saved runs only and hidden from creation | content |
| `derivedStatRules` (`src/content/derivedStats.js:6`) `rulesetVersion` 5: `hp = 20 + 4×CON`, `mana = WIS`, `stamina = CON`, `energy = 2 + floor(DEX/5)`, `draw = 4 + floor(INT/5)`, plus the phase-6 level thresholds; numbers are the M3 balance pass's to move | content |
| Equipment gates `attributes.gate.*` read by `canEquip` | `loadout.js:2958` |
| `resolveLevelUpValue` and creation screens read the new mode | UI |

Acceptance: `derivedStatPresentationProblems` clean; every class preset sums
to the mode total; the simulator's win-rate band is re-measured and recorded
in `docs/BALANCE.md`.

## Sequencing and parallelism

```
1a → 1b → 2 ─┐
             ├→ 3a → 3b → 3c → 4a → 4b → 5a → 5b → 5c → 6 → 9
      8 ─────┘ (after 1b)              7 (after 3a)
```

Phases 7 and 8 need only phases 1 and 3a. Phase 9 waits for 6 because the
thresholds and the rebase both rewrite `derivedStats.js`.

## Risks and their tests

| Risk | Test that catches it |
|---|---|
| A property mounts twice on re-equip | `propertyMounts` key uniqueness assertion in `mountProperties`; test equips, unequips, re-equips and counts triggers |
| Relic migration changes a text string | phase-2 snapshot fixture |
| Deck under minimum after unequip mid-run | loadout leave door test |
| Skill XP farmable by 0-cost spam | XP requires a resolved hit on a live target; test plays a 0-cost skill 20 times and asserts zero XP |
| dev moves under a receipt | each PR writes its receipt one ordinal ahead and rebuilds after the final base merge, as in #985 |
