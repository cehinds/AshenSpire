// Owner, 2026-11-01 (SPEC 4.1a): Ward and Barrier are stacked statuses.
// Ward: all damage meets Poise first, then Block, then HP; one stack decays at the holder's turn start.
// Barrier: each stack is +5 maximum and current Poise; one stack decays per turn, taking its +5 maximum with it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import * as S from '../src/engine/statuses.js';
import * as A from '../src/engine/actions.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function liveCore() {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  delete combat.player.combatStance;
  return combat;
}
function hit(carrier, { block = 0, poise = 0, ward = 1, amount = 10 } = {}) {
  const combat = liveCore(), target = combat.enemies[0];
  Object.assign(target, { block, persistentWard: null, persistentPoise: { value: poise, max: Math.max(20, poise) }, gameProfilePoise: 0, statuses: ward ? { ward: { stacks: ward } } : {} });
  delete target.combatStance;
  delete target.weaknesses;
  const receipt = profileDamageReceipt(combat, combat.player, target, amount, { ...carrier, skipRatingBonus: true }, { roll: 0 });
  return { receipt, combat, target, poiseAfter: poise - receipt.poiseMitigated, blockAfter: receipt.blockRemaining };
}
const physical = { combatProfile: { camp: 'physical', damageType: 'slashing' } };
const spell = { combatProfile: { camp: 'spell', damageType: 'fire', magicShare: 1 } };

for (const [name, carrier] of [['physical', physical], ['magic', spell]]) {
  test(`Ward: a ${name} hit meets Poise first, 100%, before Block`, () => {
    const r = hit(carrier, { poise: 20, block: 5 });
    assert.equal(r.receipt.wardRouted, true);
    assert.equal(r.poiseAfter, 10, 'all 10 went to Poise');
    assert.equal(r.blockAfter, 5, 'Block is untouched');
    assert.equal(r.receipt.hpLoss, 0);
    const ids = r.receipt.damageReceipt.hits[0].sources.map(s => s.id);
    assert.ok(ids.includes('ward-poise'), 'the receipt shows where the damage went');
  });
  test(`Ward: ${name} overflow past Poise spills to Block, then HP`, () => {
    const r = hit(carrier, { poise: 4, block: 3 });
    assert.equal(r.poiseAfter, 0);
    assert.equal(r.receipt.blocked, 3);
    assert.equal(r.blockAfter, 0);
    assert.equal(r.receipt.hpLoss, 3, '10 - 4 Poise - 3 Block');
    assert.equal(r.receipt.amount, 6, 'HP lost 3 + Block 3 (Poise is reported apart)');
  });
  test(`Ward off: the ${name} hit does not take the Ward lane`, () => {
    assert.notEqual(hit(carrier, { poise: 20, block: 5, ward: 0 }).receipt.wardRouted, true);
  });
}

test('Ward: with no Poise the whole hit meets Block then HP', () => {
  const r = hit(physical, { poise: 0, block: 4 });
  assert.equal(r.receipt.hpLoss, 6);
  assert.equal(r.receipt.blocked, 4);
});

test('Ward decays by 1 at the start of its holder\'s turn, on the shared status hook', () => {
  const combat = liveCore(), e = combat.enemies[0];
  S.applyStatus(combat, e, 'ward', 3, combat.player);
  assert.equal(S.getStacks(e, 'ward'), 3);
  S.decayAtTurnStart(combat, e);
  assert.equal(S.getStacks(e, 'ward'), 2);
  e.fixCoreDecayRound = null; combat.turn += 1;
  S.decayAtTurnStart(combat, e); S.decayAtTurnStart(combat, e);
  assert.equal(S.getStacks(e, 'ward'), 1, 'one decay per holder turn');
});

test('Barrier: each stack is +5 maximum and +5 current Poise', () => {
  const combat = liveCore(), e = combat.enemies[0];
  const { max, value } = e.persistentPoise;
  S.applyStatus(combat, e, 'barrier', 2, combat.player);
  assert.equal(e.persistentPoise.max, max + 10);
  assert.equal(e.persistentPoise.value, value + 10);
});

