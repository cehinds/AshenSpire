> Current authority: [CURRENT-SPECIFICATION.md](CURRENT-SPECIFICATION.md). It supersedes conflicting earlier iteration notes. Documentation only.

# AshenSpire architecture refactor: execution and handoff plan

Prepared 2026-09-12. Repository: `D:/repos/AshenSpire`.
Inspected HEAD: `3c70be9014063e2a6216d4e3196d2a04d4438229`, branch `dev`.
This is a proposed implementation plan, not a claim that the refactor or its tests have run.

Read this together with `FRONTEND-WIREFRAMES.md`. That document is a required part of this handoff: it defines the proposed frontend redesign, responsive wireframes, minimal-heading rules, CSS units, configuration extensions, and per-file implementation instructions. The frontend work is not limited to preserving today's appearance. First capture behavior/visual baseline, then apply the explicitly specified presentation changes while preserving mechanics. Where earlier task text says appearance parity, preserve it until the corresponding wireframe change is intentionally implemented and verified.

Latest owner layout rule: EVERY multi-category menu uses W1's left navigation rail/right content pane, with category navigation above content on compact screens. This includes Shop, Character Creation, Town services, Armoury, Compendium, profile categories, and the combined Discard/Exhaust viewer. selection body/inspection body/choice body compose content inside W1 as needed. Do not preserve horizontal tabs/accordions as alternative category shells merely for visual parity. Preserve domain behavior and saved category IDs while deliberately updating presentation. Expanded main-menu/save/map/town/dialogue wireframes are in section 9 of the frontend document.

Latest owner consolidation rule: the wireframe families are shared implementations. Different view models and command bindings populate them; per-flow illustrations are not instructions to build per-flow shells. New/Load share selection body and the existing slot-selection model; Save uses inspection body; Delete/Replace use W2; all category menus share W1. Proposed feature component filenames in this plan may be thin composition adapters or unnecessary where a shared renderer suffices. Do not create duplicate markup just to fill the proposed file list.

Main-menu correction (latest): follow the two-state main-menu wireframe. ASHEN SPIRE stays centered across the full screen in a full-width header in both states; Profile stays top-right. The menu is centered without preview by default. Only while available Continue is highlighted, move the menu region left and show the matching saved-character/world preview on the right; compact layout reveals preview below the centered menu. Use one MainMenuViewModel and renderer, with a derived preview/layout state from shared keyboard/controller/pointer highlight. Preserve focus and prevent hover oscillation during movement. Highlighting never loads or writes a save. Edit src/ui/screens/title.js menuHtml/render and title-only quick-control insertion/binding; reuse kit TitleMenu primitives and existing background/title styling. Wire Profile through existing showProfile and keep fullscreen/music in Settings. Add model and interaction tests for highlight enter/leave, disabled Continue, exact save/preview identity, compact mode, reduced motion, and screen-centered title. Menu destinations follow validated definitions and existing supported handlers. This supersedes the earlier always-centered/no-preview and always-split proposals.

## 1. Outcome and scope

Complete UI handoff: `wireframe.md` now contains screen and card ASCII, per-component vh/vw tables, and language-agnostic pseudocode for every entry. `COMPONENT-SIZING.md` defines the canonical `wireframe.region.component` naming and viewport-to-parent budget conversion. All values not explicitly supplied by the owner are proposed nominal allocations, not measured geometry; validate responsive minimums before implementation.

Card extension is required: `CARD-CONSTRUCTION-CONTRACT.md` and `card-wireframes.md` define WC0 → playing/possession/creation parents → variants, including equipment → weapon/armor, relic → passive/triggered, consumable → healing/resource/utility. Card construction itself resolves components/providers through validated tag rules; no entity-ID renderer branching. Add a dedicated schema/spec PR before implementing these new card presentation contracts, then integrate serially into Tasks 03/06/11/13/14. Reuse current tag service, domain previews, card renderer entry points and save identities. Per-card pseudocode and proposed tag vocabulary must be reconciled to actual existing definitions, not copied as invented mechanics. New schema relations remain 3NF; generated composite card models are derived.

Palette/state requirement: COLOR-INTERACTION-CONTRACT.md is mandatory. Implement its five configurable palette groups and role/state resolution through W0 in Tasks 01–06; descendants inherit. Exit/Close/Back selected state is red, ordinary primary ready/selected is green, neutral/unready is dark brown/gold. Preserve named exceptions and disabled-state precedence. Store theme/role/state mappings in normalized data, compile shared CSS variables, and eliminate per-feature color literals. Use the same state model for pointer, keyboard, controller, and touch feedback. Include single-row-first layout/typography without overriding user text scaling, shrinking targets, or wrapping footer controls.

Footer correction: all footer controls remain INLINE on one horizontal row in every orientation. This supersedes any earlier suggestion to stack buttons on narrow screens. Keep Back/Close left and Primary right, or one button full-width. Use concise semantic action labels (the Profile placeholder is `Action`, not `Applicable action`) and shared responsive sizing/gap/padding within accessibility limits. Render-state explanations belong in the body, not verbose button labels. The master footer must not wrap controls or labels. Validate supported narrow widths rather than silently stacking, clipping, or shrinking targets below the configured minimum.

W0 master requirement (latest): all four parent families inherit W0; all lettered children inherit through their parent. W0 owns title/header, top-right exit, body host, bottom-left Back, bottom-right Primary, spacing/effects/focus/transition/lifecycle. Refactor Task 04A/05/06 around this one master renderer. W1 is a workspace specialization, not another master. Preserve explicitly requested title-center and combat-center variants as declared slot-placement policies. Header/footer are reserved regions outside body scrolling. Capability records control legal actions; do not invent Back/exit/commit behavior for mandatory or root screens.

W0 placement contract: title top-left, exit top-right, Close/Back bottom-left, interaction/confirmation bottom-right. Use one inherited padding/inset token system across headers, body edges, and footers. Child models may omit unneeded components; remaining anchors do not drift. Count the actual rendered footer actions after capability/visibility filtering: zero → omit footer; one → full usable footer width, label centered; two → Close/Back left and Primary right with shared consistent button padding/sizing. Disabled-but-visible actions still count. This one-button rule supersedes earlier single-action left/right alignment. Implement in the shared footer renderer, not per-child CSS; verify one/two/zero action cases in wide/compact/portrait and ensure transitions cannot leave stale grid columns.

Represent the definition hierarchy with a normalized `uiWireframes(id PK, parentId FK nullable, rendererId)` relation; W0 is the sole root, parent cycles and dangling references fail validation. Store local typed slot/policy assignments once against the owning wireframe; compile inherited effective records as derived output. Children reference their parent and define only allowed local overrides/view-model provider bindings. Do not duplicate inherited effects or ancestor IDs across descendant records. Validate allowed overrides and keep runtime semantic IDs compatible; W labels are catalog IDs unless explicitly adopted in the reviewed schema. `wireframe-catalog.json` now records W0, four direct parents, and 32 children.

Final wireframe hierarchy: exactly four parent families, ordered in RESPONSIVE-WIREFRAMES.md as W1 Workspace/modal (children W1a–W1v), W2 Confirmation (W2a–W2e), W3 Main menu (W3a–W3b), W4 Gameplay/encounter (W4a–W4c). Each parent appears first with description, Wide, Compact, Vertical/Mobile ASCII; each child follows in letter order with its own three drawings. Shared parent bones/effects are implemented once; child differences are view-model data and registered body/policy selections. Selection, inspection, and choices are W1 body variants, not separate top-level parents. `wireframe-catalog.json` is the authoritative document-ID mapping; preserve existing runtime/save semantic IDs.

