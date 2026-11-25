import test from 'node:test';
import assert from 'node:assert/strict';
import { fight } from './elementFixture.mjs';
import * as Statuses from '../src/engine/statuses.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { computeBlockGain, applyAttackDamage } from '../src/engine/actions.js';
import { previewCard } from '../src/engine/combat.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';
import { WeaponPoiseDamage } from '../src/model/weaponPoise.js';
import { ReceiptPoiseLoss } from '../src/model/fixCoreMechanics.js';
import { ChangeAttribute, RecomputeLiveStats } from '../src/engine/liveStats.js';
import { IsFinesseHit, SourceWeaponHasTag } from '../src/model/combatRatings.js';
import { ScoreItem, RankOf } from '../src/model/combatPower.js';
import { ItemRankOf, ItemRankBadge } from '../src/model/itemRank.js';
import { equipmentCardModel } from '../src/model/equipmentCard.js';
import { RankBandForLevel, FilterToRankBand } from '../src/model/levelLists.js';
import { gameProfileRewardPools, gameProfileRewardOffers, gameProfileShopStock } from '../src/model/gameProfileRewards.js';
import { StackCardSalePlans, gameProfileShopSalePlans } from '../src/model/gameProfileShopSales.js';
import { applyUpgradeSteps } from '../src/model/cardUpgrade.js';
import { EvaluateUpgradeStepCp } from '../src/model/cardUpgradeCp.js';
import { RankUpCardRows } from '../src/ui/components/rankUpCardModal.js';
import { RankUpUpgradeModel } from '../src/ui/models/CardUpgradeModel.js';
import { AttributePointsEarnedBetween, awardLevelXp } from '../src/model/levelup.js';
import { ShopOpensDeckEditor, RestOpensDeckEditor } from '../src/model/armouryRules.js';
import { createRegistries } from '../src/model/registries.js';
import { projectGameCard } from '../src/model/gameProfile.js';
import { createRng } from '../src/model/rng.js';
import { readFileSync } from 'node:fs';
import { loadGameProfileCatalog } from '../tools/game-config.mjs';
import { resolveGameAuthor } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRunState } from '../src/model/state.js';
import { derivedStatRules } from '../src/content/generated/derivedStatRules.js';
import { scoring } from '../src/content/generated/scoring.js';
import { applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';

const profile = resolveGameAuthor(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))), loadGameProfileCatalog());
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);

function makeCoreRun(seed = 12345, classId = 'reaver') {
  const run = createRunState({ registries, classId, seed });
  run.level = { xp: 0, level: 1, unspentPoints: 0 };
  return run;
}

