# JSON game modules: implementation pseudocode

**Status: documentation blueprint only.** None of the interfaces, module loader,
update requests, portable runtime, or verification procedures below is implemented
by this document. Existing gameplay is unchanged; the compatibility legacy adapter
is a future implementation step, not a component supplied here. Follow the
scope and delivery sequence in [IMPLEMENTATION.md](IMPLEMENTATION.md); record work
and resume instructions in [CONTINUE.md](CONTINUE.md). Integration is restricted to
`Feature/json-game-modules`; do not promote to `dev`, `test`, `main`, or a release.

## 1. Preserve a playable core before extracting optional systems

The generic kernel is not itself the game. `ashen.core@1.0.0` includes default
hero/enemy definitions, HP, baseline stats, target selection, direct attack,
pass/end-turn, an enemy response policy, victory/death/restart, an activity launcher,
a minimal accessible UI with inspection, procedural low-poly stand-ins, and saving.
It provides action execution, targets, stats, damage, activities, and presentation
contracts regardless of optional features. Routes and dungeons select activities;
they do not own the only way to launch one. A shop can register an activity without
routes. Disabling equipment or stat progression restores baseline combat stats.
Disabling art selects core stand-ins, including in a newly imported package.

Core owns a bounded **turn opportunity**, separate from optional SP, MP, or Actions.
One accepted direct attack spends the default opportunity and yields an enemy
response; pass yields immediately. Invalid commands never spend it. A module may
supply a bounded opportunity policy, but cannot remove the turn-progress guarantee.
Free support actions require a configured finite per-turn budget. No combination
may allow an infinite free-action loop or require a resource that is absent.

```text
type CorePhase = launch | activity | playerTurn | enemyTurn | victory | death
type TransactionStatus = COMMITTED | REJECTED | SUSPENDED
CoreState = {
  phase, cycle, hero, activity: {id, kind, enemies, localState, enemyCursor},
  outcome, turn: {ownerId, opportunitiesRemaining, freeCommandsRemaining},
  commandSequence, transactionSequence, pendingDecision
}
RunState = {lock, core: CoreState, modules: namespacedPerRunState}

submit(request):
  result = executeTransaction(request)  // includes all lifecycle/system commands
  if result.status == REJECTED: publish public rejection; return
  if result.status == SUSPENDED: publish allowlisted decision choices; return
  // Only COMMITTED may dispatch the persisted successor system command.
  publish committed public view
  dispatchPersistedSuccessorIfAny(result.transactionId)

handleCandidate(candidate, command):  // called only inside executeTransaction
  switch command.kind:
    newRun:
      require no active run or explicit permitted restart from terminal outcome
      create new run ID and immutable lock; initialize hero and per-run module state
      initialize durable deck/currency/progression/resources using new-run policies
      set phase = launch; offer activity launcher
    startActivity:
      require legal launch/transition and registered activity ID
      retain hero, deck, currency, progression and resource state
      apply explicit entry/recovery/carry policies through candidate deltas
      initialize only activity-local module state
      if activity.kind == combat:
        create its enemy instances; enemyCursor = 0
        enqueueSystem(enterPlayerTurn)
      else:
        phase = activity; open registered activity handler (shop creates no enemies)
    enterPlayerTurn:
      require combat and no pending decision
      if terminalOutcome(candidate): set outcome and terminal phase; return
      phase = playerTurn
      turn = boundedPolicy.begin(hero, cycle)
      require finite nonnegative budgets and legalCommands includes core.pass
    playerAction:
      require phase == playerTurn and actor == hero and no pending decision
      validate target, projected definition, legality and budget before any spend
      if action == core.pass: close remaining opportunity through candidate delta
      else: resolve action; spend declared opportunity/free budget in candidate
      if terminalOutcome(candidate): set outcome and terminal phase
      else if pass or opportunitiesRemaining == 0:
        enqueueSystem(beginEnemyResponse)
    beginEnemyResponse:
      phase = enemyTurn; enemyCursor = 0; enqueueSystem(enemyStep)
    enemyStep:
      require phase == enemyTurn
      choose next living enemy in stable initiative order
      if none:
        cycle += 1; enqueueSystem(enterPlayerTurn); return
      // RNG fork already exists: no authoritative draws outside transaction.
      intent = enemyAI.chooseLegalAttackOrPass(candidate.view, candidate.rng.enemyAI)
      resolve within finite enemy opportunity policy; advance enemyCursor
      if terminalOutcome(candidate): set outcome and terminal phase
      else: enqueueSystem(enemyStep)
    activityCommand:
      delegate validated command to current activity handler in candidate
      preserve per-run state except explicit declared deltas
    resumeDecision:
      resume the saved candidate at its exact boundary, using validated choice
```