Base-modal consolidation (latest owner clarification): W1 is the default modal/workspace frame: one header, optional category rail, active body host, persistent action footer. Settings, Character Creation, Town, Shop, and Armoury share that renderer with different view models. selection body/inspection body/choice body are body compositions; single-category variants omit the rail with no empty space. W2 uses the same primitive/lifecycle foundation as a compact decision variant. Town must not add a separate HUD/title/scene band above W1; town name/resources belong in the shared header, small NPC portrait and services in the active pane. Optional art stays inside the pane. Do not mount nested modal shells to reuse a body. Implement this consolidation in Tasks 04A/06 and apply to Town in 09A, Settings in 10, Creation/Armoury in 11.

Required responsive companion: `RESPONSIVE-WIREFRAMES.md`. Every shared layout and distinct flow has three views: wide landscape, compact landscape, vertical portrait. Implement and verify all three using the same components/view models; compact does not stand in for portrait. Audit the existing upright/orientation gate (`src/ui/components/upright.js` and its `main.js` callers); incorporate portrait support in the spec task before implementation if the current contract blocks it.

Latest creation requirement: W1, only the active category, small header portrait, compact/paged choices, two-column attributes when space permits, one column in narrow portrait, concise derived-effects summary, persistent Back/Next/Begin. Minimize page scrolling; do not mount inactive category bodies. Large-text overflow may use one active-pane scroll; never hide required fields or reduce minimum targets. Apply in Task 11 and test category changes/rotation with draft preservation.

Latest map requirement: configured nominal height shares top HUD 10%, map 60%, selected-node details 20%, bottom HUD 10%; map inline size about 95% of visible game viewport. Region selection goes inside the top HUD. Resolve requested vh/vw through the existing viewport/zoom boundary and host-relative layout, include safe areas, and keep spacing inside the 100% allocation. Honor minimum readable/control sizes with documented overflow exceptions. Apply in Task 13 across all three views. Author these as typed layout-fraction/size records with a validated total of 1, not a map-specific constant scattered in renderers.

Make all game features use normalized authoritative definitions, validated tags, shared domain operations, pure presentation projections, consistent components, and explicit interaction policies. Existing gameplay, saves, seeded randomness, offline delivery, and input accessibility are the baseline to preserve. A behavior correction discovered during migration is a separately identified change, not silently bundled into an extraction.

Authoring must support JSON/CSV and a database export through the same contract. Database hosting, credentials, live editing, and production deployment are not prerequisites and are not selected by this plan. A portable relational schema and validated export adapter are part of the work; choosing a vendor is a later explicit decision.

The source has existing foundations: `src/model/tagService.js`, normalized tag CSVs, `src/model/registries.js`, component models, UI kit, domain planning/commit methods, and the offline content compiler. Extend these. Do not introduce a second tag registry, effect interpreter, UI framework, or runtime database dependency.

## 2. How to use the file and line references

The companion `source-map.json` contains 289 tracked source/configuration/support files with exact working-tree SHA-256 hashes, line counts, and top-level declaration anchors. `pre-existing-changes.txt` lists tracked local changes present during planning. They are not changes made for this plan.

Numbers below refer to those working-tree bytes, not necessarily HEAD. After every preceding task, locate a symbol again with `rg -n`; never apply an edit blindly at an old line number. New files are explicitly labeled NEW and have no current line number. The line references identify edit entry points; they do not authorize deleting the remainder of a function or file without reading it.

Some later tasks require a field-by-field mapping before implementation. This plan specifies that deliverable and its acceptance test rather than pretending that every legacy field has already been audited. An implementer must not invent a meaning for an unknown field.

## 3. Execution rules for every task

1. Read repository `AGENTS.md`, `SPEC.md`, `DEVELOPER.md`, and any narrower instructions at the implementation checkout.
2. Check `git status`, current branch, and active work before edits. Do not reset, clean, stash, overwrite, or copy the dirty working tree without explicit direction. Plan against the actual current `dev`; refresh anchors if it differs from this snapshot.
3. Work serially. Each numbered implementation task is one GitHub issue, one `codex/` branch off the owner-reviewed `dev`, and one draft PR targeting `dev`. Each later task starts only after its prerequisites have landed through owner review. Do not stack speculative migrations on an unreviewed foundation.
4. Posting issues/PRs or pushing is an outward-facing action: follow the current authorization and repository rules. This document does not authorize publication or merging. Prepare the concrete changes and results before requesting any still-required approval.
5. Before extraction, search all callers: `rg -n 'SYMBOL' src tools tests`. Record API inputs, return shape, mutation behavior, side effects, cleanup, and caller assumptions.
6. Run applicable existing tests on the baseline. If red, record the failure and distinguish it from your changes. Never suppress a check to make the migration pass.
7. Implement only the current task. Preserve public entry points with small explicit compatibility adapters until their callers are migrated. No dual writes or alternative rule implementations.
8. Add behavioral tests for the moved responsibility. Update source-shape checks to assert the real contract after extraction; do not retain tests that require the obsolete implementation location.
9. Rebuild generated content with `node tools/content-build.mjs`; rebuild shipped HTML with `node tools/launch.mjs --build-only` when applicable. Never hand-edit generated JS, `AshenSpire.html`, `build/`, `dist/`, or `buildordinal.json`.
10. Complete applicable CI gates, summarize exact results and limits, and submit a draft PR only when authorized. Never merge it yourself.

## 4. Target ownership and dependency contract

| Layer | Responsibilities | Forbidden dependencies/behavior |
|---|---|---|
| `content/source/` | Canonical rows and configuration versions | Executable scripts, callbacks, embedded SQL, duplicate authoritative facts |
| `src/content/generated/` | Build-generated data transport | Manual edits; hand-authored overrides |
| `src/model/` | Schemas, registry indexes, tags, pure calculations, domain plans and existing validated commit primitives | DOM, UI imports, browser storage |
| `src/engine/commands/` (NEW) | Validated feature command boundaries over domain primitives | DOM, display text construction, audio, navigation |
| `src/app/` (NEW) | Run session, navigation coordination, persistence coordination | Entity-specific rule calculations, DOM templates |
| `src/ui/viewModels/` | Snapshot + definition + local selection → immutable display records | Mutation, I/O, RNG draws, event listeners, HTML strings in new models |
| `src/ui/models/` | Component and interaction record constructors | Mutable run objects, callbacks, DOM nodes |
| `src/ui/screens/` | Presenters and screen lifecycle | Price/heal/eligibility formulas, direct domain mutations, duplicated shared markup |
| `src/ui/components/` | Renderers and component interactions | Rule decisions or persistence |
| `src/ui/services/` | Modal/input lifecycle and other browser adapters | Domain transactions |
| `src/ui/kit/` | Leaf primitives and shared assemblies | Depending on a consumer through tooltip/debug/fx cycles |
| `src/main.js` | Construct and wire the above | Growing into the new location of extracted feature logic |

`src/framework/` currently contains both candidate implementations and adopted wrappers. Record each module's actual status. Do not delete or replace the framework wholesale. Adopted wrappers may remain compatibility facades while callers migrate toward the correct layer.

## 5. 3NF contract

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

### 5.1 Proposed UI/service relations

Names below are new logical relation names. Use lower-camel CSV basenames in `content/source/` to match the current generator. Do not add an entire table if the pilot does not yet use it.

