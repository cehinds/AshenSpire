# Approved combat HUD and mobile targeting

The [approved three-state design reference](approved-selection-design-reference.png) was supplied again by the owner for the remote merge. It defines idle, player-selected and enemy-selected presentation while preserving the existing cards and footer. It is an illustration; the screenshots and package records below are runtime evidence.

The owner approved the refined header and three selection states on October 9, preserving the existing card fan and footer. The historical packaged checkpoint below is **0.7.1.1227**, digest `73455e1bea`. It includes the consolidated primary battlefield geometry/renderers, approved HUD and 105% selection emphasis, bounded footer packing, and the duplicate self-target activation fix integrated from dev. Subsequent FixUI source checkpoints are recorded at the end of this page.

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

## FixUI follow-up — October 10

The [commit checklist](FixUI-checklist.md) links a playable preview for each focused fix pushed to `origin/feature/FixUI`. Current source checkpoint 5a is `2900824566f`; it incorporates the positioning, floor, selected HUD and compact tool-row fixes plus concurrent branch updates. The snapshots share the verified `hd-assets-v18` art cache. These are local source checks, not a new packaged release.

The player is fully above the hand; enemies occupy the upper field on portrait phones. Hidden enemy footers no longer reserve space that pushes selected player details away. The small Information control remains over the sprite, and selected details fit beside the player. The tool row spans the card band with Log left and Reaction right. Existing card sizing, fan and footer controls retain their code and layout.

| Viewport | Idle | Player selected | Enemy selected |
| --- | --- | --- | --- |
| 288 × 513 | [Actual](fixui-288-idle.png) | [Actual](fixui-288-player.png) | [Actual](fixui-288-enemy.png) |
| 390 × 844 | [Actual](fixui-390-idle.png) | [Actual](fixui-390-player.png) | [Actual](fixui-390-enemy.png) |

These posed captures used `?shot=combat&preview=rear-player` after artwork and fonts loaded. The [interactive comparison](hud-comparison.html) shows these actual states against the approved illustration; it does not claim pixel fidelity.

Validation:

- Native emulated touch at 288, 320 and 390 pixels: [selection, inspection, real card targeting/self-cast and End Turn](fixui-mobile-results.json). The [post-predicate 288 rerun](fixui-final288-results.json) also passes.
- Independent reviewer `/root/layout_ci_review`: reach sweep at 288 × 513, 390 × 650 and 844 × 390 for normal, XL text and overlap fixtures; zero covered controls. The XL native ownership audit confirms packed cores hit their own owner and leave foreign sprite bounds clear. Actual overlapping artwork receives taps for the top painted owner.
- [Selection geometry](fixui-selection-results.json) at 390 and 1440 pixels: 105% enlargement around the ground anchor, front depth, stable rerenders and exact size/depth restoration.
- [Log touch gestures](fixui-log-results.json) at 288, 320, 390 and 844 pixels: bounded Small/Medium/Large snapping, cancellation, subsequent taps and keyboard resizing; no inner size buttons.
- [Real card-play stability](fixui-stability-results.json): defensive and melee plays, return to original anchors, empty-hand resize and next draw.
- Engine/tool invariant runner: `node tests/run-node.mjs --no-selftests --no-discovered`, 149 passed, zero failed. Fast discovered runner: `node tests/run-node.mjs --discovered-only --no-slow`, 416 files, 3,541 tests, zero failed. The runner reports its existing exclusions and slow lane separately. No test was quarantined for this change.
- Focused ownership/proxy/target/composition tests: 19 passed. Actual geometry/default-perspective tests: six passed. Art-pack/book-art/music-score tests: 26 passed after fetching and verifying the new pinned release.

Independent review found the selected portrait player still entering footer reservations; `fa25c9be002` corrected the predicate and added a regression fixture. The final review found no remaining actionable blocker. Browser emulation does not establish physical-phone, hosted-deployment or owner positioning acceptance; those remain open on the checklist. Feature-branch delivery is separate from dev/test promotion and required hosted CI.
