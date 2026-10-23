import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/kit-dom.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { mountHand } from '../src/ui/components/hand.js';
import { openBoundCardInspection } from '../src/ui/components/cardInspection.js';
import { clearSelection, litCard } from '../src/ui/components/cardSelection.js';

const registries = createRegistries(contentBundle);
const entry = (id, extra = {}) => ({ inst: { instanceId: id, cardId: 'frostNova', upgraded: false },
  affordable: true, surface: 'combat', availability: { play: true }, commands: { play() {} }, ...extra });

function withHand(fn, { fitFan = false, reuseCards = true, inspectHold = false } = {}) {
  withKitDom(dom => {
    dom.document.documentElement = dom.document.body;
    dom.document.getSelection = () => null;
    const create = dom.document.createElement.bind(dom.document);
    dom.document.createElement = tag => {
      const node = create(tag), values = new Map();
      node.styleWrites = [];
      node.style = new Proxy({
        setProperty(key, value) { values.set(key, String(value)); node.styleWrites.push(key); },
        getPropertyValue(key) { return values.get(key) || ''; },
        removeProperty(key) { values.delete(key); },
      }, { set(target, key, value) { target[key] = String(value); node.styleWrites.push(key); return true; } });
      return node;
    };
    const combat = document.createElement('main'); combat.className = 'combat';
    const handEl = document.createElement('div'); handEl.className = 'hand';
    combat.append(handEl); document.body.append(combat);
    const wires = [], releases = [], activations = [];
    const hand = mountHand(handEl, { registries, reuseCards, fitFan, inspectHold,
      wireCard(el, current, index) {
        const id = current.inst.instanceId;
        wires.push([id, index, el]);
        const activate = () => activations.push([id, index]);
        el.addEventListener('slot-action', activate);
        return () => { releases.push([id, index, el]); el.removeEventListener('slot-action', activate); };
      },
    });
    try { fn({ hand, handEl, wires, releases, activations }); }
    finally { hand.teardown(); clearSelection(); document.querySelector('.card-inspection-modal .modal-close')?.click(); }
  });
}
const cardsOf = handEl => handEl.querySelectorAll('.card');
const key = card => card.querySelector('.key-hint')?.textContent ?? null;
const fan = (index, count) => {
  const mid = (count - 1) / 2, spread = Math.min(6, count) * 1.2;
  return `rotate(${(index - mid) * (spread / Math.max(count - 1, 1))}deg) translateY(${(Math.abs(index - mid) - mid) * 6}px)`;
};

test('a three-to-two count change retains faces, selection, Information and input bindings while updating the legacy fan', () => {
  withHand(({ hand, handEl, wires, releases, activations }) => {
    const a = entry('a', { selected: true }), b = entry('b'), c = entry('c');
    hand.render({ cards: [a, b, c] });
    const [first, second, removed] = cardsOf(handEl);
    const info = first.querySelector('.card-info-button');
    info.click(); document.querySelector('.card-inspection-modal .modal-close').click();
    const identity = litCard(), paintedFace = first.querySelector('.illustrated-card-face');
    hand.render({ cards: [a, b] });
    assert.deepEqual(cardsOf(handEl), [first, second]);
    assert.equal(first.querySelector('.card-info-button'), info);
    assert.equal(first.querySelector('.illustrated-card-face'), paintedFace, 'the retained face is not repainted');
    assert.equal(first.classList.contains('inspection-selected'), true);
    assert.equal(first.classList.contains('selected'), true); assert.equal(litCard(), identity);
    assert.equal(removed.isConnected, false);
    assert.equal(wires.length, 3); assert.deepEqual(releases.map(row => row.slice(0, 2)), [['c', 2]]);
    for (const [index, card] of [first, second].entries()) {
      assert.equal(key(card), String(index + 1));
      assert.equal(card.style.transform, fan(index, 2));
      assert.equal(card.style.getPropertyValue('--card-fan-transform'), fan(index, 2));
      assert.equal(card.style.zIndex, String(index));
      card.dispatchEvent(new Event('slot-action'));
    }
    assert.deepEqual(activations, [['a', 0], ['b', 1]]);
    const before = [first, second].map(card => card.styleWrites.length);
    hand.render({ cards: [a, b] });
    assert.deepEqual([first, second].map(card => card.styleWrites.length), before, 'unchanged positions do not write card styles');
  });
});

test('a fitted fan retains same-slot faces and matches a fresh render after the hand count changes', () => {
  let retained;
  withHand(({ hand, handEl, wires }) => {
    const a = entry('a'), b = entry('b');
    hand.render({ cards: [a, b, entry('c')] }); const originals = cardsOf(handEl);
    hand.render({ cards: [a, b] });
    assert.deepEqual(cardsOf(handEl), originals.slice(0, 2)); assert.equal(wires.length, 3);
    retained = cardsOf(handEl).map(card => [card.style.transform, card.style.getPropertyValue('--card-fan-transform'),
      card.style.getPropertyValue('--hand-card-x'), card.style.getPropertyValue('--hand-card-y'), key(card)]);
  }, { fitFan: true });
  withHand(({ hand, handEl }) => {
    hand.render({ cards: [entry('a'), entry('b')] });
    assert.deepEqual(cardsOf(handEl).map(card => [card.style.transform, card.style.getPropertyValue('--card-fan-transform'),
      card.style.getPropertyValue('--hand-card-x'), card.style.getPropertyValue('--hand-card-y'), key(card)]), retained);
  }, { fitFan: true });
});

