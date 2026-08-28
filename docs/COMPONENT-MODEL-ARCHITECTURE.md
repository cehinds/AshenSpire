# AshenSpire Component Model Architecture

## Outcome

AshenSpire uses a composition/component-based architecture with explicit
presenter and observer-style boundaries for presentation. .NET and Dimitar's
naming and coding practices guide vocabulary and consistency; no .NET runtime,
MVC framework, or MVVM folder structure is required.

Every migrated screen is rendered from immutable Component Models. Screen hosts
serve as presenters: they project domain snapshots, compose models, request DOM
from renderer components, and bind semantic commands. Observer-style adapters
are reserved for lifecycle, refresh, input, and browser events. Domain state
never owns DOM and renderers never decide game rules.

The architecture is intentionally hybrid: Composition/Component-Based is the
core structure, MVP is the presentation role assignment, Observer is the event
notification technique, and JSON/CSV plus data-driven class objects are the
content boundary.

## Layers and dependency direction

```text
Composition Root (`src/main.js`)
├── Headless simulation (`src/engine/`)
│   └── Domain state and contracts (`src/model/`)
├── Data boundary (`src/content/`, `content/source/`)
│   └── JSON/CSV definitions interpreted by reusable rules
├── Transport adapter (`src/net/lan.js`)
└── Screen hosts / presenters (`src/ui/screens/`)
    ├── Screen projections (`src/ui/viewModels/`)
    ├── Component Models (`src/ui/models/`)
    │   └── shared primitive and Behavior Models
    └── DOM components and observer adapters (`src/ui/components/`)
```

Dependencies point toward pure rules and data. Domain code does not import
presentation or browser adapters. Engine code remains headless. Presenters
project snapshots and semantic commands; they do not mutate the Domain
directly. Renderers and observers translate those commands at the DOM boundary.

| Composition/component responsibility | Current home | Boundary |
|---|---|---|
| Domain models and contracts | `src/model/` | Pure state, rules, plans, receipts; no DOM |
| Headless simulation/services | `src/engine/` | Use-case orchestration, RNG, combat, encounters, and saves |
| Content boundary | `src/content/`, `content/source/` | Data-driven class objects, JSON, and CSV; no screen markup |
| Screen presenters | `src/ui/screens/` | Screen composition, projection calls, command/lifecycle binding |
| Presentation projections | `src/ui/viewModels/` | Domain-to-screen composition for migrated slices |
| Component and behavior records | `src/ui/models/` | Frozen, serializable trees and semantic interaction records |
| Views and observer adapters | `src/ui/components/` | DOM rendering, refresh, focus, hold, tooltip, and browser-event seams |
| Composition Root | `src/main.js` | Construction and dependency wiring only |

The current tree is transitional by slice: some screens still own legacy markup
while migrated aggregates use the component boundary. Do not bulk-move those
files. Add one compatibility seam, migrate its consumers, prove the same-door
behavior, and remove the adapter only after repository-wide consumer proof.

## Core invariants

- The renderer is never the source of truth for simulation state.
- Component Models carry data and semantic behavior descriptions, never DOM
  nodes, callbacks, or mutable run objects.
- Presenter code may observe state and translate input, but game rules stay in
  `src/model/` and `src/engine/`.
- Content changes prefer JSON/CSV and reusable interpreters over per-entity
  imperative branches.
- The architecture refresh routine updates only the current-dev inventory; it
  cannot replace this contract or silently change the redesign goals.

## Immutable records

A `ComponentModel` is the JavaScript equivalent of a presentation record:

```js
{
  component,       // stable allowlisted semantic id
  variant,         // named visual/semantic variant
  properties,      // serializable display data
  tokens,          // local configurable presentation tokens
  accessibility,   // labels, roles, live-region intent
  behaviors,       // immutable BehaviorModel records
  children,        // immutable child ComponentModel records
}
```

A `BehaviorModel` declares an interaction without carrying a callback:

```js
{ name, event, command, policy, payload }
```

Views render. Behavior adapters translate semantic commands into callbacks
provided by the screen host. This keeps models serializable, inspectable,
testable, and independent of the browser.

## Reference aggregate: Shared Run HUD

```text
RunHudViewModel
├── RunHeaderModel
│   ├── IdentityClusterModel
│   │   ├── PortraitBadgeModel
│   │   └── CharacterTitleModel
│   ├── CindersCounterModel
│   └── BuildMetadataTrailModel
│       └── MetadataFieldModel × 5
├── PrimaryHudRowModel
│   ├── VitalsPanelModel
│   │   └── ResourceMeterModel
│   └── QuickAccessPanelModel
│       ├── ActionControlModel × 2
│       └── ChargeFlaskControlModel × 2
└── InventoryBeltModel
    └── ItemTrayModel × 2
```

Map and Combat create the same `RunHudViewModel` and render it through the same
View. Screen-specific state is projected into properties; no alternate markup
path is retained.

