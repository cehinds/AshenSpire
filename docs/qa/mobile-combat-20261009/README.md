# Approved combat HUD and mobile targeting

The owner approved the refined header and three selection states on October 9, preserving the existing card fan and footer. The final package tested here is **0.7.1.1227**, digest `73455e1bea`. It includes the consolidated primary battlefield geometry/renderers, approved HUD and 105% selection emphasis, bounded footer packing, and the duplicate self-target activation fix integrated from dev.

## Verified behavior

- Native touch at 288, 320 and 390 pixels: HP selects its owner; selected Information opens inspection in one tap; a defensive card shows its stance icon and plays through the player HP strip; enemy intent and body-target routes play accepted cards. End Turn, reaction decline, the log toggle and reaction switch also work through touch.
- Final package at 390 × 844 and 1440 × 900: selected sprites scale exactly 105%, rise above other sprites, keep their center/ground anchors and fitted dimensions, survive rerender without compounding, and restore original geometry/depth on deselection. See [selection results](approved1227-selection-results.json).
- Earlier source header checks at five widths (288, 320, 390, 844, 1280): the HP trough ends 12 pixels before Armoury. An actual enemy turn changes the fill from 63/63 to 53/63. This standalone header matrix preceded the final receipt rebuild; it is not an additional exact-package claim.
- Compact names remain hidden until selection; idle enemy HP sits above the sprite. Selected names sit below the body. Player details clear enemy controls and the hand toolbar; Information remains above the player. Intent/ribbon clearance measures 4 pixels on the narrow layout.
- Final package native log drag checks at 288, 320, 390 and 844 pixels cover three bounded snap sizes, cancellation, subsequent taps, and keyboard access without inner size buttons. See [log results](approved1227-log-results.json).
- Final package card-play stability and empty-hand resizing checks also pass. See [stability results](approved1227-stability-results.json), [empty-hand resize results](approved1227-empty-hand-resize.json), [phone stability results](approved1227-phone-stability-results.json), and [phone empty-hand resize results](approved1227-phone-empty-hand-resize.json).

## Evidence and reproduction

Run `tools/combat-mobile-touch-qa.mjs`, `tools/combat-sprite-selection-qa.mjs`, `tools/combat-header-qa.mjs`, and `tools/combat-log-touch-qa.mjs`. `COMBAT_QA_URL` selects source or package; `COMBAT_QA_OUT` selects the output directory. Playwright must be available through the installed Node runtime.

The final **0.7.1.1227 package** passed all three phone sizes with zero page errors and no injected combat state. The [results](approved1227-mobile-results.json) include viewport, loaded URL, geometry and the consumed card instance for each play route. The [package record](approved1227-package.json) identifies the tested HTML by SHA-256.

| Viewport | Idle | Player selected | Enemy selected | Defensive card selected |
| --- | --- | --- | --- | --- |
| 288 × 513 | [Screenshot](approved1227-288-initial.png) | [Screenshot](approved1227-288-details.png) | [Screenshot](approved1227-288-enemy-selected.png) | [Screenshot](approved1227-288-card-selected.png) |
| 390 × 844 | [Screenshot](approved1227-390-initial.png) | [Screenshot](approved1227-390-details.png) | [Screenshot](approved1227-390-enemy-selected.png) | [Screenshot](approved1227-390-card-selected.png) |

The 320 × 568 run is included in the final results. The selected enemy footer at 390 pixels is pushed farther below its sprite to clear the player's HP and Information controls. This is visible in the capture; the tests verify accessibility and overlap clearance, not a maximum attachment gap.

These are local packaged-browser checks with emulated touch, not physical-phone, hosted deployment, live co-op, or owner acceptance. The mobile matrix verifies HP selection and intent/body-target card play; it does not independently prove every unarmed sprite selection route. Hosted CI and dev/test promotion are reported separately.

Files marked `1191`, `approved1205-*`, and the earlier unversioned screenshots record prior layouts. `approved1227-*` records the final package after primary battlefield consolidation. Generated illustration approvals are design references, not gameplay evidence.
