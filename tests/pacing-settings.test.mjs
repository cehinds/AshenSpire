// D11 (owner, 2026-10-18): the pause between steps and the auto-combat speed are
// player settings, persisted with the other profile rows, and presentation-only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsRows } from '../src/ui/screens/settings.js';
import { profileKeys } from '../src/model/settingsSync.js';
import { actionPacing, setAnimSpeed, setCombatPacing } from '../src/ui/animationPace.js';

const row = key => settingsRows().find(r => r.key === key);

test('Pause between steps defaults to 0.5 s and ranges 0.25 to 2 s', () => {
  const gap = row('combatStepPause');
  assert.deepEqual([gap.def, gap.min, gap.max, gap.type], [500, 250, 2000, 'number']);
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
  for (const key of ['combatStepPause', 'autoCombatSpeed', 'combatSpeed', 'autoCombat']) assert.ok(keys.includes(key), key);
});

test('saved values reach the pacing, and a cleared value falls back to the defaults', () => {
  setAnimSpeed('normal');
  setCombatPacing({ combatStepPause: 500, autoCombatSpeed: 2, autoCombat: true });
  assert.equal(actionPacing().gapMs, 250, '500 ms at ×2');
  setCombatPacing({ autoCombat: true, autoCombatSpeed: undefined, combatStepPause: undefined });
  assert.ok(Math.abs(actionPacing().gapMs - 500 / 1.5) < 1e-9);
  setCombatPacing({});
  assert.equal(actionPacing().gapMs, 500);
  setCombatPacing();
});

test('reduced motion and the Instant pace still drop every pause', () => {
  setAnimSpeed('normal'); setCombatPacing({ combatStepPause: 2000 });
  const reduced = actionPacing({ reduced: true });
  assert.equal(reduced.gapMs + reduced.wordMs + reduced.resultMs + reduced.damageMs + reduced.resetMs, 0);
  setAnimSpeed('instant'); assert.equal(actionPacing().gapMs, 0);
  setAnimSpeed('normal'); setCombatPacing();
});

test('the shorter default preserves an explicitly saved pause and authored sprite duration', () => {
  setAnimSpeed('normal'); setCombatPacing();
  const defaultClip = actionPacing().spriteSpeed.lungeMs;
  setCombatPacing({ combatStepPause: 1000 });
  assert.equal(actionPacing().gapMs, 1000);
  assert.equal(actionPacing().spriteSpeed.lungeMs, defaultClip);
  assert.equal(defaultClip, 390);
  setCombatPacing();
});

test('a saved pre-D11 combatActionDelay (old Action delay) does not carry into the new pause', () => {
  setAnimSpeed('normal'); setCombatPacing({ combatActionDelay: 0 });
  assert.equal(actionPacing().gapMs, 500);
  setCombatPacing({ combatActionDelay: 5000 });
  assert.equal(actionPacing().gapMs, 500);
  setCombatPacing();
});

test('animation duration and combat interval independently control their timeline paths', () => {
  setAnimSpeed('normal'); setCombatPacing();
  const baseline = actionPacing();
  setCombatPacing({ animationStepDuration: 195 });
  const quickSprite = actionPacing();
  assert.equal(quickSprite.spriteSpeed.lungeMs, 195);
  for (const key of ['gapMs', 'wordMs', 'afterSpriteMs', 'resultMs', 'reactionMs', 'damageMs', 'resetMs', 'stepMs']) {
    assert.equal(quickSprite[key], baseline[key], key);
  }
  setCombatPacing({ animationStepDuration: 195, combatStepPause: 1000 });
  assert.equal(actionPacing().gapMs, 1000);
  assert.deepEqual(actionPacing().spriteSpeed, quickSprite.spriteSpeed);
  setCombatPacing({ animationStepDuration: Infinity });
  assert.equal(actionPacing().spriteSpeed.lungeMs, 390);
  setCombatPacing({ animationStepDuration: -5 });
  assert.ok(Math.abs(actionPacing().spriteSpeed.lungeMs - 50) < 1e-9);
  setCombatPacing({ animationStepDuration: 99999 });
  assert.equal(actionPacing().spriteSpeed.lungeMs, 3000);
  setCombatPacing();
});

test('mobile fast preset writes visible persisted controls, manual edits return to custom', async () => {
  const { combatPacingChanges } = await import('../src/model/autoCombatPolicy.js');
  const saved = { combatStepPause: 2000, animationStepDuration: 1000, combatSpeed: 2 };
  Object.assign(saved, combatPacingChanges('combatPacingPreset', 'mobile-fast'));
  assert.equal(saved.combatStepPause, 250);
  assert.equal(saved.animationStepDuration, 195);
  assert.equal(saved.combatSpeed, 2);
  Object.assign(saved, combatPacingChanges('animationStepDuration', 400));
  assert.equal(saved.combatPacingPreset, 'custom');
  assert.equal(saved.combatStepPause, 250);
  assert.equal(saved.animationStepDuration, 400);
  const keys = profileKeys(settingsRows());
  for (const key of ['animationStepDuration', 'combatPacingPreset']) assert.ok(keys.includes(key));
  assert.deepEqual([row('animationStepDuration').def, row('animationStepDuration').min, row('animationStepDuration').max], [390, 50, 3000]);
});
