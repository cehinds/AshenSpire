# AshenSpire component catalog

This is the quick-reference library for the reusable UI vocabulary. The visual
catalog is available at [`component-catalog.html`](./component-catalog.html).
Select any component card there to open its detail drawer. The dedicated
[`tray-gallery.html`](./tray-gallery.html) shows all eight top/right/bottom/left
folded and unfolded Tray states using the production renderer.

Use the catalog's **Grid / List** switch to choose card tiles or a compact
vertical list. In Grid view, use the **− / reset / +** controls, Ctrl/Command +
mouse wheel, or a trackpad pinch to change card size and the number of visible
columns. View and density preferences persist in the browser. The catalog
header also links back to the repository, README, issue list, Daily Status, and
the current GitHub Pages preview.

Search accepts multiple terms and matches each term across the component ID,
model, renderer/view, role, reuse surface, and cataloged children. Press `/` to
focus search. Results can be sorted by ID, group, model, or view and filtered to
composite or leaf components. **Copy view link** preserves the active search,
group, kind, and sort in a shareable URL; **Clear** resets discovery filters.

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
| `component-background` | `componentModel` child | Panel + combatant CSS | Panels + combat cards | Reusable opacity, tint, border, and backing layer. |
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
| `folding-tray` | `trayModel` | `trayComponents.renderTray` | Armoury + future menus | Edge-aware disclosure composition. |
| `tray-header` | `trayHeaderModel` child | `trayComponents.renderTray` | Folding Tray | Arrow, name, quantity, and optional sort action. |
| `tray-resize-handle` | `trayResizeHandleModel` child | `trayComponents.renderTray` | Resizable expanded Folding Tray | Optional 44px pointer/touch/keyboard resize surface; emitted only when that tray enables resizing. |
| `tray-content` | `trayContentModel` child | `trayComponents.renderTray` | Folding Tray | Pluggable item-model content host. |
| `relic-tray` | `itemTrayModel` | Belt view | Map + Combat | Relics under SP. |
| `relic-slot` | `componentModel` semantic ID | Item view | Map + Combat | Individual relic tile. |
| `potion-tray` | `itemTrayModel` | Belt view | Map + Combat | Utility potion tray, right anchored. |
| `potion-control` | `componentModel` semantic ID | Item view | Inventory | Individual utility potion control. |
| `battlefield-stage` | `componentModel` | `combat.js` | Combat | Combat scene/stage host. |
| `combatant-frame` | `combatantFrame` | `combatantFrame.js` | Combat | Shared combatant card geometry. |
| `player-combatant-frame` | `combatantFrame` variant | `combatantFrame.js` | Combat | Player combatant card. |
| `enemy-combatant-frame` | `combatantFrame` variant | `combatantFrame.js` | Combat | Enemy combatant card. |
| `combatant-sprite` | `combatantFrame` child | `combatantFrame.js` + `assets.js` | Combat cards | Rendered player or enemy figure. |
| `combatant-nameplate` | `combatantFrame` child | `combatantFrame.js` | Combat cards | Combatant name label. |
| `intent-indicator` | semantic component | `combat.js` + `uiContent.js` | Enemy cards | Telegraphed enemy action and amount. |
| `block-badge` | semantic component | `combat.js` | Combat cards | Current Guard/Block over the sprite. |
| `health-status-bar` | `resourceMeter` variant | `resbars.js` | Combat cards | Individual combatant HP bar. |
| `poise-status-bar` | `resourceMeter` variant | `resbars.js` | Combat cards | Individual combatant Poise bar. |
| `proc-status-bar` | semantic component | `combat.js` | Enemy cards | Individual Bleed/Frost/Insanity buildup bar. |
| `arcane-exposure-bar` | semantic component | `arcaneExposure.js` | Enemy cards | Individual Arcane Exposure meter. |
| `status-effect-tray` | semantic component | `combat.js` | Combat cards | Active status icons and stacks. |
| `tooltip` | semantic component | `tooltip.js` | All interactive surfaces | Shared contextual explanation. |
| `damage-feedback` | semantic component | `fx.js` | Combat feedback | One hit receipt containing Guard and HP channels. |
| `guarded-damage-indicator` | `damageFeedback` variant | `fx.js` | Combat feedback | Amount absorbed by Guard. |
| `health-damage-indicator` | `damageFeedback` variant | `fx.js` | Combat feedback | Residual damage applied to HP. |
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

