# AshenSpire Component Model Architecture

## Outcome

AshenSpire is migrating toward a .NET-inspired Clean Architecture with an MVVM
presentation layer. Every migrated View is rendered from immutable Component
Models. Models compose other models, including shared primitives and Behavior
Models. Domain state never owns DOM and renderers never decide game rules.

## Layers and dependency direction

```text
Composition Root
      │
      ├── Infrastructure ──implements──► Application Interfaces
      │                                      ▲
      └── Presentation ──uses───────────────┤
                         Application Services ──uses──► Domain Models

Presentation View
      └── Screen ViewModel
            └── Component Models
                  ├── shared primitive Component Models
                  └── Behavior Models
```

Dependencies point inward. Domain code imports none of Application,
Infrastructure, or Presentation. Application Services depend on Domain Models
and Interfaces, not browser adapters. Infrastructure implements Interfaces.
Presentation projects snapshots and semantic commands; it does not mutate the
Domain directly.

| .NET-style responsibility | Current/incremental home | Target responsibility |
|---|---|---|
| Domain Models | `src/model/` | Pure state, rules, plans, receipts |
| Application Interfaces | `src/application/interfaces/` | Storage, audio, clock, navigation, networking ports |
| Application Services | `src/application/services/` | Use-case orchestration over Domain and Interfaces |
| Infrastructure | `src/infrastructure/` | Browser/local-storage/audio/network adapters |
| Presentation Models | `src/ui/models/` | Frozen Component and Behavior records |
| Presentation ViewModels | `src/ui/viewModels/` | Domain-to-screen projection and composition |
| Views | `src/ui/screens/` | Thin screen hosts during migration |
| Components | `src/ui/components/` | DOM renderers only |
| Behaviors | `src/ui/behaviors/` | Command, focus, tooltip, hold, refusal, and lifecycle binders |
| Composition Root | `src/main.js` | Construction and dependency wiring only |

The target folders are introduced only when a migrated slice needs them. Bulk
moves are forbidden; public imports remain compatible until consumers migrate.

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

`menuComponents.js` and `armouryComponents.js` own markup, semantic component
markers, and accessibility attributes. `quicknav.js`, `overlay.js`, and
`equipment.js` remain screen hosts: they own lifecycles and translate semantic
commands into the existing callbacks, but no longer author the extracted
component markup. Presentation Models import neither the DOM nor simulation
state, and all properties remain serializable and deeply frozen.

## Shared Folding Tray aggregate

Inventory, Cards, and Stats no longer author separate disclosure headers. Each
is mounted through the edge-aware presentation aggregate:

```text
trayModel → Folding Tray Component Model
├─ trayHeaderModel
│  └─ toggle behavior + optional sort behavior
└─ trayContentModel
   └─ caller-owned Component Models × N
```

The `trayModel` factory owns the stable id, name, edge, expanded state, total quantity,
item-type noun, and optional sort intent. `trayComponents.renderTray` owns the
shared header, directional arrow, `aria-expanded`/`aria-controls`, content host,
and edge classes. Domain-specific item behavior stays with the item models. The
full Top/Right/Bottom/Left contract is in `docs/TRAY-COMPONENTS.md`.

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
