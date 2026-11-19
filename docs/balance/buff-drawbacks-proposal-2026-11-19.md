# Buff-card drawbacks proposal, 2026-11-19

Design survey, no code or card data changed. Owner rule (2026-11-19): "Most buff cards should exhaust before upgrades, or be really expensive, or have escalating cost, or be Ethereal, or give an enemy a buff too, or cause a discard, or add stacks of status cards (Wound, Dazed) to the deck, or inflict a negative status debuff. Upgrading can alleviate these drawbacks as options." Owner addition: upgrade options should prioritise easing the drawback or improving effectiveness/cost, offered about 3:1 against "add a new effect" at early upgrades (section 6).

## 1. Scope and method

- Shipped game: the Core profile (`games/ashenspire/packs/core/cards.json`, 95 cards, plus the `base.*` cards in `base.core-rewards`, `games/ashenspire/packs/base-cards/`). Table A lists its buff cards. Cards were read from the live registry (`registries.cards.all()` under the shipped profile) and upgrades from each card's `upgrade` block.
- Legacy "Current" catalog (bare-id cards such as `warcry`, `goreblood`, generated from `content/source`): not in the Core reward pool but still in the registry and used by the `ashen.current@1.0.0` preset. Table B lists its buff cards so the rule is not lost if that preset is promoted.
- "Buff" means the card's main job helps the player and it deals no enemy damage: a positive status (Strength, Dexterity, Evade, Reflect, Precision, stance bonus, Prepared), a power, energy/SP/MP gain, a Ward/Poise/Block boost status, or a draw engine. Left out: pure Block or heal cards (Defend, Steady Guard, Healing Prayer, Mending Touch), cards that put a debuff on an enemy (Hex Mark, Frost Veil), attacks with a rider, pile-utility cards (Scout, Recall, Transmute-the-base-card, Shuffle), enemy-only cards, legacy `emberCovenant` and `shatterOpportunity` (powers with no effects of their own), and the generated Stagger/Paralysis/Restrained status cards.
- Costs are SP (stamina) and MP (mana). Codes: EX Exhaust, ET Ethereal, XP expensive, ES escalating cost, EB enemy gets a buff, DS forced discard, ST Wound/Dazed added, SD self debuff or self damage.

## 2. Drawback mechanics in the engine

| Drawback | Exists? | Where | Notes |
|---|---|---|---|
| Exhaust | Yes | keyword `exhaust`, tag `lifecycle.exhaust` (`content/source/actionCosts.json` `KEYWORD_TAGS`, `DRAWBACK_KEYWORD_TAGS`); a played card goes to `piles.exhaust` (`src/engine/combat.js`); upgrade step `fx:unexhaust` (`src/model/cardUpgrade.js`) | Meaningless on a Power (a played power leaves play anyway), so powers take other drawbacks. |
| Ethereal | Yes | keyword `ethereal`, tag `lifecycle.ethereal`; unplayed cards exhaust at end of turn (`finishPlayerHand`, `combat.js`); upgrade step `fx:unethereal` | A Retain card cannot also be Ethereal (the retain option excludes it). |
| Escalating cost | Yes | card field `costGrowth {stamina, mana, perUse, max}` read in `src/engine/cardBehavior.js` `projectCardBehavior`, per instance; schema in `src/model/schemas.js`; used by `ironHide`, `base.cost-per-use`, `base.retain-block`; upgrade step `fx:steady` zeroes it | Counts plays of that copy only. |
| Give an enemy a status (buff) | Mechanically yes | `applyStatus` with `target: enemy` or `allEnemies` (`src/engine/actions.js`) accepts any status id; `strength` carries `attackDamageAdd`, read from the attacker through `statuses.getAdd` in the damage path | No card does this today and no test pins an enemy holding a positive status. The enemy AI and intent preview (`enemyIntentProjection.js`) must be checked. Needs a test. |
| Forced discard | Yes | op `discard` with `amount` and `random` or `choose` (`actions.js`; `requestAbilityDiscard` for the choose path); derived tag `drawback:discard` (`DRAWBACK_OPS`); used by `pilfer`, `acrobaticsRogue`, `progression-silent-exchange` | A random discard needs no UI; a choose discard opens a picker. |
| Add Wound/Dazed to the piles | Yes | op `addCard` with `card`, `pile`, `count`, `position` (`actions.js`); registry cards `wound` (unplayable), `dazed` (unplayable, Ethereal), `slimed` (1 SP, Exhaust), `guilt` (curse, loses HP); derived tag `drawback:selfDeck` | The instance is created in the combat piles only, never in `run.deck`, so the deck editor never sees it. `addBurden` is a different op (burdens for enemy hands). |
| Self debuff | Yes | `applyStatus` with `target: self` and `weak`, `frail`, `vulnerable`, `bleed`, `burn`; `loseHp` (derived tag `drawback:hpCost`) | The relic text "Drained, Reckless" in `build-relics-proposal-2026-11-18.md` names two statuses that do not exist in `content/source/statuses.json`; use Frail, Weak or Vulnerable. |

