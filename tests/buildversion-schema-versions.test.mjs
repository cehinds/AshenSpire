import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { check, release, REPO_ROOT, BUILD_IDENTITY_FILES, catalogSchemaVersionLines } from '../tools/buildversion.mjs';

const file = 'src/content/generated/gameProfiles.js';
const original = readFileSync(resolve(REPO_ROOT, file), 'utf8');

test('catalog protocol versions clear only their schema sites, including when equal to the release', () => {
  const root = mkdtempSync(join(tmpdir(), 'buildversion-schema-'));
  try {
    for (const path of ['src', 'styles', 'index.html', 'buildordinal.json', ...BUILD_IDENTITY_FILES]) {
      cpSync(resolve(REPO_ROOT, path), resolve(root, path), { recursive: true });
    }
    const row = () => check(root).rows.find(row => row.name === 'B NO SECOND COPY');
    assert.equal(row().ok, true, row().detail);
    const rel = release(root);
    const agreeing = original.replaceAll('"version": "1.0.0"', `"version": "${rel}"`);
    writeFileSync(resolve(root, file), agreeing);
    assert.equal(row().ok, true, row().detail);
    for (const version of [rel, '9.9.z', 'latest']) {
      writeFileSync(resolve(root, file), agreeing + `\nexport const SHOWN_VERSION = '${version}';\n`);
      assert.equal(row().ok, false);
      assert.match(row().detail, /SHOWN_VERSION/);
      const planted = agreeing.replace('"contracts": {', `"display": { "version": "${version}" },\n  "contracts": {`);
      writeFileSync(resolve(root, file), planted);
      assert.equal(row().ok, false, 'noncanonical catalog fails closed');
      const prefix = 'export const gameProfileCatalog = ';
      const end = agreeing.indexOf('\n};');
      const catalog = JSON.parse(agreeing.slice(agreeing.indexOf(prefix) + prefix.length, end + 2));
      catalog.display = { version };
      writeFileSync(resolve(root, file), prefix + JSON.stringify(catalog, null, 2) + ';\n');
      assert.equal(row().ok, false, 'canonical additional version sites still fail');
      assert.match(row().detail, /version =/);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('unrecognized generated fields and other files never receive a catalog-wide exemption', () => {
  assert.equal(catalogSchemaVersionLines('src/content/generated/other.js', original).size, 0);
  const start = original.indexOf('export const gameProfileCatalog = ');
  const end = original.indexOf('\n};', start);
  const catalog = JSON.parse(original.slice(start + 'export const gameProfileCatalog = '.length, end + 2));
  catalog.modules.animation.defaults.display = { version: 'latest' };
  catalog.releaseVersion = 'latest';
  const text = 'export const gameProfileCatalog = ' + JSON.stringify(catalog, null, 2) + ';\n';
  const exempt = catalogSchemaVersionLines(file, text);
  assert.ok(exempt.size > 1000);
  text.split('\n').forEach((line, i) => {
    if (line.includes('"latest"')) assert.equal(exempt.has(i), false);
  });
});
