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
import { scanDynamicImports } from './dynamic-imports.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Same statement grammar as tools/bundle.mjs IMPORT_RE.
const IMPORT_RE =
  /^[ \t]*import\s+['"]([^'"]+)['"](?:[ \t]*;)*[ \t]*$|^[ \t]*import\b(?!(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*\n)*\()([\s\S]*?)from\s*['"]([^'"]+)['"](?:[ \t]*;)*[ \t]*$/gm;

const idOf = (abs, root = ROOT) => relative(root, abs).split(/[\\/]/).join('/');

function parseImports(id, root = ROOT) {
  const abs = resolve(root, id);
  const src = readFileSync(abs, 'utf8').replace(/\r\n?/g, '\n');
  const out = [];
  out.dynamic = [];
  IMPORT_RE.lastIndex = 0;
  let m;
  while ((m = IMPORT_RE.exec(src)) !== null) {
    const spec = m[1] ?? m[3];
    const clause = m[2] ?? '';
    const target = idOf(resolve(dirname(abs), spec), root);
    const brace = /\{([\s\S]*?)\}/.exec(clause);
    const names = brace
      ? brace[1].split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.split(/\s+as\s+/)[0])
      : [];
    const line = src.slice(0, m.index).split('\n').length;
    out.push({ target, names, line });
  }
  for (const call of scanDynamicImports(src)) {
    if (call.spec !== null) out.dynamic.push(idOf(resolve(dirname(abs), call.spec), root));
  }
  return out;
}

// Simulate the bundle's require(): run each module's imports in source order,
// depth first; a module already on the stack returns its half-filled exports.
export function findCycleHazards(entry = 'src/main.js', root = ROOT) {
  let state = new Map(); // id -> 'loading' | 'done'
  const stack = [];
  const hazards = [];
  const cache = new Map();
  const imports = (id) => cache.get(id) ?? (cache.set(id, parseImports(id, root)), cache.get(id));
  function load(id) {
    if (state.has(id)) return;
    if (!existsSync(resolve(root, id))) return;
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
  // A dynamic edge adds no evaluation order: its target runs later, on demand,
  // after boot. Each dynamic target is analysed as its own root, from a fresh
  // copy of the boot-loaded state, so the order of the import() calls in source
  // (and what an earlier lazy root happened to load) cannot change the result.
  const boot = state;
  const roots = new Set();
  const walked = new Set();
  for (const queue = [entry]; queue.length;) {
    const id = queue.shift();
    if (walked.has(id) || !existsSync(resolve(root, id))) continue;
    walked.add(id);
    for (const imp of imports(id)) queue.push(imp.target);
    for (const t of imports(id).dynamic) { roots.add(t); queue.push(t); }
  }
  const seenHazard = new Set(hazards.map((h) => `${h.importer}:${h.line}:${h.target}`));
  for (const lazy of [...roots].sort()) {
    state = new Map(boot);
    stack.length = 0;
    const before = hazards.length;
    load(lazy);
    // The same hazard reached from two roots is one finding.
    const fresh = hazards.splice(before).filter((h) => {
      const key = `${h.importer}:${h.line}:${h.target}`;
      if (seenHazard.has(key)) return false;
      seenHazard.add(key);
      return true;
    });
    hazards.push(...fresh);
  }
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
