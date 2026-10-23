import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch } from '../src/engine/combat.js';
import { rangePairKey } from '../src/model/combatEngagement.js';
import { enemyPlanActions } from '../src/engine/normalPreview.js';

const profile = resolveGameProfile('core');
const base = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const restrictions = { locked: { locked: true }, reaction: { reaction: { on: ['playerAction'], minIncoming: 1, chance: 1 } } };
function live(flags, weapon = 'straightSword', seed = 511) {
  const native = base.enemies.get('wanderingSoldier');
  const definition = { ...native, moves: { ...native.moves, advance: { ...native.moves.advance, ...flags } } };
  const registries = { ...base, enemies: { ...base.enemies, get: id => id === definition.id ? definition : base.enemies.get(id) } };
  const run = createRunState({ registries, classId: 'reaver', seed });
  run.loadout.sets.rightHand[0] = weapon;
  run.loadout.sets.leftHand[0] = null;
  const combat = createRunCombat({ registries, run, rng: createRng(seed), enemyIds: [definition.id] });
  return { combat, enemy: combat.enemies[0] };
}
function endTurn(combat) {
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  for (let count = 0; combat.pendingReaction; count++) {
    assert.ok(count < 20, 'normal reaction continuation completes');
    dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  }
  return combat.eventLog.slice(start);
}
for (const [kind, flags] of Object.entries(restrictions)) {
  test(`new-policy forecast cannot replace a distant attack with ${kind} closing`, () => {
    const { combat, enemy } = live(flags, 'shortbow', 2);
    assert.equal(enemy.maxStamina, 1);
    assert.equal(combat.rangeState.engagements[rangePairKey('player:player', `enemy:${enemy.id}`)], 2);
    assert.deepEqual(enemyPlanActions(combat, enemy).map(row => row.id), ['guard']);
    assert.equal(enemy.intent.moveId, 'guard');
  });
  test(`new-policy execution refuses ${kind} closing when distance changes after planning`, () => {
    const { combat, enemy } = live(flags);
    assert.equal(enemy.intent.moveId, 'slash', 'the native affordable attack was planned at Melee');
    const pair = rangePairKey('player:player', `enemy:${enemy.id}`);
    assert.equal(combat.rangeState.engagements[pair], 0);
    combat.rangeState.engagements[pair] = 2;
    const events = endTurn(combat);
    assert.deepEqual(events.filter(row => row.type === 'enemyMoveStarted').map(row => row.moveId), []);
    const refused = events.find(row => row.type === 'enemyMoveUnavailable');
    assert.ok(refused, 'the real planned root reaches payment refusal');
    assert.deepEqual([refused.moveId, refused.required, refused.available], ['slash', 3, 1]);
    assert.equal(combat.rangeState.engagements[pair], 2);
    assert.equal(enemy.stamina, 1, 'refusal spends no SP');
  });
  test(`old active fights retain their accepted ${kind} closing fallback`, () => {
    const { combat, enemy } = live(flags);
    assert.equal(enemy.intent.moveId, 'slash');
    delete combat.core2ActionRulesVersion;
    const pair = rangePairKey('player:player', `enemy:${enemy.id}`);
    combat.rangeState.engagements[pair] = 2;
    const events = endTurn(combat);
    assert.deepEqual(events.filter(row => row.type === 'enemyMoveStarted').map(row => row.moveId), ['advance']);
    assert.equal(combat.rangeState.engagements[pair], 1);
    assert.equal(enemy.stamina, 0);
  });
}
test('an unlocked closing move still executes and pays for exactly one band after distance changes', () => {
  const { combat, enemy } = live({ locked: true });
  assert.equal(enemy.intent.moveId, 'slash');
  enemy.unlockedMoves.push('advance');
  const pair = rangePairKey('player:player', `enemy:${enemy.id}`);
  combat.rangeState.engagements[pair] = 2;
  const events = endTurn(combat);
  assert.deepEqual(events.filter(row => row.type === 'enemyMoveStarted').map(row => row.moveId), ['advance']);
  assert.equal(events.filter(row => row.type === 'combatEngagementMoved').length, 1);
  assert.equal(combat.rangeState.engagements[pair], 1);
  assert.equal(enemy.stamina, 0);
});
