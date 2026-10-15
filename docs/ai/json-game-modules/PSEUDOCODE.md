# JSON game modules: implementation pseudocode

**Status: documentation blueprint only.** None of the interfaces, module loader,
update requests, portable runtime, or verification procedures below is implemented
by this document. Existing gameplay is unchanged; the compatibility legacy adapter
is a future implementation step, not a component supplied here. Follow the
scope and delivery sequence in [IMPLEMENTATION.md](IMPLEMENTATION.md); record work
and resume instructions in [CONTINUE.md](CONTINUE.md). Integration is restricted to
`Feature/json-game-modules`; do not promote to `dev`, `test`, `main`, or a release.

## 1. Distinguish the full core bundle from the technical fallback

The product core `ashen.core@1.0.0` selects the **full core bundle**, not a
one-attack demo. [CORE-SPEC.md](CORE-SPEC.md) owns its class, loadout, card, resource,
combat, progression, route, rest, reward and presentation specifications, including
pending decisions. Read that sibling before implementing a policy or filling in a
number. The bundle declares feature modules and exact package pins explicitly;
the runtime kernel supplies their shared contracts and technical fallbacks.

The full profile includes class selection, fixed starting loadouts, a combat deck,
SP/MP, multi-card turns with End Turn, stances and rewards, a deck editor,
progression and the three-act journey. `modules: {}` means those bundle defaults.
A technical one-action attack/pass harness remains available when feature
overrides disable normal action providers; it must not redefine the user-facing
core. `ashen.fallback@1.0.0` is an optional internal test fixture reference only:
users do not need to switch core references to disable modules.

The runtime's core fallback providers own playable action execution, targets,
baseline stats, damage, activities, procedural presentation and outcomes/restart.
The generic kernel supplies transaction, registration, persistence and scheduling
contracts; it does not itself contain that gameplay. Routes/dungeons select
activities; they do not own the only launcher. A shop can register an activity
without routes. Disabled equipment/progression uses declared baseline stats, and
disabled or missing art uses procedural low-poly stand-ins. Disabling a module
changes mechanics as well as UI, while fallback policy prevents a softlock.

`boundedPolicy` selects **full-profile card turns** when the projected action
provider supports them, otherwise **fallback one-action turns**. The full profile
allows multiple legal cards using its declared SP/MP prices and constraints;
it does not spend a universal one-card opportunity. End Turn is always legal
while awaiting a player command and yields an enemy response. The fallback profile
uses one direct attack opportunity or pass, even without SP, MP or Actions.
Both policies have a finite zero-resource/free-action budget and bounded queued
work; exhausting a budget never creates an infinite refill loop. Invalid commands
spend neither resource nor opportunity. Budget policies are versioned and visible
in inspection; they cannot silently replace the specified card-turn model.

