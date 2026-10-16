# Battlefield visual preview — approval pending

**Current review:** [visual-review.html](visual-review.html), [1440×900 image](visual-preview-1440.png), [1920×1080 image](visual-preview-1920.png). The openable [visual-preview.html](visual-preview.html) is a frozen browser DOM snapshot with existing embedded game artwork, repositioned by docs-only `visual-preview.js`. It has no game engine, interaction or persistence. No production source is changed.

The updated wireframe has four visual depth bands across three columns. A: enemy back / top-right cell anchor. B: enemy front / bottom-left anchor. C: extra combatant row, configurable and occupiable but planned disabled in core and enabled in the current module. D: player / bottom-center anchor, leftmost cell by default. The core visual preview leaves C empty. These visual depth-band names are not changes to the existing saved formation cell/lane addresses. Exact module schema and allocation belong to implementation after visual approval.

The prototype uses the normal two-enemy screenshot fixture: one back and one front, with the player in leftmost D. Ground scene art retains its proportions, shows more sky, and sits lower. Shadows follow figure widths. Original header, centered hand, utility button/toggle and stone footer arrangement are preserved. Footer and card artwork scale uniformly. Combat log/Reactions use fixed screen edges above the hand. The lower HUD background is continuous. The previous A–G layouts are rejected archive material.

Validation: Chromium renders at 1440×900 and 1920×1080; all five cards and the complete original footer fit on screen; no horizontal overflow; no production source edits. This is a visual composition preview, not a gameplay test or implementation claim. The original low-resolution embedded art is retained; its existing softness is visible at desktop scale.

---

# Revised original battlefield layout — approval pending

The owner rejected all A–G proposals because the footer was redesigned. Those files are archived proposals, not active candidates.

**Current proposal:** [revised-original.html](revised-original.html), [PNG](revised-original.png), [SVG](revised-original.svg). The original header and footer control arrangement are retained. Existing Combat log and Reaction controls retain their recognizable button/toggle presentation and sides, with fixed screen-relative positions on a slim line above the hand, independent of the hand width.

The footer keeps its existing stone HUD group, enlarged in place, ordered resource orb, draw pile, End Turn, discard pile, potions. The hand remains centered directly above it, with unused hand-space removed. Card frames retain the original 2:3 width-to-height proportion (147×220.5). All lower HUD background uses the same color. Turn banner remains at the upper center of the field; health remains top left, shield/menu top right.

Scene changes remain reduced zoom/lower ground to expose sky, requested 4×3 visual-band anchors and character-width shadows. The updated shared inset shows A/B foot rules and player D; C is the extra configurable combatant band. Card and control sizes are schematic; this is a faithful composition review before the visual preview, then implementation.

## Rejected archive: A–G

# Battlefield approval wireframes — 2026-10-16

Docs-only layout proposals. No battlefield implementation is authorized until the owner chooses an option, then reviews its visual preview.

The archived `index.html` contains the rejected interactive comparison. `overview.png` contains A–G and the common anchor inset. Individual PNG/SVG files are 1440×900. Shapes are schematic, not final artwork; the same required scene, formation anchors and shadow rules apply to every option.

- **A — Balanced desktop · recommended:** Side utilities; five larger cards; compact, readable footer.
- **B — Wide utility rails:** Tall side rails keep logs and reactions beside the stage.
- **C — Single action dock:** One continuous dock combines large cards and full-height controls.
- **D — Left command column:** Resources and turn action on the left; cards center, log at right.
- **E — Right command column:** Large command stack at right; centered hand and quiet left log.
- **F — Raised utility shelf:** Log and reactions sit above a shallow hand dock; sky stays open.
- **G — Split hand wings:** Cards split around a large central turn and resource hub.

## Shared requirements

- Reduce background zoom and move the ground down to expose an upper sky band.
- Keep a perspective 3×3 grid: row A enemies anchor toward each cell’s top right; row B enemies toward bottom left; row C players toward bottom center. Dots show foot anchors; the grid is a review guide, not a requirement to display it during play.
- Keep figures proportional; ground shadows follow the visual silhouette width.
- Enlarge vitality, turn label, character mini HUD, cards and footer controls.
- Combat log and Reactions have their own layout areas and never derive width from the hand.
- Remove unused vertical space around the hand; the entire lower HUD has one continuous background color. Larger card/control content can fill that space.

The representative four-character encounter demonstrates the shared anchor rules; unoccupied dots show all nine cell anchors. Options vary utility placement, command placement, card grouping and lower-panel height. Selection is a layout decision only; exact art, responsive behavior and final sizes belong to the next preview stage.
