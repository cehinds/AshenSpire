#!/usr/bin/env node
// tools/fetch-art.mjs — fetch the pinned high-res art release and check it.
//
//   node tools/fetch-art.mjs                 download the release art-release.json pins,
//                                            verify it, unpack into .art-cache/<tag>/
//   node tools/fetch-art.mjs --from <zip>    verify and unpack a zip already on disk
//   node tools/fetch-art.mjs --print-dir     print the cache directory and exit
//
// WHY (docs/ART-REPO-PLAN.md, step 4). The full-resolution art is leaving this
// repository for releases of cehinds/AshenSpire-art (private, owner 2026-09-26),
// one zip per release. This tool is the only door through which that art comes
// back in, and it lets nothing through unchecked:
//
//   1. the zip's sha256 must equal the one art-release.json pins;
//   2. every asset id art-manifest.json lists must be in the zip, with the
//      bytes and sha256 its `high` record names;
//   3. the zip may hold nothing else but its own art-manifest.json.
//
// Any mismatch exits 1 and leaves no cache behind. A cache that verified once is
// marked with the zip's sha256 and reused; --recheck hashes it again.
//
// THE TOKEN. The art repository is private, so the download needs a token with
// read access to its Contents: ART_REPO_TOKEN (CI secret of that name), else
// GITHUB_TOKEN. Without one the tool says which variable to set.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readZip } from './zip.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PIN_PATH = 'art-release.json';
export const MANIFEST_PATH = 'art-manifest.json';
export const CACHE_DIR = '.art-cache';
const VERIFIED = '.verified';

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** The pin, or an error naming what is missing. */
export function readPin(root = ROOT) {
  const pin = JSON.parse(readFileSync(join(root, PIN_PATH), 'utf8'));
  const missing = ['repo', 'tag', 'zip', 'sha256'].filter((k) => !pin[k]);
  if (missing.length) {
    throw new Error(`${PIN_PATH} pins no release yet (${missing.join(', ')} unset). The owner publishes hd-assets-v1 from cehinds/AshenSpire-art first; a PR then pins its tag, zip name and sha256 here.`);
  }
  if (!/^[0-9a-f]{64}$/.test(pin.sha256)) throw new Error(`${PIN_PATH}: sha256 must be 64 lowercase hex characters`);
  return pin;
}

export const cacheDirFor = (pin, root = ROOT) => join(root, CACHE_DIR, pin.tag);

/**
 * verifyRelease(zipBuf, pin, manifest) → { problems, entries }. The checks the
 * header lists; `entries` is the zip's content (name → Buffer) when it read.
 */
export function verifyRelease(zipBuf, pin, manifest) {
  const problems = [];
  const got = sha256(zipBuf);
  if (got !== pin.sha256) return { problems: [`the zip's sha256 is ${got}, ${PIN_PATH} pins ${pin.sha256}`], entries: null };
  let entries;
  try { entries = new Map(readZip(zipBuf).map((e) => [e.name, e.data])); }
  catch (e) { return { problems: [e.message], entries: null }; }
  const want = manifest.assets || {};
  const paths = new Set();
  for (const [id, rec] of Object.entries(want)) {
    const high = rec && rec.high;
    if (!high) { problems.push(`${id}: ${MANIFEST_PATH} has no high record`); continue; }
    paths.add(high.path);
    const data = entries.get(high.path);
    if (!data) { problems.push(`${id}: not in the release`); continue; }
    if (data.length !== high.bytes || sha256(data) !== high.sha256) problems.push(`${id}: the release's file differs from ${MANIFEST_PATH}`);
  }
  for (const name of entries.keys()) {
    if (name !== MANIFEST_PATH && !paths.has(name)) problems.push(`${name}: in the release, not in ${MANIFEST_PATH}`);
  }
  return { problems, entries };
}