test('index shifts replace nodes and release old bindings once; ten/eleven positions have current quick keys', () => {
  withHand(({ hand, handEl, wires, releases, activations }) => {
    const entries = Array.from({ length: 11 }, (_, index) => entry(`c${index}`));
    hand.render({ cards: entries }); const original = cardsOf(handEl);
    assert.equal(key(original[9]), 'Q'); assert.equal(key(original[10]), null);
    hand.render({ cards: entries.slice(1) }); const shifted = cardsOf(handEl);
    shifted.forEach((card, index) => {
      assert.notEqual(card, original[index + 1], 'a changed input slot receives a fresh node');
      assert.equal(key(card), index < 9 ? String(index + 1) : 'Q');
      card.dispatchEvent(new Event('slot-action'));
    });
    assert.deepEqual(activations, entries.slice(1).map((current, index) => [current.inst.instanceId, index]));
    assert.equal(releases.length, 11); assert.equal(new Set(releases.map(row => row[2])).size, 11);
    assert.equal(wires.length, 21);
    hand.render({ cards: entries.slice(1) }); assert.equal(wires.length, 21); assert.equal(releases.length, 11);
    hand.render({ cards: [] }); assert.equal(releases.length, 21);
    hand.teardown(); assert.equal(releases.length, 21, 'teardown cannot double release removed cards');
  });
});

for (const [field, change] of [
  ['preview', current => ({ ...current, preview: { costs: { action: 2, mana: 0 }, damageSequences: [] } })],
  ['affordable', current => ({ ...current, affordable: false })],
  ['reason', current => ({ ...current, reason: 'Not your turn', name: 'Frost Nova' })],
  ['name', current => ({ ...current, name: 'Different viewer label' })],
  ['surface', current => ({ ...current, surface: 'none' })],
  ['inst', current => ({ ...current, inst: { ...current.inst, upgraded: true } })],
]) test(`${field} still rebuilds the face and its input closure`, () => {
  withHand(({ hand, handEl, wires, releases }) => {
    const initial = entry('a'); hand.render({ cards: [initial] }); const before = cardsOf(handEl)[0];
    hand.render({ cards: [change(initial)] });
    assert.notEqual(cardsOf(handEl)[0], before); assert.equal(before.isConnected, false);
    assert.equal(wires.length, 2); assert.equal(releases.length, 1); assert.equal(releases[0][2], before);
    hand.teardown(); assert.equal(releases.length, 2);
  });
});

test('availability-only reuse reads current refusal and commands even while an inspector remains open', () => {
  withHand(({ hand, handEl, wires, releases }) => {
    let oldCalls = 0, intermediateCalls = 0, latestCalls = 0;
    const originalCommands = { play() { oldCalls++; } };
    const originalPlay = originalCommands.play;
    const initial = entry('a', { commands: originalCommands });
    hand.render({ cards: [initial] }); const face = cardsOf(handEl)[0];
    const refused = { ...initial, availability: { play: 'Wait for your turn.' }, commands: { play() { intermediateCalls++; } } };
    hand.render({ cards: [refused] }); assert.equal(cardsOf(handEl)[0], face);
    openBoundCardInspection(face);
    let dialog = document.querySelector('.card-inspection-modal');
    assert.equal(dialog.querySelector('.card-inspection-act').disabled, true);
    assert.equal(dialog.querySelector('.card-action-reason').textContent, 'Wait for your turn.');
    dialog.querySelector('.modal-close').click();
    const enabled = { ...refused, availability: { play: true } };
    hand.render({ cards: [enabled] }); openBoundCardInspection(face);
    dialog = document.querySelector('.card-inspection-modal');
    hand.render({ cards: [{ ...enabled, commands: { play() { latestCalls++; } } }] });
    dialog.querySelector('.card-inspection-act').click();
    assert.equal(latestCalls, 1); assert.equal(oldCalls, 0); assert.equal(intermediateCalls, 0);
    assert.equal(initial.commands, originalCommands, 'caller-owned command map is untouched');
    assert.equal(originalCommands.play, originalPlay, 'updating the private map cannot replace a caller-owned closure');
    assert.deepEqual(Object.keys(originalCommands), ['play']);
    openBoundCardInspection(face); dialog = document.querySelector('.card-inspection-modal');
    hand.render({ cards: [refused] }); dialog.querySelector('.card-inspection-act').click();
    assert.equal(dialog.querySelector('.card-inspection-act').disabled, true, 'an already-open door re-reads current refusal');
    dialog.querySelector('.modal-close').click();
    hand.render({ cards: [enabled] }); openBoundCardInspection(face);
    dialog = document.querySelector('.card-inspection-modal');
    hand.render({ cards: [{ ...enabled, commands: {} }] });
    dialog.querySelector('.card-inspection-act').click();
    assert.equal(dialog.querySelector('.card-inspection-act').disabled, true, 'removed commands cannot call a stale closure');
    dialog.querySelector('.modal-close').click();
    assert.equal(latestCalls, 1); assert.equal(oldCalls, 0); assert.equal(intermediateCalls, 0);
    assert.equal(wires.length, 1); assert.equal(releases.length, 0, 'action-only changes do not replace or rewire the face');
  });
});


