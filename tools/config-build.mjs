// tools/config-build.mjs — compile content/config/**.json into
// src/config/generated/ui.js, the THIRD authored tree (after content/source/
// and content/framework/). Same reason as the other two: the game runs from
// file:// and ships as one HTML, so authored JSON becomes a plain ES data
// module at build time and the runtime sees only resolved numbers.
//
//   node tools/config-build.mjs            compile, validate, write
//   node tools/config-build.mjs --check    verify the generated module is
//                                          current (gate use: no writes)
//
// content/config/README.md is the author's guide. The rules it states are
// enforced here, and every refusal names the file and the thing refused:
//
//   SECTIONS  a file's top level uses only the closed set in SECTIONS.
//   VARIABLES a string "$name" is replaced by a variable: the file's own
//             `vars` first, then ui/tokens.json's. Unknown, unused, cyclic, and
//             malformed "$" uses are refused.
//   FRACTIONS an object that is exactly { "numerator": n, "denominator": d }
//             becomes the number n / d, computed with the same IEEE division
//             the old hand-written `5 / 8` used, so the result is bit-equal.
//   SCENES    scenes/*.json get the W4 contract checks (bands, floor, layers,
//             entrance, footer actions, portrait fraction).
//
// Folder → export shape: ui/tokens.json → uiConfig.tokens; ui/scenes/<id>-<name>
// .json → uiConfig.scenes.<id>; ui/components/<name>.json →
// uiConfig.components.<name>; ui/screens/<name>.json → uiConfig.screens.<name>;
// ui/presentation/<name>.json → uiConfig.presentation.<name>.
//
// presentation/ holds the tables that were hand-written JS data in src/ — map
// tiles, pose states, animation families, art anchors, environments, menus.
// Each file is named for the module that reads it, so the JSON and its shim
// are findable from either end.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CONFIG_DIR = 'content/config';
export const GENERATED = 'src/config/generated/ui.js';

export const SECTIONS = ['vars', 'sizing', 'positioning', 'layering', 'motion', 'components', 'behavior'];
export const GROUPS = ['scenes', 'components', 'screens', 'presentation'];
export const FOOTER_ACTIONS = ['back', 'skipSpeech', 'continue'];
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const REF = /^\$([A-Za-z_][A-Za-z0-9_]*)$/;

const lf = (text) => text.replace(/\r\n/g, '\n');
const hashOf = (text) => createHash('sha256').update(lf(text)).digest('hex').slice(0, 16);
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Duplicate keys in one object are refused: JSON.parse silently keeps the last. */
function duplicateKeys(text) {
  const dupes = [];
  const stack = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      let j = i + 1;
      while (text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      const str = JSON.parse(text.slice(i, j + 1));
      let k = j + 1;
      while (/\s/.test(text[k] || '')) k += 1;
      const top = stack[stack.length - 1];
      if (text[k] === ':' && top instanceof Set) {
        if (top.has(str)) dupes.push(str);
        top.add(str);
      }
      i = j + 1;
      continue;
    }
    if (ch === '{') stack.push(new Set());
    else if (ch === '[') stack.push('array');
    else if (ch === '}' || ch === ']') stack.pop();
    i += 1;
  }
  return dupes;
}

function groupOf(rel) {
  // rel is relative to content/config, POSIX separators.
  const parts = rel.split('/');
  if (parts[0] !== 'ui') return { error: `${CONFIG_DIR}/${rel}: unknown config tree "${parts[0]}" — only ui/ exists (content/config/README.md)` };
  if (parts.length === 2 && parts[1] === 'tokens.json') return { group: 'tokens' };
  if (parts.length === 3 && GROUPS.includes(parts[1])) {
    const base = parts[2].replace(/\.json$/, '');
    const key = parts[1] === 'scenes' ? base.split('-')[0] : base;
    if (!NAME.test(key)) return { error: `${CONFIG_DIR}/${rel}: file name "${base}" does not give a usable key` };
    return { group: parts[1], key };
  }
  return { error: `${CONFIG_DIR}/${rel}: not a known place — config files sit at ui/tokens.json or ui/{${GROUPS.join(',')}}/<name>.json` };
}

/**
 * compileEntries(entries) → { config, errors, sources }
 * entries: [{ rel: 'ui/scenes/w4.json', text }] — rel is relative to content/config.
 * Pure: no filesystem, so tests can plant any tree.
 */
