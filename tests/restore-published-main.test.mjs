import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { restorePublishedMain, siteReader, safeRelative } from '../tools/restore-published-main.mjs';
import { indexText, twinText, objectPath, mimeOf } from '../tools/asset-pack.mjs';
import { publishPack, packPages, storeFindings } from '../tools/pages-store.mjs';

const site = 'https://example.test/AshenSpire/';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => Buffer.from(JSON.stringify(value));

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'published-main-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const files = new Map(), calls = [], manifest = { schema: 2, assets: {} };
  const contents = { common: { 'assets/fonts/test.woff2': 'font data', 'music/test.mp3': 'music data' },
    high: { 'assets/test.webp': 'original high art' }, light: { 'assets/test.webp': 'original light art' } };
  const pin = { schema: 1, tier: 'high', packs: {} };
  for (const [tier, rows] of Object.entries(contents)) {
    const entries = {};
    for (const [id, value] of Object.entries(rows)) {
      const bytes = Buffer.from(value), sha256 = hash(bytes);
      (manifest.assets[id] ||= {})[tier] = { sha256, bytes: bytes.length, path: id };
      entries[id] = [sha256, bytes.length, mimeOf(id)]; files.set(objectPath(sha256, id), bytes);
    }
    const text = indexText(entries), sha256 = hash(Buffer.from(text)), name = `${tier}-${sha256.slice(0, 12)}`;
    pin.packs[tier] = { index: `packs/${name}.json`, sha256 };
    files.set(`packs/${name}.json`, Buffer.from(text)); files.set(`packs/${name}.js`, Buffer.from(twinText('window.__ashenPack', name, text)));
  }
  const faces = JSON.stringify({ 'assets/fonts/test.woff2': Buffer.from('font data').toString('base64') });
  const fontHash = hash(Buffer.from(faces)); pin.fonts = { file: `packs/fonts-${fontHash.slice(0, 12)}.js`, sha256: fontHash };
  files.set(pin.fonts.file, Buffer.from(twinText('__ashenFonts', `fonts-${fontHash.slice(0, 12)}`, faces)));
  const trusted = { sha: 'a'.repeat(40), box: { release: '0.7.1', ordinal: 810, digest: '2d43fe2e34', built: '2026-10-03' }, manifest };
  const single = Buffer.from('light standalone src 2d43fe2e34');
  const entry = { branch: 'main', sha: trusted.sha, source: 'rebuild', shape: 'pack', tier: 'high', version: '0.7.1', ordinal: 810,
    digest: trusted.box.digest, built: trusted.box.built,
    download: { path: 'download/AshenSpire.html', sha256: hash(single), bytes: single.length } };
  const listing = { branches: [{ branch: 'main', head: trusted.sha, builds: [entry] }] };
  const metadata = { commit: trusted.sha };
  const refresh = () => {
    const html = Buffer.from(`<!doctype html>src 2d43fe2e34\nconst ASSET_PACKS = ${JSON.stringify(pin)};\n`);
    Object.assign(entry, { bytes: html.length, sha256: hash(html) });
    Object.assign(metadata, entry, { pageBytes: entry.bytes, pageSha256: entry.sha256 });
    files.set('main/810/index.html', html); files.set('main/810/download/AshenSpire.html', single);
    files.set('builds.json', json(listing)); files.set('main/810/build.json', json(metadata));
  };
  refresh();
  const fetchImpl = async (url, options) => {
    assert.ok(url.startsWith(site)); assert.equal(options.redirect, 'manual'); assert.equal(options.headers, undefined);
    const path = url.slice(site.length); calls.push(path);
    return new Response(files.get(path) || null, { status: files.has(path) ? 200 : 404 });
  };
  const options = { trusted, out: join(dir, 'seed'), site, fetchImpl, pause: async () => {}, concurrency: 2 };
  return { dir, files, pin, trusted, entry, listing, metadata, refresh, calls, fetchImpl, options };
}

test('exact main restores the existing Pages seed layout and passes publishPack/storeFindings', async t => {
  const f = fixture(t), result = await restorePublishedMain(f.options);
  assert.equal(result.restored, true); assert.equal(result.objects, 4);
  assert.deepEqual(readFileSync(join(f.options.out, 'AshenSpire.html')), f.files.get('main/810/download/AshenSpire.html'));
  assert.equal(readFileSync(join(f.options.out, 'music/test.mp3'), 'utf8'), 'music data');
  const published = join(f.dir, 'site');
  publishPack(published, 'main/810', readFileSync(join(f.options.out, 'web/AshenSpire.html')), join(f.options.out, 'web'));
  const findings = storeFindings(published, packPages(published, ['main']));
  assert.ok(findings.length >= 3); assert.deepEqual(findings.filter(([, ok]) => !ok), []);
});