Missing, and the minimal implementation:

1. Derived tags for the three drawbacks with no `DRAWBACK_OPS` entry: enemy buff, self debuff and escalating cost. Without them the action-cost budget (`src/model/actionCosts.js`, `COST_BUDGET`) gives no credit for them. Add `drawback:enemyBuff`, `drawback:selfDebuff`, `drawback:escalating` with negative weights.
2. Two upgrade steps that ease the new drawbacks (section 6): `fx:soften` and `fx:unburden`, plus their `DRAWBACK_TEXT` patterns so face text follows the data (`cardUpgrade.js`).
3. Let drawback-easing options through for Powers: `options()` in `src/model/cardUpgradeSteps.js` returns after `cost` for types in `RESTRICTED_TYPES` (power, status, curse, consumable), so a rolled power upgrade can only be `cost`. Move the ease kinds before that early return, or give powers an `upgradeMenu` naming `cost`, `fx:soften`, `fx:unburden`.
4. Tests: an enemy holding Strength raises its hit; a card adding Wound/Dazed shows in the piles and reshuffles; preview text for each new drawback line.
5. Card text: `textTemplate` lines such as "Discard 1 card.", "Add a Wound to your discard pile.", "An enemy gains 1 Strength." so the face states the drawback (`cardFaceBudget.js` limits face lines).

## 3. Table A: Core (shipped) buff cards

