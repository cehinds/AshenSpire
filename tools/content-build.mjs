// tools/content-build.mjs — compile authored JSON/CSV content into ES modules,
// and the Law 1 clause-6 content smoke (#43).
//
// WHY a compile step rather than fetching JSON at runtime: the game has to run
// from file:// and ship as one self-contained HTML. fetch() breaks both, and
// import assertions aren't portable enough to rely on. So content is AUTHORED
// as spreadsheet-friendly CSV (flat tables) and JSON (nested defs), and this
// compiles it into src/content/generated/*.js — plain data modules the existing
// bundler, validator and tests already understand. You edit a spreadsheet; the
// game keeps working offline with no runtime cost.
//
//   node tools/content-build.mjs            compile + report
//   node tools/content-build.mjs --check    verify generated files are current
//                                           (CI/test use — no writes)
//   node tools/content-build.mjs --selftest the clause-6 corpus: both edges +
//                                           every known-bad observed red BY NAME
//   node tools/content-build.mjs --mutate   reinstate each defect in a copy of
//                                           the REAL tree; each must be CAUGHT
//
// WHY THE SMOKE LIVES HERE (#43): Law 1 clause 5 — bad data fails loud and
// names the entry — failed silent three independent ways in one evening
// (floorRules `opt(any)` + `|| {}`, five audio modes, a dropped comma dying
// upstream of every validator). Clause 6 is the standing check that clause 5
// holds, stated in its own words: one entry added by table + asset alone
// appears and plays; one deliberately broken entry fails WITH ITS NAME PRINTED.
// The test is never "cleanly architected" — it is "Constantine can extend it
// without us." Same --selftest/--mutate contract as dirorder, shotguard-probe,
// mapreach, verify-shipped, quicknav-reach, zoomunits: a corpus nobody has
// watched go red is unknown, not green (the instrument rule, development.md).
//
// THE MATRIX (Vega's amendment on #43): five failure modes × three surfaces is
// fifteen claims. Every cell either RUNS against a planted known-bad or says
// N/A BY NAME with the reason — an undefined cell is how a corpus lies by
// completeness. Modes: m1 id typo · m2 unknown key · m3 malformed file ·
// m4 missing file · m5 wrong folder. Surfaces: S1 bundle-schema
// (validateContent over the assembled bundle) · S2 source-pipeline
// (content/source → generated, this tool's own parse) · S3 asset-binding
// (ID → filename convention, src/ui/assets.js:42).
//
// A GREEN HERE DOES NOT CLOSE #42 (Vega's second line, binding): audio's
// failures are partly runtime — a track 404s mid-play, masked in-channel —
// and no boot-time check reaches live play. This smoke proves content LOADS,
// VALIDATES and PLAYS headlessly; it proves nothing about what is HEARD.
//
// REMOVAL CONDITION (SOP 1's corollary): the corpus is deleted with the checks
// it exercises, never separately. A case drops out only when the defect it
// reinstates becomes impossible to write — not when it has passed a long time.
// A --mutate that stops catching things is the alarm, not the cleanup.
//
// CSV rules: '#' comment lines and blank lines are skipped; the first data row
// is the header. Values are coerced — integers/floats become numbers, 'true'/
// 'false' become booleans, empty stays '', and a value containing '|' becomes
// an array. Quoted fields may contain commas.

import {
  readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, cpSync,
  rmSync, readdirSync, renameSync,
} from 'node:fs';
import { readdirSortedSync } from './dirorder.mjs';
import { dirname, resolve, join, basename, extname, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'content', 'source');
const OUT = join(ROOT, 'src', 'content', 'generated');
const CHECK = process.argv.includes('--check');
const SELFTEST = process.argv.includes('--selftest');
const MUTATE = process.argv.includes('--mutate');

// Parse/verify failures inside probe runs must be CATCHABLE (the corpus feeds
// this tool known-bad files and asserts on the message); the CLI paths keep
// the exact same stderr line and exit(1) they always had.
class BuildError extends Error {}
function bthrow(msg) { throw new BuildError(msg); }
function fail(msg) {
  console.error('content-build: ' + msg);
  process.exit(1);
}

/** Split one CSV line, honouring "quoted, fields" and "" escapes. */
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** '12' → 12, 'true' → true, 'a|b' → ['a','b'], '' → ''. */
function coerce(raw) {
  if (raw === '') return '';
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw.includes('|')) return raw.split('|').map((s) => coerce(s.trim()));
  // Only plain decimals — ids like '0E0A08' or '3d' must stay strings.
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if (/^-?\d*\.\d+$/.test(raw)) return Number(raw);
  return raw;
}

function parseCsv(text, file) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '' && !l.trimStart().startsWith('#'));
  if (!lines.length) bthrow(`${file}: no data rows`);
  const header = splitCsvLine(lines[0]);
  const dupe = header.find((h, i) => header.indexOf(h) !== i);
  if (dupe) bthrow(`${file}: duplicate column '${dupe}'`);
  return lines.slice(1).map((line, n) => {
    const cells = splitCsvLine(line);
    if (cells.length !== header.length) {
      bthrow(`${file}: row ${n + 2} has ${cells.length} cells, header has ${header.length}`);
    }
    const row = {};
    header.forEach((h, i) => { row[h] = coerce(cells[i]); });
    return row;
  });
}

// Every generated module is a plain export of one array/object, so the bundler
// and the tests treat it exactly like a hand-written content file.
function emit(name, data, sourceFile) {
  return (
    `// GENERATED by tools/content-build.mjs from content/source/${sourceFile}\n` +
    `// Do not edit by hand — edit the source file and re-run the build.\n\n` +
    `export const ${name} = ${JSON.stringify(data, null, 2)};\n`
  );
}

/**
 * compileDir(srcDir, outDir, { write }) → { results, stale, orphans }
 *
 * The compile, as a callable check: throws BuildError naming the file (and
 * row, for CSV) on bad input. `orphans` are generated *.js files in outDir
 * that no current source file produces — a second copy nothing syncs: the
 * source was deleted or renamed and the stale module kept shipping (the
 * m4/S2 cell of the matrix). Reported here, ruled on by the caller.
 */
