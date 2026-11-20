// Owner 2026-11-20: press and hold reads a card. In combat the hand card's own hold SELECTS, and its length follows
// the player's Hold to confirm setting (balance.ui.holdConfirm: short 350, normal 600 by default, long 1000).
// Review of #2913: a fixed 700 ms read opened the modal under Long, and the release (still inside the card's
// 1000 ms hold) was then armHold's early-release tap, which selects or plays. The read now waits for the card's
// own hold (`data-hold-ms`) plus a margin, so its release is never a tap.
import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/dom.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { armHold, holdMs } from '../src/ui/components/holdconfirm.js';
import { bindCardInspection, HoldInspectDelay } from '../src/ui/components/cardInspection.js';
import { clearSelection } from '../src/ui/components/cardSelection.js';

const registries = createRegistries(contentBundle);
const holdConfirm = registries.balance.ui.holdConfirm;

async function withDom(fn) {
  const { globals } = withKitDom((dom, globals) => ({ globals }));
  const before = Object.fromEntries(Object.keys(globals).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, globals);
  // armHold fills on animation frames; the minimal DOM has none.
  const frames = { requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  globalThis.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);
  globalThis.cancelAnimationFrame = id => clearTimeout(id);
  try { await fn(); } finally {
    Object.assign(globalThis, frames);
    clearSelection();
    for (const [key, value] of Object.entries(before)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const press = (el, type) => el.dispatchEvent(Object.assign(new Event(type, { bubbles: true }), { pointerType: 'touch', pointerId: 1, isPrimary: true, button: 0, clientX: 10, clientY: 10 }));

// A hand card as combat wires it: the card's own selecting hold (armHold, ms from the setting) plus the shared binder.
function handCard(setting) {
  const card = document.createElement('div');
  card.className = 'card';
  document.body.append(card);
  const ms = holdMs({ holdConfirm: setting }, holdConfirm);
  const calls = [];
  armHold(card, { ms: () => ms, onTap: () => calls.push('tap'), onConfirm: () => calls.push('select'),
    tapOnEarlyRelease: true, tapOnPointerRelease: true });
  bindCardInspection(card, { title: 'Defend', actionOwnsTouch: true, infoBadge: true, open: () => calls.push('read') });
  return { card, ms, calls };
}

test('the read always waits past the card\'s own hold, at every Hold to confirm setting', () => withDom(async () => {
  for (const setting of Object.keys(holdConfirm.steps)) {
    const { card, ms } = handCard(setting);
    if (ms > 0) assert.ok(HoldInspectDelay(card) >= ms + 300, `${setting}: read at ${HoldInspectDelay(card)} ms, card hold ${ms} ms`);
    assert.ok(HoldInspectDelay(card) >= 700, `${setting}: never shorter than the bare 700 ms read`);
  }
}));

test('under Long, an 800 ms hold neither reads nor taps through the read; the release is the hold\'s own early release', () => withDom(async () => {
  const { card, ms, calls } = handCard('long');
  assert.equal(ms, 1000);
  press(card, 'pointerdown');
  await wait(800);
  assert.ok(!calls.includes('read'), 'no read inside the card\'s own hold');
  press(card, 'pointerup');
  await wait(20);
  assert.ok(!calls.includes('read'));
}));

test('under Long, a 1400 ms hold selects at 1000, reads after it, and the release neither taps nor plays', () => withDom(async () => {
  const { card, calls } = handCard('long');
  press(card, 'pointerdown');
  await wait(1450);
  assert.ok(calls.includes('read'), `the hold read the card (${calls.join(',')})`);
  press(card, 'pointerup');
  card.dispatchEvent(Object.assign(new Event('click', { bubbles: true, cancelable: true }), { detail: 1 }));
  await wait(20);
  assert.ok(!calls.includes('tap'), `the release after a read is no tap (${calls.join(',')})`);
  const readAt = calls.indexOf('read');
  const selectAt = calls.indexOf('select');
  assert.ok(selectAt >= 0 && selectAt < readAt, `the card's hold selected before the read (${calls.join(',')})`);
}));

test('a press that leaves the card ends the hold: no read opens when it is released elsewhere', () => withDom(async () => {
  const { card, calls } = handCard('normal');
  press(card, 'pointerdown');
  press(card, 'pointerleave');
  await wait(HoldInspectDelay(card) + 150);
  assert.ok(!calls.includes('read'), `a press that slid off the card did not read it (${calls.join(',')})`);
}));
