# Implementation plan: progression, equipment-as-cards, and the property system

Executes [proposal-progression-and-property-system.md](proposal-progression-and-property-system.md).
Each phase is one or more pull requests into `dev`, each with a CHANGELOG
receipt and rebuild. Paths and symbols below are the seams as they exist at
`0.6.0.160` (phase 10 at `0.7.1.51`); a phase that finds a seam moved
re-anchors and says so in its PR.

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
- Migrations: `RUN_SCHEMA_VERSION` in `src/model/state.js` and
  `migrateRunSchema` use era flags; each phase that changes `RUN_SHAPE` bumps
  the version and adds one flag. Version 6 was taken by seats (`67941367`) the
  day this plan merged, so the phases below start at 7. If another change takes
  a number first, a phase uses the next free one and says so in its PR.

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

**RE-ANCHORED WHEN IT WAS BUILT, and the phase split in two.** Landed as 2a;
2b is not scheduled and should not be until its blocker moves.

- **Passives did not move, and cannot yet.** A relic's passives are upgraded per
  run AND per copy at the smith (`model/itemUpgrades.js` `resolveUpgradedRelic`,
  `UPGRADE_RELIC_PASSIVE_TAGS`). A rule in `propertyRules.csv` is one global row
  with nowhere to record "this copy is at tier 2", so moving them would have
  taken the smith's relic upgrades with it. They stay on the relic and keep
  reaching every reader through `passiveSum`'s upgrade-aware path. **Phase 2b is
  therefore: give a mount somewhere to carry a resolved per-instance value, then
  move passives and split the text.**
- **`textTemplate` did not move either**, because with passives staying it
  cannot: a relic's sentence covers both halves, and splitting it would
  renumber its own `{block.2}` tokens (`computeTokenBindings` counts per
  template). It stays on the relic and reads its numbers from both homes.
- **One tag per relic, id shared with the relic.** The `hp10` / `openingPoise`
  vocabulary this phase pictured assumed reuse the content does not have: 51
  distinct trigger shapes across the 48 trigger-carrying relics, 3 of them
  shared. Property tags never join displayed `tags` (`model/registries.js`
  `stampTags`), so a tag per relic costs nothing a player sees.
- **Two things the move had to carry.** `relicTriggered` is emitted from the
  mount scan for a relic-kind source, or the relic stops flashing (`ui/fx.js`);
  and a combat snapshot's `relic:<owner>:<id>:<i>` gate keys are renamed on
  restore, or a reloaded fight refunds a spent `once`.
- **Co-op mounts under `setActive`.** A co-op owner key is the *active* seat
  (`triggers.js` `ownerKeyFor` reads `C.playerKey`), so seats must be mounted
  inside the pass that sets it; mounting them in one loop outside filed every
  seat's relics under one owner. Engine test 24 is what says so.

## Phase T — The tag tree (1 PR, landed between 2 and 3)

**Owner's direction, 2026-09-18:** every object carries property tags that say
what it is and how the game may use it; the vocabulary is one tree, in third
normal form; a node carries no numbers, only variables the owner assigns.

**What the review found before building:** the tree already existed, for
cards only — `content/framework/properties.json`, 58 nodes with `parentId`,
read by `hasProperty()` — beside the flat 13-domain registry
(`tags.csv`, all 435 objects) and the `property` rules inside it. Three
systems for one question. The phase folds them into one and keeps every
answer.

