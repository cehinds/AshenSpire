// Theme B of the 2026-11-17 playtest (owner): status and stance rules.
// Rule 1: Counter follows the normal decay rule. Its stacks lose 1 at the owner's turn start, and the armed Counter lasts while they do.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { fixCoreMechanics as shipped } from '../src/content/generated/fixCoreMechanics.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const SLASH = { kind: 'attack', moveId: 'slash', damage: 8, hits: 1,
  combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing', range: 'melee', targeting: 'single', traits: [], stanceTrigger: false } };

function live({ enemyId = 'wanderingSoldier', rules = null } = {}) {
  const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: [enemyId] });
  if (rules) rules(combat.fixCoreRules);
  const enemy = combat.enemies[0];
  delete combat.reactionRules.contactPolicy;
  Object.assign(combat.player, { basePrecisionBonus: 1000, hp: 9999, maxHp: 9999, energy: 99 });
  Object.assign(enemy, { hp: 5000, maxHp: 5000, statuses: {}, ratingSources: [], basePrecisionBonus: 1000 });
  dispatch(combat, { type: 'setReactions', enabled: false });
  return { combat, enemy };
}
const play = (combat, id, cardId, extra = {}) => { combat.piles.hand.push({ instanceId: id, cardId, ...extra }); dispatch(combat, { type: 'playCard', cardInstanceId: id }); };
const endTurn = combat => { const from = combat.eventLog.length; dispatch(combat, { type: 'endTurn' }); return combat.eventLog.slice(from); };
const attackNext = enemy => {
  enemy.combatStance = { maneuver: 'attack', camp: 'physical', range: 'melee' };
  Object.assign(enemy, { maxStamina: 3, stamina: 3, plannedMoves: [] });
  enemy.intent = { ...enemy.intent, ...SLASH };
};

test('rule 1: Counter stacks lose 1 at the owner turn start and the Counter stays armed while stacks remain', () => {
  const { combat, enemy } = live();
  combat.player.counterStacks = 2;
  play(combat, 'c', 'core.counter');
  assert.equal(combat.player.counterStacks, 3);
  attackNext(enemy);
  const first = endTurn(combat);
  assert.equal(first.filter(e => e.type === 'combatCounterTriggered').length, 1, 'the covered hit is answered');
  assert.deepEqual(first.filter(e => e.type === 'counterStacksChanged').map(e => [e.amount, !!e.consumed, !!e.decay]), [[-1, true, false], [-1, false, true]],
    'the hit spends 1, then 1 fades at the turn start');
  assert.equal(combat.player.counterStacks, 1);
  assert.ok(combat.player.combatCounter?.charges > 0, 'the Counter is still armed with 1 stack left (it used to expire at the turn start)');
  attackNext(enemy);
  const second = endTurn(combat);
  const answer = second.find(e => e.type === 'combatCounterTriggered');
  assert.ok(answer, 'the next turn the remaining stack still answers a covered hit');
  assert.deepEqual(answer.counterHits.map(row => row.stacksBefore), [1]);
  assert.equal(combat.player.counterStacks ?? 0, 0);
  assert.equal(combat.player.combatCounter, undefined, 'the Counter ends with its last stack');
});

test('rule 1: with no stack left at the turn start the Counter expires as before', () => {
  const { combat } = live();
  play(combat, 'c', 'core.counter');
  assert.equal(combat.player.counterStacks, 1);
  combat.enemies[0].intent = { ...combat.enemies[0].intent, kind: 'block', damage: undefined, hits: undefined };
  endTurn(combat);
  assert.equal(combat.player.counterStacks ?? 0, 0, 'the one stack fades');
  assert.equal(combat.player.combatCounter, undefined);
});

test('rule 1: a fight saved without counter.armedWhileStacks keeps the old expiry at the turn start', () => {
  const { combat, enemy } = live({ rules: rules => { delete rules.counter.armedWhileStacks; } });
  combat.player.counterStacks = 2;
  play(combat, 'c', 'core.counter');
  attackNext(enemy);
  endTurn(combat);
  assert.equal(combat.player.counterStacks, 1);
  assert.equal(combat.player.combatCounter, undefined, 'old rule: the charge clears although a stack remains');
});

test('rule 1: the shipped data turns the rule on', () => {
  assert.equal(shipped.counter.armedWhileStacks, true);
  assert.equal(shipped.counter.decayPerTurn, 1);
});
