# Approved combat HUD and mobile targeting

The owner approved the refined header and three selection states on October 9, preserving the existing card fan and footer. Build 0.7.1.1205 adds the final HUD behavior and 105% selection emphasis.

## Verified behavior

- Native touch at 288, 320 and 390 pixels: HP selects its owner; selected Information opens inspection in one tap; a defensive card shows its stance icon and plays through the player HP strip; enemy intent and body-target routes play accepted cards. End Turn, reaction decline, the log toggle and reaction switch also work through touch.
- Phone and desktop: selected sprites scale exactly 105%, rise above other sprites, keep their center/ground anchors and fitted dimensions, survive rerender without compounding, and restore original geometry/depth on deselection. Idle enemies have no selection outline; armed targets retain their aiming cue.
- Five header widths (288, 320, 390, 844, 1280): the HP trough ends 12 pixels before Armoury. An actual enemy turn changes the fill from 63/63 to 53/63.
- Compact names remain hidden until selection; idle enemy HP sits above the sprite. Selected names sit below the body. Player details clear enemy controls and the hand toolbar; Information remains above the player. Intent/ribbon clearance measures 4 pixels on the narrow layout.
- Existing native log drag regression covers three bounded snap sizes, cancellation, subsequent taps, and keyboard access without inner size buttons.

## Evidence and reproduction

Run `tools/combat-mobile-touch-qa.mjs`, `tools/combat-sprite-selection-qa.mjs`, `tools/combat-header-qa.mjs`, and `tools/combat-log-touch-qa.mjs`. `COMBAT_QA_URL` selects source or package; `COMBAT_QA_OUT` selects the output directory. Playwright must be available through the installed Node runtime.

The final **0.7.1.1205 package** passed all three phone sizes with zero page errors and no injected combat state. The [results](approved1205-mobile-results.json) include viewport, loaded URL, geometry and the consumed card instance for each play route. The [package record](approved1205-package.json) identifies the tested HTML by SHA-256.

| Viewport | Idle | Player selected | Enemy selected | Defensive card selected |
| --- | --- | --- | --- | --- |
| 288 × 513 | [Screenshot](approved1205-288-initial.png) | [Screenshot](approved1205-288-details.png) | [Screenshot](approved1205-288-enemy-selected.png) | [Screenshot](approved1205-288-card-selected.png) |
| 390 × 844 | [Screenshot](approved1205-390-initial.png) | [Screenshot](approved1205-390-details.png) | [Screenshot](approved1205-390-enemy-selected.png) | [Screenshot](approved1205-390-card-selected.png) |

The 320 × 568 run is included in the final results. Files marked `1191` and the earlier unversioned screenshots record the prior layout; `approved1205-*` records the approved final package. Generated illustration approvals are design references, not gameplay evidence. Hosted checks and dev/test promotion are reported separately.
