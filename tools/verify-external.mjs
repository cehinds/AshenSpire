#!/usr/bin/env node
// tools/verify-external.mjs — verify the DE-INLINED build: that the packs the
// HTML pins are beside it, and that every object they list is there and is the
// file its name says.
//
// WHY THIS EXISTS — de-inlining trades a loud failure for a quiet one
// ------------------------------------------------------------------
// In the single-file build a missing asset is impossible by construction: the
// bytes are inside the HTML or they are not, and tools/verify-shipped.mjs reads
// the shipped file and refuses when the art is not in it. That guard cannot be
// pointed at this build, because here "the art is present" means FILES ON DISK
// BESIDE THE HTML, and an absent one does not change the HTML by a byte. It
// fails later, in a browser, as a blank card — which is the art-less-build bug
// tools/bundle.mjs's header describes, wearing different clothes.
//
// THE PACK SHAPE (docs/EXTERNAL-ASSETS-PLAN.md §3–4, step 3a). The build is
// AshenSpire.html + asset-base.json + packs/ (one index per pack, named by its
// digest) + objects/ (every file, named by its sha256). The HTML pins each
// index's sha256 in ASSET_PACKS; the loader refuses an index that does not hash
// to its pin. This tool reads the output directory off disk, exits non-zero,
// and proves it can fail with --selftest against planted known-bads rather
// than asserting its own care.
//
//   node tools/verify-external.mjs [--dir build]
//   node tools/verify-external.mjs --selftest [--dir build]
//
// WHAT IT CHECKS
//   A  the pins are present: ASSET_MAP is empty, ASSET_PACKS names a default
//      tier and each pack, every pinned index (and the font sidecar) is in
//      packs/ and hashes to its pin, the counts agree, and asset-base.json
//      names this folder
//   B  no media travelled inside the HTML anyway (a data: payload here means
//      the flag did not take); SVG (the masks, §3.7) is the one exception
//   C  every object every index lists is present and hashes to its name,
//      nothing unlisted is in the store, each index agrees with
//      art-manifest.json, and each .js twin carries its index's text
//      (tools/asset-pack.mjs verifyPacks — the same rules the pack tool keeps)
//   D  the CSS assets go through the loader (step 3b): the inlined <style>s
//      name no file by url() (data:, remote and fragment urls name none; the
//      two SVG masks are inline as data:), the
//      HTML carries an ASSET_CSS template, every slot in it names an id the
//      common index lists or EVERY pinned art tier lists (so the high → light
//      fallback can fill it), and every `var(--as-css-…)` a stylesheet reads is
//      one a template rule defines, and the other way round
//   E  the music and the map tiles go through the index (step 3c): the common
//      index lists `music/manifest.json`, every track that manifest (read from
//      its object) names under `music/`, and every map-detail tile the map can
//      ask for (each MAP_ART source, each level, every tile, built with the
//      same tileId() and visibleTiles() the page uses); and no map-detail/ or
//      music/ folder sits beside the HTML, where it would quietly serve what
//      the index misses
//
// WHAT IT DOES NOT CHECK, and the boundary matters as much as the checks:
// paths built at RUNTIME (`assets/equipment/weapon_${id}.webp`) are not
// enumerable from this source — that is the whole reason src/ui/assetmap.js
// exists. C covers them only in the sense that the index lists every id the
// manifest has, so any id that resolved in the source tree resolves here too.
// E proves the common index LISTS the tiles and tracks; C proves each listed
// object is present and correct. Nothing here loads the page, plays a track or
// draws a tile; that is tools/external-play.mjs.
import { readFileSync, existsSync, rmSync, cpSync, mkdtempSync, writeFileSync, unlinkSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { verifyPacks, withAlternativeArt, PACKS, objectPath, indexText } from './asset-pack.mjs';
import { slotIds, VAR_PREFIX } from './asset-css.mjs';
import { unmappedFaceDescriptors } from '../src/ui/assetPacks.js';
import { MAP_ART } from '../src/content/mapArt.generated.js';
import { visibleTiles } from '../src/ui/models/MapDetailModel.js';
import { tileId } from '../src/ui/components/mapDetail.js';
import { SHIPPED_MUSIC_FOLDER } from '../src/content/music.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARGV = process.argv.slice(2);
const SELFTEST = ARGV.includes('--selftest');
const dirFlag = ARGV.indexOf('--dir');
const OUT = resolve(ROOT, dirFlag >= 0 ? ARGV[dirFlag + 1] : 'build');
const MANIFEST = resolve(ROOT, 'art-manifest.json');

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// A data: URI with a real payload. The bare string `data:image/webp;base64,`
// appears in assetmap.js's own PROSE describing the mechanism, and counting
// that as inlined art would make this check fire on a correct build. SVG is
// left out: the two masks stay inline by design (§3.7).
const REAL_PAYLOAD = /data:(?:image\/(?!svg\+xml)[a-z0-9.+-]+|audio\/[a-z0-9.+-]+|font\/[a-z0-9.+-]+);base64,[A-Za-z0-9+/]{64,}/g;
// The bundler stamps the pin as one line of JSON (tools/bundle.mjs, 2b).
const PIN = /const ASSET_PACKS = (\{.*?\});\n/;
// And the CSS template beside it (step 3b), one line of JSON or null.
const CSS_PIN = /const ASSET_CSS = (\{.*?\}|null);\n/;
// The stylesheets the bundler inlined, one <style data-src> each.
const STYLE_BLOCK = /<style data-src="[^"]*">([\s\S]*?)<\/style>/g;
const VAR_USE = new RegExp(`var\\(\\s*(${VAR_PREFIX}[A-Za-z0-9_-]+)`, 'g');
const VAR_RULE = new RegExp(`^:root\\{(${VAR_PREFIX}[A-Za-z0-9_-]+):url\\("\\{\\{[^{}]+\\}\\}"\\)\\}$`);
const PLAIN_BASE = /^(?:\.\.?\/)*(?:[A-Za-z0-9_-]+\/)*$/;