export function compileEntries(entries) {
  const errors = [];
  const files = [];
  const sorted = [...entries].sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  for (const { rel, text } of sorted) {
    const where = groupOf(rel);
    if (where.error) { errors.push(where.error); continue; }
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      errors.push(`${CONFIG_DIR}/${rel}: not valid JSON — ${e.message}`);
      continue;
    }
    for (const d of duplicateKeys(text)) errors.push(`${CONFIG_DIR}/${rel}: duplicate key "${d}" — JSON keeps only the last one`);
    if (!isObject(data)) { errors.push(`${CONFIG_DIR}/${rel}: top level must be an object of sections`); continue; }
    for (const key of Object.keys(data)) {
      if (!SECTIONS.includes(key)) errors.push(`${CONFIG_DIR}/${rel}: unknown section "${key}" — sections are ${SECTIONS.join(', ')}`);
    }
    if (where.group === 'tokens') {
      for (const key of Object.keys(data)) {
        if (key !== 'vars' && SECTIONS.includes(key)) errors.push(`${CONFIG_DIR}/${rel}: tokens.json holds only "vars", not "${key}"`);
      }
    }
    if ('vars' in data && !isObject(data.vars)) errors.push(`${CONFIG_DIR}/${rel}: "vars" must be an object`);
    files.push({ rel, text, data, ...where });
  }

  const tokenFiles = files.filter((f) => f.group === 'tokens');
  if (tokenFiles.length === 0) errors.push(`${CONFIG_DIR}/ui/tokens.json: missing — the shared variables live there`);
  const tokenVars = (tokenFiles[0] && isObject(tokenFiles[0].data.vars)) ? tokenFiles[0].data.vars : {};

  for (const f of files) {
    const vars = isObject(f.data.vars) ? f.data.vars : {};
    for (const name of Object.keys(vars)) {
      if (!NAME.test(name)) errors.push(`${CONFIG_DIR}/${f.rel}: variable name "${name}" is not a plain identifier (write the name without "$")`);
    }
  }

  // ---- variable resolution -------------------------------------------------
  const tokenScope = { label: 'ui/tokens.json', vars: tokenVars, parent: null, used: new Set(), memo: new Map() };
  const misuse = (file, path, msg) => errors.push(`${CONFIG_DIR}/${file}: ${path}: ${msg}`);

  function lookup(scope, name) {
    for (let s = scope; s; s = s.parent) if (Object.prototype.hasOwnProperty.call(s.vars, name)) return s;
    return null;
  }

  // Resolve a value in `scope`. `trail` is the chain of variables being
  // resolved, for cycle detection; `count` is false during the audit pass so
  // resolving an unreferenced variable does not mark its dependencies used.
  function resolveValue(value, scope, file, path, trail, count) {
    if (typeof value === 'string') {
      if (!value.includes('$')) return value;
      const m = REF.exec(value);
      if (!m) { misuse(file, path, `"${value}" misuses "$" — a variable reference is the whole string "$name", nothing before or after`); return value; }
      return resolveVar(m[1], scope, file, path, trail, count);
    }
    if (Array.isArray(value)) return value.map((v, i) => resolveValue(v, scope, file, `${path}[${i}]`, trail, count));
    if (isObject(value)) {
      const keys = Object.keys(value);
      if (keys.length === 2 && keys.includes('numerator') && keys.includes('denominator')) {
        const n = resolveValue(value.numerator, scope, file, `${path}.numerator`, trail, count);
        const d = resolveValue(value.denominator, scope, file, `${path}.denominator`, trail, count);
        if (typeof n !== 'number' || typeof d !== 'number' || !Number.isFinite(n) || !Number.isFinite(d)) {
          misuse(file, path, 'a fraction needs a finite number numerator and denominator');
          return NaN;
        }
        if (d === 0) { misuse(file, path, 'fraction denominator is 0'); return NaN; }
        return n / d;
      }
      const out = {};
      for (const k of keys) {
        if (k.includes('$')) misuse(file, `${path}.${k}`, `key "${k}" misuses "$" — "$" marks a variable reference in a string value, never a key`);
        out[k] = resolveValue(value[k], scope, file, `${path}.${k}`, trail, count);
      }
      return out;
    }
    return value;
  }

  function resolveVar(name, scope, file, path, trail, count) {
    const owner = lookup(scope, name);
    if (!owner) {
      misuse(file, path, `unknown variable "$${name}" — declare it in this file's "vars" or in ui/tokens.json`);
      return undefined;
    }
    const id = `${owner.label}:${name}`;
    if (trail.includes(id)) {
      const cycle = [...trail.slice(trail.indexOf(id)), id].map((t) => `$${t.split(':')[1]}`).join(' → ');
      misuse(file, path, `variable cycle ${cycle}`);
      return undefined;
    }
    if (count) owner.used.add(name);
    if (count && owner.memo.has(name)) return owner.memo.get(name);
    const value = resolveValue(owner.vars[name], owner, owner.label, `vars.${name}`, [...trail, id], count);
    if (count) owner.memo.set(name, value);
    return value;
  }

  const config = { tokens: {}, scenes: {}, components: {}, screens: {}, presentation: {} };
  const seen = new Map();
  const scopes = [];
  for (const f of files) {
    if (f.group === 'tokens') continue;
    const vars = isObject(f.data.vars) ? f.data.vars : {};
    const scope = { label: f.rel, vars, parent: tokenScope, used: new Set(), memo: new Map() };
    scopes.push(scope);
    const out = {};
    for (const [section, value] of Object.entries(f.data)) {
      if (section === 'vars' || !SECTIONS.includes(section)) continue;
      out[section] = resolveValue(value, scope, f.rel, section, [], true);
    }
    const slot = `${f.group}.${f.key}`;
    if (seen.has(slot)) errors.push(`${CONFIG_DIR}/${f.rel}: uiConfig.${slot} is already produced by ${CONFIG_DIR}/${seen.get(slot)}`);
    seen.set(slot, f.rel);
    config[f.group][f.key] = out;
    if (f.group === 'scenes') errors.push(...sceneProblems(f.rel, out));
  }

  // Tokens: resolved inside their own scope and exported as plain values.
  for (const name of Object.keys(tokenVars)) {
    config.tokens[name] = resolveValue(tokenVars[name], tokenScope, tokenScope.label, `vars.${name}`, [`${tokenScope.label}:${name}`], false);
  }
  // Audit pass: every declared variable resolves (unknowns and cycles inside
  // variables nobody references are still refused), and every one is used.
  for (const scope of scopes) {
    for (const name of Object.keys(scope.vars)) {
      resolveValue(scope.vars[name], scope, scope.label, `vars.${name}`, [`${scope.label}:${name}`], false);
      if (!scope.used.has(name)) errors.push(`${CONFIG_DIR}/${scope.label}: variable "$${name}" is defined but never used — delete it or reference it`);
    }
  }
  for (const name of Object.keys(tokenVars)) {
    if (!tokenScope.used.has(name)) errors.push(`${CONFIG_DIR}/ui/tokens.json: variable "$${name}" is defined but never used — delete it or reference it`);
  }

  const sources = files.map((f) => ({ rel: f.rel, hash: hashOf(f.text) }));
  return { config, errors: [...new Set(errors)], sources };
}

