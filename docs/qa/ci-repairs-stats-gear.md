# Stats and gear CI repair record

Baseline at `05ae1d5b5c6` ran 453 test entries in the assigned lane. 96 failed.

## Shared armour after the equipment rework

`tests/shared-armor.test.mjs` assumed every current shared outfit had an old raw card modifier and resource grant. The reworked outfit rows clear those raw signatures. The 16 current outfit checks still verify purchase ownership, attribute thresholds, failed equip immutability, successful equip, class identity, card facts and complete sprite coverage. A separate fixture uses the original raw signatures from the parent of `057fbe0905a` to verify resource maxima, deck stamping and playable card effects for each of the same 16 combinations.

`node --test tests/shared-armor.test.mjs` passed 34 of 34. The initial file failed 16 of 18. The other 80 baseline failures remain to be classified or repaired.

## Armour card disclosures

- `tests/armour-card-text.test.mjs` still pins the complete bonus lines for Ashen Vigil and Wayfarer Plate, including spelled-out attribute grants, distinct group and signature text, and the absence of rank and points. The equipment rework removed Vigil's Defend signature and the Plate's raw Defend/HP bonuses, and reduced the group grants.
- `node --test tests/armour-card-text.test.mjs` passed 3/3, from 2/3 before the fixture correction. The lane had 79 original failures remaining after this group.

## Deferred Strength and recurring Reach

- `tests/gear-pass-deferred-strength.test.mjs` explicitly restores the former Axe's +1 Strength on one fixture weapon. Assertions still cover the reaction pause, pre-grant damage, exactly-once post-play application, save/restore, and a non-grant weapon control.
- `tests/gear-pass-reach-decay.test.mjs` uses Waywatcher Coat's authored turn-start Reach instead of Shortbow's retired turn grant. The next-round expiry and fresh grant remain required in the real turn loop. Current, custom, and saved decay cases remain covered.
- `node --test tests/gear-pass-deferred-strength.test.mjs tests/gear-pass-reach-decay.test.mjs` passed 15/15, from 12/15 before the fixture corrections. The lane had 76 original failures remaining.

## Damage forecast fixtures

- `tests/gear-pass-thorns-preview.test.mjs` equips current Cinderforged Plate and requires its authored Thorns signature. The two forecast/live checks still cover killing the attacker before later hits or Reflect.
- `tests/gear-pass-stone-skin.test.mjs` gives the multi-hit target enough Block to test the full three-hit sequence. Its two Stone Skin stacks still must be depleted in live play, and forecast must match live HP without consuming the target's stacks.
- `node --test tests/gear-pass-thorns-preview.test.mjs tests/gear-pass-stone-skin.test.mjs` passed 12/12, from 9/12 before the fixture corrections. The lane had 73 original failures remaining.

## Confirmed per-point resource and draw tuning

- `tests/a4-hand-rules.test.mjs`, `tests/turn-stamina.test.mjs` and `tests/hand-sp-mp-per-four-2026-11-18.test.mjs` now pin the owner's 2026-11-24 per-point settings in actual new fights and configured class pools. Draw remains clamped to available capacity. The old Draw fixture explicitly pins its quarter-point coefficient. Legacy combat refills, fixed draws, equipment Focus discounts, and Mana relic addends remain covered.
- `node --test tests/a4-hand-rules.test.mjs tests/turn-stamina.test.mjs tests/hand-sp-mp-per-four-2026-11-18.test.mjs` passed 21/21, from 14/21. The lane had 66 original failures remaining.

## Generic hand rows and disclosures

- `tests/hand-rules.test.mjs`, `tests/hand-refresh.test.mjs` and `tests/solo-hand-display.test.mjs` pin the per-point opening and draw rows, their independent capacity, 10-card row ceiling, row receipts, the unchanged worked Settings override, and the per-point labels. Legacy fill, shuffled refresh, pile conservation, Retain, Ethereal and snapshot coverage remains in place.
- `node --test tests/hand-rules.test.mjs tests/hand-refresh.test.mjs tests/solo-hand-display.test.mjs` passed 45/45, from 36/45. There were 61 original failures remaining, including four in two dated stat files measured separately (17/21 passed).

## Stat rows and real allocations

- `tests/stat-rows.test.mjs`, `tests/starting-stat-config.test.mjs`, and `tests/latest-stat-allocation-rules.test.mjs` pin the per-point coefficients and bounds, separate Core stamina alias, and exact consecutive 2-to-3 and 3-to-4 allocation gains. Old profile integrity, explicit saved rules, and custom fractional row coverage stay intact.
- `node --test tests/stat-rows.test.mjs tests/starting-stat-config.test.mjs tests/latest-stat-allocation-rules.test.mjs` passed 51/51. The lane had 57 original failures remaining.

## Attribute and creation previews