| id | name | class | rarity | cost | effect | current drawback (base / upgraded) | proposed drawback | upgrade change |
|---|---|---|---|---|---|---|---|---|
| `core.evade` | Evade | colorless | common | 3 SP | Evade stacks | none (3 SP is the price) / upgrade 2 SP | Expensive: stays 3 SP | Cost 3 to 2 (existing `cost` option) |
| `core.closingDodge` | Closing Dodge | colorless | uncommon | 4 SP | Evade stacks, pull enemy 1 band | none (4 SP) / upgrade 3 SP | Expensive: stays 4 SP | Cost 4 to 3 (existing) |
| `core.backstep` | Backstep | colorless | uncommon | 1 SP | Evade, step back, Prepared | Exhaust / upgrade drops Exhaust | Exhaust (as now) | Drops Exhaust (as now); Evade halves per `per:2`, so keep that as the price |
| `core.mirrorGuard` | Mirror Guard | colorless | uncommon | 1 SP | Reflect 1 | none / upgrade Reflect 2 | Ethereal | Drops Ethereal; Reflect stays 1 (the +1 Reflect moves to a later rolled step) |
| `core.guidingWhisper` | Guiding Whisper | colorless | common | 1 SP | Precision 3, Regen 1 | none / none | Self Frail 1 | Removes Frail; Precision 4 (existing) |
| `core.manaSurge` | Mana Surge | colorless | starter | 1 SP | +2 MP | none | none: starter card, net resource gain is already small | Generic roll only |
| `core.glimpse` | Glimpse | colorless | common | 1 SP | Draw 1, +1 MP | none / draw 2 | none: cantrip filler, a drawback would make it unplayable | Draw 2 (existing) |
| `core.openArchive` | Open Archive | colorless | rare | 2 MP | Draw 5, +2 MP | Exhaust / draw 7, MP 3 | Exhaust (as now) | Keeps Exhaust (a repeatable 5-card draw is too strong); draw 7 as now |
| `core.moteShield` | Mote Shield | colorless | common | 1 SP | Block 2, Barrier 1, Ward 1, draw 1 | none | none: mostly a defence card with small numbers | Generic roll only |
| `core.hallowedWard` | Hallowed Ward | colorless | common | 1 SP | Block 3, Barrier 1, Regen 1 | none | none: mostly a defence card with small numbers | Generic roll only |
| `base.stat-buff` | Stat Buff | colorless | common | 1 SP | +2 Strength for the fight | none | Escalating: +1 SP per prior play, max +2 | `fx:steady` (stops the rise); later Strength 3 |
| `base.buff-ally` | Buff Ally | colorless | common | 1 SP | Ally +2 Strength (co-op) | none | Exhaust | Drops Exhaust |
| `base.foresight` | Foresight | colorless | uncommon | 1 SP + 1 MP | Perception 3, draw 2 | none | Discard 1 (you choose) | Discard 1 becomes optional (up to 1) |
| `base.evade` | Evade (base) | colorless | common | 1 SP | Evade 1 | Exhaust | Exhaust (as now) | Drops Exhaust |
| `base.intangible` | Intangible | colorless | uncommon | 1 SP + 2 MP | Intangible 1 | none (2 MP is steep) | Exhaust | MP 2 to 1; Exhaust stays (Intangible is too strong to repeat) |
| `base.mirrors` | Mirrors | colorless | uncommon | 1 SP + 2 MP | Mirrors 1 | none | Ethereal | Drops Ethereal |
| `base.extra-weapon` | Extra Weapon | colorless | uncommon | 1 SP + 1 MP | Extra weapon 1 | none | Add 1 Wound to the discard pile | Wound swaps for Dazed (one-turn clog) |
| `base.extra-shield` | Extra Shield | colorless | uncommon | 1 SP + 1 MP | Extra shield 1 | none | Add 1 Dazed to the draw pile | Removes the Dazed |
| `base.auto-counter` | Auto Counter | colorless | common | 1 SP | Auto-counter 1 | none | Enemy gains Strength 1 | Removes the enemy Strength |
| `base.auto-sweep` | Auto Sweep | colorless | common | 1 SP | Auto-sweep 1 | none | Self Vulnerable 1 | Removes Vulnerable |
| `base.reflect` | Reflect | colorless | uncommon | 1 SP + 1 MP | Reflect status | none | All enemies gain Strength 2 | Enemy Strength 2 to 1 |
| `base.gain-resource` | Gain Resource | colorless | uncommon | 1 SP + 1 MP | +3 SP | none (net +1 SP) | none: pays 2 resources to gain 3, already a thin gain | Generic roll only |
| `base.perception-untargetable` | Veil | colorless | uncommon | 1 SP + 1 MP | Veil 2 (hard to target) | none | Self Frail 2 | Frail 2 to 1 |
| `base.hide-cards` | Conceal | colorless | uncommon | 1 SP + 1 MP | Conceal 2, hide cards | none | Discard 1 at random | Discard becomes your choice |
| `base.multi-stance` | Many Forms | colorless | uncommon | 1 SP + 1 MP | One extra concurrent stance | none | Escalating: +1 SP per prior play, max +2 | `fx:steady` |
| `base.retain-block` | Retain Block | colorless | common | 1 SP | Block 6, keep it 1 turn | Escalating +1 SP per play, max +2 / upgrade steady | Escalating (as now) | `fx:steady` (as now) |
| `base.draw` | Draw | colorless | common | 1 SP | Draw 2 | none | Add 1 Dazed to the discard pile | Removes the Dazed |
| `base.immediate-stance-transition` | Stance Shift | colorless | common | 0 | Enter a chosen stance | none | Ethereal | Drops Ethereal |