`enqueueSystem` writes the candidate scheduler/outbox only. A successor becomes
eligible after the complete transaction commits; the dispatcher claims its stable
ID idempotently and submits it through the same transaction entry point. While a
mandatory successor is pending, gameplay command legality permits only that system
command (or an authorized pending-decision response); a player cannot race another
pass/action between turn-ending commit and enemy dispatch. Phase, cycle, pass, opportunity spends, enemy cursor, AI selection/RNG, outcome, and
activity lifecycle handlers never mutate live state outside that entry point.
A rejected request discards all candidate changes, including opportunity spends.
A suspended request does not advance phase, enemy cursor, or successor dispatch;
its persisted continuation resumes inside the transaction protocol in section 5.

A run transition is not a new run: activity exit/entry policies explicitly declare
which local state expires and how persistent resources carry or recover. Returning
from a shop or launching another fight must not recreate the hero or reset deck,
currency, progression or resource pools by accidental initialization.

Core policy must define simultaneous death precedence and multiple-enemy ordering
in versioned rules. UI and headless drivers submit the same commands. Minimal UI
renders current HP, targets, attack, pass, outcome/restart, activities, and an
inspector showing effective definitions and rejection reasons. A core-only game
must be playable without importing a card, route, equipment, or art provider.

## 2. Fix the authoring surface and package contracts

Core-only author JSON is exactly this shape:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {}
}
```

An enabled example uses the same shape:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "$comment": "New runs use these settings; existing runs keep their lock.",
  "modules": {
    "cards": true,
    "resources": { "include": ["sp", "mp"] },
    "defenses": { "include": ["block", "poise"], "order": ["block", "poise"] },
    "stances": { "include": ["attack", "counter", "sweep", "defend"] },
    "art": false
  }
}
```

Missing/`false` means disabled; `true` means enabled with manifest defaults; an
object means enabled with settings merged into defaults. There is no second
`enabled` field. Unknown module IDs or settings fail by path. Core/package versions
are pinned through a reviewed catalog artifact: `modules.cards` selects the
catalog's pinned cards package, never an opportunistic latest version. Built-in
preset/pack references use registered namespaces with complete closure; unknown
custom references are errors. Defaults and overrides merge recursively for keyed
objects; arrays and scalars replace whole values. RFC 6902 patches edit the author
source before resolution. Removing an override restores the inherited default;
it cannot remove that default. To change a default, edit its owning module, or use
a schema-defined replacement such as `include: []` or an explicit policy field.
Null has only its declared schema meaning, never implicit deletion semantics.

Reserve `$comment` at every object depth. Preserve it in author source and strip it
recursively before execution and gameplay hashing. Preserve array order. Reject
functions, undefined, nonfinite numbers, cycles, prototype-bearing objects, and
unknown executable fields at the data door.

Each cohesive feature package owns its manifest, config/state schemas,
implementation, author guide, content, UI adapter, and integration cases. Helpers
are not separate user toggles. A sample manifest contract follows; package paths
and interfaces are proposed, not existing files:

```json
{
  "manifestVersion": 1,
  "id": "defenses",
  "version": "1.0.0",
  "implementationVersion": "1.0.0",
  "runtimeABI": "ashen.runtime@1",
  "configVersion": 1,
  "stateVersion": 1,
  "defaults": { "include": ["block", "poise"], "order": ["block", "poise"] },
  "configSchema": {
    "type": "object",
    "properties": {
      "include": { "type": "array", "uniqueItems": true, "items": { "type": "string", "minLength": 1 } },
      "order": { "type": "array", "uniqueItems": true, "items": { "type": "string", "minLength": 1 } }
    },
    "required": ["include", "order"],
    "additionalProperties": false
  },
  "requires": [{ "kind": "core", "capability": "damage.pipeline", "version": "1" }],
  "provides": [{ "capability": "damage.defenseStages", "version": "1", "mode": "contribution" }],
  "technicalDependencies": [],
  "integrations": [
    { "id": "defenses.stanceProtection", "owner": "defenses", "version": 1,
      "whenEnabled": ["defenses", "stances"], "requiresCapabilities": ["stance.entry@1"] }
  ],
  "entrypoints": { "implementation": "./defenses.mjs" },
  "ui": ["./defenses.ui.json"],
  "guide": "./defenses.md",
  "stateSchema": { "$ref": "./defenses.schema.json#/$defs/state" },
  "content": ["./defenses.content.json"],
  "integrationCases": ["./defenses.cases.json"]
}
```

These proposed paths are relative to the module folder; `defenses.schema.json`
contains its config schema and `$defs.state`. No such files are created by this
blueprint. Defense IDs are registry-validated strings, not a closed four-ID enum:
authors can define additional defenses using supported behavior contracts. Require
`order` to contain exactly the selected registered defense IDs once, each with a
supported stage implementation; schema alone is insufficient. Technical
dependencies ship inside the reviewed package closure.
Optional feature dependencies never silently activate another feature. An optional
bridge activates only when both selected features and compatible capabilities
exist; its owner/version are explicit. A selected unsupported combination reports
a clear conflict rather than enabling a missing feature.

## 3. Resolve, validate, hash, and lock once per runtime/run

```text
resolve(authorSource, pinnedCatalog):
  validate source root; retain source and its comments
  source = apply already-authorized source patches, if any
  executableSource = stripReservedCommentsDeep(source)
  core = catalog.requireExact(executableSource.core)
  selected = decodeEntries(executableSource.modules)
  packages = [core] + selected.map(catalog.requirePinnedManifest)
  close bundled technical dependencies with typed version checks
  assert selected feature IDs unchanged by technical closure
  settings = mergeDefaultsThenGameForEachEnabledPackage()
  validate root/settings schemas and manifest/package/schema reference closure
  validate candidate definition shapes without requiring inactive capabilities
  activate explicitly owned compatible integrations for selected pairs
  providers = arbitrateCapabilities(packages, integrations)
  definitions = projectDefinitions(settings, providers)
  validate all active projection references, operations and capabilities
  report inactive definitions/variants and eligibility reasons separately
  phases = compileOrderedStageGraph(providers)
  verify all referenced opcodes/formulas/predicates/capabilities supported
  verify gameplay invariants and core fallback availability
  resolved = immutable {packages, settings, providers, definitions, phases, contracts}
  configHash = hash(canonical(executableSource plus catalog pins))
  resolvedHash = hash(canonical(resolved including implementation digests))
  return immutable lock with resolved, hashes, exact package pins and ABI versions
```

Capability types include core requirements, exclusive replaceable providers, and
ordered contributions. Core's mandatory fallback providers cannot disappear.
Reject two exclusive providers unless a declared selection policy chooses one;
never use import order. Validate interface versions as well as names.

Stages declare stable IDs, phase, input/output types, `before`/`after` edges, scope
(per hit/per action/per turn), and numeric policy. Topologically sort the DAG;
reject cycles, missing referenced stages, cross-phase backward edges and competing
unordered writes. Independent commuting/read-only stages may use a contractually
specified stable-ID tie order. Noncommuting ties require an explicit precedence
edge; lexical sorting must not silently invent game mechanics.