| Relation | Columns and key | Dependencies/constraints |
|---|---|---|
| `uiLayouts` | `id` PK, `rendererId` | `id → rendererId`; renderer ID resolves in code allowlist |
| `uiLayoutSlots` | `layoutId`, `slotId`, `ordinal`, `required`; PK `(layoutId,slotId)` | FK layout; UNIQUE `(layoutId,ordinal)` |
| `uiModalPolicies` | `id` PK, `escapeAction`, `backdropAction`, `initialFocus`, `restoreFocus`, `inputShieldMs` | All fields depend on policy ID; enums validated; nonnegative bounded duration |
| `uiSizes` | `id` PK, `widthRem`, `maxHeightRatio` | Positive width; ratio in valid range; no feature-name sizing branches |
| `uiSurfaces` | `id` PK, `layoutId`, `modalPolicyId`, `sizeId`, `titleTextId` | FKs; policy nullable only for a declared nonmodal surface |
| `uiSurfaceSlots` | `surfaceId`, `slotId`, `providerId`; PK `(surfaceId,slotId)` | Validate slot belongs to the surface's layout; provider code allowlist |
| `uiTexts` | `id`, `locale`, `text`; PK `(id,locale)` | Localized content; validate required fallback locale; text IDs resolve as groups |
| `gameCommands` | `id` PK, `handlerId` | Handler allowlist; configuration does not execute code |
| `uiActions` | `id` PK, `commandId`, `labelTextId`, `confirmationPolicyId` | FKs; interaction semantics reference existing confirmation authority |
| `uiSurfaceActions` | `surfaceId`, `position`, `actionId`; PK `(surfaceId,position)` | Position is a constrained slot; UNIQUE `(surfaceId,actionId)` where repeated actions unsupported |
| `gameServices` | `id` PK, `surfaceId`, `previewProviderId`, `actionId` | No duplicated command ID/label/layout fields already reachable by FK |
| `serviceRequiredTags` | `serviceId`, `tagId`; PK both | Both FKs; all required tags must match |
| `serviceExcludedTags` | `serviceId`, `tagId`; PK both | Both FKs; contradiction with required tags rejected |
| `serviceLocations` | `serviceId`, `locationKindId`; PK both | FKs to service and existing declared location kinds |

`confirmationPolicyId` above references the canonical confirmation policy relation selected by Task 01. If existing IDs are action policies rather than separate reusable policies, preserve that structure instead of creating a parallel table. `uiModalPolicies` controls dismissal/focus, which is a distinct fact from whether an action requires confirmation.

Example canonical rows (illustrative IDs; map to existing IDs during Task 01):

```text
uiLayouts:       (selectionDetail, selectionDetailRenderer)
uiLayoutSlots:   (selectionDetail, choices, 0, true)
uiLayoutSlots:   (selectionDetail, details, 1, true)
uiSizes:         (xl, <existing measured value>, <existing ratio>)
uiSurfaces:      (smithUpgrade, selectionDetail, selectionDismiss, xl, smithUpgradeTitle)
gameCommands:    (smith.upgrade, smithUpgradeHandler)
uiActions:       (upgradeSelected, smith.upgrade, upgradeLabel, <existing policy ID>)
gameServices:    (smith.upgrade, smithUpgrade, smithUpgradePreview, upgradeSelected)
serviceRequiredTags: (smith.upgrade, <existing eligible tag or approved new tag>)
```

Do not copy placeholder values into shipped data. Extract exact current values and approved identifiers. A new capability tag is valid only if it expresses a real reusable property and eligibility stays equivalent to the existing planner.

### 5.2 Domain relation migration pattern

For each family preserve its actual candidate keys; do not impose a speculative universal Item table. Separate, as applicable: definition, ordered effects, requirements, grants, tags, pool membership, asset associations, and owned instances. For example:

```text
WeaponDefinition(weaponId PK, nameTextId, weaponTypeId, ...intrinsic scalar facts)
WeaponRequirement(weaponId, attributeId, minimum; PK weaponId+attributeId)
WeaponGrant(weaponId, roleId, ordinal, cardId; PK weaponId+roleId+ordinal)
OwnedWeapon(instanceId PK, runId FK, weaponId FK, upgradeLevel)
```

First document whether grants can repeat, whether requirements vary by tier, and whether weapon IDs are scoped. Extend the key/relations accordingly before writing data. The sample is a pattern, not an audited replacement schema for all existing equipment.

## 6. Language-agnostic core pseudocode

### 6.1 Typed ingestion and normalized compilation

```text
FUNCTION buildContent(sourceAdapter, manifest, schemas):
    snapshot = sourceAdapter.readConsistentSnapshot(manifest)
    REQUIRE snapshot.schemaVersion is supported
    FOR each relationSchema IN schemas:
        rows = snapshot.readRelation(relationSchema.name)
        rows = parseUsingDeclaredColumnTypes(rows, relationSchema)
        validateColumnsNullsAndTypes(rows)
        validatePrimaryAndCandidateKeys(rows)
    validateAllForeignKeys(snapshot)
    validateTagTargetsAndFamilyDomains(snapshot)
    validateRegisteredCommandsProvidersLayouts(snapshot)
    validateRequiredSlotsAndPolicyCompatibility(snapshot)
    validateRuleGraph(snapshot)  // bounded, typed, no executable strings
    ordered = orderByDeclaredOrdinalOrStableKey(snapshot)
    materialized = joinIntoExistingRuntimeShapes(ordered)
    validateExistingContentContract(materialized)
    artifact = serializeDeterministically(materialized)
    emitGeneratedModules(artifact)
    RETURN artifact
```

Database exports use one consistent read transaction/snapshot. Files use one source manifest. Neither merges competing authoritative records by last-writer-wins. Preserve existing gameplay-sensitive ordering explicitly; do not sort a random-choice pool differently and call it formatting.

### 6.2 Tag selection

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

### 6.3 Domain command execution

```text
FUNCTION executeCommand(session, envelope):
    REQUIRE envelope.commandId resolves to a registered handler
    validatePayload(envelope)
    IF session.completedRequests contains envelope.requestId:
        RETURN recordedResult(envelope.requestId)
    IF session.commandInProgress:
        RETURN rejected("busy")
    session.commandInProgress = true
    TRY:
        current = session.currentDomainState
        plan = handler.plan(current, registries, envelope.payload)
        IF NOT plan.allowed:
            RETURN rejected(plan.reasonCode)
        IF plan invalidates the user's reviewed consequence:
            RETURN reviewRequired(plan)  // no mutation, show refreshed review
        result = handler.commitValidatedPlan(current, plan)
        // Reuse existing domain commit checks. No UI callbacks here.
        recordCompletedRequest(envelope.requestId, result)
        publishOneStateChange(result)
        RETURN committed(result.receipt)
    FINALLY:
        session.commandInProgress = false
```

Initially this is an in-process guard, not durable distributed exactly-once delivery. Co-op authority and request IDs must follow the existing server protocol. Prevalidate before mutation; where a current commit can partially fail, create a feature-specific prepared change set and test atomicity before routing it through the new command boundary. Do not JSON-clone or replace the entire run behind existing engine references.

Persistence is coordinated after a successful domain commit. Preserve existing failure reporting. A save failure does not mean the purchase failed and must not cause a second purchase on retry.

### 6.4 Presenter and view model

```text
FUNCTION openService(context, serviceId):
    selection = emptySelection()
    lifecycle = createDisposableScope()
    service = registries.services.require(serviceId)
    modal = modalHost.open(project())

    FUNCTION project():
        plan = previewRegistry[service.previewProviderId](context.snapshot(), selection)
        RETURN immutableServiceViewModel(service, plan, selection)

    ON selectItem(id):
        selection = { itemId: id }  // invalidate dependent mount/card selection
        modal.update(project())
    ON selectMount(id):
        selection = { itemId: selection.itemId, mountId: id }
        modal.update(project())
    ON confirm:
        result = commands.execute(commandEnvelopeFor(service, selection))
        IF result is rejected OR reviewRequired:
            modal.update(projectWithReason(result))
        ELSE:
            closeOrRefreshAccordingToExistingServiceContinuation(result)
    ON cancel:
        modal.close("cancel")  // no domain mutation
    ON dispose:
        lifecycle.dispose()
        modal.close("navigation")
```

