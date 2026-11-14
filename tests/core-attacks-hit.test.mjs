// Owner, 2026-11-14: attacks always hit. With accuracy.hitRoll false no die is drawn for any attacker, an in-range attack
// connects, and a stack of Evade cancels exactly the next attack against its holder. A fight saved before this ruling
// (its rules lack the key) keeps rolling the d20.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from './withoutWeaknesses.mjs';
import { dispatch } from '../src/engine/combat.js';
import { attackHitPreview, resolveAttackHit, evadeStackGain } from '../src/engine/stanceHit.js';
import { legacyHitRoll } from './legacyHitRules.mjs';
import { gameProfileRewardPools } from '../src/model/gameProfileRewards.js';
import { fixCoreStatusDefinition } from '../src/model/fixCoreMechanics.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const melee = { combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' } };
const draws = combat => combat.rng.getCounters().combatAvoidance || 0;
function live(seed = 511) {
  const run = createRunState({ registries: reg, classId: 'reaver', seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(seed), enemyIds: ['wanderingSoldier'] });
  const target = combat.enemies[0];
  Object.assign(target, { hp: 500, maxHp: 500, block: 0, statuses: {} });
  delete target.combatStance; delete target.combatCounter;
  for (const entity of [combat.player, target]) entity.statuses = {};
  return { run, combat, target };
}

test('the shipped rules switch the hit roll off', () => {
  const { combat } = live();
  assert.equal(combat.fixCoreRules.accuracy.hitRoll, false);
  assert.equal(combat.fixCoreRules.accuracy.evadeStacksPerCard, 1);
});

test('300 player attacks and 300 enemy attacks in range all hit and draw nothing from combatAvoidance', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const { combat, target } = live(seed);
    const before = draws(combat);
    const out = resolveAttackHit(combat, combat.player, target, melee);
    const back = resolveAttackHit(combat, target, combat.player, melee);
    assert.equal(out.hit, true, `player attack ${seed}`); assert.equal(back.hit, true, `enemy attack ${seed}`);
    assert.equal(out.hitChance, 100); assert.deepEqual(out.dice, []); assert.equal(out.d20, null);
    assert.equal(draws(combat), before, `seed ${seed} drew a die`);
  }
});

test('real card plays land every time and never touch the avoidance stream', () => {
  const { combat, target } = live(7);
  const before = draws(combat);
  let plays = 0;
  for (const card of combat.piles.hand.filter(row => reg.cards.get(row.cardId).type === 'attack')) {
    combat.player.stamina = 10;
    const hp = target.hp;
    dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: target.id });
    plays++;
    assert.ok(target.hp < hp, 'the attack connected and took HP');
  }
  assert.ok(plays > 0);
  assert.equal(combat.eventLog.filter(event => event.type === 'attackMissed').length, 0, 'no attack missed');
  assert.equal(draws(combat), before);
});

test('a target with 2 Evade makes exactly the next two hits miss, reads Evaded, and holds 0 afterwards', () => {
  const { combat, target } = live();
  target.statuses.evade = { stacks: 2 };
  const before = draws(combat), events = [];
  const emit = combat.emit; combat.emit = (type, data) => { events.push([type, data]); return emit.call(combat, type, data); };
  const preview = attackHitPreview(combat, combat.player, target, melee);
  assert.equal(preview.hitChance, 0); assert.equal(preview.evadeAttempted, true);
  const hits = [1, 2, 3].map(() => resolveAttackHit(combat, combat.player, target, melee).hit);
  combat.emit = emit;
  assert.deepEqual(hits, [false, false, true]);
  assert.equal(target.statuses.evade?.stacks || 0, 0);
  assert.equal(draws(combat), before);
  const missed = events.filter(([type]) => type === 'attackMissed');
  assert.equal(missed.length, 2);
  assert.ok(missed.every(([, data]) => data.label === 'Evaded' && data.missReason === 'evaded'));
  // The same holds when the enemy is the attacker and the player holds the Evade.
  combat.player.statuses.evade = { stacks: 1 };
  assert.deepEqual([1, 2].map(() => resolveAttackHit(combat, target, combat.player, melee).hit), [false, true]);
});