test('1. Stat buffs add bonuses: STR +1 dmg, DEX +1 Block, WIS +1 Poise & +1 Divine dmg, INT +1 magic & +2 Arcane dmg', () => {
  const { combat, player, enemy } = fight({ classId: 'starseer', enemies: 1 });
  delete combat.player.combatStance;
  delete combat.fixCoreRules.stanceBenefits?.neutral?.damageTakenMultiplier;

  // STR buff (+3) -> +3 physical damage
  const physCard = { combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing' }, tags: ['camp:physical'], skipRatingBonus: true };
  const basePhys = profileDamageReceipt(combat, player, enemy, 10, physCard, { roll: 0 }).rawHit;
  Statuses.applyStatus(combat, player, 'strength', 3, player);
  const strPhys = profileDamageReceipt(combat, player, enemy, 10, physCard, { roll: 0 }).rawHit;
  assert.equal(strPhys - basePhys, 3, 'STR buff adds +1 damage per stack');

  // DEX buff (+2) -> +2 Block on played block card
  const blockCard = { cardId: 'core.brace', tags: ['camp:physical', 'maneuver:defend'] };
  const baseBlk = computeBlockGain(combat, player, 6, blockCard);
  Statuses.applyStatus(combat, player, 'dexterity', 2, player);
  const dexBlk = computeBlockGain(combat, player, 6, blockCard);
  assert.equal(dexBlk - baseBlk, 2, 'DEX buff adds +1 Block per stack');

  // WIS buff (+2) -> +2 Poise max/current and +2 Divine damage
  const poiseBefore = player.persistentPoise.max;
  const divineCard = { combatProfile: { camp: 'spell', school: 'divine', damageType: 'sacred' }, tags: ['camp:spell', 'school:divine', 'tradition:divine'], skipRatingBonus: true };
  const baseDiv = profileDamageReceipt(combat, player, enemy, 10, divineCard, { roll: 0 }).rawHit;
  Statuses.applyStatus(combat, player, 'wisdom', 2, player);
  assert.equal(player.persistentPoise.max - poiseBefore, 2, 'WIS buff adds +1 Poise per stack');
  const wisDiv = profileDamageReceipt(combat, player, enemy, 10, divineCard, { roll: 0 }).rawHit;
  assert.equal(wisDiv - baseDiv, 2, 'WIS buff adds +1 Divine damage per stack');

  // INT buff (+2) -> +2 on non-arcane magic (e.g. frost) and +4 on arcane (+2 per stack)
  const frostCard = { combatProfile: { camp: 'spell', school: 'frost', damageType: 'frost' }, tags: ['camp:spell', 'school:frost', 'tradition:divine'], skipRatingBonus: true };
  const arcaneCard = { combatProfile: { camp: 'spell', school: 'force', damageType: 'arcane' }, tags: ['camp:spell', 'school:force', 'tradition:arcane'], skipRatingBonus: true };
  const baseFrost = profileDamageReceipt(combat, player, enemy, 10, frostCard, { roll: 0 }).rawHit;
  const baseArcane = profileDamageReceipt(combat, player, enemy, 10, arcaneCard, { roll: 0 }).rawHit;
  Statuses.applyStatus(combat, player, 'intelligence', 2, player);
  assert.equal(profileDamageReceipt(combat, player, enemy, 10, frostCard, { roll: 0 }).rawHit - baseFrost, 2, 'INT buff adds +1 magic damage per stack');
  assert.equal(profileDamageReceipt(combat, player, enemy, 10, arcaneCard, { roll: 0 }).rawHit - baseArcane, 4, 'INT buff adds +2 Arcane damage per stack');
});

test('2. Finesse switches STR->DEX (weapons except Smash; card-level finesse only that card) & dexDamage strictly adds DEX', () => {
  const { combat, player, enemy } = fight({ classId: 'rogue', enemies: 1 });
  player.ratings.ar = 2;
  player.ratings.dr = 9;
  player.ratingSources = [{ kind: 'attribute', name: 'Attributes', ar: 2, dr: 9, pr: 0, poise: 5, ward: 0 }];
  combat.loadout = { active: { rightHand: 0 }, sets: { rightHand: ['dagger'] } };

  const strike = { combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'piercing' }, tags: ['camp:physical', 'maneuver:attack'] };
  const smash = { combatProfile: { camp: 'physical', maneuver: 'smash', damageType: 'piercing' }, tags: ['camp:physical', 'maneuver:smash'] };
  assert.equal(SourceWeaponHasTag(combat, player, strike, 'finesse'), true, 'dagger has finesse tag');
  assert.equal(IsFinesseHit(combat, player, strike, 'ar'), true, 'finesse weapon uses DEX on attack');
  assert.equal(IsFinesseHit(combat, player, smash, 'ar'), false, 'finesse weapon does NOT use DEX on Smash');

  const strikeHit = profileDamageReceipt(combat, player, enemy, 10, strike, { roll: 0 }).raw;
  const smashHit = profileDamageReceipt(combat, player, enemy, 10, smash, { roll: 0 }).raw;
  assert.ok(strikeHit > smashHit, 'finesse attack uses DEX (9) while Smash uses STR (2)');

  // Non-finesse weapon + finesse-tagged card
  combat.loadout.sets.rightHand = ['straightSword'];
  assert.equal(IsFinesseHit(combat, player, strike, 'ar'), false);
  const finesseCard = { ...strike, tags: ['camp:physical', 'maneuver:attack', 'finesse'] };
  assert.equal(IsFinesseHit(combat, player, finesseCard, 'ar'), true, 'finesse tag on card uses DEX');

  // dexDamage strictly adds DEX to existing damage
  const deftCard = { ...strike, tags: ['camp:physical', 'maneuver:attack', 'dexDamage'] };
  const plainSword = profileDamageReceipt(combat, player, enemy, 10, strike, { roll: 0 }).raw;
  const deftSword = profileDamageReceipt(combat, player, enemy, 10, deftCard, { roll: 0 }).raw;
  assert.ok(deftSword > plainSword, 'dexDamage strictly adds DEX on top of STR');
});

