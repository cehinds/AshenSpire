// tests/shot-ready.test.mjs — tools/shotReady.mjs decides when a combat
// screenshot may be taken. A missing figure must hold the capture back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { combatantArt, readyExpression } from '../tools/shotReady.mjs';

const img = (src, { complete = true, naturalWidth = 512, display = 'block', visibility = 'visible', opacity = '1' } = {}) => ({
  complete, naturalWidth, css: { display, visibility, opacity }, getAttribute: (name) => (name === 'src' ? src : null),
});
const frame = (eid, imgs) => ({ dataset: { eid }, querySelectorAll: () => imgs });
const page = (frames) => [
  { querySelectorAll: () => frames },
  { getComputedStyle: (el) => el.css },
];

test('every combatant drawn: ready', () => {
  const state = combatantArt(...page([
    frame('player', [img('a/STANCE-READY.webp'), img('a/prev.webp', { display: 'none' }), img('a/down.webp', { visibility: 'hidden' })]),
    frame('e1', [img('e/hound_idle.webp', { naturalWidth: 384 }), img('e/hound_attack.webp', { visibility: 'hidden', complete: false })]),
  ]));
  assert.equal(state.ready, true);
  assert.deepEqual(state.combatants, [{ eid: 'player', shown: 1, drawn: 1 }, { eid: 'e1', shown: 1, drawn: 1 }]);
});

test('the player frame still loading holds the capture and is named', () => {
  const state = combatantArt(...page([
    frame('player', [img('a/STANCE-READY.webp', { complete: false, naturalWidth: 0 })]),
    frame('e1', [img('e/hound_idle.webp')]),
  ]));
  assert.equal(state.ready, false);
  assert.deepEqual(state.pending, ['player:STANCE-READY.webp']);
});

test('a broken image (loaded, zero width) is not ready and is reported', () => {
  const state = combatantArt(...page([frame('player', [img('a/missing.webp', { naturalWidth: 0 })])]));
  assert.equal(state.ready, false);
  assert.deepEqual(state.broken, ['player:missing.webp']);
});

test('a combatant with no shown artwork, or no combatants at all, is not ready', () => {
  assert.equal(combatantArt(...page([frame('player', [img('a/x.webp', { opacity: '0' })])])).ready, false);
  assert.equal(combatantArt(...page([])).ready, false);
});

test('the in-page expression carries the same check, self-contained', () => {
  const source = readyExpression();
  assert.match(source, /combatantArt/);
  assert.match(source, /\.decode\(\)/);
  assert.doesNotThrow(() => new Function(`return ${source}`));
});
