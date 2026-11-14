// D11 (owner, 2026-10-18): the pause between steps and the auto-combat speed are
// player settings, persisted with the other profile rows, and presentation-only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsRows, resetKeys, commitNumberRow } from '../src/ui/screens/settings.js';
import { profileKeys } from '../src/model/settingsSync.js';
import { actionPacing, setAnimSpeed, setCombatPacing } from '../src/ui/animationPace.js';
import { ACTION_PACING } from '../src/model/autoCombatPolicy.js';

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
  assert.equal(defaultClip, 550);
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
  setCombatPacing({ combatSpeed: 1, animationStepDuration: 275 });
  const quickSprite = actionPacing();
  assert.equal(quickSprite.spriteSpeed.lungeMs, 275);
  for (const key of ['gapMs', 'wordMs', 'afterSpriteMs', 'resultMs', 'reactionMs', 'damageMs', 'resetMs', 'stepMs']) {
    assert.equal(quickSprite[key], baseline[key], key);
  }
  setCombatPacing({ combatSpeed: 1, animationStepDuration: 275, combatStepPause: 1000 });
  assert.equal(actionPacing().gapMs, 1000);
  assert.deepEqual(actionPacing().spriteSpeed, quickSprite.spriteSpeed);
  setCombatPacing({ combatSpeed: 1, animationStepDuration: Infinity });
  assert.equal(actionPacing().spriteSpeed.lungeMs, 550);
  setCombatPacing({ combatSpeed: 1, animationStepDuration: -5 });
  // Re-pinned 2026-11-02 (sprite pacing): the shortest step (50 ms) is lifted to the 75 ms frame-hold floor
  // (animationPace.js COMBAT_TIMING.frameHoldMinMs, was 40 ms), so a lunge is never shorter than one held frame.
  assert.ok(Math.abs(actionPacing().spriteSpeed.lungeMs - 75) < 1e-9);
  setCombatPacing({ combatSpeed: 1, animationStepDuration: 99999 });
  assert.equal(actionPacing().spriteSpeed.lungeMs, 3000);
  setCombatPacing();
});

test('mobile fast preset writes visible persisted controls, manual edits return to custom', async () => {
  const { combatPacingChanges } = await import('../src/model/autoCombatPolicy.js');
  const saved = { combatStepPause: 2000, animationStepDuration: 1000, combatSpeed: 2 };
  Object.assign(saved, combatPacingChanges('combatPacingPreset', 'mobile-fast'));
  assert.equal(saved.combatStepPause, 250);
  assert.equal(saved.animationStepDuration, 275);
  assert.equal(saved.combatSpeed, 2);
  Object.assign(saved, combatPacingChanges('animationStepDuration', 400));
  assert.equal(saved.combatPacingPreset, 'custom');
  assert.equal(saved.combatStepPause, 250);
  assert.equal(saved.animationStepDuration, 400);
  const keys = profileKeys(settingsRows());
  for (const key of ['animationStepDuration', 'combatPacingPreset']) assert.ok(keys.includes(key));
  assert.deepEqual([row('animationStepDuration').def, row('animationStepDuration').min, row('animationStepDuration').max], [550, 50, 3000]);
});


test('zero pause is a valid committed value and preserves normal sprite duration', () => {
  const committed = commitNumberRow({}, row('combatStepPause'), '0');
  assert.deepEqual(committed, { value: 0, refusal: null });
  setAnimSpeed('normal'); setCombatPacing({ combatSpeed: 1, combatStepPause: committed.value });
  const timing = actionPacing();
  for (const key of ['gapMs', 'wordMs', 'afterSpriteMs', 'resultMs', 'reactionMs', 'damageMs', 'resetMs']) assert.equal(timing[key], 0, key);
  assert.equal(timing.spriteSpeed.lungeMs, 550, 'turning pauses off retains normal animation');
  setCombatPacing();
});

test('resetting either timing row updates the saved preset in the same transaction', async () => {
  for (const key of ['combatStepPause', 'animationStepDuration']) {
    const settings = { combatPacingPreset: 'mobile-fast', combatStepPause: 250, animationStepDuration: 275 };
    const writes = [];
    const snapshot = await resetKeys(settings, changes => { writes.push(changes); return { ok: true }; }, [key], 'Timing reset', { promoted: {} });
    assert.equal(settings.combatPacingPreset, 'custom');
    assert.equal(writes[0].combatPacingPreset, 'custom');
    assert.equal(snapshot.combatPacingPreset, 'mobile-fast', 'undo retains the original preset');
    assert.equal(settings[key], undefined);
    const untouched = key === 'combatStepPause' ? 'animationStepDuration' : 'combatStepPause';
    assert.equal(settings[untouched], untouched === 'animationStepDuration' ? 275 : 250);
  }
});