for (const mode of ['missing listing', 'different main', 'missing exact build', 'legacy manifest']) {
  test(`${mode} requests the original rebuild without creating a seed`, async t => {
    const f = fixture(t);
    if (mode === 'missing listing') f.files.delete('builds.json');
    if (mode === 'different main') { f.listing.branches[0].head = 'b'.repeat(40); f.files.set('builds.json', json(f.listing)); }
    if (mode === 'missing exact build') { f.listing.branches[0].builds = []; f.files.set('builds.json', json(f.listing)); }
    if (mode === 'legacy manifest') f.trusted.manifest = null;
    assert.equal((await restorePublishedMain(f.options)).restored, false); assert.equal(existsSync(f.options.out), false);
  });
}

for (const [name, damage, message] of [
  ['wrong committed box', f => { f.entry.digest = 'wrong'; f.files.set('builds.json', json(f.listing)); }, /box disagrees/],
  ['wrong metadata commit', f => { f.metadata.commit = 'b'.repeat(40); f.files.set('main/810/build.json', json(f.metadata)); }, /build.json disagrees/],
  ['duplicate exact build', f => { f.listing.branches[0].builds.push(f.entry); f.files.set('builds.json', json(f.listing)); }, /duplicate exact/],
  ['corrupt HTML', f => f.files.set('main/810/index.html', Buffer.from('wrong')), /hash or byte mismatch/],
  ['corrupt download', f => f.files.set('main/810/download/AshenSpire.html', Buffer.from('wrong')), /hash or byte mismatch/],
  ['corrupt index', f => f.files.set(f.pin.packs.high.index, Buffer.from('{}')), /index hash mismatch/],
  ['corrupt JavaScript twin', f => f.files.set(f.pin.packs.high.index.replace('.json', '.js'), Buffer.from('alert(1)')), /twin mismatch/],
  ['corrupt font sidecar', f => f.files.set(f.pin.fonts.file, Buffer.from('alert(1)')), /font sidecar hash mismatch/],
  ['manifest disagrees with index', f => { f.trusted.manifest.assets['assets/test.webp'].high.sha256 = 'b'.repeat(64); }, /disagrees with main/],
  ['manifest requires a missing asset', f => { f.trusted.manifest.assets['assets/missing.webp'] = f.trusted.manifest.assets['assets/test.webp']; }, /coverage mismatch/],
  ['missing object', f => f.files.delete(objectPath(f.trusted.manifest.assets['assets/test.webp'].high.sha256, 'assets/test.webp')), /HTTP 404/],
  ['wrong object hash', f => { const p = objectPath(f.trusted.manifest.assets['assets/test.webp'].high.sha256, 'assets/test.webp'); f.files.set(p, Buffer.alloc(f.files.get(p).length)); }, /hash or byte mismatch/],
  ['oversized object', f => { const p = objectPath(f.trusted.manifest.assets['assets/test.webp'].high.sha256, 'assets/test.webp'); f.files.set(p, Buffer.alloc(f.files.get(p).length + 1)); }, /byte limit/],
  ['escaping index', f => { f.pin.packs.high.index = '../escape.json'; f.refresh(); }, /unsafe or mismatched/],
  ['foreign index origin', f => { f.pin.packs.high.index = 'https://other.test/index.json'; f.refresh(); }, /unsafe or mismatched/],
  ['escaping font path', f => { f.pin.fonts.file = '../fonts.js'; f.refresh(); }, /unsafe font/],
]) {
  test(`${name} refuses publication, rather than falling back to an unverified seed`, async t => {
    const f = fixture(t); damage(f);
    await assert.rejects(restorePublishedMain(f.options), message); assert.equal(existsSync(f.options.out), false);
  });
}

