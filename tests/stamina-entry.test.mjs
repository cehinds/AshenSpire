// Stamina refills at fight start (plan A2, mechanics.stamina.combatStartRefill);
// Mana refills at fight end (owner 2026-10-31, mechanics.mana.combatEndRefill);
// docs/COMBAT-EQUIPMENT-RULES.md §5.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat, runCombatEnd } from '../src/engine/runCombat.js';
import { staminaAtCombatStart, manaAtCombatEnd, manaDeficitAtCombatEnd } from '../src/framework/resources.js';
import { mechanics } from '../src/framework/data/mechanics.js';

const registries = createRegistries(contentBundle);

test('the shipped entry rule is full', () => {
  assert.equal(mechanics.stamina.combatStartRefill, 'full');
  assert.equal(staminaAtCombatStart({ currentStamina: 0, maxStamina: 4 }), 4);
});

test('a fight after a draining fight opens on full Stamina, and Mana was refilled when the last fight ended', () => {
  const run = createRunState({ seed: 7, classId: 'reaver', registries });
  const first = createRunCombat({ registries, rng: createRng(7), run, enemyIds: ['wanderingSoldier'] });
  first.player.stamina = 0;
  first.player.mana = 0;
  runCombatEnd(run, first);
  assert.equal(run.stamina, 0, 'the run keeps what the fight left');
  const next = createRunCombat({ registries, rng: createRng(8), run, enemyIds: ['wanderingSoldier'] });
  assert.equal(next.player.stamina, run.maxStamina, 'Stamina refills at the door');
  assert.equal(run.mana, run.maxMana, 'Mana refills as the fight ends');
  assert.equal(next.player.mana, next.player.maxMana, 'the next fight opens on full Mana');
});

test('the Mana end rule: full, carry, unknown', () => {
  assert.equal(mechanics.mana.combatEndRefill, 'full');
  assert.equal(manaAtCombatEnd({ currentMana: 0, maxMana: 5 }), 5);
  assert.equal(manaDeficitAtCombatEnd(3), 0);
  const saved = mechanics.mana.combatEndRefill;
  try {
    mechanics.mana.combatEndRefill = 'carry';
    assert.equal(manaAtCombatEnd({ currentMana: 1, maxMana: 5 }), 1);
    assert.equal(manaDeficitAtCombatEnd(3), 3);
    const run = createRunState({ seed: 7, classId: 'reaver', registries });
    const fight = createRunCombat({ registries, rng: createRng(7), run, enemyIds: ['wanderingSoldier'] });
    fight.player.mana = 0;
    runCombatEnd(run, fight);
    assert.equal(run.mana, 0, 'carry keeps the old behaviour');
    mechanics.mana.combatEndRefill = 'half';
    assert.throws(() => manaAtCombatEnd({ currentMana: 1, maxMana: 5 }), /combatEndRefill/);
  } finally {
    mechanics.mana.combatEndRefill = saved;
  }
});

test('a Mana equipment deficit is cleared when the fight ends', () => {
  const run = createRunState({ seed: 7, classId: 'reaver', registries });
  const fight = createRunCombat({ registries, rng: createRng(7), run, enemyIds: ['wanderingSoldier'] });
  fight.equipmentPoolDeficits.mana = 2;
  runCombatEnd(run, fight);
  assert.equal(run.equipmentPoolDeficits.mana, 0);
});

test('the carry rule and an unknown rule', () => {
  const saved = mechanics.stamina.combatStartRefill;
  try {
    mechanics.stamina.combatStartRefill = 'carry';
    assert.equal(staminaAtCombatStart({ currentStamina: 1, maxStamina: 4 }), 1);
    mechanics.stamina.combatStartRefill = 'half';
    assert.throws(() => staminaAtCombatStart({ currentStamina: 1, maxStamina: 4 }), /combatStartRefill/);
  } finally {
    mechanics.stamina.combatStartRefill = saved;
  }
});

test('the co-op host seats a member through the same entry rule', () => {
  const session = readFileSync(new URL('../tools/session.mjs', import.meta.url), 'utf8');
  assert.match(session, /stamina: staminaAtCombatStart\(\{ currentStamina: m\.run\.stamina/);
  assert.match(session, /m\.run\.mana = manaAtCombatEnd\(\{ currentMana: P\.entity\.mana/, 'co-op settle refills Mana like solo');
});

test('the refill settles a Stamina deficit an equipment swap carried, and keeps the others', () => {
  const run = createRunState({ seed: 9, classId: 'reaver', registries });
  run.stamina = 0;
  run.equipmentPoolDeficits = { hp: 3, mana: 1, stamina: run.maxStamina };
  const combat = createRunCombat({ registries, rng: createRng(9), run, enemyIds: ['wanderingSoldier'] });
  assert.equal(combat.player.stamina, run.maxStamina);
  assert.equal(combat.equipmentPoolDeficits.stamina, 0, 'no stale Stamina deficit');
  assert.equal(combat.equipmentPoolDeficits.hp, 3);
  assert.equal(combat.equipmentPoolDeficits.mana, 1);
});

test('the refill settles a carried Stamina deficit even when the pool already reads full', () => {
  const run = createRunState({ seed: 10, classId: 'reaver', registries });
  run.stamina = run.maxStamina; // recovered to a smaller vessel, deficit still hidden
  run.equipmentPoolDeficits = { hp: 0, mana: 0, stamina: run.maxStamina + 2 };
  const combat = createRunCombat({ registries, rng: createRng(10), run, enemyIds: ['wanderingSoldier'] });
  assert.equal(combat.equipmentPoolDeficits.stamina, 0);
});