- `tests/attribute-point-preview.test.mjs` and `tests/creation-primary-benefits.test.mjs` assert current per-point labels, effective Dexterity with and without Heavy armour, and exact allocation deltas in the UI and fight. The custom fractional examples and prior four-point draw and capacity check now isolate their own snapshot rows.
- `node --test tests/creation-primary-benefits.test.mjs tests/attribute-point-preview.test.mjs` passed 28/28, from 19/28. The lane had 48 original failures remaining.

## Core resource formulas across levels

- `tests/balance-stats-2026-11-17.test.mjs` checks the governed SP, MP, and hand rows at consecutive points and still requires every starter card to be payable. The configured rows have no SP/MP level term, whereas generic rows retain the level terms covered separately.
- `node --test --test-name-pattern 'item 5' tests/balance-stats-2026-11-17.test.mjs` passed 2/2. The lane had 47 original failures remaining.

## Codex equipment and stacked variant damage

- `tests/gear-pass-codex-types.test.mjs` pins all 38 updated raw signatures. Git shows the source outfit and weapon tables are unchanged from 057fbe0905a. Current sword, glaives, claws, Focus, tomes, talismans, and group/signature interactions retain exact outcome checks. The historical no-type control remains unchanged.
- `tests/gear-pass-effect-variants.test.mjs` independently plays a no-stack control for the selected Smash branch and requires exactly three equal hits, exact total damage, and a matching face in native and bundled runtimes.
- `node --test tests/gear-pass-codex-types.test.mjs tests/gear-pass-effect-variants.test.mjs` passed 15/15 in the two focused runs, from 7/15. The lane had 39 original failures remaining.

## Current signatures and save round-trip fixtures

- `tests/gear-signature-mods.test.mjs` verifies Sweep Weak is Broadsword's raw signature and is replaced or cleared through profile projection. Current Sage's Robe keeps its Ward, discount and vulnerability without a flat group Mana bonus.
- `tests/gear-pass-save-compatibility.test.mjs` proves the starter outfit mapping before equipping Cinderforged Plate for the type-enabled Thorns save round trip. The legacy option-off control still runs.
- The two full files passed 12/15, from 9/15. Three unresolved historical assertions remain in these files (type-enabled Sage's Robe and two offer oracles). The lane had 36 original failures remaining.

## Gear pool double-count controls

- `tests/gear-pool-no-double-count.test.mjs` loads explicit pre-rework pool signatures from the old item rows for the discard/preserve tests. It still measures repeated equipment points, previously double-counted saves, no healing on correction, and positive/negative signatures that survive Blacksmith attribute picks. Current Sage robe verifies the flat group bonus was removed.
- `node --test tests/gear-pool-no-double-count.test.mjs` passed 7/7, from 4/7. The lane had 33 original failures remaining.

## Owner-approved character level rewards

- `content/source/balanceLevelUp.json` defines the version-1 rule copied into new configured Core runs. The class's primary attribute gains one at levels 2, 6, 10, 14 and 18. An assignable point is earned at 4, 12 and 20. One rank-up credit is earned at every level after creation. The character ladder shows these grants alongside its separate level-card offers.
- `tests/class-level-bonus.test.mjs` proves the live effective stat for all four classes, the exact ladder through 20, a current save restored against changed authored rules, and 16 save cases for earlier absent and odd-level markers. The old save rules are not backfilled.
- `tests/character-progression.test.mjs` and `tests/progression-modal.test.mjs` use the same earned points as the level ledger. `tests/content-expansion-equipment.test.mjs` pins the current three signatures and still tests positive and negative archived pool addends across XP and allocation.
- `node --test tests/class-level-bonus.test.mjs tests/character-progression.test.mjs tests/content-expansion-equipment.test.mjs tests/progression-modal.test.mjs tests/save-migration.test.mjs` passed 72/72, and `node tools/content-build.mjs --check` passed. The original lane count had 18 failures remaining before cross-lane updates.

## Static card face parity

- `src/model/playingCard.js` uses the same Finesse weapon reader as modern combat and includes Dexterity when the authored Block value is zero. No-character faces still show authored numbers. The two dated face suites check the current starter weapon/armour values, live receipt and saved-profile controls.
- `node --test tests/balance-stats-2026-11-17.test.mjs tests/static-face-attributes-2026-11-18.test.mjs tests/card-face-colours-2026-11-18.test.mjs` passed 54/54, including both Arcane and Divine attribute paths. The original lane had 15 remaining failures.

## Rank-up cost boundaries

- `tests/rank-up-bonus.test.mjs` isolates the cost option using the supported authored menu. Cost conversion and a direct cut now compete for the same upgrade family, so the fixture selects the direct cut. It inspects both entries of a paired cut and verifies a Basic's exact Mana reduction.
- `node --test tests/rank-up-bonus.test.mjs` passed 6/6, from 5/6.
