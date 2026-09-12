# Current source audit — 2026-09-12

This atlas is a proposed documentation reference, not the current game executing inside the gallery. Source paths refer to the isolated documentation worktree unless explicitly identified below.

## Snapshot boundaries

- Documentation worktree: `D:/repos/AshenSpire-wireframe-docs`, branch `codex/document-wireframe-reference`; audited at `c618177a`, based on the dev snapshot used for this task.
- Owner's active checkout: `D:/repos/AshenSpire`; observed HEAD `3c70be90` (`docs: refresh current-dev architecture [architecture-sync]`), plus uncommitted changes. It is a different source snapshot, not just the documentation baseline with a few local edits.
- Direct file hash comparisons confirmed differences in HUD, cards, combatant frames/inspector, tooltips, combat and map. Therefore this atlas must not claim exact current-checkout parity. The requested presentation changes remain proposals; references identify reusable concepts and source anchors.

## Meaningful committed-source differences

| Source / symbol | Documentation baseline | Owner's current checkout | Reference implication |
| --- | --- | --- | --- |
| `src/ui/components/hudmeta.js` / `quickAccessPanelHtml` | Resources beside Armoury and Menu; every potion control on detached rail | Adds healing/mana flask host below Armoury/Menu, making a 2×2 control group; detached rail contains carried potions | HUD gallery follows the documented proposal/baseline. Current checkout has an additional flask subgroup. Do not call the two controls an exact copy of current checkout. |
| `src/ui/components/hudmeta.js` / `sharedRunHudHtml` | No fold grip | Renders `hudModeGrip`, `data-hud-mode`, and next-mode command | Current HUD also supports compact/expanded state. Presentation-layer visibility controls are a proposed configurable alternative, not proof that production grip was removed everywhere. |
| `src/ui/viewModels/RunHudViewModel.js` | No HUD-mode model | Imports `hudModeGripModel` and `normalizeHudMode` | Model inheritance differs across snapshots. |
| `src/ui/components/runHud.js` | Exists, shared noncombat HUD renderer | File absent | This is a baseline-only reference. Use source snapshot links instead of implying it exists in the owner's current checkout. |
| `src/ui/components/combatantFrame.js` | `updateCombatantFrame` and `adoptCombatantFrame` preserve/reuse existing frame slots; status trailing nodes explicitly ordered first | Only creation renderer; appends supplied trailing order | Proposed shared-component lifecycle must be implemented deliberately; do not infer current DOM reuse. |
| `src/ui/components/card.js`, `combatantInspector.js`, `tooltip.js`; `src/ui/screens/combat.js`, `map.js` | Different files by direct hash comparison | Different committed snapshot | Detailed equivalence was not established. Card/inspector proposals must retain their stated design status. |

## Owner's uncommitted UI changes

These files were read without editing or copying changes into the documentation branch.

- `src/ui/screens/reward.js`, `renderChooser`: card click now selects a radio option and highlights/lifts it. A separate footer Confirm starts disabled and becomes enabled after selection; Back remains inline. Reference reward flow should preserve selection-before-confirmation and should not grant a card immediately on selection.
- `styles/kit.css`, `.reward-selected` and `.reward-confirm`: selected card gold border/glow/lift; available Confirm green. These agree with the requested selection/confirmation design.
- `src/ui/screens/equipment.js`, `bindInformationCardAccordion`: opening a character information card closes siblings, focuses its heading and scrolls it into view. Uniform summary faces are styled in `styles/kit.css`. Reference detail workspaces should show one consistent reading lane rather than independently expanding uneven boxes.
- `src/ui/components/statAllocationCard.js`, `drawRows`: remembers expanded attribute faces across rerenders and adds a disclosure chevron. `styles/kit.css` makes the label/summary and stepper share a single bordered header, with full-width details below.
- `src/ui/screens/customize.js`, `mountCustomize`: moves sprite choices into a disclosure at the bottom of the character preview pane. `styles/ui.css` gives the art the remaining preview space and keeps primary-stat faces on one line.
- `src/ui/screens/customize.js` contains unresolved literal conflict markers (`<<<<<<< ours`, `=======`, `>>>>>>> theirs`) in `resetAttributes` and the point-buy mode handler at inspection time. No resolution was attempted. This checkout cannot be treated as a verified runnable source until its owner resolves that unrelated work.

