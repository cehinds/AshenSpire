# Tag system and 3NF — design intent

Carried over from AshenSpire. This file keeps the **intent** of the tag system
and the third-normal-form content contract. It keeps no content rows and no
code: the tables below describe what each relation means and why it is shaped
that way. Everything here is extracted verbatim from AshenSpire sources (named
in each heading) so the reasoning is preserved in the owner's words; paths
inside quoted text refer to the original project and may not exist here.

## 0. The rules in one screen

1. **One vocabulary.** Every tag anything carries is a node in one tag tree.
   A node's parent is its `parentId` and nothing else; an id's spelling is an
   opaque key, never structure.
2. **One home per fact.** A tag is written in exactly one place: one row in
   the `tagging` association table, `(family, scope, objectId, tagId)`. No
   inline `tags` column, no list in a cell, no second copy kept in sync by a rule.
3. **Families are data.** What can be tagged is a row (`tagFamilies`); which
   subtrees a family may carry is a row per pair (`familyNodes`). Adding a
   family or a vocabulary is a spreadsheet line, not a code change.
4. **Relations between tags are rows.** `requires`/`excludes` are edges
   (`INHERITS · PERMITS · REQUIRES · CONFLICTS_WITH · SUPPRESSES · REPLACES`),
   not columns.
5. **Nodes carry no numbers.** A conferring node's effects name variables;
   variables are declared per node; what a variable is worth is a binding to a
   balance row, resolved by scope (`instance › upgrade › class › default`).
6. **Tags classify and select; they do not replace typed data.** Numbers,
   relationships and state machines stay in typed relations. Presentation tags
   select sprites and never change mechanics.
7. **3NF is about functional dependencies, not file format.** CSV, JSON and a
   database are adapters over the same relations. Derived indexes, joined view
   models and compiled bundles may be denormalized — they are regenerated,
   never edited.
8. **The validator refuses by name**: unknown family, unknown tag, tag outside
   the family's subtrees, dangling object id, missing/extra scope, duplicate row.

## 1. Relations of the tag system

| Relation | Key | Meaning |
|---|---|---|
| `nodes` | `id` | The tag tree: `id, parentId, label, color, glyph, visibility, priority, domain (roots only), aside (roots only), blurb` |
| `nodeRelations` | `(sourceId, relation, targetId)` | Typed edges between nodes, with `precedence` |
| `nodeTerms` | `nodeId` | Player-facing words for the few nodes that reach the player; `template` with `{variable}` tokens |
| `nodeVariables` | `(nodeId, variable)` | Variables a conferring node's effects name, with `role` |
| `variableBindings` | `(scope, scopeId, nodeId, variable)` | What a variable reads (`balancePath`) in a scope; literal numbers refused |
| `nodeEffects` | `nodeId` | Effect list of each `property` node (DSL, not code) |
| `tagFamilies` | `family` | What can be tagged: `source` collection, optional `scopeField` |
| `familyNodes` | `(family, nodeId)` | Subtree a family may draw from |
| `tagging` | `(family, scope, objectId, tagId)` | THE only home of a tag on anything; file order = chip order |

### Root vocabularies of the original tag tree

