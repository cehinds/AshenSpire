# AshenSpire component catalog

This is the quick-reference library for the reusable UI vocabulary. The visual
catalog is available at [`component-catalog.html`](./component-catalog.html).

Stable IDs live in [`UiComponentId.js`](../src/ui/models/UiComponentId.js). Model
factories live under [`src/ui/models/`](../src/ui/models/) and the shared HUD
projection is [`RunHudViewModel.js`](../src/ui/viewModels/RunHudViewModel.js).

| Component ID | Model / factory | View or renderer | Reuse | Purpose |
|---|---|---|---|---|
| `shared-run-hud` | `runHudViewModel` | `hudmeta.sharedRunHudHtml` | Map + Combat | One shared run HUD composition. |
| `run-header-strip` | `runHeaderModel` | `runHeaderStripHtml` | Map + Combat | Identity, cinders, and prioritized metadata. |
| `identity-cluster` | `identityClusterModel` | `identityClusterHtml` | Map + Combat | Character identity cluster. |
| `portrait-badge` | `componentModel` child | `hudmeta.identityClusterHtml` | Map + Combat | Character glyph/badge. |
| `character-title` | `componentModel` child | `hudmeta.identityClusterHtml` | Map + Combat | Name and class label. |
| `cinders-counter` | `cindersCounterModel` | `cindersCounterHtml` | Map + Combat | Live cinders count. |
| `build-metadata-trail` | `buildMetadataTrailModel` | `buildMetadataTrailHtml` | Map + Combat | Act, floor, seed, build, source. |
| `metadata-field` | `metadataFieldModel` | `hudmeta` metadata spans | Map + Combat | One prioritized metadata field. |
| `primary-hud-row` | `componentModel` composition | `primaryHudRowHtml` | Map + Combat | Vitals and Quick Access row. |
| `panel` | `panelModel` child | Shared panel frame | HUD panels | Common panel semantic/frame component. |
| `vitals-panel` | `vitalsPanelModel` | `vitalsPanelHtml` | Map + Combat | HP, MP, and SP panel. |
| `resource-meter` | `componentModel` child | `resbars.resourceBars` | HUD + combat cards | Data-driven resource trough/fill. |
| `quick-access-panel` | `quickAccessPanelModel` | `quickAccessPanelHtml` | Map + Combat | Armoury, menu, and charge flasks. |
| `action-control` | `actionControlModel` child | `quickAccessPanelHtml` | HUD controls | Shared activation semantics. |
| `hotkey-badge` | `componentModel` semantic ID | View-owned | HUD controls | Configurable key hint badge. |
| `armoury-control` | `actionControlModel` | Quick Access view | Map + Combat | Opens Armoury. |
| `quick-menu-control` | `actionControlModel` | Quick Access view | Map + Combat | Opens quick menu. |
| `crimson-flask-control` | `componentModel` | `flask.flaskPresentation` | Map + Combat | Health charge flask. |
| `azure-flask-control` | `componentModel` | `flask.flaskPresentation` | Map + Combat | Mana charge flask. |
| `inventory-belt` | `inventoryBeltModel` | `inventoryBeltHtml` | Map + Combat | Shared relic/potion belt. |
| `item-tray` | `itemTrayModel` child | Belt view | Inventory | Shared horizontal tray behavior. |
| `item-slot` | `componentModel` semantic ID | Item view | Inventory | Generic item slot contract. |
| `relic-tray` | `itemTrayModel` | Belt view | Map + Combat | Relics under SP. |
| `relic-slot` | `componentModel` semantic ID | Item view | Map + Combat | Individual relic tile. |
| `potion-tray` | `itemTrayModel` | Belt view | Map + Combat | Utility potion tray, right anchored. |
| `potion-control` | `componentModel` semantic ID | Item view | Inventory | Individual utility potion control. |
| `battlefield-stage` | `componentModel` | `combat.js` | Combat | Combat scene/stage host. |
| `combatant-frame` | `combatantFrame` | `combatantFrame.js` | Combat | Shared combatant card geometry. |
| `player-combatant-frame` | `combatantFrame` variant | `combatantFrame.js` | Combat | Player combatant card. |
| `enemy-combatant-frame` | `combatantFrame` variant | `combatantFrame.js` | Combat | Enemy combatant card. |
| `player-hand-tray` | `componentModel` | `combat.js` + `hand.js` | Combat | Player card hand. |
| `combat-action-rail` | `componentModel` | `combat.js` | Combat | End-turn/action controls. |

## Composition at a glance

```text
shared-run-hud
├─ run-header-strip
│  ├─ identity-cluster ── portrait-badge + character-title
│  ├─ cinders-counter
│  └─ build-metadata-trail ── metadata-field × 5
├─ primary-hud-row
│  ├─ vitals-panel ── panel + resource-meter
│  └─ quick-access-panel ── panel + action-control + flasks
└─ inventory-belt
   ├─ relic-tray ── item-tray + relic-slot × N
   └─ potion-tray ── item-tray + potion-control × N
```

Map and Combat mount the same shared HUD model. Combat adds the Battlefield
Stage, Combatant Frames, Player Hand Tray, and Combat Action Rail.

## Merge/PR rule

Any UI element or component change should link this catalog in the merge or PR
summary. If the change alters a stable ID, model/factory, renderer, composition,
or reuse surface, update this catalog and the matching visual miniature before
the merge.

## Current shared HUD tuning

The catalog's shared HUD currently uses a 70% portrait-badge scale, an 8 px
primary-row gap, a 2 px Quick Access card gap, and a 2 px vertical vital-row
gap. These are data-owned in `balance.ui.hudPresentation`, projected once by
`src/main.js`, and consumed by the shared Map/Combat stylesheet.

### Run-header layout contract

```text
┌──────────────────────────── run-header-strip ────────────────────────────┐
│ identity-cluster      cinders-counter       build-metadata-trail          │
│ [◎ NAME · CLASS]          ⛁ 42              ACT 1 · FLOOR 1 · BUILD …    │
│      flexible             ≤ 30vw              ≤ 30vw; hides rightmost     │
└───────────────────────────────────────────────────────────────────────────┘
```

The three columns negotiate inside one grid. `cinders-counter` stays centered;
`build-metadata-trail` is capped and progressively hides Source, Seed, then
Build. `metadataShowTotals` is false by default, so only current Act/Floor are
shown.
