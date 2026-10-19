// Co-op parity with solo (owner, 2026-10-18 14:15: "make sure I don't auto play
// a card when I click on it once"; 14:32: "keep the switch but make it default to
// not be 1 tap"): the first click or 1-9 key selects, the next one on the same
// card plays with no timing window, and oneTapPlay (read live) plays at once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withKitDom } from './helpers/kit-dom.mjs';
import { bindCardInspection } from '../src/ui/components/cardInspection.js';
import { resetSelection } from '../src/ui/components/cardSelection.js';
import { wireCoopTapPlay } from '../src/ui/components/coopTapPlay.js';

const coop = readFileSync(new URL('../src/ui/screens/coop.js', import.meta.url), 'utf8');


// This fixture's ordinary element dispatcher only bubbles. Add browser capture
// order so shared inspection really runs between the production capture/play doors.
function phaseEvents(dom) {
  const proto = Object.getPrototypeOf(dom.document.body);
  const records = new WeakMap();
  proto.addEventListener = function(type, fn, options) {
    const rows = records.get(this) || [];
    rows.push({ type, fn, capture: options === true || !!options?.capture });
    records.set(this, rows);
  };
  proto.removeEventListener = function(type, fn) {
    records.set(this, (records.get(this) || []).filter(row => row.type !== type || row.fn !== fn));
  };
  proto.dispatchEvent = function(event) {
    event.target ||= this;
    const path = []; for (let node = this; node; node = node.parentNode) path.push(node);
    const deliver = (node, capture) => {
      event.currentTarget = node;
      for (const row of [...(records.get(node) || [])]) {
        if (event.immediatePropagationStopped) break;
        if (row.type === event.type && row.capture === capture) row.fn(event);
      }
    };
    for (const node of [...path].reverse()) { deliver(node, true); if (event.propagationStopped) return !event.defaultPrevented; }
    for (const node of path) { deliver(node, false); if (!event.bubbles || event.propagationStopped) break; }
    return !event.defaultPrevented;
  };
}

function fixture(dom, opts) {
  phaseEvents(dom);
  resetSelection();
  const card = dom.document.createElement('div'); card.className = 'card';
  dom.document.body.appendChild(card);
  bindCardInspection(card, { title: 't', identity: 'c1', actionOwnsTouch: true, open() {} });
  const state = { plays: 0 };
  wireCoopTapPlay(card, { ...opts, onPlay: () => state.plays++ });
  return { card, state };
}

test('default: first click selects, the second click plays, however long after', () => {
  withKitDom(dom => {
    const { card, state } = fixture(dom, { oneTap: () => false });
    card.click();
    assert.equal(state.plays, 0, 'one click plays nothing');
    card.click();
    assert.equal(state.plays, 1, 'the next click on the selected card plays');
  });
});

test('oneTap opt-in is read live at click time', () => {
  withKitDom(dom => {
    let on = false;
    const { card, state } = fixture(dom, { oneTap: () => on });
    on = true;
    card.click();
    assert.equal(state.plays, 1, 'opted in: one click plays');
  });
});

test('a friendly-target card is not held back (its click is the arming step)', () => {
  withKitDom(dom => {
    const { card, state } = fixture(dom, { selectBeforePlay: false });
    card.click();
    assert.equal(state.plays, 1);
  });
});

test('the 1-9 key goes through the same click door and the setting is read live', () => {
  assert.match(coop, /const oneTapPlayOn = \(\) => \(readSettings \? readSettings\(\) : meta\.settings \|\| \{\}\)\.oneTapPlay === true;/);
  assert.match(coop, /wireCoopTapPlay\(el, \{[\s\S]*?oneTap: \(\) => oneTapPlays\(entry\.def\), onPlay: play,/, 'plain card clicks use the select-then-play wrapper');
  assert.doesNotMatch(coop, /el\.addEventListener\('click', play\)/, 'no click plays on the first click');
  assert.match(coop, /if \(cardEl\) \{ cardEl\.click\(\); return; \}/, 'the number key is the click on that card');
});

test('one-tap in co-op needs an unambiguous play, upcast wrapper included', () => {
  assert.match(coop, /const oneTapPlays = \(def\) => oneTapPlayOn\(\)\s*&& \(!cardNeedsEnemyTarget\(def\) \|\| \(snap\?\.scene\?\.enemies \|\| \[\]\)\.filter\(\(e\) => e\.hp > 0\)\.length === 1\);/);
  assert.equal((coop.match(/oneTap: \(\) => oneTapPlays\(entry\.def\)/g) || []).length, 2, 'plain and Upcast wiring both use the predicate');
  assert.doesNotMatch(coop, /oneTap: oneTapPlayOn/);
});

test('co-op render drops a selection whose card left every hand', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/ui/screens/coop.js', import.meta.url), 'utf8');
  // Only the active seat's hand keeps a selection alive (instance ids repeat across seats).
  assert.match(src, /litCard\(\) !== null\s*\n\s*&& !\(\(snap\.scene\.players \|\| \[\]\)\.find\(p => p\.id === me\)\?\.hand \|\| \[\]\)\.some\(card => card\.instanceId === litCard\(\)\)\) clearSelection\(\);/);
});