Left drawback-free: `core.manaSurge` (starter, +2 MP for 1 SP is a small gain), `core.glimpse` (1-card cantrip filler), `core.moteShield` and `core.hallowedWard` (small Block with a Ward/Barrier, mostly defence), `base.gain-resource` (pays 2 resources for 3). Each would become unplayable or pointless with a drawback.

## 4. Table B: Legacy Current catalog buff cards

Not in the Core reward pool; applies if the `ashen.current` preset is used.

| id | name | class | rarity | cost | effect | current drawback (base / upgraded) | proposed drawback | upgrade change |
|---|---|---|---|---|---|---|---|---|
| `rallyingStandard` | Rallying Standard | reaver | uncommon | 1 | Power: +1 Strength each turn, take 1 damage per stack | status self-damage (built in) / upgrade `Up` status drops the damage | Self damage (as now, built into the status) | Upgrade status drops the damage (as now) |
| `goreblood` | Goreblood | reaver | rare | 3 | Power: poise thresholds stop rising | none (3 SP) / upgrade 2 SP | Expensive: stays 3 SP | Cost 3 to 2 (as now) |
| `unbreakable` | Unbreakable | reaver | rare | 2 | Power: Block no longer expires (cap 30) | none / upgrade cap 40 | Self Frail 2 | Frail 2 to 1; cap 40 moves to a later step |
| `sanguinePactCard` | Sanguine Pact | reaver | rare | 2 | Power: +2 Strength per Bleed burst | none / cost 1 | Discard 1 (you choose) | Discard 1 optional; cost 2 to 1 stays a rolled option |
| `ironVowCard` | Iron Vow | reaver | uncommon | 1 | Power: 3 Block when you lose HP | none / cost 0 | none: conditional on losing HP, already a risky build | Cost 1 to 0 (as now) |
| `stargazerCard` | Stargazer | starseer | uncommon | 1 | Power: Starstone Charge each turn (Retain) | Retain / none | Add 1 Dazed to the draw pile | Removes the Dazed |
| `astralArmorCard` | Astral Armour | starseer | uncommon | 1 | Power: 4 Block per stack at end of turn | none / +2 stacks | Expensive: 2 SP | Cost 2 to 1; the extra stack becomes a later step |
| `azureCoilCard` | Azure Coil | starseer | uncommon | 1 | Power: 2 Block per Skill played | none | Discard 1 at random | Discard becomes your choice |
| `constellationCard` | Constellation | starseer | rare | 2 | Power: 4 damage per Charge gained | none (2 SP) / cost 1 | Expensive: stays 2 SP | Cost 2 to 1 (as now) |
| `waxingMoonCard` | Waxing Moon | starseer | rare | 2 | Power: 2 Vulnerable to all enemies each turn | none / cost 1 | All enemies gain Strength 1 | Removes the enemy Strength; cost stays 2 |
| `moonlitShieldCard` | Moonlit Shield | starseer | uncommon | 1 | Power: 3 Block per Charge gained | none | Self Frail 1 | Removes Frail |
| `astromancerCard` | Astromancer | starseer | rare | 1 | Power: Charge and draw 1 each turn | none | Expensive: 2 SP | Cost 2 to 1 |
| `thornHaloCard` | Thorn Halo | herald | uncommon | 1 | Power: Crimson Blight to all enemies each turn | none | Ethereal | Drops Ethereal |
| `communionCard` | Communion | herald | uncommon | 2 | Power: heal 3 each turn (Retain) | Retain / cost 1 | Expensive: stays 2 SP | Cost 2 to 1 (as now) |
| `stigmataCard` | Stigmata | herald | uncommon | 1 | Power: heal 2 when you lose HP | none | Add 1 Wound to the discard pile | Wound swaps for Dazed |
| `lifeTitheCard` | Life Tithe | herald | rare | 1 | Power: heal 8 when an enemy dies | none | Discard 1 (you choose) | Discard 1 optional |
| `zealotryCard` | Zealotry | herald | rare | 2 | Power: 3 damage when you lose HP | none (2 SP) / cost 1 | Expensive: stays 2 SP | Cost 2 to 1 (as now) |
| `emberTideCard` | Ember Tide | herald | uncommon | 1 | Power: +1 Strength when you heal | none / cost 0 | Ethereal | Drops Ethereal; cost 0 stays a later step |
| `harbingerOfBlightCard` | Harbinger of Blight | herald | rare | 2 | Power: heal 1 per Blight applied | none (2 SP) / cost 1 | Expensive: stays 2 SP | Cost 2 to 1 (as now) |
| `afterimageCard` | Afterimage | rogue | uncommon | 1 | Power: 3 Block on every third card | none / cost 0 | Self Weak 1 | Removes Weak |
| `deadlyTempoCard` | Deadly Tempo | rogue | rare | 2 | Power: Prepared and draw 1 each turn | none / cost 1 | Add 1 Wound to the discard pile | Wound swaps for Dazed; cost stays 2 |
| `opportunistCard` | Opportunist | rogue | rare | 1 | Power: Prepared and draw on Break | none / cost 0 | none: needs a Break to trigger, conditional | Cost 1 to 0 (as now) |
| `envenomCard` | Envenom | rogue | rare | 2 | Power: attacks apply 1 Venom | none / cost 1 | All enemies gain Strength 1 | Removes the enemy Strength; cost stays 2 |
| `enterGorefire` | Enter: Gorefire | reaver | common | 1 | Enter Gorefire stance, draw 1 | none / cost 0 | Ethereal | Drops Ethereal; cost 0 stays a later step |
| `warcry` | Warcry | reaver | uncommon | 1 | +1 Strength, draw 1 | Exhaust / none | Exhaust (as now) | Drops Exhaust |
| `twinkling` | Twinkling | starseer | common | 0 | Draw 1, Charge; +1 energy if charged | none / draw 2 | none: 0-cost cantrip, tiny gain | Draw 2 (as now) |
| `lucidity` | Lucidity | starseer | uncommon | 1 | +1 energy, draw 1, Charge | none / draw 2 | Discard 1 at random | Discard becomes your choice |
| `timeDilation` | Time Dilation | starseer | rare | 2 | +2 energy, draw 3, Charge | Exhaust + Retain / upgrade drops Exhaust | Exhaust (as now) | Drops Exhaust (as now) |
| `scholarsInsight` | Scholar's Insight | starseer | common | 1 | Draw 2 | none | Discard 1 at random | Discard becomes your choice |
| `readTheAsh` | Read the Ash | starseer | common | 1 | Draw 2 | none | Add 1 Dazed to the discard pile | Removes the Dazed |
| `starPath` | Star Path | starseer | uncommon | 1 | Draw 2 | none | Ethereal | Drops Ethereal |
| `attune` | Attune | starseer | starter | 1 | +2 MP | Exhaust + Retain / upgrade drops Exhaust | Exhaust (as now) | Drops Exhaust (as now) |
| `riteOfCinders` | Rite of Cinders | starseer | rare | 1 | +1 energy, draw 2, Charge bonus | Exhaust + Retain | Exhaust (as now) | Draw 3 (as now); Exhaust stays |
| `bloodPact` | Blood Pact | herald | common | 0 | Lose 2 HP, +1 energy, draw 1 | self HP loss / upgrade loses 1 | Self HP loss (as now) | HP loss 2 to 1 (as now) |
| `martyrBlood` | Martyr's Blood | herald | uncommon | 1 | Lose 5 HP, +2 energy, draw 2 | Exhaust + self HP loss / upgrade loses 3 | Exhaust + HP loss (as now) | HP loss 5 to 3 (as now); Exhaust stays |
| `gildedOath` | Gilded Oath | herald | uncommon | 2 | +2 Strength, +2 Dexterity (Retain) | Retain / none | Expensive: stays 2 SP | Cost 2 to 1 via a rolled `cost` step |
| `prepare` | Prepare | rogue | starter | 0 | Prepared | Exhaust / upgrade drops Exhaust | Exhaust (as now) | Drops Exhaust (as now) |
| `feint` | Feint | rogue | common | 1 | Draw 1, Prepared | none | none: cheap filler, a drawback would make it unplayable | Generic roll only |
| `nockAndWait` | Nock and Wait | rogue | common | 1 | Draw 2, Prepared | none / draw 3 | Self Frail 1 | Removes Frail; draw 3 (as now) |
| `backstep` | Backstep (legacy) | rogue | common | 1 | Evade, step back, Prepared | none | Ethereal | Drops Ethereal |
| `shadowstep` | Shadowstep | rogue | uncommon | 2 | Evade, advance, Prepared | none (2 SP) / cost 1 | Expensive: stays 2 SP | Cost 2 to 1 (as now) |
| `setupRogue` | Setup | rogue | uncommon | 0 | Prepared, +1 energy, add a Shiv | Exhaust / upgrade draws 1 | Exhaust (as now) | Exhaust stays; draw 1 (as now) |
| `perfectHeist` | Perfect Heist | rogue | rare | 1 | Draw 3, +1 energy | Exhaust | Exhaust (as now) | Exhaust stays; generic roll |
| `pilfer` | Pilfer | rogue | common | 1 | Draw 2 | random discard 1 / draw 3 | Discard 1 at random (as now) | Discard becomes your choice |
| `acrobaticsRogue` | Acrobatics | rogue | uncommon | 1 | Evade, +1 Dexterity this turn, draw 2 | random discard 1 | Discard 1 at random (as now) | Discard becomes your choice |
| `honedEdge` | Honed Edge | colorless | common | 1 | +2 Strength | Exhaust / Strength 3 | Exhaust (as now) | Drops Exhaust; Strength stays 2 (the +1 moves to a later step) |
| `transmute` | Transmute | colorless | rare | 1 | +2 energy, draw 1 | Exhaust / draw 2 | Exhaust (as now) | Exhaust stays; draw 2 (as now) |
| `masterOfStrategy` | Master of Strategy | colorless | rare | 0 | Draw 3 | Exhaust / draw 4 | Exhaust (as now) | Exhaust stays; draw 4 (as now) |
| `steelResolve` | Steel Resolve | reaver | uncommon | 2 | +2 Strength | Exhaust (2 SP) / cost 1 | Exhaust (as now) | Cost 2 to 1 (as now); Exhaust stays |
| `ironHide` | Iron Hide | reaver | common | 1 | +2 Dexterity | Escalating +1 SP per play, max +2 / cost 0 | Escalating (as now) | Cost 0 (as now) plus `fx:steady` |
| `hearthVigil` | Hearth Vigil | herald | uncommon | 1 | Regen 4 | none | Add 1 Dazed to the draw pile | Removes the Dazed |
| `zealousFervor` | Zealous Fervor | herald | rare | 1 | +2 Strength, +1 Dexterity | Ethereal / upgrade drops Ethereal | Ethereal (as now) | Drops Ethereal (as now) |
| `keenEdge` | Keen Edge | rogue | common | 1 | +1 Strength, +1 Dexterity | Ethereal / upgrade drops Ethereal | Ethereal (as now) | Drops Ethereal (as now) |
| `innerOrbit` | Inner Orbit | starseer | uncommon | 1 | +2 Dexterity, draw 1 | Exhaust | Exhaust (as now) | Drops Exhaust via a rolled `fx:unexhaust` |
| `ashOath` | Oath of Ash | colorless | special | 2 | Ally +2 Strength, self +1 (co-op) | Exhaust / ally Strength 3 | Exhaust (as now) | Exhaust stays; ally Strength 3 (as now) |

