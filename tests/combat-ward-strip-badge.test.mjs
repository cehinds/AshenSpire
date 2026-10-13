// A Ward strip (a counter's or a rider's drain) carries the remaining Ward, so the paced reducers move
// the Ward badge with it, as they do for a damageDealt hit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { stripCombatWard } from '../src/engine/combatMatchups.js';

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
});

test('the paced reducers in combat.js and coop.js apply combatWardStripped to the Ward badge', () => {
  const combatUi = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  const coopUi = readFileSync(new URL('../src/ui/screens/coop.js', import.meta.url), 'utf8');
  assert.match(combatUi, /case 'persistentWardChanged':\s*case 'combatWardStripped':\s*if \(t\?\.persistentWard && Number\.isFinite\(e\.value\)\) \{ t\.persistentWard\.value = e\.value;/);
  assert.match(coopUi, /if \(\(event\.type === 'persistentWardChanged' \|\| event\.type === 'combatWardStripped'\) && target\?\.persistentWard && Number\.isFinite\(event\.value\)\) \{/);
});
