// The owner's exported settings (2026-11-05) are the Core defaults, and developer
// switches default off. A fresh profile reads these straight from content, with
// no stored setting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { balance } from '../src/content/balance.js';
import { uiConfig } from '../src/config/generated/ui.js';
import { settingsRows } from '../src/ui/screens/settings.js';

test('Core content carries the owner\'s balance defaults', () => {
  // level.xp.growth stays 1.303 (SPEC §13.4o, tests/run-node #50): the owner's exported 1.5 is NOT baked.
  assert.equal(balance.level.xp.growth, 1.303);
  assert.equal(balance.rewards.cardChoices, 3);
  const chance = balance.rewards.cardRewards.chancePct;
  assert.deepEqual([chance.normal, chance.elite, chance.boss], [10, 10, 10]);
});

test('Core prologue content carries the owner\'s scene defaults', () => {
  const all = [];
  const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (o.id && o.actor) all.push(o); Object.values(o).forEach(walk); } };
  walk(uiConfig.screens.prologue);
  const step = all.find((s) => s.id === 'step');
  const extraA = all.find((s) => s.id === 'extraA');
  assert.equal(extraA.character, false);
  assert.deepEqual({ ...step.actor.desktop }, { x: 50, y: 96, height: 40, rotation: 0, layer: 'behindWash' });
});

test('developer and debug switches default off', () => {
  const rows = new Map(settingsRows().map((r) => [r.key, r]));
  for (const key of ['mapHeaderSeed', 'debugMode']) assert.equal(rows.get(key).def, false, key);
});
