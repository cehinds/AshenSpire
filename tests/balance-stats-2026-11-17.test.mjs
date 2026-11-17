// Owner playtest 2026-11-17, theme A (combat math): docs/feedback/2026-11-17-playtest.md items 1-7.
// Each rule is checked against the shipped default game profile (Core 2), not against copied numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import * as Profile from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { deriveStat } from '../src/model/derivedStats.js';
import { gameProfileEffectiveAttributes } from '../src/model/gameProfileRun.js';

const profile = Profile.resolveGameProfile('default');
const registries = Profile.bindGameProfileRegistries(createRegistries(Profile.applyGameProfileToContent(contentBundle, profile)), profile);
const META = { gameProfileUnlocks: { [profile.id]: { completedRunIds: ['a', 'b', 'c'] } } };
const newRun = (classId, seed = 7) => createRunState({ registries, classId, seed, profileMeta: META });

test('item 3: Core player HP is 30 + 5 x (CON + level), relic HP on top', () => {
  for (const classId of ['reaver', 'starseer', 'rogue', 'herald']) {
    const run = newRun(classId);
    const attributes = gameProfileEffectiveAttributes(registries, run);
    const relicFlat = deriveStat(run.derivedStatRuleSnapshot.rules, 'hp', { attributes, classDef: registries.classes.get(classId), level: 1 }).value
      - (30 + 5 * (attributes.constitution + 1));
    assert.ok(relicFlat >= 0, `${classId}: a starting relic never lowers HP`);
    assert.equal(run.maxHp, 30 + 5 * (attributes.constitution + 1) + relicFlat, `${classId} level 1`);
    for (const level of [5, 10]) {
      for (const constitution of [1, 3]) {
        const hp = deriveStat(run.derivedStatRuleSnapshot.rules, 'hp', { attributes: { ...attributes, constitution }, classDef: registries.classes.get(classId), level }).value;
        assert.equal(hp, 30 + 5 * (constitution + level) + relicFlat, `${classId} level ${level} CON ${constitution}`);
      }
    }
  }
});

test('item 1: Core halves every card\'s base damage, rounded up, before AR or PR adds', async () => {
  const { createRng } = await import('../src/engine/rng.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  const { dispatch } = await import('../src/engine/combat.js');
  const { firstAffordableCard, botCardTargetId } = await import('../tools/simbot.mjs');
  assert.equal(profile.modules.effects.baseDamageMultiplier, 0.5);
  let checked = 0;
  for (const classId of ['reaver', 'rogue', 'starseer', 'herald']) {
    const run = newRun(classId, 11);
    const combat = createRunCombat({ registries, run, rng: createRng(11), enemyIds: ['wanderingSoldier'] });
    for (let plays = 0; plays < 6 && combat.phase === 'player' && !combat.result; plays++) {
      const card = firstAffordableCard(registries, combat, new Set());
      if (!card) break;
      const mark = combat.eventLog.length;
      try { dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: botCardTargetId(registries, combat, card, combat.enemies[0].id) }); } catch { break; }
      for (const event of combat.eventLog.slice(mark)) {
        for (const hit of event.type === 'damageDealt' ? event.damageReceipt?.hits || [] : []) {
          const base = hit.sources.find(row => row.id === 'base')?.amount;
          const scale = hit.sources.find(row => row.id === 'base-damage-scale');
          if (!(base > 0)) continue;
          assert.equal(scale ? scale.effective : base, Math.ceil(base / 2), `${classId}: base ${base} scales to ${Math.ceil(base / 2)}`);
          checked++;
        }
      }
    }
  }
  assert.ok(checked >= 4, `enough player hits were checked: ${checked}`);
});

