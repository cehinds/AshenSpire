# Buff-card drawbacks proposal, 2026-11-19

Design survey, no code or card data changed. Owner rule (2026-11-19): "Most buff cards should exhaust before upgrades, or be really expensive, or have escalating cost, or be Ethereal, or give an enemy a buff too, or cause a discard, or add stacks of status cards (Wound, Dazed) to the deck, or inflict a negative status debuff. Upgrading can alleviate these drawbacks as options." Owner addition: upgrade options should prioritise easing the drawback or improving effectiveness/cost, offered about 3:1 against "add a new effect" at early upgrades (section 6). Owner correction: upgrades stay random rolls tied to card type, using existing upgrade kinds; nothing is a fixed per-card result.

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
2. Easing the four drawbacks no existing upgrade kind touches (self debuff, enemy buff, forced discard, added Wound/Dazed): see section 7. Recommended: generalise the existing `stk` number step, no new kind id.
3. Let drawback-easing options through for Powers: `options()` in `src/model/cardUpgradeSteps.js` returns after `cost` for types in `RESTRICTED_TYPES` (power, status, curse, consumable), so a rolled power upgrade can only be `cost`. Move the ease kinds before that early return (section 6, per-type table).
4. Tests: an enemy holding Strength raises its hit; a card adding Wound/Dazed shows in the piles and reshuffles; preview text for each new drawback line.
5. Card text: `textTemplate` lines such as "Discard 1 card.", "Add a Wound to your discard pile.", "An enemy gains 1 Strength." so the face states the drawback (`cardFaceBudget.js` limits face lines).

## 3. Table A: Core (shipped) buff cards

| id | name | class | rarity | cost | effect | current drawback (base / upgraded) | proposed drawback | eligible ease options (existing kinds) |
|---|---|---|---|---|---|---|---|---|
| `core.evade` | Evade | colorless | common | 3 SP | Evade stacks | none (3 SP is the price) / upgrade 2 SP | Expensive: stays 3 SP | `cost` (SP or MP -1, once per card) |
| `core.closingDodge` | Closing Dodge | colorless | uncommon | 4 SP | Evade stacks, pull enemy 1 band | none (4 SP) / upgrade 3 SP | Expensive: stays 4 SP | `cost` (SP or MP -1, once per card) |
| `core.backstep` | Backstep | colorless | uncommon | 1 SP | Evade, step back, Prepared | Exhaust / upgrade drops Exhaust | Exhaust (as now) | `fx:unexhaust` |
| `core.mirrorGuard` | Mirror Guard | colorless | uncommon | 1 SP | Reflect 1 | none / upgrade Reflect 2 | Ethereal | `fx:unethereal` |
| `core.guidingWhisper` | Guiding Whisper | colorless | common | 1 SP | Precision 3, Regen 1 | none / none | Self Frail 1 | none existing (see section 7) |
| `core.manaSurge` | Mana Surge | colorless | starter | 1 SP | +2 MP | none | none: starter card, net resource gain is already small | n/a (no drawback) |
| `core.glimpse` | Glimpse | colorless | common | 1 SP | Draw 1, +1 MP | none / draw 2 | none: cantrip filler, a drawback would make it unplayable | n/a (no drawback) |
| `core.openArchive` | Open Archive | colorless | rare | 2 MP | Draw 5, +2 MP | Exhaust / draw 7, MP 3 | Exhaust (as now) | `fx:unexhaust` |
| `core.moteShield` | Mote Shield | colorless | common | 1 SP | Block 2, Barrier 1, Ward 1, draw 1 | none | none: mostly a defence card with small numbers | n/a (no drawback) |
| `core.hallowedWard` | Hallowed Ward | colorless | common | 1 SP | Block 3, Barrier 1, Regen 1 | none | none: mostly a defence card with small numbers | n/a (no drawback) |
| `base.stat-buff` | Stat Buff | colorless | common | 1 SP | +2 Strength for the fight | none | Escalating: +1 SP per prior play, max +2 | `fx:steady`, `cost` |
| `base.buff-ally` | Buff Ally | colorless | common | 1 SP | Ally +2 Strength (co-op) | none | Exhaust | `fx:unexhaust` |
| `base.foresight` | Foresight | colorless | uncommon | 1 SP + 1 MP | Perception 3, draw 2 | none | Discard 1 (you choose) | none existing (see section 7) |
| `base.evade` | Evade (base) | colorless | common | 1 SP | Evade 1 | Exhaust | Exhaust (as now) | `fx:unexhaust` |
| `base.intangible` | Intangible | colorless | uncommon | 1 SP + 2 MP | Intangible 1 | none (2 MP is steep) | Exhaust | `fx:unexhaust`, `cost` |
| `base.mirrors` | Mirrors | colorless | uncommon | 1 SP + 2 MP | Mirrors 1 | none | Ethereal | `fx:unethereal` |
| `base.extra-weapon` | Extra Weapon | colorless | uncommon | 1 SP + 1 MP | Extra weapon 1 | none | Add 1 Wound to the discard pile | none existing (see section 7) |
| `base.extra-shield` | Extra Shield | colorless | uncommon | 1 SP + 1 MP | Extra shield 1 | none | Add 1 Dazed to the draw pile | none existing (see section 7) |
| `base.auto-counter` | Auto Counter | colorless | common | 1 SP | Auto-counter 1 | none | Enemy gains Strength 1 | none existing (see section 7) |
| `base.auto-sweep` | Auto Sweep | colorless | common | 1 SP | Auto-sweep 1 | none | Self Vulnerable 1 | none existing (see section 7) |
| `base.reflect` | Reflect | colorless | uncommon | 1 SP + 1 MP | Reflect status | none | All enemies gain Strength 2 | none existing (see section 7) |
| `base.gain-resource` | Gain Resource | colorless | uncommon | 1 SP + 1 MP | +3 SP | none (net +1 SP) | none: pays 2 resources to gain 3, already a thin gain | n/a (no drawback) |
| `base.perception-untargetable` | Veil | colorless | uncommon | 1 SP + 1 MP | Veil 2 (hard to target) | none | Self Frail 2 | none existing (see section 7) |
| `base.hide-cards` | Conceal | colorless | uncommon | 1 SP + 1 MP | Conceal 2, hide cards | none | Discard 1 at random | none existing (see section 7) |
| `base.multi-stance` | Many Forms | colorless | uncommon | 1 SP + 1 MP | One extra concurrent stance | none | Escalating: +1 SP per prior play, max +2 | `fx:steady`, `cost` |
| `base.retain-block` | Retain Block | colorless | common | 1 SP | Block 6, keep it 1 turn | Escalating +1 SP per play, max +2 / upgrade steady | Escalating (as now) | `fx:steady`, `cost` |
| `base.draw` | Draw | colorless | common | 1 SP | Draw 2 | none | Add 1 Dazed to the discard pile | none existing (see section 7) |
| `base.immediate-stance-transition` | Stance Shift | colorless | common | 0 | Enter a chosen stance | none | Ethereal | `fx:unethereal` |

Left drawback-free: `core.manaSurge` (starter, +2 MP for 1 SP is a small gain), `core.glimpse` (1-card cantrip filler), `core.moteShield` and `core.hallowedWard` (small Block with a Ward/Barrier, mostly defence), `base.gain-resource` (pays 2 resources for 3). Each would become unplayable or pointless with a drawback.

## 4. Table B: Legacy Current catalog buff cards

Not in the Core reward pool; applies if the `ashen.current` preset is used.

