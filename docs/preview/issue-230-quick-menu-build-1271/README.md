# Issue #230 Quick Menu evidence

Exact-build evidence for the promoted Mirror Quick Menu, preserved legacy modes, and shared Fullscreen/Music controls.

- Base: `dev@69fdbc99aea853ba85e1f08b3bacde134d648dbe`
- Candidate BUILD: `0.4.0.1271` · source digest `b2272fb6a3`
- Artifact SHA-256: `da906f288172f43d63ed7bdd7203a4787129281e995e46a4cf8bc5710d693035`
- Evidence: 38 PNG files committed beside this record
- Shapes: `390x844`, `844x344`, `1200x730`
- Text sizes: M and XL
- States: Mirror map, Music off, combat, overlay, legacy Off, Switcher, and component-catalog controls

The focused browser gate passed 284/284 checks across all six viewport/text combinations. Music ownership/parity passed 31/31 with 16/16 same-door plants. Fullscreen passed 9/9 with 3/3 same-door plants. Screen reach passed 11/11 at the focused `390x650` shape with 8/8 same-door plants. The complete Node suite passed 108/108. Visual review confirmed the Quick Menu remains readable and internally scrollable at phone and short-landscape sizes; Fullscreen and Music are the first controls; Save and Save & Quit remain the final actions.

Each PNG's exact provenance is its immutable Git blob in the commit carrying this directory. The image names encode viewport, text size, Quick Menu mode, and state so individual captures can be replaced without changing the catalog contract.

Boundary: no physical gamepad was attached; the browser gate drove the shared keyboard/controller navigation analogue. The broader release-shot run reaches this Quick Menu but remains RED on inherited `dev@69fdbc9` customize-stats and compendium-held fixtures. Release remains RED.
