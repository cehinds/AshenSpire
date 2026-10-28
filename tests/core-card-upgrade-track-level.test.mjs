// Card upgrades 8b: R (cardTrackLevel) on the real Core profile and cards, via Core's explicit track-to-tag map.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { cardTrackLevel, skillTracks } from '../src/model/skills.js';
import { freeAllowance } from '../src/model/cardUpgradeLimits.js';

const run = (skills) => {
  const r = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  r.skills = Object.fromEntries(Object.entries(skills).map(([id, level]) => [id, { level, xp: 0 }]));
  return r;
};
const def = (id) => registries.cards.get(id);
const R = (skills, id) => cardTrackLevel(registries, run(skills), def(id));

test('Core has the tracks the map names', () => {
  const ids = skillTracks(registries).map((t) => t.id);
  for (const id of ['item:blade', 'item:shield', 'item:magic-focus', 'dualWield']) assert.ok(ids.includes(id), id);
});

test('martial cards read the blade (and dual-wield) track', () => {
  assert.equal(R({ 'item:blade': 3 }, 'core.stunningBlow'), 3);
  assert.equal(R({ 'item:blade': 3 }, 'core.ironbreaker'), 3);
  assert.equal(R({ dualWield: 5, 'item:blade': 2 }, 'core.skullsplitter'), 5, 'the highest matching track, not a sum');
  assert.equal(R({ 'item:magic-focus': 6 }, 'core.stunningBlow'), 0, 'a spell track does not level martial cards');
});

test('spells read the Spellcraft (focus) track', () => {
  assert.equal(R({ 'item:magic-focus': 4 }, 'core.cometLance'), 4);
  assert.equal(R({ 'item:magic-focus': 7 }, 'core.starfall'), 7);
  assert.equal(R({ 'item:blade': 9 }, 'core.cometLance'), 0);
});

test('guard cards also read the shield track', () => {
  assert.equal(R({ 'item:shield': 2 }, 'core.closingDodge'), 2);
  assert.equal(R({ 'item:shield': 2, 'item:blade': 1 }, 'core.rallyingRoar'), 2);
  assert.equal(R({ 'item:shield': 2 }, 'core.stunningBlow'), 0);
});

test('R feeds F on real cards: 1 + R for non-Basic, 1 for Basic and cantrips', () => {
  const r = run({ 'item:blade': 3, 'item:magic-focus': 4 });
  const F = (id) => freeAllowance(r, def(id), registries);
  assert.equal(F('core.stunningBlow'), 4);
  assert.equal(F('core.reaverSpecial'), 4);
  assert.equal(F('core.cometLance'), 5);
  assert.equal(F('core.strike'), 1);
  assert.equal(F('core.hammerBlow'), 1);
  assert.equal(F('core.cinderDart'), 1);
  assert.equal(F('core.manaSurge'), 5);
});