| id | name | class | rarity | cost | effect | current drawback (base / upgraded) | proposed drawback | eligible ease options (existing kinds) |
|---|---|---|---|---|---|---|---|---|
| `rallyingStandard` | Rallying Standard | reaver | uncommon | 1 | Power: +1 Strength each turn, take 1 damage per stack | status self-damage (built in) / upgrade `Up` status drops the damage | Self damage (as now, built into the status) | none existing (see section 7) |
| `goreblood` | Goreblood | reaver | rare | 3 | Power: poise thresholds stop rising | none (3 SP) / upgrade 2 SP | Expensive: stays 3 SP | `cost` (SP or MP -1, once per card) |
| `unbreakable` | Unbreakable | reaver | rare | 2 | Power: Block no longer expires (cap 30) | none / upgrade cap 40 | Self Frail 2 | none existing (see section 7) |
| `sanguinePactCard` | Sanguine Pact | reaver | rare | 2 | Power: +2 Strength per Bleed burst | none / cost 1 | Discard 1 (you choose) | none existing (see section 7) |
| `ironVowCard` | Iron Vow | reaver | uncommon | 1 | Power: 3 Block when you lose HP | none / cost 0 | none: conditional on losing HP, already a risky build | n/a (no drawback) |
| `stargazerCard` | Stargazer | starseer | uncommon | 1 | Power: Starstone Charge each turn (Retain) | Retain / none | Add 1 Dazed to the draw pile | none existing (see section 7) |
| `astralArmorCard` | Astral Armour | starseer | uncommon | 1 | Power: 4 Block per stack at end of turn | none / +2 stacks | Expensive: 2 SP | `cost` (SP or MP -1, once per card) |
| `azureCoilCard` | Azure Coil | starseer | uncommon | 1 | Power: 2 Block per Skill played | none | Discard 1 at random | none existing (see section 7) |
| `constellationCard` | Constellation | starseer | rare | 2 | Power: 4 damage per Charge gained | none (2 SP) / cost 1 | Expensive: stays 2 SP | `cost` (SP or MP -1, once per card) |
| `waxingMoonCard` | Waxing Moon | starseer | rare | 2 | Power: 2 Vulnerable to all enemies each turn | none / cost 1 | All enemies gain Strength 1 | none existing (see section 7) |
| `moonlitShieldCard` | Moonlit Shield | starseer | uncommon | 1 | Power: 3 Block per Charge gained | none | Self Frail 1 | none existing (see section 7) |
| `astromancerCard` | Astromancer | starseer | rare | 1 | Power: Charge and draw 1 each turn | none | Expensive: 2 SP | `cost` (SP or MP -1, once per card) |
| `thornHaloCard` | Thorn Halo | herald | uncommon | 1 | Power: Crimson Blight to all enemies each turn | none | Ethereal | `fx:unethereal` |
| `communionCard` | Communion | herald | uncommon | 2 | Power: heal 3 each turn (Retain) | Retain / cost 1 | Expensive: stays 2 SP | `cost` (SP or MP -1, once per card) |
| `stigmataCard` | Stigmata | herald | uncommon | 1 | Power: heal 2 when you lose HP | none | Add 1 Wound to the discard pile | none existing (see section 7) |
| `lifeTitheCard` | Life Tithe | herald | rare | 1 | Power: heal 8 when an enemy dies | none | Discard 1 (you choose) | none existing (see section 7) |
| `zealotryCard` | Zealotry | herald | rare | 2 | Power: 3 damage when you lose HP | none (2 SP) / cost 1 | Expensive: stays 2 SP | `cost` (SP or MP -1, once per card) |
| `emberTideCard` | Ember Tide | herald | uncommon | 1 | Power: +1 Strength when you heal | none / cost 0 | Ethereal | `fx:unethereal` |
| `harbingerOfBlightCard` | Harbinger of Blight | herald | rare | 2 | Power: heal 1 per Blight applied | none (2 SP) / cost 1 | Expensive: stays 2 SP | `cost` (SP or MP -1, once per card) |
| `afterimageCard` | Afterimage | rogue | uncommon | 1 | Power: 3 Block on every third card | none / cost 0 | Self Weak 1 | none existing (see section 7) |
| `deadlyTempoCard` | Deadly Tempo | rogue | rare | 2 | Power: Prepared and draw 1 each turn | none / cost 1 | Add 1 Wound to the discard pile | none existing (see section 7) |
| `opportunistCard` | Opportunist | rogue | rare | 1 | Power: Prepared and draw on Break | none / cost 0 | none: needs a Break to trigger, conditional | n/a (no drawback) |
| `envenomCard` | Envenom | rogue | rare | 2 | Power: attacks apply 1 Venom | none / cost 1 | All enemies gain Strength 1 | none existing (see section 7) |
| `enterGorefire` | Enter: Gorefire | reaver | common | 1 | Enter Gorefire stance, draw 1 | none / cost 0 | Ethereal | `fx:unethereal` |
| `warcry` | Warcry | reaver | uncommon | 1 | +1 Strength, draw 1 | Exhaust / none | Exhaust (as now) | `fx:unexhaust` |
| `twinkling` | Twinkling | starseer | common | 0 | Draw 1, Charge; +1 energy if charged | none / draw 2 | none: 0-cost cantrip, tiny gain | n/a (no drawback) |
| `lucidity` | Lucidity | starseer | uncommon | 1 | +1 energy, draw 1, Charge | none / draw 2 | Discard 1 at random | none existing (see section 7) |
| `timeDilation` | Time Dilation | starseer | rare | 2 | +2 energy, draw 3, Charge | Exhaust + Retain / upgrade drops Exhaust | Exhaust (as now) | `fx:unexhaust` |
| `scholarsInsight` | Scholar's Insight | starseer | common | 1 | Draw 2 | none | Discard 1 at random | none existing (see section 7) |
| `readTheAsh` | Read the Ash | starseer | common | 1 | Draw 2 | none | Add 1 Dazed to the discard pile | none existing (see section 7) |
| `starPath` | Star Path | starseer | uncommon | 1 | Draw 2 | none | Ethereal | `fx:unethereal` |
| `attune` | Attune | starseer | starter | 1 | +2 MP | Exhaust + Retain / upgrade drops Exhaust | Exhaust (as now) | `fx:unexhaust` |
| `riteOfCinders` | Rite of Cinders | starseer | rare | 1 | +1 energy, draw 2, Charge bonus | Exhaust + Retain | Exhaust (as now) | `fx:unexhaust` |
| `bloodPact` | Blood Pact | herald | common | 0 | Lose 2 HP, +1 energy, draw 1 | self HP loss / upgrade loses 1 | Self HP loss (as now) | none existing (see section 7) |
| `martyrBlood` | Martyr's Blood | herald | uncommon | 1 | Lose 5 HP, +2 energy, draw 2 | Exhaust + self HP loss / upgrade loses 3 | Exhaust + HP loss (as now) | `fx:unexhaust` |
| `gildedOath` | Gilded Oath | herald | uncommon | 2 | +2 Strength, +2 Dexterity (Retain) | Retain / none | Expensive: stays 2 SP | `cost` (SP or MP -1, once per card) |
| `prepare` | Prepare | rogue | starter | 0 | Prepared | Exhaust / upgrade drops Exhaust | Exhaust (as now) | `fx:unexhaust` |
| `feint` | Feint | rogue | common | 1 | Draw 1, Prepared | none | none: cheap filler, a drawback would make it unplayable | n/a (no drawback) |
| `nockAndWait` | Nock and Wait | rogue | common | 1 | Draw 2, Prepared | none / draw 3 | Self Frail 1 | none existing (see section 7) |
| `backstep` | Backstep (legacy) | rogue | common | 1 | Evade, step back, Prepared | none | Ethereal | `fx:unethereal` |
| `shadowstep` | Shadowstep | rogue | uncommon | 2 | Evade, advance, Prepared | none (2 SP) / cost 1 | Expensive: stays 2 SP | `cost` (SP or MP -1, once per card) |
| `setupRogue` | Setup | rogue | uncommon | 0 | Prepared, +1 energy, add a Shiv | Exhaust / upgrade draws 1 | Exhaust (as now) | `fx:unexhaust` |
| `perfectHeist` | Perfect Heist | rogue | rare | 1 | Draw 3, +1 energy | Exhaust | Exhaust (as now) | `fx:unexhaust` |
| `pilfer` | Pilfer | rogue | common | 1 | Draw 2 | random discard 1 / draw 3 | Discard 1 at random (as now) | none existing (see section 7) |
| `acrobaticsRogue` | Acrobatics | rogue | uncommon | 1 | Evade, +1 Dexterity this turn, draw 2 | random discard 1 | Discard 1 at random (as now) | none existing (see section 7) |
| `honedEdge` | Honed Edge | colorless | common | 1 | +2 Strength | Exhaust / Strength 3 | Exhaust (as now) | `fx:unexhaust` |
| `transmute` | Transmute | colorless | rare | 1 | +2 energy, draw 1 | Exhaust / draw 2 | Exhaust (as now) | `fx:unexhaust` |
| `masterOfStrategy` | Master of Strategy | colorless | rare | 0 | Draw 3 | Exhaust / draw 4 | Exhaust (as now) | `fx:unexhaust` |
| `steelResolve` | Steel Resolve | reaver | uncommon | 2 | +2 Strength | Exhaust (2 SP) / cost 1 | Exhaust (as now) | `fx:unexhaust`, `cost` |
| `ironHide` | Iron Hide | reaver | common | 1 | +2 Dexterity | Escalating +1 SP per play, max +2 / cost 0 | Escalating (as now) | `fx:steady`, `cost` |
| `hearthVigil` | Hearth Vigil | herald | uncommon | 1 | Regen 4 | none | Add 1 Dazed to the draw pile | none existing (see section 7) |
| `zealousFervor` | Zealous Fervor | herald | rare | 1 | +2 Strength, +1 Dexterity | Ethereal / upgrade drops Ethereal | Ethereal (as now) | `fx:unethereal` |
| `keenEdge` | Keen Edge | rogue | common | 1 | +1 Strength, +1 Dexterity | Ethereal / upgrade drops Ethereal | Ethereal (as now) | `fx:unethereal` |
| `innerOrbit` | Inner Orbit | starseer | uncommon | 1 | +2 Dexterity, draw 1 | Exhaust | Exhaust (as now) | `fx:unexhaust` |
| `ashOath` | Oath of Ash | colorless | special | 2 | Ally +2 Strength, self +1 (co-op) | Exhaust / ally Strength 3 | Exhaust (as now) | `fx:unexhaust` |

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

### How the current roll uses card type

