// tools/pages-store.mjs — the Pages object store and the pages that read it
// (docs/EXTERNAL-ASSETS-PLAN.md §4 "GitHub Pages", step 6b).
//
// Every pack-shaped build on the site shares ONE store at the site root:
//
//   /AshenSpire/objects/<xx>/<sha256>.<ext>    each file once, named by its bytes
//   /AshenSpire/packs/<pack>-<digest12>.json   each index (and its .js twin, and the font sidecar)
//
// so a file used by twenty builds on four branches is stored once. Each page
// that serves a pack-shaped HTML gets an `asset-base.json` beside it naming
// the site root relative to itself ({"base":"../../"} for /<branch>/<ordinal>/,
// {"base":"../"} for /build/ and /dist/, {"base":"./"} at the root).
//
// tools/pages-site.mjs publishes through publishPack() and proves the result
// with storeFindings(); tools/pages-offline.mjs builds its local site with
// the same functions, so the browser check serves the shape Pages serves.

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { OBJECTS_DIR, PACKS_DIR, objectPath } from './asset-pack.mjs';
import { SW_FILE, serviceWorkerSource } from './pages-sw.mjs';

export const ASSET_BASE_FILE = 'asset-base.json';

// The pin tools/bundle.mjs stamps into a pack-shaped HTML (tools/browser.mjs
// isPackShaped and verify-external read the same shape).
const PACK_PIN = /const ASSET_PACKS = (\{.*?\});\n/;

/** The ASSET_PACKS pin a pack-shaped HTML carries, or null (a single file, or no pin). */
export function packPinOf(html) {
  const m = PACK_PIN.exec(Buffer.isBuffer(html) ? html.toString('utf8') : String(html));
  if (!m) return null;
  try {
    const pin = JSON.parse(m[1]);
    return pin && pin.packs && typeof pin.packs === 'object' && Object.keys(pin.packs).length ? pin : null;
  } catch { return null; }
}

/** The base a page in folder `relDir` (site-relative, '' for the root) uses to reach the root. */
export function assetBaseFor(relDir) {
  const depth = String(relDir || '').split('/').filter(Boolean).length;
  return depth ? '../'.repeat(depth) : './';
}

/** The asset-base.json text for a page in `relDir`. */
export function assetBaseText(relDir) {
  return `${JSON.stringify({ base: assetBaseFor(relDir) })}\n`;
}

