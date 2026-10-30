import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { mountHand } from '../src/ui/components/hand.js';
import { withModalDom } from './helpers/modal-dom.mjs';

const registries = createRegistries(contentBundle);
const ids = ['a', 'b', 'c', 'd'];
const entries = (list, selectedId = null) => list.map((id) => ({
  inst: { cardId: 'bashingBlow', instanceId: id }, preview: null, affordable: true,
  selected: id === selectedId, surface: 'combat', availability: {},
}));

test('a hand render that only changes selection or slot keeps every card element', () => withModalDom(() => {
  document.documentElement ??= { dataset: { handLayout: 'paging' }, getAttribute: () => null };
  const handEl = document.createElement('div');
  document.body.append(handEl);
  const hand = mountHand(handEl, { registries, reuseCards: true });
  hand.render({ cards: entries(ids) });
  const before = new Map([...handEl.children].map((el) => [el.dataset.instanceId, el]));
  assert.equal(before.size, 4);

  // Selection toggles classes in place.
  hand.render({ cards: entries(ids, 'b') });
  for (const el of handEl.children) assert.equal(el, before.get(el.dataset.instanceId), 'selection rebuilt a card');
  assert.ok(before.get('b').classList.contains('selected'));
  hand.render({ cards: entries(ids) });
  assert.ok(!before.get('b').classList.contains('selected'));

  // A played card leaves: the cards behind it shift slot, keep their element and take the new key badge.
  hand.render({ cards: entries(['a', 'c', 'd']) });
  assert.equal(handEl.children.length, 3);
  for (const el of handEl.children) assert.equal(el, before.get(el.dataset.instanceId), 'a slot change rebuilt a card');
  assert.equal(before.get('b').isConnected, false);
  const keys = [...handEl.children].map((el) => el.querySelector(':scope > .key-hint')?.textContent);
  assert.deepEqual(keys, ['1', '2', '3']);
  hand.teardown();
}));
