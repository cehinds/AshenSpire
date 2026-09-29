# Player combat animation rules

Card **type** is the stamped classification (`Attack`, `Skill`, or `Power`). Card tags describe the action; armament tags describe what is held. The first matching row wins. These rules change presentation only.

| Card type | Card tag or profile | Equipped type and hand arrangement | Animation set played |
| --- | --- | --- | --- |
| Attack | `source:spell` | Any loadout | `cast`; empty hands and bows use the nine-frame magic channel, while other equipped sets have a single cast pose |
| Attack | `fx:shield`, `shieldAttack` profile, or sourced from a physical shield | A physical shield in either hand | `shieldBash1–3`; the same bash motion for all five physical shields |
| Attack | `bow` (bow attack profile); `ranged` when the card comes from the shortbow | A shortbow in either hand, with or without another item | `bowAttack`; seven-frame draw, release, and recovery for each outfit |
| Attack | `blade` | Two weapons with the `blade` tag, one per hand | `twinSwordAttack`, using the straight sword/katana painted set as a shared stand-in |
| Attack | `blade` | A `blade` weapon and physical shield | `swordShieldAttack`, using the straight sword/shield painted set as a shared stand-in |
| Attack | `blade` | One `blade` weapon and an empty other hand | `greatswordAttack`, using the greatsword painted set as a shared stand-in |
| Attack | `pierce` without `blade` | One dagger | `daggerAttack` |
| Attack | Other physical attack tags | Other loadouts | Existing generic `attack` sequence |
| Skill | `guard` or `block` | A physical shield, unless the card comes from a parrying dagger | `shieldGuard1–3` |
| Skill | `guard` plus `shieldGuard` profile | Parrying dagger, without physical shield | `parry1–3` |
| Skill | `guard` or `block` | Other loadouts | `guard` |
| Power | Any | Any loadout | `power` or the selected set's buff pose |
| Skill | No guard tag | Any loadout | `cast` |

For shield actions, `fx:shield` is the existing visual tag. The runtime reads it from the card or equipment profile through the tag service. `item:shield` by itself is broader: lanterns, torches, and parrying daggers carry it, but have no physical shield motion. The physical shield check currently accepts buckler, kite, tower, round, and spiked shields. The older Shield Bash card ID and shield profiles remain compatible with the same route.

For Blade attacks, the weapon must carry the actual `blade` characteristic. `item:blade` alone is too broad: the shortbow and warhammer also carry that item type. The hand arrangement chooses the painted sword motion. A card with no `blade` tag keeps the equipped set's existing attack motion, including the dedicated single-dagger art.

## Existing tags and sprite gaps

| Existing card and item tags | Card type | Current result | Art still needed |
| --- | --- | --- | --- |
| `source:spell`; staff or sceptre (`item:magic-focus`) | Attack | One-frame cast in the equipped set | Staff and sceptre magic attack sequences, if focus-specific motion is desired |
| `blade`; polearm, axe, or twinblade | Attack | Shared sword stand-in chosen by hand arrangement | Distinct polearm, axe, and twinblade sets, if silhouettes should match the weapon |
| `heavy` without `blade`; warhammer | Attack | Generic attack fallback | Hammer attack set |
| `fx:shield`; lantern, torch, or parrying dagger (`item:shield`) | Attack or guarded Skill | Generic attack/guard or parry fallback | Tool-specific attack and guard sets; these are deliberately excluded from shield bash |
| `blade`; mixed pair of a blade and another non-shield weapon | Attack | Generic attack fallback unless an exact set exists | Mixed-weapon dual attack set |
| `guard` without a physical shield | Skill | Generic guard | Weapon-specific guard sets, if desired |

The shipped full-frame motion profiles are `greatswordTwoHand`, `swordShield`, `twinSword`, `daggerSingle`, `bow`, and `unarmed` (physical and magic). The bow set has seven attack frames for 32 unique appearances across all 35 armor entries. The painted outfit fallback includes shield bash, shield guard, and parry poses. Hammer, polearm, axe, twinblade, and mixed-weapon full-frame sets are still missing.
