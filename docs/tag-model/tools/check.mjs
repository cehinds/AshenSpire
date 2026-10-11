// Validates the tag-model tables. Exit 0 when every check passes, 1 otherwise.
//
//   node docs/tag-model/tools/check.mjs
//
// Checks:
//   - every CSV under tables/ and tables/presentation/ parses, with a consistent
//     column count, LF line endings and a final newline
//   - tag ids and keys are unique; each key is the shortest unique suffix of its id
//   - reference columns resolve: tags parent (id), school and related (keys),
//     variables (values or formulas keys); objects tags, skill, exp, cardType,
//     stance, rarity, costResource (keys) and grants (object ids); ranks object
//     (object id) and key (values key); relations source and target (keys);
//     formulas [key] references (values or formulas keys)
//   - presentation tables: tag resolves to a tag key; band and scope are in
//     their vocabularies
//   - tags status is one of live-tag, game-concept, new; liveId only on a live-tag
//     and resolves to a nodes.csv id

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTable, parseCsv } from './csv.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TM = join(HERE, '..');
const TABLES = join(TM, 'tables');
const PRES = join(TABLES, 'presentation');
const NODES = join(TM, '..', '..', 'content', 'source', 'nodes.csv');

const errors = [];
const fail = msg => errors.push(msg);
let nodeIdsCache = null;
const splitRefs = v => String(v || '').split(/\s+/).filter(Boolean);

// ---------------------------------------------------------------- CSV shape
const csvFiles = [
  ...readdirSync(TABLES).filter(f => f.endsWith('.csv')).map(f => join(TABLES, f)),
  ...readdirSync(PRES).filter(f => f.endsWith('.csv')).map(f => join(PRES, f)),
];
const tables = {};
for (const file of csvFiles) {
  const text = readFileSync(file, 'utf8');
  const name = file.replace(TM + '/', '');
  if (text.includes('\r')) fail(`${name}: CR line ending (must be LF)`);
  if (!text.endsWith('\n')) fail(`${name}: no final newline`);
  try {
    tables[file] = readTable(file);
  } catch (e) {
    fail(`${name}: ${e.message}`);
  }
}
const T = name => tables[join(TABLES, name + '.csv')];

// -------------------------------------------------------------------- tags
const tags = T('tags');
const TAG_COLS = ['id', 'key', 'label', 'parent', 'erd', 'school', 'description', 'effect', 'variables', 'duration', 'stacking', 'related', 'status', 'glyph', 'color', 'liveId'];
const ix = Object.fromEntries(TAG_COLS.map(c => [c, tags.header.indexOf(c)]));
for (const c of TAG_COLS) if (ix[c] < 0) fail(`tags: missing column ${c}`);
const tagRow = tags.rows;
const ids = tagRow.map(r => r[ix.id]);
const keys = tagRow.map(r => r[ix.key]);
const idSet = new Set(ids);
const keySet = new Set(keys);
const keyToId = Object.fromEntries(tagRow.map(r => [r[ix.key], r[ix.id]]));
if (idSet.size !== ids.length) fail('tags: duplicate id');
if (keySet.size !== keys.length) fail('tags: duplicate key ' + keys.filter((k, i) => keys.indexOf(k) !== i).join(', '));

for (const r of tagRow) {
  const id = r[ix.id];
  const key = r[ix.key];
  const segs = id.split('.');
  if (!(key === id || id.endsWith('.' + key))) fail(`tags: key "${key}" is not a suffix of ${id}`);
  // shortest unique suffix
  let shortest = null;
  for (let n = 1; n <= segs.length && !shortest; n++) {
    const s = segs.slice(segs.length - n).join('.');
    if (!ids.some(o => o !== id && (o === s || o.endsWith('.' + s)))) shortest = s;
  }
  if (shortest !== key) fail(`tags: key for ${id} is "${key}", shortest unique is "${shortest}"`);
  const parent = r[ix.parent];
  if (parent && !idSet.has(parent)) fail(`tags: ${id} parent "${parent}" is not an id`);
  if (parent && id !== parent && !id.startsWith(parent + '.')) fail(`tags: ${id} parent "${parent}" is not its id prefix`);
  const status = r[ix.status];
  if (!['live-tag', 'game-concept', 'new'].includes(status)) fail(`tags: ${id} status "${status}" not in vocabulary`);
  const live = r[ix.liveId];
  if (live && status !== 'live-tag') fail(`tags: ${id} has liveId but status ${status}`);
}

// values and formulas keys (variables and formula references)
const values = T('values');
const formulas = T('formulas');
const valueKeys = new Set(values.rows.map(r => r[0]));
const formulaKeys = new Set(formulas.rows.map(r => r[0]));
const numKeys = new Set([...valueKeys, ...formulaKeys]);

