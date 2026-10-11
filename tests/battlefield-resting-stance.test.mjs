import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The player's stance chip stays in the details panel only. The resting chip
// lift (acf084a3d) is reverted: the glyph above the head is the at-rest cue.
const stage = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/combat-layers.css', import.meta.url), 'utf8');

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