test('unsafe URL paths, credentials and redirects never escape the configured site', async () => {
  for (const path of ['../x', '/x', 'x/../y', 'x\\y', 'x//y', 'https://other.test/x', '%2e%2e/x', 'x?query']) assert.throws(() => safeRelative(path), /unsafe/);
  for (const base of ['http://example.test/', 'https://user:password@example.test/', 'https://example.test/?q=1']) assert.throws(() => siteReader(base), /HTTPS directory/);
  let calls = 0;
  const get = siteReader(site, { fetchImpl: async () => { calls++; return new Response(null, { status: 302, headers: { location: 'https://other.test/x' } }); } });
  await assert.rejects(get('builds.json'), /redirects are refused/); assert.equal(calls, 1);
  const foreign = new Response('{}'); Object.defineProperty(foreign, 'url', { value: 'https://other.test/x' });
  await assert.rejects(siteReader(site, { fetchImpl: async () => foreign })('builds.json'), /changed origin/);
});

test('a self-consistent font sidecar still has to match the committed font bytes', async t => {
  const f = fixture(t), text = JSON.stringify({ 'assets/fonts/test.woff2': Buffer.from('changed font').toString('base64') });
  const sha256 = hash(Buffer.from(text)), name = `fonts-${sha256.slice(0, 12)}`;
  f.pin.fonts = { file: `packs/${name}.js`, sha256 };
  f.files.set(f.pin.fonts.file, Buffer.from(twinText('__ashenFonts', name, text))); f.refresh();
  await assert.rejects(restorePublishedMain(f.options), /does not match its common record/);
  assert.equal(existsSync(f.options.out), false);
});

test('an index with valid original object hashes cannot change their MIME types', async t => {
  const f = fixture(t), entries = JSON.parse(f.files.get(f.pin.packs.high.index));
  entries['assets/test.webp'][2] = 'text/html';
  const text = indexText(entries), sha256 = hash(Buffer.from(text)), name = `high-${sha256.slice(0, 12)}`;
  f.pin.packs.high = { index: `packs/${name}.json`, sha256 };
  f.files.set(`packs/${name}.json`, Buffer.from(text));
  f.files.set(`packs/${name}.js`, Buffer.from(twinText('window.__ashenPack', name, text))); f.refresh();
  await assert.rejects(restorePublishedMain(f.options), /mime text\/html/);
  assert.equal(existsSync(f.options.out), false);
});

test('transient download failures retry within a bound, and permanent errors do not', async t => {
  const f = fixture(t); let attempts = 0;
  const path = objectPath(f.trusted.manifest.assets['assets/test.webp'].high.sha256, 'assets/test.webp');
  f.options.fetchImpl = async (url, options) => {
    if (url.endsWith(path) && ++attempts < 3) return new Response(null, { status: 503 });
    return f.fetchImpl(url, options);
  };
  assert.equal((await restorePublishedMain(f.options)).restored, true); assert.equal(attempts, 3);
  let failures = 0;
  await assert.rejects(siteReader(site, { pause: async () => {}, fetchImpl: async () => { failures++; return new Response(null, { status: 503 }); } })('builds.json'), /HTTP 503/);
  assert.equal(failures, 3);
});

test('an existing output is preserved, never overwritten by a restore', async t => {
  const f = fixture(t); mkdirSync(f.options.out); writeFileSync(join(f.options.out, 'mine'), 'keep');
  await assert.rejects(restorePublishedMain(f.options), /already exists/);
  assert.equal(readFileSync(join(f.options.out, 'mine'), 'utf8'), 'keep'); assert.equal(f.calls.length, 0);
});

test('Pages uses verified reuse before rebuilding and only exit 3 continues to the strict schema-2 fetch', () => {
  const workflow = readFileSync(new URL('../.github/workflows/pages-builds.yml', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
  const restore = workflow.indexOf('if node tools/restore-published-main.mjs --out "$RUNNER_TEMP/main-build"; then');
  const rebuild = workflow.indexOf('git worktree add --detach "$RUNNER_TEMP/main" origin/main');
  assert.ok(restore > 0 && rebuild > restore);
  assert.match(workflow.slice(restore, rebuild), /MAIN_BUILD_ARGS=--main-build.*\n\s+exit 0/);
  assert.match(workflow.slice(restore, rebuild), /restore_status=\$\?\n\s+if \[ "\$restore_status" -ne 3 \]; then exit "\$restore_status"; fi/);
  assert.match(workflow.slice(rebuild), /if \[ "\$PIN_MODE" = "fetch" \]; then[\s\S]*node tools\/fetch-art\.mjs --pack all/);
});
