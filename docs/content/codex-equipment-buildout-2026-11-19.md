# Codex equipment buildout, v28 icons (2026-11-19)

Built from `docs/balance/equipment-list-2026-11-18.md` (type base plus one second bonus) using only the mod vocabulary in `content/source/equipMods.csv`. Peers supply profiles, ratings, range and material. Every new weapon, off-hand and armour is in the Core reward groups (`games/ashenspire/packs/core/rewards.json`) and, for hand items, the legacy drop pool (`dropWeight` 10/7/4 by rarity).

Art: `inventoryArtKey` is the item id (v28 ships `icon_<id>.webp`, pending PR #2844); `artKey` is the closest existing weapon or outfit sprite.

Arts: each new weapon has one default and two learnable arts, all existing non-expansion cards, no card on more than three weapons.

## Proposed (owner approval needed)

| Icon id | Proposed type | Proposed bonus |
|---|---|---|
| sagesRobe | unarmoured (robe), rare | Base: spells -1 MP, +1 max MP, Vulnerable to melee. Bonus: the first spell each turn costs 1 less MP. Not authored: no row in the list. |

## Mechanics gaps

Only `strike.*`, `defend.*`, `power.*` and `self.*` mods exist. Type bases and bonuses below are not authored. "All" means every item of that type.

| Item | Missing piece | Why |
|---|---|---|
| All swords, rapiers | +1 to Sweeps; +1 Pierce; Counter stack at turn end | No Sweep, Pierce or Counter mod |
| Broadsword, Flamberge | Sweeps apply Weak / Burn | No Sweep target, no Weak mod |
| Flamberge, Moonlit Katana, Thunder Mallet | +1 Fire / Frost / Lightning damage | Carried as a `flat` row in combatExpansionEquipment.json only; Sweep and Smash limits dropped |
| Rapier, Estoc, Duelist's Foil | Counter returns +1; 1 Evade at fight start; Counter cards -1 SP | No such mods (all three carry no mods) |
| Daggers | Stiletto +1 Pierce on 0-cost attacks | No Pierce mod |
| Ashen Claymore, Zweihander | Two-handed, Smash adds STR twice; Smash Burn; Smash +2 Poise | No Smash target; only +1 strike Poise authored |
| Pike, Scythe, Reaper's Crescent | +1 Sweep, +1 Pierce; front-row damage; Sweep Bleed; kill heals 3 | No such mods (carry no mods; Reach is the range column) |
| Mace, Morning Star, Flail | Ignore 1 Block; Smash +1 Poise; Flail Smash Multi-hit | No block-ignore or Smash mod |
| Maul, Thunder Mallet | Smash Vulnerable/Retreat; Lightning and Shock | No Smash, Shock or Lightning mod |
| Bearded Axe | Axe base (STR per attack, Sweep +1); Retreat pull | No such mods |
| Moonlit Katana | DEX on Attack/Sweep/Smash | No DEX-scaling mod |
| Moon Glaives | Multi-hit on Smash and Sweep | Only strike hits authored |
| Longbow, Hunter's Recurve, Shortbow base | DEX vs Retreat, Retreat stack, Pierce, melee vulnerability, Smash Reach, Bleed vs Retreat | No such mods |
| Hand Crossbow, Arbalest | +2 Pierce, Escalating, first-attack +3, Vulnerable on back row | No such mods |
| Leather Whip, Thorn Whip | Remove Retreat stack, Weak on attack, Thorns | No such mods |
| Iron Knuckles, Beast Claws | Sweeps gain Multi-hit | No Sweep mod |
| Storm Sceptre | Shock on Lightning spells; Ward at turn start; Prepared-stance MP discount | No Shock, Ward or stance mod |
| Grimoire, Prayer Book | Draw on first spell; 2 Ward; Fire spells +1; Healing +1 | No such mods (carry none) |
| Sun Talisman, Bone Talisman | +1 Ward at turn start; Blight spells +1 | Sun Talisman Heal 1 is `self.regen=+1`; the rest has no mod |
| Cinderforged Plate | Resist Fire; Thorns; +5 Poise | Block +3 and DEX -1 authored; no Resist or Thorns mod |
| Wyrmscale Mail | Resist Frost; +1 Poise; +3 Poise base | Poise lives in `poiseThreshold` (8); no Resist mod |
| Ringmail Hauberk | 1 Block at turn start | No such mod |
| Hunter's Hide | Back-row damage | No such mod |
| Heavy/medium/light set bonuses | Counter, Evade, Thorns at turn | Set-bonus mechanic belongs to chore/GearPassMechanics |

## Notes

- Maul is an enemy move name in the game, not a weapon; it is authored here as a new hammer.
- Armour rows are single-class (Cinderforged Plate and Wyrmscale Mail Reaver, Ringmail Hauberk Herald, Hunter's Hide Rogue), reusing that class's outfit art, and carry their peer's unlock.
- Relics not authored: anvilSigil, duelistsRibbon, prayerBeads, quiverStrap, whetstoneCharm.