## Implemented aggregates: Menu and Armoury

The in-run menu and Armoury now use the same three-part presentation boundary:

```text
Screen host / controller
   ├─ projects immutable Component Models from display data
   ├─ asks renderer components for DOM
   └─ binds domain commands and lifecycle callbacks
```

```text
MenuModels.js                         ArmouryModels.js
├─ QuickMenuPanelModel               ├─ ArmouryOverlayModel
│  ├─ QuickMenuCaptionModel          │  └─ ArmouryPanelModel
│  └─ QuickMenuRowModel × N          │     ├─ ArmouryHeaderModel
└─ MenuOverlayModel                  │     │  └─ ArmouryViewSwitcherModel
   ├─ MenuTabStripModel              │     ├─ ArmouryBodyModel
   │  └─ MenuTabModel × N            │     ├─ ArmouryInventoryModel
   └─ MenuPanelModel                 │     ├─ ArmouryStatsPanelModel
                                     │     └─ ArmouryCardStripModel
                                     ├─ EquipmentSlotModel
                                     │  └─ EquipmentSetCellModel × N
                                     ├─ InventoryItemCardModel
                                     └─ InventoryDetailCardModel
```

`menuComponents.js` owns the extracted menu markup.
`armouryComponents.js` owns the Armoury shell, inventory-card, equipment-slot,
semantic marker, and accessibility markup that has migrated. `equipment.js`
remains the composition host and still renders domain-specific Character,
Armaments, Cards, Stats, and receipt content while binding lifecycle and domain
commands. Those screen-owned fragments are not a second implementation of the
extracted shell or inventory cards. Presentation Models import neither the DOM
nor simulation state, and all properties remain serializable and deeply
frozen.

## Shared Folding Tray aggregate

Armaments, Inventory, Cards, and Stats no longer author separate disclosure
headers. Each mounted instance uses the edge-aware presentation aggregate:

```text
trayModel → Folding Tray Component Model
├─ trayHeaderModel
│  └─ toggle behavior + optional sort behavior
└─ trayContentModel
   └─ caller-owned Component Models × N
```

The `trayModel` factory owns the stable id, name, edge, expanded state, total
quantity, item-type noun, optional sort intent, and resize contract.
`trayComponents.renderTray` owns the shared header, directional arrow,
`aria-expanded`/`aria-controls`, content host, edge classes, and the sort and
resize affordances when the model opts into them; those affordances render only
while expanded. `TraySizeService` remembers the expanded size by stable tray id
and edge for resizable instances; folded rendering ignores that size, and
reopening restores it. Domain-specific item behavior stays with the item models. The full
Top/Right/Bottom/Left contract is in `docs/TRAY-COMPONENTS.md`.

Inventory cards use one additional reusable capability boundary. The
`inventoryItem` class in `armouryUi.json` explicitly enables `holdAction`.
`inventoryItemCardModel` and `inventoryDetailCardModel` project the same flag to
the folded face and expanded reveal; the shared hold-confirm binder delegates
one progress state to both visible regions. Comparison is a separate semantic
child whose tooltip/inline presentation is data-owned, so reading a comparison
cannot become a second action path.

Equipment-driven attack cards use the same model/service boundary. The pure
`WeaponDeckCompositionService.buildEquippedWeaponCardPlan()` projects equipped hand models into
an immutable `EquippedWeaponCardPlan`; `applyEquippedWeaponCardPlan()` rebinds only the stable
generated attack instances. Screens consume the resulting comparison/card-strip models and issue
semantic equipment commands; they do not select weapon packages or resize the deck. One
post-commit `equipmentChanged` event carries the loadout signatures and changed positions so
combat, save, and future presentation consumers share the same transition instead of adding
Rogue-, weapon-, or screen-specific controllers.

Exact combat restoration stays on this same boundary: after the existing snapshot shape and
reference validators accept the stored record, save migration composes one plan from the
snapshot's authoritative loadout and applies it to the combined `draw`/`hand`/`discard`/`exhaust`
attack instances. The result replaces the stale top-level loadout projection before resume. No
snapshot-specific package rules, renderer controller, or second composition service exists.

## Migration order

1. Contracts, validators, renderer registry, and behavior binder.
2. Shared Run HUD vertical slice.
3. Resource, flask, tooltip, refusal, hold, and disclosure primitives.
4. Card, combatant, hand, map board, and equipment receipt components.
5. Low-risk leaf Views: About, Controls, History, Game Over, Profile.
6. Transactional Views: Draft, Event, Reward, Shrine, Shop, Settings.
7. Composed forms: Character Creation, Custom Run, Lobby, Compendium, Armoury.
8. Map and Combat compositions, then Co-op last.
9. Remove compatibility adapters only after repository-wide consumer proof.

Each phase is independently shippable and must preserve visual behavior,
keyboard/gamepad semantics, save compatibility, and exact-head browser evidence.