Left drawback-free: `ironVowCard` and `opportunistCard` (conditional powers that only pay off after taking damage or a Break), `twinkling` (0-cost cantrip) and `feint` (cheap filler).

## 5. Counts per drawback type

Cards listed: 28 Core, 55 Legacy. Cards that keep or get a drawback: 23 Core, 51 Legacy. The cap is about 35% per type; the highest is Exhaust at 25% overall (Core alone 21%, Legacy alone 27%). Many Exhaust, Ethereal, Expensive and Escalating entries are cards that already have that drawback today, so they are kept, not new.

| drawback type | Core shipped | Legacy Current | total | share of cards with a drawback |
|---|---|---|---|---|
| Exhaust | 5 | 14 | 19 | 26% |
| Expensive | 2 | 9 | 11 | 15% |
| Ethereal | 3 | 7 | 10 | 14% |
| Self debuff / self damage | 3 | 6 | 9 | 12% |
| Forced discard | 2 | 7 | 9 | 12% |
| Wound/Dazed added | 3 | 5 | 8 | 11% |
| Enemy gets a buff | 2 | 2 | 4 | 5% |
| Escalating cost | 3 | 1 | 4 | 5% |
| none (left drawback-free) | 5 | 4 | 9 | - |
| **cards with a drawback** | **23** | **51** | **74** | 100% |