| Root | Framework domain | Aside | Intent |
|---|---|---|---|
| `card` |  |  | What a card IS — its school, form and feel. Carried by cards, by the classes that lean on them, and by the equipment that rewrites them. |
| `creature` |  |  | What a creature IS. Gates proc resistance, and the one domain the engine reads at runtime. |
| `item` |  |  | What a piece of gear DOES beyond its numbers, and what a run pickup is. |
| `run` |  |  | Run structure — what an event, an encounter or an unlock is about. |
| `itemType` |  |  | What a piece of equipment IS, as the Armoury and the smith name it. Distinct from the card domain: a Blade item type and a Blade card school are different facts about the same sword. |
| `grantSource` |  |  | Where a starting card came from. The composed deck deals bound cards in this vocabulary's authored order, so adding a source is a row here rather than a code change. Nothing WEARS these — the `grant` family exists to declare them, the way `effect` declares which words a damage effect may carry. |
| `presentation` | PRESENTATION | true | Sprite selection only; never damage or resistance identity. |
| `attackSource` |  |  | Source profile supplying an attack; separate from damage type. |
| `delivery` |  |  | How a direct attack reaches its targets. |
| `damageType` |  |  | Identity of a typed HP damage component. |
| `technique` |  |  | Conditions for explicit technique bonuses. |
| `theme` |  |  | Build synergies; tags alone grant no effects. |
| `property` |  |  | What a holder CONFERS while it is held. Each property node has exactly one entry in nodeEffects.json; the holder grants it, and it leaves when the holder does. EVERY family may carry one — what the mount path can hold (worn, owned, chosen) is the engine's narrower list, engine/properties.js MOUNTABLE_KINDS. |
| `classification` | CLASSIFICATION | true |  |
| `damage` | DAMAGE |  |  |
| `scaling` | SCALING |  |  |
| `cost` | COST |  |  |
| `lifecycle` | LIFECYCLE |  |  |
| `equipment` | EQUIPMENT |  |  |
| `utility` | ACTION_ROLE |  |  |
| `targeting` | TARGETING |  |  |
| `internal` | INTERNAL |  |  |

### Taggable families of the original game

| Family | Scope field | Intent |
|---|---|---|
| `card` |  | Every playable card. |
| `class` |  | A class's identity in card terms — what it leans toward. |
| `relic` |  | Permanent run pickups. |
| `flask` |  | Consumables, refilled at Grace. |
| `keepsake` |  | The boon you start the run holding. |
| `event` |  | Unknown-node encounters. |
| `encounter` |  | Authored fights. |
| `enemy` |  | Creature identity; gates proc resistance at runtime. |
| `armament` |  | Weapons, shields and staves. |
| `armour` | classId | Armour sets. Ids repeat per class, so classId is part of the key. |
| `basicCardProfile` |  | Equipment-bound core card profiles. |
| `slot` |  | What you can wear, and when you may swap. |
| `startingKit` |  | A class's listed opening loadout. |
| `unlock` |  | What a run can earn. |
| `effect` |  | Damage effects carry card tags; a hit inherits the card's identity. |
| `grant` |  | Where a starting card comes from. No collection: like `effect`, this family exists only to declare a vocabulary — the order bound cards are dealt in. |
| `location` |  | Where a run stops: a classic node type (shrine), the Unknown node's camp, an atlas rest service's type (inn, chapel) or one atlas node by id. No collection — the ids are the map's, checked by model/locations.js. Mounted from arrival to departure (engine/locations.js). |

## 2. Table headers (verbatim from `content/source/*.csv`)

### `nodes`

```text
content/source/nodes.csv — THE tag tree (Ashen Spire)

One tree for the whole vocabulary. Every tag any object carries — a card's
school, a weapon's type, a creature's kind, what a relic confers, what a card
IS — is a node here, and a node's place in the tree is its parentId and
nothing else. Roots are what used to be called domains (tagDomains.csv) and
the framework's family roots (content/framework/properties.json); both files
are gone, this is their one home.

THIRD NORMAL FORM, and the three things that means here:
  parentId is the ONLY home of the parent. Some ids carry a dotted spelling
    (lifecycle.recall.afterUse) from the framework era; that is an opaque key
    kept so no reader had to change, not structure — the validator reads the
    tree from parentId and never from the id.
  domain is written on ROOTS ONLY. A child's domain is its root's, so writing
    it on every row would repeat a fact the tree already states.
  requires/excludes are not columns. They are rows in nodeRelations.csv.

color/glyph are the chip the tag renders as; framework-era nodes have none and
render no chip. visibility/priority are the framework's (INTERNAL nodes are
never player-facing); a node with neither is one the framework never reads.

aside (ROOTS ONLY): true for a root whose tags never join an object's tag
LIST because they have a reader of their own — presentation is sprite
selection (tagService.presentationIdsOf), classification is what the object
IS (registries stamps it as `kindIds`, read by objectKinds). A mechanic asking
"what tags does this carry" is asking about gameplay identity, and neither of
those is that. Stated on the root, once, and read by every list reader.

columns: id, parentId, label, color, glyph, visibility, priority, domain, aside, blurb
```

