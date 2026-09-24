import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { distinctInlinedBytes, inlinedBytes, MOBILE_ART_INLINED_BUDGET_BYTES, MOBILE_BUNDLE_BUDGET_BYTES } from '../tools/mobileart-policy.mjs';

test('the art budget counts each distinct image once, as the bundle inlines it', () => {
  const a = Buffer.from('same bytes');
  const b = Buffer.from('other bytes!');
  assert.equal(distinctInlinedBytes([a, Buffer.from('same bytes'), b]), inlinedBytes(a.length) + inlinedBytes(b.length));
  assert.equal(distinctInlinedBytes([]), 0);
  assert.ok(MOBILE_ART_INLINED_BUDGET_BYTES < MOBILE_BUNDLE_BUDGET_BYTES, 'the art budget stays under the file ceiling');
});

test('the bundler aliases byte-identical images instead of inlining them twice', () => {
  const bundle = readFileSync(new URL('../tools/bundle.mjs', import.meta.url), 'utf8');
  assert.match(bundle, /firstKeyOf\.has\(id\)/);
  assert.match(bundle, /ASSET_MAP\[alias\] = ASSET_MAP\[key\]/);
});