Enemy-buff and escalating are the smallest groups on purpose: both can snowball (enemy Strength is permanent; escalating cost bricks a late fight) and both need the testing in section 2 first.

## 6. Upgrade option weighting

Source: `src/model/cardUpgradeSteps.js` (`WEIGHTS`, `options`, `addMenuOptions`, `rollUpgradeOptions`), `src/model/cardUpgrade.js` (`FX_KINDS`, `DrawbackSteps`, `MAX_CARD_UPGRADES = 10`), `src/model/cardUpgradeLimits.js` (`nextUpgradeOptions`, `RestUpgradeRule`).

### Current weights

`rollUpgradeOptions(baseDef, appliedSteps, stepIndex, rng, limits, count)` builds the kinds the card is eligible for, then draws one weighted by a single static `WEIGHTS` table. `stepIndex` and the card rank are not used by the weights: rank only caps amounts (`limits.rank`) and `scale`. The first upgrade is the card's authored `upgrade` block when it has one. Rest sites give one option for upgrades 1 to 3 and two options (20% carry two effects) from the 4th; a blacksmith offers 2 or 3. A card takes up to 10 upgrades (`UpgradeSlots` is card rank + weapon Smith level + 1).

| Group | Kinds and weight | Sum |
|---|---|---|
| Ease a drawback (only on a card that has it) | `fx:unexhaust` 8, `fx:unethereal` 12, `fx:steady` 12 | 32 |
| Effectiveness / cost | `dmg` 30, `blk` 25, `stk` 20, `cost` 10, `hits` 5, `poise` 12 | 102 |
| New effect | `addStatus` 8, `fx:block` 18, `fx:draw` 14, `fx:cycle` 8, `fx:cull` 4, `fx:copy` 5, `fx:shuffle` 4, `fx:retain` 10, `fx:innate` 5, `fx:holdOne` 6, `fx:boost` 8, `fx:target` 7, `fx:reaction` 8, `fx:counter` 8 | 113 |
| New effect, identity change | `range` 6, `targeting` 6, `maneuver` 5, `school` 4, `element` 6, `rankDown` 3 | 30 |
| New effect, run attribute (spells) | `attr` 2 | 2 |

