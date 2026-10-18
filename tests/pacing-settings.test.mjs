// D11 (owner, 2026-10-18): the pause between steps and the auto-combat speed are
// player settings, persisted with the other profile rows, and presentation-only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsRows } from '../src/ui/screens/settings.js';
import { profileKeys } from '../src/model/settingsSync.js';
import { actionPacing, setAnimSpeed, setCombatPacing } from '../src/ui/animationPace.js';

const row = key => settingsRows().find(r => r.key === key);

test('Pause between steps defaults to 1 s and ranges 0.25 to 2 s', () => {
  const gap = row('combatActionDelay');
  assert.deepEqual([gap.def, gap.min, gap.max, gap.type], [1000, 250, 2000, 'number']);
  assert.match(gap.label, /Pause between steps/);
});

test('Auto combat speed defaults to ×1.5 and ranges ×1 to ×3, beside the manual Combat speed', () => {
  const auto = row('autoCombatSpeed');
  assert.deepEqual([auto.def, auto.min, auto.max, auto.type], [1.5, 1, 3, 'number']);
  assert.match(auto.label, /Auto combat speed/);
  assert.equal(row('combatSpeed').def, 1, 'the manual multiplier stays ×1');
});

test('both rows persist and export with the settings profile', () => {
  const keys = profileKeys(settingsRows());
  for (const key of ['combatActionDelay', 'autoCombatSpeed', 'combatSpeed', 'autoCombat']) assert.ok(keys.includes(key), key);
});

test('saved values reach the pacing, and a cleared value falls back to the defaults', () => {
  setAnimSpeed('normal');
  setCombatPacing({ combatActionDelay: 500, autoCombatSpeed: 2, autoCombat: true });
  assert.equal(actionPacing().gapMs, 250, '500 ms at ×2');
  setCombatPacing({ autoCombat: true, autoCombatSpeed: undefined, combatActionDelay: undefined });
  assert.ok(Math.abs(actionPacing().gapMs - 1000 / 1.5) < 1e-9);
  setCombatPacing({});
  assert.equal(actionPacing().gapMs, 1000);
  setCombatPacing();
});

test('reduced motion and the Instant pace still drop every pause', () => {
  setAnimSpeed('normal'); setCombatPacing({ combatActionDelay: 2000 });
  const reduced = actionPacing({ reduced: true });
  assert.equal(reduced.gapMs + reduced.wordMs + reduced.resultMs + reduced.damageMs + reduced.resetMs, 0);
  setAnimSpeed('instant'); assert.equal(actionPacing().gapMs, 0);
  setAnimSpeed('normal'); setCombatPacing();
});
