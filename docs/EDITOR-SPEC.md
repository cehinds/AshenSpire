# Score Studio editor specification

Status: **future editor contract**, consolidated 26 November 2026.
This document specifies the designer-facing authoring environment, its data
contracts and its acceptance requirements. It does not declare that the complete
editor is implemented, that a prototype has passed browser tests, or that any
gameplay change is approved.

Requirement terms follow RFC 2119 meanings: MUST/SHALL are required, SHOULD is
recommended unless a documented reason justifies deviation, and MAY is optional.
Lowercase "shall" in the requirements below also denotes a required future
contract. Existing-foundation statements are descriptive, not acceptance results.

## 1. Purpose, authority and scope

Score Studio shall let a designer change supported content, understand its
consequences and try the exact candidate in the actual local game with little
or no code editing. A supported job ends at verified consumption by the game,
not at editing an unused field or producing a plausible preview.

This is the authoritative specification for the editor work described here.
Earlier editor mockups, use-case catalogues and dated plans are design history;
their page-based arrangements do not override the persistent workbench below.
Supporting source guides remain authoritative for the systems they document.

- [SPEC.md](../SPEC.md), its superseding gameplay contracts and the active game
  profile own formulas, content rules, effect ordering and save compatibility.
- [CONTRIBUTING.md](../CONTRIBUTING.md) owns review, integration and publication.
- [DEVELOPER.md](../DEVELOPER.md) and [Manual editing](MANUAL-EDITING.md) own
  existing authoring/compiler commands and field lifetimes.
- [Architecture map](ARCHITECTURE-MAP.md), [component architecture](COMPONENT-MODEL-ARCHITECTURE.md)
  and [engine API](ENGINE-API.md) constrain implementation boundaries.
- [Project guide](PROJECT-GUIDE.md) is the discovery entry point for this spec
  and the existing operational guides. Do not create a competing editor index.

The [implementation reference](score-studio/README.md) retains the detailed
checklist, use cases, package dependencies and bounded first story as supporting
material. This specification controls editor requirements and delivery priorities.

The editor shall expose existing validated capabilities rather than change
gameplay implicitly. New opcodes, target semantics, resolution order, RNG rules,
serialization migrations and runtime adapters remain engineering work with the
applicable gameplay contract and tests. Arbitrary method names are not an effect
picker. Changing a scoring weight does not implement an effect.

Player-facing deck editing and shops described in SPEC.md remain distinct from
this designer tool. Sharing definitions/renderers is encouraged; their access,
progression, prices and save rules must not be replaced by authoring privileges.

### 1.1 Existing foundations versus requirements

Existing source provides Score Studio content/scoring tools, selections, custom
lists, save helpers and supported game-content pipelines. Their precise served
version and integration must be checked before implementation; a stale source
file or old audit is not proof that a current UI control is absent.

[Mechanical scoring](score-studio-mechanical-scoring.md) documents the shared
neutral card projection and currently installed Starseer content/starter.
[Core starter declarations](../games/ashenspire/packs/core/starterDeck.json) and
current canonical card definitions resolve the actual IDs and quantities.
Earlier missing-file observations are not current installation blockers.
Recover exact original bytes only when a historical fixture test requires that
original export; do not invent equivalent bytes or hold unrelated tests hostage.

Source availability, static schema validation, rendered diagrams, browser
interaction and actual-game acceptance are separate evidence levels. A local
design example shall identify itself as unconnected until real adapters exist.
No baseline screenshot or synthetic receipt establishes a successful game run.

## 2. One persistent parent workbench

The primary environment shall resemble a dockable IDE: one project, one shared
document/session model, common pane chrome and a persistent selection/context.
Routine operations shall not require leaving one page for another tool page.
Tool groups and optional layout presets shall be:

| Stable group ID | Tools activated within the same environment |
| --- | --- |
| `content` | Cards, items, events, labels, native card appearance |
| `mechanics` | Feature registry, scoring, effect composition, naming, generation, rebalance |
| `decks` | Collections, starters, classes, effective profile and supported game settings |
| `motion` | Approved clips, presentation timing, tag rules, audio/feedback |
| `assets` | Approved asset references, frames, anchors, import and coverage |
| `playtest` | Actual-game normal run, scenarios, labs, receipts and comparison |

These six IDs are not six required pages, independent drafts or separate save
slots. Activating a group may reveal, focus or arrange panes while retaining the
open document, selection, candidate revision and prior tool settings.

The parent shall provide library/outline, central document/production preview,
contextual inspector, grouped JSON/source access, changes/history, jobs and event
inspection. Optional timeline and specialized content panes use the same shell.
Code and JSON access shall be grouped and reachable from the selected entity.
Each view shall show its document identity, ownership and current revision.

### 2.1 Parent, children and interfaces

Every focused wireframe shall have accompanying JSON. It shall declare its
parent, shared component instances, placement, context bindings, commands,
menus/dialogs, states, validation and acceptance references. A screenshot alone
is not a complete wireframe contract.

Use one parent and at most one parent-to-child specialization level. Children
shall supply content and allowed layout/binding overrides; they shall not copy
the shell, dispatcher, document store, job protocol or focus/modal controllers.
Reject inheritance cycles, missing parents and unsupported interface versions.

| Interface | Required contract |
| --- | --- |
| Contextual pane | Stable pane/component IDs, context source, document session; dock/resize/float/move/hide/auto-hide/pin/focus restoration |
| Document view | Session, revision, view kind, field bindings; shared visual/JSON/source identity, staged validation and explicit writes |
| Async job view | Operation ID, input revision, frozen scope, lifecycle; local progress, cancellation, stale-result rejection, atomic Apply |
| Context surface | Invoker, exact target/scope, ordered items, availability; close menu before dialog and restore context on Cancel |

Child resolution order shall be parent defaults → shared component defaults →
child specialization → permitted personal layout overrides. Objects override
named keys; ordered arrays replace only when explicitly supplied. Stable IDs
shall not rename or merge implicitly. Personal layout cannot override gameplay
data, capability validation, source-write guards or the single-modal policy.

### 2.2 Shared components and machine-readable placement

