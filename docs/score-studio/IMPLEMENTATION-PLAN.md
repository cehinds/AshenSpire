# Score Studio prioritized implementation plan

The [editor specification](../EDITOR-SPEC.md) controls requirements, priorities
and persistent-workbench behavior. This plan provides supporting package,
dependency and test detail within that contract.

Planning reference, 26 November 2026. Eight milestones, 33 work packages, 27 planned actual-game acceptance tests and complete mapping of the requested checklist. [Start here](README.md) · [First story](stories/SS-001-persistent-workspace.md) · [Checklist](FEATURE-CHECKLIST.md) · [Use cases](USE-CASES.md).

## Outcome and priority

Configure → Author → Validate and review → Load the exact local revision → Play → Inspect and compare → Save or restore.

P0 completes the dependable card-to-game loop. P1 makes repeated balancing, supported mechanics, deeper card testing and native visual reuse effective. P2 expands specialist tools and broader game systems. Follow explicit package dependencies; independent work can proceed after shared contracts. No calendar estimate or permission to publish is implied.

## Milestones

| ID | Priority | Delivery | Packages | Exit gate |
| --- | --- | --- | --- | --- |
| M0 | P0 | Establish the running project and shared contracts | W01, W02, W03 | Identify the actual served checkout, runtime and canonical data owners; preserve the current draft; validate a versioned change set without changing normal player state. |
| M1 | P0 | Complete one card to starter to actual game workflow | W04, W05, W06, W07, W08, W09 | Create and edit a supported custom card through Studio, install it in a starter, launch a fresh actual local run, play it and inspect its results. Export/import and Undo preserve the authored data. |
| M2 | P1 | Make repeated balancing work efficient and predictable | W10, W11, W12, W13, W14, W15, W16 | Complete the three 15-card generation exercise with named recipes, sorting, selection, bulk changes and reversible cleanup; repeat after reload without rebuilding context. |
| M3 | P1 | Author supported mechanics and feature definitions | W17, W18, W19, W20 | Create a template bound to a supported engine effect, tune its scoring, archive/restore it and transfer it without losing IDs or references; actual-game behavior matches the declared binding. |
| M4 | P1 | Understand cards through controlled real-game experiments | W21, W22, W23 | Card and Encounter Labs, event inspection and saved regression fixtures use the actual local runtime; legal costs, multi-turn utility, reactions and status lifecycles can be reproduced. |
| M5 | P1 | Connect the existing visual and feedback tools | W24, W25, W28 | Native card layout, bounded production effects timing and supported HUD tokens can be edited, reviewed and seen in the actual local game without rebuilding separate editors. |
| M6 | P2 | Expand motion rules and sprite preparation | W26, W27, W29 | Validated animation matching, frame/anchor preparation and the first selected external format round-trip correctly; runtime mechanics remain independent of presentation speed. |
| M7 | P2 | Extend proven authoring to other game systems | W30, W31, W32, W33 | Each added reward, enemy, progression or map editor has a verified runtime consumer, explicit application timing and a complete configure to actual-game acceptance path. |

First delivery is M0 plus M1. Use the existing native preview, approved animation family and supported effects; do not wait for a new sprite editor or generic animation graph. SS-001 is the first bounded UI story. M2 precedes broad subsystem expansion; deeper mechanics, sandbox and bounded native-tool integration follow their actual package dependencies.

## Shared UI and data contracts

Use six tool groups inside one persistent parent: Content (`content`), Mechanics (`mechanics`), Decks (`decks`), Motion (`motion`), Assets (`assets`) and Playtest (`playtest`). These are contextual pane/layout changes, not six pages or independent drafts. Keep project/profile above them and preserve the active entity, document/history, revision, scenario, baseline and breadcrumbs without reconstructing a page. Use a library, central native preview/game, contextual inspector and optional timeline. Maximize Playtest and distinguish Inspect from Play input modes. SS-001 initially connects existing surfaces rather than inventing empty replacement pages.

Selection uses click/Ctrl/Shift/Ctrl+Shift/Ctrl+A/Escape with stable IDs and range anchors in current displayed order. Count hidden selections. Drag/drop previews targets, quantities and Copy/Move, has keyboard/menu equivalents and one Undo. Right-click a selected record preserves its group. Edit definition, edit deck entry, duplicate variant, remove membership and trash definition are distinct commands.

Use one live draft and a shared command registry across toolbar/context/keyboard/touch. Global scoring and shared-template controls must be labelled differently from selected-card controls. Routine fields remain near their preview; advanced sections collapse with summaries; primary actions stay reachable. Avoid required nested modals, redundant instructions, hidden essential hover actions and unexplained disabled controls.

Last used, named preset, project default and factory baseline are different states. Card/item and per-section settings are independent. Cancel follows a declared consistent policy; view state is not destructive operation scope. State indicators distinguish Draft, Applied, Saved, Loaded and Tested revisions.

Author stable IDs and canonical sources; generated outputs are not independent authorities. A minimal versioned manifest grows to cover profile/modules, definitions, scoring/runtime bindings, starters/decks, assets/layouts/motion, presets and scenarios. Validate full/section imports and conflicts before atomic commit. Pure export never silently saves source. Portable handoff uses IDs and relative references, with provenance.

