# Armoury layout brief

This is the implementation contract for the character and equipment pane. The
attached screenshots are visual references; the data in
`content/source/armouryUi.json` is the tunable authority.

## Refined prompt

Build one responsive Armoury shell with a 40% character pane and a 60%
armaments pane on desktop and phone. Keep the character on the left at every
resolution, shrinking the sprite to fit. Keep the Armaments title, tooltip,
and divider treatment, but make its outer border configurable.

The character pane has two stacked regions: a sprite pane above and a stats
pane below. The stats pane begins with `FORSAKEN · <CLASS> · LEVEL <N>`, then a
vertical Combat Power group (Strike, Potency, Defense), Attributes, and Relics.
Every component is progressively disclosed. A folded row is always one row;
its secondary bonus line may disappear at narrow widths, while the shared
tooltip keeps the full name and the interaction instruction.

The Armaments pane is a vertical stack of foldable subcards in this order:
Armaments summary, Right Hand, Left Hand, then any additional authored socket
such as Armour. The Stats, Equipment, and Hybrid tabs are data-labelled views:
Stats opens character information and Cards, Equipment opens Armaments and
Inventory, and Hybrid keeps supporting trays folded.

## Structural illustration

```text
┌──────────────────────────────┬──────────────────────────────────────┐
│ FORSAKEN · REAVER · LEVEL 3  │ ARMAMENTS                            │
│                              │ ──────────────────────────────────── │
│            sprite            │ [Armaments summary]                  │
│                              │ [RIGHT HAND]                         │
│                              │ [Straight Sword  +bonus  weight]     │
│                              │ [LEFT HAND]                          │
│                              │ [Round Shield   +bonus  weight]      │
├──────────────────────────────┤ [ARMOUR]                              │
│ COMBAT POWER                 │ [Wayfarer Plate +bonus weight]       │
│ [Strike              14]    │                                      │
│ [Potency              6]    │                                      │
│ [Defense              9]    │                                      │
│ ATTRIBUTES · STR 12 · ...   │                                      │
│ RELICS · 2                  │                                      │
└──────────────────────────────┴──────────────────────────────────────┘
```

## Comparison checklist

- [x] Character/equipment ratios are config-driven and normalized.
- [x] Combat Power cards are vertical and use stable component IDs.
- [x] Armament sockets are individually foldable and ordered by data.
- [x] Stats/Equipment/Hybrid labels and tray defaults are data-driven.
- [x] Narrow cards hide only the secondary bonus line; tooltip content remains.
- [x] Component IDs and selectors are mirrored in `assets/components/armoury.json`
      and `docs/ASSET-COMPONENTS.md`.
