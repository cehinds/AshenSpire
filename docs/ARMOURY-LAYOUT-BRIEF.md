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

List mode is a flat procedural list: one horizontal card for every visible
occupied, empty, or locked equipment position. Position labels, codes, group
order, slot count, unlock state, and item assignment come from data.

```text
┌──────────┬──────────────┬────────────────────────────────────┐
│ POSITION │ ITEM SPRITE  ║ ITEM SUMMARY                       │
│ LABEL    │              ║ Category · Name · Combat           │
│ RH1      │  contained   ║ tags · Weight · EQUIPPED / EQUIP   │
└──────────┴──────────────┴────────────────────────────────────┘
                         ↑
                  Summary Divider

Expanded beneath the summary:
[lore] [effects] [combat bonuses] [value] [weight] [tag details]
```

Stable subcomponent names:

1. Position Label Pane
2. Item Sprite Pane
3. Summary Divider
4. Item Summary Pane
5. Equipment State Action
6. Expanded Detail Pane

The Position Label Pane is deliberately narrow with bounded type. The Item
Sprite Pane is constrained to a near-square or slightly-wide rectangle and
scales its art up without clipping. The Summary Divider is the sprite pane's
right boundary.

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

## Inventory comparison

Expanded Inventory cards contain item information and their action. Comparison
receipts do not lengthen the card body in the shipped `tooltip` presentation:
delayed pointer hover or keyboard/gamepad focus displays the complete receipt
in the shared tooltip above the expanded card. The data-owned `inline`
presentation instead keeps that receipt inside the expanded card.

Comparison and action are deliberately separate. The Inventory item class owns
Equip, Move, or Unequip through the shared hold-confirm system; comparison
reading never consumes that hold. `Magic` is the primary displayed combat
value; `Potency` remains the modifier that adds to Magic damage.

## Unified Inventory card action

- `layout.cardClasses.inventoryItem.holdAction` explicitly opts the Inventory
  item class into the reusable card action. Missing classes default to false.
- With hold-confirm enabled, the folded face and expanded reveal are one large
  action control. The progress wash covers the complete visible card—including
  the title and expanded information—and releasing early cancels without
  changing the loadout.
- The visible Equip/Move/Unequip wording inside a hold-enabled expanded card is
  a label, not a second nested button. The same card remains keyboard/gamepad
  focusable.
- With hold-confirm off, ordinary activation continues to fold/unfold the item
  and the explicit in-card action remains the commit control.
- The folded card is also the drag source. Crossing the shared movement slop
  cancels a pending hold and transfers the gesture to drag/drop.
- During the player's combat turn, Equip, Move, and Unequip remain available.
  They dispatch the priced `changeEquipment` combat intent instead of mutating
  the panel's loadout directly. The engine charges the same authored action cost
  as a prepared-set swap and immediately updates cards, resource maxima, Poise,
  events, and the persisted combat loadout.

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