Field lifetime is specific: run profiles/fight snapshots, supported live framework tuning and device/presentation settings have different contracts. See [Manual editing](../MANUAL-EDITING.md#which-changes-reach-an-existing-run). Show effective values and application timing; do not assume every edit requires a new run or silently alter a historical fight.

Mechanics execute in supported engine bindings; weights evaluate them; animation cues present them. Unsupported behavior needs separately engineered capability. Changing sprite FPS, clip length, sound completion or presentation speed must not alter damage/payment/status/RNG decisions.

Interaction budgets below are proposed targets. Record actual pointer/keyboard/touch activations, field focus/entry, dropdown choices, gestures, native file-picker actions, gameplay inputs, menu openings, distinct interfaces, workspace switches, maximum modal depth, scroll travel, waits, errors and displaced actions. Never substitute a target for a measurement.

## Work packages


### M0 Establish the running project and shared contracts


#### W01 Resolve the running project and effective configuration

I want to know which project, rules and assets I am changing.

**Depends on:** None.

**UI and UX:** Persistent project/profile and build/content/art revision indicator; show authored, resolved and loaded values plus field-specific application timing.

**Implementation boundary:** Resolve the server working directory and exact runtime; inventory canonical owners, supported schemas, compiler paths, overrides and archived tools. Record a baseline and isolate test storage.

**Reuse:** R07, R08. **Acceptance:** AT01.

**Proposed interaction target:** One persistent project context; no repeated project picker for related edits.

**Research cases:** 46, 63. **Status:** planned.

#### W02 Introduce a versioned project and atomic change set

I want to import and review a configuration without silently overwriting unrelated content.

**Depends on:** W01.

**UI and UX:** One review surface for scope, conflicts, dependencies and Merge/Replace section/Duplicate choices; validation errors retain the draft.

**Implementation boundary:** Start with the minimal manifest for cards, weights, starters and test fixtures. Add schema/provider versions, stable references, source-revision guards and atomic commit/rollback. Expand the same manifest in later milestones.

**Reuse:** R07. **Acceptance:** AT01, AT14, AT23.

**Proposed interaction target:** Conflict-free import: at most 3 Studio activations plus native file-picker actions; one review dialog.

**Research cases:** 34, 46. **Status:** planned.

#### W03 Create connected workspace and interaction foundations

I want related tools to share my selected entity and working context.

**Depends on:** W01, W02.

**UI and UX:** Six contextual tool groups within one persistent parent, with shared library/preview/inspector, document/history, optional timeline, breadcrumbs, keyboard/focus/touch paths and Draft/Applied/Saved/Loaded status. Do not reconstruct pages on group changes. Use concise labels, scope-aware tooltips and visible Cancel/Undo.

**Implementation boundary:** Introduce shared view and operation-state models, not a wholesale restyle. Instrument task activations, menus, panel switches, scroll travel, waiting and cancellation. Capture current screenshots before changing visible flows.

**Reuse:** R01, R02, R03. **Acceptance:** AT27.

**Proposed interaction target:** One contextual inspector for a routine edit; no stacked required modals; no hidden essential hover-only action.

**Research cases:** 32, 45. **Status:** planned.

### M1 Complete one card to starter to actual game workflow


#### W04 Expose clear card identity, costs and supported effects

I want to change a card or compose a supported effect without raw-tag knowledge.

**Depends on:** W02, W03.

**UI and UX:** Separate Camp, School, Tradition and Stance; inline costs and effects; duplicate from template; native preview and generated rules text beside authored fields. Preserve independent dimensions.

**Implementation boundary:** Bind controls to the active profile schema and existing engine operations. Separate editable definitions from derived values. Reject unsupported bindings and invalid targets before Apply.

**Reuse:** R01, R04, R07. **Acceptance:** AT02, AT04.

**Proposed interaction target:** Tradition-only change: at most 4 pointer activations from a visible card, one workspace, no modal; typed values counted separately.

**Research cases:** 01, 02, 03, 04, 05, 06. **Status:** planned.

#### W05 Deliver a reliable card collection and exact selection

I want to find, sort and select the exact cards I intend to change.

**Depends on:** W03, W04.

**UI and UX:** Gallery/table toggle; CP/name/ID/type sorts and directions; searchable deck filter; click/Ctrl/Shift/Ctrl+Shift/Ctrl+A/Escape; selected and hidden-selected counts; row opens its inspector.

**Implementation boundary:** Key selection by stable IDs and define range anchors in current displayed order. Ctrl+A covers matching records, not rendered cells. Persist per-view sort/filter/order. Add other cost/rank/class sorts and grouping using the same model.

**Reuse:** R01. **Acceptance:** AT06, AT25, AT27.

**Proposed interaction target:** Change sort in one activation when exposed; deck filter in at most 3; no selection loss on sort; native keyboard alternative for every selection action.

**Research cases:** 11, 41, 44, 45. **Status:** planned.

#### W06 Build decks and install arbitrary valid starters

I want to add my card to a class starter and set copy counts.

**Depends on:** W02, W04, W05.

**UI and UX:** Two-pane library/deck builder, persistent starter entries, inline minus/quantity/plus, totals and restrictions; Add to starter beside selected card. Distinguish class eligibility, custom list and actual starter.

**Implementation boundary:** Resolve card instances and starter references together; validate class/rules/copy counts and show before/after composition. Support requested Starseer starter through isolated test unlock, with Reaver fallback for the custom QA card.

**Reuse:** R01, R07. **Acceptance:** AT03, AT04.

**Proposed interaction target:** Add to a starter: at most 7 pointer activations for the stated class/quantity/replacement example; repeated same-class addition at most 4; one contextual setup dialog maximum.

**Research cases:** 07, 44. **Status:** planned.

#### W07 Launch the actual local game with the candidate revision

I want to play the card I just authored in a fresh normal run.

**Depends on:** W01, W02, W04, W06.

**UI and UX:** Test this draft and Start normal run show class, starter, overrides and loaded revision; progress/error states identify validation/build/load stages. Return to editor preserves context.

**Implementation boundary:** Connect validated content to the actual game build/load pipeline; acknowledge effective runtime identity and starter. Pin a test snapshot; never substitute a parallel combat implementation. Keep visual reload and mechanical restart explicit.

**Reuse:** R04, R07, R08. **Acceptance:** AT01, AT03, AT04, AT24.

**Proposed interaction target:** At most 3 Studio activations from a valid reviewed candidate to launch; ordinary gameplay and build wait measured separately.

**Research cases:** 09, 53. **Status:** planned.

#### W08 Add isolated class testing and one saved scenario

I want to test a locked class and repeat a controlled encounter without altering progression.

**Depends on:** W07.

**UI and UX:** Explicit test profile, Practice versus labelled Training, class/deck/opponent/seed/resources summary and saved scenario picker. Start/Restart stay visible.

**Implementation boundary:** Implement one supported scenario through the real runtime, with coherent state and legal costs by default. Isolate unlock overrides and save slots; record all training exceptions. Preserve profile and field lifetime contracts.

**Reuse:** R07, R08. **Acceptance:** AT03, AT19.

**Proposed interaction target:** Saved scenario selection and Start in at most 2 activations; Restart in 1; normal profile remains separate.

**Research cases:** 08, 10, 53. **Status:** planned.

#### W09 Make edits recoverable and project handoff lossless

I want to undo a whole experiment or restore its exact configuration.

**Depends on:** W02, W04, W06, W07.

**UI and UX:** Undo/Redo named transactions, recoverable custom-definition Trash, clear export scopes and saved revision list. No implicit game write during pure export.

**Implementation boundary:** Restore definitions, quantities, memberships and references atomically. Persist drafts; guard stale/cancelled jobs and partial writes. Round-trip the minimal full project and section files; add later schemas without losing fields.

**Reuse:** R01, R07. **Acceptance:** AT05, AT14, AT22, AT23.

**Proposed interaction target:** Undo or Redo in 1 activation/shortcut; conflict-free export in at most 2 Studio activations; no workspace switch required.

**Research cases:** 33, 34, 48. **Status:** planned.

### M2 Make repeated balancing work efficient and predictable


#### W10 Support multi-card drag and drop

I want to drag a selection into a deck or remove it without losing definitions.

**Depends on:** W05, W06, W09.

**UI and UX:** Counted drag ghost; valid/invalid destination feedback; quantity preview; explicit Copy/Move; sidebar targets, hover-open, edge scroll, manual reorder and contextual remove/trash destinations.

**Implementation boundary:** Reuse shared selection/deck transactions. Selected-card drag carries selection; unselected-card drag targets only that card. Escape cancels. Reorder explicitly changes sort to Manual. Trash is recoverable; deck removal preserves library definitions.

**Reuse:** R01. **Acceptance:** AT05, AT06, AT23.

**Proposed interaction target:** One drag gesture after selection; gesture tracked separately from clicks. Equivalent menu path at most 3 activations.

**Research cases:** 42. **Status:** planned.

#### W11 Expose contextual menus and bounded bulk changes

I want the right actions for this card, deck, field or selection.

**Depends on:** W04, W05, W06, W09.

**UI and UX:** Sticky selection bar and right-click/overflow/keyboard/touch menus; count-aware verbs; Mixed values; Set/Delta/percentage where supported; feature add/remove separate from replace-all. Hover and focus shortcuts for secondary actions.

**Implementation boundary:** One command registry across toolbar/menu/shortcut paths. Preserve multiselection on selected-card right-click. Preview exact IDs and exclusions; apply only touched fields as one transaction.

**Reuse:** R01. **Acceptance:** AT02, AT05, AT06, AT27.

**Proposed interaction target:** Context menu opens in 1 activation; routine available action requires at most 1 submenu; simple bulk field edit at most 7 activations plus entry.

**Research cases:** 12, 43. **Status:** planned.

#### W12 Persist independent tool and section presets

I want to save defaults and return to tweak my last settings.

**Depends on:** W02, W03, W09.

**UI and UX:** Last used, Project default, named presets and factory baseline are distinct. Save as/Load/Set default/Reset default; section presets and dirty indicators; predictable Cancel semantics.

**Implementation boundary:** Version per-tool and per-section settings independently for card/item generation, rebalance and naming. Persist compatible values across reopen/reload/restart; migrate older presets. Keep view context separate from operation scope.

**Reuse:** R01, R07. **Acceptance:** AT07, AT14, AT23.

**Proposed interaction target:** Recall a preset in at most 2 activations; repeated tweak does not reopen unrelated menus or lose scope.

**Research cases:** 19, 45. **Status:** planned.

#### W13 Unify generation and retain honest results

I want three reproducible 15-card configurations directly in named decks.

**Depends on:** W04, W06, W09, W12.

**UI and UX:** Simple/Distribution modes share destination, seed and preset controls. Show effective total, quotas, scoring profile, batch results, misses and Select/Keep/Reroll failed/Compare actions. Sticky footer and collapsible groups.

**Implementation boundary:** Wrap existing pool and batch generators without silently changing their different rules. Keep recipe, weight revision, seed and output provenance. No silent exactness guarantee on misses; repeat-seed IDs must not overwrite unrelated records.

**Reuse:** R01. **Acceptance:** AT08, AT14, AT25.

**Proposed interaction target:** Generate from a saved valid recipe into an existing deck in at most 4 activations; output batch selected automatically; native field edits counted separately.

**Research cases:** 17, 18. **Status:** planned.

#### W14 Make rebalancing scoped, repeatable and explainable

I want to rebalance only these cards using remembered constraints.

**Depends on:** W04, W05, W09, W12.

**UI and UX:** Explicit current/selection/filtered/deck/pool scope, affected count, lock-preserved fields, original/candidate comparison and Preview/Apply. Recipe transfer separate from output transfer.

**Implementation boundary:** Keep current failure guard; stage candidate results and apply accepted IDs only. Preserve last valid constraints and advanced quotas per policy. Detect stale scope/results before commit and prevent silent all-card expansion.

**Reuse:** R01. **Acceptance:** AT07, AT09, AT23.

**Proposed interaction target:** Existing selected scope: Preview and Apply in 2 activations after opening; another tweak requires no repeated scope reconstruction.

**Research cases:** 13. **Status:** planned.

#### W15 Expose naming rules with real previews

I want readable generated names and reusable naming conventions.

**Depends on:** W04, W09, W12.

**UI and UX:** Naming rules reachable from Auto-name/rename/generation; maximum length, priority, sample names, dropped components, collisions and impossible constraints. Distinguish rename once and keep updated.

**Implementation boundary:** Use stable identity independently of names. Preserve manual names unless included; keep previous name set and atomic Undo. Validate mandatory components that cannot fit rather than silently breaking the limit.

**Reuse:** R01. **Acceptance:** AT07, AT10, AT23.

**Proposed interaction target:** Naming rules open from a relevant tool in 1 activation; simple rule edit and Apply in at most 3 more activations plus entry.

**Research cases:** 15, 16. **Status:** planned.

#### W16 Compare and recall design variants

I want to compare two batches or decks under the same test conditions.

**Depends on:** W07, W08, W09, W12, W13, W14.

**UI and UX:** Named baseline/candidate, structural and effective-value differences, matched scenario and explicit changed recipe fields. Sequential trials are sufficient initially; avoid a second runtime implementation.

**Implementation boundary:** Save immutable comparison inputs and actual revision identities. Replay controlled sequences with recorded seeds and training overrides. Explain legitimate RNG/event differences caused by changed mechanics.

**Reuse:** R07, R08. **Acceptance:** AT08, AT20.

**Proposed interaction target:** Run a saved comparison in at most 3 activations; retain scenario, pair and observations.

**Research cases:** 18, 20. **Status:** planned.

### M3 Author supported mechanics and feature definitions


#### W17 Create a feature catalogue with reversible retirement

I want obsolete features hidden from active authoring and restorable later.

**Depends on:** W02, W04, W09, W12.

**UI and UX:** Search Active/Archived, add from catalogue, duplicate template, rename label, Find usages, archive and restore. Show dependent cards/rules/presets. Separate archive, disable scoring and retire gameplay.

**Implementation boundary:** Stable IDs and compatibility-preserving references; archiving authoring availability alone does not erase an effect from existing cards or disable its score. Provide reviewed migration for actual retirement.

**Reuse:** R01, R07. **Acceptance:** AT11, AT14.

**Proposed interaction target:** Archive with reviewed impact in at most 4 activations; restore selected definition in 1; one impact dialog maximum.

**Research cases:** 35, 36, 37. **Status:** planned.

#### W18 Author typed scoring templates

I want flat, additive, per-unit or multiplicative weights with clear limits.

**Depends on:** W17.

**UI and UX:** Template selector, units, parameters, stacking/order/caps and supported conditions; worked score examples beside the active card. Explicitly distinguish scoring from gameplay behavior.

**Implementation boundary:** Use a constrained expression/template schema with validation; no arbitrary code/method text. Preserve evaluation contracts and version formulas. Test zero, negative, fractional and capped inputs where allowed.

**Reuse:** R01, R07. **Acceptance:** AT12.

**Proposed interaction target:** Selected template parameter tweak and preview in at most 3 activations plus entry; no mandatory navigation to another tool.

**Research cases:** 14, 38. **Status:** planned.

#### W19 Compose mechanics using supported runtime bindings

I want to design a mechanic and see its actual effect in the game.

**Depends on:** W04, W07, W08, W17, W18.

**UI and UX:** Trigger to Conditions to Targets to Effects to Duration/Stacking; supported bindings palette, costs/scaling/restrictions, ordered execution and generated text. Engine support required for unavailable behavior.

**Implementation boundary:** Bind to the active runtime capability contract, not inferred method names. Validate targets, ranges, exclusions and recursive trigger paths. New engine operations are separately scoped engineering changes with headless contracts before exposure.

**Reuse:** R04, R07. **Acceptance:** AT04, AT12, AT13.

**Proposed interaction target:** Template parameter edit, Test and Apply in at most 5 coordination activations plus gameplay; basic effects remain accessible in card inspector.

**Research cases:** 39, 50. **Status:** planned.

#### W20 Transfer and migrate feature registries safely

I want to import definitions without breaking cards or losing retired traits.

**Depends on:** W02, W09, W17, W18, W19.

**UI and UX:** Versioned import/export, conflicts, stable-ID references, missing bindings and reversible migration preview. Rename is not delete-and-recreate.

**Implementation boundary:** Extend the project schema with definitions, scoring and runtime bindings as separate sections. Validate entire dependency graph before atomic commit; preserve archived records for compatible old content.

**Reuse:** R07. **Acceptance:** AT11, AT14, AT23.

**Proposed interaction target:** Conflict-free known registry import in at most 5 Studio activations plus file picker; one review surface.

**Research cases:** 40. **Status:** planned.

### M4 Understand cards through controlled real-game experiments


#### W21 Build Card and Encounter Labs around real decisions

I want to feel a card under controlled resources, enemies and deck states.

**Depends on:** W07, W08, W12, W16.

**UI and UX:** Saved scenario library; exact player/gear/stats, hand/piles, enemy state/intents and seed. Legal Practice default; visible Training exceptions. Maximize actual game and keep targets unobscured.

**Implementation boundary:** Expand the one-scenario bridge to the twelve fixture families in this plan using the actual engine. Validate coherent state; isolate progression. Add checkpoint/replay only where engine support exists.

**Reuse:** R04, R07, R08. **Acceptance:** AT19, AT20.

**Proposed interaction target:** Saved scenario select and Start in 2 activations, Restart in 1; advanced setup stays in one focused workspace.

**Research cases:** 10, 51, 52, 54. **Status:** planned.

#### W22 Explain events and step action separately from presentation

I want to understand why a play succeeded and why a visual occurred.

**Depends on:** W07, W08, W21.

**UI and UX:** Optional event drawer with action/event IDs, costs, target/defense/status facts, cue rules and source links. Separate Step game action, Step presentation frame, Pause, speed and checkpoint replay.

**Implementation boundary:** Instrument actual runtime facts without recalculating historical events from edited current rules. Preserve deterministic checkpoints/RNG; do not promise arbitrary backward game-state scrubbing. Correlate mechanics and presentation channels.

**Reuse:** R03, R04, R08. **Acceptance:** AT04, AT17, AT19, AT20.

**Proposed interaction target:** Inspect the next event in 1 activation with drawer open; Pause/Step/Restart remain directly available.

**Research cases:** 55, 56. **Status:** planned.

#### W23 Save regression packs and measure usability and recovery

I want repeatable proof and responsive tools at realistic collection sizes.

**Depends on:** W03, W09, W16, W21, W22.

**UI and UX:** Run saved pack, progress, cancel, failures with replay links and compact receipt. Record measured task costs and show recoverable unfinished work after interruption.

**Implementation boundary:** Run UI-driven real-game fixtures plus focused engine/schema checks. Capture revisions, IDs, semantic receipts, screenshots and geometry evidence. Stress 1000-card and 10000-card fixtures; no per-card inspector loop for bulk operations.

**Reuse:** R07, R08. **Acceptance:** AT22, AT23, AT25, AT27.

**Proposed interaction target:** Saved pack select and Run in 2 activations; Cancel directly available; complete metrics for the ten reference tasks.

**Research cases:** 30, 48, 54. **Status:** planned.

### M5 Connect the existing visual and feedback tools


#### W24 Integrate native card appearance editing

I want to design a card face and see that same rendering in hand.

**Depends on:** W02, W03, W07, W09.

**UI and UX:** Layer/canvas selection, art crop, masks, typography, symbols, rank/cost/rules groups, snapping and anchors; explicit shared-template versus per-card scope. Hand/zoom/list/device samples and editable versus flattened export.

**Implementation boundary:** Adapt existing native layout/component tools and renderer. Separate pure export from source save; validate source revision and preserve mechanic/text-token bindings. Do not introduce a divergent card renderer.

**Reuse:** R01, R02. **Acceptance:** AT15, AT23.

**Proposed interaction target:** Selected component tweak and native preview in at most 4 activations plus entry; common controls beside preview, advanced full editor linked.

**Research cases:** 49, 63. **Status:** planned.

#### W25 Connect production effect timing and approved feedback

I want to tune impact, status, audio and card feedback without obscuring play.

**Depends on:** W07, W09, W22.

**UI and UX:** Compact timeline for approved clips, category timing/opacity, anchors and sample stress cases; real-card preview; clear loop/interruption/reset/reduced-motion controls. Distinguish sample receipts from combat facts.

**Implementation boundary:** Reuse production effect planner/renderer/timing validation. Start with bounded existing settings and approved assets; add only supported audio/camera bindings. Engine owns mechanics; presentation speed cannot change state or RNG.

**Reuse:** R03, R04. **Acceptance:** AT16, AT17, AT21.

**Proposed interaction target:** Retained event/timing tweak and replay in at most 3 activations plus entry; full timeline optional.

**Research cases:** 57, 63, 64. **Status:** planned.

#### W28 Expose supported game UI appearance and interaction previews

I want to tune card/game readability and check it while playing.

**Depends on:** W02, W03, W07, W09.

**UI and UX:** Permitted UI tokens, responsive views/states, readable tooltips and text backing; game preview of keyboard/touch/focus/targeting behaviour. Preserve the playfield and support reduced motion.

**Implementation boundary:** Reuse Component Studio layer/transform controls and validated HUD token merge/compiler bridge. Its design pages are specimens, not a ready game-navigation editor; new navigation/data bindings need explicit runtime support.

**Reuse:** R06, R07. **Acceptance:** AT21, AT27.

**Proposed interaction target:** Retained supported token change, preview and Apply in at most 4 activations plus entry; no manual file merge in routine use.

**Research cases:** 31, 64. **Status:** planned.

### M6 Expand motion rules and sprite preparation


#### W26 Author deterministic animation assignment rules

I want tags and events to select predictable animations with visible fallbacks.

**Depends on:** W17, W19, W22, W25.

**UI and UX:** Require-all/any/excluded tags, event phase, class/loadout/outcome, priority and fallback; Why this animation, matched examples, conflicts and dead-rule diagnostics. One actor action plus separate cue channels.

**Implementation boundary:** Version matching policy; verify active first-match resolver and class-default weapon policy before adapting it. No silent art-policy changes. Do not duplicate a primary cast because several traits match. Supported event selectors only.

**Reuse:** R03, R04. **Acceptance:** AT16, AT17.

**Proposed interaction target:** Selected rule tweak and preview in at most 5 activations; rule explanation in 1 contextual action.

**Research cases:** 58. **Status:** planned.

#### W27 Prepare sprites, anchors and coverage

I want to import frames, align them and see which actions are missing.

**Depends on:** W02, W09, W24, W25.

**UI and UX:** Import loose frames or a documented atlas subset; slice/trim/padding, duration/loop, onion skin, floor/hand/muzzle/hit anchors, world scale and class/action/gear matrix. Missing, unique and fallback states differ.

**Implementation boundary:** Wrap normalization/export/import helpers in fresh staging with explicit transformations. Preserve logical bounds, source art/provenance and stable asset IDs. Keep editable masters separate from pinned immutable runtime cache.

**Reuse:** R05, R06. **Acceptance:** AT18, AT26.

**Proposed interaction target:** One import wizard with a preview; retained frame/anchor adjustment and replay in at most 3 activations plus entry.

**Research cases:** 47, 59, 60, 61, 62. **Status:** planned.

#### W29 Add selected external format adapters only when justified

I want specialist editors to hand assets into Studio without rebuilding them.

**Depends on:** W01, W02, W09, W24, W25, W27.

**UI and UX:** Choose a format, preview supported metadata and losses, map IDs/anchors and validate before import. Deep-link external authoring where useful; no promise of arbitrary document compatibility.

**Implementation boundary:** First evaluate Aseprite PNG+JSON. TexturePacker subset, baked Effekseer exports, Rive UI motion or a live effects runtime are separate optional adapters. Confirm source/runtime licences, packaging, reset, performance and accessibility before selecting one.

**Reuse:** R09. **Acceptance:** AT18, AT26.

**Proposed interaction target:** Known format import uses one review wizard plus native file picker; no new runtime required for the first delivery.

**Research cases:** 60, 63. **Status:** planned.

### M7 Extend proven authoring to other game systems


#### W30 Author rewards, loot and economy

I want to tune offers, eligibility, rarity and prices without finding source files.

**Depends on:** W02, W07, W12, W21, W22.

**UI and UX:** Typed reward/shop tables, eligibility and weights, cadence and price controls; explain effective overrides; preview and test the relevant normal-run stage.

**Implementation boundary:** Expose only existing validated consumers, not unused card fields. Add per-subsystem presets and reference checks; preserve normal-run lifecycle and save compatibility.

**Reuse:** R07, R08. **Acceptance:** AT24.

**Proposed interaction target:** Selected one-field edit and review in at most 5 activations plus entry; one direct Test relevant scenario action.

**Research cases:** 21, 22, 23. **Status:** planned.

#### W31 Author enemies, moves and encounters

I want to tune a threat and play the exact encounter.

**Depends on:** W02, W07, W12, W21, W22.

**UI and UX:** Enemy stats/moves, repetition/weights, encounter composition and supported positions/intents; real threat receipts and Test encounter from selection.

**Implementation boundary:** Resolve whether authored move/card data actually drives the active runtime. Show required opt-ins and effective projections; preserve AI/target/defense contracts and deterministic fixtures.

**Reuse:** R07, R08. **Acceptance:** AT19, AT24.

**Proposed interaction target:** Repeated enemy edit and test in at most 5 coordination activations plus gameplay; no silent edits to an unused source.

**Research cases:** 24, 25, 26. **Status:** planned.

#### W32 Author progression and difficulty presets

I want to tune unlocks and scaling with known application timing.

**Depends on:** W01, W02, W07, W12, W21.

**UI and UX:** Typed progression/unlock/difficulty controls, effective-value display and New run/Live/Device timing labels. Separate temporary test unlock from ordinary progress.

**Implementation boundary:** Respect profile/fight snapshots and existing live framework tuning. Validate historical saves and resumed fights for changes whose contract permits live application.

**Reuse:** R07, R08. **Acceptance:** AT01, AT24.

**Proposed interaction target:** Recall/review/test a known valid preset in at most 3 activations plus gameplay.

**Research cases:** 27, 28. **Status:** planned.

#### W33 Author supported routes and supporting content

I want to change map/run constraints, labels and supported asset assignments.

**Depends on:** W01, W02, W07, W12, W21, W27.

**UI and UX:** Capability-aware route constraints, supporting definition editors and asset pickers; Find usages, missing-reference validation and actual-run route preview.

**Implementation boundary:** Add one runtime-consumed subsystem at a time using shared manifest/presets/change sets. Arbitrary event scripting, new map algorithms and new engine semantics remain separately engineered scope.

**Reuse:** R05, R07, R08. **Acceptance:** AT24, AT26.

**Proposed interaction target:** Selected preset modification and test in at most 5 coordination activations plus entry; retain seed and comparison baseline.

**Research cases:** 29, 47. **Status:** planned.

## Reuse inventory

Source/documentation candidates are not automatically ready integrations. Resolve the actual served checkout before changing them. Prefer native rendering and production modules, then validated adapters/deep links, then optional runtimes only for demonstrated unmet needs.


### R01 Current Score Studio selection, deck, generation, naming, rebalance and weight components

Adapt the newer served UI and retain existing successful behavior; consolidate command/state handling instead of rewriting the application.

**Boundary:** The served build may differ from C:/repos/AshenSpire. Resolve its checkout in W01; file presence is not readiness.

- [tools/score-studio/cardSelection.js](../../tools/score-studio/cardSelection.js)
- [tools/score-studio/deckListPanel.js](../../tools/score-studio/deckListPanel.js)
- [tools/score-studio/cardPoolForm.js](../../tools/score-studio/cardPoolForm.js)
- [tools/score-studio/rebalanceSession.js](../../tools/score-studio/rebalanceSession.js)

### R02 Native card layer and rank tools

Shared card renderer, layer selection, grouped transforms, native rank/text anchors and approved layout source.

**Boundary:** Documented Export JSON also saves game source. Add a pure export route and source-revision validation.

- [tools/card-layers/index.html](../../tools/card-layers/index.html)
- [tools/card-rank-layers/README.md](../../tools/card-rank-layers/README.md)

### R03 Effects Timing production preview

Existing production effect model/planner/renderer, timing validation and actual-art stage; use as the bounded motion control surface.

**Boundary:** Synthetic preview events are not evidence of actual combat. Normal-run and real-event linking remain mandatory.

- [tools/recipient-effects-runtime-preview.mjs](../../tools/recipient-effects-runtime-preview.mjs)
- [tools/recipient-effects-runtime-preview.html](../../tools/recipient-effects-runtime-preview.html)

### R04 Shared card animation family and current mapping policy

Use live/Reading Desk family, timing, supported action resolution and honest per-class fallbacks.

**Boundary:** Documents may describe different revisions. Verify active resolver and class-default weapon policy; no automatic sprite swap from a balance edit.

- [docs/ai/json-game-modules/CARD-ANIMATION-MAPPING.md](../../docs/ai/json-game-modules/CARD-ANIMATION-MAPPING.md)
- [docs/animation-tag-matrix.md](../../docs/animation-tag-matrix.md)

### R05 Sprite normalization, import/export and art manifests

Frame/bounds/scale staging, stable asset references, source provenance and runtime export paths.

**Boundary:** CLI helpers require a validated UI wrapper; some art sources are in AI-Art. Do not edit pinned runtime cache or claim missing animations exist.

- [tools/pose-sprites.mjs](../../tools/pose-sprites.mjs)
- [tools/unarmed-animation-import.mjs](../../tools/unarmed-animation-import.mjs)
- [docs/ART-AUTHORING.md](../../docs/ART-AUTHORING.md)

### R06 HUD Component Studio and permitted token bridge

Layers, snapping/group transforms, hide/lock, form factors, Undo and editable JSON; connect supported token export/merge/compiler.

**Boundary:** Design scenes are specimens, not working game navigation; only permitted bindings are initially in scope.

- [tools/hud-component-studio/README.md](../../tools/hud-component-studio/README.md)
- [docs/hud-layout-tokens.md](../../docs/hud-layout-tokens.md)

### R07 Canonical schemas, content/config/framework compilers and atomic write helpers

Resolve ownership, validate, build isolated test revision and report effective field lifetime; reuse build-lock and save bridges.

**Boundary:** Do not author generated outputs. Profile pins, fight snapshots, live framework values and device/presentation settings have different lifetimes.

- [DEVELOPER.md](../../DEVELOPER.md)
- [docs/MANUAL-EDITING.md](../../docs/MANUAL-EDITING.md)
- [tools/README.md](../../tools/README.md)

### R08 Existing real-game QA, screenshot and acceptance infrastructure

UI-driven acceptance, actual screenshot/event evidence and compact receipts outside the repository.

**Boundary:** A screenshot route, source test or separate simulator alone does not prove a new card was loaded and played.

- [tools/qa-sandbox.mjs](../../tools/qa-sandbox.mjs)
- [docs/qa/SANDBOX-QA.md](../../docs/qa/SANDBOX-QA.md)

### R09 Optional external adapters and transferable editor patterns

Aseprite PNG+JSON first; consider bounded TexturePacker, baked Effekseer, Rive UI or Fabric components only after a concrete unmet need.

**Boundary:** Formats/runtimes need compatibility, licensing, reset/performance and packaging evaluation. Pose Studio/Workbench/full editor are archived candidates, not assumed installed integrations.


## Sandbox fixture families

Card Lab controls exact hand/target. Encounter Lab uses real enemies, intents and state. Normal Run reveals draws, economy, rewards and progression. All share the actual local engine/renderer. Practice pays normal costs; Training visibly records exceptions. Distinguish Step game action from Step presentation frame. Same-seed restart and supported checkpoint replay are valid; arbitrary backwards game-state scrubbing is not assumed.

| Family | Setup | Inspect |
| --- | --- | --- |
| Baseline target | Known class/gear and ordinary single target | Costs, targeting clarity and ordinary effect pacing. |
| Groups and area | Multiple legal targets, supported positions, multihit/AoE | Per-hit/per-target order, readable overlaps, one primary actor action. |
| Defenses | Block/Poise and supported resistance/weakness | Defense ordering, actual damage receipt, correct blocked/avoided feedback. |
| Resource pressure | Exactly affordable and unaffordable plays | Paid cost/refusal, opportunity cost and alternatives under legal Practice. |
| Low health and outcomes | Near defeat, on-kill/overkill and target loss | Correct outcome, cancellation/cleanup, transition or reward. |
| Reactions | Counter preparation/return, block and evade conditions | Held states, actual trigger ownership and no duplicate return. |
| Status lifecycle | Apply, stack, refresh, expire and cleanse | Rules/text/timing agreement and separate cue phases. |
| Card piles | Hand/draw/discard/exhaust/retain/innate where supported | Instance identity, pile transitions and readable hand behavior. |
| Cycling and synergy | Multi-turn deck cycle and supported trigger chains | Utility beyond one hit, resource tradeoffs and recursive guards. |
| Class and equipment | Supported class/loadout/scaling combinations | Legality, actual family policy and explicit intentional fallback. |
| Presentation stress | Overlapping effects, missing/cold assets, reduced motion, narrow view | Input responsiveness, outcome readability and cleanup. |
| Normal-run transitions | Encounter, reward, shop/rest, save/load | Runtime consumption beyond a controlled single fight. |

Record affordability, alternatives, multi-turn utility, targeting clarity, readability, anticipation/impact/recovery and latency alongside CP/outcomes. No universal win-rate target is introduced. Correlate mechanics and presentation by action/event IDs while keeping their ownership separate.

## Local-game acceptance catalogue

All tests below are planned. Set up feature actions/scenarios through Studio and the actual local game UI. Read-only exports and logs may verify results. Console state injection, hand-edited saves, synthetic preview receipts or a parallel simulator do not prove UI completion. Supporting schema/engine tests do not replace actual gameplay checks.


### AT01 Prove source ownership, loaded revision and field timing

**Procedure**

1. Identify the actual served checkout/runtime and export the current Studio draft through UI.
2. Choose one known supported profile value, one documented live framework value and one presentation/device value in isolated test data.
3. Review effective overrides and application timing, build/load through Studio, start a fresh run and exercise a supported resumed-fight case.

**Expected**

- Loaded content/runtime/art revisions match the reviewed candidate; stale builds fail visibly.
- New-run pins, fight snapshots, permitted live tuning and presentation/device settings follow their actual contracts; no blanket fresh-run assumption.

**Evidence**

- Before/after UI exports, source-owner map, loaded-revision screenshot and actual runtime receipts.

### AT02 Change only the intended identity dimension

**Procedure**

1. Select a spell and record authored effects, costs, school, camp, tradition and stance.
2. Change Tradition to Divine and back to Arcane; separately edit School and Camp using their own controls.
3. Assign Attack stance while retaining spell source and Magic only, then launch the controlled actual-game fixture.

**Expected**

- Only the explicitly edited authored fields change. Derived scaling consequences are explained rather than mistaken for authored effect edits.
- No school:divine substitution for tradition; no Martial tag accidentally introduced; game identity and action behaviour match the controls.

**Evidence**

- Authored-field diff, inspector screenshots, loaded card and actual play receipt.

### AT03 Build the exact requested ten-card Starseer starter

**Procedure**

1. Resolve the current canonical Starseer starter and card definitions. For an explicitly requested historical-import variant, recover the original 20261125 export bytes and import through UI with reviewed merge policy.
2. Choose Starseer starter: Arcane Strike 4, Mana Rite 1, Ward 4, Arcane Bolt 1; resolve stable IDs from installed canonical definitions and verify ten authored cards separately from equipment grants.
3. If Starseer is locked, use isolated test-class availability; keep normal progression unchanged. Start a fresh actual local game and inspect its full deck.

**Expected**

- Exact IDs and quantities reach the actual game. Studio list membership is not accepted as proof of installation.
- Original fixture definitions remain preserved. Reaver fallback is valid for the Reaver QA card; class restrictions are not silently bypassed or original cards reclassified.
- Only an explicitly requested historical-import variant depends on recovering the original export bytes. Their absence does not block current starter or unrelated tests; no invented replacement is called equivalent.

**Evidence**

- Canonical source/revision, before/after starter export, normal-profile unlock state and actual full deck screenshot; original fixture hash/source when testing the historical-import variant.

### AT04 Create and actually play the supported custom card

**Procedure**

1. Create a clearly named QA spell through UI, with Arcane tradition, Attack stance, Magic only and a supported two-hit damage effect.
2. Install it in the appropriate starter; use a Reaver-specific duplicate/fallback if needed, without mutating original definitions.
3. Launch a fresh normal run on the actual local game and play the card against a legal target.

**Expected**

- Card appears in the intended starter and hand; costs are paid exactly once.
- Two supported resolved-hit events occur, with defense/scaling explained and no duplicate primary action. If two-hit binding is unsupported, it is explicitly blocked until engineered; the basic supported card still must play.

**Evidence**

- UI steps, authored export, loaded revision, deck/hand screenshots and actual cost/hit/cue receipts.

### AT05 Bulk-remove only the 45 generated cards

**Procedure**

1. Back up baseline definitions through UI and generate three identifiable 15-card batches.
2. Filter/select all 45 by batch identity; inspect selected/hidden counts and remove only these added definitions in one transaction.
3. Check original definitions and deck references; Undo, Redo and inspect the actual game under the restored or remaining chosen test configuration.

**Expected**

- No original definition or unrelated membership changes. One Undo restores all 45 definitions and relationships.
- Trash and deck removal have distinct meanings. Empty deck-container cleanup is optional and explicit.

**Evidence**

- Before/after ID and definition comparison, selected-count confirmation, Undo/Redo export and game deck check.

### AT06 Preserve exact selection through sort, context actions and drag

**Procedure**

1. Click an anchor, Shift-select a range, Ctrl-deselect two cards and Ctrl+Shift-add another range.
2. Sort by CP/name/ID/type; filter some selected cards out and inspect hidden-selected count.
3. Right-click a selected card, drag the group into a valid starter/deck, adjust copies, then Undo. Repeat using keyboard/menu alternatives.
4. Launch that candidate starter in the actual game.

**Expected**

- The same stable IDs stay selected after sort; next range uses current displayed order.
- Only previewed IDs/copies are transferred; one Undo restores source/destination/quantity/order. Ctrl+A covers matching records beyond virtualized viewport.
- Manual reorder explicitly selects Manual sorting; invalid drops explain restrictions and mutate nothing.

**Evidence**

- Selected-ID exports at checkpoints, action/menu/drag log, starter diff and actual full deck screenshot.

### AT07 Verify independent defaults and last-used state

**Procedure**

1. Save different whole-tool and section presets for Pool generation, Batch Cards, Batch Items, Rebalance and Naming.
2. Set a project default, tweak last-used values, Cancel as specified, reopen, reload browser and restart local server/application.
3. Load/export/import presets and repeat generation/rebalance into an isolated game fixture.

**Expected**

- Each tool/section retains the declared values without cross-contaminating Card/Item counts. Named preset, default, factory and last-used states remain distinct.
- Cancel follows one documented contract; scopes never silently expand. Actual game output identifies the recipe/weight revision.

**Evidence**

- State matrix with expected/actual values at reopen/reload/restart, preset exports and actual output receipt.

### AT08 Generate three reproducible fifteen-card configurations honestly

**Procedure**

1. Use three named rank-distribution recipes with separate seeds to make three 15-card decks under a recorded scoring profile.
2. Separately exercise three distinct scoring-profile variants if supported, clearly separating changed weights from changed generation quotas.
3. Check school/camp/rank/cost quotas, exact-CP flags, IDs and destination; retry only misses; repeat a recipe/seed.
4. Install an accepted generated test card/deck and play it in the actual local game.

**Expected**

- Each accepted batch has 15 entries and its recorded recipe. Exact mode meets targets; any best-effort mode explicitly lists misses before acceptance.
- Repeated seeds reproduce content decisions without overwriting unrelated IDs; no false claim that three rank distributions are three weight models.
- Displayed costs/effects agree with actual runtime resolution, subject to visible scaling/defense.

**Evidence**

- Recipes, weight revisions, output exports, miss report, deterministic comparison and actual game play receipt.

### AT09 Rebalance the intended scope and keep constraints

**Procedure**

1. Select/filter one QA card while other definitions remain in the pool. Open Rebalance and inspect scope.
2. Change advanced rank quotas and constraints; reopen/reload as specified. Preview an infeasible target and then a feasible supported case.
3. Apply only the intended result, launch the candidate in the actual game, and Undo.

**Expected**

- Scope and counts match intent, remembered settings follow AT07, and other cards are untouched.
- Infeasible results cannot silently commit; recipe export contains settings rather than just cards. Actual loaded card reflects the accepted result.

**Evidence**

- Scope/constraint snapshots, recipe and definition diffs, failed-preview explanation, actual play and Undo export.

### AT10 Rename without silent loss or identity changes

**Procedure**

1. Set a short name limit, reorder component priorities and test long/mandatory-component examples.
2. Preview rename-once and Auto-name on a selected batch, preserving manual names unless included.
3. Save preset, reload, apply, Undo and start the actual game with a renamed card.

**Expected**

- Length/collisions/dropped parts are explicit; impossible mandatory-name combinations require a decision instead of silent truncation.
- Stable IDs, starter references and effects stay intact; game name/text and actual card identity match.

**Evidence**

- Naming preset, before/after names/IDs, collision/limit preview and actual hand/inspection screenshot.

### AT11 Archive, restore and migrate a referenced feature

**Procedure**

1. Create or select a supported referenced feature; inspect its usages.
2. Archive authoring availability, restore it, rename its display label, then test separately disabling its scoring contribution.
3. Review a true gameplay retirement/migration as a distinct operation and import/export the registry. Play a referencing card before/after the permitted operations.

**Expected**

- Archive hides active authoring choices but preserves historical references and stable ID; restore recovers it.
- Changing a label or scoring weight does not silently remove gameplay. Actual retirement has an explicit dependency/migration result.

**Evidence**

- Registry/ref graph diffs, active/archived views, score breakdown and actual gameplay receipts.

### AT12 Validate formula structure and scoring/gameplay separation

**Procedure**

1. Create supported flat, additive, per-unit and multiplier templates with units, caps and ordering.
2. Exercise zero, fractional, negative and boundary values where allowed; reject invalid units/ranges/conditions.
3. Tune only scoring, then separately tune an actual effect through supported controls and play both candidates.

**Expected**

- Worked score matches the declared formula and evaluation order.
- A scoring-only edit changes evaluation, not mechanics; a mechanic edit changes actual runtime receipts as declared.

**Evidence**

- Template JSON, worked calculations, validation output and paired actual-game receipts.

### AT13 Compose supported trigger mechanics and reject unsupported behavior

**Procedure**

1. Build a supported trigger/condition/target/effect/duration template and preview execution order.
2. Exercise valid, invalid-target and recursion/counter-chain cases through the actual engine.
3. Attempt to choose an unavailable runtime effect or arbitrary method name.

**Expected**

- Only supported bindings can be accepted; undefined behavior displays Engine support required.
- Runtime executes the configured sequence with applicable guardrails and no infinite/duplicate trigger path.

**Evidence**

- Capability/binding versions, validation, action/event trace and error-state screenshots.

### AT14 Round-trip project sections and reject bad imports atomically

**Procedure**

1. Export full project and individual cards/weights/presets/registry/layout/scenario sections as implemented.
2. Import into a clean isolated project; test duplicate IDs, old schema, missing references/assets/bindings and a stale source revision.
3. Cancel a reviewed conflict and then import a valid resolution; start the same actual-game fixture.

**Expected**

- Supported fields and relationships survive semantically losslessly; expected metadata changes are identified.
- Rejected/cancelled imports write no partial state; original project survives. Runtime loads the imported candidate and reproduces supported behavior.

**Evidence**

- Normalized semantic diff, conflict/validation results, source revision guards and actual loaded-revision receipt.

### AT15 Use the same card design in editor and actual hand

**Procedure**

1. Edit a shared template and a separate per-card appearance override using native controls.
2. Preview short/long/localized text, high costs/ranks and dense effects at hand/zoom/list/device sizes.
3. Apply design and play/inspect those cards in the actual game; pure Export must not save source.

**Expected**

- Native rendering and text/mechanic tokens agree; shared scope versus override is explicit.
- No unintended clipping/overlap or broken anchors; readable controls remain reachable. Exported editable and flattened artifacts are clearly different.

**Evidence**

- Layout scope diff, native preview and actual game screenshots, overflow/geometry checks and export/source comparison.

### AT16 Resolve one intended actor action and layered cues

**Procedure**

1. Create rules for a Magic-only Arcane spell with Attack stance, a counter preparation/return and a status apply/update/remove lifecycle.
2. Add competing/equal-priority rules, missing clips and intentional class fallbacks; inspect Why this animation.
3. Play each case in the actual game with the reviewed class/loadout policy.

**Expected**

- Exactly one winning actor action per channel; additional traits do not duplicate the primary cast.
- Conflicts/missing bindings are diagnosed; phase and fallback are correct. Class-default weapon/art policy is not silently replaced.

**Evidence**

- Effective tags, winning-rule trace, action/cue IDs, coverage status and actual game capture.

### AT17 Keep mechanics deterministic across presentation changes

**Procedure**

1. Replay one fixed legal scenario at normal, slow and fast presentation, reduced motion and skip settings.
2. Exercise interruption, target defeat, scene exit, repeated actions and status-cue cleanup.
3. Step actual actions and presentation frames separately.

**Expected**

- Domain state, paid costs, RNG position and semantic mechanical event order match across presentation-only variants; timestamps/frame counts may differ.
- No ghost particles/audio/camera offsets, duplicate damage, skipped statuses or stuck inputs remain after cleanup.

**Evidence**

- Semantic receipt/state comparison, cue lifecycle/resource counts and actual captures.

### AT18 Import sprite metadata and align it in the real scene

**Procedure**

1. Import loose frames or the first supported PNG+JSON atlas fixture with trim/padding and per-frame durations.
2. Set logical bounds, pivots and floor/hand/muzzle/hit anchors; inspect loops and coverage.
3. Replace an asset by stable ID and play matching actions across supported class/equipment contexts.

**Expected**

- Frame order/duration, logical bounds and anchors survive roundtrip. Intended floor/scale alignment is stable within the declared fixture tolerance.
- Missing and fallback actions are labelled honestly; no accidental other-class art substitution or immutable cache mutation.

**Evidence**

- Imported metadata/asset hashes, anchor overlay, coverage matrix and actual game motion capture.

### AT19 Exercise the Card and Encounter Lab fixture families

**Procedure**

1. Create/save one fixture in each of the twelve families listed in the plan, using supported state controls.
2. Test exactly-affordable and unaffordable plays under Practice, then explicit Training.
3. Play multiple turns and inspect targets, defenses, reactions, status lifecycles, piles and normal-run transition cases.

**Expected**

- Actual local engine and renderer execute all accepted setups; coherent state and training exceptions are visible.
- Legal refusal/affordability and multi-turn tradeoffs are observable; isolated tests do not alter ordinary progression/saves.

**Evidence**

- Scenario manifest, loaded revisions, input/action log, runtime events, observations and normal-profile state check.

### AT20 Compare and replay actual game revisions

**Procedure**

1. Choose saved baseline/candidate and identical scenario/seed, then run a recorded legal action sequence.
2. Reset/replay from a supported checkpoint and compare outcomes plus resource/pacing observations.
3. Change a mechanic and a presentation setting in separate comparisons.

**Expected**

- Same candidate/fixture reproduces semantic results; changed mechanics can legitimately change outcomes/RNG usage and the comparison explains it.
- No arbitrary rewind promise; presentation-only changes satisfy AT17. Baseline and candidate identity remain distinct.

**Evidence**

- Both content revisions, fixture/actions, effective values, outcome/decision notes and replay receipts.

### AT21 Tune supported HUD/feedback and preserve playability

**Procedure**

1. Edit permitted token/layout/feedback values and preview narrow, desktop and wide forms with long text.
2. Use keyboard, pointer and touch-equivalent controls, reduced motion and open/close inspector modes.
3. Play a targeted card while checking tooltips, overlays, selection and input routing.

**Expected**

- Supported edits reach actual game through validated owners; arbitrary specimen layout is not falsely presented as live gameplay navigation.
- Targets, costs and outcomes remain readable/reachable; menus do not accidentally trigger game input; reduced-motion alternative remains informative.

**Evidence**

- Token/source diff, viewport/input records, actual game screenshots and focus/target geometry checks.

### AT22 Cancel jobs and recover interruptions without partial commits

**Procedure**

1. Start a large generation/rebalance/import operation; cancel before commit.
2. Start a newer job or edit its source while an older preview is running; close/reload during a staged operation.
3. Recover draft and launch its last valid actual-game configuration.

**Expected**

- Cancelled/stale results cannot overwrite newer content or broaden scope.
- Draft/source is intact, progress/error state explains recovery, and actual game loads a valid acknowledged revision.

**Evidence**

- Job IDs/state, cancellation/recovery UI, source/draft diff and actual loaded-revision receipt.

### AT23 Undo, redo and restart with complete relationships

**Procedure**

1. Exercise definition edits, deck quantities, bulk removal, naming, generation, layout and imports as supported.
2. Undo/Redo each transaction, export semantic state and reopen/reload/restart.
3. Launch a restored starter and play its restored card.

**Expected**

- All affected definitions, IDs, names, memberships, quantities and presets restore together.
- No original content loss or hidden pending source write; actual game matches the chosen restored revision.

**Evidence**

- Before/Undo/Redo semantic exports, persistence matrix and actual starter/play receipt.

### AT24 Prove every broader editor reaches its actual runtime consumer

**Procedure**

1. For each implemented rewards/shop/enemy/encounter/progression/difficulty/map section, change one owned value through UI.
2. Review profile/override/opt-in/application timing, validate/build and navigate to the relevant actual normal-run or encounter stage.
3. Exercise supported save/resume compatibility and restore baseline.

**Expected**

- Actual offer/price/move/route/progression behavior reflects the effective candidate value, not an unused authored field.
- Unsupported fields stay unavailable; appropriate new-run/live/presentation timing and ordinary profile isolation are preserved.

**Evidence**

- Owner/effective-value receipt, authored diff, actual stage capture and restore/resume evidence.

### AT25 Keep selection and common work responsive at scale

**Procedure**

1. Load isolated 1000-card reference and 10000-card stress fixtures through UI.
2. Search, sort, Ctrl+A, inspect hidden selection, bulk edit, drag and cancel a long job.
3. Install a small valid result into a starter and play it.

**Expected**

- Virtualization does not change semantic selection or scope. No mandatory per-card editing loop; progress and cancellation remain reachable.
- Measure agreed reference-hardware latency/memory/scroll targets established in M0, rather than inventing a performance pass from screenshots.

**Evidence**

- Hardware/build/viewport, measured responsiveness and memory, selected IDs, job metrics and actual game result.

### AT26 Validate one external format or supporting asset adapter end to end

**Procedure**

1. Select a documented source-format subset and retain original file/provenance metadata.
2. Import to fresh staging, review unsupported metadata/coordinate conversions and export the accepted subset.
3. Assign the resulting asset/content reference, rebuild/load and exercise it in the actual game.

**Expected**

- No claim of arbitrary compatibility; metadata/trim/pivots/durations and source references satisfy the chosen contract.
- No proprietary editor copying or implicit publication; malformed/unsupported data cannot partially replace approved runtime assets.

**Evidence**

- Source/adapter versions, licence/provenance decision, roundtrip comparison and actual scene capture.

### AT27 Measure the ten reference workflows and contextual quality

**Procedure**

1. Run all ten reference tasks in the plan from their stated starting conditions with pointer and keyboard routes, then narrow/touch equivalents where supported.
2. Record actual activations, field edits, menus, interfaces, workspace switches, maximum modal depth, scroll travel, waits, errors, re-entry and displaced actions.
3. Complete the runtime portions in the actual local game and compare with proposed interaction budgets.

**Expected**

- Observed counts replace planning estimates; missed budgets and unintuitive/mislabelled/dead actions are documented.
- No nested required modals, no essential hover-only controls, and no context reconstruction for a simple repeated tweak.

**Evidence**

- Task-by-task I want to records, counts, viewport/input conditions, screenshots and actual-game receipts.

## Fixtures and prerequisites


### F01 Original requested Starseer import

20261125_starseer_ashenspire-cards-list.json from the user; preserve original bytes/hash and treat content as data.

The original external export was missing during planning. Recovery is required only for an explicitly requested historical-import variant of AT03. Its absence does not block the current installed starter or unrelated tests; do not claim the original bytes were recovered.

### F02 Requested ten-card starter

Arcane Strike x4, Mana Rite x1, Ward x4, Arcane Bolt x1; resolve stable IDs from the installed Core starter and card definitions, total ten authored cards plus separate equipment grants.

Names/composition are user requirements, not guessed IDs. Use isolated Starseer test unlock; Reaver fallback applies only where eligibility is explicit.

### F03 Custom card and Reaver fallback

UI QA card with supported damage; Arcane tradition, Attack stance, Magic only. Supported two-hit variant for the expanded creative acceptance.

Create/duplicate through UI; preserve originals. New runtime binding requires engineering if unsupported.

### F04 Three generated batches

Three 15-card decks with named rank-distribution recipes/seeds; record separate scoring profile. Additional distinct weight-profile variants are separate from rank quotas.

Use deterministic test recipes and retain baseline export; exact mode must not silently accept misses.

### F05 Selection and import boundaries

Mixed types/classes and hidden selections, duplicate IDs, missing references, old schemas, stale revisions and 1000/10000-card stress data.

Isolated test data; agreed reference hardware and thresholds recorded in M0.

### F06 Sprite, layout and rule boundaries

Trimmed atlas with logical bounds/frame durations; long/localized text; missing/fallback clips; competing animation rules and interruption cases.

Approved or purpose-made test assets with source provenance; no new runtime dependency required for the initial slice.

## Reference usability tasks

| I want to | Starting state | Record |
| --- | --- | --- |
| Change one card tradition | Visible card, gallery open | Select card, change Tradition only, Apply, then test; preserve authored unrelated fields. |
| Install a starter | Selected card, no class chosen | Choose class/count/replacement in one surface; validate composition and start actual normal run. |
| Create a supported card | Library open | Create from template, configure effect and costs, review and play in actual game. |
| Generate 15 into a named deck | Known valid recipe | Recall recipe/destination, generate, inspect misses and select batch without ID-search workarounds. |
| Tweak rebalance | Selected scope, prior accepted recipe | Edit one constraint, preview/apply and retest without rebuilding scope/settings. |
| Bulk edit mixed cards | Filtered mixed collection | Select exact IDs, edit only one property, preview and Undo. |
| Drag a selection | Known selection and valid deck target | Transfer/copy with counted preview, adjust quantity, sort/reorder, Undo and inspect actual starter. |
| Rename from rules | Selected batch including a manual name | Edit length/priority, preview collisions, preserve excluded manual names and restore. |
| Archive and restore a trait | Referenced definition selected | Review dependencies, archive authoring availability, restore same ID and play a referencing card. |
| Tune motion and compare | Saved supported scenario and cue | Adjust presentation, replay and compare mechanical state/RNG across speed/reduced-motion variants. |

## Delivery gates

- Identify the actual serving source, schema/field owners and baseline before implementation. Capture current UI screenshots and write a bounded visual/state contract before changing the layout.
- Split packages into small scoped changes. Preserve user edits, drafts, archives and worktrees; use proportionate checks and review the exact diff.
- First delivery must load and play the custom card in the actual game and preserve the project through Undo/roundtrip. Test the current installed Starseer starter independently; only an explicitly requested historical-import variant requires recovery of its original export bytes.
- A milestone closes only with its exit gate and linked tests demonstrated. Document actual task costs and state-memory results with before/after screenshots; do not close it from compiler success or a static mock.
- Keep missing runtime capabilities, assets and adapters explicit. A scoring definition does not create gameplay; an archived design page is not working navigation.
- Update completed story checkboxes only with actual evidence. Planning, docs merge and user-requested runtime implementation are separate deliveries; publication requires its own authority.
- Initial scope excludes a replacement engine, arbitrary scripting, full pixel painter, generic skeletal/particle runtime, second card renderer and automatic balance optimization.

The [checklist](FEATURE-CHECKLIST.md) maps every requested item to packages, and [use cases](USE-CASES.md) map all 64 researched cases. The structured plan contains the same mapping.

## Primary editor references

- [Godot Inspector](https://docs.godotengine.org/en/latest/tutorials/editor/inspector_dock.html) — Selection-driven inspection pattern.
- [Unreal Property Matrix](https://dev.epicgames.com/documentation/en-us/unreal-engine/property-matrix-in-unreal-engine) — Bulk property comparison and editing pattern.
- [Unity default presets](https://docs.unity.com/en-us/engine/6000.6/manual/assets-and-media/presets/default) — Reusable preset versus chosen default pattern.
- [Godot animation timeline](https://docs.godotengine.org/en/stable/tutorials/animation/introduction.html) — Tracks/keyframes/playback pattern; not an engine replacement.
- [Unreal Gameplay Ability System](https://dev.epicgames.com/documentation/unreal-engine/understanding-the-unreal-engine-gameplay-ability-system?lang=en-US) — Cosmetic cue/tag association pattern.
- [Aseprite sheets and metadata](https://aseprite.org/docs/cli) — PNG/JSON adapter candidate.
- [Effekseer](https://effekseer.github.io/en/) — Baked effects or optional web runtime candidate.
- [Rive state machines](https://rive.app/docs/editor/state-machine/state-machine) — Optional UI motion/data-binding candidate.
- [Fabric.js](https://www.fabricjs.com/) — Conditional reusable canvas components, not a new parallel native renderer.
