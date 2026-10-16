# Approved mobile floor and mini HUD

The floor's visible terrain now starts at least 10 physical pixels above the highest occupied back-row shadow. It updates after layout and resizing, preserves artwork proportions, and does not move or resize combatants. The player's mini health bar spans its full inner width, with enemy-matched thickness and text scale. Existing defense badges sit below-left and the HP fraction below-right. Both adjustments follow the selected Mobile form factor.

| View | Screenshot |
| --- | --- |
| Approved design | [Wireframe](approved-wireframe.png) |
| Core, 390×844 | [Three bosses](core-390-three.png) |
| Current, 390×844 | [Three bosses](current-390-three.png) |
| Core, 430×932 | [Three bosses](core-430-three.png) |
| Core, 360×740 | [Three bosses](core-360-three.png) |
| Mobile selected in Settings on an 844×390 host | [Centered view](selected-mobile-landscape.png) |

Final 390px and centered-view screenshots were captured on 2026-10-16 from local standalone source `175cf7da4`, runtime `ba56c020d0`, build `0.7.1.1534`. HTML SHA-256: `ee711527bbcf14955a806a57e565fcbaa7423dd64bbe53b94f6ebf41421a259f`. Core and Current use the same runtime through the existing profile parameter. Captures exercise real game controls and the existing combat fixture; no actor positions or screenshot DOM were edited.

Seven portrait cases across 360, 390 and 430px passed on source `4d0862353` / runtime `4f9bbce2e8`. The final correction retains pixel-identical Core/Current portrait captures and desktop output. Final resizing and actual Settings → Mobile checks confirm 10px clearance and actors contained in the centered game area. Automatic landscape uses its existing Tablet layout. No horizontal overflow or browser exceptions were recorded. Shared defense-badge tooltips retain their behavior.

The centered-view check exposed and fixed an existing coordinate bug: field-relative positions were subtracting the outer viewport inset twice. The stage now uses a local zero origin for those conversions; it does not change global viewport scaling. Selected Mobile still simulates a portrait game area inside a landscape host; this work does not redesign that preset's compact hand or field proportions.

Focused floor, formation, overhead and browser regression checks passed. [Final QA report](final-report.json) · [Configuration and implementation guide](../../../../ai/json-game-modules/MOBILE-FLOOR.md).

[Core standalone build](https://github.com/cehinds/AshenSpire/actions/runs/38976523633/artifacts/12079182071) · [Current standalone build](https://github.com/cehinds/AshenSpire/actions/runs/38976558207/artifacts/12079610146).

These builds remain on Feature branches. Live Pages publication is unverified; the screenshots verify the local standalone built from the listed source.
