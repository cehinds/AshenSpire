# AshenSpire — Wireframe-first rebuild implementation plan

**Audience:** Claude or another implementation agent working with Constantine (`cehinds`).

**Status:** Proposed execution plan; no runtime changes or release approval.

**Prepared:** 2026-09-12.

**Planning baseline:** `dev` at `3c70be9014063e2a6216d4e3196d2a04d4438229`.

**Presentation reference:** draft PR #1005 at `dcb3d1cd2d7436d7893778e7403c2373b343c569`.

## 1. Reframed mandate

Build a fresh, deliberately scoped version of AshenSpire around the owner's wireframes. The first playable build must establish the intended appearance, responsive composition, information hierarchy, reusable components, and dependable interaction before restoring the full legacy feature set.

Every screen must be composed from immutable component view models. Every recurring visual pattern must have one component owner. All authored presentation values, content definitions, and supported gameplay tuning must come from validated configuration. Source data must be designed with third normal form (3NF) in mind; runtime read models may be denormalized for fast rendering and simulation.

The desired result is a quiet, weighty, readable dark-fantasy game: stable combatants standing on the ground, clear threats, consistent card faces, predictable selection, responsive feedback, and anchored controls that never disappear behind content. The wireframes define product intent, not merely inspiration.

This is a staged rebuild with a small initial product surface. It is not a requirement to make every old screen compatible before demonstrating the new game. Existing pure mechanics, content, assets, and save machinery may be reused when their behavior is understood and compatible. Existing UI implementations are reference material, not an architectural constraint on new presentation.

### 1.1 What this plan authorizes conceptually

- A separate development entry point for the rebuilt experience.
- Benching features from the rebuilt runtime while retaining their source and historical behavior.
- Replacing legacy screen markup and lifecycle patterns with a consistent component architecture.
- Building real interactive vertical slices early, using a curated subset of existing content.
- Revising architecture documentation before implementing boundaries that differ from the current architecture contract.

This document does not authorize deleting existing features, overwriting the owner's dirty checkout, replacing saves, changing combat formulas without a spec change, publishing a build, or merging a PR. Follow the active `AGENTS.md`. The current request is to prepare this plan; a later execution instruction starts implementation.

### 1.2 Success means

1. A new player can enter the rebuilt experience, choose an available character, fight a real encounter, inspect entities, accept a reward, and safely resume a saved checkpoint.
2. Those screens visibly match the effective wireframe contracts at wide, compact, and portrait sizes.
3. A shared token change updates every consuming component without editing those screens.
4. A new item or encounter can be authored using existing supported primitives without entity-specific UI code.
5. Combat previews and resolution agree, repeated input cannot double-commit, and presentation does not alter deterministic outcomes.
6. Benched features are absent from normal navigation and cannot leak into generated rewards or encounters.

## 2. Authority, references, and baseline

### 2.1 Read in this order

1. The owner's current task instructions and repository `AGENTS.md`.
2. The effective presentation contract extracted from the latest owner revisions in `CURRENT-SPECIFICATION.md`.
3. The relevant detailed card, selection, color, progression, and responsive contracts.
4. Current `SPEC.md` for mechanics that the rebuild actually enables.
5. This implementation plan for sequencing and proposed architecture.
6. Older diagrams, source maps, and code anchors as historical evidence.

Presentation authority does not silently amend mechanics. A gallery example showing XP, six allied slots, or practice awards does not establish a gameplay rule.

### 2.2 Immutable source references

