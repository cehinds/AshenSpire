#!/usr/bin/env node
// tools/bundle.mjs — produce a standalone, single-file, double-click-to-play
// build of AshenSpire at build/AshenSpire.html.
//
// Zero dependencies (Node core only). Reads index.html, inlines every
// stylesheet, statically walks the ES-module import graph from src/main.js,
// and rewrites each module into a per-module CommonJS-style closure so the
// whole game runs from one classic <script> under file:// with no bundler,
// no server, and no module/CORS constraints.
//
// Usage: node tools/bundle.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { readdirSortedSync } from './dirorder.mjs';
import { sourceDigest, stampSource, bumpOrdinal, padOrdinal, ORDINAL_HOME, VERSION_MODULE, RUN_PATH_BUNDLE } from './buildversion.mjs';
import { dirname, resolve, relative, posix, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Shared by the CSS url() pass and the assets/ sweep, so it is declared up here
// rather than beside either of them (const is not hoisted).
//
// Audio is here BEFORE any audio exists, deliberately. Vira's finding: the sweep
// skips unknown extensions silently, so the first .ogg anyone adds would be
// dropped from the single-file build without a word — and we would rediscover
// the art-less-build bug in a new medium. sfx.js and music.js already document
// the hooks (SFX_MANIFEST / MUSIC_MANIFEST), so the day they get used is coming.
const MIME = {
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.m4a': 'audio/mp4', '.woff2': 'font/woff2',
};

// Repo-relative POSIX id for a file (e.g. "src/main.js"), used as module key.
function idOf(absPath) {
  return relative(ROOT, absPath).split(/[\\/]/).join('/');
}

// ---------------------------------------------------------------------------
// REFUSAL — one home for the output path, one home for the page, and the write
// is bound to the EXIT CODE rather than to any particular refusal path.
//
// #77 shipped property 3 — "a refused write must not leave a stale bundle
// silently in place" — on the parse path ONLY. Measured at d51b8e0, SEVEN of
// eight refusal paths left the previous good bundle standing at the output,
// byte-identical (d7373dde…) before and after: the strictness assertions, the
// language probe, an unresolved import, a non-relative import, an unhandled
// export form, a missing stylesheet. And the dangling-literal-asset check —
// which runs AFTER the write — printed `bundle.mjs: OK`, wrote a full 1.9 MiB
// PLAYABLE game, and then exited 1. A refusal that ships is worse than a
// refusal that leaves yesterday's build, and both are worse than the blank
// screen #77 already fixed, because Constantine's edit reads as "nothing
// happened" instead of as something visibly broken.
//
// WHY THE EXIT CODE AND NOT fail(). The obvious collapse is "whatever refuses
// writes the page" — put the write inside fail(). That closes today's seven and
// still lets tomorrow's eighth forget, because it only binds paths that go
// through fail(): a bare `process.exit(2)`, a throw, an assertion library, a
// future author who writes his own error exit. Binding to a NON-ZERO EXIT binds
// to the one thing every refusal has in common and none of them can route
// around. fail() below records a reason; it does not write. There is exactly
// one writer of this page, it sits on the way out, and a new refusal path
// cannot forget it because it never has to remember it.
// ---------------------------------------------------------------------------
const OUT_DIR = resolve(ROOT, 'build');
const OUT_PATH = resolve(OUT_DIR, 'AshenSpire.html');

// Reasons collected by fail(). May legitimately be empty — a throw or a bare
// exit has none — and the page says so rather than inventing one.
const refusals = [];

function refusalPage(items, code) {
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const body = items.length
    ? `<ul>${items
        .map((e) => `<li>${e.id ? `<code>${esc(e.id)}${e.line ? ':' + e.line : ''}</code> — ` : ''}${esc(e.message)}</li>`)
        .join('')}</ul>`
    : `<ul><li>The build exited <code>${esc(code)}</code> without naming a reason. Run
       <code>node tools/bundle.mjs</code> in a terminal and read what it printed.</li></ul>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Ashen Spire — build failed</title>
<style>
 body{background:#14110f;color:#e8dfd2;font:16px/1.5 ui-monospace,Menlo,Consolas,monospace;margin:0;padding:32px}
 h1{color:#c9a227;font-size:20px;margin:0 0 8px}
 p{margin:0 0 16px;max-width:60rem}
 li{margin:0 0 6px}
 code{color:#ff8f6b}
</style></head><body>
<h1>This build did not happen</h1>
<p>The build refused, so no game was written. <strong>This page is standing
where the game would be</strong> — you are not looking at an older build by mistake.
Fix what it names below and build again.</p>
${body}
<p>Built ${new Date().toISOString()}</p>
</body></html>
`;
}

process.on('exit', (code) => {
  if (code === 0) return;
  try {
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(OUT_PATH, refusalPage(refusals, code), 'utf8');
    console.error('  ' + idOf(OUT_PATH) + ' now holds a build-failed page, not a game.');
  } catch (err) {
    // Never mask the original failure with the failure to report it.
    console.error('  bundle.mjs: could not replace ' + idOf(OUT_PATH) + ' (' + err.message + ')'
      + ' — whatever is there now is NOT this build.');
  }
  // dist/ is a committed artifact and this tool does not own it; say plainly
  // that it is now older than the sources rather than quietly corrupting it.
  if (existsSync(resolve(ROOT, 'dist/AshenSpire.html'))) {
    console.error('  NOTE: dist/AshenSpire.html is untouched and therefore OLDER than these sources — do not run it and do not ship it until this builds.');
  }
});

function fail(msg, items) {
  console.error('bundle.mjs: ERROR — ' + msg);
  refusals.push(...(items && items.length ? items : [{ message: msg }]));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Parse index.html: ordered stylesheet hrefs + module entry src.
// ---------------------------------------------------------------------------
const indexPath = resolve(ROOT, 'index.html');
if (!existsSync(indexPath)) fail('index.html not found at ' + indexPath);
const indexHtml = readFileSync(indexPath, 'utf8');

const cssHrefs = [];
{
  const re = /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi;
  let m;
  while ((m = re.exec(indexHtml)) !== null) {
    const hrefMatch = /\bhref=["']([^"']+)["']/i.exec(m[0]);
    if (hrefMatch) cssHrefs.push(hrefMatch[1]);
  }
}
if (cssHrefs.length === 0) fail('no <link rel="stylesheet"> found in index.html');

let entrySrc = null;
{
  const m = /<script\b[^>]*\btype=["']module["'][^>]*>/i.exec(indexHtml);
  if (m) {
    const srcMatch = /\bsrc=["']([^"']+)["']/i.exec(m[0]);
    if (srcMatch) entrySrc = srcMatch[1];
  }
}
if (!entrySrc) fail('no <script type="module" src="..."> entry found in index.html');

// ---------------------------------------------------------------------------
// 2. Statically walk the import graph from the entry module.
// ---------------------------------------------------------------------------

// Match an import statement anchored at line start (optional leading whitespace).
// Captures the whole statement including a possibly multi-line brace list.
// Forms handled:
//   import { a, b as c } from './x.js';
//   import { \n a, \n b, \n } from './x.js';
//   import * as N from './x.js';
//   import './x.js';                       (side-effect only)
const IMPORT_RE =
  /^[ \t]*import\b(?:[\s\S]*?)from\s*['"]([^'"]+)['"][ \t]*;?[ \t]*$|^[ \t]*import\s+['"]([^'"]+)['"][ \t]*;?[ \t]*$/gm;

function resolveSpecifier(fromAbs, spec) {
  if (!spec.startsWith('.')) {
    fail(
      'non-relative import "' + spec + '" in ' + idOf(fromAbs) +
      ' — the bundler only supports relative imports'
    );
  }
  const abs = resolve(dirname(fromAbs), spec);
  if (!existsSync(abs)) {
    fail('unresolved import "' + spec + '" from ' + idOf(fromAbs) + ' (looked at ' + abs + ')');
  }
  return abs;
}

// Discover the set of dependency specifiers in a module source.
function findImportSpecifiers(src, fromAbs) {
  const specs = [];
  IMPORT_RE.lastIndex = 0;
  let m;
  while ((m = IMPORT_RE.exec(src)) !== null) {
    const spec = m[1] !== undefined ? m[1] : m[2];
    specs.push(spec);
  }
  // Guard against dynamic import() slipping through — should already be absent.
  if (/\bimport\s*\(/.test(src)) {
    fail('dynamic import() found in ' + idOf(fromAbs) + ' — not supported by this bundler');
  }
  return specs;
}

const entryAbs = resolve(ROOT, entrySrc);
if (!existsSync(entryAbs)) fail('entry module not found: ' + entrySrc);

// Graph walk (DFS), collecting modules in a stable order and detecting the set.
const sources = new Map(); // id -> raw source
const depsById = new Map(); // id -> [resolved ids]
const order = []; // discovery order (not strictly needed, but stable)

function visit(absPath) {
  const id = idOf(absPath);
  if (sources.has(id)) return;
  // Normalize CRLF -> LF at read time so all anchored regexes (import & export
  // matching) behave identically regardless of the file's line endings.
  const src = readFileSync(absPath, 'utf8').replace(/\r\n?/g, '\n');
  sources.set(id, src);
  const specs = findImportSpecifiers(src, absPath);
  const deps = specs.map((s) => resolveSpecifier(absPath, s));
  depsById.set(id, deps.map(idOf));
  order.push(id);
  for (const d of deps) visit(d);
}
visit(entryAbs);

// ---------------------------------------------------------------------------
// 2b. Carry the art inside the file.
//
// Rendered images are referenced by paths BUILT AT RUNTIME
// (`assets/equipment/weapon_${id}.webp`), so no amount of source reading finds
// them — which is exactly how the standalone build shipped for months with the
// sprites silently falling back to placeholder rectangles. So: sweep assets/
// wholesale and hand the result to src/ui/assetmap.js, whose assetUrl() prefers
// the map when it is populated.
//
// Every file under assets/ goes in. Being deliberate about which ones is how
// the last hole opened; a build that carries one asset too many is a kilobyte,
// a build that misses one is a bug nobody sees.
// ---------------------------------------------------------------------------
const ASSET_DIR = resolve(ROOT, 'assets');
const ASSET_MAP_ID = 'src/ui/assetmap.js';

function walkAssets(dir) {
  const out = [];
  // Sorted, not raw: the filesystem's order is a property of the machine, and it
  // reached the shipped bundle. tools/dirorder.mjs carries the whole reason.
  for (const entry of readdirSortedSync(dir, { withFileTypes: true })) {
    const abs = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkAssets(abs));
    else out.push(abs);
  }
  return out;
}

let mapEntries = 0;
let mapBytes = 0;
const skipped = []; // files under assets/ with no MIME mapping — reported, not silent
if (existsSync(ASSET_DIR) && sources.has(ASSET_MAP_ID)) {
  const pairs = [];
  for (const abs of walkAssets(ASSET_DIR)) {
    const mime = MIME[extname(abs).toLowerCase()];
    if (!mime) {
      // A LOUD COUNTER beside a quiet fallback. Skipping unknown types is the
      // right behaviour — README.md and .blend files don't belong in the
      // bundle — but skipping them SILENTLY is how the art vanished for months.
      // The build now says what it left behind.
      skipped.push(idOf(abs));
      continue;
    }
    const buf = readFileSync(abs);
    const key = posix.join('assets', relative(ASSET_DIR, abs).split(/[\\/]/g).join('/'));
    pairs.push(`  ${JSON.stringify(key)}: "data:${mime};base64,${buf.toString('base64')}"`);
    mapEntries += 1;
    mapBytes += buf.length;
  }
  const src = sources.get(ASSET_MAP_ID);
  if (!/\/\* ASSET_MAP_START \*\/[\s\S]*?\/\* ASSET_MAP_END \*\//.test(src)) {
    fail(`${ASSET_MAP_ID} has lost its ASSET_MAP markers — the bundler anchors on them`);
  }
  sources.set(
    ASSET_MAP_ID,
    src.replace(
      /\/\* ASSET_MAP_START \*\/[\s\S]*?\/\* ASSET_MAP_END \*\//,
      `/* ASSET_MAP_START */\nexport const ASSET_MAP = {\n${pairs.join(',\n')}\n};\n/* ASSET_MAP_END */`
    )
  );
}

// ---------------------------------------------------------------------------
// 2c. THE BUILD VERSION — DERIVED HERE, NEVER TYPED IN THE TREE.
//
// Constantine asked for the build version on three screens. The reasoning for
// the scheme lives in src/buildversion.js; the two facts this file needs are:
//
//   · the digest is a function of the SOURCE ON DISK, so a rebuild from the
//     same tree produces the same bytes and tools/rebuild-matches.mjs stays
//     GREEN. A ref-derived stamp would make that check red forever, and it is
//     the only generative one in the tree.
//   · the injection is IN MEMORY, exactly like ASSET_MAP above. Nothing is
//     written back to src/, so the file the digest covers never moves because
//     of the digest, and there is no second-order commit to chase.
//   · THE ORDINAL IS THE ONE EXCEPTION AND IT IS WRITTEN, NOT INJECTED FROM
//     THIN AIR. It cannot be re-derived on the spot, because it is a fact of
//     HISTORY and history advances by exactly the commit that carries this
//     bundle. So it is computed once, here, and COMMITTED — which turns it into
//     a fact of the source tree, the only kind this bundle may carry. The write
//     is conditional on the digest having moved, which is what keeps
//     rebuild-matches green; see bumpOrdinal().
//
// It refuses rather than skips. A bundler that quietly ships `UNSTAMPED`
// because a marker got renamed hands a player a version that says nothing,
// and says nothing about saying nothing.
// ---------------------------------------------------------------------------
if (!sources.has(VERSION_MODULE)) {
  fail(`${VERSION_MODULE} is not in the import graph — no screen in this build could say which build drew it`);
}
let buildDigest = null;
try {
  // THE ONE PLACE THE ORDINAL IS EVER WRITTEN — Constantine's "auto bump on
  // build", taken at its word. It rewrites buildordinal.json only when the
  // digest has moved, so a rebuild of an unchanged tree writes nothing and
  // reproduces the committed bundle byte for byte (tools/rebuild-matches.mjs).
  // tools/serve.mjs deliberately does NOT do this: a dev server that bumped
  // would burn an ordinal per reload and dirty the tree doing it.
  const ord = bumpOrdinal(ROOT);
  buildDigest = ord.digest;
  if (ord.bumped) console.log(`bundle: build ordinal → ${padOrdinal(ord.ordinal)} (the source moved; ${ORDINAL_HOME} rewritten)`);
  // THE RUN PATH IS SAID HERE BECAUSE ONLY HERE KNOWS IT. What this function
  // produces is one HTML file a player opens on its own; tools/serve.mjs says
  // the other thing in its own words. Neither infers, and there is no third
  // site that could disagree with both.
  sources.set(VERSION_MODULE, stampSource(sources.get(VERSION_MODULE), buildDigest, {
    ordinal: padOrdinal(ord.ordinal),
    built: ord.built,
    runPath: RUN_PATH_BUNDLE,
  }));
} catch (err) {
  fail(`could not derive the build version: ${err.message}`);
}

// ---------------------------------------------------------------------------
// 3. Transform each module source: imports -> require, strip exports, and
//    append Object.assign(module.exports, {...}) for the collected names.
// ---------------------------------------------------------------------------

// Rewrite a single import statement (already isolated as `stmt`) into a require.
// Returns the replacement string.
// Keep the rewritten statement on the same number of lines as the original.
// A multi-line `import { a,\n b } from '...'` collapsing to one line shifts
// every line below it, and then a parse error's reported line points at the
// wrong place — a check that names the wrong line is worse than one that names
// none (#77 property 2).
function padLines(original, replacement) {
  const lost = original.split('\n').length - replacement.split('\n').length;
  return lost > 0 ? replacement + '\n'.repeat(lost) : replacement;
}

function rewriteImport(stmt, fromAbs) {
  // Namespace import:  import * as N from '...'
  let m = /^([ \t]*)import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s*['"]([^'"]+)['"][ \t]*;?[ \t]*$/.exec(stmt);
  if (m) {
    const [, indent, name, spec] = m;
    const id = idOf(resolveSpecifier(fromAbs, spec));
    return padLines(stmt, `${indent}const ${name} = require(${JSON.stringify(id)});`);
  }

  // Named import (possibly multi-line):  import { a, b as c } from '...'
  m = /^([ \t]*)import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"][ \t]*;?[ \t]*$/.exec(stmt);
  if (m) {
    const [, indent, body, spec] = m;
    const id = idOf(resolveSpecifier(fromAbs, spec));
    const parts = body
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const am = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(s);
        if (am) return `${am[1]}: ${am[2]}`; // { a as c } -> { a: c }
        return s;
      });
    return padLines(stmt, `${indent}const { ${parts.join(', ')} } = require(${JSON.stringify(id)});`);
  }

  // Side-effect-only import:  import '...'
  m = /^([ \t]*)import\s*['"]([^'"]+)['"][ \t]*;?[ \t]*$/.exec(stmt);
  if (m) {
    const [, indent, spec] = m;
    const id = idOf(resolveSpecifier(fromAbs, spec));
    return padLines(stmt, `${indent}require(${JSON.stringify(id)});`);
  }

  fail('could not parse import statement in ' + idOf(fromAbs) + ':\n' + stmt);
}

// Transform export declarations/statements line-anchored, and gather names.
function transformModule(id, src, absPath) {
  const exportedNames = new Set();

  // First, rewrite import statements (may span multiple lines). We do this by
  // matching whole import statements with the same anchored regex used for
  // discovery, and replacing each with its require() form.
  let out = src.replace(IMPORT_RE, (stmt) => rewriteImport(stmt, absPath));

  // Now process exports, line by line, anchored at line start. Normalize CRLF
  // to LF so anchored per-line regexes (which use `$`, and `.` that excludes
  // \r) match cleanly regardless of the source file's line endings.
  const lines = out.replace(/\r\n?/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // export { a, b as c };   (re-export of local bindings; no `from`)
    let m = /^([ \t]*)export\s*\{([^}]*)\}\s*;?[ \t]*$/.exec(line);
    if (m) {
      const body = m[2];
      body
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => {
          const am = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(s);
          exportedNames.add(am ? am[2] : s); // exported-as name is what's public
        });
      lines[i] = ''; // drop the statement; assignment appended at end of module
      continue;
    }

    // export function NAME / export class NAME
    m = /^([ \t]*)export\s+(async\s+)?(function\*?|class)\s+([A-Za-z_$][\w$]*)/.exec(line);
    if (m) {
      exportedNames.add(m[4]);
      lines[i] = line.replace(/^([ \t]*)export\s+/, '$1');
      continue;
    }

    // export const/let/var NAME (possibly multiple declarators on the line)
    m = /^([ \t]*)export\s+(const|let|var)\s+(.*)$/.exec(line);
    if (m) {
      // Collect the leading identifier of each top-level declarator on this line.
      // Sources here declare one name per `export const` line, but handle the
      // simple `a = ..., b = ...` case defensively by taking each declarator's head.
      const declHead = m[3];
      // Grab the first identifier (the binding name). Destructuring is not used
      // in any `export const` in this codebase; take the leading identifier.
      const nameMatch = /^([A-Za-z_$][\w$]*)/.exec(declHead.trim());
      if (nameMatch) exportedNames.add(nameMatch[1]);
      lines[i] = line.replace(/^([ \t]*)export\s+/, '$1');
      continue;
    }

    // Any other `export ...` we did not anticipate — fail loudly.
    if (/^[ \t]*export\b/.test(line)) {
      fail('unhandled export form in ' + id + ' at line ' + (i + 1) + ':\n' + line);
    }
  }

  let body = lines.join('\n');

  // Append the exports assignment (only if there is something to export).
  if (exportedNames.size > 0) {
    const names = [...exportedNames];
    body += `\n\nObject.assign(module.exports, { ${names.join(', ')} });\n`;
  }

  return { body, exportedNames: [...exportedNames] };
}

