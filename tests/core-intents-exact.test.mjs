// Owner, 2026-11-14: every enemy move is shown exactly. With perception.roll false every read is exact and draws nothing from
// the two intent streams; the player sees the current move, its stance, a prepared Counter and every later action. A fight saved
// before this ruling (its rules lack the key) keeps rolling the perception check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from './withoutWeaknesses.mjs';
import { previewCard, previewIntent } from '../src/engine/combat.js';
import { knowledgeIntentProjection } from '../src/engine/enemyKnowledge.js';
import { enemyPlanActions } from '../src/engine/normalPreview.js';
import { followUpSymbols, perceptionLevel, readStage } from '../src/ui/models/CombatRoundsScreenModel.js';
import { rollKnowledgeRead } from '../src/model/enemyIntentKnowledge.js';
import { legacyPerceptionRoll } from './legacyHitRules.mjs';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const streams = combat => { const c = combat.rng.getCounters(); return [c.enemyIntentVisibility || 0, c.enemyIntentClue || 0]; };
const enemyIds = [...reg.enemies.all?.() ?? []].map(row => row.id).filter(Boolean);
function fight(seed, ids) {
  const run = createRunState({ registries: reg, classId: 'reaver', seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  return createRunCombat({ registries: reg, run, rng: createRng(seed), enemyIds: ids });
}
const ids = ['wanderingSoldier'];

test('the shipped rules switch the perception roll off', () => {
  assert.equal(fight(1, ids).fixCoreRules.perception.roll, false);
});

test('over 100 seeded fights every read is exact and neither intent stream is drawn', () => {
  const pool = enemyIds.length ? enemyIds : ids;
  for (let seed = 1; seed <= 100; seed++) {
    const combat = fight(seed, [pool[seed % pool.length]]);
    assert.deepEqual(streams(combat), [0, 0], `seed ${seed} drew an intent stream`);
    for (const enemy of combat.enemies) {
      const reads = Object.values(enemy.knowledgeAction.reads);
      assert.ok(reads.length > 0);
      for (const read of reads) { assert.equal(read.visibility, 'exact'); assert.equal(read.label, null); }
      assert.equal(knowledgeIntentProjection(combat, enemy).exact, true);
      const intent = previewIntent(combat, enemy.id);
      assert.notEqual(intent.hidden, true, `seed ${seed} ${enemy.enemyId}`);
      assert.ok(intent.moveId, 'the move is named');
    }
    assert.equal(combat.eventLog.filter(event => event.type === 'perceptionRolled').length, 0);
  }
});

test('the preview keeps the enemy stance and a prepared Counter with its return amount', () => {
  const combat = fight(3, ids);
  const enemy = combat.enemies[0];
  enemy.combatStance = { maneuver: 'counter', camp: 'physical', range: 'melee' };
  enemy.combatCounter = { charges: 1, expiresOnOwnerCycle: 9, carrier: { combatProfile: { camp: 'physical', maneuver: 'counter', range: 'melee' } }, serial: 1 };
  const card = combat.piles.hand.find(row => row.cardId === 'core.strike') || combat.piles.hand[0];
  // The visible copy the player prices a card against must still hold the enemy's Counter, not strip it as an unread move.
  let seen = null;
  const view = {};
  previewCard(combat, card.instanceId, enemy.id, undefined, { knowledgeView: view });
  seen = view.visible?.enemies.find(row => row.id === enemy.id);
  assert.ok(seen, 'a detached visible copy was made');
  assert.deepEqual(seen.combatStance, enemy.combatStance);
  assert.ok(seen.combatCounter, 'the Counter survives the preview copy');
  assert.equal(seen.intent.hidden === true || seen.intent.kind === 'unknown', false);
});

test('an enemy with two actions exposes both to the player', () => {
  const pool = enemyIds.length ? enemyIds : ids;
  let multi = 0;
  for (let seed = 1; seed <= 100 && multi < 3; seed++) {
    const combat = fight(seed, [pool[seed % pool.length]]);
    const enemy = combat.enemies[0];
    const actions = enemyPlanActions(combat, enemy);
    if (actions.length < 2) continue;
    multi++;
    const row = followUpSymbols(actions, perceptionLevel(combat), readStage(previewIntent(combat, enemy.id)));
    assert.equal(row.length, actions.length - 1);
    assert.ok(row.every(symbol => symbol.kind === 'action' && symbol.icon), `seed ${seed}: no follow-up reads "?"`);
  }
  assert.ok(multi > 0, 'some seeded enemy has more than one action');
});

test('legacy rules still roll the perception check', () => {
  const combat = legacyPerceptionRoll(fight(5, ids));
  const before = streams(combat);
  const read = rollKnowledgeRead(combat.rng, combat.enemyKnowledge.rules, { entity: combat.player, attributes: combat.player.attributes, level: 1, perception: 0 }, 'Attack', { ctx: combat, target: combat.enemies[0] });
  assert.ok(read.perception, 'a roll receipt is returned');
  assert.deepEqual(streams(combat), [before[0] + 1, before[1] + 1]);
  assert.equal(perceptionLevel(combat), 0);
});

test('rules saved without the key keep rolling reads from the start of the fight', () => {
  const combat = fight(5, ids);
  delete combat.fixCoreRules.perception.roll;
  const read = rollKnowledgeRead(combat.rng, combat.enemyKnowledge.rules, { entity: combat.player, attributes: combat.player.attributes, level: 1, perception: 0 }, 'Attack', { ctx: combat, target: combat.enemies[0] });
  assert.ok(read.perception);
});