Canonical encoding has its own version: sorted object keys, preserved array order,
UTF-8 strings and a fixed numeric domain/encoding. Define it with test vectors;
plain host `JSON.stringify` is not a cross-engine specification. Keep source,
config, resolved-game and save-state hashes distinct. Freeze configuration for a
run. Every registry, bridge and cache is scoped by immutable runtime instance and
resolved hash, not a mutable process singleton.

## 4. Project content with honest fallbacks

```text
projectDefinition(authored, enabledCapabilities):
  choose authored primary variant if all requirements are satisfied
  otherwise choose explicitly declared compatible fallback variant
  otherwise mark unavailable with missing requirements and source path
  validate chosen variant in full; preserve source identity/provenance
  never mechanically delete unsupported effects or costs
```

A simple MP-priced attack may declare a no-MP alternative with its own cost and
effect numbers. A spell saying “spend all MP; scale damage by MP spent” is
unavailable without MP unless the author supplies an explicit alternate formula
and behavior. Dropping its MP cost would produce a different, often unlimited,
action. Apply the same rule to rewards, shops, enemy moves, unlocks and inventories.

With cards disabled, core attack/pass remain the action interface. With cards
enabled, assemble a deck from eligible definitions using a declared minimum-deck
policy; fill shortages from a compatible built-in starter pack or expose core
attack/pass when that policy permits. Report exclusions, chosen alternates,
starter injections, unmet minimums, and provenance. If a mandatory deck minimum
cannot be met, reject the candidate instead of starting a softlocked run.
Defense disabled means that channel stage is absent/passthrough; stances disabled
means neutral posture and no stance entry/counter events. Keep optional state out
of core authority. Configure supported fallback behavior rather than hiding UI
while leaving mechanics active.

## 5. Construct module lifecycles and typed transactions

```text
Module.create({lock, readOnlyCore, namespacedState, commandPort, registrars})
Module.register({actions, stages, activities, inspectors, UI, migrations})
Module.dispose()  // session end or construction of a new runtime only

ActionRequest = {schemaVersion, requestId, actorId, actionId, targetIds, arguments}
ActionEnvelope = {schemaVersion, actionInstanceId, definitionId, sourceId,
                  ownerId, targetIds, effects, origin, ancestry, declaredBoundary}
DeltaCommand = {schemaVersion, commandId, ownerModule, operation, arguments}
CommittedFact = {schemaVersion, eventId, transactionId, ordinal, type, payload}
```

Commands request validated changes; facts describe changes already committed.
Modules receive immutable views and issue typed delta commands. Only their own
namespace can be written directly through the transaction store; cross-module
changes pass validated capability commands. Stable definition IDs differ from
run instance IDs, action IDs and event IDs. Persist all identity counters.
Do not hot-unload modules from existing saves in v1. Feature changes construct a
new runtime for new runs; running saves retain the locked package set.

```text
executeTransaction(request) -> {status: COMMITTED | REJECTED | SUSPENDED, ...}:
  validate request schema, authority, idempotency key and committed revision
  reject invalid decision choice before touching its pending record
  fork state + action queue + RNG streams/counters + scheduler + identity counters
  if resumeDecision:
    load saved candidate and verify boundary/base revision/choice authority
  else:
    require no pending decision; invoke handleCandidate(candidate, request)
  when resolving action: derive typed envelope from projected definition
  at declared precommit reaction boundary:
    collect eligible offers in declared order; enforce ancestry/depth/event bounds
    if input needed:
      durably store candidate + base revision/hash + boundary/program counter
      + selected offers + queues/RNG/scheduler/counters as pending continuation
      publish only allowlisted choices; return SUSPENDED
  resume/continue selected reactions and ordered stages against candidate
  validate deltas, terminal outcome, numeric limits and invariant postconditions
  on error:
    discard candidate; clear failed continuation transactionally if present
    return REJECTED with public reason (no budget/RNG/phase changes)
  on success:
    atomically persist state, queue, RNG, scheduler, facts, outbox and dedup ledger
    clear pending continuation in same commit; return COMMITTED after durability
```