A new view model contains IDs, text, values, tokens, enabled/disabled reasons, and semantic actions. Renderers do not receive `run`, mutable registries for rule queries, or callbacks inside model records. Presenter binding receives a separate command map.

### 6.5 Modal lifecycle

```text
FUNCTION openModal(model, bindings):
    validateModalModelAndPolicy(model)
    entry = { id: uniqueRuntimeId(), opener: activeElement(), closed: false }
    entry.dom = renderRegisteredLayout(model)
    stack.push(entry)
    updateBackgroundInputOwnership(stack)
    focusAccordingToPolicy(entry)

    ON Escape(event):
        IF entry != stack.top OR event.repeat OR event.alreadyHandled: RETURN
        requestClose(entry, model.policy.escapeAction, event)
    ON pointerDown(event):
        rememberWhetherGestureStartedOnThisBackdrop(event)
    ON backdropClick(event):
        IF entry == stack.top AND gestureStartedAndEndedOnThisBackdrop(event):
            requestClose(entry, model.policy.backdropAction, event)
    ON Tab(event):
        IF entry == stack.top: containFocusIncludingEmptyOrDisabledContent(entry, event)

    FUNCTION close(reason):
        IF entry.closed: RETURN
        IF reason disallowed by current policy: RETURN
        entry.closed = true
        cancelPendingTimersAndReleaseListeners(entry)
        removeFromStackAndDOM(entry)
        updateBackgroundInputOwnership(stack)
        restoreFocusToConnectedOpenerOrParentFallback(entry, reason)
        IF reason == committedNavigation: preserveExistingInputShieldUntilDestinationPaint()
        notifyCloseExactlyOnce(reason)

    RETURN { update, close, dispose, id }
```

Do not let an update steal focus if the selected control still exists. Do not make every modal closable: nonmodal mandatory choice screens are a separate surface role. Close reasons are `cancel`, `confirm`, `navigation`, `replace`, and `dispose`; external adapters translate these to existing callback semantics.

## 7. Ordered implementation tasks

### Task 00 — Baseline and complete responsibility inventory

Prerequisite: none. Suggested branch: `codex/architecture-baseline`.

Edit/create:

- NEW `docs/refactor/BASELINE.md`: commit, local changes excluded, test results, save/RNG contracts, input matrix.
- NEW `docs/refactor/MIGRATION-MAP.csv`: `path,symbol,currentResponsibility,targetOwner,taskId,consumers,status`.
- NEW `docs/refactor/AUTHORITY-MAP.csv`: `factOrRelation,currentSource,candidateKeys,canonicalSource,derivedConsumers,migrationTask`.
- Inspect `SPEC.md:93` (layers), `SPEC.md:970` (presentation), `DEVELOPER.md`, component architecture doc; verify anchors in current checkout.
- Inventory every tracked `src/`, `content/source/`, and relevant style file using companion source map. Include all modal constructors, raw HTML paths, `.style` assignments, direct `run`/`meta`/combat writes, hard-coded labels/tuning, and framework imports.

Procedure: enumerate → classify → trace callers → identify behavior → assign one later task. Use AST inspection or manual confirmation for writes; regex alone misses aliases and array mutation.

Acceptance: every tracked implementation/config source has an owner and disposition; each modal has a dismissal/focus/confirmation contract; baseline failures are named; no game changes. Record rendered baseline with actual input through existing browser tools, including settings from title and in-run, Smith upgrade/extract/install, Armoury, Shop, Rest, Rewards, Combat, and co-op where runnable. Unavailable flows remain explicitly unverified.

### Task 01 — Architecture, relation, and compatibility specifications

Prerequisite: 00. Suggested branch: `codex/architecture-contract`.

Edit `docs/COMPONENT-MODEL-ARCHITECTURE.md:1`, `DEVELOPER.md` architecture section, and `SPEC.md` architecture sections in this dedicated spec PR. NEW `docs/refactor/RELATIONS.md` and `docs/refactor/COMPATIBILITY.md`.

Write exact relation definitions using Section 5, adapted to existing identifiers. Inventory canonical confirmation ownership across `src/model/secondbeat.js:117`, `src/model/consequence.js:173`, `src/framework/confirmationRule.js:27`, and framework confirmation data. Distinguish adopted facades from duplicate/candidate logic.

Specify: source manifest versions, deterministic ordering, old-to-new field mappings, null semantics, migration error policy, unchanged save keys/IDs, component contracts, bounded rule vocabulary, and the exact pilot tables. Do not claim all gameplay tables normalized until the family tasks validate them.

Acceptance: a reviewer can identify one owner per fact; 3NF candidate keys/dependencies are documented; UI policy differences are explicit; no mechanics have changed. If new mechanics are necessary, they need their own spec proposal before implementation.

### Task 02 — Typed normalized source ingestion and adapters

Prerequisite: 01. Suggested branch: `codex/normalized-content-pipeline`.

Existing edit anchors:

- `tools/content-build.mjs:101` `coerce`, `:112` `parseCsv`, `:131` `emit`, `:148` `compileDir`.
- `src/content/index.js:51` `contentBundle`.
- `src/model/registries.js:174` `createRegistries`.
- `src/model/validate.js:252` `validateContent`; `src/model/schemas.js:520` `SCHEMAS`.
- `tests/run-node.mjs:64` runner aggregation; `.github/workflows/ci.yml:221` existing Node test gate.

NEW `content/schema/manifest.json`, `content/schema/relations.json`, `src/model/normalizedContent.js`, `tools/content-source-adapters.mjs`, `tests/normalized-content.test.mjs`.

Instructions:

1. Keep schema manifests outside `content/source/` so today's compiler does not mistake them for game tables.
2. Define a typed parser path for normalized tables. String IDs stay strings, including `001` and text resembling booleans/numbers. Define optional cells explicitly; do not treat zero as absent.
3. Preserve legacy parsing until each table is migrated. Reject duplicate CSV/JSON owners with the same relation ID; today's basename-to-output mapping can otherwise collide.
4. Validate all normalized rows together before emitting. Add row/key/path diagnostics for invalid FKs, duplicate keys, unknown columns, contradictory tag constraints, missing layouts/actions, and unsupported schema versions.
5. Add filesystem and database-export snapshot adapters. Database-export input uses the same relation names/types and one consistent snapshot ID. Do not open live network connections in browser/runtime code.
6. Compile compatibility views to the existing `contentBundle` shapes. Preserve explicit row/pool order. Keep generated file naming compatible with `tools/bundle.mjs` export limitations.
7. Make `--check` nonwriting and deterministic. Regenerate via the compiler, never patch output files.

Pseudocode: Section 6.1. Acceptance: equivalent CSV, JSON, and database-export fixtures produce byte-equivalent canonical output; malformed IDs/rows/references fail by name; current content and offline build retain behavior; existing parser fixtures remain green. Test a quoted comma and quotes, define/reject unsupported multiline CSV explicitly rather than silently splitting it.

### Task 03 — Pilot configuration, tag queries, and database schema

Prerequisite: 02. Suggested branch: `codex/service-config`.

Existing anchors: `src/model/tagService.js:58` `build`, `:88` `tagService`; `src/model/tags.js:88` `tagContentProblems`; `src/model/registries.js:140` `stampTags`; `src/ui/models/UiComponentId.js`; `src/ui/surfaces.js:87` `SURFACES`.

NEW pilot CSVs from Section 5.1, `src/model/serviceDefinitions.js`, `src/ui/models/ModalModel.js`, `src/ui/services/UiDefinitionRegistry.js`, `docs/refactor/CONTENT-DATABASE.sql`, and `tests/service-config.test.mjs`.

