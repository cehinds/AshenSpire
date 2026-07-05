#!/usr/bin/env node
// tools/bundle.mjs — produce a standalone, single-file, double-click-to-play
// build of EldenSpire at build/EldenSpire.html.
//
// Zero dependencies (Node core only). Reads index.html, inlines every
// stylesheet, statically walks the ES-module import graph from src/main.js,
// and rewrites each module into a per-module CommonJS-style closure so the
// whole game runs from one classic <script> under file:// with no bundler,
// no server, and no module/CORS constraints.
//
// Usage: node tools/bundle.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

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
// 4. Emit build/EldenSpire.html
// ---------------------------------------------------------------------------

// Inline CSS in index.html order.
const styleBlocks = cssHrefs.map((href) => {
  const cssAbs = resolve(ROOT, href);
  if (!existsSync(cssAbs)) fail('stylesheet not found: ' + href);
  const css = readFileSync(cssAbs, 'utf8');
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

const title = (/<title>([\s\S]*?)<\/title>/i.exec(indexHtml) || [, 'EldenSpire'])[1].trim();

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
const outPath = resolve(outDir, 'EldenSpire.html');
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
console.log('  output           : ' + idOf(outPath));
console.log('  output size      : ' + bytes + ' bytes (' + kib + ' KiB)');
process.exit(0);
