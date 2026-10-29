import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manifestIds } from '../tools/art-source.mjs';
// Step 12: an id ships when art-manifest.json lists it (the pinned packs carry
// exactly those), not when a tree in this checkout happens to hold the file.
const SHIPPED = manifestIds();
import { relics } from '../src/content/relics.js';
import { relicArtAsset } from '../src/model/relicArt.js';

test('painted relic paths resolve to shipped WebPs for the full catalog', () => {
  // Brimming Gourd (Core 2, 2026-10-25) ships before its painting exists: it keeps the glyph until art is delivered.
  const UNPAINTED = new Set(['brimmingGourd']);
  const painted = relics.filter(relic => relicArtAsset(relic));
  assert.equal(painted.length, relics.length - UNPAINTED.size);
  for (const relic of relics.filter(relic => UNPAINTED.has(relic.id))) assert.equal(relicArtAsset(relic), null, relic.id);
  for (const relic of painted) {
    assert.ok(SHIPPED.has(relicArtAsset(relic)), relic.id);
    assert.equal(relicArtAsset(relic.id), relicArtAsset(relic));
  }
});

test('unknown relics keep the glyph fallback', () => {
  assert.equal(relicArtAsset({ id: '../unexpected' }), null);
  assert.equal(relicArtAsset(null), null);
});
