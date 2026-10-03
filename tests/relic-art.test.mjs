import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manifestIds } from '../tools/art-source.mjs';
// Step 12: an id ships when art-manifest.json lists it (the pinned packs carry
// exactly those), not when a tree in this checkout happens to hold the file.
const SHIPPED = manifestIds();
import { relics } from '../src/content/relics.js';
import { relicArtAsset } from '../src/model/relicArt.js';

test('painted relic paths resolve to shipped WebPs for twelve catalog identities', () => {
  const painted = relics.filter(relic => relicArtAsset(relic));
  assert.equal(painted.length, 12);
  for (const relic of painted) {
    assert.ok(SHIPPED.has(relicArtAsset(relic)), relic.id);
    assert.equal(relicArtAsset(relic.id), relicArtAsset(relic));
  }
});

test('unpainted and unknown relics keep the glyph fallback', () => {
  assert.equal(relicArtAsset({ id: 'whetstoneFragment' }), null);
  assert.equal(relicArtAsset({ id: '../unexpected' }), null);
  assert.equal(relicArtAsset(null), null);
});