Do not expose speculative damage as a committed fact. For v1, a transaction with a
reaction decision is wholly speculative until resolution: only the pending decision
record is durable on SUSPENDED, and no gameplay prefix is committed. Block other
gameplay/system commands at that base revision; allow only authorized resume or
explicit cancellation. Resume from the stored program counter and candidate RNG
counters, never reroll AI or replay prefix effects. Cancellation drops the candidate
and pending record without changing committed gameplay. Invalid decision choices
leave the pending record intact and return REJECTED. Verify revision/lock before
resuming; reject stale/corrupt continuations with explicit recovery rather than
rebase. Any future prefix-commit protocol requires a new boundary contract version.
Apply identical boundaries to solo, co-op, delayed actions and sandbox preview.

Outbox records carry deterministic `effectId = transactionId + ordinal + sink`.
Visual/audio/network sinks acknowledge with deduplication. A postcommit sink failure
retries delivery, never the gameplay transaction. Non-idempotent external sinks
need their own idempotency protocol. Persist delivery state separately from the
canonical gameplay hash when it cannot affect gameplay.

RNG algorithm, seed encoding, stream IDs and counters are pinned and saved.
Use bounded deterministic stream access; never host `Math.random` or wall-clock
ordering. Scheduler entries use simulation ticks plus stable ordering keys, never
host timer callbacks as authoritative state. A transaction rollback restores draws
and scheduled work as well as HP. An intent view is built by allowlist from the
committed state: hidden enemy move IDs, damage, targets and future fields must not
leak through inspectors, events or preview responses. Internal resolution retains
full intent; renderer/headless public clients receive the same concealed view.

## 6. Specify damage and preview without changing baseline semantics

```text
resolveDamage(action, target, pipeline, numericPolicy):
  derive authored components and physical/magic shares
  apply rating/formula/status modifiers at their versioned stages
  group components at declared scope; allocate integer budgets conserving totals
  apply typed immunity/resistance/armor according to selected policy
  process configured channel stages in compiled order
  apply per-hit or per-action minimum-through rule at its declared boundary
  spend protection pools and HP through delta commands
  produce receipts for all allocations, absorptions, breaks and riders
```

Every policy names rounding positions, floor/ceil semantics, integer range,
overflow rejection, largest-remainder tie order, mixed-component grouping,
per-hit/per-action budgets, bypass handling and minimum-through eligibility.
Do not assume changing stage order preserves the old minimum-through behavior.
The legacy adapter must reproduce its exact receipts before migrating a ruleset:
magic meets Barrier then Ward; physical meets Block then persistent Poise, with
existing mixed-hit and at-least-one-through rules. Pool absorption and break meters
are distinct mechanisms even where both use the names Poise/Ward. Migration must
preserve or explicitly version their distinction.

```text
preview(request, committedSnapshot):
  sandbox = clone authoritative state, queues, scheduler, counters and RNG
  run the same legality, reaction and damage path with sandbox sinks
  derive publicReceipt/publicView through explicit field allowlists
  redact hidden intent, private stage receipts and exact hidden/future RNG results
  replace uncertain fields with permitted ranges/distributions/conditional results
  discard sandbox; assert live state/RNG/counters/outbox unchanged
  return only {publicReceipt, publicView, uncertainty}
```

Known deterministic outcomes match execution from the same state. Even when a
sandbox clone can compute the exact next RNG result, that private result is not
public knowledge and must not be returned. Hidden reactions or unknown future RNG
outcomes require permitted ranges/distributions or a conditional result. Apply
public projection after the shared math; never return raw receipts or an
unrestricted sandbox inspector. Preview consumes no authoritative draws, writes
no durable suspension, and delivers no real outbox effects.