```text
type CorePhase = launch | activity | playerTurn | enemyTurn | victory | death
type TransactionStatus = COMMITTED | REJECTED | SUSPENDED
CoreState = {
  phase, cycle, hero, activity: {id, kind, enemies, localState, enemyCursor},
  outcome, turn: {ownerId, policyId, opportunitiesRemaining?, freeCommandsRemaining},
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
      if projected full-profile class provider is active:
        require selected class belongs to the four-class core selector
        apply fixed starting loadout/class definition; no attribute creation flow
      else: instantiate declared compatible baseline hero
      initialize only enabled durable deck/currency/progression/resource state
      validate active class/loadout/card contracts; use fallback if provider absent
      set phase = launch; offer activity launcher/journey
    startActivity:
      require legal launch/transition and registered activity ID
      retain hero, deck, currency, progression and resource state
      apply explicit entry/recovery/carry policies through candidate deltas
      initialize only activity-local module state
      if activity.kind == combat:
        create its enemy instances; enemyCursor = 0
        enqueueSystem(beginCombatRound)
      else:
        phase = activity; open registered activity handler (shop creates no enemies)
    beginCombatRound:
      require combat and no pending decision
      if projected card provider active:
        reconcile standard round pool/fresh hand through core deck policy
      else: preserve fallback attack/pass without reading absent card state
      enqueueSystem(enterPlayerTurn)
    enterPlayerTurn:
      require combat and no pending decision
      if terminalOutcome(candidate): set outcome and terminal phase; return
      phase = playerTurn
      turn = boundedPolicy.begin(hero, cycle)
      require finite policy budgets and legalCommands includes core.endTurn
      // core.pass is the fallback presentation/alias of End Turn.
    playerAction:
      require phase == playerTurn and actor == hero and no pending decision
      validate target, projected definition, legality and budget before any spend
      if action in [core.endTurn, core.pass]: boundedPolicy.close(candidate.turn)
      else:
        resolve action; pay declared SP/MP/other costs and free-work budget
        if policyId == fallback: spend one fallback opportunity
        // full-profile card play does not spend a universal one-card quota.
      if terminalOutcome(candidate): set outcome and terminal phase
      else if boundedPolicy.shouldYield(candidate.turn, action):
        enqueueSystem(beginEnemyResponse)
      else: expose further legal cards/actions and End Turn
    beginEnemyResponse:
      phase = enemyTurn; enemyCursor = 0; enqueueSystem(enemyStep)
    enemyStep:
      require phase == enemyTurn
      choose next living enemy in stable initiative order
      if none:
        cycle += 1; enqueueSystem(beginCombatRound); return
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

Combat victory grants the earned reward and permits a journey/activity transition;
it does not run `newRun` or reset persistent state. The final act boss victory and
hero death end the run according to the outcome policy. Classify activity outcomes
separately from run outcomes; commit reward/transition eligibility with the result.

Core policy must define simultaneous death precedence and multiple-enemy ordering
in versioned rules. UI and headless drivers submit the same commands. The full
core UI exposes the class selector, card hand, End Turn, activities, combat log,
outcome/restart and inspector; the fallback UI exposes attack/pass. Combat log
rows use committed public facts. Inspection uses hold-target or tap an already
selected target/HUD as specified in CORE-SPEC; ordinary selection clicks and an
`i` shortcut are not new default inspect bindings. Both profiles retain accessible
labels and explain rejected requests without exposing private intent.

## 2. Fix the authoring surface and package contracts

The full core author JSON is exactly this shape:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {}
}
```

An explicit subset override example uses the same shape (not the default bundle):

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

Expand the selected core bundle before applying the author module map. Missing
**bundled** entries inherit bundle enablement/settings; missing **nonbundled**
entries are off. Explicit `false` disables even a bundled feature. `true` enables
module defaults plus bundle overrides. An object enables module defaults, then
bundle overrides, then author settings. Arrays/scalars replace; keyed objects
merge recursively. There is no second `enabled` field. Show the expanded feature
list and each value's module/bundle/author provenance to the author.

Unknown module IDs/settings fail by path. Core and bundle pins identify exact
reviewed artifacts; catalog lookups never select an opportunistic latest package.
Bundle-selected features are explicit product choices, not dependency activation.
Technical dependency closure and optional bridges must not silently enable any
feature outside that declared selection. Built-in preset/pack namespaces must
resolve completely; missing custom references are errors.

RFC 6902 patches edit author source before resolution. Removing an author override
restores the bundle/default value, including enablement; it does not remove an
inherited default. To disable an inherited feature, set `false`. To change a
setting default, edit its owning module/bundle or use a schema-defined replacement
such as `include: []` or an explicit policy. Null is never implicit deletion.

Reserve `$comment` at every object depth. Preserve it in author source and strip it
recursively before execution and gameplay hashing. Preserve array order. Reject
functions, undefined, nonfinite numbers, cycles, prototype-bearing objects, and
unknown executable fields at the data door.

