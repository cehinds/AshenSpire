# FixUI handoff

This branch preserves the approved combat HUD work for continued implementation. It is a work-in-progress checkpoint, not a declaration that the visual composition or post-merge browser checks are finished.

## Reference and actual result

- Approved design: [three selection states](../qa/mobile-combat-20261009/approved-selection-design-reference.png).
- [Interactive reference versus actual comparison](../qa/mobile-combat-20261009/hud-comparison.html).
- Actual build 1227 evidence: [QA record](../qa/mobile-combat-20261009/README.md).

The actual layout has too much empty space above enemies, places the player too far behind the cards, and separates selected details too far from their characters. Match the approved framing and relative character positions while preserving the existing cards, fan, artwork, hotkeys and footer.

## Required behavior

Idle enemies show compact intent symbols with a question mark when unknown, HP and status symbols. Selection reveals names and background panels. Sprite, intent and HP select the same owner and accept armed card targeting; player HP accepts self-cast abilities. Enemy outlines are red and player outlines green. The small Information control stays above its character and participates in its highlight. A selected action card displays the authored action/stance symbol above the player.

Selected sprites temporarily scale to 105 percent around their ground anchor and rise above other sprites. Deselect restores exact size and depth. Card play never permanently resizes or moves a sprite; melee returns to its original anchor. Header HP is proportional and leaves padding before Armoury. Compact Log and Reaction sit directly above cards; vertical log dragging snaps to three sizes without inner size buttons. Text fits its available width with padding.

## Unfinished changes preserved here

The snapshot includes uncommitted follow-up work from codex/approved-hud-ci-followup: transparent target-core packing in battlefieldStage.js/CombatOverheadModel.js/combat-layers.css, revised screenreach fixtures, and a motion-probe correction with tests. Inspect and validate it before merging.

A review found an 844x390 XL-text case where enemy e3's transparent core intercepted enemy e1's visible body. Subsequent packing changes were still being investigated. Verify the current snapshot fixes ownership rather than assuming that a zero-covered-controls result proves correct routing. A separate assertion expects the old target-coordinate CSS literal and may need a semantic update. Do not weaken reachability or known-bad tests to obtain a green result.

The motion sampler correction ignores elements with no client rectangles, such as display:none name labels, while preserving detection of transparent, transformed and offscreen motion. Focused tests and real-turn planted canvas/image motion checks passed before this handoff. Full final validation of this combined snapshot remains outstanding.

## Delivery

Worktree and generated outputs must remain under D:/repos/.codex. Read CONTRIBUTING.md. The approved HUD feature was merged as PR1787 and promoted by PR1790; this snapshot is follow-up work. Complete independent review, actual phone-size and desktop pointer/touch checks, build receipts and required CI before a subsequent dev/test merge. Root alternative/dev and alternative/test are frozen. The user has already approved implementation and merging.