const transformed = new Map(); // id -> body
for (const id of order) {
  const absPath = resolve(ROOT, id);
  const { body } = transformModule(id, sources.get(id), absPath);
  // Post-condition: no stray top-level import/export keywords remain.
  if (/^[ \t]*(import|export)\b/m.test(body)) {
    const badLine = body.split('\n').find((l) => /^[ \t]*(import|export)\b/.test(l));
    fail('module ' + id + ' still has a top-level import/export after transform:\n' + badLine);
  }
  transformed.set(id, body);
}

// ---------------------------------------------------------------------------
// 4. Emit build/AshenSpire.html
// ---------------------------------------------------------------------------

// Assets referenced from CSS url(...) must travel INSIDE the single file, or
// the standalone build silently loses them (the act backdrops, and anything
// added later). Rewrite each url() to a base64 data: URI, resolved relative to
// the stylesheet. Absolute/remote/data: urls are left alone; a missing file is
// a hard fail rather than a silently blank background.
let inlinedAssets = 0;
let inlinedAssetBytes = 0;

function inlineCssUrls(css, cssAbs) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, _q, ref) => {
    if (/^(data:|https?:|\/\/)/i.test(ref)) return whole;
    const assetAbs = resolve(dirname(cssAbs), ref.split('?')[0].split('#')[0]);
    if (!existsSync(assetAbs)) fail(`asset referenced from CSS not found: ${ref}`);
    const ext = extname(assetAbs).toLowerCase();
    const mime = MIME[ext];
    if (!mime) fail(`unsupported CSS asset type '${ext}' for ${ref}`);
    const buf = readFileSync(assetAbs);
    inlinedAssets += 1;
    inlinedAssetBytes += buf.length;
    return `url("data:${mime};base64,${buf.toString('base64')}")`;
  });
}

