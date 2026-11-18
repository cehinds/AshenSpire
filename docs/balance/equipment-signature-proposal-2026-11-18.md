# Equipment signature effects: proposal (2026-11-18)

Status: PROPOSAL ONLY. Nothing here is implemented; the owner approves before anyone builds it.

Owner, 2026-11-18: max Poise = 1 + CON + other Poise bonuses. Guarding gear (armour, shields, some two-handed weapons such as the
Greatsword) adds its Poise; a one-handed weapon that is not defensive adds 0 unless authored. Each such piece should also carry ONE
signature effect, chosen from the approved tag set.

## Poise bonus as measured (live Core path)

Poise points x `pointValues.poise` (3). Source: `engine/kernel/gameConfig.js` `resolveStatPointGear` after the "Gear adds Poise only
when its ratings weights name Poise" commit; the share comes from the item's tag weights (`engine/modules/gear/defaults.json`).

## Approved tag set and sizing

| Tag | Reads as | Common | Uncommon | Rare |
|---|---|---|---|---|
| Auto-Block | start each fight with N Block (kept as a turn-1 Block) | 3 | 5 | 8 |
| Counter | start each fight with N Counter stacks | 1 | 1 | 2 |
| Evade | start each fight with N Evade stacks | 1 | 1 | 2 |
| Reflect | start each fight with N Reflect stacks | 1 | 2 | 3 |
| Ward | start each fight with N Ward stacks | 1 | 2 | 2 |
| Fortified | start each fight with N Fortified stacks | 1 | 1 | 2 |
| Retain | the first Defend card played each turn is Retained | - | yes | yes |
| Resist | element resistance (immunity never) | 1 school | 1 school | 2 schools |

Rarity budget: common pieces take the small row, uncommon the middle, rare the strong. A piece that already has a signature in its mods
keeps it and gains nothing new (marked "keep"). Poise is the piece's baseline and is not traded against the signature.

## Weapons and shields

| Item | Rarity | Poise | Existing mods | Proposed signature | Note |
|---|---|---|---|---|---|
| Straight Sword | common | 3 | none | Counter 1 | "Honest steel": the plain parry. Tag weights give it Poise; owner may zero it as a non-defensive one-hander |
| Greatsword | uncommon | 6 | cost +1, poise +3 | keep (strike.poise) + Fortified 1 | "Slow, and it does not care." |
| Halberd | uncommon | 6 | cost +1, poise +4 | Evade 1 | "Keep the dead at arm's length" |
| Warhammer | uncommon | 9 | poise +6 | keep (strike.poise +6) | the signature is Poise damage already |
| Battleaxe | common | 3 | cost +1 | none (non-defensive; Poise comes from the `heavy` tag, owner call) | woodcutter's tool |
| Frost Spear | uncommon | 3 | frost +2 | Resist frost | "slows the next advance" |
| Cinder Axe | uncommon | 6 | cost +1, burn +3 | Resist burn | furnace edge |
| Buckler | common | 0 | none | Counter 1 (adds Poise 3 if the owner wants a guard) | "quick": a parry piece, so Counter |
| Kite Shield | common | 6 | none | Auto-Block 3 | "a wall you can carry" |
| Round Shield | common | 3 | none | Auto-Block 3 | "plain, and enough" |
| Spiked Shield | uncommon | 3 | none | Reflect 2 | "Defence with an opinion" |
| Tower Shield | rare | 9 | maxHp +10 | keep (maxHp) + Fortified 2 | "You will not be moved" |
| Parry Dagger | uncommon | 6 | poise +2 | Counter 1 + keep poise +2 | "Held wrong on purpose" |
| Lantern | common | 0 | regen +1 | keep (regen) | already a signature |
| Torch | common | 0 | burn +2 | keep (burn) | already a signature |
| Wyrmhorn Staff | rare | 9 | potency +2, poise +2, insanity +2 | keep | already three; no new tag |

One-handed non-defensive pieces (Dagger, Shortbow, Katana, Twinblade, staves, sceptres, Frost Spear aside) add 0 Poise and get no
signature here: they are weapons, not guards.

## Armour

| Item | Class | Rarity | Poise | Existing mods | Proposed signature |
|---|---|---|---|---|---|
| Wayfarer Plate | all | common | 6 | block +2, maxHp +4 | Auto-Block 3 |
| Ashen Vigil | Reaver | uncommon | 3 | block +2 | Counter 1 |
| Gilded Oathsworn | Reaver | uncommon | 6 | block +1, STR +1 | Ward 2 ("an oath unbroken") |
| Warden Mail | Reaver | uncommon | 3 | block +3, damage -1 | Retain on Defend cards |
| Bastion Harness | Reaver | uncommon | 6 | block +4, maxStamina -1 | Fortified 1 |
| Nightweave | Starseer | common | 6 | potency +1, maxMana +1 | Ward 1 |
| Eclipse Habit | Starseer | uncommon | 6 | potency +1 | Resist (dark school) |
| Starlit Silks | Starseer | uncommon | 3 | hits +1, damage -1 | Evade 1 |
| Astral Vestment | Starseer | uncommon | 6 | potency +2, block -1 | Ward 2 |
| Rimeweave Robes | Starseer | uncommon | 6 | frost +2, block -1 | Resist frost |
| Rite Vestments | Herald | common | 6 | block +1, maxHp +6 | Ward 1 |
| Ossuary Weave | Herald | uncommon | 6 | blight +1 | Resist blight |
| Emberlight Habit | Herald | uncommon | 6 | potency +1, regen +1 | Resist burn |
| Pilgrim Wrap | Herald | uncommon | 6 | block +2, maxHp +4 | Retain on Defend cards |
| Gutter Leathers | Rogue | common | 3 | damage +1, maxStamina +1 | Evade 1 |
| Nightveil Coat | Rogue | uncommon | 3 | block +2 | Evade 1 + keep block |
| Duelist Jerkin | Rogue | uncommon | 3 | hits +1, damage -1 | Counter 1 |
| Shadow Mantle | Rogue | uncommon | 3 | STR +1 | Evade 2 |
| Waywatcher Coat | Rogue | uncommon | 3 | maxStamina +1, damage -1 | Evade 1 |

## Open decisions for the owner

- Whether the Straight Sword, Battleaxe and Frost Spear (one-handed, but their tag weights carry a Poise share) should keep their Poise or be zeroed.
- Whether Auto-Block means a turn-1 Block, a standing Block floor, or a start-of-fight Block stack.
- Resist: which schools exist as a pick list, and whether a school's resistance is the 0.75 share Core already uses.
