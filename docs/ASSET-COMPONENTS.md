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
| `armoury.viewSwitcher` | Stats / Equipment / Hybrid selector | `.armoury-views` | `src/ui/screens/equipment.js` |
| `armoury.characterPane` | Left character pane | `.armoury-character` | `src/ui/screens/equipment.js` |
| `armoury.spritePane` | Shrink-to-fit sprite pane | `.armoury-sprite-pane` | `src/ui/screens/equipment.js` + `styles/ui.css` |
| `armoury.characterSummary` | Name, class, level | `.character-summary` | `src/ui/screens/equipment.js` |
| `armoury.combatPowerGroup` | Vertical Combat Power group | `.character-power-cards` | `src/ui/screens/equipment.js` |
| `armoury.combatPowerCard` | Strike / Potency / Defense card | `.character-power-cards .disc-face` | `src/ui/components/disclosure.js` |
| `armoury.attributesCard` | Folded attributes group | `.character-attributes` | `src/ui/screens/equipment.js` |
| `armoury.attributeCard` | Expandable attribute card | `.character-attributes .disc-face` | `src/ui/components/disclosure.js` |
| `armoury.relicsCard` | Folded relic group | `.character-relics` | `src/ui/screens/equipment.js` |
| `armoury.equipmentPane` | Right vertical socket pane | `.armoury-equipment` | `src/ui/screens/equipment.js` |
| `armoury.armamentsHeader` | Armaments group header | `.armoury-equipment-head` | `src/ui/screens/equipment.js` |
| `armoury.armamentsCard` | Configurable Armaments group | `.armoury-equipment[data-component="armoury.armamentsCard"]` | `src/ui/screens/equipment.js` |
| `armoury.armamentSubcard` | Foldable socket subcard | `.armoury-slot-card` | `src/ui/screens/equipment.js` |
| `armoury.socketCard` | Right/Left Hand and Armour socket cards | `.armoury-equipment .equip-slot` | `src/ui/screens/equipment.js` |
| `armoury.socketSet` | Socket loadout cells | `.armoury-equipment .es-sets` | `src/ui/screens/equipment.js` |
| `armoury.inventoryCard` | Unified Inventory panel | `.armoury-inventory` | `src/ui/screens/equipment.js` |
| `armoury.itemCard` | Folded inventory/picker item | `.inventory-face, .equip-chip.as-face` | `src/ui/screens/equipment.js` |
| `armoury.itemReveal` | Model, description, comparison, action | `.inventory-detail, .disc-reveal` | `src/ui/screens/equipment.js` + `src/ui/components/disclosure.js` |
| `armoury.cardsCard` | Derived Cards panel | `.armoury-strip` | `src/ui/screens/equipment.js` |
| `armoury.disclosure` | Shared fold/reveal behavior | `.disc-face, .disc-reveal` | `src/ui/components/disclosure.js` |

## Layout authority

Proportions and order are authored in
[`content/source/armouryUi.json`](../content/source/armouryUi.json), compiled to
`src/content/generated/armouryUi.js`, and normalized by
`src/model/armouryLayout.js`. The current contract is:

- desktop: character `40%`, equipment `60%`;
- character: sprite `60%`, stats `40%`;
- equipment order: `Armaments` header, `Right Hand`, `Left Hand`, then any
  additional authored sockets;
- phone: character `40%`, equipment `60%`, with the sprite still visible.

The three saved view IDs retain compatibility with existing preferences while
their authored labels are now `Stats`, `Equipment`, and `Hybrid`. Stats opens
the character information and card strip; Equipment opens the Armaments and
Inventory trays; Hybrid keeps the supporting trays folded. The visible
secondary bonus line on Combat Power cards is suppressed at the phone width,
while the shared tooltip retains the full label and action.

When a new component is introduced, add its ID and selector to the registry in
the same change as its renderer. Do not create a second hand-authored catalog.

## Preview captures

These captures are the visual reference for the current component contract:

- [Stats view — 1440×900](preview-armoury-stats-1440x900.png)
- [Equipment view — 1440×900](preview-armoury-equipment-1440x900.png)
- [Hybrid view — 1440×900](preview-armoury-hybrid-1440x900.png)
- [Hybrid phone view — 390×844](preview-armoury-phone-390x844.png)

The captures show the shared `armoury.shell`, `armoury.characterPane`,
`armoury.spritePane`, `armoury.combatPowerGroup`,
`armoury.armamentsCard`, `armoury.armamentSubcard`, and the folded Inventory
and Cards region components together, at the sizes that matter for review.
