import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { mountHand } from '../src/ui/components/hand.js';
import { withModalDom } from './helpers/modal-dom.mjs';

const registries = createRegistries(contentBundle);
const ids = ['a', 'b', 'c'];
const entries = (list, aim = null) => list.map((id) => ({
  inst: { cardId: 'bashingBlow', instanceId: id }, preview: id === 'b' && aim ? { targetName: aim } : null, affordable: true,
  selected: id === 'b' && !!aim, surface: 'combat', availability: {},
}));

globalThis.MutationObserver ??= class { observe() {} disconnect() {} takeRecords() { return []; } };

test('a fitted hand reads its box before card writes and keeps its plan when a face is rebuilt in place', () => withModalDom(() => {
  document.documentElement ??= { dataset: { handLayout: 'paging' }, getAttribute: () => null };
  // The shared fixture's style is inert; a custom-property store makes the plan observable.
  const make = document.createElement.bind(document);
  document.createElement = (...args) => {
    const el = make(...args), values = new Map();
    Object.assign(el.style, {
      setProperty: (k, v) => values.set(k, v), getPropertyValue: k => values.get(k) || '', removeProperty: k => values.delete(k),
      [Symbol.iterator]: () => values.keys(),
    });
    return el;
  };
  const handEl = document.createElement('div');
  let reads = 0, readsAfterWrite = 0, wrote = false;
  Object.defineProperties(handEl, { clientWidth: { get() { reads++; if (wrote) readsAfterWrite++; return 390; } }, clientHeight: { get() { reads++; if (wrote) readsAfterWrite++; return 250; } } });
  handEl.getBoundingClientRect = () => { reads++; if (wrote) readsAfterWrite++; return { left: 0, top: 500, width: 390, height: 250 }; };
  document.body.append(handEl);
  const insert = handEl.insertBefore.bind(handEl);
  handEl.insertBefore = (...args) => { wrote = true; return insert(...args); };
  const hand = mountHand(handEl, { registries, reuseCards: true, fitFan: true });
  hand.render({ cards: entries(ids) });
  const first = new Map([...handEl.children].map((el) => [el.dataset.instanceId, el]));
  const width = first.get('b').style.getPropertyValue('--hand-card-width');
  assert.ok(width, 'the first render lays the fan out');

  // Selecting card b aims its preview: the face is rebuilt, the plan is not re-fitted.
  reads = 0; readsAfterWrite = 0; wrote = false;
  hand.render({ cards: entries(ids, 'Goblin') });
  const rebuilt = handEl.querySelector('[data-instance-id="b"]');
  assert.notEqual(rebuilt, first.get('b'), 'the aimed face is a new element');
  assert.equal(rebuilt.style.getPropertyValue('--hand-card-width'), width, 'it takes over its predecessor placement');
  assert.ok(rebuilt.querySelector(':scope > .hand-hit-lane'), 'and its hit lane');
  assert.equal(handEl.children[1], rebuilt, 'in the same slot');
  assert.equal(handEl.dataset.handGeometry !== undefined, true);
  // Only the pre-write read of the strip box (rect + two client reads); no layout pass after the writes.
  assert.equal(readsAfterWrite, 0, 'no strip read follows a card write');
  assert.ok(reads > 0 && reads <= 3, `strip box read ${reads} times`);
  hand.teardown();
}));
