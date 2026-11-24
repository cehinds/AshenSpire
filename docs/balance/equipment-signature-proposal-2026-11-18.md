# Equipment signature effects: proposal (2026-11-18)

Status: PROPOSAL ONLY. Nothing here is implemented; the owner approves before anyone builds it.

Owner, 2026-11-18: max Poise = 1 + CON + other Poise bonuses. Guarding gear (armour, shields, some two-handed weapons such as the
Greatsword) adds its Poise; a one-handed weapon that is not defensive adds 0 unless authored. Each such piece also carries ONE
signature effect. Refinement (same day): signatures are PER TURN, not start-of-fight. The default family is Block per turn and, for
higher tiers, Counter at the end of the turn.

## Poise bonus as measured (live Core path)

Poise points x `pointValues.poise` (3). Source: `engine/kernel/gameConfig.js` `resolveStatPointGear` after the "Gear adds Poise only
when its ratings weights name Poise" commit; the share comes from the item's tag weights (`engine/modules/gear/defaults.json`).

## Signature families and sizing

Budget anchor: one Stamina is worth about 5-8 Block on a card, so a free per-turn trigger stays small.

| Family | Wording | Common | Uncommon | Rare |
|---|---|---|---|---|
| Block, start | "Gain N Block at the start of each of your turns" | 1-3 | 3-4 | 4-5 |
| Block, end | "Gain N Block at the end of each of your turns" (kept through the enemy turn, so it is the stronger timing; N sits one lower than start) | 1-2 | 2-4 | 3-5 |
| Counter, end | "Gain 1 Counter at the end of your turn" | not offered | 1 | 1 (rare: 2 on a piece with no other mod) |
| Reflect, Evade, Ward, Fortified | stacks gained at the start of your turn, 1 each | 1 | 1 | 1-2 |
| Resist | element resistance, one school; two on a rare | 1 | 1 | 2 |
| Retain | the first Defend card you play each turn is Retained | not offered | yes | yes |

Start vs end: Block at the START of the turn is spendable on that turn's cards as well as the enemy's, so it is the lighter
number. Block or Counter at the END belongs to a piece that waits (a shield, a parry, a plate), and Counter is always an END effect
so it is armed for the enemy turn. Counter is reserved for uncommon and rare. A piece that already has a signature in its mods
keeps it and gains nothing new (marked "keep"). Poise is the baseline and is not traded against the signature.

## Weapons and shields

| Item | Rarity | Poise | Existing mods | Proposed signature | Timing |
|---|---|---|---|---|---|
| Straight Sword | common | 3 | none | 1 Block | start. Tag weights give it Poise; owner may zero it as a non-defensive one-hander |
| Greatsword | uncommon | 6 | cost +1, poise +3 | keep (strike.poise) + 3 Block | start ("slow, and it does not care") |
| Halberd | uncommon | 6 | cost +1, poise +4 | 1 Evade | start ("keeps the dead at arm's length") |
| Warhammer | uncommon | 9 | poise +6 | keep (strike.poise +6) | the signature is Poise damage already |
| Battleaxe | common | 3 | cost +1 | none (non-defensive; Poise comes from the `heavy` tag, owner call) | |
| Frost Spear | uncommon | 3 | frost +2 | Resist frost | passive |
| Cinder Axe | uncommon | 6 | cost +1, burn +3 | Resist burn | passive |
| Buckler | common | 0 | none | 2 Block | start (quick; a parry piece). Adds Poise 3 only if the owner wants it a guard |
| Kite Shield | common | 6 | none | 3 Block | end ("a wall you can carry") |
| Round Shield | common | 3 | none | 2 Block | end |
| Spiked Shield | uncommon | 3 | none | 1 Reflect | start ("defence with an opinion") |
| Tower Shield | rare | 9 | maxHp +10 | keep (maxHp) + 5 Block | end ("you will not be moved") |
| Parry Dagger | uncommon | 6 | poise +2 | keep poise +2 + 1 Counter | end ("held wrong on purpose") |
| Lantern | common | 0 | regen +1 | keep (regen) | already a signature |
| Torch | common | 0 | burn +2 | keep (burn) | already a signature |
| Wyrmhorn Staff | rare | 9 | potency +2, poise +2, insanity +2 | keep | already three; no new tag |

One-handed non-defensive pieces (Dagger, Shortbow, Katana, Twinblade, staves, sceptres) add 0 Poise and get no signature here: they
are weapons, not guards.

## Armour

| Item | Class | Rarity | Poise | Existing mods | Proposed signature | Timing |
|---|---|---|---|---|---|---|
| Wayfarer Plate | all | common | 6 | block +2, maxHp +4 | 2 Block | end |
| Ashen Vigil | Reaver | uncommon | 3 | block +2 | 1 Counter | end |
| Gilded Oathsworn | Reaver | uncommon | 6 | block +1, STR +1 | 4 Block | end ("an oath unbroken") |
| Warden Mail | Reaver | uncommon | 3 | block +3, damage -1 | Retain on Defend cards | |
| Bastion Harness | Reaver | uncommon | 6 | block +4, maxStamina -1 | 3 Block + 1 Counter | end (heavy trade for its Stamina cost; the one piece with both) |
| Nightweave | Starseer | common | 6 | potency +1, maxMana +1 | 1 Ward | start |
| Eclipse Habit | Starseer | uncommon | 6 | potency +1 | Resist (dark school) | passive |
| Starlit Silks | Starseer | uncommon | 3 | hits +1, damage -1 | 1 Evade | start |
| Astral Vestment | Starseer | uncommon | 6 | potency +2, block -1 | 1 Ward | start |
| Rimeweave Robes | Starseer | uncommon | 6 | frost +2, block -1 | Resist frost | passive |
| Rite Vestments | Herald | common | 6 | block +1, maxHp +6 | 2 Block | start |
| Ossuary Weave | Herald | uncommon | 6 | blight +1 | Resist blight | passive |
| Emberlight Habit | Herald | uncommon | 6 | potency +1, regen +1 | Resist burn | passive |
| Pilgrim Wrap | Herald | uncommon | 6 | block +2, maxHp +4 | Retain on Defend cards | |
| Gutter Leathers | Rogue | common | 3 | damage +1, maxStamina +1 | 1 Block | start |
| Nightveil Coat | Rogue | uncommon | 3 | block +2 | 1 Evade | start |
| Duelist Jerkin | Rogue | uncommon | 3 | hits +1, damage -1 | 1 Counter | end |
| Shadow Mantle | Rogue | uncommon | 3 | STR +1 | 3 Block | start |
| Waywatcher Coat | Rogue | uncommon | 3 | maxStamina +1, damage -1 | 1 Evade | start |

## Open decisions for the owner

- Whether the Straight Sword, Battleaxe and Frost Spear (one-handed, but their tag weights carry a Poise share) keep their Poise or are zeroed.
- Whether end-of-turn Block should persist through the enemy turn (assumed yes) or be cleared like other Block at the start of your turn.
- Resist: which schools exist as a pick list, and whether a school's resistance is the 0.75 share Core already uses.
- The four starting armours (`default` rows) are not gear-catalogue items today, so they give no Poise or points; see the report.