test('reordering slots ten and eleven correctly removes and adds Q with fresh indexed inputs', () => {
  withHand(({ hand, handEl, wires, releases }) => {
    hand.render({ cards: Array.from({ length: 11 }, (_, index) => entry(`c${index}`)) });
    const original = cardsOf(handEl);
    hand.reorderAt('c9', 10000);
    let reordered = cardsOf(handEl);
    assert.deepEqual(reordered.slice(0, 9), original.slice(0, 9));
    assert.equal(reordered[9].dataset.instanceId, 'c10'); assert.equal(key(reordered[9]), 'Q');
    assert.equal(reordered[10].dataset.instanceId, 'c9'); assert.equal(key(reordered[10]), null);
    assert.equal(wires.length, 13); assert.equal(releases.length, 2);
    assert.equal(original[9].isConnected, false); assert.equal(original[10].isConnected, false);
    reordered.forEach((card, index) => { card.box = { left: index * 100, top: 0, width: 80, height: 112 }; });
    const shifted = reordered.slice(9);
    hand.reorderAt('c9', 900); reordered = cardsOf(handEl);
    assert.equal(reordered[9].dataset.instanceId, 'c9'); assert.equal(key(reordered[9]), 'Q');
    assert.equal(reordered[10].dataset.instanceId, 'c10'); assert.equal(key(reordered[10]), null);
    assert.equal(wires.length, 15); assert.equal(releases.length, 4);
    assert.ok(shifted.every(card => !card.isConnected));
    assert.equal(handEl.querySelectorAll('.key-hint').length, 10);
  });
});


test('generic inspection-hold ownership changes rebuild once in each direction', () => {
  withHand(({ hand, handEl, wires, releases }) => {
    const reading = entry('hold-policy', { commands: undefined });
    hand.render({ cards: [reading] });
    const first = cardsOf(handEl)[0]; assert.equal(first.dataset.inspect, 'idle');
    const actionable = { ...reading, commands: { play() {} } };
    hand.render({ cards: [actionable] });
    const second = cardsOf(handEl)[0];
    assert.notEqual(second, first); assert.equal(first.isConnected, false);
    assert.equal(second.dataset.inspect, undefined, 'a command-owned card does not inherit the generic reading hold');
    assert.equal(wires.length, 2); assert.equal(releases.length, 1); assert.equal(releases[0][2], first);
    hand.render({ cards: [{ ...actionable, commands: { play() {} } }] });
    assert.equal(cardsOf(handEl)[0], second, 'new command function identities do not rebuild the same hold policy');
    hand.render({ cards: [reading] });
    const third = cardsOf(handEl)[0];
    assert.notEqual(third, second); assert.equal(second.isConnected, false);
    assert.equal(third.dataset.inspect, 'idle', 'removing commands restores the creation-time generic hold policy');
    assert.equal(wires.length, 3); assert.equal(releases.length, 2); assert.equal(releases[1][2], second);
    hand.teardown(); assert.equal(releases.length, 3);
  }, { inspectHold: true });
});

test('with generic holds disabled command presence still reuses and refreshes an open inspector', () => {
  withHand(({ hand, handEl, wires, releases }) => {
    let calls = 0;
    const reading = entry('no-hold-policy', { commands: undefined });
    hand.render({ cards: [reading] }); const face = cardsOf(handEl)[0];
    openBoundCardInspection(face);
    const actionable = { ...reading, commands: { play() { calls++; } } };
    hand.render({ cards: [actionable] });
    assert.equal(cardsOf(handEl)[0], face); assert.equal(face.dataset.inspect, undefined);
    document.querySelector('.card-inspection-modal .card-inspection-act').click(); assert.equal(calls, 1);
    openBoundCardInspection(face); hand.render({ cards: [reading] });
    assert.equal(cardsOf(handEl)[0], face);
    const dialog = document.querySelector('.card-inspection-modal');
    dialog.querySelector('.card-inspection-act').click();
    assert.equal(dialog.querySelector('.card-inspection-act').disabled, true);
    dialog.querySelector('.modal-close').click();
    assert.equal(calls, 1); assert.equal(wires.length, 1); assert.equal(releases.length, 0);
  }, { inspectHold: false });
});