test('a failed timing reset restores both the preset and control value', async () => {
  const settings = { combatPacingPreset: 'mobile-fast', combatStepPause: 250, animationStepDuration: 275 };
  let calls = 0;
  await resetKeys(settings, () => ({ ok: ++calls !== 1 }), ['combatStepPause'], 'Timing reset', { promoted: {} });
  assert.deepEqual(settings, { combatPacingPreset: 'mobile-fast', combatStepPause: 250, animationStepDuration: 275 });
});

test('enemy pacing is its own pair of settings, both 750 ms by default, and moves only enemy timing', async () => {
  const { floaterStaggerMs } = await import('../src/ui/animationPace.js');
  const turn = ACTION_PACING.enemyTurn;
  const floaterShare = turn.floaterIntervalMs / ACTION_PACING.enemyFloaterIntervalDefaultMs;
  const clipShare = ACTION_PACING.spritePlaybackRate / turn.spritePlaybackRate;
  setAnimSpeed('normal'); setCombatPacing();
  assert.equal(floaterStaggerMs(), 750);
  assert.equal(floaterStaggerMs({ enemy: true }), Math.round(750 * floaterShare), 'the enemies act on motion.enemyTurn: a shorter floater interval than the player\'s');
  assert.equal(actionPacing({ enemy: true }).spriteSpeed.lungeMs, Math.round(actionPacing().spriteSpeed.lungeMs * clipShare), 'the same animation step, played at the enemy clip rate');
  setCombatPacing({ enemyAttackMs: 1500, enemyFloaterIntervalMs: 375 });
  assert.equal(floaterStaggerMs({ enemy: true }), Math.round(375 * floaterShare));
  assert.equal(floaterStaggerMs(), 750, 'the player interval is untouched');
  assert.equal(actionPacing({ enemy: true }).spriteSpeed.lungeMs, Math.round(2 * actionPacing().spriteSpeed.lungeMs * clipShare));
  setCombatPacing({ enemyAttackMs: 1, enemyFloaterIntervalMs: 99999 });
  assert.equal(actionPacing({ enemy: true }).spriteSpeed.lungeMs > 0, true);
  assert.equal(floaterStaggerMs({ enemy: true }), Math.round(3000 * floaterShare), 'the setting is bounded to 3000 ms before the enemy turn pacing scales it');
  setCombatPacing();
});

test('the enemies\' turn runs on its own, shorter stage gaps; the player\'s plays keep the pinned stages', () => {
  setAnimSpeed('normal'); setCombatPacing();
  const turn = ACTION_PACING.enemyTurn, player = actionPacing(), enemy = actionPacing({ enemy: true });
  assert.equal(player.gapMs, ACTION_PACING.stageGapMs * 0.8, 'the player stage gap is unchanged (500 ms at the default speed 1.25)');
  assert.equal(enemy.gapMs, turn.stageGapMs * 0.8, 'the enemy stage gap is motion.enemyTurn.stageGapMs at the same speed');
  assert.ok(enemy.gapMs < player.gapMs && enemy.bannerMs < player.bannerMs && enemy.telegraphMs > 0 && player.telegraphMs === 0);
  setCombatPacing({ combatStepPause: 1000 });
  assert.equal(actionPacing({ enemy: true }).gapMs, 2 * enemy.gapMs, 'the Pause between steps row still scales the enemy gap');
  setCombatPacing({ combatSpeed: 2.5 });
  assert.ok(actionPacing({ enemy: true }).gapMs < enemy.gapMs, 'a faster Combat speed is still faster for the enemies');
  setCombatPacing();
  assert.deepEqual([...Object.keys(actionPacing({ reduced: true, enemy: true }))].filter(k => /Ms$/.test(k) && actionPacing({ reduced: true, enemy: true })[k] !== 0), [], 'reduced motion removes every enemy wait too');
});

test('the enemy pacing rows are persisted Combat settings with 750 ms defaults', () => {
  const keys = profileKeys(settingsRows());
  for (const key of ['enemyAttackMs', 'enemyFloaterIntervalMs']) {
    assert.ok(keys.includes(key), key);
    assert.deepEqual([row(key).def, row(key).min, row(key).max, row(key).cat], [750, 100, 3000, 'Combat']);
  }
});
