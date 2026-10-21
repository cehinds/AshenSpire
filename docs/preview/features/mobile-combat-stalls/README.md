# Mobile combat presentation and targeting captures

Captured 2026-10-21 UTC from source `bdd484f31b9c394093e9e5e66ed2973c0b0ff6e8`, packaged light build **0.7.1.1761**, digest `b623462ee1`.
HTML SHA-256: `ac9c74462644d468574679c1458accbe1da60be15455372a700298ee1a507a92`.

Feature preview: https://cehinds.github.io/AshenSpire/branches/fix/MobileCombatStalls/latest/
Publication verified 2026-10-21: Pages run [39622995036](https://github.com/cehinds/AshenSpire/actions/runs/39622995036) deployed successfully. Its public HTTP gate passed for 24 feature previews and explicitly included this branch at source `bdd484f31b9c394093e9e5e66ed2973c0b0ff6e8`. The matching preview job confirms version 0.7.1.1761 and digest b623462ee1.

| Capture | Viewport |
| --- | --- |
| mobile.png | 375 × 667 |
| desktop.png | 1280 × 800 |
| wide.png | 1920 × 1080 |
| tablet.png | 768 × 1024 |

These are real Chromium captures of the supported Core combat screenshot entry (seed 3, three enemies, five cards), followed by native input through the game controller. The starting encounter is a fixture, not a completed playthrough. Five viewport flows passed, including an additional 412 × 915 phone view. Checks cover native card selection, enemy-name and Health targeting, and two settled Strikes with expected targets and stamina costs. The 375 × 667 flow also covers hold/Information, repeated taps, post-playback targeting and drag/drop. All four images were visually inspected for loaded artwork and reachable controls. The compact phone HUD overlaps some artwork in the existing layout.

A separate native regression reproduced an unintended inspector in the previous package when a second target press began during playback and released after playback unlocked. The corrected package passed the same event-time assertions: a real enemy HUD pointerdown while the hand was inert, release after unlock, no inspector or extra action, and a subsequent paid attack that settled normally.

Immediate post-inspection input was checked against an old-build negative and this package: a fresh name/Health press inside the previous 700 ms window now resolves, while the original held pointer released after more than 850 ms remains suppressed.

Native stance checks preserve the exact canvas and painted content when switching between Strike cards; selecting Defend changes the artwork. Activating the action glyph after selecting the second Defend plays that current instance and spends 1 stamina. The glyph remains in its overhead rack and within the viewport after a 375-to-768-width resize. Native selection briefly disarms the previous card during the press-to-inspect sequence, then arms the new card on release; its action glyph therefore changes through the held/resting state. Source review confirms this explains the glyph identity change, without a selection/payment/layout failure.

A native paid Core Counter also completed on this exact package: positive return payload, 5 HP damage, 1 stamina payment, changing action pixels and return to the next player turn. The fixture uses authored cards and native reaction handlers, with posed initial resources and observer read.

The stationary-art implementation was additionally validated on its earlier exact package (source f6fcfde475, 0.7.1.1759/1aeb404713): resting fighters were observed for more than 6.4 seconds in six supported rendering styles, with stable visible bounds and canvas pixels; an injected bob failed the same predicate. Attack/reaction animation and actual Counter damage/payment remained functional. That implementation is unchanged in this capture build. Still images alone do not demonstrate motion or mobile speed.

Simulated Chromium checks do not represent physical Galaxy A32, iPhone SE, or Safari measurements. Performance results are recorded separately. The existing release screenshot gallery remains on published Release **0.7.1.1517** and was verified unchanged; these captures describe the feature build only.