Each cohesive feature package owns its manifest, config/state schemas,
implementation, author guide, content, UI adapter, and integration cases. Helpers
are not separate user toggles. A sample manifest contract follows; package paths
and interfaces are proposed, not existing files. Its sample plugin defaults are
illustrative; they do not settle the full core's remaining Poise activation/stage
policy or copy the bundle's settings:

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
  coreBundle = catalog.requireExact(executableSource.core)
  verify bundle manifest, exact package pins and artifact digests
  effective = expandBundle(coreBundle.declaredModules)
  for each author module entry:
    missing bundled: keep bundle selection/settings
    missing nonbundled: keep off
    false: set off, recording explicit author override
    true: enable merge(module.defaults, bundle.overrides)
    object: enable merge(module.defaults, bundle.overrides, author.object)
  selected = enabledFeatureIDs(effective)
  packages = [coreBundle.kernel] + selected.map(requireExactBundleOrCatalogPin)
  record expansion, value provenance and all bundle pins
  close bundled technical dependencies with typed version checks
  assert selected feature IDs unchanged by technical closure
  settings = effective.mergedSettings  // module -> bundle -> author
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
  resolved = immutable {coreBundle, packages, settings, provenance,
                        providers, definitions, phases, contracts}
  configHash = hash(canonical(executableSource plus bundle/catalog pins))
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

## 4.1. Instantiate the full bundle's gameplay policies

All policies below read values from CORE-SPEC and a versioned resolved profile.
Unanswered choices remain unresolved fields that block approval of the affected
production policy; documentation placeholders must never become executable nulls
or guessed constants. Unaffected slices may use explicitly labeled test fixtures.

```text
validateClassLoadoutAndStarterDeck(candidate):
  require class/cards/equipment capabilities used by this validation are active
  profile = lock.fullCoreProfile  // derives from CORE-SPEC, not legacy defaults
  class = profile.classes.require(candidate.hero.classId)
  assert no initial attribute-allocation request is required
  assert sum(class.fixedAttributes) == profile.startingStatPointTotal
  assert class.fixedAttributes exactly matches its CORE-SPEC allocation
  assert initial equipped items exactly match class.fixedLoadout
  assert starter role multiplicities match profile.starterDeckRecipe
  assert exactly one class-specific slot resolves to class-specific card kind
  validate each stable card/gear reference and projected behavior
  instantiate cards with stable instance IDs and immutable provenance
  assert starter instance count matches the specified ten-card total
  // Evade is available via stance/rewards, not a required initial deck slot.

beginCombatRound(candidate):
  policy = lock.cards.roundPolicy
  pool = collectPlayedAndUnplayedStandardCards(candidate.deck, candidate.round)
  apply declared treatment of exhaust/powers/persistent instances
  retain instance upgrades, acquisition history and per-run progression
  shuffle eligible whole standard pool using candidate.rng.deck
  draw policy.handBase + candidate.hero.attributes.INT
  // Full core uses the confirmed 4 + INT rule; no extra INT baseline term.
  // Never carry over an old draw/discard arrangement as the standard round rule.
  // Never reapply retained power hooks merely because its card is reshuffled.
```

CORE-SPEC supplies the four classes, fixed weapons and starter role counts: the
implementation must validate their ten-card recipe rather than substitute a
legacy starter deck. No equipment/attribute creation editor is implied. The
allowed weapon and armor catalogs are explicit core content constraints, not an
inference from what the legacy game happens to contain. Character appearance is
fixed per class regardless of equipped weapon/armor.

Round refresh reconciles **played and unplayed** standard cards into the whole
pool and produces a fresh hand using the specified base hand. Exhausted cards,
retained power effects, upgrades and persistent card identities require separate
explicit policy; do not blindly reset all instance state. Specify whether a
retained power's card remains eligible and how duplicate application is prevented
before enabling it. Hand size uses the confirmed `4 + INT` rule: most classes
start at five and Starseer at six, using the fixed six-total-point allocations in
CORE-SPEC. There is no seven-per-attribute baseline or separate class-bonus pass.
Keep the hand-base and INT contribution distinct in receipts.

