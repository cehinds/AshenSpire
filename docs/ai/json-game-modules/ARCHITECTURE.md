# Proposed architecture and ownership decisions

**Status: target architecture; partially implemented on `Feature/json-game-modules`.** The checkout now contains the versioned profile resolver, module schemas/defaults, core/current bundles, content pack, generated lock, author CLI and host runtime adapters. The tree below describes the intended complete engine-neutral architecture; it is not a claim that every listed provider, rules VM, adapter, integration, state schema or cross-engine export exists. The present gameplay export requires `ashen.legacy-adapter@1`. See [README.md](README.md) for current verification status, [CORE-SPEC.md](CORE-SPEC.md) for product requirements, [IMPLEMENTATION.md](IMPLEMENTATION.md) for target acceptance and [PSEUDOCODE.md](PSEUDOCODE.md) for algorithm sketches. Do not scaffold the whole target tree or duplicate an existing authored source. This architecture does not change gameplay or release authorization.

## Separate infrastructure, minimum gameplay, features and game data

The target kernel is generic infrastructure: typed contracts, scheduler, transactions, deterministic RNG and bounded portable execution. The current `engine/kernel` resolves, validates, hashes and pins JSON profiles; it is not yet the complete gameplay scheduler or portable rules VM. It contains no heroes or Ashen game content. Versioned contracts define the target command, operation, value, state-owner and adapter surfaces.

The target game-neutral always-installed foundation supplies minimal gameplay providers: HP, baseline attack/pass actions, targets, enemy response/AI fallback, outcomes, activity launcher, log, inspect and basic presentation with procedural stand-ins. These providers are not user switches. The current `engine/foundation/foundation.json` and configured host adapter provide part of this fallback contract; full standalone and cross-engine foundation conformance is still acceptance work. Foundation declares mandatory fallback presentation contracts and target geometry; the web adapter renders procedural lowpoly stand-ins. Browser objects and rendering code stay outside portable gameplay. Technical scheduling belongs to the kernel; gameplay turn policy belongs to the foundation/provider binding and feature contributions. The full Ashen profile permits multiple SP/MP card plays and End Turn. One baseline command advances the technical fallback opportunity; that is not a product one-card-per-turn rule.

Modules are reusable feature implementations and declarative rules. Bundles are data-only module selections, exact pins, settings and pack references. Packs contain game definitions. The public name ashen.core@1.0.0 resolves to the Ashen bundle; it does not name a monolithic executable core module. No second implementation of cards, HP or progression belongs in that bundle.

## Proposed hierarchy

```text
engine/
  kernel/
  contracts/
  foundation/
    foundation.json
    guide.md
    rules.json
    standins.json
    cases.json
  modules/<id>/
    module.json
    settings.schema.json
    defaults.json
    state.schema.json          # required when module owns state
    guide.md
    rules.json
    runtime.mjs                 # only when justified below
    content.json               # optional reusable definitions
    ui.json                    # optional UI contributions
    cases.json                 # meaningful behavior cases
    integrations/<other>.json  # only actual integrations
  tools/
  adapters/web/
  adapters/headless/
  verification/
games/ashenspire/
  game.json
  game.lock.json             # generated, reproducible committed metadata
  guide.md
  bundles/core/
    bundle.json
    guide.md
  packs/core/
    pack.json
    classes.json
    cards.json
    equipment.json
    stances.json
    policies.json
    routes.json
    rest.json
    rewards.json
    tags.json
    groups.json
    presentation.json
    guide.md
  presets/
  art/
build/game-config/ashenspire/   # generated exports/reports, ignored
workbench/modules/<configuration>/
```

This is a responsibility map, not a bulk file-creation checklist. Many named paths already exist; optional target files are omitted when unused. `games/ashenspire/game.lock.json` is generated and committed as reproducible metadata. Exports and reports belong under ignored `build/game-config/ashenspire/`. Do not maintain a second editable lock there. The current lock records the resolver's runtime closure, selected module/bundle/pack artifacts and hashes; verify its exact fields before assuming a future contract or numeric-policy feature is implemented.

The Workbench/ctx integration remains target work; the current author surface is `games/ashenspire/game.json` plus the `tools/game-config.mjs` CLI. Reuse existing content/config compilers only through a reviewed adapter. For each migrated definition, designate exactly one authored owner. Existing sources remain canonical until that slice explicitly transfers ownership; do not make both trees independently editable.