test('item 5: one more SP (Actions) or MP costs 3 attribute points; no other attribute feeds them', () => {
  for (const classId of ['reaver', 'starseer', 'rogue', 'herald']) {
    const run = newRun(classId);
    const rules = run.derivedStatRuleSnapshot.rules, classDef = registries.classes.get(classId);
    const ones = { strength: 1, dexterity: 1, constitution: 1, wisdom: 1, intelligence: 1 };
    const at = (id, attributes, level = 1) => deriveStat(rules, id, { attributes: { ...ones, ...attributes }, classDef, level }).value;
    for (const [pool, attribute] of [['stamina', 'constitution'], ['mana', 'wisdom']]) {
      const base = at(pool, { [attribute]: 0 });
      for (const points of [1, 2, 3, 5, 6, 9, 10]) assert.equal(at(pool, { [attribute]: points }) - base, Math.floor(points / 3), `${classId} ${pool}: ${attribute} ${points}`);
      for (const other of ['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence'].filter(id => id !== attribute)) {
        assert.equal(at(pool, { [other]: 12 }), at(pool, {}), `${classId} ${pool} ignores ${other}`);
      }
    }
  }
});

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

test('item 4: Core armour and armaments grant 1-3 attribute points (average 1-2) and a Poise value, never AR or DR', async () => {
  const { resolveGearItem } = await import('../engine/kernel/gameConfig.js');
  const settings = profile.modules.gear;
  const totals = [];
  for (const item of profile.content.gear) {
    const resolved = resolveGearItem(item, settings);
    const attributes = ['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence'].reduce((sum, id) => sum + resolved.points[id], 0);
    assert.equal(resolved.values.ar, 0, `${item.id} AR`);
    assert.equal(resolved.values.dr, 0, `${item.id} DR`);
    assert.ok(attributes >= 1 && attributes <= 3, `${item.id}: ${attributes} attribute points`);
    assert.ok(resolved.values.poise > 0, `${item.id} has a Poise value`);
    totals.push(attributes);
    // A Smith tier adds an attribute point, still never AR or DR.
    const tiered = resolveGearItem(item, settings, { rank: (item.rank ?? 1) + 2 });
    assert.equal(tiered.values.ar + tiered.values.dr, 0, `${item.id} tiered`);
    assert.equal(['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence'].reduce((sum, id) => sum + tiered.points[id], 0), attributes + 2, `${item.id} +2 ranks`);
  }
  const average = totals.reduce((a, b) => a + b, 0) / totals.length;
  assert.ok(average >= 1 && average <= 2, `average ${average}`);
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

test('item 6: Core elites and bosses fight at their act level (elites 2/4/6, bosses 4/6/8); normal enemies are unchanged', async () => {
  const { createRng } = await import('../src/engine/rng.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  const { characterSettings, enemyPools, enemyItemBonuses } = await import('../engine/kernel/gameConfig.js');
  const settings = characterSettings(profile.modules);
  const LEVELS = { elite: [2, 4, 6], boss: [4, 6, 8] };
  for (const act of [1, 2, 3]) {
    for (const row of profile.content.enemies) {
      const run = newRun('reaver', 5);
      run.actNumber = act;
      const enemy = createRunCombat({ registries, run, rng: createRng(5), enemyIds: [row.id] }).enemies[0];
      const def = registries.enemies.get(row.id);
      if (!LEVELS[row.tier]) {
        assert.ok(enemy.maxHp >= def.hp[0] && enemy.maxHp <= def.hp[1], `${row.id} keeps its authored HP`);
        assert.equal(enemy.level === undefined || enemy.level <= 5, true, `${row.id} keeps its own level`);
        continue;
      }
      const level = LEVELS[row.tier][act - 1];
      assert.equal(enemy.level, level, `act ${act} ${row.tier} ${row.id} level`);
      // The fight's own seeded spread (variance moves points, never the total).
      const own = enemy.ownAttributes;
      assert.equal(Object.values(own).reduce((a, b) => a + b, 0), 5 + level, `${row.id}: budget 5 + level`);
      const pools = enemyPools({ ...row, level, resolvedAttributes: own }, settings, level, enemyItemBonuses(row, profile.content, profile.modules.gear));
      assert.equal(enemy.maxHp, pools.hp, `act ${act} ${row.id}: HP is the level's HP row`);
    }
  }
});