// Inline CSS in index.html order.
const styleBlocks = cssHrefs.map((href) => {
  const cssAbs = resolve(ROOT, href);
  if (!existsSync(cssAbs)) fail('stylesheet not found: ' + href);
  const css = inlineCssUrls(readFileSync(cssAbs, 'utf8'), cssAbs);
  return `  <style data-src="${href}">\n${css}\n  </style>`;
});

// Build the module registry. Guard the closing script tag inside sources by
// splitting any literal "</script" occurrence (none expected, but be safe).
function guardScript(s) {
  return s.replace(/<\/script/gi, '<\\/script');
}

// ---------------------------------------------------------------------------
// PARSE GATE (#77) — refuse to write a bundle we could not parse.
//
// Law 1 clause 5 already named this failure in its own words: "a syntax error
// that dies before the validator runs and hands Constantine a blank screen
// violates this clause even while the validator is perfect." It was not a new
// finding, it was an unpaid one. Reproduced on dev before this was written: one
// dropped brace in src/content/statuses.js gave `bundle.mjs: OK`, exit 0,
// `verify-shipped: OK — 4 checks passed`, and a game whose #app had ZERO
// children. Only tests/run-node.mjs caught it, and the edit-and-run path does
// not go through the suite.
//
// This file already reads every module; all it lacked was the nerve to check
// what it read. Each transformed body is compiled — not executed — and a
// failure names the FILE and the LINE, because clause 5's whole demand is that
// bad data names the entry. Line numbers are exact because rewriteImport pads
// its replacements to the original line count (see padLines).
// ONE HOME for the module wrapper. Bjorn's defect: the comment below used to
// claim each body was "compiled inside the same wrapper the runtime uses" while
// the gate and the runtime were TWO COPIES with nothing checking they agree —
// and they disagreed on the thing that matters. The runtime's factories sit
// inside `"use strict"` (the IIFE below); the gate's did not. So the gate
// parsed sloppy and the browser parsed strict, and a whole class walked
// through: `energy: 010` built clean, exit 0, and handed over a blank screen
// with only `Octal literals are not allowed in strict mode` in the console.
// Duplicate parameter names, `with`, and `delete x` passed the same way.
//
// The hole was invisible for a specific reason worth keeping: src/ is ESM and
// therefore ALREADY STRICT — and the transform strips the import/export that
// made it so. The gate was the one place the strictness had to be restored by
// hand, and it was the one place nobody did.
//
// This is Law 0's fourth clause pointed at the gate that enforces Law 1
// clause 5, so the fix is not just "add the words": the signature has ONE home
// and the runtime's strictness is ASSERTED below rather than assumed.
//
// #77 left two more copies of exactly this shape behind, and both are closed
// here. They are one class, not two bugs: a second copy IS an instrument that
// cannot fail, because nothing is checking the copies against each other.
//
//   1. The runtime-strictness guard below was a REGEX over `runtime` — and
//      `runtime` is this template AFTER all 93 module bodies are interpolated
//      into it. So any content file containing the most ordinary preamble in
//      JavaScript, `(function () { "use strict"; … })()`, satisfied it.
//      Reproduced at 18aab6f: runtime directive removed plus one such preamble
//      in src/content/balance.js gave `bundle.mjs: OK`, exit 0, and a shipped
//      runtime whose IIFE was not strict. The regex is DELETED, not tightened:
//      a regex that "looks right" is an instrument that cannot fail, and no
//      amount of tightening changes where it looks. The wrapper's opening text
//      is a named constant and the assertion is `startsWith` against it —
//      content lives after position 0 and can never satisfy that.
//   2. The loader's `factory(module, module.exports, require)` call was a
//      second copy of MODULE_FN's parameter list. Reproduced at 18aab6f: give
//      MODULE_FN a fourth parameter the way Bjorn did and the emitted bundle
//      declares four and is called with three, exit 0, nothing said so. The
//      parameters and the arguments now come from ONE table.
//
// STRICT_DIRECTIVE is one home for a THIRD copy, and it is load-bearing rather
// than tidy: `startsWith(RUNTIME_OPEN)` cannot see a hand that edits
// RUNTIME_OPEN itself, so hoisting alone would have traded the regex's
// false-pass for a blind spot the regex did not have. With the gate's prologue
// and the runtime's opening built from the same token, gate-sloppy /
// browser-strict — #77's whole defect — is not expressible.
const STRICT_DIRECTIVE = '"use strict";';

