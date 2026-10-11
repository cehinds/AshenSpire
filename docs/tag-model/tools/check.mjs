// Validates the tag-model tables. Exit 0 when every check passes, 1 otherwise.
//
//   node docs/tag-model/tools/check.mjs
//
// Every failure prints a FAIL line. A table whose expected column is missing
// fails by name and its row checks are skipped; a missing column never passes.
//
// Checks:
//   - shape: every CSV under tables/ and tables/presentation/ parses, with a
//     consistent column count, LF line endings and a final newline; every column
//     the checks rely on exists
//   - keys: tags id and key unique, and each key is the shortest unique suffix
//     of its id; objects id, values key, formulas key, assets id unique; ranks
//     (object, rank, key), relations (source, relation, target) and presentation
//     tokens (token, theme, file) unique; presentation components, effects,
//     animations, symbols, assets id, resolutions tier, breakpoints name,
//     settings key, strings key and combat-symbols tagKey unique
//   - css: components cssClasses are selector classes in styles/*.css; a
//     catalog row lists them exactly when its notes do not say css:unresolved
//   - duplicates: no presentation table holds two identical rows
//   - references: tags parent (id), school and related (keys), variables (values
//     or formulas keys); objects tags, skill, exp, cardType, stance, rarity,
//     costResource (keys) and grants (object ids); ranks object (object id) and
//     key (values key); relations source and target (keys); formulas [key]
//     references; components parent (components id); layouts and styles
//     componentId (components id); presentation tag (a presentation node key)
//   - assets: components assetRefs tokens are blank, an assets id, or a "*"
//     pattern that matches at least one assets id; combat-symbols assignedAssetRef
//     is blank, an assets id, or an svg:<Module>.<NAME>.<key> reference whose
//     module, NAME and key all appear in its source file (svg-source.mjs); a
//     combat-symbols row is status missing exactly when assignedAssetRef is blank
//   - vocabularies: tags status; layouts and styles band; settings scope;
//     combat-symbols status
//   - tag status: liveId only on a live-tag, resolves to a nodes.csv id, and a
//     nodes.csv id claimed by two tags must be listed in SHARED_LIVE; the
//     "Moved: re-homed" note appears at most once per description

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTable, parseCsv } from './csv.mjs';
import { SHARED_LIVE } from './live-map.mjs';
import { svgRefProblem } from './svg-source.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TM = join(HERE, '..');
const TABLES = join(TM, 'tables');
const PRES = join(TABLES, 'presentation');
const NODES = join(TM, '..', '..', 'content', 'source', 'nodes.csv');

const errors = [];
const fail = msg => errors.push(msg);
const splitRefs = v => String(v || '').split(/\s+/).filter(Boolean);

// ---------------------------------------------------------------- CSV shape
const csvFiles = [
  ...readdirSync(TABLES).filter(f => f.endsWith('.csv')).map(f => join(TABLES, f)),
  ...readdirSync(PRES).filter(f => f.endsWith('.csv')).map(f => join(PRES, f)),
];
const byPath = {};
for (const file of csvFiles) {
  const text = readFileSync(file, 'utf8');
  const name = file.replace(TM + '/', '');
  if (text.includes('\r')) fail(`${name}: CR line ending (must be LF)`);
  if (!text.endsWith('\n')) fail(`${name}: no final newline`);
  try {
    byPath[file] = readTable(file);
  } catch (e) {
    fail(`${name}: ${e.message}`);
  }
}
const T = name => byPath[join(TABLES, name + '.csv')];
const P = name => byPath[join(PRES, name + '.csv')];

// Every named column must exist. Returns false (after failing) when one is missing.
function need(label, t, cols) {
  if (!t) { fail(`${label}: table could not be read`); return false; }
  let ok = true;
  for (const c of cols) {
    if (t.header.indexOf(c) < 0) { fail(`${label}: missing column ${c}`); ok = false; }
  }
  return ok;
}
const at = (t, r, c) => r[t.header.indexOf(c)];

