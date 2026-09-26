// tests/assetmap-tiers.test.mjs — assetUrl() resolves an id through the tiers:
// a high-res source when one covers the id, else the built-in art.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assetUrl, assetTier, setHighResSource } from '../src/ui/assetmap.js';

test('with no high-res source an id resolves to the built-in path', () => {
  setHighResSource(null);
  assert.equal(assetUrl('assets/bg/bg_act1.webp'), 'assets/bg/bg_act1.webp');
  assert.equal(assetTier('assets/bg/bg_act1.webp'), 'built-in');
});

test('a high-res source wins for the ids it covers and falls back for the rest', () => {
  const n = setHighResSource(new Map([['assets/bg/bg_act1.webp', 'blob:hd-act1']]));
  assert.equal(n, 1);
  assert.equal(assetUrl('assets/bg/bg_act1.webp'), 'blob:hd-act1');
  assert.equal(assetTier('assets/bg/bg_act1.webp'), 'high');
  assert.equal(assetUrl('assets/bg/bg_act2.webp'), 'assets/bg/bg_act2.webp', 'a file the folder lacks falls back to built-in');
  assert.equal(assetTier('assets/bg/bg_act2.webp'), 'built-in');
  setHighResSource(null);
});

test('an empty source is no source', () => {
  assert.equal(setHighResSource(new Map()), 0);
  assert.equal(assetUrl('assets/bg/bg_act1.webp'), 'assets/bg/bg_act1.webp');
});
