# Armoury layout brief

This is the implementation contract for the Character, Inventory, Hybrid, and
Armaments presentations. Visual references inform the work; tunable layout
authority lives in `content/source/armouryUi.json`.

## View contract

- **Character** is one full-width two-column Character surface at every
  resolution. Identity/class/level and the shrink-to-fit sprite stay on the
  left; Combat Power, Attributes, and Relics stay on the right. It does not
  render a duplicate Stats tray.
- **Inventory** contains Armaments and Inventory with a draggable, snapping
  divider. At phone width those panes stack. Its Stats tray contains class,
  level, combat values, attributes, resources, and relics.
- **Hybrid** keeps the approved compact vertical Character stack on the left
  and Armaments on the right, with its own draggable, snapping, saved center
  divider. Its supporting trays are Inventory and Cards.

The sprite always uses contain sizing and shrinks with its pane. Character data
cards fold automatically where the authored view asks for folded state.

```text
┌──────────────────────────────────────────────────────────────┐
│ ARMOURY                         [Character][Inventory][Hybrid]│
├───────────────────────────────┬─┬────────────────────────────┤
│ CHARACTER (vertical)          │║│ ▾ ARMAMENTS 3 items GRID ▦ │
│ identity · class · level      │║│ List or Grid                │
│ [shrink-to-fit sprite]        │║│                            │
│ [Combat Power]                │║│                            │
│ [Attributes] [Relics]         │║│                            │
├───────────────────────────────┴─┴────────────────────────────┤
│ ▸ INVENTORY  4 items                                       │
│ ▸ CARDS      3 cards                                       │
└──────────────────────────────────────────────────────────────┘
```

## Armaments List

List mode uses compact occupied rows with a complete scaled equipment-card thumbnail, authored position code, item name and Equipped/Reserve badge. Inspect and Replace stay grouped; Unequip sits at the right. Inspect is read-only: desktop shows the complete inspection beside the list; mobile switches to inspection with a Back control. Thumbnail and inspection widths are authored in `layout.equipment.compactList`. Empty and locked positions retain their model-driven states and refusal text. Make active remains a separate action, including for an empty reserve.

## Armaments Grid

Grid mode iterates the same authored groups and positions. Current data happens
to author Armour, Right Hand, and Left Hand; the renderer contains no named
branch for those groups.

```text
ARMOUR
[BODY  ]
[sprite]
[Plate ]

RIGHT HAND
[RH1   ] [RH2   ] ... [RHN   ]
[sprite] [sprite]     [sprite]
[name  ] [name  ]     [name  ]

LEFT HAND
[LH1   ] [LH2   ] ... [LHN   ]
[sprite] [sprite]     [sprite]
[name  ] [name  ]     [name  ]

──────────────────────────────────────────────────────────────
DETAILS
[selected position lore, effects, bonuses, value, weight, tags]
```

Column count is authored separately for desktop and phone. Tiles preserve the
same occupied, empty, locked, selected, drag/drop, and refusal states as List.

## Armament inspection, comparison and action

Armament inventory faces disclose details on the first tap and remain read-only on hold. The nested card inspector is disabled on those faces because the disclosure owns inspection. `layout.cardClasses.armamentItem` authors `holdAction: false` and inline comparison. Other Inventory classes retain `inventoryItem` capabilities.

An item without a selected destination never chooses a hand automatically. The picker names every compatible position, its occupant, active/reserve status and lock reason. Choosing a reserve does not activate it. Named Equip/Move/Unequip buttons are the mutation controls; successful changes name the item and destination. Mouse/pen drag remains available, while touch scroll is preserved.

Existing requirements, storage capacity, grip restrictions and combat prices remain authoritative. Combat changes dispatch the priced engine callback. Inspect and choosing a destination never mutate equipment. Magic remains the primary combat value; Potency is its modifier.

## Tray and pane resizing

- Resizable supporting Inventory/Card/Stats tray heights are independent saved
  ratios. Inventory disables height resizing while it fills Inventory view;
  Armaments is non-resizable.
- A tray exposes its top-edge pointer/keyboard handle only while unfolded and
  only when its model enables resizing; folded trays expose only the uniform
  compact header.
- Folding ignores the saved expanded ratio and collapses immediately to the
  header; reopening restores that same saved expanded ratio.
- Default, minimum, maximum, snap ratios, and tolerance are authored under
  `layout.trays`.
- Armaments, Inventory, Cards, and Stats share the same Folding Tray structure.
  A labelled List/Grid action exists only for an unfolded sortable tray.
- Inventory and Hybrid center dividers reuse the authored pane bounds and snap
  stops; Inventory changes Armaments/Inventory, Hybrid changes
  Character/Armaments.
- Narrow position cards auto-fold details and progressively remove secondary
  metadata before they sacrifice position, art, name, or equipment state.

## Acceptance checklist

- [x] Character is two-column at every resolution and has no duplicate Stats tray.
- [x] Inventory stacks at 390×844 and its divider resizes desktop panes.
- [x] Hybrid keeps the approved vertical Character stack and its center divider
      resizes Character and Armaments.
- [x] Sprite and item art remain fully visible at desktop and phone widths.
- [x] List and Grid iterate arbitrary authored equipment groups and positions.
- [x] Comparison hover/focus remains wholly on-glass; action hold fills the
      complete folded or expanded card and aborts cleanly on early release.
- [x] Enabled tray handles appear only unfolded and persist independent snapped heights.
- [x] Folded/expanded tray headers align and sort toggles are absent when folded.
- [x] `Magic` is primary; `Potency` is only a modifier.
- [x] Component registry, generated content, shipped HTML, tests, and screenshots
      match this contract.

Shipped evidence: `0.4.0.1191` / PR #334, including the desktop Character,
Inventory, Hybrid, hold-progress and comparison-tooltip captures plus the
390×844 phone capture under [`docs/preview/`](./preview/).