| Change | Where |
|---|---|
| `nodes.csv` — every tag is a node; parent is `parentId` only; roots are domains; `domain`/`aside` on roots only; ids kept verbatim as opaque keys | `content/source/nodes.csv` |
| `nodeRelations.csv` — `REQUIRES · CONFLICTS_WITH · PERMITS · INHERITS · REPLACES · SUPPRESSES`; a rule's old `requires`/`excludes` cells become rows | `content/source/nodeRelations.csv`, `NODE_RELATIONS` in `schemas.js` |
| `familyNodes.csv` — family × subtree root; **every family may carry `property`**, every collection-backed family carries `classification` | replaces `tagFamilyDomains.csv`; `PROPERTY_CARRIER_FAMILIES` retired |
| `nodeVariables.csv` + `variableBindings.csv` + `nodeEffects.json` — a node's effects name variables; a binding says which `balance.js` row a variable reads, per scope (`instance › upgrade › class › default`); a literal number in a binding is refused | 64 numeric leaves became 66 variables; the 48 relics' literals moved to `balance.powers` |
| `nodeTerms.csv` — player-facing words: framework term ids, a conferring node's sentence | |
| 435 classification rows — one per object, `classification.<type>` for cards, `classification.<family>` otherwise; stamped as `kindIds`, never `tags` | `tagging.csv`; `registries.js` `objectKinds` |
| Derivations — `tags`, `tagDomains`, `tagFamilyDomains`, `propertyRules`, `propertyRuleEffects`, and `src/framework/data/{properties,relations}.js` are compiled from the tree; `run-node.mjs` runs `content-build --check` as the drift gate, since the framework module bakes the default balance bindings in | `tools/content-build.mjs`; six old sources deleted, `propertyRuleEffects.json` renamed to `nodeEffects.json` |
| Readers — `registries.tree` (`nodeTree`: parent, root, children, the dotted path from labels), `resolveVariable` ladder (live at runtime through `nodeTokens` for the relic sentences; only `default` rows ship, the other scopes are declared and validated), `cardKind` in `src/model/tree.js`; `objectKinds`/`objectIsKind` in `src/model/registries.js` | |
| Validation — parents, cycles, edges, families, variables ⇔ effects ⇔ bindings, balance paths, kinds ⇔ collections ⇔ card types | `treeProblems`, hooked into `validateContent` |

**Feel-neutrality, proved not claimed:** `tests/tree-equivalence.test.mjs`
compares everything the tree derives against three fixtures recorded before
the fold — 50 property rules resolved to their numbers, 58 framework rows with
`defaultParameters`, 137 tags / 13 domains / 56 pairings — row for row, and
names the additions (nine roots, 61 framework nodes now registered, 435 kind
rows, 24 pairings).

**Two switches, in the same phase (owner's ask):**

- *Templates bind by variable name.* A rule's sentence and a relic's sentence
  read a power's numbers as `{variable}` → `resolveVariable` (`tree.js`
  `nodeTokens`; `relicTokens(def, rules, registries)`), never by counting op
  positions; `{restoreMana.2}` is the variable `restoreMana_2`. The validator
  binds the same way (`nodeVariableBindings`) and keeps the "every
  player-visible number is stated" guard by carrying the op that reads each
  variable. Only a relic's own passives, which are not nodes, still bind by op.
- *Readers ask the kind, not the collection.* `cardKind(def)` reads the kind
  tag; the attack counter (`combat.js`, `coopCombat.js`), the card ref and
  `cardPlayed` receipt, the `cardTypeIs` predicate, `combatAnimation`, the
  combat screen's skill highlight, `consequence.js` and the framework
  importer's classification (`cardPropertyInstances`, from the junction's
  kind row) no longer touch `def.type`. A def with no kind row answers null,
  never quietly its type — so every fixture carries its kind rows too.

**A trade-off stated, not hidden:** the 435 kind rows restate what the
collection and `card.type` already say, and the validator calls that "one fact
stated twice" and checks it. They are kept authored because the owner's rule
is that the tag is the authority and the collection the check — a derived row
would make the tree the copy again — at the cost that every fixture and
prototype carries its rows (`withKindRows`, `combatBuilds.js`, the Add-edge
probe). `classification.strike/guard/weaponArt` are kinds no object carries
under the exactly-one rule; the importer derives them from the card's own kind
and the framework's relations.

**Not done here, deliberately:** the two `bound` nodes (`item/bound`,
`equipment.bound`) and the `presentation` mirror of the card schools are not
merged; `def.type` still exists on the card row as the authored word the kind
row is checked against.

## Phase 3 — Cards in zones; collection and deck (3 PRs)

**PR 3a: zones in run state.**

| Change | Where |
|---|---|
| `RUN_SHAPE` gains `zones: {core: id|null, worn: {body,head,hands,feet}, hands: {main,off}, passive: [relicIds]}` and `collection: [cardInstance]`; `deck` becomes the edited subset | `src/model/state.js:508`, `RUN_SCHEMA_VERSION` 7, era flag `preZones` |
| Migration: `loadout` slots → `zones.hands`/`zones.worn`; `relics` → `zones.passive`; `deck` copied to `collection`; `class` → `zones.core` (a class card id equal to the class id, phase 5 gives it content) | `migrateRunSchema` |
| `serializeRun`/`deserializeRun` and `validateRunShape` updated | |

