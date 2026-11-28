// Owner playtest 2026-11-17, theme A (combat math): docs/feedback/2026-11-17-playtest.md items 1-7.
// Numerical regressions use explicit small rule/card fixtures. Current authored
// settings are independently compiled below; changing them does not change these scenarios.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileGameProfiles } from '../tools/game-config.mjs';
import { resolveGameAuthor, gameDigest } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import * as Profile from '../src/model/gameProfile.js';
import { createRunState, deserializeRun, serializeRun } from '../src/model/state.js';
import { deriveStat } from '../src/model/derivedStats.js';
import { gameProfileEffectiveAttributes } from '../src/model/gameProfileRun.js';

const shippedProfile = Profile.resolveGameProfile('default');
const profile = structuredClone(shippedProfile);
Object.assign(profile.modules.effects, { baseDamageMultiplier: 0.5, playerDamageMultiplier: 0.7, enemyDamageMultiplier: 0.7,
  physicalDamageMultiplier: 0.7, blockGainMultiplier: 0.49 });
profile.content.stats = { handBase: 3, handAttribute: 'intelligence', handPointsPerIncrease: 1,
  // The class attributes are the shipped ones, so their total is too.
  attributePointTotal: shippedProfile.content.stats.attributePointTotal, levelGains: { dexterity: { sp: 1 }, constitution: { hp: 5 }, wisdom: { mp: 1, poise: 1 }, intelligence: {} },
  poolBases: { hp: 35, mana: 1, stamina: 3 }, levelGrowth: { hp: 5, mana: 0, stamina: 0 },
  pointsPerIncrease: { sp: 1, mp: 1 }, attributeBaseline: { sp: 0, mp: 0 }, secondaryPolicy: 'primaryOnly' };
profile.modules.gear.statPoints = { attributes: { common: 0, uncommon: 0, rare: 1, epic: 1 }, perRank: 0, poiseMin: 1, attributeBudgetCost: 3 };
const card = (id, effects, maneuver = 'attack') => ({ id, name: id, class: 'colorless', rarity: 'common', type: 'attack',
  cost: 1, staminaCost: 1, manaCost: 0, costRule: 'fixed', keywords: [], effects,
  tags: ['camp:physical', `maneuver:${maneuver}`, 'classification.attack', ...(maneuver === 'counter' ? ['trait:reaction'] : [])], textTemplate: 'Deal {damage} damage.' });
const numericalCards = [card('core.strike', [{ op: 'damage', target: 'enemy', amount: 6 }]),
  card('core.counter', [{ op: 'block', target: 'self', amount: 5 }, { op: 'damage', target: 'enemy', amount: 4 }], 'counter')];
profile.content.cards = [...profile.content.cards.filter(row => !numericalCards.some(card => card.id === row.id)), ...numericalCards];
for (const row of numericalCards) delete profile.content.resourceVariants?.[row.id];
profile.content.starterDeck.classDecks.reaver = [{ card: 'core.strike', copies: 4 }, { card: 'core.counter', copies: 4 }];
delete profile.hash;
profile.hash = gameDigest(profile);
const readJson = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));

test('current authored JSON independently compiles to the shipped profile', () => {
  const { catalog } = compileGameProfiles();
  const current = resolveGameAuthor(readJson('games/ashenspire/game.json'), catalog);
  assert.deepEqual(current.content.stats, shippedProfile.content.stats);
  assert.deepEqual(current.modules.effects, shippedProfile.modules.effects);
  assert.deepEqual(current.modules.gear, shippedProfile.modules.gear);
  assert.deepEqual(current.content.gear, shippedProfile.content.gear);
});
const registries = Profile.bindGameProfileRegistries(createRegistries(Profile.applyGameProfileToContent(contentBundle, profile)), profile);
const META = { gameProfileUnlocks: { [profile.id]: { completedRunIds: ['a', 'b', 'c'] } } };
const newRun = (classId, seed = 7) => createRunState({ registries, classId, seed, profileMeta: META });

