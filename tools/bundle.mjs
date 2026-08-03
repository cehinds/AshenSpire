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
import { readdirSortedSync } from './dirorder.mjs';
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

function fail(msg) {
  console.error('bundle.mjs: ERROR — ' + msg);
  process.exit(1);
}

// Repo-relative POSIX id for a file (e.g. "src/main.js"), used as module key.
function idOf(absPath) {
  return relative(ROOT, absPath).split(/[\\/]/).join('/');
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
// 3. Transform each module source: imports -> require, strip exports, and
//    append Object.assign(module.exports, {...}) for the collected names.
// ---------------------------------------------------------------------------

// Rewrite a single import statement (already isolated as `stmt`) into a require.
// Returns the replacement string.
function rewriteImport(stmt, fromAbs) {
  // Namespace import:  import * as N from '...'
  let m = /^([ \t]*)import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s*['"]([^'"]+)['"][ \t]*;?[ \t]*$/.exec(stmt);
  if (m) {
    const [, indent, name, spec] = m;
    const id = idOf(resolveSpecifier(fromAbs, spec));
    return `${indent}const ${name} = require(${JSON.stringify(id)});`;
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
    return `${indent}const { ${parts.join(', ')} } = require(${JSON.stringify(id)});`;
  }

  // Side-effect-only import:  import '...'
  m = /^([ \t]*)import\s*['"]([^'"]+)['"][ \t]*;?[ \t]*$/.exec(stmt);
  if (m) {
    const [, indent, spec] = m;
    const id = idOf(resolveSpecifier(fromAbs, spec));
    return `${indent}require(${JSON.stringify(id)});`;
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

const entryId = idOf(entryAbs);
const moduleEntries = order
  .map((id) => {
    const body = guardScript(transformed.get(id));
    return `${JSON.stringify(id)}: function (module, exports, require) {\n${body}\n}`;
  })
  .join(',\n');

const runtime = `(function () {
  "use strict";
  var __modules = {
${moduleEntries}
  };
  var __cache = {};
  function require(id) {
    if (Object.prototype.hasOwnProperty.call(__cache, id)) return __cache[id].exports;
    var factory = __modules[id];
    if (!factory) throw new Error("Module not found: " + id);
    var module = { exports: {} };
    __cache[id] = module;
    factory(module, module.exports, require);
    return module.exports;
  }
  require(${JSON.stringify(entryId)});
})();`;

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

const outDir = resolve(ROOT, 'build');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, 'AshenSpire.html');
writeFileSync(outPath, html, 'utf8');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const bytes = Buffer.byteLength(html, 'utf8');
const kib = (bytes / 1024).toFixed(1);
console.log('bundle.mjs: OK');
console.log('  entry            : ' + entryId);
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
  console.log('  literal refs     : all resolve');
}
console.log('  output           : ' + idOf(outPath));
console.log('  output size      : ' + bytes + ' bytes (' + kib + ' KiB)');
process.exit(0);