Maintain one small component registry. Reuse renderer/controller functionality
for shell, pane, splitter, property field/grid, collection table, menu/item,
dialog shell/footer, scope/status/validation strip, job view, document view,
production preview, diff, timeline and ordered steps. A new screen or different
label is not a reason to add another component implementation.

Instances shall reference definitions, typed props, slots and canonical commands.
Common style/behavior changes shall propagate through the registry. Explicit
per-instance overrides shall show their origin and support reset and Find usages.
Add a new component kind only when existing composition cannot express its
behavior; document the distinction and update the [component catalogue](component-catalog.html).

Placement JSON shall name dock region/group, order, anchors, size constraints,
visibility/auto-hide state, floating bounds, narrow reflow and context source.
Cross-surface references shall name modal/menu/component IDs rather than copy
their definitions or use unrestricted filesystem paths.

The following illustrates a **proposed design format**, not an existing game
import format or an implemented runtime API:

```json
{
  "format": "editor.parent",
  "formatVersion": 1,
  "id": "editor.workbench",
  "componentRegistryRef": "editor.components",
  "interfaces": ["contextual-pane@1", "document-view@1", "async-job-view@1"],
  "policies": {"maximumParentDepth": 1, "modalDepth": 1, "submenuDepth": 1},
  "sessionRef": "editor.document.current"
}
```

```json
{
  "format": "editor.components",
  "formatVersion": 1,
  "components": [{
    "id": "editor.component.property-grid",
    "rendererKind": "fields",
    "slots": ["fields", "validation"],
    "interfaces": ["contextual-pane@1"],
    "defaultProps": {"showUnits": true, "showOverrides": true}
  }]
}
```

```json
{
  "format": "editor.child",
  "formatVersion": 1,
  "id": "editor.child.card",
  "extends": "editor.workbench",
  "toolGroup": "content",
  "instances": [{
    "id": "editor.instance.card-properties",
    "componentRef": "editor.component.property-grid",
    "documentSessionRef": "editor.document.current",
    "contextBinding": "selection.currentCard",
    "placement": {"region": "right", "group": "inspector", "minimumWidth": 240},
    "commandRefs": ["cmd.editFields"],
    "menuRefs": ["menu.context.singleCard"],
    "dialogRefs": ["dialog.addToStarter"]
  }]
}
```

Schemas shall distinguish design descriptions from authoring data and runtime
receipts. Require version/format, unique IDs, valid types/units/enums, declared
props/slots/interfaces, resolvable references and bounded inheritance/layout.
Validate reference kinds, dependency cycles, command arguments and illegal
overrides in addition to JSON syntax. Unknown newer formats shall fail with an
exact path while retaining original bytes. Projections/HTML/diagrams shall be
generated from canonical design JSON; do not hand-edit competing copies.

## 3. Docking, context and shared document behavior

Panes shall dock to explicit targets, resize with clamped splitters, undock,
float, move, redock, hide, auto-hide, reopen and pin context. Floating inside the
same application document is the baseline. Native-window detach is a separate
capability and must not be implied by an in-page demonstration.

Title-bar menus shall offer the same pane actions as visible controls. Pointer
drag is optional: provide keyboard resize/movement and labelled alternatives.
Show dock targets/insertion previews without committing layout during hover.
Cancel/outside-drop restores the prior layout. Preserve reachable title bars,
recover off-screen panes and clamp restored bounds to current display geometry.

Auto-hide shall collapse a pane to a labelled reachable strip, preserve its
content/state and avoid covering essential controls when reopened. Selection
updates a following inspector; Pin fixes its context until explicitly released.
Show Following/Pinned and the inspected entity, not just an unexplained lock icon.

Hide/reopen, tool activation and layout reset shall preserve selected stable IDs,
pending field edits, document history, tool recipes and useful scroll anchors.
Reset layout resets personal arrangement, not project content. Personal layout
preferences shall stay separate from gameplay bundles unless explicitly exported
as a personal-layout section. Narrow layouts shall reflow/auto-hide panes while
retaining equivalent commands, readable fields and return focus.

Visual editing and JSON editing of a structured document shall share one
canonical draft, revision and history. A parse-invalid text buffer shall remain
recoverable without replacing the last valid structured document. Views shall
show parse/schema errors and stale previews; switching views must not drop edits.

Owning source/code is linked through the same project/document session and
ownership map. Where a provider cannot round-trip a code resource into visual
fields, identify that boundary rather than create an independent autosaved copy.
Start with read-only source access; supported editing requires explicit provider,
validation, source-revision guards and reviewed writes. Never evaluate edited
code automatically. Engine implementation changes retain normal code review.

## 4. Commands, menus and exceptional dialogs

One canonical command dispatcher shall serve toolbars, pane controls, menus,
context menus, command search, keyboard and touch. Commands declare typed
arguments, context/target kind, frozen scope, prerequisites, availability reason,
transaction behavior and focus return. UI instances do not copy handlers.

Top-menu order shall be **File, Edit, View, Tools, Test, Help**. Data shall give
stable item IDs, numeric order, semantic groups/separators, action/surface refs,
scope, prerequisites and close-before-action. Allow at most one submenu level.

| Menu | Deliberate ordered groups |
| --- | --- |
| File | Import to draft; Save project/Save as/Export; Review changes and separately reviewed source save; recovery/Trash |
| Edit | Undo/Redo; focus-local selection; bounded edits; independent preset actions |
| View | Show/focus/dock panes; author/play input mode; personal layout presets/reset |
| Tools | Generation/rebalance/naming; supported creation and feature registry; motion/assets; grouped source/JSON; later game-system tools |
| Test | Test draft/normal run/saved scenario; restart; compare/regression; fixture requirements only when relevant |
| Help | Find command; current field/tool explanation; input alternatives; draft/revision lifecycle |

Within groups, put frequent safe work first and destructive/shared-definition
operations last. Ellipsis means additional input/review, not merely a tooltip.
Disabled actions shall retain a visible reason and recovery route. A command
that only opens setup shall not be labelled as having created or saved content.

Ten contextual targets shall have distinct menus using the same renderer:

| Context | Required target-specific actions |
| --- | --- |
| Single card | Inspect/edit, usages, duplicate, add to starter or deck, test, export, custom-definition Trash |
| Multiple selected cards | Review N/hidden IDs, edit/rebalance N, add N, export N, impact-reviewed Trash |
| Deck entry | Inspect shared definition, copies, copy/replace membership, remove from this deck, copy stable ID |
| Starter entry | Entry actions plus composition validation/test; remove from starter preserves definition |
| Deck/starter collection | Open composition, test, compare, rename/duplicate where supported, export composition/dependencies |
| Feature definition | Inspect/usages, supported template/scoring/binding, archive/restore, registry export |
| Supported setting | Explain, copy value/path, stage default, revert field, save section preset |
| Generated batch | Recipe/seed/misses, select/compare, retry failures, accept reviewed output, separate recipe/content export, removal |
| Empty collection space | Search/select matching, create supported definition, import, generate into explicit destination |
| Recorded runtime event | Actual receipt, owning definition, Why this animation, supported replay, comparison, receipt ID |

Right-clicking a selected item preserves multiselection. For an unselected item,
retain the selection and distinguish This card from N selected in action labels;
do not silently retarget a batch. Freeze/revalidate IDs when opening review.

Routine fields/settings shall stay in contextual panes. Exceptional Add to
starter/deck, import/conflict, archive impact, advanced constraints, preset-save,
source-save review, launch review and Trash restore may use one shared dialog.
At most one contextual modal shall be open, with maximum depth one.

Opening sequence: invoke → capture scope/context → close menu/submenu → open
dialog → validate/review inline → Apply or Cancel → restore invoking focus.
Conflict and missing-reference steps are subviews of the same dialog, not nested
modals. Missing prerequisites normally use inline blocked panels.
Native file choosers are external steps and shall be counted separately.
Cancel precedes the primary action consistently and discards dialog-only edits.
Add to deck/list and Add to class starter require distinct destination semantics;
neither shall pretend that collection membership installs a starter.

## 5. Collection selection, sorting, bulk changes and drag

Click selects and populates the persistent inspector; explicit Edit/double-click
focuses editing. Ctrl/platform-equivalent toggles, Shift selects a displayed-order
range, and Ctrl+Shift adds a range. Preserve stable-ID membership through sorting,
editing and virtualization; the next range uses current display order and anchor.

In collection-navigation focus, Ctrl+A selects all matching in the active
collection, not only mounted rows. In a text/number editor it selects text.
Escape cancels the active drag/menu/dialog or field edit before clearing the
collection selection. Provide visible select visible/matching, invert, clear and
show-selected commands; rectangle selection is an optional later accelerator.

Show selected, hidden-selected, visible, matching and affected counts. Filtering
must neither silently add matching records nor erase hidden selections. Review
scope before mutation and restore only surviving IDs after deletion/reload.

Sort by CP, name, stable ID, type, rank, rarity, costs and supported taxonomy.
Provide direction, stable tie-break, optional secondary sort and independent
group/filter controls. Search names, IDs, tags, effects and descriptions with
truthful hints. Persist sort/filter/columns/scroll per collection/view.

Bulk editing shall show mixed values, compatible/excluded records and before/after
values. Support set/add/subtract/percentage transforms only for compatible typed
fields. Mixed/blank never means zero. Only explicitly edited properties change;
adding/removing one trait preserves unrelated traits. Preview exact frozen IDs,
reject invalid output or require an explicit documented skip policy, and commit
one reversible transaction. Copy one current property to selection is separate
from replacing whole definitions.

Dragging transfers the entire reviewed selection with a cards/copies badge,
valid/invalid target reasons, destination/quantity preview and edge autoscroll.
Differentiate Add references, Move membership and Duplicate definitions in words.
Default library-to-list behavior adds references. Manual reorder must explicitly
activate Manual order; a CP-sorted view is not authored order. Preserve relative
order of moved blocks and ordered effects. Hover/autoscroll changes no content.
Escape/invalid/outside-drop commits nothing. One Undo restores memberships,
quantities and order; menu/keyboard/touch alternatives must perform the same job.

## 6. Content, decks and supported game settings

Common card fields shall remain beside the native preview: name/stable ID,
type/class eligibility, SP/MP/HP costs, target/range, Camp, School, Tradition,
Stance, ordered effects, generated description and score receipt.
Resolve vocabulary/availability from the active profile; do not confuse
Martial/Magic camp with elemental school or Arcane/Divine tradition.
Editing one identity dimension shall preserve other authored dimensions while
explaining any derived scaling, eligibility, pricing or presentation consequence.

Duplicate from supported templates with new stable identity and explicit
inheritance/overrides. Effects use typed supported Trigger → Conditions → Targets
→ Effects → Duration/Stacking composition, with order, units, caps and exclusions.
Keep automatic text bound to mechanics; clearly distinguish manual text overrides.

Deck building shall keep library and active composition together with a persistent
Library/Decks/Starters/Recent outline. Inline minus/quantity/plus, reference picker
and replace-with-retained-quantity reduce repeated manager hops. Show total,
resource curve, tradition distribution, restrictions and equipment-granted cards.
Validate missing definitions, copies, effects, affordability and compatible class.
Starter regeneration shall preview a recipe's size, copy limits, type/school mix,
allowed cards and retained entries before replacing composition. Starter
eligibility is separate from weighted likelihood in reward/shop offers.

Separate definition identity, library membership, class eligibility, reward-pool
eligibility and starter entries. Removing a deck entry preserves the definition
and other memberships. Shared-definition edits expose usages. Named variants,
snapshots and comparison shall not mutate a pinned ordinary run.

Game Setup shall show selected profile/modules, authored owner, resolved value,
overrides, capability requirements and application timing. A pack edit shadowed
by a module binding must explain why it is ineffective. Unsupported modules or
options remain unavailable with a reason; tags cannot enable a module implicitly.