- `options()` reads `base.type`. `RESTRICTED_TYPES` (power, status, curse, consumable) get only `cost` (offered before the early return) and nothing else.
- Attack versus skill: `attack` (tag `classification.attack` or type attack) gates `fx:target` and the Strength `fx:boost`; a card with a plain damage effect on an enemy gates `dmg`, `hits`, `addStatus` (and `poise`); a card with a printed Block gates `blk`.
- Maneuver tag: `maneuver:counter` removes `dmg`, `hits`, `poise`, range and targeting (the return payload is fixed) and `fx:block`, and is the only type offered `fx:counter`; `maneuver:defend` or counter removes `fx:reaction`.
- Spell (`camp:spell` or `source:spell`): `attr`, INT/WIS `fx:boost`, element and school options, an MP cut on `cost` (not on a Basic: a common non-spell or a cantrip), and the `addStatus` pair (burn/vulnerable for spells, bleed/weak for physical).
- Ranked ability cards (`gradeProfiles`) are offered only `DrawbackSteps` (`fx:unexhaust`, `fx:unethereal`, `fx:steady`); an authored `upgradeMenu` names a subset of kinds.
- The weights themselves ignore type and upgrade number.

### Proposed: two-stage roll weighted by upgrade number

Roll the group first by upgrade number (`stepIndex + 1`), then a kind inside the group by the existing weights, so the ratio holds however many kinds a card is eligible for. The two draws per option (`pick`, `choice`) are kept: split `pick` into group and kind by rescaling, so the roll stays a pure function of the stream. If the card has no ease option left, its ease share goes to effectiveness/cost; if a group has no eligible kind, its share goes to the other groups pro rata. Kinds are the existing ones only.

| Upgrade # | Ease drawback | Effectiveness / cost | New effect (other) | Identity change | (ease + effectiveness) : new (other + identity) |
|---|---|---|---|---|---|
| 1 to 3 (early) | 40% | 35% | 20% | 5% | 3 : 1 |
| 4 to 5 | 30% | 30% | 30% | 10% | 1.5 : 1 |
| 6 to 7 | 20% | 30% | 35% | 15% | 1 : 1 |
| 8 to 10 (late) | 15% | 20% | 45% | 20% | 1 : 1.9 |

Identity change (range, targeting, stance, damage type; the element packet moved to effectiveness / cost) is its own share inside "new effect" (section 9): present from upgrade 1 at low odds, rising to a fifth of rolls late.

A card with no drawback has no ease share; it goes to effectiveness/cost, so 75% / 25% early. Upgrades are never fixed per card: a card gets the same random, type-gated roll as today, only weighted by this table. For the cards in sections 3 and 4 that means no authored `upgrade` block should fix the first upgrade (today an authored block is always upgrade 1); drop or reduce it to numbers so upgrade 1 rolls and favours the drawback. The "current drawback" column keeps today's authored upgrades as facts only. Rank-up bonuses (`rankUpBonus.js`) and the blacksmith's 2 to 3 options reuse the same roll. Stored steps keep working (saves hold the step list, not the roll), so owned cards do not change; only new previews do, and seeded roll tests need new expected values.

### Proposed per-type option pools

Kinds in order: ease group first, then effectiveness/cost, then new effects. "Exists" kinds only.

| Card type | Ease group (rolled first) | Effectiveness / cost | New effect |
|---|---|---|---|
| Attack (not spell) | `fx:unexhaust`, `fx:unethereal`, `fx:steady`, plus the signed `stk` of section 7 | `cost`, `dmg`, `hits`, `poise`, `stk`, `blk` when it has Block | `addStatus`, `fx:target`, `fx:boost` (STR), `fx:block`, `fx:draw`, `fx:cycle`, `fx:cull`, `fx:copy`, `fx:shuffle`, `fx:retain`, `fx:innate`, `fx:holdOne`, `fx:reaction`, identity kinds (range, targeting, maneuver, school, element, rankDown) |
| Attack, counter maneuver | same | `cost`, `stk` | `fx:counter`, `fx:draw`, `fx:cycle`, `fx:cull`, `fx:shuffle`, `fx:retain`, `fx:innate`, `fx:holdOne` |
| Skill (not spell), the typical buff | same three plus signed `stk` | `cost`, `blk` when it has Block, `stk` (raises the buff status) | `fx:block`, `fx:draw`, `fx:cycle`, `fx:cull`, `fx:copy`, `fx:shuffle`, `fx:retain`, `fx:innate`, `fx:holdOne`, `fx:boost` (DEX), `fx:reaction`, `maneuver` |
| Spell (skill or attack) | same | as the row above, `cost` may cut MP too (not on a Basic) | as above plus `fx:boost` (INT or WIS), `attr`, `element`, `school` |
| Sweep (`maneuver:sweep`, `targeting:area`, damage on `allEnemies`) | same | `poise` (a plain `poiseDamage`; not offered when `maneuver:smash`), `stk`, `cost` (floored at 2 SP at rank 0; an authored lower cost lowers the floor). Gate today: `dmg` needs `effects[dmgIndex].target === 'enemy'`, so a sweep's per-target damage is NOT offered, and `hits` and `fx:target` need an enemy-target hit too. Approved (owner, 2026-11-19): lift the `dmg` gate to `allEnemies` (the step raises damage per target) | `addStatus` (bleed or weak, if it has no status), `range` (melee/reach), `element` (physical sweep), `dmgType` (section 9), `fx:block`, `fx:draw`, `fx:cycle`, `fx:cull`, `fx:shuffle`, `fx:retain`, `fx:innate`, `fx:holdOne`, `fx:reaction`. No `targeting` and no `maneuver` kind: both are gated off `maneuver:sweep` |
| Smash (`maneuver:smash`) | same | `dmg`, `cost` (floor 2 SP; a floored smash is not also charged 1 MP), `stk`. `poise` is NOT offered on a smash: its Poise is derived from the hit (+50% stance bonus and `smashPoiseBase` 3), so a printed Poise step would be a no-op; `hits` is not offered (needs printed damage 8 or less; smashes start near 12) | `addStatus`, `range`, `targeting` (single to area, x0.75), `maneuver` (smash to attack), `element`, `dmgType`, `fx:block`, `fx:draw`, `fx:target`, `fx:boost` (STR), `fx:reaction`, `fx:cycle`, `fx:cull`, `fx:copy`, `fx:shuffle`, `fx:retain`, `fx:innate`, `fx:holdOne` |
| Defend / Block (`maneuver:defend`, has Block, already `trait:reaction`) | `fx:unexhaust`, `fx:unethereal`, `fx:steady`, signed `stk` | `blk` (printed Block only), `cost`, `stk` on a Ward/Barrier/Poise status that is a plain numeric `applyStatus` | `fx:draw`, `fx:cycle`, `fx:cull`, `fx:copy`, `fx:shuffle`, `fx:retain`, `fx:innate`, `fx:holdOne`, `fx:boost` (DEX for a non-spell, WIS for a spell with Block or Ward). Not offered: `fx:block` (already has Block), `fx:reaction` (defend or counter excluded), every damage kind |
| Evade (a `maneuver:defend` card with no printed Block; its Evade stacks come from a metric formula, not a plain number) | same | `cost` only (`stk` and `blk` need a plain number or printed Block) | `fx:block` (it has no Block, so it is offered; a real new effect), `fx:draw`, `fx:cycle`, `fx:cull`, `fx:copy`, `fx:shuffle`, `fx:retain`, `fx:innate`, `fx:holdOne`; no boost (needs Block or damage) |
| Power (change) | `fx:unethereal`, signed `stk`, and `cost` | `cost` | none offered today; keep it so (a power's new-effect share goes to ease and `cost`). The pool runs out after the drawback is eased and `cost` is taken, as today |
| Ranked ability card (`gradeProfiles`) | `fx:unexhaust`, `fx:unethereal`, `fx:steady` | none | none (unchanged) |
| Status, curse, consumable | none | none | none (unchanged) |

The Power row is the only change to who can be offered what: powers become eligible for the ease group (and the signed `stk`), which they cannot roll today. Exhaust never applies to a Power, so `fx:unexhaust` is not eligible there.

## 7. No existing ease kind

Self debuff (SD), enemy buff (EB), forced discard (DS) and added Wound/Dazed (ST) have no existing upgrade kind that lowers them. 30 of the 74 cards with a drawback carry one (Core 10, Legacy 20). Smallest options:

- (a) Generalise an existing number step. The `stk` step already adds `n` stacks to a plain `applyStatus` (`cardUpgrade.js` `case 'stk'`; the option generator in `cardUpgradeSteps.js` only offers positive `n` on the first status). Let it also target the drawback effect with a negative `n`: self debuff stacks -1, enemy buff stacks -1, and the same signed step on `discard.amount` and `addCard.count`. When the number reaches 0 the effect is dropped. No new kind id, no new weight, `FX_KINDS` and `UPGRADE_OPTION_KINDS` unchanged; it sits in the ease group with the weight of `fx:steady` (12). Needs: generator branch (find a drawback effect), apply branch (negative n, drop at 0), face-text rewrite (`DRAWBACK_TEXT` style) and tests.
- (b) A new kind (such as `fx:soften`): a new `WEIGHTS` entry, `FX_KINDS` id, apply case, text pattern, UI label and `DrawbackSteps` entry, doing the same job as (a) under a new name.

Recommend (a): it reuses `stk`'s existing apply path, adds no id to the player-visible menu, and keeps the saved step format (`{k:'stk', ...}`) valid. Cards with a one-stack drawback ease to nothing in one step, so the signed step removes the drawback outright, which also covers "remove the Wound add" with no extra kind. The two-notch swap ("Wound to Dazed") from the earlier draft is dropped.

## 8. Maneuver transitions (the `maneuver` identity kind)

Today `maneuver` only swaps between Attack and Smash (`ATTACK_MANEUVERS` in `cardUpgradeSteps.js` is the `maneuver:` family filtered to `attack` and `smash`). The step writes the new `maneuver:` tag (a `tag` step), and the SP/MP cost re-derives from the tag (maneuver floors in `MANEUVER_SP_FLOORS`: smash and sweep 2 SP).

| From to | Rollable today? | Gate | What it does to damage and cost |
|---|---|---|---|
| Attack to Smash | Yes | non-spell, hits an enemy, card already pays 2 SP or more (`sp >= 2`), not already changed by a maneuver step | Smash at 2 SP or more scales damage and Poise (x1.8 at 2 SP, `twoCostMultiplier`), adds `smashPoiseBase` 3 Poise, +50% Poise stance bonus; cost floor 2 SP (a floored smash is not also charged 1 MP) |
| Smash to Attack | Yes | same | Loses the Poise add and bonus; the cost floor lifts and the cost re-derives |
| Attack or Smash to Sweep | No | `sweep` is not in `ATTACK_MANEUVERS` | Sweep keeps its damage unscaled (`SWEEP_UNSCALED_OPS`), 2 SP floor, area targeting; a sweep's stance damage factor is 0.75 (`sweepMultiplier` in `combatExpansionMatchups.json`; the owner's "0.7" is the same idea, I did not find a 0.7). Reach it with the `targeting` kind (single to area, damage x0.75), which does not change the `maneuver:` tag |
| Sweep to anything | No | `targeting` and `maneuver` are both gated off `maneuver:sweep` | A sweep card cannot roll either; it is stuck as a sweep |
| to Defend (Block) | No | no gate offers it | Would change the card's job (damage to Block). Do not add: an upgrade should not turn an attack into a defence card |
| to Counter | No | `maneuver:counter` cards use a fixed return payload (`counterReturn`), which also blocks `dmg`, `hits`, `poise`, `range`, `targeting` | Do not add, same reason |
| to Evade | n/a | Evade is not a maneuver: Evade cards carry `maneuver:defend` and an Evade status | Not a transition |
| to Casting | No | `casting` is the spell stance and needs MP and a school | Do not add |

