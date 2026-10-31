# Desktop target HUD

Author `content/config/ui/components/combatTargetHud.json` to change physical panel widths, gaps, lane preferences, the 500 ms dwell, fade duration, or red/blue cell tints. Compile through `node tools/config-build.mjs`; the generated UI module is shared with the rest of the game.

The feature is enabled only for desktop/widescreen alternative formation. Mobile, tablet, Classic, and other layouts keep their existing HUD. `combat.dataset.targetHud` publishes the gate before the battlefield fit; the stage owns sprites and emits `battlefieldgeometrychange` after fitting. Each frame provides `targetHudLane` and `targetHudCellPolygon` in physical field-relative coordinates. Detail positions convert physical coordinates into the field's local scale once.

`TargetHudModel` owns preferred panel sides, clamping/staggering and the stable 500 ms transition clock. `combatTargetHud` owns the DOM, pointer corridor, focus retention, fade, resize listeners and cleanup. It consumes paced values and the same projected intent as overhead HUDs. It never issues a combat command. Card eligibility is supplied by `pendingTargetPlan().legalIds`; a preview does not play a card.

A single dwell applies on entry, exit and stable switches. The actor, connecting corridor, panel and status row retain the current preview. Reduced motion keeps dwell but skips the opacity transition. All selected candidates receive panels; crowded targets are staggered within the field above the hand.

Side rule (owner, 2026-10-31): with exactly one living enemy its detail card sits to the left of that enemy (`positioning.loneEnemySide`); with several living enemies it sits below the selected one (`positioning.crowdedEnemySide`), shifted inward so the viewport edge never cuts it. The player's card stays pinned right. `combatTargetHud` counts living enemies and passes `enemyCount` to `placeTargetHudPanels`, whose bounds are the field intersected with the combat root and the viewport, cut at the hand top. The lane table `enemyLaneSides` is only the fallback when the count is unknown. `data-side` on the panel records the side actually chosen. The Info button's 25 px strip is on the panel's left on every side.

Status icons reuse the existing shared tray/tooltip components and remain readable while a card is armed. Detail intent receipts describe direct HP at current defenses and committed stance, excluding delayed effects and retaliation. Hidden intent stays hidden in both surfaces.

Winning defending stances now reduce incoming damage by 25% in newly resolved Core and Current profiles. Author `modules.stances.defenseMitigation` in the game JSON (fraction `0..1`; `0` disables it). The engine and intent preview use the same rule, before defense pools. Existing saved resolved profiles without this setting keep their previous rules. Green means the displayed damage range is strictly reduced against a neutral-stance baseline; an Evade range with a higher possible maximum remains red.

Fresh profile-backed enemy occupancy is back-right, back-left, back-middle, front-right, front-middle, front-left. Existing saved/moved positions are preserved. Sprite feet and shadows are inset into their cells without reducing desktop sprite size. The header owns the live turn indicator and Cinders, and compact overheads stay below it. The approved footer and header fades are retained.

Checks: `node --test tests/target-hud-model.test.mjs`, projected intent tests, and actual browser checks for desktop/widescreen crowded targets, card/self eligibility, keyboard focus, tooltip corridor, reduced motion and mobile/Classic fallback.
