import test from 'node:test';
import assert from 'node:assert/strict';
import { policyFor, twinDimensions } from '../tools/mobileart-policy.mjs';

test('wide chapel retains 720p detail without upscaling small sources', () => {
  const rule = policyFor('player-polish/scenes/chapel-rest-desktop.webp');
  assert.deepEqual(twinDimensions({ width: 1672, height: 941 }, rule), { width: 1279, height: 720 });
  assert.deepEqual(twinDimensions({ width: 320, height: 180 }, rule), { width: 320, height: 180 });
  assert.equal(rule.quality, 78);
  assert.equal(rule.alphaQuality, 80);
});

test('other scenery keeps the existing 256px ceiling', () => {
  for (const path of ['player-polish/scenes/chapel-rest-master.webp', 'player-polish/scenes/forge-desktop.webp', 'environments/ashen-crown-combat.webp']) {
    const rule = policyFor(path);
    assert.equal(rule.maxEdge, 256);
    assert.equal(rule.maxHeight, 256);
  }
});

test('ultrawide chapel preserves its expanded aspect at the 720p ceiling', () => {
  const rule = policyFor('player-polish/scenes/chapel-rest-ultrawide.webp');
  assert.deepEqual(twinDimensions({ width: 1938, height: 812 }, rule), { width: 1718, height: 720 });
  assert.deepEqual(twinDimensions({ width: 600, height: 251 }, rule), { width: 600, height: 251 });
  assert.equal(rule.quality, 78);
  assert.equal(rule.alphaQuality, 80);
});
