import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogJSONExpression } from '../tools/catalog-json.mjs';
import { decodeCatalogJSONText, decodeCatalogJSON } from '../src/model/catalogJson.js';
import { compileGameProfiles } from '../tools/game-config.mjs';
import { gameProfileCatalog } from '../src/content/generated/gameProfiles.js';
import { nodes } from '../src/content/generated/nodes.js';
import { uiStrings } from '../src/content/generated/uiStrings.js';
import { scoring } from '../src/content/generated/scoring.js';
import { sharedOutfitArt } from '../src/content/generated/sharedOutfitArt.js';
import { readFileSync } from 'node:fs';
import { productionBundle } from './helpers/production-bundle.mjs';
const payload = expression => JSON.parse(expression.slice('decodeCatalogJSON('.length, -1));
const assertSizeBudget = (expression, limit) => assert.ok(expression.length < limit);

test('catalog transport reconstructs the exact canonical text, values and provenance', () => {
  const { catalog } = compileGameProfiles();
  const packed = catalogJSONExpression(catalog);
  assert.equal(packed.encoded, true);
  assert.deepEqual(catalogJSONExpression(catalog), packed, 'deterministic emission');
  assert.equal(decodeCatalogJSONText(payload(packed.expression)), JSON.stringify(catalog));
  assert.deepEqual(gameProfileCatalog, catalog, 'real generated import retains all catalog and provenance fields');
  // The kernel-only save pin removed the app-file provenance rows. Measure the
  // smaller live catalog proportionally; keep the original byte guard below.
  const budget = JSON.stringify(catalog).length * 2 / 3;
  assertSizeBudget(packed.expression, budget);
  assert.throws(() => assertSizeBudget(JSON.stringify(catalog), budget), assert.AssertionError);
});

test('fixed provenance corpus retains the original 180 KB reduction guard', () => {
  const catalog = { runtimeSources: Array.from({ length: 8192 }, (_, index) => ({
    path: `src/fixed-provenance/module-${index}.js`,
    id: 'ashen.source-runtime',
    version: '1.0.0',
    hash: `sha256:${index.toString(16).padStart(64, '0')}`,
  })) };
  const text = JSON.stringify(catalog);
  const packed = catalogJSONExpression(catalog);
  assert.equal(packed.encoded, true);
  assert.equal(decodeCatalogJSONText(payload(packed.expression)), text);
  assertSizeBudget(packed.expression, text.length - 180000);
  assert.throws(() => assertSizeBudget(text, text.length - 180000), assert.AssertionError);
});

test('frequent short keys and escaped strings use profitable dictionary indices', () => {
  const value = Array.from({ length: 120 }, (_, index) => ({ id: index, x: index % 2,
    detail: 'quoted " slash \\ newline\n '.repeat(4), ['field' + index]: 'unique-' + index }));
  const packed = catalogJSONExpression(value);
  assert.equal(packed.encoded, true);
  const data = payload(packed.expression);
  assert.ok(data.strings.includes('"id"'), 'escaping makes repeated short keys profitable');
  assert.equal(data.strings[0], '"id"', 'stable frequency ordering gives the first equal-frequency key the shortest index');
  assert.equal(decodeCatalogJSONText(data), JSON.stringify(value));
  assert.deepEqual(decodeCatalogJSON(data), value);
  assert.deepEqual(catalogJSONExpression(value), packed);
  assertSizeBudget(packed.expression, JSON.stringify(value).length);
});

test('packed content tables retain their canonical definitions through native imports and the classic loader', () => {
  const tables = { nodes, uiStrings, scoring, sharedOutfitArt };
  const require = productionBundle({ additionalModules: Object.keys(tables).map(name => `src/content/generated/${name}.js`) });
  for (const [name, value] of Object.entries(tables)) {
    const packed = catalogJSONExpression(value), text = JSON.stringify(value);
    assert.equal(packed.encoded ? decodeCatalogJSONText(payload(packed.expression)) : packed.expression, text);
    assert.equal(JSON.stringify(require(`src/content/generated/${name}.js`)[name]), text,
      `${name}: the real classic compiler and loader retain the complete table`);
  }
  for (const [name, value] of Object.entries({ scoring, sharedOutfitArt })) {
    const source = JSON.parse(readFileSync(new URL(`../content/source/${name}.json`, import.meta.url), 'utf8'));
    assert.equal(JSON.stringify(value), JSON.stringify(source), `${name}: authored JSON reaches the runtime unchanged`);
  }
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
