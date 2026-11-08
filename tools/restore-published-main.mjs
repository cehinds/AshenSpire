#!/usr/bin/env node
// Reuse only the already-published build of the exact main commit. This does not
// replace an art pin or rebuild main with newer assets. No match exits 3 so the
// workflow still runs its original strict fetch/build; corrupt matching data exits 1.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, copyFileSync, renameSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { objectPath, twinText, verifyPacks } from './asset-pack.mjs';
import { packPinOf } from './pages-store.mjs';

const SITE = 'https://cehinds.github.io/AshenSpire/';
const HASH = /^[0-9a-f]{64}$/;
const MAX_FILE = 512 * 1024 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const requireThat = (ok, message) => { if (!ok) throw new Error(message); };

export function safeRelative(path) {
  requireThat(typeof path === 'string' && /^[A-Za-z0-9._/-]+$/.test(path)
    && path.split('/').every(part => part && part !== '.' && part !== '..'), `unsafe published path: ${path}`);
  return path;
}

export function readMain(root, ref = 'origin/main') {
  requireThat(!ref.startsWith('-'), 'invalid main ref');
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const sha = git('rev-parse', '--verify', `${ref}^{commit}`).trim();
  const json = path => JSON.parse(git('show', `${sha}:${path}`));
  let hasManifest = true;
  try { git('cat-file', '-e', `${sha}:art-manifest.json`); } catch { hasManifest = false; }
  return { sha, box: json('buildordinal.json'), manifest: hasManifest ? json('art-manifest.json') : null };
}

/** Fetch only this site's paths, with no credentials or redirects. Retry transient failures three times total. */
export function siteReader(site, { fetchImpl = fetch, pause = ms => new Promise(done => setTimeout(done, ms)) } = {}) {
  const base = new URL(site);
  requireThat(base.protocol === 'https:' && !base.username && !base.password && !base.search && !base.hash
    && base.pathname.endsWith('/'), 'published site must be an HTTPS directory URL');
  if (base.pathname !== '/') safeRelative(base.pathname.slice(1, -1));
  return async (path, { missing = false, limit = 32 * 1024 * 1024 } = {}) => {
    safeRelative(path);
    const url = new URL(path, base);
    requireThat(url.origin === base.origin && url.pathname.startsWith(base.pathname), 'published URL escaped its site');
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try { response = await fetchImpl(url.href, { redirect: 'manual', signal: AbortSignal.timeout(30000) }); }
      catch (error) {
        if (attempt === 2) throw new Error(`${path}: download failed: ${error.message}`);
        await pause(250 * 2 ** attempt); continue;
      }
      requireThat(!response.url || response.url === url.href, `${path}: response changed origin or path`);
      if ([429, 500, 502, 503, 504].includes(response.status) && attempt < 2) {
        await response.body?.cancel(); await pause(250 * 2 ** attempt); continue;
      }
      if (response.status === 404 && missing) { await response.body?.cancel(); return null; }
      requireThat(response.status === 200, `${path}: HTTP ${response.status} (redirects are refused)`);
      const chunks = []; let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        requireThat(size <= limit, `${path}: exceeds expected byte limit ${limit}`);
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    }
  };
}

function expectedFile(bytes, record, label) {
  requireThat(record && HASH.test(record.sha256) && Number.isSafeInteger(record.bytes)
    && record.bytes > 0 && record.bytes <= MAX_FILE, `${label}: invalid hash/byte record`);
  if (bytes) requireThat(bytes.length === record.bytes && hash(bytes) === record.sha256, `${label}: hash or byte mismatch`);
}

function sameBox(row, box) {
  return row?.version === box.release && row.ordinal === box.ordinal && row.digest === box.digest && row.built === box.built;
}

