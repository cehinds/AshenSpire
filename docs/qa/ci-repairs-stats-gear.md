# Stats and gear CI repair record

Baseline at `05ae1d5b5c6` ran 453 test entries in the assigned lane. 96 failed.

## Shared armour after the equipment rework

`tests/shared-armor.test.mjs` assumed every current shared outfit had an old raw card modifier and resource grant. The reworked outfit rows clear those raw signatures. The 16 current outfit checks still verify purchase ownership, attribute thresholds, failed equip immutability, successful equip, class identity, card facts and complete sprite coverage. A separate fixture uses the original raw signatures from the parent of `057fbe0905a` to verify resource maxima, deck stamping and playable card effects for each of the same 16 combinations.

`node --test tests/shared-armor.test.mjs` passed 34 of 34. The initial file failed 16 of 18. The other 80 baseline failures remain to be classified or repaired.