/** Every file a pin names in packs/: each index, its .js twin, and the font sidecar. */
export function pinnedPackFiles(pin) {
  const out = [];
  for (const p of Object.values(pin?.packs || {})) {
    if (typeof p?.index !== 'string') continue;
    out.push(p.index);
    out.push(p.index.replace(/\.json$/, '.js'));
  }
  if (typeof pin?.fonts?.file === 'string') out.push(pin.fonts.file);
  return [...new Set(out)];
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/**
 * The font sidecar is pinned by its TEXT, the string inside
 * `__ashenFonts("<id>", "<text>");` (as tools/verify-external.mjs reads it), not
 * by the file's bytes. The sha256 of that string, or null.
 */
function sidecarHash(abs) {
  const m = /^__ashenFonts\("[^"]+", (".*")\);\n$/s.exec(readFileSync(abs, 'utf8'));
  try {
    const inner = m ? JSON.parse(m[1]) : null;
    return typeof inner === 'string' ? sha256(Buffer.from(inner, 'utf8')) : null;
  } catch { return null; }
}

/**
 * Put one pack-shaped build into the site: `html` at `<relDir>/<name>`, an
 * asset-base.json beside it, and every file its pin names merged into the
 * shared store from `from` (a folder holding packs/ and objects/, as
 * bundle.mjs --external-art writes). Only what the pin names is copied, so a
 * stale object left beside the build is never published. A store file that is
 * already there is kept when its bytes agree and is an error when they do not
 * (a packs/ name is a 12-hex digest; an object name is the whole sha256).
 * Returns { pin, objects, added } — objects listed, objects newly stored.
 */
export function publishPack(siteDir, relDir, html, from, { name = 'index.html' } = {}) {
  // `from` is one folder holding packs/ and objects/, or { packs, objects }
  // naming the folder that holds each (a rebuild stages its objects in one
  // store shared by every rebuild of the run).
  const packsRoot = typeof from === 'string' ? from : from.packs;
  const objectsRoot = typeof from === 'string' ? from : from.objects;
  const where = `${relDir ? `${relDir}/` : ''}${name}`;
  const pin = packPinOf(html);
  if (!pin) throw refused(`${where}: not a pack-shaped HTML (no ASSET_PACKS pin)`);
  // EVERYTHING IS CHECKED BEFORE ANYTHING IS WRITTEN (review of #1456): a build
  // the store cannot take is refused whole, by name, and leaves the site as it
  // was, so the caller skips that one build instead of the whole publication.
  const packFiles = pinnedPackFiles(pin);
  // The font sidecar is only ever packs/fonts-<digest12>.js (tools/asset-pack.mjs),
  // the name the file:// loader and the in-game zip ask for; a pin naming any
  // other is refused here rather than published where nothing can read it (Codex, #1480).
  if (pin.fonts?.file !== undefined && !SIDECAR_FILE.test(String(pin.fonts.file))) throw refused(`${where}: its pin names the font sidecar ${JSON.stringify(pin.fonts.file)}, which is not a packs/fonts-<digest12>.js file`);
  if (pin.fonts?.file !== undefined && !OBJECT_SHA.test(String(pin.fonts.sha256))) throw refused(`${where}: its pin gives the font sidecar ${JSON.stringify(pin.fonts.sha256)} as its sha256, which is not 64 lowercase hex`);
  for (const file of packFiles) {
    if (!PIN_FILE.test(file)) throw refused(`${where}: its pin names ${JSON.stringify(file)}, which is not a packs/<pack>-<digest12>.json|js file`);
    const src = join(packsRoot, file);
    if (!existsSync(src)) throw refused(`${where}: its pin names ${file}, and the build has none`);
    const dest = join(siteDir, file);
    if (existsSync(dest) && Buffer.compare(readFileSync(dest), readFileSync(src)) !== 0) {
      throw refused(`${where}: the store already holds a different ${file} (a newer build published it first; two builds disagree about one name)`);
    }
  }
  const wanted = [];
  for (const p of Object.values(pin.packs)) {
    const entries = JSON.parse(readFileSync(join(packsRoot, p.index), 'utf8'));
    for (const [id, row] of Object.entries(entries)) {
      if (!Array.isArray(row) || !OBJECT_SHA.test(String(row[0]))) throw refused(`${where}: ${p.index} lists ${JSON.stringify(id)} with no sha256 name`);
      const rel = objectPath(row[0], id);
      if (!OBJECT_FILE.test(rel)) throw refused(`${where}: ${p.index} lists ${JSON.stringify(id)} at ${rel}, outside objects/`);
      const src = join(objectsRoot, rel);
      if (!existsSync(join(siteDir, rel)) && !existsSync(src)) throw refused(`${where}: ${p.index} lists ${id} (${rel}), and the build has no such object`);
      wanted.push([rel, src]);
    }
  }
  const dir = join(siteDir, relDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), html);
  writeFileSync(join(dir, ASSET_BASE_FILE), assetBaseText(relDir));
  for (const file of packFiles) {
    const dest = join(siteDir, file);
    if (existsSync(dest)) continue;
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(packsRoot, file), dest);
  }
  let added = 0;
  for (const [rel, src] of wanted) {
    const dest = join(siteDir, rel);
    if (existsSync(dest)) continue;
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    added++;
  }
  return { pin, objects: wanted.length, added };
}