Owner ruling (2026-11-19): Attack/Smash to Sweep is not approved; the `maneuver` kind stays Attack and Smash only.

## 9. Identity-change options

Identity kinds reshape what a card is without changing its numbers. Proposal: they are one share inside "new effect", placed from upgrade 1 at low odds (5%) and rising to 20% late (weighting table in section 6). Inside the share each kind rolls by its weight. Gates are in `addTagOptions` (`cardUpgradeSteps.js`). "attacking" means the card hits an enemy and is attack, smash, sweep, ranged or counter maneuver, or a spell.

| Kind | Current weight | What it changes today | Who can roll it (gates) | Group and proposed weight |
|---|---|---|---|---|
| `range` | 6 | `range:` tag. Melee to Reach and Reach to Melee, nothing else | attacking, not a counter; at most 2 range steps; Reach is dropped if the run's `maxRange` cap is lower | identity, weight 3 (halved): see below |
| `targeting` | 6 | Single to Area (damage x0.75, hits all) or Area to Single (damage x1.25) | hits an enemy, not `maneuver:sweep`, not counter, one retarget per card; Area to Single only if the grown total stays inside the +100% guard | identity, 6 |
| `maneuver` | 5 | Attack and Smash swap (section 8) | non-spell, hits an enemy, maneuver is attack or smash, a smash needs 2 SP, once | identity, 5 |
| `school` | 4 | Nothing: `addTagOptions` never sets `found.school` ("a school change alone changes no play"). The weight is dead | never offered | Left as is (owner, 2026-11-19: not fixing it); do not count it |
| `element` | 6 | Reworked (owner, 2026-11-19): ADDS an element packet to the existing damage instead of replacing it; see "Element packet" below | any card that deals damage (not a counter's fixed return) | effectiveness / cost group (it is a damage step), weight 12 |
| `rankDown` | 3 | Becomes a cantrip (`rank.cantrip`): the Mana price goes to 0 | not a Basic or cantrip, SP not 0, Mana above 0, the multi-hit SP floor still fits | effectiveness / cost group (it is a cost cut), 3 |
| `dmgType` (new) | none | see below | see below | identity, 5 |

Range: it covers melee to Reach and Reach to melee only. There is no Reach to Ranged entry in the map (`{ melee: 'reach', reach: 'melee' }`) and a card that is already Ranged has no next range, so Reach to Ranged is not offered today. A Reach hit is priced at the distance it covers, so it skips the implicit Advance SP (`advanceSpPerBand` 1 SP per missing band in `rangeActionPlan`, `src/model/combatEngagement.js`) and gains `reachPrecisionBonus` +1 Precision (`RANGE_POLICY_DEFAULTS`). It also keeps hitting from the back row after a Retreat without paying to Advance. That is a strong effect, so flag it: halve the weight to 3, and keep the two-range-step cap and the `maxRange` cap.

### New kind: `dmgType` (physical damage type)

Today no kind changes the physical type (slashing, piercing, blunt). The type feeds the Pierce bypass (`actions.js`, a piercing hit lets part of the damage past Block; the piercing rider in `combatMatchups.js`), the enemy weakness, resist and immune lookups (`enemyWeaknessRules.js`, `WEAKNESS_PHYSICAL`), and physical routing in `physicalTypeOf` (`combatRatings.js`). I found no read of the damage type by Stone Skin (the status only keeps Block), so that part of the brief is unconfirmed.

- What it does: sets the hit's physical type to one of the other two of slashing, piercing, blunt (the roll picks one at random from the two). The three types carry the same cost weight (2 SP each in `COST_TAGS`), so the derived cost does not move.
- Weight: 5, in the identity group.
- Gates: the card hits an enemy; not a counter; not a spell or elemental hit (camp physical, `damageSchool` physical, no element step applied); melee range only (the range tag is melee, so a card that rolled Reach is out, and a Reach card cannot be changed); maneuver is attack, smash or sweep; not already changed by a dmgType step. Cards that take their type from the wielded weapon (`attack.weaponDamage`): the step replaces it with the fixed type, as `element` does, so the card no longer follows the weapon. Allowed (owner, 2026-11-19): a weapon card may change type away from its weapon's.
- Face text: the card text does not name a physical type, so no sentence is needed; the face shows it through the damage-type tag chip and tooltip (`weaknessIcons.js` already has the icons). Add the three type names and a one-line tooltip each to the strings.
- Files: `src/model/cardUpgradeSteps.js` (a `WEIGHTS` entry `dmgType`, the gate and option in `addTagOptions`, a `stepOf` case; `UPGRADE_OPTION_KINDS` and `upgradeMenu` validation in `validate/entityCross.js` follow the `WEIGHTS` keys); apply path: reuse the existing `tag` step branch for `step.damage` in `src/model/cardUpgrade.js`, which already drops other `damage:` tags and rewrites `attack.damageType` and component types; save format: `{ k: 'tag', damage: 'piercing' }`, a `tag` step with no `tag` field, so no new step kind in `UPGRADE_STEP_KINDS` and no save migration, but check that the step validator accepts a `tag` step with no `tag`; UI label: the change line in `src/ui/models/CardUpgradeModel.js` and its string key, plus the option name in the upgrade picker; tests: the `core-card-upgrade-*` tests and a new test that a dmgType step changes the type the engine reads.

### Element packet (the reworked `element` kind)

A Strike plus Fire stays an Attack (same maneuver, camp and cost rules), keeps its physical damage and gains a second packet of fire magic damage on the same hit. Owner rulings of 2026-11-19: Attack/Smash to Sweep is not approved; the `school` kind is left as is.

- Size: a flat amount by rarity, not a split of the hit: common 75% of the common `dmg` step (min 2), uncommon x2 (min 3), rare x4 (min 6); e.g. Smash 12: +2, +3, +6; Spell 24: +3, +6, +12. It counts against the "+100% of printed total" guard together with `dmg` steps, and shows as its own number.
- How it is stored: the card's one `damage` effect rises by the packet and gets `damageComponents` weighted by amounts (e.g. physical 6, fire 2). `componentPartsOf` in `combatRatings.js` already turns weights into a magic share (here 25%), so no new damage path is needed. Later `dmg` steps scale both parts in proportion.
- Channel: the physical part keeps its STR and AR channel; the magic part uses INT and the Power rating (a spell's Power is magic, a weapon's Attack is physical: the contact comment in `actions.js`), so Arcane Trader INT boosts raise it.
- Routing: the magic part goes to Barrier, then Ward (the Ward ruling); the physical part goes to Block, then Poise. The fire part also takes the element's weakness, resist and exposure build-up (`exposureBuildupPerHit`), as the old element step did.
- "Magic trait" means: a `damage:<element>` tag, the school tag and the magic share. It does NOT make the card a spell: `camp` stays physical, so the spell-stance bonus (Prepared +25% spell damage) and spell tags do not apply. Cost re-derives through the formula (magic damage steps price on MP); the existing rule that an upgrade must not raise the card's cost applies, so the packet is clamped to the largest size that keeps the cost, or the option is not offered.
- Existing elemental cards: the option does not add a second element; it raises that element's packet by the same sizes (or its element status through `stk`). A card holds one added element.
- Face text: a second sentence "Deal {fire} Fire damage." with the element icon beside the physical line; `cardFaceBudget.js` limits the lines.
- Gates: any card that deals enemy damage, except a counter's fixed return payload.


## 10. Upgrade rarity

Every upgrade option carries a rarity from the existing card ladder: common, uncommon, rare. A 4th tier is not needed: a rare step is already x3 to x4 and meets the existing "+100% of the printed total" guard on damage and Block (`biggest()` in `cardUpgradeSteps.js` returns the largest step that fits), so a bigger tier would only be clipped. Add one only if rare turns out too common late (50% at upgrades 8 to 10).

### How it combines with the group weighting

Roll the group (section 6 table: ease / effectiveness-cost / new effect / identity, by upgrade number), then the rarity (below, by upgrade number, over the rarities that group has options for, renormalised), then pick a kind in that group and rarity by the existing `WEIGHTS`. The existing amount scaler `limits.scale` (the rank-up bonus already uses 2) is the hook for sizes: common scale 1, uncommon 2, rare 4, with each kind's own cap kept. Stored steps already hold their size (`{k:'dmg', n}`), so the save format needs no change; an optional `r` field can store the rarity for the picker colour.

| Upgrade # | common | uncommon | rare |
|---|---|---|---|
| 1 to 3 | 70% | 25% | 5% |
| 4 to 5 | 45% | 40% | 15% |
| 6 to 7 | 25% | 45% | 30% |
| 8 to 10 | 10% | 40% | 50% |

### Step sizes by rarity (derived from today's steps)

Common is today's step. Uncommon is x2, the shipped `rankUpBonusScale`. Rare is x3 to x4, set by the card budget curve (`card-budget-2026-11-18.md`: a 1 SP Defend gives 10 Block, a Strike 6 damage, a 2 SP Smash 12).

| Kind | Common (today) | Uncommon | Rare | Rare multiplier and basis |
|---|---|---|---|---|
| `dmg` | +max(2, 15% of printed total) | x2 | x4 | x4; capped at printed +100% in all steps. Strike 6: +2, +4, +6 (cap). Smash 12: +2, +4, +8. Spell 24: +4, +8, +16 |
| `blk` | +max(2, 20%) | x2 | x4 | x4; same cap. Defend 10: +2, +4, +8 |
| `poise` | +max(1, 20%) | x2 | x4 | x4 |
| `stk` | +1 stack | +2 | +3, up to the status cap | x3; caps: Burn, Weak, Vulnerable, Frail 3, Bleed 4 |
| `cost` | -1 in one pool | -1 SP and -1 MP (combo) | -2 in one pool | x2; floors (SP 1, MP 1) limit it |
| `hits` | 2 hits | none | 3 hits | existing 2 or 3 hit roll, split by rarity |
| `addStatus` | 1 stack | 2 | 3 (capped) | x3 |
| `fx:block` | +4 (6 at 2 SP) | +8 (12) | +12 (18) | x3: about one Defend of Block |
| `fx:draw` | +1 | none | +2 | x2 (total draw stays at 3 or less) |
| `fx:cycle` | 1 | none | 2 | x2 |
| `fx:boost` | +2 this turn | +1 for the fight | +2 for the fight | NEW size |
| `fx:target` | none | +1 target at 50% | +1 target at 75% | NEW size |
| ease | ease one notch | remove it, plus draw 1 (combo) | remove it, plus a rare-size step (combo) | enhanced ease uses existing combo steps |
| identity kinds, `fx:cull/copy/shuffle/retain/innate/holdOne/reaction/counter`, `attr`, `rankDown` | one size | | | rarity is a placement only (see the tables) |

### Potential upgrades by card type (ordered by rarity)

Chance at upgrade 1 = P(group) x P(rarity within that group) x kind weight over the weights of the same group and rarity, for a card with a drawback (group shares ease 40%, effectiveness/cost 35%, new effect 20%, identity 5%; rarity 70/25/5). A drawback-free card has no ease rows: that 40% moves to the other groups pro rata. Where a group has no row at a rarity, the rarity odds are renormalised over the ones it has. Kinds the gates remove for that type are not in its table.

Ease kinds (the "ease" rows): remove Exhaust `fx:unexhaust`, remove Ethereal `fx:unethereal`, stop a rising cost `fx:steady`, cost -1 on an Expensive card `cost`, and -1 on a self debuff / enemy buff / discard / Wound-Dazed count (signed `stk`, recommended in section 7). Exactly one of them matches a card's drawback.

#### Attack

| rarity | upgrade | group | chance at upgrade 1 | notes / gates |
|---|---|---|---|---|
| common | Ease the drawback one notch (the one matching kind, see ease kinds above) | ease | 28.0% | chance is for a card that has the drawback; with none, this share goes to effectiveness / cost |
| common | +2 damage (15% of printed, min 2; e.g. Strike 6, Spell 24 +4) | effectiveness / cost | 8.3% |  |
| common | +1 stack on the card's own status | effectiveness / cost | 5.5% | first plain numeric `applyStatus` only; none on a Power or an Evade (formula stacks) |
| common | +1 Poise damage (20% of printed, min 1) | effectiveness / cost | 3.3% | not on a smash (Poise derived from the hit) |
| common | Add an element packet: +2 (min) damage of Magic, Arcane, Holy or Fire as a second packet | effectiveness / cost | 3.3% | any damaging card; an elemental card raises its own element packet instead; not a counter |
| common | Cost -1 in one pool (SP min 1, MP min 1) | effectiveness / cost | 2.8% | once per card; Basic cards have no MP cut |
| common | +1 hit: 2 hits of 60% damage each | effectiveness / cost | 1.4% | printed damage 8 or less, single target |
| common | +4 Block (6 at 2 SP or more) | new effect | 3.7% | only a card with no Block; not a counter |
| common | Add 1 stack of Bleed/Weak (physical) or Burn/Vulnerable (spell) on the enemy | new effect | 1.6% | only a card with damage and no status yet |
| common | +2 Strength (Dexterity for a Block card, INT/WIS for a spell) this turn | new effect | 1.6% | `fx:boost` |
| common | Physical damage type: slashing, piercing or blunt (`dmgType`, NEW) | identity | 3.5% | melee, non-spell, non-elemental, once |
| uncommon | Remove the drawback outright, and draw 1 (combo of an ease step and `fx:draw`) | ease | 10.0% | combo steps already exist (20% rest-site rule) |
| uncommon | +4 damage (x2, the existing `rankUpBonusScale`) | effectiveness / cost | 3.5% |  |
| uncommon | +2 stacks on the card's own status | effectiveness / cost | 2.4% | first plain numeric `applyStatus` only; none on a Power or an Evade (formula stacks) |
| uncommon | +2 Poise damage (x2) | effectiveness / cost | 1.4% | not on a smash (Poise derived from the hit) |
| uncommon | Element packet x2 (75% of an uncommon `dmg` step, min 3) | effectiveness / cost | 1.4% | same |
| uncommon | +8 Block (12) | new effect | 1.3% | only a card with no Block; not a counter |
| uncommon | Add 2 stacks of that status | new effect | 0.6% | only a card with damage and no status yet |
| uncommon | +1 stat for the rest of the fight (stacks per play) | new effect | 0.6% | `fx:boost` |
| uncommon | Targeting: single to area (x0.75) or area to single (x1.25) | identity | 0.7% | not a sweep, not a counter |
| rare | Remove the drawback and take a rare-size step: cost -2, or +4x damage / Block (combo) | ease | 2.0% |  |
| rare | +8 damage (x4; at most printed total +100% in all steps) | effectiveness / cost | 0.6% |  |

Shared utility rows (draw, cycle, cull, copy, shuffle, retain, innate, hold one) add 9.0% in total for this type (see the shared table). 13 low-chance rows omitted.

#### Counter (return payload)

| rarity | upgrade | group | chance at upgrade 1 | notes / gates |
|---|---|---|---|---|
| common | Ease the drawback one notch (the one matching kind, see ease kinds above) | ease | 29.5% | chance is for a card that has the drawback; with none, this share goes to effectiveness / cost |
| common | +2 Block (20% of printed, min 2) | effectiveness / cost | 11.7% | printed Block only |
| common | +1 stack on the card's own status | effectiveness / cost | 9.4% | first plain numeric `applyStatus` only; none on a Power or an Evade (formula stacks) |
| common | Cost -1 in one pool (SP min 1, MP min 1) | effectiveness / cost | 4.7% | once per card; Basic cards have no MP cut |
| common | +2 Strength (Dexterity for a Block card, INT/WIS for a spell) this turn | new effect | 2.3% | `fx:boost` |
| common | +1 Counter stack a play (cap 3 per card) | new effect | 2.3% | `fx:counter`, counter cards only |
| uncommon | Remove the drawback outright, and draw 1 (combo of an ease step and `fx:draw`) | ease | 10.5% | combo steps already exist (20% rest-site rule) |
| uncommon | +4 Block (x2) | effectiveness / cost | 5.1% | printed Block only |
| uncommon | +2 stacks on the card's own status | effectiveness / cost | 4.1% | first plain numeric `applyStatus` only; none on a Power or an Evade (formula stacks) |
| uncommon | +1 stat for the rest of the fight (stacks per play) | new effect | 1.5% | `fx:boost` |
| rare | Remove the drawback and take a rare-size step: cost -2, or +4x damage / Block (combo) | ease | 2.1% |  |
| rare | +8 Block (x4; at most printed +100% total) | effectiveness / cost | 0.8% | printed Block only |
| rare | +3 stacks on the card's own status (up to the status cap: Burn, Weak, Vulnerable, Frail 3; Bleed 4) | effectiveness / cost | 0.7% | first plain numeric `applyStatus` only; none on a Power or an Evade (formula stacks) |
| rare | Cost -2 in one pool | effectiveness / cost | 0.3% | needs a cost of 3 or more in that pool |
| rare | +2 stat for the rest of the fight (NEW size) | new effect | 0.3% | NEW value of `fx:boost` |

Shared utility rows (draw, cycle, cull, copy, shuffle, retain, innate, hold one) add 14.7% in total for this type (see the shared table).

#### Sweep

| rarity | upgrade | group | chance at upgrade 1 | notes / gates |
|---|---|---|---|---|
| common | Ease the drawback one notch (the one matching kind, see ease kinds above) | ease | 28.0% | chance is for a card that has the drawback; with none, this share goes to effectiveness / cost |
| common | +2 damage (15% of printed, min 2; e.g. Strike 6, Spell 24 +4) | effectiveness / cost | 8.8% | ; approved gate lift: `dmg` offered on `allEnemies` |
| common | +1 stack on the card's own status | effectiveness / cost | 5.8% | first plain numeric `applyStatus` only; none on a Power or an Evade (formula stacks) |
| common | +1 Poise damage (20% of printed, min 1) | effectiveness / cost | 3.5% | not on a smash (Poise derived from the hit) |
| common | Add an element packet: +2 (min) damage of Magic, Arcane, Holy or Fire as a second packet | effectiveness / cost | 3.5% | any damaging card; an elemental card raises its own element packet instead; not a counter |
| common | Cost -1 in one pool (SP min 1, MP min 1) | effectiveness / cost | 2.9% | once per card; Basic cards have no MP cut |
| common | +4 Block (6 at 2 SP or more) | new effect | 3.7% | only a card with no Block; not a counter |
| common | Add 1 stack of Bleed/Weak (physical) or Burn/Vulnerable (spell) on the enemy | new effect | 1.6% | only a card with damage and no status yet |
| common | +2 Strength (Dexterity for a Block card, INT/WIS for a spell) this turn | new effect | 1.6% | `fx:boost` |
| common | Physical damage type: slashing, piercing or blunt (`dmgType`, NEW) | identity | 4.7% | melee, non-spell, non-elemental, once |
| uncommon | Remove the drawback outright, and draw 1 (combo of an ease step and `fx:draw`) | ease | 10.0% | combo steps already exist (20% rest-site rule) |
| uncommon | +4 damage (x2, the existing `rankUpBonusScale`) | effectiveness / cost | 3.5% | ; approved gate lift: `dmg` offered on `allEnemies` |
| uncommon | +2 stacks on the card's own status | effectiveness / cost | 2.4% | first plain numeric `applyStatus` only; none on a Power or an Evade (formula stacks) |
| uncommon | +2 Poise damage (x2) | effectiveness / cost | 1.4% | not on a smash (Poise derived from the hit) |
| uncommon | Element packet x2 (75% of an uncommon `dmg` step, min 3) | effectiveness / cost | 1.4% | same |
| uncommon | +8 Block (12) | new effect | 1.4% | only a card with no Block; not a counter |
| uncommon | Add 2 stacks of that status | new effect | 0.6% | only a card with damage and no status yet |
| uncommon | +1 stat for the rest of the fight (stacks per play) | new effect | 0.6% | `fx:boost` |
| uncommon | Gain the Reaction trait | new effect | 0.6% | not a Defend, Counter or Evade |
| rare | Remove the drawback and take a rare-size step: cost -2, or +4x damage / Block (combo) | ease | 2.0% |  |
| rare | +8 damage (x4; at most printed total +100% in all steps) | effectiveness / cost | 0.6% | ; approved gate lift: `dmg` offered on `allEnemies` |
| rare | +3 stacks on the card's own status (up to the status cap: Burn, Weak, Vulnerable, Frail 3; Bleed 4) | effectiveness / cost | 0.4% | first plain numeric `applyStatus` only; none on a Power or an Evade (formula stacks) |

Shared utility rows (draw, cycle, cull, copy, shuffle, retain, innate, hold one) add 9.2% in total for this type (see the shared table). 7 low-chance rows omitted.

#### Smash

| rarity | upgrade | group | chance at upgrade 1 | notes / gates |
|---|---|---|---|---|
| common | Ease the drawback one notch (the one matching kind, see ease kinds above) | ease | 28.0% | chance is for a card that has the drawback; with none, this share goes to effectiveness / cost |
| common | +2 damage (15% of printed, min 2; e.g. Strike 6, Spell 24 +4) | effectiveness / cost | 10.2% |  |
| common | +1 stack on the card's own status | effectiveness / cost | 6.8% | first plain numeric `applyStatus` only; none on a Power or an Evade (formula stacks) |
| common | Add an element packet: +2 (min) damage of Magic, Arcane, Holy or Fire as a second packet | effectiveness / cost | 4.1% | any damaging card; an elemental card raises its own element packet instead; not a counter |
| common | Cost -1 in one pool (SP min 1, MP min 1) | effectiveness / cost | 3.4% | once per card; Basic cards have no MP cut |
| common | +4 Block (6 at 2 SP or more) | new effect | 3.7% | only a card with no Block; not a counter |
| common | Add 1 stack of Bleed/Weak (physical) or Burn/Vulnerable (spell) on the enemy | new effect | 1.6% | only a card with damage and no status yet |
| common | +2 Strength (Dexterity for a Block card, INT/WIS for a spell) this turn | new effect | 1.6% | `fx:boost` |
| common | Physical damage type: slashing, piercing or blunt (`dmgType`, NEW) | identity | 3.5% | melee, non-spell, non-elemental, once |
| uncommon | Remove the drawback outright, and draw 1 (combo of an ease step and `fx:draw`) | ease | 10.0% | combo steps already exist (20% rest-site rule) |
| uncommon | +4 damage (x2, the existing `rankUpBonusScale`) | effectiveness / cost | 4.2% |  |
| uncommon | +2 stacks on the card's own status | effectiveness / cost | 2.8% | first plain numeric `applyStatus` only; none on a Power or an Evade (formula stacks) |
| uncommon | Element packet x2 (75% of an uncommon `dmg` step, min 3) | effectiveness / cost | 1.7% | same |
| uncommon | +8 Block (12) | new effect | 1.3% | only a card with no Block; not a counter |
| uncommon | Add 2 stacks of that status | new effect | 0.6% | only a card with damage and no status yet |
| uncommon | +1 stat for the rest of the fight (stacks per play) | new effect | 0.6% | `fx:boost` |
| uncommon | Gain the Reaction trait | new effect | 0.6% | not a Defend, Counter or Evade |
| uncommon | Hit +1 other target at half damage | new effect | 0.5% | `fx:target`; attack classification, enemy-target hit |
| uncommon | Targeting: single to area (x0.75) or area to single (x1.25) | identity | 0.7% | not a sweep, not a counter |
| uncommon | Stance: Attack to Smash or Smash to Attack | identity | 0.6% | smash needs 2 SP |
| rare | Remove the drawback and take a rare-size step: cost -2, or +4x damage / Block (combo) | ease | 2.0% |  |
| rare | +8 damage (x4; at most printed total +100% in all steps) | effectiveness / cost | 0.7% |  |

Shared utility rows (draw, cycle, cull, copy, shuffle, retain, innate, hold one) add 9.0% in total for this type (see the shared table). 8 low-chance rows omitted.

#### Block (Defend)

| rarity | upgrade | group | chance at upgrade 1 | notes / gates |
|---|---|---|---|---|
| common | Ease the drawback one notch (the one matching kind, see ease kinds above) | ease | 29.5% | chance is for a card that has the drawback; with none, this share goes to effectiveness / cost |
| common | +2 Block (20% of printed, min 2) | effectiveness / cost | 11.7% | printed Block only |
| common | +1 stack on the card's own status | effectiveness / cost | 9.4% | first plain numeric `applyStatus` only; none on a Power or an Evade (formula stacks) |
| common | Cost -1 in one pool (SP min 1, MP min 1) | effectiveness / cost | 4.7% | once per card; Basic cards have no MP cut |
| common | +2 Strength (Dexterity for a Block card, INT/WIS for a spell) this turn | new effect | 2.7% | `fx:boost` |
| uncommon | Remove the drawback outright, and draw 1 (combo of an ease step and `fx:draw`) | ease | 10.5% | combo steps already exist (20% rest-site rule) |
| uncommon | +4 Block (x2) | effectiveness / cost | 5.1% | printed Block only |
| uncommon | +2 stacks on the card's own status | effectiveness / cost | 4.1% | first plain numeric `applyStatus` only; none on a Power or an Evade (formula stacks) |
| uncommon | +1 stat for the rest of the fight (stacks per play) | new effect | 1.5% | `fx:boost` |
| rare | Remove the drawback and take a rare-size step: cost -2, or +4x damage / Block (combo) | ease | 2.1% |  |
| rare | +8 Block (x4; at most printed +100% total) | effectiveness / cost | 0.8% | printed Block only |
| rare | +3 stacks on the card's own status (up to the status cap: Burn, Weak, Vulnerable, Frail 3; Bleed 4) | effectiveness / cost | 0.7% | first plain numeric `applyStatus` only; none on a Power or an Evade (formula stacks) |
| rare | Cost -2 in one pool | effectiveness / cost | 0.3% | needs a cost of 3 or more in that pool |
| rare | +2 stat for the rest of the fight (NEW size) | new effect | 0.3% | NEW value of `fx:boost` |

Shared utility rows (draw, cycle, cull, copy, shuffle, retain, innate, hold one) add 16.6% in total for this type (see the shared table).

#### Evade-type Defend

| rarity | upgrade | group | chance at upgrade 1 | notes / gates |
|---|---|---|---|---|
| common | Ease the drawback one notch (the one matching kind, see ease kinds above) | ease | 29.5% | chance is for a card that has the drawback; with none, this share goes to effectiveness / cost |
| common | Cost -1 in one pool (SP min 1, MP min 1) | effectiveness / cost | 34.4% | once per card; Basic cards have no MP cut |
| common | +4 Block (6 at 2 SP or more) | new effect | 5.0% | only a card with no Block; not a counter |
| uncommon | Remove the drawback outright, and draw 1 (combo of an ease step and `fx:draw`) | ease | 10.5% | combo steps already exist (20% rest-site rule) |
| uncommon | +8 Block (12) | new effect | 2.4% | only a card with no Block; not a counter |
| rare | Remove the drawback and take a rare-size step: cost -2, or +4x damage / Block (combo) | ease | 2.1% |  |
| rare | Cost -2 in one pool | effectiveness / cost | 2.5% | needs a cost of 3 or more in that pool |
| rare | +12 Block (18; x3) | new effect | 0.5% | only a card with no Block; not a counter |

Shared utility rows (draw, cycle, cull, copy, shuffle, retain, innate, hold one) add 13.1% in total for this type (see the shared table).

#### Skill (non-spell buff)

| rarity | upgrade | group | chance at upgrade 1 | notes / gates |
|---|---|---|---|---|
| common | Ease the drawback one notch (the one matching kind, see ease kinds above) | ease | 29.5% | chance is for a card that has the drawback; with none, this share goes to effectiveness / cost |
| common | +2 Block (20% of printed, min 2) | effectiveness / cost | 11.7% | printed Block only |
| common | +1 stack on the card's own status | effectiveness / cost | 9.4% | first plain numeric `applyStatus` only; none on a Power or an Evade (formula stacks) |
| common | Cost -1 in one pool (SP min 1, MP min 1) | effectiveness / cost | 4.7% | once per card; Basic cards have no MP cut |
| common | +4 Block (6 at 2 SP or more) | new effect | 5.0% | only a card with no Block; not a counter |
| uncommon | Remove the drawback outright, and draw 1 (combo of an ease step and `fx:draw`) | ease | 10.5% | combo steps already exist (20% rest-site rule) |
| uncommon | +4 Block (x2) | effectiveness / cost | 4.2% | printed Block only |
| uncommon | +2 stacks on the card's own status | effectiveness / cost | 3.3% | first plain numeric `applyStatus` only; none on a Power or an Evade (formula stacks) |
| uncommon | Cost -1 SP and -1 MP (combo of two `cost` steps) | effectiveness / cost | 1.7% | two-pool cards only |
| uncommon | +8 Block (12) | new effect | 2.0% | only a card with no Block; not a counter |
| uncommon | Gain the Reaction trait | new effect | 0.9% | not a Defend, Counter or Evade |
| rare | Remove the drawback and take a rare-size step: cost -2, or +4x damage / Block (combo) | ease | 2.1% |  |
| rare | +8 Block (x4; at most printed +100% total) | effectiveness / cost | 0.8% | printed Block only |
| rare | +3 stacks on the card's own status (up to the status cap: Burn, Weak, Vulnerable, Frail 3; Bleed 4) | effectiveness / cost | 0.7% | first plain numeric `applyStatus` only; none on a Power or an Evade (formula stacks) |
| rare | Cost -2 in one pool | effectiveness / cost | 0.3% | needs a cost of 3 or more in that pool |
| rare | +12 Block (18; x3) | new effect | 0.5% | only a card with no Block; not a counter |

Shared utility rows (draw, cycle, cull, copy, shuffle, retain, innate, hold one) add 12.7% in total for this type (see the shared table).

#### Spell

| rarity | upgrade | group | chance at upgrade 1 | notes / gates |
|---|---|---|---|---|
| common | Ease the drawback one notch (the one matching kind, see ease kinds above) | ease | 28.0% | chance is for a card that has the drawback; with none, this share goes to effectiveness / cost |
| common | +2 damage (15% of printed, min 2; e.g. Strike 6, Spell 24 +4) | effectiveness / cost | 6.7% |  |
| common | +2 Block (20% of printed, min 2) | effectiveness / cost | 5.6% | printed Block only |
| common | +1 stack on the card's own status | effectiveness / cost | 4.5% | first plain numeric `applyStatus` only; none on a Power or an Evade (formula stacks) |
| common | +1 Poise damage (20% of printed, min 1) | effectiveness / cost | 2.7% | not on a smash (Poise derived from the hit) |
| common | Add an element packet: +2 (min) damage of Magic, Arcane, Holy or Fire as a second packet | effectiveness / cost | 2.7% | any damaging card; an elemental card raises its own element packet instead; not a counter |
| common | Cost -1 in one pool (SP min 1, MP min 1) | effectiveness / cost | 2.2% | once per card; Basic cards have no MP cut |
| common | +4 Block (6 at 2 SP or more) | new effect | 3.7% | only a card with no Block; not a counter |
| common | Add 1 stack of Bleed/Weak (physical) or Burn/Vulnerable (spell) on the enemy | new effect | 1.6% | only a card with damage and no status yet |
| common | +2 Strength (Dexterity for a Block card, INT/WIS for a spell) this turn | new effect | 1.6% | `fx:boost` |
| uncommon | Remove the drawback outright, and draw 1 (combo of an ease step and `fx:draw`) | ease | 10.0% | combo steps already exist (20% rest-site rule) |
| uncommon | +4 damage (x2, the existing `rankUpBonusScale`) | effectiveness / cost | 2.3% |  |
| uncommon | +4 Block (x2) | effectiveness / cost | 2.0% | printed Block only |
| uncommon | +2 stacks on the card's own status | effectiveness / cost | 1.6% | first plain numeric `applyStatus` only; none on a Power or an Evade (formula stacks) |
| uncommon | +2 Poise damage (x2) | effectiveness / cost | 0.9% | not on a smash (Poise derived from the hit) |
| uncommon | Element packet x2 (75% of an uncommon `dmg` step, min 3) | effectiveness / cost | 0.9% | same |
| uncommon | Cost -1 SP and -1 MP (combo of two `cost` steps) | effectiveness / cost | 0.8% | two-pool cards only |
| uncommon | +8 Block (12) | new effect | 1.4% | only a card with no Block; not a counter |
| uncommon | Add 2 stacks of that status | new effect | 0.6% | only a card with damage and no status yet |
| uncommon | Targeting: single to area (x0.75) or area to single (x1.25) | identity | 4.2% | not a sweep, not a counter |
| rare | Remove the drawback and take a rare-size step: cost -2, or +4x damage / Block (combo) | ease | 2.0% |  |
| rare | Range: Melee to Reach or Reach to Melee | identity | 0.8% | strong: skips Advance SP; capped by `maxRange` |

Shared utility rows (draw, cycle, cull, copy, shuffle, retain, innate, hold one) add 9.1% in total for this type (see the shared table). 13 low-chance rows omitted.

#### Power

| rarity | upgrade | group | chance at upgrade 1 | notes / gates |
|---|---|---|---|---|
| common | Ease the drawback one notch (the one matching kind, see ease kinds above) | ease | 37.3% | chance is for a card that has the drawback; with none, this share goes to effectiveness / cost |
| common | Cost -1 in one pool (SP min 1, MP min 1) | effectiveness / cost | 43.6% | once per card; Basic cards have no MP cut |
| uncommon | Remove the drawback outright, and draw 1 (combo of an ease step and `fx:draw`) | ease | 13.3% | combo steps already exist (20% rest-site rule) |
| rare | Remove the drawback and take a rare-size step: cost -2, or +4x damage / Block (combo) | ease | 2.7% |  |
| rare | Cost -2 in one pool | effectiveness / cost | 3.1% | needs a cost of 3 or more in that pool |

Shared utility rows (draw, cycle, cull, copy, shuffle, retain, innate, hold one) add 0.0% in total for this type (see the shared table).

### Shared utility rows (chance at upgrade 1, per type)

These rows (the generic `fx` effects) are in every type's denominators but not repeated in its table. A dash means the type does not get the row. A Power gets none.

| rarity | upgrade | group | Attack | Counter | Sweep | Smash | Block | Evade-type | Skill | Spell |
|---|---|---|---|---|---|---|---|---|---|---|
| common | Draw +1 (`fx:draw`; total draw 3 at most) | new effect | 2.8% | 4.0% | 2.8% | 2.8% | 4.8% | 3.9% | 3.9% | 2.8% |
| common | Cycle 1: discard 1, draw 1 (`fx:cycle`) | new effect | 1.6% | 2.3% | 1.6% | 1.6% | 2.7% | 2.2% | 2.2% | 1.6% |
| common | Cull: Exhaust a card from hand, draw 2 (`fx:cull`) | new effect | 0.8% | 1.2% | 0.8% | 0.8% | 1.4% | 1.1% | 1.1% | 0.8% |
| common | Copy: add a copy of this card to the discard (`fx:copy`) | new effect | 1.0% | 1.4% | 1.0% | 1.0% | 1.7% | 1.4% | 1.4% | 1.0% |
| common | Shuffle the discard pile into the draw pile (`fx:shuffle`) | new effect | 0.8% | 1.2% | 0.8% | 0.8% | 1.4% | 1.1% | 1.1% | 0.8% |
| uncommon | Retain keyword (`fx:retain`) | new effect | 0.7% | 1.8% | 0.8% | 0.7% | 1.8% | 1.3% | 1.1% | 0.8% |
| uncommon | Innate keyword (`fx:innate`) | new effect | 0.4% | 0.9% | 0.4% | 0.4% | 0.9% | 0.7% | 0.6% | 0.4% |
| uncommon | Hold one: Retain one other card this turn (`fx:holdOne`) | new effect | 0.4% | 1.1% | 0.5% | 0.4% | 1.1% | 0.8% | 0.7% | 0.5% |
| rare | Draw +2 (NEW size) | new effect | 0.2% | 0.5% | 0.2% | 0.2% | 0.5% | 0.4% | 0.4% | 0.2% |
| rare | Cycle 2: discard 2, draw 2 (NEW size) | new effect | 0.1% | 0.3% | 0.1% | 0.1% | 0.3% | 0.2% | 0.2% | 0.1% |

Notes: Counter cards are `maneuver:counter` (fixed return payload), so damage, hits, Poise, range, targeting, element and `dmgType` are gated off. The Sweep `dmg` row needs the proposed gate lift. A Power can roll only the ease rows and `cost`; its ease "draw 1" combo needs a different sweetener (a `cost` step) because Powers take no draw option today.


## 11. Upgrade vendors

### Where upgrades come from today

| Source | Code | Options and odds today |
|---|---|---|
| Rest-site Smith | `RestUpgradeRule` in `cardUpgradeLimits.js` | upgrades 1 to 3: one option; 4th on: two options, each 20% two effects; one free tier per visit (`smith.free`) |
| Blacksmith card upgrade (`upgradeArt`) | `blacksmith.js`, `upgradeChoiceCount` | 2 or 3 options, seeded; free, or 1 Smithing Stone past the free allowance |
| Blacksmith rank-up bonus | `rankUpBonus.js` | 3 choices, `scale` 2, no authored step |
| Free upgrade effects | `freeCardUpgradeStep` / `applyFreeCardUpgrade` in `engine/actions.js` | one rolled option |
| Arcane Trader | none today | `arcane-trader-proposal-2026-11-18.md` sells relics, scrolls, magic armaments and armour, spell cards: no card service. A card upgrade there is a NEW service and needs approval |

All of these use the base tables of section 10 (and the section 6 group shares) unless they are at a vendor below. The rank-up bonus uses the base table one band later (its x2 scale already makes its steps bigger), so upgrade 1 to 3 rolls like 4 to 5.

### Category of every kind

P physical, M magic, N neutral. A kind can be P or M by card: `fx:boost` is P for a weapon card (STR, DEX) and M for a spell (INT, WIS); `addStatus` is P (Bleed, Weak) or M (Burn, Vulnerable); `blk` and `fx:block` are M on a spell, P otherwise.

| Category | Kinds |
|---|---|
| Physical | `dmg`, `hits`, `poise`, `blk`, `fx:block`, `dmgType`, `maneuver`, `range` (Reach), `fx:target`, `fx:counter`, `fx:boost` (STR/DEX), `addStatus` (physical), SP-side `cost` |
| Magic | `element` (add or raise a packet), `school` (dead today, stays), `attr`, `rankDown`, `fx:boost` (INT/WIS), `addStatus` (spell), MP-side `cost`, Ward/Barrier `stk` |
| Neutral | all ease rows, `stk` on a non-Ward status, `targeting`, `fx:draw`, `fx:cycle`, `fx:cull`, `fx:copy`, `fx:shuffle`, `fx:retain`, `fx:innate`, `fx:holdOne`, `fx:reaction` |

Physical tags the Blacksmith should also offer: Reach is `range`, Pierce is `dmgType` piercing; Force and Thorns have no upgrade kind today (NEW if wanted). Spell tags and a Ward-boost kind for the Arcane Trader are also NEW and not specified here.

### Per-vendor category weights

A multiplier on the kind weight when picking inside a group. Ease options are neutral, so both vendors offer them at the same odds.

| Vendor | Physical | Magic | Neutral |
|---|---|---|---|
| Blacksmith | x3 | x0.25 | x1 |
| Arcane Trader | x0.25 | x3 | x1 |
| Rest site, free upgrade, other | x1 | x1 | x1 |

The off-category share is small, not zero, so a card with no kind in the vendor's category (a Skill buff at the Arcane Trader) still gets a full list.

### Per-vendor rarity odds (own category versus off-category)

Neutral kinds and ease rows use the base table (70/25/5, 45/40/15, 25/45/30, 10/40/50).

| Upgrade # | own category (common / uncommon / rare) | off-category (common / uncommon / rare) |
|---|---|---|
| 1 to 3 | 55 / 33 / 12 | 80 / 18 / 2 |
| 4 to 5 | 35 / 42 / 23 | 60 / 32 / 8 |
| 6 to 7 | 18 / 42 / 40 | 40 / 42 / 18 |
| 8 to 10 | 7 / 33 / 60 | 25 / 45 / 30 |

### Roll order with a vendor

Group (section 6 by upgrade number) then category (vendor multipliers over the kinds the group has) then rarity (the odds above for that category) then kind within group, category and rarity by `WEIGHTS`.

### What each vendor offers at upgrade 1 (computed, group shares 40/35/20/5)

| Card | vendor | physical kinds | magic kinds | neutral kinds | rare (any kind) |
|---|---|---|---|---|---|
| Attack | base table | 34% | 5% | 61% | 5.0% |
| Attack | Blacksmith | 46% | 1% | 54% | 8.2% |
| Attack | Arcane Trader | 10% | 16% | 74% | 5.7% |
| Spell | base table | 14% | 22% | 64% | 5.6% |
| Spell | Blacksmith | 30% | 5% | 66% | 9.5% |
| Spell | Arcane Trader | 3% | 39% | 58% | 7.9% |
| Skill buff | base table | 24% | 0% | 76% | 5.0% |
| Skill buff | Blacksmith | 36% | 0% | 64% | 7.5% |
| Skill buff | Arcane Trader | 8% | 0% | 92% | 4.8% |

Reading it: the Blacksmith clearly skews an Attack toward physical kinds and raises its rare odds; the Arcane Trader raises a spell's magic kinds from 22% to 39% and an Attack's from 5% to 16% (its only magic kind is `element`), and a non-damaging buff Skill has no magic kind at all. To give the Arcane Trader more for an Attack, the element packet carries a weight of 12 in the effectiveness/cost group (so it is a headline option there), and a Ward-boost kind could be added later.


## 12. Risks

- Wound/Dazed bloat. `addCard` makes combat-only instances, so the deck editor and shop removal never see them. A Wound sits in the discard pile until combat ends (it reshuffles), so repeated plays thicken the draw pile; Dazed is Ethereal and clears itself each turn. Cap at about 3 added status cards per fight from card plays, and prefer Dazed on common cards, Wound on uncommon and rare. If a design ever makes them run-long, they would need to be removable in the deck editor.
- Enemy buff and the AI/sim. Permanent enemy Strength compounds on long fights and bosses, and the autoplay policy (`autoCombatPolicy.js`) does not price it, so a sim run will under-rate those cards. Keep to Strength 1 to 2 and run the card-budget report plus a sim sweep before shipping.
- Escalating cost with repeated plays: a card that keeps returning to hand climbs to its cap and stays costly. Keep `max` at 2 and let `fx:steady` clear it.
- Exhaust on a Power is meaningless; that is why powers use ET, XP, SD, DS, ST and EB here.
- Ethereal on a 0-cost card (`base.immediate-stance-transition`) is nearly free; revisit after playtest.
- Expensive buffs at 3 to 4 SP (`core.evade`, `core.closingDodge`) are hard to play on a small SP pool; the upgrade cost -1 must stay the most-offered early option.
- More drawback cards raise the value of the Penitent's Chain relic (it rewards cards with a drawback); check it after this lands.
- Card-face space: a face with a status line plus a drawback line can exceed the face budget (`cardFaceBudget.js`).
- Every value is a proposal; none was run through the sim, and enemy-Strength behaviour in the AI is unverified.