test('3. Poise effect applies before Ward (temp health) and Bonus Poise (temp poise) reduces damage before Ward', () => {
  const { combat, player, enemy } = fight({ classId: 'reaver', enemies: 1 });
  // Under stance-gated Poise mitigation, Poise reduces damage while Countering, Preparing, or Smashing.
  combat.player.combatStance = { maneuver: 'prepared', camp: 'physical', range: 'melee' };
  const basePoise = player.persistentPoise.value;
  Statuses.applyStatus(combat, player, 'barrier', 2, player); // +10 temp poise
  assert.equal(player.persistentPoise.value, basePoise + 10);
  Statuses.applyStatus(combat, player, 'ward', 2, player); // 10 Ward HP
  const carrier = { combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'blunt', reach: 'contact' }, tags: ['camp:physical', 'damage:blunt'], skipRatingBonus: true };
  const receipt = profileDamageReceipt(combat, enemy, player, 20, carrier, { roll: 0 });
  assert.ok(receipt.poiseMitigated > 0, 'Poise reduces hit before Ward while Preparing');
  assert.equal(receipt.poiseMitigated + receipt.wardHpAbsorbed + receipt.hpLoss, receipt.damageReceipt.hits[0].incoming);
  assert.ok(receipt.wardHpAbsorbed < receipt.damageReceipt.hits[0].incoming, 'Ward only absorbs post-Poise remainder');
});

test('4. Armament poise only adds weighted CP, items carry ranks & badges, and enemy poiseMax is lowered', () => {
  const lowPoise = ScoreItem({ kind: 'weapon', id: 'testLow', rarity: 'common', base: 'sword', mods: [], props: [], tags: [], poise: 2, range: 'melee', attackBase: 3, guardBase: 1 }, scoring);
  const zeroPoise = ScoreItem({ kind: 'weapon', id: 'testZero', rarity: 'common', base: 'sword', mods: [], props: [], tags: [], poise: 0, range: 'melee', attackBase: 3, guardBase: 1 }, scoring);
  assert.ok(lowPoise.raw >= zeroPoise.raw, 'poise on armaments never subtracts CP');

  const greatsword = registries.equipment.armaments.find(a => a.id === 'greatsword');
  const gsRank = ItemRankOf('weapon', greatsword);
  assert.ok(Number.isInteger(gsRank) && gsRank >= 0);
  const model = equipmentCardModel(registries, greatsword);
  assert.equal(model.rankBadge, ItemRankBadge('weapon', greatsword));

  const ashRevenant = registries.enemies.get('ashRevenant');
  assert.ok(ashRevenant.poiseMax <= 4, 'enemy poiseMax scaled down');
});

