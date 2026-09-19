import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { relics } from '../src/content/relics.js';
import { relicArtAsset } from '../src/model/relicArt.js';

test('painted relic paths resolve to shipped WebPs for twelve catalog identities', () => {
  const painted = relics.filter(relic => relicArtAsset(relic));
  assert.equal(painted.length, 12);
  for (const relic of painted) {
    assert.ok(existsSync(new URL('../' + relicArtAsset(relic), import.meta.url)), relic.id);
    assert.equal(relicArtAsset(relic.id), relicArtAsset(relic));
  }
});

test('unpainted and unknown relics keep the glyph fallback', () => {
  assert.equal(relicArtAsset({ id: 'whetstoneFragment' }), null);
  assert.equal(relicArtAsset({ id: '../unexpected' }), null);
  assert.equal(relicArtAsset(null), null);
});