### `tagFamilies`

```text
content/source/tagFamilies.csv — what can be tagged (Ashen Spire)

One row per content family. Adding a family to the tag system is a row here,
not a code change. Every family is tagged the same way — a row in tagging.csv
— so there is no `home` column any more and no second place to look.

source      where the family's objects live in the content bundle, dotted. The
            validator walks it to check every tagged id is a real object. Empty
            means the family is not a bundle collection: `effect` exists only to
            declare which domains a damage effect's tags may draw from.
scopeField  the field on the object that disambiguates its id, or empty when the
            id is unique on its own. `armour` names classId because outfit ids
            repeat across classes on purpose; tagging.csv rows for that family
            must carry the matching scope.

Which domains a family may carry is tagFamilyDomains.csv — one row per pair,
because a family carrying two domains is two facts, not one cell.

columns: family, source, scopeField, label, blurb
```

### `familyNodes`

```text
content/source/familyNodes.csv — which SUBTREE a family may draw from

Replaces tagFamilyDomains.csv. A row (family, nodeId) says objects of that
family may carry any node under nodeId. Pointing at a root is the old
family×domain pair; pointing at a branch is new and narrower. Every
collection-backed family points at classification, because every object
states its kind (validate.js refuses one that does not).

columns: family, nodeId
```

### `tagging`

```text
content/source/tagging.csv — who carries which tag (Ashen Spire)

THE association table, and the ONLY home for a tag on anything. One row per
(family, scope, objectId, tagId) — third normal form, so there is no cell
holding a list and no second place a tag can be written.

WHY ONE ROW PER TAG rather than a pipe-separated cell: a repeating group in a
cell is a 1NF break, and it is what let the old inline `tags` columns exist as
a second home. With one row per tag there is nothing to keep in sync — a tag
is a row, and adding one is adding a row.

family    a row in tagFamilies.csv. That row names the collection the objectId
          must exist in, and (via familyNodes.csv) the subtrees it may carry.
scope     the value of the family's `scopeField`, or empty when it has none.
          Only `armour` uses it today: outfit ids repeat per class, so classId
          is part of the parent key and must be part of this one.
objectId  the id of the thing being tagged, in that family and scope.
tagId     a node in nodes.csv, under a subtree the family is paired with.

Display order is file order: the first row for an object is its first chip.

The validator refuses, BY NAME: an unknown family, an unknown tag, a tag from a
domain that family may not carry, an objectId no object has, a scope on a family
with no scopeField (or a missing one on a family that has one), and a duplicate
(family, scope, objectId, tagId).

columns: family, scope, objectId, tagId
```

### `nodeRelations`

```text
content/source/nodeRelations.csv — edges between nodes (Ashen Spire)

One row per edge. The verbs are the framework's, closed (src/model/schemas.js
NODE_RELATIONS): INHERITS · PERMITS · REQUIRES · CONFLICTS_WITH · SUPPRESSES ·
REPLACES. CONFLICTS_WITH is symmetric; the rest read source → target.

PERMITS is what "a kind automatically inherits the methods of that kind"
means in data: classification.attack PERMITS damage says an attack may carry
the damage subtree. A property rule's old requires/excludes columns are
REQUIRES and CONFLICTS_WITH rows here — a list in a cell was the one 1NF
break the old table still had.

columns: sourceId, relation, targetId, precedence
```

### `nodeTerms`

```text
content/source/nodeTerms.csv — the player-facing words a node has, if any

Split from nodes.csv because most nodes have none: a term row only where the
node reaches the player. playerTermId/tooltipTermId are ids into
content/framework/terms.json (the framework's words for a card property);
template is a conferring node's own sentence, whose {tokens} are its
variables (nodeVariables.csv) — {poiseDamage} reads the variable poiseDamage.

columns: nodeId, playerTermId, tooltipTermId, template
```

