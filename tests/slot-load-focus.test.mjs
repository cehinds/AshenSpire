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

test('resumeRun calls onLoaded after saved-run context validation and before the live run is swapped', () => {
  const body = functionBody('resumeRun');
  const load = body.indexOf('context = LoadSavedRunContext(');
  const lastRefusal = body.indexOf('if (!context.run)');
  const hook = body.indexOf('onLoaded?.()');
  const swap = body.indexOf('run = loaded;');
  assert.ok(load >= 0 && lastRefusal > load && hook > lastRefusal, 'onLoaded runs only after the context is validated and contains a run');
  assert.ok(swap > hook, 'onLoaded runs before the live run is replaced');
});

// Execute the actual load door through adoption. Later rendering is unrelated
// to whether a refused load leaves its launcher and live run in place.
function loadDoor(context, error = null) {
  const body = functionBody('resumeRun');
  const end = body.indexOf('\n  rng = createRng(');
  assert.ok(end > body.indexOf('run = loaded;'), 'the probe includes run adoption');
  const loadThroughAdoption = body.slice(0, end) + '\n  return "adopted";\n}';
  return new Function('contextResult', 'loadError', `
    const original = {}, originalCombat = {}, originalRegistries = {};
    let run = original, xpCombat = originalCombat, registries = originalRegistries;
    let activeSlot = 1, registryGameProfile, lastRegistryBuild, terminalResume = null;
    let overlayOpen = true;
    const trace = [];
    const saves = {};
    const refusedRunLanding = slot => { trace.push(['refused', slot]); return 'refused'; };
    const LoadSavedRunContext = (manager, slot, options) => {
      trace.push(['load', slot]);
      if (loadError) throw loadError;
      options.validate('profile', 'configuration', 'authored');
      return contextResult;
    };
    const cachedContentValidation = (...args) => { trace.push(['validate', ...args]); return { result: true }; };
    const t = key => key, dlog = () => {};
    const showSettingsNotice = () => true;
    const registryBuildKey = () => null;
    const configureTooltipGlossary = () => {}, setClassGlyphs = () => {};
    const resetArmouryTraySession = () => {};
    ${loadThroughAdoption}
    return {
      start: () => resumeRun(2, { onLoaded: () => {
        trace.push(['loaded', run === original, overlayOpen]);
        overlayOpen = false;
      } }),
      state: () => ({ run, xpCombat, registries, activeSlot, overlayOpen, trace, original, originalCombat, originalRegistries }),
    };
  `)(context, error);
}

test('missing, retired and invalid saved-run contexts keep the overlay launcher and original run', () => {
  for (const [context, error] of [
    [{ run: null }, null],
    [{ run: null, retiredReason: 'retired game mode' }, null],
    [null, new Error('invalid saved configuration')],
  ]) {
    const door = loadDoor(context, error);
    assert.equal(door.start(), 'refused');
    const state = door.state();
    assert.equal(state.overlayOpen, true, 'the refusal can restore focus to its still-mounted launcher');
    assert.equal(state.run, state.original);
    assert.equal(state.xpCombat, state.originalCombat);
    assert.equal(state.registries, state.originalRegistries);
    assert.equal(state.activeSlot, 1);
    assert.equal(state.trace.some(([name]) => name === 'loaded'), false, 'the overlay success hook never runs');
    assert.deepEqual(state.trace.at(-1), ['refused', 2]);
  }
});

test('a validated context closes the overlay before adoption and clears the previous combat lock', () => {
  const loaded = {}, registries = { classes: { all: () => [] } };
  const door = loadDoor({ run: loaded, registries, gameProfile: 'profile', configuration: {} });
  assert.equal(door.start(), 'adopted');
  const state = door.state();
  assert.deepEqual(state.trace, [
    ['load', 2], ['validate', 'profile', 'configuration', 'authored'], ['loaded', true, true],
  ]);
  assert.equal(state.overlayOpen, false);
  assert.equal(state.run, loaded);
  assert.equal(state.registries, registries);
  assert.equal(state.xpCombat, null);
  assert.equal(state.activeSlot, 2);
});