**3a AS BUILT (2026-09-18):** `zones` and `collection` are a PROJECTION,
not a second authority. Thirty-one sites write `class`, `loadout`, `relics`
and `deck` (`armamentTrading`, `cardExtraction`, `cardRemoval`, the reward and
shop screens, `combatSnapshot`, `save.js`, …); flipping them is 3b's whole
job, and a phase that made zones authoritative while those writers still
wrote the old fields would be two homes for one fact with nothing keeping
them equal. So `projectZones(run)` reads the legacy fields, `syncZones` is
the one writer (creation, serialize, migrate), `validateRunShape` checks the
shape, and a save whose carried projection disagrees is re-projected with a
ledger note rather than refused. `worn.talisman` is included beside the
plan's four because the slot table already declares it. SPEC §13.4a.

**PR 3b: equipment rows become cards.**

| Change | Where |
|---|---|
| `src/content/equipment.js` armament and armour rows gain `cardType: 'equipment'`, `slot` (existing `SLOTS`), and are registered in the card registry with a `zone` field; `SCHEMAS.card` gains `zone?: en('draw','core','worn','hands','passive')` | schemas, registries |
| Armour slots split: `body`, `head`, `hands`, `feet` in `SLOTS`; existing armour rows map to `body`; new head/hands/feet rows ship as data with the slot→layer table from proposal §4 as mods | content |
| `reconcileGrantedCards` (`loadout.js:2011`) and `reconcileGrantedCardsInCombat` (`:2212`) reconcile against `collection`, and mark granted instances `locked: true` while their source is equipped | |
| Deck minimum: `balance.deck.minimum`, `balance.deck.minimumStepLevels`, `balance.deck.minimumPerStep` (as built); `deckMinimum(registries, run)` in `src/model/loadout.js`; the loadout screen's leave door refuses under-minimum by name | `src/ui/screens/equipment.js` |
| `figureSpec` (`loadout.js:2280`) reads `zones.worn` and `zones.hands`; `equippedFigure` (`assets.js:558`) accepts head/hands/feet layer ids and falls back to nothing when art is missing | |

**3b AS BUILT (2026-09-19):** the half of 3b that is feel-neutral shipped;
the half that changes what an object IS did not, and is 3b-ii below.

- The slot split is real: `equipSlots.csv` carries `head`, `hands`, `feet`
  (kinds of the same names, one set, out-of-combat swap) and `model/zones.js`
  is the one map from zone to slot, read by the projection, the figure and the
  slot table's door. No head/hands/feet PIECES ship: the proposal's §4 layer
  stats (typed resistance, evade charges, stamina recovery, impact dealt…) are
  mod fields the engine does not yet compute, and a piece authored against a
  field nothing reads is a number that does nothing. The pieces arrive with
  the fields, in the phase that gives the fields a reader (8 for exposure; the
  rest as their systems land).
- `figureSpec` draws from `projectZones`; `equippedFigure` layers the three
  new slots and draws nothing when the art is missing.
- The deck floor is `balance.deck` + `deckMinimum` + `loadoutLeaveRefusal`, on
  every player road out of the Armoury. It refuses what the screen did, never a
  deficit the run arrived with (a shop removal), so a door cannot trap a
  player. Measured before building: unequipping both hands takes a reaver from
  10 cards to 4, so the floor is live on day one, not dormant.
- The lock is `grantedBy`, which `canRemoveDeckCard` already refused; a
  `locked: true` flag would be a second home for one fact (3NF), so none is
  written. "Reconcile against `collection`" is a no-op while `collection` is a
  projection of `deck`, and stays unwritten for the same reason 3a's note gives.

