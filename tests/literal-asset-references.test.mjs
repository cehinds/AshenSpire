import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { catalogJSONExpression } from '../tools/catalog-json.mjs';
import { catalogVersionScanText } from '../tools/buildversion.mjs';
import { danglingLiteralAssets } from '../tools/literal-asset-references.mjs';

const asset = 'assets/recipient-effects/v5/slash.png';
const row = { asset, columns: 3, rows: 1, row: 0, optional: true };
const config = { behavior: { atlasId: 'v5', atlas: { slash: row } } };
const generated = (recipient = config, extra = {}) =>
  `export const uiConfig = deepFreeze(${JSON.stringify({ presentation: { recipientEffects: recipient }, ...extra })});\n`;
const scan = (source, authored = config, id = 'src/config/generated/ui.js', manifest = new Set()) =>
  danglingLiteralAssets(new Map([[id, source]]), manifest, authored);

test('declared optional atlas art builds absent from the manifest', () => {
  assert.deepEqual(scan(generated()), []);
});

test('required art still fails, including required recipient rows', () => {
  const required = structuredClone(config);
  delete required.behavior.atlas.slash.optional;
  assert.equal(scan(generated(required), required).length, 1);
  assert.equal(scan(`const image = 'assets/required.png';`).length, 1);
  assert.deepEqual(scan(`const image = 'assets/required.png';`, config, 'src/main.js', new Set(['assets/required.png'])), []);
});

test('optional ID cannot exempt another module or another property in generated config', () => {
  assert.equal(scan(generated(), config, 'src/not-generated.js').length, 1);
  const refs = scan(generated(config, { other: { asset, optional: true } }));
  assert.deepEqual(refs, [`src/config/generated/ui.js → ${asset}`]);
  assert.equal(scan(generated() + `const other = '${asset}';`).length, 1);
});

test('unknown rows, stale declarations and arbitrary optional paths cannot bypass validation', () => {
  const unknown = structuredClone(config);
  unknown.behavior.atlas.unknown = { ...row, asset: 'assets/recipient-effects/v5/unknown.png' };
  assert.equal(scan(generated(unknown)).length, 1);
  const stale = structuredClone(config);
  delete stale.behavior.atlas.slash.optional;
  assert.equal(scan(generated(stale)).length, 1);
  for (const bad of ['assets/required.png', 'assets/recipient-effects/v5/../required.png', 'assets/recipient-effects/v5/other.png']) {
    const invalid = structuredClone(config);
    invalid.behavior.atlas.slash.asset = bad;
    assert.throws(() => scan(generated(invalid), invalid), /Invalid optional recipient atlas/);
  }
});

test('real generated catalog permits its 47 optional rows and no unrelated literal', () => {
  const authored = JSON.parse(readFileSync(new URL('../content/config/ui/presentation/recipientEffects.json', import.meta.url), 'utf8'));
  const source = readFileSync(new URL('../src/config/generated/ui.js', import.meta.url), 'utf8');
  const ids = Object.values(authored.behavior.atlas).map(entry => entry.asset);
  assert.equal(ids.filter(id => id.includes('/v5/')).length, 35);
  assert.equal(ids.filter(id => id.includes('/v6/')).length, 12);
  const manifest = new Set(Object.keys(JSON.parse(readFileSync(new URL('../art-manifest.json', import.meta.url), 'utf8')).assets));
  ids.forEach(id => manifest.delete(id));
  assert.deepEqual(scan(source, authored, 'src/config/generated/ui.js', manifest), []);
  const unknown = 'assets/recipient-effects/v5/not-catalogued.png';
  assert.deepEqual(scan(source + `\nconst missing = '${unknown}';`, authored, 'src/config/generated/ui.js', manifest), [`src/config/generated/ui.js → ${unknown}`]);
});

test('packed config preserves optional offsets and detects the same asset at a required site', () => {
  const data = { presentation: { recipientEffects: config }, required: { asset } };
  const packed = catalogJSONExpression({
    ...data, repeated: Array.from({ length: 20 }, () => ({ repeatedProperty: 'a repeated string value' })),
  });
  assert.equal(packed.encoded, true);
  const source = `export const uiConfig = deepFreeze(${packed.expression});\n`;
  assert.deepEqual(scan(source), [`src/config/generated/ui.js → ${asset}`]);
});

test('packed art and changelog projections still expose missing literal assets', () => {
  const path = 'assets/required.png';
  const rows = Array.from({ length: 20 }, () => ({ path, repeatedProperty: 'a repeated string value' }));
  for (const [id, name, wrap, data] of [
    ['src/content/reviewedCardArt.generated.js', 'reviewedCardArtCatalog', false, { rows }],
    ['src/content/changelog.generated.js', 'GENERATED_CHANGELOG', true, rows],
  ]) {
    const packed = catalogJSONExpression(data);
    assert.equal(packed.encoded, true);
    const expression = wrap ? `Object.freeze(${packed.expression})` : packed.expression;
    const source = `export const ${name} = ${expression};
`;
    const missing = scan(source, config, id);
    assert.equal(missing.length, rows.length, id);
    assert.ok(missing.every(ref => ref.endsWith(path)), id);
    assert.deepEqual(scan(source, config, id, new Set([path])), []);
  }
});

test('generated UI, art and changelog scan as the same ordered data that the runtime imports', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  for (const [id, name, wrapper] of [
    ['src/config/generated/ui.js', 'uiConfig', 'deepFreeze('],
    ['src/content/reviewedCardArt.generated.js', 'reviewedCardArtCatalog', ''],
    ['src/content/changelog.generated.js', 'GENERATED_CHANGELOG', 'Object.freeze('],
  ]) {
    const file = resolve(root, id);
    const source = readFileSync(file, 'utf8');
    const prefix = `export const ${name} = ${wrapper}`;
    const line = catalogVersionScanText(id, source).split('\n').find(row => row.startsWith(prefix));
    const canonicalJSON = line.slice(prefix.length, wrapper ? -2 : -1);
    const runtime = (await import(pathToFileURL(file).href))[name];
    assert.equal(canonicalJSON, JSON.stringify(runtime), id);
  }
});
