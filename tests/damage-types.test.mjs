// Poison, Psychic and Earth are real damage types (owner decisions #2, #5, #14).
// Data-only: each type is a registry row plus a rider row in both matchup tables.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { combatRules } from '../src/content/combatRules.js';
import { combatMatchups, combatExpansionMatchups } from '../src/content/combatMatchups.js';
import { combatStatusRules } from '../src/content/combatStatusRules.js';
import { combatExpansionEquipment } from '../src/content/combatExpansionEquipment.js';
import { tagging } from '../src/content/generated/tagging.js';

// A one-hit probe: the starter Strike is rewritten to deal `damageType` for 10.
function hit(damageType, enemyId = 'wanderingSoldier', combatExpansionVersion = 2) {
  const registries = createRegistries({ ...contentBundle, cards: contentBundle.cards.map(card => card.id === 'strike'
    ? { ...card, attack: { damageType }, tags: [`damage:${damageType}`], effects: [{ op: 'damage', target: 'enemy', amount: 10 }],
      cost: 0, manaCost: 0, upgrade: undefined } : card) });
  const combat = createCombat({ registries, rng: createRng(801), combatExpansionVersion, enemyIds: [enemyId],
    player: { classId: 'reaver', maxHp: 100, hp: 100, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1,
      deck: [{ cardId: 'strike', instanceId: 'p', upgraded: false }] } });
  const enemy = combat.enemies[0];
  enemy.block = enemy.barrier = 0;
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: 'p', targetId: enemy.id });
  const pressure = out.events.filter(event => event.type === 'statusPressure');
  return { combat, enemy, out, pressure };
}

test('the closed damage-type list and both rider tables know poison, psychic and earth', () => {
  for (const type of ['poison']) {
    assert.deepEqual(combatRules.damageTypes[type], { tag: `damage:${type}`, physical: false }, type);
    assert(combatMatchups.damageRiders[type], `v1 rider ${type}`);
    const rider = combatExpansionMatchups.damageRiders[type];
    assert(rider, `v2 rider ${type}`);
    assert(combatStatusRules.statuses[rider.status], `v2 gauge row for ${rider.status}`);
  }
});

test('a poison hit applies Venom (v2 build-up, v1 stack)', () => {
  const { enemy, pressure } = hit('poison');
  assert(enemy.hp < enemy.maxHp);
  assert.equal(pressure.length, 1);
  assert.equal(pressure[0].status, 'venom');
  assert.equal(pressure[0].acceptedBuildup, 4);
  const legacy = hit('poison', 'wanderingSoldier', 1);
  assert.equal(legacy.enemy.statuses.venom?.stacks ?? legacy.enemy.statuses.venom, 1);
});

test('a construct halves poison build-up; an undead takes it normally', () => {
  const construct = hit('poison', 'livingArmor');
  assert.equal(construct.pressure[0].status, 'venom');
  assert.equal(construct.pressure[0].acceptedBuildup, 2, 'half of 4');
  const undead = hit('poison', 'huskBrute');
  assert.equal(undead.pressure[0].acceptedBuildup, 4, 'undead are not resistant');
  for (const id of ['courtMarionette', 'livingArmor', 'charredColossus', 'bellKeeper', 'glassRegent', 'furnaceSaint'])
    assert.equal(combatExpansionEquipment.enemies[id].traits.buildupResistance.venom, 50, id);
  const undeadIds = tagging.filter(row => row.family === 'enemy' && row.tagId === 'undead').map(row => row.objectId);
  for (const id of undeadIds) assert.equal(combatExpansionEquipment.enemies[id]?.traits?.buildupResistance?.venom, undefined, id);
});

test('the two retagged Rogue Venom cards carry damage:poison', () => {
  for (const id of ['venomcoat', 'toxicVolley'])
    assert(tagging.some(row => row.family === 'card' && row.objectId === id && row.tagId === 'damage:poison'), id);
});