test('an attack that bypasses Evade ignores it and keeps the stack', () => {
  const { combat, target } = live();
  target.statuses.evade = { stacks: 2 };
  const spell = { combatProfile: { camp: 'spell', maneuver: 'casting', range: 'melee' }, tags: ['target'] };
  const result = resolveAttackHit(combat, combat.player, target, spell);
  assert.equal(result.hit, true); assert.equal(result.bypass, true);
  assert.equal(target.statuses.evade.stacks, 2);
});

test('out of range still misses without a die', () => {
  const { combat, target } = live();
  // One band apart: a melee attack cannot reach.
  for (const key of Object.keys(combat.rangeState.engagements)) combat.rangeState.engagements[key] = 1;
  const before = draws(combat);
  const result = resolveAttackHit(combat, combat.player, target, { combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' } });
  assert.equal(result.hit, false); assert.equal(result.missReason, 'range');
  assert.equal(draws(combat), before);
});

test('the Evade cards grant exactly one stack, and Evade reads what it does', () => {
  const { combat } = live();
  for (const id of ['core.evade', 'core.closingDodge', 'core.backstep']) {
    const def = reg.cards.get(id);
    assert.equal(evadeStackGain(combat, combat.player, def), 1, id);
  }
  const status = fixCoreStatusDefinition(combat, 'evade', reg.statuses.get('evade'), combat.player);
  assert.match(status.tooltip, /The next attack against you misses\./);
  const face = ['core.evade', 'core.closingDodge', 'core.backstep'].map(id => reg.cards.get(id).textTemplate);
  assert.ok(face.every(text => text.startsWith('Gain {evade} Evade.')));
});

test('Precision is gone from the cards that granted it, and out of every new offer', () => {
  for (const id of ['core.steadyGuard', 'core.glimpse', 'core.wardingGlance', 'core.palmFlame']) {
    const def = reg.cards.get(id);
    for (const effects of [def.effects, def.upgrade?.effects || []]) assert.ok(!effects.some(effect => effect.status === 'precision'), id);
    assert.ok(!/Precision/.test(def.textTemplate), id);
  }
  assert.ok(reg.cards.has('core.guidingWhisper'), 'saved decks still resolve it');
  const { run } = live();
  const pool = gameProfileRewardPools(reg, run).combatCards;
  assert.ok(!pool.includes('core.guidingWhisper')); assert.ok(!pool.includes('base.evade'));
  assert.ok(pool.includes('core.evade'));
});

test('legacy rules still roll the d20 (a fight saved before this ruling)', () => {
  const { combat, target } = live();
  legacyHitRoll(combat);
  const before = draws(combat);
  resolveAttackHit(combat, combat.player, target, melee);
  assert.equal(draws(combat), before + 1);
  assert.equal(evadeStackGain(combat, combat.player, reg.cards.get('core.evade')), 3);
  target.statuses.evade = { stacks: 1 };
  const preview = attackHitPreview(combat, combat.player, target, melee);
  assert.ok(preview.hitChance > 0 && preview.hitChance < 100);
});

test('rules saved without the key keep rolling', () => {
  const { combat, target } = live();
  delete combat.fixCoreRules.accuracy.hitRoll;
  const before = draws(combat);
  resolveAttackHit(combat, combat.player, target, melee);
  assert.equal(draws(combat), before + 1);
});

test('a multi-hit attack is evaded hit by hit: each Evade stack cancels one hit', () => {
  for (const [stacks, landed] of [[0, 3], [1, 2], [2, 1], [3, 0], [5, 0]]) {
    const { combat, target } = live(1);
    if (stacks) target.statuses.evade = { stacks };
    combat.piles.hand.push({ instanceId: 'multi', cardId: 'base.multi-hit', upgraded: false });
    combat.player.stamina = 10;
    const n = combat.eventLog.length;
    dispatch(combat, { type: 'playCard', cardInstanceId: 'multi', targetId: target.id });
    const fresh = combat.eventLog.slice(n);
    assert.equal(fresh.filter(event => event.type === 'damageDealt' && event.targetId === target.id).length, landed, `${stacks} Evade`);
    assert.equal(fresh.filter(event => event.type === 'attackMissed').every(event => event.label === 'Evaded'), true);
    assert.equal(target.statuses.evade?.stacks || 0, Math.max(0, stacks - 3));
  }
});