**3b-ii (not built; needs the owner's call):** equipment rows joining the
card registry with `cardType: 'equipment'` and a `zone` field. Under the tag
tree every object states exactly one kind (`classification.armament`,
`classification.armour`); making a piece ALSO a card is a classification
decision — a second kind row per piece, or `card` becoming an ancestor of
`armament` in `nodes.csv` — and it changes every reader of
`registries.cards.all()` (rewards, shops, deck stamping, the 435-object
equivalence). It should be decided as a tree change first and a registry
change second, in its own PR.

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

**3c AS BUILT (2026-09-19):** the grip is READ, not stored. `gripOf` derives
`one`/`two`/`dual` from the two hand slots (a stored grip would be a second
home for a fact the hands already hold); the moment a grip CHOICE exists
(two-handing a one-hander) that choice becomes the stored intent and `gripOf`
its reader. The derived tags are framework nodes — `equipment.twoHanded`
(already authored) and `equipment.dualWield` (new) — so the predicate that
asks about them is validated against the tree like any tag. They ride the
card snapshot in solo and co-op combat as `derivedTags`, and the `cardPlayed`
event carries `cardTags` and `derivedTags`; the preview builds its card the
same way (and now reads the kind tag, which the tree phase had left at
`def.type` on that one site). `canEquip` refuses the one illegal grip (a
two-hander beside an occupied hand) when told what is going where — the same
rule the deck plan's gate already held at `cycleSet`/`equipPiece` by throwing,
asked earlier and with a sentence the Armoury's seal can show; the DEX gate on
`dual` is phase 9's row, as the plan sequences it. No shipped package
requires two hands, so `two` is dormant and proven with a probe registry;
`dual` is live (knife and sword). SPEC §13.4c; engine test 84.

## Phase 4 — Skill tracks (2 PRs)

**PR 4a: ledger and curve.**

| Change | Where |
|---|---|
| `RUN_SHAPE.skills: { [skillId]: {xp, level, pendingDrafts} }`, `RUN_SCHEMA_VERSION` 8, flag `preSkills` | `state.js` |
| Skill ids: one per armament group tag, per armour group tag, per focus group tag, `dualWield`, and `class:<id>` | derived from tag registry, validated |
| `src/model/skills.js`: `xpToNext(registries, trackKind, level)` (one curve shape, keys from proposal §10), `awardSkillXp(run, skillId, amount)` returning level-ups, `skillLevel(run, id)` | new |
| XP hooks in the engine: `damageDealt`/`blockGained` with a card tagged by group → `perHit`; `combatEnd` win → `perWinEquipped` per equipped group × `killMult` if that group dealt the killing hit; `impactDealt` to owner while heavy armour worn → `armorAbsorbPer`; `attackEvaded` while light → `armorEvadePer`; `arcaneExposureChanged` by owner → `focusBuildupPer` | `src/engine/combat.js` event listeners, no entity-specific code: the hooks read the tag registry |
| Predicates `skillLevelAtLeast` now read the ledger | |
| Simulator: `tools/runsim.mjs --skill-levels` reports levels per track per run | tools |

**4a AS BUILT (2026-09-19):** the tracks are DERIVED — `itemType` nodes for
weapon and focus groups, the framework's weight classes for the armour
groups (`armour:light|medium|heavy`, read off `playerWeightClass`, the one
home the game already has for "how heavy is what you wear"; no armour group
tags were authored, because a second home for weight would be exactly what
the tree phase removed), `dualWield`, and `class:<id>`. One listener on the
event bus (`engine/skillXp.js`) pays a receipt on the combat, keyed by seat;
the run is written once by its owner through `applySkillXp` — main.js,
tools/session.mjs and tools/runsim.mjs — so combat never writes a run.
`damageDealt` and `blockGained` now carry the card (`cardInstanceId`,
`sourceHand`, `grantedBy`) so a hook can pay the piece that lent it — kit,
package and weapon-art cards name their piece by the bare id the loadout
stamps, normalised through `cardMounts.ownerItemRef`. ALL THREE ARMOUR TRACKS
ARE DORMANT today: heavy's `impactDealt` fires for enemies only until phase 8
gives the player poise, and light's `attackEvaded` fires only under a
foundation ruleset, which no shipped door passes; the focus track's buildup
is live. Balance rows are named for what they are (`impactPerXp`, `evadeXp`,
`buildupPerXp`) rather than the proposal's "1 per 5" prose. The combat
snapshot carries the ledger and the receipt, so a fight resumed from a save
keeps what it earned. The shipped Siphon gate was re-pointed from `focus` to
the derived track id `item:magic-focus`, and `validate.js` now refuses a
gate on a name no track has. `pendingDrafts` accrues and nothing yet spends
it (4b). SPEC §13.4d; engine test 85.

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

**4b AS BUILT (2026-09-19):** drafts, rarity and auto-upgrade landed; the
smithing re-point did NOT, and is its own PR (4b-ii) — `model/smithing.js`
carries its own schema version and the smith panel's transaction, and a
door that offers cards should not also re-tier the forge in one review. Two
decisions to state: (1) the tree keeps a Blade ITEM TYPE and a Blade CARD
SCHOOL as distinct nodes, so "filter by group tag" had no single tag to
filter by — the schools a track drafts from are DERIVED from the held
piece's own card-domain tags in tagging.csv (`skillSchools`), falling back
to every piece of the type; an authored relation could replace that
derivation if the owner wants a tighter pool; the review round dropped
the "every piece of the type" fallback — a type no hand holds drafts
nothing and keeps its draft, since a union over the type handed a swordless
blade track guard and blood cards. A draft rolls at the door's own odds
(the boss's at a boss door, equal under Chaos Rewards) and still takes the
card row's seat, as the plan says. (2) Reward rows gained a KEY
(`rewardplan.js rowKey`) because one offer may carry several drafts and the
old `states[kind]` could hold one; singleton kinds keep the kind as key, so
saved offers still read. Co-op queues drafts and does not yet offer them
(its reward scene in tools/session.mjs is its own door). Review round:
the threshold is a STANDING RULE (every award at or past it, and the load
door reconciles an older ledger), it upgrades ORDINARY cards only — an
equipment-bound basic and an item-owned card read the smith's tier and are
re-derived by every restamp — and a draft row's key carries an ordinal so
two drafts of one track are two rows. Simulator: 6.5 drafts taken per run
over 8 runs. SPEC §13.4e; engine test 86.

## Phase 5 — Class card, kits, tree, unlocks, swap (3 PRs)

**PR 5a: class card and kits.**

| Change | Where |
|---|---|
| `src/content/classes.js` rows become core-zone cards: `cardType: 'class'`, `zone: 'core'`, `kit: [weaponId, abilityCardId, relicId]`, `favored: [groupTag]`; `favored<Group>` property rules (`skillXpMult` passive scoped to a group) and tagging rows `class,,<classId>,favored<Group>` | content, schemas |
| Four ability cards and four relics from proposal §4 authored in the class card CSVs and `relics.js` (as carriers) | content |
| `createRunState` (`state.js:63`) builds `zones.core` and injects the kit through the existing starting-kit path (`startingDeckPlan`, `loadout.js:1801`) | |
| `mountProperties` mounts the core card at run start and combat start | |

**5a AS BUILT (2026-09-19):** the class card is DERIVED (`model/classCard.js`)
from the class row, its free kit and its tagging rows — no `cardType`/`zone`/
`kit` fields were authored, because every one of them is a fact another row
already owns. Decisions to state: (1) the kit relic rides BESIDE the starting
relic (`kitRelic`, `run.relics = [startingRelic, kitRelic]`) rather than
replacing it — the starting relics carry the pool modifiers the HP/Mana
formulas and a dozen tests read, and a swap would have been a balance change
hidden in a content phase. (2) `favored<Group>` is ONE rule, `favored`, scoped
by the carrier's own item-type tag (`class,,reaver,item:blade`; the family
gained `class → itemType`) — a rule per group would have been N rows saying
one number. (3) The ability cards are authored to the nearest shipped word:
Brace is a stance (damage taken −25%, Block on entering, Strength on leaving)
rather than "impact taken −2", Attune restores Mana rather than discounting
the next cast's Stamina, Warm Litany heals and blocks without the overheal
charge, Prepare prepares without the cost discount — each needs vocabulary
the engine has not got, and the owner may want the proposal's exact words
when it does. (4) `startingDeckSize` is 11 (`roleCopies.ability: 1`). The
core zone mounts in solo, co-op (per seat) and on restore. SPEC §13.4f;
engine test 87.

**PR 5b: class tree.**

| Change | Where |
|---|---|
| Node = property tag with `requires: classLevelAtLeast N` and optional `excludes`; three tiers per class in `propertyRules.csv`; a tier-3 node may carry `presentation: {artKey, name}` which the core card renders instead of its own | content |
| Class XP source: `combatEnd` win, `questCompleted` (the event phase 10a adds; completing a journey node is not completing a quest), boss kill | engine |
| Draft screen for class level-ups reuses `rollSkillDraftIds` with the node list as the pool; picking writes a tagging row into `run.zones.coreTags` | `reward.js` |

**5b AS BUILT (2026-09-19):** the tree is a TABLE (`content/source/classTree.csv`)
rather than a `requires: classLevelAtLeast N` on each rule row — a tier is
the row's own column and the level it opens at is one balance list
(`skill.class.tierAt`), so the gate lives where the draft reads it, and
`requires`/`excludes` stay the relation rows the mount path already reads.
Six nodes per class (two per tier) rather than "about twelve": the shape is
complete and the count is rows. The pick is `run.coreTags` (schema 9),
projected as `zones.coreTags` — a projection cannot be written, so the
field is the run's and the zone reads it. Class XP is paid by the RUN'S
OWNER (the combat does not know the door's pool); quest XP waits for 10a.
No `presentation: {artKey, name}` column: the subclass node's own label and
glyph are the card's face, read off the row. The reward door is the tree's
only screen today. SPEC §13.4g; engine test 88.

**PR 5c: unlocks and swap.**

| Change | Where |
|---|---|
| Profile unlock table (`src/model/unlocks.js`) keyed by class card id; conditions as data rows (`winAs`, `classLevel`, `bossWithGroup`) | |
| Class-swap item: a run opcode `swapClass {classId}` in `RUN_OPCODES`; authored on one event and one boss reward; replaces `zones.core`, clears `coreTags` not permitted by the new class, resets `skills['class:*']` | `actions.js:810` run-effect door |
| Character-creation screen lists unlocked class cards from the profile | `src/ui/screens/` creation |

**5c AS BUILT (2026-09-19):** the unlock table gained a `class` kind and two
conditions (`classLevel`, `bossWithGroup`); no shipped class is gated, so the
gate is a row the owner may write, and the creation screen lists a gated
class locked with the row's hint. The swap is the run opcode `swapClass`
(named or `random`), shipped on ONE door, the Turncoat's Mirror event; the
boss-reward door is NOT shipped — a reward row is a kind of its own and
which boss gives it is the owner's call. The swap keeps the deck, relics,
loadout, attributes and weapon skills, resets every class track, prunes the
tree picks the new class has no seat for, and does not deal the new class's
kit (the run was born once). Progress records `maxClassLevel` and the item
types each boss fell to. SPEC §13.4h; engine test 89.

Acceptance: four classes start from core cards with kits; a tier-3 node
swaps art and name; an old save with `run.class` loads with its core card
mounted; class swap removes disallowed tags and keeps weapon skills.

## Phase 6 — Character level and cinders (1 PR)

| Change | Where |
|---|---|
| `RUN_SHAPE.level: {xp, level, unspentPoints}`, `RUN_SCHEMA_VERSION` 9, flag `preXpLevels`; migration sets `level` from `levelUps.length` | `state.js` |
| `levelCost` / `levelsAffordable` (`src/model/levelup.js:63,83`) replaced by `xpToNext` on the `level.xp.*` rows; `applyLevelUp` no longer touches `run.cinders` | |
| XP awards on `combatEnd` win, `enemyDied` by tier, `questCompleted` | engine |
| Threshold bumps: `derivedStats.js` rules gain `perLevelThreshold: {every: 5, hp, mana, stamina, draw}` | content |
| Level-up panel in `src/ui/screens/rest.js:133` becomes the town/level-up service (phase 7 places it); no cinder line | UI |
| `balance.levelUp.firstCost/costStep` removed; `tools/runsim.mjs --level-cost` replaced by `--xp-levels` with the 10–20 band assertion | |

Acceptance: simulator measures levels per run in band; no code path spends
cinders on a level.

**6 AS BUILT (2026-09-19):** `run.level = { xp, level, unspentPoints }` at
schema 10 (a ≤ 9 save arrives at `1 + levelUps`, nothing waiting);
`model/levelup.js` owns the curve (`xpToNext` on `balance.level.xp`, the
skills' shape), the climb (`awardLevelXp`, the dial's points per level to
the ledger, `maxLevels` the cap) and the assignment (`applyLevelUp` spends
one waiting point; `levelUps`/`levelPoints` still count every assignment for
the load door). The run's owner pays `combatLevelXp` — a win, each kill by
the door's pool — in `main.js`, `tools/session.mjs` and `tools/runsim.mjs`;
`questLevelXp` names the quest award for 10a's door. The threshold bumps are
NOT a `perLevelThreshold` object on the table but a `perLevel: { every,
gain }` term per derived-stat row, snapshotted with the row and read by
`deriveStat` at the run's level (HP/Mana/Stamina every five, Hand every
ten), so no old save is re-priced. The shrine's Level-up card assigns the
waiting points and names no cinder; `levelCost`/`levelsAffordable` and
`balance.levelUp.firstCost/costStep` are gone, `--level-cost` is
`--xp-levels` with the band line. The proposal's awards paid 6.7 levels a
full run on this map; raised ×2.5 they measure 11.5, in band. SPEC §13.4i;
engine tests 60–60e, 90.

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

**7 AS BUILT (2026-09-19):** the `location` family (no collection; ids are
the map's — a classic node type, `camp`, an atlas service type, an atlas
node — checked by `model/locations.js`) carries the property subtree;
`engine/locations.js` is the window (`createLocationVisit` mounts on the
run-level context `actions.js createRunContext`, now the one facade for
events, flasks and visits; `arriveAt` / `restAt` emit the two new events and
write the pools back; `previewRest` on a clone; `leaveLocation` unmounts).
Rules: `restHpSmall/Partial/Full`, `restManaFlat/Floor/Full` (the
`restoreMana` opcode gains `toFloorPct`; `missingMana` joins the formula
ops), `restFlasks` (a new run opcode `refillFlasks` wrapping
`applyGraceRefill`), and `smith` / `levelUp` as service markers. `restMana`
is the default, resolved at the carrier to `balance.rest.mana.mode`'s tag
(shipped `floorOrFull` at 50%) — NOT a mode read inside the rule, because a
variable binds to a number and the mode is a word. Shipped sets: shrine,
camp (the Unknown node's rest outcome, `enterNode`), inn and chapel (the
atlas rest services, one row per type; a node row would override). Not
shipped from §7.4: `restAzureOne` (no Azure charge kind exists),
`restCleanse` (nothing lingers between fights), `ambushRisk` (a seeded
encounter roll is its own feature), `merchant` / `questBoard` markers (no
carrier today; 10b's board may add one). The passives are `restHealMult`
and `restDenied` (true | tag list; the Wyrm Heart carries
`['restHpPartial']`). The heal multipliers ride `ctx.healMult`, never the
rule. `generateJourney` takes `{ townsPerActMax }` and counts city nodes
per act (the start is not a stop; every shipped city is act 1 and a route
holds one hub, so the shipped cap of 1 changes no seeded route). Note the
retunes this design carries: the shrine's Rest used to restore Mana to
full; under the default mode it restores to 50% or full. The Unknown
node's rest outcome used to open the Shrine (35%, refill, smith,
level-up); it opens the camp now (25%, Mana, nothing else). SPEC §13.4j;
engine test 91, local-map and world-atlas tests.

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

**8 AS BUILT (2026-09-19):** `balance.mana { minActionCost 1, minStaminaCost 1 }`
and the card rule (base and upgrade); `balance.exposure.buildupPerManaSpell`
5 with its floor on `cardExposure.csv`; `staggerBreak` and `resonance` rules,
the new opcode `arcaneBuildup` and target `otherEnemies`, carriers by item
(every focus is a `staff` kind: the plain staves break harder, the rod and
the brand overcharge, the branch rings out); the player's poise meter via
`dealPoiseDamage` and `staggerPlayer`, `balance.stagger.player { actionLoss,
statuses }` (a status map, so the engine names no status), the receipt's
Constitution term as `balance.poise.playerPerConstitution`; outside the
foundation ruleset (the shipped fight has none) an enemy blow that draws
blood rocks the player by `balance.poise.playerImpactPerHit`. Two deviations,
both deferred to phase 9 on purpose: the signature arts cost 1 stamina / 1
Mana, not 2 / 2 — under the current tiers the Reaver and the Rogue start
with a one-point Mana pool and the Starseer and the Herald with one stamina,
so 2 / 2 would strand two signature cards until Mana equals Wisdom; and the
Poise derived-stat row, since phase 9 rewrites the ruleset and every save
snapshots it. Also re-costed under the rule: Comet Fragment costs an action;
seven Mana powers' upgrades drop the Mana line instead of the action line.
SPEC §13.4k; engine test 92; property-mount tests.

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

## Phase 10 — Quests: completion, board, and dialogue (2 PRs)

Proposal §7.5. Both halves ship: a quest completes through one door, and every
quest exchange is spoken in the dialogue screen (W4c, WGQ0–WGQ8).

**PR 10a: completion door and dialogue screen.** Needs nothing else in this
plan; land it before 5b so class XP has a quest source.

| Change | Where |
|---|---|
| `commitEventChoice(ctx, {eventId, choiceId})`: run effects, then `recordEventChoice`, then the completion check. The Event screen's inline commit (`executeRunEffects` + `recordEventChoice` inside `mountEvent`, `src/ui/screens/event.js:148`) calls it instead | new `src/engine/quests.js` |
| Chain quest ids: sidecar `questChains = { [questId]: { steps: [eventId], completes: [{eventId, choiceId}] } }` beside the history gates; Grave of the Nameless ships as `nameless`, completing on the three non-Leave `namelessRest` choices | `src/content/events.js` |
| `recordQuestCompletion(run, {questId, source})` appends `{kind: 'questCompleted', questId, source}` to `run.history` at most once per quest; `hasQuestCompletion(subject, questId)` | `src/model/quests.js` |
| Event `questCompleted` in `EVENTS`, emitted only by the door | `src/model/schemas.js:91`, engine |
| Atlas claim: the quest branch of `worldLocationAction` (`src/main.js:1584`) calls the door with `source: 'atlas'` when `plan.next === 'claimed'` | `src/main.js` |
| Speakers: `content/source/speakers.csv` (`id,name,portraitKey`) compiled to `src/content/generated/speakers.js`; sidecar `eventSpeakers = { [eventId]: speakerId }`; atlas `quests` rows gain `speakerId` | `tools/content-build.mjs`, content |
| Validation, refusals by name: every chain step and `completes` ref resolves; every chain event names a speaker; every named speaker exists; a Leave choice may not complete a quest | `src/model/validate.js` |
| `DialogueModel`: pure. Beats from the event text split on blank lines; player left, speaker right; responses from `availableEventChoices` on the last beat only; Back, Skip speech and Continue states. No command but a response | new `src/ui/models/DialogueModel.js` |
| Dialogue screen adapter renders WGQ0–WGQ8; `dialogue` block in the frozen wireframe config (portrait share, caption lines). Scan the config for duplicate top-level keys | new `src/ui/screens/dialogue.js`, `src/content/wireframeUi.js` |
| `mountEvent` routes a chain event to the dialogue screen; one-off events keep the W1u choice body | `src/ui/screens/event.js` |
| Copy through `t()` | `content/source/uiStrings.csv` |
| No `RUN_SHAPE` change: completion rows live in the existing `run.history` | |

Acceptance, headless: committing a completing chain choice writes one
`questCompleted` row and emits one event; a reload or replay of the same
commit writes none; claiming an atlas quest does the same with
`source: 'atlas'`; Back, Continue and speech ending issue no command.
In the UI: each Nameless step opens in dialogue with its speaker on the right;
Continue walks the beats; responses appear only on the last beat; a missing
portrait shows the name plate.

**PR 10b: the board as a location service.** After phase 7.

| Change | Where |
|---|---|
| The `questBoard` tag renders a board in `enterLocation`: atlas quests offered at the node with their `questAction` state, and a journal of the run's started and completed chains read from `run.history` | location screen (phase 7) |
| Accept and Collect open the dialogue screen with the quest row's speaker; the response commits through `questAction` and the 10a door | |
| The atlas screen's own quest list (`src/ui/screens/worldAtlas.js:244`) opens the board where the location has one | |

Acceptance: a town lists its quests; accepting and collecting are spoken; a
collected quest shows as done and rewards once.

## Sequencing and parallelism

```
1a → 1b → 2 ─┐
             ├→ 3a → 3b → 3c → 4a → 4b → 5a → 5b → 5c → 6 → 9
      8 ─────┘ (after 1b)              7 (after 3a)
10a (any time, before 5b)              10b (after 7)
```

Phases 7 and 8 need only phases 1 and 3a. Phase 9 waits for 6 because the
thresholds and the rebase both rewrite `derivedStats.js`. Phase 10a touches
none of the other phases' files except `EVENTS` and can land first.

## Risks and their tests

| Risk | Test that catches it |
|---|---|
| A property mounts twice on re-equip | `propertyMounts` key uniqueness assertion in `mountProperties`; test equips, unequips, re-equips and counts triggers |
| Relic migration changes a text string | phase-2 snapshot fixture |
| Deck under minimum after unequip mid-run | loadout leave door test |
| Skill XP farmable by 0-cost spam | XP requires a resolved hit on a live target; test plays a 0-cost skill 20 times and asserts zero XP |
| dev moves under a receipt | each PR writes its receipt one ordinal ahead and rebuilds after the final base merge, as in #985 |
| A quest completes twice (reload, replay, a second claim) | 10a test commits the completing choice, reloads, commits again, and counts one `questCompleted` row and one event |
| Dialogue grants an effect outside a response | `DialogueModel` test drives Back, Continue, Skip speech and speech ending and asserts no command |