Instructions: reuse current tag IDs/families; add `hasAll`/`hasAny` only if missing; keep cached indexes scoped to registries. Register layout renderers, provider IDs, and command handlers in code allowlists. Do not instantiate modules from arbitrary data strings. Import generated tables through `contentBundle`, expose frozen indexed definitions, and validate the relationships. Map existing `sm/md/lg/xl` values rather than choosing new sizes. Produce portable SQL DDL for the actual pilot schema with PK/UNIQUE/FK/CHECK constraints; document conditional cross-table checks enforced by the export validator.

Acceptance: a second configuration using the same supported service/layout behavior works without renderer changes; unknown command/provider/tag fails; emitted SQL relationships match JSON/CSV validation; no second tag or confirmation authority.

### Task 04 — Break the UI dependency cycle

Prerequisite: 02. Suggested branch: `codex/ui-leaf-primitives`.

Existing anchors: `src/ui/components/tooltip.js:367` `esc`; `src/ui/components/modalShell.js:37` tooltip import; `src/ui/kit/index.js:31` cycle workaround; `src/ui/fx.js:8` debug import; `src/ui/debuglog.js`; `src/ui/components/debugChrome.js`.

NEW `src/ui/kit/text.js` containing the existing escaping implementation unchanged. Change shell import to the leaf module. Preserve `tooltip.esc` as a temporary compatibility wrapper if consumers need it. Trace the resulting graph before changing kit wrappers; do not merely assert the cycle gone. Keep debug logging data/notification independent of kit rendering where another cycle remains. Preserve bundle-supported exports.

Acceptance: existing escaping behavior preserved, UI kit/shell can import in either order, no cycle among affected foundation modules, standalone bundle passes. Do not move unrelated tooltip timing/placement behavior in this task.

### Task 04A — Frontend wireframe and token foundation

Prerequisite: 03, 04. Suggested branch: `codex/frontend-layout-contract`.

Implement the shared foundation from FRONTEND-WIREFRAMES.md before Task 05/06 consumers: explicit heading hierarchy, normalized layout/token/presentation records, typed allowed units, registered responsive layout variants, shared status/action slots, and a fixture-based wireframe showcase. Changes to `modalHead` remove redundant context/title stacks only through the presentation model, not screen-specific hide selectors. Preserve accessible names even when visible context is omitted. Extend Task 01's architecture/UI specification first for any conflict with its existing presentation contract.

Acceptance: the four parent wireframe families render from data; equivalent desktop/compact views share one model and DOM reading order; no decorative subtitle stack; necessary costs, warnings, consequences, and instructions remain visible; new hard-coded px uses have a documented exception. Read the detailed unit/scaling constraints before editing CSS.

### Task 05 — One modal lifecycle with compatibility adapters

Prerequisite: 04A. Suggested branch: `codex/modal-lifecycle`.

Existing anchors:

- `src/ui/components/modalShell.js:136` `bindModalDismiss`, `:201` `modalHead`, `:339` `openModal`.
- `src/ui/components/confirmationModal.js:11` input shield, `:50` opener.
- `src/ui/components/overlay.js:95` close, `:113` open, local listeners around `:293`.
- `src/ui/components/veil.js:107` `topVeil`; `src/ui/input.js:386` `scopeRoot`, `:599` screen key claim.
- `src/ui/components/smithUpgradeModal.js:319` local close/key handling (migrate in 07).
- `styles/kit.css:379` veil, `:386` modal, `:399` size rules; inspect `styles/ui.css` overlaps before changes.

NEW `src/ui/services/ModalHost.js`, `src/ui/services/DisposableScope.js`, `tests/modal-lifecycle.test.mjs`.

Instructions: implement Section 6.5. Make `openModal` delegate lifecycle to the host. Preserve DOM handles used by old callers via adapter. Move confirmation focus trap, initial cancel focus, and destination input shield into reusable host capabilities without discarding their tests. Adapt `topVeil`/input scope to agree with the host while preserving nonmodal surfaces/tooltips. Do not introduce a second competing topmost algorithm. Use scoped DOM IDs. Close and dispose are idempotent. Preserve listener removal and timer cancellation.

Migrate confirmation and menu overlay in separate commits within this task; if review size is excessive, split into sequential issues/PRs before proceeding. Keep behavior parity and documented exceptions rather than forcing every body through one universal form.

Acceptance matrix: nested Escape closes top only; repeated key ignored; Shift-Tab/Tab contained; disabled/empty content has focus fallback; backdrop drag does not dismiss; closing restores connected opener or parent; navigation restores destination focus; rapid repeated confirm cannot activate destination; replace/dispose does not masquerade as cancellation; gamepad input targets top modal. Exercise real browser keyboard/pointer sequences, not only DOM `.click()`.

### Task 06 — Shared layouts and typed service projections

Prerequisite: 05. Suggested branch: `codex/service-layouts`.

Existing anchors: `src/ui/models/ComponentModel.js:24`; `src/ui/models/SmithSelectionModel.js:71`; `src/ui/models/MountServiceModel.js:53`; `src/ui/viewModels/RunHudViewModel.js:11`; `src/ui/kit/index.js` registered primitive builders.

NEW `src/ui/viewModels/ServiceViewModel.js`, `src/ui/components/serviceComponents.js`. Add only pilot-used primitives/layouts: selection list, detail pane, cost row, blocker, action footer. Later features extend the same vocabulary.

Instructions: build on immutable models rather than introduce another model envelope. Move registry lookups and display derivation out of Smith/mount renderers into projections. Providers return typed fields, never HTML. One renderer handles selection-detail layout; specialized mount/card sections remain registered components. Move tunable geometry to validated size/layout records and stylesheet tokens. CSS implements layout algorithms and selectors; data supplies supported values. Do not allow arbitrary CSS/HTML in configuration.

Acceptance: render identical shell/layout from different service models; no renderer changes currency or evaluates eligibility; model serializes and deep-freezes; desktop/phone/large-text shapes verified without changing baseline appearance unintentionally.

### Task 07 — Complete Smith upgrade/extract/install migration

Prerequisite: 06. Suggested branch: `codex/smith-service-migration`.

Existing anchors:

- `src/ui/screens/smithServices.js:11` offer, `:32` open, `:58` receipt text.
- `src/ui/components/smithUpgradeModal.js:42` mount, `:319` close; `src/ui/components/mountServiceModal.js:18` mount.
- `src/model/smithing.js:343` plan, `:420` commitItemUpgrade, `:459` commitSmithing.
- `src/model/cardExtraction.js:180` extractionPlan, `:221` commitExtraction, `:274` installPlan, `:303` commitInstall.
- `src/ui/screens/rest.js:90` and `src/ui/screens/shop.js:81` service callers.

NEW `src/engine/commands/smithCommands.js`, `src/ui/screens/servicePresenter.js`, `tests/smith-commands.test.mjs`.

Instructions: wrap existing domain plans/commits, do not rewrite their formulas. Replace service-name ternaries in `smithServices` with validated provider/command registry resolution. Use shared presenter selection invalidation and layouts. Existing exported modal mount functions become adapters; remove their local keyboard/dismissal/focus code once migrated. Preserve item references, receipts, `free`, `multiUse`, place, onBack/onCommitted behavior. Inspect those options' actual callers before deciding where they belong; owner/configuration context chooses policy, UI payload never grants free purchases.

Acceptance: all three services from Shrine and Merchant; empty/ineligible/insufficient states; cancel leaves run unchanged; stale selection rejected; tier/cost changes require refreshed review; exact one mutation per activation; extraction fallback and installed-card identity unchanged; repeated service continuation preserved. Remove obsolete renderer body markup only after callers use shared layout.

