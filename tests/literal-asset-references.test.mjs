import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { danglingLiteralAssets } from '../tools/literal-asset-references.mjs';

const asset = 'assets/recipient-effects/v5/slash.png';
const row = { asset, columns: 3, rows: 1, row: 0, optional: true };
const config = { behavior: { atlasVersion: 'v5', atlas: { slash: row } } };
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

test('real generated catalog permits its 35 optional rows and no unrelated literal', () => {
  const authored = JSON.parse(readFileSync(new URL('../content/config/ui/presentation/recipientEffects.json', import.meta.url), 'utf8'));
  const source = readFileSync(new URL('../src/config/generated/ui.js', import.meta.url), 'utf8');
  const ids = Object.values(authored.behavior.atlas).map(entry => entry.asset);
  assert.equal(ids.length, 35);
  const manifest = new Set(Object.keys(JSON.parse(readFileSync(new URL('../art-manifest.json', import.meta.url), 'utf8')).assets));
  ids.forEach(id => manifest.delete(id));
  assert.deepEqual(scan(source, authored, 'src/config/generated/ui.js', manifest), []);
  const unknown = 'assets/recipient-effects/v5/not-catalogued.png';
  assert.deepEqual(scan(source + `\nconst missing = '${unknown}';`, authored, 'src/config/generated/ui.js', manifest), [`src/config/generated/ui.js → ${unknown}`]);
});