## Character Creation components

These components are the production renderers used by Character Creation and
its `?shot=components` reference page. Art-bearing components receive their
visual node or content row from the existing asset/content registries, so later
custom art does not require a second card implementation.

| Component ID | Model / input | Renderer | Reuse |
|---|---|---|---|
| `character-disclosure` | disclosure entries | `disclosure.mountDisclosure` | Character Creation + catalog |
| `class-preview-pane` | class preview presentation | `creationCards.classPreviewPane` | Class preview + catalog |
| `class-resource-grid` | `statProjection.derived[]` | `creationCards.classResourceGrid` | Class preview + catalog |
| `class-choice-card` | class row + selected/locked state | `creationCards.classChoiceCard` | Class selection + catalog |
| `view-mode-toggle` | view-mode state | `creationCards.viewModeToggle` | Class/Equipment + catalog |
| `boolean-setting-toggle` | boolean setting state | `creationCards.booleanSettingToggle` | Auto-advance + future settings |
| `selection-section-face` | label/value/visual receipt | `creationCards.selectionSectionFace` | Equipment disclosures + catalog |
| `primary-stat-card` | attribute projection row | `creationCards.primaryStatCard` | Character stats + catalog |
| `resource-strip` | derived rows + Poise receipt | `creationCards.resourceStrip` | Character stats + catalog |
| `mode-choice` | creation mode + selected state | `creationCards.modeChoiceButton` | Standard/Assign Points + catalog |
| `sprite-choice` | sprite-style row + selected state | `creationCards.spriteChoiceButton` | Appearance + catalog |
| `tint-choice` | tint row + selected state | `creationCards.tintChoiceButton` | Appearance + catalog |
| `sigil-choice` | glyph + selected state | `creationCards.sigilChoiceButton` | Appearance + catalog |
| `keepsake-choice` | keepsake row + selected state | `creationCards.keepsakeChoiceButton` | Keepsake + catalog |
| `equipment-choice-card` | equipment row + selected state | `equipment.pieceChip` | Starting Equipment + Armoury/catalog |
| `relic-choice-card` | relic row + selected state | `creationCards.relicChoiceButton` | Starting Equipment + catalog |

```text
class-preview-pane
└─ class-resource-grid

character-disclosure
├─ mode-choice + primary-stat-card × N + resource-strip
├─ sprite-choice + sigil-choice + tint-choice
└─ keepsake-choice
```

## Menu components

| Component ID | Model | Renderer | Purpose |
|---|---|---|---|
| `quick-menu-panel` | `quickMenuPanelModel` | `menuComponents.renderQuickMenu` | Contextual dropdown opened from the HUD. |
| `quick-menu-caption` | `quickMenuCaptionModel` | `menuComponents.renderQuickMenu` | Active Quick Menu variant/status caption. |
| `quick-menu-row` | `quickMenuRowModel` | `menuComponents.renderQuickMenu` | One contextual destination or action. |
| `menu-overlay` | `menuOverlayModel` | `menuComponents.renderMenuOverlay` | Full in-run tabbed menu. |
| `menu-tab-strip` | `menuTabStripModel` | `menuComponents.renderMenuOverlay` | Shared Deck/Relics/Stats/Save/Settings/Controls navigation. |
| `menu-tab` | `menuTabModel` | `menuComponents.renderMenuOverlay` | One declared tab control. |
| `menu-panel` | `menuPanelModel` | `menuComponents.updateMenuSelection` | Content host for the selected tab. |

```text
quick-menu-panel
├─ quick-menu-caption
└─ quick-menu-row × N

menu-overlay
├─ menu-tab-strip
│  └─ menu-tab × N
└─ menu-panel
```

## Armoury components

