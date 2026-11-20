import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';

function fight({ wardOnly = false, block = 3, poiseMax = 3, poiseGuard = 0 } = {}) {
  const profile = { camp: 'physical', maneuver: 'smash', damageType: 'slashing',
    ...(wardOnly ? { delivery: 'projectile' } : {}) };
  const registries = createRegistries({ ...contentBundle,
    // costRule 'fixed' (SPEC action costs, owner 2026-10-12): this fixture pins its own 4-damage Smash, so the guard-break
    // threshold the ordering tests read stays where it was; the 2-SP cost is the same as the table's.
    cards: contentBundle.cards.map(card => card.id === 'kilnCleave' ? { ...card, costRule: 'fixed',
      effects: [{ op: 'damage', target: 'enemy', amount: 4, combatProfile: profile }] } : card),
    enemies: contentBundle.enemies.map(enemy => enemy.id === 'gildedKnight' ? { ...enemy, firstMove: 'parry' } : enemy),
  });
  const player = { classId: 'reaver', hp: 200, maxHp: 200, mana: 10, maxMana: 10, energyMax: 10, drawPerTurn: 1,
    deck: [{ instanceId: 'smash1', cardId: 'kilnCleave' }], relicIds: [] };
  const options = { registries, rng: createRng(50), enemyIds: ['gildedKnight', 'wanderingSoldier'] };
  const c = createCombat({ ...options, player });
  const actor = () => c.player;
  const enemy = c.enemies[0];
  enemy.block = block; enemy.wardBlock = 0; enemy.poiseGuard = poiseGuard;
  enemy.poiseMeter = { value: 0, max: poiseMax };
  enemy.combatCounter.mode = wardOnly ? 'spell' : 'melee';
  enemy.combatCounter.damage = 6; enemy.combatCounter.poiseDamage = 4;
  actor().poiseMeter = { value: 0, max: 100 };
  if (wardOnly) { actor().block = 10; actor().wardBlock = 6; }
  return { c, enemy, actor, play: () => dispatch(c, { type: 'playCard', cardInstanceId: 'smash1', targetId: enemy.id }) };
}

const mode = 'solo';
test(`${mode} same fully guarded Smash breaks Poise before Counter Health or listed Poise reply`, () => {
  const { c, enemy, actor, play } = fight();
  const hp = enemy.hp;
  play();
  const hit = c.eventLog.find(event => event.type === 'damageDealt');
  assert.equal(hit.amount, 3); assert.equal(hit.blocked, 3); assert.equal(enemy.hp, hp);
  assert(c.eventLog.some(event => event.type === 'enemyStaggered' && event.targetId === enemy.id));
  assert.equal(actor().hp, 200); assert.equal(actor().poiseMeter.value, 0);
  assert.equal(enemy.combatCounter, undefined, 'stagger destroys the spent preparation without refund');
  assert.equal(c.eventLog.filter(event => event.type === 'combatCounterTriggered').length, 0);
  assert.equal(c.eventLog.filter(event => event.type === 'damageDealt' && event.sourceId === enemy.id).length, 0);
});
test(`${mode} Guard-intact and nonstaggering Guard-break Smash still allow normal Counter`, () => {
  for (const block of [3, 4]) {
    const { c, enemy, actor, play } = fight({ block, poiseMax: 100 });
    play();
    assert.equal(actor().hp, 186); assert.equal(actor().poiseMeter.value, 6);
    assert.equal(enemy.poiseMeter.value, block === 3 ? 3 : 0);
    assert.equal(c.eventLog.filter(event => event.type === 'combatCounterTriggered').length, 1);
    assert.equal(enemy.combatCounter, undefined);
  }
});
test(`${mode} same-hit Smash stagger precedes even synchronous Spell Counter Ward stripping`, () => {
  for (const poiseMax of [3, 100]) {
    const { c, enemy, actor, play } = fight({ wardOnly: true, poiseMax });
    play();
    assert.equal(actor().hp, 200);
    assert.equal(actor().wardBlock, poiseMax === 3 ? 6 : 0);
    assert.equal(actor().block, poiseMax === 3 ? 10 : 4);
    assert.equal(c.eventLog.filter(event => event.type === 'combatWardStripped').length, poiseMax === 3 ? 0 : 1);
    assert.equal(c.eventLog.filter(event => event.type === 'combatCounterTriggered').length, poiseMax === 3 ? 0 : 1);
    assert.equal(enemy.combatCounter, undefined);
  }
});

test('Poise guard absorbs Smash break bonus without inventing a stagger or losing Counter reply', () => {
  const { c, enemy, actor, play } = fight({ poiseGuard: 3 });
  play();
  assert.equal(enemy.poiseGuard, 0); assert.equal(enemy.poiseMeter.value, 0);
  assert.equal(actor().hp, 186);
  assert.equal(c.eventLog.filter(event => event.type === 'enemyStaggered').length, 0);
});