// The names a pin and an index may use (review of #1456): nothing a pin or an
// index says can write outside packs/ and objects/.
const PIN_FILE = /^packs\/[a-z]+-[0-9a-f]{12}\.(?:json|js)$/;
const SIDECAR_FILE = /^packs\/fonts-[0-9a-f]{12}\.js$/;
const OBJECT_SHA = /^[0-9a-f]{64}$/;
const OBJECT_FILE = /^objects\/[0-9a-f]{2}\/[0-9a-f]{64}(?:\.[a-z0-9]+)?$/;
/** An error that refuses one build, not the run: `refused` is set. */
function refused(message) { return Object.assign(new Error(message), { refused: true }); }

/** Write the service worker at the site root; returns what builds.json records about it. */
export function writeServiceWorker(siteDir, { kill } = {}) {
  const text = serviceWorkerSource({ kill });
  writeFileSync(join(siteDir, SW_FILE), text);
  return { file: SW_FILE, kill: Boolean(kill), sha256: sha256(Buffer.from(text)) };
}

/**
 * The pack-shaped pages of a site: every `<branch>/<dir>/index.html` under the
 * given branch folders, and the stable links (AshenSpire.html at the root,
 * build/ and dist/) — the page kinds of §4's table. Each is { rel, dir, pin }.
 * Found by reading the HTML, not from the generator's manifest, so a page the
 * generator forgot to record is still checked.
 */
export function packPages(siteDir, branches) {
  const out = [];
  const consider = (dir, name) => {
    const file = join(siteDir, dir, name);
    if (!existsSync(file)) return;
    const pin = packPinOf(readFileSync(file));
    if (pin) out.push({ rel: dir ? `${dir}/${name}` : name, dir, pin });
  };
  for (const branch of branches) {
    const top = join(siteDir, branch);
    if (!existsSync(top)) continue;
    for (const e of readdirSync(top, { withFileTypes: true })) if (e.isDirectory()) consider(`${branch}/${e.name}`, 'index.html');
  }
  for (const dir of ['', 'build', 'dist']) consider(dir, 'AshenSpire.html');
  return out;
}

/**
 * The store's proof, as [text, ok] rows (the plan's two new --check rows, and
 * the store's own hygiene):
 *   · every pack-shaped page has an asset-base.json whose base resolves each
 *     index its pin names, hashing to the pin (and the font sidecar);
 *   · every object a served index lists is present and hashes to its name;
 *   · no object, and no file in packs/, is unreferenced by a served page.
 * `hashCache` (path → sha256) lets one run hash each object once.
 */