test('Barrier: a stack lost takes its +5 maximum and current Poise clamps to the new maximum', () => {
  const combat = liveCore(), e = combat.enemies[0];
  const { max } = e.persistentPoise;
  S.applyStatus(combat, e, 'barrier', 2, combat.player);
  S.decayAtTurnStart(combat, e);
  assert.equal(S.getStacks(e, 'barrier'), 1);
  assert.equal(e.persistentPoise.max, max + 5);
  assert.equal(e.persistentPoise.value, max + 5, 'full Poise clamps down with the maximum');
  e.fixCoreDecayRound = null; combat.turn += 1;
  S.decayAtTurnStart(combat, e);
  assert.equal(S.getStacks(e, 'barrier'), 0);
  assert.equal(e.persistentPoise.max, max);
  assert.equal(e.persistentPoise.value, max);
  assert.equal(e.persistentPoise.barrierBonus, undefined);
});

test('Barrier keeps damaged Poise below the maximum when a stack decays', () => {
  const combat = liveCore(), e = combat.enemies[0];
  const { max } = e.persistentPoise;
  S.applyStatus(combat, e, 'barrier', 1, combat.player);
  e.persistentPoise.value = 3;
  S.decayAtTurnStart(combat, e);
  assert.equal(e.persistentPoise.max, max);
  assert.equal(e.persistentPoise.value, 3);
});

test('Mote Shield gains Block, Barrier and Ward, and says so', () => {
  const def = reg.cards.get('core.moteShield');
  const ops = def.effects.map(e => `${e.op}:${e.status || ''}:${e.amount ?? e.stacks ?? ''}`);
  assert.ok(ops.includes('applyStatus:barrier:1'), ops.join());
  assert.ok(ops.some(o => o.startsWith('applyStatus:ward:')), ops.join());
  assert.match(def.textTemplate, /Barrier/); assert.match(def.textTemplate, /Ward/);
  const up = def.upgrade.effects.map(e => `${e.op}:${e.status || ''}:${e.amount ?? e.stacks ?? ''}`);
  assert.ok(up.includes('applyStatus:barrier:2')); assert.ok(up.includes('applyStatus:ward:2'), up.join());
});

test('the roll log shows where a warded hit went: Poise first, then Block, then HP', async () => {
  const { combatLogEntries } = await import('../src/model/combatLog.js');
  const enemies = [{ id: 'e1', enemyId: 'graveWisp' }];
  const [line] = combatLogEntries([{ type: 'damageDealt', sourceId: 'e1', targetId: 'player', amount: 6, blocked: 3, blockRemaining: 0,
    poiseAbsorbed: 4, poiseRemaining: 0, wardRouted: true }], { enemies }).map(row => row.text);
  assert.match(line, /Ward: Poise absorbed 4 \(4 → 0\), Block absorbed 3 \(3 → 0\)/);
  assert.match(line, /3 HP dealt\.$/);
});

test('a live warded hit reports wardRouted, Poise, Block and HP on damageDealt', () => {
  const combat = liveCore(), target = combat.enemies[0];
  Object.assign(target, { block: 3, persistentWard: null, persistentPoise: { value: 4, max: 20 }, gameProfilePoise: 0, statuses: { ward: { stacks: 1 } } });
  delete target.combatStance; delete target.weaknesses;
  target.hp = target.maxHp = 100;
  const start = combat.eventLog.length;
  A.applyAttackDamage(combat, combat.player, target, 10, [], { ...physical, skipRatingBonus: true });
  const hit = combat.eventLog.slice(start).find(e => e.type === 'damageDealt' && e.targetId === target.id);
  assert.ok(hit, 'a damageDealt event');
  assert.equal(hit.wardRouted, true);
  assert.equal(hit.poiseAbsorbed, 4);
  assert.equal(hit.blocked, 3);
  assert.equal(100 - target.hp, 3, 'the rest reaches HP');
});

test('old saves: a combat snapshot holding the numeric barrier loads and drops it', async () => {
  const { serializeCombatSnapshot, restoreCombatSnapshot } = await import('../src/engine/combatSnapshot.js');
  const combat = liveCore();
  combat.player.barrier = 7; combat.enemies[0].barrier = 3;
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  const restored = restoreCombatSnapshot({ registries: reg, rng: createRng(combat.rng.seed, combat.rng.getCounters()), snapshot: saved });
  assert.equal('barrier' in restored.player, false, 'the old pool is dropped');
  assert.equal('barrier' in restored.enemies[0], false);
  assert.equal(restored.player.hp, combat.player.hp);
});