for (const r of tagRow) {
  for (const k of splitRefs(r[ix.school])) if (!keySet.has(k)) fail(`tags: ${r[ix.id]} school "${k}" does not resolve`);
  for (const k of splitRefs(r[ix.related])) if (!keySet.has(k)) fail(`tags: ${r[ix.id]} related "${k}" does not resolve`);
  for (const k of splitRefs(r[ix.variables])) if (!numKeys.has(k)) fail(`tags: ${r[ix.id]} variables "${k}" does not resolve`);
  const live = r[ix.liveId];
  if (live && !nodeIdsFromFile().has(live)) fail(`tags: ${r[ix.id]} liveId "${live}" is not in nodes.csv`);
}

function nodeIdsFromFile() {
  if (!nodeIdsCache) {
    const text = readFileSync(NODES, 'utf8').split('\n').filter(l => l && !l.startsWith('#')).join('\n');
    nodeIdsCache = new Set(parseCsv(text).slice(1).map(r => r[0]));
  }
  return nodeIdsCache;
}

// -------------------------------------------------------------- objects etc.
const objects = T('objects');
const objectIds = new Set(objects.rows.map(r => r[0]));
const oc = name => objects.header.indexOf(name);
for (const r of objects.rows) {
  const id = r[0];
  for (const k of splitRefs(r[oc('tags')])) if (!keySet.has(k)) fail(`objects: ${id} tag "${k}" does not resolve`);
  for (const c of ['skill', 'exp', 'cardType', 'stance', 'rarity', 'costResource']) {
    for (const k of splitRefs(r[oc(c)])) if (!keySet.has(k)) fail(`objects: ${id} ${c} "${k}" does not resolve`);
  }
  for (const g of splitRefs(r[oc('grants')])) if (!objectIds.has(g)) fail(`objects: ${id} grants "${g}" is not an object id`);
}

const ranks = T('ranks');
for (const r of ranks.rows) {
  if (!objectIds.has(r[0])) fail(`ranks: object "${r[0]}" is not an object id`);
  if (!valueKeys.has(r[2])) fail(`ranks: key "${r[2]}" is not a values key`);
}

const relations = T('relations');
for (const r of relations.rows) {
  if (!keySet.has(r[0])) fail(`relations: source "${r[0]}" does not resolve`);
  if (!keySet.has(r[2])) fail(`relations: target "${r[2]}" does not resolve`);
}

// [rank] is the object's own rank from ranks.csv, supplied at evaluation time
// (dodgeRoll.block uses it). It is not a values key, so it is allowed here only.
const RUNTIME_VARS = new Set(['rank']);
for (const r of formulas.rows) {
  for (const m of String(r[1]).matchAll(/\[([^\]]+)\]/g)) {
    if (!numKeys.has(m[1]) && !RUNTIME_VARS.has(m[1])) fail(`formulas: ${r[0]} references [${m[1]}] which does not resolve`);
  }
}

// ------------------------------------------------------ presentation tables
const BAND_OK = new Set(['mobile', 'tablet', 'desktop', 'state', 'other', 'all']);
const SCOPE_OK = new Set(['player', 'tuning']);
for (const file of csvFiles.filter(f => f.startsWith(PRES))) {
  const t = tables[file];
  if (!t) continue;
  const name = file.replace(TM + '/', '');
  const tagCol = t.header.indexOf('tag');
  if (tagCol < 0) { fail(`${name}: no tag column`); continue; }
  if (t.header.indexOf('liveRef') < 0) fail(`${name}: no liveRef column`);
  const bandCol = t.header.indexOf('band');
  const scopeCol = t.header.indexOf('scope');
  t.rows.forEach((r, i) => {
    const tag = r[tagCol];
    if (!keySet.has(tag)) fail(`${name}: row ${i + 2} tag "${tag}" is not a tag key`);
    if (!keyToId[tag] || !keyToId[tag].startsWith('meta.presentation')) fail(`${name}: row ${i + 2} tag "${tag}" is not a presentation node`);
    if (bandCol >= 0 && !BAND_OK.has(r[bandCol])) fail(`${name}: row ${i + 2} band "${r[bandCol]}" not in vocabulary`);
    if (scopeCol >= 0 && !SCOPE_OK.has(r[scopeCol])) fail(`${name}: row ${i + 2} scope "${r[scopeCol]}" not in vocabulary`);
  });
}

// ----------------------------------------------------------------- report
const presentationTables = csvFiles.filter(f => f.startsWith(PRES)).length;
const presentationRows = csvFiles.filter(f => f.startsWith(PRES)).reduce((a, f) => a + tables[f].rows.length, 0);
console.log(`checked ${csvFiles.length} CSV files (${presentationTables} presentation, ${presentationRows} presentation rows)`);
console.log(`tags: ${tagRow.length} nodes, ${tagRow.filter(r => r[ix.id].startsWith('meta.presentation')).length} presentation`);
if (errors.length) {
  for (const e of errors) console.error('FAIL ' + e);
  console.error(`${errors.length} problem(s)`);
  process.exit(1);
}
console.log('ok: all checks pass');