/** The W4 scene contract. Every refusal names the file and the rule. */
export function sceneProblems(rel, scene) {
  const out = [];
  const at = `${CONFIG_DIR}/${rel}`;
  const sizing = isObject(scene.sizing) ? scene.sizing : {};
  if ('bands' in sizing) {
    const bands = sizing.bands;
    const values = isObject(bands) ? Object.values(bands) : [];
    if (!isObject(bands) || values.some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0)) {
      out.push(`${at}: sizing.bands must map each band to a non-negative percent`);
    } else {
      const sum = values.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 100) > 1e-9) out.push(`${at}: sizing.bands sum to ${sum}, not 100`);
    }
  }
  if ('floorPercent' in sizing) {
    const p = sizing.floorPercent;
    if (typeof p !== 'number' || !(p >= 0 && p <= 100)) out.push(`${at}: sizing.floorPercent ${JSON.stringify(p)} is outside 0–100`);
  }
  const layering = isObject(scene.layering) ? scene.layering : {};
  const declared = new Set();
  if ('layers' in layering) {
    if (!Array.isArray(layering.layers)) out.push(`${at}: layering.layers must be an array of { id, z, enabled }`);
    else {
      for (const [i, layer] of layering.layers.entries()) {
        if (!isObject(layer) || typeof layer.id !== 'string' || !layer.id) { out.push(`${at}: layering.layers[${i}] needs a string id`); continue; }
        if (declared.has(layer.id)) out.push(`${at}: layering.layers id "${layer.id}" is declared twice`);
        declared.add(layer.id);
        if (!Number.isInteger(layer.z)) out.push(`${at}: layering.layers "${layer.id}" z ${JSON.stringify(layer.z)} is not an integer`);
        if ('enabled' in layer && typeof layer.enabled !== 'boolean') out.push(`${at}: layering.layers "${layer.id}" enabled must be true or false`);
      }
    }
  }
  const motion = isObject(scene.motion) ? scene.motion : {};
  if ('entrance' in motion) {
    if (!Array.isArray(motion.entrance)) out.push(`${at}: motion.entrance must be an array of steps`);
    else {
      for (const [i, step] of motion.entrance.entries()) {
        const names = isObject(step) && Array.isArray(step.layers) ? step.layers : null;
        if (!names) { out.push(`${at}: motion.entrance[${i}] needs a layers array`); continue; }
        for (const name of names) {
          if (!declared.has(name)) out.push(`${at}: motion.entrance[${i}] names layer "${name}", which layering.layers does not declare`);
        }
      }
    }
  }
  const components = isObject(scene.components) ? scene.components : {};
  if (isObject(components.footer) && 'actions' in components.footer) {
    const actions = components.footer.actions;
    if (!Array.isArray(actions)) out.push(`${at}: components.footer.actions must be an array`);
    else {
      for (const a of actions) {
        if (!FOOTER_ACTIONS.includes(a)) out.push(`${at}: components.footer.actions "${a}" is not a known footer action (${FOOTER_ACTIONS.join(', ')})`);
      }
    }
  }
  const positioning = isObject(scene.positioning) ? scene.positioning : {};
  if (isObject(positioning.portraits) && 'visibleFraction' in positioning.portraits) {
    const f = positioning.portraits.visibleFraction;
    if (typeof f !== 'number' || !(f > 0 && f <= 1)) out.push(`${at}: positioning.portraits.visibleFraction ${Number.isFinite(f) ? f : JSON.stringify(f)} must satisfy 0 < f ≤ 1`);
  }
  return out;
}

