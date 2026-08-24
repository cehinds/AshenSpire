# Folding Tray Component Contract

## Component names

- **Folding Tray** (`folding-tray`): edge-aware disclosure container.
- **Tray Header** (`tray-header`): one fold control containing the arrow, tray
  name, and quantity, plus an optional real sort action.
- **Tray Resize Handle** (`tray-resize-handle`): expanded-only 44px drag/hold
  surface. Top/Bottom resize vertically; Left/Right resize horizontally.
- **Tray Content** (`tray-content`): pluggable content area. Inventory items,
  cards, stats, relics, or future menu-specific item models remain responsible
  for their own markup and behavior.

The `trayModel` factory returns an immutable, DOM-free Folding Tray Component
Model. It owns `id`, `name`, `edge`, expanded
state, total quantity, item-type noun, optional sort affordance, and child item
models. `renderTray` owns the shared DOM and accessibility contract.

## Current Armoury instances

The Armoury does not maintain a parallel pane-header system. Its four content
families compose the same base component:

| Tray | Content model | Optional expanded action | Saved size |
|---|---|---|---|
| Armaments | Procedural occupied/empty/locked equipment positions | List/Grid | Not resizable in the current Armoury |
| Inventory | One authoritative carried-item list | Contextual filter/action only | Saved when mounted as a resizable supporting tray; disabled while it fills Inventory view |
| Cards | Equipment-associated card list | List/Grid | By stable Cards tray ID |
| Stats | Class, level, combat, attributes, resources, relics | None | By stable Stats tray ID |

Not every presentation mounts all four at once. Character uses its full-width
character surface without a duplicate Stats tray; Inventory pairs Armaments and
Inventory and exposes Stats; Hybrid pairs the compact Character pane and
Armaments with Inventory and Cards as supporting trays. The shared structure
and arrow rule remain identical wherever a tray is mounted. Sorting and
resizing are optional capabilities declared by each instance; saved-size
behavior is identical among the instances that enable resizing.

## Direction rule

The arrow says what pressing it will do. A closed tray points inward toward the
space it will open into. An open tray points back toward its anchored edge.

| Edge | Closed / open inward | Open / fold outward |
|---|---|---|
| Top | `v` | `^` |
| Right | `<` | `>` |
| Bottom | `^` | `v` |
| Left | `>` | `<` |

## Bottom tray

```text
FOLDED — anchored to the bottom, opens upward
┌──────────────────────────────────────────────────────────┐
│ ^  TRAY NAME                         ×N items             │
└──────────────────────────────────────────────────────────┘

UNFOLDED — folds back toward the bottom
┌──────────────────────────────────────────────────────────┐
│ v  TRAY NAME                         ×N items   [sort]    │
├──────────────────────────────────────────────────────────┤
│ [ tray item component                                  ] │
│ [ tray item component                                  ] │
└──────────────────────────────────────────────────────────┘
```

## Top tray

```text
FOLDED — anchored to the top, opens downward
┌──────────────────────────────────────────────────────────┐
│ v  TRAY NAME                         ×N items             │
└──────────────────────────────────────────────────────────┘

UNFOLDED — folds back toward the top
┌──────────────────────────────────────────────────────────┐
│ ^  TRAY NAME                         ×N items   [sort]    │
├──────────────────────────────────────────────────────────┤
│ [ tray item component                                  ] │
│ [ tray item component                                  ] │
└──────────────────────────────────────────────────────────┘
```

## Right tray

```text
FOLDED — right rail, opens left into the component section
┌────┐
│ <  │
│ T  │
│ R  │
│ A  │
│ Y  │
│ ⋮  │
│ ×N │
└────┘

UNFOLDED — folds back toward the right edge
┌──────────────────────────────────────────────────────────┐
│ >  TRAY NAME                         ×N items   [sort]    │
├──────────────────────────────────────────────────────────┤
│ [ tray item component                                  ] │
│ [ tray item component                                  ] │
└──────────────────────────────────────────────────────────┘
```