### Task 08 — Shop commands and presentation

Prerequisite: 07. Suggested branch: `codex/shop-commands`.

Existing anchors: `src/ui/screens/shop.js:70` resale calculation, `:81` mount, purchase mutations near `:171`, `:189`, `:203`, remove near `:237`, sell near `:261`; `src/engine/encounters.js:191` stock generation; `src/content/balance.js` shop definition (find in source map/current file).

NEW `src/model/shop.js`, `src/engine/commands/shopCommands.js`, `src/ui/viewModels/ShopViewModel.js`, `src/ui/components/shopComponents.js`, `tests/shop-commands.test.mjs`.

Instructions: move resale pricing/eligibility into `model/shop`; extract buy-card/relic/flask/remove/sell command handlers; keep current tuning and stock roll order. Replace captured array indexes as action identity with a stable reference validated against current stock/possession. Avoid inventing new persisted IDs unless necessary and separately migrated. Keep saved stock authoritative after load. Render sections from configured ordered rows and shared components; local expanded section belongs to presenter state. Domain command returns receipt; presenter triggers existing audio and refresh; session coordinates one persist.

Acceptance: every current operation, affordability at commit time, capacity, last-card restriction, starter exclusions, disabled sell setting, double activation, changed stock, and reopen/refresh behavior. Compare currency/inventory/stock/receipts before and after to baseline fixtures. No direct domain writes remain in Shop presenter.

### Task 09 — Rest, reward, and event commands

Prerequisite: 08. Suggested branch: `codex/rest-reward-event-commands` (split into three serial tasks if necessary).

Existing anchors: `src/ui/screens/rest.js:90`, heal writes `:300`; `src/ui/screens/reward.js:65`; `src/ui/screens/event.js:18`; `src/model/rewardplan.js:96` and `:121`; `src/model/quests.js:57`; `src/engine/actions.js:773`; `src/engine/encounters.js:309`/`:320`; `src/main.js:1772`/`:1785` pending rewards and `:1823`/`:1884` screen coordination.

NEW `src/engine/commands/restCommands.js`, `rewardCommands.js`, `eventCommands.js`; corresponding `RestViewModel.js`, `RewardViewModel.js`, `EventViewModel.js` and component modules; `tests/encounter-commands.test.mjs`.

Instructions: reuse existing heal/refill/reward/effect planners. Move mutations and effect execution behind commands. Preserve reward ordering, automatic versus optional claims, saved pending rewards, one-use/multi-use rest, event history, and combat transition signaling. Resolve labels and section composition through normalized definitions. Required event decisions are page surfaces, not dismissible modals with a hidden close button.

Acceptance: no duplicate reward on reload, free and costly event choices, unavailable choices, event-to-combat path, cancel where currently legal, inventory capacity, refill/heal caps, auto reward RNG calls exactly preserved. Mandatory screens always retain a legal continuation under their specified conditions.

### Task 09A — Town and voiced quest interaction specification and implementation

Owner-requested extension: see FRONTEND-WIREFRAMES.md section 9 for Main Menu, Character Creation, slot flows, Map, Town, and Quest Conversation. This adds new interaction capabilities beyond a behavior-preserving refactor. Execute after Task 09 and before Task 10; use one dedicated spec PR first, then serial implementation issues/branches for town and dialogue. Do not implement an unreviewed new town node mechanic or quest/audio progression rule through a UI extraction.

Spec deliverables: approved town-to-existing-node mapping; NPC/service availability; dialogue graph and typed normalized relations; exact Continue/Skip speech/Back semantics; audio/manual fallback; choice boundaries; caption rules; save compatibility; speech asset requirements. Follow the proposed defaults in the wireframe document unless the reviewed specification changes them. No production voice generation or database deployment is implicit.

Existing anchors: `src/model/quests.js:57` recordEventChoice; `src/content/events.js` quest chain/history definitions; `src/ui/screens/event.js:18`; `src/engine/actions.js:773`; `src/ui/audio.js` music/SFX coordination; `src/main.js:1444` enterNode and `:1884` showEvent. Existing save/menu/creation consumers: `src/ui/components/saveSlotSelector.js:24` slotFacts, `:33` slotOption, `:67` slotDoor; `src/ui/screens/title.js`; `src/ui/screens/profileArchive.js:89`; `src/main.js:933` confirmSlotLoad; `src/ui/screens/customize.js:63`.

NEW `src/model/dialogue.js`, `src/model/town.js`, `src/ui/viewModels/DialogueViewModel.js`, `TownViewModel.js`, `src/ui/screens/dialogue.js`, `town.js`, `src/ui/components/dialogueComponents.js`, `townComponents.js`, `src/ui/services/SpeechPlayback.js`, `tests/dialogue.test.mjs`, and `tests/town-interaction.test.mjs`. Add normalized tables defined in wireframe section 9 through the existing content compiler, validator, and registry. Use existing quest/effect commands; do not duplicate quest rewards in the dialogue controller.

Procedure: validate graph and references → implement pure current-beat/available-choice projection → implement portrait/dialogue layout → implement cancellable speech adapter → bind presentation controller → route existing quest commands → integrate town service entry/return → test. Player portrait left, NPC right, dialogue replacing the card region. Voice completion may advance linear prose but never select responses or commit consequences. Continue and Skip invalidate pending audio callbacks; Back reviews without replaying effects. Missing/muted/blocked audio remains playable with captions and manual continuation. Register speaker, timing, layout, captions, services, and content as validated data; keep playback/navigation algorithms in code.

Acceptance: all expanded flow checks in the wireframe document, deterministic quest-history parity, no effects on Back/Skip, audio completion/skip race protection, missing asset/manual mode, locale fallback, town availability and return selection, accessible short caption beats at wide/compact/large-text sizes. Main menu/save/creation layouts are applied in Tasks 10/11/15 using the same section 9 targets, not a second implementation. Mark missing voice content explicitly; do not claim recorded speech validated when only fixtures exist.

### Task 10 — Settings and menu configuration

Prerequisite: 09A. Suggested branch: `codex/settings-models`.

Existing anchors: `src/ui/screens/settings.js:80` ROWS, `:454` SECTIONS, `:472` CATEGORY_ORDER, `:546` valueOf, `:611` settingOn, `:617` row HTML, `:1200` renderSettings, `:1525` openSettings; `src/ui/components/overlay.js:113`; `src/ui/models/MenuModels.js`; `src/ui/components/menuComponents.js`; `src/main.js:1086` settings persistence.

NEW `src/model/settings.js`, `src/ui/viewModels/SettingsViewModel.js`, `src/ui/components/settingsComponents.js`; normalized `settingDefinitions`, `settingCategories`, `settingOptions`, and category-membership/order rows as approved in the family schema. Option ordinals and typed values are explicit; avoid loose string value bags.

Instructions: extract pure settings readers from the screen module so Shop/domain callers stop importing UI settings. Move row metadata/defaults/limits/labels/category order to canonical rows, sharing existing balance facts by reference instead of copying them. Browser fullscreen/audio capabilities remain registered adapter functions. Wire title and in-run settings to the same projection/rendering path. Preserve current immediate persistence/apply semantics per control; do not impose a new apply/cancel mechanism without spec approval.

Acceptance: both entry paths, all control kinds, stored category selection, keyboard/controller rebinding, fullscreen failure, defaults, legacy settings hydration, size/accessibility limits, and immediate-save behavior. Control code contains no duplicate authored label/range list.

### Task 11 — Armoury and character creation

Prerequisite: 10. Suggested branches, executed serially: `codex/armoury-models`, then `codex/creation-models`.