| Component ID | Model | Renderer | Purpose |
|---|---|---|---|
| `armoury-overlay` | `armouryOverlayModel` | `armouryComponents.renderArmouryOverlay` | Modal veil and Armoury focus scope. |
| `armoury-panel` | `armouryPanelModel` | `armouryComponents.renderArmouryPanel` | Complete responsive Armoury surface. |
| `armoury-header` | `armouryHeaderModel` | `armouryComponents.renderArmouryPanel` | Title, view switcher, and close action. |
| `armoury-view-switcher` | `armouryViewSwitcherModel` | `armouryComponents.renderArmouryPanel` | Player labels are Character / Inventory / Hybrid; the compatibility keys remain `grid` / `rack` / `hybrid` internally. |
| `armoury-body` | `armouryBodyModel` | `armouryComponents.renderArmouryPanel` | Responsive Character and Armaments workspace selected by the current player view. |
| `armoury-figure` | semantic child model | `equipment.js` + `assets.js` | Layered equipped character figure. |
| `equipment-slot` | `equipmentSlotModel` | `armouryComponents.renderEquipmentSlot` | One named equipment socket. |
| `equipment-set-cell` | `equipmentSetCellModel` | `armouryComponents.renderEquipmentSetCell` | One active, empty, or locked set cell. |
| `armoury-inventory` | `armouryInventoryModel` | `equipment.js` inside `renderTray` | Inventory tray content and the single carried-item list. |
| `inventory-item-card` | `inventoryItemCardModel` | `armouryComponents.renderInventoryItemCard` | Folded carried-item face. The current `inventoryItem` class explicitly enables `holdAction`; its folded and expanded states are one action/progress surface, and an early release aborts without changing equipment. |
| `inventory-detail-card` | `inventoryDetailCardModel` | `armouryComponents.renderInventoryDetailCard` | Expanded art, tags, mods, and action label inside the same whole-card hold surface; the label is not a second action button while hold confirmation owns the action. |
| `equipment-comparison` | semantic child model + `armouryUi.layout.comparison` | `equipmentReceipts.js` in shared tooltip or item card | Full before/after receipt, separate from the action hold. Authored presentation chooses delayed hover/focus tooltip or inline content, with data-owned delay, width, and viewport cap. |
| `armoury-stats-panel` | `armouryStatsPanelModel` | `equipment.js` inside `renderTray` | Stats tray content: attributes, combat values, resources, and relic summary. |
| `armoury-card-strip` | `armouryCardStripModel` | `equipment.js` + `card.js` inside `renderTray` | Cards tray content: equipment-associated card rewrites in list or grid presentation. |
| `armoury-region-header` | compatibility semantic ID | replaced by `tray-header` | Historical Armoury-only fold header name. |

```text
armoury-overlay
└─ armoury-panel
   ├─ armoury-header ── armoury-view-switcher
   ├─ player view: Character / Inventory / Hybrid
   │  └─ compatibility key: grid / rack / hybrid
   ├─ responsive subject region (armoury-body)
   │  ├─ armoury-figure
   │  └─ equipment-slot × N ── equipment-set-cell × N
   ├─ shared folding-tray family × 4
   │  ├─ tray-header
   │  ├─ tray-resize-handle (optional; expanded when enabled)
   │  └─ tray-content
   │     ├─ Armaments
   │     ├─ Inventory ── armoury-inventory
   │     ├─ Cards ── armoury-card-strip
   │     └─ Stats ── armoury-stats-panel
   └─ armoury-inventory
      └─ inventory-item-card × N ── inventory-detail-card
         └─ equipment-comparison (delayed tooltip/focus or inline)
```

The four current Armoury tray families are Armaments, Inventory, Cards, and
Stats. They share the same `folding-tray` shell while their content components
remain independent. The current `inventoryItem` class enables whole-card hold
confirmation in both disclosure states; comparison presentation remains a
separate delayed hover/focus tooltip or inline receipt. See the
[four-edge ASCII and interaction contract](./TRAY-COMPONENTS.md).

Armaments uses the shared shell without a resize handle. Inventory has a height
handle only when rendered as a supporting tray; it has no tray-height handle
when it fills the Inventory pane. Cards and Stats may expose their configured
expanded-state handles. Folding, sorting, and resizing are independent
capabilities rather than guarantees of every tray instance.

### Asset Components / Rendered Armoury

The dotted IDs below are stable references for rendered Armoury pieces called
out by design screenshots and implementation notes. They complement the
semantic IDs above rather than replacing them. Select a dotted ID in the
[interactive catalog](./component-catalog.html?group=armoury-assets), or use the
full selector/owner cross-reference in
[`ASSET-COMPONENTS.md`](./ASSET-COMPONENTS.md). The machine-readable authority
is [`assets/components/armoury.json`](../assets/components/armoury.json).

