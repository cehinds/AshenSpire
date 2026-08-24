# Asset component catalog

This catalog is the quick-reference index for named visual components. The
machine-readable registry is [`assets/components/armoury.json`](../assets/components/armoury.json).
IDs are stable references for screenshots, QA notes, and future UI edits; the
selector identifies the rendered component and the source owner remains the
single place that constructs it.

## Armoury

| ID | Rendered component | Selector | Source owner |
| --- | --- | --- | --- |
| `armoury.shell` | Shared responsive shell | `.armoury[data-composition="character-equipment"]` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.viewSwitcher` | Character / Inventory / Hybrid selector | `.armoury-views` | `src/ui/screens/equipment.js` |
| `armoury.characterView` | Full-width Character surface: identity/sprite left, stats right | `.armoury[data-pane="character"]` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.inventoryView` | Inventory surface: Armaments and Inventory panes | `.armoury[data-pane="inventory"]` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.hybridView` | Hybrid surface: vertical Character pane and Armaments pane | `.armoury[data-pane="both"]` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.characterViewButton` | Opens Character view | `.armoury-views [data-member="grid"]` | `src/ui/screens/equipment.js` |
| `armoury.inventoryViewButton` | Opens Inventory view | `.armoury-views [data-member="rack"]` | `src/ui/screens/equipment.js` |
| `armoury.hybridViewButton` | Opens Hybrid view | `.armoury-views [data-member="hybrid"]` | `src/ui/screens/equipment.js` |
| `armoury.characterPane` | Full Character surface or vertical left Hybrid pane | `.armoury-character` | `src/ui/screens/equipment.js` |
| `armoury.spritePane` | Shrink-to-fit sprite pane | `.armoury-sprite-pane` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.characterSummary` | Name, class, level | `.character-summary` | `src/ui/screens/equipment.js` |
| `armoury.combatPowerCard` | Foldable Combat Power group with summary values | `.character-info-card.combatPowerCard` | `src/ui/screens/equipment.js` |
| `armoury.combatPowerGroup` | Vertical Strike / Magic / Defense detail group | `.character-power-cards` | `src/ui/screens/equipment.js` |
| `armoury.combatPowerMetric` | One Strike / Magic / Defense detail card | `.character-power-cards .disc-face` | `src/ui/components/disclosure.js` |
| `armoury.attributesCard` | Foldable Attributes group with summary values | `.character-info-card.attributesCard` | `src/ui/screens/equipment.js` |
| `armoury.attributeCard` | Expandable attribute card | `.character-attributes .disc-face` | `src/ui/components/disclosure.js` |
| `armoury.relicsCard` | Foldable Relics group with count and name summary | `.character-info-card.relicsCard` | `src/ui/screens/equipment.js` |
| `armoury.equipmentPane` | Vertical armaments pane (left in Inventory, right in Hybrid) | `.armoury-equipment` | `src/ui/screens/equipment.js` |
| `armoury.armamentsHeader` | Shared tray-pattern Armaments header and item count | `.armoury-equipment-head` | `src/ui/screens/equipment.js` |
| `armoury.armamentsFoldButton` | Armaments fold/unfold control | `.armoury-equipment-head [data-fold="armaments"]` | `src/ui/screens/equipment.js` |
| `armoury.armamentsExpanded` | Expanded Armaments state with List/Grid control | `.armoury-equipment[data-collapsed="0"]` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.armamentsFolded` | Folded Armaments name-and-count state | `.armoury-equipment[data-collapsed="1"]` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.armamentsCard` | Armaments pane containing List and Grid presentations | `.armoury-equipment[data-component="armoury.armamentsCard"]` | `src/ui/screens/equipment.js` |
| `armoury.armamentViewToggle` | Armaments List/Grid toggle | `.armoury-armament-view-toggle` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.hybridPaneSplitter` | Hybrid Character/Armaments divider | `.armoury-hybrid-splitter` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.equipmentPositionCard` | One complete card for every visible equipment position | `.armoury-position-card` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.occupiedPositionCard` | Occupied position with compact summary and expandable details | `.armoury-position-card.is-occupied` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.emptyPositionCard` | Unlocked empty position and item drop target | `.armoury-position-card.is-empty` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.lockedPositionCard` | Next locked position with its authored refusal | `.armoury-position-card.is-locked` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.positionLabelPane` | Authored position name and short code | `.armoury-position-label-pane` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.positionSpritePane` | Item or position-state art | `.armoury-position-sprite-pane` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.summaryDivider` | Left boundary of the Item Summary Pane | `.armoury-position-sprite-pane` right border | `styles/ui.css` |
| `armoury.positionSummaryPane` | Category, name, combat, tags, weight, and state | `.armoury-position-summary-pane` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.positionAction` | Equip or green Equipped state | `.armoury-position-action` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.armamentItemCard` | Expanded lore/effect/calculation details | `.armoury-position-detail` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.armamentDetailPane` | Details beneath the compact position summary | `.armoury-armament-details` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.armamentGridGroup` | One procedural equipment group in Grid mode | `.armoury-position-grid-group` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.positionGridCard` | Compact position code, sprite, and item-name tile | `.armoury-position-grid-card` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.occupiedPositionGridCard` | Occupied grid tile | `.armoury-position-grid-card.is-occupied` | `src/ui/screens/equipment.js` |
| `armoury.emptyPositionGridCard` | Empty grid tile/drop target | `.armoury-position-grid-card.is-empty` | `src/ui/screens/equipment.js` |
| `armoury.lockedPositionGridCard` | Locked grid tile | `.armoury-position-grid-card.is-locked` | `src/ui/screens/equipment.js` |
| `armoury.armamentGridDetails` | Shared selected-position Details area | `.armoury-position-grid-detail` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.inventoryCard` | Unified Inventory panel | `.armoury-inventory` | `src/ui/screens/equipment.js` |
| `armoury.paneSplitter` | Draggable/keyboard pane resizer with snapping | `.armoury-pane-splitter` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.itemCard` | Folded inventory/picker item | `.inventory-face, .equip-chip.as-face` | `src/ui/screens/equipment.js` |
| `armoury.inventoryItemClass` | Inventory item class with model-opted folded/unfolded hold action and whole-card drag | `[data-card-class="inventoryItem"]` | `content/source/armouryUi.json` + `src/ui/components/holdconfirm.js` |
| `armoury.itemReveal` | Model, description, tags, and available action | `.inventory-detail, .disc-reveal` | `src/ui/screens/equipment.js` + `src/ui/components/disclosure.js` |
| `armoury.comparisonTooltipAnchor` | Hover/configured-hold comparison tooltip anchor | `.inventory-detail[data-component="armoury.comparisonTooltipAnchor"]` | `src/ui/screens/equipment.js` + `src/ui/components/tooltip.js` |
| `armoury.inventoryTrayResizeHandle` | Independent Inventory tray height handle | `[data-component="armoury.inventoryTrayResizeHandle"]` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.cardsCard` | Folded equipment-card panel with list/grid toggle | `.armoury-strip` | `src/ui/screens/equipment.js` |
| `armoury.cardList` | Configurable vertical list or grid | `.armoury-card-list` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.cardRow` | Folded equipment card row with count and cost | `.armoury-card-row` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.cardDetail` | Expanded icon and detail panes | `.armoury-card-row-detail` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.cardViewToggle` | List/grid presentation toggle | `.armoury-card-view-toggle` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.cardsTrayResizeHandle` | Independent Cards tray height handle | `[data-component="armoury.cardsTrayResizeHandle"]` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.statsTray` | Inventory-view character-data tray | `.armoury-stats-tray` | `src/ui/screens/equipment.js` |
| `armoury.statsSummary` | Class, level, combat, attributes, resources, relics | `.armoury-stats-summary` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.statsTrayResizeHandle` | Independent Stats tray height handle | `[data-component="armoury.statsTrayResizeHandle"]` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.disclosure` | Shared fold/reveal behavior | `.disc-face, .disc-reveal` | `src/ui/components/disclosure.js` |

## Layout authority

Proportions and order are authored in
[`content/source/armouryUi.json`](../content/source/armouryUi.json), compiled to
`src/content/generated/armouryUi.js`, and normalized by
`src/model/armouryLayout.js`. The current contract is:

- Hybrid defaults to character `40%`, Armaments `60%`; its center divider is
  draggable, snapping, and saved;
- character: summary header, sprite `38%`, stats `62%` (the sprite is reduced
  by about 20% from the prior `48%` allocation so folded stats remain in view);
- equipment positions iterate from `equipSlots.csv` and the loadout ladder;
  labels, short codes, order, and counts are content rather than renderer
  branches. There are no duplicate group headers or miniature position strips.
  In List mode every occupied, empty, or next-locked position is one complete
  horizontal card. The named subcomponents are Position Label Pane, Item Sprite
  Pane, Summary Divider, Item Summary Pane, Equipment State Action, and Expanded
  Detail Pane. Grid mode groups the same procedural positions and shows compact
  position/sprite/name tiles plus one shared Details area;
- Inventory pane widths are player-resizable. Snap ratios, saved default,
  compact-density boundary, and position-card fold boundaries are authored in
  `armouryUi.json` rather than embedded in the renderer;
- Inventory, Cards, and Stats tray heights are independent saved ratios. Their
  default/minimum/maximum/snap stops are authored under `layout.trays`. Resize
  handles exist only while the corresponding tray is unfolded;
- selectable Inventory item cards opt into the core action gesture through
  `layout.cardClasses.inventoryItem.holdAction: true`. Omitted card classes
  default to `false`; the shared Settings hold dial defaults off. When enabled,
  the folded face and unfolded detail use the same action and progress strip,
  with the HOLD hint kept inside the card. The folded card is also the native
  and pointer drag source; crossing the shared hold slop cancels the hold and
  changes the gesture into a drag;
- cards: list by default, grid columns authored as `4`, with the presentation
  toggle in the Cards tray header; only cards with an equipment source appear;
  phone grid columns are separately authored as `2`;
- phone: Character remains a full-width two-column surface with identity/sprite
  left and stat cards right; Inventory stacks Armaments above Inventory;
  Hybrid retains its approved vertical Character pane and the user-resizable
  Character/Armaments split. Sprite and item art use contain sizing and
  secondary card detail auto-folds at authored widths.

The three saved view IDs retain compatibility with existing preferences while
their authored labels are `Character`, `Inventory`, and `Hybrid`. Character
renders only the full-width character pane and no duplicate Stats tray.
Inventory renders Armaments with Inventory and exposes the character-data Stats
tray. Hybrid renders the compact vertical Character stack | Armaments with its own saved center divider;
only Inventory and Cards remain as supporting trays. Narrow panes fold expanded
details, then progressively hide secondary
combat, tags, weight, and category while preserving position, art, item name,
and equipment state. Hybrid keeps the two
panes split and the supporting trays folded.
Combat Power, Attributes, and Relics are independent vertical disclosure cards.
Their folded headers retain their summary values; their expanded bodies expose
the existing nested calculation cards. The visible secondary bonus line on
Combat Power metrics is suppressed at the phone width, while the shared tooltip
retains the full label and action.

Armament summaries reserve a load-weight field for each item. Current weapon
and armour source rows do not yet author carried-load values, so the UI displays
`Weight —`; the existing `dropWeight` field is discovery weighting and is not
reused as load.

When a new component is introduced, add its ID and selector to the registry in
the same change as its renderer. Do not create a second hand-authored catalog.

## Preview captures

These captures are the visual reference for the current component contract:

- [Character view — 1440×900](preview-armoury-stats-1440x900.png)
- [Inventory view — 1440×900](preview-armoury-equipment-1440x900.png)
- [Hybrid view — 1440×900](preview-armoury-hybrid-1440x900.png)
- [Cards list — 1440×900](preview-armoury-cards-list-1440x900.png)
- [Expanded card — 1440×900](preview-armoury-card-expanded-1440x900.png)
- [Cards grid — 1440×900](preview-armoury-cards-grid-1440x900.png)
- [Compact Inventory view — 390×844](preview-armoury-phone-390x844.png)

The captures show the shared `armoury.shell`, `armoury.characterPane`,
`armoury.spritePane`, `armoury.combatPowerGroup`,
`armoury.equipmentPositionCard`, `armoury.positionLabelPane`,
`armoury.positionSummaryPane`, `armoury.paneSplitter`, and the folded
Inventory and Cards region components together, at the sizes that matter for
review.