// The module factory's signature, one home: [parameter name, the argument the
// loader passes for it]. Both the declaration and the call site are derived
// from this, so an added parameter reaches both or neither.
const MODULE_SIGNATURE = [
  ['module', 'module'],
  ['exports', 'module.exports'],
  ['require', 'require'],
];
const MODULE_FN = `function (${MODULE_SIGNATURE.map(([param]) => param).join(', ')}) {`;
const MODULE_CALL = `factory(${MODULE_SIGNATURE.map(([, arg]) => arg).join(', ')});`;

// The runtime IIFE's opening — the text the strictness assertion checks, and
// the reason it can be checked at all.
const RUNTIME_OPEN = `(function () {\n  ${STRICT_DIRECTIVE}\n`;

const parseErrors = [];
for (const id of order) {
  const body = transformed.get(id);
  try {
    // Same signature as the runtime (MODULE_FN, one home) and — the part that
    // was missing — the same STRICTNESS, now from the same token the runtime
    // opens with (STRICT_DIRECTIVE, one home). The directive shares the
    // wrapper's opening line so the body still starts on line 2 and the -1
    // offset below stays exact. Compiling never runs it.
    new vm.Script(`${STRICT_DIRECTIVE} (${MODULE_FN}\n${body}\n})`, { filename: id });
  } catch (err) {
    // vm reports the line within the wrapper; subtract the line we added.
    const at = /:(\d+)\n/.exec(err.stack || '');
    const line = at ? Math.max(1, Number(at[1]) - 1) : null;
    parseErrors.push({ id, line, message: (err.message || String(err)).split('\n')[0] });
  }
}