/** The ASSET_CSS template the HTML carries: the value, null, or undefined when there is no stamp. */
function readCss(text) {
  const m = CSS_PIN.exec(text);
  if (!m) return undefined;
  try { return JSON.parse(m[1]); } catch { return undefined; }
}

/** The ASSET_PACKS pin the HTML carries, or null. */
function readPin(text) {
  const m = PIN.exec(text);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

// The object name is asset-pack's own: one home, so the two cannot drift.
const objectOf = (id, sha) => objectPath(sha, id);

/** Every map-detail tile id the page can ask for: each source, each level, the whole painting. */
function mapTileIds(mapArt = MAP_ART) {
  const ids = [];
  for (const art of Object.values(mapArt)) for (const level of art.levels) {
    for (const tile of visibleTiles(level, { x0: 0, y0: 0, x1: 1, y1: 1 })) ids.push(tileId(art.assetHash, tile.key));
  }
  return ids;
}

/** The track ids a music manifest names: relative entries under the shipped folder (audio.js configureMusic). */
function musicTrackIds(manifest, folder = SHIPPED_MUSIC_FOLDER) {
  const ids = [];
  for (const [key, list] of Object.entries(manifest || {})) {
    if (key.startsWith('_') || !Array.isArray(list)) continue;
    for (const f of list) if (typeof f === 'string' && !/^(https?:)?\/\//.test(f) && !f.startsWith('/')) ids.push(`${folder}/${f}`);
  }
  return ids;
}

function verify(outDir) {
  const findings = [];
  let checks = 0;
  const html = resolve(outDir, 'AshenSpire.html');
  if (!existsSync(html)) return { findings: [`no build at ${relative(ROOT, html)}`], checks: 0 };
  const text = readFileSync(html, 'utf8');

  // A — the pins
  checks++;
  if (!/ASSET_MAP = \{\}/.test(text)) findings.push('ASSET_MAP is not empty — this is not the pack-shaped build');
  checks++;
  const pin = readPin(text);
  if (!pin || !pin.packs || typeof pin.packs !== 'object') {
    findings.push('no ASSET_PACKS pin in the HTML — the loader would have nothing to load');
    return { findings, checks, objects: 0, packs: [] };
  }
  const pinned = Object.keys(pin.packs);
  checks++;
  if (!['light', 'high'].includes(pin.tier) || !pin.packs[pin.tier]) findings.push(`ASSET_PACKS names default tier ${JSON.stringify(pin.tier)}, which it does not pin`);
  checks++;
  if (!pin.packs.common) findings.push('ASSET_PACKS pins no common pack');
  if (pin.tier === 'high') {
    checks++;
    if (!pin.packs.light) findings.push('a high-default build pins no light pack — the tier fallback (high → light) has nothing to fall to');
  }
  let objects = 0;
  const idsOf = {}; // pack → the ids its index lists, for D
  for (const pack of pinned) {
    const p = pin.packs[pack] || {};
    checks++;
    if (!PACKS.includes(pack)) { findings.push(`ASSET_PACKS pins an unknown pack ${JSON.stringify(pack)}`); continue; }
    const file = resolve(outDir, String(p.index || ''));
    if (!/^packs\/[a-z]+-[0-9a-f]{12}\.json$/.test(String(p.index)) || !existsSync(file)) { findings.push(`${pack}: the pinned index ${p.index} is not beside the build`); continue; }
    const buf = readFileSync(file);
    if (sha256(buf) !== p.sha256) { findings.push(`${pack}: ${p.index} does not hash to its pin (${String(p.sha256).slice(0, 12)}) — a stale pin or a stale index`); continue; }
    let entries;
    try { entries = JSON.parse(buf.toString('utf8')); } catch { findings.push(`${pack}: ${p.index} is not JSON`); continue; }
    const rows = Object.entries(entries);
    const sizes = new Map(rows.map(([, row]) => [row[0], row[1]]));
    const bytes = [...sizes.values()].reduce((a, b) => a + b, 0);
    checks++;
    if (rows.length !== p.ids || sizes.size !== p.objects || bytes !== p.bytes) {
      findings.push(`${pack}: the pin says ${p.ids} ids / ${p.objects} objects / ${p.bytes} bytes, the index has ${rows.length} / ${sizes.size} / ${bytes}`);
    }
    idsOf[pack] = new Set(rows.map(([id]) => id));
    objects += sizes.size;
  }
  if (pin.packs.common) {
    checks++;
    const f = pin.fonts;
    const file = f && resolve(outDir, String(f.file || ''));
    if (!f || !/^packs\/fonts-[0-9a-f]{12}\.js$/.test(String(f.file)) || !existsSync(file)) findings.push(`the pinned font sidecar ${f ? f.file : '(none)'} is not beside the build`);
    else {
      const m = /^__ashenFonts\("[^"]+", (".*")\);\n$/s.exec(readFileSync(file, 'utf8'));
      let inner = null;
      try { inner = m ? JSON.parse(m[1]) : null; } catch { inner = null; }
      if (typeof inner !== 'string' || sha256(Buffer.from(inner, 'utf8')) !== f.sha256) findings.push(`${f.file}: its text does not hash to its pin`);
    }
  }
  checks++;
  let base = null;
  try { base = JSON.parse(readFileSync(resolve(outDir, 'asset-base.json'), 'utf8')).base; } catch { base = null; }
  if (typeof base !== 'string' || !PLAIN_BASE.test(base)) findings.push('asset-base.json is missing or does not name a plain relative base');
  else if (resolve(outDir, base) !== resolve(outDir)) findings.push(`asset-base.json names ${base}; a build tree's packs/ are beside its HTML ("./")`);

  // B — nothing inlined anyway
  checks++;
  const payloads = text.match(REAL_PAYLOAD) || [];
  if (payloads.length) findings.push(`${payloads.length} inlined asset payload(s) in a build that should carry none`);

  // C — the store: every object present and named by its bytes, nothing stray,
  // every index canonical and in agreement with the manifest.
  checks++;
  let manifest = null;
  try { manifest = withAlternativeArt(JSON.parse(readFileSync(MANIFEST, 'utf8')), ROOT); } catch (e) { findings.push(`art manifests could not be read: ${e.message}`); }
  const problems = verifyPacks(outDir, { manifest, packs: pinned.filter((p) => PACKS.includes(p)) });
  for (const p of problems.slice(0, 6)) findings.push(p);
  if (problems.length > 6) findings.push(`… and ${problems.length - 6} more pack problem(s)`);

  // D — the CSS assets go through the loader (ASSET_CSS), not around it
  const styles = [...text.matchAll(STYLE_BLOCK)].map((m) => m[1]).join('\n');
  checks++;
  if (!styles) findings.push('no inlined <style data-src> in the HTML — the stylesheets did not ship');
  for (const m of styles.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
    const ref = m[2];
    checks++;
    // The same rule as tools/asset-css.mjs: a url() that names no file (an
    // authored data: URI, a remote url, a fragment) is left as written; B
    // polices large non-SVG base64 payloads, the masks included in that rule.
    if (/^(data:|https?:|\/\/|#)/i.test(ref)) continue;
    findings.push(`a stylesheet names ${ref.slice(0, 60)} by url() — every CSS asset but the SVG masks must be an ASSET_CSS slot the loader fills`);
  }
  const css = readCss(text);
  checks++;
  if (!css || !Array.isArray(css.rules) || !css.rules.length) {
    findings.push(css === undefined ? 'no ASSET_CSS stamp in the HTML' : 'ASSET_CSS is empty — the fonts and backdrops have no template to load through');
  } else {
    const artTiers = pinned.filter((p) => p !== 'common' && idsOf[p]);
    for (const id of slotIds(css)) {
      checks++;
      if (idsOf.common && idsOf.common.has(id)) continue;
      const missing = artTiers.filter((p) => !idsOf[p].has(id));
      if (!artTiers.length || missing.length) findings.push(`ASSET_CSS names ${id}, which ${missing.length ? `the ${missing.join(' and ')} index` : 'no pinned index'} does not list`);
    }
    const defined = new Set();
    for (const rule of css.rules) {
      const m = VAR_RULE.exec(String(rule));
      if (m) defined.add(m[1]);
      else if (!/^@font-face\s*\{[^{}]*\}$/.test(String(rule).replace(/\{\{[^{}]+\}\}/g, 'slot'))) {
        checks++;
        findings.push(`ASSET_CSS carries a rule that is neither a backdrop variable nor an @font-face: ${String(rule).slice(0, 60)}`);
      }
    }
    // file:// (step 4) builds each face as a FontFace from its rule: a
    // descriptor FACE_DESCRIPTORS does not map would make that door declare a
    // different face than the @font-face rule over http(s).
    checks++;
    for (const d of unmappedFaceDescriptors(css)) findings.push(`an ASSET_CSS @font-face carries ${d}, which the file:// FontFace would drop — map it in FACE_DESCRIPTORS (src/ui/assetPacks.js)`);
    const used = new Set([...styles.matchAll(VAR_USE)].map((m) => m[1]));
    for (const name of used) {
      checks++;
      if (!defined.has(name)) findings.push(`a stylesheet reads ${name}, which no ASSET_CSS rule defines`);
    }
    for (const name of defined) {
      checks++;
      if (!used.has(name)) findings.push(`ASSET_CSS defines ${name}, which no stylesheet reads`);
    }
  }

  // E — the music and the map tiles go through the common index (step 3c)
  for (const dir of ['map-detail', SHIPPED_MUSIC_FOLDER]) {
    checks++;
    if (existsSync(resolve(outDir, dir))) findings.push(`a ${dir}/ folder sits beside the HTML — the web edition reads ${dir === 'map-detail' ? 'its tiles' : 'its score'} through the common index, and a copy would quietly serve what the index misses`);
  }
  let tiles = 0, tracks = 0;
  const common = idsOf.common;
  if (common) {
    const tileIds = mapTileIds();
    checks++;
    if (!tileIds.length) findings.push('MAP_ART names no map-detail tile — nothing for this check to compare');
    const lost = tileIds.filter((id) => !common.has(id));
    checks += tileIds.length;
    if (lost.length) findings.push(`the common index lists ${tileIds.length - lost.length} of the ${tileIds.length} map-detail tiles the map can ask for; missing ${lost.slice(0, 3).join(', ')}`);
    tiles = tileIds.length - lost.length;
    const manifestId = `${SHIPPED_MUSIC_FOLDER}/manifest.json`;
    checks++;
    let musicManifest = null;
    try {
      const entries = JSON.parse(readFileSync(resolve(outDir, String(pin.packs.common.index)), 'utf8'));
      if (entries[manifestId]) musicManifest = JSON.parse(readFileSync(resolve(outDir, objectOf(manifestId, entries[manifestId][0])), 'utf8'));
    } catch { musicManifest = null; }
    if (!common.has(manifestId)) findings.push(`the common index does not list ${manifestId} — the shipped score cannot load`);
    else if (!musicManifest) findings.push(`${manifestId}'s object is missing or is not JSON`);
    else {
      const trackIds = musicTrackIds(musicManifest);
      checks++;
      if (!trackIds.length) findings.push(`${manifestId} names no track`);
      for (const id of trackIds) {
        checks++;
        if (!common.has(id)) findings.push(`${manifestId} names ${id}, which the common index does not list`);
        else tracks++;
      }
    }
  }
  return { findings, checks, objects, packs: pinned, tiles, tracks };
}

if (!SELFTEST) {
  const { findings, checks, objects, packs, tiles, tracks } = verify(OUT);
  for (const f of findings) console.log('  RED ' + f);
  if (findings.length) {
    console.log(`verify-external: RED — ${findings.length} finding(s) over ${checks} check(s) in ${relative(ROOT, OUT) || '.'}`);
    process.exit(1);
  }
  // THE VERDICT LINE ENDS AT THE COUNT. tools/verdict.mjs parses a fixed
  // grammar and a trailing parenthetical matches none of it: `OK — N checks
  // passed (…)` read as prose, so an exit-0 run reported SILENCE and the CI
  // step failed with "a tool that checked nothing and a tool that found
  // nothing are the same green". The detail belongs on the line above.
  console.log(`  ${packs.join(', ')} packs pinned and present; ${objects} objects listed, each present and named by its bytes; ${tiles} map tiles and ${tracks} tracks listed by the common index.`);
  console.log(`verify-external: OK — ${checks} checks passed`);
  console.log('BOUNDARY: files on disk only. Runtime-built paths are covered only insofar as every');
  console.log('          manifest id is in its index; a path that was already wrong is still wrong;');
  console.log('          and nothing here loaded the page, drew a tile, played a track or played the game.');
  process.exit(0);
}

// --- selftest: prove each check can fail, on a copy, never on the real tree ---
// --selftest plants into a COPY of whatever --dir names, so it works against
// the CI build (preview/) as well as the local one. The copy takes only what
// this tool reads (the HTML, asset-base.json, packs/ and objects/).
const base = OUT;
if (!existsSync(resolve(base, 'AshenSpire.html'))) {
  console.error(`verify-external --selftest: no build at ${relative(ROOT, base)} — node tools/bundle.mjs [--light] --out ${relative(ROOT, base)}`);
  process.exit(2);
}
// ONE copy, and every plant is undone before the next: a high-tier build is
// ~200 MB, and a copy per plant cost gigabytes of temporary disk for nothing.
// Each plant names the files it touches; they are saved before it runs and
// put back after, and the restored copy must verify green again at the end.
const work = mkdtempSync(join(tmpdir(), 'vext-'));
const KEEP = new Set(['AshenSpire.html', 'asset-base.json', 'packs', 'objects', '.asset-pack']);
const d = join(work, 'build');
mkdirSync(d, { recursive: true });
for (const name of readdirSync(base)) if (KEEP.has(name)) cpSync(join(base, name), join(d, name), { recursive: true });
let pass = 0, fail = 0;
const html = resolve(d, 'AshenSpire.html');
const pinOf = () => readPin(readFileSync(html, 'utf8'));
const indexOf = (pack) => resolve(d, pinOf().packs[pack].index);
const firstObject = () => {
  const [id, [sha]] = Object.entries(JSON.parse(readFileSync(indexOf(pinOf().tier), 'utf8')))[0];
  return resolve(d, objectOf(id, sha));
};
const strayObject = () => {
  const sha = sha256(Buffer.from('stray'));
  return resolve(d, `objects/${sha.slice(0, 2)}/${sha}.webp`);
};
// `expect`, when given, must match a finding: a plant that some OTHER check
// happens to catch (a re-pinned index also disagrees with the manifest) has
// not shown that the check it was written for can fail.
const plant = (name, touches, mutate, expect = null) => {
  const files = touches();
  const saved = files.map((f) => [f, existsSync(f) ? readFileSync(f) : null]);
  try {
    mutate(...files);
    const { findings } = verify(d);
    const red = expect ? findings.some((f) => expect.test(f)) : findings.length > 0;
    console.log(`  ${red ? 'caught' : 'MISSED'}  ${name}`);
    red ? pass++ : fail++;
  } finally {
    for (const [f, bytes] of saved) {
      if (bytes === null) rmSync(f, { recursive: true, force: true });
      else { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, bytes); }
    }
  }
};
const baseline = (label) => {
  const { findings } = verify(d);
  console.log(`  ${findings.length ? 'DIRTY ' : 'green '}  ${label}`);
  for (const f of findings.slice(0, 5)) console.log(`          ${f}`);
  findings.length ? fail++ : pass++;
};
// the clean baseline must be GREEN, or every plant below proves nothing
baseline('clean baseline');
const edit = (f, from, to) => writeFileSync(f, readFileSync(f, 'utf8').replace(from, to));
plant('a missing object', () => [firstObject()], (f) => unlinkSync(f));
plant('an object whose bytes drifted (wrong hash)', () => [firstObject()],
  (f) => writeFileSync(f, Buffer.concat([readFileSync(f), Buffer.from('drift')])));
plant('a stray object no index lists', () => [strayObject()], (f) => {
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, 'stray');
});
plant('a stale pin (the HTML pins another index)', () => [html], (f) => {
  const pin = pinOf();
  const stale = { ...pin, packs: { ...pin.packs, [pin.tier]: { ...pin.packs[pin.tier], sha256: '0'.repeat(64) } } };
  edit(f, PIN, () => `const ASSET_PACKS = ${JSON.stringify(stale)};\n`);
});
plant('an index rewritten under its pinned name', () => [indexOf(pinOf().tier)],
  (f) => edit(f, '{\n', `{\n"assets/aa-planted.webp":["${'0'.repeat(64)}",1,"image/webp"],\n`));
plant('a pinned index that is not beside the build', () => [indexOf('common')], (f) => unlinkSync(f));
plant('a .js twin whose string does not match its index', () => [indexOf(pinOf().tier).replace(/\.json$/, '.js')],
  (f) => edit(f, '{\\n', '{\\n\\"assets/aa-planted.webp\\":[],\\n'));
plant('a font sidecar that does not hash to its pin', () => [resolve(d, pinOf().fonts.file)],
  (f) => edit(f, '{\\n', '{\\n\\"x\\":\\"\\",\\n'));
plant('no ASSET_PACKS pin at all', () => [html], (f) => edit(f, PIN, 'const ASSET_PACKS = null;\n'));
plant('an asset-base.json that names another origin', () => [resolve(d, 'asset-base.json')],
  (f) => writeFileSync(f, '{"base":"https://example.com/"}\n'));
plant('art inlined into a build that should carry none', () => [html],
  (f) => edit(f, '</body>', `<img src="data:image/webp;base64,${'A'.repeat(200)}"></body>`));
plant('a stylesheet naming an object directly, around the loader', () => [html],
  (f) => edit(f, /<style data-src="[^"]*">\n/, (open) => `${open}.planted { background-image: url("objects/00/does-not-exist.webp"); }\n`));
plant('an ASSET_CSS slot naming an id no index lists', () => [html],
  (f) => edit(f, /\{\{assets\//, '{{assets/zz-planted/'));
plant('a stylesheet reading a backdrop variable no ASSET_CSS rule defines', () => [html],
  (f) => edit(f, /(<style data-src="[^"]*">[\s\S]*?)var\(--as-css-([A-Za-z0-9_-]+)/, (_, head, name) => `${head}var(--as-css-planted-${name}`));
plant('no ASSET_CSS template', () => [html], (f) => edit(f, CSS_PIN, 'const ASSET_CSS = null;\n'));
plant('an ASSET_CSS @font-face with a descriptor the file:// FontFace would drop', () => [html],
  (f) => edit(f, /@font-face \{ /, '@font-face { font-palette:light; '), /which the file:\/\/ FontFace would drop/);
plant('an injected ASSET_MAP — the wrong shape shipped', () => [html],
  (f) => edit(f, /ASSET_MAP = \{\}/g, 'ASSET_MAP = {"assets/x.webp":"data:image/webp;base64,AAAA"}'));
// E — the music and the tiles (step 3c).
plant('a map-detail/ copy left beside the HTML', () => [resolve(d, 'map-detail')], (f) => {
  mkdirSync(join(f, 'x'), { recursive: true });
  writeFileSync(join(f, 'x', 'tile.webp'), 'old');
}, /a map-detail\/ folder sits beside the HTML/);
plant('a music/ copy left beside the HTML', () => [resolve(d, SHIPPED_MUSIC_FOLDER)], (f) => {
  mkdirSync(f, { recursive: true });
  writeFileSync(join(f, 'manifest.json'), '{}');
}, /a music\/ folder sits beside the HTML/);
// Drop ids from the common index and re-pin it, so A still passes and the
// finding has to come from E.
const dropFromCommon = (match) => (htmlFile, indexFile) => {
  const pin = pinOf();
  const entries = JSON.parse(readFileSync(indexFile, 'utf8'));
  const victim = Object.keys(entries).find(match);
  if (!victim) throw new Error('nothing to drop');
  delete entries[victim];
  const text = indexText(entries);
  writeFileSync(indexFile, text);
  const sizes = new Map(Object.values(entries).map((row) => [row[0], row[1]]));
  const common = { ...pin.packs.common, sha256: sha256(Buffer.from(text)), ids: Object.keys(entries).length, objects: sizes.size, bytes: [...sizes.values()].reduce((a, b) => a + b, 0) };
  edit(htmlFile, PIN, () => `const ASSET_PACKS = ${JSON.stringify({ ...pin, packs: { ...pin.packs, common } })};\n`);
};
plant('a common index missing one tile the map can ask for', () => [html, indexOf('common')],
  dropFromCommon((id) => id.startsWith('map-detail/')), /map-detail tiles the map can ask for/);
plant('a common index missing one track the score names', () => [html, indexOf('common')],
  dropFromCommon((id) => /^music\/.+\.mp3$/.test(id)), /which the common index does not list/);
plant('a common index without the music manifest', () => [html, indexOf('common')],
  dropFromCommon((id) => id === `${SHIPPED_MUSIC_FOLDER}/manifest.json`), /the shipped score cannot load/);
// Every plant was undone: the copy must be green again, or a restore leaked
// into the plants after it.
baseline('restored baseline');
rmSync(work, { recursive: true, force: true });
if (fail) { console.log(`verify-external --selftest: RED — ${fail} of ${pass + fail} did not behave`); process.exit(1); }
console.log(`  both baselines were green, which is what makes the ${pass - 2} plants mean anything.`);
console.log(`verify-external --selftest: OK — ${pass - 2} plants, ${pass - 2} caught`);