// Duplicate values of a key: a list of the tuples that occur more than once.
function duplicateKeys(t, cols) {
  const seen = new Map();
  for (const r of t.rows) {
    const k = cols.map(c => at(t, r, c)).join('\u0001');
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  return [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k.split('\u0001').join(' | '));
}
function checkUnique(label, t, cols) {
  const dups = duplicateKeys(t, cols);
  if (dups.length) fail(`${label}: duplicate ${cols.join('+')} ${dups.slice(0, 5).join(', ')}${dups.length > 5 ? ` (+${dups.length - 5} more)` : ''}`);
}

// ------------------------------------------------------------------- tags
const tags = T('tags');
const TAG_COLS = ['id', 'key', 'label', 'parent', 'erd', 'school', 'description', 'effect', 'variables', 'duration', 'stacking', 'related', 'status', 'glyph', 'color', 'liveId'];
const TAG_STATUS = ['live-tag', 'game-concept', 'new'];
let tagRow = [];
let nodeIds = null;
const nodeIdsFromFile = () => {
  if (!nodeIds) {
    const text = readFileSync(NODES, 'utf8').split('\n').filter(l => l && !l.startsWith('#')).join('\n');
    nodeIds = new Set(parseCsv(text).slice(1).map(r => r[0]));
  }
  return nodeIds;
};
const keySet = new Set();
const keyToId = {};
const idSet = new Set();
if (need('tags', tags, TAG_COLS)) {
  tagRow = tags.rows;
  const ids = tagRow.map(r => at(tags, r, 'id'));
  const keys = tagRow.map(r => at(tags, r, 'key'));
  ids.forEach(i => idSet.add(i));
  keys.forEach(k => keySet.add(k));
  tagRow.forEach(r => { keyToId[at(tags, r, 'key')] = at(tags, r, 'id'); });
  checkUnique('tags', tags, ['id']);
  checkUnique('tags', tags, ['key']);
  const liveClaims = {};
  for (const r of tagRow) {
    const id = at(tags, r, 'id');
    const key = at(tags, r, 'key');
    const segs = id.split('.');
    if (!(key === id || id.endsWith('.' + key))) fail(`tags: key "${key}" is not a suffix of ${id}`);
    let shortest = null;
    for (let n = 1; n <= segs.length && !shortest; n++) {
      const s = segs.slice(segs.length - n).join('.');
      if (!ids.some(o => o !== id && (o === s || o.endsWith('.' + s)))) shortest = s;
    }
    if (shortest !== key) fail(`tags: key for ${id} is "${key}", shortest unique is "${shortest}"`);
    const parent = at(tags, r, 'parent');
    if (parent && !idSet.has(parent)) fail(`tags: ${id} parent "${parent}" is not an id`);
    if (parent && id !== parent && !id.startsWith(parent + '.')) fail(`tags: ${id} parent "${parent}" is not its id prefix`);
    const status = at(tags, r, 'status');
    if (!TAG_STATUS.includes(status)) fail(`tags: ${id} status "${status}" not in vocabulary`);
    const live = at(tags, r, 'liveId');
    if (live && status !== 'live-tag') fail(`tags: ${id} has liveId but status ${status}`);
    if (live) (liveClaims[live] ||= []).push(id);
    const moved = (at(tags, r, 'description').match(/Moved: re-homed/g) || []).length;
    if (moved > 1) fail(`tags: ${id} description has the "Moved: re-homed" note ${moved} times`);
  }
  for (const [live, claimed] of Object.entries(liveClaims)) {
    if (!nodeIdsFromFile().has(live)) fail(`tags: liveId "${live}" (${claimed.join(', ')}) is not in nodes.csv`);
    if (claimed.length > 1 && !SHARED_LIVE[live]) fail(`tags: liveId "${live}" is claimed by ${claimed.join(', ')} with no SHARED_LIVE reason`);
  }
  for (const live of Object.keys(SHARED_LIVE)) {
    if ((liveClaims[live] || []).length < 2) fail(`tags: SHARED_LIVE lists ${live}, which is not claimed by two tags`);
  }
  for (const r of tagRow) {
    const id = at(tags, r, 'id');
    for (const k of splitRefs(at(tags, r, 'school'))) if (!keySet.has(k)) fail(`tags: ${id} school "${k}" does not resolve`);
    for (const k of splitRefs(at(tags, r, 'related'))) if (!keySet.has(k)) fail(`tags: ${id} related "${k}" does not resolve`);
  }
}

// values, formulas (variables and [key] references)
const values = T('values');
const formulas = T('formulas');
const valueKeys = new Set();
const formulaKeys = new Set();
const formulasOk = need('formulas', formulas, ['key', 'expr']);
if (need('values', values, ['key'])) { values.rows.forEach(r => valueKeys.add(at(values, r, 'key'))); checkUnique('values', values, ['key']); }
if (formulasOk) { formulas.rows.forEach(r => formulaKeys.add(at(formulas, r, 'key'))); checkUnique('formulas', formulas, ['key']); }
const numKeys = new Set([...valueKeys, ...formulaKeys]);
if (need('tags', tags, ['variables'])) {
  for (const r of tagRow) {
    for (const k of splitRefs(at(tags, r, 'variables'))) if (!numKeys.has(k)) fail(`tags: ${at(tags, r, 'id')} variables "${k}" does not resolve`);
  }
}

// ---------------------------------------------------------- objects and rules
const objects = T('objects');
const OBJECT_REFS = ['tags', 'skill', 'exp', 'cardType', 'stance', 'rarity', 'costResource'];
const objectIds = new Set();
if (need('objects', objects, ['id', 'grants', ...OBJECT_REFS])) {
  objects.rows.forEach(r => objectIds.add(at(objects, r, 'id')));
  checkUnique('objects', objects, ['id']);
  for (const r of objects.rows) {
    const id = at(objects, r, 'id');
    for (const c of OBJECT_REFS) {
      for (const k of splitRefs(at(objects, r, c))) if (!keySet.has(k)) fail(`objects: ${id} ${c} "${k}" does not resolve`);
    }
    for (const g of splitRefs(at(objects, r, 'grants'))) if (!objectIds.has(g)) fail(`objects: ${id} grants "${g}" is not an object id`);
  }
}

const ranks = T('ranks');
if (need('ranks', ranks, ['object', 'rank', 'key'])) {
  checkUnique('ranks', ranks, ['object', 'rank', 'key']);
  for (const r of ranks.rows) {
    if (!objectIds.has(at(ranks, r, 'object'))) fail(`ranks: object "${at(ranks, r, 'object')}" is not an object id`);
    if (!valueKeys.has(at(ranks, r, 'key'))) fail(`ranks: key "${at(ranks, r, 'key')}" is not a values key`);
  }
}

const relations = T('relations');
if (need('relations', relations, ['source', 'relation', 'target'])) {
  checkUnique('relations', relations, ['source', 'relation', 'target']);
  for (const r of relations.rows) {
    if (!keySet.has(at(relations, r, 'source'))) fail(`relations: source "${at(relations, r, 'source')}" does not resolve`);
    if (!keySet.has(at(relations, r, 'target'))) fail(`relations: target "${at(relations, r, 'target')}" does not resolve`);
  }
}

// [rank] is the object's own rank from ranks.csv, supplied at evaluation time
// (dodgeRoll.block uses it). It is not a values key, so it is allowed here only.
const RUNTIME_VARS = new Set(['rank']);
if (formulasOk) {
  for (const r of formulas.rows) {
    for (const m of String(at(formulas, r, 'expr')).matchAll(/\[([^\]]+)\]/g)) {
      if (!numKeys.has(m[1]) && !RUNTIME_VARS.has(m[1])) fail(`formulas: ${at(formulas, r, 'key')} references [${m[1]}] which does not resolve`);
    }
  }
}