## Left tray

```text
FOLDED — left rail, opens right into the component section
┌────┐
│ >  │
│ T  │
│ R  │
│ A  │
│ Y  │
│ ⋮  │
│ ×N │
└────┘

UNFOLDED — folds back toward the left edge
┌──────────────────────────────────────────────────────────┐
│ <  TRAY NAME                         ×N items   [sort]    │
├──────────────────────────────────────────────────────────┤
│ [ tray item component                                  ] │
│ [ tray item component                                  ] │
└──────────────────────────────────────────────────────────┘
```

## Implementation prompt

```text
Design and implement AshenSpire's reusable Folding Tray component.

Fantasy and tone: dark-fantasy field equipment, parchment and worn metal;
restrained state-change motion; never a generic dashboard accordion.
Viewpoint: browser roguelike with live Map and Combat playfields plus modal
Armoury and menu surfaces.

Composition:
- The `trayModel` factory composes `trayHeaderModel` and `trayContentModel` records.
- Tray Header contains one accessible fold control: directional arrow, tray
  name, and total quantity written as “×N <item type>”.
- An optional sort action appears only when a real sorting behavior is wired.
- Tray Content accepts reusable item Component Models without knowing their
  domain type.

Edges:
- Top and Bottom collapse to full-width horizontal bars.
- Left and Right collapse to narrow full-height rails.
- Closed arrows point inward; open arrows point back to the anchored edge.
- The open Right Tray header is exactly “> TRAY NAME …”.

Responsive and access rules:
- 44 CSS-pixel minimum target after UI scaling.
- Preserve keyboard/gamepad focus when a redraw replaces the header.
- aria-expanded and aria-controls must match visible state.
- Counts remain visible while folded and represent total quantity, not merely
  the number of rendered rows.
- Expanded content owns its scrollport; it must not push the modal off-screen.
- Keep central gameplay clear and collapse secondary trays by default.
- Inset Left and Right tray shells from their anchored edge and vertical bounds
  with the shared `--ui-tray-side-margin` token.
- Start resizing immediately with a mouse, or after a short deliberate hold on
  touch. Arrow keys resize a focused handle in 16px steps.
- For a resizable instance, remember expanded size by stable tray id and edge.
  Folding always returns to the standard bar/rail; reopening restores the last
  expanded size.
- Before the player resizes it, the generic component may hug its header and
  visible contents. Armoury supporting trays intentionally opt into the
  data-authored default height ratio immediately.
- Bottom trays anchor to the bottom edge and grow upward; Top trays anchor to
  the top edge and grow downward.

Avoid: hand-written tray headers in screens, inert sort icons, arrows with
different meanings between edges, hidden counts, and item-specific logic in
the shared renderer.
```

## Recommended defaults

1. Use one shared spacing and typography token set for tray and menu headers,
   while keeping their semantics distinct: trays disclose content; menus
   navigate or invoke actions.
2. Default secondary Armoury trays to folded. Optionally enforce one open tray
   per group on compact screens so the figure and equipment slots retain room.
3. Persist expansion and sort state by tray id, never by DOM position.
4. Show sort only after the tray provides named strategies such as `type`,
   `name`, `newest`, or `equipped`; never ship a decorative button.
5. Let layout data choose the edge. Do not infer it from viewport width inside
   the renderer.
6. Tune the slight Left/Right tray breathing room once through
   `--ui-tray-side-margin`; do not add screen-specific margins.

## Verification

`node tools/tray-components.mjs --shots` drives all four edge variants in a
real browser, checks literal arrows (including open Right `>`), ARIA/content
state, side-rail geometry, child-model delivery, and every configurable Armoury
subject. It also verifies the clickable catalog detail drawer and the dedicated
[`tray-gallery.html`](./tray-gallery.html) page. Its eight-state visual artifact
is written to `scratch/tray-components/eight-state-trays.png`.