if (parseErrors.length) {
  // PROPERTY 3, and it is no longer this path's private business. The page,
  // the output path and the dist/ note used to be written HERE, which is why
  // the other seven refusal paths did not have them. They live at the one home
  // above now; this path only supplies the rows, which is the one thing it
  // knows that the exit hook does not.
  const rows = parseErrors
    .map((e) => `  ${e.id}${e.line ? ':' + e.line : ''}  ${e.message}`)
    .join('\n');
  fail('refusing to write a bundle that does not parse:\n' + rows, parseErrors);
}

const entryId = idOf(entryAbs);
const moduleEntries = order
  .map((id) => {
    const body = guardScript(transformed.get(id));
    return `${JSON.stringify(id)}: ${MODULE_FN}\n${body}\n}`;
  })
  .join(',\n');

// ONE HOME for the loader. The real runtime and the signature probe below are
// the SAME code with a different registry — a probe against a re-typed copy of
// the loader would be a check on my transcription, not on what ships.
function assembleRuntime(entries, rootId) {
  return `${RUNTIME_OPEN}  var __modules = {
${entries}
  };
  var __cache = {};
  function require(id) {
    if (Object.prototype.hasOwnProperty.call(__cache, id)) return __cache[id].exports;
    var factory = __modules[id];
    if (!factory) throw new Error("Module not found: " + id);
    var module = { exports: {} };
    __cache[id] = module;
    ${MODULE_CALL}
    return module.exports;
  }
  require(${JSON.stringify(rootId)});
})();`;
}

