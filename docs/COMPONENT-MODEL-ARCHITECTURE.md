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