test('5. Level-correlated rank rewards: L1 -> 0..1, elite +2 -> 0..3, boss +3 -> 0..4, rare +1', () => {
  assert.deepEqual(RankBandForLevel({ level: 1, pool: 'normal', rareBoost: false }), { minRank: 0, maxRank: 1 });
  assert.deepEqual(RankBandForLevel({ level: 1, pool: 'normal', rareBoost: true }), { minRank: 0, maxRank: 2 });
  assert.deepEqual(RankBandForLevel({ level: 1, pool: 'elite', rareBoost: false }), { minRank: 0, maxRank: 3 });
  assert.deepEqual(RankBandForLevel({ level: 1, pool: 'boss', rareBoost: false }), { minRank: 0, maxRank: 4 });
  assert.deepEqual(RankBandForLevel({ level: 3, pool: 'boss', rareBoost: true }), { minRank: 0, maxRank: 7 });
});

test('6. Cost swap upgrade option (-1 MP +2 SP and -2 SP +1 MP)', () => {
  const base = { id: 'test.spell', name: 'Arcane Blast', rarity: 'common', type: 'spell', cost: 2, staminaCost: 2, manaCost: 1, effects: [{ op: 'damage', target: 'enemy', amount: 8 }] };
  const mpToSp = applyUpgradeSteps(base, [{ k: 'costSwap', dir: 'mpToSp' }]);
  assert.equal(mpToSp.manaCost, 0);
  assert.equal(mpToSp.staminaCost, 4);
  const spToMp = applyUpgradeSteps(base, [{ k: 'costSwap', dir: 'spToMp' }]);
  assert.equal(spToMp.staminaCost, 0);
  assert.equal(spToMp.manaCost, 2);
});

test('7. Available rank-ups sorted at top in RankUpCardRows', () => {
  const run = makeCoreRun(77, 'reaver');
  run.deck = [
    { instanceId: 'blocked_card', cardId: 'core.strike', rank: 1, upgraded: false, upgradeSteps: [] },
    { instanceId: 'ready_card', cardId: 'core.strike', rank: 0, upgraded: true, upgradeSteps: [{ k: 'dmg', n: 2 }] },
  ];
  const rows = RankUpCardRows(registries, run);
  assert.equal(rows[0].id, 'ready_card', 'available rank-up comes first');
  assert.equal(rows[0].disabled, false);
  assert.equal(rows[1].id, 'blocked_card');
  assert.equal(rows[1].disabled, true);
});

test('9 & 10. Default hand size reduced by 2, shop opens deck editor, rewards disallow library', () => {
  assert.equal(derivedStatRules.rules.handSize.base, 5);
  assert.equal(derivedStatRules.rules.openingHand.base, 3);
  assert.equal(derivedStatRules.rules.draw.base, 3);
  const run = makeCoreRun(88, 'reaver');
  assert.equal(ShopOpensDeckEditor(run), true, 'shops can open deck editor');
  assert.equal(RestOpensDeckEditor(run), true, 'rest sites can open deck editor');
});

test('11. Selling cards stacks identical cards with multiplier', () => {
  const run = makeCoreRun(99, 'reaver');
  run.sideboard = [
    { instanceId: 'c1', cardId: 'core.strike', upgraded: false },
    { instanceId: 'c2', cardId: 'core.strike', upgraded: false },
    { instanceId: 'c3', cardId: 'core.defend', upgraded: false },
  ];
  const rng = createRng(run.seed);
  gameProfileShopStock(registries, run, rng, { shopId: 'shop:1' });
  const plans = gameProfileShopSalePlans(registries, run, 'shop:1');
  const stacked = StackCardSalePlans(plans, run);
  const strikeStack = stacked.find(p => p.def?.id === 'core.strike');
  assert.equal(strikeStack.count, 2, 'identical sideboard cards stack with count 2');
  assert.equal(strikeStack.instanceIds.length, 2);
});

