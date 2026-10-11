import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { placeRestingStance } from '../src/ui/components/battlefieldStage.js';

// Owner (2026-10-11): the player's stance stays visible above the figure while
// the player is not selected. It used to sit under the HP plate at the feet,
// truncated to the plate's width.

const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
function fakeLeading(origin = box(30, 420, 112, 34)) {
  const props = new Map();
  const host = { getBoundingClientRect: () => origin };
  const chip = { dataset: {}, offsetParent: host, getBoundingClientRect: () => box(0, 0, 148, 14),
    style: { setProperty: (k, v) => props.set(k, v), removeProperty: k => props.delete(k) } };
  return { chip, props, leading: { querySelector: sel => (sel.includes('.stance-chip') ? chip : null) } };
}

test('at rest the stance chip is centred above the art, below the HUD band', () => {
  const { chip, props, leading } = fakeLeading();
  const art = box(35, 205, 99, 105);
  const spot = placeRestingStance(leading, { expanded: false, art, hudBottom: 60, zoom: 1 });
  assert.equal(chip.dataset.restAbove, 'true');
  assert.equal(spot.top + spot.height + 4, art.top, 'bottom edge 4px over the head');
  assert.equal(props.get('--rest-stance-left'), `${(35 + 99 / 2) - 30}px`);
  assert.equal(props.get('--rest-stance-top'), `${(205 - 18) - 420}px`);
  // A head under the HUD band: the chip stays below the band.
  const high = placeRestingStance(leading, { expanded: false, art: box(35, 50, 99, 105), hudBottom: 60, zoom: 1 });
  assert.equal(high.top, 62);
});

test('selected, the chip returns to the details panel flow', () => {
  const { chip, props, leading } = fakeLeading();
  placeRestingStance(leading, { expanded: false, art: box(35, 205, 99, 105), hudBottom: 60 });
  placeRestingStance(leading, { expanded: true, art: box(35, 205, 99, 105), hudBottom: 60 });
  assert.equal(chip.dataset.restAbove, undefined);
  assert.equal(props.size, 0);
});

test('the rest-above rule is scoped to an unselected player', () => {
  const css = readFileSync(new URL('../styles/combat-layers.css', import.meta.url), 'utf8');
  assert.match(css, /\.player:not\(\.context-selected\):not\(\.selected-target\) \.combatant-mini-hud > \.stance-chip\[data-rest-above='true'\] \{[^}]*position: absolute/);
  assert.doesNotMatch(css, /\[data-meter-row='stance'\] \{ display: none/);
});

// Coordinator review (2026-10-11): the chip showed an empty slot before its
// name. Its glyph had no height, so the 100%-tall masked shield painted 0px.
test('the stance glyph is a sized square, so its shield paints', () => {
  const css = readFileSync(new URL('../styles/combat-layers.css', import.meta.url), 'utf8');
  assert.match(css, /\.stance-chip\[data-meter-row='stance'\] > \.as-glyph \{[^}]*width: 1em; height: 1em;/);
});