Broader editors shall follow the same validated ownership/consumer path: reward
eligibility and offer cadence; loot/drop weighting; shop prices/stock/economy;
enemy authored stats/budgets and move/repetition rules; encounters/tier pools;
progression/class unlocks and difficulty; map quotas/constraints; items/events and
localized labels. Expose inputs instead of overwritten derived values. No
universal win-rate target or automatic balance approval is introduced.
Where supported, show per-act rank/card eligibility and rank/rarity odds by
source (ordinary rewards, shops, events, elites and bosses), explicit pinned
inclusions/exclusions and seeded sample offers. Keep probability and eligibility
separate, and identify the actual owning consumer before exposing a field.

## 7. Generation, rebalance, names and presets

Generation shall have one discoverable entry with simple/distribution modes and
explicit add/replace/destination semantics. Expose count, school/camp, rank/rarity,
cost/type/range distribution, allowed effects/statuses/keywords and constraints.
Distinguish Replace generated only (preserve hand-authored entries), Replace all
in this explicit collection, and Add. Each policy previews affected IDs,
references and exclusions and remains reversible. Weighted distributions include
supported effect counts (for example one/two/three), keyword, drawback and area
odds; unavailable combinations are blocked rather than silently approximated.
Show Requested → Planned → Generated totals and precedence; an overridden Total
field must not contradict effective school/count allocations.

Seed and complete input/weight/template/provider versions form the reproducibility
receipt. Repeating a recipe shall preserve decisions without overwriting unrelated
IDs. Distinguish changed weight models from changed rank-distribution recipes.
Preview before acceptance; exact mode must meet constraints or identify misses.
Best effort requires an explicit policy, actual values, reasons and repair/retry.
Retry failures only; auto-select/filter an accepted new batch without losing its
recipe and destination. Never conceal a miss by pinning CP or dropping upgrades.

Rebalance shall distinguish current, selected, filtered, deck/class and whole-pool
scope. Do not silently broaden an unavailable or empty selection to All Cards.
Allow explicit locks for identity, names, costs, effects and upgrades. Preserve
constraints and preferences as declared, show original/staged changes, and make
Preview separate from Apply. Quota/target infeasibility requires explanation.
Keep score-only weight tuning distinct from a mechanical content rebalance.

Naming shall be reachable from rename, generation and rebalance. Distinguish
Rename once from persistent Auto-name. Preserve manual names unless explicitly
included. Preview dictionaries/component order, rank/upgrade parts, maximum
length, dropped components, duplicate/collision risk and mandatory-part overflow.
An impossible limit requires a designer decision, not silent truncation.
Names may change without changing IDs or references; Undo restores prior names.
Expose per-component keep/drop priority and range-sensitive base-word rules
(for example Strike/Shot, Touch/Bolt and Cleave/Wave), using the active profile's
vocabulary. A numeric example limit is not a universal fixed character cap.

For each tool and section, distinguish Factory defaults, Project default, Named
preset and Last used. Cards/Items, generation/batch/rebalance/naming settings are
independent. Provide Save as, Load, Set default, Reset default, active name and
dirty-preset indication. Presets declare included fields and exclusions; loading
a recipe shall not silently replace the current selection or stable identities.

Remember successful operation settings according to a published state policy.
Cancel discards operation-only edits; intentional draft settings remain visibly
staged until Apply. Reopen, browser reload and application restart are separate
persistence checks. Export recipe settings separately from resulting content;
section presets and their JSON shall round-trip without importing unrelated data.

## 8. Feature registry and mechanic boundaries

Use a searchable catalogue with All/Active/Archived, kind, score structure,
runtime capability, usages and validation. Separate three linked records:

| Record | Designer-editable supported data | Engineering boundary |
| --- | --- | --- |
| Definition | Stable ID, label, aliases, description, category, lifecycle, typed template parameters | Identity migration, new schema kinds |
| Scoring rule | Supported flat/per-unit/additive/multiplier/conditional structure, coefficients, units, caps, applicability and explanation | New evaluators/operators, changed evaluation ordering |
| Runtime binding | Declared provider/version, parameter/target/timing/stacking map, restrictions and dependencies | New effect semantics, dispatch adapters and safety behavior |

An active score-only definition shall say Scoring only. Missing providers shall
say Unsupported/Engine support required; never silently execute a no-op.
Show worked score receipts separately from actual behavior receipts. Validate
units, bounds, recursion, condition cycles, stacking/order and target legality.
For an exposed multiplier, offer a flat/additive alternative when the scoring
provider supports it; show the changed calculation and do not imply mechanical
equivalence or fabricate an unsupported evaluator.

Hide in my view is personal; Archive for new authoring hides active pickers while
preserving referenced definitions/rules/bindings; Restore returns the same ID.
Disable gameplay requires an actual supported switch and dependency review.
Delete is reserved for unused records with recoverable history. Bulk lifecycle
and restriction changes use the same impact graph and transaction rules.

Registry import/export shall include versioned definitions, scoring, bindings,
restrictions, archived records and explicit migrations. Preview all references in
cards/upgrades, enemies, rewards, starters, naming, presets and scenarios. Retain
pre-migration snapshots and reversible maps; a reverse migration shall review
later edits rather than overwrite them. Never silently migrate ordinary saves.

## 9. Native appearance, motion, assets and tool reuse

Reuse native card rendering for frame/art crop/masks, typography, cost/tag/rank
symbols and dynamic rules text. Shared template versus selected override scope
shall be explicit, with affected-card preview. Support layers/groups, anchors,
snapping and approved asset references without painting mechanics into an image.
Verify hand/inspection/list/reward/phone sizes, long/localized text, dense effects,
contrast and symbol fallback. Editable design export differs from flattened art.

Motion editing shall separate clip library and matching rules. Tracks may cover
actor anticipation/action/recovery, projectile/trail, impact/reaction, statuses,
card/UI, audio and camera where providers exist. Declare duration/easing, anchors,
layering, sequential/parallel overlap, finish/interrupt/queue/skip/reset policy,
affected properties and reduced-motion fallback. Native scene preview is required.