function compileDir(srcDir, outDir, { write } = {}) {
  if (!existsSync(srcDir)) bthrow(`no ${srcDir} directory`);
  if (write) mkdirSync(outDir, { recursive: true });
  const results = [];
  const produced = new Set();
  let stale = 0;
  for (const file of readdirSortedSync(srcDir)) {
    const ext = extname(file).toLowerCase();
    if (ext !== '.csv' && ext !== '.json') continue;
    const name = basename(file, ext);
    const text = readFileSync(join(srcDir, file), 'utf8');
    let data;
    if (ext === '.csv') data = parseCsv(text, file);
    else {
      try { data = JSON.parse(text); } catch (e) { bthrow(`${file}: ${e.message}`); }
    }
    const code = emit(name, data, file);
    produced.add(`${name}.js`);
    const dest = join(outDir, `${name}.js`);
    const prev = existsSync(dest) ? readFileSync(dest, 'utf8') : null;
    // Git's Windows checkout may materialize the generated module with CRLF
    // while emit() is deliberately platform-neutral LF. That is not stale
    // content: compare one canonical newline form so --check still measures
    // authored data drift rather than the machine that checked it out.
    const comparable = prev == null ? null : prev.replace(/\r\n/g, '\n');
    if (comparable !== code) {
      stale += 1;
      if (write) writeFileSync(dest, code);
    }
    results.push({ file, name, rows: Array.isArray(data) ? data.length : Object.keys(data).length });
  }
  const orphans = existsSync(outDir)
    ? readdirSortedSync(outDir).filter((f) => f.endsWith('.js') && !produced.has(f))
    : [];
  return { results, stale, orphans };
}

/**
 * sweepAssets(assetsRoot, bundle) → { errors, bound, artless }
 *
 * The asset-binding surface (S3), headless: the one measured convention is
 * assets/sprites/enemy_<id>.webp (src/ui/assets.js:42), consumed with no
 * registration list, exactly as Law 1 clause 4 orders. Two ways a supplied
 * file silently never plays: it names no enemy (id typo — m1), or it sits
 * where the convention never looks (wrong folder — m5). Both fail BY NAME.
 * A MISSING sprite is not an error: clause 4 licenses the placeholder
 * fallback ("degrades visibly but gracefully"), so absence is counted and
 * printed, never red.
 */
function sweepAssets(assetsRoot, bundle) {
  const ids = new Set((bundle.enemies || []).map((e) => e && e.id).filter(Boolean));
  const errors = [];
  let bound = 0;
  const files = [];
  (function walk(dir) {
    if (!existsSync(dir)) return;
    for (const ent of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const abs = join(dir, ent.name);
      if (ent.isDirectory()) walk(abs);
      else files.push({ rel: relative(assetsRoot, abs).split(sep).join('/'), base: ent.name });
    }
  })(assetsRoot);
  for (const f of files) {
    const m = /^enemy_(.+)\.webp$/.exec(f.base);
    if (!m) continue; // outside the swept convention — named in the boundary
    // Exact-flat, not startsWith (Vira's D2): the convention fetches
    // assets/sprites/enemy_<id>.webp with no subfolders (src/ui/assets.js:42),
    // so a sprite nested at sprites/nested/ is as unfetchable as one in bg/ —
    // the old startsWith counted it BOUND while artless listed the same enemy.
    if (f.rel !== `sprites/${f.base}`) {
      errors.push(`${f.rel}: conventionally-named sprite in the WRONG FOLDER — the convention reads assets/sprites/ FLAT, no subfolders (src/ui/assets.js:42); this file will never be fetched`);
    } else if (!ids.has(m[1])) {
      errors.push(`${f.rel}: NAMES NO ENEMY — id '${m[1]}' is not in the bundle; the file will never be fetched (id typo, or art for a deleted entry)`);
    } else bound += 1;
  }
  const artless = [...ids].filter((id) => !existsSync(join(assetsRoot, 'sprites', `enemy_${id}.webp`))).sort();
  return { errors, bound, artless };
}

/**
 * sweepStraySources(contentRoot) → errors
 *
 * The m5/S2 cell, made a check instead of a boundary (Vega's gate finding on
 * #43: the old cell DESCRIBED the blindness — "the pipeline reads
 * content/source only; a stray source file elsewhere is invisible" — without
 * licensing it, and the person it bites is exactly the spreadsheet editor
 * clause 5 protects: content/weapons.csv saved one level up compiles clean,
 * ships nothing, caught nowhere). Same pattern as sweepAssets: walk, and fail
 * BY NAME anything the compile will never read. compileDir reads exactly the
 * TOP LEVEL of content/source — so both edges are stray: a *.csv/*.json one
 * level UP (beside source/) and one level DEEP (a subfolder inside source/).
 */
function sweepStraySources(contentRoot) {
  const errors = [];
  // content/framework/ is the SECOND authored tree, owned by
  // tools/framework-data-build.mjs (its --check drift gate runs in
  // tools/framework-gate.mjs). The protection stays real here: a framework
  // JSON is stray unless its generated mirror src/framework/data/<name>.js
  // exists — an authored file that compiles to nothing still fails by name.
  const frameworkDir = join(contentRoot, 'framework');
  const frameworkGeneratedDir = join(contentRoot, '..', 'src', 'framework', 'data');
  (function walk(dir) {
    if (!existsSync(dir)) return;
    for (const ent of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const abs = join(dir, ent.name);
      if (ent.isDirectory()) walk(abs);
      else if (/\.json$/i.test(ent.name) && dir === frameworkDir) {
        const mirror = join(frameworkGeneratedDir, ent.name.replace(/\.json$/i, '.js'));
        if (!existsSync(mirror)) {
          errors.push(`content/framework/${ent.name}: STRAY SOURCE FILE — no generated mirror at src/framework/data/; run node tools/framework-data-build.mjs`);
        }
      } else if (/\.(csv|json)$/i.test(ent.name) && dir !== join(contentRoot, 'source')) {
        errors.push(`content/${relative(contentRoot, abs).split(sep).join('/')}: STRAY SOURCE FILE — the compile reads only the top level of content/source/; this file compiles to nothing and ships nowhere. Move it to content/source/${ent.name}`);
      }
    }
  })(contentRoot);
  return errors;
}