/** Stage the existing --main-build layout only after the entire payload verifies. Existing output is never overwritten. */
export async function restorePublishedMain({ trusted, out, site = SITE, fetchImpl, pause, concurrency = 8, log = () => {} }) {
  requireThat(/^[0-9a-f]{40}$/.test(trusted.sha) && trusted.box?.digest, 'main must have a source SHA and build box');
  if (trusted.manifest?.schema !== 2) return { restored: false, reason: 'main has no schema-2 asset manifest' };
  requireThat(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 16, 'concurrency must be 1..16');
  requireThat(!existsSync(out), 'restore output already exists');
  const get = siteReader(site, { fetchImpl, pause });
  const listing = await get('builds.json', { missing: true });
  if (!listing) return { restored: false, reason: 'no published build manifest' };
  const branches = JSON.parse(listing).branches;
  requireThat(Array.isArray(branches), 'invalid published build manifest');
  const main = branches.filter(row => row.branch === 'main');
  requireThat(main.length <= 1, 'duplicate published main branch');
  if (!main.length || main[0].head !== trusted.sha) return { restored: false, reason: 'published main is a different commit' };
  requireThat(Array.isArray(main[0].builds), 'invalid published main builds');
  const matches = main[0].builds.filter(row => row.sha === trusted.sha);
  if (!matches.length) return { restored: false, reason: 'exact main build is not published' };
  requireThat(matches.length === 1, 'duplicate exact main build');
  const entry = matches[0];
  requireThat(sameBox(entry, trusted.box), 'published main build box disagrees with its commit');
  requireThat(entry.source === 'rebuild' && entry.shape === 'pack' && entry.tier === 'high'
    && entry.download?.path === 'download/AshenSpire.html', 'unsupported published main payload');
  expectedFile(null, entry, 'main page'); expectedFile(null, entry.download, 'main download');
  const prefix = `main/${entry.ordinal}/`;
  const metadata = JSON.parse(await get(prefix + 'build.json'));
  requireThat(metadata.commit === trusted.sha && sameBox(metadata, trusted.box)
    && metadata.source === entry.source && metadata.shape === entry.shape && metadata.tier === entry.tier
    && metadata.pageSha256 === entry.sha256 && metadata.pageBytes === entry.bytes
    && ['path', 'bytes', 'sha256'].every(key => metadata.download?.[key] === entry.download[key]), 'main build.json disagrees with builds.json or commit');
  const html = await get(prefix + 'index.html', { limit: entry.bytes });
  const single = await get(prefix + entry.download.path, { limit: entry.download.bytes });
  expectedFile(html, entry, 'main page'); expectedFile(single, entry.download, 'main download');
  requireThat(html.includes(trusted.box.digest) && single.includes(trusted.box.digest), 'main payload lacks its committed source digest');
  const pin = packPinOf(html);
  requireThat(pin?.schema === 1 && pin.tier === 'high'
    && Object.keys(pin.packs).sort().join(',') === 'common,high,light', 'main page must pin all three original packs');

  const files = new Map(), objects = new Map(), commonPayload = [];
  for (const [tier, record] of Object.entries(pin.packs)) {
    requireThat(HASH.test(record.sha256) && record.index === `packs/${tier}-${record.sha256.slice(0, 12)}.json`, 'unsafe or mismatched pack index');
    const bytes = await get(record.index);
    requireThat(hash(bytes) === record.sha256, `${tier}: index hash mismatch`);
    const entries = JSON.parse(bytes);
    const wanted = Object.entries(trusted.manifest.assets).filter(([, tiers]) => tiers[tier]);
    requireThat(Object.keys(entries).length === wanted.length, `${tier}: manifest coverage mismatch`);
    for (const [id, tiers] of wanted) {
      safeRelative(id);
      const expected = tiers[tier], row = entries[id];
      requireThat(Array.isArray(row) && row.length === 3 && row[0] === expected.sha256 && row[1] === expected.bytes,
        `${tier}: ${id} disagrees with main's asset manifest`);
      expectedFile(null, expected, id);
      const path = objectPath(row[0], id); safeRelative(path);
      const previous = objects.get(path);
      requireThat(!previous || previous.bytes === expected.bytes, `${path}: conflicting object sizes`);
      objects.set(path, expected);
      if (tier === 'common' && /^(?:map-detail|music)\//.test(id)) commonPayload.push([id, path]);
    }
    files.set(record.index, bytes);
    const twinPath = record.index.replace(/\.json$/, '.js'), twin = await get(twinPath);
    requireThat(twin.equals(Buffer.from(twinText('window.__ashenPack', basename(record.index, '.json'), bytes.toString()))), `${tier}: JavaScript index twin mismatch`);
    files.set(twinPath, twin);
  }
  requireThat(HASH.test(pin.fonts?.sha256) && pin.fonts.file === `packs/fonts-${pin.fonts.sha256.slice(0, 12)}.js`, 'unsafe font sidecar pin');
  const fonts = await get(pin.fonts.file);
  const match = /^__ashenFonts\("[^"]+", (".*")\);\n$/s.exec(fonts.toString());
  requireThat(match && hash(Buffer.from(JSON.parse(match[1]))) === pin.fonts.sha256, 'font sidecar hash mismatch');
  files.set(pin.fonts.file, fonts);

  const target = resolve(out); mkdirSync(dirname(target), { recursive: true });
  const stage = mkdtempSync(join(dirname(target), `.${basename(target)}-verified-`));
  const web = join(stage, 'web');
  const write = (path, bytes) => { safeRelative(path); const file = join(web, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, bytes); };
  // A failure leaves only this new staging directory, never an accepted output.
  log(`Verifying ${objects.size} objects into ${stage}`);
  for (const [path, bytes] of files) write(path, bytes);
  const jobs = [...objects]; let next = 0, verified = 0, failed;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (!failed && next < jobs.length) {
      const [path, expected] = jobs[next++];
      try {
        const bytes = await get(path, { limit: expected.bytes }); expectedFile(bytes, expected, path); write(path, bytes);
        if (++verified % 1000 === 0) log(`Verified ${verified}/${jobs.length} objects`);
      } catch (error) { failed ||= error; }
    }
  }));
  if (failed) throw failed;
  const problems = verifyPacks(web, { manifest: trusted.manifest });
  requireThat(!problems.length, `published pack verification failed: ${problems.slice(0, 5).join('; ')}`);
  writeFileSync(join(web, 'AshenSpire.html'), html);
  writeFileSync(join(web, 'asset-base.json'), '{"base":"./"}\n');
  writeFileSync(join(stage, 'AshenSpire.html'), single);
  for (const [id, path] of commonPayload) { mkdirSync(dirname(join(stage, id)), { recursive: true }); copyFileSync(join(web, path), join(stage, id)); }
  renameSync(stage, target);
  return { restored: true, sha: trusted.sha, stamp: `${trusted.box.release}.${trusted.box.ordinal}`, objects: verified, out: target };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), options = {};
    for (let i = 0; i < args.length; i += 2) {
      requireThat(['--out', '--site', '--main-ref'].includes(args[i]) && args[i + 1], 'usage: restore-published-main.mjs --out DIR [--site HTTPS_URL] [--main-ref origin/main]');
      options[args[i]] = args[i + 1];
    }
    requireThat(options['--out'], '--out is required');
    const result = await restorePublishedMain({ trusted: readMain(process.cwd(), options['--main-ref']), out: options['--out'], site: options['--site'] || SITE, log: console.log });
    console.log(`restore-published-main: ${JSON.stringify(result)}`);
    process.exitCode = result.restored ? 0 : 3;
  } catch (error) { console.error(`restore-published-main: FAILED — ${error.message}`); process.exitCode = 1; }
}