Rules use declared event phases, required-all/any/excluded tags, class/loadout,
source/target/outcome and explicit priority/override/fallback. Explain Why matched,
conflicts, dead rules and missing coverage. Version the rule policy; do not
silently replace a live first-match resolver with a new specificity algorithm.
Resolve one main actor action per channel with independent layered cues.
Spell + Attack stance must not force a sword action or duplicate a primary cast.
Counter preparation/trigger and status apply/update/remove remain distinct phases.

Presentation consumes resolved semantic events. Clip FPS, cue markers, sound
completion and render speed cannot determine damage, payment, targets, statuses
or RNG. Changing mechanical resolution timing requires separate engine work.
Interruption/replay/scene exit must clean owned particles/audio/camera/layers.
Respect class-default weapon/art policy and honest per-class fallback coverage.

Asset tools shall support approved frames/PNG sheets and explicitly supported
atlas subsets, ordered slices/durations, trim/padding/logical bounds, pivots,
floor/root/hand/muzzle/hit anchors, scene scale, facing and per-frame exceptions.
Provide frame strip, onion skin, ground/checkerboard, duration/loop controls and
keyboard alternatives. Reimport preserves logical anchors; cosmetic coordinates
never redefine gameplay targeting. Review class/equipment/action/facing coverage.

Retain original inputs, provenance, source/adapter versions and hashes. Use fresh
staging, explicit transformations and reversible replacement by stable ID.
Do not mutate pinned art caches or treat unreviewed output as approved coverage.
An asset proposal/export is not publication; follow [Art authoring](ART-AUTHORING.md).

Prefer focused adapters/deep links over rebuilding full tools. Existing card-layer
tools, permitted HUD tokens and [recipient effects](RECIPIENT-EFFECTS.md) are reuse
candidates, not proof of integration readiness. [Card animation mapping](ai/json-game-modules/CARD-ANIMATION-MAPPING.md)
owns documented live/inspection family sharing and fallbacks; [HUD token guide](hud-layout-tokens.md)
defines the permitted presentation subset. Specimen scenes are not live navigation.
Archived Pose/Workbench suites require availability/compatibility checks before use.
External frame/atlas/effect tools require a scoped format adapter and licensing
review, not copying proprietary editors or adopting an unnecessary new runtime.

Adapters shall declare inputs/outputs, ownership, schema/provider versions,
revision, read-only/proposal/source-writing mode and side effects. A download
command must not implicitly save source. Return a reviewed diff to the same
canonical draft; reject stale tool output and restore originating context.

## 10. Actual local game and meaningful experiments

Start normal run and Start scenario shall load the actual local game with its
engine and renderer. A separate combat simulator, score calculation, static card
or synthetic effect sample cannot replace this acceptance path.
Show runtime/profile/content/art identity and effective candidate values after
host acknowledgement, not merely the requested filename or successful build.

Use isolated test storage and explicit temporary unlocks. Normal run follows
ordinary setup, routes, rewards, shops, rests, saving and progression. Card Lab
provides a bounded real-runtime fixture; Encounter Lab expands supported actors,
intents, positions, defenses and statuses. Default Practice pays legal costs.
Training exceptions such as forced hand/unlimited resources shall be visible and
recorded; they never alter ordinary progress or prove normal affordability.

Scenario data may configure supported class/equipment/stats/resources, piles,
turn, seed and enemies/intent/status conditions. Validate coherent instance IDs,
legal capacities, trigger state and compatible providers. Overrides stay separate
from shared card/enemy defaults. Save/restart the same fixture and action recipe.

Coverage shall include single/group targets, AoE/multihit, defenses/resistance,
exactly affordable/unaffordable costs, low-health/kill transitions, reactions,
status stack/refresh/expiry/cleanse, draw/discard/exhaust/retain, multi-turn cycling,
class/equipment compatibility, presentation stress and campaign transitions.
Observe target clarity, pacing, anticipation/impact/recovery, resource tradeoffs
and readability alongside CP/outcomes. Human feel notes are not automated passes.

Pause, Step game action and Step presentation frame are distinct. Replay requires
a supported checkpoint/reset; arbitrary backwards game-state scrubbing is not
promised. Baseline/candidate trials record both revisions, same initial fixture,
seed and legal action sequence. Changed mechanics may legitimately change RNG
usage/results; presentation-only variants shall preserve semantic game state.

Receipts shall correlate action/entity IDs, paid cost, eligibility/target,
hit/defense/status facts and presentation choices. Diagnostics must not consume
RNG, rerun effects or change outcomes. Mark synthetic sample receipts and untaken
tests explicitly. Changed content invalidates relevant evidence without deleting
historical observations. Return to the same document/selection after play.

## 11. Transactions, timing, persistence and background jobs

Separate recoverable draft, unapplied stage, applied authoring state, saved
bundle/source, loaded runtime revision and tested revision. Show stale tests and
differences between Authored → Resolved → Loaded. Save/Export/Apply/Test/source
write commands shall name their exact scope and destination.