### `nodeVariables`

```text
content/source/nodeVariables.csv — the variables a conferring node exposes

A NODE CARRIES NO NUMBERS. Its effects (nodeEffects.json) name variables, and
this table declares them: one row per (node, variable), with the role the
variable plays (amount, stacks, pct, hits, n, level, or a passive key).
validate.js refuses an effect naming a variable this table lacks, and a row
here that no effect names.

What a variable IS WORTH is variableBindings.csv, never here.

columns: nodeId, variable, role
```

### `variableBindings`

```text
content/source/variableBindings.csv — what each variable reads, per scope

One row per (scope, scopeId, node, variable): the balance.js row that
variable is worth in that scope. Resolution is a ladder, highest scope wins:
  instance › upgrade › class › default
  default   scopeId ''             the shipped tuning
  class     scopeId a class id     a class's own tuning of a shared node
  upgrade   scopeId a level        the smith's tier table (per copy, per run)
  instance  scopeId an instanceId  this one copy
Only default rows ship today; the other scopes are the shape phase 2b needs
for per-copy relic passives, so they are declared and validated now.

NUMBERS LIVE IN src/content/balance.js. balancePath names a row there; a
literal number in this column is refused by name.

columns: scope, scopeId, nodeId, variable, balancePath
```

## 3. Architecture laws (SPEC.md §3.1)

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
4. **All tuning is data.** `content/balance.js` holds every global constant (energy 3, draw 5, the fallback hand capacity `handMax` 5, reward odds, rune ranges, prices, flask drop decay). A balance change is a one-file data diff.
5. **Headless engine.** Nothing under `src/engine/` or `src/model/` references `document`, `window`, `localStorage`, or timers. A combat runs to completion from `tests/index.html` with no UI imports.
6. **Budgeted escape hatch.** `content/scripts.js` is a registry of named custom behaviors for what the DSL can't express. Target <5% of content; every entry carries a comment justifying why the DSL couldn't do it. A script pattern appearing twice gets promoted to a DSL primitive (engine PR).

### Tag tree entity (SPEC.md §3.3)

