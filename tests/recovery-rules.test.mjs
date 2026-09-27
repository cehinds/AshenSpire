// Settings → Advanced → Recovery (owner, 2026-09-27): HP, Stamina and Mana
// recover per turn, after going unused, every N rounds, after a won fight and
// at every Rest. The defaults are the game as it shipped.

import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';
import { createLocationVisit, previewRest, restAt } from '../src/engine/locations.js';
import {
  applyAfterCombatRecovery, recoveryKey, recoveryRulesFor, recoveryRulesProblems, restRecoveryBonus, turnRecovery,
} from '../src/model/recoveryRules.js';
import { recoveryRules } from '../src/content/recoveryRules.js';
import { mechanics } from '../src/framework/data/mechanics.js';

const registries = createRegistries(contentBundle);
const fight = (settings, seed = 7) => {
  const run = createRunState({ seed, classId: 'reaver', registries });
  return { run, combat: createRunCombat({ registries, rng: createRng(seed), run, enemyIds: ['wanderingSoldier'], settings }) };
};

test('the defaults are the shipped rule and build no recovery state', () => {
  assert.equal(recoveryRules.defaults.stamina.perTurn, mechanics.stamina.idleRecoveryPerTurn);
  assert.equal(recoveryRules.defaults.stamina.idleTurns, 1);
  assert.equal(recoveryRulesFor({}), null);
  assert.equal(recoveryRulesFor({ [recoveryKey('hp', 'afterCombat')]: 50 }), null, 'out-of-combat triggers do not touch the fight');
  const { combat } = fight({});
  assert.equal(combat.recovery, undefined);
  assert.equal(serializeCombatSnapshot(combat).recovery, undefined);
});

test('out-of-range stored values fall back to the default', () => {
  assert.equal(recoveryRulesFor({ [recoveryKey('hp', 'perTurn')]: -3, [recoveryKey('mana', 'unit')]: 'lots' }), null);
});

test('turnRecovery honours the idle streak, the round cadence, the unit and the maximum', () => {
  const rules = { hp: { perTurn: 10, unit: 'percent', idleTurns: 2, everyRounds: 3 } };
  const at = (round, idleStreak, current = 10) => turnRecovery({ rules, pool: 'hp', round, idleStreak, current, max: 50 });
  assert.equal(at(3, 1), 0, 'one unused turn is not two');
  assert.equal(at(2, 2), 0, 'round 2 is not a third round');
  assert.equal(at(3, 2), 5, '10% of 50');
  assert.equal(at(6, 5, 48), 2, 'capped at the maximum');
  rules.hp = { perTurn: 3, unit: 'flat', idleTurns: 0, everyRounds: 1 };
  assert.equal(at(1, 0), 3, 'idleTurns 0: a used turn still recovers');
});

test('a fight under custom rules recovers every pool at the end of the turn, and saves the streak', () => {
  const settings = {
    [recoveryKey('hp', 'perTurn')]: 2,
    [recoveryKey('mana', 'perTurn')]: 1,
    [recoveryKey('stamina', 'perTurn')]: 1, [recoveryKey('stamina', 'idleTurns')]: 0,
  };
  const { combat } = fight(settings);
  assert.ok(combat.recovery, 'the rules ride the fight');
  const p = combat.player;
  p.hp = p.maxHp - 5; p.mana = 0; p.stamina = 0;
  dispatch(combat, { type: 'endTurn' });
  assert.equal(p.mana, Math.min(p.maxMana, 1));
  assert.ok(p.stamina >= 1, 'Stamina recovered although idleTurns is 0');
  const snapshot = serializeCombatSnapshot(combat);
  assert.deepEqual(combatSnapshotProblems(snapshot, registries).filter((m) => /recovery/.test(m)), []);
  const tampered = structuredClone(snapshot);
  tampered.recovery.logIndex = tampered.eventLog.length + 1;
  assert.ok(combatSnapshotProblems(tampered).some((m) => /recovery\.logIndex/.test(m)), 'a cursor past the log is refused');
  const restored = restoreCombatSnapshot({ registries, rng: createRng(9), snapshot });
  assert.deepEqual(restored.recovery, combat.recovery);
});

test('a malformed rule is refused by name', () => {
  assert.match(recoveryRulesProblems({ hp: { perTurn: 1, unit: 'flat', idleTurns: 0, everyRounds: 0 }, stamina: {}, mana: {} }).join('\n'), /hp\.everyRounds/);
});

test('after a won fight and at a Rest, the percents restore each pool', () => {
  const run = createRunState({ seed: 3, classId: 'reaver', registries });
  run.hp = 1; run.mana = 0;
  const gained = applyAfterCombatRecovery(run, { [recoveryKey('hp', 'afterCombat')]: 50 });
  assert.equal(gained.hp, Math.floor(run.maxHp / 2));
  assert.equal(gained.mana, 0);

  run.hp = 1;
  const bonus = restRecoveryBonus({ [recoveryKey('hp', 'atRest')]: 100 });
  const visit = createLocationVisit({ run, registries, rng: createRng(4) }, 'camp', { restBonus: bonus });
  const preview = previewRest(visit);
  assert.equal(preview.hp, run.maxHp, 'the preview includes the bonus');
  const receipt = restAt(visit);
  assert.equal(receipt.hp, preview.hp, 'the Rest gives what the preview said');
});

test('Stamina between fights is inert while fights open with it full', () => {
  assert.equal(mechanics.stamina.combatStartRefill, 'full');
  assert.equal(restRecoveryBonus({ [recoveryKey('stamina', 'atRest')]: 100 }).stamina, 0);
  const run = createRunState({ seed: 5, classId: 'reaver', registries });
  run.stamina = 0;
  assert.equal(applyAfterCombatRecovery(run, { [recoveryKey('stamina', 'afterCombat')]: 100 }).stamina, 0);
});
