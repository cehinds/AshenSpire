import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { check, release, REPO_ROOT, BUILD_IDENTITY_FILES, catalogSchemaVersionSpans, catalogVersionScanText } from '../tools/buildversion.mjs';
import { gameProfileCatalog } from '../src/content/generated/gameProfiles.js';

import { catalogJSONExpression } from '../tools/catalog-json.mjs';

const file = 'src/content/generated/gameProfiles.js';
const original = readFileSync(resolve(REPO_ROOT, file), 'utf8');
const formats = [
  ['pretty', value => JSON.stringify(value, null, 2)],
  ['compact', value => JSON.stringify(value)],
  ['dictionary', value => catalogJSONExpression(value).expression],
  ['CRLF', value => JSON.stringify(value, null, 2).replaceAll('\n', '\r\n')],
];
const moduleText = (catalog, format) => 'export const gameProfileCatalog = ' + format(catalog) + ';\n';

test('catalog protocol versions clear only their schema sites, including when equal to the release', () => {
  const root = mkdtempSync(join(tmpdir(), 'buildversion-schema-'));
  try {
    for (const path of ['src', 'styles', 'index.html', 'buildordinal.json', ...BUILD_IDENTITY_FILES]) {
      cpSync(resolve(REPO_ROOT, path), resolve(root, path), { recursive: true });
    }
    const row = () => check(root).rows.find(row => row.name === 'B NO SECOND COPY');
    assert.equal(row().ok, true, row().detail);
    const rel = release(root);
    for (const [name, format] of formats) {
      const agreeing = moduleText(JSON.parse(JSON.stringify(gameProfileCatalog).replaceAll('"version":"1.0.0"', `"version":"${rel}"`)), format);
      writeFileSync(resolve(root, file), agreeing);
      assert.equal(row().ok, true, `${name}: ${row().detail}`);
      for (const version of [rel, '9.9.z', 'latest']) {
        writeFileSync(resolve(root, file), agreeing.trimEnd() + ` export const SHOWN_VERSION = '${version}';\n`);
        assert.equal(row().ok, false, `${name}: appended declaration`);
        assert.match(row().detail, /SHOWN_VERSION/);
        const catalog = structuredClone(gameProfileCatalog);
        catalog.display = { version };
        catalog.modules.animation.defaults.display = { version };
        catalog.releaseVersion = version;
        writeFileSync(resolve(root, file), moduleText(catalog, format));
        assert.equal(row().ok, false, `${name}: additional version sites still fail`);
        assert.match(row().detail, /version =/);
        assert.match(row().detail, /releaseVersion =/);
        if (version === rel) assert.match(row().detail, /arm 1/);
      }
    }
    for (const expression of invalidEncodedExpressions) {
      writeFileSync(resolve(root, file), 'export const gameProfileCatalog = ' + expression + ';');
      assert.equal(row().ok, false, 'invalid encoded catalog fails row B closed');
      assert.match(row().detail, /encoded catalog/);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('unrecognized generated fields and other files never receive a catalog-wide exemption', () => {
  assert.equal(catalogSchemaVersionSpans('src/content/generated/other.js', original).length, 0);
  for (const [name, format] of formats) {
    const catalog = structuredClone(gameProfileCatalog);
    catalog.modules.animation.defaults.display = { version: 'latest' };
    catalog.releaseVersion = 'latest';
    // A quoted brace/semicolon is data, never the end of the JSON export.
    catalog.display = { note: 'escaped quote " and }; and [brackets]', version: 'latest' };
    const text = catalogVersionScanText(file, moduleText(catalog, format));
    const exempt = catalogSchemaVersionSpans(file, text);
    assert.ok(exempt.length > 1000, name);
    for (const span of exempt) assert.equal(JSON.parse(text.slice(span.start, span.end)), '1.0.0');
    for (const match of text.matchAll(/"latest"/g)) {
      assert.equal(exempt.some(span => span.start <= match.index && match.index < span.end), false, name);
    }
    assert.equal(catalogSchemaVersionSpans(file, text.replace('"contracts"', '"contracts":BROKEN,"bad"')).length, 0, `${name}: invalid JSON fails closed`);
  }
  assert.equal(catalogSchemaVersionSpans(file, 'export const gameProfileCatalog = {"contracts":{"version":"1.0.0","version":"latest"}};').length, 0, 'duplicate keys fail closed');
  assert.equal(catalogSchemaVersionSpans(file, 'export const gameProfileCatalog = {"contracts":{"version":"1.0.0"}} + unsafe;').length, 0, 'expressions receive no exemption');
});

const invalidEncodedExpressions = [
  ...[
    { text: '{}', strings: ['"9.9.z"'] },
    { text: '~1~', strings: ['"value"'] },
  ].map(payload => `decodeCatalogJSON(${JSON.stringify(payload)})`),
  'decodeCatalogJSON({"text":"{}","strings":[]}) + unsafe',
  'decodeCatalogJSON({"text":"{}","text":"{}","strings":[]})',
  'anotherDecoder({})',
];
test('encoded catalogs reject malformed, unknown, and unused dictionary material', () => {
  for (const expression of invalidEncodedExpressions) {
    assert.throws(() => catalogVersionScanText(file, 'export const gameProfileCatalog = ' + expression + ';'));
  }
});