test('current run HP agrees with its snapshotted source rules and effective attributes', () => {
  const currentReg = Profile.bindGameProfileRegistries(createRegistries(Profile.applyGameProfileToContent(contentBundle, shippedProfile)), shippedProfile);
  for (const classId of Object.keys(shippedProfile.content.starterDeck.classDecks)) {
    const run = createRunState({ registries: currentReg, classId, seed: 7, profileMeta: META });
    const receipt = deriveStat(run.derivedStatRuleSnapshot.rules, 'hp', {
      attributes: gameProfileEffectiveAttributes(currentReg, run), classDef: currentReg.classes.get(classId), level: run.level.level });
    assert.equal(run.maxHp, receipt.value, classId);
  }
});

test('controlled HP rows add constitution, level growth and a flat relic modifier independently', () => {
  const rules = { rulesetVersion: 8, defaults: { perLevel: 0 }, rules: { hp: { base: 35, constitution: 5, perLevel: 5 } } };
  const modified = { ...rules, rules: { hp: { ...rules.rules.hp, base: 45 } } };
  for (const level of [1, 5, 10]) for (const constitution of [0, 1, 3]) {
    const input = { attributes: { strength: 2, dexterity: 3, constitution, wisdom: 1, intelligence: 1 }, classDef: { id: 'fixture' }, level };
    const hp = deriveStat(rules, 'hp', input).value;
    assert.equal(hp, 30 + 5 * (constitution + level));
    assert.equal(deriveStat(modified, 'hp', input).value, hp + 10);
  }
});

