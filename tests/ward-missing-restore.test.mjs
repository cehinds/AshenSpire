// A clamped Ward or Poise pool refills first against its hidden missing debt. That refill is reported
// as missingRecovered; restored is only the value the pool actually gained, and the log uses that.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { restorePersistentWard, restorePersistentPoise } from '../src/engine/combatStatusControl.js';
import { combatLogEntries } from '../src/model/combatLog.js';

function fixture() {
  const registries = createRegistries(contentBundle);
  const combat = createCombat({ registries, rng: createRng(921), combatExpansionVersion: 2, enemyIds: ['wanderingSoldier'],
    player: { classId: 'starseer', maxHp: 100, hp: 100, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1, deck: [] } });
  const events = [];
  const emit = combat.emit;
  combat.emit = (type, payload) => { events.push({ type, ...payload }); return emit(type, payload); };
  return { combat, enemy: combat.enemies[0], events };
}

test('restoring 2 into a Ward {max 3, value 0, missing 8} pays down missing debt, not value', () => {
  const { combat, enemy, events } = fixture();
  enemy.persistentWard = { max: 3, value: 0, missing: 8 };
  const result = restorePersistentWard(combat, enemy, 2, { source: 'card', modifierPercent: 0 });
  const changed = events.find(e => e.type === 'persistentWardChanged');
  assert.equal(enemy.persistentWard.value, 0, 'the value does not move');
  assert.equal(enemy.persistentWard.missing, 6, 'the missing debt falls from 8 to 6');
  assert.equal(changed.restored, 0, 'restored is the real value increase');
  assert.equal(changed.missingRecovered, 2, 'the paid-down debt is reported separately');
  assert.equal(changed.value, 0);
  assert.equal(result.restored, 0);
  assert.equal(result.missingRecovered, 2);
});

test('a Ward refill that lifts the value reports exactly that increase as restored', () => {
  const { combat, enemy, events } = fixture();
  enemy.persistentWard = { max: 3, value: 0, missing: 4 };
  restorePersistentWard(combat, enemy, 3, { source: 'card', modifierPercent: 0 });
  const changed = events.find(e => e.type === 'persistentWardChanged');
  assert.equal(enemy.persistentWard.value, 2, 'missing 4 becomes 1, so the value is max - 1');
  assert.equal(changed.restored, 2, 'the value rose from 0 to 2');
  assert.equal(changed.missingRecovered, 1, 'the rest of the refill paid down hidden debt');
});

test('restoring Poise into a clamped pool reports the value increase, with the debt paid separately', () => {
  const { combat, enemy, events } = fixture();
  enemy.persistentPoise = { max: 3, value: 0, missing: 8 };
  restorePersistentPoise(combat, enemy, 2, { source: 'card' });
  const changed = events.find(e => e.type === 'persistentPoiseChanged');
  assert.equal(enemy.persistentPoise.value, 0);
  assert.equal(changed.restored, 0);
  assert.equal(changed.missingRecovered, 2);
});

test('the combat log says the actual Ward change, and says nothing when the value did not move', () => {
  const enemies = [{ id: 'e1', enemyId: 'graveWisp' }];
  const log = events => combatLogEntries(events, { enemies }).map(row => row.text);
  assert.deepEqual(log([{ type: 'persistentWardChanged', targetId: 'e1', restored: 0, missingRecovered: 2, value: 0, max: 3 }]), []);
  const [line] = log([{ type: 'persistentWardChanged', targetId: 'e1', restored: 1, missingRecovered: 2, value: 1, max: 3 }]);
  assert.match(line, /restored 1 Ward \(0 → 1\)\./);
});
