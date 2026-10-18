import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogJSONExpression } from '../tools/catalog-json.mjs';
import { decodeCatalogJSONText, decodeCatalogJSON } from '../src/model/catalogJson.js';
import { compileGameProfiles } from '../tools/game-config.mjs';
import { gameProfileCatalog } from '../src/content/generated/gameProfiles.js';
const payload = expression => JSON.parse(expression.slice('decodeCatalogJSON('.length, -1));

test('catalog transport reconstructs the exact canonical text, values and provenance', () => {
  const { catalog } = compileGameProfiles();
  const packed = catalogJSONExpression(catalog);
  assert.equal(packed.encoded, true);
  assert.deepEqual(catalogJSONExpression(catalog), packed, 'deterministic emission');
  assert.equal(decodeCatalogJSONText(payload(packed.expression)), JSON.stringify(catalog));
  assert.deepEqual(gameProfileCatalog, catalog, 'real generated import retains all catalog and provenance fields');
  assert.ok(packed.expression.length < JSON.stringify(catalog).length - 180000);
});

test('repeated objects remain distinct and hostile-looking strings remain data', () => {
  const item = { longRepeatedProperty: 'quoted " slash \\ newline\n and }; export const SHOWN_VERSION = 9' };
  const value = Array.from({ length: 20 }, () => ({ ...item }));
  const packed = catalogJSONExpression(value);
  const decoded = decodeCatalogJSON(payload(packed.expression));
  assert.deepEqual(decoded, value);
  assert.notEqual(decoded[0], decoded[1]);
  decoded[0].longRepeatedProperty = 'changed';
  assert.equal(decoded[1].longRepeatedProperty, item.longRepeatedProperty);
  for (const value of [{ marker: '~0~' }, { tiny: 1 }, JSON.parse('{"__proto__":{"own":true}}')]) {
    const fallback = catalogJSONExpression(value);
    assert.equal(fallback.encoded, false);
    assert.equal(fallback.expression, JSON.stringify(value));
  }
});

test('unknown, malformed and unused transport tokens fail closed', () => {
  for (const data of [
    { text: '~1~', strings: ['"value"'] },
    { text: '~00~', strings: ['"value"'] },
    { text: '~0~', strings: ['null'] },
    { text: '~0~', strings: ['"unterminated'] },
    { text: '{}', strings: ['"hidden version"'] },
    { text: '{}', strings: [], ignored: true },
    { text: '{~bad~:1}', strings: [] },
  ]) assert.throws(() => decodeCatalogJSON(data));
});


test('encoded JSON retains own __proto__ keys and independent nested identities', () => {
  const row = JSON.parse('{"__proto__":{"longRepeatedProperty":"repeated data"},"nested":{"longRepeatedProperty":"repeated data"},"zero":-0}');
  const value = Array.from({ length: 20 }, () => structuredClone(row));
  const packed = catalogJSONExpression(value);
  assert.equal(packed.encoded, true);
  const text = JSON.stringify(value);
  assert.equal(decodeCatalogJSONText(payload(packed.expression)), text);
  const decoded = decodeCatalogJSON(payload(packed.expression));
  assert.deepEqual(decoded, JSON.parse(text), 'preserves the existing JSON serialization semantics for -0');
  assert.ok(Object.hasOwn(decoded[0], '__proto__'));
  assert.equal(Object.getPrototypeOf(decoded[0]), Object.prototype);
  assert.deepEqual(Object.keys(decoded[0]), Object.keys(row));
  assert.notEqual(decoded[0].nested, decoded[1].nested);
  assert.notEqual(decoded[0].__proto__, decoded[1].__proto__);
});