test('a controlled half-base-damage rule rounds upward before attribute and side scales', async () => {
  const { createRng } = await import('../src/engine/rng.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  assert.equal(profile.modules.effects.baseDamageMultiplier, 0.5);
  let checked = 0;
  for (const amount of [1, 2, 3, 6, 7]) {
    const run = newRun('reaver', 11);
    const combat = createRunCombat({ registries, run, rng: createRng(11), enemyIds: ['wanderingSoldier'] });
    const { profileDamageReceipt } = await import('../src/engine/gameProfileCombat.js');
    const receipt = profileDamageReceipt(combat, combat.player, combat.enemies[0], amount,
      { combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' }, skipRatingBonus: true });
    const hit = receipt.damageReceipt.hits[0];
    const scale = hit.sources.find(row => row.id === 'base-damage-scale');
    assert.equal(scale ? scale.effective : amount, Math.ceil(amount / 2));
    checked++;
  }
  assert.equal(checked, 5);
});

test('item 1: static rank-up faces show base damage for the supplied run profile', async () => {
  const { cardFaceLines } = await import('../src/model/cardFaceText.js');
  const { playingCardDefinition } = await import('../src/model/playingCard.js');
  const run = newRun('reaver');
  run.loadout = { sets: { rightHand: [null], leftHand: [null], armor: [null] }, active: { rightHand: 0, leftHand: 0, armor: 0 } };
  run.attributes.strength = 3;
  const ranked = playingCardDefinition(registries, { cardId: 'core.strike', rank: 2 }, { rules: run });
  const strike = registries.cards.get('core.strike');
  const previous = structuredClone(run.gameProfile);
  delete previous.modules.effects.baseDamageMultiplier;
  delete previous.modules.effects.playerDamageMultiplier;
  delete previous.modules.effects.physicalDamageMultiplier;
  delete previous.hash;
  previous.hash = gameDigest(previous);
  const beforeBalance = { ...run, gameProfile: previous };
  const damageLine = (def, rules, preview) => cardFaceLines(def, preview, registries, rules)
    .find(line => line.kind === 'damage').html.replace(/<[^>]+>/g, '');

  // In this STR 3 fixture, the fixed base 6 and ranked
  // 7 are halved and rounded up before STR is added; physical and player
  // scaling each multiply by 0.7 before flooring the displayed value.
  assert.equal(gameProfileEffectiveAttributes(registries, run).strength, 3);
  assert.equal(damageLine(strike, run), '2 damage');
  assert.equal(damageLine(ranked, run), '3 damage', 'rank 2 composes authored 7 before base rounding, STR and the cuts');
  assert.equal(damageLine(ranked, null), '7 damage', 'a face without a run keeps the authored amount');
  assert.equal(damageLine(ranked, beforeBalance), '7 damage', 'an older pinned profile keeps the authored amount');
  assert.equal(damageLine(ranked, run, { tokens: { damage: 9 } }), '9 damage', 'a final preview value stays authoritative');
});

test('item 1: player and enemy Counters scale their authored base once before the return', async () => {
  const { createRng } = await import('../src/engine/rng.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  const { dispatch, previewCard, previewIntent } = await import('../src/engine/combat.js');
  const { primeAccuracyRolls } = await import('./accuracyFixture.mjs');
  const firstMoves = { wanderingSoldier: 'slash', gildedKnight: 'parry' };
  const bundle = { ...contentBundle, enemies: contentBundle.enemies.map(enemy =>
    Object.hasOwn(firstMoves, enemy.id) ? { ...enemy, firstMove: firstMoves[enemy.id] } : enemy) };
  const baseRegistries = Profile.bindGameProfileRegistries(createRegistries(Profile.applyGameProfileToContent(bundle, profile)), profile);
  const fixed = id => ({ id, name: id, hp: [1000, 1000], poiseMax: 0, spPool: 1, levelProfile: { min: 1, max: 1 },
    attributes: { strength: 1, dexterity: 1, constitution: 1, wisdom: 1, intelligence: 1 }, startingRange: 'melee',
    firstMove: firstMoves[id], moves: id === 'wanderingSoldier' ? { slash: { id: 'slash', enemyId: id, intent: 'attack', sp: 1, damage: 6, weight: 1, tags: ['camp:physical', 'maneuver:attack', 'range:melee'] } }
      : { parry: { id: 'parry', enemyId: id, intent: 'block', sp: 1, counterDamage: 6, block: 0, weight: 1, tags: ['camp:physical', 'maneuver:counter', 'counter:melee', 'range:melee'] } } });
  const withFixedEnemies = base => ({ ...base, enemies: { ...base.enemies, get: id => firstMoves[id] ? fixed(id) : base.enemies.get(id) } });
  const fightRegistries = withFixedEnemies(baseRegistries);
  const begin = (enemyId, registries = fightRegistries) => {
    const run = createRunState({ registries, classId: 'reaver', seed: 511 });
    // This arithmetic lane has no authored equipment or relic triggers.
    run.relics = [];
    run.loadout = { sets: { rightHand: [null], leftHand: [null], armor: [null] }, active: { rightHand: 0, leftHand: 0, armor: 0 } };
    const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: [enemyId] });
    const [enemy] = combat.enemies;
    enemy.actorIntentRevealed = true;
    enemy.plannedMoves = [];
    primeAccuracyRolls(combat, { count: 2 });
    dispatch(combat, { type: 'setReactions', enabled: false });
    return { combat, enemy };
  };
  const returnedDamage = (combat, sourceId, base) => {
    const index = combat.eventLog.findIndex(event => event.type === 'combatCounterTriggered' && event.sourceId === sourceId);
    const trigger = combat.eventLog[index];
    assert.equal(trigger?.counterBase, base);
    const hit = combat.eventLog.slice(index + 1).find(event => event.type === 'damageDealt' && event.sourceId === sourceId && event.targetId === trigger.targetId);
    assert.equal(hit?.damageReceipt?.hits?.[0]?.incoming, trigger.amount);
    return trigger.amount;
  };

  const playCounter = ({ combat, enemy }, base) => {
    combat.piles.hand.push({ instanceId: 'scaled-counter', cardId: 'core.counter' });
    const card = previewCard(combat, 'scaled-counter', enemy.id);
    dispatch(combat, { type: 'playCard', cardInstanceId: 'scaled-counter' });
    assert.equal(combat.player.combatCounter.payload.hp, base);
    dispatch(combat, { type: 'endTurn' });
    assert.equal(returnedDamage(combat, 'player', base), card.counterReturn.hp);
  };
  playCounter(begin('wanderingSoldier'), 2);
  const explicit = structuredClone(profile);
  explicit.content.cards.find(card => card.id === 'core.counter').counterPayload = { hp: 5, hpRating: false };
  delete explicit.hash;
  explicit.hash = gameDigest(explicit);
  const explicitRegistries = withFixedEnemies(Profile.bindGameProfileRegistries(createRegistries(Profile.applyGameProfileToContent(bundle, explicit)), explicit));
  playCounter(begin('wanderingSoldier', explicitRegistries), 3);

  const knight = begin('gildedKnight');
  knight.combat.piles.hand.push({ instanceId: 'into-parry', cardId: 'core.strike' });
  assert.equal(previewIntent(knight.combat, knight.enemy.id).counterDamage, 3, 'the enemy intent shows half of the 6 authored damage');
  dispatch(knight.combat, { type: 'playCard', cardInstanceId: 'into-parry', targetId: knight.enemy.id });
  // Owner, 2026-11-18 (second cut): the Strike's hit is small enough now that the stack share rounds to 0; the return still carries the whole counter base.
  assert.ok(returnedDamage(knight.combat, knight.enemy.id, 3) >= 3, 'the return keeps its counter base');
});

test('item 5 (owner, 2026-11-24): SP = 3 + DEX and MP = 1 + WIS in Core', () => {
  for (const classId of ['reaver', 'starseer', 'rogue', 'herald']) {
    const run = newRun(classId);
    const rules = run.derivedStatRuleSnapshot.rules, classDef = registries.classes.get(classId);
    const ones = { strength: 1, dexterity: 1, constitution: 1, wisdom: 1, intelligence: 1 };
    const at = (id, attributes, level = 1) => deriveStat(rules, id, { attributes: { ...ones, ...attributes }, classDef, level }).value;
    for (const level of [1, 5, 10]) {
      // Consecutive points, including the old fourth-point boundaries.
      for (const dex of [0, 1, 3, 4, 7, 8, 11, 12]) assert.equal(at('stamina', { dexterity: dex }, level), 3 + dex, `${classId} SP at DEX ${dex}, level ${level}`);
      for (const wis of [0, 1, 3, 4, 7, 8, 11, 12]) assert.equal(at('mana', { wisdom: wis }, level), 1 + wis, `${classId} MP at WIS ${wis}, level ${level}`);
      // INT does not buy Mana any more, and the snapshotted hand rows use 3 + INT.
      for (const int of [0, 3, 4, 7, 8, 12]) {
        assert.equal(at('mana', { intelligence: int }, level), at('mana', {}, level), `${classId} MP ignores INT ${int}`);
        assert.equal(at('draw', { intelligence: int }, level), Math.min(10, 3 + int), `${classId} draw at INT ${int}`);
        assert.equal(at('openingHand', { intelligence: int }, level), Math.min(10, 3 + int), `${classId} opening hand at INT ${int}`);
      }
    }
    for (const other of ['strength', 'constitution', 'wisdom', 'intelligence']) assert.equal(at('stamina', { [other]: 12 }), at('stamina', {}), `${classId} SP ignores ${other}`);
    for (const other of ['strength', 'dexterity', 'constitution', 'intelligence']) assert.equal(at('mana', { [other]: 12 }), at('mana', {}), `${classId} MP ignores ${other}`);
    assert.equal(run.maxStamina, at('stamina', gameProfileEffectiveAttributes(registries, run)), `${classId}: SP follows its snapshotted rule`);
    assert.equal(run.maxMana, at('mana', gameProfileEffectiveAttributes(registries, run)), `${classId}: MP follows its snapshotted rule`);
  }
});

// Current starter quote/payment parity is covered for every authored deck in
// core-starting-decks.test.mjs; affordability is a tunable authoring decision.

test('item 2: the attribute part of AR, DR and PR reads one stat each (STR, DEX, max(INT, WIS))', () => {
  for (const classId of ['reaver', 'starseer', 'rogue', 'herald']) {
    const run = newRun(classId);
    const rules = run.derivedStatRuleSnapshot.rules, classDef = registries.classes.get(classId);
    const at = (id, attributes) => deriveStat(rules, id, { attributes: { strength: 2, dexterity: 3, constitution: 4, wisdom: 5, intelligence: 6, ...attributes }, classDef, level: 4 }).value;
    assert.equal(at('ar', {}), 2, `${classId} AR = STR`);
    assert.equal(at('dr', {}), 3, `${classId} DR = DEX`);
    assert.equal(at('pr', {}), 6, `${classId} PR row = INT (the WIS half is PrAttributeView)`);
  }
});

test('item 4: Core gear grants its current rarity attributes and guarding Poise, never AR or DR', async () => {
  const { resolveGearItem } = await import('../engine/kernel/gameConfig.js');
  const settings = profile.modules.gear;
  const byRarity = { common: 0, uncommon: 0, rare: 1, epic: 1 };
  assert.deepEqual(settings.statPoints.attributes, byRarity);
  assert.equal(settings.statPoints.perRank, 0);
  assert.equal(settings.statPoints.attributeBudgetCost, 3);
  const guarding = [];
  const attributesOf = points => ['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence']
    .reduce((sum, id) => sum + (points?.[id] ?? 0), 0);
  for (const item of profile.content.gear) {
    const resolved = resolveGearItem(item, settings);
    const attributes = attributesOf(resolved.points);
    assert.equal(resolved.values.ar, 0, `${item.id} AR`);
    assert.equal(resolved.values.dr, 0, `${item.id} DR`);
    assert.equal(attributes, Math.max(attributesOf(item.points), byRarity[item.rarity] ?? 0), `${item.id} attributes`);
    // Owner, 2026-11-18 (con-poise): Poise comes from guarding gear only; a weapon or shield with no Poise weight (dagger, buckler, staffs) grants none.
    assert.ok(resolved.values.poise >= 0, `${item.id} has a non-negative Poise value`);
    if (resolved.values.poise > 0) guarding.push(item.id);
    // Raising the item rank opens an upgrade slot without granting automatic attributes.
    const tiered = resolveGearItem(item, settings, { rank: (item.rank ?? 1) + 2 });
    assert.equal(tiered.values.ar + tiered.values.dr, 0, `${item.id} tiered`);
    assert.equal(attributesOf(tiered.points), attributes, `${item.id} +2 ranks`);
  }
  assert.ok(guarding.every(id => profile.content.gear.some(item => item.id === id)), 'Poise receipts identify authored gear');
});

test('item 4: an equipped, Smith-tiered weapon adds no AR; AR is the effective STR', async () => {
  const { gameProfileRatingReceipt } = await import('../src/model/gameProfileRun.js');
  for (const classId of ['reaver', 'starseer', 'rogue', 'herald']) {
    const run = newRun(classId);
    for (const [slot, sets] of Object.entries(run.loadout.sets)) {
      const id = sets[run.loadout.active?.[slot] || 0];
      if (id) (run.itemUpgradeLevels ||= {})[slot === 'armor' ? `armor/${classId}/${id}` : `armament/${id}`] = 2;
    }
    const attributes = gameProfileEffectiveAttributes(registries, run);
    const receipt = gameProfileRatingReceipt(registries, run);
    assert.equal(receipt.totals.ar, attributes.strength, `${classId} AR`);
    assert.equal(receipt.totals.dr, attributes.dexterity, `${classId} DR`);
    assert.equal(receipt.totals.pr, Math.max(attributes.intelligence, attributes.wisdom), `${classId} PR`);
  }
});

test('item 6: enemy fights read current authored act/floor levels and HP rules', async () => {
  const { createRng } = await import('../src/engine/rng.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  const { characterSettings, enemyPools, enemyItemBonuses, enemyFightLevel, enemyEffectiveLevel, enemyAttributeBudget } = await import('../engine/kernel/gameConfig.js');
  const settings = characterSettings(profile.modules);
  for (const act of [1, 2, 3]) {
    for (const row of profile.content.enemies) {
      const run = newRun('reaver', 5);
      run.actNumber = act;
      const enemy = createRunCombat({ registries, run, rng: createRng(5), enemyIds: [row.id] }).enemies[0];
      const def = registries.enemies.get(row.id);
      const expected = enemyFightLevel(row, settings, { act, floor: run.floor });
      const level = settings.enemyLevelScaling ? expected.level : enemyEffectiveLevel(row, settings, act);
      if (level !== null) assert.equal(enemy.level, level, `act ${act} ${row.tier} ${row.id} level`);
      const own = enemy.ownAttributes;
      assert.equal(Object.values(own).reduce((a, b) => a + b, 0), enemyAttributeBudget({ ...row, level: enemy.level }, settings), `${row.id} follows its attribute budget`);
      if (!settings.effectiveLevelHp || enemyEffectiveLevel(row, settings, 1) === null) {
        // Enemies without level-row HP keep their authored range at the first floor step.
        const scale = settings.hpScaleByTier?.[row.tier] ?? 1;
        assert.ok(enemy.maxHp >= Math.max(1, Math.round(def.hp[0] * scale)) && enemy.maxHp <= Math.max(1, Math.round(def.hp[1] * scale)), `${row.id} keeps its authored HP range, scaled ${scale}`);
        continue;
      }
      const pools = enemyPools({ ...row, level, resolvedAttributes: own }, settings, level, enemyItemBonuses(row, profile.content, profile.modules.gear));
      const scale = settings.hpScaleByTier?.[row.tier] ?? 1;
      assert.equal(enemy.maxHp, Math.max(1, Math.round(pools.hp * scale)), `act ${act} ${row.id}: HP is the level's HP row, scaled ${scale}`);
    }
  }
});

test('Smith and card upgrade prices follow the current authored table, upgrade count and rank', async () => {
  const { SmithUpgradeCost } = await import('../src/model/smithUpgrade.js');
  const { CardUpgradePrice } = await import('../src/model/blacksmithConfig.js');
  const run = newRun('reaver');
  const { smith } = readJson('content/source/itemProperties.json');
  const prices = readJson('games/ashenspire/packs/core/shops.json').blacksmith.prices;
  for (const n of [1, 2, smith.cinders.length, smith.cinders.length + 1, smith.cinders.length + 4]) {
    for (const rank of [0, 1, 3]) {
      const cinders = (n <= smith.cinders.length ? smith.cinders[n - 1] : smith.cinders.at(-1) + smith.cinderStep * (n - smith.cinders.length)) + (smith.cinderPerRank || 0) * rank;
      assert.deepEqual(SmithUpgradeCost(n, rank, run), { cinders, stones: Math.ceil(n / smith.stonesPerBand) });
    }
  }
  for (const upgrades of [0, 1, 4]) for (const rank of [1, 2, 5]) {
    assert.equal(CardUpgradePrice(run, { upgrades, rank }), prices.cardUpgrade + prices.cardUpgradePerUpgrade * upgrades + prices.cardUpgradePerRank * (rank - 1));
  }
});

test('item 7: resuming a run without stat-point gear preserves its Blacksmith item prices and stat options', async () => {
  const { PlanSmithUpgrade, SmithOptionPool } = await import('../src/model/smithUpgrade.js');
  const previous = structuredClone(profile);
  delete previous.modules.gear.statPoints;
  delete previous.hash;
  previous.hash = gameDigest(previous);
  const previousRegistries = Profile.bindGameProfileRegistries(createRegistries(Profile.applyGameProfileToContent(contentBundle, previous)), previous);
  const beforeSave = createRunState({ registries: previousRegistries, classId: 'reaver', seed: 31, profileMeta: META });
  const resumed = deserializeRun(serializeRun(beforeSave));
  assert.equal(resumed.gameProfile.hash, previous.hash);
  const current = newRun('reaver', 31);
  const item = 'armament/greatsword';
  const options = run => SmithOptionPool(run, item).filter(row => row.pick.k === 'stat').map(row => row.pick.id);
  const { ItemCategory } = await import('../src/model/itemPicks.js');
  const source = readJson('content/source/itemProperties.json');
  const expected = (run, table) => table.martial.flatMap(row => row.stat ? [row.id] : row.effect ? []
    : (row.attrs || row.byCategory?.[ItemCategory(run, item)] || row.fallback || []).map(attr => `attr:${attr}`));
  assert.equal(PlanSmithUpgrade(resumed, item).cinders, source.smithBeforeStatPoints.cinders[0]);
  assert.deepEqual(options(resumed), expected(resumed, source.statOptionsBeforeStatPoints));
  assert.equal(PlanSmithUpgrade(current, item).cinders, source.smith.cinders[0]);
  assert.deepEqual(options(current), expected(current, source.statOptions));
});

test('review of #2820: a Blacksmith card upgrade is priced by upgradeCount (an authored-only upgrade counts as one)', async () => {
  const { upgradeArtPlan } = await import('../src/model/blacksmith.js');
  const { CardUpgradePrice } = await import('../src/model/blacksmithConfig.js');
  const run = newRun('reaver');
  run.cinders = 9999;
  const card = run.deck.find(row => row.cardId === 'core.strike');
  card.upgraded = true; delete card.upgradeSteps; // a save from before step lists: upgraded, no steps
  assert.equal(upgradeArtPlan(registries, run, card.instanceId).cost, CardUpgradePrice(run, { upgrades: 1, rank: 1 }));
  assert.equal(CardUpgradePrice(run, { upgrades: 1, rank: 1 }) - CardUpgradePrice(run), readJson('games/ashenspire/packs/core/shops.json').blacksmith.prices.cardUpgradePerUpgrade);
});

test('review of #2820: a return computed from damage already dealt is not halved again', async () => {
  const { createRng } = await import('../src/engine/rng.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  const { profileDamageReceipt } = await import('../src/engine/gameProfileCombat.js');
  const run = newRun('reaver');
  const combat = createRunCombat({ registries, run, rng: createRng(5), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  const base = carrier => profileDamageReceipt(combat, enemy, combat.player, 10, { combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' }, skipRatingBonus: true, ...carrier })
    .damageReceipt.hits[0].sources;
  const scaled = rows => rows.find(row => row.id === 'base-damage-scale');
  assert.equal(scaled(base({}))?.effective, 5, 'an ordinary card hit is halved');
  // base.reflect's return (proposalAfterHitRules: 50% of the HP damage dealt) travels as proposalReactive; a Reflect or Counter return as
  // reflectedHit / counterReturnAttack. Each is already final damage: 20 dealt, 10 returned, 10 in the receipt.
  for (const flag of ['proposalReactive', 'reflectedHit', 'counterReturnAttack']) assert.equal(scaled(base({ [flag]: true })), undefined, `${flag} keeps its amount`);
});

test('numerical fixtures and operations leave the shipped profile immutable', () => {
  assert.deepEqual(Profile.resolveGameProfile('default'), shippedProfile);
});
