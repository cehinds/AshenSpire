import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyContentBundle } from './helpers/legacy-progression-content.mjs';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createCoopCombat, playCard } from '../src/engine/coopCombat.js';
import { combatRules } from '../src/content/combatRules.js';
import { resolveCombatRatings } from '../src/model/combatRatings.js';

function fight({ coop = false, wardOnly = false, block = 3, poiseMax = 3, poiseGuard = 0, foundation = false } = {}) {
  const profile = { camp: 'physical', maneuver: 'smash', damageType: 'slashing',
    ...(wardOnly ? { delivery: 'projectile' } : {}) };
  const registries = createRegistries({ ...legacyContentBundle,
    cards: legacyContentBundle.cards.map(card => card.id === 'kilnCleave' ? { ...card,
      effects: [{ op: 'damage', target: 'enemy', amount: 4, combatProfile: profile }] } : card),
    enemies: legacyContentBundle.enemies.map(enemy => enemy.id === 'gildedKnight' ? { ...enemy, firstMove: 'parry' } : enemy),
  });
  const player = { classId: 'reaver', hp: 200, maxHp: 200, energyMax: 10, drawPerTurn: 1,
    deck: [{ instanceId: 'smash1', cardId: 'kilnCleave' }], relicIds: [] };
  const options = { registries, rng: createRng(50), enemyIds: ['gildedKnight', 'wanderingSoldier'], ratingsRules: null,
    ...(foundation ? { ruleset: combatRules, combatProfiles: { player: { sources: { mainHand: {
      id: 'sword', sourceType: 'weapon', family: 'blade', weight: 1, grip: 'oneHand',
      damageType: 'slashing', tags: [], buildup: [] } } } } } : {}) };
  const c = coop ? createCoopCombat({ ...options, players: [{ ...player, id: 'p1' }] }) : createCombat({ ...options, player });
  const actor = () => coop ? c.players.get('p1').entity : c.player;
  const enemy = c.enemies[0];
  enemy.block = block; enemy.wardBlock = 0; enemy.poiseGuard = poiseGuard;
  enemy.poiseMeter = { value: 0, max: poiseMax };
  enemy.combatCounter.mode = wardOnly ? 'spell' : 'melee';
  enemy.combatCounter.damage = 6; enemy.combatCounter.poiseDamage = 4;
  actor().poiseMeter = { value: 0, max: 100 };
  if (wardOnly) { actor().block = 10; actor().wardBlock = 6; }
  return { c, enemy, actor, play: () => coop ? playCard(c, 'p1', 'smash1', enemy.id)
    : dispatch(c, { type: 'playCard', cardInstanceId: 'smash1', targetId: enemy.id }) };
}

for (const coop of [false, true]) {
  const mode = coop ? 'co-op' : 'solo';
  test(`${mode} same fully guarded Smash breaks Poise before Counter Health or listed Poise reply`, () => {
    const { c, enemy, actor, play } = fight({ coop });
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
      const { c, enemy, actor, play } = fight({ coop, block, poiseMax: 100 });
      play();
      assert.equal(actor().hp, 186); assert.equal(actor().poiseMeter.value, 6);
      assert.equal(enemy.poiseMeter.value, block === 3 ? 3 : 0);
      assert.equal(c.eventLog.filter(event => event.type === 'combatCounterTriggered').length, 1);
      assert.equal(enemy.combatCounter, undefined);
    }
  });
  test(`${mode} same-hit Smash stagger precedes even synchronous Spell Counter Ward stripping`, () => {
    for (const poiseMax of [3, 100]) {
      const { c, enemy, actor, play } = fight({ coop, wardOnly: true, poiseMax });
      play();
      assert.equal(actor().hp, 200);
      assert.equal(actor().wardBlock, poiseMax === 3 ? 6 : 0);
      assert.equal(actor().block, poiseMax === 3 ? 10 : 4);
      assert.equal(c.eventLog.filter(event => event.type === 'combatWardStripped').length, poiseMax === 3 ? 0 : 1);
      assert.equal(c.eventLog.filter(event => event.type === 'combatCounterTriggered').length, poiseMax === 3 ? 0 : 1);
      assert.equal(enemy.combatCounter, undefined);
    }
  });
}

test('Poise guard absorbs Smash break bonus without inventing a stagger or losing Counter reply', () => {
  const { c, enemy, actor, play } = fight({ poiseGuard: 3 });
  play();
  assert.equal(enemy.poiseGuard, 0); assert.equal(enemy.poiseMeter.value, 0);
  assert.equal(actor().hp, 186);
  assert.equal(c.eventLog.filter(event => event.type === 'enemyStaggered').length, 0);
});

test('foundation protected Poise prevents same-hit Smash interruption and preserves normal Counter', () => {
  const { c, enemy, actor, play } = fight({ foundation: true });
  enemy.impactProtectedUntil = c.turn;
  play();
  assert.equal(actor().hp, 186);
  assert.equal(c.eventLog.filter(event => event.type === 'enemyStaggered').length, 0);
  assert.equal(c.eventLog.filter(event => event.type === 'combatCounterTriggered').length, 1);
});

test('rating and single-meter breaks also interrupt the same-hit Smash reply in solo and co-op', () => {
  for (const coop of [false, true]) for (const breakMeterVersion of [0, 1]) {
    const { c, enemy, actor, play } = fight({ coop });
    c.ratingsRules = resolveCombatRatings({}, legacyContentBundle);
    c.breakMeterVersion = breakMeterVersion;
    actor().ratings = { ar: 0, dr: 0, pr: 0, poise: 100, ward: 100 };
    play();
    assert.equal(actor().hp, 200);
    assert.equal(actor().poiseMeter.value, 0);
    assert.equal(enemy.combatCounter, undefined);
    assert(c.eventLog.some(event => event.type === 'ratingImpact' && event.targetId === enemy.id && event.breaks === 1));
    assert.equal(c.eventLog.filter(event => event.type === 'combatCounterTriggered').length, 0);
  }
});