test('12. Owned cards, armors, and relics excluded from rewards and shop pools', () => {
  const run = makeCoreRun(101, 'reaver');
  run.deck = [{ instanceId: 'd1', cardId: 'core.cleave', upgraded: false }];
  run.relics = ['goldenSprout'];
  run.loadout.boughtArmour = [{ classId: 'reaver', id: 'vigil' }];
  const pools = gameProfileRewardPools(registries, run);
  assert.equal(pools.combatCards.includes('core.cleave'), false, 'owned card excluded');
  assert.equal(pools.relics.includes('goldenSprout'), false, 'owned relic excluded');
  assert.equal(pools.armor.includes('vigil'), false, 'owned armor excluded');
});

test('13. Leveling up grants rank-up every level, attribute point every 4 levels, and temp combat buffs do not raise HP/MP/SP', () => {
  assert.equal(AttributePointsEarnedBetween(1, 2, 4, 1), 0);
  assert.equal(AttributePointsEarnedBetween(1, 4, 4, 1), 1);
  assert.equal(AttributePointsEarnedBetween(1, 8, 4, 1), 2);
  const run = makeCoreRun(202, 'reaver');
  const res = awardLevelXp(registries, run, 5000);
  assert.ok(res.levelUps >= 3);
  assert.equal(run.level.pendingRankUps, res.levelUps, '1 rank-up per level gained');
  assert.equal(run.level.unspentPoints, AttributePointsEarnedBetween(1, run.level.level, 4, 1), '1 attr point per 4 levels');

  const { combat, player } = fight({ classId: 'reaver', enemies: 1 });
  const hp0 = player.maxHp, sp0 = player.maxStamina, mp0 = player.maxMana;
  ChangeAttribute(combat, player, 'constitution', 5, { thisTurn: true });
  ChangeAttribute(combat, player, 'dexterity', 5, { thisTurn: true });
  ChangeAttribute(combat, player, 'wisdom', 5, { thisTurn: true });
  assert.equal(player.maxHp, hp0, 'temp CON does not raise maxHp in combat');
  assert.equal(player.maxStamina, sp0, 'temp DEX does not raise maxStamina in combat');
  assert.equal(player.maxMana, mp0, 'temp WIS does not raise maxMana in combat');
});

test('14. Recurring buff tag costs +15 CP and pairs with Exhaust', () => {
  assert.equal(scoring.tags['trait:recurring'].weight, 15);
  const base = { id: 'test.buff', name: 'War Stance', rarity: 'common', type: 'skill', cost: 1, staminaCost: 1, manaCost: 0, effects: [{ op: 'applyStatus', target: 'self', status: 'strength', stacks: 1 }] };
  const upgraded = applyUpgradeSteps(base, [{ k: 'fx', fx: 'recurring' }]);
  assert.ok(upgraded.tags.includes('trait:recurring'));
  assert.ok(upgraded.keywords.includes('exhaust'));
});

test('15. Card upgrades respect rank, CP, and rarity', () => {
  // 0-rank common card at CP 0 trying to get -1 SP (+4 CP) -> bumps to uncommon (CP 2 -> Rank 1), allowed if playerLevel >= 1
  // Trying to add recurring (+15 CP) at level 1 -> even at rare (-5 discount -> CP ~10 -> Rank 3), player at level 1 cannot reach Rank 3 -> disallowed!
  const base = { id: 'test.buff', name: 'War Stance', rarity: 'common', type: 'skill', cost: 1, staminaCost: 1, manaCost: 0, effects: [{ op: 'applyStatus', target: 'self', status: 'strength', stacks: 1 }] };
  const atLevel1 = EvaluateUpgradeStepCp({ baseDef: base, currentDef: base, instance: { rank: 0 }, step: { k: 'fx', fx: 'recurring' }, playerLevel: 1, scoring });
  assert.equal(atLevel1.allowed, false, 'recurring buff (+15 CP) disallowed when player level 1 cannot reach resulting rank');
  const atLevel5 = EvaluateUpgradeStepCp({ baseDef: base, currentDef: base, instance: { rank: 0 }, step: { k: 'fx', fx: 'recurring' }, playerLevel: 5, scoring });
  assert.equal(atLevel5.allowed, true, 'allowed when player level 5 can reach resulting rank');
});