`content/source/nodes.csv` — `id, parentId, label, color, glyph, visibility, priority, domain, aside, blurb`. THE one vocabulary: every tag any object carries is a node, and a node's parent is `parentId` and nothing else (an id's dotted spelling is an opaque key). Roots are domains; `domain` (the framework's enum word) and `aside` (a root whose tags never join a tag list — `presentation`, `classification`) are written on roots only. Companions: `nodeRelations.csv` (`sourceId, relation ∈ NODE_RELATIONS, targetId, precedence`), `familyNodes.csv` (family × subtree root — who may carry what), `nodeTerms.csv` (`playerTermId, tooltipTermId, template`), `nodeVariables.csv` (`nodeId, variable, role` — a node carries no numbers), `variableBindings.csv` (`scope ∈ VARIABLE_SCOPES, scopeId, nodeId, variable, balancePath` — what a variable reads, per scope; `instance › upgrade › class › default`), `nodeEffects.json` (`{ [nodeId]: { passives?, triggers? } }` naming variables). Derived from it: the five tag tables, the property rules, and `src/framework/data/{properties,relations}.js`. Every collection-backed object carries exactly one `classification.*` node, stamped as `kindIds` (§3.14)

### A weapon's category is its tags (SPEC.md §3.8)

**A weapon's category is its tags** — `heavy`, `flourish` — never a `swapCost` column, because a
column would compel an author to restate what the tags already imply (Law 0 clause 1). The two
rule fields are closed and **their product is total**: all four cells price a swap, and a fourth
rule is one row of `swapCostRules` with no code (proven by test 28q).


## 4. Authoritative content is 3NF (SPEC.md, World Journey)

Authoritative content is in third normal form. Maps, regions, nodes, placements,
edges, assets, enemies, encounters, pools, services, quests and profiles have stable
primary keys. Many-to-many relationships use junction tables. Local region IDs
are derived through their owning world location; node rows do not copy map or
region labels. Handler bindings belong to service types, not repeated placements.
CSV and JSON imports use the same relational table contract as the database and
reject duplicate keys, invalid references and unsupported rules atomically.
Runtime indexes, joined view models and immutable run manifests are derived read
models; they are not competing authoring sources. Content revisions identify the
exact rules used by a run. A revision mismatch must be explained instead of
silently regenerating the route.


## 5. The 3NF contract (architecture handoff, EXECUTION-PLAN §5, §5.2, §6.2)

3NF is evaluated over logical relations and functional dependencies, not file format. For every nontrivial functional dependency X → A, X must be a superkey or A a prime attribute. In practice, document all candidate keys and make each non-key fact depend on the key, the whole key, and no other non-key fact. A surrogate ID does not repair hidden transitive dependencies.

For each relation, record: purpose, columns/types/null rules, primary key, candidate keys, foreign keys, functional dependencies, ordering, deletion behavior, and source owner. Enforce duplicate/foreign-key/type constraints mechanically. A schema review establishes dependencies; validation cannot prove that an undiscovered business dependency does not exist.

Rules:

- No pipe-separated relationship IDs or arrays of foreign keys in authoritative cells. Existing compiler coercion of `a|b` is legacy behavior; disable it for normalized tables using typed parsing, not a global behavior change.
- Ordered relationships use a child relation with an ordinal and a uniqueness constraint scoped to the parent.
- Entity definitions and owned instances are distinct. A definition's name/type does not belong in every instance.
- Existing scoped item identity must survive: `(family, scope, objectId)` remains a validated key until an explicit migration says otherwise. Never assume IDs unique across classes/families.
- Existing `tagDomains`, `tagFamilies`, `tagFamilyDomains`, `tags`, and `tagging` remain the tag authority. Validate the polymorphic tagging target against its family and scope. A database adapter must preserve this integrity using validated export and appropriate database constraints; it must not claim a bare polymorphic FK is enforced by ordinary SQL.
- Do not model every attribute as generic `(entity, key, value)` text. Use typed relations and typed rule operands. Tags classify and select; they do not replace numeric columns, relationships, or state machines.
- Authoritative JSON may encode named arrays of relation rows. Nesting is transport grouping, not permission to repeat shared facts.
- Derived runtime indexes, projected component trees, and compiled bundles may be denormalized. They are regenerated, never edited.
- Save snapshots and transaction receipts are historical facts. A receipt's charged price is not a duplicate of today's price rule. Preserve existing save envelopes initially; normalized logical runtime relations do not require a destructive save-format rewrite.

For each family preserve its actual candidate keys; do not impose a speculative universal Item table. Separate, as applicable: definition, ordered effects, requirements, grants, tags, pool membership, asset associations, and owned instances. For example:

```text
WeaponDefinition(weaponId PK, nameTextId, weaponTypeId, ...intrinsic scalar facts)
WeaponRequirement(weaponId, attributeId, minimum; PK weaponId+attributeId)
WeaponGrant(weaponId, roleId, ordinal, cardId; PK weaponId+roleId+ordinal)
OwnedWeapon(instanceId PK, runId FK, weaponId FK, upgradeLevel)
```

First document whether grants can repeat, whether requirements vary by tier, and whether weapon IDs are scoped. Extend the key/relations accordingly before writing data. The sample is a pattern, not an audited replacement schema for all existing equipment.

```text
FUNCTION eligibleServiceItems(serviceId, registries, snapshot):
    service = registries.services.require(serviceId)
    required = registries.serviceRequiredTags.forService(serviceId)
    excluded = registries.serviceExcludedTags.forService(serviceId)
    candidates = existingOwnershipQuery(snapshot)
    RETURN candidates WHERE
        sharedTags.hasAll(candidate.identity, required)
        AND NOT sharedTags.hasAny(candidate.identity, excluded)
        AND existingDomainPlannerAllows(service, candidate, snapshot)
```

Tags narrow capability; runtime conditions still belong to the domain planner. Possessing an `upgradeable` tag does not prove ownership, affordability, legal level, or a compatible mount.

## 6. Worked example: world atlas functional dependencies (WORLD-ATLAS.md)

The source is 3NF under these functional dependencies:

| Fact | Key and ownership |
| --- | --- |
| Map title and art | `maps.mapId` |
| World location's region and difficulty | `world_nodes.nodeId` |
| Node title, description and type | `nodes.nodeId` |
| Placement on a world map | `(world_map_nodes.mapId, nodeId)` |
| Local map owner | `local_maps.mapId`, with unique `ownerNodeId` |
| Fixed local placement | `local_map_nodes.nodeId` |
| Directed road and gate condition | `edges.edgeId`, unique map/from/to |
| Pool membership weight | `(enemy_pool_members.poolId, enemyId)` |
| Explicit encounter override | `node_encounters.nodeId` |
| Handler for a service type | `service_types.serviceTypeId` |
| Offered service or quest | Junction keys `(nodeId, serviceId/questId)` |
| Possible city-gate destinations | `(local_gates.nodeId, destinationNodeId)` |
| Profile and generation budgets | `run_profiles.profileId` |
| Ordered anchor rule | `(profile_anchors.profileId, roleId)` |
| Pins, exclusions, quotas and weights | Their declared profile/role/content keys |

No node copies its region's name or its map's art URI. A local point's region is
derived through its owning world node. `resolved_node_regions`, `map_nodes`, and
`resolved_service_handlers` are SQL views, not extra editable tables. Enemy and
encounter tables contain only reference IDs: names, statistics and enemy behavior
remain in the existing canonical registries. This is a normalized atlas content
contract, not a claim that every pre-existing AshenSpire subsystem is normalized.

## 7. Worked example: progression storage (PROGRESSION-SPECIFICATION.md)

| Relation | Key and facts |
|---|---|
| ProficiencyCategory | category_id PK; category_name |
| ProficiencyDefinition | proficiency_id PK; category_id FK; name_key; description_key |
| CharacterProficiency | character_id FK + proficiency_id FK composite PK; accumulated_practice |
| ProficiencyThreshold | proficiency_id FK + rank composite PK; required_practice |
| TechniqueDefinition | technique_id PK; name_key; description_key |
| ProficiencyUnlock | proficiency_id + rank + technique_id composite PK/FKs |
| PracticeEvent | event_id PK; character_id FK; proficiency_id FK; source_event_id; awarded_practice; occurred_at |
| KnownTechnique | character_id + technique_id composite PK/FKs; discovery_event_id FK |
| TagDefinition | tag_id PK; tag_name |
| ProficiencyTag | proficiency_id + tag_id composite PK/FKs |

Do not store rank or next threshold in CharacterProficiency when they are derived from accumulated practice and threshold definitions. Do not copy category names into proficiency rows, technique names into unlocks, or current totals into events. Choose events as the authority with a rebuildable totals projection, or a transactional total plus audit events; never maintain unrelated competing totals. Enforce award idempotency with a unique source-event/proficiency/character constraint, or a configured award sequence where one source can intentionally award multiple times. JSON/CSV imports represent these same relations and validate foreign keys before publication. View models may denormalize names and meter values for rendering.


## 8. Worked example: location presentation (location-presentation/README.md)

- settings, times, weather: one row per vocabulary ID.
- profiles: profileId primary key; regionId and settingId foreign keys. A region/setting pair identifies one profile.
- nodeProfiles: nodeId primary/foreign key; profileId foreign key. No repeated region, setting, scene path or display name.
- scenes: sceneId primary/foreign key to the existing environment art catalog; timeId and weatherId foreign keys. Texture paths, crop rectangles and floor anchors remain in the existing catalog.
- sceneProfiles: composite key (profileId, sceneId); weight depends on that pair.
- music: musicId primary key; future audio asset metadata belongs here.
- musicProfiles: composite key (profileId, musicId); weight depends on that pair.

These relations use atomic values and store descriptive facts only with their owning key (3NF). Runtime save snapshots are resolved output, not additional authored sources of truth.

The resolver uses only compatible setting/biome pools. Time and weather are preferences, with explicit `timeFallback` in its result. Missing profiles return null for legacy runs; empty authored pools are invalid. Night is currently available only for paintings actually depicting night. Do not tag daytime art as night to silence coverage gaps.

Runs may set `presentationTimeId` and `presentationWeatherId`; defaults are day/any. World inspection and combat use the same node ID and presentation seed. World entry saves the selected scene; combat reuses compatible saved selections. Scene selection never consumes gameplay RNG or changes between turns. Traditional maps derive a profile from their biome and node type when an explicit atlas node mapping does not exist.

Music tables intentionally contain no invented tracks. `musicCandidates` exposes compatible IDs/weights for later playback and crossfades; it does not start audio.


## 9. Combat tag sources (COMBAT-TAG-SOURCES.md)

### Authored identity

All direct card definitions and attack profiles declare weapon, spell, or unarmed
source. Armaments declare their own source, delivery and base damage type. Normal
weapon techniques inherit the selected weapon's damage type; explicit techniques
can override it. Mixed damage still requires explicit component weights.

Starseer and Herald spell attacks retain an explicit Arcane baseline in this
slice. A Frost visual or a Blight theme is not an implicit conversion or an
ailment. New typed spell compositions are a later content change. Physical weapon
types distinguish slashing, piercing and blunt without granting armor penetration.

Legacy schools remain available to their existing consumers. Broad source,
delivery, damage and theme categories do not bypass cross-class equipment
permissions. Presentation tags never contribute to a resolved attack's mechanics.

### Resolution and ownership

- Explicit hand selection is honored, including the existing left/right card
  instance carriers and the mainHand/offHand combat profile vocabulary.
- Spells select a matching focus, including one in the offhand. A missing or
  incompatible explicit source refuses the action atomically rather than borrowing
  the other weapon. Empty physical hands use the unarmed source.
- Controlled prototype and saved combat profiles remain complete source snapshots.
  Legacy profiles without `sourceType` retain their focus-family interpretation.
- Live solo loadouts read active equipment through the existing slot model. Weight
  stays on the item; configurable profile/item rows select impact family. This
  slice does not infer two-handed grip or implement new grip requirements.
- Direct effects capture their source before payment or resource-spent hooks. Later hits
  use that snapshot. Contact buildup belongs only to that source, including a
  focus with an explicitly configured effect. A theme alone supplies no buildup.
- Card previews resolve the current source for hand, draw, discard and exhaust.
  Swaps remove inherited tags without storing them on permanent card definitions
  or changing card IDs, upgrades, ownership or pile order.
- Preview entries and damage events expose matching source identities and effective
  tags. Card chips use the preview's effective tags; inherited chips explain the
  item granting them. Existing tag overflow handling remains in place.

### Boundaries

Actual rune inventory/socket transactions, item-copy migration, affinities,
two-handed grip, armor-derived combat defenses, co-op live equipment swapping,
the balance gate, and new reward cards remain subsequent work. Configured source
effects exercise rune-style inheritance; this does not claim a shipped rune-loot
system. Legacy `strike.*` equipment modifiers retain their existing scope.

Validation includes production content validation, source coverage and
contradiction checks, real solo swapping, wrong-hand rollback, source snapshots,
save restoration, exact previews, and co-op seat ownership. The existing

## 10. History (CHANGELOG, #589)

- **The starting deck is composed from tags, and the tag schema is normalised** ([#589](https://github.com/cehinds/AshenSpire/pull/589), `0.5.4.7`). What goes into your opening deck is now decided by tags on the content rather than by names written into the code, so a spreadsheet line changes it. Underneath, the tag tables are normalised to third normal form: five tables, a tag written in exactly one place, and no cell holding a list — which removes the second home a tag used to be able to live in, where only a rule kept the two copies agreeing.
