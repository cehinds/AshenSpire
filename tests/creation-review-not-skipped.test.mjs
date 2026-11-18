// Item 38 (owner, 2026-11-17): "the character review page sometimes just gets skipped on character creation".
// Cause: Customise moves to the Review step and the footer re-lays out, putting a wider Begin under the same finger;
// the second tap of a double tap (or Chromium's snapped touch target) then pressed Begin and the climb started.
// The step-arrival guard makes a press that changed the step never also count as Begin. The browser repro is
// tests/creation-review-double-tap.browser.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CreateStepArrivalGuard, STEP_ARRIVAL_GUARD_MS } from '../src/ui/stepArrivalGuard.js';

test('a forward press inside the window after a step change is ignored, and allowed after it', () => {
  let clock = 1000;
  const guard = CreateStepArrivalGuard({ now: () => clock });
  assert.equal(guard.allows(), true, 'before any step change Begin acts');
  guard.arrived();
  clock += 80;
  assert.equal(guard.allows(), false, 'the second tap of a double tap does not Begin');
  clock += STEP_ARRIVAL_GUARD_MS;
  assert.equal(guard.allows(), true, 'a deliberate Begin a moment later acts');
});

test('a second tap queued during Review rendering is timed from when the input occurred', () => {
  let handledAt = 1005;
  const guard = CreateStepArrivalGuard({ now: () => handledAt });
  guard.arrived(1000);
  handledAt = 1573;
  assert.equal(guard.allows(1252), false, 'rendering delayed delivery beyond the window');
  assert.equal(guard.allows(1450), true, 'an input outside the window still begins');
});

test('character creation wires the guard: Next and Back mark arrival, Begin checks it first', () => {
  const src = readFileSync(new URL('../src/ui/screens/customize.js', import.meta.url), 'utf8');
  const next = src.match(/next\.addEventListener\('click', \(event\) => \{[\s\S]*?\n {4}\}\);/)?.[0] || '';
  assert.match(next, /stepArrival\.arrived\(event\.timeStamp\);\s*advanceFrom\(current\)/, 'Customise / Next records the step-changing input time');
  const back = src.match(/back\.addEventListener\('click', \(event\) => \{[\s\S]*?\n {2}\}\);/)?.[0] || '';
  assert.match(back, /stepArrival\.arrived\(event\.timeStamp\);\s*activate\(plan\.previous\)/, 'Back records the step-changing input time');
  const start = src.match(/start\.addEventListener\('click', async \(event\) => \{[\s\S]*?if \(startPending/)?.[0] || '';
  assert.match(start, /if \(!stepArrival\.allows\(event\.timeStamp\)\) return;/, 'Begin checks when its input took place');
});
