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

| Upgrade # | Ease drawback | Effectiveness / cost | New effect | (ease + effectiveness) : new |
|---|---|---|---|---|
| 1 to 3 (early) | 40% | 35% | 25% | 3 : 1 |
| 4 to 5 | 30% | 30% | 40% | 1.5 : 1 |
| 6 to 7 | 20% | 30% | 50% | 1 : 1 |
| 8 to 10 (late) | 15% | 20% | 65% | 1 : 1.9 |

A card with no drawback has no ease share; it goes to effectiveness/cost, so 75% / 25% early. Upgrades are never fixed per card: a card gets the same random, type-gated roll as today, only weighted by this table. For the cards in sections 3 and 4 that means no authored `upgrade` block should fix the first upgrade (today an authored block is always upgrade 1); drop or reduce it to numbers so upgrade 1 rolls and favours the drawback. The "current drawback" column keeps today's authored upgrades as facts only. Rank-up bonuses (`rankUpBonus.js`) and the blacksmith's 2 to 3 options reuse the same roll. Stored steps keep working (saves hold the step list, not the roll), so owned cards do not change; only new previews do, and seeded roll tests need new expected values.

### Proposed per-type option pools

Kinds in order: ease group first, then effectiveness/cost, then new effects. "Exists" kinds only.

| Card type | Ease group (rolled first) | Effectiveness / cost | New effect |
|---|---|---|---|
| Attack (not spell) | `fx:unexhaust`, `fx:unethereal`, `fx:steady`, plus the signed `stk` of section 7 | `cost`, `dmg`, `hits`, `poise`, `stk`, `blk` when it has Block | `addStatus`, `fx:target`, `fx:boost` (STR), `fx:block`, `fx:draw`, `fx:cycle`, `fx:cull`, `fx:copy`, `fx:shuffle`, `fx:retain`, `fx:innate`, `fx:holdOne`, `fx:reaction`, identity kinds (range, targeting, maneuver, school, element, rankDown) |
| Attack, counter maneuver | same | `cost`, `stk` | `fx:counter`, `fx:draw`, `fx:cycle`, `fx:cull`, `fx:shuffle`, `fx:retain`, `fx:innate`, `fx:holdOne` |
| Skill (not spell), the typical buff | same three plus signed `stk` | `cost`, `blk` when it has Block, `stk` (raises the buff status) | `fx:block`, `fx:draw`, `fx:cycle`, `fx:cull`, `fx:copy`, `fx:shuffle`, `fx:retain`, `fx:innate`, `fx:holdOne`, `fx:boost` (DEX), `fx:reaction`, `maneuver` |
| Spell (skill or attack) | same | as the row above, `cost` may cut MP too (not on a Basic) | as above plus `fx:boost` (INT or WIS), `attr`, `element`, `school` |
| Power (change) | `fx:unethereal`, signed `stk`, and `cost` | `cost` | none offered today; keep it so (a power's new-effect share goes to ease and `cost`). The pool runs out after the drawback is eased and `cost` is taken, as today |
| Ranked ability card (`gradeProfiles`) | `fx:unexhaust`, `fx:unethereal`, `fx:steady` | none | none (unchanged) |
| Status, curse, consumable | none | none | none (unchanged) |

The Power row is the only change to who can be offered what: powers become eligible for the ease group (and the signed `stk`), which they cannot roll today. Exhaust never applies to a Power, so `fx:unexhaust` is not eligible there.

## 7. No existing ease kind

Self debuff (SD), enemy buff (EB), forced discard (DS) and added Wound/Dazed (ST) have no existing upgrade kind that lowers them. 30 of the 74 cards with a drawback carry one (Core 10, Legacy 20). Smallest options:

- (a) Generalise an existing number step. The `stk` step already adds `n` stacks to a plain `applyStatus` (`cardUpgrade.js` `case 'stk'`; the option generator in `cardUpgradeSteps.js` only offers positive `n` on the first status). Let it also target the drawback effect with a negative `n`: self debuff stacks -1, enemy buff stacks -1, and the same signed step on `discard.amount` and `addCard.count`. When the number reaches 0 the effect is dropped. No new kind id, no new weight, `FX_KINDS` and `UPGRADE_OPTION_KINDS` unchanged; it sits in the ease group with the weight of `fx:steady` (12). Needs: generator branch (find a drawback effect), apply branch (negative n, drop at 0), face-text rewrite (`DRAWBACK_TEXT` style) and tests.
- (b) A new kind (such as `fx:soften`): a new `WEIGHTS` entry, `FX_KINDS` id, apply case, text pattern, UI label and `DrawbackSteps` entry, doing the same job as (a) under a new name.

Recommend (a): it reuses `stk`'s existing apply path, adds no id to the player-visible menu, and keeps the saved step format (`{k:'stk', ...}`) valid. Cards with a one-stack drawback ease to nothing in one step, so the signed step removes the drawback outright, which also covers "remove the Wound add" with no extra kind. The two-notch swap ("Wound to Dazed") from the earlier draft is dropped.

## 8. Risks

- Wound/Dazed bloat. `addCard` makes combat-only instances, so the deck editor and shop removal never see them. A Wound sits in the discard pile until combat ends (it reshuffles), so repeated plays thicken the draw pile; Dazed is Ethereal and clears itself each turn. Cap at about 3 added status cards per fight from card plays, and prefer Dazed on common cards, Wound on uncommon and rare. If a design ever makes them run-long, they would need to be removable in the deck editor.
- Enemy buff and the AI/sim. Permanent enemy Strength compounds on long fights and bosses, and the autoplay policy (`autoCombatPolicy.js`) does not price it, so a sim run will under-rate those cards. Keep to Strength 1 to 2 and run the card-budget report plus a sim sweep before shipping.
- Escalating cost with repeated plays: a card that keeps returning to hand climbs to its cap and stays costly. Keep `max` at 2 and let `fx:steady` clear it.
- Exhaust on a Power is meaningless; that is why powers use ET, XP, SD, DS, ST and EB here.
- Ethereal on a 0-cost card (`base.immediate-stance-transition`) is nearly free; revisit after playtest.
- Expensive buffs at 3 to 4 SP (`core.evade`, `core.closingDodge`) are hard to play on a small SP pool; the upgrade cost -1 must stay the most-offered early option.
- More drawback cards raise the value of the Penitent's Chain relic (it rewards cards with a drawback); check it after this lands.
- Card-face space: a face with a status line plus a drawback line can exceed the face budget (`cardFaceBudget.js`).
- Every value is a proposal; none was run through the sim, and enemy-Strength behaviour in the AI is unverified.
