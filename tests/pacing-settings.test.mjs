// D11 (owner, 2026-10-18): the pause between steps and the auto-combat speed are
// player settings, persisted with the other profile rows, and presentation-only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsRows, resetKeys, commitNumberRow } from '../src/ui/screens/settings.js';
import { profileKeys } from '../src/model/settingsSync.js';
import { actionPacing, setAnimSpeed, setCombatPacing } from '../src/ui/animationPace.js';

const row = key => settingsRows().find(r => r.key === key);

test('Pause between steps defaults to 0.5 s and ranges 0 to 2 s', () => {
  const gap = row('combatStepPause');
  assert.deepEqual([gap.def, gap.min, gap.max, gap.type], [500, 0, 2000, 'number']);
  assert.match(gap.label, /Pause between steps/);
});

test('Auto combat speed defaults to ×1.5 and ranges ×1 to ×3, beside the manual Combat speed', () => {
  const auto = row('autoCombatSpeed');
  assert.deepEqual([auto.def, auto.min, auto.max, auto.type], [1.5, 1, 3, 'number']);
  assert.match(auto.label, /Auto combat speed/);
  assert.equal(row('combatSpeed').def, 1.25, 'the manual multiplier defaults to ×1.25 (owner 2026-10-26)');
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
  assert.equal(actionPacing().gapMs, 500 / 1.25, 'the default 500 ms at the ×1.25 manual default');
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
  setAnimSpeed('normal'); setCombatPacing({ combatSpeed: 1 });
  const defaultClip = actionPacing().spriteSpeed.lungeMs;
  setCombatPacing({ combatSpeed: 1, combatStepPause: 1000 });
  assert.equal(actionPacing().gapMs, 1000);
  assert.equal(actionPacing().spriteSpeed.lungeMs, defaultClip);
  assert.equal(defaultClip, 390);
  setCombatPacing();
});

test('a saved pre-D11 combatActionDelay (old Action delay) does not carry into the new pause', () => {
  setAnimSpeed('normal'); setCombatPacing({ combatActionDelay: 0 });
  assert.equal(actionPacing().gapMs, 500 / 1.25);
  setCombatPacing({ combatActionDelay: 5000 });
  assert.equal(actionPacing().gapMs, 500 / 1.25);
  setCombatPacing();
});

test('animation duration and combat interval independently control their timeline paths', () => {
  setAnimSpeed('normal'); setCombatPacing({ combatSpeed: 1 });
  const baseline = actionPacing();
  setCombatPacing({ combatSpeed: 1, animationStepDuration: 195 });
  const quickSprite = actionPacing();
  assert.equal(quickSprite.spriteSpeed.lungeMs, 195);
  for (const key of ['gapMs', 'wordMs', 'afterSpriteMs', 'resultMs', 'reactionMs', 'damageMs', 'resetMs', 'stepMs']) {
    assert.equal(quickSprite[key], baseline[key], key);
  }
  setCombatPacing({ combatSpeed: 1, animationStepDuration: 195, combatStepPause: 1000 });
  assert.equal(actionPacing().gapMs, 1000);
  assert.deepEqual(actionPacing().spriteSpeed, quickSprite.spriteSpeed);
  setCombatPacing({ combatSpeed: 1, animationStepDuration: Infinity });
  assert.equal(actionPacing().spriteSpeed.lungeMs, 390);
  setCombatPacing({ combatSpeed: 1, animationStepDuration: -5 });
  assert.ok(Math.abs(actionPacing().spriteSpeed.lungeMs - 50) < 1e-9);
  setCombatPacing({ combatSpeed: 1, animationStepDuration: 99999 });
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


test('zero pause is a valid committed value and preserves normal sprite duration', () => {
  const committed = commitNumberRow({}, row('combatStepPause'), '0');
  assert.deepEqual(committed, { value: 0, refusal: null });
  setAnimSpeed('normal'); setCombatPacing({ combatSpeed: 1, combatStepPause: committed.value });
  const timing = actionPacing();
  for (const key of ['gapMs', 'wordMs', 'afterSpriteMs', 'resultMs', 'reactionMs', 'damageMs', 'resetMs']) assert.equal(timing[key], 0, key);
  assert.equal(timing.spriteSpeed.lungeMs, 390, 'turning pauses off retains normal animation');
  setCombatPacing();
});

test('resetting either timing row updates the saved preset in the same transaction', async () => {
  for (const key of ['combatStepPause', 'animationStepDuration']) {
    const settings = { combatPacingPreset: 'mobile-fast', combatStepPause: 250, animationStepDuration: 195 };
    const writes = [];
    const snapshot = await resetKeys(settings, changes => { writes.push(changes); return { ok: true }; }, [key], 'Timing reset', { promoted: {} });
    assert.equal(settings.combatPacingPreset, 'custom');
    assert.equal(writes[0].combatPacingPreset, 'custom');
    assert.equal(snapshot.combatPacingPreset, 'mobile-fast', 'undo retains the original preset');
    assert.equal(settings[key], undefined);
    const untouched = key === 'combatStepPause' ? 'animationStepDuration' : 'combatStepPause';
    assert.equal(settings[untouched], untouched === 'animationStepDuration' ? 195 : 250);
  }
});

test('a failed timing reset restores both the preset and control value', async () => {
  const settings = { combatPacingPreset: 'mobile-fast', combatStepPause: 250, animationStepDuration: 195 };
  let calls = 0;
  await resetKeys(settings, () => ({ ok: ++calls !== 1 }), ['combatStepPause'], 'Timing reset', { promoted: {} });
  assert.deepEqual(settings, { combatPacingPreset: 'mobile-fast', combatStepPause: 250, animationStepDuration: 195 });
});
