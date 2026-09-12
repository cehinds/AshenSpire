> Current authority: [CURRENT-SPECIFICATION.md](CURRENT-SPECIFICATION.md). It supersedes conflicting earlier iteration notes. Documentation only.

# AshenSpire refactor handoff

**Complete current document: [wireframe.md](wireframe.md).** It combines every W0-based screen and WC0-based card with parent/child ordering, Wide/Compact/Vertical ASCII, named component vh/vw allocations, and language-agnostic pseudocode. Screen hierarchy: W0 → four families → 32 children. Card hierarchy: WC0 → playing/possession/creation families → children and child-of-child variants. Construction is tag-driven through validated registries and normalized rule tables. [Card-only view](card-wireframes.md), [construction contract](CARD-CONSTRUCTION-CONTRACT.md), and [size/naming contract](COMPONENT-SIZING.md) provide focused references.

Document refresh order: run `generate-card-wireframes.mjs`, then `generate-responsive-wireframes.mjs` from this package. These generate planning documents only, not game code or game content. `wireframe-pseudocode.mjs` and `wireframe-dimensions.mjs` supply the per-entry pseudocode and dimension tables; keep them in the handoff bundle.

[Shared palette and interaction contract](COLOR-INTERACTION-CONTRACT.md): five configurable palette sections, red exit/back highlight, green ready/selected primary actions, brown/gold neutral states, explicit exceptions, normalized schema, and single-row-first typography rules.

W0 fixes placement for every descendant: title top-left, × top-right, Close/Back bottom-left, Primary bottom-right, with consistent shared padding. Components may be omitted when inapplicable. Exactly one footer button fills the usable footer width; two retain their corner roles; no actions means no empty footer. These rules are drawn in the responsive catalog and specified in the execution plan.

**Start with [the ordered ASCII wireframes](RESPONSIVE-WIREFRAMES.md).** W0 is the master shell, followed by four inheriting parents: W1 Workspace/modal, W2 Confirmation, W3 Main menu, W4 Gameplay/encounter. Each parent is followed immediately by its lettered children. Every parent and child has separate Wide, Compact, and Vertical/Mobile ASCII drawings, in that order. W1a = Settings, W1b = Town, W1c = Character Creation. The catalog contains 32 children and 111 drawings total (including W0); `wireframe-catalog.json` records the hierarchy. Children share their parent's bones/effects and supply view-model variations.

This package covers the complete requested scope: architecture, data/tag-driven configuration, 3NF entity schemas, shared models and behaviors, and frontend redesign/wireframes with minimal unnecessary px and subtitle stacking.

Read in this order:

**Latest visual set:** [Three responsive views per wireframe](RESPONSIVE-WIREFRAMES.md) — wide landscape, compact landscape, and vertical portrait. Includes the revised low-scroll character creation and 10% HUD / 60% map / 20% details / 10% bottom HUD map layout (map ≈95% viewport width).

1. [Execution plan](EXECUTION-PLAN.md): ownership rules, 3NF/schema contracts, language-agnostic pseudocode, ordered tasks, file/symbol/line entry points, migration rules, tests, and a pasteable executor prompt.
2. [Frontend wireframes](FRONTEND-WIREFRAMES.md): four parent families and reusable body variants, wide/compact wireframes, screen mapping, units/scaling policy, frontend schema additions, copy/state rules, and exact editing responsibilities.
3. [Source map](source-map.json): 289 files with working-tree hashes and declaration line anchors. Revalidate against current dev before implementation.
4. [Existing local changes](pre-existing-changes.txt): planning-time changes already present in the repository. Do not overwrite these or assume they belong to this refactor.

## What the package establishes

| Owner request | Where it is specified |
|---|---|
| Models, view models, shared methods and stable architecture | Execution sections 4, 6, Tasks 04–13 |
| Context-based modals with consistent behavior | Execution Tasks 03–07 and modal lifecycle pseudocode |
| JSON/CSV/database-compatible authoring | Execution Tasks 02–03, 14 and ingestion pseudocode |
| Tag-driven capabilities and shared queries | Execution sections 5–6 and Task 03 |
| Third normal form | Execution section 5, Task 01, per-family mappings in Task 14 |
| Frontend redesign and consistent wireframes | Frontend sections 1–4 and execution Task 04A |
| Minimize px without breaking scaling/input | Frontend section 2 and exception audit |
| Very little redundant subtitle stacking | Frontend sections 1, 3, 6–7 |
| Precise handoff to another executor | Task prerequisites, existing/new file distinctions, symbol anchors, pseudocode, acceptance gates and executor prompt |

## Boundaries

W0 is the master shell; W1 is its workspace variant. Settings, Character Creation, Town, Shop, and Armoury share one header/navigation/body/footer renderer; different view models supply content. Town has no separate scene/HUD band above this frame. selection body/inspection body/choice body are reusable bodies, and single-category variants omit the rail.

Owner extensions are included: section 9 adds Main Menu, Character Creation, New Game/Load/Save/Delete/Replace, Map, Town, and voiced quest dialogue with player portrait left/NPC portrait right and Continue/Skip/Back. Task 09A covers the new town/dialogue specification and implementation. All multi-category menus use W1. The combat footer order is Actions → Draw → End Turn → Discard/Exhaust → Potions, with the specified raised/faded/green states.

Consolidation: these flows reuse the shared wireframe families with different view models; do not build a separate layout for each drawing. The main-menu title stays screen-centered, with Profile top-right. The menu is centered by default; highlighting available Continue reveals the matching save preview and moves only the menu region left (preview below on compact screens). One view model/renderer handles both states.

This is a source-grounded execution specification. No game code was changed and no implementation tests/browser visual checks were run for this planning package. It does not claim a completed field-level audit of every content family. Required mapping tasks are explicit prerequisites to their conversions; an executor must complete them rather than invent a field's meaning.

The proposed schemas and wireframes are implementation targets. Placeholder example IDs/values are marked and must be replaced with verified existing data. Database export compatibility is specified; no database vendor, deployment, or live runtime dependency has been chosen.

Do one task at a time. The first implementation task is Task 00, then Task 01. Do not jump directly to moving files or rebuilding all modals. Task 04A is a required prerequisite for modal/layout migration and carries the owner's latest frontend requirements.