| Rendered family | Searchable asset IDs |
|---|---|
| Shell and player views | `armoury.shell`, `armoury.viewSwitcher`, `armoury.characterView`, `armoury.inventoryView`, `armoury.hybridView`, `armoury.characterViewButton`, `armoury.inventoryViewButton`, `armoury.hybridViewButton` |
| Character composition | `armoury.characterPane`, `armoury.spritePane`, `armoury.characterSummary`, `armoury.combatPowerCard`, `armoury.combatPowerGroup`, `armoury.combatPowerMetric`, `armoury.attributesCard`, `armoury.attributeCard`, `armoury.relicsCard` |
| Armaments tray and pane | `armoury.equipmentPane`, `armoury.armamentsCard`, `armoury.armamentsHeader`, `armoury.armamentsFoldButton`, `armoury.armamentsExpanded`, `armoury.armamentsFolded`, `armoury.armamentViewToggle`, `armoury.hybridPaneSplitter` |
| Procedural equipment-position cards | `armoury.equipmentPositionCard`, `armoury.occupiedPositionCard`, `armoury.emptyPositionCard`, `armoury.lockedPositionCard`, `armoury.positionLabelPane`, `armoury.positionSpritePane`, `armoury.summaryDivider`, `armoury.positionSummaryPane`, `armoury.positionAction`, `armoury.armamentItemCard`, `armoury.armamentDetailPane`, `armoury.armamentGridGroup`, `armoury.positionGridCard`, `armoury.occupiedPositionGridCard`, `armoury.emptyPositionGridCard`, `armoury.lockedPositionGridCard`, `armoury.armamentGridDetails` |
| Inventory and comparison | `armoury.inventoryCard`, `armoury.paneSplitter`, `armoury.itemCard`, `armoury.inventoryItemClass`, `armoury.itemReveal`, `armoury.comparisonTooltipAnchor`, `armoury.equipmentComparison`, `armoury.inventoryTrayResizeHandle` |
| Cards, Stats, and disclosure | `armoury.cardsCard`, `armoury.cardList`, `armoury.cardRow`, `armoury.cardDetail`, `armoury.cardViewToggle`, `armoury.cardsTrayResizeHandle`, `armoury.statsTray`, `armoury.statsSummary`, `armoury.statsTrayResizeHandle`, `armoury.disclosure` |

### Combatant card detail

```text
combatant-frame
├─ component-background
├─ intent-indicator                 enemy variant
├─ combatant-sprite
│  └─ block-badge                   when Guard > 0
├─ combatant-nameplate
├─ health-status-bar
├─ poise-status-bar
├─ proc-status-bar × 0..2           Bleed/Frost/Insanity buildup
├─ arcane-exposure-bar              enemy, when available
└─ status-effect-tray

damage-feedback
├─ guarded-damage-indicator         Guard absorbed
└─ health-damage-indicator          residual HP loss
```

`tooltip` is a shared overlay used by these parts and by controls throughout the
game. The catalog expands this combatant family because its pieces have distinct
behavior and visual meaning; this does not declare that every other catalog item
is indivisible.

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

### Data-driven presentation tokens

| Setting | Default | Runtime projection | What it controls |
|---|---:|---|---|
| `componentBackgroundOpacityPct` | `0` | `--hud-component-background-opacity` | Shared component-card background opacity. |
| `metadataFontPx` | `11` | `--hud-metadata-font-px` | One font size for Act, Floor, Build, Seed, and Source. |
| `beltItemGapPx` | `2` | `--hud-belt-item-gap-px` | Uniform relic/potion slot spacing. |
| `portraitScale` | `0.7` | `--hud-portrait-scale` | Portrait-badge size without changing identity semantics. |
| `primaryRowGapPx` | `8` | `--hud-primary-row-gap-px` | Gap between Vitals and Quick Access. |
| `controlGapPx` | `2` | `--hud-control-gap-px` | Gap inside the Quick Access 2×2 control grid. |
| `resourceRowGapPx` | `2` | `--hud-resource-row-gap-px` | Vertical spacing between HP, MP, and SP. |
| `cindersMaxWidthPct` | `30` | `--hud-cinders-max-width` | Maximum centered Cinders track width in viewport units. |
| `metadataMaxWidthPct` | `30` | `--hud-metadata-max-width` | Maximum right metadata-trail width in viewport units. |
| `metadataShowTotals` | `false` | `data-hud-metadata-show-totals` | Whether Act/Floor include their `/ total` values. |

Changing these defaults is a data edit. `src/main.js` validates and projects
them; Map and Combat then consume the same runtime values through the shared HUD.

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
