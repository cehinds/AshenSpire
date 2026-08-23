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
| `armoury.characterPane` | Left character pane | `.armoury-character` | `src/ui/screens/equipment.js` |
| `armoury.spritePane` | Shrink-to-fit sprite pane | `.armoury-sprite-pane` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.characterSummary` | Name, class, level | `.character-summary` | `src/ui/screens/equipment.js` |
| `armoury.combatPowerGroup` | Vertical Combat Power group | `.character-power-cards` | `src/ui/screens/equipment.js` |
| `armoury.combatPowerCard` | Strike / Potency / Defense card | `.character-power-cards .disc-face` | `src/ui/components/disclosure.js` |
| `armoury.attributesCard` | Folded attributes group | `.character-attributes` | `src/ui/screens/equipment.js` |
| `armoury.attributeCard` | Expandable attribute card | `.character-attributes .disc-face` | `src/ui/components/disclosure.js` |
| `armoury.relicsCard` | Folded relic group | `.character-relics` | `src/ui/screens/equipment.js` |
| `armoury.equipmentPane` | Vertical armaments pane (left in Inventory, right in Hybrid) | `.armoury-equipment` | `src/ui/screens/equipment.js` |
| `armoury.armamentsHeader` | Armaments group header | `.armoury-equipment-head` | `src/ui/screens/equipment.js` |
| `armoury.armamentsCard` | Armaments group containing only foldable socket rows | `.armoury-equipment[data-component="armoury.armamentsCard"]` | `src/ui/screens/equipment.js` |
| `armoury.armamentSubcard` | Foldable socket subcard | `.armoury-slot-card` | `src/ui/screens/equipment.js` |
| `armoury.socketCard` | Right/Left Hand and Armour socket cards | `.armoury-equipment .equip-slot` | `src/ui/screens/equipment.js` |
| `armoury.socketSet` | Socket loadout cells | `.armoury-equipment .es-sets` | `src/ui/screens/equipment.js` |
| `armoury.inventoryCard` | Unified Inventory panel | `.armoury-inventory` | `src/ui/screens/equipment.js` |
| `armoury.itemCard` | Folded inventory/picker item | `.inventory-face, .equip-chip.as-face` | `src/ui/screens/equipment.js` |
| `armoury.itemReveal` | Model, description, comparison, action | `.inventory-detail, .disc-reveal` | `src/ui/screens/equipment.js` + `src/ui/components/disclosure.js` |
| `armoury.cardsCard` | Folded equipment-card panel with list/grid toggle | `.armoury-strip` | `src/ui/screens/equipment.js` |
| `armoury.cardList` | Configurable vertical list or grid | `.armoury-card-list` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.cardRow` | Folded equipment card row with count and cost | `.armoury-card-row` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.cardDetail` | Expanded icon and detail panes | `.armoury-card-row-detail` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.cardViewToggle` | List/grid presentation toggle | `.armoury-card-view-toggle` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.statsTray` | Folded compact character stats summary | `.armoury-stats-tray` | `src/ui/screens/equipment.js` |
| `armoury.disclosure` | Shared fold/reveal behavior | `.disc-face, .disc-reveal` | `src/ui/components/disclosure.js` |

## Layout authority

Proportions and order are authored in
[`content/source/armouryUi.json`](../content/source/armouryUi.json), compiled to
`src/content/generated/armouryUi.js`, and normalized by
`src/model/armouryLayout.js`. The current contract is:

- desktop: character `40%`, equipment `60%`;
- character: summary header, sprite `38%`, stats `62%` (the sprite is reduced
  by about 20% from the prior `48%` allocation so folded stats remain in view);
- equipment order: `Armaments` header, `Armour`, `Right Hand`, `Left Hand`, then
  any additional authored sockets; there is no separate armament summary row;
- cards: list by default, grid columns authored as `4`, with the presentation
  toggle in the Cards tray header; only cards with an equipment source appear;
  phone grid columns are separately authored as `2`;
- phone: character `40%`, equipment `60%`, with the sprite still visible.

The three saved view IDs retain compatibility with existing preferences while
their authored labels are now `Character`, `Inventory`, and `Hybrid`. Character
renders only the full-width character pane, with summary/sprite left and Combat
Power, Attributes, and Relics right; the Cards tray remains open. Inventory
renders the equivalent full-width split with Armaments left and the Inventory
card right; Hybrid keeps the two panes split and the supporting trays folded.
The visible
secondary bonus line on Combat Power cards is suppressed at the phone width,
while the shared tooltip retains the full label and action.

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
- [Hybrid phone view — 390×844](preview-armoury-phone-390x844.png)

The captures show the shared `armoury.shell`, `armoury.characterPane`,
`armoury.spritePane`, `armoury.combatPowerGroup`,
`armoury.armamentsCard`, `armoury.armamentSubcard`, and the folded Inventory
and Cards region components together, at the sizes that matter for review.
