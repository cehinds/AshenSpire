// Validates the JSON UI layer (engine/ui/components, games/<game>/ui/screens) and writes engine/ui/index.json.
// Beyond schema and refs it checks that every event names a command in engine/runtime/commands.json, every asset slot
// resolves (catalog, games/<game>/assets/aliases.json or missing.json) and every src/ path in a description exists.
//   node tools/ui-validate.mjs           validate, then write the index
//   node tools/ui-validate.mjs --check   validate and fail if the index is stale (writes nothing)
// Contract: docs/ai/json-game-modules/MECHANICS-ARCHITECTURE.md (UI section).
import { readFileSync, readdirSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateGameSchema } from '../engine/kernel/gameConfig.js';
import { buildAssetCatalog, readAliases, readMissing } from './asset-catalog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (file, root = ROOT) => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
const COMMANDS_FILE = 'engine/runtime/commands.json';
const SRC_PATH = /src\/[\w/.-]+\.js/g;
const GATED_FIELDS = ['sp', 'mp', 'cardCosts'];
const VISIBILITY_QUERY = 'enemy_visibility.visibleFields';

function jsonFiles(dir, root = ROOT) {
  const abs = path.join(root, dir);
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

function checkRef(ref, subPath, where, errors, root = ROOT) {
  if (!ref.startsWith('content/config/ui/')) { errors.push(`${where}: ref "${ref}" must live under content/config/ui/`); return; }
  if (!existsSync(path.join(root, ref))) { errors.push(`${where}: ref "${ref}" does not exist`); return; }
  // Realpath containment: '..' segments or links must not escape the UI configuration tree.
  if (!realpathSync(path.join(root, ref)).startsWith(realpathSync(path.join(root, 'content/config/ui')) + path.sep)) { errors.push(`${where}: ref "${ref}" must live under content/config/ui/`); return; }
  if (subPath !== undefined && !resolvePath(readJson(ref, root), subPath)) errors.push(`${where}: path "${subPath}" not found in ${ref}`);
}

/** Enemy-visibility rule: SP, MP and card costs are bound only through the visibility query.
 *  Shared with tools/build-game.mjs so a built artifact cannot expose hidden enemy fields. */
export function visibilityErrors(doc, rel) {
  const errors = [];
  const bindings = doc.viewModel?.bindings || {};
  const needed = new Set();
  for (const [k, v] of Object.entries(bindings)) {
    const text = typeof v === 'string' ? v : JSON.stringify(v);
    if (GATED_FIELDS.includes(k)) needed.add(k);
    if (/pools\.sp\b/.test(text)) needed.add('sp');
    if (/pools\.mp\b/.test(text)) needed.add('mp');
    if (/deck\.costs\b/.test(text)) needed.add('cardCosts');
  }
  if (needed.size && doc.viewModel?.visibility?.appliesTo !== 'player') {
    const vis = doc.viewModel?.visibility;
    if (!vis || vis.query !== VISIBILITY_QUERY) errors.push(`${rel}: binds ${[...needed].join(', ')} without the ${VISIBILITY_QUERY} visibility query`);
    else for (const field of needed) if (!(vis.fields && field in vis.fields)) errors.push(`${rel}: binding needs visibility field "${field}"`);
  }
  return errors;
}

/** Guards that tie a UI document to the rest of the repo: its command ids, its asset slots and the src files its description names. */
function commandErrors(doc, rel, commands) {
  const errors = [];
  for (const [event, command] of Object.entries(doc.events || {})) if (!commands || !(command in commands)) errors.push(`${rel}: event "${event}" names command "${command}", which is not in ${COMMANDS_FILE}`);
  return errors;
}

function assetErrors(doc, rel, resolvers) {
  const errors = [];
  for (const id of doc.assets || []) for (const { game, resolves } of resolvers) if (!resolves(id)) errors.push(`${rel}: asset "${id}" is not a catalog id, an alias or a missing.json entry for game ${game}`);
  return errors;
}

function descriptionErrors(doc, rel, root) {
  const errors = [];
  for (const file of new Set((doc.description || '').match(SRC_PATH) || [])) if (!existsSync(path.join(root, file))) errors.push(`${rel}: description names ${file}, which does not exist`);
  return errors;
}

/** The ids a game's UI may name as an asset: catalog ids, alias keys and missing.json entries. */
function assetResolver(root, game, errors) {
  let catalog = {};
  try { catalog = buildAssetCatalog({ root, game }).assets; } catch (e) { errors.push(`games/${game}/assets: ${e.message}`); }
  const aliases = readAliases(root, game), missing = readMissing(root, game);
  for (const [slot, target] of Object.entries(aliases)) if (target !== null && !(target in catalog)) errors.push(`games/${game}/assets/aliases.json: alias "${slot}" names catalog id "${target}", which does not exist`);
  return { game, resolves: id => id in catalog || id in aliases || id in missing };
}

export function validateUi({ games = ['ashenspire'], root = ROOT } = {}) {
  const errors = [], warnings = [];
  const componentSchema = readJson('engine/contracts/ui-component.schema.json', root);
  const screenSchema = readJson('engine/contracts/ui-screen.schema.json', root);
  let commands = null;
  try {
    const registry = readJson(COMMANDS_FILE, root);
    validateGameSchema(registry, readJson('engine/contracts/commands.schema.json', root));
    commands = registry.commands;
  } catch (e) { errors.push(`${COMMANDS_FILE}: ${e.message}`); }
  const resolvers = games.map(game => assetResolver(root, game, errors));
  const components = {}, screens = {};
  const load = (dir, file, schema, into, label) => {
    const rel = `${dir}/${file}`;
    let doc;
    try { doc = readJson(rel, root); } catch (e) { errors.push(`${rel}: ${e.message}`); return; }
    try { validateGameSchema(doc, schema); } catch (e) { errors.push(`${rel}: ${e.message}`); return; }
    if (doc.id !== file.replace(/\.json$/, '')) errors.push(`${rel}: id "${doc.id}" must match the file name`);
    strings(doc, '$', (s, where) => { if (!/^[\x20-\x7E]*$/.test(s)) errors.push(`${rel}: non-ASCII text at ${where}`); });
    if (into[doc.id]) errors.push(`${rel}: duplicate ${label} id "${doc.id}"`);
    into[doc.id] = { doc, rel, game: label === 'screen' ? dir.split('/')[1] : null };
  };
  for (const f of jsonFiles('engine/ui/components', root)) load('engine/ui/components', f, componentSchema, components, 'component');
  for (const g of games) for (const f of jsonFiles(`games/${g}/ui/screens`, root)) load(`games/${g}/ui/screens`, f, screenSchema, screens, 'screen');

  const used = new Set();
  for (const { doc, rel } of Object.values(components)) {
    if (doc.layout) checkRef(doc.layout.ref, doc.layout.path, `${rel} layout`, errors, root);
    errors.push(...commandErrors(doc, rel, commands), ...assetErrors(doc, rel, resolvers), ...descriptionErrors(doc, rel, root));
    for (const child of doc.children || []) {
      used.add(child.component);
      if (!components[child.component]) errors.push(`${rel}: child component "${child.component}" does not exist`);
    }
    errors.push(...visibilityErrors(doc, rel));
  }
  for (const { doc, rel, game } of Object.values(screens)) {
    if (doc.layout) checkRef(doc.layout.ref, undefined, `${rel} layout`, errors, root);
    if (doc.scene) checkRef(doc.scene.ref, undefined, `${rel} scene`, errors, root);
    errors.push(...commandErrors(doc, rel, commands), ...assetErrors(doc, rel, resolvers.filter(r => r.game === game)), ...descriptionErrors(doc, rel, root));
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