Existing anchors: `src/ui/screens/equipment.js:337` buildArmoury, `:621` mountEquipment; `src/ui/models/ArmouryModels.js`; `src/ui/components/armouryComponents.js`; `src/model/armouryLayout.js`; `src/model/equipmentUi.js`; `src/model/inventoryPresentation.js`; `src/model/loadout.js`; `content/source/armouryUi.json:1`; `src/ui/screens/customize.js:63`; `src/model/characterCreation.js`, `creationBrief.js`, `attributes.js`; `src/ui/components/statAllocationCard.js`; `content/source/characterCreation.json`.

NEW `src/ui/viewModels/ArmouryViewModel.js`, `CharacterCreationViewModel.js`, `src/engine/commands/equipmentCommands.js`, and `characterCreationCommands.js`.

Instructions: retain existing normalized inventory/loadout query helpers. Extract one pane at a time in order: inventory selection/detail → equipment slots/receipts → cards → stats → character pane. Wrap equip/unequip/swap/stat allocation in commands without changing rules. Normalize repeated Armoury/config relationships into child rows; compile the existing nested configuration as a compatibility projection until consumers migrate. Preserve saved `grid/rack/hybrid` IDs, tray sizes, selection references, and drag/resize behavior. Then migrate character creation using the same stat-allocation projection/component. Existing uncommitted creation/stat changes from planning must be reconciled through current `dev`, not overwritten.

Acceptance: all Armoury views/panes, slot handedness, capacity, requirements, grants, stat previews, cancellation, resizing/folding, keyboard/controller, and character starting loadout exactly preserved. Split `loadout.js` only along proven responsibilities/callers; file size alone is not permission to relocate unrelated formulas.

### Task 12 — Application coordination and persistence boundary

Prerequisite: 11. Suggested branch: `codex/application-coordination`.

Existing anchors in `src/main.js`: `:148` storage, `:421` layout, `:579` display settings, `:712` persist, `:754` newRun, `:904` resumeRun, `:1033` title, `:1214` overlay, `:1419` map, `:1444` enterNode, `:1546` combat, `:1772` reward, `:1869` shop. Also `src/engine/save.js:198` save manager and `src/model/state.js:829` serialization, `:906` migration.

NEW `src/app/RunSession.js`, `src/app/NavigationController.js`, `src/app/PersistenceCoordinator.js`, `src/ui/services/DisplaySettings.js`, `src/engine/commands/CommandRegistry.js`.

Instructions: extract existing functions with explicit dependencies; avoid replacing closures with a global service locator. `RunSession` owns active run/RNG references and command serialization. Navigation owns active presenter disposal. Persistence owns save timing/failure reporting, using existing save manager. Display settings stay in browser UI service. `main` instantiates and wires. Keep screenshot/in-memory storage isolation and startup/restore paths. Do not unify profile saves and run saves into a transaction the storage layer cannot provide.

Acceptance: new run/load/resume/quit/reward continuation, failed storage writes, in-memory shot mode, one persist per committed action where intended, and existing save fixtures all work. No new save version is required merely to move functions.

### Task 13 — Combat, map, and co-op presentation

Prerequisite: 12. Suggested branches, serial: `codex/combat-presentation`, `codex/map-presentation`, `codex/coop-presentation`.

Existing anchors: `src/ui/screens/combat.js:63`; `src/ui/screens/map.js`; `src/ui/screens/coop.js:74`; `src/ui/viewModels/RunHudViewModel.js:11`; `src/ui/components/mapboard.js`, `battlefieldStage.js`, `hand.js`, `card.js`; `src/engine/combat.js`, `coopCombat.js`, `combatSnapshot.js`; `src/net/lan.js:40`; server-side `tools/lan.mjs` consumers must be inventoried before co-op edits.

NEW `CombatViewModel.js`, `MapViewModel.js`, `CoopViewModel.js` under `src/ui/viewModels/`, and feature command adapters only where existing engine APIs do not already supply the boundary.

Instructions: first extract display projections, then UI lifecycle, then duplicated shared bodies. Preserve engine command execution order, previews, animation sequencing, seeded stream counters, and server authority. Co-op receives server snapshots and sends existing protocol intents; never execute a local authoritative purchase/combat mutation because single-player uses a local command registry. Use adapters for local and remote commands with explicit acknowledgments. No network protocol redesign in a presentation extraction.

Combat footer requirement (owner update): follow the revised Combat and map composition in FRONTEND-WIREFRAMES.md. Order: Actions circle → Draw pile button → End Turn → combined Discard/Exhaust pile button → Potions circle. Keep all five controls in one tightly packed centered group with minimal inter-button gaps in both wide and compact layouts. Actions and Potions sit at the ends of the group, not distant screen corners; this supersedes earlier corner anchoring. Scale as needed without enlarging gaps or shrinking input targets below their configured floor. Actions, End Turn, and Potions are the largest and raised; pile buttons are smaller supporting controls. Pair circle sizes and pile-button sizes so End Turn remains centered. Use one shared minimal gap token, no space-between or stretch spacers. Preserve uniform vertical section gaps. Empty action/potion/pile indicators fade; End Turn does not. The combined pile indicator is empty only when both piles are empty. Draw opens the draw pile; it does not introduce a new gameplay action. Discard/Exhaust opens a W1 categorized pile viewer. Project the green End Turn state from `canEndTurn AND actionsRemaining == 0`; do not change existing legality or disable early end-turn merely to implement the highlight. Derive values from domain state and keep spacing, sizing, elevation, and state styling in shared configuration/tokens. This footer is combat-specific; do not add it to the map.

Acceptance: committed combat save/restore, card/target selection, end turn, death/victory, map selection, tooltip/pile modal ownership, HUD parity, local-vs-server authoritative behavior, disconnect/reconnect where supported, and deterministic replay fixtures. If co-op environment unavailable, mark it unverified and leave that migration incomplete.

### Task 14 — Finish normalized authoring across all content families

Prerequisite: 13; family schema work may be prepared earlier but must not race feature edits. One serial issue/branch/draft PR per row below. Each uses Task 02 adapters and requires a reviewed field map before conversion.

| Order | Existing source family | Exact transformation responsibility |
|---|---|---|
| A | `src/content/classes.js`, `attributes.js`, `derivedStats.js`, generated `startingKits`, `characterCreation`, `outfits`, `unlocks` | Scalar definitions plus ordered/member/requirement relations; formula IDs/typed operands; preserve current defaults |
| B | `src/content/equipment.js`, generated `weapons`, `equipMods`, `equipSlots`, `equipTargets`, `equipmentGrants`, `equipmentRequirements`, `itemUpgradeChanges`, `basicCardProfiles`, `cardEquipmentExceptions` | Definition/requirement/grant/tier/effect relationships; preserve scoped identities and instance mappings |
| C | `src/content/cards/*.js`, `statuses.js`, `stances.js`, `keywords.js`, `scripts.js` | Definition + ordered effect/trigger/predicate/formula relations using existing opcode vocabulary; scripts remain registered code implementations until expressed by supported primitives |
| D | `src/content/enemies/*.js`, `encounters/*.js`, `events.js`, `mapconfig.js` | Encounter membership, weights, ordered actions/choices, conditions and rewards; explicit order for RNG parity |
| E | `src/content/relics.js`, `flasks.js`, `keepsakes.js`, `resources.js`, `customMods.js`, `balance.js` | Typed configuration domains, pool memberships, modifier relationships; shared values referenced, not copied |
| F | `src/content/music.js`, `sfx.js`, `poseSprites.js`, `classArtAnchors.js`, `src/ui/assetmap.js`, `assets.js`, `uiContent.js` | Asset metadata/associations, audio recipes, timings and presentation labels as validated data; playback/animation algorithms remain code |
| G | `src/content/aiDisclosure.js`, `retiredNames.js`, changelog inputs, residual UI labels/layout constants | Normalize actual repeated facts and approved tunables; preserve generated changelog pipeline and attribution text; classify historical build output as derived |

