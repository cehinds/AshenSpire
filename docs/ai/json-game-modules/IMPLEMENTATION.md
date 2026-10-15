# JSON game modules: implementation instructions

**Status: mixed.** The profile resolver, JSON schemas/defaults, Ashen core/current bundles, content pack, generated lock, authoring CLI and selected configured host adapters are implemented on the feature branch. The full target is not: the export is host-dependent (`ashen.legacy-adapter@1`), several catalogue modules are intentionally unsupported, and portable rules execution, broad provider extraction, Workbench integration and complete browser acceptance remain outstanding. This document retains target requirements but is not proof they are complete. Read [CONTINUE.md](CONTINUE.md) for the current bounded task, [README.md](README.md) for status, [ARCHITECTURE.md](ARCHITECTURE.md) for target boundaries, [PSEUDOCODE.md](PSEUDOCODE.md) for proposed algorithms, and [CORE-SPEC.md](CORE-SPEC.md) for product authority and provisional/pending values. The full Ashen profile, not the attack/pass fallback, is the product goal.

## Authority and working boundary

The integration target is **Feature/json-game-modules only** until an explicit future owner instruction changes this boundary. During this boundary, never merge or promote this work into dev, test, release or main, and never open a PR into dev. Workers may commit and push their own worker/json-game-modules/<task> branches; only the integrator pushes Feature/json-game-modules. This explicit user instruction overrides the standing CLAUDE.md promotion workflow. Existing live-session authorization remains valid for its scope; this handoff grants no new authority and does not require fresh approval for already authorized work. Read CLAUDE.md, CONTRIBUTING.md, DEVELOPER.md and SPEC.md before source changes; propose any necessary specification amendment alongside its implementing slice. Do not introduce AGENTS.md.

Workers use their own narrowly scoped branches and worktrees. Push every small self-contained commit immediately. Integrate reviewed commits into the parent feature branch only. The user-selected Sol 6.1 medium/low and GPT-6 Luna workers supersede the repository's model routing for this work. Give one worker ownership of each file in a wave; do not give two workers overlapping compiler or runtime edits. Review each diff and the actual browser behavior before accepting a visible slice.

