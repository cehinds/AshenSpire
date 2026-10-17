// Validates the JSON UI layer (engine/ui/components, games/<game>/ui/screens) and writes engine/ui/index.json.
//   node tools/ui-validate.mjs           validate, then write the index
//   node tools/ui-validate.mjs --check   validate and fail if the index is stale (writes nothing)
// Contract: docs/ai/json-game-modules/MECHANICS-ARCHITECTURE.md (UI section).
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateGameSchema } from '../engine/kernel/gameConfig.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = file => JSON.parse(readFileSync(path.join(ROOT, file), 'utf8'));
const GATED_FIELDS = ['sp', 'mp', 'cardCosts'];
const VISIBILITY_QUERY = 'enemy_visibility.visibleFields';

function jsonFiles(dir) {
  const abs = path.join(ROOT, dir);
  return existsSync(abs) ? readdirSync(abs).filter(f => f.endsWith('.json')).sort() : [];
}

function strings(value, where, visit) {
  if (typeof value === 'string') visit(value, where);
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${where}/${i}`, visit));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { visit(k, `${where}/{key}`); strings(v, `${where}/${k}`, visit); }
}

function resolvePath(doc, dotted) {
  let at = doc;
  for (const part of dotted.split('.')) {
    if (at === null || typeof at !== 'object' || !(part in at)) return false;
    at = at[part];
  }
  return true;
}

function checkRef(ref, subPath, where, errors) {
  if (!ref.startsWith('content/config/ui/')) { errors.push(`${where}: ref "${ref}" must live under content/config/ui/`); return; }
  if (!existsSync(path.join(ROOT, ref))) { errors.push(`${where}: ref "${ref}" does not exist`); return; }
  if (subPath !== undefined && !resolvePath(readJson(ref), subPath)) errors.push(`${where}: path "${subPath}" not found in ${ref}`);
}

export function validateUi({ games = ['ashenspire'] } = {}) {
  const errors = [], warnings = [];
  const componentSchema = readJson('engine/contracts/ui-component.schema.json');
  const screenSchema = readJson('engine/contracts/ui-screen.schema.json');
  const components = {}, screens = {};
  const load = (dir, file, schema, into, label) => {
    const rel = `${dir}/${file}`;
    let doc;
    try { doc = readJson(rel); } catch (e) { errors.push(`${rel}: ${e.message}`); return; }
    try { validateGameSchema(doc, schema); } catch (e) { errors.push(`${rel}: ${e.message}`); return; }
    if (doc.id !== file.replace(/\.json$/, '')) errors.push(`${rel}: id "${doc.id}" must match the file name`);
    strings(doc, '$', (s, where) => { if (!/^[\x20-\x7E]*$/.test(s)) errors.push(`${rel}: non-ASCII text at ${where}`); });
    if (into[doc.id]) errors.push(`${rel}: duplicate ${label} id "${doc.id}"`);
    into[doc.id] = { doc, rel };
  };
  for (const f of jsonFiles('engine/ui/components')) load('engine/ui/components', f, componentSchema, components, 'component');
  for (const g of games) for (const f of jsonFiles(`games/${g}/ui/screens`)) load(`games/${g}/ui/screens`, f, screenSchema, screens, 'screen');

  const used = new Set();
  for (const { doc, rel } of Object.values(components)) {
    if (doc.layout) checkRef(doc.layout.ref, doc.layout.path, `${rel} layout`, errors);
    for (const child of doc.children || []) {
      used.add(child.component);
      if (!components[child.component]) errors.push(`${rel}: child component "${child.component}" does not exist`);
    }
    // Enemy-visibility rule: SP, MP and card costs are bound only through the visibility query.
    const bindings = doc.viewModel.bindings || {};
    const needed = new Set();
    for (const [k, v] of Object.entries(bindings)) {
      const text = typeof v === 'string' ? v : JSON.stringify(v);
      if (GATED_FIELDS.includes(k)) needed.add(k);
      if (/pools\.sp\b/.test(text)) needed.add('sp');
      if (/pools\.mp\b/.test(text)) needed.add('mp');
      if (/deck\.costs\b/.test(text)) needed.add('cardCosts');
    }
    if (needed.size && doc.viewModel.visibility?.appliesTo !== 'player') {
      const vis = doc.viewModel.visibility;
      if (!vis || vis.query !== VISIBILITY_QUERY) errors.push(`${rel}: binds ${[...needed].join(', ')} without the ${VISIBILITY_QUERY} visibility query`);
      else for (const field of needed) if (!(vis.fields && field in vis.fields)) errors.push(`${rel}: binding needs visibility field "${field}"`);
    }
  }
  for (const { doc, rel } of Object.values(screens)) {
    if (doc.layout) checkRef(doc.layout.ref, undefined, `${rel} layout`, errors);
    if (doc.scene) checkRef(doc.scene.ref, undefined, `${rel} scene`, errors);
    for (const region of doc.regions) {
      used.add(region.component);
      if (!components[region.component]) errors.push(`${rel}: region "${region.slot}" uses unknown component "${region.component}"`);
    }
  }
  for (const id of Object.keys(components)) if (!used.has(id)) warnings.push(`component "${id}" is not used by any screen or component`);

  const index = { format: 'ashen.ui-index@1', components: Object.keys(components).sort(), screens: Object.keys(screens).sort() };
  return { errors, warnings, index };
}

export const INDEX_FILE = 'engine/ui/index.json';
export const indexText = index => JSON.stringify(index, null, 2) + '\n';

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const { errors, warnings, index } = validateUi();
  for (const w of warnings) console.warn(`warn: ${w}`);
  for (const e of errors) console.error(`error: ${e}`);
  if (errors.length) process.exit(1);
  const text = indexText(index), file = path.join(ROOT, INDEX_FILE);
  if (check) {
    if (!existsSync(file) || readFileSync(file, 'utf8') !== text) { console.error(`error: ${INDEX_FILE} is stale; run node tools/ui-validate.mjs`); process.exit(1); }
  } else writeFileSync(file, text);
  console.log(`ui ok: ${index.components.length} components, ${index.screens.length} screens`);
}
