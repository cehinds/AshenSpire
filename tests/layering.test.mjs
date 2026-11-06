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
  function scanTemplate() {
    push(src[i++], ' ');
    while (i < n) {
      const c = src[i];
      if (c === '\\' && i + 1 < n) {
        const escaped = src.slice(i, i + 2);
        push(escaped, blank(escaped));
        i += 2;
      } else if (c === '$' && src[i + 1] === '{') {
        push(src.slice(i, i + 2), '  ');
        i += 2;
        scanCode(true);
      } else {
        push(c, blank(c));
        i++;
        if (c === '`') return;
      }
    }
  }

  function scanCode(templateExpression = false) {
    let braces = 0;
    while (i < n) {
      const c = src[i], d = src[i + 1];
      if (templateExpression && c === '}' && braces === 0) {
        push(c, ' ');
        i++;
        return;
      }
      if (c === '{') braces++;
      if (c === '}') braces--;
      if (c === '/' && d === '/') {
        let j = i;
        while (j < n && src[j] !== '\n') j++;
        const comment = blank(src.slice(i, j));
        push(comment, comment);
        i = j;
      } else if (c === '/' && d === '*') {
        const end = src.indexOf('*/', i + 2);
        const j = end < 0 ? n : end + 2;
        const comment = blank(src.slice(i, j));
        push(comment, comment);
        i = j;
      } else if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < n && src[j] !== c && src[j] !== '\n') {
          if (src[j] === '\\') j++;
          j++;
        }
        j = Math.min(j + 1, n);
        push(src.slice(i, j), blank(src.slice(i, j)));
        i = j;
      } else if (c === '`') {
        scanTemplate();
      } else {
        push(c, c);
        i++;
      }
    }
  }

  scanCode();
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
    if (code[m.index] !== noComments[m.index] || !m[2].startsWith('.')) continue;
    const target = relative(ROOT, resolve(dirname(file), m[2])).split(sep).join('/');
    if (target === 'src/main.js' || target === 'src/ui' || target.startsWith('src/ui/')) {
      bad.push(`${rel}:${lineOf(noComments, m.index)} imports ${m[2]} (resolves into ${target})`);
    }
  }
  const names = BROWSER_GLOBALS.join('|');
  const globals = new RegExp(
    `(?<![\\w$.])(?:globalThis\\s*(?:\\?\\.|\\.)\\s*)?(${names})\\b`, 'g',
  );
  for (let m; (m = globals.exec(code));) {
    bad.push(`${rel}:${lineOf(code, m.index)} uses browser global ${m[1]}`);
  }
  const bracketGlobals = new RegExp(
    `(?<![\\w$.])globalThis\\s*(?:\\?\\.\\s*)?\\[\\s*(['"])(${names})\\1\\s*\\]`, 'g',
  );
  for (let m; (m = bracketGlobals.exec(noComments));) {
    if (code[m.index] !== noComments[m.index]) continue;
    bad.push(`${rel}:${lineOf(code, m.index)} uses browser global ${m[2]}`);
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
  assert.equal(check(f, 'const a = globalThis?.document.body;').length, 1);
  assert.equal(check(f, "globalThis['window'].name;").length, 1);
  assert.equal(check(f, 'const a = `${{ a: document.body }.a}`;').length, 1);
  assert.equal(check(f, 'const a = `${`inner ${window.name}`}`;').length, 1);
  assert.equal(check(f, 'const a = "import \'../ui/fx.js\'";').length, 0);
  assert.equal(check(f, "// document\n/* window */ const s = 'localStorage'; const c = globalThis.crypto;").length, 0);
});
