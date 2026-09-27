// The in-run Load door keeps the overlay open until the load is certain
// (Codex review on #1355). Launched from the in-run overlay's quick
// navigation, confirmSlotLoad's `returnFocusElement` is a button inside that
// overlay. Closing the overlay before resumeRun knew the outcome disconnected
// it, so a refused load's "Keep playing" could not restore focus and keyboard
// and gamepad players were left on <body> with the live run still onscreen.
// tools/slot-load-door.mjs drives the refusal in the real page, through the
// combat menu and (SLOT-LOAD-OVERLAY-FOCUS) through the overlay's quick
// navigation, asserting focus lands back on its launcher; this pins the order
// the overlay path depends on.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

function functionBody(name) {
  const start = main.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `src/main.js still defines ${name}`);
  const next = main.indexOf('\nfunction ', start + 1);
  return main.slice(start, next < 0 ? undefined : next);
}

test('confirmSlotLoad closes the overlay only through resumeRun\'s success hook', () => {
  const body = functionBody('confirmSlotLoad');
  const confirm = body.slice(body.indexOf('onConfirm:'));
  assert.ok(confirm.includes('onLoaded: closeOverlay'), 'the load confirmation hands closeOverlay to resumeRun as onLoaded');
  assert.equal(/closeOverlay\(\)/.test(confirm), false,
    'the load confirmation must not close the overlay before the load outcome is known');
});

test('resumeRun calls onLoaded after both loads succeed and before the live run is swapped', () => {
  const body = functionBody('resumeRun');
  const lastRefusal = body.lastIndexOf('if (!loaded) return refused();');
  const hook = body.indexOf('onLoaded?.()');
  const swap = body.indexOf('run = loaded;');
  assert.ok(lastRefusal >= 0 && hook > lastRefusal, 'onLoaded runs only after the last refusal point');
  assert.ok(swap > hook, 'onLoaded runs before the live run is replaced');
});