- [Wireframe draft PR #1005](https://github.com/cehinds/AshenSpire/pull/1005).
- [Current presentation specification](https://github.com/cehinds/AshenSpire/blob/dcb3d1cd2d7436d7893778e7403c2373b343c569/docs/architecture-handoff/CURRENT-SPECIFICATION.md).
- [Card construction](https://github.com/cehinds/AshenSpire/blob/dcb3d1cd2d7436d7893778e7403c2373b343c569/docs/architecture-handoff/CARD-CONSTRUCTION-CONTRACT.md).
- [Card selection and inspection](https://github.com/cehinds/AshenSpire/blob/dcb3d1cd2d7436d7893778e7403c2373b343c569/docs/architecture-handoff/CARD-SELECTION-CONTRACT.md).
- [Color and interaction](https://github.com/cehinds/AshenSpire/blob/dcb3d1cd2d7436d7893778e7403c2373b343c569/docs/architecture-handoff/COLOR-INTERACTION-CONTRACT.md).
- [Progression proposal](https://github.com/cehinds/AshenSpire/blob/dcb3d1cd2d7436d7893778e7403c2373b343c569/docs/architecture-handoff/PROGRESSION-SPECIFICATION.md).
- [Earlier execution plan](https://github.com/cehinds/AshenSpire/blob/dcb3d1cd2d7436d7893778e7403c2373b343c569/docs/architecture-handoff/EXECUTION-PLAN.md).
- [Source audit and known baseline differences](https://github.com/cehinds/AshenSpire/blob/dcb3d1cd2d7436d7893778e7403c2373b343c569/docs/architecture-handoff/CURRENT-SOURCE-AUDIT.md).

Local planning-time reference checkout: `D:/repos/AshenSpire-wireframe-docs`. Do not assume that path exists on another machine. Resolve the pinned Git objects or the reviewed successor to PR #1005. Record the exact reference commit used by each implementation task.

### 2.3 Resolve contradictions once

The reference is an iterative design record. Earlier paragraphs mention layouts and controls that later paragraphs supersede. Before implementation, produce `docs/rebuild/PRESENTATION-CONTRACT.md` with one effective value per named contract, its source section, its default, and its allowed responsive exception.

Known examples:

| Subject | Effective target for this plan |
|---|---|
| Combat bands | 10% HUD / 55% battlefield / 30% hand / 5% footer, with physical minimums |
| Potions | One control in the combat footer; none in the top HUD |
| HUD mode grip | Removed from the rebuilt presentation |
| Defense position | Latest role-specific anchors: player 12%, enemy 88% of sprite height; outside sprite |
| Combatant fitting | Selection/status expansion does not affect base fit |
| Selection layering | Latest formation contract: priority increases within the prescribed formation layer; do not assume selection crosses all layers |
| Cards | 5:8 ratio; 10/40/40/10 bands; footer metadata, not a Use button |
| Hand | Selection-only lift; stable exposed hit regions; overflow scroller for excess cards |

An unresolved contradiction that changes interaction or appearance becomes a narrow owner decision with side-by-side evidence. Continue independent work. Do not invent a compromise or silently pick whichever rule is easiest to implement.

### 2.4 The dirty checkout is not the rebuild baseline

At review time, the owner checkout contained uncommitted changes and conflict markers in classes, derived stats, validation, creation UI, and tests. `node tests/run-node.mjs` stopped at `tests/engine.test.js:6400` before running tests.

Implementation starts from a clean branch/worktree based on current `dev`. Record existing baseline failures. Do not copy the dirty working tree wholesale. Reuse any pending owner work only through an explicit, reviewed integration decision. A clean checkout may still fail tests; verify rather than assume.

## 3. Scope and feature benching

### 3.1 First playable milestone

The first milestone is a curated single-player encounter loop, not the complete historical game:

```text
startup / title
    -> minimal character and starting-kit selection
    -> one authored encounter
    -> real card selection, targeting, resolution, inspection
    -> reward selection and confirmation
    -> checkpoint and resume
    -> next encounter or a clearly completed demonstration run
```

Use an existing class, kit, cards, and enemy definitions selected for supported mechanics and visual coverage. Do not invent permanent class names, balancing values, or a replacement combat system to populate the prototype. The actual selected IDs belong in the reviewed build-profile data.

### 3.2 Proposed disposition matrix

| Feature | First playable | Retention and return condition |
|---|---|---|
| W0 shell, W3 title, W4 combat | Build immediately | Core rebuild foundations |
| Minimal character/kit selection | Enabled, curated choices | Full creation restored after shared workspace/card coverage |
| HP/MP/SP, costs, supported statuses | Enabled as required by curated content | Keep current specified semantics |
| Card targeting, damage, defense, enemy intent | Enabled | Preview/commit parity is a release condition |
| Inspection and tooltips | Enabled | Required for readable cards and dense combat |
| HP/MP charge potions, supported carried consumables | Enabled through one footer projection | No duplicate ownership or buttons |
| Reward choice and checkpoint | Enabled | Exact-once command and persistence coverage |
| Settings | Essential text size, motion, sound, supported input only | Remaining categories return when real behaviors exist |
| Full class roster and procedural content pools | Benched | Reintroduce by curated family and capability validation |
| Full Armoury, Smith, extraction, installation, trading | Benched | Domain command and workspace migration complete |
| Complex relic synergies and unsupported statuses | Benched by content closure | Required interpreter/provider and tests exist |
| Co-op / LAN / lobbies | Benched | Remote command adapter and snapshot parity demonstrated |
| Endless, custom-run modifiers, draft modes | Benched | Core loop stable; deterministic profiles specified |
| Full procedural map and proposed 200-node atlas | Benched | Journey milestone and separate atlas mechanics contract |
| Town services and voiced dialogue | Benched initially | Quest/history/availability commands and fallback playback proven |
| XP and weapon/skill proficiency | Fixture-only in component lab | Mechanics specification approved before real awards |
| Advanced cosmetic rigs and editor workflows | Benched | Stable asset metadata, pivots, and core animations |
| Broad compendium, achievements, unlocks, history UI | Benched | Knowledge/profile boundaries and workspace support |
| Desktop wrapper and production distribution cutover | Deferred | Browser and portable-build validation complete |

These are proposed rebuild profile choices, not deletion instructions. If the owner changes the initial feature set, update the profile and its acceptance matrix together.

### 3.3 Benching is capability closure, not CSS hiding

The build profile selects enabled features, modes, content memberships, routes, and providers. Compile their dependencies. A disabled feature must not leave dangling cards, loot, event choices, mandatory controls, save expectations, or routes.

```text
FUNCTION compileBuildProfile(profile, definitions):
    enabledFeatures = resolveFeatureDependencies(profile.featureIds)
    REQUIRE no dependency cycles
    enabledContent = resolveExplicitContentMembership(profile)
    requiredCapabilities = capabilitiesRequiredBy(enabledContent)
    REQUIRE requiredCapabilities SUBSET OF capabilitiesOf(enabledFeatures)
    REQUIRE every reference from enabledContent resolves within enabled closure
    REQUIRE every reachable route has a renderer and command adapter
    REQUIRE every mandatory encounter has a supported completion path
    RETURN immutable compiled profile
```

Do not infer benching from an item name. Do not silently drop an effect because its provider is missing. Reject the profile with a precise error. Keep bench status in build-profile data and a short feature matrix; tasks remain GitHub Issues, not a second ticket system.

## 4. Proposed architecture

### 4.1 Responsibility boundaries

```text
Authoring: normalized JSON / CSV / database export
    -> typed parser + relational validation + deterministic compiler
    -> immutable content, rule, presentation, and asset registries

Composition root
    -> RunSession / command coordinator
        -> domain plans and simulation
        -> RNG
        -> persistence adapter
    -> active presenter
        -> pure screen projection
            -> immutable component view models
        -> component renderer and instance reconciler
        -> input / layout / animation / audio adapters
    -> platform services and optional remote transport adapter
```

The core remains composition-based. A presenter translates input and coordinates a screen. A view model describes what to display. Components render and emit semantic intents. Observers only manage browser/input/lifecycle boundaries. No framework-specific MVC or MVVM machinery is required.

### 4.2 Four kinds of state

| State | Owner | Examples | Saved? |
|---|---|---|---|
| Domain state | Engine/model via RunSession | HP, inventory, card piles, turn, quest choices, RNG counters | Committed checkpoints |
| Presentation state | Presenter | Selected card/entity, active category, reordered hand IDs, inspected reference | Normally no; deliberate preferences only |
| Playback state | Timeline controller | Current visual beat, transient numbers, poses, pending effects | No; restore committed checkpoint |
| Platform/preferences | Injected services | Viewport, input family, audio capability, text size, chosen theme | Preferences separately |

A displayed HP value during animation may differ temporarily from the already committed HP value. That is a deliberate presentation snapshot, never another authoritative game state. On cancellation or resume, reconcile to the committed state.

### 4.3 Dependency laws

- `model` and `engine` never import DOM, UI, storage globals, or transport.
- Domain plans never read CSS, labels, selection glow, or component IDs to decide legality.
- Component view-model modules never import DOM or retain mutable run references.
- Components never query a registry to calculate gameplay. They receive projected display records.
- Presenters call domain plans/commands; they do not change HP, currency, inventory, or quest history themselves.
- Platform adapters own storage, audio, asset decoding, measurement, and browser events.
- `main` wires dependencies and entry points. Run transitions are owned by RunSession and navigation services.
- Local and remote command adapters implement one presentation-facing contract; only the correct authority commits.
- Rendering and layout consume no gameplay RNG.

### 4.4 Reuse decisions

Preserve or adapt the existing seeded RNG, effect interpreter, registries, resource plans, targeting plans, quest history, save envelope, and component-record concepts where tests establish compatibility. Inspect `src/framework/` explicitly: its compiler, cost, lifecycle, and confirmation responsibilities overlap several proposed boundaries. Assign each behavior to one owner, with temporary adapters as needed; do not create a second independent formula engine.

Replace the old screen-owned DOM/mutation pattern. Do not port large screen files wholesale and call them presenters. Extract pure projections first, then move command handling and lifecycle ownership. Remove compatibility adapters only after all rebuilt consumers use the destination and the legacy entry remains supported until cutover.

### 4.5 Runtime choice

Default to the current browser-native module stack and existing build tools for the first slice. A new dependency or framework is justified only by a concrete requirement and a demonstrated reduction in complexity. Do not make a framework migration, database server, network service, or native engine a prerequisite to proving the owner's wireframes.

### 4.6 Current-source extraction map

Revalidate these symbols on the actual implementation commit; this table names ownership, not frozen line numbers.

| Current source / behavior | Target responsibility | Extraction proof |
|---|---|---|
| `src/main.js`: `newRun`, `enterNode`, `onCombatEnd`, pending rewards | RunSession + domain command handlers | Same committed state/RNG/result before and after extraction |
| `src/main.js`: display settings, navigation, persistence | Separate display/navigation/persistence coordinators | No gameplay rules retained in bootstrap; disposal and failed-save tests |
| `src/ui/screens/combat.js`: `combatantSubject`, `statusRow`, meter/intent composition | Pure combatant/inspector VMs + actor components | Equivalent known values, new wireframe geometry, no DOM in projection |
| `src/ui/screens/combat.js`: `afterDispatch`, display snapshot, selection/input | Timeline and interaction controllers | Event order, final reconciliation, no duplicate action, retained focus |
| `src/ui/components/battlefieldStage.js`: whole-frame fitting | Ground-pivot formation layout | Effects and selection do not change base sprite fit or foot position |
| `src/ui/components/card.js`, `hand.js` | Typed card projection + WC0 renderer + hand host | Shared faces across combat, rewards, equipment, and inspector |
| `src/ui/viewModels/RunHudViewModel.js`, `VitalsPanelModel.js`, `hudmeta.js` | Complete HUD projection + shared components | Numbers live in models; one footer Potions control; no mode grip |
| `src/ui/screens/shop.js`: `sellPriceFor`, mutation callbacks | Pure shop plans and authoritative commands | Exact pricing/ownership parity; stale references refuse |
| `src/ui/screens/equipment.js`, `smithServices.js` | Workspace presenters + existing pure plans | Preserve receipts, grants, costs, and contextual service availability |
| `src/ui/components/tooltip.js`, modal/overlay helpers | One timing service and modal lifecycle | All input families; timer cancellation; topmost Escape/focus restoration |
| `src/framework/*` | Retain/adapt existing interpreters and shared policies | One owner for costs, confirmations, schema, and lifecycle |
| `src/engine/actmap.js`, `model/mapknowledge.js`, `model/quests.js` | Retain domain seams; add new projections | Seeded route/choice history and separate knowledge semantics preserved |

Each extraction task lists the old export, its consumers, the new owner, and the temporary adapter removal condition. Finding a better destination does not justify moving unrelated functions in the same task.

## 5. Proposed file structure

Paths marked below describe the target, not claims that these modules exist. Establish them incrementally; do not mass-move current `src/`.

```text
docs/
  WIREFRAME-FIRST-REBUILD-IMPLEMENTATION-PLAN.md
  rebuild/
    PRESENTATION-CONTRACT.md       # one effective rule per visual contract
    ARCHITECTURE.md                # approved target and dependency rules
    DATA-DICTIONARY.md             # keys, dependencies, units, validation
    FEATURE-MATRIX.md              # profile disposition, not a task board
    ACCEPTANCE.md                  # fixtures, viewports, evidence, limits
    AUTHORING.md                   # how to add content and change tokens
content/source/
  ui/                             # authoritative normalized relation files
  profiles/                       # curated runtime memberships/capabilities
  narrative/                      # later: text, speakers, dialogue, discovery
  progression/                    # later: specified practice/unlocks
  ...existing content relations...
src/
  main.js                         # legacy public entry until reviewed cutover
  app/
    bootstrapRebuild.js            # rebuilt composition entry
    RunSession.js                 # active run, serialization, revision
    NavigationCoordinator.js      # presenter mount/dispose
    CommandGateway.js             # local/remote adapter selection
    LocalCommandAdapter.js
    PersistenceCoordinator.js
    BuildProfile.js
  model/
    ...existing pure contracts...
    commands/                     # plans, receipts, stable references
    knowledge/                    # separate run/profile discovery policies
    dialogue/                     # future graph, availability, transitions
    progression/                  # future specified awards and derived ranks
  engine/
    ...existing interpreter/RNG/combat...
    commands/                     # command handlers and orchestration
  content/
    ...compatibility exports and compiled registry adapters...
  ui/
    presenters/
      TitlePresenter.js
      CharacterPresenter.js
      CombatPresenter.js
      RewardPresenter.js
      InspectorPresenter.js
      WorkspacePresenter.js
    viewModels/
      CombatScreenViewModel.js
      CardViewModel.js
      CombatantViewModel.js
      InspectorViewModel.js
      RunHudViewModel.js
      PotionsViewModel.js
      WorkspaceViewModel.js
    models/                       # retain/extend immutable record factories
      ComponentModel.js
      BehaviorModel.js
      UiComponentId.js
    components/
      shell/                      # W0 and W1/W2/W3/W4 specializations
      primitives/                 # button, title, icon, meter, facts, artwork
      cards/                      # WC0 and typed composition variants
      combat/                     # actor, stage, hand, intent, footer
      inspection/                 # tooltip, inspector, overflow disclosure
    rendering/
      ComponentRegistry.js
      ComponentReconciler.js
      BindingScope.js
    services/
      SelectionController.js
      HandInteractionController.js
      TooltipController.js
      ModalCoordinator.js
      CombatTimelineController.js
      LayoutScheduler.js
      ViewportAdapter.js
      AssetService.js
      AudioService.js
    screens/                      # existing hosts retained during migration
  platform/
    BrowserStorageAdapter.js
    BrowserInputAdapter.js
    BrowserAudioAdapter.js
    BrowserAssetAdapter.js
  net/                            # retained; remote rebuild adapter later
styles/
  rebuild.css                     # scoped rebuilt entry; component styles
  generated/                      # compiled tokens, never hand-edited
tests/
  rebuild/                        # integrated suites, not an orphan test tree
  fixtures/rebuild/               # real VM/domain/viewport fixture inputs
tools/
  rebuild-preview.html            # temporary development door
  rebuild-preview.mjs             # loopback preview wrapper if needed
  component-lab.html              # actual production component renderer
  validate-rebuild-data.mjs
  verify-rebuild-boundaries.mjs
  verify-rebuild-layout.mjs
  ...existing build and verification tools...
```

Use current naming conventions where they do not obscure ownership. A new directory is warranted by a real boundary, not by this diagram alone. New components have one implementation; old exported functions may temporarily delegate to them. Do not maintain both `newCombat`, `combatV2`, and `rebuildCombat` implementations.

The preview entry is development-only. Keep `run.bat`, `run.sh`, `index.html`, and portable build doors unchanged until a reviewed cutover task. Do not add new root clutter or silently change distribution aliases.

## 6. Data architecture: normalized authority, compiled runtime

### 6.1 What 3NF means here

Each authoritative relation has a declared key. Every non-key fact depends on the key, the whole key, and no other non-key fact. Names, labels, categories, thresholds, and inherited settings are not copied into every row that references them.

Examples:

- Store a technique name in `TechniqueDefinition`, not in every proficiency unlock row.
- Store a theme color once per theme/color role, not in every button definition.
- Store a card's ordered effects as effect relations, not independent copies in combat, reward, and inspector data.
- Store a wireframe's parent once; compile inherited values rather than authoring the effective values repeatedly.

3NF does not require a database connection during gameplay. It does not require rendering to perform joins every frame. It does not mean every scalar in a transient object needs its own table. Save snapshots, caches, materialized views, and immutable view models may deliberately denormalize; document their source and never treat them as a second writable authority.

### 6.2 Authoring and compilation pipeline

```text
FUNCTION compileSources(sourceSnapshot):
    parsed = parseTypedRelations(sourceSnapshot)
    validatePrimaryKeys(parsed)
    validateUniqueConstraints(parsed)
    validateForeignKeys(parsed)
    validateCheckConstraints(parsed)
    validateOrderedSequences(parsed)
    validateInheritanceAndGraphCycles(parsed)
    validateUnitsAndRegisteredVocabulary(parsed)
    effectiveDefinitions = resolveInheritance(parsed)
    profiles = compileBuildProfiles(parsed, effectiveDefinitions)
    validateContentClosure(profiles)
    runtime = buildIndexedImmutableRegistries(effectiveDefinitions, profiles)
    digest = hashCanonicalOutput(runtime)
    RETURN {runtime, digest, sourceSnapshotId, compilerVersion}
```

JSON, CSV, and database exports feed the same typed relation model. Database export uses one consistent snapshot. File input uses one manifest. Reject duplicate keys and conflicting records; never merge authoritative sources using last-writer-wins.

Preserve string IDs such as `001`. Parse booleans, numbers, nulls, and units using the field schema. Preserve zero. Handle quoted CSV values correctly and explicitly support or reject multiline values. RNG-sensitive pool order uses authored ordinals and must survive compilation unchanged.

### 6.3 Logical presentation relations

These are proposed logical relations. The implementation task must produce concrete schema files and foreign-key definitions before importing content.

```text
TextKey(text_id PK)
LocalizedText(text_id FK, locale_id FK, value;
              PK text_id + locale_id)
Locale(locale_id PK, fallback_locale_id FK nullable)

RendererDefinition(renderer_id PK)                 # ID in code allowlist
ProviderDefinition(provider_id PK)                 # ID in code allowlist
CommandDefinition(command_id PK, payload_schema_id FK)
PayloadSchema(payload_schema_id PK)                # registered schema ID

ComponentDefinition(component_id PK, parent_component_id FK nullable,
                    renderer_id FK)
ComponentSlot(owner_component_id FK, slot_id, semantic_role_id FK;
              PK owner_component_id + slot_id)
ComponentSlotChild(parent_component_id FK, slot_owner_id, slot_id,
                   ordinal, child_component_id FK, provider_id FK;
                   PK parent_component_id + slot_owner_id + slot_id + ordinal;
                   FK slot_owner_id + slot_id -> ComponentSlot)

WireframeDefinition(wireframe_id PK, parent_wireframe_id FK nullable,
                    root_component_id FK)
WireframeSlotBinding(wireframe_id FK, slot_owner_id, slot_id, provider_id FK;
                    PK wireframe_id + slot_owner_id + slot_id;
                    FK slot_owner_id + slot_id -> ComponentSlot)

LayoutVariant(variant_id PK)                       # wide/compact/portrait
LayoutPolicy(policy_id PK, algorithm_id FK)
LayoutAlgorithm(algorithm_id PK)                   # registered implementation
WireframeLayout(wireframe_id FK, variant_id FK, policy_id FK;
                PK wireframe_id + variant_id)
LayoutSlotRule(policy_id FK, slot_owner_id, slot_id,
               width_rule_id FK, height_rule_id FK, alignment_id FK,
               overflow_policy_id FK;
               PK policy_id + slot_owner_id + slot_id;
               FK slot_owner_id + slot_id -> ComponentSlot)

LengthRule(rule_id PK, kind_id FK, value nullable, unit_id FK nullable,
           reference_slot_owner_id nullable, reference_slot_id nullable)
Alignment(alignment_id PK, horizontal, vertical, positioning)
OverflowPolicy(overflow_policy_id PK)              # typed registered policy
```

Validate that slot references belong to the effective component ancestry. Validate nullability combinations for each length-rule kind. A parent fraction may reference its parent; an intrinsic rule does not carry a numeric value. All vocabulary/FK targets omitted from this compact notation still require concrete tables or closed registered enums in the schema.

Avoid arbitrary component nesting that can introduce recursion. Require an acyclic definition graph and finite compiled tree. Collection providers produce repeated instances with domain keys; they do not add arbitrary new renderer types at runtime.

### 6.4 Typed tokens and themes

```text
TokenDefinition(token_id PK, value_type_id FK, unit_id FK nullable,
                constraint_id FK, description_text_id FK)
TokenSet(token_set_id PK, parent_token_set_id FK nullable)
NumericTokenValue(token_set_id FK, token_id FK, value;
                  PK token_set_id + token_id)
BooleanTokenValue(token_set_id FK, token_id FK, value;
                  PK token_set_id + token_id)
EnumTokenValue(token_set_id FK, token_id FK, option_id;
               PK token_set_id + token_id;
               FK token_id + option_id -> TokenEnumOption)
TokenEnumOption(token_id FK, option_id;
                PK token_id + option_id)
ComponentTokenSet(component_id FK, variant_id FK, token_set_id FK;
                  PK component_id + variant_id)

PaletteGroup(group_id PK, label_text_id FK, ordinal UNIQUE)
ColorRole(role_id PK, group_id FK, label_text_id FK)
Theme(theme_id PK, name_text_id FK)
ThemeColor(theme_id FK, role_id FK, color_value;
           PK theme_id + role_id)
ControlStyle(style_id PK, fill_role_id FK, text_role_id FK, border_role_id FK)
ControlStateStyle(control_role_id FK, state_id FK, style_id FK;
                  PK control_role_id + state_id)
```

The concrete enum-value table must use the composite FK `(token_id, option_id)` to `TokenEnumOption`. Validate that every token value occurs in the correct type table and at most one type table; this is a cross-table constraint enforced by the compiler and, where applicable, database constraints/triggers. Do not claim an ordinary FK alone establishes that invariant.

Units belong to token definitions, so an override cannot turn a duration into a width. Typed tokens configure presentation; they are not a universal entity-attribute-value store for game entities. Cards, enemies, quests, and equipment retain meaningful typed schemas.

### 6.5 Gameplay and content relations

Use existing definitions and identifiers where possible. Illustrative target shapes:

```text
CardDefinition(card_id PK, name_text_id FK, description_text_id FK,
               rarity_id FK, artwork_id FK)
CardCost(card_id FK, resource_id FK, cost_rule_id FK;
         PK card_id + resource_id)
CardEffect(card_id FK, ordinal, effect_id FK;
           PK card_id + ordinal)
EffectDefinition(effect_id PK, opcode_id FK)
DamageEffect(effect_id PK/FK, amount_formula_id FK,
             damage_type_id FK, target_rule_id FK)
StatusEffect(effect_id PK/FK, status_id FK,
             amount_formula_id FK, target_rule_id FK)

EnemyDefinition(enemy_id PK, name_text_id FK, artwork_id FK, ai_policy_id FK)
EnemyMove(enemy_id FK, move_id, name_text_id FK;
          PK enemy_id + move_id)
EnemyMoveEffect(enemy_id, move_id, ordinal, effect_id FK;
                PK enemy_id + move_id + ordinal;
                FK enemy_id + move_id -> EnemyMove)
EncounterDefinition(encounter_id PK, location_id FK nullable)
EncounterMember(encounter_id FK, ordinal, enemy_id FK, formation_slot_id FK;
                PK encounter_id + ordinal)
```

Effect subtype membership must match its opcode, with exactly one supported payload shape. Formulas use the existing structured DSL or a reviewed typed equivalent; never executable strings. Do not normalize every formula into a graph unless a real authoring need warrants it. A schema-validated immutable expression value can remain an atomic domain value.

For currently scoped IDs, preserve `(family, scope, objectId)` or introduce a reviewed mapping. A normalized `EntityKey` supertype can provide global referential integrity for tags without flattening all entity facts into one table. Otherwise retain family-specific tag join tables. Never pretend a polymorphic string ID has a normal FK to several unrelated tables.

### 6.6 Tags and provider bindings

Tags describe reusable traits. They may select registered display providers or supported capabilities. They do not bypass command legality or execute strings.

```text
FUNCTION projectDetails(entityRef, knownSnapshot, registry):
    entity = resolveKnownEntity(knownSnapshot, entityRef)
    providerIds = registry.detailProviderBindings.forFamily(entity.family)
    providerIds += registry.detailProviderBindings.forTags(entity.knownTagIds)
    providerIds = uniqueAndOrderByAuthoredPriority(providerIds)
    rows = []
    FOR providerId IN providerIds:
        provider = CODE_PROVIDER_ALLOWLIST.require(providerId)
        rows += provider.project(entity, knownSnapshot)
    RETURN immutable rows
```

Unknown providers fail compilation. Two providers cannot both claim exclusive ownership of the same fact row. Data-driven means composing supported behavior, not guessing behavior from names.

### 6.7 Runtime and saved state

Mutable run aggregates may use efficient maps/arrays. Commit them through one session owner. Save an envelope containing schema version, ruleset/content identity, build-profile identity, committed revision, run state, and RNG stream counters. Preserve stable object IDs.

Do not persist DOM, computed layout, tooltip timers, card transforms, derived rank, or uncommitted preview values. If resume needs a derived cache, mark it rebuildable and validate it against the authoritative version.

Start the prototype with isolated memory storage. Add a separate versioned rebuild save namespace when checkpointing lands. Never overwrite legacy saves or silently import an incompatible ruleset. Unsupported saves produce a readable explanation; legacy source/save data remains intact.

### 6.8 Asset, interaction, and profile relations

Assets must support configuration as deliberately as layouts. A foot pivot is an authored asset fact; a formation foot position is a scene-layout result. Do not copy asset metadata into every enemy or screen.

```text
AssetDefinition(asset_id PK, asset_role_id FK)
AssetVariant(asset_id FK, variant_id, uri, intrinsic_width, intrinsic_height,
             content_hash;
             PK asset_id + variant_id)
SpriteGeometry(asset_id, variant_id, bounds_x, bounds_y, bounds_width,
               bounds_height, foot_x, foot_y;
               PK asset_id + variant_id;
               FK asset_id + variant_id -> AssetVariant)
AnimationDefinition(animation_id PK, playback_policy_id FK)
AnimationFrame(animation_id FK, ordinal, asset_id, variant_id, duration_ms;
                PK animation_id + ordinal;
                FK asset_id + variant_id -> AssetVariant)
EntityArt(entity_key FK, pose_id FK, animation_id FK;
           PK entity_key + pose_id)

InteractionPolicy(policy_id PK, algorithm_id FK)
InteractionPolicyToken(policy_id FK, purpose_id FK, token_id FK;
                       PK policy_id + purpose_id)
ComponentBehavior(component_id FK, behavior_id, event_id FK,
                   command_id FK, policy_id FK;
                   PK component_id + behavior_id)

FeatureDefinition(feature_id PK)
FeatureDependency(feature_id FK, required_feature_id FK;
                   PK feature_id + required_feature_id)
BuildProfile(profile_id PK, ruleset_id FK)
ProfileFeature(profile_id FK, feature_id FK;
                PK profile_id + feature_id)
ProfileContent(profile_id FK, entity_key FK, ordinal;
                PK profile_id + entity_key;
                UNIQUE profile_id + ordinal)
```

Specify sprite geometry coordinates explicitly, preferably normalized to intrinsic bounds. Validate pivots/bounds and missing pose fallbacks. Asset variants can represent quality tiers, poses, or formats only through declared roles; do not overload `variant_id` without a schema. Choose one compiled delivery variant per role/profile with explicit ordering. A missing nonessential effect asset may fall back; missing mandatory actor identity must be surfaced in validation.

Behavior payloads come from the instance projection and are validated by the registered command schema. Static behavior definitions do not contain mutable targets or callbacks. Profile content ordering above is only membership/display order; RNG pool membership has its own authored order and must not inherit this order accidentally.

## 7. Configuration contract

### 7.1 What must be configurable

| Family | Examples | Change boundary |
|---|---|---|
| Layout | Bands, insets, gaps, bounds, overflow, anchors | Presentation config |
| Components | Slot composition, approved variants, visibility policy | Validated definitions |
| Controls | Width presets, heights, circle sizes, role styles | Shared tokens |
| Cards | Aspect ratio, band ratios, fan, lift, inspection delay | Shared card tokens |
| Combatants | Formation, pivots, scale, status priorities, overflow | Scene/actor policies |
| Text/theme | Fonts, sizes, semantic colors, localization | Preferences + theme data |
| Feedback | Timings, easing IDs, audio cues, reduced-motion policy | Presentation config |
| Content | Cards, enemies, effects, encounters, rewards | Validated content |
| Rules | Supported formula/tuning values and explicit rule versions | Mechanics spec + ruleset |
| Features | Curated profile membership and dependencies | Build profile |

Algorithms, transaction guarantees, input arbitration, and validation are code. New behavior outside the registered vocabulary requires code and tests. Do not expose every authoring setting as a player option. The developer configuration surface and player settings are different products.

### 7.2 Resolution and overrides

Resolve defaults, inherited family values, explicit variant overrides, and allowed user preferences once. Use typed, per-domain precedence; avoid one global loose merge of arbitrary dictionaries. Compilation explains the source of each effective value.

```text
FUNCTION resolvePresentation(componentId, variantId, themeId, preferences):
    chain = validatedAncestorChain(componentId)
    values = baseTokenDefaults()
    FOR ancestor IN chain FROM ROOT TO LEAF:
        values = applyAllowedTypedOverrides(values, ancestor.tokenSet)
        values = applyAllowedTypedOverrides(values, ancestor.variant(variantId))
    values = applyPreferenceOverrides(values, preferences.allowedPresentationKeys)
    styles = resolveThemeRoles(themeId)
    validateEffectiveConstraints(values, styles)
    RETURN immutable {values, styles, provenance}
```

Hot-reloading presentation in the component lab is useful. Hot-reloading mechanics during an active run is not the default: a run pins its ruleset. Reject invalid edits and retain the last valid preview; show field-specific errors. Never partially apply an invalid configuration.

Configurability does not weaken fidelity. Keep a versioned owner-reference preset and compare acceptance fixtures against it. Developer experiments may use separate presets; they do not silently replace the product default or rewrite the screenshot baseline merely to make a failed check pass.

### 7.3 Standard geometry defaults

These are reference-derived starting values unless explicitly marked proposed. Store them once in the approved token source.

| Token family | Effective default / rule |
|---|---|
| Card ratio | Width:height = 5:8 |
| Card bands | Header 0.10, art 0.40, body 0.40, metadata 0.10 |
| Button width presets | Third 0.30, half 0.50, full 1.00; quarter 0.25 is additional |
| Button heights | Standard 2.75rem; tall ×1.5; double ×2 |
| Nine standard sizes | Third/half/full crossed with standard/tall/double |
| Exit | Shared icon-size token, square 1:1, no flex distortion |
| Footer shares | One action full; multiple equal usable shares after gaps |
| Combat bands | 0.10 / 0.55 / 0.30 / 0.05 |
| Hand minimum | 208 CSS px at default scale; increase for required text/accessibility fit |
| Footer minimum | 56 CSS px at default scale; hit targets at least 44 CSS px |
| Hand card width | Shared range 5rem–9rem, uniform per hand |
| Hand capacity | Five at 22rem through fifteen at 75rem, also constrained by exposed hit width |
| Hand fan / selected lift | 2.5 degrees / 1rem |
| Inspect delay | 1000ms; cancel on deselection/disposal/identity change |
| Tooltip delay | 1000ms under the current reference policy |
| Selected inspection hit region | At least 44 × 44 CSS px; visible disk may be smaller |
| Exact actor resource text | At least 12 CSS px after layout transforms |
| Guard/intent values | At least 13.2 CSS px, intent reserve 22px |
| Resource reference maxima | HP 200, MP 20, SP 20; visual scale, not domain caps |
| Active lower actor rows | At most five after filtering/prioritization |
| Status tiles | 1.575rem; no wrapping; final `+N` disclosure on overflow |

The reference uses the term “physical” for minimums. Implement and measure them in CSS pixels after UI transforms; do not confuse them with hardware device pixels or multiply by device-pixel ratio twice. Real-device usability remains a separate check.

The actor legibility policy also retains post-transform minimums of 0.85rem HP height, 0.45rem secondary/buildup height, 0.85rem stance height, and 1rem status-icon size. These are lower bounds, not replacements for the larger nominal dimensions. Where exact half-height ratios and minimums interact, enlarge the shared HP reference sufficiently to satisfy both; do not silently break the ratios.

## 8. Component view models and rendering

### 8.1 Immutable record contract

```text
ComponentViewModel:
    instanceKey               # stable identity within its owning collection
    componentId               # code-allowlisted renderer contract
    variantId
    properties                # typed display values, no mutable domain object
    tokenSetRef               # resolved immutable config or stable reference
    accessibility             # role/name/state/live-region intent
    behaviors[]               # semantic commands, policies, typed payloads
    childrenBySlot{}           # immutable child model collections
```

A component has no embedded HTML, DOM nodes, closures, registry instances, browser objects, or executable strings in its model. Text is plain or a typed rich-text tree rendered through escaped primitives. Fact rows carry known/unknown/none states explicitly.

`instanceKey` must identify the instance, not its label, list index, or definition alone. Two copies of one card have distinct instance keys. Row reordering preserves their mounted components.

### 8.2 Projection

```text
FUNCTION projectCombatScreen(domainSnapshot, playbackSnapshot,
                             presenterState, config, knowledge):
    displaySnapshot = playbackSnapshot OR domainSnapshot
    commands = planAvailableCommands(domainSnapshot)
    known = projectKnowledge(displaySnapshot, knowledge)
    actors = mapStableEntities(known, projectCombatant)
    hand = projectHand(domainSnapshot, presenterState.handOrder,
                       authoritativeCardPreviews(domainSnapshot))
    RETURN freezeDeep(composeScreen(
        shell = projectGameplayShell(config),
        hud = projectRunHud(displaySnapshot, config),
        battlefield = projectFormation(actors, presenterState, config),
        hand = hand,
        footer = projectCombatFooter(commands, presenterState, config)))
```

While playback is busy, any final-state command previews must be unavailable for committing. Do not present a mid-animation display as an actionable domain snapshot. Define which values animate and which update immediately, and test their reconciliation.

### 8.3 Mount, update, dispose

```text
INTERFACE ComponentInstance:
    mount(host, model, intentSink, scope)
    update(nextModel)
    dispose()

FUNCTION reconcileCollection(host, previousInstances, nextModels):
    REQUIRE unique nextModels.instanceKey
    FOR model IN nextModels IN DISPLAY ORDER:
        old = previousInstances.lookup(model.instanceKey)
        IF old exists AND old.componentId == model.componentId:
            old.update(model)
            moveExistingNodeToCorrectPosition(old)
        ELSE:
            disposeOldIfPresent(old)
            mountRegisteredComponent(host, model)
    disposeInstancesAbsentFrom(nextModels)
```

Do not clear and rebuild the actor zone on every damage beat. Do not restart sprite animation or tooltip timers when unrelated properties change. Avoid deep-cloning the entire run on every animation frame; project on revisions/beats and cache stable derived records where measurements justify it.

### 8.4 Binding scopes

Each screen and component scope owns its listeners, observers, timers, animation handles, subscriptions, and pending asynchronous callbacks. Disposal is idempotent.

```text
FUNCTION mountScreen(host, dependencies):
    scope = newDisposableScope()
    presenter = createPresenter(dependencies, scope)
    instance = render(presenter.initialModel, presenter.handleIntent, scope)
    scope.onDispose(instance.dispose)
    scope.onDispose(presenter.dispose)
    RETURN scope

FUNCTION navigate(route):
    activeScope.dispose()
    activeScope = mountRoute(route)
```

Use generation/revision guards in addition to cancellation where an asynchronous operation cannot truly be cancelled. A stale image load, tooltip delay, or audio callback must never affect the next screen.

## 9. Wireframe implementation contracts

### 9.1 W0 and its specializations

W0 owns shared safe-area handling, header, body host, footer, title/exit/back/primary anchors, theme, focus, and transitions. W1 workspace, W2 decision, W3 menu, and W4 gameplay compose that foundation. W3 keeps its explicit centered title/menu variant. W4 owns gameplay bands, not a generic scrolled modal body.

Header and footer reserve their own layout space. Only the designated body/details pane scrolls. No duplicate outside padding in child headings, list panes, or footer buttons. Omitted optional slots collapse; absent capabilities do not create placeholder actions.

A component-lab toggle may preserve a hidden diagnostic region for examination. That is not production collapse behavior.

### 9.2 Buttons and interaction appearance

Button size comes from named presets, not label length. Exit stays square. Actions/Potions stay circular. Text may wrap within a supported button layout without silently changing the shared width preset.

Resolve state in this order: absent capability; unavailable/busy; destructive role; exit/back highlight; primary-ready; utility/selection. Selection is gold. Valid primary readiness is restrained green. Highlighted Back/Exit is red. Disabled/busy suppress activation emphasis. Focus and state must remain understandable without color.

End Turn remains legal when rules allow early ending. Its green guidance follows the special reference policy; do not disable it simply because cards remain playable. Destructive actions never become green merely because they occupy the primary slot.

### 9.3 WC0 card family

Playing cards, equipment, relics, consumables, class options, and kits use a common card anatomy with typed child providers. Their domain records remain distinct.

- Preserve 5:8 and 10/40/40/10 proportions.
- Keep meaningful tags at the art band's bottom.
- Put projected costs on the exposed left artwork edge below the header.
- Keep rarity/owned metadata in the footer.
- Put contextual actions in the host's action region, not inside card metadata.
- Preserve art proportions and explicit contain/crop roles.
- Use inspection for full rules/details; do not add internal card scrolling.
- Reserve selection/inspection headroom outside card bands.

Use real long-text and multi-cost fixtures early. Abbreviated faces may show a curated summary, but exact accessible details remain available. No component-specific font shrinking to hide overflow.

### 9.4 Hand layout and input

The hand selects one uniform card size from its allocated height and width range. Body transforms and invisible hit lanes must agree about which instance receives input. Hover does not lift, rotate, or reorder cards. Explicit selection lifts and straightens the card.

The first narrow-host fixture has five cards. Capacity also respects at least 44px exposed touch width per card. Additional cards use one horizontal hand scroller. The hand does not create vertical or inner-card scrolling.

Reordering changes only presenter-owned instance order. Draw/discard/exhaust membership remains domain-owned. Merge surviving order with newly drawn IDs deterministically for presentation, remove departed IDs, and retain no stale selection.

### 9.5 WC4 combatants and battlefield

Combatants are transparent assemblies, not boxed item cards. Name sits immediately above HP. Enemy intent is shown by default; player intent is hidden unless a supported policy requests it. Info appears above intent, or above artwork if intent is omitted.

Apply the latest selected/unselected visibility contract: unselected actors retain sprite, HP, active defense, eligible intent, status icons, aura/buffs, and ground shadow. Name, secondary resource bars, buildup bars, and stance are selected-only by default. Selection still respects domain activity: it must not reveal inactive systems or invent empty rows. The inspector preview is a separate explicit sprite/name/HP variant. This policy is configurable in one place and supersedes earlier always-visible lower-stack examples.

The ground shadow and authored artwork foot pivot share one logical contact point. Art faces inward; labels and badges never mirror. Aura behind art and buff effects in front are noninteractive. Status panels do not determine sprite grounding.

Latest formation defaults:

- Ground 80%, sky 20% of battlefield; ground-cutout asset has transparent upper contours.
- Six reserved slots per faction: three depth tiers × two columns. Fill in authored order without recentering empty slots.
- Outer/back column layer 200; inner/front column layer 0. Selection adds priority within its allowed layer.
- Mirrored diagonal tracks, horizontal requested step 5% of field width, preferred minimum 8px where fitting permits.
- Inner/front columns retreat outward by 2% field width, capped at 15% column spacing.
- Outer padding 1rem; faction gap interpolates 3% at 375px to 5% at 1200px.
- Row scales 0.9 / 0.95 / 1.0; selected growth 1.1 / 1.05 / 1.1; display multiplier 1.1.
- Latest lower detail reserve 3.5rem. Reconcile earlier sprite-allocation examples in the effective contract rather than carrying multiple defaults.
- Player defense at 12% artwork height on its right; enemy at 88% on its left; outside gap 0.5rem in the declared source coordinate space.

Reserve slots visually even when the active rules allow fewer actors. Slot count does not grant extra allies or summon mechanics.

### 9.6 Status priority and information disclosure

Filter by activity before counting rows. HP always remains. Optional resource/buildup rows use authored priorities; stance and status icons follow the contract. Secondary and buildup meters are half HP height; stance shares HP dimensions. Keep at most five lower rows. Convert excess buildup to icons and excess icons to a final `+N` disclosure. Never omit a relevant effect from the inspector.

Define activity per provider: zero current mana with a positive mana capacity is not automatically an inactive mana system. Zero buildup may be inactive according to its registered policy. Empty optional slots leave no gaps.

Selection glow belongs to one owner envelope and must not multiply at every child. Eligibility cues remain separate from the one selected combatant ID.

### 9.7 HUD and Potions

Project numeric values into the HUD model; do not leave meters as empty mount placeholders. Capacity and fill are separate:

```text
trackFraction = clamp(maximum / referenceMaximum, 0, 1)
fillFraction  = IF maximum > 0 THEN clamp(current / maximum, 0, 1) ELSE 0
trackWidth    = allowedTrackWidth * trackFraction
filledWidth   = trackWidth * fillFraction
```

Keep exact labels outside narrow tracks. Reference maxima are visual references, not health/mana/stamina caps.

One Potions button in the footer opens a projection joining HP charges, MP charges, and supported carried consumables. Their underlying ownership records remain distinct. A potion entry carries a stable provider/item reference, remaining uses, targeting requirements, and authoritative availability. UI selection does not consume it.

The footer has exactly five ordered tracks: Actions, Draw, End Turn, Discard/Exhaust, Potions. Actions and Potions share a circular diameter; End Turn shares their height and lifted baseline. Draw/Discard are the smaller pair. Use a centered grid: nominal width envelopes are at most 20% / 10% / 40% / 10% / 20%, with gaps removed before track sizing. Major controls use 95% of available footer height while retaining minimum hit size; circles fit uniformly within their width/height limits. The Potions disclosure wrapper contributes no independent padding, margin, or border. Do not give its nested control a different baseline.

XP is absent from the playable HUD until its rules exist. The component lab may display a labeled fixture to preserve visual design coverage.

### 9.8 Inspector and tooltip

W1w uses a read-only preview on the left and details on the right. For item cards, preserve the documented 38% preview allocation with configured gap and remaining detail space. On portrait, retain the specified two-column design and test readability; do not silently convert to an accordion.

Combatant preview contains only sprite/name/HP. Right-side order: HP/Intent/Defense summary, current state, previous actions newest-first, known abilities, known traits, lore last. Unknown and none are distinct. Knowledge filtering occurs before projection.

The right pane scrolls; header/footer stay anchored. Omit recursive inspection and invented primary actions. A sole Back action spans the footer. Close returns focus to the original surviving instance or a defined fallback.

Tooltip timing is shared. Hover/focus/tap intent observes the current one-second policy; cancellation, repeated events, pointer crossing into the panel, Escape, modal layering, and disposal are handled by one service. Long interactive content belongs in inspection.

### 9.9 Map, dialogue, and proficiency workspaces

These follow after core combat. Map uses the documented 10/60/20/10 allocation and real reachability/knowledge projections. Dialogue keeps player left, NPC right and substitutes prose/choice content in its specified region. Proficiencies use equal category/list widths and a double-width detail column on wide hosts; compact/portrait uses the two documented dropdowns.

Do not implement these as generic screens that merely resemble the wireframes. Bind each named region to real shared components and typed providers. Keep proposed mechanics fixture-only until approved.

## 10. Responsive layout and performance algorithms

### 10.1 One coordinate conversion

The viewport adapter calculates the usable game rectangle after safe areas/browser viewport changes. Nested layouts use their parent bounds. UI zoom conversion happens once at the adapter boundary. Device-pixel ratio is for raster backing resolution, not repeated CSS sizing.

```text
FUNCTION allocateCombatBands(host, config, textMetrics):
    usable = inset(host, safeAreaAndOuterInset)
    minimums = measureRequiredBandMinimums(config, textMetrics)
    REQUIRE minimums.hand >= configuredHandMinimum
    REQUIRE minimums.footer >= configuredFooterMinimum
    nominal = usable.height * [0.10, 0.55, 0.30, 0.05]
    allocation = solveConstrainedBands(nominal, minimums, usable.height)
    IF allocation is impossible:
        RETURN explicitUnsupportedGeometry(minimums, usable)
    RETURN allocation
```

Do not take space from the hand below its minimum to fit the footer. Do not let the battlefield become negative. A geometry failure in a claimed supported profile is a failed acceptance test, not a reason to shrink text or silently scroll combat. Very short windows outside supported profiles receive a clear resize/orientation suggestion; do not silently narrow the supported matrix to pass.

### 10.2 Fixed-foot formation

```text
FUNCTION layoutFormation(field, actors, config, assetMetadata):
    ground = resolveGroundRect(field, config)
    slots = resolveReservedFactionSlots(ground, config)
    baseFitByCategory = fitSpriteFramesAcrossBothFactions(slots, actors)
    # Ignore selected expansion and status-panel height in base fit.
    FOR actor IN actors:
        slot = slots.require(actor.slotId)
        foot = resolveSlotFoot(slot, config)
        fit = baseFitByCategory[actor.sizeCategory]
        scale = fit * config.displayScale * config.depthScale[slot.depth]
        selectedScale = actor.selected ? config.selectedScale[slot.depth] : 1
        artTransform = transformAboutFoot(assetMetadata[actor.assetId].footPivot,
                                          foot, scale * selectedScale)
        information = arrangeScreenSpaceInformation(actor, foot, config)
        information = shiftDetailsUpWithinFloorWithoutMovingFoot(information)
        emit {actorId, artTransform, foot, information, layer}
```

For the latest vertical tier contract, calculate unadjusted first/last foot positions and `step = (last-first)/2`; displayed anchors are `first+0.25*step`, `first+1.125*step`, and `last`. Both gaps are `0.875*step`. Fit against unadjusted baselines so the shift cannot enlarge actors.

Authored asset bounds and foot pivots are preferred to scanning transparent pixels repeatedly. Cache metadata by asset revision. Measure after assets/fonts are ready, batch reads before writes, and never observe the entire document merely to manage one actor.

### 10.3 Update scheduling

```text
ON domainRevision OR playbackBeat OR presenterStateChange:
    nextModel = projectRelevantScreen()
    reconcileChangedComponents(nextModel)
    IF geometryDependenciesChanged:
        layoutScheduler.request(activeScreenId)

ON animationFrame:
    reads = measureDirtyHostsOnce()
    plans = calculateLayouts(reads, immutableConfig)
    applyStyleWrites(plans)
```

Use transforms/opacity for cosmetic motion. Avoid alternating geometry reads and writes per actor. Do not rebuild full view-model trees every frame for a static scene.

### 10.4 Proposed performance acceptance targets

These are targets to measure, not existing verified performance:

- 60 Hz target on the named reference desktop; interaction feedback within 100ms at p95.
- No ordinary card-selection or single-beat render task exceeding 50ms under the documented test fixture.
- A documented mobile device or clearly labeled emulation profile, with measured frame-time distribution and input delay.
- No growing listener/timer/observer count across 100 enter/leave or select/inspect cycles.
- No actor remount caused solely by HP, defense, or active-status value changes.
- Asset decoding and first-use loading measured separately from steady-state rendering.

Tune these after baseline measurement with the owner if necessary. Report device/browser/fixture and p50/p95/p99; do not claim a universal frame rate from one desktop trace.

## 11. Commands, interaction, and playback pseudocode

### 11.1 Command transaction

```text
FUNCTION executeCommand(envelope):
    # envelope: commandId, requestId, expectedRevision, typed payload
    RETURN session.serialized:
        previous = session.receiptFor(envelope.requestId)
        IF previous exists: RETURN previous
        REQUIRE envelope.expectedRevision == session.revision
        handler = COMMAND_ALLOWLIST.require(envelope.commandId)
        validatePayload(handler.schema, envelope.payload)
        plan = handler.plan(session.snapshot(), envelope.payload)
        IF NOT plan.allowed: RETURN refusal(plan.reason)

        transaction = beginStateAndRngTransaction(session)
        TRY:
            receipt = handler.commit(transaction, plan)
            validateDomainInvariants(transaction.nextState)
            transaction.stageReceipt(envelope.requestId, receipt)
            transaction.commitStateRngAndReceiptTogether()
        CATCH error:
            transaction.rollbackIncludingRng()
            RETURN failure(error)

        persistence.enqueueCommittedCheckpoint(session.snapshot())
        RETURN receipt
```

The transaction abstraction must match actual implementation capabilities. Use copy-on-write state/RNG staging or a proven reversible mutation journal. Do not promise rollback around an interpreter that mutates live objects without restoring them. Save failure does not replay the command: retain the committed state, show unsaved status, and retry persistence of that revision.

Persist the command request/receipt identity with the committed revision when retries can survive reload or reconnection. The receipt includes a unique `receiptId`, its originating `requestId`, resulting revision, command type, and ordered events with stable event IDs. Do not use the command type (for example, `playCard`) as an idempotency key. In the pseudocode, the receipt and the new state are part of one logical session commit; they must not be independently durable writes that can disagree after a crash. State and request-history persistence use the same save envelope or a specified transactional store.

### 11.2 Selection and targeting

```text
ON selectCard(cardInstanceId):
    REQUIRE cardInstanceId still belongs to displayed hand
    cancelPreviousInspectionDelay()
    state.selectedCardId = cardInstanceId
    state.selectedTargetId = NONE
    state.mode = selected
    availability = planCardAction(currentDomainSnapshot, cardInstanceId)
    state.eligibleTargetIds = availability.eligibleTargetIds
    scheduleInspectionForIdentity(cardInstanceId, selectionGeneration)
    publishProjection()

ON selectTarget(entityId):
    REQUIRE entityId IN currentAuthoritativeEligibleTargets()
    state.selectedTargetId = entityId
    publishProjection()

ON confirmSelectedAction:
    REQUIRE state.mode NOT IN {reordering, inspecting, committing, playback}
    state.mode = committing
    receipt = commandGateway.execute(currentSelectedIntent())
    IF receipt.refused:
        revalidateSelectionAndShowReason()
    ELSE:
        clearCommittedSelection()
        beginPlayback(receipt)
```

Choose the precise approved confirmation gesture per action family in the interaction contract. Do not accidentally add an extra confirmation to every combat action or restore legacy immediate-play clicks that contradict explicit selection. A shared state machine supports the chosen gesture; it does not decide product policy.

### 11.3 Reordering and delayed inspection

```text
ON dragThresholdCrossed(cardId):
    state.mode = reordering
    cancelInspectionDelay()
    capturePointerForReorder()

ON reorderRelease(targetSlot):
    state.handOrder = moveStableId(state.handOrder, cardId, targetSlot)
    suppressReleaseClickForThisGesture()
    state.mode = selected
    # No engine call, no cost change, no RNG draw.

FUNCTION scheduleInspectionForIdentity(id, generation):
    timer.after(config.inspectDelay):
        IF scope.disposed: RETURN
        IF generation != state.selectionGeneration: RETURN
        IF state.selectedId != id: RETURN
        IF NOT currentProjection.contains(id): RETURN
        revealInspectionControl(id)
```

Map pointer, touch, keyboard, and gamepad into semantic intents. Escape closes the topmost overlay before deselecting underlying content. Touch scrolling cancels pending taps according to an explicit threshold; no double consumption by parent/child controls.

### 11.4 Event playback

```text
FUNCTION playReceipt(receipt, committedSnapshot):
    playbackGeneration += 1
    mine = playbackGeneration
    setBusy(true)
    TRY:
        FOR beat IN orderedPresentationBeats(receipt.events):
            IF disposed OR mine != playbackGeneration: BREAK
            applyEventDeltasToDisplaySnapshot(beat)
            patchProjectedValues()
            AWAIT playCosmeticBeat(beat, motionPreference)
    FINALLY:
        IF NOT disposed AND mine == playbackGeneration:
            displaySnapshot = committedSnapshot
            TRY:
                reconcileFinalProjection()
            CATCH renderError:
                reportRecoverablePresentationFailure(renderError)
            FINALLY:
                setBusy(false)
            handleResultOnce(receipt.receiptId)
```

Reduced motion preserves causal ordering and exact values while removing unnecessary movement. Skip cancels remaining cosmetics and reconciles to committed state. Navigation disposal invalidates callbacks. Never grant rewards from an animation completion callback without an authoritative result command that can execute only once.

## 12. Lore, knowledge, journey, and progression

### 12.1 Narrative direction

Retain the Goldbough/Sovereign Ember pilgrimage and the three-act visual identities unless the owner supplies a replacement lore canon. Express lore through region art, enemy behavior, equipment, short descriptions, and consequence-bearing choices. Avoid turning required combat information into lore riddles.

Normalized narrative relations should include text keys/localizations, location definitions, speaker definitions, dialogue nodes, ordered lines, choices, conditions, effect references, and discovery requirements. Keep artwork/audio references separate from rule effects.

### 12.2 Knowledge boundaries

Separate run knowledge, profile discovery, and authored truth. Project a viewer-specific known snapshot before creating inspector models. Do not put unrevealed abilities into the model and merely hide them with CSS.

```text
FUNCTION projectKnownEntity(entity, runKnowledge, profileKnowledge, policy):
    result.identity = policy.visibleIdentity(entity)
    result.currentState = policy.visibleCurrentState(entity)
    result.abilities = filterKnownAbilities(entity, runKnowledge, profileKnowledge)
    result.traits = filterKnownTraits(entity, runKnowledge, profileKnowledge)
    result.lore = filterKnownLore(entity, runKnowledge, profileKnowledge)
    result.unknownSections = explicitUnknownMarkers()
    RETURN immutable result
```

Do not merge map fog with lifetime compendium discovery just because both have hidden/known states. Reuse generic projection mechanics while retaining separate domain policies.

### 12.3 Dialogue and quest consequences

Existing quest choice history is a useful foundation. Specify graph availability and effect timing before adding town navigation or voice.

```text
ON chooseDialogueResponse(choiceId):
    receipt = executeDomainCommand(commitDialogueChoice, choiceId)
    IF receipt.success:
        present(receipt.nextDialogueNode)

ON speechComplete(playbackGeneration):
    IF stillCurrent(playbackGeneration) AND node.isLinearProse:
        advancePresentationBeat()
    # Never select a response or execute reward effects.

ON skipSpeech OR backToPreviousText:
    invalidateSpeechCallbacks()
    updatePresentationOnly()
```

Missing/muted/blocked audio retains captions and manual continuation. History review never grants effects again. Save only committed narrative decisions and the explicitly specified resume point.

### 12.4 Atlas and journey

The proposed 200-node authored atlas needs a separate domain specification for fixed locations, seeded route selection, required anchors, local maps, fog, revisit rules, and completion. Its view model consumes reachability and knowledge; it does not generate routes or grant travel.

A map illustration and formation slot are presentation data. A reachable location, enemy placement rule, or journey anchor is gameplay data. Their relation may be explicit, but neither owns the other's facts.

### 12.5 XP and proficiency: mandatory decisions before activation

Specify all of the following before real progression enters the build:

- Run-local versus profile-persistent XP/practice.
- Award triggers: use, hit, successful effect, victory, or another explicit event.
- Failed/immune/overkill/repeated actions and anti-farming behavior.
- Thresholds, rollover, rank caps, diminishing returns, and rounding.
- Technique discovery versus ownership versus ability to equip/use.
- Rank benefits and their interaction with character attributes and equipment.
- Death, abandon, load, replay, and future co-op authority.
- Ruleset version and save migration.

Proposed normalized relations: `ProficiencyDefinition`, `ProficiencyCategory`, `ProficiencyThreshold`, `TechniqueDefinition`, `ProficiencyUnlock`, `PracticeEvent`, and `KnownTechnique`. Choose an authority explicitly. Recommended starting design: idempotent practice events with a rebuildable total projection; a transactionally updated total plus audit events is also valid if specified. Do not maintain unrelated competing totals.

```text
FUNCTION grantPractice(characterId, proficiencyId, sourceEventId, awardSequence):
    key = (characterId, proficiencyId, sourceEventId, awardSequence)
    IF practiceEvents.contains(key): RETURN existingReceipt(key)
    amount = approvedAwardPolicy(currentState, sourceEventId)
    appendPracticeEvent(key, amount)
    total = sumCommittedPractice(characterId, proficiencyId)
    rank = deriveRank(total, orderedThresholds(proficiencyId))
    unlocks = deriveNewUnlocks(rank, knownTechniques)
    RETURN receipt(total, rank, unlocks)
```

Do not copy sample gallery ranks or awards into production tuning.

## 13. Implementation phases Claude should execute

Each row below is a bounded delivery phase, not permission to put the whole rebuild in one branch. Split a phase further if one independently reviewable change cannot fit. Use one GitHub Issue, branch off current `dev`, and draft PR targeting `dev` per task. Never merge the PR. Coordinate dependent phases through owner-reviewed integration; do not quietly build a stack against unmerged assumptions.

For every task: record input commits, feature scope, files, expected behavior, applicable tests, visual evidence, known limitations, and next dependency. Keep routine handoff concise; do not recreate the removed governance system.

### Phase 00 — Freeze references and establish a clean baseline

**Deliverables:** source/reference commit record; baseline test results; disposition of dirty-checkout work; current-module responsibility inventory.

**Steps:** read AGENTS/SPEC/architecture; inspect current Git state; use an isolated clean worktree; inspect `src/framework` and public entry points; run existing node/build verification; identify historical source-map paths that no longer exist.

**Exit:** the executor can distinguish baseline defects, proposed changes, and unrelated work. No runtime edits or cleanup of the owner's checkout.

### Phase 01 — Ratify rebuild scope and presentation contract

**Deliverables:** `PRESENTATION-CONTRACT.md`, initial feature matrix, architecture revision, required separate mechanics-spec proposals.

**Steps:** resolve superseded wireframe clauses; bind named W/WC components to effective rules; specify bench profile; name supported viewport and content fixtures; document initial interaction gestures.

**Exit:** one default per visual rule, no ambiguous control ownership, mechanics proposals clearly separated. Architecture/spec changes follow repository review before their dependent implementation.

### Phase 02 — Build typed configuration and compiler pilot

**Deliverables:** token/theme/button/card/layout relations, schema, parser/validator, compiled immutable registries, profile closure validation.

**Steps:** implement one complete family across CSV/JSON/export fixtures; preserve order and IDs; add failed-input fixtures; generate CSS variables from the same values used by model projections.

**Exit:** equivalent inputs compile equivalently; duplicate keys, invalid units, cycles, and unsupported providers fail. A shared button token changes all pilot consumers.

### Phase 03 — Create the rebuilt development door and component lab

**Deliverables:** isolated preview entry, injected services, scoped styles, real component lab, memory-only session fixtures.

**Steps:** bootstrap the new path without changing public launch aliases; register renderers; implement mount/update/dispose and stable-key reconciliation; use production components in the lab.

**Exit:** shell and components render from immutable records; legacy entry unaffected; no lab-only renderer pretending to prove production fidelity.

### Phase 04 — Implement W0, buttons, text, meters, artwork, modal lifecycle

**Deliverables:** shared primitives and shell specializations, focus restoration, overflow ownership, token inspection.

**Steps:** build title/exit/body/footer placement; nine button sizes; semantic appearance resolver; capacity/fill meter; image ratio handling; modal stack; keyboard/touch/gamepad intent adapters.

**Exit:** wide/compact/two portrait profiles pass geometry and text tests; header/footer stay visible; one shared inset; invalid/unavailable controls behave consistently.

### Phase 05 — Implement cards, selection, tooltip, inspector, and hand

**Deliverables:** WC0 family, typed card VM, inspector, shared timing, five-card fan, overflow hand, presentation-only reordering.

**Steps:** use real long-content fixtures; preserve ratios; expose costs; mount info overlay outside card bands; arbitrate inspect versus select versus reorder; preserve stable instance identity.

**Exit:** selecting/reordering/inspecting cannot play or consume a card; five narrow-host cards have reachable hit lanes; no clipped info control; stale timers cannot reveal another item's control.

### Phase 06 — Implement actors and formation with fixture data

**Deliverables:** WC4, actor VM, ground/art metadata, formation layout, active-status prioritization, selection/eligibility distinction.

**Steps:** render one, several, and twelve actors; test differing silhouettes and transparent margins; add/remove 0–20 effects; select each depth/column; retain fixed feet and correct layer ordering.

**Exit:** no battlefield scrolling; no foot movement from status changes; minimum information sizes hold; real portrait screenshot comparison recorded. If dense fixture cannot meet constraints, resolve with concrete evidence before claiming completion.

### Phase 07 — Wire authoritative combat and safe commands

**Deliverables:** RunSession, local gateway, curated combat profile, authoritative previews, transactional command/receipt handling.

**Steps:** adapt tested existing engine; eliminate UI mutation in the rebuilt path; gate content closure; implement revision/request identity; prove state and RNG behavior on refusal and failure.

**Exit:** real card actions and enemy turns work headlessly and in UI; preview/commit parity; no duplicate action from repeated input; presentation consumes no RNG. No invented XP/proficiency.

### Phase 08 — Add paced feedback, final-state reconciliation, and footer Potions

**Deliverables:** timeline controller, pose/audio adapters, shared footer, combined potion projection.

**Steps:** patch stable actors/cards per beat; add damage/guard/status cues; cancel/skip safely; integrate potion targeting through commands; remove top-HUD potion duplicates and mode grip from rebuilt composition.

**Exit:** reduced motion, interrupted playback, killing blow, render failure, and screen disposal all recover without stuck busy state or repeated rewards. Record performance traces.

### Phase 09 — Complete the first playable loop

**Deliverables:** title, minimal creation/kit choice, combat, reward, checkpoint/resume, readable completion.

**Steps:** use shared workspaces/cards; implement reward selection-before-confirmation; add isolated save namespace; retain committed RNG state; test save failure without replaying commands.

**Exit:** a user completes the loop without developer controls. Screenshot and interaction proof at supported profiles. This is the first integrated product checkpoint.

### Phase 10 — Restore equipment and service workspaces

**Deliverables:** Armoury, equipment change, shop, then Smith upgrade/extract/install as separately scoped tasks.

**Steps:** move price/eligibility/plans to domain owners; select stable references rather than captured array positions; compose category/list/detail panes; reuse confirmation/receipts/focus lifecycle.

**Exit:** no direct state mutation in presenters; stale selection and insufficient funds refuse safely; ownership and card grants remain coherent; relevant legacy rules preserved or separately specified.

### Phase 11 — Restore journey, knowledge, and narrative

**Deliverables:** reachable-map projection, knowledge-filtered inspection, specified quest/town/dialogue flows.

**Steps:** implement current approved route rules first, or the separately approved atlas replacement; keep fog/profile discovery distinct; reuse quest commands; add audio only after text fallback works.

**Exit:** Back/Skip/history do not replay consequences; hidden knowledge never enters visible models; route generation and saves deterministic.

### Phase 12 — Activate approved progression

**Prerequisite:** separate mechanics specification resolved and reviewed.

**Deliverables:** XP/practice authority, idempotent awards, derived ranks, unlocks, migration, W1x/XP UI bound to real data.

**Exit:** threshold crossing, rollover, duplicate events, death/load, and known/unknown technique cases pass; no gallery sample value treated as balance authority.

### Phase 13 — Expand content and restore remaining modes

**Deliverables:** additional class/build profiles, content families, selected custom/endless modes, and later co-op adapter.

**Steps:** add content in closed supported groups; simulate representative heavy physical, fast buildup, and caster builds once their mechanics are approved; restore remote authority through acknowledged commands and server snapshots.

**Exit:** each unbenched feature has its domain, presentation, save, and input tests; no client-authoritative co-op mutation; no empty promised navigation.

### Phase 14 — Cutover and remove superseded adapters

**Deliverables:** reviewed public entry/build change, migration policy, authoring guide, removal list proven by consumer search.

**Steps:** compare source and portable behavior; regenerate via existing tools; verify save namespaces; record retained legacy support; update changelog/user-facing documentation as applicable.

**Exit:** owner reviews and performs merges/releases. Remove legacy paths only in explicitly authorized removal tasks. A successful prototype is not permission to replace the released game.

## 14. Verification and acceptance matrix

### 14.1 Required fixture coverage

| Family | Minimum cases |
|---|---|
| Shell | Zero/one/two/three footer actions; long title; modal nesting; safe area; text scale |
| Buttons | Nine standard sizes; square exit; all role/state mappings; disabled reason |
| Cards | Every enabled family; 0/1/multiple costs; long name/body; missing art; selected/info |
| Hand | Empty, one, five, maximum supported, overflow; reorder; draw/discard during selection |
| Actors | One actor, uneven factions, full twelve-slot fixture; each depth/column; elite/boss art |
| Effects | 0, 1, 5, 20; inactive systems; overflow; changing values; selected detail expansion |
| Inspector | Known/unknown/none; vanished entity; long lore; no recursive info; focus return |
| Commands | Invalid target, stale revision, duplicate request, insufficient resources, mid-commit failure |
| Playback | Normal, reduced motion, skip, navigation, render exception, victory/defeat |
| Saves | New, resume, unsupported version/profile, corrupt data, quota/write failure |
| Benching | No missing dependency, disabled route, unsupported reward, or orphaned command |
| Narrative/progression | Add only with the relevant phase; use its explicit boundary cases |

### 14.2 Viewports and input

Use the reference's wide/compact configurations plus portrait fixtures at 375×667 and 360×780 CSS px. Add a short landscape stress case and a larger desktop. Record the exact chosen wide/compact sizes. Test default and enlarged text, reduced motion, pointer, touch, keyboard, and available gamepad navigation.

Browser emulation is not real-device validation. Label it honestly. The local gallery was observed in wide and portrait reference modes during review; this does not establish complete game or device coverage.

### 14.3 Visual assertions

- Card ratio and bands match computed tokens within a declared subpixel tolerance.
- Header/footer anchors remain in their reserved regions.
- Sibling footer widths subtract gaps correctly; circles and exit remain undistorted.
- Ground pivots remain fixed when effects/selection change.
- Minimum rendered text and touch sizes survive transforms.
- Card selection is exclusive and hover does not shift card position or paint order.
- Inspect control belongs to its owner, remains reachable, and reveals only after the correct delay.
- Hand can scroll only horizontally when overflowing; battlefield never scrolls.
- Potions exists exactly once in the footer and nowhere in the top HUD.
- No production mode grip or fixture-only progression control appears.
- Real assets preserve the dark-fantasy motif; placeholders are labeled only in development fixtures.

Pixel comparisons supplement geometry and interaction checks; they do not replace them. Compare the production renderer with the effective reference under equivalent data, viewport, font, theme, and animation state.

### 14.4 Data and architecture assertions

- All enabled IDs and composite references resolve.
- Inheritance/provider graphs are acyclic and use allowlists.
- Ratio sums, units, bounds, priorities, order, and token-type membership validate.
- No DOM/browser imports in pure layers; no gameplay mutation in presenters/components.
- VMs serialize and freeze without retaining domain references.
- Source relations have documented candidate keys and functional dependencies.
- Generated output is reproducible from the selected source snapshot.
- Existing entity scopes and RNG-sensitive ordering survive migration.

### 14.5 Existing commands and proposed checks

Existing required commands include:

```text
node tests/run-node.mjs
node tools/verdict.mjs -- node tools/verify-shipped.mjs
node tools/verdict.mjs -- node tools/buildversion.mjs --check
```

When runtime/content changes require regeneration, use the repository's supported tools:

```text
node tools/content-build.mjs
node tools/launch.mjs --build-only
```

Read current `DEVELOPER.md` and `.github/workflows/ci.yml` for additional applicable checks. Do not re-enable or redesign CI scheduling as part of this task. Integrate new suites into the actual runner; merely adding a test file does not make it run.

`validate-rebuild-data`, `verify-rebuild-boundaries`, and `verify-rebuild-layout` are proposed tools in this plan, not commands that already work. Implement small meaningful checks as their phases land. Do not build a large rule-checking framework that mostly validates its own paperwork.

### 14.6 Definition of done per task

1. The intended behavior exists in the actual rebuilt path.
2. Applicable headless tests run and pass; inherited failures are distinguished.
3. Rendered evidence covers the changed components and their integration.
4. Configuration has one source of truth, with no local style/formula workaround.
5. Bench/profile closure and saves remain valid.
6. Generated outputs are rebuilt through their owners when affected.
7. The draft PR says what changed, why, how verified, and what remains unverified.
8. No task claims an owner's merge/release approval that has not been given.

## 15. Authoring workflow and safeguards against drift

### 15.1 Change a visual default

Locate its token definition and owning token set; edit the normalized source; validate; compile; open the production component lab; compare all consuming variants; run the relevant geometry/interaction checks. Do not search for similar CSS literals and change them independently.

### 15.2 Add content using existing mechanics

Create the typed entity row and required relationships; reference existing effects/formulas/assets; assign tags; add it to an explicit build-profile membership; validate closure; preview its real VM in the lab; run a seeded encounter fixture. No UI code should be necessary unless it introduces a genuinely new supported presentation provider.

### 15.3 Add a new mechanic

Specify semantics first, including ordering, preview, save, replay, and future remote authority. Add the smallest supported interpreter primitive and typed payload. Test it headlessly. Then add providers and content. Never implement the mechanic by inspecting a component tag or animation state.

### 15.4 Add a new screen

Bind a wireframe definition to W0-derived composition; select providers; implement a pure screen projection; bind semantic intents in a presenter; register lifecycle and routes; add fixtures and capability dependencies. Do not duplicate markup from another screen.

### 15.5 Keep reference and implementation connected

Maintain a compact mapping from wireframe/component ID to production renderer, VM factory, config relations, and fixture IDs. This is traceability, not another architecture generator or task scheduler. The component lab uses that mapping and production renderers. Regenerate reference-derived documentation only through its generators.

## 16. Executor prompt for Claude

Copy the following as an implementation task prompt after the owner chooses the starting phase:

> Read `AGENTS.md`, `docs/WIREFRAME-FIRST-REBUILD-IMPLEMENTATION-PLAN.md`, the current mechanics specification, and the pinned or reviewed successor wireframe reference. Execute the next authorized bounded phase of the wireframe-first rebuild. Start from a clean branch off current `dev`; preserve the owner's dirty checkout and legacy saves. Treat the wireframes as the presentation acceptance contract. Resolve superseded clauses into one effective rule before coding. Build screens from immutable component view models and shared components, with normalized authoritative data compiled into fast runtime registries. Keep domain commands, presenter state, animation playback, and platform services separate. Benched features must be excluded by validated profile closure, not hidden buttons. Do not invent XP, proficiency, atlas, combat, or narrative consequences from mock data. Implement a real usable slice, validate its headless behavior and rendered wide/compact/portrait interaction, and provide concrete evidence. Do not merge, publish, delete legacy features, or replace saves without the owner's explicit authorization. Finish with the changed behavior, tests/evidence, unresolved limits, and the next dependency. Use one issue, branch, and draft PR per independently reviewable task; observe the repository's approval rules for outward-facing actions.

### 16.1 First implementation task

Begin with Phases 00–01 as documentation/baseline tasks. Then implement the compiler pilot and shared shell/card foundations. The first major demonstration should be the rebuilt combat scene connected to real engine behavior, not a full migration of every menu or every normalized content family.

### 16.2 Avoid these shortcuts

- Copying the reference gallery's illustrative state and calling it the game.
- Making every optional feature visible but nonfunctional.
- Performing an entire rebuild in one branch or one unreviewable PR.
- Porting legacy screen callbacks intact under new filenames.
- Adding per-screen pixels, formula copies, or one-off color overrides.
- Flattening typed game entities into a universal property bag to claim 3NF.
- Joining normalized tables or rescanning asset pixels every render frame.
- Rebuilding actors on every event and compensating with animation delays.
- Shrinking text/hit targets to force the nominal band percentages to fit.
- Using screenshot similarity alone as proof of functional or responsive correctness.
- Disabling failing tests, reviving removed governance, or scheduling agents to coordinate the rebuild.
- Treating this plan, a green test, or another agent's statement as owner merge approval.

The delivery principle is simple: prove the desired look and interaction in a small real game, make its components/configuration reusable, then restore features through those proven boundaries.
