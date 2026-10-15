# JSON game modules: implementation instructions

Status: implementation instructions delivered; gameplay changes are **not implemented**. This document describes proposed future development, not a claim that the proposed paths, schemas, CLI or runtime exist. Read [PSEUDOCODE.md](PSEUDOCODE.md) for algorithm sketches and [CONTINUE.md](CONTINUE.md) for continuation and handoff instructions. The parent README records delivery status. [CORE-SPEC.md](CORE-SPEC.md) is the canonical product-core specification: use its confirmed requirements, recommendations and open questions without copying unresolved numbers into implementation defaults. This revision supersedes the earlier minimal attack/pass product definition; runtime/source implementation remains pending.

## Authority and working boundary

The integration target is **Feature/json-game-modules only** until an explicit future owner instruction changes this boundary. During this boundary, never merge or promote this work into dev, test, release or main, and never open a PR into dev. Workers may commit and push their own worker/json-game-modules/<task> branches; only the integrator pushes Feature/json-game-modules. This explicit user instruction overrides the standing CLAUDE.md promotion workflow. Existing live-session authorization remains valid for its scope; this handoff grants no new authority and does not require fresh approval for already authorized work. Read CLAUDE.md, CONTRIBUTING.md, DEVELOPER.md and SPEC.md before source changes; propose any necessary specification amendment alongside its implementing slice. Do not introduce AGENTS.md.

Workers use their own narrowly scoped branches and worktrees. Push every small self-contained commit immediately. Integrate reviewed commits into the parent feature branch only. The user-selected Sol 6.1 medium/low and GPT-6 Luna workers supersede the repository's model routing for this work. Give one worker ownership of each file in a wave; do not give two workers overlapping compiler or runtime edits. Review each diff and the actual browser behavior before accepting a visible slice.

