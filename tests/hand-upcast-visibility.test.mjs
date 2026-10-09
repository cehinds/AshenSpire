import test from 'node:test';
import assert from 'node:assert/strict';
import { mountHandInspectionOverlay, revealHandUpcastControl } from '../src/ui/components/handInspectionOverlay.js';

function scroller({ viewport, left = 0, width = viewport, zoom = .9, controlLeft, controlWidth = 146.156 }) {
  const hand = { clientWidth: width / zoom, scrollLeft: 0, scrollTop: 17,
    getBoundingClientRect: () => ({ left, right: left + width, width }) };
  const control = { parentElement: { style: { getPropertyValue: () => '', setProperty() {} } }, getBoundingClientRect: () => ({
    left: controlLeft - hand.scrollLeft * zoom,
    right: controlLeft + controlWidth - hand.scrollLeft * zoom,
    width: controlWidth,
  }) };
  return { hand, control };
}

for (const viewport of [320, 390]) test(`outside-card Upcast stays inside the ${viewport}px phone hand`, () => {
  const { hand, control } = scroller({ viewport, controlLeft: viewport - 24.734 });
  revealHandUpcastControl(hand, control, viewport);
  const box = control.getBoundingClientRect();
  assert.ok(box.left >= 0);
  assert.ok(Math.abs(box.right - viewport) < .001);
  assert.equal(hand.scrollTop, 17, 'revealing the chooser cannot move the page or vertical hand position');
  const firstScroll = hand.scrollLeft;
  revealHandUpcastControl(hand, control, viewport);
  assert.equal(hand.scrollLeft, firstScroll, 'settled scroll events cannot drift the hand');
});

