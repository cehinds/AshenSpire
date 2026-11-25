# Stats and gear CI repair record

Baseline at `05ae1d5b5c6` ran 453 test entries in the assigned lane. 96 failed.

## Shared armour after the equipment rework

`tests/shared-armor.test.mjs` assumed every current shared outfit had an old raw card modifier and resource grant. The reworked outfit rows clear those raw signatures. The 16 current outfit checks still verify purchase ownership, attribute thresholds, failed equip immutability, successful equip, class identity, card facts and complete sprite coverage. A separate fixture uses the original raw signatures from the parent of `057fbe0905a` to verify resource maxima, deck stamping and playable card effects for each of the same 16 combinations.

`node --test tests/shared-armor.test.mjs` passed 34 of 34. The initial file failed 16 of 18. The other 80 baseline failures remain to be classified or repaired.

## Armour card disclosures

- `tests/armour-card-text.test.mjs` still pins the complete bonus lines for Ashen Vigil and Wayfarer Plate, including spelled-out attribute grants, distinct group and signature text, and the absence of rank and points. The equipment rework removed Vigil's Defend signature and the Plate's raw Defend/HP bonuses, and reduced the group grants.
- `node --test tests/armour-card-text.test.mjs` passed 3/3, from 2/3 before the fixture correction. The lane had 79 original failures remaining after this group.
