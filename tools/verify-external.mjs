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
//   node tools/verify-external.mjs [--dir build/web]
//   node tools/verify-external.mjs --selftest [--dir build/web]
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
//   D  every CSS url() in the HTML names an object a pinned index lists
//      (until step 3b replaces them with ASSET_CSS slots)
//
// WHAT IT DOES NOT CHECK, and the boundary matters as much as the checks:
// paths built at RUNTIME (`assets/equipment/weapon_${id}.webp`) are not
// enumerable from this source — that is the whole reason src/ui/assetmap.js
// exists. C covers them only in the sense that the index lists every id the
// manifest has, so any id that resolved in the source tree resolves here too.
// map-detail/ and music/ are still copies beside the HTML until step 3c, and
// are not checked here. Nothing here loads the page or plays the game; that is
// tools/external-play.mjs.
import { readFileSync, existsSync, rmSync, cpSync, mkdtempSync, writeFileSync, unlinkSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { verifyPacks, PACKS } from './asset-pack.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARGV = process.argv.slice(2);
const SELFTEST = ARGV.includes('--selftest');
const dirFlag = ARGV.indexOf('--dir');
const OUT = resolve(ROOT, dirFlag >= 0 ? ARGV[dirFlag + 1] : 'build/web');
const MANIFEST = resolve(ROOT, 'art-manifest.json');

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// A data: URI with a real payload. The bare string `data:image/webp;base64,`
// appears in assetmap.js's own PROSE describing the mechanism, and counting
// that as inlined art would make this check fire on a correct build. SVG is
// left out: the two masks stay inline by design (§3.7).
const REAL_PAYLOAD = /data:(?:image\/(?!svg\+xml)[a-z0-9.+-]+|audio\/[a-z0-9.+-]+|font\/[a-z0-9.+-]+);base64,[A-Za-z0-9+/]{64,}/g;
// The bundler stamps the pin as one line of JSON (tools/bundle.mjs, 2b).
const PIN = /const ASSET_PACKS = (\{.*?\});\n/;
const PLAIN_BASE = /^(?:\.\.?\/)*(?:[A-Za-z0-9_-]+\/)*$/;

/** The ASSET_PACKS pin the HTML carries, or null. */
function readPin(text) {
  const m = PIN.exec(text);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

const objectOf = (id, sha) => `objects/${sha.slice(0, 2)}/${sha}${id.slice(id.lastIndexOf('.')).toLowerCase()}`;

function verify(outDir) {
  const findings = [];
  let checks = 0;
  const html = resolve(outDir, 'AshenSpire.html');
  if (!existsSync(html)) return { findings: [`no build at ${relative(ROOT, html)}`], checks: 0 };
  const text = readFileSync(html, 'utf8');

  // A — the pins
  checks++;
  if (!/ASSET_MAP = \{\}/.test(text)) findings.push('ASSET_MAP is not empty — this is not the external-art build');
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
  const listed = new Set(); // object paths the pinned indexes list, for D
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
    for (const [id, row] of rows) listed.add(objectOf(id, row[0]));
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
  try { manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch { findings.push('art-manifest.json could not be read'); }
  const problems = verifyPacks(outDir, { manifest, packs: pinned.filter((p) => PACKS.includes(p)) });
  for (const p of problems.slice(0, 6)) findings.push(p);
  if (problems.length > 6) findings.push(`… and ${problems.length - 6} more pack problem(s)`);

  // D — CSS urls name listed objects
  for (const m of text.matchAll(/url\(\s*"([^"]+)"\s*\)/g)) {
    const ref = m[1];
    if (/^(data:|https?:|\/\/|#)/i.test(ref)) continue;
    checks++;
    const path = ref.split('?')[0].split('#')[0];
    if (!listed.has(path)) findings.push(`CSS url names no object a pinned index lists: ${ref}`);
    else if (!existsSync(resolve(outDir, path))) findings.push(`CSS url does not resolve: ${ref}`);
  }
  return { findings, checks, objects, packs: pinned };
}

if (!SELFTEST) {
  const { findings, checks, objects, packs } = verify(OUT);
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
  console.log(`  ${packs.join(', ')} packs pinned and present; ${objects} objects listed, each present and named by its bytes.`);
  console.log(`verify-external: OK — ${checks} checks passed`);
  console.log('BOUNDARY: files on disk only. Runtime-built paths are covered only insofar as every');
  console.log('          manifest id is in its index; a path that was already wrong is still wrong;');
  console.log('          map-detail/ and music/ are unchecked copies until step 3c; and nothing here');
  console.log('          loaded the page or played the game.');
  process.exit(0);
}

// --- selftest: prove each check can fail, on a copy, never on the real tree ---
// --selftest plants into a COPY of whatever --dir names, so it works against
// the CI build (preview/) as well as the local one. The copy takes only what
// this tool reads (the HTML, asset-base.json, packs/ and objects/).
const base = OUT;
if (!existsSync(resolve(base, 'AshenSpire.html'))) {
  console.error(`verify-external --selftest: no build at ${relative(ROOT, base)} — node tools/bundle.mjs --external-art --out ${relative(ROOT, base)}`);
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
const plant = (name, touches, mutate) => {
  const files = touches();
  const saved = files.map((f) => [f, existsSync(f) ? readFileSync(f) : null]);
  try {
    mutate(...files);
    const { findings } = verify(d);
    const red = findings.length > 0;
    console.log(`  ${red ? 'caught' : 'MISSED'}  ${name}`);
    red ? pass++ : fail++;
  } finally {
    for (const [f, bytes] of saved) {
      if (bytes === null) rmSync(f, { force: true });
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
plant('a CSS url pointing at nothing', () => [html],
  (f) => edit(f, /url\("objects\/[^"]+"\)/, 'url("objects/00/does-not-exist.webp")'));
plant('an injected ASSET_MAP — the wrong shape shipped', () => [html],
  (f) => edit(f, /ASSET_MAP = \{\}/g, 'ASSET_MAP = {"assets/x.webp":"data:image/webp;base64,AAAA"}'));
// Every plant was undone: the copy must be green again, or a restore leaked
// into the plants after it.
baseline('restored baseline');
rmSync(work, { recursive: true, force: true });
if (fail) { console.log(`verify-external --selftest: RED — ${fail} of ${pass + fail} did not behave`); process.exit(1); }
console.log(`  both baselines were green, which is what makes the ${pass - 2} plants mean anything.`);
console.log(`verify-external --selftest: OK — ${pass - 2} plants, ${pass - 2} caught`);