const runtime = assembleRuntime(moduleEntries, entryId);

const title = (/<title>([\s\S]*?)<\/title>/i.exec(indexHtml) || [, 'AshenSpire'])[1].trim();

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
${styleBlocks.join('\n')}
</head>
<body>
  <main id="app" aria-live="polite"></main>
  <script>
${runtime}
  </script>
</body>
</html>
`;

// The gate above compiles bodies as STRICT because the runtime runs them
// strict. That is an assumption about a string built further up this same file,
// and an unchecked assumption between two places is exactly what let the octal
// class through. So it is checked — twice, because the two ways this can rot
// are not the same failure and one assertion catches only one of them.
//
// (1) POSITION. The assembled runtime must OPEN with the wrapper, not merely
//     contain it somewhere. This is where the previous regex could not fail:
//     it searched all of `runtime`, which by this line holds every module body
//     in the game, so one `(function () { "use strict"; })()` in any content
//     file answered a question about the wrapper. `startsWith` asks about
//     position 0, and content is never at position 0.
if (!runtime.startsWith(RUNTIME_OPEN)) {
  fail(
    'the runtime no longer opens with RUNTIME_OPEN, so the parse gate (which\n'
    + '  compiles every module as strict) would now be checking a different language\n'
    + '  than the one the browser runs. The runtime must be assembled from\n'
    + '  RUNTIME_OPEN — do not re-type its opening lines.'
  );
}

// (2) LANGUAGE. `startsWith` is blind to a hand that edits RUNTIME_OPEN
//     itself — it would agree with any opening, including a sloppy one. So ask
//     the parser, not the text: put a strict-only fault where a module body
//     goes and require it to be REJECTED. Nothing in the bundle can satisfy
//     this one, because the probe is synthesised here rather than read.
let runtimeIsStrict = false;
try {
  new vm.Script(`${RUNTIME_OPEN}var __strictProbe = 010;\n})();`);
} catch {
  runtimeIsStrict = true;
}
if (!runtimeIsStrict) {
  fail(
    'RUNTIME_OPEN does not put module bodies in strict mode — an octal literal was\n'
    + '  accepted where a module body goes. The gate compiles every module as strict,\n'
    + '  so it would now be checking a different language than the one the browser\n'
    + '  runs. Restore the strict directive in RUNTIME_OPEN.'
  );
}

// (3) ARGUMENTS. MODULE_SIGNATURE gives the declaration and the call site one
//     home, so they cannot disagree about the COUNT. They can still agree on a
//     wrong answer: Bjorn planted ['exports', 'module'] at the one home, the
//     build exited 0, it shipped `factory(module, module, require);`, and all
//     44 cases stayed green. It is latent only because no module body reads
//     bare `exports` today (94 of 95 occurrences are `module.exports`; the
//     95th is the parameter list) — which is what makes it the silent kind.
//     His own sentence, turned on my fix: a consistency check is not a
//     correctness check.
//
//     So ask the loader to DO ITS JOB rather than to look right. A synthetic
//     module is run through the real loader — assembleRuntime, one home, so
//     this is the code that ships — and it writes an export under each of the
//     two names a body may use, then requires itself back. If `exports` is not
//     `module.exports`, one of the two writes lands on an object nobody will
//     ever read, and that is precisely the silent breakage. The probe is
//     synthesised here, never read from the tree, so no content file can
//     satisfy it. It executes only this synthetic module — no game code runs.
const SIGNATURE_PROBE_ID = '__signature_probe__';
const probeEntries = `${JSON.stringify(SIGNATURE_PROBE_ID)}: ${MODULE_FN}
  if (typeof require !== 'function') throw new Error('the loader did not pass a callable require');
  if (!module || typeof module !== 'object') throw new Error('the loader did not pass a module object');
  if (!module.exports || typeof module.exports !== 'object') throw new Error('module.exports is not an object');
  exports.viaExports = 'e';
  module.exports.viaModule = 'm';
  var back = require(${JSON.stringify(SIGNATURE_PROBE_ID)});
  if (back.viaModule !== 'm') throw new Error('require() did not return module.exports');
  if (back.viaExports !== 'e') throw new Error('exports is not module.exports — a body assigning to bare exports would be dropped');
  globalThis.__signatureProbeOK = true;
}`;
{
  const probeScope = { __signatureProbeOK: false };
  let why = null;
  try {
    vm.runInNewContext(assembleRuntime(probeEntries, SIGNATURE_PROBE_ID), probeScope,
      { filename: 'module-signature-probe' });
  } catch (err) {
    why = (err && err.message) || String(err);
  }
  if (probeScope.__signatureProbeOK !== true) {
    fail(
      'the module signature does not deliver what its parameter names promise:\n'
      + '    ' + (why || 'the probe did not finish, and did not say why') + '\n'
      + '  MODULE_SIGNATURE gives the declaration and the call site one home, which proves\n'
      + '  they AGREE — not that they are RIGHT. Each pair is [parameter, argument]; check\n'
      + '  that the argument really is the thing the parameter is named after.'
    );
  }
}

// ---------------------------------------------------------------------------
// Dangling literal asset references.
//
// The check that would have caught the art-less build, and Bjorn's shape: a
// content check whose scope stops one step short. Runtime-CONSTRUCTED paths
// (`assets/equipment/weapon_${id}.webp`) can't be verified statically — Vira
// audited those against the CSVs and found both directions clean. But a LITERAL
// path in shipped source can be, and it costs nothing.
//
// Comment lines are excluded: music.js documents `assets/sfx/card.ogg` as an
// example of a hook that is deliberately unused. Counting a documented example
// as a dangling reference is the same error as counting an unfired branch as a
// missing key — which is exactly the false positive Vira caught in her own audit
// an hour ago.
//
// MOVED ABOVE THE WRITE (2026-08-07). It used to run after it, so a dangling
// reference printed `bundle.mjs: OK`, wrote a full 1.9 MiB playable game, and
// THEN exited 1. Both "the build refused" and "the build wrote the game" were
// true of the same run. The exit hook now replaces that file, so the property
// held either way — but a refusal should not first do the thing it is refusing
// to do, and `OK` above an error is a line that lies to whoever reads it.
// It reads only `sources`, so it never needed to be down there.
// ---------------------------------------------------------------------------
{
  const LITERAL = /['"`](assets\/[A-Za-z0-9_\-./]+\.[a-z0-9]{2,5})['"`]/g;
  const dangling = [];
  for (const [id, src] of sources) {
    for (const line of src.split('\n')) {
      const t = line.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
      LITERAL.lastIndex = 0;
      let m;
      while ((m = LITERAL.exec(line)) !== null) {
        if (!existsSync(resolve(ROOT, m[1]))) dangling.push(`${id} → ${m[1]}`);
      }
    }
  }
  if (dangling.length) {
    fail(
      'literal asset reference(s) point at files that do not exist:\n    ' +
      dangling.join('\n    ') +
      '\n  Either add the file or remove the reference — a path the code states and the ' +
      'repo lacks fails silently at runtime.'
    );
  }
}