test('pager focus reveals an ordinary face before selection when hand scrolling clamps', () => {
  const frames = [], events = new Map();
  let focused = true, selected = false, hidden = true, mutation;
  const properties = new Map();
  const card = {
    classList: { contains: name => name === 'card' },
    style: { getPropertyValue: key => properties.get(key), setProperty: (key, value) => properties.set(key, value) },
    getBoundingClientRect: () => {
      const shift = focused || selected ? (parseFloat(properties.get('--hand-upcast-shift')) || 0) * .9 : 0;
      return { left: 592 + shift, right: 727 + shift, width: 135 };
    },
  };
  const control = { parentElement: card, getBoundingClientRect: () => {
    if (hidden) return { left: 0, right: 0, width: 0 };
    const box = card.getBoundingClientRect();
    return { ...box, right: box.left + 146, width: 146 };
  } };
  const hand = { clientWidth: 280, get scrollLeft() { return 0; }, set scrollLeft(value) {},
    getBoundingClientRect: () => ({ left: 34, right: 286, width: 252 }),
    querySelector: selector => selector === '.card.gp-focus' ? focused ? card : null :
      selector.includes('card-upcast-controls') && selected ? control : null,
    addEventListener: (type, fn) => events.set(type, fn), removeEventListener: type => events.delete(type),
  };
  const originals = new Map(['window', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame']
    .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, {
    window: { innerWidth: 320, addEventListener() {}, removeEventListener() {} },
    MutationObserver: class { constructor(fn) { mutation = fn; } observe() {} disconnect() {} },
    requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, cancelAnimationFrame() {},
  });
  try {
    const release = mountHandInspectionOverlay(hand);
    mutation(); frames.shift()();
    assert.ok(Math.abs(card.getBoundingClientRect().right - 286) < .001);
    assert.equal(hidden, true, 'pager focus cannot open a chooser or select its card');
    assert.equal(selected, false);
    assert.equal(hand.scrollLeft, 0, 'the actual overflow-visible hand still clamps scrolling');
    selected = true; hidden = false;
    mutation(); frames.shift()();
    assert.ok(control.getBoundingClientRect().right <= 286.001, 'selection admits the full chooser beneath its owning face');
    const selectedShift = properties.get('--hand-upcast-shift');
    focused = false;
    mutation(); frames.shift()();
    assert.equal(properties.get('--hand-upcast-shift'), selectedShift, 'a selected card stays revealed when pager focus moves');
    selected = false; hidden = true;
    mutation(); frames.shift()();
    assert.equal(card.getBoundingClientRect().left, 592, 'an idle card restores its original fan position');
    assert.equal(properties.get('--hand-upcast-shift'), selectedShift, 'restoration retains a stable shift for the next focus');
    release();
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test('hand clipping and CSS zoom share one coordinate space', () => {
  const { hand, control } = scroller({ viewport: 390, left: 12, width: 366, zoom: .8, controlLeft: 365.266 });
  revealHandUpcastControl(hand, control, 390);
  assert.ok(Math.abs(control.getBoundingClientRect().right - 378) < .001);
  hand.scrollLeft += 500;
  revealHandUpcastControl(hand, control, 390);
  assert.ok(Math.abs(control.getBoundingClientRect().left - 12) < .001);
});

test('pager focus and pointer selection choose one reveal owner without scroll oscillation', () => {
  const { hand, control } = scroller({ viewport: 320, controlLeft: 40 });
  const selectedCard = { style: control.parentElement.style, classList: { contains: name => name === 'card' }, closest() { return this; } };
  let selectedOwner = selectedCard;
  control.parentElement = selectedCard;
  const focusedCard = { style: control.parentElement.style, classList: { contains: name => name === 'card' }, closest() { return this; },
    getBoundingClientRect: () => ({ left: 592 - hand.scrollLeft * .9, right: 727 - hand.scrollLeft * .9, width: 135 }) };
  hand.querySelector = selector => selector === '.card.gp-focus' ? focusedCard :
    selector === '.card:is(.selected,.inspection-selected)' ? selectedOwner :
    selector.includes('card-upcast-controls') && selectedOwner === selectedCard ? control : null;
  const frames = [], events = new Map();
  hand.addEventListener = (type, fn) => events.set(type, fn);
  hand.removeEventListener = type => events.delete(type);
  const originals = new Map(['window', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame']
    .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, {
    window: { innerWidth: 320, addEventListener() {}, removeEventListener() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, cancelAnimationFrame() {},
  });
  try {
    const release = mountHandInspectionOverlay(hand);
    events.get('gpfocus')({ target: focusedCard }); frames.shift()();
    assert.ok(Math.abs(focusedCard.getBoundingClientRect().right - 320) < .001);
    const focusedScroll = hand.scrollLeft;
    events.get('scroll')(); frames.shift()();
    events.get('scroll')(); frames.shift()();
    assert.equal(hand.scrollLeft, focusedScroll, 'an older selected wrapper cannot scroll a newly focused face away');
    events.get('cardinspectionselect')({ target: selectedCard }); frames.shift()();
    assert.ok(Math.abs(control.getBoundingClientRect().left) < .001, 'a new pointer selection becomes the reveal owner');
    const selectedScroll = hand.scrollLeft;
    events.get('scroll')(); frames.shift()();
    assert.ok(Math.abs(hand.scrollLeft - selectedScroll) < .001, 'the retained pager cursor cannot undo the latest pointer selection');
    selectedOwner = { parentElement: hand, matches: () => true, style: selectedCard.style, classList: selectedCard.classList, closest() { return this; },
      getBoundingClientRect: () => ({ left: 40 - hand.scrollLeft * .9, right: 175 - hand.scrollLeft * .9, width: 135 }) };
    events.get('cardinspectionselect')({ target: selectedOwner }); frames.shift()();
    assert.ok(Math.abs(selectedOwner.getBoundingClientRect().left) < .001, 'a non-Upcast selection wins over the retained pager focus');
    const detached = selectedOwner;
    detached.parentElement = null;
    detached.getBoundingClientRect = () => { throw Error('A detached selected face must not defeat the live hand'); };
    selectedOwner = selectedCard;
    events.get('scroll')(); frames.shift()();
    assert.ok(Math.abs(focusedCard.getBoundingClientRect().right - 320) < .001, 'a rerender releases the detached owner and restores the live focus');
    release();
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test('visible, hidden and detached-size controls leave hand position untouched', () => {
  const { hand, control } = scroller({ viewport: 1365, controlLeft: 200 });
  revealHandUpcastControl(hand, control, 1365);
  assert.equal(hand.scrollLeft, 0);
  control.getBoundingClientRect = () => ({ left: 1500, right: 1500, width: 0 });
  revealHandUpcastControl(hand, control, 1365);
  assert.equal(hand.scrollLeft, 0);
  hand.clientWidth = 0;
  revealHandUpcastControl(hand, control, 1365);
  assert.equal(hand.scrollLeft, 0);
});

for (const viewport of [320, 390]) test(`overflow-visible fan keeps the owning card and chooser together at ${viewport}px`, () => {
  const { hand, control } = scroller({ viewport, left: 12, width: viewport - 24, controlLeft: viewport - 24.734 });
  Object.defineProperty(hand, 'scrollLeft', { get: () => 0, set() {} });
  const properties = new Map();
  control.parentElement = { style: { getPropertyValue: key => properties.get(key), setProperty: (key, value) => properties.set(key, value) } };
  const bounds = control.getBoundingClientRect;
  control.getBoundingClientRect = () => {
    const box = bounds(), shift = (parseFloat(properties.get('--hand-upcast-shift')) || 0) * .9;
    return { ...box, left: box.left + shift, right: box.right + shift };
  };
  revealHandUpcastControl(hand, control, viewport);
  assert.ok(Math.abs(control.getBoundingClientRect().right - (viewport - 12)) < .001);
  assert.equal(hand.scrollLeft, 0);
  assert.equal(hand.scrollTop, 17);
  const shift = properties.get('--hand-upcast-shift');
  revealHandUpcastControl(hand, control, viewport);
  assert.equal(properties.get('--hand-upcast-shift'), shift, 'selection and resize frames cannot accumulate translation');
  revealHandUpcastControl(hand, control, viewport + 70);
  assert.equal(properties.get('--hand-upcast-shift'), shift, 'a valid existing shift is preserved rather than restarting lift motion');
  revealHandUpcastControl(hand, control, viewport - 30);
  assert.ok(control.getBoundingClientRect().right <= viewport - 30, 'a newly narrower viewport admits the same owning card');
});

test('shared hand selection and scrolling invoke reveal without opening or paying Upcast', () => {
  const { hand, control } = scroller({ viewport: 390, controlLeft: 365.266 });
  let selected = false, mutation, disconnected = false;
  const frames = [], events = new Map(), windowEvents = new Map();
  hand.querySelector = selector => selector.includes('card-upcast-controls') && selected ? control : null;
  hand.addEventListener = (type, fn) => events.set(type, fn);
  hand.removeEventListener = type => events.delete(type);
  const originals = new Map(['window', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame']
    .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, {
    window: { innerWidth: 390, addEventListener: (type, fn) => windowEvents.set(type, fn), removeEventListener: type => windowEvents.delete(type) },
    MutationObserver: class { constructor(fn) { mutation = fn; } observe() {} disconnect() { disconnected = true; } },
    requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, cancelAnimationFrame() {},
  });
  try {
    const release = mountHandInspectionOverlay(hand);
    mutation(); frames.shift()();
    assert.equal(hand.scrollLeft, 0, 'unselected cards do not move the hand');
    events.get('pointerdown')({ pointerId: 1 });
    selected = true;
    mutation(); frames.shift()();
    assert.equal(hand.scrollLeft, 0, 'hold-start selection cannot move a card under an active touch');
    windowEvents.get('pointerup')({ pointerId: 1, type: 'pointerup' }); frames.shift()();
    assert.equal(hand.scrollLeft, 0, 'the first release frame must not redirect a delayed native click');
    windowEvents.get('click')(); frames.shift()();
    assert.ok(control.getBoundingClientRect().right <= 390, 'selection reveals the unopened controls');
    assert.equal(hand.scrollTop, 17);
    const settledScroll = hand.scrollLeft;
    events.get('scroll')(); frames.shift()();
    assert.equal(hand.scrollLeft, settledScroll);
    hand.scrollLeft = 0;
    events.get('pointerdown')({ pointerId: 2 });
    events.get('pointerdown')({ pointerId: 3 });
    windowEvents.get('pointercancel')({ pointerId: 2 }); frames.shift()();
    assert.equal(hand.scrollLeft, 0, 'one cancelled touch cannot move another active touch');
    windowEvents.get('pointercancel')({ pointerId: 3 }); frames.shift()();
    assert.equal(hand.scrollLeft, settledScroll, 'the final cancellation releases the reveal');
    hand.scrollLeft = 0;
    events.get('pointerdown')({ pointerId: 4 });
    windowEvents.get('blur')(); frames.shift()();
    assert.equal(hand.scrollLeft, settledScroll, 'losing window focus cannot leave reveal locked');
    hand.scrollLeft = 0;
    events.get('pointerdown')({ pointerId: 5 });
    windowEvents.get('pointerup')({ pointerId: 5, type: 'pointerup' }); frames.shift()();
    windowEvents.get('keydown')(); frames.shift()();
    assert.equal(hand.scrollLeft, settledScroll, 'keyboard selection releases a gesture that suppresses its native click');
    release();
    assert.equal(disconnected, true);
    assert.equal(events.size, 0, 'remounting a co-op snapshot releases the observer and scroll listener');
    assert.equal(windowEvents.size, 0, 'release and cancellation listeners cannot outlive the hand');
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
