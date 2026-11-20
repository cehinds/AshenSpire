import test from 'node:test';
import assert from 'node:assert/strict';
import { sameLfCanonicalText } from '../tools/working-tree-text.mjs';

test('generated-text checks accept checkout CRLF but still reject content drift', () => {
  const expected = '{\n  "value": 1\n}\n';
  assert.equal(sameLfCanonicalText(expected, expected), true);
  assert.equal(sameLfCanonicalText(expected.replace(/\n/g, '\r\n'), expected), true);
  assert.equal(sameLfCanonicalText(expected.replace('1', '2'), expected), false);
  assert.equal(sameLfCanonicalText(expected.replace(/\n/g, '\r\n').replace('1', '2'), expected), false);
  assert.equal(sameLfCanonicalText(expected.replace(/\n/g, '\r\n').replace('\r\n', '\r'), expected), false);
});
