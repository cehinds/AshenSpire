# Codex equipment buildout, v28 icons (2026-11-19)

Built from `docs/balance/equipment-list-2026-11-18.md` (type base plus one second bonus) using only the mod vocabulary in `content/source/equipMods.csv`. Peers supply profiles, ratings, range and material. Every new weapon, off-hand and armour is in the Core reward groups (`games/ashenspire/packs/core/rewards.json`) and, for hand items, the legacy drop pool (`dropWeight` 10/7/4 by rarity).

Art: `inventoryArtKey` is the item id (v28 ships `icon_<id>.webp`, pending PR #2844); `artKey` is the closest existing weapon or outfit sprite.

Arts: each new weapon has one default and two learnable arts, all existing non-expansion cards, no card on more than three weapons.

## Authored after owner decision (2026-11-19)

| Icon id | Type | Rarity | Authored | Class and art |
|---|---|---|---|---|
| sagesRobe | Ward robe (unarmoured caster armour) | uncommon | `self.maxMana=+1` | Starseer, Astral Vestment art and palette |

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
| Bone Sceptre (existing), Storm Sceptre | Tagged Sceptre Retreat does not currently grant in combat | Their attack descriptors use `source: 'spell'`, while `bandRows.js` requires `source: 'weapon'` for the grant. Storm Sceptre inherits this existing limitation; damage routing is unchanged. |
| Grimoire, Prayer Book | Draw on first spell; 2 Ward; Fire spells +1; Healing +1 | No such mods (carry none) |
| Sun Talisman, Bone Talisman | +1 Ward at turn start; Blight spells +1 | Sun Talisman Heal 1 is `self.regen=+1`; the rest has no mod |
| Sage's Robe | 1 Ward stack at the start of each turn; spells -1 MP; Vulnerable to melee | No Ward-at-turn-start mod; waits on chore/ForceWardRules |
| Cinderforged Plate | Resist Fire; Thorns; +5 Poise | Block +3 and DEX -1 authored; no Resist or Thorns mod |
| Wyrmscale Mail | Resist Frost; +1 Poise; +3 Poise base | Poise lives in `poiseThreshold` (8); no Resist mod |
| Ringmail Hauberk | 1 Block at turn start | No such mod |
| Hunter's Hide | Back-row damage | No such mod |
| Heavy/medium/light set bonuses | Counter, Evade, Thorns at turn | Set-bonus mechanic belongs to chore/GearPassMechanics |

## Per-item stat choices

Engine test 32 forbids an item that a same-profile item of equal or lower rarity beats on every axis. Because most new items carry few mods, each was given its own Attack, Defence and Weight (weight equals the Poise threshold, a validator rule), within about two points of its peer. A search (nearest to the intended shape, no dominance in either direction) set the values. Existing items are unchanged.

| Item | Attack | Defence | Weight (= Poise threshold) | Trade-off |
|---|---|---|---|---|
| kris | 1 | 1 | 3 | searched so no same-profile item of equal or lower rarity dominates it, or is dominated by it |
| stiletto | 2 | 1 | 2 | searched so no same-profile item of equal or lower rarity dominates it, or is dominated by it |
| broadsword | 3 | 2 | 6 | searched so no same-profile item of equal or lower rarity dominates it, or is dominated by it |
| flamberge | 4 | 1 | 5 | searched so no same-profile item of equal or lower rarity dominates it, or is dominated by it |
| rapier | 1 | 3 | 3 | light, high defence, low attack |
| estoc | 2 | 3 | 3 | light and quick, gives up attack |
| duelistsFoil | 2 | 4 | 3 | best guard of any blade, light |
| ashenClaymore | 4 | 1 | 8 | searched so no same-profile item of equal or lower rarity dominates it, or is dominated by it |
| zweihander | 5 | 2 | 9 | searched so no same-profile item of equal or lower rarity dominates it, or is dominated by it |
| pike | 2 | 1 | 6 | Reach, lower attack, heavy |
| scythe | 4 | 2 | 7 | searched so no same-profile item of equal or lower rarity dominates it, or is dominated by it |
| reapersCrescent | 4 | 3 | 6 | searched so no same-profile item of equal or lower rarity dominates it, or is dominated by it |
| mace | 1 | 2 | 7 | searched so no same-profile item of equal or lower rarity dominates it, or is dominated by it |
| morningStar | 3 | 2 | 8 | searched so no same-profile item of equal or lower rarity dominates it, or is dominated by it |
| flail | 3 | 3 | 8 | searched so no same-profile item of equal or lower rarity dominates it, or is dominated by it |
| maul | 3 | 2 | 10 | searched so no same-profile item of equal or lower rarity dominates it, or is dominated by it |
| thunderMallet | 4 | 1 | 10 | searched so no same-profile item of equal or lower rarity dominates it, or is dominated by it |
| beardedAxe | 2 | 1 | 6 | searched so no same-profile item of equal or lower rarity dominates it, or is dominated by it |
| moonlitKatana | 3 | 2 | 4 | searched so no same-profile item of equal or lower rarity dominates it, or is dominated by it |
| moonGlaives | 2 | 1 | 5 | searched so no same-profile item of equal or lower rarity dominates it, or is dominated by it |
| longbow | 2 | 1 | 3 | light, modest attack |
| huntersRecurve | 2 | 2 | 3 | balanced bow |
| handCrossbow | 1 | 2 | 2 | lightest bow, low attack |
| arbalest | 3 | 1 | 4 | heavier, harder-hitting |
| leatherWhip | 1 | 1 | 2 | light Reach, lowest attack |
| thornWhip | 1 | 2 | 2 | light Reach, a little guard |
| ironKnuckles | 1 | 2 | 3 | light, low attack, some guard |
| beastClaws | 2 | 1 | 3 | light, sharper |
| stormSceptre | 2 | 2 | 3 | searched so no same-profile item of equal or lower rarity dominates it, or is dominated by it |
| grimoire | 0 | 6 | 3 | searched so no same-profile item of equal or lower rarity dominates it, or is dominated by it |
| prayerBook | 0 | 6 | 2 | searched so no same-profile item of equal or lower rarity dominates it, or is dominated by it |
| sunTalisman | 1 | 3 | 1 | searched so no same-profile item of equal or lower rarity dominates it, or is dominated by it |
| boneTalisman | 3 | 2 | 2 | searched so no same-profile item of equal or lower rarity dominates it, or is dominated by it |

## Notes

- Stiletto lends Twin Fang and teaches Assassinate and Feint. Feint is an existing 1-SP, zero-MP setup card (draw one and gain Prepared), matching Assassinate's Prepared bonus; it replaces the newly exposed Deathblow, whose damage lacks the required drawback. Feint appears on only this weapon. Deathblow's existing definition is unchanged.
- Maul is an enemy move name in the game, not a weapon; it is authored here as a new hammer.
- Armour rows are single-class (Cinderforged Plate and Wyrmscale Mail Reaver, Sage's Robe Starseer, Ringmail Hauberk Herald, Hunter's Hide Rogue), reusing that class's outfit art, and carry their peer's unlock.
- Relics not authored: anvilSigil, duelistsRibbon, prayerBeads, quiverStrap, whetstoneCharm.

## Inventory icon QA correction (2026-11-19)

The Compendium `shotFound` fixture cannot prove these icons: equipment persistence is `perRun`, so the off-run view does not own those pieces. The acceptance scenes now roll production boss armament rewards (seeds: Rapier 133, Beast Claws 102, Hand Crossbow 88, Scythe 49), claim the actual item, equip it in Main Hand 1 through the slot and replacement dialogs, finish the reward, and reopen the Armory. Each check requires the real held item card and its exact `icon_<id>.webp` image in `rightHand:0`. Combat hand checks also require the granted weapon-art instance (Riposte / Twinblade Flurry), rather than an arbitrary card. The sandbox visible check proves the matching image element is drawn; final browser QA separately verifies `complete` and positive `naturalWidth`, with screenshots.

## Default arts preserve existing Mana policy

Only the 33 new packages are reassigned. Their default cards already had weapon-art identity before this buildout (or are the existing Mana-free Quickstep exception), so adding the gear never changes an old card's global Mana category or base or upgraded price. All 28 existing packages are unchanged. Every weapon still has one default and two distinct learnable arts, and no card appears on more than three weapons. Maul lends Bashing Blow and teaches Colossus Smash; Colossus Smash keeps its previous price, including zero Mana. Beast Claws lends Twinblade Flurry; Fan of Knives remains learnable.

The bows use Quickstep for repositioning; Hand Crossbow uses Scholar's Insight for setup and Arbalest uses Bastion for bracing. Daggers use Twin Fang, the larger blades use Sundering Hew or sweeping cuts, and the caster items borrow their established spell families. These are existing cards; no policy or card definition changes.

| New weapon | Default art | Learnable arts |
| --- | --- | --- |
| kris | `twinFang` | `viperStrike`, `aspDart` |
| stiletto | `twinFang` | `assassinate`, `feint` |
| broadsword | `sweepingBlow` | `rend`, `hewingArc` |
| flamberge | `flameToBlade` | `progression-ember-hew`, `honedEdge` |
| rapier | `riposte` | `quickCut`, `coupDeGrace` |
| estoc | `guardCounter` | `thousandCutsRogue`, `garrote` |
| duelistsFoil | `guardCounter` | `executionWindow`, `rondelParry` |
| ashenClaymore | `greatswordSunderingHew` | `executioner`, `bloodTithe` |
| zweihander | `greatswordSunderingHew` | `progression-breaker-s-toll`, `warriorsVow` |
| pike | `rimeThrust` | `twinPrick`, `impale` |
| scythe | `cleavingBlow` | `crimsonCleave`, `ironSkin` |
| reapersCrescent | `sweepingBlow` | `bloodhuntersStrike`, `hemorrhage` |
| mace | `bashingBlow` | `shieldBash`, `kickOff` |
| morningStar | `spikedReprisal` | `goreslash`, `hemorrhage` |
| flail | `spikedReprisal` | `shieldCrash`, `setTheShield` |
| maul | `bashingBlow` | `colossusSmash`, `ruinousBlow` |
| thunderMallet | `shieldBash` | `aegisOfEmbers`, `enterBulwark` |
| beardedAxe | `cleavingBlow` | `sunderingChop`, `bloodTithe` |
| moonlitKatana | `katanaDrawCut` | `hamstringRogue`, `quickCut` |
| moonGlaives | `twinbladeFlurry` | `twinPrick`, `serratedBlade` |
| longbow | `quickstep` | `aimedShot`, `nockAndWait` |
| huntersRecurve | `quickstep` | `barbedArrow`, `pinningShot` |
| handCrossbow | `scholarsInsight` | `ricochet`, `pinningShot` |
| arbalest | `shieldBastion` | `lethalDose`, `arrowVolley` |
| leatherWhip | `katanaDrawCut` | `hamstring`, `enfeeble` |
| thornWhip | `contagion` | `septicBlade`, `toxicVolley` |
| ironKnuckles | `shieldGuardian` | `ironResolve`, `warSurgeon` |
| beastClaws | `twinbladeFlurry` | `fanOfKnives`, `shadowstep` |
| stormSceptre | `starSpark` | `starstoneKris`, `celestialLance` |
| grimoire | `scholarsInsight` | `pyreOfCharts`, `cinderLance` |
| prayerBook | `urgentHeal` | `transfusion`, `secondBloom` |
| sunTalisman | `urgentHeal` | `martyrBlood`, `litany` |
| boneTalisman | `blightTouch` | `blightwardLash`, `progression-blight-litany` |
