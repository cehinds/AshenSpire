# Approved combat HUD and mobile targeting

The owner approved the refined header and three selection states on October 9, preserving the existing card fan and footer. Build 0.7.1.1203 adds the final HUD behavior and 105% selection emphasis.

## Verified behavior

- Native touch at 288, 320 and 390 pixels: sprite, intent and HP select their owner; selected Information opens inspection in one tap; a defensive card shows its stance icon and plays through the player HP strip; enemy intent and body routes play accepted cards.
- Phone and desktop: selected sprites scale exactly 105%, rise above other sprites, keep their center/ground anchors and fitted dimensions, survive rerender without compounding, and restore original geometry/depth on deselection. Idle enemies have no selection outline; armed targets retain their aiming cue.
- Five header widths (288, 320, 390, 844, 1280): the HP trough ends 12 pixels before Armoury. An actual enemy turn changes the fill from 63/63 to 53/63.
- Compact names remain hidden until selection; idle enemy HP sits above the sprite. Selected names sit below the body. Player details clear enemy controls and the hand toolbar; Information remains above the player. Intent/ribbon clearance measures 4 pixels on the narrow layout.
- Existing native log drag regression covers three bounded snap sizes, cancellation, subsequent taps, and keyboard access without inner size buttons.

## Evidence and reproduction

Run `tools/combat-mobile-touch-qa.mjs`, `tools/combat-sprite-selection-qa.mjs`, `tools/combat-header-qa.mjs`, and `tools/combat-log-touch-qa.mjs`. `COMBAT_QA_URL` selects source or package; `COMBAT_QA_OUT` selects the output directory. Playwright must be available through the installed Node runtime.

Final source and packaged results and screenshots are stored beside this document. Generated illustration approvals are design references, not gameplay evidence. Hosted checks and dev/test promotion are reported separately.