## Public entry and inheritance

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {}
}
```

This is the only public author entry shape and inherits the full declared Ashen profile. JSON examples contain no // comments; use legal $comment metadata for annotations. Missing bundled entries inherit; missing nonbundled entries are off; false disables; true uses module defaults plus bundle settings; an object merges module defaults, bundle settings and author overrides. Objects merge recursively; arrays/scalars replace. No extra enable flag is added. RFC 6902 removal deletes an authored override, allowing inheritance to return; it cannot delete package/bundle defaults. Unknown settings fail with paths. $comment is metadata excluded from gameplay hashes.

A module manifest and settings excerpt might be:

```json
{
  "id": "resources",
  "version": "1.0.0",
  "settingsSchema": "settings.schema.json",
  "defaults": "defaults.json",
  "rules": "rules.json",
  "guide": "guide.md",
  "contracts": { "requires": ["foundation.hp@1"], "provides": ["resource.pools@1"] },
  "stateOwners": ["resources.pools"],
  "decorates": ["foundation.hp"]
}
```

```json
{
  "include": ["sp", "mp"]
}
```

Reusable module content supplies optional generic defaults/examples; Ashen-specific IDs belong only in game packs. IDs must be unique and namespaced. Reject duplicates unless an explicit versioned override declares the replacement; import order never chooses a winner.

These fields illustrate the intended separation, not an already accepted executable manifest schema. HP is always preserved and owned by foundation.hp. Resources may decorate its public interface but cannot create another authoritative HP pool. SP, MP and optional Actions state belong to resources. An HP-facing compatibility selector, if retained during migration, references foundation HP rather than enabling/disabling a second instance.

## Bundle and pack references

An abbreviated data-only bundle might be:

```json
{
  "id": "ashen.core",
  "version": "1.0.0",
  "foundation": "ashen.foundation@1.0.0",
  "modulePins": { "cards": "1.0.0", "resources": "1.0.0", "class-selection": "1.0.0", "rest": "1.0.0" },
  "settings": { "resources": { "include": ["sp", "mp"] } },
  "packs": ["ashen.core-content@1.0.0"]
}
```

```json
{
  "id": "ashen.core-content",
  "version": "1.0.0",
  "definitions": {
    "classes": "classes.json",
    "cards": "cards.json",
    "equipment": "equipment.json",
    "stances": "stances.json",
    "policies": "policies.json",
    "routes": "routes.json",
    "rest": "rest.json",
    "rewards": "rewards.json",
    "tags": "tags.json",
    "groups": "groups.json",
    "presentation": "presentation.json"
  }
}
```

Bundle manifests, module manifests and exact-pin catalogs are internal package-author formats, not alternative public author entry shapes. Edit cards.json to change an Ashen card, a module rules.json to change reusable behavior, defaults.json to change reusable module defaults, and game.json modules overrides to change one game configuration. Edit bundle settings only to change the versioned Ashen preset; publish/review that version deliberately.

The bundle excerpt intentionally omits other required core-selected modules; it is not a complete playable fixture. The implemented full bundle must select every provider needed for CORE-SPEC acceptance. Tags/groups select definitions or refer to declared behaviors. They never activate feature modules. Simple include lists are permitted; authors need not construct tag queries for a small explicit selection. Required unresolved references, including pending advanced values, fail executable compilation rather than becoming invented defaults.

## Ownership catalog

| Layer/package | Ashen selection and authoritative responsibility |
| --- | --- |
| Foundation | Always installed: HP, baseline actions/targets, fallback enemy response, terminal outcomes, activity launcher, log/inspect/basic UI and stand-ins. |
| cards | Core-selected: deck/hand/discard state and card play; owns deck-editor operations, while rest controls access. |
| resources | Core-selected: SP/MP and optional Actions pools; decorates foundation HP without owning duplicate HP. |
| stats | Core-selected: attributes and derived-stat contributions through typed contracts. |
| defenses | Core-selected block/poise; barrier/ward remain optional instances; owns defense state and operations. |
| stances, reactions | Core-selected for seven stances, response behavior, stagger and interrupt; separate namespaces and explicit integration. |
| effects, statuses | Core-selected enhanced operation/status behavior; foundation direct damage remains available independently. |
| equipment | Core-selected: inventory ownership, loadouts, equip/editor operations and gear upgrades; no sprite swapping. Other packages issue typed grant/upgrade requests. |
| class-selection | Core-selected fixed class chooser with model/host/UI unlock guards; no attribute creation. |
| progression | Core-selected: run earned-point/level state and separately owned permanent profile unlock ledger. Declare distinct progression.run and progression.profile ownership/lifetimes even within one package. |
| routes | Core-selected route state and navigation policy; foundation launcher remains fallback. |
| rest | Core-selected service/visit policy and durable service token; invokes card/equipment/progression capabilities and coordinates atomic recovery. |
| rewards, shops | Core-selected eligibility, offer/claim or purchase policies; use typed inventory/card grants rather than writing their state. |
| animation, art | Core-selected profile presentation where specified; fixed look, required animation facts and optional authored assets fall back to foundation stand-ins. |
| posture, damage-types, intent, dungeons, quests, dialogue, audio, advanced-ui, multiplayer | Later extensions unless explicitly selected by a reviewed bundle revision; no implicit activation. |
| character-creation | Optional later extension, off by default; not the fixed class selector. |

Combat is a composed capability pipeline, not a duplicate state-owning mega-module. Enemy AI uses foundation planning plus declared profile policies and enabled behavior contributions. Do not invent toggles for every helper, log panel or editor file. Any needed new capability has a named owner before integration. Inventory belongs to equipment; cards own card collections; cross-family rewards use their respective public commands.

The current `ashen.core@1.0.0` bundle selects cards, resources, stats, defenses, stances, effects, statuses, equipment, class-selection, progression, routes, rest, shops, rewards, art, animation, intent and reactions. The catalog also contains advanced-ui, audio, character-creation, damage-types, dialogue, dungeons, multiplayer, posture and quests, but the configured resolver rejects these unsupported additions. These are package IDs, not a second enable registry. There is no presentation, combat, inspect or editor helper toggle: basic presentation/inspect/log belong to foundation, combat is composition, and editors belong to cards/equipment with rest access policy.

## Explicit disabling and provider compilation

| Override | Required supported behavior |
| --- | --- |
| cards:false | Foundation attack/pass controls; no stale deck state. |
| resources:false | Foundation HP preserved; SP/MP/Actions absent; explicit authored cost/scaling variants or content exclusion. |
| stats:false or equipment:false | Authored baseline stat/loadout providers; no duplicate inventory or attribute state. |
| defenses:false / stances:false | Damage passthrough / neutral stance; no stale modifiers. |
| progression:false | Static run progression and explicit new-run profile policy; generic storage persists the progression-owned ledger. Preserve earned classes and ledger bytes; never implicitly relock or erase them. |
| routes:false or dungeons:false | Foundation activities keep independently enabled services reachable. |
| class-selection:false | Authored default eligible hero; optional character creation is not auto-enabled. |
| art:false / animation:false | Usable stand-ins/basic presentation, same targeting geometry; mechanics unchanged. |
| multiplayer:false | Single-player host binding. |

Built-in supported combinations, including each module explicitly off, require tested authored fallback/eligibility variants; this is not a promise for arbitrary combinations. Hiding a widget never disables its mechanic. Custom malformed references may fail validation. Disabled resources never mean ignoring arbitrary resource-dependent branches. Canonical content remains intact; projections record exclusions and variants without silent identity changes.

```text
entry = validateEntry(readAuthorJSON())
bundle = resolvePinnedBundle(entry.core)
selection = expandBundleAndOverrides(bundle, entry.modules)
settings = mergeAndValidate(moduleDefaults, bundle.settings, authorObjects)
contracts = loadPinnedContractsAndEnabledModules(selection)
providers = bindFoundationAndDeclaredContributionsOnce(contracts)
assertExactlyOneStateOwnerPerCapability(providers)
assertNoImplicitOptionalFeatureActivation(selection, providers)
content = projectPacks(bundle.packs, settings, explicitVariants)
validateAllRequiredRefsAndExecutableValues(content, providers)
packClosure = resolveAndHashAllReferencedPackArtifacts(content)
lock = canonicalLock(kernelPinAndHash, foundationPinAndHash, bundle,
                     modules, contracts, packClosure, definitionsHash,
                     provenance, hashes)
