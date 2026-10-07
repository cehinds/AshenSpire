import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { legacyContentBundle } from './helpers/legacy-progression-content.mjs';
import { createRegistries } from '../src/model/registries.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createCoopCombat, playCard, endTurn } from '../src/engine/coopCombat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { getStacks } from '../src/engine/statuses.js';

function registry(effects = []) {
  return createRegistries({ ...contentBundle,
    enemies: contentBundle.enemies.map(enemy => enemy.id === 'gildedKnight' ? { ...enemy, firstMove: 'parry' } : enemy),
    enemyMoves: contentBundle.enemyMoves.map(move => move.enemyId !== 'gildedKnight' ? move
      : { ...move, weight: move.id === 'thrust' ? 1 : 0, ...(move.id === 'parry' ? { effects } : {}) }),
  });
}
function player() {
  return { classId: 'reaver', hp: 500, maxHp: 500, energyMax: 3, drawPerTurn: 1,
    deck: [{ instanceId: 'guard', cardId: 'defend' }], relicIds: [] };
}
function fight(registries, coop = false) {
  const options = { registries, rng: createRng(340), enemyIds: ['gildedKnight'] };
  return coop ? createCoopCombat({ ...options, players: [{ id: 'seat', ...player() }], ratingsRules: null })
    : createCombat({ ...options, player: player() });
}
function finishTurn(combat, coop = false) {
  if (coop) endTurn(combat, 'seat');
  else dispatch(combat, { type: 'endTurn' });
}
const blockEvents = combat => combat.eventLog.filter(event => event.type === 'blockGained' && event.targetId === combat.enemies[0].id);

for (const coop of [false, true]) {
  const mode = coop ? 'co-op' : 'solo';
  test(`${mode} Counter defense prepares once and leaves no phantom Block on fresh Attack`, () => {
    const combat = fight(registry(), coop), enemy = combat.enemies[0];
    assert.equal(enemy.intent.moveId, 'parry');
    assert.equal(enemy.intent.counterDefensePrimed, true);
    assert.equal(enemy.block, 11, 'printed9 Guard plus2 Ward');
    assert.deepEqual(blockEvents(combat).map(event => event.amount), [9, 2]);
    finishTurn(combat, coop);
    assert.equal(enemy.intent.moveId, 'thrust');
    assert.equal(enemy.combatCounter, undefined);
    assert.equal(enemy.intent.counterDefensePrimed, undefined);
    assert.equal(enemy.block, 0, 'expired Counter defense is not replayed');
    assert.equal(enemy.wardBlock, 0);
    assert.deepEqual(blockEvents(combat).map(event => event.amount), [9, 2]);
  });
  test(`${mode} Counter keeps support effects that were not primed`, () => {
    const combat = fight(registry([
      { op: 'block', target: 'self', amount: 3 },
      { op: 'applyStatus', target: 'self', status: 'strength', stacks: 2 },
    ]), coop), enemy = combat.enemies[0];
    finishTurn(combat, coop);
    assert.equal(enemy.block, 3, 'only support recipe Block resolves after the primed defense expires');
    assert.equal(getStacks(enemy, 'strength'), 2);
    assert.deepEqual(blockEvents(combat).map(event => event.amount), [9, 2, 3]);
  });
}

test('saved committed Counter remembers primed defense without replaying it after reload', () => {
  const registries = registry();
  const combat = fight(registries);
  const snapshot = serializeCombatSnapshot(combat);
  assert.equal(snapshot.enemies[0].intent.counterDefensePrimed, true);
  const loaded = restoreCombatSnapshot({ registries, rng: createRng(340, combat.rng.getCounters()), snapshot });
  assert.equal(loaded.enemies[0].intent.counterDefensePrimed, true);
  finishTurn(loaded);
  finishTurn(combat);
  assert.equal(loaded.enemies[0].block, 0);
  assert.deepEqual(loaded.eventLog, combat.eventLog);
  for (const value of ['true', 1, null]) {
    const malformed = structuredClone(snapshot);
    malformed.enemies[0].intent.counterDefensePrimed = value;
    assert.ok(combatSnapshotProblems(malformed).some(problem => problem.includes('counterDefensePrimed must be boolean')));
  }
  const malformed = structuredClone(snapshot);
  malformed.enemies[0].intent.combatProfile.maneuver = 'attack';
  assert.ok(combatSnapshotProblems(malformed).some(problem => problem.includes('counterDefensePrimed requires the committed Counter move')));
});

test('older unprimed Counter intent still resolves its ordinary Block payload', () => {
  const combat = fight(registry());
  delete combat.enemies[0].intent.counterDefensePrimed;
  finishTurn(combat);
  assert.equal(combat.enemies[0].block, 9);
  assert.deepEqual(blockEvents(combat).map(event => event.amount), [9, 2, 9]);
});

test('solo and co-op capture conditional Counter values after payment, before their own support', () => {
  const registries = createRegistries(legacyContentBundle);
  for (const coop of [false, true]) for (const cardId of ['guardCounter', 'riposte']) for (const block of [0, 2]) {
    const actor = { ...player(), deck: [{ instanceId: 'counter', cardId }] };
    const options = { registries, rng: createRng(340), enemyIds: ['wanderingSoldier'] };
    const combat = coop ? createCoopCombat({ ...options, players: [{ id: 'seat', ...actor }], ratingsRules: null })
      : createCombat({ ...options, player: actor });
    const entity = coop ? combat.players.get('seat').entity : combat.player;
    const actionsBefore = entity.energy;
    entity.block = block;
    if (coop) playCard(combat, 'seat', 'counter');
    else dispatch(combat, { type: 'playCard', cardInstanceId: 'counter' });
    const label = `${coop ? 'co-op' : 'solo'} ${cardId} Block${block}`;
    assert.equal(entity.combatCounter.damage, cardId === 'guardCounter' ? (block ? 10 : 4) : 6, label);
    assert.equal(entity.combatCounter.poiseDamage, cardId === 'riposte' ? (block ? 4 : 0) : 1, label);
    assert.equal(entity.energy, actionsBefore - registries.cards.get(cardId).cost, label);
    assert.equal(entity.block, block + 6, `${label}: protection resolves after conditional capture`);
    const paid = combat.eventLog.findIndex(event => event.type === 'energySpent');
    const armed = combat.eventLog.findIndex(event => event.type === 'combatCounterArmed' && event.sourceId === entity.id);
    const support = combat.eventLog.findIndex(event => event.type === 'blockGained' && event.targetId === entity.id);
    assert.ok(paid >= 0 && armed > paid && support > armed, `${label}: payment, capture, support order`);
  }
});
