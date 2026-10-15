# JSON game modules: implementation instructions

Status: implementation instructions delivered; gameplay changes are **not implemented**. This document describes authorized future development, not a claim that the proposed paths, schemas, CLI or runtime exist. Read [PSEUDOCODE.md](PSEUDOCODE.md) for algorithm sketches and [CONTINUE.md](CONTINUE.md) for continuation and handoff instructions. The parent README records delivery status.

## Authority and working boundary

The integration target is **Feature/json-game-modules only**. Never merge or promote this work into dev, test, release or main, and never open a PR into dev. This explicit user instruction overrides the standing CLAUDE.md promotion workflow. Read CLAUDE.md, CONTRIBUTING.md, DEVELOPER.md and SPEC.md before source changes; propose any necessary specification amendment alongside its implementing slice. Do not introduce AGENTS.md.

Workers use their own narrowly scoped branches and worktrees. Push every small self-contained commit immediately. Integrate reviewed commits into the parent feature branch only. The user-selected Sol 6.1 medium/low and GPT-6 Luna workers supersede the repository's model routing for this work. Give one worker ownership of each file in a wave; do not give two workers overlapping compiler or runtime edits. Review each diff and the actual browser behavior before accepting a visible slice.

For this documentation delivery, only these instructions are being committed by this worker. No game build is required. Future source work needs the targeted gates below. Existing preview workflows must be inspected before use: Feature/** casing is supported, but README wording about PR requirements has drifted. Do not promise a published preview based on an unverified workflow or repeat a claim that a GitHub API operation succeeded when access returned Forbidden. Documentation alone does not create a new gameplay preview.

## 1. Verify the live baseline before changing it

Record source paths and current behavior in a short checked-in inventory. Confirm each cited seam in the current branch; line numbers drift. The live data compiler is tools/content-build.mjs, which reads content/source and emits src/content/generated. tools/config-build.mjs separately compiles content/config UI definitions. content/framework supplies the framework tree. Retain these as adapters during migration.

Inspect src/engine/actions.js for effect execution; src/model/combatCardProfile.js for card resolution; src/model/loadout.js and src/model/state.js for initial equipment, grant sources and deck assembly. Inspect bridge/singleton registry paths and identify every global cache or RNG that could leak between two runtimes. Inventory src/model/worldAtlas.js, content/source/worldAtlas.json, src/content/mapconfig.js, content/source/legacyDungeons.json and src/content/shops.js. Character choices already use content/source/characterCreation.json. UI fields already use content/config/ui/components/card.json and src/model/cardFields.js; card-face phrase order still lives in src/model/cardFaceText.js.

Inspect tools/engine-export.mjs and docs/ENGINE-EXPORT.md before extending export. The exporter already emits useful tables, schemas, manifests and hashes. Serialization that omits functions does not establish portable behavior. Identify those omissions explicitly. docs/tag-model/README.md labels its compiler and tables a proposal: do not migrate that folder as if it were authoritative live content. Live tag nodes and effects remain content/source/nodes.csv, its relation/binding companions and nodeEffects.json until deliberately changed.

Acceptance: an inventory distinguishes executable behavior, declarative live content, generated files and proposal-only material; a seeded representative legacy trace and save fixture establish the baseline; no broad src rename or replacement is included.

## 2. Freeze the authoring contract and examples

The sole public entry shape is proposed as:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {}
}
```

This is a complete core-only game request. A module entry absent or false disables it; true enables its defaults; an object enables it with setting overrides. Do not introduce a parallel settings.enable registry. A second proposed example is:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {
    "cards": true,
    "resources": { "include": ["sp", "mp"] },
    "defenses": { "include": ["block", "poise"], "order": ["block", "poise"] },
    "stances": { "include": ["attack", "counter", "sweep", "defend"] },
    "art": false
  }
}
```

A versioned catalog maps these stable IDs to pinned manifests. Resolve settings as defaults followed by the entry's object overrides: keyed objects merge recursively, arrays replace entirely, scalars replace. Removal is only an explicit RFC 6902 config patch applied before resolution, never a special null convention. Validate patches and the resulting configuration. Unknown properties and unresolved required references report their exact JSON paths. Permit $comment metadata; ignore it in execution and gameplay hashes. Do not silently activate optional features because another module mentions them.

Freeze definitions for typed IDs, values, state, commands, events, operation signatures and adapter versions. Specify canonical JSON ordering, numeric representation, finite-number restrictions, integer bounds, rounding, per-hit versus per-action application and mixed-damage allocation. Specify named RNG streams, draw order, scheduler ordering and a bounded declarative rules VM. The lock records exact versions, artifact hashes, contract versions and the resolved gameplay hash. Native host extensions must declare a separately versioned execution capability; they are not portable declarative rules.

Acceptance: positive examples include core, core plus every individual module and the selected narrow combinations. Negative examples include unknown IDs/settings, incompatible contracts, required missing references, invalid patches and unsupported portable behavior. Every example is machine-readable and tested against the real schema once it exists. The schemas in these instructions are proposals until implementation lands.

## 3. Build a small required playable core

Distinguish the generic kernel from the required playable core. The kernel owns typed contracts, deterministic scheduling, registries, transactions and adapter boundaries. The playable core supplies a browser game: new run, default hero and enemy HP, direct attack and pass, target selection, player/enemy response cycle, enemy AI, win/death outcomes, restart, a basic activity menu, usable UI and inspect, procedural lowpoly stand-ins and versioned saves.

A baseline command consumes a turn opportunity even when SP, MP and Actions are absent. Player attack/pass must therefore remain available independently of resource modules. Enemy planning exists without intent display. Core supports minimal direct-damage and action operations; enhanced effects and statuses remain optional. Keep this core small: do not hide the entire legacy game under its name.

Expose stable action, target, stats, damage, navigation and presentation providers. A baseline stat provider supplies valid HP and attack values without the optional stats package. Optional defenses absent means damage passes through. Optional stances absent means neutral behavior. Core activities supply a navigation home even when routes and dungeons are disabled. Shops, quests and dialogue register accessible launcher entries when enabled without routes.

Core stand-ins are required infrastructure. Optional art disabled, missing or failing to load must show them using the same hitboxes and target geometry. Art must never determine legal targets, turn progression or outcomes. Multiplayer disabled means ordinary single-player operation.

Build the core-only vertical slice behind an adapter while retaining the current legacy preset and entry path. First prove one complete win and one complete death/restart, then save/reload. Do not begin by deleting old gameplay or moving every file.

Acceptance: core-only browser and headless games reach outcomes; attack/pass and target inspection work; saving preserves the deterministic continuation; two simultaneous runtimes cannot affect each other's registries, caches, RNG or state. The legacy preset still produces its recorded trace within declared compatibility limits.

## 4. Package ownership and module catalog

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

Resources is one generic pool package with independently selectable sp, mp and actions instances. Defenses is one generic defense package with block, barrier, ward and poise instances, explicit ordering and applicability. Do not reproduce the same mechanism as several bespoke implementations. Effects and statuses extend minimal core operations rather than becoming required dependencies for every direct attack.

Typed pipeline stages declare input/output, ordering, ownership and allowed mutations. Modules cannot write another module's state. State contributions live under namespaced keys. Cross-feature behavior uses conditional integration contracts and commands/facts, with a designated owner and adapter version. Scheduler and rules execution have bounded work limits and named errors for unsupported operations.

Transactions must checkpoint state, queue and RNG. A failed operation restores all three. Emit committed facts only after commit; external effects use deduplicated outbox IDs, never irreversible calls inside a rollback region. Reactions must obey the same scheduler and rollback rules.

Acceptance: no missing optional module triggers an import-time crash, singleton mutation or implicit activation; every package has a declared public surface and a real independent behavior case. Validate pipeline ordering and conflicts before starting a run.

## 5. Prove cards add/remove before widening scope

Implement cards as the first independent optional module, with its own content, deck/hand state, actions and UI. Core without cards uses attack/pass. Cards enabled supplies a legal default deck and inspectable playing cards. Removing cards for a new game restores the core controls without stale deck state or a blank combat screen.

Use a narrow SP/block integration slice to prove resources and defenses can attach and detach while the legacy adapter remains available. A missing resource is not a blanket instruction to ignore every effect. A simple cost can disappear only through an explicitly authored fallback. Scaling, conditional branches, spend-all behavior and other resource-dependent semantics require an authored variant; otherwise the content is unavailable with a diagnostic report. Never silently change a card's identity or introduce a zero-cost infinite command loop.

Retain canonical definitions and derive eligible projected content for a selected module set. Built-in starter packages supply baseline variants and eligibility choices that preserve a legal starting deck. Record exclusions and chosen variants for inspection. Custom external configurations with required missing references may fail validation; all supported built-in combinations, including each module individually with core, must remain playable.

Acceptance: new games with cards on and off are usable; a resource toggle changes the intended behavior and visible costs; an unsupported resource-dependent card is excluded with its path and reason; starter legality remains valid; baseline actions permit turn advancement when no card is playable.

## 6. Migrate by observable feature waves

Wave A covers resources, defenses and equipment. Reuse loadout grant-source assembly and existing profile resolution through adapters. Test separate SP/MP/Actions inclusion and ordered block/barrier/ward/poise. Verify optional stats, damage-types and equipment each fall back to baseline values without leaking incompatible references.

Wave B covers stances, reactions, posture, intent, enhanced effects and statuses. Preserve four authored stance identities and their matchup/buff rules, while distinguishing mechanic enablement from visibility. Hiding intent does not disable enemy AI. Hiding stance widgets does not disable stance calculations. Test reaction chain limits, rollback and deterministic ordering with more than one integration active.

Wave C covers character creation, progression, routes, dungeons, shops, rewards, quests and dialogue. Creation absent chooses the default hero; progression absent stays static; routes/dungeons absent returns to core activities. Migrate atlas profiles, classic-map shapes and dungeon graphs as separate content concepts. Preserve explicit bosses and seeded constraints. Shops expose authored count/options rather than only layout. Shops, quests and dialogue must remain reachable when enabled alone.

Wave D covers art, animation, audio, advanced-ui and multiplayer. Core inspect and targeting remain usable with all four presentation packages absent. Presentation adapters consume committed facts. Multiplayer is a bounded later slice with explicit authority, deterministic replay and transport contracts; do not claim it works solely because state can be serialized.

Assign separate workers to non-overlapping module files, with one integration worker for the catalog and one reviewer for scenario evidence. For each wave, list exact owned paths before dispatch. Keep compilers and compatibility adapters under a single owner. Integrate one reviewed, tested small commit at a time.

## 7. Workbench, CLI, export and save discipline

Build one resolver used by Workbench and CLI. Workbench supports validate, preview, apply to a new game, update configuration and export. Show errors with JSON paths, module ownership and unavailable-content reasons. Do not create a second editor-only interpretation of merges, versions or feature enablement. Any new module CLI commands are proposed work; document them as executable only after files and help output exist.

Distinguish configuration edits, module upgrades and save migrations. New games use current selected toggles. Running saves pin their exact lock and resolved hash; v1 has no hot unload. An upgrade proposes a new lock. A save migration is an explicit, tested, atomic operation with rollback and is not automatically authorized by editing a setting. Refuse incompatible saves without destroying their bytes.

Export one engine-neutral resolved bundle containing contracts, manifests, canonical/projected content, declarative rules, UI descriptions, assets, lock and hashes. Preserve source/provenance references without exposing browser objects or HTML as behavior contracts. Web and headless are adapters; Unity/Unreal consumers should not need JavaScript execution merely to understand a direct-damage rule. Reject unsupported required native behavior with its owning path/capability; never omit a function and report a complete export.

Acceptance: Workbench and CLI resolve identical bytes/hashes; export round trips in a non-web validation harness; unsupported required behavior fails explicitly; save mismatch and failed migration preserve the original save; unchanged comments do not change the gameplay hash.

## 8. Module guide and catalog template

Every module guide must answer the following in plain language, with a minimal valid JSON example and one meaningful change example:

1. What feature the player gains, its stable ID/version, and what core does when it is disabled.
2. Each setting's type, default, unit, range, merge behavior and exact schema path; distinguish mechanic switches from visibility controls.
3. Required technical capabilities and conditional optional integrations; show behavior when each counterpart is absent.
4. Content authoring schema, typed references, eligibility rules and fallback variants; show an invalid example and its diagnostic.
5. State namespace, commands, committed events, operation signatures, RNG streams and pipeline ordering.
6. UI/widget contributions, inspect information, placements, input bindings, target geometry and lowpoly/art fallback behavior.
7. Numeric/rounding policies and resource costs, especially disabled-resource behavior and loop prevention.
8. Portability class, native extensions if any, adapter requirements and export limitations.
9. Save compatibility/version policy and any separately authorized migration procedure.
10. Behavior cases and runnable verification commands once implemented; include enabled-alone, disabled and integration outcomes.

The catalog links each guide, pinned manifest, schema and representative case. Include a quick-start recipe for core alone, basic cards, a six-node boss route, custom shops and presentation settings. Explain that authors edit the one entry JSON and referenced content modules, while the resolver derives runtime artifacts.

## 9. Reviewer recommendation and user-goal acceptance matrix

| Recommendation or goal | Implementation evidence required |
| --- | --- |
| Small kernel and genuinely playable core | Core-only browser win/death/restart/save; no hidden legacy package dependency. |
| One simple authoring entry | Canonical shape above, strict schema, one resolver, no competing enable registry. |
| Five preboss nodes plus one boss | Authored route fixture resolves exactly six playable stops, boss last and reachable; inspect shows configured node identities. |
| Basic deck plus one special | Authored starter fixture produces intended basic copies and exactly one special, with stable identity and valid disabled-resource variants. |
| SP, MP and Actions independent | Each individual include and meaningful combinations tested; core turn opportunity still ends after command. |
| All-damage block and poise | Authored applicability includes physical and nonphysical damage as intended; ordering/rounding verified through actual damage outcomes. |
| Four stances and matchups/buffs | Attack/counter/sweep/defend cases verify behavior independently of widget visibility. |
| Card face limits and secondary information | Configured face budget limits displayed fields; inspect exposes the declared secondary information; no gameplay change from hiding text. |
| Shop counts/options | Fixture checks displayed eligible offer count, chosen categories/options, purchase result and reachability with routes off. |
| Boss size, inspect and relative widgets | Browser evidence at desktop/mobile shows configured boss scale and widget anchors; target geometry remains valid and inspect usable. |
| Optional assets | Missing/disabled/load-failed art renders core stand-ins with unchanged targeting and outcomes. |
| Portable behavior | Neutral bundle passes conformance vectors; unsupported required native operation is rejected. |
| Safe composition | Core plus each package, supported matrix and selected higher-order invariants pass without implicit activation. |
| Determinism and isolation | Two concurrent runtimes, save replay, queue/RNG rollback and numeric vectors pass. |

Do not turn this matrix into tests that merely compare a setting to itself. Assert resulting actions, damage, turns, reachability, visible fields and outcomes.

## 10. Verification and completion gates

For source work, start with scenario-specific tests and touched discovered test shards. The existing focused runner command is `node tests/run-node.mjs --no-selftests --no-discovered`; verify current runner flags before execution. DEVELOPER.md also documents `node tools/launch.mjs --build-only` and `node tools/plantsites.mjs --check` for relevant src changes. Run generated-content checks when compiler inputs change. Avoid rerunning unrelated long suites after sufficient green evidence unless changes or unresolved failures justify it.

Generate a supported-toggle matrix covering core alone, core plus each module, all supported resource/defense selections and selected higher-order combinations. Invariants include at least one legal action, turn advance, reachable outcome, legal deck where cards are enabled, valid save/reload and isolated runtimes. Add targeted regression cases for reactions and transactional rollback, numeric allocation/rounding, fallback art and unsupported exports. Preserve baseline trace parity through the legacy preset while the migration remains partial.

Browser review must exercise core win/lose/save and meaningful module add/remove on new runs, rather than only rendering the settings screen. Capture desktop/mobile evidence for visible UI changes and use the verified feature-preview delivery path. Integrate only after review and applicable checks. Finish each phase with committed status: delivered files, exact SHAs, actual commands and results, remaining risks and next bounded task. Until source slices pass these gates, report this package as **documentation delivered, implementation pending**.