// The success write and the refusal write must aim at the same file or the
// whole property is a second copy of a path. OUT_DIR / OUT_PATH, one home.
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_PATH, html, 'utf8');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const bytes = Buffer.byteLength(html, 'utf8');
const kib = (bytes / 1024).toFixed(1);
console.log('bundle.mjs: OK');
console.log('  entry            : ' + entryId);
console.log('  build version    : ' + buildDigest + ' (derived from this source; node tools/buildversion.mjs --which ' + buildDigest + ')');
console.log('  modules bundled  : ' + order.length);
console.log('  stylesheets      : ' + cssHrefs.length + ' (' + cssHrefs.join(', ') + ')');
console.log('  css assets inlined: ' + inlinedAssets + ' (' + Math.round(inlinedAssetBytes / 1024) + ' KiB raw)');
console.log('  art inlined      : ' + mapEntries + ' files (' + Math.round(mapBytes / 1024) + ' KiB raw)');
if (skipped.length) {
  console.log('  skipped (no MIME): ' + skipped.length + ' — ' + skipped.slice(0, 4).join(', ') + (skipped.length > 4 ? ' …' : ''));
}
if (mapEntries === 0) {
  console.log('  WARNING          : no art inlined — the standalone build will show fallbacks');
}

console.log('  literal refs     : all resolve');
console.log('  output           : ' + idOf(OUT_PATH));
console.log('  output size      : ' + bytes + ' bytes (' + kib + ' KiB)');

// ---------------------------------------------------------------------------
// What this OK does not cover. SPEC §8 clause 5, and it was unpaid in the tool
// we just spent two commits hardening: nine lines of what the build did and
// nothing on what it did not. A boundary in a file header is read by whoever
// edits the tool; a boundary in the run's output is read by whoever is about
// to trust the green — and that is the person who needs it.
// ---------------------------------------------------------------------------
console.log('BOUNDARY: every module was COMPILED, never RUN. A file that parses and throws');
console.log('          on load builds clean here — that is node tests/run-node.mjs and the');
console.log('          browser. Strictness and the module signature are asserted through');
console.log('          node\'s parser and node\'s vm, so no browser has seen this bundle.');
console.log('          Only LITERAL asset paths were resolved; paths built at runtime');
console.log('          (`assets/x_${id}.webp`) are unchecked here — Vira audits those');
console.log('          against the CSVs. dist/ is not this tool\'s to check: that is');
console.log('          node tools/verify-shipped.mjs. Nothing above says the game plays.');
process.exit(0);
