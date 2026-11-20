// W25: a fight saved before element rules (no `elements` key) plays exactly as before, and a fight with them keeps them through a save round trip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fight, play } from './elementFixture.mjs';
import { ElementRulesOf } from '../src/model/elementIdentityRules.js';
import { validateFixCoreRules } from '../src/model/fixCoreMechanics.js';
import { createRng } from '../src/engine/rng.js';

test('rules without `elements` validate and read as no element rules; new fights carry version 1', () => {
  const now = fight(), old = fight({ legacy: true });
  assert.equal(ElementRulesOf(now.combat).version, 1);
  assert.equal(ElementRulesOf(old.combat), null);
  const stripped = structuredClone(now.combat.fixCoreRules); delete stripped.elements;
  assert.doesNotThrow(() => validateFixCoreRules(stripped));
  assert.equal(ElementRulesOf(JSON.parse(JSON.stringify(now.combat))).version, 1, 'survives a JSON round trip');
});

test('an old fight plays a fire card exactly as the rules before W25 did: one target, no Burn change, the elements stream untouched', () => {
  const old = fight({ enemies: 2, legacy: true, poise: 3 });
  const played = play(old.combat, 'core.cinderDart', old.enemies[0].id);
  assert.equal(played.lost.e2, 0);
  assert.equal(old.enemies[0].statuses.burn.stacks, 2, 'only the printed Burn');
  assert.equal(old.combat.rng.getCounters().elements, undefined);
});

test('the elements stream is appended last and is omitted from a save while untouched', () => {
  const rng = createRng(7);
  assert.equal(rng.getCounters().elements, undefined);
  rng.chance('elements', 50);
  assert.equal(rng.getCounters().elements, 1);
  assert.doesNotThrow(() => createRng(7).restoreCounters(Object.fromEntries(Object.entries(createRng(7).getCounters()))));
});
