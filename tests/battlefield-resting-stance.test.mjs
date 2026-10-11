import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { placePlayerIntentGlyph } from '../src/ui/components/battlefieldStage.js';

// The player's intent glyph stays above the figure's head while the player is
// not selected. The resting stance chip stays in the details panel only.
const stage = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/combat-layers.css', import.meta.url), 'utf8');

const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
function fakeLeading(origin = box(30, 420, 112, 34), size = 24) {
  const style = {};
  const host = { getBoundingClientRect: () => origin };
  const node = { offsetParent: host, dataset: {}, style, getBoundingClientRect: () => box(0, 0, size, size) };
  return { node, style, leading: { querySelector: sel => (sel === '.player-action-intent' ? node : null) } };
}

test('at rest the intent glyph is centred above the art, below the HUD band', () => {
  const { node, style, leading } = fakeLeading();
  const art = box(35, 205, 99, 105);
  const spot = placePlayerIntentGlyph(leading, { art, hudBottom: 60, zoom: 1 });
  assert.equal(node.dataset.placed, 'true');
  assert.equal(spot.top + spot.height + 4, art.top, 'bottom edge 4px over the head');
  assert.equal(style.left, `${(35 + 99 / 2) - 12 - 30}px`);
  assert.equal(style.top, `${(205 - 24 - 4) - 420}px`);
  // A head under the HUD band: the glyph stays below the band.
  const high = placePlayerIntentGlyph(leading, { art: box(35, 50, 99, 105), hudBottom: 60, zoom: 1 });
  assert.equal(high.top, 62);
});

test('the same spot selected or not: the glyph is placed by the stage in every state', () => {
  // The stage's player loop never gates the glyph on the selection state.
  assert.match(stage, /placePlayerIntentGlyph\(leading, \{ art, hudBottom, zoom \}\);/);
  assert.doesNotMatch(stage, /if \(expanded\)[^\n]*\n[^\n]*placePlayerIntentGlyph/);
  const { style, leading } = fakeLeading();
  const art = box(35, 205, 99, 105);
  placePlayerIntentGlyph(leading, { art, hudBottom: 60, zoom: 1 });
  const rest = { ...style };
  placePlayerIntentGlyph(leading, { art, hudBottom: 60, zoom: 1 });
  assert.deepEqual({ ...style }, rest);
});

test('no intent glyph, nothing is placed', () => {
  assert.equal(placePlayerIntentGlyph({ querySelector: () => null }, { art: box(0, 0, 1, 1), hudBottom: 0 }), null);
});

test('the glyph is hidden until its spot is written, and the door loop no longer anchors it', () => {
  assert.match(css, /\.player-action-intent:not\(\[data-placed\]\) \{ visibility: hidden; \}/);
  assert.doesNotMatch(stage, /\[action, actionRect\]/);
});

test('the stance chip is not lifted out of the details panel at rest', () => {
  assert.doesNotMatch(stage, /placeRestingStance/);
  assert.doesNotMatch(css, /data-rest-above/);
  assert.doesNotMatch(css, /--rest-stance-(left|top)/);
});

// Coordinator review (2026-10-11): the chip showed an empty slot before its
// name. Its glyph had no height, so the 100%-tall masked shield painted 0px.
test('the stance glyph is a sized square, so its shield paints', () => {
  assert.match(css, /\.stance-chip\[data-meter-row='stance'\] > \.as-glyph \{[^}]*width: 1em; height: 1em;/);
});
