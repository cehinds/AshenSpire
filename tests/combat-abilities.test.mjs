import test from 'node:test';
import assert from 'node:assert/strict';
import { activeCombatAbilities } from '../src/ui/components/combatAbilities.js';
import { prototypeBundle, prototypeRegistries } from '../src/content/prototypes/combatBuilds.js';
import { createRegistries } from '../src/model/registries.js';

test('active inspection includes the stance, Evade and every live effect, with no class-description entry', () => {
  const rows = activeCombatAbilities(prototypeRegistries(), { stanceId: 'prototypeGuardStance', evade: 2,
    statuses: { strength: { stacks: 3 }, vulnerable: { stacks: 1, duration: 2 }, bleed: { stacks: 0 } } }, true);
  assert.deepEqual(rows.map(row => row.id), ['prototypeGuardStance', 'evade', 'strength', 'vulnerable']);
  assert.match(rows[0].detail, /Gain 3 Block when entering\. Gain 2 Block/);
  assert.match(rows[1].detail, /2 charges remaining/);
  assert.match(rows[1].detail, /start of your next turn/);
  assert.match(rows[2].name, /3/);
  assert.match(rows[3].detail, /Turns left: 2/);
});

test('consumed Evade and replaced stances disappear from live inspection', () => {
  const rows = activeCombatAbilities(prototypeRegistries(), { stanceId: 'prototypeFocusStance', evade: 0, statuses: {} }, true);
  assert.deepEqual(rows.map(row => row.id), ['prototypeFocusStance']);
  assert.equal(rows[0].name, 'Astral Focus');
  assert.match(rows[0].detail, /until replaced or combat ends/);
  assert.deepEqual(activeCombatAbilities(prototypeRegistries(), { evade: 1, statuses: {} }, false), []);
});

test('stance explanations derive their numbers from the active bundle', () => {
  const bundle = prototypeBundle();
  const stance = bundle.stances.find(row => row.id === 'prototypeGuardStance');
  stance.onEnter[0].amount = 7; stance.hooks[0].do[0].amount = 4;
  const [row] = activeCombatAbilities(createRegistries(bundle), { stanceId: stance.id, statuses: {} });
  assert.match(row.detail, /Gain 7 Block when entering\. Gain 4 Block/);
  assert(!row.detail.includes('{'));
});
