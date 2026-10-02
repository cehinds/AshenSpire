// tests/fetch-art.test.mjs — tools/zip.mjs and tools/fetch-art.mjs, with known-bads.
//
// The zip module is shared byte for byte with cehinds/AshenSpire-art, which
// packs the releases this tool unpacks; the pinned vector below is the same one
// that repository's tests pin, so the two cannot drift apart silently.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, readZip, writeZip } from '../tools/zip.mjs';
import { createServer } from 'node:http';
import { agree, download, fetchArt, httpCause, markerFor, netCause, packDirFor, packOfZip, packsOf, readPin, unpack, verifyRelease, PIN_PATH, MANIFEST_PATH } from '../tools/fetch-art.mjs';
import { buildManifest, canonicalBytes, commonSources, serialize } from '../tools/art-manifest.mjs';
import { planPacks, verifyPacks, writePacks } from '../tools/asset-pack.mjs';

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const tmp = () => mkdtempSync(join(tmpdir(), 'fetch-art-'));

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('the shared zip writer produces the vector cehinds/AshenSpire-art pins', () => {
  const dir = tmp();
  try {
    const out = join(dir, 'v.zip');
    writeZip(out, [{ name: 'b/two.txt', data: Buffer.from('two\n') }, { name: 'a.txt', data: Buffer.from('one\n') }]);
    const buf = readFileSync(out);
    assert.equal(sha(buf), 'dbe718937523d5bf1e635265ef5521109f596ec2e6762d8f01977032ea52c67c');
    assert.deepEqual(readZip(buf).map((e) => e.name), ['a.txt', 'b/two.txt']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the committed pin is schema 2: one tag, three packs, the top level equal to the high pack', () => {
  const raw = JSON.parse(readFileSync(new URL(`../${PIN_PATH}`, import.meta.url), 'utf8'));
  assert.equal(raw.repo, 'cehinds/AshenSpire-art');
  assert.equal(raw.schema, 2);
  const pin = readPin();
  assert.deepEqual(Object.keys(pin.packs).sort(), ['common', 'high', 'light']);
  const n = pin.tag.replace('hd-assets-v', '');
  assert.equal(pin.packs.high.zip, `hd-assets-v${n}.zip`);
  assert.equal(pin.packs.light.zip, `light-assets-v${n}.zip`);
  assert.equal(pin.packs.common.zip, `common-assets-v${n}.zip`);
  assert.deepEqual([pin.zip, pin.sha256], [pin.packs.high.zip, pin.packs.high.sha256]);
  for (const p of Object.values(pin.packs)) assert.match(p.sha256, /^[0-9a-f]{64}$/);
});

// A throwaway repo root: a manifest listing two ids, a release zip made the way
// cehinds/AshenSpire-art's tools/pack.mjs makes one, and a pin for it.
function fixture({ tamper = null } = {}) {
  const root = tmp();
  const files = { 'assets/bg/a.webp': Buffer.from('high-a'), 'assets/ui/b.webp': Buffer.from('high-b') };
  const record = (id) => ({ high: { path: id, bytes: files[id].length, sha256: sha(files[id]) } });
  const manifest = { schema: 1, count: 2, assets: Object.fromEntries(Object.keys(files).map((id) => [id, record(id)])) };
  writeFileSync(join(root, MANIFEST_PATH), JSON.stringify(manifest));
  let entries = [{ name: 'art-manifest.json', data: Buffer.from(JSON.stringify(manifest)) },
    ...Object.entries(files).map(([name, data]) => ({ name, data }))];
  if (tamper) entries = tamper(entries);
  const zip = join(root, 'hd-assets-v1.zip');
  writeZip(zip, entries);
  const pin = { repo: 'cehinds/AshenSpire-art', tag: 'hd-assets-v1', zip: 'hd-assets-v1.zip', sha256: sha(readFileSync(zip)) };
  writeFileSync(join(root, PIN_PATH), JSON.stringify(pin));
  return { root, zip, pin, manifest };
}

test('a matching release is verified, unpacked into .art-cache/<tag>/, then reused', async () => {
  const { root, zip } = fixture();
  try {
    const first = await fetchArt({ root, from: zip });
    assert.equal(first.count, 2);
    assert.equal(readFileSync(join(first.dir, 'assets/bg/a.webp'), 'utf8'), 'high-a');
    assert.match(first.dir, /\.art-cache[\\/]hd-assets-v1[\\/]high$/);
    const again = await fetchArt({ root });
    assert.equal(again.reused, true, 'a verified cache is reused without a download');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('known-bad: a zip whose sha256 is not the pinned one is refused before it is read', () => {
  const { root, zip, pin, manifest } = fixture();
  try {
    const buf = readFileSync(zip);
    buf[buf.length - 1] ^= 1;
    assert.match(verifyRelease(buf, pin, manifest).problems[0], /sha256 is .* pins/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('known-bad: a changed, missing or extra file is refused and leaves no cache', async () => {
  const cases = [
    [(e) => e.map((x) => (x.name === 'assets/bg/a.webp' ? { ...x, data: Buffer.from('other') } : x)), /assets\/bg\/a\.webp: the release's file differs/],
    [(e) => e.filter((x) => x.name !== 'assets/ui/b.webp'), /assets\/ui\/b\.webp: not in the release/],
    [(e) => [...e, { name: 'assets/extra.webp', data: Buffer.from('x') }], /assets\/extra\.webp: in the release, not in/],
    [(e) => e.filter((x) => x.name !== 'art-manifest.json'), /the release has no art-manifest\.json/],
    [(e) => e.map((x) => (x.name === 'art-manifest.json' ? { ...x, data: Buffer.from('{"assets":{}}') } : x)), /assets\/bg\/a\.webp: the release's art-manifest\.json disagrees/],
  ];
  for (const [tamper, want] of cases) {
    const { root, zip } = fixture({ tamper });
    try {
      await assert.rejects(fetchArt({ root, from: zip }), (e) => { assert.match(e.problems.join('\n'), want); return true; });
      assert.ok(!existsSync(join(root, '.art-cache/hd-assets-v1/high')), 'nothing is unpacked from a release that failed');
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('known-bad: --recheck finds a cached file edited after it was verified', async () => {
  const { root, zip } = fixture();
  try {
    const { dir } = await fetchArt({ root, from: zip });
    mkdirSync(join(dir, 'assets/bg'), { recursive: true });
    writeFileSync(join(dir, 'assets/bg/a.webp'), 'edited');
    await assert.rejects(fetchArt({ root, recheck: true }), (e) => { assert.match(e.problems.join('\n'), /assets\/bg\/a\.webp: the cached file changed/); return true; });
    assert.ok(!existsSync(dir), 'a cache that no longer matches is removed');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('known-bad: a cache verified against another manifest is not reused', async () => {
  const { root, zip, manifest } = fixture();
  try {
    await fetchArt({ root, from: zip });
    manifest.assets['assets/bg/a.webp'].high.sha256 = '0'.repeat(64);
    writeFileSync(join(root, MANIFEST_PATH), JSON.stringify(manifest));
    let downloads = 0;
    const get = async () => { downloads += 1; throw new Error('no network in this test'); };
    await assert.rejects(fetchArt({ root, get }), /no network in this test/, 'it goes to download again instead of reusing');
    assert.equal(downloads, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('known-bad: a pin whose tag or zip could escape the cache is refused', () => {
  const root = tmp();
  try {
    const base = { repo: 'cehinds/AshenSpire-art', tag: 'hd-assets-v1', zip: 'hd-assets-v1.zip', sha256: 'a'.repeat(64) };
    for (const [bad, want] of [[{ tag: '..' }, /tag must be/], [{ tag: '../../x' }, /tag must be/], [{ zip: 'other.zip' }, /zip must be/], [{ repo: 'x/../y' }, /repo must be/]]) {
      writeFileSync(join(root, PIN_PATH), JSON.stringify({ ...base, ...bad }));
      assert.throws(() => readPin(root), want);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('known-bad: the zip reader refuses duplicate names, and the writer refuses the zip64 sentinel count', () => {
  const dir = tmp();
  try {
    const out = join(dir, 'd.zip');
    writeZip(out, [{ name: 'a.txt', data: Buffer.from('1') }, { name: 'B.txt', data: Buffer.from('2') }]);
    const buf = readFileSync(out);
    buf.write('b', buf.indexOf('B.txt', buf.indexOf('B.txt') + 1), 'latin1'); // central name only: B.txt -> b.txt
    buf.write('A', buf.lastIndexOf('b.txt'), 'latin1');                          // -> A.txt, a case-fold duplicate of a.txt
    assert.throws(() => readZip(buf), /appears twice/);
    assert.throws(() => writeZip(join(dir, 'x.zip'), Array.from({ length: 0xffff }, (_, i) => ({ name: `f${i}`, data: Buffer.alloc(0) }))), /65535 or more/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('known-bad: --recheck finds the cached art-manifest.json deleted or edited', async () => {
  for (const damage of [(dir) => rmSync(join(dir, 'art-manifest.json')), (dir) => writeFileSync(join(dir, 'art-manifest.json'), '{"assets":{}}')]) {
    const { root, zip } = fixture();
    try {
      const { dir } = await fetchArt({ root, from: zip });
      damage(dir);
      await assert.rejects(fetchArt({ root, recheck: true }), (e) => { assert.match(e.problems.join('\n'), /cached art-manifest\.json|no art-manifest\.json/); return true; });
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('the cache directory can only ever be one name under .art-cache', async () => {
  const { cacheDirFor } = await import('../tools/fetch-art.mjs');
  const root = tmp();
  try {
    assert.match(cacheDirFor({ tag: 'hd-assets-v2' }, root), /\.art-cache[\\/]hd-assets-v2$/);
    for (const tag of ['..', '../x', 'a/b', '']) assert.throws(() => cacheDirFor({ tag }, root), /not a single directory name/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('runs at the same time each publish a whole cache, and leave no staging behind', async () => {
  const { root, zip } = fixture();
  try {
    const mod = new URL('../tools/fetch-art.mjs', import.meta.url).href;
    const script = `const { fetchArt } = await import(${JSON.stringify(mod)}); await fetchArt({ root: ${JSON.stringify(root)}, from: ${JSON.stringify(zip)} });`;
    const run = () => new Promise((done) => {
      const child = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore', 'ignore', 'pipe'] });
      let err = '';
      child.stderr.on('data', (d) => { err += d; });
      child.on('close', (code) => done({ code, err }));
    });
    const results = await Promise.all(Array.from({ length: 6 }, run));
    for (const r of results) assert.equal(r.code, 0, r.err);
    assert.deepEqual(readdirSync(join(root, '.art-cache')), ['hd-assets-v1'], 'only the published cache is left');
    assert.deepEqual(readdirSync(join(root, '.art-cache', 'hd-assets-v1')), ['high'], 'and no staging beside it');
    const again = await fetchArt({ root, recheck: true });
    assert.equal(again.reused, true, 'the published cache is whole and verified');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('known-bad: --from replaces a cache whose marker still matches but whose files were damaged', async () => {
  const { root, zip } = fixture();
  try {
    const first = await fetchArt({ root, from: zip });
    writeFileSync(join(first.dir, 'assets/bg/a.webp'), 'edited');
    rmSync(join(first.dir, 'assets/ui/b.webp'));
    const again = await fetchArt({ root, from: zip });
    assert.equal(again.reused, false, '--from unpacks again rather than trusting the marker');
    assert.equal(readFileSync(join(again.dir, 'assets/bg/a.webp'), 'utf8'), 'high-a');
    assert.equal(readFileSync(join(again.dir, 'assets/ui/b.webp'), 'utf8'), 'high-b');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a cache copy an earlier run set aside but could not delete is swept by the next publish', async () => {
  const { root, zip } = fixture();
  try {
    const leftover = join(root, '.art-cache', 'hd-assets-v1', 'high.discard-1-abandoned');
    mkdirSync(join(leftover, 'assets'), { recursive: true });
    writeFileSync(join(leftover, 'assets', 'old.webp'), 'old');
    await fetchArt({ root, from: zip });
    assert.deepEqual(readdirSync(join(root, '.art-cache', 'hd-assets-v1')), ['high'], 'the abandoned copy is gone');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// SCHEMA 2 (docs/EXTERNAL-ASSETS-PLAN.md §2): the fonts became `common` records.
// The pinned hd-assets-v1 zip still carries them under assets/fonts/, listed as
// high in its own schema-1 manifest. That release must keep verifying, and a
// font whose bytes differ from the common record must still be refused.
function schema2Fixture({ fontBytes = Buffer.from('font') } = {}) {
  const root = tmp();
  const art = Buffer.from('high-a');
  const font = Buffer.from('font');
  const rec = (path, data) => ({ path, bytes: data.length, sha256: sha(data) });
  const ours = { schema: 2, count: 3, assets: {
    'assets/bg/a.webp': { high: rec('assets/bg/a.webp', art) },
    'assets/fonts/f.woff2': { common: rec('assets/fonts/f.woff2', font) },
    'music/title/title.mp3': { common: rec('music/title/title.mp3', Buffer.from('mp3')) },
  } };
  const theirs = { schema: 1, count: 2, assets: {
    'assets/bg/a.webp': { high: rec('assets/bg/a.webp', art) },
    'assets/fonts/f.woff2': { high: rec('assets/fonts/f.woff2', fontBytes) },
  } };
  writeFileSync(join(root, MANIFEST_PATH), JSON.stringify(ours));
  const zip = join(root, 'hd-assets-v1.zip');
  writeZip(zip, [{ name: 'art-manifest.json', data: Buffer.from(JSON.stringify(theirs)) },
    { name: 'assets/bg/a.webp', data: art }, { name: 'assets/fonts/f.woff2', data: fontBytes }]);
  const pin = { repo: 'cehinds/AshenSpire-art', tag: 'hd-assets-v1', zip: 'hd-assets-v1.zip', sha256: sha(readFileSync(zip)) };
  writeFileSync(join(root, PIN_PATH), JSON.stringify(pin));
  return { root, zip, pin, manifest: ours };
}

test('schema-1 pin (schema-2 manifest): a legacy high release that still carries the fonts verifies against their common records', async () => {
  const { root, zip, pin, manifest } = schema2Fixture();
  try {
    assert.deepEqual(verifyRelease(readFileSync(zip), pin, manifest).problems, []);
    const { dir } = await fetchArt({ root, from: zip });
    assert.equal(readFileSync(join(dir, 'assets/fonts/f.woff2'), 'utf8'), 'font');
    assert.equal((await fetchArt({ root, recheck: true })).reused, true, 'a common id the high zip lacks (music) is not a recheck failure');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('known-bad: a schema-2 high release that carries a common id is refused, not admitted as legacy', () => {
  const { root, zip, pin, manifest } = schema2Fixture();
  try {
    // The same zip and manifest that a schema-1 pin admits (hd-assets-v1 carried
    // the fonts), but pinned by a schema-2 art-release.json: the high pack is
    // pack-scoped there, so a common font in it is a disagreement and an extra.
    const pin2 = { ...pin, schema: 2, packs: { high: { zip: pin.zip, sha256: pin.sha256 } } };
    const problems = verifyRelease(readFileSync(zip), pin2, manifest, 'high').problems.join('\n');
    assert.match(problems, /assets\/fonts\/f\.woff2: the release's art-manifest\.json disagrees/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('known-bad: schema 2, a carried font that differs from its common record is refused', () => {
  const { root, zip, pin, manifest } = schema2Fixture({ fontBytes: Buffer.from('other font') });
  try {
    const problems = verifyRelease(readFileSync(zip), pin, manifest).problems.join('\n');
    assert.match(problems, /assets\/fonts\/f\.woff2: the release's file differs/);
    assert.match(problems, /assets\/fonts\/f\.woff2: the release's art-manifest\.json disagrees/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('known-bad: schema 2, --recheck reports a cached font the release listed and the cache lost', async () => {
  const { root, zip } = schema2Fixture();
  try {
    const { dir } = await fetchArt({ root, from: zip });
    rmSync(join(dir, 'assets/fonts/f.woff2'));
    await assert.rejects(fetchArt({ root, recheck: true }), (e) => {
      const problems = e.problems.join('\n');
      assert.match(problems, /assets\/fonts\/f\.woff2: missing from the cache/);
      assert.doesNotMatch(problems, /music\/title\/title\.mp3/, 'a common id the release never listed stays optional');
      return true;
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('known-bad: schema 2, a release whose manifest lists a font its zip lacks is refused', () => {
  const { root, pin, manifest } = schema2Fixture();
  try {
    const theirs = { schema: 1, count: 2, assets: { 'assets/bg/a.webp': manifest.assets['assets/bg/a.webp'], 'assets/fonts/f.woff2': { high: manifest.assets['assets/fonts/f.woff2'].common } } };
    const zip = join(root, 'short.zip');
    writeZip(zip, [{ name: 'art-manifest.json', data: Buffer.from(JSON.stringify(theirs)) }, { name: 'assets/bg/a.webp', data: Buffer.from('high-a') }]);
    const buf = readFileSync(zip);
    const problems = verifyRelease(buf, { ...pin, sha256: sha(buf) }, manifest).problems.join('\n');
    assert.match(problems, /assets\/fonts\/f\.woff2: not in the release/);
    assert.doesNotMatch(problems, /music\/title/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('under a schema-1 pin the high cache marker folds in the fonts a legacy high release can carry, not music or tiles', () => {
  const rec = (n) => ({ path: `p${n}`, bytes: n, sha256: String(n).repeat(64).slice(0, 64) });
  const pin = { sha256: 'a'.repeat(64) };
  const base = { assets: { 'assets/bg/a.webp': { high: rec(1) }, 'assets/fonts/f.woff2': { common: rec(2) }, 'music/title/title.mp3': { common: rec(3) } } };
  const mark = markerFor(pin, base);
  const withTrack = { assets: { ...base.assets, 'music/boss/boss.mp3': { common: rec(4) }, 'map-detail/x/256/0-0.webp': { common: rec(5) } } };
  assert.equal(markerFor(pin, withTrack), mark, 'a new track or tile leaves the high cache valid');
  const newFont = { assets: { ...base.assets, 'assets/fonts/f.woff2': { common: rec(6) } } };
  assert.notEqual(markerFor(pin, newFont), mark, 'a changed font re-verifies the cache');
});

test('known-bad: schema 2, a common file the release carries but its own manifest does not declare is an extra file', () => {
  const { root, pin, manifest } = schema2Fixture();
  try {
    const theirs = { schema: 1, count: 1, assets: { 'assets/bg/a.webp': manifest.assets['assets/bg/a.webp'] } };
    const zip = join(root, 'undeclared.zip');
    writeZip(zip, [{ name: 'art-manifest.json', data: Buffer.from(JSON.stringify(theirs)) },
      { name: 'assets/bg/a.webp', data: Buffer.from('high-a') }, { name: 'assets/fonts/f.woff2', data: Buffer.from('font') }]);
    const buf = readFileSync(zip);
    const problems = verifyRelease(buf, { ...pin, sha256: sha(buf) }, manifest).problems.join('\n');
    assert.match(problems, /assets\/fonts\/f\.woff2: in the release, not in art-manifest\.json/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// SCHEMA-2 PINS AND THE THREE PACKS (docs/EXTERNAL-ASSETS-PLAN.md §2, step 11).
// A throwaway tree like tests/asset-pack.test.mjs's, packed into three zips the
// way cehinds/AshenSpire-art's tools/pack.mjs packs them: each zip carries the
// manifest's header, `"pack"`, and that pack's rows only, and every file at its
// record's path.
function webp(width, height, salt = 0) {
  const buf = Buffer.alloc(40);
  buf.write('RIFF', 0, 'ascii'); buf.writeUInt32LE(32, 4); buf.write('WEBP', 8, 'ascii');
  buf.write('VP8L', 12, 'ascii'); buf.writeUInt32LE(20, 16); buf[20] = 0x2f;
  buf.writeUInt32LE(((width - 1) | ((height - 1) << 14)) >>> 0, 21);
  buf[39] = salt;
  return buf;
}
const TREE = {
  'assets/bg/a.webp': webp(1536, 1024),
  'assets-mobile/bg/a.webp': webp(614, 410),
  'assets/ui/i.svg': '<svg width="4" height="4">\n<rect/>\n</svg>\n',
  'assets-mobile/ui/i.svg': '<svg width="4" height="4">\n<rect/>\n</svg>\n',
  'assets/fonts/f-400-normal.woff2': Buffer.from('wOF2-face-one'),
  'assets-mobile/fonts/f-400-normal.woff2': Buffer.from('wOF2-face-one'),
  'asset-data/fonts/OFL.txt': 'SIL OPEN FONT LICENSE\nVersion 1.1\n',
  'music/manifest.json': '{\n  "tracks": ["title"]\n}\n',
  'music/title/title.mp3': Buffer.from('ID3-title'),
  'map-detail/abc/256/0-0.webp': webp(256, 256, 2),
};
const STEMS = { high: 'hd', light: 'light', common: 'common' };
const inPackOf = (entry, pack) => (pack === 'common' ? Boolean(entry.common) : !entry.common);

/** The zip entries pack.mjs writes for `pack`, from the tree at `root`. */
function packEntries(root, manifest, pack) {
  const sources = new Map(commonSources(root).map((c) => [c.id, c.source]));
  const rows = Object.fromEntries(Object.entries(manifest.assets).filter(([, e]) => inPackOf(e, pack)));
  const { _, schema, tiers } = manifest;
  const embedded = { _, schema, pack, tiers, count: Object.keys(rows).length, assets: rows };
  return [{ name: MANIFEST_PATH, data: Buffer.from(serialize(embedded)) },
    ...Object.entries(rows).map(([id, e]) => ({ name: e[pack].path, data: canonicalBytes(pack === 'common' ? sources.get(id) : join(root, e[pack].path)) }))];
}

function threePacks({ tamper = {} } = {}) {
  const root = tmp();
  for (const [rel, data] of Object.entries(TREE)) {
    mkdirSync(join(root, rel, '..'), { recursive: true });
    writeFileSync(join(root, rel), data);
  }
  const manifest = buildManifest(root);
  writeFileSync(join(root, MANIFEST_PATH), serialize(manifest));
  const zips = {};
  const packs = {};
  for (const pack of ['high', 'light', 'common']) {
    let entries = packEntries(root, manifest, pack);
    if (tamper[pack]) entries = tamper[pack](entries, manifest);
    const name = `${STEMS[pack]}-assets-v2.zip`;
    zips[pack] = join(root, 'dl', name);
    mkdirSync(join(root, 'dl'), { recursive: true });
    writeZip(zips[pack], entries);
    packs[pack] = { zip: name, sha256: sha(readFileSync(zips[pack])) };
  }
  const pin = { schema: 2, repo: 'cehinds/AshenSpire-art', tag: 'hd-assets-v2', zip: packs.high.zip, sha256: packs.high.sha256, packs };
  writeFileSync(join(root, PIN_PATH), JSON.stringify(pin));
  return { root, zips, pin, manifest };
}

const fetchAll = async (root, zips) => { for (const pack of ['high', 'light', 'common']) await fetchArt({ root, pack, from: zips[pack] }); };

test('schema 2: each pack is verified into .art-cache/<tag>/<pack>/, and the caches agree with the trees', async () => {
  const { root, zips } = threePacks();
  try {
    const got = {};
    for (const pack of ['high', 'light', 'common']) {
      const r = await fetchArt({ root, pack, from: zips[pack] });
      assert.match(r.dir, new RegExp(`\\.art-cache[\\\\/]hd-assets-v2[\\\\/]${pack}$`));
      got[pack] = r.count;
    }
    assert.deepEqual(got, { high: 2, light: 2, common: 5 }, 'art ids in high and light; fonts, licence, music and tiles in common');
    assert.equal(readFileSync(join(root, '.art-cache/hd-assets-v2/common/licenses/OFL.txt'), 'utf8'), TREE['asset-data/fonts/OFL.txt']);
    for (const pack of ['high', 'light', 'common']) assert.equal((await fetchArt({ root, pack, recheck: true })).reused, true);
    const { problems, checks } = agree({ root });
    assert.deepEqual(problems, []);
    assert.equal(checks, 2 * (2 + 2 + 5) + 1, 'a row and a file per id per pack, and the light tree\'s font twin');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('schema 2: asset-pack writes the same objects and indexes from the fetched cache as from the trees', async () => {
  const { root, zips } = threePacks();
  const a = join(root, 'build', 'out-trees');
  const b = join(root, 'build', 'out-cache');
  try {
    await fetchAll(root, zips);
    writePacks({ root, out: a });
    writePacks({ root, out: b, source: 'cache' });
    const files = (dir) => { const out = {}; const walk = (d) => { for (const n of readdirSync(d).sort()) { const p = join(d, n); if (lstatSync(p).isDirectory()) walk(p); else out[p.slice(dir.length)] = sha(readFileSync(p)); } }; walk(dir); return out; };
    assert.deepEqual(files(b), files(a));
    assert.deepEqual(verifyPacks(b, { manifest: JSON.parse(readFileSync(join(root, MANIFEST_PATH), 'utf8')) }), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('known-bad: asset-pack --source cache refuses a pack that was not fetched, naming the fetch', async () => {
  const { root, zips } = threePacks();
  try {
    await fetchArt({ root, pack: 'high', from: zips.high });
    const plan = planPacks(root, ['light', 'high'], { source: 'cache' });
    assert.match(plan.problems.join('\n'), /light pack of hd-assets-v2 is not fetched.*fetch-art\.mjs --pack light/);
    assert.doesNotMatch(plan.problems.join('\n'), /high pack/);
    assert.throws(() => writePacks({ root, out: join(root, 'build', 'out'), source: 'cache' }), /nothing was written/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('known-bad: --agree catches a tree that moved after the fetch, a stray cached file and an unfetched pack', async () => {
  const { root, zips } = threePacks();
  try {
    await fetchArt({ root, pack: 'light', from: zips.light });
    await fetchArt({ root, pack: 'common', from: zips.common });
    writeFileSync(join(root, 'assets-mobile/bg/a.webp'), webp(614, 410, 9));
    writeFileSync(join(root, '.art-cache/hd-assets-v2/common/music/stray.mp3'), 'stray');
    writeFileSync(join(root, 'assets-mobile/fonts/f-400-normal.woff2'), 'another face');
    writeFileSync(join(root, 'assets-mobile/ui/extra.webp'), webp(8, 8));
    const problems = agree({ root }).problems.join('\n');
    assert.match(problems, /high: .*not a verified cache of hd-assets-v2\.zip — node tools\/fetch-art\.mjs --pack high/);
    assert.match(problems, /light: assets\/bg\/a\.webp: assets-mobile\/bg\/a\.webp and the cache's assets-mobile\/bg\/a\.webp differ/);
    assert.match(problems, /light: assets\/bg\/a\.webp: the release's row differs/);
    assert.match(problems, /common: music\/stray\.mp3: in the cache, not in the trees/);
    assert.match(problems, /common: assets-mobile\/fonts\/f-400-normal\.woff2 differs from the common pack's/);
    assert.match(problems, /light: assets-mobile\/ui\/extra\.webp: in the light tree, not in the release/);
    assert.deepEqual(agree({ root, packs: 'common' }).problems.filter((p) => !p.includes('fonts')).length, 1, 'only the stray, for the common pack alone');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('known-bad: a pack zip that names another pack, carries an art id in common, or lacks a track is refused', async () => {
  const cases = [
    ['light', (e) => e.map((x) => (x.name === MANIFEST_PATH ? { ...x, data: Buffer.from(x.data.toString().replace('"pack": "light"', '"pack": "high"')) } : x)), /is for pack "high", not light/],
    ['common', (e) => e.filter((x) => x.name !== 'music/title/title.mp3'), /music\/title\/title\.mp3: not in the release/],
    ['common', (e, m) => e.map((x) => (x.name === MANIFEST_PATH ? { ...x, data: Buffer.from(x.data.toString().replace('"assets": {', `"assets": {\n    "assets/bg/a.webp": ${JSON.stringify(m.assets['assets/bg/a.webp'])},`)) } : x)), /assets\/bg\/a\.webp: the release's art-manifest\.json disagrees/],
    ['light', (e) => [...e, { name: 'assets/fonts/f-400-normal.woff2', data: Buffer.from('wOF2-face-one') }], /assets\/fonts\/f-400-normal\.woff2: in the release, not in art-manifest\.json/],
  ];
  for (const [pack, t, want] of cases) {
    const { root, zips } = threePacks({ tamper: { [pack]: t } });
    try {
      await assert.rejects(fetchArt({ root, pack, from: zips[pack] }), (e) => { assert.match(e.problems.join('\n'), want); return true; });
      assert.ok(!existsSync(join(root, '.art-cache/hd-assets-v2', pack)), 'nothing is unpacked');
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('known-bad: a schema-2 pin that is not one tag, three packs and a top level equal to high is refused', () => {
  const root = tmp();
  try {
    const h = 'a'.repeat(64);
    const good = { schema: 2, repo: 'cehinds/AshenSpire-art', tag: 'hd-assets-v2', zip: 'hd-assets-v2.zip', sha256: h,
      packs: { high: { zip: 'hd-assets-v2.zip', sha256: h }, light: { zip: 'light-assets-v2.zip', sha256: 'b'.repeat(64) }, common: { zip: 'common-assets-v2.zip', sha256: 'c'.repeat(64) } } };
    writeFileSync(join(root, PIN_PATH), JSON.stringify(good));
    assert.deepEqual(packsOf(readPin(root)), ['high', 'light', 'common']);
    assert.deepEqual(packsOf(readPin(root), 'common,light'), ['light', 'common']);
    const bad = [
      [{ sha256: 'd'.repeat(64) }, /top-level zip and sha256 must equal packs\.high/],
      [{ packs: { high: good.packs.high, light: good.packs.light } }, /must name exactly high, light, common/],
      [{ packs: { ...good.packs, light: { zip: 'light-assets-v1.zip', sha256: 'b'.repeat(64) } } }, /packs\.light\.zip must be light-assets-v2\.zip/],
      [{ packs: { ...good.packs, common: { zip: 'common-assets-v2.zip', sha256: 'XYZ' } } }, /packs\.common\.sha256 must be/],
      [{ schema: 3 }, /schema must be 1 or 2/],
      [{ schema: undefined }, /"packs" needs "schema": 2/],
    ];
    for (const [change, want] of bad) {
      writeFileSync(join(root, PIN_PATH), JSON.stringify({ ...good, ...change }));
      assert.throws(() => readPin(root), want);
    }
    writeFileSync(join(root, PIN_PATH), JSON.stringify({ repo: good.repo, tag: 'hd-assets-v1', zip: 'hd-assets-v1.zip', sha256: h }));
    assert.deepEqual(packsOf(readPin(root)), ['high'], 'a schema-1 pin is the high zip alone');
    assert.throws(() => packsOf(readPin(root), 'light'), /pins no light zip/);
    assert.throws(() => packsOf(readPin(root), 'medium'), /unknown pack "medium"/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('--from finds its pack by the zip name, else by its sha256', () => {
  const { root, zips, pin } = threePacks();
  try {
    const p = readPin(root);
    assert.equal(packOfZip(p, zips.light), 'light');
    const renamed = join(root, 'dl', 'downloaded.zip');
    writeFileSync(renamed, readFileSync(zips.common));
    assert.equal(packOfZip(p, renamed), 'common');
    writeFileSync(renamed, 'not a release');
    assert.throws(() => packOfZip(p, renamed), /none of the zips art-release\.json pins.*--pack/);
    assert.equal(pin.packs.high.zip, 'hd-assets-v2.zip');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('every refusal a download can meet names its cause and what to do', () => {
  const pin = { repo: 'cehinds/AshenSpire-art', tag: 'hd-assets-v2' };
  const res = (status, headers = {}) => ({ status, statusText: '', headers: new Headers(headers) });
  const ctx = { pin, zip: 'light-assets-v2.zip', url: 'https://github.com/x' };
  assert.match(httpCause(res(404), { ...ctx, tokenName: null }), /no token was set.*private.*ART_REPO_TOKEN.*step's env/);
  assert.match(httpCause(res(404), { ...ctx, tokenName: 'ART_REPO_TOKEN' }), /cannot read the repository/);
  assert.match(httpCause(res(401), { ...ctx, tokenName: 'ART_REPO_TOKEN' }), /refused the token in ART_REPO_TOKEN/);
  assert.match(httpCause(res(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000000' }), { ...ctx, tokenName: null }), /rate limit is spent \(it resets at 2027-.*Set ART_REPO_TOKEN or GITHUB_TOKEN/);
  assert.match(httpCause(res(403), { ...ctx, tokenName: 'GITHUB_TOKEN' }), /GITHUB_TOKEN may not read/);
  assert.match(httpCause(res(502), { ...ctx, tokenName: null }), /server error/);
  assert.match(netCause(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } }), 'https://github.com/x'), /could not reach github\.com: ENOTFOUND/);
  assert.match(netCause(Object.assign(new Error('timed out'), { name: 'TimeoutError' }), 'https://github.com/x'), /no answer from github\.com in time/);
});

// Review of #1450 (Copilot): four holes, each now a known-bad.
const rewriteManifest = (fn) => (e) => e.map((x) => (x.name === MANIFEST_PATH ? { ...x, data: Buffer.from(fn(x.data.toString())) } : x));

test('known-bad: under a schema-2 pin the high zip must name its pack; only a schema-1 pin may omit it', async () => {
  const { root, zips } = threePacks({ tamper: { high: rewriteManifest((t) => t.replace('  "pack": "high",\n', '')) } });
  try {
    assert.doesNotMatch(readZip(readFileSync(zips.high)).find((e) => e.name === MANIFEST_PATH).data.toString(), /"pack"/, 'the plant removed the field');
    await assert.rejects(fetchArt({ root, pack: 'high', from: zips.high }), (e) => { assert.match(e.problems.join('\n'), /is for pack null, not high/); return true; });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('known-bad: --recheck under a schema-2 pin refuses a cached high manifest that lost its pack', async () => {
  const { root, zips } = threePacks();
  try {
    const { dir } = await fetchArt({ root, pack: 'high', from: zips.high });
    const file = join(dir, MANIFEST_PATH);
    writeFileSync(file, readFileSync(file, 'utf8').replace('  "pack": "high",\n', ''));
    await assert.rejects(fetchArt({ root, pack: 'high', recheck: true }), (e) => { assert.match(e.problems.join('\n'), /the cached art-manifest\.json is for pack null, not high/); return true; });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('known-bad: an embedded or cached manifest that parses to something other than an object is refused', async () => {
  for (const text of ['null', '[]', '42', '"x"', '{"assets":[]}', '{"assets":null}']) {
    const { root, zips } = threePacks({ tamper: { light: rewriteManifest(() => text) } });
    try {
      await assert.rejects(fetchArt({ root, pack: 'light', from: zips.light }), (e) => { assert.match(e.problems.join('\n'), /the release's art-manifest\.json (is not a JSON object|has an "assets" that is not an object)/, text); return true; });
    } finally { rmSync(root, { recursive: true, force: true }); }
    const ok = threePacks();
    try {
      const { dir } = await fetchArt({ root: ok.root, pack: 'common', from: ok.zips.common });
      writeFileSync(join(dir, MANIFEST_PATH), text);
      await assert.rejects(fetchArt({ root: ok.root, pack: 'common', recheck: true }), (e) => { assert.match(e.problems.join('\n'), /the cached art-manifest\.json (is not a JSON object|has an "assets" that is not an object)/, text); return true; });
    } finally { rmSync(ok.root, { recursive: true, force: true }); }
  }
});

test('known-bad: the light pack\'s manifest may not list a common id, even with the right bytes', async () => {
  const { root, zips } = threePacks({ tamper: { light: (e, m) => rewriteManifest((t) => t.replace('"assets": {', `"assets": {\n    "assets/fonts/f-400-normal.woff2": ${JSON.stringify(m.assets['assets/fonts/f-400-normal.woff2'])},`))(e) } });
  try {
    await assert.rejects(fetchArt({ root, pack: 'light', from: zips.light }), (e) => { assert.match(e.problems.join('\n'), /assets\/fonts\/f-400-normal\.woff2: the release's art-manifest\.json disagrees/); return true; });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('an anonymous 403 that is not the rate limit says to set a token or check the repository is public', () => {
  const msg = httpCause({ status: 403, statusText: '', headers: new Headers() }, { pin: { repo: 'cehinds/AshenSpire-art', tag: 'hd-assets-v2' }, zip: 'hd-assets-v2.zip', url: 'https://github.com/x', tokenName: null });
  assert.doesNotMatch(msg, /null/);
  assert.match(msg, /no token.*Set ART_REPO_TOKEN.*or check that the repository is public/);
});

// THE DOWNLOAD ITSELF, against a stub of GitHub (a local http server). A
// private release is reachable only through the API: the release by its tag,
// the asset by its id with `accept: application/octet-stream`, then a 302 to
// storage that must be fetched WITHOUT the token. With no token, the public
// release URL. And a 404 is told apart: token blind to the repo, or no release.
async function withGitHub(fn, { repoVisible = true, release = true, publicRepo = true, storage = 200 } = {}) {
  const zip = Buffer.from('the zip bytes');
  const seen = [];
  const server = createServer((req, res) => {
    seen.push({ url: req.url, auth: req.headers.authorization || null, accept: req.headers.accept || null });
    const send = (status, body, headers = {}) => { res.writeHead(status, headers); res.end(body); };
    const authed = req.headers.authorization === 'Bearer t0ken';
    if (req.url === '/repos/cehinds/AshenSpire-art') return send(authed && repoVisible ? 200 : 404, '{}');
    if (req.url === '/repos/cehinds/AshenSpire-art/releases/tags/hd-assets-v2') {
      if (!authed || !repoVisible || !release) return send(404, '{"message":"Not Found"}');
      return send(200, JSON.stringify({ assets: [{ id: 7, name: 'light-assets-v2.zip' }] }), { 'content-type': 'application/json' });
    }
    if (req.url === '/repos/cehinds/AshenSpire-art/releases/assets/7') {
      if (!authed || req.headers.accept !== 'application/octet-stream') return send(404, '');
      return send(302, '', { location: `http://127.0.0.1:${server.address().port}/storage/signed?x=1` });
    }
    if (req.url === '/storage/signed?x=1') return req.headers.authorization ? send(400, 'auth sent to storage') : storage === 200 ? send(200, zip) : send(storage, 'denied');
    if (req.url === '/web/cehinds/AshenSpire-art/releases/download/hd-assets-v2/light-assets-v2.zip') return publicRepo ? send(200, zip) : send(404, '');
    return send(404, '');
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { return await fn({ api: base, web: `${base}/web`, seen, zip }); } finally { server.close(); }
}
const PIN2 = { repo: 'cehinds/AshenSpire-art', tag: 'hd-assets-v2', packs: { light: { zip: 'light-assets-v2.zip' } } };

test('with a token, a private release comes through the API and the storage hop carries no token', async () => {
  await withGitHub(async ({ api, web, seen, zip }) => {
    const got = await download(PIN2, 'light', { api, web, env: { ART_REPO_TOKEN: 't0ken' } });
    assert.deepEqual(got, zip);
    assert.deepEqual(seen.map((r) => r.url), ['/repos/cehinds/AshenSpire-art/releases/tags/hd-assets-v2', '/repos/cehinds/AshenSpire-art/releases/assets/7', '/storage/signed?x=1']);
    assert.equal(seen[1].accept, 'application/octet-stream');
    assert.equal(seen[1].auth, 'Bearer t0ken');
    assert.equal(seen[2].auth, null, 'the token never reaches storage');
  });
});

test('with no token, the public release URL is used and nothing is sent to the API', async () => {
  await withGitHub(async ({ api, web, seen, zip }) => {
    assert.deepEqual(await download(PIN2, 'light', { api, web, env: {} }), zip);
    assert.deepEqual(seen.map((r) => [r.url, r.auth]), [['/web/cehinds/AshenSpire-art/releases/download/hd-assets-v2/light-assets-v2.zip', null]]);
  });
});

test('known-bad: a 404 says whether the token cannot see the repository or the release is missing', async () => {
  await withGitHub(async ({ api, web }) => {
    await assert.rejects(download(PIN2, 'light', { api, web, env: { ART_REPO_TOKEN: 't0ken' } }), /token in ART_REPO_TOKEN cannot see cehinds\/AshenSpire-art at all.*read access.*or make the repository public/);
  }, { repoVisible: false, publicRepo: false });
  await withGitHub(async ({ api, web }) => {
    await assert.rejects(download(PIN2, 'light', { api, web, env: { ART_REPO_TOKEN: 't0ken' } }), /can read cehinds\/AshenSpire-art, but it has no published release tagged hd-assets-v2/);
  }, { release: false });
  await withGitHub(async ({ api, web }) => {
    await assert.rejects(download(PIN2, 'light', { api, web, env: { ART_REPO_TOKEN: 'wrong' } }), /token in ART_REPO_TOKEN cannot see/, 'a refused token with a private repo keeps the token\'s diagnosis');
  }, { publicRepo: false });
  await withGitHub(async ({ api, web }) => {
    await assert.rejects(download({ ...PIN2, tag: 'hd-assets-v9' }, 'light', { api, web, env: {} }), /HTTP 404 at .*no token was set/);
  });
});

test('once the repository is public, a token that cannot read it does not stop the fetch: the public URL serves it, with a warning', async () => {
  await withGitHub(async ({ api, web, zip, seen }) => {
    const warnings = [];
    const got = await download(PIN2, 'light', { api, web, env: { ART_REPO_TOKEN: 't0ken' }, warn: (m) => warnings.push(m) });
    assert.deepEqual(got, zip);
    assert.match(warnings.join('\n'), /could not read cehinds\/AshenSpire-art.*public release URL served it.*fix or remove ART_REPO_TOKEN/);
    assert.equal(seen.at(-1).auth, null, 'the public URL is fetched with no token');
  }, { repoVisible: false, publicRepo: true });
});

test('known-bad: a storage hop that fails is named as the storage URL, not blamed on the token', async () => {
  await withGitHub(async ({ api, web }) => {
    await assert.rejects(download(PIN2, 'light', { api, web, env: { ART_REPO_TOKEN: 't0ken' }, warn: () => {} }), (e) => {
      assert.match(e.message, /the release's storage URL answered HTTP 403 \(the token is not sent there\); run again/);
      assert.doesNotMatch(e.message, /token in ART_REPO_TOKEN/);
      return true;
    });
  }, { storage: 403, publicRepo: false });
});

// Independent review 5395850998 of #1450: the layers a --from or pin-bump
// mistake would rely on, each now a known-bad.

/** A zip whose one entry is named `name`: written under a same-length safe name, then renamed in place. */
function zipNamed(name, data = Buffer.from('x')) {
  const dir = tmp();
  try {
    const safe = 'a'.repeat(name.length);
    const file = join(dir, 'z.zip');
    writeZip(file, [{ name: safe, data }]);
    const buf = readFileSync(file);
    const from = Buffer.from(safe);
    let at = buf.indexOf(from);
    let n = 0;
    while (at >= 0) { Buffer.from(name).copy(buf, at); n += 1; at = buf.indexOf(from, at + 1); }
    assert.equal(n, 2, 'the name sits in the local header and the central directory');
    return buf;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('known-bad: the zip reader refuses an entry that climbs out with ../, and so does a pinned release that carries one', () => {
  const buf = zipNamed('../x');
  assert.throws(() => readZip(buf), /refusing entry name "\.\.\/x"/);
  assert.throws(() => readZip(zipNamed('a/../../x')), /refusing entry name/);
  assert.throws(() => readZip(zipNamed('/abs')), /refusing entry name/);
  const { root, pin, manifest } = fixture();
  try {
    const problems = verifyRelease(buf, { ...pin, sha256: sha(buf) }, manifest).problems.join('\n');
    assert.match(problems, /refusing entry name "\.\.\/x"/);
    assert.equal(existsSync(join(root, '.art-cache')), false, 'nothing was unpacked');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('known-bad: unpack refuses an entry that escapes the cache, and publishes nothing', () => {
  const root = tmp();
  try {
    const dir = join(root, '.art-cache', 'hd-assets-v2', 'high');
    for (const name of ['../x', '../../escaped', 'ok/../../../escaped']) {
      assert.throws(() => unpack(new Map([['fine.txt', Buffer.from('a')], [name, Buffer.from('b')]]), dir, 'mark'), /escapes the cache directory/, name);
      assert.equal(existsSync(dir), false, `${name}: no cache was published`);
    }
    assert.equal(existsSync(join(root, '.art-cache', 'hd-assets-v2', 'x')), false);
    assert.equal(existsSync(join(root, '.art-cache', 'escaped')), false);
    assert.deepEqual(readdirSync(join(root, '.art-cache', 'hd-assets-v2')), [], 'no staging directory is left behind');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('known-bad: asset-pack --source cache refuses a manifest path that escapes the verified cache', async () => {
  const { root, zips, pin } = threePacks();
  try {
    await fetchArt({ root, pack: 'light', from: zips.light });
    const manifest = JSON.parse(readFileSync(join(root, MANIFEST_PATH), 'utf8'));
    const id = 'assets/bg/a.webp';
    const rec = manifest.assets[id].light;
    // The escaping path points at a real file with the record's bytes, so only
    // the containment check stands between it and the pack.
    const outside = join(root, '.art-cache', 'outside.webp');
    writeFileSync(outside, readFileSync(join(packDirFor(pin, 'light', root), rec.path)));
    manifest.assets[id].light = { ...rec, path: '../../outside.webp' };
    writeFileSync(join(root, MANIFEST_PATH), JSON.stringify(manifest));
    // Re-mark the cache against the edited manifest, so verifiedPackDir admits it.
    writeFileSync(join(packDirFor(pin, 'light', root), '.verified'), `${markerFor(pin, manifest, 'light')}\n`);
    const plan = planPacks(root, ['light'], { source: 'cache' });
    assert.match(plan.problems.join('\n'), /assets\/bg\/a\.webp: its light path \.\.\/\.\.\/outside\.webp escapes the cache/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('under a schema-2 pin the high cache marker leaves out the font rows: a font change does not re-download the high pack', () => {
  const rec = (n) => ({ path: `p${n}`, bytes: n, sha256: String(n).repeat(64).slice(0, 64) });
  const pin = { schema: 2, sha256: 'a'.repeat(64), zip: 'hd-assets-v2.zip', packs: { high: { zip: 'hd-assets-v2.zip', sha256: 'a'.repeat(64) }, light: { zip: 'light-assets-v2.zip', sha256: 'b'.repeat(64) }, common: { zip: 'common-assets-v2.zip', sha256: 'c'.repeat(64) } } };
  const base = { assets: { 'assets/bg/a.webp': { high: rec(1) }, 'assets/fonts/f.woff2': { common: rec(2) } } };
  const mark = markerFor(pin, base, 'high');
  const newFont = { assets: { ...base.assets, 'assets/fonts/f.woff2': { common: rec(6) }, 'assets/fonts/g.woff2': { common: rec(7) } } };
  assert.equal(markerFor(pin, newFont, 'high'), mark, 'a changed or added font leaves the schema-2 high cache valid');
  assert.notEqual(markerFor(pin, newFont, 'common'), markerFor(pin, base, 'common'), 'the common cache still re-verifies');
  const newArt = { assets: { ...base.assets, 'assets/bg/a.webp': { high: rec(8) } } };
  assert.notEqual(markerFor(pin, newArt, 'high'), mark, 'a changed high record still re-verifies the high cache');
  const legacy = { sha256: 'a'.repeat(64) };
  assert.notEqual(markerFor(legacy, newFont), markerFor(legacy, base), 'a schema-1 pin still folds the fonts in');
});

test('every ART_REPO_TOKEN a workflow passes is gated on a protected ref', () => {
  const dir = fileURLToPath(new URL('../.github/workflows/', import.meta.url));
  const GATE = `contains(fromJSON('["refs/heads/dev","refs/heads/test","refs/heads/release","refs/heads/main"]'), github.ref) && secrets.ART_REPO_TOKEN || '' }}`;
  let lines = 0;
  for (const name of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n)).sort()) {
    const text = readFileSync(join(dir, name), 'utf8');
    text.split('\n').forEach((line, i) => {
      if (/^\s*#/.test(line) || !line.includes('secrets.ART_REPO_TOKEN')) return;
      lines += 1;
      assert.match(line, /^\s*ART_REPO_TOKEN: \$\{\{ /, `${name}:${i + 1}: the secret is passed only as the ART_REPO_TOKEN env`);
      assert.ok(line.trimEnd().endsWith(GATE), `${name}:${i + 1}: ART_REPO_TOKEN must be gated on a protected ref:\n${line.trim()}`);
    });
  }
  assert.ok(lines >= 4, `the four fetching workflows pass the token (found ${lines})`);
});
