// tests/layering.test.mjs — the rules layer imports nothing from the browser or the UI.
//
// Owner decision 2026-11-04 (Unity-port shape): game rules in src/engine/,
// src/model/ and engine/ stay headless. DEVELOPER.md, "The four layers".
// Fails with file:line on (a) an import that resolves into src/ui/ or src/main.js,
// (b) a browser global used outside comments and string literals.
// globalThis.crypto is allowed (injectable default, not a DOM dependency).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RULE_DIRS = ['src/engine', 'src/model', 'engine'];
const BROWSER_GLOBALS = ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'requestAnimationFrame', 'HTMLElement'];

// A future exception is a visible edit here: entries are 'path/to/file.js' (repo-relative, posix).
const ALLOW = [];

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|mjs)$/.test(e.name) && !e.name.endsWith('.generated.js')) out.push(p);
  }
  return out;
}

// Returns { noComments, code }: same length and line breaks as src.
// noComments keeps string literals (to read import specifiers); code blanks them too.
function scan(src) {
  let noComments = '', code = '';
  let i = 0;
  const n = src.length;
  const push = (a, b) => { noComments += a; code += b; };
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') {
      let j = i; while (j < n && src[j] !== '\n') j++;
      push(blank(src.slice(i, j)), blank(src.slice(i, j))); i = j;
    } else if (c === '/' && d === '*') {
      let j = src.indexOf('*/', i + 2); j = j < 0 ? n : j + 2;
      push(blank(src.slice(i, j)), blank(src.slice(i, j))); i = j;
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n && src[j] !== c) { if (src[j] === '\\') j++; if (c !== '`' && src[j] === '\n') break; j++; }
      j = Math.min(j + 1, n);
      push(src.slice(i, j), blank(src.slice(i, j))); i = j;
    } else { push(c, c); i++; }
  }
  return { noComments, code };
}

const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;

export function check(file, src) {
  const rel = relative(ROOT, file).split(sep).join('/');
  if (ALLOW.includes(rel)) return [];
  const { noComments, code } = scan(src);
  const bad = [];
  const spec = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(['"`])([^'"`\n]+)\1/g;
  for (let m; (m = spec.exec(noComments));) {
    if (!m[2].startsWith('.')) continue;
    const target = relative(ROOT, resolve(dirname(file), m[2])).split(sep).join('/');
    if (target === 'src/main.js' || target === 'src/ui' || target.startsWith('src/ui/')) {
      bad.push(`${rel}:${lineOf(noComments, m.index)} imports ${m[2]} (resolves into ${target})`);
    }
  }
  const glob = new RegExp(`(?<![\\w$.])(${BROWSER_GLOBALS.join('|')})\\b`, 'g');
  for (let m; (m = glob.exec(code));) {
    bad.push(`${rel}:${lineOf(code, m.index)} uses browser global ${m[1]}`);
  }
  return bad;
}

test('rules layer (src/engine, src/model, engine) imports no UI and uses no browser globals', () => {
  const files = RULE_DIRS.flatMap((d) => walk(join(ROOT, d)));
  assert.ok(files.length > 50, `expected to scan the rules layer, found ${files.length} files`);
  const bad = files.flatMap((f) => check(f, readFileSync(f, 'utf8')));
  assert.deepEqual(bad, [], `layering violations:\n${bad.join('\n')}`);
});

test('layering checker catches what it should and ignores comments and strings', () => {
  const f = join(ROOT, 'src/model/x.js');
  assert.equal(check(f, "import '../ui/fx.js';\n").length, 1);
  assert.equal(check(f, "import { a } from '../main.js';").length, 1); // ../main.js from src/model is src/main.js
  assert.equal(check(f, 'const a = document.body;').length, 1);
  assert.equal(check(f, "// document\n/* window */ const s = 'localStorage'; const c = globalThis.crypto;").length, 0);
});
