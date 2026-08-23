# Armoury layout brief

This is the implementation contract for the character and equipment pane. The
attached screenshots are visual references; the data in
`content/source/armouryUi.json` is the tunable authority.

## Refined prompt

Build one responsive Armoury shell. Hybrid defaults to a 40% character pane
and 60% armaments pane. Inventory defaults to a 60% Armaments pane and 40%
Inventory pane, with a draggable, snapping separator that lets the player save
a different split. Keep the character on the left at every resolution,
shrinking the sprite to fit. Keep the Armaments title, tooltip, and divider
treatment, but make its outer border configurable.

The character pane has a summary header above two stacked regions: a sprite
pane above and a stats pane below. The header begins with
`FORSAKEN · <CLASS> · LEVEL <N>`. Combat Power, Attributes, and Relics are
three independent vertical group cards. Each group can fold or unfold; its
folded header keeps the complete summary values while the expanded body exposes
the existing per-metric, per-attribute, or per-relic cards.

The Armaments pane is a vertical stack generated from authored equipment
groups. No group name or position count is embedded in the renderer. Each group
header contains its active item and an automatically sized strip of every
visible loadout position, including the next locked rung. Every unlocked
position becomes a vertical detail subcard. Inventory opens groups and position
cards when room permits and each expanded item card fills the left pane.
Its identity pane uses about `30%` for the name, category, main combat value,
sprite, tags, value, and weight. Its right-justified detail pane uses about
`65%` for lore, type, effects, bonuses, value, weight, and tag descriptions.
Hybrid keeps the same equipment-group and position cards folded. Every folded position row carries
the equipped item, bonus, and weight fields. The renderer
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

Inventory places a draggable vertical separator between Armaments and the
Inventory list. Its default, minimum, maximum, snap ratios, snap tolerance, and
compact/fold thresholds are authored in `armouryUi.json`. The chosen ratio is a
saved presentation preference. Width changes compact item rows first, fold
loadout-position subcards next, and fold whole equipment groups last so the UI
prefers showing more items before showing verbose detail.

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
│ ▾ ARMOUR [Plate]                  ║ [Forsaken Medallion]     │
│   ▾ Armour Slot 1                 ║ [Straight Sword]         │
│   ┌────────────┬────────────────┐ ║ [Round Shield]           │
│   │ [sprite]   │ Lore/effects   │ ║                          │
│   └────────────┴────────────────┘ ║ draggable separator      │
│ ▾ RIGHT HAND [Sword] [lock]       ║                          │
│   [unlocked position subcards]    ║                          │
│ ▾ LEFT HAND [Shield] [lock]       ║                          │
└────────────────────────────────────┴──────────────────────────┘

Hybrid folded Armaments:
[▸ ARMOUR      Wayfarer Plate   Defense …   Weight —]
[▸ RIGHT HAND  Straight Sword   Strike …    Weight —]
[▸ LEFT HAND   Round Shield     Defense …   Weight —]

Character information:
[▸ COMBAT POWER  Strike 7 · Potency 0 · Defense 5]
[▸ ATTRIBUTES    STR 13 · DEX 10 · CON 12 · INT 10 · WIS 10]
[▸ RELICS        1 equipped · Forsaken Medallion]
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
- [x] Combat Power, Attributes, and Relics are independent vertical group cards
      with summary values in their folded headers.
- [x] Equipment groups and every loadout position iterate from data; Inventory
      expands their 30/65 item cards when width permits, compact thresholds fold
      them progressively, and there is no extra Armaments summary row.
- [x] Inventory panes resize by pointer or keyboard, snap to authored ratios,
      and persist the chosen width as a presentation preference.
- [x] Character/Inventory/Hybrid labels and pane/tray defaults are data-driven.
- [x] Narrow cards hide only the secondary bonus line; tooltip content remains.
- [x] Component IDs and selectors are mirrored in `assets/components/armoury.json`
      and `docs/ASSET-COMPONENTS.md`.