/** Remove comments while preserving strings/templates and line positions. */
function withoutJsComments(source) {
  let out = '';
  let quote = null;
  let escaped = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (quote) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; out += ch; continue; }
    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') { out += ' '; i++; }
      out += '\n';
      continue;
    }
    if (ch === '/' && next === '*') {
      out += '  '; i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        out += source[i] === '\n' ? '\n' : ' ';
        i++;
      }
      out += ' ';
      continue;
    }
    out += ch;
  }
  return out;
}

function sfxSourceFiles(srcRoot) {
  const files = [];
  (function walk(dir) {
    for (const ent of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const abs = join(dir, ent.name);
      if (ent.isDirectory()) walk(abs);
      else if (ent.name.endsWith('.js')) files.push(abs);
    }
  })(srcRoot);
  return files;
}

function closingCallParen(source, open) {
  let depth = 1;
  let quote = null;
  let escaped = false;
  for (let i = open + 1; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '(') depth += 1;
    else if (ch === ')' && --depth === 0) return i;
  }
  return -1;
}

const quotedIds = (text) => [...text.matchAll(/(['"])([A-Za-z_$][\w$]*)\1/g)].map((m) => m[2]);
const templateFamily = (text) => {
  const m = /^`([^`]*)\$\{/.exec(text.trim());
  if (!m) return null;
  return m[1].endsWith('_') ? m[1].slice(0, -1) : m[1];
};

/**
 * Compare ids reachable from sfx.play() with authored rows in both directions.
 * `sourceOverrides` exists only for --selftest plants; production always walks
 * the real src tree. Identifier-only forwarding calls are reported but are not
 * invented into ids: this gate owns literal, conditional-literal and composed
 * template callers, the exact boundary of #67.
 */
function sweepSfxAuthority(srcRoot, recipes, familyIds, sourceOverrides = null) {
  const families = new Set(familyIds);
  const literals = new Set();
  const composed = new Set();
  let callerSites = 0;
  let forwardedSites = 0;
  const sources = sourceOverrides || new Map(sfxSourceFiles(srcRoot).map((file) => [file, readFileSync(file, 'utf8')]));

  for (const [file, raw] of sources) {
    const source = withoutJsComments(raw);
    const call = /\bsfx\.play\s*\(/g;
    let match;
    while ((match = call.exec(source))) {
      const open = source.indexOf('(', match.index);
      const close = closingCallParen(source, open);
      if (close < 0) continue;
      const arg = source.slice(open + 1, close).trim();
      callerSites += 1;
      const directFamily = templateFamily(arg);
      if (directFamily) composed.add(directFamily);
      else if (/^(['"])[A-Za-z_$][\w$]*\1$/.test(arg)) quotedIds(arg).forEach((id) => literals.add(id));
      else if (arg.includes('?')) quotedIds(arg).forEach((id) => literals.add(id));
      else if (/^[A-Za-z_$][\w$]*$/.test(arg)) {
        const aliasPattern = '(?:const|let|var)\\s+' + arg + '\\s*=\\s*(`[^`]*`)';
        const assignments = [...source.slice(0, match.index).matchAll(new RegExp(aliasPattern, 'g'))];
        const aliasFamily = assignments.length ? templateFamily(assignments.at(-1)[1]) : null;
        if (aliasFamily) composed.add(aliasFamily); else forwardedSites += 1;
      }
      call.lastIndex = close + 1;
    }
    // holdbeat's injectable `play` defaults to sfx.play and receives composed
    // ids from idFor(). Keep that dependency visible without pretending every
    // HTMLMediaElement.play() in the tree is an SFX caller.
    for (const m of source.matchAll(/\bplay\s*\(\s*idFor\([^)]*,\s*(['"])([A-Za-z_$][\w$]*)\1\s*\)/g)) {
      composed.add(m[2]);
      callerSites += 1;
    }
  }

  const errors = [];
  if (families.size !== familyIds.length) errors.push('SFX family ids contain a duplicate');
  for (const family of families) {
    if (!Object.prototype.hasOwnProperty.call(recipes, family)) errors.push(`SFX family '${family}' has no recipe row`);
    if (!composed.has(family)) errors.push(`SFX family recipe '${family}' has no composed caller`);
  }
  const resolve = (id) => {
    if (Object.prototype.hasOwnProperty.call(recipes, id)) return id;
    const cut = id.indexOf('_');
    const family = cut > 0 ? id.slice(0, cut) : null;
    return family && Object.prototype.hasOwnProperty.call(recipes, family) ? family : 'default';
  };
  for (const id of literals) {
    if (resolve(id) === 'default') errors.push(`SFX caller without recipe '${id}'`);
  }
  for (const family of composed) {
    if (!families.has(family) || !Object.prototype.hasOwnProperty.call(recipes, family)) {
      errors.push(`SFX composed caller '${family}_…' has no registered family recipe '${family}'`);
    }
  }
  for (const id of Object.keys(recipes)) {
    if (id === 'default' || families.has(id)) continue;
    const exact = literals.has(id);
    const viaComposed = [...composed].some((family) => id.startsWith(`${family}_`));
    if (!exact && !viaComposed) errors.push(`SFX recipe without caller '${id}'`);
  }
  return { errors, callerSites, literalIds: literals.size, composedFamilies: composed.size, forwardedSites };
}

// ---------------------------------------------------------------------------
// The smoke — shared plumbing
// ---------------------------------------------------------------------------

// The game modules load only inside the smoke: a plain compile run must not
// import the engine (this tool runs before the tree is necessarily healthy).
async function loadGame() {
  const [{ validateContent }, { contentBundle }, { SFX_RECIPES, SFX_FAMILY_IDS }, { createRegistries, resolveCard }, { createCombat, dispatch }, { createRng }] =
    await Promise.all([
      import('../src/model/validate.js'),
      import('../src/content/index.js'),
      import('../src/content/sfx.js'),
      import('../src/model/registries.js'),
      import('../src/engine/combat.js'),
      import('../src/engine/rng.js'),
    ]);
  return { validateContent, contentBundle, SFX_RECIPES, SFX_FAMILY_IDS, createRegistries, resolveCard, createCombat, dispatch, createRng };
}

const jclone = (v) => JSON.parse(JSON.stringify(v));

// The eight bundle doors and their current fail-closed owners. validateContent
// now owns balance and equipment; the other six still validate GREEN when
// absent and therefore remain guarded here. K15 plants every missing key and
// proves the expected owner causally, so a responsibility change is loud and
// must update this matrix rather than silently weakening either layer.
const BUNDLE_DOOR_MATRIX = [
  { key: 'version', owner: 'content-build' },
  { key: 'events', owner: 'content-build' },
  { key: 'flasks', owner: 'content-build' },
  { key: 'mapConfigs', owner: 'content-build' },
  { key: 'sfx', owner: 'content-build' },
  { key: 'unlocks', owner: 'content-build' },
  { key: 'balance', owner: 'validateContent' },
  { key: 'equipment', owner: 'validateContent' },
];
const BUNDLE_DOORS = BUNDLE_DOOR_MATRIX.map(({ key }) => key);
const openDoors = (bundle) => BUNDLE_DOORS.filter((k) => bundle[k] == null);

// The Add edge's two probe entries — table rows and one conventionally-named
// file, no code. If either needs anything beyond this literal, clause 1 of
// Law 1 has regressed and this smoke should be the thing that says so.
const PROBE_CARD = {
  id: 'smokeProbeCard', name: 'Smoke Probe', class: 'colorless', rarity: 'special',
  cost: 1, type: 'skill', keywords: [],
  effects: [{ op: 'block', target: 'self', amount: 8 }],
  textTemplate: 'Gain {block} Block.',
};
const PROBE_ENEMY = {
  id: 'smokeProbeFoe', name: 'Smoke Probe Foe', hp: [10, 10], poiseMax: 5,
  levelProfile: { min: 1, max: 4 }, // required since enemy level content landed
  moves: { wait: { intent: 'block', block: 1, weight: 100 } },
};

function printBoundary() {
  console.log(`
BOUNDARY — what this green does NOT cover (SOP 3, CI expectation 4):
  - nothing rendered, nothing heard: "appears and plays" is registries + engine
    truth (resolveCard found it, the played card's effect landed); no browser,
    no screen, no ear. The render half of "appears" is unverified here.
  - a green here does NOT close #42: runtime audio failure — a track 404ing
    mid-play, masking in-channel — is live-play truth no boot smoke reaches.
  - the asset sweep rules on the enemy-sprite convention only
    (assets/sprites/enemy_<id>.webp); bg/ and equipment/ families are unswept,
    and file CONTENTS are opaque — a corrupt webp binds and still won't render.
  - legal is not tuned: this proves entries load, validate and play, never that
    they are balanced — runsim owns that claim.
  - six bundle doors are held outside validate.js by this tool (version,
    events, flasks, mapConfigs, sfx, unlocks); validate.js owns balance and
    equipment. K15's eight-row matrix plants every missing key and proves its
    expected fail-closed owner. A responsibility change must update the matrix;
    neither layer is silently weakened.
  - not every syntax error names its file, and the shape is PLATFORM-SHAPED
    (re-measured for Vira's D3 — node v22.22.2, no package.json in this tree):
    a ',,' in mapconfig.js IS caught by name here, because .js under no
    package.json takes node's CJS translator, whose error names
    './mapconfig.js'. The no-file shape is real but reproduces only under
    forced ESM (the same ',,' in a .mjs → "Unexpected token ','", file named
    nowhere in message or stack). M1's file-naming claim therefore leans on
    the CJS-translator path: if this tree gains a package.json with
    "type": "module", or content moves to .mjs, re-measure it — do not trust
    it. The boot surface (browser console names file:line, but clause 5's
    reader has no devtools open) still owes this either way.`);
}

// ---------------------------------------------------------------------------
// --selftest: baseline greens + the known-bad corpus, every case red BY NAME
// ---------------------------------------------------------------------------

async function selftest() {
  console.log('content-build --selftest: the clause-6 corpus. Every known-bad below must go red for its NAMED reason.\n');
  const G = await loadGame();
  const b = G.contentBundle;
  let bad = 0;
  const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) bad += 1; };
  const tmp = mkdtempSync(join(tmpdir(), 'content-smoke-'));

  try {
    // ---- baseline: the real tree is green before any known-bad is judged --
    console.log('baseline — the shipped tree:');
    const v0 = G.validateContent(b);
    ok(v0.ok, `real bundle validates clean (${v0.ok ? 0 : v0.errors.length} errors)`);
    const cleanDoors = openDoors(b);
    ok(cleanDoors.length === 0, `bundle-door clean control 1/1: all ${BUNDLE_DOORS.length} keys present (${BUNDLE_DOORS.join(', ')})`);
    let compiled = null;
    try { compiled = compileDir(SRC, OUT, { write: false }); } catch (e) { compiled = { err: e.message }; }
    ok(compiled && !compiled.err && compiled.stale === 0, `content/source compiles and generated files are current${compiled && compiled.err ? ` — ${compiled.err}` : ''}`);
    ok(compiled && !compiled.err && compiled.orphans.length === 0, 'no orphaned generated modules (every generated .js has a living source)');
    const sw0 = sweepAssets(join(ROOT, 'assets'), b);
    ok(sw0.errors.length === 0, `asset sweep clean: ${sw0.bound} sprite(s) bound by convention, ${sw0.artless.length} enemy(ies) art-less (licensed by Law 1 clause 4 — placeholder, not a defect)`);
    const st0 = sweepStraySources(join(ROOT, 'content'));
    ok(st0.length === 0, 'stray-source sweep clean: every *.csv/*.json under content/ sits exactly where the compile reads (content/source/, top level)');
    const sfx0 = sweepSfxAuthority(join(ROOT, 'src'), G.SFX_RECIPES, G.SFX_FAMILY_IDS);
    ok(sfx0.errors.length === 0, `SFX authority joins ${sfx0.literalIds} literal id(s) + ${sfx0.composedFamilies} composed family/families to ${Object.keys(G.SFX_RECIPES).length} recipe row(s), both ways${sfx0.errors.length ? ` — ${sfx0.errors.join(' | ')}` : ''}`);

    // ---- the Add edge (clause 6's first words) ----------------------------
    console.log('\nthe Add edge — one entry by table + asset alone, asserted on OUTCOME:');
    const b2 = { ...b, cards: [...b.cards, PROBE_CARD], enemies: [...b.enemies, PROBE_ENEMY] };
    const v2 = G.validateContent(b2);
    ok(v2.ok, `probe card + probe enemy enter by table alone and validate (${v2.ok ? 0 : v2.errors.length} errors)`);
    const REG2 = G.createRegistries(b2);
    const cardDef = G.resolveCard(REG2, { cardId: PROBE_CARD.id, upgraded: false });
    ok(!!cardDef && cardDef.name === PROBE_CARD.name, `probe card APPEARS: resolveCard finds '${PROBE_CARD.id}'`);
    ok(!!REG2.enemies.get(PROBE_ENEMY.id), `probe enemy APPEARS: registries resolve '${PROBE_ENEMY.id}'`);
    const combat = G.createCombat({
      registries: REG2, rng: G.createRng('clause6-probe'),
      player: {
        classId: 'reaver', maxHp: 60, hp: 60, relicIds: [], flasks: [],
        energyMax: 3, drawPerTurn: 5,
        deck: [1, 2, 3, 4, 5].map((n) => ({ instanceId: `probe${n}`, cardId: PROBE_CARD.id, upgraded: false })),
      },
      enemyIds: [PROBE_ENEMY.id],
    });
    const inHand = combat.piles.hand.find((h) => h.cardId === PROBE_CARD.id);
    const blockBefore = combat.player.block;
    G.dispatch(combat, { type: 'playCard', cardInstanceId: inHand.instanceId });
    ok(combat.player.block - blockBefore === 8, `probe card PLAYS: block ${blockBefore} → ${combat.player.block} (the authored 8, not a validator return code)`);
    const addAssets = join(tmp, 'assets-add');
    mkdirSync(join(addAssets, 'sprites'), { recursive: true });
    writeFileSync(join(addAssets, 'sprites', `enemy_${PROBE_ENEMY.id}.webp`), 'probe');
    const swAdd = sweepAssets(addAssets, b2);
    ok(swAdd.errors.length === 0 && swAdd.bound === 1, 'probe ASSET binds by name alone: conventionally-named file consumed, no registration list touched');

    // ---- the known-bad corpus (the Break edge, case by case) --------------
    console.log('\nknown-bad corpus — observed red, name checked in the message:');
    const cases = [
      {
        id: 'K1', cell: 'S1 coupling', what: 'floorRules.fixed anchored past floors (every field legal, the PAIR wrong — the case a field-wise validator cannot fail)',
        expect: ['mapConfigs.1', 'floorRules.fixed', 'outside'],
        run() { const m = jclone(b.mapConfigs); m[1].floorRules.fixed.push({ at: 'floor', index: 99, type: 'treasure' }); return G.validateContent({ ...b, mapConfigs: m }); },
      },
      {
        id: 'K2', cell: 'S1', what: 'floorRules absent entirely (the retired `|| {}` fallback must stay loud)',
        expect: ['mapConfigs.1.floorRules', 'missing'],
        run() { const m = jclone(b.mapConfigs); delete m[1].floorRules; return G.validateContent({ ...b, mapConfigs: m }); },
      },
      {
        id: 'K3', cell: 'S1', what: 'unknownWeights absent (the second coupling: schema said opt, runtime said crash)',
        expect: ['mapConfigs.1.unknownWeights', 'missing'],
        run() { const m = jclone(b.mapConfigs); delete m[1].unknownWeights; return G.validateContent({ ...b, mapConfigs: m }); },
      },
      {
        id: 'K4', cell: 'S1 m2', what: "event choice requires:{hp:50} — the second opt(any)'s regression guard (schemas.js event.requires)",
        expect: ["Unknown field 'hp'"],
        run() { const evs = jclone(b.events); evs[0].choices[0].requires = { hp: 50 }; return G.validateContent({ ...b, events: evs }); },
      },
      {
        id: 'K5', cell: 'S1 m1 · THE BREAK EDGE', what: "dangling id — a broken entry fails with ITS OWN NAME printed",
        expect: ['Dangling reference', 'no_such_enemy'],
        run() { const encs = jclone(b.encounters); encs[0].enemies = ['no_such_enemy']; return G.validateContent({ ...b, encounters: encs }); },
      },
      {
        id: 'K6', cell: 'S1 m2', what: 'sfx layer with an unknown key (closed schema, not opt(any))',
        expect: ["Unknown field 'freqq'"],
        run() { const s = jclone(b.sfx); s.default[0].freqq = 3; return G.validateContent({ ...b, sfx: s }); },
      },
      {
        id: 'K7', cell: 'S1', what: "sfx 'default' recipe deleted — the audible fallback every unknown id lands on",
        expect: ["Missing 'default' recipe"],
        run() { const s = jclone(b.sfx); delete s.default; return G.validateContent({ ...b, sfx: s }); },
      },
    ];
    for (const c of cases) {
      const r = c.run();
      const msgs = (r.errors || []).map((e) => `${e.path}: ${e.msg}`);
      const hit = msgs.find((m) => c.expect.every((s) => m.includes(s))) || msgs.find((m) => c.expect.some((s) => m.includes(s)));
      const pass = !r.ok && !!hit && c.expect.every((s) => msgs.some((m) => m.includes(s)));
      ok(pass, `${c.id} [${c.cell}] ${c.what}\n      → ${pass ? hit : `NOT CAUGHT BY NAME (ok=${r.ok}, ${msgs.length} error(s))`}`);
    }

    // pipeline cases (S2) — planted files through this tool's own parse
    const plant = (name, text) => { const d = join(tmp, `src-${name}`); mkdirSync(d, { recursive: true }); writeFileSync(join(d, name), text); return d; };
    const pipeCases = [
      { id: 'K8', cell: 'S2 m3', what: 'CSV row with a dropped cell (the dropped comma, in table form) — file AND row named', file: 'bad.csv', text: 'a,b\n1,2\n3\n', expect: ['bad.csv', 'row 3'] },
      { id: 'K9', cell: 'S2 m3', what: 'malformed JSON (trailing comma) — file named, caught in the tool, upstream of any validator', file: 'bad.json', text: '{"a": 1,}\n', expect: ['bad.json'] },
      { id: 'K10', cell: 'S2 m2', what: 'duplicate CSV column — the pipeline\'s key-level check', file: 'dupe.csv', text: 'a,a\n1,2\n', expect: ["duplicate column 'a'"] },
    ];
    for (const c of pipeCases) {
      const d = plant(c.file, c.text);
      let msg = null;
      try { compileDir(d, join(tmp, 'out-' + c.id), { write: false }); } catch (e) { if (e instanceof BuildError) msg = e.message; else throw e; }
      const pass = !!msg && c.expect.every((s) => msg.includes(s));
      ok(pass, `${c.id} [${c.cell}] ${c.what}\n      → ${pass ? msg : `NOT CAUGHT BY NAME (got: ${msg})`}`);
    }
    {
      const d = join(tmp, 'src-orphan'); const o = join(tmp, 'out-orphan');
      mkdirSync(d, { recursive: true }); mkdirSync(o, { recursive: true });
      writeFileSync(join(d, 'good.csv'), 'a,b\n1,2\n');
      writeFileSync(join(o, 'ghost.js'), 'export const ghost = [];\n');
      const r = compileDir(d, o, { write: false });
      ok(r.orphans.length === 1 && r.orphans[0] === 'ghost.js', `K11 [S2 m4] generated module whose source is gone — 'ghost.js' reported as orphan (a second copy nothing syncs)`);
    }
    // asset cases (S3)
    {
      const a = join(tmp, 'assets-wrong'); mkdirSync(join(a, 'sprites'), { recursive: true }); mkdirSync(join(a, 'bg'), { recursive: true });
      writeFileSync(join(a, 'bg', 'enemy_wanderingSoldier.webp'), 'x');
      const r = sweepAssets(a, b);
      const pass = r.errors.length === 1 && r.errors[0].includes('WRONG FOLDER') && r.errors[0].includes('bg/enemy_wanderingSoldier.webp');
      ok(pass, `K12 [S3 m5] real-named sprite planted in assets/bg — ${pass ? r.errors[0] : 'NOT CAUGHT BY NAME'}`);
    }
    {
      const a = join(tmp, 'assets-orphan'); mkdirSync(join(a, 'sprites'), { recursive: true });
      writeFileSync(join(a, 'sprites', 'enemy_noSuchFoe.webp'), 'x');
      const r = sweepAssets(a, b);
      const pass = r.errors.length === 1 && r.errors[0].includes('NAMES NO ENEMY') && r.errors[0].includes('noSuchFoe');
      ok(pass, `K13 [S3 m1] sprite whose id names no enemy — ${pass ? r.errors[0] : 'NOT CAUGHT BY NAME'}`);
    }
    {
      // K14 — Vega's scenario verbatim, plus the same blindness one level the
      // other way: compileDir reads only content/source top level, so BOTH
      // misplacements must be red by name, with the legit file staying green.
      const c = join(tmp, 'content-stray');
      mkdirSync(join(c, 'source', 'sub'), { recursive: true });
      writeFileSync(join(c, 'source', 'ok.csv'), 'a,b\n1,2\n');
      writeFileSync(join(c, 'weapons.csv'), 'a,b\n1,2\n'); // saved one level UP
      writeFileSync(join(c, 'source', 'sub', 'extra.json'), '{"a": 1}\n'); // one level DEEP
      const r = sweepStraySources(c);
      const up = r.find((m) => m.includes('content/weapons.csv'));
      const deep = r.find((m) => m.includes('content/source/sub/extra.json'));
      const pass = r.length === 2 && !!up && !!deep;
      ok(pass, `K14 [S2 m5] stray source files — weapons.csv one level UP and source/sub/extra.json one level DEEP, each red by name, the legit file untouched\n      → ${pass ? up : `NOT CAUGHT BY NAME (${r.length} error(s): ${r.join(' | ') || 'none'})`}`);
    }
    {
      // K15 — eight causal missing-key plants. Six must pass through
      // validateContent and be caught by this tool; balance/equipment must be
      // rejected inside validateContent by a message naming the missing door.
      const results = [];
      for (const [index, row] of BUNDLE_DOOR_MATRIX.entries()) {
        const nb = { ...b }; delete nb[row.key];
        const v = G.validateContent(nb);
        const doors = openDoors(nb);
        const messages = (v.errors || []).map((e) => `${e.path}: ${e.msg}`);
        const namedInside = messages.some((m) => m.startsWith(`${row.key}.`) || m.startsWith(`${row.key}:`));
        const external = row.owner === 'content-build';
        const pass = doors.length === 1 && doors[0] === row.key && (
          external ? v.ok && !namedInside : !v.ok && namedInside
        );
        results.push({ ...row, pass });
        const observed = v.ok
          ? `content-build door guard (validateContent green; doors=[${doors.join(', ')}])`
          : `validateContent (${messages.find((m) => m.startsWith(row.key)) || `${messages.length} error(s), door not named`})`;
        ok(pass, `K15.${index + 1} [S1 door matrix] '${row.key}' missing — expected owner ${row.owner}; observed ${observed}`);
      }
      const external = results.filter((r) => r.owner === 'content-build');
      const internal = results.filter((r) => r.owner === 'validateContent');
      const passed = results.filter((r) => r.pass).length;
      const externalPassed = external.filter((r) => r.pass).length;
      const internalPassed = internal.filter((r) => r.pass).length;
      ok(
        passed === 8 && external.length === 6 && externalPassed === 6 && internal.length === 2 && internalPassed === 2 && cleanDoors.length === 0,
        `K15 door-owner matrix totals: plants ${passed}/8; external ${externalPassed}/6; internal ${internalPassed}/2; clean ${cleanDoors.length === 0 ? 1 : 0}/1`,
      );
    }
    {
      // K16 — Vira's D2: a real-named sprite NESTED inside sprites/ was
      // counted BOUND at exit 0 (startsWith('sprites/') against an exact-flat
      // convention, src/ui/assets.js) while the same enemy simultaneously
      // listed artless — one run, two answers. Exact-flat now: nested is
      // WRONG FOLDER by name.
      const a = join(tmp, 'assets-nested'); mkdirSync(join(a, 'sprites', 'nested'), { recursive: true });
      writeFileSync(join(a, 'sprites', 'nested', 'enemy_wanderingSoldier.webp'), 'x');
      const r = sweepAssets(a, b);
      const pass = r.errors.length === 1 && r.errors[0].includes('WRONG FOLDER') && r.errors[0].includes('sprites/nested/enemy_wanderingSoldier.webp') && r.bound === 0;
      ok(pass, `K16 [S3 m5] real-named sprite nested in assets/sprites/nested/ — ${pass ? r.errors[0] : `NOT CAUGHT (errors: ${r.errors.join(' | ') || 'none'}; bound=${r.bound})`}`);
    }
    {
      const sources = new Map(sfxSourceFiles(join(ROOT, 'src')).map((file) => [file, readFileSync(file, 'utf8')]));
      sources.set(join(ROOT, 'src', 'selftest-sfx-missing.js'), "sfx.play('sfxMissingCallerRow');\n");
      const r = sweepSfxAuthority(join(ROOT, 'src'), G.SFX_RECIPES, G.SFX_FAMILY_IDS, sources);
      const hit = r.errors.find((m) => m.includes('caller without recipe') && m.includes('sfxMissingCallerRow'));
      ok(!!hit, `K17 [SFX caller→row] caller without recipe 'sfxMissingCallerRow' is red by name\n      → ${hit || 'NOT CAUGHT BY NAME'}`);
    }
    {
      const recipes = { ...G.SFX_RECIPES, sfxOrphanRecipeRow: G.SFX_RECIPES.default };
      const r = sweepSfxAuthority(join(ROOT, 'src'), recipes, G.SFX_FAMILY_IDS);
      const hit = r.errors.find((m) => m.includes('recipe without caller') && m.includes('sfxOrphanRecipeRow'));
      ok(!!hit, `K18 [SFX row→caller] recipe without caller 'sfxOrphanRecipeRow' is red by name\n      → ${hit || 'NOT CAUGHT BY NAME'}`);
    }
    {
      const families = G.SFX_FAMILY_IDS.filter((id) => id !== 'beat');
      const r = sweepSfxAuthority(join(ROOT, 'src'), G.SFX_RECIPES, families);
      const hit = r.errors.find((m) => m.includes("beat_…") && m.includes("family recipe 'beat'"));
      ok(!!hit, `K19 [SFX composed→family] beat_<phase> without the registered 'beat' family is red by name\n      → ${hit || 'NOT CAUGHT BY NAME'}`);
    }
    {
      const families = [...G.SFX_FAMILY_IDS, 'noCallerFamily'];
      const recipes = { ...G.SFX_RECIPES, noCallerFamily: G.SFX_RECIPES.default };
      const r = sweepSfxAuthority(join(ROOT, 'src'), recipes, families);
      const hit = r.errors.find((m) => m.includes("family recipe 'noCallerFamily'") && m.includes('no composed caller'));
      ok(!!hit, `K20 [SFX family row→caller] registered family recipe without a composed caller is red by name\n      → ${hit || 'NOT CAUGHT BY NAME'}`);
    }

    // ---- the matrix, every cell named (Vega's amendment) ------------------
    console.log(`
the matrix — 5 modes × 3 surfaces, every cell RUNS or says N/A BY NAME:
                      S1 bundle-schema         S2 source-pipeline       S3 asset-binding
  m1 id typo          K5 (dangling ref)        N/A — ids are checked    K13 (orphan sprite)
                                               at S1 after compile;
                                               the pipeline carries
                                               no ref table of its own
  m2 unknown key      K4, K6                   K10 (duplicate column)   N/A — a filename is its
                                                                        only key; a wrong name
                                                                        IS m1/m5, not m2
  m3 malformed file   N/A — the bundle is      K8, K9                   N/A — asset bytes are
                      parsed JS; malformed                              opaque here; decode is a
                      dies at import,                                   render/runtime fact
                      upstream (--mutate M1
                      covers it and names
                      the file)
  m4 missing file     N/A — mapConfigs names   K11 (orphaned            N/A — a missing sprite is
                      no asset (Vega,          generated module)        LICENSED: Law 1 clause 4
                      measured on #43)                                  degrades to placeholder
  m5 wrong folder     N/A — same referent-     K14 (stray source:       K12 (planted in bg/)
                      less cell as m4          one level up OR deep;
                                               also red in the plain
                                               build and --check)`);

    printBoundary();
    if (bad) { console.error(`\ncontent-build --selftest: ${bad} check(s) failed.`); process.exit(1); }
    console.log(`\ncontent-build --selftest: OK — baseline green, Add edge plays, 20 known-bad families red by name, K15 plants 8/8 + clean 1/1, 15/15 matrix cells accounted for.`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// --mutate: reinstate each defect in a copy of the REAL tree; watch it be CAUGHT
// ---------------------------------------------------------------------------

async function mutate() {
  console.log('content-build --mutate: reinstating each defect in a copy of the real tree. Every case below must be CAUGHT.\n');
  const G = await loadGame();
  const b = G.contentBundle;
  const tmp = mkdtempSync(join(tmpdir(), 'content-mutate-'));
  let bad = 0;
  const report = (caught, id, what, detail) => {
    console.log(`  ${caught ? 'CAUGHT' : 'MISSED'}  ${id} ${what}\n          → ${detail}`);
    if (!caught) bad += 1;
  };
  // Copy src/content (self-contained: no import in it escapes the directory —
  // verified at authoring; if one ever does, the import below fails loudly).
  const copyContent = (name, edits) => {
    const d = join(tmp, name);
    cpSync(join(ROOT, 'src', 'content'), join(d, 'content'), { recursive: true });
    for (const [file, from, to] of edits) {
      const p = join(d, 'content', file);
      const text = readFileSync(p, 'utf8');
      if (!text.includes(from)) bthrow(`mutation target not found in ${file}: ${JSON.stringify(from)} — the tree drifted; fix the mutation, do not let it silently no-op`);
      writeFileSync(p, text.replace(from, to));
    }
    return pathToFileURL(join(d, 'content', 'index.js')).href;
  };

  try {
    // M1 — the dropped comma (Marina's parse edge): dies UPSTREAM of every
    // validator, and must still name the file.
    try {
      await import(copyContent('m1', [['mapconfig.js', 'floors: 12,', 'floors: 12']]));
      report(false, 'M1', 'dropped comma in mapconfig.js', 'import succeeded — a syntax error loaded clean');
    } catch (e) {
      const where = `${e.message}\n${e.stack || ''}`;
      report(where.includes('mapconfig.js'), 'M1', 'dropped comma in mapconfig.js — SyntaxError must name the file', (e.message || '').split('\n')[0] + (where.includes('mapconfig.js') ? ' (file named)' : ' (FILE NOT NAMED)'));
    }
    // M2 — the original #43 defect, reinstated in today's vocabulary:
    // floors moved down while a fixed anchor stays absolute.
    {
      const { contentBundle: mb } = await import(copyContent('m2', [
        ['mapconfig.js', 'floors: 12,', 'floors: 8,'],
        ['mapconfig.js', "{ at: 'fraction', of: 0.64, type: 'treasure' }", "{ at: 'floor', index: 9, type: 'treasure' }"],
      ]));
      const r = G.validateContent(mb);
      const hit = (r.errors || []).map((e) => `${e.path}: ${e.msg}`).find((m) => m.includes('floorRules.fixed') && m.includes('outside'));
      report(!r.ok && !!hit, 'M2', 'floors 12→8 while a fixed anchor names floor 9 (the treasure-vanishes coupling)', hit || 'validated clean');
    }
    // M3 — the sfx audible-fallback contract: 'default' typo'd away.
    {
      const { contentBundle: mb } = await import(copyContent('m3', [['sfx.js', 'default:', 'defualt:']]));
      const r = G.validateContent(mb);
      const hit = (r.errors || []).map((e) => `${e.path}: ${e.msg}`).find((m) => m.includes("Missing 'default' recipe"));
      report(!r.ok && !!hit, 'M3', "sfx 'default' recipe typo'd to 'defualt'", hit || 'validated clean');
    }
    // M4 — a dangling id planted into a real encounter.
    {
      const { contentBundle: mb } = await import(copyContent('m4', [['encounters/act1.js', "'wanderingSoldier'", "'wanderingSoldat'"]]));
      const r = G.validateContent(mb);
      const hit = (r.errors || []).map((e) => `${e.path}: ${e.msg}`).find((m) => m.includes('wanderingSoldat'));
      report(!r.ok && !!hit, 'M4', "encounter enemy id typo'd to 'wanderingSoldat' — must be named in the message", hit || 'validated clean');
    }
    // M5 — a short row appended to a real CSV (the dropped comma, table form).
    {
      const d = join(tmp, 'm5-src');
      cpSync(SRC, d, { recursive: true });
      const csv = readdirSortedSync(d).find((f) => f.endsWith('.csv'));
      writeFileSync(join(d, csv), readFileSync(join(d, csv), 'utf8').replace(/\n*$/, '\nx\n'));
      let msg = null;
      try { compileDir(d, join(tmp, 'm5-out'), { write: false }); } catch (e) { if (e instanceof BuildError) msg = e.message; else throw e; }
      report(!!msg && msg.includes(csv) && msg.includes('row'), 'M5', `short row appended to real ${csv} — file and row named`, msg || 'compiled clean');
    }
    // M6 — a real sprite moved to the wrong folder.
    {
      const a = join(tmp, 'm6-assets');
      cpSync(join(ROOT, 'assets'), a, { recursive: true });
      mkdirSync(join(a, 'bg'), { recursive: true });
      renameSync(join(a, 'sprites', 'enemy_wanderingSoldier.webp'), join(a, 'bg', 'enemy_wanderingSoldier.webp'));
      const r = sweepAssets(a, b);
      const hit = r.errors.find((m) => m.includes('WRONG FOLDER') && m.includes('enemy_wanderingSoldier.webp'));
      report(!!hit, 'M6', 'real sprite enemy_wanderingSoldier.webp moved to assets/bg', hit || `sweep clean (${r.errors.length} errors)`);
    }
    // M7 — an orphan sprite planted beside the real ones.
    {
      const a = join(tmp, 'm7-assets');
      cpSync(join(ROOT, 'assets'), a, { recursive: true });
      writeFileSync(join(a, 'sprites', 'enemy_wanderingSoldat.webp'), 'x');
      const r = sweepAssets(a, b);
      const hit = r.errors.find((m) => m.includes('NAMES NO ENEMY') && m.includes('wanderingSoldat'));
      report(!!hit, 'M7', 'orphan sprite enemy_wanderingSoldat.webp planted in assets/sprites', hit || `sweep clean (${r.errors.length} errors)`);
    }

    printBoundary();
    if (bad) { console.error(`\ncontent-build --mutate: ${bad} case(s) MISSED. The corpus does not kill what it claims to.`); process.exit(1); }
    console.log('\ncontent-build --mutate: OK — 7 reinstatements of real defects, 7 caught, each by name.');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (SELFTEST) {
  await selftest();
} else if (MUTATE) {
  await mutate();
} else {
  let r;
  try {
    r = compileDir(SRC, OUT, { write: !CHECK });
  } catch (e) {
    if (e instanceof BuildError) fail(e.message);
    throw e;
  }
  // The stray-source sweep runs on EVERY plain build and --check — the person
  // it protects runs exactly this command after saving a spreadsheet (m5/S2).
  const stray = sweepStraySources(join(ROOT, 'content'));
  if (stray.length) {
    fail(`stray source file(s) the compile will never read:\n  ${stray.join('\n  ')}`);
  }
  const { SFX_RECIPES, SFX_FAMILY_IDS } = await import('../src/content/sfx.js');
  const sfxAuthority = sweepSfxAuthority(join(ROOT, 'src'), SFX_RECIPES, SFX_FAMILY_IDS);
  if (sfxAuthority.errors.length) {
    fail(`SFX caller/table authority defect(s):\n  ${sfxAuthority.errors.join('\n  ')}`);
  }
  if (CHECK && r.stale) {
    fail(`${r.stale} generated file(s) are out of date — run: node tools/content-build.mjs`);
  }
  if (CHECK && r.orphans.length) {
    fail(`orphaned generated file(s) with no source: ${r.orphans.join(', ')} — delete them or restore their source`);
  }
  console.log(CHECK ? 'content-build: generated files are current' : 'content-build: OK');
  console.log(`SFX_FAMILY_IDS [${SFX_FAMILY_IDS.join(', ')}] — sfx authority: ${sfxAuthority.literalIds + sfxAuthority.composedFamilies} caller id(s), ${Object.keys(SFX_RECIPES).length} recipe row(s), 0 defect(s)`);
  for (const o of r.orphans) console.log(`  ORPHANED src/content/generated/${o} — no source file produces it; it ships stale`);
  for (const res of r.results) console.log(`  ${res.file.padEnd(16)} → src/content/generated/${res.name}.js  (${res.rows} rows)`);
}