return isolatedRuntimeFactory(providers, content, lock)
```

Bindings are compiled once per resolved configuration; each runtime gets separate state, registries/caches and RNG. Pipeline ordering and numeric policies must be explicit, but this document does not prescribe unresolved damage-stage ordering or invent numeric rules. Transactions checkpoint state, queue and RNG; committed facts follow commit, external effects use deduplicated outboxes. Adapters never bypass state ownership.

## Portability and guides

rules.json is portable declarative behavior interpreted against versioned contracts. runtime.mjs is optional: either a host interpreter implementation of a declared portable contract or an explicitly native extension. It is not silently portable merely because its manifest serializes. Export rejects required native behavior unsupported by the target; never omit functions and claim completeness. Data-only bundles and packs cannot contain runtime functions or register executable providers; they only select and configure declared capabilities/definitions.

Each module and pack guide documents schema/defaults, inherited settings/provenance, recipes, ownership/lifetime, disabled fallback, dependency/integration behavior, validation and portability. Give a new-module handoff checklist: catalog/pin registration, state owner, public operations, off behavior, authored variants, UI contributions, guide and behavioral cases. Explain pending advanced values and how compilation refuses them. Preserve every CORE-SPEC requirement, including class unlock ledger, rest-only Strategize deck editing, one atomic rest service, full recovery, fixed appearances and confirmed class/hand rules. Architecture acceptance supplements those gameplay tests rather than replacing them.

## Review recommendations incorporated

| Recommendation | Decision |
| --- | --- |
| Separate infrastructure from gameplay | Generic kernel, game-neutral always-installed foundation, reusable modules and data-only game bundle/packs. |
| Avoid duplicate state | One owner per capability, compiled bindings, foundation HP decorated rather than copied. |
| Keep authoring practical | One small public entry; internal manifests/pins; direct includes; clear card/rule/default/override edit locations. |
| Preserve portability | Declarative rules plus explicit native capability boundary; web renderer outside gameplay. |
| Limit migration risk | Slice-sized ownership transfer, legacy compatibility adapter, no bulk scaffolding or duplicate editor. |