For every family:

1. List every exported definition and field from the source-map/current file. Identify arrays, implicit filename identities, string-encoded relationships, and functions embedded in definition objects.
2. Complete `oldPath.field → relation.column/key → runtime projection → consumers` in AUTHORITY-MAP. Document dependencies/candidate keys and exact ordering.
3. Separate authored values from algorithms. An executable behavior becomes a registered primitive reference; never serialize source code into JSON.
4. Write normalized rows preserving IDs, numeric types, effects, and pool order. Add schema/constraints and generate runtime projections.
5. Replace old content module with a compatibility export of generated projection; remove hand-authored duplicated data in the same commit.
6. Compare old/new materialized records and deterministic seeded outcomes before removal. Include negative schema tests and a positive extension authored only in data.
7. Search all consumers; update content compiler, bundle, validation, documentation, and tests together.

No blanket regex rewrite of content. No universal EAV table. Do not rewrite the proven effect engine just to relocate its data. Task 14 is complete only when every inventoried authored fact has a normalized owner or a documented derived/algorithm classification; an unchecked family is remaining work.

### Task 15 — Remaining surfaces, removal, and owner editing guide

Prerequisite: all earlier tasks. Suggested branch: `codex/architecture-completion`; split remaining screen migrations into serial PRs as needed.

Remaining screens from baseline include title, lobby, draft, customRun, compendium, history, gameover, profileArchive, profileNotice, about, and controls. Remaining components include save-slot selector, startup gate, quick navigation, inspectors, piles, tutorials, and debug surfaces. Use the exhaustive MIGRATION-MAP and source-map to ensure none is silently excluded. Existing well-separated components need validation, not gratuitous rewriting.

Instructions: project remaining screens using shared primitives/policies; move remaining configurable labels/layout/rules to authoritative data; remove obsolete adapters only after zero consumers including tools/tests. Update `src/framework/index.js` documentation and retire duplicate candidate modules only when their status and consumers prove removal appropriate. Do not restore removed governance/scheduling infrastructure.

NEW `docs/CONTENT-EDITING.md`, `docs/UI-EDITING.md`, and a small `tools/component-showcase.html` development artifact driven by real fixture view models. Explain adding a service, item, tag, effect composition, setting, modal variation, and updating a shared token. Show exact authoring file, build command, validator, preview, and rollback through version control.

Add a focused architecture test covering dependency direction, foundational cycles, unregistered handlers, and migrated presentation imports. Use semantic checks and tests for mutation contracts; do not build a giant source-text governance checker or claim regex can prove purity. Wire new suites into CI using existing verdict conventions with nonzero counted checks.

Acceptance: all inventory rows complete; one modal lifecycle; one tag authority; no duplicate authored values in legacy modules; no domain writes in migrated presenters/renderers; all existing save/RNG/offline contracts pass; docs match actual imports; owner can perform the data-only extension tests below.

## 8. Verification and completion gates

Use these existing commands as applicable; re-read current CI because the workflow may change:

```text
node tests/run-node.mjs
node tools/content-build.mjs --check
node tools/content-build.mjs --selftest
node tools/launch.mjs --build-only
node tools/verify-shipped.mjs
node tools/buildversion.mjs --check
```

CI wraps checkers with `node tools/verdict.mjs -- ...`; preserve its counted-result/exit conventions. `tests/run-node.mjs` already has additional suite wiring beyond its first import; read its aggregation before adding new suites. New `.test.mjs` files need explicit integration: merely creating them does not make CI execute them. Avoid double-counting suites or discarding their failures. Proposed tests are new work, not existing commands promised to work today.

Existing focused tools include modal shell contract, modal keyboard check, confirmation tests, Smith UI checks, and screen-specific checks discovered by caller search. Inspect their command interface before use. Update tools coupled to old selectors only with equivalent or stronger behavioral evidence. Build checks do not replace actual interaction tests.

Required new behavior tests:

| Area | Positive case | Negative/regression case |
|---|---|---|
| Normalization | Equivalent adapters compile identically | Duplicate candidate key, dangling FK, missing scope, pipe-separated relation rejected |
| Tags | Required/excluded membership resolves | Unknown tag, wrong domain, contradictory membership rejected |
| Configuration | Add second supported service using data | Unregistered provider/layout/action rejected |
| Transactions | Expected receipt and exact state delta | Stale target, insufficient funds, duplicate input, partial failure do not corrupt state |
| Modal lifecycle | Shared keyboard/controller ownership | Nested Escape, drag-out, detached opener, disabled focus, click-through |
| Persistence | Old saves restore and continue | Unsupported content version/invalid reference handled explicitly; failed save not retried as transaction |
| Determinism | Same seed/actions produce same outcomes | Pool ordering/RNG calls differ → migration fails |
| Responsive UI | Desktop, phone, large text work | No clipped actions, inaccessible continuation, or unreachable focus |

Schema version is not content identity. Record a content fingerprint for reproducibility tooling; do not silently invalidate older saves because a hash differs. If replay needs historical content, specify retention/resolution of that content separately. Preserve the current save behavior until a reviewed compatibility change is implemented.

Final owner-facing demonstrations:

1. Change one shared modal size token; every surface using it changes, and no feature renderer is edited.
2. Add a service variant using registered providers/commands/layouts entirely through normalized data.
3. Add a tag association; all supported eligibility/filter views update consistently.
4. Change one price rule; preview and commit agree everywhere.
5. Export the same definitions from a database snapshot; the offline build matches canonical file-source output.
6. Load baseline saves and reproduce baseline seeded outcomes.

## 9. Pasteable executor prompt

> Implement only Task NN from EXECUTION-PLAN.md in the AshenSpire repository. Read AGENTS.md and prerequisite task results first. Refresh file anchors against the current checkout using source-map.json as a historical index. Do not overwrite existing work. Create one branch off reviewed dev; do not merge or publish without the authorization required by repository rules. Preserve existing game mechanics, saved IDs, deterministic ordering, offline build, input behavior, and generated-file ownership. Reuse the existing tag service and domain planners. Follow the task's file list, pseudocode, compatibility steps, and acceptance tests. First produce the task's field/caller mapping if required, then implement it. Do not invent missing business semantics, add a second authoritative data path, or migrate unrelated features. Run baseline and post-change checks, report pre-existing failures separately, and document exact results. Update the migration map and provide a draft PR description stating what changed, why, and how it was verified. If a prerequisite is missing or an unreviewed mechanics change is required, name the exact blocker and stop the dependent part rather than guessing.

> FRONTEND REQUIREMENT: Read FRONTEND-WIREFRAMES.md as well. Implement its applicable wireframe, data-driven presentation schema, and responsive state matrix. Minimize px; preserve the existing distinction between text scale, UI scale, and physical input-target size. Use one meaningful title, optional necessary context, and concise action-oriented copy. Do not stack decorative eyebrows/subtitles/captions or remove necessary game information. The handoff covers architecture, 3NF schemas, and frontend redesign together.

## 10. Required handoff at the end of each task

```text
Task and issue:
Branch and base commit:
Files/symbols changed:
Authoritative definitions added/moved:
Compatibility adapters retained and their remaining callers:
Behavior preserved or explicitly approved change:
Tests run, counts/results, and unavailable checks:
Generated outputs rebuilt:
Known remaining work:
Draft PR description:
Next task whose prerequisites are satisfied:
```

This work is finished by migrated behavior and verified ownership, not by creating the proposed folders. Do not mark the overall refactor complete while migration-map rows, content-family mappings, compatibility removals, or required interaction checks remain unfinished.