With every kind eligible, ease plus effectiveness (134) against new effect (145) is about 0.9:1 at every upgrade number. A buff card has no damage, so `dmg` and `hits` drop out and the ratio tilts further toward new effects (it keeps `stk` 20, `cost` 10 and the menu). A Power can only be offered `cost` (section 2, item 3).

### Proposed: two-stage roll weighted by upgrade number

Roll the group first by upgrade number (`stepIndex + 1`), then a kind inside the group by the existing weights, so the ratio holds however many kinds a card is eligible for. The two draws per option (`pick`, `choice`) are kept: split `pick` into group and kind by rescaling, so the roll stays a pure function of the stream. If the card has no ease option left, its ease share goes to effectiveness/cost; if a group has no eligible kind, its share goes to the other groups pro rata.

| Upgrade # | Ease drawback | Effectiveness / cost | New effect | (ease + effectiveness) : new |
|---|---|---|---|---|
| 1 to 3 (early) | 40% | 35% | 25% | 3 : 1 |
| 4 to 5 | 30% | 30% | 40% | 1.5 : 1 |
| 6 to 7 | 20% | 30% | 50% | 1 : 1 |
| 8 to 10 (late) | 15% | 20% | 65% | 1 : 1.9 |

A card with no drawback (the free cards in sections 3 and 4) has no ease share; it goes to effectiveness/cost, so 75% / 25% early. Upgrade 1 stays the authored block when a card has one; author those blocks to ease the drawback, as the "upgrade change" column says. At 3:1 early, `fx:block`, `fx:draw` and the other added effects become rarer on the first three upgrades, which matches the owner's intent that extra effects come late. Rank-up bonuses (`rankUpBonus.js`) and the blacksmith's 2 to 3 options reuse the same roll, so they follow the table with no extra rule.

