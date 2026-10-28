// tools/bundle-cycles.mjs — find named imports that the bundler turns into a
// load-time destructure of a module that is still loading.
//
// tools/bundle.mjs rewrites `import { x } from './m.js'` into
// `const { x } = require("src/m.js")`. When m.js is mid-load (an import cycle)
// its exports object is still empty, so x is undefined for the life of the
// page. Node ESM live bindings hide this, so the node tests cannot see it.
// `import * as N` is safe (N is the live exports object, read at call time).
//
// Usage: node tools/bundle-cycles.mjs [entry=src/main.js]   (exit 1 on hazards)
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Same statement grammar as tools/bundle.mjs IMPORT_RE.
const IMPORT_RE =
  /^[ \t]*import\s+['"]([^'"]+)['"](?:[ \t]*;)*[ \t]*$|^[ \t]*import\b([\s\S]*?)from\s*['"]([^'"]+)['"](?:[ \t]*;)*[ \t]*$/gm;

const idOf = (abs) => relative(ROOT, abs).split(/[\\/]/).join('/');

function parseImports(id) {
  const abs = resolve(ROOT, id);
  const src = readFileSync(abs, 'utf8').replace(/\r\n?/g, '\n');
  const out = [];
  IMPORT_RE.lastIndex = 0;
  let m;
  while ((m = IMPORT_RE.exec(src)) !== null) {
    const spec = m[1] ?? m[3];
    const clause = m[2] ?? '';
    const target = idOf(resolve(dirname(abs), spec));
    const brace = /\{([\s\S]*?)\}/.exec(clause);
    const names = brace
      ? brace[1].split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.split(/\s+as\s+/)[0])
      : [];
    const line = src.slice(0, m.index).split('\n').length;
    out.push({ target, names, line });
  }
  return out;
}

// Simulate the bundle's require(): run each module's imports in source order,
// depth first; a module already on the stack returns its half-filled exports.
export function findCycleHazards(entry = 'src/main.js') {
  const state = new Map(); // id -> 'loading' | 'done'
  const stack = [];
  const hazards = [];
  const cache = new Map();
  const imports = (id) => cache.get(id) ?? (cache.set(id, parseImports(id)), cache.get(id));
  function load(id) {
    if (state.has(id)) return;
    if (!existsSync(resolve(ROOT, id))) return;
    state.set(id, 'loading');
    stack.push(id);
    for (const imp of imports(id)) {
      if (state.get(imp.target) === 'loading' && imp.names.length) {
        const from = stack.indexOf(imp.target);
        hazards.push({ importer: id, line: imp.line, target: imp.target, names: imp.names,
          chain: [...stack.slice(from), imp.target] });
      }
      load(imp.target);
    }
    stack.pop();
    state.set(id, 'done');
  }
  load(entry);
  return hazards;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const hazards = findCycleHazards(process.argv[2]);
  for (const h of hazards) {
    console.log(`${h.importer}:${h.line} destructures {${h.names.join(', ')}} from ${h.target} while it is loading`);
    console.log(`    chain: ${h.chain.join(' -> ')}`);
  }
  console.log(`bundle-cycles: ${hazards.length} hazard(s)`);
  process.exit(hazards.length ? 1 : 0);
}
