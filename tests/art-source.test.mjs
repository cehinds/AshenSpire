// tests/art-source.test.mjs — the one door through which the tools read the
// art trees that left this repository at step 13 (docs/EXTERNAL-ASSETS-PLAN.md
// steps 12 and 13): the fetched pack when it is verified, and otherwise an
// error naming the fetch. ASHEN_ART_SOURCE=trees reads the trees' paths under a
// sandbox root that copied them there on purpose.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { artDir, artPath, fetchPlanFor, manifestIds, packSource, packTreeOf, sourceMode, treeOf, HIGH_TREE, MOVING_TREES, PACK_TREES } from '../tools/art-source.mjs';
import { markerFor, readPin } from '../tools/fetch-art.mjs';

const TOOL = fileURLToPath(new URL('../tools/art-source.mjs', import.meta.url));
const hex = (c) => c.repeat(64);
const PIN = {
  schema: 2, repo: 'cehinds/AshenSpire-art', tag: 'hd-assets-v9', zip: 'hd-assets-v9.zip', sha256: hex('a'),
  packs: {
    high: { zip: 'hd-assets-v9.zip', sha256: hex('a') },
    light: { zip: 'light-assets-v9.zip', sha256: hex('b') },
    common: { zip: 'common-assets-v9.zip', sha256: hex('c') },
  },
};
const MANIFEST = {
  schema: 2,
  assets: {
    'assets/bg/a.webp': { light: { path: 'assets-mobile/bg/a.webp', bytes: 1, sha256: hex('1') }, high: { path: 'assets/bg/a.webp', bytes: 1, sha256: hex('2') } },
    'assets/fonts/f.woff2': { common: { path: 'assets/fonts/f.woff2', bytes: 1, sha256: hex('3') } },
    'music/manifest.json': { common: { path: 'music/manifest.json', bytes: 2, sha256: hex('4') } },
  },
};

/** A checkout with no trees, a pin and a manifest; `cached` packs get a verified cache. */
function fixture(cached = [], { trees = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'art-source-'));
  writeFileSync(join(root, 'art-release.json'), JSON.stringify(PIN));
  writeFileSync(join(root, 'art-manifest.json'), JSON.stringify(MANIFEST));
  if (trees) {
    for (const tree of Object.keys(PACK_TREES)) mkdirSync(join(root, ...tree.split('/')), { recursive: true });
    writeFileSync(join(root, 'music', 'manifest.json'), '{"from":"tree"}');
  }
  const pin = readPin(root);
  for (const pack of cached) {
    const dir = join(root, '.art-cache', PIN.tag, pack);
    mkdirSync(join(dir, 'music'), { recursive: true });
    mkdirSync(join(dir, 'assets', 'bg'), { recursive: true });
    writeFileSync(join(dir, 'music', 'manifest.json'), '{"from":"cache"}');
    writeFileSync(join(dir, 'assets', 'bg', 'a.webp'), `${pack}-a`);
    writeFileSync(join(dir, '.verified'), `${markerFor(pin, MANIFEST, pack)}\n`);
  }
  return root;
}

test('the trees the packs carry, and the pack whose cache holds each at the same path', () => {
  assert.deepEqual(MOVING_TREES, { 'assets-mobile': 'light', 'assets/fonts': 'common', music: 'common', 'map-detail': 'common' });
  assert.equal(HIGH_TREE, 'assets');
  assert.deepEqual(PACK_TREES, { ...MOVING_TREES, assets: 'high' });
  assert.equal(treeOf('music/manifest.json'), 'music');
  assert.equal(treeOf('assets/fonts/x.woff2'), 'assets/fonts');
  assert.equal(treeOf('assets-mobile/bg/a.webp'), 'assets-mobile');
  assert.equal(treeOf('./map-detail/abc/256/0-0.webp'), 'map-detail');
  assert.equal(treeOf('assets/bg/a.webp'), null, 'treeOf names the four light and common trees only');
  assert.equal(packTreeOf('assets/bg/a.webp'), 'assets', 'the high tier is the high pack\'s');
  assert.equal(packTreeOf('assets/fonts/x.woff2'), 'assets/fonts', 'the fonts stay the common pack\'s');
  assert.equal(packTreeOf('assets-mobile/x'), 'assets-mobile');
  assert.equal(treeOf('musical/x'), null, 'a prefix is not a tree');
  assert.equal(packTreeOf('assetsx/y'), null);
  assert.throws(() => artDir('art'), /not one of the trees/);
});