const assetsTop = T('assets');
if (need('assets', assetsTop, ['id'])) checkUnique('assets', assetsTop, ['id']);

// ------------------------------------------------------ presentation tables
const BAND_OK = new Set(['mobile', 'tablet', 'desktop', 'state', 'other', 'all']);
const SCOPE_OK = new Set(['player', 'tuning']);
const COMBAT_STATUS = new Set(['has symbol', 'placeholder', 'missing']);

// name -> key columns (unique together) and the columns the checks read.
const PRES_SPEC = {
  components: { key: ['id'], cols: ['id', 'group', 'parent', 'file', 'assetRefs', 'notes', 'cssClasses', 'tag', 'liveRef'] },
  layouts: { key: null, cols: ['componentId', 'breakpoint', 'band', 'tag', 'liveRef'] },
  styles: { key: null, cols: ['componentId', 'cssComponentId', 'selector', 'property', 'breakpoint', 'band', 'tag', 'liveRef'] },
  tokens: { key: ['token', 'theme', 'file'], cols: ['token', 'theme', 'file', 'tag', 'liveRef'] },
  breakpoints: { key: ['name'], cols: ['name', 'condition', 'file', 'tag', 'liveRef'] },
  assets: { key: ['id'], cols: ['id', 'category', 'tag', 'liveRef'] },
  animations: { key: ['id'], cols: ['id', 'tag', 'liveRef'] },
  effects: { key: ['id'], cols: ['id', 'kind', 'tag', 'liveRef'] },
  resolutions: { key: ['tier'], cols: ['tier', 'tag', 'liveRef'] },
  settings: { key: ['key'], cols: ['key', 'scope', 'tag', 'liveRef'] },
  symbols: { key: ['id'], cols: ['id', 'tag', 'liveRef'] },
  'combat-symbols': { key: ['tagKey'], cols: ['tagKey', 'status', 'assignedAssetRef', 'tag', 'liveRef'] },
  strings: { key: ['key'], cols: ['key', 'tooltip', 'file', 'tag', 'liveRef'] },
};
const presOk = {};
for (const [name, spec] of Object.entries(PRES_SPEC)) {
  const t = P(name);
  const label = `presentation/${name}`;
  presOk[name] = need(label, t, spec.cols);
  if (!presOk[name]) continue;
  if (spec.key) checkUnique(label, t, spec.key);
  const dups = t.rows.map(r => JSON.stringify(r));
  const exact = dups.length - new Set(dups).size;
  if (exact) fail(`${label}: ${exact} exact duplicate row(s)`);
  t.rows.forEach((r, i) => {
    const tag = at(t, r, 'tag');
    if (!keySet.has(tag)) fail(`${label}: row ${i + 2} tag "${tag}" is not a tag key`);
    else if (!keyToId[tag] || !keyToId[tag].startsWith('meta.presentation')) fail(`${label}: row ${i + 2} tag "${tag}" is not a presentation node`);
  });
}