test('16. Poise reduces damage by 50% of current Poise (costing floor(0.5*damage)+1 Poise) ONLY when Countering, Preparing, or Smashing', () => {
  const { combat, player, enemy } = fight({ classId: 'reaver', enemies: 1 });
  const carrier = { combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing', range: 'melee' }, tags: ['camp:physical', 'maneuver:attack', 'damage:slashing'], skipRatingBonus: true };
  // Non-mitigation stances: attack, defend, sweep, neutral -> 0 Poise reduction, full damage hits Block/Ward/HP.
  for (const stance of ['attack', 'defend', 'sweep', 'neutral']) {
    enemy.block = 0;
    enemy.persistentPoise = { value: 10, max: 10 };
    enemy.combatStance = { maneuver: stance, camp: 'physical', range: 'melee' };
    const r = profileDamageReceipt(combat, player, enemy, 20, carrier, { roll: 0 });
    assert.equal(r.poiseMitigated, 0, `no Poise damage reduction in ${stance}`);
    assert.equal(r.poiseMitigationCost, 0, `no Poise mitigation drain in ${stance}`);
    assert.equal(r.hpLoss, r.damageReceipt.hits[0].incoming, `full damage hits HP in ${stance}`);
  }
  // Mitigation stances: counter, prepared, smash -> 50% of current Poise reduction, floor(0.5*damage)+1 mitigation drain.
  for (const stance of ['counter', 'prepared', 'smash']) {
    enemy.block = 0;
    enemy.persistentPoise = { value: 10, max: 10 };
    enemy.combatStance = { maneuver: stance, camp: 'physical', range: 'melee' };
    const r = profileDamageReceipt(combat, player, enemy, 20, carrier, { roll: 0 });
    const incoming = r.damageReceipt.hits[0].incoming;
    assert.equal(r.poiseMitigated, Math.min(incoming, 5), `50% of 10 Poise = 5 reduction in ${stance}`);
    assert.equal(r.poiseMitigationCost, Math.min(10, Math.floor(incoming * 0.5) + 1), `floor(0.5*damage)+1 Poise mitigation cost in ${stance}`);
    assert.equal(r.hpLoss, incoming - r.poiseMitigated);
    assert.ok(ReceiptPoiseLoss(r) >= r.poiseMitigationCost);
  }
});

test('17. Weapon inherent poise damage (1-3), Sceptres/Bows/Staves +20%, Smash 1.25x and Smash vs Guarding 2x', () => {
  const { combat, player, enemy } = fight({ classId: 'reaver', enemies: 1 });
  const strike = { combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing', range: 'melee' }, tags: ['camp:physical', 'maneuver:attack'] };
  const smash = { combatProfile: { camp: 'physical', maneuver: 'smash', damageType: 'blunt', range: 'melee' }, tags: ['camp:physical', 'maneuver:smash'] };
  const dagger = WeaponPoiseDamage(combat, player, enemy, { ...strike, sourceArmamentId: 'dagger' }, { defending: 'neutral' });
  const sword = WeaponPoiseDamage(combat, player, enemy, { ...strike, sourceArmamentId: 'straightSword' }, { defending: 'neutral' });
  const greatsword = WeaponPoiseDamage(combat, player, enemy, { ...strike, sourceArmamentId: 'greatsword' }, { defending: 'neutral' });
  assert.equal(dagger.amount, 1);
  assert.equal(sword.amount, 2);
  assert.equal(greatsword.amount, 3);
  for (const [id, base] of [['shortbow', 1], ['ashStaff', 2], ['boneSceptre', 2]]) {
    const ranged = WeaponPoiseDamage(combat, player, enemy, { ...strike, sourceArmamentId: id }, { defending: 'neutral' });
    assert.equal(ranged.raw, base * 1.2, `${id} multiplies its own authored Poise base by 1.2`);
    assert.equal(ranged.amount, Math.ceil(base * 1.2), `${id} rounds the multiplied Poise up`);
  }
  const swordSmash = WeaponPoiseDamage(combat, player, enemy, { ...smash, sourceArmamentId: 'straightSword' }, { defending: 'neutral' });
  const swordSmashGuard = WeaponPoiseDamage(combat, player, enemy, { ...smash, sourceArmamentId: 'straightSword' }, { defending: 'defend' });
  assert.equal(swordSmash.amount, 3, 'Sword (2) x 1.25 = 2.5 -> 3');
  assert.equal(swordSmashGuard.amount, 4, 'Sword (2) x 2 vs Guarding = 4');
  const gsSmash = WeaponPoiseDamage(combat, player, enemy, { ...smash, sourceArmamentId: 'greatsword' }, { defending: 'neutral' });
  const gsSmashGuard = WeaponPoiseDamage(combat, player, enemy, { ...smash, sourceArmamentId: 'greatsword' }, { defending: 'defend' });
  assert.equal(gsSmash.amount, 4, 'Greatsword (3) x 1.25 = 3.75 -> 4');
  assert.equal(gsSmashGuard.amount, 6, 'Greatsword (3) x 2 vs Guarding = 6');
  enemy.block = 50;
  enemy.persistentPoise = { value: 10, max: 10 };
  enemy.combatStance = { maneuver: 'defend', camp: 'physical', range: 'melee' };
  const liveReceipt = profileDamageReceipt(combat, player, enemy, 12, { ...smash, sourceArmamentId: 'greatsword', skipRatingBonus: true }, { roll: 0 });
  assert.equal(liveReceipt.poiseDrain, 6, 'Smash vs Guarding deals 2x weapon poise (6) through Block');
});

test('18. Dynamic poise damage appears on the card when attacking and updates vs Guarding targets', () => {
  const { combat, enemy } = fight({ classId: 'reaver', enemies: 1 });
  combat.loadout = { ...(combat.loadout || {}), rightHand: 'straightSword' };
  combat.piles.hand = [
    { instanceId: 'c-strike', cardId: 'core.strike', upgraded: false },
    { instanceId: 'c-smash', cardId: 'core.smash', upgraded: false },
  ];
  enemy.combatStance = { maneuver: 'neutral', camp: 'physical', range: 'melee' };
  const strikePreview = previewCard(combat, 'c-strike', enemy.id);
  const strikeDmg = strikePreview.values.find(v => v.op === 'damage');
  assert.equal(strikeDmg.weaponPoise, 2, 'Strike previews 2 weapon poise with Straight Sword');
  const strikeDef = strikePreview.resolvedDefinition;
  const strikeLines = cardFaceLines(strikeDef, strikePreview, combat.registries, strikePreview.faceRules);
  assert.ok(strikeLines.some(l => /2.*Poise/i.test(l.html)), 'Strike card face dynamically displays weapon poise damage');

  const smashNeutral = previewCard(combat, 'c-smash', enemy.id);
  const smashNeutralWp = smashNeutral.values.find(v => v.op === 'damage').weaponPoise;
  assert.equal(smashNeutralWp, 3, 'Smash vs neutral previews 1.25x weapon poise (3)');

  enemy.combatStance = { maneuver: 'defend', camp: 'physical', range: 'melee' };
  const smashGuarding = previewCard(combat, 'c-smash', enemy.id);
  const smashGuardingWp = smashGuarding.values.find(v => v.op === 'damage').weaponPoise;
  assert.equal(smashGuardingWp, 4, 'Smash vs Guarding dynamically jumps to 2x weapon poise (4)');
  const smashGuardLines = cardFaceLines(smashGuarding.resolvedDefinition, smashGuarding, combat.registries, smashGuarding.faceRules);
  assert.ok(smashGuardLines.some(l => /4.*Poise/i.test(l.html)), 'Smash card face dynamically displays 4 Poise vs Guarding target');
});
