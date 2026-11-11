// A Ward strip (a counter's or a rider's drain) carries the remaining Ward, so the paced reducers move
// the Ward badge with it, as they do for a damageDealt hit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { stripCombatWard } from '../src/engine/combatMatchups.js';
import { ApplyCombatBeat } from '../src/ui/models/CombatPlaybackModel.js';

test('a Ward strip emits the Ward it leaves: value and max', () => {
  const registries = createRegistries(contentBundle);
  const combat = createCombat({ registries, rng: createRng(931), combatExpansionVersion: 2, enemyIds: ['wanderingSoldier'],
    player: { classId: 'starseer', maxHp: 100, hp: 100, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1, deck: [] } });
  const enemy = combat.enemies[0];
  enemy.persistentWard = { max: 3, value: 3 };
  const events = [];
  const emit = combat.emit;
  combat.emit = (type, payload) => { events.push({ type, ...payload }); return emit(type, payload); };
  const stripped = stripCombatWard(combat, combat.player, enemy, 2);
  const strip = events.find(e => e.type === 'combatWardStripped');
  assert.equal(stripped, 2);
  assert.equal(strip.amount, 2);
  assert.equal(strip.value, 1, 'the Ward badge reads 1 after the strip');
  assert.equal(strip.max, 3);
  assert.equal(enemy.persistentWard.value, 1);
  const disp = { ents: { [enemy.id]: { persistentWard: { value: 3, max: 3 } } } };
  ApplyCombatBeat(disp, [strip], { combat, registries, reduceFollowRows() {} });
  assert.deepEqual(disp.ents[enemy.id].persistentWard, { value: 1, max: 3 }, 'the paced badge follows the actual strip receipt');
});

test('the playback owner applies Ward changes and strips without inventing or corrupting a badge', () => {
  for (const type of ['persistentWardChanged', 'combatWardStripped']) {
    const disp = { ents: { enemy: { persistentWard: { value: 3, max: 3 } }, unwarded: {} } };
    const apply = payload => ApplyCombatBeat(disp, [{ type, targetId: 'enemy', ...payload }], {
      combat: { eventLog: [] }, reduceFollowRows() {},
    });
    apply({ value: 1, max: 5 });
    assert.deepEqual(disp.ents.enemy.persistentWard, { value: 1, max: 5 }, `${type}: value and max follow the beat`);
    apply({ value: 0 });
    assert.deepEqual(disp.ents.enemy.persistentWard, { value: 0, max: 5 }, `${type}: zero Ward is displayed and an absent max is retained`);
    apply({ value: NaN, max: 99 });
    apply({ value: Infinity, max: 99 });
    apply({ value: 0, max: Infinity });
    assert.deepEqual(disp.ents.enemy.persistentWard, { value: 0, max: 5 }, `${type}: invalid receipt values cannot corrupt the badge`);
    apply({ targetId: 'unwarded', value: 1, max: 5 });
    apply({ targetId: 'missing', value: 1, max: 5 });
    assert.deepEqual(disp.ents.unwarded, {}, `${type}: no Ward badge is fabricated`);
  }
});
