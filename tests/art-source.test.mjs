// tests/art-source.test.mjs — the one door through which the tools read the
// trees that leave this repository at step 13 (docs/EXTERNAL-ASSETS-PLAN.md
// step 12): the fetched pack when it is verified, the tree otherwise, and
// never the tree when ASHEN_ART_SOURCE=cache binds the checkout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { artDir, artPath, fetchPlanFor, manifestIds, packSource, sourceMode, strictFor, treeOf, MOVING_TREES } from '../tools/art-source.mjs';
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

/** A checkout with the four trees, a pin and a manifest; `cached` packs get a verified cache. */
function fixture(cached = []) {
  const root = mkdtempSync(join(tmpdir(), 'art-source-'));
  writeFileSync(join(root, 'art-release.json'), JSON.stringify(PIN));
  writeFileSync(join(root, 'art-manifest.json'), JSON.stringify(MANIFEST));
  for (const tree of Object.keys(MOVING_TREES)) mkdirSync(join(root, ...tree.split('/')), { recursive: true });
  writeFileSync(join(root, 'music', 'manifest.json'), '{"from":"tree"}');
  const pin = readPin(root);
  for (const pack of cached) {
    const dir = join(root, '.art-cache', PIN.tag, pack);
    mkdirSync(join(dir, 'music'), { recursive: true });
    mkdirSync(join(dir, 'assets-mobile'), { recursive: true });
    writeFileSync(join(dir, 'music', 'manifest.json'), '{"from":"cache"}');
    writeFileSync(join(dir, '.verified'), `${markerFor(pin, MANIFEST, pack)}\n`);
  }
  return root;
}

test('the four trees, and the pack whose cache holds each at the same path', () => {
  assert.deepEqual(MOVING_TREES, { 'assets-mobile': 'light', 'assets/fonts': 'common', music: 'common', 'map-detail': 'common' });
  assert.equal(treeOf('music/manifest.json'), 'music');
  assert.equal(treeOf('assets/fonts/x.woff2'), 'assets/fonts');
  assert.equal(treeOf('assets-mobile/bg/a.webp'), 'assets-mobile');
  assert.equal(treeOf('./map-detail/abc/256/0-0.webp'), 'map-detail');
  assert.equal(treeOf('assets/bg/a.webp'), null, 'the high tier is not one of them');
  assert.equal(treeOf('musical/x'), null, 'a prefix is not a tree');
  assert.throws(() => artDir('assets'), /not one of the trees/);
});