test('a verified pack is read from the cache, whatever the mode but trees', () => {
  const root = fixture(['common', 'high']);
  try {
    for (const env of [{}, { ASHEN_ART_SOURCE: 'cache' }, { ASHEN_ART_SOURCE: 'auto' }]) {
      const got = artDir('music', { root, env });
      assert.equal(got.from, 'cache');
      assert.equal(got.dir, join(root, '.art-cache', PIN.tag, 'common', 'music'));
      assert.equal(readFileSync(artPath('music/manifest.json', { root, env }), 'utf8'), '{"from":"cache"}');
    }
    assert.equal(artDir('assets/fonts', { root }).dir, join(root, '.art-cache', PIN.tag, 'common', 'assets', 'fonts'));
    assert.equal(readFileSync(artPath('assets/bg/a.webp', { root }), 'utf8'), 'high-a', 'assets/… is the high pack');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('auto uses local light art; other unfetched packs and explicit cache still require a verified release', () => {
  const root = fixture([], { trees: true });
  try {
    for (const [tree, pack] of Object.entries(PACK_TREES)) {
      for (const env of [{}, { ASHEN_ART_SOURCE: 'cache' }]) {
        if (tree === 'assets-mobile' && !env.ASHEN_ART_SOURCE) {
          assert.equal(artDir(tree, { root, env }).from, 'trees');
          continue;
        }
        assert.throws(() => artDir(tree, { root, env }), new RegExp(`step 13.*fetch-art\\.mjs --pack ${pack}`), `${tree} is not read from the leftover tree`);
      }
    }
    assert.throws(() => artPath('assets/bg/a.webp', { root }), /fetch-art\.mjs --pack high/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('local light art wins in auto even when the light release is cached', () => {
  const root = fixture(['light'], { trees: true });
  try {
    assert.equal(artDir('assets-mobile', { root, env: {} }).from, 'trees');
    assert.equal(artDir('assets-mobile', { root, env: { ASHEN_ART_SOURCE: 'cache' } }).from, 'cache');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a cache for another pin or manifest is not verified, even after it was in the same process', () => {
  const root = fixture(['common']);
  try {
    assert.equal(packSource('common', { root, env: {} }).from, 'cache');
    writeFileSync(join(root, 'art-manifest.json'), JSON.stringify({ ...MANIFEST, assets: { ...MANIFEST.assets, 'music/x.mp3': { common: { path: 'music/x.mp3', bytes: 3, sha256: hex('5') } } } }));
    assert.throws(() => packSource('common', { root, env: {} }), /verified against another pin or manifest/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a pack fetched while the process runs is used from then on (a long-running serve.mjs)', () => {
  const root = fixture([]);
  try {
    assert.throws(() => packSource('light', { root, env: {} }), /fetch-art\.mjs --pack light/);
    const dir = join(root, '.art-cache', PIN.tag, 'light');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '.verified'), `${markerFor(readPin(root), MANIFEST, 'light')}\n`);
    assert.equal(packSource('light', { root, env: {} }).from, 'cache');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('ASHEN_ART_SOURCE=trees reads a sandbox\'s own copies silently; anything else unknown is an error', () => {
  const root = fixture([], { trees: true });
  try {
    const got = artDir('music', { root, env: { ASHEN_ART_SOURCE: 'trees' } });
    assert.deepEqual([got.from, got.dir], ['trees', join(root, 'music')]);
    assert.equal(readFileSync(artPath('music/manifest.json', { root, env: { ASHEN_ART_SOURCE: 'trees' } }), 'utf8'), '{"from":"tree"}');
    assert.equal(artDir('assets', { root, env: { ASHEN_ART_SOURCE: 'trees' } }).dir, join(root, 'assets'));
    rmSync(join(root, 'music'), { recursive: true });
    assert.throws(() => artDir('music', { root, env: { ASHEN_ART_SOURCE: 'trees' } }), /music\/ is not under .*ASHEN_ART_SOURCE=trees/);
    assert.throws(() => sourceMode({ ASHEN_ART_SOURCE: 'tree' }), /one of auto, cache, trees/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('artPath keeps a request inside its tree, and leaves other paths alone', () => {
  const root = fixture(['common', 'high']);
  try {
    assert.equal(artPath('src/main.js', { root }), join(root, 'src', 'main.js'));
    assert.throws(() => artPath('music/../../etc/passwd', { root }), /escapes music\//);
    assert.throws(() => artPath('assets/../../etc/passwd', { root }), /escapes assets\//);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('manifestIds is the committed manifest, read without any tree or cache', () => {
  const root = fixture([]);
  try {
    assert.deepEqual([...manifestIds(root)].sort(), Object.keys(MANIFEST.assets).sort());
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the CLI names each tree\'s directory from the cache, or fails naming the fetch; an unknown tree fails by name', () => {
  // Run against this checkout: since step 13 it has no trees, so every line is
  // a fetched cache, or the run fails and names the fetch for the missing pack.
  const r = spawnSync(process.execPath, [TOOL, '--which'], { encoding: 'utf8', env: { ...process.env, ASHEN_ART_SOURCE: 'auto' } });
  if (r.status === 0) {
    for (const tree of Object.keys(PACK_TREES)) assert.match(r.stdout, new RegExp(`^${tree.replace('/', '\\/')}\\s+(high|light|common)\\s+${tree === 'assets-mobile' ? 'trees\\s+assets-mobile' : 'cache\\s+\\.art-cache/'}`, 'm'));
  } else {
    assert.equal(r.status, 1);
    assert.match(r.stderr, /art-source: FAIL — .*node tools\/fetch-art\.mjs --pack (high|light|common)/);
  }
  const bad = spawnSync(process.execPath, [TOOL, '--dir', 'art'], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /art-source: FAIL — "art" is not one of the trees/);
});

test('fetchPlanFor: a rebuild fetches its own commit\'s packs, and only when its pin names them', () => {
  const root = fixture([]);
  try {
    assert.equal(fetchPlanFor(root), null, 'no tools/fetch-art.mjs: nothing to run');
    mkdirSync(join(root, 'tools'), { recursive: true });
    writeFileSync(join(root, 'tools', 'fetch-art.mjs'), '');
    assert.deepEqual(fetchPlanFor(root), ['tools/fetch-art.mjs', '--pack', 'light,common']);
    assert.deepEqual(fetchPlanFor(root, { fullArt: true }), ['tools/fetch-art.mjs', '--pack', 'all']);
    writeFileSync(join(root, 'art-release.json'), JSON.stringify({ ...PIN, schema: 1, packs: undefined }));
    assert.equal(fetchPlanFor(root), null, 'a schema-1 pin builds from its trees');
    rmSync(join(root, 'art-release.json'));
    assert.equal(fetchPlanFor(root), null, 'no pin at all');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