export function storeFindings(siteDir, pages, { hashCache = new Map() } = {}) {
  const rows = [];
  const hashOf = (abs) => {
    if (!hashCache.has(abs)) hashCache.set(abs, sha256(readFileSync(abs)));
    return hashCache.get(abs);
  };
  const servedIndexes = new Map();   // site-relative index path → pinned sha256
  const servedPackFiles = new Set();
  let indexesMissing = 0;
  for (const page of pages) {
    // What the page's pin names is referenced whether or not the page can
    // reach it: an unreachable index is this page's red, not the store's.
    for (const f of pinnedPackFiles(page.pin)) servedPackFiles.add(f);
    for (const p of Object.values(page.pin.packs)) {
      const abs = join(siteDir, p.index);
      if (existsSync(abs) && hashOf(abs) === p.sha256) servedIndexes.set(p.index, p.sha256);
      else indexesMissing++;
    }
    const baseFile = join(siteDir, page.dir, ASSET_BASE_FILE);
    let base = null;
    try { base = JSON.parse(readFileSync(baseFile, 'utf8')).base; } catch { base = null; }
    if (typeof base !== 'string' || !/^(?:\.\.?\/)*$/.test(base)) {
      rows.push([`MISSING ${page.dir ? `${page.dir}/` : ''}${ASSET_BASE_FILE}: the pack-shaped page ${page.rel} has no asset-base.json naming the site root`, false]);
      continue;
    }
    const root = posix.normalize(posix.join(page.dir || '.', base)).replace(/\/+$/, '') || '.';
    if (root !== '.') {
      rows.push([`WRONG BASE ${page.rel}: asset-base.json says ${JSON.stringify(base)}, which resolves to ${root}/, not the site root`, false]);
      continue;
    }
    const wanted = [...Object.entries(page.pin.packs).map(([pack, p]) => [pack, p.index, p.sha256]),
      ...(page.pin.fonts?.file ? [['fonts', page.pin.fonts.file, page.pin.fonts.sha256]] : [])];
    const missing = [];
    for (const [pack, file, want] of wanted) {
      const abs = join(siteDir, file);
      if (!existsSync(abs)) { missing.push(`${pack} ${file} is not in the store`); continue; }
      if ((pack === 'fonts' ? sidecarHash(abs) : hashOf(abs)) !== want) { missing.push(`${pack} ${file} does not hash to its pin`); continue; }
    }
    rows.push([missing.length
      ? `MISSING INDEX for ${page.rel}: ${missing.join('; ')}`
      : `${page.rel}: asset-base.json ${JSON.stringify(base)} resolves its ${wanted.length} pinned file(s)`, missing.length === 0]);
  }
  // Every object every served index lists.
  const listed = new Set();
  let bad = [];
  for (const [file] of servedIndexes) {
    const entries = JSON.parse(readFileSync(join(siteDir, file), 'utf8'));
    for (const [id, row] of Object.entries(entries)) {
      const rel = objectPath(row[0], id);
      if (listed.has(rel)) continue;
      listed.add(rel);
      const abs = join(siteDir, rel);
      if (!existsSync(abs)) bad.push(`${rel} (${id}, listed by ${file}) is missing`);
      else if (hashOf(abs) !== row[0]) bad.push(`${rel} (${id}) does not hash to its name`);
    }
  }
  rows.push([bad.length ? `MISSING OBJECT: ${bad.length} object(s) a served index lists are absent or wrong, e.g. ${bad.slice(0, 3).join('; ')}`
    : `every object the ${servedIndexes.size} served index(es) list is in the store with its hash (${listed.size} objects)`, bad.length === 0]);
  // Nothing in the store that no served page reads. Not judged while a pinned
  // index is missing (that page is already red, and the objects only it lists
  // cannot be told apart from strays).
  if (indexesMissing) return rows;
  const strays = [];
  const objectsDir = join(siteDir, OBJECTS_DIR);
  if (existsSync(objectsDir)) {
    for (const sub of readdirSync(objectsDir, { withFileTypes: true })) {
      if (!sub.isDirectory()) { strays.push(`${OBJECTS_DIR}/${sub.name}`); continue; }
      for (const f of readdirSync(join(objectsDir, sub.name))) {
        const rel = `${OBJECTS_DIR}/${sub.name}/${f}`;
        if (!listed.has(rel)) strays.push(rel);
      }
    }
  }
  const packsDir = join(siteDir, PACKS_DIR);
  if (existsSync(packsDir)) for (const f of readdirSync(packsDir)) if (!servedPackFiles.has(`${PACKS_DIR}/${f}`)) strays.push(`${PACKS_DIR}/${f}`);
  rows.push([strays.length ? `UNREFERENCED: ${strays.length} store file(s) no served page reads, e.g. ${strays.slice(0, 3).join(', ')}`
    : 'no store file is unreferenced', strays.length === 0]);
  return rows;
}

/** The published sw.js is this tool's text for the recorded kill state, byte for byte. */
export function serviceWorkerFindings(siteDir, recorded) {
  const abs = join(siteDir, SW_FILE);
  if (!recorded) return [[`no service worker recorded in builds.json`, !existsSync(abs)]];
  const want = serviceWorkerSource({ kill: recorded.kill });
  if (!existsSync(abs)) return [[`MISSING ${SW_FILE}: builds.json records a service worker and the site has none`, false]];
  const ok = readFileSync(abs, 'utf8') === want;
  return [[ok ? `${SW_FILE} is tools/pages-sw.mjs's ${recorded.kill ? 'kill-switch' : 'worker'}, byte for byte`
    : `STALE ${SW_FILE}: the published worker is not tools/pages-sw.mjs's current ${recorded.kill ? 'kill-switch' : 'worker'} text`, ok]];
}