```text
constructStatProvider(profile, retainedSourceFormulas):
  replace corresponding legacy primary terms once with core primary mappings
  preserve other hidden formula terms and their source/version/dependency receipts
  validate no duplicate primary path; compile immutable provider into runtime lock
  require resolved SP formula and current-HP/resource carry policies where needed

applyAllocatedLevelPoint(candidate, attributeId):
  require rest level-up service active and unspent earned point available
  policy = lock.progression.attributeDeltaPolicy.require(attributeId)
  before = snapshot current/max resources and dependency receipts
  increment selected primary attribute; decrement unspent point
  after = lock.statProvider.recompute(candidate.attributes)  // once
  verify specified primary delta and secondary/hidden contribution receipts
  // No formula mutation or separate flat primary gain during allocation.
  reconcile current pools using explicit deficit/carry policy from profile
  preserve unrelated deck/currency/progress and emit public allocation facts

makeRewardOffer(candidate, earnedReward):
  offerCount = requireResolvedPolicy(coreSpec.reward.offerCount)
  takePolicy = requireResolvedPolicy(coreSpec.reward.takePolicy)
  // Three usual offers confirmed; take one remains a recommendation.
  eligible = project six reward-category pools against enabled capabilities
  validate count, positive eligible weight and fallback for empty categories
  sample offerCount weighted categories/items under resolved replacement policy
  persist offer IDs, takePolicy and RNG receipt; retry displays reuse same offers
  return public offers; selection spends claim token once in a transaction

RestVisit = {visitId, revision, semanticsVersion, status: available|active|resolved|closed,
             visitTokenConsumed, selectedService?, draft?, completedReceipt?}

restCommand(candidate, request):  // every branch executes inside executeTransaction
  require actual current rest activity and matching visitId/expectedVisitRevision
  visit = candidate.restVisits.require(request.visitId)
  if request == chooseService:
    require visit.status == available and not visit.visitTokenConsumed
    require service in [Strategize, Smith, LevelUp]
    validate selected service eligibility and available authored budgets
    visit.selectedService = service; visit.visitTokenConsumed = true
    visit.status = active; visit.draft = versioned service-specific empty draft
    increment visit.revision  // durable exclusive choice; no effects/refill yet
  if request == updateServiceDraft:
    require visit.status == active and request.service == visit.selectedService
    validate draft against selected service, owned instances and current budgets
    persist draft and increment visit.revision; apply no irreversible service effects
  if request == finalizeService:
    require visit.status == active  // token is already consumed; do not spend twice
    revalidate draft, eligibility, earned points and authored upgrade budget
    switch visit.selectedService:
      Strategize: apply validated deck moves preserving identities/history
      Smith: upgrade eligible equipment only; spend declared upgrade budget once
      LevelUp: allocate existing earned points through compiled stat provider
    reconcile maxima after equipment/stat changes using their dependency receipts
    set current HP = resulting maxHP, MP = resulting maxMP, SP = resulting maxSP
    refill healing and MP flask charges to resulting declared capacities
    // Enabled providers own these deltas; no absent-module resource is recreated.
    visit.status = resolved; close service editor; increment visit.revision
    persist receipt keyed by visitId with choice/service/recovery facts
  if request == leaveRest:
    require visit.status == resolved
    visit.status = closed; close editor; increment visit.revision
    authorize activity exit without creating another visit token

editDeck(candidate, request):
  require deck editor enabled and current activity is an actual rest spot
  require visit.status == active and visit.selectedService == Strategize
  require service editor active for matching visitId/revision
  require no combat or pending decision; map disguise cannot grant rest legality
  validate owned instances and resulting deck legality; update Strategize draft
  preserve upgrade state, history and stable IDs; finalize via finalizeService
  never undo an irreversible upgrade through remove/re-add or reopening editor
  // Reward acquisition elsewhere is not a manual deck-edit command.

editEquipment(candidate, request):
  require equipment editor enabled
  require profile.equipmentEditing.contextPolicy permits current activity/phase
  validate ownership, slot/loadout legality and resulting resource reconciliation
  preserve item/card identities and irreversible upgrades through deltas
  // Do not inherit deck editor's rest-only rule; choose this policy separately.
```

