# Desktop split-footer wireframes — A–G

Docs-only selection review. **A is recommended as the closest literal match to the markup.** No runtime, mobile or tablet changes are included.

[Open the interactive gallery](index.html). Each SVG/HTML is self-contained apart from its neighboring image; all PNGs are full 1440×900 viewport captures. Labels and comparison notes outside the viewport are review annotations, not proposed game UI.

![All seven desktop options](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/docs/design/desktop-footer-options-2026-10-16/overview.png)

## Shared layout

The original header and approved battlefield retain their bounds and actor sizes/anchors. Stamina + Draw are anchored bottom left; Discard + Potions bottom right; End Turn is much larger at bottom center. Combat log sits directly above the left group and Reaction directly above the right group. No new dock, column or panel is introduced.

The baseline cards are approximately 142×210. Proposed cards are 200–212×300–318 (approximately 40–50% larger) with exact 2:3 proportions. The enlarged hand overlaps the otherwise empty lower field margin. It does not move or shrink actors: the player’s feet end at y505, and every first-card corner remains below that line. The card layer sits in front of the empty scenery margin; no actor is hidden. The lowest few pixels of the floor shadow can continue behind the hand. Fan rotations are deliberately small. Five cards are shown as the common comparison fixture, not a new hand-capacity rule.

Corner groups end near y890. Combat log/Reaction occupy the fixed y750–779 line above them. Each End Turn group includes its existing HOLD hint and ends at y894. These controls retain their familiar components and order within each group.

| Option | Card W×H | Card top–bottom | Step / overlap | Outer fan angle | Corner inset / width | End Turn W×H and vertical bounds |
|---|---|---|---|---|---|---|
| A | 208×312 | 512–824 | 182 / 26 | ±0° | 16 / 205 | 320×62, y832–894 |
| B | 200×300 | 518–818 | 190 / 10 | ±0° | 24 / 197 | 300×72, y822–894 |
| C | 210×315 | 512–827 | 178 / 32 | ±0° | 16 / 205 | 340×60, y834–894 |
| D | 204×306 | 516–822 | 184 / 20 | ±0.7° | 20 / 201 | 320×68, y826–894 |
| E | 208×312 | 514–826 | 188 / 20 | ±0° | 16 / 205 | 280×64, y830–894 |
| F | 210×315 | 512–827 | 173 / 37 | ±0° | 24 / 197 | 360×64, y830–894 |
| G | 212×318 | 512–830 | 177 / 35 | ±0.45° | 16 / 205 | 340×58, y836–894 |

## A — Literal split · recommended

Closest to the markup: large centered hand, fixed corner pairs, strong center action.

![Option A: Literal split · recommended](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/docs/design/desktop-footer-options-2026-10-16/option-a.png)

## B — More exposed card faces

Slightly smaller cards with only 10px overlap; more of every face stays visible.

![Option B: More exposed card faces](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/docs/design/desktop-footer-options-2026-10-16/option-b.png)

## C — Larger flat hand

Larger faces and 32px overlap; a wider End Turn keeps the same bottom center.

![Option C: Larger flat hand](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/docs/design/desktop-footer-options-2026-10-16/option-c.png)

## D — Gentle fan

A small fan softens the hand; the first card still clears the player’s feet.

![Option D: Gentle fan](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/docs/design/desktop-footer-options-2026-10-16/option-d.png)

## E — Wider centered hand

The hand spreads a little farther across the center; corner groups remain fixed.

![Option E: Wider centered hand](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/docs/design/desktop-footer-options-2026-10-16/option-e.png)

## F — Compact span · larger action

More card overlap gives the largest End Turn a clear center emphasis.

![Option F: Compact span · larger action](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/docs/design/desktop-footer-options-2026-10-16/option-f.png)

## G — Largest faces · shallow fan

212px faces with a shallow fan; a shorter End Turn keeps room below the hand.

![Option G: Largest faces · shallow fan](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/docs/design/desktop-footer-options-2026-10-16/option-g.png)

## Approval boundary

These seven close variants are for selecting the desktop composition. Choosing one is not a claim that the game has changed. Responsive behavior, variable hand counts, input targets and runtime validation belong to implementation after selection. The SVG generation source is `generate.py`; no existing screenshot or game artwork was edited.