For this documentation delivery, only these instructions are being committed by this worker. No game build is required. Future source work needs the targeted gates below. Existing preview workflows must be inspected before use: Feature/** casing is supported, but README wording about PR requirements has drifted. Do not promise a published preview based on an unverified workflow or repeat a claim that a GitHub API operation succeeded when access returned Forbidden. Documentation alone does not create a new gameplay preview.

## 1. Verify the live baseline before changing it

The unchanged source baseline for this documentation revision is main at 49c5781fe. Record source paths and current behavior in a short checked-in inventory. Confirm each cited seam in the current branch; line numbers drift. The live data compiler is tools/content-build.mjs, which reads content/source and emits src/content/generated. tools/config-build.mjs separately compiles content/config UI definitions. content/framework supplies the framework tree. Retain these as adapters during migration.

Inspect src/engine/actions.js for effect execution; src/model/combatCardProfile.js for card resolution; src/model/loadout.js and src/model/state.js for initial equipment, grant sources and deck assembly. Inspect bridge/singleton registry paths and identify every global cache or RNG that could leak between two runtimes. Inventory src/model/worldAtlas.js, content/source/worldAtlas.json, src/content/mapconfig.js, content/source/legacyDungeons.json and src/content/shops.js. Character choices already use content/source/characterCreation.json. UI fields already use content/config/ui/components/card.json and src/model/cardFields.js; card-face phrase order still lives in src/model/cardFaceText.js.

Inspect tools/engine-export.mjs and docs/ENGINE-EXPORT.md before extending export. The exporter already emits useful tables, schemas, manifests and hashes. Serialization that omits functions does not establish portable behavior. Identify those omissions explicitly. docs/tag-model/README.md labels its compiler and tables a proposal: do not migrate that folder as if it were authoritative live content. Live tag nodes and effects remain content/source/nodes.csv, its relation/binding companions and nodeEffects.json until deliberately changed.

Acceptance: an inventory distinguishes executable behavior, declarative live content, generated files and proposal-only material; a seeded representative legacy trace and save fixture establish the legacy baseline, not the numeric specification for the new ruleset; no broad src rename or replacement is included.

## 2. Freeze the authoring contract and examples

The sole public entry shape is proposed as:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {}
}
```

This selects the complete four-class, ten-card Ashen core bundle, not the internal attack/pass harness. ashen.core@1.0.0 is an explicit versioned declaration of the same feature modules used elsewhere, with Ashen selections and settings; it is not a second monolithic implementation. A missing bundled module inherits its bundle selection/settings; a missing nonbundled module is off. false explicitly disables a module. true enables module defaults plus bundle overrides, preserving Ashen defaults. An object applies module defaults, then bundle settings, then author overrides. Do not introduce a parallel settings.enable registry. A second proposed example is:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {
    "cards": true,
    "resources": { "include": ["hp", "sp", "mp"] },
    "defenses": { "include": ["block", "poise"], "order": ["block", "poise"] },
    "stances": { "include": ["attack", "counter", "smash", "sweep", "prepare", "evade", "defend"] },
    "art": false
  }
}
```

A versioned catalog maps these stable IDs to pinned manifests. Expand the declared bundle with provenance for each inherited selection and setting. Resolve settings as module defaults, then bundle overrides, then the entry's object overrides: keyed objects merge recursively, arrays replace entirely, scalars replace. Removal is only an explicit RFC 6902 config patch applied before resolution, never a special null convention. An RFC 6902 remove deletes an authored override, so the inherited bundle setting, or module default when no bundle override exists, returns during resolution; it cannot erase a bundle/package default. To replace that inherited value, use a schema-defined replacement setting such as include:[], or edit the owning bundle/package definition/default; null has no magic removal meaning. Validate patches and the resulting configuration. Unknown properties and unresolved required references report their exact JSON paths. Permit $comment metadata; ignore it in execution and gameplay hashes. Selecting the core explicitly opts into its declared bundle. Dependencies cannot silently activate unrelated optional features because another module mentions them.

Freeze definitions for typed IDs, values, state, commands, events, operation signatures and adapter versions. Specify canonical JSON ordering, numeric representation, finite-number restrictions, integer bounds, rounding, per-hit versus per-action application and mixed-damage allocation. Specify named RNG streams, draw order, scheduler ordering and a bounded declarative rules VM. The lock records the exact bundle and module versions, artifact hashes, contract versions, expanded selections, provenance and resolved gameplay hash. Native host extensions must declare a separately versioned execution capability; they are not portable declarative rules.

Acceptance: positive examples include the full inherited Ashen bundle, explicit disabling of bundled modules with supported fallback content, nonbundled additions and selected narrow combinations. Separately exercise individual modules against the technical fallback harness; those cases do not redefine the product core. Negative examples include unknown IDs/settings, incompatible contracts, required missing references, invalid patches and unsupported portable behavior. Every example is machine-readable and tested against the real schema once it exists. The schemas in these instructions are proposals until implementation lands.

## 3. Build the declared four-class playable core incrementally

Keep the generic kernel separate from the product bundle. The kernel owns typed contracts, deterministic scheduling, registries, transactions and adapter boundaries. ashen.core@1.0.0 declares the feature-module selection/settings needed for the complete product in [CORE-SPEC.md](CORE-SPEC.md): cards, HP/SP/MP resources, stats, block/poise, seven stances, enhanced effects/statuses, reactions, equipment, fixed class selection, progression, routes/rest/shops/rewards and basic log/inspect/UI. Presentation uses fixed class appearances and required procedural lowpoly stand-ins. Do not hide legacy systems wholesale under a core name or create separate core copies of module mechanics.

Begin with the four-class core manifest and a ten-card baseline scene, then a typed combat slice through the existing adapter. Retain the legacy preset and entry path. An internal minimal attack/pass scene can prove transactions, targeting, enemy response, outcomes and saves before the product bundle is complete. Optionally name that fixture ashen.fallback@1.0.0; it is a technical fixture, not the current product core or default author example.

The technical runtime must always have attack/pass fallback actions and a turn opportunity that ends after a baseline command independently of SP, MP or Actions. Providers for action, target, stats, damage, navigation and presentation remain stable when features are explicitly disabled. Disabled stats/equipment use baseline values, defenses pass damage through, stances are neutral, and hidden intent leaves enemy planning active. Disabled routes/dungeons expose core activities; independently enabled shops, quests and dialogue remain reachable through that launcher. Creation explicitly disabled supplies the authored default hero; progression explicitly disabled is static.

Required product acceptance includes class selection with fixed loadouts rather than attribute creation, an enabled deck editor, attributes and level allocation, gear/relic/card rewards, rest equipment choices, a one-channel damage model, seven stance interactions, stagger/interrupt, simple card resolution, log, inspect, fixed appearance and the specified animations. Detailed amounts, sequencing and unresolved decisions belong to CORE-SPEC.md. Do not invent SP formulas, costs, durations or missing benefits to fill schema fields.

Art disabled, missing or load-failed must show stand-ins using identical hitboxes and target geometry. Gear does not swap class sprites. Art cannot determine legal targets or outcomes; multiplayer disabled remains single-player. Saves are versioned and continuation deterministic. Acceptance requires both complete product runs and separate fallback-harness win/death/restart/save checks, plus isolated simultaneous runtimes. Legacy trace parity applies to the legacy preset; it does not freeze legacy formulas for the new product ruleset.

## 4. Package ownership and module catalog

The following is a **future target map**, not a tree that currently exists. Introduce paths only for an implemented slice; do not bulk scaffold them or move legacy files merely to match this map.

| Proposed path | Responsibility |
| --- | --- |
| engine/kernel/ | Generic registries, transactions, scheduling and composition. |
| engine/contracts/ | Versioned ABI, bounded rules VM, numeric policies and RNG contracts. |
| engine/core/ | Versioned declared Ashen module bundle and baseline assets/contracts; core.json, core.schema.json, core.mjs, core.md, core.content.json, core.ui.json, core.standins.json and core.cases.json. |
| engine/modules/<id>/ | Optional feature packages using the template below. |
| engine/games/ashenspire/ | game.json, generated game.lock.json, game.md and authored presets/, groups/ and packs/. |
| engine/tools/ | Proposed resolver, configuration and export commands; executable names remain undefined until implemented. |
| engine/adapters/web/ and engine/adapters/headless/ | Browser presentation/input and headless host integration. |
| engine/verification/ | Shared contract, numeric, replay and portability conformance vectors. |

Extend the existing Workbench through workbench/modules/<configuration>/ and its existing ctx API; do not build a second application or duplicate editor. Existing src/content compilation inputs remain canonical through a compatibility adapter until each migration explicitly selects its single authored owner. Never leave both the legacy and replacement trees editable as competing sources of truth.

Proposed package organization is:

```text
engine/modules/<id>/
  <id>.json
  <id>.schema.json
  <id>.mjs
  <id>.md
  <id>.content.json
  <id>.ui.json
  <id>.cases.json
  integrations/<other>.json
```

These paths are future architecture, not existing commands or files. The manifest owns identity/version, settings defaults, contract/capability declarations, content/UI/state contributions and integration declarations. Each module owns its implementation, schema, guide and meaningful behavior cases. Include content, UI and integration files only when used; do not force empty placeholders. Family subfolders organize packages without changing IDs or becoming user-facing toggles.

User switches are cohesive feature packages: cards, resources, stats, damage-types, defenses, stances, reactions, posture, intent, effects, statuses, equipment, character-creation, progression, routes, dungeons, shops, rewards, quests, dialogue, art, animation, audio, advanced-ui and multiplayer. Internal helper files are not switches. Technical helper dependencies can resolve and bundle automatically; optional feature integrations run only when their participating user features are enabled.

Resources is one generic pool package with independently selectable hp, sp, mp and actions instances; the Ashen bundle selects its CORE-SPEC pools and Actions remains independently configurable. Defenses is one generic defense package with block, barrier, ward and poise instances, explicit ordering and applicability. Do not reproduce the same mechanism as several bespoke implementations. Effects and statuses extend minimal core operations rather than becoming required dependencies for every direct attack.

Typed pipeline stages declare input/output, ordering, ownership and allowed mutations. Modules cannot write another module's state. State contributions live under namespaced keys. Cross-feature behavior uses conditional integration contracts and commands/facts, with a designated owner and adapter version. Scheduler and rules execution have bounded work limits and named errors for unsupported operations.

Transactions must checkpoint state, queue and RNG. A failed operation restores all three. Emit committed facts only after commit; external effects use deduplicated outbox IDs, never irreversible calls inside a rollback region. Reactions must obey the same scheduler and rollback rules.

Acceptance: no missing optional module triggers an import-time crash, singleton mutation or implicit activation; every package has a declared public surface and a real independent behavior case. Validate pipeline ordering and conflicts before starting a run.

## 5. Prove the ten-card bundle and explicit feature overrides

Extract cards as a reusable module with its own content, deck/hand state, actions and UI; the declared Ashen core enables it by inheritance. Implement the four class starter packages and ten-card distribution specified in CORE-SPEC.md, with an enabled deck editor and no fixed nine-slot restriction. A missing cards entry retains that selection. Explicit cards:false on a new game invokes attack/pass fallback without stale deck state or a blank screen. This override proves composability; it does not replace full-core acceptance.

Use a narrow SP/block integration slice to prove resources and defenses can attach and detach while the legacy adapter remains available. A missing resource is not a blanket instruction to ignore every effect. A simple cost can disappear only through an explicitly authored fallback. Scaling, conditional branches, spend-all behavior and other resource-dependent semantics require an authored variant; otherwise the content is unavailable with a diagnostic report. Never silently change a card's identity or introduce a zero-cost infinite command loop.

Retain canonical definitions and derive eligible projected content for a selected module set. Built-in starter packages supply baseline variants and eligibility choices that preserve a legal starting deck. Record exclusions and chosen variants for inspection. Custom external configurations with required missing references may fail validation; all supported built-in combinations, including the inherited bundle, supported explicit disables and each module against the fallback harness, must remain playable.

Acceptance: inherited full-core starters and new games with cards explicitly on/off are usable; a resource toggle changes the intended behavior and visible costs; an unsupported resource-dependent card is excluded with its path and reason; starter legality remains valid; baseline actions permit turn advancement when no card is playable.

## 6. Migrate by observable feature waves

Wave A covers resources, defenses and equipment. Reuse loadout grant-source assembly and existing profile resolution through adapters. Test separate SP/MP/Actions inclusion and ordered block/barrier/ward/poise. Verify optional stats, damage-types and equipment each fall back to baseline values without leaking incompatible references.

Wave B covers stances, reactions, posture, intent, enhanced effects and statuses. Implement the seven CORE-SPEC stance identities and confirmed matchup rules, plus stagger/interrupt, while distinguishing mechanic enablement from visibility. Hiding intent does not disable enemy AI. Hiding stance widgets does not disable stance calculations. Test reaction chain limits, rollback and deterministic ordering with more than one integration active.

Wave C covers character creation, progression, routes, dungeons, shops, rewards, quests and dialogue. The bundle inherits fixed class selection, progression and routes. Explicitly disabling creation chooses the default hero; disabling progression stays static; disabling routes/dungeons returns to core activities. Migrate atlas profiles, classic-map shapes and dungeon graphs as separate content concepts. Build three acts with seven preboss nodes and one boss per act as specified in CORE-SPEC.md; preserve explicit bosses and seeded constraints. Apply its node-visibility and two-visible-rest requirements rather than guessing a replacement rule. Shops expose authored count/options rather than only layout. Shops, quests and dialogue must remain reachable when enabled alone.

Wave D covers art, animation, audio, advanced-ui and multiplayer. Basic inspect, log and targeting remain usable with optional presentation packages explicitly disabled; a missing bundled presentation entry retains its inherited selection. Presentation adapters consume committed facts. Multiplayer is a bounded later slice with explicit authority, deterministic replay and transport contracts; do not claim it works solely because state can be serialized.

Assign separate workers to non-overlapping module files, with one integration worker for the catalog and one reviewer for scenario evidence. For each wave, list exact owned paths before dispatch. Keep compilers and compatibility adapters under a single owner. Integrate one reviewed, tested small commit at a time.

## 7. Workbench, CLI, export and save discipline

Build one resolver used by Workbench and CLI. Workbench supports validate, preview, apply to a new game, update configuration and export. Show errors with JSON paths, module ownership and unavailable-content reasons. Do not create a second editor-only interpretation of merges, versions or feature enablement. Any new module CLI commands are proposed work; document them as executable only after files and help output exist.

Distinguish configuration edits, module upgrades and save migrations. New games use current selected toggles. Running saves pin their exact lock and resolved hash; v1 has no hot unload. An upgrade proposes a new lock. A save migration is an explicit, tested, atomic operation with rollback and is not automatically authorized by editing a setting. Refuse incompatible saves without destroying their bytes.

Export one engine-neutral resolved bundle containing contracts, manifests, canonical/projected content, declarative rules, UI descriptions, assets, lock and hashes. Preserve source/provenance references without exposing browser objects or HTML as behavior contracts. Web and headless are adapters; Unity/Unreal consumers should not need JavaScript execution merely to understand a direct-damage rule. Reject unsupported required native behavior with its owning path/capability; never omit a function and report a complete export.

Acceptance: Workbench and CLI resolve identical bytes/hashes; export round trips in a non-web validation harness; unsupported required behavior fails explicitly; save mismatch and failed migration preserve the original save; unchanged comments do not change the gameplay hash.

## 8. Module guide and catalog template

Every module guide must answer the following in plain language, with a minimal valid JSON example and one meaningful change example:

1. What feature the player gains, its stable ID/version, whether the Ashen bundle selects it, and the authored fallback when explicitly disabled.
2. Each setting's type, module default, inherited bundle override/provenance, unit, range, merge behavior and exact schema path; distinguish mechanic switches from visibility controls.
3. Required technical capabilities and conditional optional integrations; show behavior when each counterpart is absent.
4. Content authoring schema, typed references, eligibility rules and fallback variants; show an invalid example and its diagnostic.
5. State namespace, commands, committed events, operation signatures, RNG streams and pipeline ordering.
6. UI/widget contributions, inspect information, placements, input bindings, target geometry and lowpoly/art fallback behavior.
7. Numeric/rounding policies and resource costs, especially disabled-resource behavior and loop prevention.
8. Portability class, native extensions if any, adapter requirements and export limitations.
9. Save compatibility/version policy and any separately authorized migration procedure.
10. Behavior cases and runnable verification commands once implemented; include inherited bundle, fallback-harness enabled-alone, explicit disabled and integration outcomes. Include a new-module handoff listing catalog registration, owner, public contracts, authored fallback, guide, portable cases and required integration changes.

The catalog links each guide, pinned manifest, schema and representative case. Include a quick-start recipe for the inherited full Ashen core, its ten-card starters, a three-act eight-node-per-act route, custom shops and presentation settings. Explain that authors edit the one entry JSON and referenced content modules, while the resolver derives runtime artifacts.

## 9. Reviewer recommendation and user-goal acceptance matrix

| Recommendation or goal | Implementation evidence required |
| --- | --- |
| Generic kernel and full declared core | Four-class ten-card product browser win/death/restart/save; module selection/provenance visible; technical attack/pass harness verified separately. |
| One simple authoring entry | Canonical shape above, strict schema, one resolver, no competing enable registry. |
| Seven preboss nodes plus one boss, three acts | Each act resolves eight playable stops with reachable final boss; CORE-SPEC visibility/rest rules and node inspect verified. |
| Four fixed classes and ten-card starters | Each starts with 3 Strike, 3 Defend, Counter, Smash, Sweep and its class special; no initial Evade card; loadouts and enabled deck editor match CORE-SPEC. |
| HP/SP/MP resources and independent Actions | Each individual include and meaningful combinations tested; core turn opportunity still ends after command. |
| One-channel damage, block and poise | Actual damage/rounding, stagger and interrupt cases follow CORE-SPEC; unresolved Poise interpretation is not replaced by legacy depletion behavior. |
| Seven stances and matchups/buffs | Attack/counter/smash/sweep/prepare/evade/defend cases verify confirmed edges independently of widget visibility. |
| Card face limits and secondary information | Configured face budget limits displayed fields; inspect exposes the declared secondary information; no gameplay change from hiding text. |
| Shops, rest, rewards and progression | Fixture checks offers, purchases and reachability with routes off; rest recovery/flasks, allocation/upgrades, rewards and gear choices follow CORE-SPEC and confirmed equipment policy. |
| Boss size, inspect and relative widgets | Browser evidence at desktop/mobile shows configured boss scale and widget anchors; target geometry remains valid and inspect usable. |
| Optional assets | Missing/disabled/load-failed art renders core stand-ins with unchanged targeting and outcomes. |
| Portable behavior | Neutral bundle passes conformance vectors; unsupported required native operation is rejected. |
| Safe composition | Full inherited bundle, supported explicit disables/additions, standalone fallback-harness cases and higher-order invariants pass without implicit unrelated activation. |
| Determinism and isolation | Two concurrent runtimes, save replay, queue/RNG rollback and numeric vectors pass. |

Do not turn this matrix into tests that merely compare a setting to itself. Assert resulting actions, damage, turns, reachability, visible fields and outcomes.

## 10. Verification and completion gates

For source work, start with scenario-specific tests and touched discovered test shards. The existing focused runner command is `node tests/run-node.mjs --no-selftests --no-discovered`; verify current runner flags before execution. DEVELOPER.md also documents `node tools/launch.mjs --build-only` and `node tools/plantsites.mjs --check` for relevant src changes. Run generated-content checks when compiler inputs change. Avoid rerunning unrelated long suites after sufficient green evidence unless changes or unresolved failures justify it.

Generate a supported-toggle matrix covering the complete inherited bundle, supported explicit feature disables/additions, fallback harness plus each module, all supported resource/defense selections and selected higher-order combinations. Invariants include at least one legal action, turn advance, reachable outcome, legal deck where cards are enabled, valid save/reload and isolated runtimes. Add targeted regression cases for reactions and transactional rollback, numeric allocation/rounding, fallback art and unsupported exports. Preserve baseline trace parity through the legacy preset while the migration remains partial.

Browser review must exercise full four-class product-core win/lose/save, separately exercise fallback-harness outcomes, and meaningful module add/remove on new runs, rather than only rendering the settings screen. Capture desktop/mobile evidence for visible UI changes and use the verified feature-preview delivery path. Integrate only after review and applicable checks. Finish each phase with committed status: delivered files, exact SHAs, actual commands and results, remaining risks and next bounded task. Until source slices pass these gates, report this package as **documentation delivered, implementation pending**.

## 11. Product-rule freeze and unresolved choices

Use [CORE-SPEC.md](CORE-SPEC.md) as the detailed source for fixed loadouts, attributes/bonuses, weapon and armour families, level gains, starting hand, round reshuffle, class specials, replayable stacking powers, recovery, rewards, stance edges and animation states. It separates confirmed requirements from recommendations and pending answers. Current legacy formulas and traces are comparison fixtures, not authority to override this new ruleset. Source SPEC changes belong to future implementation slices, not this documentation revision.

Before implementing affected numeric cases, incorporate the live owner answers recorded there for Poise interpretation, initial INT versus starting hand, and equipment-editor availability versus claim/rest-only swapping. Do not invent a default or add a new approval gate: proceed on already authorized independent work while those decisions remain pending. Likewise distinguish the recommended three reward offers/choose-one behavior from a confirmed instruction, and do not infer direct MP refill from MP-flask refill. Target level gains per act/run do not establish exact XP thresholds.

Keep no-elements, no ranked spells, no feats and no skill-XP constraints visible in author guides and eligibility validation. The required fixed-look animations and log/inspect interactions must receive browser acceptance; use the CORE-SPEC inspection gesture and selected-target HUD behavior. Publish implementation status against full product requirements, not merely a passing minimal harness.