Each rest visit offers **one service choice**: Strategize edits the deck, Smith
upgrades equipment, or LevelUp allocates earned attribute points. All three fully
restore HP, MP and SP and refill healing/MP flasks after the chosen service's
changes, so a raised maximum is filled too. Selecting a service commits the one-use
visit choice; it cannot be swapped for another service by reopening, reloading or
retrying a request. Entering/reopening the UI alone does not trigger recovery or
create a new visit. A legitimate visit ID derives from committed activity-entry
identity, not render/mount count; activity policy controls any genuine later visit.

Service selection and finalization are separate transactions. Save the chosen
service, consumed token, revision, semantics version and draft while active;
reload resumes that editor, without new budgets, a new choice or duplicate
recovery. Finalize atomically applies the selected service, resource recovery and
resolved receipt. Duplicate finalize requests return the stored receipt through
idempotency handling. Leaving requires resolution and closes the editor. If an
editor needs a reaction/input suspension, section 5's transaction continuation
retains that same visit identity; SUSPENDED never authorizes a second choice.

Permit an eligible service editor to finish without changes as a recommendation
to prevent a softlock; express that no-op policy explicitly rather than inventing
free earned points, XP or equipment upgrades. Eligibility and upgrade/point budgets
remain authored policies. Invalid drafts keep the locked choice and editor open
for correction. Smith is the rest-menu equipment-upgrade path; there is no rest
card-upgrade option in this profile. Level/card reward acquisition remains governed
by its own reward rules and is not a free LevelUp grant.

Both editors are on. Manual deck editing is **rest-only within active Strategize**;
reward acquisition outside rest is distinct and permits no arbitrary deck edit.
The equipment editor has its own context policy; noncombat safe phases remain a
recommendation, not a confirmed rest-only restriction. Its general editing
permission does not grant the Smith upgrade service or a second rest service.
Fixed starting attributes
use six total points distributed by class exactly as CORE-SPEC records. Replace
legacy primary terms only while constructing the stat provider; allocation updates
attributes and recomputes it once. Preserve other hidden formulas with
source/version/dependency receipts. Do not
invent SP math such as `floor(CON/2)` or silently add new primary gains on top of
old scaling. Intended level gains per act do not establish an XP curve or an
unambiguous final level.

The route generator reads the three-act profile: validate pre-boss node count and
the boss endpoint independently, distinct act bosses, two visible rest anchors
per act plus visible elite/boss anchors, and actual activity types behind question marks. Visibility changes only
the map view, never its resolved type. Shops, treasure, events, fights and rests
all use transactional activity services even without the route module.

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

## 6. Specify full-core combat without importing legacy defense semantics

The full core uses unified damage and its selected HP/SP/MP, AR/DR, accuracy,
evasion, Block and Poise rules. It does not inherit element channels, spell ranks,
Ward/Barrier splits, or legacy Poise absorption/depletion/stagger behavior merely
because the adapter can execute those systems. Their old receipts remain legacy
parity fixtures, not new default policy.

```text
resolveDamage(action, target, compiledGraph, numericPolicy):
  require all activation, ordering, scope and numeric policies resolved
  frame = create damage frame from action, target and candidate read-only views
  for stage in compiledGraph.orderedStages:
    execute stage exactly once per its declared hit/action scope
    collect validated delta commands and internal receipts
  return internal receipts; public projection later strips private information

// Responsibilities registered as graph stages, not extra calls after traversal:
// authored damage/formulas and source-traced AR/DR contributions;
// accuracy/hit/evade decisions and directed stance-matchup resolution;
// successful evade's all-damage dodge / failed evade's double-damage effect;
// Block and pure-Poise mitigation; HP deltas; status/DoT/interrupt riders.
// Explicit edges decide their sequence; reject duplicate responsibility ownership
// or unresolved noncommuting order. Never apply Block/Poise/Evade a second time.
```

CORE-SPEC owns the directed stance edges (including Prepare), not an inferred
rock-paper-scissors cycle. Resolve edge overlap and valid contexts explicitly.
Evade is accuracy-based; no invented guaranteed hit or arbitrary fixed dodge
percentage. The double-damage stage placement, rounding and timing require named
resolved policies. Poise's confirmed pure damage-mitigation rule, **while it
applies**, is `d > 0 ? max(floor(d * 0.75), 1) : 0`: 25% less damage taken,
not 75% mitigation. Zero input cannot create damage. Its active condition and
stage/per-hit/per-action scope still require named policies in CORE-SPEC; do not
invent a large depleting pool or choose a legacy interpretation. Stagger
interruption is a separate authored behavior whose unspecified details
also require a declared policy, not automatic Poise depletion.