// vocabularies
for (const name of ['layouts', 'styles']) {
  if (presOk[name]) P(name).rows.forEach((r, i) => {
    if (!BAND_OK.has(at(P(name), r, 'band'))) fail(`presentation/${name}: row ${i + 2} band "${at(P(name), r, 'band')}" not in vocabulary`);
  });
}
if (presOk.settings) P('settings').rows.forEach((r, i) => {
  if (!SCOPE_OK.has(at(P('settings'), r, 'scope'))) fail(`presentation/settings: row ${i + 2} scope "${at(P('settings'), r, 'scope')}" not in vocabulary`);
});

// components: parent and id; layouts and styles componentId
const comps = P('components');
const compIds = new Set();
if (presOk.components) {
  comps.rows.forEach(r => compIds.add(at(comps, r, 'id')));
  for (const r of comps.rows) {
    const id = at(comps, r, 'id');
    const parent = at(comps, r, 'parent');
    if (parent && !compIds.has(parent)) fail(`presentation/components: ${id} parent "${parent}" is not a components id`);
    if (parent && parent === id) fail(`presentation/components: ${id} is its own parent`);
  }
}
for (const name of ['layouts', 'styles']) {
  if (!presOk[name] || !presOk.components) continue;
  P(name).rows.forEach((r, i) => {
    const c = at(P(name), r, 'componentId');
    if (!compIds.has(c)) fail(`presentation/${name}: row ${i + 2} componentId "${c}" is not a components id`);
  });
}