### New option kinds needed

| New kind | What it does | Maps onto existing kinds |
|---|---|---|
| `fx:soften` | Lowers the drawback one notch: self debuff stacks -1, enemy buff stacks -1, forced discard random to choose or 2 to 1, Wound to Dazed, `costGrowth.max` -1 | Sits beside `fx:steady`; ease group, weight 12 |
| `fx:unburden` | Removes the drawback op outright (self debuff, enemy buff, discard, added Wound/Dazed) | Ease group, weight 10; eligible once the drawback is at its smallest, or at once when it is already 1 |
| remove Exhaust, remove Ethereal, stop rising cost | Already exist | `fx:unexhaust`, `fx:unethereal`, `fx:steady` |
| cost -1 | Already exists; for an Expensive card it is the ease option | `cost` (counted in the ease group on an XP card, weight 10 as now) |
| remove the Wound add | New wording only | `fx:unburden` on an ST card |

Plumbing: add both ids to `FX_KINDS` and the `case` switch in `cardUpgrade.js`; add both to `DrawbackSteps` so ranked ability cards (grade tables) can take them; add `DRAWBACK_TEXT` patterns; add the two weights to `WEIGHTS` (that list drives `UPGRADE_OPTION_KINDS`, which `upgradeMenu` validation reads in `validate/entityCross.js`). Stored steps keep working: saves hold the step list, not the roll, so changing weights never changes an owned card; only new previews change. Seeded tests that pin a roll (the `core-card-upgrade-*` tests) will need new expected values.

## 7. Risks

- Wound/Dazed bloat. `addCard` makes combat-only instances, so the deck editor and shop removal never see them. A Wound sits in the discard pile until combat ends (it reshuffles), so repeated plays thicken the draw pile; Dazed is Ethereal and clears itself each turn. Cap at about 3 added status cards per fight from card plays, and prefer Dazed on common cards, Wound on uncommon and rare. If a design ever makes them run-long, they would need to be removable in the deck editor.
- Enemy buff and the AI/sim. Permanent enemy Strength compounds on long fights and bosses, and the autoplay policy (`autoCombatPolicy.js`) does not price it, so a sim run will under-rate those cards. Keep to Strength 1 to 2 and run the card-budget report plus a sim sweep before shipping.
- Escalating cost with repeated plays: a card that keeps returning to hand climbs to its cap and stays costly. Keep `max` at 2 and let `fx:steady` clear it.
- Exhaust on a Power is meaningless; that is why powers use ET, XP, SD, DS, ST and EB here.
- Ethereal on a 0-cost card (`base.immediate-stance-transition`) is nearly free; revisit after playtest.
- Expensive buffs at 3 to 4 SP (`core.evade`, `core.closingDodge`) are hard to play on a small SP pool; the upgrade cost -1 must stay the most-offered early option.
- More drawback cards raise the value of the Penitent's Chain relic (it rewards cards with a drawback); check it after this lands.
- Card-face space: a face with a status line plus a drawback line can exceed the face budget (`cardFaceBudget.js`).
- Every value is a proposal; none was run through the sim, and enemy-Strength behaviour in the AI is unverified.