For this documentation delivery, only these instructions are being committed by this worker. No game build is required. Future source work needs the targeted gates below. Existing preview workflows must be inspected before use: Feature/** casing is supported, but README wording about PR requirements has drifted. Do not promise a published preview based on an unverified workflow or repeat a claim that a GitHub API operation succeeded when access returned Forbidden. Documentation alone does not create a new gameplay preview.

## 1. Verify the live baseline before changing it

Historical baseline hashes below are not current. Recheck the active feature tip and source before every change; line numbers and files move while workers integrate. Keep an inventory of remaining source seams, distinguishing migrated profile behavior from unchanged legacy authority. The live data compiler is tools/content-build.mjs, which reads content/source and emits src/content/generated. tools/config-build.mjs separately compiles content/config UI definitions. content/framework supplies the framework tree. Retain these as adapters during migration.

Inspect src/engine/actions.js for effect execution; src/model/combatCardProfile.js for card resolution; src/model/loadout.js and src/model/state.js for initial equipment, grant sources and deck assembly. Inspect bridge/singleton registry paths and identify every global cache or RNG that could leak between two runtimes. Inventory src/model/worldAtlas.js, content/source/worldAtlas.json, src/content/mapconfig.js, content/source/legacyDungeons.json and src/content/shops.js. Character choices already use content/source/characterCreation.json. UI fields already use content/config/ui/components/card.json and src/model/cardFields.js; card-face phrase order still lives in src/model/cardFaceText.js.

Inspect tools/engine-export.mjs and docs/ENGINE-EXPORT.md before extending export. The exporter already emits useful tables, schemas, manifests and hashes. Serialization that omits functions does not establish portable behavior. Identify those omissions explicitly. docs/tag-model/README.md labels its compiler and tables a proposal: do not migrate that folder as if it were authoritative live content. Live tag nodes and effects remain content/source/nodes.csv, its relation/binding companions and nodeEffects.json until deliberately changed.

Acceptance: an inventory distinguishes executable behavior, declarative live content, generated files and proposal-only material; a seeded representative legacy trace and save fixture establish the legacy baseline, not the numeric specification for the new ruleset; no broad src rename or replacement is included.

## 2. Freeze the authoring contract and examples

The current public author entry shape is:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {}
}
```

This selects the complete four-class, ten-card Ashen core bundle, not the internal attack/pass harness. ashen.core@1.0.0 is an explicit versioned declaration of the same feature modules used elsewhere, with Ashen selections and settings; it is not a second monolithic implementation. A missing bundled module inherits its bundle selection/settings; a missing nonbundled module is off. false explicitly disables a module. true enables module defaults plus bundle overrides, preserving Ashen defaults. An object applies module defaults, then bundle settings, then author overrides. Do not introduce a parallel settings.enable registry. A supported core override example is:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {
    "cards": true,
    "resources": { "include": ["sp", "mp"] },
    "defenses": { "include": ["block", "poise"], "order": ["block", "poise"] },
    "stances": { "include": ["attack", "counter", "smash", "sweep", "prepared", "evade", "defend"] },
    "art": false
  }
}
```

A versioned catalog maps these stable IDs to pinned manifests. Expand the declared bundle with provenance for each inherited selection and setting. Resolve settings as module defaults, then bundle overrides, then the entry's object overrides: keyed objects merge recursively, arrays replace entirely, scalars replace. Removal is only an explicit RFC 6902 config patch applied before resolution, never a special null convention. An RFC 6902 remove deletes an authored override, so the inherited bundle setting, or module default when no bundle override exists, returns during resolution; it cannot erase a bundle/package default. To replace that inherited value, use a schema-defined replacement setting such as include:[], or edit the owning bundle/package definition/default; null has no magic removal meaning. Validate patches and the resulting configuration. Unknown properties and unresolved required references report their exact JSON paths. Permit $comment metadata; ignore it in execution and gameplay hashes. Selecting the core explicitly opts into its declared bundle. Dependencies cannot silently activate unrelated optional features because another module mentions them.

Freeze definitions for typed IDs, values, state, commands, events, operation signatures and adapter versions. Specify canonical JSON ordering, numeric representation, finite-number restrictions, integer bounds, rounding, per-hit versus per-action application and mixed-damage allocation. Specify named RNG streams, draw order, scheduler ordering and a bounded declarative rules VM. The lock records the exact bundle and module versions, artifact hashes, contract versions, expanded selections, provenance and resolved gameplay hash. Native host extensions must declare a separately versioned execution capability; they are not portable declarative rules.

Current status: the author shape and JSON schemas are implemented; the CLI resolves the full inherited core, supported explicit disables and rejects unsupported configured modules/instances. Nonbundled configured module additions are not a general supported extension path. Machine-readable validation and selected toggle tests exist, but the full combination and portable conformance matrix remains incomplete. The fallback harness does not redefine the product core.

## 3. Build the declared four-class playable core incrementally

Keep the generic kernel separate from the product bundle. The kernel owns typed contracts, deterministic scheduling, registries, transactions and adapter boundaries. ashen.core@1.0.0 declares the feature-module selection/settings needed for the complete product in [CORE-SPEC.md](CORE-SPEC.md): cards, HP/SP/MP resources, stats, block/poise, seven stances, enhanced effects/statuses, reactions, equipment, fixed class selection, progression, routes/rest/shops/rewards and basic log/inspect/UI. Presentation uses fixed class appearances and required procedural lowpoly stand-ins. Do not hide legacy systems wholesale under a core name or create separate core copies of module mechanics.

The four-class core bundle, ten-card starter, core author file and profile-backed run/combat/rest/reward/shop adapters now exist. Continue closing the remaining behavior and UI acceptance gaps in small slices; preserve the legacy preset and entry path. The foundation attack/pass path is technical fallback, not the product example. Do not claim the current host adapter is a portable or complete engine-neutral runtime.

The always-installed foundation, separate from the generic kernel, owns HP, attack/pass, targets, fallback enemy response/outcomes, launcher and basic log/inspect/presentation. Each capability has one authoritative state owner compiled into provider bindings once. The technical runtime must always have attack/pass fallback actions. Its fallback policy ends a turn opportunity after one baseline command independently of SP, MP or Actions. The full Ashen profile permits multiple card plays using SP/MP followed by End Turn; the fallback policy does not impose one card per product turn. Providers for action, target, stats, damage, navigation and presentation remain stable when features are explicitly disabled. Disabled stats/equipment use baseline values, defenses pass damage through, stances are neutral, and hidden intent leaves enemy planning active. Disabled routes/dungeons expose core activities; independently enabled shops, quests and dialogue remain reachable through that launcher. Fixed class selection explicitly disabled supplies the authored default eligible hero; optional character creation remains off unless selected; progression explicitly disabled is static.

Required product acceptance includes class selection with four defined fixed loadouts rather than attribute creation, initially permitting only unlocked Reaver, a rest-only deck editor and an enabled equipment editor with a separate timing policy, attributes and level allocation, gear/relic/card rewards, the three-service rest menu, a one-channel damage model, seven stance interactions, stagger/interrupt, simple card resolution, log, inspect, fixed appearance and the specified animations. Detailed amounts, sequencing and unresolved decisions belong to CORE-SPEC.md. Do not invent SP formulas, costs, durations or missing benefits to fill schema fields.

Art disabled, missing or load-failed must show stand-ins using identical hitboxes and target geometry. Gear does not swap class sprites. Art cannot determine legal targets or outcomes; multiplayer disabled remains single-player. Saves are versioned and continuation deterministic. Acceptance requires both complete product runs and separate fallback-harness win/death/restart/save checks, plus isolated simultaneous runtimes. Legacy trace parity applies to the legacy preset; it does not freeze legacy formulas for the new product ruleset.

## 4. Package ownership and module catalog

Use [ARCHITECTURE.md](ARCHITECTURE.md) for the target hierarchy and ownership catalog. Many paths and schemas already exist; add only missing files for a reviewed slice and never scaffold duplicates. Generic infrastructure lives in engine/kernel/ and versioned contracts in engine/contracts/. Always-installed minimal gameplay lives in engine/foundation/, not the kernel or a user toggle. Reusable features live in `engine/modules/<id>/`; current manifests, settings schemas, defaults and guides exist for the catalog. `rules.json`, `state.schema.json`, UI contributions and integration cases remain target additions where the implemented slice needs them. runtime.mjs is optional for an explicit native extension or host interpreter implementation; portability requires the declared contract, not JavaScript serialization.

The public ashen.core@1.0.0 resolves to data-only games/ashenspire/bundles/core/bundle.json selecting module pins, settings and pack references. Game definitions live in packs/core/; fixed class selection is class-selection, while character-creation is a later optional feature off by default. Rest is an explicit core-selected module. Its policy coordinates cards' deck editor, equipment's inventory/upgrades/editor and progression's earned allocation without taking ownership of their state. Run progression and permanent profile unlocks have separate namespaces and lifetimes even under the progression package. Foundation owns baseline log/inspect and enemy response; do not fragment helpers into toggles.

`games/ashenspire/game.lock.json` is the current generated lock; the author CLI provides `validate`, `build`, `check`, `export` and `apply`. A full Workbench module UI and portable web/headless conformance suite remain target work. Existing `src/content` remains authoritative for unmigrated host behavior; only one authored source owns each migrated definition.

Resources owns SP/MP/optional Actions and decorates foundation HP through its public capability; it never creates another HP pool, and disabling resources cannot remove HP. Any legacy HP selector becomes an alias to that foundation capability. Defenses provides selectable block/barrier/ward/poise instances with declared applicability and ordering, without freezing unresolved numeric or damage-stage policies here. Tags/groups select content or declared behavior references, never enable features; easy include lists remain supported. Pending advanced values and required unresolved references fail executable compilation.

Typed pipeline stages declare input/output, ordering, ownership and allowed mutations. Modules cannot write another module's state. State contributions live under namespaced keys. Cross-feature behavior uses conditional integration contracts and commands/facts, with a designated owner and adapter version. Scheduler and rules execution have bounded work limits and named errors for unsupported operations.

Transactions must checkpoint state, queue and RNG. A failed operation restores all three. Emit committed facts only after commit; external effects use deduplicated outbox IDs, never irreversible calls inside a rollback region. Reactions must obey the same scheduler and rollback rules.

Acceptance: no missing optional module triggers an import-time crash, singleton mutation or implicit activation; every package has a declared public surface and a real independent behavior case. Validate pipeline ordering and conflicts before starting a run.

## 5. Prove the ten-card bundle and explicit feature overrides

Extract cards as a reusable module with its own content, deck/hand state, actions and UI; the declared Ashen core enables it by inheritance. Implement the four class starter packages and ten-card distribution specified in CORE-SPEC.md, with an enabled rest-only deck editor available exclusively through the chosen Strategize service, and no fixed nine-slot restriction. Reward acquisition outside rests can grant cards to the owned collection; it does not authorize manual deck edits outside rests. A missing cards entry retains that selection. Explicit cards:false on a new game invokes attack/pass fallback without stale deck state or a blank screen. This override proves composability; it does not replace full-core acceptance.

Use a narrow SP/block integration slice to prove resources and defenses can attach and detach while the legacy adapter remains available. A missing resource is not a blanket instruction to ignore every effect. A simple cost can disappear only through an explicitly authored fallback. Scaling, conditional branches, spend-all behavior and other resource-dependent semantics require an authored variant; otherwise the content is unavailable with a diagnostic report. Never silently change a card's identity or introduce a zero-cost infinite command loop.

Retain canonical definitions and derive eligible projected content for a selected module set. Built-in starter packages supply baseline variants and eligibility choices that preserve a legal starting deck. Record exclusions and chosen variants for inspection. Custom external configurations with required missing references may fail validation; all supported built-in combinations, including the inherited bundle, supported explicit disables and each module against the fallback harness, must remain playable.

Acceptance: inherited full-core starters and new games with cards explicitly on/off are usable; a resource toggle changes the intended behavior and visible costs; an unsupported resource-dependent card is excluded with its path and reason; starter legality remains valid; baseline actions permit turn advancement when no card is playable.

## 6. Migrate by observable feature waves

Wave A covers resources, defenses and equipment. Reuse loadout grant-source assembly and existing profile resolution through adapters. Test separate SP/MP/Actions inclusion and ordered block/barrier/ward/poise. Verify optional stats, damage-types and equipment each fall back to baseline values without leaking incompatible references.

Wave B covers stances, reactions, enhanced effects and statuses; posture and intent remain later extensions off by default. Implement the seven CORE-SPEC stance identities and confirmed matchup rules, plus stagger/interrupt, while distinguishing mechanic enablement from visibility. Hiding intent does not disable enemy AI. Hiding stance widgets does not disable stance calculations. Test reaction chain limits, rollback and deterministic ordering with more than one integration active.

Wave C first covers class-selection, rest, progression, routes, shops and rewards; dungeons, quests and dialogue are later optional integrations. Optional character-creation remains separate and off by default. The bundle inherits fixed class selection, progression and routes. Explicitly disabling class-selection chooses the default eligible hero; disabling progression stays static; disabling routes/dungeons returns to core activities. Migrate atlas profiles, classic-map shapes and dungeon graphs as separate content concepts. Build three acts with seven preboss nodes and one boss per act as specified in CORE-SPEC.md; preserve explicit bosses and seeded constraints. Apply its node-visibility and two-visible-rest requirements rather than guessing a replacement rule. Shops expose authored count/options rather than only layout. Shops, quests and dialogue must remain reachable when enabled alone.

The progression module owns a permanent, versioned profile unlock ledger, separate from each run's locked configuration and character-level progression. Four classes are defined, but only Reaver is initially unlocked. Each full run completed by a committed terminal win or defeat unlocks exactly the next class: Starseer, then Rogue, then Herald. A run using any unlocked class counts; do not require a win or the previously unlocked class. Encounter wins, XP/levels, starting a run, quitting, abandoning or restarting without a terminal outcome do not count. Class unlocks are an explicit progression exception beyond character levels; they do not enable feats or skill XP.

Use runId as the deduplication key for terminal-outcome processing. Commit outcome application and ledger advancement atomically under a versioned progression policy; retries and save/load cannot unlock twice. Keep profile migration separate from run configuration upgrades and preserve the save atomicity/rollback contract. Character selection must enforce unlock eligibility in the model, UI and authoritative host/server boundary where present, rather than merely hiding buttons. Test a terminal defeat as well as a win, repeated outcome delivery, reload/retry, nonterminal restart, sequence exhaustion after Herald and a run using a previously unlocked class. Full four-class content tests may construct valid unlocked profile fixtures; they must not imply all four are selectable on a new profile.

Implement exactly three rest services: Strategize edits the deck, Smith upgrades equipment, and Level Up allocates already earned attribute points. A visit permits exactly one service. Persist a visit identity and consumed-service token so reopening, save/reload or repeated commands cannot reset the choice. Commit the service, token consumption and full HP/MP/SP plus healing/MP-flask refill atomically; failed or cancelled commits roll back state, queue and RNG together. Apply level attribute changes before restoring pools to their final maxima. Level Up cannot create free levels or allocation points when none were earned. Smith replaces any earlier standalone card-upgrade rest proposal; do not add another rest option or remove card rewards and level progression. Equipment-upgrade costs/budgets remain unspecified: expose an explicit pending policy rather than inventing currency. Recommend allowing Strategize to commit without edits so recovery remains available; keep that recommendation distinct from confirmed requirements. Equipment-editor timing is a separate policy and does not bypass Strategize-only manual deck access.

Acceptance: exercise each rest service, prove only the selected service is available for completion, verify reopen/save/reload and duplicate-command protection, rollback after a failed upgrade/allocation, and full recovery after changed maximum stats. Confirm no deck-edit path through Smith or Level Up and no unearned level allocation.

Wave D covers art, animation, audio, advanced-ui and multiplayer. Basic inspect, log and targeting remain usable with optional presentation packages explicitly disabled; a missing bundled presentation entry retains its inherited selection. Presentation adapters consume committed facts. Multiplayer is a bounded later slice with explicit authority, deterministic replay and transport contracts; do not claim it works solely because state can be serialized.

Assign separate workers to non-overlapping module files, with one integration worker for the catalog and one reviewer for scenario evidence. For each wave, list exact owned paths before dispatch. Keep compilers and compatibility adapters under a single owner. Integrate one reviewed, tested small commit at a time.

## 7. Workbench, CLI, export and save discipline

The CLI resolver already provides `validate`, `build`, `check`, `export` and `apply`; export is host-dependent and `--portable` rejects the required legacy adapter. A full Workbench UI, preview flow and update UI remain target work. Do not describe proposed editor commands as implemented, or create a second interpretation of merging, versions or enablement.

Distinguish configuration edits, module upgrades and save migrations. New games use current selected toggles. Running saves pin their exact lock and resolved hash; v1 has no hot unload. An upgrade proposes a new lock. A save migration is an explicit, tested, atomic operation with rollback and is not automatically authorized by editing a setting. Refuse incompatible saves without destroying their bytes.

Export one engine-neutral resolved bundle containing contracts, manifests, canonical/projected content, declarative rules, UI descriptions, assets, lock and hashes. Preserve source/provenance references without exposing browser objects or HTML as behavior contracts. Web and headless are adapters; Unity/Unreal consumers should not need JavaScript execution merely to understand a direct-damage rule. Reject unsupported required native behavior with its owning path/capability; never omit a function and report a complete export.

Remaining target acceptance: if/when Workbench is added, compare its output with the CLI; portable export round-trip is not implemented. Current CLI explicitly rejects unsupported configured modules/instances and portable export. Save profile mismatch preserves original bytes; no configured-save migration is provided.

## 8. Module guide and catalog template

Every guide should answer the following for supported configured behavior. Current guides cover settings, bundle selection, content sources, fallback and portability; they do not claim unsupported catalog modules are implemented. Add integration-specific state/operation details only when their adapter exists:

1. What feature the player gains, its stable ID/version, whether the Ashen bundle selects it, and the authored fallback when explicitly disabled.
2. Each setting's type, module default, inherited bundle override/provenance, unit, range, merge behavior and exact schema path; distinguish mechanic switches from visibility controls.
3. Required technical capabilities and conditional optional integrations; show behavior when each counterpart is absent.
4. Content authoring schema, typed references, eligibility rules and fallback variants; show an invalid example and its diagnostic.
5. State namespace, commands, committed events, operation signatures, RNG streams and pipeline ordering.
6. UI/widget contributions, inspect information, placements, input bindings, target geometry and lowpoly/art fallback behavior.
7. Numeric/rounding policies and resource costs, especially disabled-resource behavior and loop prevention.
8. Portability class, native extensions if any, adapter requirements and export limitations.
9. Save compatibility/version policy and any separately authorized migration procedure.
10. Runnable behavior cases for each implemented slice; keep inherited bundle, fallback harness, explicit disabled and unimplemented integration outcomes clearly separated. For a future module, include a handoff with catalog registration, owner, public contract, authored fallback, guide, supported cases and required integration changes. A catalog entry alone must not be advertised as a configured feature.

The catalog links each guide, manifest, schema and available behavior test. The author guide gives the inherited full core and small settings/content edits. The resolver derives runtime artifacts; the portable engine-neutral export remains outstanding.

## 9. Reviewer recommendation and user-goal acceptance matrix

| Recommendation or goal | Implementation evidence required |
| --- | --- |
| Generic kernel and full declared core | Four-class ten-card product browser win/death/restart/save; module selection/provenance visible; technical attack/pass harness verified separately. |
| One simple authoring entry | Canonical shape above, strict schema, one resolver, no competing enable registry. |
| Seven preboss nodes plus one boss, three acts | Each act resolves eight playable stops with reachable final boss; CORE-SPEC visibility/rest rules and node inspect verified. |
| Four fixed classes and ten-card starters | Each starts with 3 Strike, 3 Defend, Counter, Smash, Sweep and its class special; no initial Evade card; fixed loadouts, exact 4+INT hand and Strategize-only rest deck editor match CORE-SPEC; initially only Reaver is selectable. |
| Permanent class unlocks | Only Reaver initially; terminal run win or defeat unlocks Starseer, then Rogue, then Herald, once per runId; selection guards reject locked classes. |
| HP/SP/MP resources and independent Actions | Each individual include and meaningful combinations tested; full Ashen permits multiple SP/MP card plays then End Turn, while the technical fallback advances after one baseline command. |
| One-channel damage, block and poise | Actual damage/rounding, stagger and interrupt cases follow CORE-SPEC; applicable Poise damage taken is max(floor(d*.75),1), a 25% reduction, not a 75% mitigation cap or legacy depletion substitute. |
| Seven stances and matchups/buffs | Attack/counter/smash/sweep/prepare/evade/defend cases verify confirmed edges independently of widget visibility. |
| Card face limits and secondary information | Configured face budget limits displayed fields; inspect exposes the declared secondary information; no gameplay change from hiding text. |
| Shops, rest, rewards and progression | Fixture checks offers, purchases and reachability with routes off; exactly one durable rest service per visit, full HP/MP/SP and flask recovery, earned allocation, gear upgrades, rewards and separate equipment-editor policy follow CORE-SPEC. |
| Boss size, inspect and relative widgets | Browser evidence at desktop/mobile shows configured boss scale and widget anchors; target geometry remains valid and inspect usable. |
| Optional assets | Missing/disabled/load-failed art renders core stand-ins with unchanged targeting and outcomes. |
| Portable behavior | Neutral bundle passes conformance vectors; unsupported required native operation is rejected. |
| Safe composition | Full inherited bundle, supported explicit disables/additions, standalone fallback-harness cases and higher-order invariants pass without implicit unrelated activation. |
| Determinism and isolation | Two concurrent runtimes, save replay, queue/RNG rollback and numeric vectors pass. |

Do not turn this matrix into tests that merely compare a setting to itself. Assert resulting actions, damage, turns, reachability, visible fields and outcomes.

## 10. Verification and completion gates

For source work, start with scenario-specific tests and touched discovered test shards. The existing focused runner command is `node tests/run-node.mjs --no-selftests --no-discovered`; verify current runner flags before execution. DEVELOPER.md also documents `node tools/launch.mjs --build-only` and `node tools/plantsites.mjs --check` for relevant src changes. Run generated-content checks when compiler inputs change. Avoid rerunning unrelated long suites after sufficient green evidence unless changes or unresolved failures justify it.

Generate a supported-toggle matrix covering the complete inherited bundle, supported explicit feature disables/additions, fallback harness plus each module, all supported resource/defense selections and selected higher-order combinations. Invariants include at least one legal action, turn advance, reachable outcome, legal deck where cards are enabled, valid save/reload and isolated runtimes. Add targeted regression cases for reactions and transactional rollback, numeric allocation/rounding, fallback art and unsupported exports. Preserve baseline trace parity through the legacy preset while the migration remains partial.

Browser review must exercise full four-class product-core win/lose/save, separately exercise fallback-harness outcomes, and meaningful module add/remove on new runs, rather than only rendering the settings screen. Capture desktop/mobile evidence for visible UI changes and use the verified feature-preview delivery path. Integrate only after review and applicable checks. Finish each phase with committed status: delivered files, exact SHAs, actual commands and results, remaining risks and next bounded task. Report this package as **partially implemented, host-dependent, browser acceptance in progress** until the full product/browser/export gates pass. Do not let the attack/pass fallback or a green resolver test stand in for product completion.

## 11. Product-rule freeze and unresolved choices

Use [CORE-SPEC.md](CORE-SPEC.md) as the detailed source for fixed loadouts, attributes/bonuses, weapon and armour families, level gains, starting hand, round reshuffle, class specials, replayable stacking powers, recovery, rewards, stance edges and animation states. It separates confirmed requirements from recommendations and pending answers. Current legacy formulas and traces are comparison fixtures, not authority to override this new ruleset. `SPEC.md` now includes a feature-only profile addendum; the older legacy sections remain authoritative for the legacy preset.

The owner has resolved the Poise, starting attributes/hand size, and editor decisions; do not preserve their stale alternatives as pending gates. Use CORE-SPEC.md's exact six-total-attribute class table rather than adding six to every attribute or retaining the earlier all-seven proposal. Initial hand size is exactly 4+INT: five for most classes and six for Starseer. Applicable Poise damage taken is max(floor(d*.75),1). Both editors are enabled, but manual deck editing is restricted to the chosen Strategize service at rest spots; other services cannot open that editor; reward grants and ownership are separate from editing. Equipment-editor availability has its own timing policy: the owner did not restrict its location, so any safe noncombat-only recommendation must remain labeled a recommendation until specified, without reopening settled choices.

Keep the confirmed primary level deltas and preserved hidden formulas distinct to avoid adding primary bonuses twice. Every chosen rest service now explicitly restores full HP, MP and SP and refills healing and MP flasks; direct MP restoration is confirmed. Target level gains per act/run do not establish exact XP thresholds. Proceed with already authorized work; this document adds no new approval gate.

Keep no-elements, no ranked spells, no feats and no skill-XP constraints visible in author guides and eligibility validation. The required fixed-look animations and log/inspect interactions must receive browser acceptance; use the CORE-SPEC inspection gesture and selected-target HUD behavior. Publish implementation status against full product requirements, not merely a passing minimal harness.
