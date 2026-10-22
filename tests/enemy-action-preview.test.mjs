import test from 'node:test';
import assert from 'node:assert/strict';
import { productionBundle } from './helpers/production-bundle.mjs';
const require = productionBundle();
const { contentBundle } = require('src/content/index.js');
const { createRegistries } = require('src/model/registries.js');
const { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } = require('src/model/gameProfile.js');
const { createRunState } = require('src/model/state.js');
const { createRng } = require('src/engine/rng.js');
const { createRunCombat } = require('src/engine/runCombat.js');
const { dispatch, previewIntent } = require('src/engine/combat.js');
const { previewEnemyAction } = require('src/engine/enemyActionPreview.js');
const { guardHitFloatParts } = require('src/ui/fx.js');
const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function fixture(enemyId, moveId, normalize = true) {
  const run = createRunState({ registries, classId: 'reaver', seed: 511, runId: 'enemy-action-preview' });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: [enemyId] });
  const enemy = combat.enemies[0];
  for (const entity of normalize ? [combat.player, enemy] : []) {
    Object.assign(entity, { hp: 1000, maxHp: 1000, block: 0, barrier: 0, statuses: {}, ratings: {}, ratingSources: [],
      basePrecisionBonus: 1000, attributes: { dexterity: 0 }, persistentPoise: { value: 0, max: 0 } });
    delete entity.combatStance; delete entity.combatCounter;
  }
  const move = registries.enemies.get(enemyId).moves[moveId];
  const projection = previewEnemyAction(combat, enemy, moveId);
  enemy.intent = { kind: move.intent, moveId, damage: move.damage ?? null, hits: move.hits ?? 1, combatProfile: projection.profile };
  enemy.intentRevealed = true; enemy.plannedMoves = []; enemy.maxStamina = 100; enemy.stamina = 100;
  enemy.knowledgeAction = { reads: { player: { visibility: 'exact' } } };
  return { combat, enemy, move };
}

for (const [enemyId, moveId] of [['stitchedKing', 'graspingHands'], ['blightedValkyrie', 'whirlwind'],
  ['blightedValkyrie', 'scarletDance'], ['hollowAstronomer', 'orbitalShards'], ['hollowAstronomer', 'fallingHeavens']]) {
  test(`bundled authored ${enemyId}/${moveId} keeps per-hit amounts through previews, execution and floats`, () => {
    const { combat, enemy, move } = fixture(enemyId, moveId);
    const view = previewIntent(combat, enemy.id);
    assert.deepEqual(Array.from(view.hitDamages), Array(move.hits).fill(move.damage));
    assert.equal(view.totalDamage, move.damage * move.hits);
    assert.equal(view.damageReceipt.totalDamage, view.totalDamage);
    dispatch(combat, { type: 'setReactions', enabled: false });
    const before = combat.eventLog.length;
    dispatch(combat, { type: 'endTurn' });
    const damage = combat.eventLog.slice(before).filter(e => e.type === 'damageDealt' && e.sourceId === enemy.id && e.targetId === combat.player.id);
    assert.deepEqual(damage.map(e => e.hpLoss), view.hitDamages);
    assert.deepEqual(damage.map(e => guardHitFloatParts(e).damage.text), view.hitDamages.map(n => `-${n}`));
    assert.equal(combat.player.hp, 1000 - view.totalDamage);
  });
}

test('every registered boss move and charging payload has a deterministic detached action preview', () => {
  const bossIds = new Set(registries.encounters.all().filter(row => row.pool === 'boss').flatMap(row => row.enemies));
  assert.equal(bossIds.size, 10);
  for (const def of registries.enemies.all().filter(e => bossIds.has(e.id))) {
    const { combat, enemy } = fixture(def.id, Object.keys(def.moves)[0]);
    for (const [moveId, move] of Object.entries(def.moves)) {
      const before = JSON.stringify({ enemy, player: combat.player, queue: combat.queue, log: combat.eventLog, rng: combat.rng.getCounters() });
      const preview = previewEnemyAction(combat, enemy, moveId);
      assert.ok(preview.actionEffects.length, `${def.id}/${moveId} has its actual payload`);
      for (const effect of move.effects || []) assert.ok(preview.actionEffects.some(row => row.op === effect.op || effect.op === 'applyStatus' && row.op === 'buildup'), `${def.id}/${moveId}: ${effect.op}`);
      if (move.delay) assert.ok(preview.chargingEffects.length, `${def.id}/${moveId}: charging payload`);
      assert.deepEqual(previewEnemyAction(combat, enemy, moveId), preview);
      assert.equal(JSON.stringify({ enemy, player: combat.player, queue: combat.queue, log: combat.eventLog, rng: combat.rng.getCounters() }), before);
    }
  }
});

test('revealed support intents expose actual heal, card injection and status actions', () => {
  for (const [enemyId, moveId, op] of [['marrowOrganist', 'quietRefrain', 'heal'], ['hollowAstronomer', 'starChart', 'addCard'], ['ashheartDragon', 'heartRumble', 'applyStatus']]) {
    const { combat, enemy } = fixture(enemyId, moveId);
    const view = previewIntent(combat, enemy.id);
    assert.ok(view.actionEffects.some(row => row.op === op), `${enemyId}/${moveId}`);
  }
});

