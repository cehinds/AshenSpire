// The Combat speed rows take quarter steps. They were integer rows, so every
// commit floored a typed or stepped ×1.5 to ×1 and the speed never moved
// (owner, 2026-10-31). Row → committed value → actionPacing timing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsRow, commitNumberRow, buttonStep } from '../src/ui/screens/settings.js';
import { combatPacingChanges } from '../src/model/autoCombatPolicy.js';
import { actionPacing, setAnimSpeed, setCombatPacing } from '../src/ui/animationPace.js';

test('combatSpeed and autoCombatSpeed are not integer rows and keep quarter steps', () => {
  for (const key of ['combatSpeed', 'autoCombatSpeed']) {
    const row = settingsRow(key);
    assert.equal(row.integer, false, key);
    for (const v of [1.25, 1.5, 1.75, 2.5]) assert.equal(commitNumberRow({}, row, v).value, v, `${key} ${v}`);
    assert.ok(buttonStep(row, 1) <= 0.25 + 1e-9 || buttonStep(row, 1) < 1, `${key} stepper moves by a fraction`);
  }
  assert.equal(commitNumberRow({}, settingsRow('combatSpeed'), 99).value, 8, 'still clamps to the row maximum');
  assert.equal(commitNumberRow({}, settingsRow('autoCombatSpeed'), 0.5).value, 1, 'auto floor stays ×1');
});

test('a committed ×1.5 reaches the beat timing; ×1 and ×1.5 differ', () => {
  setAnimSpeed('normal');
  const at = (value, extra = {}) => {
    const committed = commitNumberRow({}, settingsRow('combatSpeed'), value).value;
    setCombatPacing({ combatSpeed: committed, ...extra });
    return actionPacing();
  };
  const one = at(1), oneHalf = at(1.5);
  assert.ok(Math.abs(oneHalf.scale - one.scale / 1.5) < 1e-9, 'scale divides by the multiplier');
  assert.ok(oneHalf.gapMs < one.gapMs && oneHalf.stepMs < one.stepMs);
  assert.ok(oneHalf.spriteSpeed.lungeMs < one.spriteSpeed.lungeMs, 'sprite playback speeds up too');
  setCombatPacing();
});

test('auto combat ×1.5 vs ×2 changes the timing while auto combat is on', () => {
  setAnimSpeed('normal');
  const at = (value) => {
    setCombatPacing({ autoCombat: true, autoCombatSpeed: commitNumberRow({}, settingsRow('autoCombatSpeed'), value).value });
    return actionPacing().gapMs;
  };
  assert.ok(at(1.5) > at(2));
  setCombatPacing();
});

test('the Mobile fast preset writes the two visible values the timing reads', () => {
  const changes = combatPacingChanges('combatPacingPreset', 'mobile-fast');
  assert.deepEqual(changes, { combatPacingPreset: 'mobile-fast', combatStepPause: 250, animationStepDuration: 195 });
  setAnimSpeed('normal');
  setCombatPacing({ combatSpeed: 1 });
  const custom = actionPacing();
  setCombatPacing({ combatSpeed: 1, ...changes });
  const fast = actionPacing();
  assert.equal(fast.gapMs, 250);
  assert.ok(fast.gapMs < custom.gapMs && fast.spriteSpeed.lungeMs < custom.spriteSpeed.lungeMs);
  setCombatPacing();
});

import { floaterLifeMs, COMBAT_TIMING } from '../src/ui/animationPace.js';
import { readFileSync } from 'node:fs';

test('a number floater lives at least 1.1 s held at ×1, scales with Combat speed, fade is the last third', () => {
  setAnimSpeed('fast'); // a phone's Auto pace must not shrink it
  setCombatPacing({ combatSpeed: 1 });
  const life = floaterLifeMs();
  assert.ok(life * (1 - COMBAT_TIMING.floaterFadeFraction) >= 1100 - 1, `hold ${life * 2 / 3} ms`);
  setCombatPacing({ combatSpeed: 2 });
  assert.ok(floaterLifeMs() < life && floaterLifeMs() >= COMBAT_TIMING.floaterMinLifeMs);
  setCombatPacing({ combatSpeed: 8 });
  assert.equal(floaterLifeMs(), COMBAT_TIMING.floaterMinLifeMs);
  setAnimSpeed('instant');
  assert.equal(floaterLifeMs(), COMBAT_TIMING.floaterInstantMs);
  setAnimSpeed('normal'); setCombatPacing();
});

test('the CSS fade starts at two thirds of the life the script sets', () => {
  const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
  assert.match(css, /@keyframes num-life \{[\s\S]*?66\.6% \{ opacity: 1/);
  assert.match(css, /num-life var\(--float-ms/);
  const fx = readFileSync(new URL('../src/ui/fx.js', import.meta.url), 'utf8');
  assert.match(fx, /setTimeout\(\(\) => el\.remove\(\), life \+ 60\)/);
});
