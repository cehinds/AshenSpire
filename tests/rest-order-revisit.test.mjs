// The Rest screen's card order (owner, 2026-10-12: Rest, Level up, Upgrade,
// Flask, then the rest), and the revisit props: a single-use visit whose one
// choice is spent stays shut, and onConsumed reports which choice committed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createLocationVisit } from '../src/engine/locations.js';
import { mountRest } from '../src/ui/screens/rest.js';
import { withKitDom } from './helpers/kit-dom.mjs';

let FixtureEvent = null;

// Same fixture as tests/shrine-one-choice.test.mjs: the Smith modal checks
// `instanceof HTMLElement`, and armed timers run before the DOM is torn down.
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

// The canonical card order; a test filters it to the cards a place carries.
const ORDER = ['rest-opt', 'level-opt', 'smith-opt', 'flask-reallocate', 'extract-opt', 'install-opt', 'board-opt', 'deck-opt'];

// A Shrine visit with its smith, level and flask services (the classic Shrine).
function mount(options = {}) {
  const { multiUse = false, stones = 3, levelPoints = 1, ...extra } = options;
  const run = createRunState({ seed: 1675, classId: 'reaver', registries: REG });
  run.smithingStones = stones;
  run.level.unspentPoints = levelPoints;
  const app = document.createElement('main');
  app.id = 'app';
  document.body.append(app);
  const done = [];
  const visit = createLocationVisit({ run, registries: REG, rng: null }, 'shrine', {});
  mountRest(app, { registries: REG, run, meta: { settings: {} }, onDone: (line) => done.push(line), visit, multiUse, ...extra });
  return { app, run, done };
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

test('DOM: Rest cards appear in the owner order, filtered to the cards present', () => {
  withDom(() => {
    const { app } = mount({ levelPoints: 1 });
    const present = [...app.querySelectorAll('.rest-choices .class-pick')].map((e) => e.id);
    assert.ok(present.length >= 2, `cards present: ${present.join(',')}`);
    assert.deepEqual(present, ORDER.filter((id) => present.includes(id)));
    assert.equal(present[0], 'rest-opt', 'Rest leads');
    if (present.includes('level-opt')) assert.equal(present[1], 'level-opt', 'Level up is second');
    app.remove();
  });
});

test('DOM: a revisited single-use Shrine with its choice spent holds every card shut', () => {
  withDom(() => {
    const { app, done } = mount({ revisit: { rested: true, spent: true, left: true } });
    assert.equal(app.querySelector('#rest-opt').getAttribute('aria-disabled'), 'true', 'Rest is shut');
    assert.ok(app.querySelector('#smith-opt').classList.contains('locked'), 'Upgrade is locked');
    const leave = app.querySelector('#shrine-leave');
    assert.ok(leave, 'a re-opened visit has a way out');
    leave.click();
    assert.equal(done.length, 1, 'Leave ends the visit');
    app.remove();
  });
});

test('DOM: onConsumed reports the smith upgrade that commits', () => {
  withDom(() => {
    const consumed = [];
    const { app } = mount({ onConsumed: (kind) => consumed.push(kind) });
    upgradeFirst(app);
    assert.ok(consumed.includes('smith'), `recorded: ${consumed.join(',')}`);
    app.remove();
  });
});

test('DOM: a single-use Shrine with no revisit has no Leave foot (behaviour preserved)', () => {
  withDom(() => {
    const { app } = mount({ revisit: null });
    assert.equal(app.querySelector('#shrine-leave'), null);
    app.remove();
  });
});

test('DOM: a reopened single-use Shrine whose choice is spent, but not left, still has a way out', () => {
  withDom(() => {
    const { app, done } = mount({ revisit: { rested: false, spent: true, left: false } });
    const leave = app.querySelector('#shrine-leave');
    assert.ok(leave, 'a spent choice on a reopened visit has a way out');
    leave.click();
    assert.equal(done.length, 1, 'Leave ends the visit');
    app.remove();
  });
});