test('a verified pack is read from the cache, whatever the mode', () => {
  const root = fixture(['common']);
  try {
    for (const env of [{}, { ASHEN_ART_SOURCE: 'cache' }]) {
      const got = artDir('music', { root, env, warn: () => assert.fail('no note when the cache is used') });
      assert.equal(got.from, 'cache');
      assert.equal(got.dir, join(root, '.art-cache', PIN.tag, 'common', 'music'));
      assert.equal(readFileSync(artPath('music/manifest.json', { root, env }), 'utf8'), '{"from":"cache"}');
    }
    assert.equal(artDir('assets/fonts', { root }).dir, join(root, '.art-cache', PIN.tag, 'common', 'assets', 'fonts'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('an unfetched pack falls back to the tree once, with a note naming the fetch', () => {
  const root = fixture([]);
  try {
    const notes = [];
    const a = artDir('music', { root, env: {}, warn: (m) => notes.push(m) });
    const b = artDir('map-detail', { root, env: {}, warn: (m) => notes.push(m) });
    assert.equal(a.from, 'trees');
    assert.equal(a.dir, join(root, 'music'));
    assert.equal(b.dir, join(root, 'map-detail'));
    assert.equal(notes.length, 1, 'one note per pack');
    assert.match(notes[0], /fetch-art\.mjs --pack common/);
    assert.match(notes[0], /step 13/);
    assert.equal(readFileSync(artPath('music/manifest.json', { root, env: {} }), 'utf8'), '{"from":"tree"}');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a cache for another pin or manifest is not verified, even after it was in the same process', () => {
  const root = fixture(['common']);
  try {
    assert.equal(packSource('common', { root, env: {}, warn: () => {} }).from, 'cache');
    writeFileSync(join(root, 'art-manifest.json'), JSON.stringify({ ...MANIFEST, assets: { ...MANIFEST.assets, 'music/x.mp3': { common: { path: 'music/x.mp3', bytes: 3, sha256: hex('5') } } } }));
    assert.equal(packSource('common', { root, env: {}, warn: () => {} }).from, 'trees');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a pack fetched while the process runs is used from then on (a long-running serve.mjs)', () => {
  const root = fixture([]);
  try {
    assert.equal(packSource('light', { root, env: {}, warn: () => {} }).from, 'trees');
    assert.throws(() => packSource('light', { root, env: { ASHEN_ART_SOURCE: 'cache' } }), /ASHEN_ART_SOURCE=cache/);
    const dir = join(root, '.art-cache', PIN.tag, 'light');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '.verified'), `${markerFor(readPin(root), MANIFEST, 'light')}\n`);
    assert.equal(packSource('light', { root, env: { ASHEN_ART_SOURCE: 'cache' } }).from, 'cache');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('ASHEN_ART_SOURCE=cache refuses the tree; =trees reads it silently; anything else is an error', () => {
  const root = fixture([]);
  try {
    assert.throws(() => artDir('assets-mobile', { root, env: { ASHEN_ART_SOURCE: 'cache' } }), /ASHEN_ART_SOURCE=cache: .*fetch-art\.mjs --pack light/);
    // In CI it binds the checkout only: a sandbox elsewhere still builds from its copy.
    const other = { ASHEN_ART_SOURCE: 'cache', GITHUB_WORKSPACE: tmpdir() };
    assert.equal(strictFor(root, other), false);
    assert.equal(artDir('assets-mobile', { root, env: other, warn: () => {} }).from, 'trees');
    assert.equal(strictFor(root, { ASHEN_ART_SOURCE: 'cache', GITHUB_WORKSPACE: root }), true);
    assert.equal(artDir('music', { root, env: { ASHEN_ART_SOURCE: 'trees' }, warn: () => assert.fail('trees mode is silent') }).from, 'trees');
    assert.throws(() => sourceMode({ ASHEN_ART_SOURCE: 'tree' }), /one of auto, cache, trees/);
    // The high pack's tree (assets/) is not one of the four: it leaves with ART-REPO-PLAN step 6.
    assert.equal(packSource('high', { root, env: { ASHEN_ART_SOURCE: 'cache' }, warn: () => {} }).from, 'trees');
    rmSync(join(root, 'music'), { recursive: true });
    assert.throws(() => artDir('music', { root, env: {}, warn: () => {} }), /not in this checkout and the common pack is not fetched/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('artPath keeps a request inside its tree, and leaves other paths alone', () => {
  const root = fixture(['common']);
  try {
    assert.equal(artPath('src/main.js', { root }), join(root, 'src', 'main.js'));
    assert.throws(() => artPath('music/../../etc/passwd', { root }), /escapes music\//);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('manifestIds is the committed manifest, read without any tree or cache', () => {
  const root = fixture([]);
  try {
    rmSync(join(root, 'music'), { recursive: true });
    assert.deepEqual([...manifestIds(root)].sort(), Object.keys(MANIFEST.assets).sort());
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the CLI names each tree\'s directory, and fails by name', () => {
  const ok = spawnSync(process.execPath, [TOOL, '--which'], { encoding: 'utf8', env: { ...process.env, ASHEN_ART_SOURCE: 'trees' } });
  assert.equal(ok.status, 0, ok.stderr);
  for (const tree of Object.keys(MOVING_TREES)) assert.match(ok.stdout, new RegExp(`^${tree.replace('/', '\\/')}\\s+\\w+\\s+trees\\s+${tree.replace('/', '\\/')}$`, 'm'));
  const bad = spawnSync(process.execPath, [TOOL, '--dir', 'assets'], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /art-source: FAIL — "assets" is not one of the trees/);
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
