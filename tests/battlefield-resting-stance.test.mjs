import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { placePlayerIntentGlyph } from '../src/ui/components/battlefieldStage.js';

// The player's intent glyph stays above the figure's head while the player is
// not selected; selected, it steps beside the Inspect door. The resting stance chip stays in the details panel only.
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

test('the glyph is placed by the stage in every state; at rest it never moves between passes', () => {
  // The stage's player loop never gates the glyph on the selection state.
  assert.match(stage, /placePlayerIntentGlyph\(leading, \{ art, hudBottom, zoom, avoid: expanded \? infoRect : null, viewport \}\);/);
  assert.doesNotMatch(stage, /if \(expanded\)[^\n]*\n[^\n]*placePlayerIntentGlyph/);
  const { style, leading } = fakeLeading();
  const art = box(35, 205, 99, 105);
  placePlayerIntentGlyph(leading, { art, hudBottom: 60, zoom: 1 });
  const rest = { ...style };
  placePlayerIntentGlyph(leading, { art, hudBottom: 60, zoom: 1 });
  assert.deepEqual({ ...style }, rest);
});

// Codex P2 on #1849: selected, the Inspect "i" centres at the glyph's rest spot
// (combatPlayerInfoRect) and the later-painted glyph took its taps.
test('selected, the glyph steps just beside the visible Inspect door and never covers it', () => {
  const art = box(35, 205, 99, 105);
  const viewport = box(0, 0, 400, 700);
  for (const inspectSize of [22, 44]) {
    const { leading } = fakeLeading();
    const centre = 35 + 99 / 2;
    const inspect = box(centre - inspectSize / 2, art.top - inspectSize - 4, inspectSize, inspectSize);
    const rest = placePlayerIntentGlyph(leading, { art, hudBottom: 60, zoom: 1 });
    const selected = placePlayerIntentGlyph(leading, { art, hudBottom: 60, zoom: 1, avoid: inspect, viewport });
    const glyph = box(selected.centre - selected.width / 2, selected.top, selected.width, selected.height);
    const intersects = glyph.left < inspect.right && glyph.right > inspect.left && glyph.top < inspect.bottom && glyph.bottom > inspect.top;
    assert.equal(intersects, false, `a ${inspectSize}px Inspect stays clear`);
    assert.equal(selected.top, rest.top, 'no vertical jump');
    assert.equal(rest.centre - selected.centre, inspectSize / 2 + 4 + 12, 'the smallest step: half the door, a 4px gap, half the glyph');
  }
  // Against the field's left edge it steps right instead.
  const { leading } = fakeLeading();
  const nearEdge = box(0, 205, 40, 105);
  const inspect = box(20 - 22, nearEdge.top - 48, 44, 44);
  const spot = placePlayerIntentGlyph(leading, { art: nearEdge, hudBottom: 60, zoom: 1, avoid: inspect, viewport: box(0, 0, 400, 700) });
  assert.ok(spot.centre - spot.width / 2 >= inspect.right, 'right of the door');
  // A non-overlapping door (moved off by its own placement) leaves the glyph centred.
  const clear = placePlayerIntentGlyph(fakeLeading().leading, { art, hudBottom: 60, zoom: 1, avoid: box(300, 100, 44, 44), viewport });
  assert.equal(clear.centre, 35 + 99 / 2);
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