Application timing is field-specific, as documented in [Manual editing](MANUAL-EDITING.md#which-changes-reach-an-existing-run):

| Lifetime | Editor obligation |
| --- | --- |
| Run profile/module content | Preserve compatible saved pins; explain fresh-run application and effective overrides |
| Saved/active-fight snapshots | Validate saved rules, paid actions and RNG; runtime identity may constrain restoration |
| Permitted live framework tuning | Respect documented compatible resumed-fight effects; do not falsely call every field new-run-only |
| Presentation/device settings | Separate authored defaults, device overrides and personal accessibility settings from gameplay pins |

Whole-project/section imports shall preflight schema, duplicates, providers,
references, asset availability, dependency impact, source revisions and migrations.
Offer explicit Merge / Replace section / Duplicate-with-new-IDs where valid.
Keep original bytes and pre-import snapshot; rejected/cancelled imports change
nothing. Preserve unrelated fields and concurrent edits. Generated content,
locks and summaries remain compiler outputs, not editable alternate authorities.

Undo/Redo shall name one atomic action and restore definitions, values, names,
memberships, quantities, ordering and relationships together. Custom-definition
Trash is recoverable and distinct from membership removal. Optional empty-list
cleanup is explicit. Reopening/reloading/restarting shall not turn an unapplied
preview into committed content or reroll an already committed game action.

Long generation, rebalance, validation, import and build tasks shall run as
independent pane jobs. Inputs include operation ID, source/candidate revision,
recipe/provider versions and frozen target IDs. Keep progress, errors, retry and
Cancel near the affected pane, without blocking unrelated work or stealing focus.
Retain the last valid preview and field values after failure.

Compute into staging. Cancel before commit discards output; commit is indivisible
and after it recovery is Undo, not a false cancellation. Late/stale results cannot
overwrite newer edits; recompute or explicitly reconcile. Source writers must
respect shared build locks and revision guards. Recover pending inputs and job
receipts after interruption but never auto-apply recovered results.

## 12. Coverage of the 180 interaction requirements

The consolidated requirements preserve all original checklist concept groups.
The ranges are traceability labels, not claims of implemented or tested controls.

| Checklist range | Contract in this specification |
| --- | --- |
| 1–12 Selection | Stable IDs, displayed range/modifiers, hidden counts, focus-local input, explicit Edit (§5) |
| 13–22 Bulk | Mixed values, supported transforms, preserve unrelated traits, exact scope, atomic Undo (§5) |
| 23–36 Drag/drop | Whole selection, badges/targets/copies, copy/move/reference, manual order, cancel, Trash, alternatives (§5) |
| 37–48 Sort/filter | CP/name/ID/type/rank/rarity/cost/taxonomy, tie-break/group/filter/search and saved views (§5) |
| 49–60 Context menus | Ten target kinds, count-aware verbs, availability and keyboard/touch parity (§4) |
| 61–72 Decks/starters | Two-pane composition, quantities, arbitrary supported references, validation/variants/usages (§6) |
| 73–84 Generation | Unified entry, destination, quotas/recipes/sections, seed, misses/retry, accepted-batch context (§7) |
| 85–94 Rebalance | Explicit scope, locks, remembered constraints, receipts, feasibility and separate recipe export (§7) |
| 95–102 Naming | Discoverability, once/auto, limits/priority, collisions/manual locks, presets and restoration (§7) |
| 103–118 Features | Catalogue, definitions/scoring/bindings, lifecycle, restrictions, migrations and behavior proof (§8) |
| 119–127 Defaults/memory | Independent last/default/named/factory, dirty state, Cancel/reopen/reload and lifecycle (§7, §11) |
| 128–136 Local testing | Exact installation/revision, normal/scenario/labs, restart/isolation/comparison/regressions (§10) |
| 137–150 Layout/accessibility | Parent docking, persistent inspector, compact table/gallery, shallow surfaces/help/search (§2–5) |
| 151–160 Recovery/integrity | Atomic history/Trash/import, ownership, interruption/conflicts and named revisions (§11) |
| 161–170 Broader authoring | Validated settings/rewards/enemies/progression/maps/supporting content and field timing (§6, §11) |
| 171–180 Acceptance | Measured interaction/context cost, scale, scope/history, cross-tool agreement and real consumption (§15) |

## 13. Required wireframe work groups

These 34 groups are the design inventory. Each requires parent-compatible
placement/component/command/surface JSON and review against §14; one group may
reuse several shared pane variants. They are not 34 independent pages or a
requirement to finish all designs before the first useful delivery.

| ID | Priority | Required design and remaining acceptance focus |
| --- | --- | --- |
| WF-P01 | P0 | Parent docking/floating/sizing/auto-hide; reachable restore and input alternatives |
| WF-P02 | P0 | Shared document/JSON/code; one draft/history, invalid buffers and reviewed writes |
| WF-P03 | P0 | Per-pane jobs/errors/cancel/stale/recovery; no partial commit |
| WF-P04 | P0 | Main/context/pane-title menus; deliberate order, target/count and input parity |
| WF-P05 | P0 | Shared dialog shells/opening; close menu first, inline subviews and focus return |
| WF-P06 | P0 | Parent/child/interfaces/registry; permitted overrides and deterministic validation |
| WF-C01 | P0 | Collection/selection/card inspector; hidden IDs, sort and independent taxonomy |
| WF-C02 | P0 | Supported effects/costs/targets/text; ordered composition and invalid combinations |
| WF-C03 | P1 | Native appearance/layers; shared/per-card overrides and affected-card review |
| WF-C04 | P0 | Long text/narrow/touch/alternate sizes; shared reflow and accessible actions |
| WF-M01 | P1 | Scoring terms/typed formula parameters; units, worked receipts and mechanical distinction |
| WF-M02 | P1 | Feature catalogue/templates/archive/usages; bulk restrictions and reversible migration |
| WF-M03 | P1 | Supported mechanic bindings; trigger/condition/target/effect/duration and provider blockers |
| WF-M04 | P1 | Distinct generation/rebalance/naming/recipe/compare pane contents and result honesty |
| WF-D01 | P0 | Two-pane deck/starter; quantities/replacement, definitions versus membership |
| WF-D02 | P0 | Profile/module/effective settings; owning source, overrides and field timing |
| WF-D03 | P0 | Class/unlock/resources; isolated setup and current canonical starter resolution |
| WF-D04 | P0 | Import/merge/conflicts/history/source-save review and lossless recovery |
| WF-N01 | P1 | Existing production effect timing/tracks/cues; interruption and actual action linkage |
| WF-N02 | P2 | Tag-to-animation rules; override/fallback/conflict/Why matched and policy version |
| WF-N03 | P2 | Expanded audio/camera/UI feedback and reduced-motion variants |
| WF-A01 | P2 | Asset library/import/provenance; supported format and fresh staging |
| WF-A02 | P2 | Frame slicing/timing/anchors/onion skin; logical bounds and duration preservation |
| WF-A03 | P2 | Class/equipment/action coverage, honest fallbacks and replacement usages |
| WF-T01 | P0 | Actual-game launch review/normal run; candidate acknowledgement and entry path |
| WF-T02 | P0 bounded | One paid real-runtime Card Lab fixture; wider hand/pile controls follow in P1 |
| WF-T03 | P1 | Encounter Lab actors/intents/position/defenses/statuses with coherent setup |
| WF-T04 | P1 | Actual events, action/frame step, supported replay and matched comparison |
| WF-T05 | P1 | Regression packs/observations, large jobs and reproducible evidence |
| WF-G01 | P2 | Rewards/loot/economy inspector/table variants with actual consumer proof |
| WF-G02 | P2 | Enemy stats/moves/encounter variants and opt-in/derived-stat visibility |
| WF-G03 | P2 | Progression/class unlock/difficulty variants with save-timing clarity |
| WF-G04 | P2 | Routes/map constraints/seeded native preview and infeasibility |
| WF-G05 | P2 | Items/events/labels/supporting-content variants and declared ownership |

## 14. Review rules: reason and required correction

Each parent/child wireframe and surface shall record these 20 checks as pass,
needs change or unverified, with its reason, correction and evidence. A design
review pass is not browser or gameplay acceptance.

| ID | Rule and reason | Required correction when missing |
| --- | --- | --- |
| DR01 | One parent; repeated navigation loses context | Move tools into shared panes/layout contexts and retain sessions |
| DR02 | Shared definitions; copied UI drifts | Replace duplicates with instances/typed props; mark overrides/usages |
| DR03 | Docking and sizing; tasks need different space | Common pane chrome, dock targets, clamped splitters and keyboard resize |
| DR04 | Floating/movement; tools must remain reachable | Shared in-page controller, redock/off-screen recovery and non-drag path |
| DR05 | Context/pin/hide; fewer tabs must not lose comparisons | Explicit following/pinned context, retained state and visible reopen |
| DR06 | Shared documents; independent editors diverge | One draft/history, parse/schema errors and explicit guarded source writes |
| DR07 | Local async work; long tasks must not freeze/overwrite | Per-pane staging/progress/cancel, last valid preview and stale rejection |
| DR08 | Exact scope; ambiguity mutates unintended content | Freeze IDs; count selected/hidden/affected and name membership semantics |
| DR09 | Ordered menus; unpredictable order increases errors | Shared ordered groups, destructive actions last and one submenu level |
| DR10 | One dialog; stacked chains displace context | Close menu first, inline subviews, consistent footer and focus return |
| DR11 | Prerequisites; plausible UI is not a capability | Exact provider/reference/fixture/compatibility blocker and recovery route |
| DR12 | Honest lifecycle; saved is not loaded/tested | Distinct revision acknowledgements, application timing and stale evidence |
| DR13 | Complete recovery; partial Undo breaks relationships | Atomic inverse records, Trash and pre-import snapshots |
| DR14 | Accessible input/space; hover/drag-only excludes users | Labelled keyboard/touch controls, focus-local keys and unclipped reflow |
| DR15 | Few transitions; saved clicks must preserve information | Common inspector/preview, recent destinations and independent recipes |
| DR16 | Actual-game target; isolated previews miss integration | Real runtime/renderer, revision proof and explicit Training/synthetic labels |
| DR17 | Mechanical/presentation separation; cosmetics cannot rebalance | Resolved semantic events and speed/reduced-motion/interrupt invariance tests |
| DR18 | Machine-readable placement/refs; changes need impact graph | Validate instances, cross-surfaces, schema, cycles and dangling IDs |
| DR19 | Meaningful states; happy-path drawings are incomplete | Shared empty/dirty/invalid/loading/cancelled/stale/blocked content and retry |
| DR20 | Matching evidence; syntax/diagrams prove limited things | Separate static, browser and game results; attach actual conditions/revisions |

## 15. Delivery sequence and acceptance

All entries below are planned gates, not a historical completion report. P0
interaction invariants apply to every first-delivery control; they are not
postponed until bulk tools arrive. Later breadth must not delay the basic useful
card → starter → actual-game loop.

| Milestone | Priority and packages | Exit condition |
| --- | --- | --- |
| M0 Foundation | P0 W01–W03 | Resolve actual owners/runtime; define parent, document/change-set/capability contracts and isolated baseline |
| M1 First complete loop | P0 W04–W09 | Supported card, exact starter, isolated normal/scenario launch, actual paid play, Undo and portable recovery |
| M2 Efficient balance | P1 W10–W16 | Exact selection/drag/bulk, independent recipes, truthful generation/rebalance/names and reproducible variants |
| M3 Supported mechanics | P1 W17–W20 | Catalogue/typed scoring/bindings/lifecycle and registry transfer with real behavior proof |
| M4 Real experiments | P1 W21–W23 | Expanded labs, receipts/step/replay/compare, regression and measured usability |
| M5 Existing visual tools | P1 W24/W25/W28 | Native face, bounded production effects and permitted HUD controls reach actual game |
| M6 Motion/assets | P2 W26/W27/W29 | Rule policy, frames/anchors/coverage and one justified external adapter verified |
| M7 Broader systems | P2 W30–W33 | Each added editor proves its owning data path and actual consumer |

Package identities remain useful for implementation traceability:

| Package | Scope | Package | Scope |
| --- | --- | --- | --- |
| W01 | Running project/effective owners | W02 | Versioned project and atomic change set |
| W03 | Parent shell/shared interaction contracts | W04 | Card identity/costs/supported effects |
| W05 | Collection/exact selection/sort | W06 | Decks/starters/quantities |
| W07 | Actual-game candidate handoff | W08 | Isolated class fixture/scenario |
| W09 | Recovery/history/project handoff | W10 | Multi-card drag/drop |
| W11 | Context commands/bounded bulk | W12 | Independent tool/section presets |
| W13 | Unified honest generation | W14 | Scoped repeatable rebalance |
| W15 | Naming rules/limits/preview | W16 | Variant recall/comparison |
| W17 | Catalogue/archive/restore | W18 | Typed scoring templates |
| W19 | Supported mechanic bindings | W20 | Registry transfer/migration |
| W21 | Expanded actual-game labs | W22 | Receipts/action/frame/replay |
| W23 | Regression/usability/recovery | W24 | Native card appearance |
| W25 | Production effect timing/feedback | W26 | Animation assignment rules |
| W27 | Sprites/anchors/coverage | W28 | Supported HUD/UI appearance |
| W29 | Justified external adapter | W30 | Rewards/loot/economy |
| W31 | Enemies/moves/encounters | W32 | Progression/difficulty |
| W33 | Routes/supporting content | — | — |

Every gate shall record build/runtime/content/art/profile identity, input mode,
viewport/hardware where relevant, exact target IDs, procedure and actual evidence.
The acceptance catalogue consolidates the 64 design use cases without treating
each example as a separate engine feature or duplicating its UI implementation.

| Test | Planned procedure and required result |
| --- | --- |
| AT01 | Resolve authored/resolved/loaded owners and test one pinned, one compatible live and one presentation field; correct timing and acknowledged revision |
| AT02 | Change tradition, school, camp and stance independently; authored diff preserves unrelated fields and actual identity behavior agrees |
| AT03 | Resolve current canonical Starseer starter IDs/copies, inspect actual fresh-run deck and separate equipment grants; historical exact-byte fixture only when explicitly testing that export |
| AT04 | Create/install/play supported custom card; pay costs once, inspect actual hit/status/cue receipts; unsupported multihit binding blocks only that capability |
| AT05 | Generate identifiable 3 × 15 batches, remove only those 45 definitions, Undo/Redo complete relationships and verify chosen actual-game deck |
| AT06 | Range/modifier/filter/sort/context/drag preserve exact IDs; one Undo restores source/destination/copies/order; keyboard/menu alternatives agree |
| AT07 | Different generation/batch Cards/Items/rebalance/naming presets; Cancel/reopen/reload/restart and section round-trips preserve declared independent state |
| AT08 | Three named 15-card recipes with recorded seeds/weights; distinguish quota from weight variants, expose misses, reproduce and actually play accepted content |
| AT09 | Rebalance one intended scope, infeasible then feasible; retain constraints, no broadening, correct recipe export, actual result and Undo |
| AT10 | Short/mandatory/duplicate names, once/auto and manual locks; preview loss/collisions, retain stable IDs and actual displayed identity |
| AT11 | Archive/restore/label rename/scoring disable/gameplay retirement as distinct operations; referencing cards still behave as declared |
| AT12 | Worked typed score templates, units/caps/order and invalid structures; score-only changes do not alter mechanical receipts |
| AT13 | Supported trigger/condition/target/effect/duration plus recursion/invalid-target cases; unavailable methods are rejected, no duplicate/infinite behavior |
| AT14 | Whole/section semantic round-trip; duplicate/missing/provider/schema/stale-source failures and Cancel commit nothing; imported actual fixture agrees |
| AT15 | Shared/native card appearance and selected override at hand/zoom/list/phone with long/localized text; correct bindings and pure export |
| AT16 | Competing spell/Attack/counter/status animation rules; one primary action, correct phases/fallbacks and Why matched in actual game |
| AT17 | Same legal fixture at slow/normal/fast/reduced-motion/skip; equal semantic state/RNG, clean interruption/exit, no duplicate or leaked cues |
| AT18 | Supported frames/atlas metadata round-trip with trim/bounds/durations/anchors; actual scene alignment, honest fallback and no pinned-cache mutation |
| AT19 | Supported lab fixture families with paid/unaffordable/Training cases; actual multi-turn rules and isolated progress remain correct |
| AT20 | Baseline/candidate and supported checkpoint replay; recorded legal actions reproduce same revision, explain legitimate mechanic/RNG differences |
| AT21 | Permitted HUD/feedback values across layouts/input/reduced motion; actual targets, costs, overlays and input routing remain usable |
| AT22 | Cancel large jobs, change inputs during old preview, interrupt/recover; no partial/stale commit or lost draft and valid acknowledged actual-game revision |
| AT23 | Undo/Redo edit/copies/removal/naming/generation/layout/import; relationships and selected content survive reopen/reload/restart and actual play |
| AT24 | Each broader editor changes a known owned value, reaches its actual offer/move/route/etc consumer and restores baseline with correct timing |
| AT25 | Reference 1,000-card and stress 10,000-card fixtures; measure agreed hardware/latency/memory/scroll targets, exact scope and responsive cancellation |
| AT26 | One documented external/supporting adapter subset; retain provenance, review conversions, reject malformed input and prove actual resolver consumption |
| AT27 | Reference workflows through pointer/keyboard/narrow/touch; measure real activations, interfaces, menus, modal depth, scrolling, waits, errors and runtime portions |

Reference workflows shall include one numeric edit, one taxonomy-only edit,
starter installation, normal/scenario launch, selection/bulk cleanup, three-batch
generation, remembered rebalance, naming limits, feature lifecycle/binding and
recoverable import. Add docking/pin/auto-hide/float/recovery to the common parent
checks rather than retesting copied implementations on every child.

Interaction budgets are proposed targets until measured. A visible one-field
edit should need roughly three pointer activations; an already contextualized
starter addition should normally fit one review surface. Count field focus,
dropdown choice and confirmations honestly. Typing, native chooser, gameplay,
waiting, scroll travel and context reconstruction are separate costs. Never hide
scope, validation or necessary consequences to meet a click target.

## 16. Evidence and documentation maintenance

Implementation reports shall distinguish local source/served build from fetched
refs and live hosted state when making repository/deployment claims. Editor
acceptance records shall distinguish planned procedure, static validation,
rendered structural review, browser input verification and actual gameplay.
If browser access is unavailable, report pointer/focus/dock behavior unverified;
do not rename a diagram as a screenshot or a syntax pass as a playtest.

Each delivered child/surface shall retain companion JSON, shared-component usage,
the applicable DR01–DR20 findings/reasons/fixes, target assumptions and actual
validation evidence. Keep bulky HTML/images/raw QA in the appropriate artifacts,
not as alternate normative specs or generated repository bloat.

This spec supersedes duplicated editor-only planning decisions. Remove an older
dated editor plan only after transferring still-relevant requirements and
updating inbound discovery links. Preserve operational/source-owning guides,
gameplay contracts, implementation evidence, archives and unrelated edits.
Deletion is not permission to erase history or remove an existing usable tool.
Keep future changes here focused on editor behavior; update gameplay authority
separately when a requested capability actually changes the game.
