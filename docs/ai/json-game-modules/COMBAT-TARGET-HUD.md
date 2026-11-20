# Combatant HUD and inspection

## Current behavior

In the current formation combat view, combatants use compact overhead controls:
enemy figures show their observer-projected intent and compact meters; the
player figure shows HP and the selected action intent. Target eligibility and
selection are separate from reading a combatant. The selected combatant detail
panels are retired: `TargetHudModel.targetHudDesiredIds()` returns no panel
IDs, so selecting, hovering, focusing or targeting a figure does not open a
floating detail panel. Use the existing Inspect control to open combatant
inspection.

The behavior boundary is split across these owners:

| Owner | Responsibility |
| --- | --- |
| `src/ui/components/combatantOverhead.js` | Builds the intent and Inspect controls; intent text is projected for the observer. |
| `src/ui/components/combatTargetHud.js` | Attaches the current formation's overhead targeting/inspection interactions and layout lifecycle. It does not issue a combat command for an ineligible target. |
| `src/ui/models/TargetHudModel.js` | Owns current formation gating, fixed mini-HUD sizing/placement helpers and the dwell helper; selected detail panels are not requested. |
| `content/config/ui/presentation/combatFormationModel.json` | Owns formation geometry, overhead insets/gaps and the mini-HUD design width, base font, minimum font and maximum scale. |
| `content/config/ui/scenes/w4a-combat.json` | Owns combat scene sizing, combatant meter sizing, intent visibility by role and selected-only meter fields. |
| `content/config/ui/components/combatTargetHud.json` | Retains shared component interaction/presentation defaults. A key can be tuned only when its reader is active in the current surface; do not infer that a stored detail-panel setting means the panel is shown. |

Edit the authored JSON under `content/config/ui/`, never
`src/config/generated/ui.js`. Compile and check with
`node tools/config-build.mjs` and `node tools/config-build.mjs --check`.
After geometry changes, build/check the game artifact and inspect the affected
formation in the intended viewport. These checks validate authored projections;
they do not prove browser behavior or restore the retired selected panels.

## Acceptance boundaries

The following browser scripts assert selected detail-panel markup and are
retired as current-HUD acceptance: `tests/target-hud-native-targeting.browser.mjs`,
`tests/combat-player-hud-right.browser.mjs`,
`tests/player-hud-right-of-player.browser.mjs`,
`tests/target-body-hud-alignment.browser.mjs`, and
`tests/fixcore-combat-ui.browser.mjs`. Their panel assertions do not describe
the current runtime. Do not use their results to accept or reject the current
overhead HUD. Select a browser door only after checking its selectors and
expected behavior against the current implementation and viewport; this guide
does not nominate an unverified alternate script.

For model-level changes, run the owner-focused tests such as
`node --test tests/target-hud-model.test.mjs` and the relevant configuration
checks. For a visible interaction or geometry change, verify the actual current
surface in the browser with an acceptance case that names the intended viewport,
observable behavior and failure condition.
