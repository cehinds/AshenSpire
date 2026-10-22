import test from 'node:test';
import assert from 'node:assert/strict';
import { live, baseRegistries } from './helpers/fixcore-combat-rules.mjs';
import { dispatch } from '../src/engine/combat.js';
import { captureEnemyIntent } from '../src/engine/enemyIntentReceipt.js';
import { combatIntentPresentation } from '../src/ui/models/CombatIntentModel.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';

function fixture() {
  const combat = live(), enemy = combat.enemies[0];
  enemy.ratings.ar = 8; enemy.basePrecisionBonus = 1000;
  combat.player.block = 3; combat.player.persistentPoise = { value: 8, max: 8 };
  combat.piles.hand = [0, 1, 2].map(n => ({ cardId: 'core.counter', instanceId: `counter${n}` }));
  return { combat, enemy };
}

test('committed full-action and each contact retain adjusted AR, Block and Poise values', () => {
  const { combat, enemy } = fixture(); primeAccuracyRolls(combat, { count: 3 });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const revealed = combat.eventLog.slice(start).find(e => e.type === 'enemyActorTurnStarted');
  assert.ok(revealed.intentPreview);
  assert.equal(revealed.intent.damage, 5, 'raw compatibility intent stays authored');
  assert.deepEqual(revealed.intentPreview.hitDamages, [7, 9, 12]);
  assert.equal(revealed.intentPreview.totalDamage, 28);
  const shown = combatIntentPresentation(revealed.intentPreview);
  assert.equal(shown.parts[0].value, '7+9+12');
  assert.match(shown.parts[0].summary, /Total.*28 HP/);
  for (let hit = 0; hit < 3; hit++) {
    const before = combat.eventLog.length;
    dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
    const events = combat.eventLog.slice(before);
    const begun = events.find(e => ['enemyMoveStarted', 'combatHitStarted'].includes(e.type));
    const damage = events.find(e => e.type === 'damageDealt' && e.sourceId === enemy.id);
    assert.equal(begun.intentPreview.damage, damage.hpLoss);
    assert.equal(begun.intentPreview.hits, 1);
    assert.equal(begun.intentPreview.contactIndex, hit);
    assert.equal(begun.intentPreview.contactCount, 3);
    assert.equal(combatIntentPresentation(begun.intentPreview).parts[0].value, String(damage.hpLoss));
    assert.match(combatIntentPresentation(begun.intentPreview).parts[0].summary, new RegExp(`Hit ${hit + 1}/3`));
  }
  assert.equal(combat.player.hp, 72);
});

test('a freshly paid Counter refreshes only the imminent contact after its defensive grants', () => {
  const { combat, enemy } = fixture();
  dispatch(combat, { type: 'endTurn' });
  for (let hit = 0; hit < 3; hit++) {
    primeAccuracyRolls(combat, { count: 3 });
    const option = combat.pendingReaction.options.find(row => row.play.cardInstanceId === `counter${hit}`);
    assert.ok(option);
    const start = combat.eventLog.length;
    dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: option.id });
    const events = combat.eventLog.slice(start);
    const begun = events.find(e => ['enemyMoveStarted', 'combatHitStarted'].includes(e.type));
    const damage = events.find(e => e.type === 'damageDealt' && e.sourceId === enemy.id);
    assert.equal(begun.intentPreview.damage, damage.hpLoss, `paid response contact ${hit}`);
    assert.equal(begun.intentPreview.hitDamages.length, 1, 'a refresh never forecasts the whole remaining action');
  }
});

test('all 33 ordinary, elite and boss current actions capture without changing entities or RNG', () => {
  assert.equal(baseRegistries.enemies.all().length, 33);
  for (const def of baseRegistries.enemies.all()) {
    const run = createRunState({ registries: baseRegistries, classId: 'reaver', seed: 511 });
    const combat = createRunCombat({ registries: baseRegistries, run, rng: createRng(511), enemyIds: [def.id] });
    const enemy = combat.enemies[0];
    assert.equal(captureEnemyIntent(combat, enemy), null, `${def.id} is not public before its actor starts`);
    enemy.actorIntentRevealed = true;
    const before = JSON.stringify({ enemy, player: combat.player, rng: combat.rng.getCounters(), queue: combat.queue, log: combat.eventLog });
    const receipt = captureEnemyIntent(combat, enemy);
    assert.equal(receipt.moveId, enemy.intent.moveId);
    assert.equal(receipt.hidden, false);
    assert.equal(JSON.stringify({ enemy, player: combat.player, rng: combat.rng.getCounters(), queue: combat.queue, log: combat.eventLog }), before, def.id);
  }
});

test('long varying attacks use a bounded per-hit range and retain an explicitly marked total', () => {
  const view = combatIntentPresentation({ kind: 'attack', moveId: 'long', damage: 1, hits: 10,
    hitDamages: [1,2,3,4,5,6,7,8,9,10], totalDamage: 55, damageBasis: 'hp' });
  assert.equal(view.parts[0].value, '1–10×10');
  assert.equal(view.parts[0].summary, 'Total 55 HP');
});

test('revealing one actor never projects another unread enemy or its future choices', () => {
  const run = createRunState({ registries: baseRegistries, classId: 'reaver', seed: 511 });
  const combat = createRunCombat({ registries: baseRegistries, run, rng: createRng(511), enemyIds: ['wanderingSoldier', 'blightHound'] });
  combat.piles.hand = [{ cardId: 'core.counter', instanceId: 'counter' }];
  const waiting = combat.enemies[1], before = JSON.stringify(waiting.intent);
  dispatch(combat, { type: 'endTurn' });
  assert.ok(combat.pendingReaction);
  assert.equal(waiting.actorIntentRevealed, undefined);
  assert.equal(captureEnemyIntent(combat, waiting), null);
  assert.equal(JSON.stringify(waiting.intent), before);
  assert.equal(combat.eventLog.filter(e => e.type === 'enemyActorTurnStarted').length, 1);
});

test('HUD and reaction prompt distinguish per-hit values from marked totals and current contact', async () => {
  const { withKitDom } = await import('./helpers/kit-dom.mjs');
  const { combatantIntent } = await import('../src/ui/components/combatantOverhead.js');
  const { openReactionChoiceModal } = await import('../src/ui/components/reactionChoiceModal.js');
  withKitDom(({ document }) => {
    document.documentElement ??= document.body;
    const node = combatantIntent({ kind: 'attack', moveId: 'flurry', damage: 5, hits: 3, hitDamages: [5,5,5], totalDamage: 15,
      projectedDamage: { basis: 'hp', label: '0–15' } }, () => '', baseRegistries);
    assert.equal(node.querySelector('.intent-action-value').textContent, '5×3');
    assert.equal(node.querySelector('.intent-damage-scope').textContent, 'Total 0–15 HP');
    const shell = openReactionChoiceModal({ pending: { options: [], intentPreview: { kind: 'attack', moveId: 'flurry', damage: 9,
      hits: 1, hitDamages: [9], totalDamage: 9, damageBasis: 'hp', damageScope: 'contact', contactIndex: 1, contactCount: 3 } }, onAnswer() {} });
    assert.equal(document.querySelector('.reaction-incoming-damage').textContent, '9 · Hit 2/3 · next 9 HP');
    shell.close();
  });
});
