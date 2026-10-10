// A one-choice Shrine is spent by its first smith upgrade (#1675 follow-up).
// The repeat-upgrade picker re-opens while stones remain; Back from it after
// an upgrade must end the visit with the upgrade's receipt, exactly as the
// final stone does, so the Shrine never redraws with Rest still on offer.
// Multi-use Shrines keep their redraw; Back with nothing upgraded leaves the
// Shrine untouched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { withKitDom } from './helpers/kit-dom.mjs';

let FixtureEvent = null;

// The Smith modal checks `instanceof HTMLElement`; the kit fixture's element
// class stands in for it for the length of one test. Timers the screens arm
// (the confirmation door's input shield) run before the fixture is torn
// down, so none of them fires against a missing window afterwards.
function withDom(fn) {
  return withKitDom((dom) => {
    const prior = { HTMLElement: globalThis.HTMLElement, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
    const timers = new Map();
    let nextId = 1;
    globalThis.HTMLElement = dom.document.body.constructor;
    globalThis.setTimeout = (callback, _ms, ...args) => { const id = nextId++; timers.set(id, () => callback(...args)); return id; };
    globalThis.clearTimeout = (id) => { timers.delete(id); };
    FixtureEvent = dom.Event;
    try {
      const result = fn(dom);
      for (let round = 0; timers.size && round < 20; round++) {
        const due = [...timers];
        timers.clear();
        for (const [, run] of due) run();
      }
      return result;
    } finally {
      Object.assign(globalThis, prior);
    }
  });
}

const REG = createRegistries(contentBundle);

async function screen() {
  const { mountRest } = await import('../src/ui/screens/rest.js');
  const { createLocationVisit } = await import('../src/engine/locations.js');
  return ({ multiUse = false, stones = 3 } = {}) => {
    const run = createRunState({ seed: 1675, classId: 'reaver', registries: REG });
    run.smithingStones = stones;
    const app = document.createElement('main');
    app.id = 'app';
    document.body.append(app);
    const done = [];
    const visit = createLocationVisit({ run, registries: REG, rng: null }, 'shrine', {});
    mountRest(app, { registries: REG, run, meta: { settings: {} }, onDone: (line) => done.push(line), visit, multiUse });
    return { app, run, done };
  };
}

const smithModal = () => document.querySelector('.smith-upgrade-modal');

// A synthetic activation (detail 0), the way input.js presses a control.
const tap = (node) => node.dispatchEvent(new FixtureEvent('click', { bubbles: true, cancelable: true, detail: 0, target: node }));

function upgradeFirst(app) {
  app.querySelector('#smith-opt').click();
  const card = smithModal().querySelector('.smith-candidate-card');
  assert.ok(card, 'the Smith offers a candidate');
  card.click();
  const smithConfirm = smithModal().querySelector('.smith-confirm');
  assert.equal(smithConfirm.hidden, false, 'selecting a candidate shows Confirm');
  tap(smithConfirm);
  const confirm = document.querySelector('.confirmation-confirm');
  assert.ok(confirm, 'Confirm opens the decision door');
  confirm.click();
}

const backOut = () => smithModal().querySelector('.smith-back').click();

test('DOM: normal Shrine, upgrade then Back ends the visit with the receipt (no Rest after)', async () => {
  const shrine = await screen();
  withDom(() => {
    const { app, run, done } = shrine({ stones: 3 });
    upgradeFirst(app);
    assert.ok(run.smithingStones > 0 && run.smithingStones < 3, 'a stone was spent and some remain');
    assert.ok(smithModal(), 'the picker re-opens while stones remain');
    assert.equal(done.length, 0);
    backOut();
    assert.equal(done.length, 1, 'Back after an upgrade ends the visit');
    assert.match(done[0], /^Upgraded .+ to tier \d+: spent \d+ Stone\.$/);
    app.remove();
  });
});

test('DOM: multi-use Shrine, upgrade then Back redraws the Shrine with Rest still open', async () => {
  const shrine = await screen();
  withDom(() => {
    const { app, run, done } = shrine({ multiUse: true, stones: 3 });
    upgradeFirst(app);
    assert.ok(run.smithingStones < 3);
    backOut();
    assert.equal(done.length, 0, 'multi-use keeps the visit');
    assert.equal(app.querySelector('#rest-opt').getAttribute('aria-disabled'), 'false', 'Rest still on offer');
    app.remove();
  });
});

test('DOM: normal Shrine, Back with nothing upgraded returns to the Shrine untouched', async () => {
  const shrine = await screen();
  withDom(() => {
    const { app, run, done } = shrine({ stones: 3 });
    app.querySelector('#smith-opt').click();
    assert.ok(smithModal());
    backOut();
    assert.equal(done.length, 0, 'the visit continues');
    assert.equal(run.smithingStones, 3, 'nothing spent');
    assert.equal(smithModal(), null);
    assert.equal(app.querySelector('#rest-opt').getAttribute('aria-disabled'), 'false', 'Rest still on offer');
    app.remove();
  });
});