## Checks performed in the documentation worktree

- `node tools/verify-shipped.mjs`: passed all six checks. Existing root/build/dist game artifacts agree and contain embedded art. The tool reported artifact provenance older than the documentation HEAD; documentation edits do not rebuild the game.
- `node tools/buildversion.mjs --check`: passed all eight checks. Version/digest/ordinal containment remained consistent.
- CI declares these through `node tools/verdict.mjs -- …`; it also declares self-tests and `node tests/run-node.mjs`. The full node suite was not rerun in this audit; no full-suite pass is claimed.
- These checks do not render the gallery or game, establish layout fidelity, or verify gameplay. Atlas static/isolated-renderer checks are separately reported by `validate-reference-atlas.mjs`.

## Required interpretation

The source baseline and the live checkout disagree in several areas. The atlas documents the owner's requested architecture and configurable presentation, using named source references as starting points. A future implementation must select and reconcile its actual game snapshot, preserve the owner's current edits, and implement mechanics such as XP/proficiency only through an explicitly approved domain specification. No game mechanic or existing source conflict was changed by this documentation work.

## Configurable comparison added to the HUD reference

The HUD playground now provides **Proposed HUD** and **Current checkout HUD** presets. Current-checkout placement composes WGH8 charge-flask controls beneath Armoury/Menu and exposes WGH9 expanded/compact grip. Proposed placement uses one shared Potions control (WGC11) with WGH8 contents; HP/MP charge providers and carried items such as Smoke vial appear inside its opened contents, never as separate HUD buttons. The proposed preset defaults the grip off. Both preserve the shared resource meters; flask buttons are actions, not duplicate meters. Individual layers remain configurable. The compact reference demonstrates collapsing the band; it does not claim pixel-identical production compact styling. WGH5 blue experience remains a proposed feature in either preset.


### Superseding Potions composition correction

The latest owner direction combines HP potion, MP potion and carried consumables under the same reusable Potions control. WGH8 now documents that control's contents and WGH6 references WGC11 rather than individual consumable buttons. Source data may retain separate charge providers and inventory records; their view model joins references without duplicating ownership. The current-checkout source comparison above remains historical evidence of the existing separate-control layout, not the desired layout.


### Final placement correction: footer only

The owner subsequently clarified that **Potions belongs exclusively to the footer HUD**. This supersedes all earlier proposed top-HUD rail placements. WGH4 and WGH6 must omit Potions in both preview presets. WGC11 in the footer opens shared WGH8 contents containing HP/MP charge providers and carried items. Configuration/sample fields remain available for that footer projection; they do not authorize a second control in the top HUD. The current-checkout comparison above describes existing source only, not the desired or preview placement.


### Vitality track proportions

Current `src/model/resources.js` / `resourceBarPlan` distinguishes `lengthPct = maximum / reference` from `pct = current / maximum`; `src/content/resources.js` currently defines reference maxima of 200 HP, 20 MP, and 20 stamina. The requested documentation defaults are **200 HP / 10 MP / 10 stamina**. The atlas therefore documents an explicit configurable presentation change, not a domain maximum change.

WGH1 uses `config.vitality.referenceMaximum`, `maximumWidthPercent`, and `scaleByMaximum`. Track width follows maximum/reference within the allocated width; fill follows current/maximum inside that track. The current/max label sits in an aligned column outside the track so short meters remain readable. Maximum/reference limits displayed width, never health, mana, stamina, or progression mechanics. Sample stamina now reads 8/10.
