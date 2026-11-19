// Playtest soft-lock (build 0.7.4.216): persistentPoise.barrierBonus left above a shrunken maximum made every dispatch fail validation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fight } from './elementFixture.mjs';
import * as Statuses from '../src/engine/statuses.js';
import { ChangeAttribute } from '../src/engine/liveStats.js';
import { serializeCombatSnapshot as createCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';
import { reg } from './elementFixture.mjs';
import { createRng } from '../src/engine/rng.js';

const ward = (combat, entity, stacks) => Statuses.applyStatus(combat, entity, 'ward', stacks, entity);
const clean = combat => assert.deepEqual(combatSnapshotProblems(createCombatSnapshotLoose(combat)).filter(p => /persistentPoise/.test(p)), []);
const createCombatSnapshotLoose = combat => createCombatSnapshot(combat);

test('an attribute change keeps Ward/Barrier Poise bonus inside the maximum', () => {
  const { combat, player } = fight({ classId: 'starseer' });
  ChangeAttribute(combat, player, 'wisdom', 1); // the fight-start snapshot of the pools is taken here, before any Ward
  ward(combat, player, 4);
  Statuses.applyStatus(combat, player, 'barrier', 3, player); // more bonus than the base maximum
  assert.ok(player.persistentPoise.barrierBonus > 0);
  for (const id of ['intelligence', 'wisdom', 'constitution', 'strength']) {
    ChangeAttribute(combat, player, id, 2);
    assert.ok(player.persistentPoise.barrierBonus <= player.persistentPoise.max, `after +${id}`);
    ChangeAttribute(combat, player, id, 1, { thisTurn: true });
    assert.ok(player.persistentPoise.barrierBonus <= player.persistentPoise.max, `after turn +${id}`);
    clean(combat);
  }
});

test('Ward decay and a later attribute change keep the pool consistent', () => {
  const { combat, player } = fight({ classId: 'reaver' });
  ChangeAttribute(combat, player, 'wisdom', 1);
  ward(combat, player, 2);
  const withWard = player.persistentPoise.max;
  assert.equal(player.persistentPoise.barrierBonus, 10);
  ChangeAttribute(combat, player, 'intelligence', 1, { thisTurn: true });
  assert.equal(player.persistentPoise.max, withWard, 'the bonus survives a stat change');
  player.fixCoreDecayRound = -1; Statuses.decayAtTurnStart(combat, player);
  assert.equal(player.persistentPoise.barrierBonus, 5);
  ChangeAttribute(combat, player, 'strength', 1);
  assert.ok(player.persistentPoise.barrierBonus <= player.persistentPoise.max);
  assert.equal(player.persistentPoise.max, withWard - 5, 'only the decayed stack'+"'s +5 left");
  clean(combat);
});

test('a saved snapshot already holding barrierBonus above max loads repaired and can be saved again', () => {
  const { combat, player } = fight({ classId: 'reaver' });
  ward(combat, player, 4);
  const saved = createCombatSnapshot(combat);
  const bonus = saved.player.persistentPoise.barrierBonus;
  assert.equal(bonus, 20);
  const baseMax = saved.player.persistentPoise.max - bonus;
  Object.assign(saved.player.persistentPoise, { max: baseMax, value: Math.min(saved.player.persistentPoise.value, baseMax) }); // the 0.7.4.216 state
  assert.ok(combatSnapshotProblems(saved).some(p => /barrierBonus/.test(p)), 'the bad snapshot is what the validator refuses');
  const restored = restoreCombatSnapshot({ registries: combat.registries, rng: createRng(5), snapshot: saved });
  assert.equal(restored.player.persistentPoise.barrierBonus, bonus);
  assert.equal(restored.player.persistentPoise.max, baseMax + bonus);
  assert.deepEqual(combatSnapshotProblems(createCombatSnapshot(restored)), []);
  // A fractional bonus is floored.
  const frac = structuredClone(saved); frac.player.persistentPoise.barrierBonus = 7.5;
  assert.equal(restoreCombatSnapshot({ registries: combat.registries, rng: createRng(5), snapshot: frac }).player.persistentPoise.barrierBonus, 7);
});

test('a fight saved with the bonus inside liveStats.base does not inflate the maximum on the next stat change', () => {
  for (const devFormat of [true, false]) {
    const { combat, player } = fight({ classId: 'reaver' });
    ChangeAttribute(combat, player, 'wisdom', 1);
    ward(combat, player, 2);
    if (devFormat) player.liveStats.base.persistentPoiseMax += 10; // what build 0.7.4.216 stored when Ward was up at the first change
    const saved = createCombatSnapshot(combat);
    const restored = restoreCombatSnapshot({ registries: combat.registries, rng: createRng(5), snapshot: saved });
    const before = { ...restored.player.persistentPoise };
    ChangeAttribute(restored, restored.player, 'strength', 1);
    assert.deepEqual(restored.player.persistentPoise, before, devFormat ? 'dev-format base' : 'new-format base');
    assert.deepEqual(combatSnapshotProblems(createCombatSnapshot(restored)), []);
  }
});
