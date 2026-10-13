// Inline SVG sigils are symbols too. They are referenced from
// combat-symbols.assignedAssetRef as svg:<Module>.<NAME>.<key>, for example
// svg:combatSigils.ACTION_SIGILS.attack or svg:cardTagSymbols.SHAPES.slashing.
//
// A reference resolves when the module is listed in SVG_MODULES, its source file
// declares `const <NAME>` (exported or not), and <key> is an object key inside
// that declaration. The check reads the source text; nothing is imported or run.

import { readFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HERE, '..', '..', '..');

// Module name used in a reference -> source file, relative to the repo root.
export const SVG_MODULES = Object.freeze({
  combatSigils: 'src/content/combatSigils.js',
  cardTagSymbols: 'src/ui/components/cardTagSymbols.js',
});

const sourceCache = new Map();
function sourceText(mod) {
  if (!sourceCache.has(mod)) sourceCache.set(mod, readFileSync(join(REPO, SVG_MODULES[mod]), 'utf8'));
  return sourceCache.get(mod);
}

// Text of `const NAME = ...` up to its closing `});` at line start, or null.
export function exportBody(text, name) {
  const start = text.search(new RegExp(`^(?:export )?const ${name}\\b`, 'm'));
  if (start < 0) return null;
  const end = text.indexOf('\n});', start);
  if (end < 0) return null;
  return text.slice(start, end);
}

const hasKey = (body, key) => new RegExp(`(?:^|[\\s,{])${key}\\s*:`, 'm').test(body);

const REF = /^svg:([A-Za-z]\w*)\.([A-Z][A-Z_]*)\.([a-z][A-Za-z]*)$/;

// '' when the reference resolves, otherwise the reason it does not.
export function svgRefProblem(ref) {
  const m = String(ref).match(REF);
  if (!m) return `"${ref}" is not svg:<Module>.<NAME>.<key>`;
  const [, mod, name, key] = m;
  if (!Object.hasOwn(SVG_MODULES, mod)) return `"${ref}": module ${mod} is not in SVG_MODULES`;
  const body = exportBody(sourceText(mod), name);
  if (body === null) return `"${ref}": ${name} is not declared in ${SVG_MODULES[mod]}`;
  if (!hasKey(body, key)) return `"${ref}": key ${key} is not inside ${name} in ${SVG_MODULES[mod]}`;
  return '';
}

// Matches "inline SVG [<src path>] <NAME>.<key>" in a combat-symbols cell.
const INLINE = /inline SVG\s+(?:(src\/[^\s;]+)\s+)?([A-Z][A-Z_]*)\.([a-z][A-Za-z]*)/;

// The svg: reference a cell names, or '' when it names no inline SVG.
// Throws when a bare NAME is declared by no module, or by more than one.
export function svgRefFromText(text) {
  const m = String(text).match(INLINE);
  if (!m) return '';
  const [, path, name, key] = m;
  let mod;
  if (path) {
    mod = Object.keys(SVG_MODULES).find(k => SVG_MODULES[k] === path);
    if (!mod) throw new Error(`inline SVG source ${path} is not in SVG_MODULES (${basename(path)})`);
  } else {
    const hits = Object.keys(SVG_MODULES).filter(k => exportBody(sourceText(k), name) !== null);
    if (hits.length !== 1) throw new Error(`inline SVG ${name} matches ${hits.length} modules, need exactly one`);
    mod = hits[0];
  }
  return `svg:${mod}.${name}.${key}`;
}
