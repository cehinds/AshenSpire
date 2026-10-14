import { primeAccuracyRolls } from './accuracyFixture.mjs';
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
import { combatExpansionNewCards } from '../src/content/combatExpansionCards.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { applyStatus, getStacks } from '../src/engine/statuses.js';
import { tagging } from '../src/content/generated/tagging.js';

// A one-hit probe: the starter Strike is rewritten to deal `damageType` for 10.
function hit(damageType, enemyId = 'wanderingSoldier', combatExpansionVersion = 2) {
  const registries = createRegistries({ ...contentBundle, cards: contentBundle.cards.map(card => card.id === 'strike'
    ? { ...card, attack: { damageType }, tags: [`damage:${damageType}`], effects: [{ op: 'damage', target: 'enemy', amount: 10 }],
      cost: 0, manaCost: 0, upgrade: undefined } : card) });
  const combat = createCombat({ registries, rng: createRng(801), combatExpansionVersion, enemyIds: [enemyId],
    player: { classId: 'reaver', maxHp: 100, hp: 100, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1,
      deck: [{ cardId: 'strike', instanceId: 'p', upgraded: false }] } });
  primeAccuracyRolls(combat, { count: 2 });
  const enemy = combat.enemies[0];
  enemy.block = enemy.barrier = 0;
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: 'p', targetId: enemy.id });
  const pressure = out.events.filter(event => event.type === 'statusPressure');
  return { combat, enemy, out, pressure };
}

test('the closed damage-type list and both rider tables know poison, psychic and earth', () => {
  for (const type of ['poison', 'psychic', 'earth']) {
    // Poison and Psychic are all magic; Earth routes physical (magicShare 0) but keeps physical: false for the foundation's armour.
    assert.deepEqual(combatRules.damageTypes[type], { tag: `damage:${type}`, physical: false, magicShare: type === 'earth' ? 0 : 1 }, type);
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

test('a psychic hit applies Confused; an earth hit applies Slowed (v2 build-up, v1 stack)', () => {
  for (const [type, status, buildup] of [['psychic', 'confused', 3], ['earth', 'slowed', 4]]) {
    const live = hit(type);
    assert(live.enemy.hp < live.enemy.maxHp, type);
    assert.equal(live.pressure.length, 1, type);
    assert.equal(live.pressure[0].status, status);
    assert.equal(live.pressure[0].acceptedBuildup, buildup);
    const legacy = hit(type, 'wanderingSoldier', 1);
    assert.equal(legacy.enemy.statuses[status]?.stacks ?? legacy.enemy.statuses[status], 1, `${type} v1`);
  }
});

test('the four illusion cards now deal psychic, not arcane', () => {
  const fresh = new Map(combatExpansionNewCards.map(card => [card.id, card]));
  for (const id of ['drowsingMote', 'illusionCounter', 'illusionDecoy', 'restfulDream']) {
    const tags = tagging.filter(row => row.family === 'card' && row.objectId === id).map(row => row.tagId);
    assert(tags.includes('damage:psychic'), id);
    assert(!tags.includes('damage:arcane'), id);
    assert.equal(combatProfileFor(fresh.get(id)).damageType, 'psychic', id);
    assert.equal(combatProfileFor(fresh.get(id)).school, 'illusion', id);
  }
  assert.equal(fresh.get('drowsingMote').attack.damageType, 'psychic');
});

test('Confused, Slowed and Entombed carry their modifiers and Earth is a known school', () => {
  const statuses = new Map(contentBundle.statuses.map(status => [status.id, status]));
  assert.deepEqual(statuses.get('confused').modifiers, { damageDealtMult: 0.9 });
  assert.deepEqual(statuses.get('slowed').modifiers, { damageDealtMult: 0.9, blockGainedMult: 0.75 });
  assert.deepEqual(statuses.get('entombed').modifiers, { skipTurn: true, damageTakenMult: 0.75 });
  for (const id of ['confused', 'slowed', 'entombed']) assert(statuses.get(id).tooltip, id);
  assert(tagging.length && combatExpansionMatchups.counter.schoolMatchups.earth);
});

test('an Entombed enemy skips its turn and the status then decays; Confused and Slowed tick without throwing', () => {
  const run = status => {
    const { combat, enemy } = hit('blunt', 'blightHound');
    const hp = combat.player.hp;
    if (status) applyStatus(combat, enemy, status, 1);
    dispatch(combat, { type: 'endTurn' });
    return { combat, enemy, lost: hp - combat.player.hp };
  };
  const control = run(null);
  assert(control.lost > 0, 'baseline enemy attacks');
  const entombed = run('entombed');
  assert.equal(entombed.lost, 0, 'entombed enemy deals no damage');
  assert.equal(getStacks(entombed.enemy, 'entombed'), 0, 'Entombed lasts one enemy turn');
  assert.doesNotThrow(() => run('confused'));
  assert.doesNotThrow(() => run('slowed'));
});