test('bundled authored hound lunge opens and settles a fresh paid Counter on EACH contact', () => {
  const { combat, enemy } = fixture('blightHound', 'lunge');
  combat.piles.hand = [0, 1].map(n => ({ instanceId: `counter-${n}`, cardId: 'core.counter' }));
  combat.player.stamina = 100; combat.player.energy = 100;
  dispatch(combat, { type: 'endTurn' });
  for (let n = 0; n < 2; n++) {
    assert.ok(combat.pendingReaction, `hit ${n + 1} has a separate opportunity`);
    const option = combat.pendingReaction.options.find(row => row.play.cardInstanceId === `counter-${n}`);
    assert.ok(option, `hit ${n + 1} can choose its own Counter`);
    const start = combat.eventLog.length;
    dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: option.id });
    const events = combat.eventLog.slice(start);
    assert.equal(events.filter(e => e.type === 'damageDealt' && e.sourceId === enemy.id && e.targetId === combat.player.id).length, 1);
    assert.equal(events.filter(e => e.type === 'combatCounterTriggered').length, 1);
    const returned = events.findIndex(e => e.type === 'combatCounterTriggered');
    const next = events.findIndex(e => e.type === 'combatContactPrepared');
    if (next >= 0) assert.ok(returned < next, 'return completes before next contact is offered');
  }
  assert.equal(combat.pendingReaction, undefined);
  assert.equal(combat.eventLog.filter(e => e.type === 'enemyMoveStarted' && e.moveId === 'lunge').length, 1, 'two contacts belong to one move');
});

test('actual move-start receipt retains the committed action payload and paid SP', () => {
  const { combat, enemy } = fixture('marrowOrganist', 'quietRefrain');
  enemy.hp = 500;
  dispatch(combat, { type: 'setReactions', enabled: false });
  dispatch(combat, { type: 'endTurn' });
  const event = combat.eventLog.findLast(e => e.type === 'enemyMoveStarted' && e.sourceId === enemy.id);
  assert.equal(event.actionPreview.moveId, 'quietRefrain');
  assert.equal(event.actionPreview.spCost, event.actionPreview.totalSp);
  assert.equal(event.actionPreview.actionEffects.find(e => e.op === 'heal').amount, 7);
  assert.equal(enemy.hp, 507);
});

test('concealed support move never exposes the action payload', () => {
  const { combat, enemy } = fixture('hollowAstronomer', 'starChart');
  enemy.knowledgeAction.reads.player.visibility = 'hidden';
  const view = previewIntent(combat, enemy.id);
  assert.equal(view.actionEffects, undefined);
  assert.equal(view.chargingEffects, undefined);
});


test('authored Stitched King ratings and starter protection agree with the live per-contact projection', () => {
  const { combat, enemy, move } = fixture('stitchedKing', 'graspingHands', false);
  // Keep the real attributes, equipment, AR/DR, stance and pools; only raise HP
  // so all contacts can resolve even when the fresh starter would be killed.
  combat.player.hp = combat.player.maxHp = 1000;
  const view = previewIntent(combat, enemy.id);
  assert.ok(view.hitDamages.length === 3);
  assert.equal(view.totalDamage, view.hitDamages.reduce((sum, n) => sum + n, 0));
  assert.equal(view.actionEffects.find(row => row.op === 'damage').amount, move.damage);
  dispatch(combat, { type: 'setReactions', enabled: false });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const events = combat.eventLog.slice(start);
  const contacts = events.filter(e => e.type === 'damageDealt' && e.sourceId === enemy.id && e.targetId === combat.player.id);
  assert.equal(events.filter(e => e.type === 'enemyMoveStarted' && e.sourceId === enemy.id).length, 1);
  assert.deepEqual(contacts.map(e => e.hpLoss), view.hitDamages);
  assert.equal(combat.player.hp, 1000 - view.totalDamage);
});

test('formula effects resolve against the proper owner and target without running the effect', () => {
  const { combat, enemy } = fixture('marrowOrganist', 'quietRefrain');
  const original = combat.registries.enemies;
  combat.registries = { ...combat.registries, enemies: { ...original, get(id) {
    const def = original.get(id);
    return id !== enemy.enemyId ? def : { ...def, moves: { ...def.moves, quietRefrain: { ...def.moves.quietRefrain,
      effects: [{ op: 'heal', target: 'self', amount: { f: 'percentMaxHp', of: 'self', pct: 10 } }] } } };
  } } };
  enemy.hp = 500;
  const counters = JSON.stringify(combat.rng.getCounters());
  const view = previewEnemyAction(combat, enemy, 'quietRefrain');
  assert.equal(view.actionEffects[0].amount, 100);
  assert.equal(enemy.hp, 500);
  assert.equal(JSON.stringify(combat.rng.getCounters()), counters);
});
