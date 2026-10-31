// Reflect stacks (owner 2026-10-31, SPEC §17): `reflectStacks` on the combat entity cuts each incoming hit by
// min(0.9, stacks x 0.3) before Block (rounded down) and sends floor(original x min(0.9, stacks x 0.3)) back at the attacker
// as a flagged hit that cannot reflect or counter again; each reflected hit costs one stack; stacks cap at 10 and clear with the fight.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { gainReflectStacks, reflectReduceFraction, reflectReturnFraction } from '../src/engine/guardStacks.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';
import { mechanics } from '../src/framework/data/mechanics.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function live() {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  combat.player.basePrecisionBonus = 1000;
  Object.assign(enemy, { hp: 500, maxHp: 500, statuses: {}, ratings: { poise: 20 }, ratingSources: [], attributes: { dexterity: 0 }, basePrecisionBonus: 1000, persistentPoise: { value: 0, max: 0 } });
  Object.assign(combat.player, { block: 0, persistentPoise: { value: 0, max: 0 } });
  return { combat, enemy };
}
function exchange(stacks, setup) {
  const { combat, enemy } = live();
  combat.player.reflectStacks = stacks;
  setup?.(combat, enemy);
  dispatch(combat, { type: 'setReactions', enabled: false });
  const start = combat.eventLog.length;
  const hp = combat.player.hp, enemyHp = enemy.hp;
  dispatch(combat, { type: 'endTurn' });
  const events = combat.eventLog.slice(start);
  return { combat, enemy, events, playerLoss: hp - combat.player.hp, enemyLoss: enemyHp - enemy.hp,
    reflected: events.find(e => e.type === 'reflectTriggered'),
    back: events.find(e => e.type === 'damageDealt' && e.targetId === enemy.id),
    taken: events.find(e => e.type === 'damageDealt' && e.targetId === 'player') };
}

test('fractions are data: 0.3 per stack, capped at 0.9', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 10].map(reflectReduceFraction), [0, 0.3, 0.6, 0.8999999999999999, 0.9, 0.9].map((v, i) => i === 3 ? Math.min(0.9, 3 * 0.3) : v));
  assert.equal(reflectReturnFraction(10), mechanics.reflect.reduceCap);
});

test('reduction: stacks cut the hit before Block, rounded down', () => {
  for (const stacks of [1, 2]) {
    const { reflected, taken } = exchange(stacks);
    assert.equal(taken.amount, Math.floor(reflected.original * (1 - stacks * 0.3)), `${stacks} stack(s)`);
    assert.equal(taken.hpLoss, taken.amount, 'no Block: all of it reaches HP');
  }
});

test('return: the attacker takes floor(original x stacks x 0.3) as a flagged hit; one stack is spent', () => {
  const { reflected, back, combat, events } = exchange(2);
  assert.equal(reflected.amount, Math.floor(reflected.original * 0.6));
  assert.equal(back.damageReceipt.hits[0].incoming, reflected.amount, 'the attacker took exactly the reflected amount before its own protection');
  assert.equal(back.sourceId, 'player');
  assert.equal(reflected.stacks, 2); assert.equal(reflected.stacksLeft, 1);
  assert.equal(combat.player.reflectStacks, 1, 'one stack lost per reflected hit');
  assert.equal(events.filter(e => e.type === 'reflectTriggered').length, 1);
});

test('cap: ten stacks cut and return 90%, not 300%', () => {
  const { reflected, taken, back } = exchange(10);
  assert.equal(taken.amount, Math.floor(reflected.original * 0.1 + 1e-9));
  assert.equal(back.damageReceipt.hits[0].incoming, Math.floor(reflected.original * 0.9));
});

test('no recursion: a reflected hit does not reflect again even into a Reflecting attacker', () => {
  const { events, enemy } = exchange(2, (combat, e) => { e.reflectStacks = 5; });
  assert.equal(events.filter(e => e.type === 'reflectTriggered').length, 1, 'only the first hit reflected');
  assert.equal(enemy.reflectStacks, 5, 'the attacker\'s Reflect was never spent by the return');
});