## 7. Save, restore, and update through pinned artifacts

A save contains core and module implementation/config/state versions, package
content digests, exact lock/resolved hash, core/module state, queue continuations,
RNG state, scheduler and identity counters. Pin runtime ABI, portable VM version,
RNG algorithm, scheduler semantics, numeric policy and canonical encoding versions.

```text
restore(save, installedArtifacts):
  verify envelope/hash and each exact pinned artifact/contract
  if any required artifact or supported ABI missing: reject with recovery details
  validate state schemas and continuations before constructing runtime
  construct from saved lock, never resolve latest catalog
  restore all stores; verify canonical state hash; publish public view
```

Config changes apply to future runs only. A module upgrade stages a reviewed local
artifact, validates its dependency closure and config compatibility, then produces
an explicit activation plan. Never fetch arbitrary remote code during gameplay.
Preserve authored settings across updates; config migration and save-state
migration are separate operations. Each state-version transition has one declared
owner and a tested chain; ambiguous owners, missing links or unsupported paths
reject cleanly. Run migrations transactionally against a copy; activate a new save
only after schema, reference, queue and hash checks pass. Retain original saves and
old artifacts for rollback and still-pinned runs.

These two request formats are proposed data contracts, not existing tools or CLI
commands:

```json
{
  "formatVersion": 1,
  "kind": "config",
  "expectedConfigHash": "sha256:example-current-config",
  "patch": [
    { "op": "test", "path": "/modules/art", "value": true },
    { "op": "replace", "path": "/modules/art", "value": false }
  ]
}
```

```json
{
  "formatVersion": 1,
  "kind": "module",
  "changes": [{ "id": "defenses", "from": "1.0.0", "to": "1.1.0" }]
}
```

```text
stageUpdate(request, activeArtifact):
  config request: compare expectedConfigHash; apply RFC6902 (including tests)
                  to source clone, never mutate active source in place
  module request: verify each from pin; stage to pins and preserve author settings
                  require separate explicit config migration if schema changed
  resolve candidate fully; reject stale expectations or any invalid closure
  write immutable candidate source/catalog/lock/export artifact directory
  verify digests; write prepared journal record; fsync where supported
  atomically replace one same-filesystem active-pointer file
  mark journal complete; retain previous pointer/artifacts for rollback
```

Do not claim that multiple filesystems or files change atomically. Recovery reads
the journal and pointer, selecting one complete verified artifact. New runs use
the new pointer; old runs still use their saved pins. Module update requests also
compare their `from` pins under the activation lock to reject concurrent changes.

## 8. Export executable meaning and resolve presentation fallbacks

A complete resolved game JSON contains core definitions, selected manifests/pins,
merged settings, projected definitions and provenance, opcodes/formulas/predicates,
capability contracts, ordered phases, numeric/RNG/scheduler/VM rules, asset
references and fallbacks, schema versions, hashes and conformance test vectors.
Author comments may live in a separate source section excluded from gameplay hash.

```text
exportGame(lock, targetContract):
  walk all reachable rule operations and reference edges
  require closure in portable opcode/VM contract
  for native host extension: require declared target implementation + version
  if a required operation unsupported: fail export, naming definition/path/op
  encode a structural plain-data object; reject nondata values (never omit them)
  include public contracts and golden vectors; verify reimport resolved hash
```

A JSON dump that drops JavaScript functions is not a playable engine-neutral
export. Native extensions may produce a clearly marked host-dependent package;
only packages whose required operations close over the portable contract can claim
portable gameplay. Unity, Unreal and browser adapters must pass the same vectors.
Asset embedding is an export policy: external references require digests and an
explicit core fallback, with missing assets unable to change gameplay.

```text
resolveVisual(entity, tags, kind, presentationLock):
  try exact entity override
  else choose matching tag rule by explicit specificity then explicit priority
       (reject equal non-equivalent winners)
  else try kind default
  else core procedural low-poly stand-in with accessible label
  on disabled/missing/invalid/error asset: use the declared next fallback
```

