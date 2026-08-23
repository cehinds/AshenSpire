# Armoury layout brief

This is the implementation contract for the character and equipment pane. The
attached screenshots are visual references; the data in
`content/source/armouryUi.json` is the tunable authority.

## Refined prompt

Build one responsive Armoury shell with a 40% character pane and a 60%
armaments pane on desktop and phone. Keep the character on the left at every
resolution, shrinking the sprite to fit. Keep the Armaments title, tooltip,
and divider treatment, but make its outer border configurable.

The character pane has a summary header above two stacked regions: a sprite
pane above and a stats pane below. The header begins with
`FORSAKEN · <CLASS> · LEVEL <N>`, then the stats pane contains a
vertical Combat Power group (Strike, Potency, Defense), Attributes, and Relics.
Every component is progressively disclosed. A folded row is always one row;
its secondary bonus line may disappear at narrow widths, while the shared
tooltip keeps the full name and the interaction instruction.

The Armaments pane is a vertical stack of foldable socket subcards in this order:
Armour, Right Hand, Left Hand, then any additional authored socket. Each socket
row carries the equipped item, bonus, and weight fields. The renderer
shows `Weight —` until an item row authors a load weight; `dropWeight` remains
the discovery-weight field and is not presented as carried load. The Character,
Inventory, and Hybrid tabs are data-labelled views. Character renders only the
character pane at full width: summary and sprite stay in a left column while
Combat Power, Attributes, and Relics occupy the right column; Cards remains
open below. Inventory uses the equivalent Skyrim-like split, with Armaments on
the left and the Inventory card on the right. Hybrid keeps the two panes split
and the supporting trays folded. The bottom trays are Inventory, Cards, and a
compact Stats summary; the Cards tray contains only equipment-associated cards,
is a vertical list by default, and can switch to an authored-column grid.

## Structural illustration

```text
Character view:
┌──────────────────────────────┬──────────────────────────────┐
│ FORSAKEN · REAVER · LEVEL 3  │ COMBAT POWER                  │
│                              │ [Strike              14]     │
│            sprite            │ [Potency              6]     │
│                              │ [Defense              9]     │
├──────────────────────────────┤ ATTRIBUTES · STR 12 · ...    │
│                              │ RELICS · 2                   │
└──────────────────────────────┴──────────────────────────────┘

Inventory view:
┌────────────────────────────────────┬──────────────────────────┐
│ ARMAMENTS                          │ INVENTORY                │
│ [ARMOUR      Wayfarer Plate]       │ [Forsaken Medallion]      │
│ [RIGHT HAND  Straight Sword]       │ [Straight Sword]          │
│ [LEFT HAND   Round Shield]         │ [Round Shield]            │
└────────────────────────────────────┴──────────────────────────┘
```

Trays:
┌──────────────────────────────────────────────────────────────┐
│ ▸ INVENTORY  4 items                                          │
│ ▸ CARDS      3 cards                                    [▦]  │
│ ▸ STATS      Lv. 1 · Strike 7 · Potency 0 · Guard 5 ...     │
└──────────────────────────────────────────────────────────────┘

## Comparison checklist

- [x] Character/equipment ratios are config-driven and normalized.
- [x] The sprite allocation is 38% (about 20% smaller than the previous 48%), with
      the summary header kept above it so folded stats stay visible.
- [x] Combat Power cards are vertical and use stable component IDs.
- [x] Armament sockets are individually foldable and ordered by data (Armour,
      Right Hand, Left Hand); there is no extra Armaments summary row.
- [x] Character/Inventory/Hybrid labels and pane/tray defaults are data-driven.
- [x] Narrow cards hide only the secondary bonus line; tooltip content remains.
- [x] Component IDs and selectors are mirrored in `assets/components/armoury.json`
      and `docs/ASSET-COMPONENTS.md`.
