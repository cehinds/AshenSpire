# Desktop target HUD

Author `content/config/ui/components/combatTargetHud.json` to change physical panel widths, gaps, lane preferences, the 500 ms dwell, fade duration, or red/blue cell tints. Compile through `node tools/config-build.mjs`; the generated UI module is shared with the rest of the game.

The feature is enabled only for desktop/widescreen alternative formation. Mobile, tablet, Classic, and other layouts keep their existing HUD. `combat.dataset.targetHud` publishes the gate before the battlefield fit; the stage owns sprites and emits `battlefieldgeometrychange` after fitting. Each frame provides `targetHudLane` and `targetHudCellPolygon` in physical field-relative coordinates. Detail positions convert physical coordinates into the field's local scale once.

`TargetHudModel` owns the fixed panel placement (`enemyHudPlacement`, `playerHudPlacement`), the mini HUD font scale (`miniHudScale`) and the stable 500 ms transition clock. `combatTargetHud` owns the DOM, pointer corridor, focus retention, fade, resize listeners and cleanup. It consumes paced values and the same projected intent as overhead HUDs. It never issues a combat command. Card eligibility is supplied by `pendingTargetPlan().legalIds`; a preview does not play.

A single dwell applies on entry, exit and stable switches. Reduced motion keeps dwell but skips the opacity transition. Every panel is built once, when its combatant first appears, and is only shown or hidden afterwards; a change of value is written into the nodes that stand (`domWrite.morph`).

Fixed placement (owner, 2026-11-06): an enemy's panel hangs from the top of its own mini HUD rack, centred on its figure, exactly as wide as its cell; the player's stands right of the body at its top, as wide as its cell. Each is placed once per layout pass (`field.dataset.layoutEpoch`) from its own figure alone: no avoidance, no packing, no movement on select, hover, intent or damage, and overlaps are accepted. Only the screen edge clamps. The font, bars and badges scale with the cell width (`--mini-hud-scale`, from `positioning.perspectiveGrid.miniHud` in `combatFormationModel.json`: design width, base font, 9px minimum font, maximum scale).

Status icons reuse the existing shared tray/tooltip components and remain readable while a card is armed. Detail intent receipts describe direct HP at current defenses and committed stance, excluding delayed effects and retaliation. Hidden intent stays hidden in both surfaces.

Winning defending stances now reduce incoming damage by 25% in newly resolved Core and Current profiles. Author `modules.stances.defenseMitigation` in the game JSON (fraction `0..1`; `0` disables it). The engine and intent preview use the same rule, before defense pools. Existing saved resolved profiles without this setting keep their previous rules. Green means the displayed damage range is strictly reduced against a neutral-stance baseline; an Evade range with a higher possible maximum remains red.

Fresh profile-backed enemy occupancy is back-right, back-left, back-middle, front-right, front-middle, front-left. Existing saved/moved positions are preserved. Sprite feet and shadows are inset into their cells without reducing desktop sprite size. The header owns the live turn indicator and Cinders, and compact overheads stay below it. The approved footer and header fades are retained.

Checks: `node --test tests/target-hud-model.test.mjs`, projected intent tests, and actual browser checks for desktop/widescreen crowded targets, card/self eligibility, keyboard focus, tooltip corridor, reduced motion and mobile/Classic fallback.