// styles: cssComponentId is a components id. componentId equals it, or is a
// catalog component whose cssClasses include a class of the row's selector.
if (presOk.styles && presOk.components) {
  const st = P('styles');
  const compById = new Map(comps.rows.map(r => [at(comps, r, 'id'), r]));
  st.rows.forEach((r, i) => {
    const css = at(st, r, 'cssComponentId');
    const own = at(st, r, 'componentId');
    if (!compIds.has(css)) fail(`presentation/styles: row ${i + 2} cssComponentId "${css}" is not a components id`);
    if (own === css) return;
    const row = compById.get(own);
    if (!row || !/\[catalog\b/.test(at(comps, row, 'notes'))) {
      fail(`presentation/styles: row ${i + 2} componentId "${own}" differs from cssComponentId "${css}" but is not a catalog component`);
      return;
    }
    const sel = new Set([...at(st, r, 'selector').replace(/\[[^\]]*\]/g, '').matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(m => m[1]));
    if (!splitRefs(at(comps, row, 'cssClasses')).some(c => sel.has(c))) {
      fail(`presentation/styles: row ${i + 2} componentId "${own}" shares no class with selector "${at(st, r, 'selector')}"`);
    }
  });
}

// Regression guards for the owner rules: the last compound decides, classes in
// :not()/:is()/:where() and generic state classes do not, and an ancestor class
// (.card in ".card .ctext") does not pick the owner.
if (presOk.styles && presOk.components) {
  const st = P('styles');
  const catalogOwnersOf = c => comps.rows
    .filter(r => /\[catalog\b/.test(at(comps, r, 'notes')) && splitRefs(at(comps, r, 'cssClasses')).includes(c))
    .map(r => at(comps, r, 'id'));
  const guard = (selector, check) => {
    const rows = st.rows.filter(r => at(st, r, 'selector') === selector);
    if (!rows.length) fail(`presentation/styles: guard selector "${selector}" has no rows`);
    for (const r of rows) check(at(st, r, 'componentId'));
  };
  const soleOwner = c => {
    const owners = catalogOwnersOf(c);
    return owners.length === 1 ? owners[0] : null;
  };
  // ctext is set by card.js's shared renderer (cardTooltip, upgradePreviewHtml), which has
  // no catalog row. No catalog component owns it, so ".card .ctext" keeps its CSS-derived
  // componentId, and smith-upgrade-preview (which embeds the renderer) says so in its notes.
  if (catalogOwnersOf('ctext').length) fail(`presentation/styles: ctext must have no catalog owner (shared renderer), got ${catalogOwnersOf('ctext').join(', ')}`);
  {
    const ctextRows = st.rows.filter(r => at(st, r, 'selector') === '.card .ctext');
    if (!ctextRows.length) fail('presentation/styles: guard selector ".card .ctext" has no rows');
    for (const r of ctextRows) if (at(st, r, 'componentId') !== at(st, r, 'cssComponentId')) fail(`presentation/styles: ".card .ctext" componentId "${at(st, r, 'componentId')}" must stay unowned (cssComponentId "${at(st, r, 'cssComponentId')}")`);
  }
  const smithRow = comps.rows.find(r => at(comps, r, 'id') === 'smith-upgrade-preview');
  if (!smithRow || !/owner:shared-renderer/.test(at(comps, smithRow, 'notes'))) fail('presentation/components: "smith-upgrade-preview" notes must say owner:shared-renderer');
  // circle:not(.node-halo) is styled by circle, so the :not() class does not name map-node-face.
  guard('.map-node.reachable > circle:not(.node-halo)', own => { if (own === 'map-node-face') fail('presentation/styles: "circle:not(.node-halo)" must not go to map-node-face'); });
  // .spent is generic: the deck editor owns the name, not the armoury card row.
  // deck-editor-name is a catalog id styled by its own class (no cssClasses entry needed).
  guard('.deck-editor-tile.spent .deck-editor-name', own => { if (own !== 'deck-editor-name') fail(`presentation/styles: ".deck-editor-tile.spent .deck-editor-name" componentId "${own}" should be "deck-editor-name"`); });
  // "outline" is a generic state class that more than one catalog component adds, so it
  // never picks the owner: the rule belongs to deck-editor-art. Without the generic skip
  // the owner becomes formation-layout-editor, so this guard fails then.
  guard('.deck-editor-art.outline', own => { if (own !== 'deck-editor-art') fail(`presentation/styles: ".deck-editor-art.outline" componentId "${own}" should be "deck-editor-art"`); });
  // as-option is not a GENERIC_STATE class but nine catalog components add it, so it is
  // generic by the GENERIC_OWNERS threshold. Its owner must come from equip-chip alone.
  // Without the threshold, as-option's nine owners make the owner set larger than one and
  // the row falls back to cssComponentId "as-option", which the guard then rejects.
  if (catalogOwnersOf('as-option').length < 3) fail('presentation/components: "as-option" must have three or more catalog owners (threshold guard)');
  guard('.equip-chip.as-option', own => { if (own !== 'equipment-choice-card') fail(`presentation/styles: ".equip-chip.as-option" componentId "${own}" should be "equipment-choice-card" (as-option must stay generic via GENERIC_OWNERS)`); });
}

// Kit helper matching: a component gets a kit helper's classes only when its file
// imports the helper and calls it bare. These rows were wrong before the match was
// limited to imported helpers (classList.toggle, a local button()).
if (presOk.components) {
  const classesOf = id => {
    const row = comps.rows.find(r => at(comps, r, 'id') === id);
    if (!row) { fail(`presentation/components: guard component "${id}" is missing`); return []; }
    return splitRefs(at(comps, row, 'cssClasses'));
  };
  const forbidden = { 'startup-mark': 'as-toggle', 'startup-divider': 'as-toggle', 'startup-ash-particle': 'as-toggle', 'menu-panel': 'as-toggle', 'shared-run-hud': 'as-btn', 'quick-access-panel': 'as-btn' };
  for (const [id, cls] of Object.entries(forbidden)) {
    if (classesOf(id).includes(cls)) fail(`presentation/components: "${id}" must not list "${cls}" (kit helper matched without an import)`);
  }
  if (!classesOf('title-menu-item').includes('tm-entry')) fail('presentation/components: "title-menu-item" must list "tm-entry" (imported titleMenu)');
}

// cssClasses: every listed class is a selector class in styles/*.css; only a
// catalog row (notes [catalog) lists classes, and it lists none exactly when its
// notes say css:unresolved.
const styleClasses = new Set();
for (const f of readdirSync(join(TM, '..', '..', 'styles')).filter(f => f.endsWith('.css')).sort()) {
  const css = readFileSync(join(TM, '..', '..', 'styles', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/([^{}]+)\{/g)) {
    const prelude = m[1].trim();
    if (prelude.startsWith('@')) continue;
    for (const c of prelude.replace(/\[[^\]]*\]/g, '').matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) styleClasses.add(c[1]);
  }
}
if (presOk.components) {
  comps.rows.forEach((r, i) => {
    const id = at(comps, r, 'id');
    const classes = splitRefs(at(comps, r, 'cssClasses'));
    for (const c of classes) if (!styleClasses.has(c)) fail(`presentation/components: row ${i + 2} (${id}) cssClasses "${c}" is not a selector class in styles/*.css`);
    const catalog = /\[catalog\b/.test(at(comps, r, 'notes'));
    const unresolved = /css:unresolved/.test(at(comps, r, 'notes'));
    if (!catalog && classes.length) fail(`presentation/components: row ${i + 2} (${id}) lists cssClasses but is not a catalog component`);
    if (catalog && unresolved !== (classes.length === 0)) fail(`presentation/components: row ${i + 2} (${id}) cssClasses ${classes.length ? 'set' : 'blank'} does not match css:unresolved in notes`);
  });
  // Regression: title-menu-item is built by the kit's titleMenu (cls('tm-entry')),
  // called from title.js mountTitle. Per-component scoping must keep tm-entry.
  const tmItem = comps.rows.find(r => at(comps, r, 'id') === 'title-menu-item');
  if (tmItem && !splitRefs(at(comps, tmItem, 'cssClasses')).includes('tm-entry')) {
    fail('presentation/components: title-menu-item cssClasses must include tm-entry');
  }
}

// assets: components assetRefs, combat-symbols assignedAssetRef
const assetIds = new Set();
const assetsPres = P('assets');
if (presOk.assets) assetsPres.rows.forEach(r => assetIds.add(at(assetsPres, r, 'id')));
const assetList = [...assetIds];
const patternOk = pat => {
  const re = new RegExp('^' + pat.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
  return assetList.some(id => re.test(id));
};
// true when the token is blank, an assets id, or a "*" pattern matching one
const assetTokenOk = tok => (tok === '' || (tok.includes('*') ? patternOk(tok) : assetIds.has(tok)));

if (presOk.components && presOk.assets) {
  comps.rows.forEach((r, i) => {
    for (const tok of splitRefs(at(comps, r, 'assetRefs'))) {
      if (!assetTokenOk(tok)) fail(`presentation/components: row ${i + 2} (${at(comps, r, 'id')}) assetRefs "${tok}" is not an assets id, a pattern with a match, or blank`);
    }
  });
}
if (presOk['combat-symbols'] && presOk.assets) {
  const cs = P('combat-symbols');
  cs.rows.forEach((r, i) => {
    const tok = at(cs, r, 'assignedAssetRef');
    const status = at(cs, r, 'status');
    if (tok.startsWith('svg:')) {
      const problem = svgRefProblem(tok);
      if (problem) fail(`presentation/combat-symbols: row ${i + 2} (${at(cs, r, 'tagKey')}) ${problem}`);
    } else if (!assetTokenOk(tok)) {
      fail(`presentation/combat-symbols: row ${i + 2} (${at(cs, r, 'tagKey')}) assignedAssetRef "${tok}" is not an assets id, an svg: reference, a pattern with a match, or blank`);
    }
    if (!COMBAT_STATUS.has(status)) fail(`presentation/combat-symbols: row ${i + 2} status "${status}" not in vocabulary`);
    if ((status === 'missing') !== (tok === '')) fail(`presentation/combat-symbols: row ${i + 2} (${at(cs, r, 'tagKey')}) status "${status}" does not match assignedAssetRef "${tok}"`);
  });
}

// ----------------------------------------------------------------- report
const presentationRows = Object.keys(PRES_SPEC).reduce((a, n) => a + (P(n) ? P(n).rows.length : 0), 0);
console.log(`checked ${csvFiles.length} CSV files (${Object.keys(PRES_SPEC).length} presentation, ${presentationRows} presentation rows)`);
console.log(`tags: ${tagRow.length} nodes, ${tagRow.filter(r => at(tags, r, 'id').startsWith('meta.presentation')).length} presentation`);
if (errors.length) {
  for (const e of errors) console.error('FAIL ' + e);
  console.error(`${errors.length} problem(s)`);
  process.exit(1);
}
console.log('ok: all checks pass');