Visuals reuse authoritative geometry/target snapshots: identical collision bounds,
target IDs and interaction areas regardless of art, loading or headless mode.
Presentation randomness uses a separate non-gameplay stream or deterministic
visual seed. Render time must never consume gameplay RNG. Low-poly hero/enemy
stand-ins are core-owned and do not require an art module.

## 9. Extract incrementally and prove contracts

Use existing live seams first: `src/engine/actions.js:1–25` defines the headless
effect envelope; `src/engine/triggers.js:1–10` and `272–295` provide declarative
hooks; `src/model/formulas.js:1–29` supplies structured formulas;
`src/model/tagService.js:1–24` and `src/model/combatCardProfile.js:53–73` resolve
authored identities. `src/model/registries.js:411–421` installs a live framework
bridge even though the broad replacement-candidate header in
`src/framework/index.js:3–8` says otherwise. Scope bridge registries and caches per
runtime before allowing concurrent configs. `src/framework/bridge.js:87–104`
exposes the legacy action/Stamina alias: extract deliberately, never charge both.

Preserve queue/reaction semantics at `src/engine/combat.js:450–475` and expanded
completion ordering at `src/engine/combatExpansionActions.js:100–109`. Baseline
damage receipts come from `src/engine/actions.js:430–485` and `592–619`, not a
simplified interpretation of comments. Current `tools/engine-export.mjs:57`
omits functions; do not treat that existing export as a full portable runtime.
These references describe the surveyed baseline, not newly implemented modules.
Do not adopt `docs/tag-model` proposal material as runtime authority.

Implement in numbered, reviewable slices from IMPLEMENTATION.md: first core-only
playability and isolated locks, then one complete optional feature package and
JSON-to-runtime adapter, then the most consequential feature interactions, then
portable execution/export and update/migration hardening. Retain the legacy path
until its replacement meets explicit compatibility gates. Feature guides must
state defaults, capabilities, fallback behavior, supported combinations, state
ownership, examples and upgrade constraints.

Verification below is a future acceptance procedure, not a claim of executed tests:

1. Core-only with every optional module absent/false: launch, target, attack, pass,
   enemy response, inspect, procedural visuals and save/restore. Prove an invalid
   attack spends no opportunity, pass reaches an enemy response, and repeated
   legal attacks against the default finite-HP enemy reach victory (or death under
   the declared default matchup), then restart starts a fresh run. Bound each turn
   without MP, SP or Actions; an intentionally endless pass script need not win.
2. For each built-in feature: core plus that feature, and full preset minus that
   feature. Verify actual absence of its costs/state/effects, not just UI hiding.
3. Targeted pairs: cards/resources, resources/stances, defenses/mixed damage,
   counters/reactions, progression/equipment, shops without routes, art off/missing.
4. Generate supported higher-order combinations from manifest constraints. Assert
   at least pass is legal on every nonterminal player turn, all finite scripted
   traces progress to a response/outcome, selected feature closure unchanged,
   valid minimum decks or declared fallback, and round-trip saves preserve hashes.
5. Golden vectors: component allocation ties, mixed-hit minimum-through, pool
   depletion/breaks, stage reorder, reactions/rollback, RNG/scheduler replay,
   stale config patches, unsupported migration and export opcode closure.
6. Run two runtimes with different locks in one process, alternating commands.
   Compare isolated traces, state hashes, caches and registry results; prove no
   singleton leaks. Compare seeded legacy traces with adapter traces first.
7. Cross-runtime portable vectors compare committed events and canonical state
   hashes, not screenshots alone. Browser/visual checks additionally cover legal
   controls, concealment, accessible labels and target-bound equivalence under
   loaded, failed, missing and disabled art.

Stop on a failing semantic gate and retain its smallest reproducible fixture.
Document unsupported combinations explicitly; never silently trim features until
an example passes. No gameplay approval, runtime implementation, or cross-engine
conformance is implied by this planning document.
