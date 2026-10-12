import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { applyAttackDamage } from '../src/engine/actions.js';

// The same expanded fight as combat-expansion-actions.test.mjs, one enemy.
function fixture() {
  const registries = createRegistries({ ...contentBundle, cards: contentBundle.cards.map(card => card.id === 'starstonePebble'
    ? { ...card, effects: [{ op: 'damage', target: 'enemy', amount: 5 }], cost: 0, manaCost: 0, upgrade: undefined } : card) });
  const combat = createCombat({ registries, rng: createRng(917), combatExpansionVersion: 2,
    enemyIds: ['wanderingSoldier'], player: { classId: 'starseer', maxHp: 100, hp: 100,
      maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1,
      deck: [{ cardId: 'starstonePebble', instanceId: 'paired', upgraded: false }] } });
  const enemy = combat.enemies[0];
  enemy.block = enemy.barrier = 0;
  enemy.damageResistanceFlat = {}; enemy.damageWeaknessPercent = {};
  delete enemy.combatCounter; delete enemy.combatEvade; delete enemy.combatStance;
  enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 0, ward: 0 };
  enemy.persistentWard = { max: 0, value: 0 };
  enemy.persistentPoise = { max: 0, value: 0 };
  enemy.pendingMove = { moveId: 'slam', cardId: 'x' }; // a prepared action the break should cancel
  return { combat, enemy };
}

const magicCarrier = () => ({ cardId: 'starstonePebble', damageSchool: 'fire', tags: ['camp:spell', 'maneuver:casting'],
  combatProfile: { camp: 'spell', maneuver: 'casting', school: 'fire', damageType: 'fire', reach: 'near', targeting: 'single' } });
const physicalCarrier = () => ({ cardId: 'strike', damageSchool: 'physical', tags: ['camp:physical', 'maneuver:attack'],
  combatProfile: { camp: 'physical', maneuver: 'attack', school: 'physical', damageType: 'slashing', reach: 'contact', targeting: 'single' } });

function captureEvents(combat) {
  const events = []; const emit = combat.emit;
  combat.emit = (type, payload) => { events.push({ type, ...payload }); return emit.call(combat, type, payload); };
  return events;
}

test('an enemy whose Ward breaks to a Spell loses its prepared move and pays 1 Stamina', () => {
  const { combat, enemy } = fixture();
  enemy.ratings.ward = 1; enemy.persistentWard = { max: 1, value: 1 };
  const events = captureEvents(combat);
  applyAttackDamage(combat, combat.player, enemy, 3, [], magicCarrier());
  assert.equal(enemy.persistentWard.value, 0, 'the Spell broke Ward');
  assert.equal(enemy.pendingMove, null, 'the prepared move is cancelled');
  assert.equal(enemy.pendingActionLoss, 1, 'the enemy pays 1 Stamina');
  assert.equal(enemy.skipNextTurn, true, 'the enemy is interrupted');
  const broke = events.find(event => event.type === 'wardBroken');
  assert.equal(broke.interrupted, true);
  assert.equal(events.find(event => event.type === 'enemyStaggered').cause, 'wardBreak');
});

test('an enemy whose Poise breaks to a physical hit loses its prepared move and pays 1 Stamina', () => {
  const { combat, enemy } = fixture();
  enemy.ratings.poise = 2; enemy.persistentPoise = { max: 2, value: 2 };
  const events = captureEvents(combat);
  applyAttackDamage(combat, combat.player, enemy, 5, [], physicalCarrier());
  assert.equal(enemy.persistentPoise.value, 0, 'the physical hit broke Poise');
  assert.equal(enemy.pendingMove, null, 'the prepared move is cancelled');
  assert.equal(enemy.pendingActionLoss, 1, 'the enemy pays 1 Stamina');
  assert.equal(events.find(event => event.type === 'enemyStaggered').cause, 'poiseBreak');
  assert.equal(events.find(event => event.type === 'poiseBroken').interrupted, true);
});
