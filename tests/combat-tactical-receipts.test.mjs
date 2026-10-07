import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { combatRules } from '../src/content/combatRules.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { applyAttackDamage, executeAction } from '../src/engine/actions.js';
import { armCombatCounter } from '../src/engine/combatMatchups.js';

const registries = createRegistries(contentBundle);
const components = [{ type: 'slashing', weight: 3 }, { type: 'fire', weight: 2 }];
function fight(profiles = {}) {
  const c = createCombat({ registries, rng: createRng(50), ratingsRules: null, ruleset: combatRules,
    combatProfiles: profiles, enemyIds: ['wanderingSoldier'], player: { classId: 'reaver',
      hp: 200, maxHp: 200, mana: 20, maxMana: 20, energyMax: 10, drawPerTurn: 1,
      deck: [{ instanceId: 'card1', cardId: 'strike' }], relicIds: [] } });
  c.enemies[0].hp = c.enemies[0].maxHp = 200;
  return c;
}
function carrier(maneuver, attack) {
  return { combatProfile: { camp: 'physical', maneuver, damageType: 'slashing' },
    attack: { source: 'weapon', ...attack }, combatRiderTargets: [] };
}
function assertReceipt(event, expected) {
  assert.equal(event.amount, expected.amount);
  assert.deepEqual(event.components, expected.components);
  assert.equal(event.components.reduce((total, c) => total + c.amount, 0), event.amount);
  assert.equal(event.hpComponents.reduce((total, c) => total + c.amount, 0), event.amount - event.blocked);
  assert.deepEqual(event.hpComponents.map(c => c.type), event.components.map(c => c.type));
  if (expected.hpComponents) assert.deepEqual(event.hpComponents, expected.hpComponents);
}

test('foundation Smash receipts reconcile single and mixed types after Guard multiplier', () => {
  for (const attack of [{ damageType: 'slashing' }, { components }]) {
    const c = fight(), enemy = c.enemies[0]; enemy.block = 3;
    applyAttackDamage(c, c.player, enemy, 5, [], carrier('smash', attack));
    const event = c.eventLog.find(e => e.type === 'damageDealt');
    assertReceipt(event, { amount: 7, components: attack.components
      ? [{ type: 'slashing', amount: 4 }, { type: 'fire', amount: 3 }]
      : [{ type: 'slashing', amount: 7 }] });
    assert.equal(enemy.hp, 196);
    assert.equal(enemy.block, 0);
    assert.equal(c.queue.filter(action => action.meta?.combatSmashBreak).length, 1);
  }
});

test('odd mixed Smash uses stable largest remainder for damage and HP shares', () => {
  const c = fight(), enemy = c.enemies[0]; enemy.block = 1;
  applyAttackDamage(c, c.player, enemy, 3, [], carrier('smash', {
    components: [{ type: 'slashing', weight: 1 }, { type: 'fire', weight: 1 }],
  }));
  assertReceipt(c.eventLog.find(e => e.type === 'damageDealt'), { amount: 3,
    components: [{ type: 'slashing', amount: 2 }, { type: 'fire', amount: 1 }],
    hpComponents: [{ type: 'slashing', amount: 1 }, { type: 'fire', amount: 1 }] });
});

test('foundation Counter reduction and mixed retaliation both reconcile receipt totals', () => {
  for (const attack of [{ damageType: 'slashing' }, { components }]) {
    const c = fight(), enemy = c.enemies[0]; c.player.block = 100; enemy.block = 2;
    armCombatCounter(c, c.player, carrier('counter', attack), { damage: 5, poiseDamage: 2 });
    applyAttackDamage(c, enemy, c.player, 5, [], carrier('attack', attack));
    assertReceipt(c.eventLog.find(e => e.type === 'damageDealt'), { amount: 2,
      components: attack.components ? [{ type: 'slashing', amount: 1 }, { type: 'fire', amount: 1 }]
        : [{ type: 'slashing', amount: 2 }] });
    assert.equal(c.player.hp, 200);
    assert.equal(c.player.combatCounter, undefined);
    assert.equal(c.queue.filter(action => action.meta?.combatCounterReaction && action.effect.op === 'poiseDamage')[0].effect.amount, 3);
    while (c.queue.length) executeAction(c, c.queue.shift());
    const reply = c.eventLog.filter(e => e.type === 'damageDealt')[1];
    assertReceipt(reply, { amount: attack.components ? 11 : 12,
      components: attack.components ? [{ type: 'slashing', amount: 7 }, { type: 'fire', amount: 4 }]
        : [{ type: 'slashing', amount: 12 }] });
    assert.equal(reply.blocked, 2);
    assert.equal(enemy.hp, attack.components ? 191 : 190);
  }
});

test('critical final damage also conserves the existing typed receipt budget', () => {
  const c = fight(), enemy = c.enemies[0];
  applyAttackDamage(c, c.player, enemy, 5, [], { ...carrier('attack', { components }), critMultiplier: 2 });
  assertReceipt(c.eventLog.find(e => e.type === 'damageDealt'), { amount: 10,
    components: [{ type: 'slashing', amount: 6 }, { type: 'fire', amount: 4 }] });
  assert.equal(enemy.hp, 190);
});

test('final receipts never assign damage to immune types and handle zero reduced hits', () => {
  const c = fight({ e1: { immunities: ['fire'] } }), enemy = c.enemies[0]; enemy.block = 1;
  applyAttackDamage(c, c.player, enemy, 5, [], carrier('smash', { components }));
  assertReceipt(c.eventLog.find(e => e.type === 'damageDealt'), { amount: 4,
    components: [{ type: 'slashing', amount: 4 }, { type: 'fire', amount: 0 }] });
  const zero = fight(); zero.player.block = 100;
  armCombatCounter(zero, zero.player, carrier('counter', { damageType: 'slashing' }), { damage: 5 });
  applyAttackDamage(zero, zero.enemies[0], zero.player, 1, [], carrier('attack', { damageType: 'slashing' }));
  assertReceipt(zero.eventLog.find(e => e.type === 'damageDealt'), { amount: 0,
    components: [{ type: 'slashing', amount: 0 }] });
  assert.equal(zero.queue.filter(action => action.meta?.combatCounterReaction).length, 0);
});