/** unpack(entries, dir, zipSha) — write every entry under dir, then the verified marker last. */
function unpack(entries, dir, zipSha) {
  rmSync(dir, { recursive: true, force: true });
  for (const [name, data] of entries) {
    const target = resolve(dir, name);
    if (!target.startsWith(resolve(dir) + sep)) throw new Error(`${name} escapes the cache directory`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
  }
  writeFileSync(join(dir, VERIFIED), `${zipSha}\n`);
}

/** recheck(dir, manifest) → problems: every listed file on disk still matches. */
export function recheck(dir, manifest) {
  const problems = [];
  for (const [id, rec] of Object.entries(manifest.assets || {})) {
    const file = join(dir, rec.high.path);
    if (!existsSync(file)) { problems.push(`${id}: missing from the cache`); continue; }
    const buf = readFileSync(file);
    if (buf.length !== rec.high.bytes || sha256(buf) !== rec.high.sha256) problems.push(`${id}: the cached file changed`);
  }
  return problems;
}

async function download(pin) {
  const token = process.env.ART_REPO_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) throw new Error(`${pin.repo} is private: set ART_REPO_TOKEN (a token with read access to its Contents) to download ${pin.tag}.`);
  const api = `https://api.github.com/repos/${pin.repo}`;
  const headers = { authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28', 'user-agent': 'ashenspire-fetch-art' };
  const rel = await fetch(`${api}/releases/tags/${encodeURIComponent(pin.tag)}`, { headers: { ...headers, accept: 'application/vnd.github+json' } });
  if (!rel.ok) throw new Error(`release ${pin.tag} of ${pin.repo}: HTTP ${rel.status} (a 404 on a private repo also means the token cannot read it)`);
  const asset = (await rel.json()).assets?.find((a) => a.name === pin.zip);
  if (!asset) throw new Error(`release ${pin.tag} has no asset named ${pin.zip}`);
  const res = await fetch(`${api}/releases/assets/${asset.id}`, { headers: { ...headers, accept: 'application/octet-stream' } });
  if (!res.ok) throw new Error(`downloading ${pin.zip}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** fetchArt({ root, from, recheck }) → the verified cache directory. */
export async function fetchArt({ root = ROOT, from = null, recheck: again = false } = {}) {
  const pin = readPin(root);
  const manifest = JSON.parse(readFileSync(join(root, MANIFEST_PATH), 'utf8'));
  const dir = cacheDirFor(pin, root);
  const marker = join(dir, VERIFIED);
  if (!from && existsSync(marker) && readFileSync(marker, 'utf8').trim() === pin.sha256) {
    if (!again) return { dir, reused: true };
    const problems = recheck(dir, manifest);
    if (!problems.length) return { dir, reused: true };
    rmSync(dir, { recursive: true, force: true });
    throw Object.assign(new Error('the cache no longer matches the manifest; it was removed — run again to re-download'), { problems });
  }
  const zipBuf = from ? readFileSync(from) : await download(pin);
  const { problems, entries } = verifyRelease(zipBuf, pin, manifest);
  if (problems.length) throw Object.assign(new Error(`${pin.tag} failed verification`), { problems });
  unpack(entries, dir, pin.sha256);
  return { dir, reused: false, count: entries.size - (entries.has(MANIFEST_PATH) ? 1 : 0) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  try {
    if (args.includes('--print-dir')) {
      console.log(relative(process.cwd(), cacheDirFor(readPin())) || '.');
    } else {
      const at = args.indexOf('--from');
      const r = await fetchArt({ from: at >= 0 ? resolve(args[at + 1] || '') : null, recheck: args.includes('--recheck') });
      const rel = relative(ROOT, r.dir);
      console.log(r.reused ? `fetch-art: OK — ${rel} already verified` : `fetch-art: OK — ${r.count} assets verified into ${rel}`);
    }
  } catch (e) {
    console.error(`fetch-art: FAIL — ${e.message}`);
    for (const p of (e.problems || []).slice(0, 20)) console.error(`  · ${p}`);
    if ((e.problems || []).length > 20) console.error(`  … and ${e.problems.length - 20} more`);
    process.exit(1);
  }
}
