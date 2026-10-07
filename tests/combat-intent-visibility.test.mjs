import test from 'node:test';
import assert from 'node:assert/strict';
import { hiddenIntentChance, concealIntent, combatIntentStance } from '../src/model/combatIntentVisibility.js';

test('intent concealment starts at 70% and Wisdom reduces it twice as much as Intelligence', () => {
  assert.equal(hiddenIntentChance(), 0.70);
  assert.ok(Math.abs(hiddenIntentChance({ wisdom: 1, intelligence: 1 }) - 0.67) < 1e-12);
  assert.equal(hiddenIntentChance({ wisdom: 50, intelligence: 50 }), 0);
  assert.equal(hiddenIntentChance({ wisdom: -100 }), 0.95);
  assert.equal(hiddenIntentChance({ wisdom: NaN, intelligence: Infinity }), 0.70);
  assert.equal(hiddenIntentChance({ wisdom: 2 }, { baseHiddenChance: 0.5, wisdomReduction: 0.1 }), 0.3);
});

test('hidden intent exposes stance and omits every exact move field', () => {
  const original = { kind: 'attack', moveId: 'iceBolt', damage: 17, totalDamage: 34, hits: 2,
    block: 3, delayed: true, pending: true, effects: [{ op: 'applyStatus', status: 'chill' }],
    futureMoveSecret: 'never expose' };
  const profile = { camp: 'spell', maneuver: 'ranged', school: 'frost', damageTypes: ['cold'] };
  const before = JSON.stringify({ original, profile });
  const hidden = concealIntent(original, profile);
  assert.deepEqual(hidden, { kind: 'unknown', moveId: null, stance: 'casting', hidden: true,
    revealed: false, profile: { camp: 'spell', maneuver: 'ranged' } });
  assert.equal(JSON.stringify({ original, profile }), before);
});

test('all physical techniques have distinct readable stances', () => {
  for (const [maneuver, stance] of Object.entries({ attack: 'attacking', defend: 'defending',
    counter: 'countering', sweep: 'sweeping', ranged: 'ranged', smash: 'smashing' })) {
    assert.equal(combatIntentStance({}, { camp: 'physical', maneuver }), stance);
  }
  assert.equal(combatIntentStance({}, { camp: 'spell', maneuver: 'counter' }), 'countering');
  assert.equal(combatIntentStance({ kind: 'staggered' }), 'staggered');
});
