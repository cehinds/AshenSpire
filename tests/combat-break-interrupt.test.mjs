import { primeAccuracyRolls } from './accuracyFixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { applyAttackDamage, staggerEnemy } from '../src/engine/actions.js';
import { interruptForBreak } from '../src/engine/combatStatusControl.js';

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
  // Protection arithmetic is exercised after a real seeded landed Accuracy decision.
  primeAccuracyRolls(combat);
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
  assert.equal(enemy.pendingActionLoss, undefined, 'an enemy has no Stamina to pay');
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
  assert.equal(enemy.pendingActionLoss, undefined, 'an enemy has no Stamina to pay');
  assert.equal(events.find(event => event.type === 'enemyStaggered').cause, 'poiseBreak');
  assert.equal(events.find(event => event.type === 'poiseBroken').interrupted, true);
});

test('a killing hit that breaks Ward does not interrupt the dead enemy: no INTERRUPTED, no stagger, no Stamina', () => {
  const { combat, enemy } = fixture();
  enemy.ratings.ward = 1; enemy.persistentWard = { max: 1, value: 1 }; enemy.hp = 1;
  const events = captureEvents(combat);
  applyAttackDamage(combat, combat.player, enemy, 3, [], magicCarrier());
  assert.equal(enemy.alive, false, 'the hit kills the enemy');
  const broke = events.find(event => event.type === 'wardBroken');
  assert.ok(broke, 'the Ward still broke');
  assert.ok(!broke.interrupted, 'a dead enemy is not reported as interrupted');
  assert.equal(events.some(event => event.type === 'enemyInterrupted'), false, 'a killing hit shows no INTERRUPTED');
  assert.equal(events.some(event => event.type === 'enemyStaggered'), false);
  assert.equal(enemy.pendingActionLoss, undefined, 'a dead enemy pays nothing');
  assert.ok(enemy.pendingMove, 'the prepared move is left alone');
});

test('interruptForBreak does nothing for an enemy at 0 HP even when it is still flagged alive', () => {
  const { combat, enemy } = fixture();
  const events = captureEvents(combat);
  enemy.hp = 0;
  interruptForBreak(combat, enemy, 'wardBreak');
  assert.equal(events.length, 0);
  assert.ok(enemy.pendingMove);
});

test('staggerEnemy reports whether it staggered; impact protection refuses and interrupts nothing', () => {
  const { combat, enemy } = fixture();
  combat.turn = 3;
  combat.foundation = { rules: { impact: { protectionTurns: 2 } } };
  enemy.impactProtectedUntil = 3;
  // A plain recorder: the foundation's own event rules are not under test here.
  const events = [];
  combat.emit = (type, payload) => { events.push({ type, ...payload }); };
  assert.equal(staggerEnemy(combat, enemy, { cause: 'poiseBreak' }), false, 'a protected enemy is not staggered');
  assert.ok(enemy.pendingMove, 'its move is not cancelled');
  interruptForBreak(combat, enemy, 'poiseBreak');
  assert.equal(events.some(event => event.type === 'enemyInterrupted'), false, 'no INTERRUPTED for a refused stagger');
  assert.equal(enemy.pendingActionLoss, undefined, 'and no Stamina is charged');
  enemy.impactProtectedUntil = 0;
  assert.equal(staggerEnemy(combat, enemy, { cause: 'wardBreak' }), true, 'an unprotected enemy is staggered');
  assert.equal(enemy.pendingMove, null);
});
