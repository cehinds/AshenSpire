import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, objectKinds } from '../src/model/registries.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { tagService } from '../src/model/tagService.js';
import { enemyMoveDamage } from '../src/model/state.js';
import { enemyMoveCards } from '../src/model/enemyMoveCards.js';
import { createCombat, previewIntent, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';

const nestedOverride = (patch) => contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier'
  ? { ...enemy, firstMove: 'slash', moves: { ...enemy.moves, slash: { ...enemy.moves.slash, ...patch } } } : enemy);
const flatOverride = (patch) => contentBundle.enemyMoves.map(move => move.enemyId === 'wanderingSoldier' && move.id === 'slash'
  ? { ...move, ...patch } : move);
const action = registries => registries.enemies.get('wanderingSoldier').moves.slash;

test('reusing the shipped derived table preserves nested payload customizations and canonical tags', () => {
  const effects = [{ op: 'applyStatus', target: 'player', status: 'weak', stacks: 2 }];
  const registries = createRegistries({ ...contentBundle, enemies: nestedOverride({ damage: 99, effects }) });
  const move = action(registries);
  assert.equal(move.damage, 99);
  assert.deepEqual(move.effects, effects);
  assert.equal(move, registries.enemyMoves.find(row => row.enemyId === 'wanderingSoldier' && row.id === 'slash'));
  assert.deepEqual(combatProfileFor(move), { camp: 'physical', maneuver: 'attack', school: null,
    damageType: 'slashing', counterMode: null });
  assert.deepEqual(objectKinds(registries, move), ['classification.enemyMove']);
  assert.equal(tagService(registries).withTag('enemyMove', 'damage:slashing').find(row => row.enemyId === 'wanderingSoldier' && row.id === 'slash'), move);
  assert.ok(Object.isFrozen(move));
  assert.ok(Object.isFrozen(move.tags));
});

test('replacement flat rows remain explicit payload authority, including conflicts with nested overrides', () => {
  const effects = [{ op: 'block', target: 'self', amount: 5 }];
  for (const enemies of [contentBundle.enemies, nestedOverride({ damage: 99, effects: [] })]) {
    const registries = createRegistries({ ...contentBundle, enemies, enemyMoves: flatOverride({ damage: 77, effects }) });
    assert.equal(action(registries).damage, 77, 'explicit flat replacement wins if both sides changed');
    assert.deepEqual(action(registries).effects, effects);
    assert.equal(action(registries), registries.enemyMoves.find(row => row.enemyId === 'wanderingSoldier' && row.id === 'slash'));
  }
});

test('legacy nested-only bundles materialize one shared tagged move table', () => {
  const { enemyMoves: _derivedView, ...bundle } = contentBundle;
  const registries = createRegistries({ ...bundle, enemies: nestedOverride({ damage: 42 }) });
  assert.equal(action(registries).damage, 42);
  assert.equal(registries.enemyMoves.length, 103);
  assert.equal(action(registries), registries.enemyMoves.find(row => row.enemyId === 'wanderingSoldier' && row.id === 'slash'));
});

test('nested customization drives scaled enemy intent, move-card catalog and executed damage', () => {
  const registries = createRegistries({ ...contentBundle, enemies: nestedOverride({ damage: 99 }),
    balance: { ...contentBundle.balance, combatIntent: { ...contentBundle.balance.combatIntent, baseHiddenChance: 0 } },
  });
  const combat = createCombat({ registries, rng: createRng(50), enemyIds: ['wanderingSoldier'], enemyDamageMult: 2,
    player: { classId: 'reaver', hp: 500, maxHp: 500, energyMax: 3, drawPerTurn: 1,
      deck: [{ instanceId: 'guard', cardId: 'defend' }], relicIds: [] },
  });
  const enemy = combat.enemies[0];
  assert.equal(enemyMoveDamage(enemy, action(registries)), 198);
  assert.equal(previewIntent(combat, enemy.id).damage, 198);
  assert.match(enemyMoveCards(registries.enemies.get(enemy.enemyId), { enemy, registries })
    .find(card => card.moveId === 'slash').detail, /198 base damage/);
  dispatch(combat, { type: 'endTurn' });
  assert.equal(combat.eventLog.find(event => event.type === 'damageDealt' && event.sourceId === enemy.id).amount, 198);
});

test('normal shipped definitions are unchanged and derived provenance stays outside payload serialization', () => {
  const before = JSON.stringify(contentBundle.enemyMoves);
  const registries = createRegistries(contentBundle);
  assert.equal(registries.enemyMoves.length, 103);
  for (const row of registries.enemyMoves) {
    const original = contentBundle.enemies.find(enemy => enemy.id === row.enemyId).moves[row.id];
    const { id, enemyId, tags, kindIds, propertyTags, ...payload } = row;
    assert.deepEqual(payload, original, `${enemyId}.${id}: no payload changes`);
    assert.equal(registries.enemies.get(enemyId).moves[id], row);
  }
  assert.equal(JSON.stringify(contentBundle.enemyMoves), before, 'materialization does not mutate authored content');
  assert.deepEqual(Reflect.ownKeys(contentBundle.enemyMoves), [...contentBundle.enemyMoves.keys()].map(String).concat('length'));
});
