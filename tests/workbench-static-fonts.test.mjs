import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, copyFileSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {copyGameFonts} from '../tools/workbench-static.mjs';
import {markerFor, packDirFor} from '../tools/fetch-art.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cssFile = path.join(REPO, 'styles', 'kit.css');
const css = readFileSync(cssFile, 'utf8');
const fontURLs = [...css.matchAll(/url\(['"]?(\.\.\/assets\/fonts\/[^)'"\s]+)['"]?\)/g)].map(match => match[1]);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'wbs-font-fixture-'));
  t.after(() => rmSync(root, {recursive:true, force:true}));
  const high = {zip:'hd-assets-v24.zip',sha256:'a'.repeat(64)};
  const pin = {schema:2,repo:'cehinds/AI-Art',tag:'ashenspire-hd-assets-v24',...high,packs:{high,
    light:{zip:'light-assets-v24.zip',sha256:'b'.repeat(64)},common:{zip:'common-assets-v24.zip',sha256:'c'.repeat(64)}}};
  const common = packDirFor(pin, 'common', root);
  const fonts = path.join(common, 'assets', 'fonts');
  const loose = path.join(root, 'assets', 'fonts');
  mkdirSync(fonts, {recursive:true}); mkdirSync(loose, {recursive:true});
  const assets = {}, expected = new Map();
  for (const url of fontURLs) {
    const id = url.slice('../'.length), name = path.basename(id);
    const bytes = Buffer.from('synthetic font fixture: ' + name);
    assets[id] = {common:{path:id,bytes:bytes.length,sha256:sha(bytes)}};
    expected.set(name, bytes);
    writeFileSync(path.join(fonts, name), bytes);
    writeFileSync(path.join(loose, name), 'unpublished loose font');
  }
  const manifest = {schema:2,count:Object.keys(assets).length,assets};
  writeFileSync(path.join(root, 'art-release.json'), JSON.stringify(pin));
  writeFileSync(path.join(root, 'art-manifest.json'), JSON.stringify(manifest));
  const marker = path.join(common, '.verified');
  writeFileSync(marker, markerFor(pin, manifest, 'common'));
  return {root,fonts,marker,expected,game:path.join(root,'out','game')};
}

test('every font URL in the mirrored kit.css resolves to the copied pinned COMMON bytes', async t => {
  assert.equal(fontURLs.length, 15, 'all registered lore font faces are covered');
  assert.equal(new Set(fontURLs).size, 15);
  const f = fixture(t);
  assert.equal(existsSync(path.join(f.root, 'assets-mobile', 'fonts')), false, 'LIGHT supplies no fonts');
  await copyGameFonts(f.game, {root:f.root});
  mkdirSync(path.join(f.game, 'styles'), {recursive:true});
  copyFileSync(cssFile, path.join(f.game, 'styles', 'kit.css'));
  for (const url of fontURLs) {
    const resolved = new URL(url, 'https://example.test/x/wb/game/styles/kit.css');
    assert.equal(resolved.pathname, '/x/wb/game/assets/fonts/' + path.basename(url));
    const output = path.resolve(f.game, 'styles', url);
    assert.deepEqual(readFileSync(output), f.expected.get(path.basename(url)), url);
  }
  const mirrored = readFileSync(path.join(f.game, 'styles', 'kit.css'), 'utf8');
  assert.match(mirrored, /SIL OPEN FONT LICENSE Version 1\.1/);
  for (const author of ['Igino Marini','EB Garamond Project Authors','Cormorant Project Authors',
    'Crimson Pro Project Authors','Spectral Project Authors','Libre Baskerville Project Authors',
    'Cinzel Project Authors','Inter Project Authors']) assert(mirrored.includes(author), `font notice: ${author}`);
});

test('fixture-tree or authoring environment cannot replace the pinned COMMON font source', async t => {
  const f = fixture(t);
  const before = {source:process.env.ASHEN_ART_SOURCE,checkout:process.env.ASHEN_ART_CHECKOUT};
  process.env.ASHEN_ART_SOURCE = 'trees';
  process.env.ASHEN_ART_CHECKOUT = f.root;
  try {
    await copyGameFonts(f.game, {root:f.root});
    for (const [name,bytes] of f.expected) assert.deepEqual(readFileSync(path.join(f.game,'assets','fonts',name)), bytes);
  } finally {
    for (const [key,value] of [['ASHEN_ART_SOURCE',before.source],['ASHEN_ART_CHECKOUT',before.checkout]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('missing or stale COMMON verification blocks copying despite available loose fonts', async t => {
  for (const marker of [null, 'stale pin and manifest']) {
    const f = fixture(t);
    if (marker === null) rmSync(f.marker); else writeFileSync(f.marker, marker);
    await assert.rejects(copyGameFonts(f.game, {root:f.root}), /not fetched|another pin or manifest/);
    assert.equal(existsSync(path.join(f.game, 'assets', 'fonts')), false);
  }
});

test('missing verified font tree fails instead of using the old repository tree', async t => {
  const f = fixture(t); rmSync(f.fonts, {recursive:true});
  await assert.rejects(copyGameFonts(f.game, {root:f.root}), /ENOENT/);
  assert.equal(existsSync(path.join(f.game, 'assets', 'fonts')), false);
});

test('ordinary relative-path CLI invocation still runs main after adding the import guard', () => {
  const run = spawnSync(process.execPath, ['tools/workbench-static.mjs','--unknown-font-fixture-argument'],
    {cwd:REPO,encoding:'utf8',timeout:10_000});
  assert.equal(run.status, 1, run.stderr);
  assert.match(run.stderr, /workbench-static: unknown argument: --unknown-font-fixture-argument/);
});