Every pipeline policy names rounding positions, floor/ceil semantics, integer
range, overflow rejection, allocation ties where relevant, per-hit/per-action
scope, bypass handling and any minimum-through rule. Unspecified rules block the
affected profile's activation; they are not licensed to copy old semantics.
For the compatibility adapter alone, reproduce the old typed allocations and
Barrier/Ward/Block/Poise receipts exactly before migrating old runs. Preserve
old and new contract versions and test vectors separately.

Core card text follows the specified short effect-line/clause budget and supported
damage, DoT/status and gain-Block/Poise/Evade behaviors. Validate text bindings to
the same active effects/formulas used by execution and preview; no hidden extra
clauses or cosmetic numbers. Descriptive tags cannot create an unsupported opcode.

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

Full-core appearance uses the fixed class look; equipped items do not silently
replace it. Animation bindings use the specified action/status keys (attack,
smash, defend, counter, sweep, cast, evade, hit, hurt/status, defeated, staggered).
Optional art and core low-poly fallbacks share those bindings and accessibility.
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

Implement in numbered, reviewable slices from IMPLEMENTATION.md: first full-bundle
expansion, isolated locks and technical fallback playability, then cohesive full-core
feature slices constrained by CORE-SPEC and
JSON-to-runtime adapter, then the most consequential feature interactions, then
portable execution/export and update/migration hardening. Retain the legacy path
until its replacement meets explicit compatibility gates. Feature guides must
state defaults, capabilities, fallback behavior, supported combinations, state
ownership, examples and upgrade constraints.

Verification below is a future acceptance procedure, not a claim of executed tests:

1. Default `{core: 'ashen.core@1.0.0', modules: {}}`: assert expanded full bundle,
   class selector/fixed gear, starter role recipe, multi-card SP/MP turn plus End
   Turn, whole-pool round shuffle/fresh hand, journey and rest services. No optional
   module may be accidentally absent merely because the author omitted its entry.
2. Fallback with every bundle feature explicitly false (or the internal fallback
   fixture): launch, attack/pass, enemy response, outcomes/restart, inspection,
   stand-ins and save/restore. Invalid attack spends no opportunity, pass yields,
   and a finite default attack script reaches a terminal outcome. Missing bundled
   entries do not constitute this all-off test; explicit overrides are required.
3. For each feature, test full bundle minus that feature and fallback plus that
   feature, using explicit maps. Verify absence of costs/state/effects, not UI
   hiding. Target cards/resources/stances, unified damage/defenses, counters,
   equipment/progression, shops without routes and failed/disabled art. Verify
   shop/fight/rest transitions preserve run-owned deck/currency/progress/resources
   except explicit recovery, cost, reward or upgrade deltas. At each rest, assert
   one durable service choice, Strategize-only deck editing, Smith equipment-only
   upgrades, earned-point-only LevelUp, full HP/MP/SP/flasks against post-service
   maxima, and save/reopen/retry protection with no second service or refill.
4. Generate supported higher-order combinations. Assert End Turn/pass always legal
   when awaiting player input, finite per-turn work, response/outcome progression,
   unchanged feature selection after technical closure, deck/fallback validity,
   and save round-trip hashes. No one-action fallback quota may cap a full card
   turn. An intentional indefinite pass script need not win.
5. Golden vectors separate new unified-damage policy from legacy adapter parity.
   Include confirmed Poise rounding/zero guard plus its activation/scope and evade
   ordering once resolved, reaction suspension/rollback, AI/deck RNG replay, state-preserving activity transitions,
   round reconciliation without power restacking, stale patches, overridden bundle
   enablement, unsupported migration and portable opcode closure. Unanswered core
   policies remain pending acceptance items; do not label guessed fixtures approved.
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
