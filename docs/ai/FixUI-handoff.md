# FixUI handoff

The approved combat HUD follow-up is implemented on `feature/FixUI` in `D:/repos/.codex/worktrees/fix-ui/AshenSpire`. The [checkbox checklist with a playable preview per commit](../qa/mobile-combat-20261009/FixUI-checklist.md) records each focused fix and its delivery state. Preserve the original dirty checkout at `D:/repos/.codex/worktrees/9628/AshenSpire`.

## Reference and actual result

- Approved design: [three selection states](../qa/mobile-combat-20261009/approved-selection-design-reference.png).
- [Interactive reference versus actual comparison](../qa/mobile-combat-20261009/hud-comparison.html).
- Actual build 1227 evidence: [QA record](../qa/mobile-combat-20261009/README.md).

The historical build 1227 had too much empty space above enemies, placed the player behind the cards and detached selected details. FixUI raises the enemies, keeps the player above the hand, attaches selected details beside the player and fits the existing Log/Reaction controls across the card band. Cards, fan, hotkeys and footer are preserved. The current comparison uses actual source screenshots and labels the illustration separately.

## Required behavior

Idle enemies show compact intent symbols with a question mark when unknown, HP and status symbols. Selection reveals names and background panels. Sprite, intent and HP select the same owner and accept armed card targeting; player HP accepts self-cast abilities. Enemy outlines are red and player outlines green. The small Information control stays above its character and participates in its highlight. A selected action card displays the authored action/stance symbol above the player.

Selected sprites temporarily scale to 105 percent around their ground anchor and rise above other sprites. Deselect restores exact size and depth. Card play never permanently resizes or moves a sprite; melee returns to its original anchor. Header HP is proportional and leaves padding before Armoury. Compact Log and Reaction sit directly above cards; vertical log dragging snaps to three sizes without inner size buttons. Text fits its available width with padding.

## Target ownership and regression checks

The target-core packing follow-up is committed. The actual stage adapter checks foreign artwork ownership, reserves selected enemy cores and disables stale packed pseudo-element hit areas. Selected portrait player foot proxies and hidden idle enemy footers do not reserve space in player HUD packing.

Independent browser review covers native taps and ownership, in addition to covered-control counts. Where character art overlaps, the top painted owner receives the tap. Transparent target squares must leave other sprites selectable. Focused regression fixtures cover foreign artwork, fixed selected cores, unused footers and geometry restoration; the checklist records final validation.

The motion sampler correction ignores elements with no client rectangles, such as display:none name labels, while preserving detection of transparent, transformed and offscreen motion. Native card-play checks exercise real turns, melee return, empty-hand resizing and next draw. Physical-phone acceptance remains separate from browser emulation.

## Delivery

Worktree and generated outputs must remain under D:/repos/.codex. Read CONTRIBUTING.md. The approved HUD feature was merged as PR1787 and promoted by PR1790; this snapshot is follow-up work. Complete independent review, actual phone-size and desktop pointer/touch checks, build receipts and required CI before a subsequent dev/test merge. Root alternative/dev and alternative/test are frozen. The user has already approved implementation and merging.