test('flagged and unreflectable hits are neither cut nor returned', () => {
  const { combat, enemy } = live();
  combat.player.reflectStacks = 3;
  const carrier = (extra = {}, traits = []) => ({ combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing', range: 'melee', targeting: 'single', traits }, ...extra });
  const plain = profileDamageReceipt(combat, enemy, combat.player, 20, carrier());
  assert.ok(plain.reflect, 'a plain hit reflects'); assert.equal(plain.reflect.stacks, 3);
  assert.equal(plain.damageReceipt.hits[0].incoming, Math.floor(plain.reflect.original * (1 - 0.9)));
  for (const [label, row] of [['unreflectable', carrier({}, ['unreflectable'])], ['reflected return', carrier({ reflectedHit: true })], ['counter return', carrier({ counterReturnAttack: true })]]) {
    const receipt = profileDamageReceipt(combat, enemy, combat.player, 20, row);
    assert.equal(receipt.reflect, undefined, label);
    assert.equal(receipt.damageReceipt.hits[0].incoming > plain.damageReceipt.hits[0].incoming, true, `${label} is not cut`);
  }
});

test('Mirror Guard grants 1 Reflect; stacks cap at mechanics.reflect.stackCap', () => {
  const { combat } = live();
  combat.piles.hand.push({ instanceId: 'mg1', cardId: 'core.mirrorGuard', upgraded: false });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'mg1' });
  assert.equal(combat.player.reflectStacks, 1);
  assert.equal(gainReflectStacks(combat, combat.player, 99), mechanics.reflect.stackCap - 1);
  assert.equal(combat.player.reflectStacks, mechanics.reflect.stackCap);
  assert.equal(gainReflectStacks(combat, combat.player, 1), 0);
});

test('snapshots round-trip reflectStacks, load without it, and refuse a count over the cap', () => {
  const { combat, enemy } = live();
  Object.assign(enemy, { ratings: { ar: 0, dr: 0, pr: 0, ward: 0, poise: 20 } });
  combat.player.reflectStacks = 4;
  const snapshot = serializeCombatSnapshot(combat);
  assert.deepEqual(combatSnapshotProblems(snapshot), []);
  const loaded = restoreCombatSnapshot({ registries: reg, rng: createRng(511, combat.rng.getCounters()), snapshot });
  assert.equal(loaded.player.reflectStacks, 4);
  const old = structuredClone(snapshot);
  delete old.player.reflectStacks;
  assert.deepEqual(combatSnapshotProblems(old), [], 'absent means 0');
  old.player.reflectStacks = 25;
  assert.deepEqual(combatSnapshotProblems(old), []);
  assert.equal(restoreCombatSnapshot({ registries: reg, rng: createRng(511, combat.rng.getCounters()), snapshot: old }).player.reflectStacks, mechanics.reflect.stackCap);
});

test('multi-hit previews spend one Reflect stack per landed hit, as live does', async () => {
  const { previewDamageHits } = await import('../src/engine/combatDamagePreview.js');
  const { combat, enemy } = live();
  combat.player.reflectStacks = 1;
  const carrier = { combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing', range: 'melee', targeting: 'single', traits: [] } };
  const view = previewDamageHits(combat, enemy, combat.player, 20, [], carrier, 2);
  const [first, second] = view.damageReceipt.hits.map(hit => hit.incoming);
  assert.equal(first, Math.floor(second * 0.7), 'only the first hit is cut (1 stack = 30%)');
  assert.equal(combat.player.reflectStacks, 1, 'the preview works on a detached copy');
});

test('integer arithmetic: 10 incoming at 4 stacks leaves 1; 30 original at 3 stacks returns 27', async () => {
  const { reflectCut, reflectReturned } = await import('../src/engine/guardStacks.js');
  assert.equal(reflectCut(10, 4), 1); assert.equal(reflectCut(10, 3), 1);
  assert.equal(reflectReturned(30, 3), 27); assert.equal(reflectReturned(30, 10), 27);
  const { combat, enemy } = live();
  combat.player.reflectStacks = 4;
  const carrier = { combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing', range: 'melee', targeting: 'single', traits: [] } };
  const receipt = profileDamageReceipt(combat, enemy, combat.player, 10, carrier);
  assert.equal(receipt.damageReceipt.hits[0].incoming, reflectCut(receipt.reflect.original, 4), 'preview receipt == helper == live path');
});

test('Mirror Guard\'s face states the amount: 1 Reflect, 2 upgraded', async () => {
  const { cardFaceLines } = await import('../src/model/cardFaceText.js');
  const { combat } = live();
  const face = upgraded => { combat.piles.hand.push({ instanceId: `mf${upgraded}`, cardId: 'core.mirrorGuard', upgraded }); const { previewCard } = globalThis.__pv; const view = previewCard(combat, `mf${upgraded}`); return (cardFaceLines(view.resolvedDefinition, view, reg) || []).map(l => l.html).join(' ').replace(/<[^>]+>/g, ''); };
  globalThis.__pv = await import('../src/engine/combat.js');
  assert.match(face(false), /\b1\b.*Reflect|Reflect.*\b1\b/);
  assert.match(face(true), /\b2\b.*Reflect|Reflect.*\b2\b/);
});