/** The generated module's text. Deterministic: sources sorted, LF only. */
export function generate({ config, sources }) {
  return [
    '// GENERATED by tools/config-build.mjs from content/config/ — do not edit by hand.',
    '// Edit the JSON under content/config/ and run: node tools/config-build.mjs',
    '// Every value is already resolved: variables substituted, fractions divided.',
    '//',
    ...sources.map((s) => `// source ${CONFIG_DIR}/${s.rel} ${s.hash}`),
    '',
    'const deepFreeze = (value) => {',
    "  if (value && typeof value === 'object') {",
    '    Object.values(value).forEach(deepFreeze);',
    '    Object.freeze(value);',
    '  }',
    '  return value;',
    '};',
    '',
    `export const uiConfig = deepFreeze(${JSON.stringify(config, null, 2)});`,
    '',
  ].join('\n');
}

/** Read every *.json under content/config (README and other prose is skipped). */
export function readConfigTree(contentRoot) {
  const dir = join(contentRoot, 'config');
  const entries = [];
  (function walk(d) {
    if (!existsSync(d)) return;
    for (const name of readdirSync(d).sort()) {
      const abs = join(d, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else if (/\.json$/i.test(name)) entries.push({ rel: relative(dir, abs).split(sep).join('/'), text: readFileSync(abs, 'utf8') });
    }
  })(dir);
  return entries;
}

/**
 * configSourceErrors(contentRoot) → errors, for tools/content-build.mjs's
 * stray-source sweep. A content/config JSON is NOT stray only when the
 * generated module names it with the hash of its current bytes, i.e. only when
 * src/config/generated/ui.js was compiled from exactly this file.
 */
export function configSourceErrors(contentRoot) {
  const entries = readConfigTree(contentRoot);
  if (!entries.length) return [];
  const genPath = join(contentRoot, '..', ...GENERATED.split('/'));
  const header = existsSync(genPath) ? lf(readFileSync(genPath, 'utf8')) : '';
  const listed = new Set([...header.matchAll(/^\/\/ source (\S+) ([0-9a-f]{16})$/gm)].map((m) => `${m[1]} ${m[2]}`));
  const errors = [];
  for (const e of entries) {
    if (!listed.has(`${CONFIG_DIR}/${e.rel} ${hashOf(e.text)}`)) {
      errors.push(`${CONFIG_DIR}/${e.rel}: STRAY SOURCE FILE — ${GENERATED} was not compiled from this version of it; run node tools/config-build.mjs`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const entries = readConfigTree(resolve(ROOT, 'content'));
  if (!entries.length) {
    console.error(`config-build: no JSON under ${CONFIG_DIR}/`);
    process.exit(1);
  }
  const result = compileEntries(entries);
  if (result.errors.length) {
    console.error(`config-build: REFUSED — ${result.errors.length} problem(s):\n  ${result.errors.join('\n  ')}`);
    process.exit(1);
  }
  const text = generate(result);
  const outPath = resolve(ROOT, GENERATED);
  if (check) {
    const current = existsSync(outPath) ? lf(readFileSync(outPath, 'utf8')) : null;
    if (current !== text) {
      console.error(`STALE: ${GENERATED} does not match ${CONFIG_DIR}/ — run node tools/config-build.mjs`);
      process.exit(1);
    }
    console.log(`config-build: ${GENERATED} is current with ${entries.length} source file(s)`);
  } else {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, text);
    console.log(`config-build: wrote ${GENERATED} from ${entries.length} source file(s)`);
  }
}
