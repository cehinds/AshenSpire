// Regenerates the presentation layer and the Task 2/3 tag changes.
//
//   node docs/tag-model/tools/build.mjs --inv <dir-with-inventory-csvs>
//   node docs/tag-model/tools/build.mjs            (re-run from tables/presentation/)
//
// --inv copies the raw inventory CSVs into tables/presentation/ first. Without
// it the script reads the copies there and strips the derived columns, so the
// run is repeatable: a second run over its own output is byte-identical. It then:
//   0. cleans the inventory: id/name columns that repeat get a -2, -3 suffix
//      (effects.id, breakpoints.name); exact duplicate rows are dropped
//      (layouts, styles); components.assetRefs keeps only tokens that resolve
//      against assets.id, a "../" prefix is dropped, a ${...} template becomes
//      a "*" pattern (kept only if it matches an asset), anything else is blank;
//   1. writes tables/presentation/<name>.csv with tag, liveRef and the
//      per-table derived columns (band, scope, assignedAssetRef). combat-symbols
//      assignedAssetRef resolves to an assets.id, an svg:<Module>.<NAME>.<key>
//      inline SVG (checked against its source file), or is blank, and status is
//      placeholder / has symbol / missing accordingly;
//   2. rebuilds the meta.presentation nodes in tables/tags.csv;
//   3. sets status (live-tag / game-concept / new) and liveId on every tag. The
//      "Moved: re-homed" note is written once, never appended again;
//   4. recomputes every key as the shortest unique id suffix and rewrites the
//      references to keys that changed (tags school/related, objects, relations).
// Run tools/check.mjs afterwards.

import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTable, parseCsv, toCsv } from './csv.mjs';
import { bandOf } from './bands.mjs';
import { LIVE, GAME, SHARED_LIVE } from './live-map.mjs';
import { svgRefFromText, svgRefProblem } from './svg-source.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TM = join(HERE, '..');
const TABLES = join(TM, 'tables');
const PRES = join(TABLES, 'presentation');
const NODES = join(TM, '..', '..', 'content', 'source', 'nodes.csv');
const LEGACY = JSON.parse(readFileSync(join(HERE, 'legacy-status.json'), 'utf8'));

const argv = process.argv.slice(2);
const invAt = argv.indexOf('--inv');
const INV = invAt >= 0 ? argv[invAt + 1] : null;

const INVENTORY = ['components', 'layouts', 'styles', 'tokens', 'breakpoints', 'assets', 'animations',
  'effects', 'resolutions', 'settings', 'symbols', 'combat-symbols', 'strings'];
// Columns this script derives. They are stripped when reading the copies.
const DERIVED = {
  components: ['tag', 'liveRef', 'cssClasses'], layouts: ['band', 'tag', 'liveRef'], styles: ['band', 'tag', 'liveRef', 'cssComponentId'],
  tokens: ['tag', 'liveRef'], breakpoints: ['tag', 'liveRef'], assets: ['tag', 'liveRef'],
  animations: ['tag', 'liveRef'], effects: ['tag', 'liveRef'], resolutions: ['tag', 'liveRef'],
  settings: ['scope', 'tag', 'liveRef'], symbols: ['tag', 'liveRef'],
  'combat-symbols': ['assignedAssetRef', 'tag', 'liveRef'], strings: ['tag', 'liveRef'],
};
const DERIVED_ALL = new Set(Object.values(DERIVED).flat());

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const presId = (...segs) => ['meta', 'presentation', ...segs].join('.');
const parentOf = id => (id.includes('.') ? id.slice(0, id.lastIndexOf('.')) : '');
const MOVED_NOTE = 'Moved: re-homed in the proposal (tag-tree.txt [m]).';
const MOVED_PREFIX = /^(Moved: re-homed in the proposal \(tag-tree\.txt \[m\]\)\.\s*)+/;

// ---------------------------------------------------------------- inventory
function readInventory(name) {
  if (INV) {
    const src = join(INV, name + '.csv');
    if (!existsSync(src)) throw new Error('missing inventory file ' + src);
    mkdirSync(PRES, { recursive: true });
    copyFileSync(src, join(PRES, name + '.csv'));
  }
  const t = readTable(join(PRES, name + '.csv'));
  // styles: an earlier run re-pointed componentId to a catalog component and kept
  // the CSS-derived id in cssComponentId. That id is the source value again here.
  if (name === 'styles' && t.header.includes('cssComponentId')) {
    const ci = t.header.indexOf('componentId');
    const cc = t.header.indexOf('cssComponentId');
    t.rows = t.rows.map((r) => { const nr = r.slice(); nr[ci] = r[cc]; return nr; });
  }
  const keep = t.header.map((h, i) => [h, i]).filter(([h]) => !DERIVED_ALL.has(h));
  return { header: keep.map(([h]) => h), rows: t.rows.map(r => keep.map(([, i]) => r[i])) };
}

const inv = Object.fromEntries(INVENTORY.map(n => [n, readInventory(n)]));
const col = (t, name) => t.header.indexOf(name);
const get = (t, r, name) => r[col(t, name)];
const need = (t, name, table) => {
  if (col(t, name) < 0) throw new Error(`${table}: missing column ${name}`);
  return col(t, name);
};

// --------------------------------------------------------------- cleaning
// Each step changes only what it must, so a second run changes nothing.
const assetIds = new Set(inv.assets.rows.map(r => get(inv.assets, r, 'id')));
const assetIdsList = [...assetIds];
const patternRe = pat => new RegExp('^' + pat.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
const patternMatches = pat => { const re = patternRe(pat); return assetIdsList.some(id => re.test(id)); };

// Keeps the first row of each duplicated id and renames later ones to -2, -3 ...
function uniquifyColumn(t, colName, table) {
  const idx = need(t, colName, table);
  const all = new Set(t.rows.map(r => r[idx]));
  const seen = new Set();
  let renamed = 0;
  t.rows = t.rows.map((r) => {
    const v = r[idx];
    if (!seen.has(v)) { seen.add(v); return r; }
    let n = 2;
    let cand;
    do { cand = `${v}-${n++}`; } while (all.has(cand) || seen.has(cand));
    all.add(cand);
    seen.add(cand);
    renamed++;
    const nr = r.slice();
    nr[idx] = cand;
    return nr;
  });
  return renamed;
}

// Drops rows identical to an earlier row, in every column.
function dropExactDuplicates(t) {
  const seen = new Set();
  const before = t.rows.length;
  t.rows = t.rows.filter((r) => {
    const k = JSON.stringify(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return before - t.rows.length;
}

// One token of components.assetRefs: an assets.id, a "*" pattern, or '' (dropped).
function cleanAssetToken(tok) {
  let t = tok.replace(/\$\{[^}]*\}/g, '*');
  if (t.startsWith('../')) t = t.slice(3); // stylesheet-relative path to a root-relative id
  if (t.includes('*')) return patternMatches(t) ? t : '';
  return assetIds.has(t) ? t : '';
}
function cleanAssetRefs(text) {
  const out = [...new Set(String(text).split(/\s+/).filter(Boolean).map(cleanAssetToken).filter(Boolean))];
  return out.join(' ');
}

const cleaning = {};
{
  const c = inv.components;
  const ai = need(c, 'assetRefs', 'components');
  let changed = 0;
  let dropped = 0;
  c.rows = c.rows.map((r) => {
    const before = String(r[ai]);
    const after = cleanAssetRefs(before);
    if (after !== before.trim().replace(/\s+/g, ' ')) { changed++; dropped += before.split(/\s+/).filter(Boolean).length - after.split(' ').filter(Boolean).length; }
    const nr = r.slice();
    nr[ai] = after;
    return nr;
  });
  cleaning.assetRefsRowsChanged = changed;
  cleaning.assetRefsTokensDropped = dropped;
}
cleaning.effectIdsRenamed = uniquifyColumn(inv.effects, 'id', 'effects');
cleaning.breakpointNamesRenamed = uniquifyColumn(inv.breakpoints, 'name', 'breakpoints');
cleaning.layoutRowsDropped = dropExactDuplicates(inv.layouts);
cleaning.styleRowsDropped = dropExactDuplicates(inv.styles);

// ------------------------------------------------------------- classifiers
// Settings scope. Advanced/config rows are tuning even where they are also
// listed on the settings screen: the brief's two scope rules overlap there and
// the tuning rule is the more specific one (see README, Presentation layer).
function scopeOf(r) {
  const file = get(inv.settings, r, 'file') + ' ' + get(inv.settings, r, 'readBy');
  const storage = get(inv.settings, r, 'storage');
  if (/advancedConfig|startingStatConfig|derivedStats|attributes\.js|classTree|content\/classes|content\/balance/.test(file)) return 'tuning';
  if (/Advanced config/i.test(storage)) return 'tuning';
  if (/src\/ui\/screens\/settings\.js/.test(file) || /localStorage/i.test(storage)) return 'player';
  return 'tuning';
}

function styleKind(prop) {
  const p = prop.toLowerCase();
  if (p.startsWith('--')) return 'token';
  if (p === 'z-index') return 'z-index';
  if (p === 'box-shadow' || p === 'text-shadow') return 'shadow';
  if (/radius/.test(p)) return 'radius';
  if (/^(transition|animation|transform|translate|scale|rotate|offset|will-change)/.test(p)) return 'motion';
  if (/^(color|background|background-color|background-image|border-color|border-top-color|border-bottom-color|border-left-color|border-right-color|outline-color|fill|stroke|caret-color|accent-color|text-decoration-color)$/.test(p)) return 'color';
  if (/^(font|line-height|letter-spacing|text-|white-space|word-|font-variant)/.test(p)) return 'typography';
  if (/^(padding|margin|gap|row-gap|column-gap|width|height|min-width|min-height|max-width|max-height|inset|top|left|right|bottom|block-size|inline-size)/.test(p)) return 'spacing';
  return 'other';
}

const ASSET_GROUP = {
  animation: 'animation', environment: 'background-art', 'card-part': 'card-structure', card: 'card-structure',
  equipment: 'card-structure', effect: 'effect', enemy: 'battlefield', 'player-sprite': 'battlefield',
  scene: 'scene', font: 'text', ui: 'hud-header', map: 'map', icon: 'symbol', audio: 'other', other: 'other',
};

const GROUPS = [
  ['scene', 'Scene', 'Scene art and frame.'],
  ['battlefield', 'Battlefield', 'Enemy and player stage.'],
  ['card-structure', 'Card structure', 'Card frame parts.'],
  ['hud-header', 'HUD header', 'Top bar HUD.'],
  ['footer', 'Footer', 'Bottom bar.'],
  ['button', 'Button', 'Buttons and icon buttons.'],
  ['modal', 'Modal', 'Dialogs and sheets.'],
  ['menu', 'Menu', 'Menus and navigation.'],
  ['background-art', 'Background art', 'Backdrops and environment art.'],
  ['map', 'Map', 'Run map.'],
  ['overlay', 'Overlay', 'Full-screen overlays.'],
  ['wireframe', 'Wireframe', 'Wireframe (grey-box) layouts.'],
  ['other', 'Other (component)', 'Components whose inventory group is other.'],
];
const GROUP_IDS = new Set(GROUPS.map(g => g[0]));
const groupOfComponent = g => {
  const m = { background: 'background-art' }[g] || g;
  return GROUP_IDS.has(m) ? m : 'other';
};

function textKind(r) {
  if (get(inv.strings, r, 'tooltip')) return 'tooltip';
  if (get(inv.strings, r, 'file').startsWith('src/')) return 'hardcoded';
  return 'label';
}


// ------------------------------------------------------------ tree nodes
const nodes = new Map(); // id -> { label, erd, description }
const node = (id, label, erd, description = '') => {
  if (nodes.has(id)) throw new Error('duplicate presentation node ' + id);
  nodes.set(id, { label, erd, description });
};

node(presId(), 'Presentation', 'TagNode', 'Presentation layer: how the game looks and reads. Carries no gameplay identity.');
for (const [g, label, d] of GROUPS) node(presId(g), label, 'Component', d);

node(presId('layout'), 'Layout', 'Layout', 'Positions and sizes of components.');
node(presId('layout', 'breakpoint'), 'Breakpoint', 'Breakpoint', 'Layout condition, normalised to a band.');
const BANDS = ['mobile', 'tablet', 'desktop', 'state', 'all', 'other'];
for (const b of BANDS) node(presId('layout', 'breakpoint', b), b[0].toUpperCase() + b.slice(1), 'Breakpoint', `Band ${b}.`);
node(presId('layout', 'anchor'), 'Anchor', 'Layout', 'Anchor and transform rules.');
node(presId('layout', 'z-layer'), 'Z-layer', 'Layout', 'Stacking layers.');

const resTiers = [...new Set(inv.resolutions.rows.map(r => get(inv.resolutions, r, 'tier').split(':')[0]))];
node(presId('resolution'), 'Resolution', 'Resolution', 'Art tiers and card sizes.');
for (const t of resTiers) node(presId('resolution', slug(t)), t, 'Resolution', `Tier ${t}.`);

const animGroups = [...new Set(inv.animations.rows.map(r => get(inv.animations, r, 'id').split('.')[0]))];
node(presId('animation'), 'Animation', 'Animation', 'Sprite and motion sequences.');
for (const g of animGroups) node(presId('animation', slug(g)), g, 'Animation', `Animation group ${g}.`);

const effectKinds = [...new Set(inv.effects.rows.map(r => get(inv.effects, r, 'kind')))];
node(presId('effect'), 'Effect', 'Effect', 'Visual effects by kind.');
for (const k of effectKinds) node(presId('effect', slug(k)), k, 'Effect', `Effect kind ${k}.`);

node(presId('text'), 'Text', 'String', 'Player-facing strings by use.');
for (const k of ['label', 'tooltip', 'hardcoded']) node(presId('text', k), k, 'String', `String kind ${k}.`);

const symGroups = [...new Set(inv.symbols.rows.map(r => get(inv.symbols, r, 'id').split(':')[0]))];
node(presId('symbol'), 'Symbol', 'Symbol', 'Icons and sigils.');
for (const g of symGroups) node(presId('symbol', slug(g)), g, 'Symbol', `Symbol group ${g}.`);

const SCOPES = ['player', 'tuning'];
node(presId('setting'), 'Setting', 'Setting', 'Settings rows by scope.');
for (const s of SCOPES) {
  node(presId('setting', s), s[0].toUpperCase() + s.slice(1), 'Setting', `Settings scope ${s}.`);
  const groups = [...new Set(inv.settings.rows.filter(r => scopeOf(r) === s).map(r => get(inv.settings, r, 'group')))];
  for (const g of groups) node(presId('setting', s, slug(g)), g, 'Setting', `${s} settings group ${g}.`);
}

const STYLE_KINDS = ['token', 'color', 'typography', 'spacing', 'radius', 'shadow', 'motion', 'z-index', 'other'];
node(presId('style'), 'Style', 'Style', 'CSS properties and tokens.');
for (const k of STYLE_KINDS) node(presId('style', k), k, k === 'token' ? 'Token' : 'Style', `Style kind ${k}.`);

// ------------------------------------------------------ row -> presentation id
const tagIds = {};
const liveRefs = {};
const bandCols = {};
const scopeCols = {};
const rowMap = (name, fn) => inv[name].rows.map((r) => fn(r));

// ------------------------------------------------- catalog component CSS classes
// cssClasses lists the CSS class selectors that style a catalog component (a row
// whose notes start [catalog). Candidates are the class names its owning JS file
// (the file column) puts on elements: className, classList, a class: key, a
// class="..." in a template string, setAttribute('class') and cls() arguments.
// Only the function or functions named by the notes' view= (the component's
// renderer) are read, so components in one file no longer share a list.
// They are kept when a styles/*.css selector uses them. A catalog id that is
// itself a selector class gets that class alone. Nothing found: the cell is blank
// and the notes gain css:unresolved (see README, cssClasses).
const ROOT = join(TM, '..', '..');
const selectorClasses = new Set();
for (const f of readdirSync(join(ROOT, 'styles')).filter(f => f.endsWith('.css')).sort()) {
  const css = readFileSync(join(ROOT, 'styles', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/([^{}]+)\{/g)) {
    const prelude = m[1].trim();
    if (prelude.startsWith('@')) continue;
    for (const c of prelude.replace(/\[[^\]]*\]/g, '').matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) selectorClasses.add(c[1]);
  }
}
const CLASS_KEY = /className|classList|\bclass\s*:|\bclass=|setAttribute\(\s*['"]class|\bcls\(/;
const CLASS_WORD = /^-?[_a-zA-Z][\w-]*$/;
function classWordsOf(src) {
  const out = new Set();
  for (const line of src.split('\n')) {
    const k = line.search(CLASS_KEY);
    if (k < 0) continue;
    const rest = line.slice(k);
    const quoted = [...rest.matchAll(/(['"`])((?:(?!\1).)*)\1/g), ...rest.matchAll(/\\"([^\\]*)\\"/g)];
    for (const m of quoted) for (const w of m[m.length - 1].split(/\s+/)) if (CLASS_WORD.test(w)) out.add(w);
  }
  return out;
}
// The body (braces included) of a function the owner file declares by name:
// `function NAME(...) {` or `const NAME = (...) => {`. Parentheses are skipped
// when looking for the opening brace, so destructured parameters do not end it.
// A declaration without a block body (a plain value, a call) gives null.
function functionBody(src, name) {
  const re = new RegExp(`(?:\\bfunction\\s+${name}\\s*\\(|\\b(?:const|let|var)\\s+${name}\\s*=\\s*(?:async\\s*)?\\()`);
  const m = re.exec(src);
  if (!m) return null;
  let i = m.index + m[0].length - 1; // on the parameter list's opening parenthesis
  let paren = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '(') paren++;
    else if (c === ')') paren--;
    else if (paren === 0 && c === '{') break;
    else if (paren === 0 && c === ';') return null;
  }
  if (i >= src.length) return null;
  const start = i;
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  return null;
}
const ownerSource = new Map();
const sourceOfOwner = file => {
  if (!ownerSource.has(file)) {
    const p = join(ROOT, file);
    ownerSource.set(file, file.endsWith('.js') && existsSync(p) ? readFileSync(p, 'utf8') : '');
  }
  return ownerSource.get(file);
};
// The classes a catalog component's own code sets: the bodies of the functions
// named in its notes `view=` (a renderer or model), not the whole owning file.
const viewNamesOf = notes => {
  const m = /view=([^;]*)/.exec(notes);
  return m ? [...new Set([...m[1].matchAll(/[A-Za-z_$][\w$]*/g)].map(x => x[0]))] : [];
};
// The kit (src/ui/kit/index.js) helpers build their elements with fixed classes
// (cls('tm-entry', ...) in titleMenu). A helper's text runs from its export to the
// next export. A component's code gets those classes when its body calls the
// helper, so the classes are attributed at the call site.
const KIT_FILE = 'src/ui/kit/index.js';
const kitClassesOf = new Map();
{
  const src = sourceOfOwner(KIT_FILE);
  for (const m of src.matchAll(/^export (?:const|function) ([A-Za-z_$][\w$]*)/gm)) {
    const next = src.indexOf('\nexport ', m.index + 1);
    kitClassesOf.set(m[1], classWordsOf(src.slice(m.index, next < 0 ? src.length : next)));
  }
}
// The kit helpers a file can call are the names it imports from the kit module,
// bound to their local names (`import { titleMenu as tm }` gives tm -> titleMenu).
// A namespace import is a member call, and a call written as x.toggle(...) is a
// member call too, so neither matches; a local function cannot share an imported
// name in the same module. Imports are read from the owner file itself.
const kitNamesOf = new Map();
const kitNames = file => {
  if (kitNamesOf.has(file)) return kitNamesOf.get(file);
  const out = new Map();
  const dir = dirname(resolve(ROOT, file));
  const kitPath = resolve(ROOT, KIT_FILE);
  for (const m of sourceOfOwner(file).matchAll(/\bimport\s*(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const target = resolve(dir, m[2]);
    if (![target, target + '.js', join(target, 'index.js')].includes(kitPath)) continue;
    for (const spec of m[1].split(',')) {
      const parts = spec.trim().split(/\s+as\s+/);
      const exported = parts[0].trim();
      const local = (parts[1] || parts[0]).trim();
      if (exported && !exported.startsWith('type ') && kitClassesOf.has(exported)) out.set(local, exported);
    }
  }
  kitNamesOf.set(file, out);
  return out;
};
const escapeRe = w => w.replace(/[$]/g, '\\$');
// A shared module is one that another src module imports from. A catalog component
// whose view clause says it runs `inside` another surface (smith-upgrade-preview:
// view=card.upgradePreviewHtml inside smithUpgradeModal) is embedding a function of
// a shared module, so the classes that function's own body sets belong to the
// shared renderer, not to the embedding component. The renderer has no catalog row
// of its own in that case, so those classes are left unowned (see README,
// cssClasses).
const moduleKey = p => p.replace(/\.js$/, '');
const importedNamesOf = new Map(); // module key -> Set of names other modules import from it
{
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name.endsWith('.js') ? [p] : [];
  });
  for (const file of walk(join(ROOT, 'src'))) {
    const from = moduleKey(file);
    const dir = dirname(file);
    for (const m of readFileSync(file, 'utf8').matchAll(/\bimport\s*\{([^}]*)\}\s*from\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const t = resolve(dir, m[2]);
      for (const key of new Set([moduleKey(t), moduleKey(join(t, 'index.js'))])) {
        if (key === from) continue;
        if (!importedNamesOf.has(key)) importedNamesOf.set(key, new Set());
        for (const spec of m[1].split(',')) {
          const name = spec.trim().split(/\s+as\s+/)[0].trim();
          if (name && !name.startsWith('type ')) importedNamesOf.get(key).add(name);
        }
      }
    }
  }
}
const isSharedModule = file => (importedNamesOf.get(moduleKey(resolve(ROOT, file))) || new Set()).size > 0;
const CALL_DEPTH = 2;
const wordsOfComponent = (file, notes) => {
  const src = sourceOfOwner(file);
  const out = new Set();
  // A renderer's classes include those set by the same-file functions it calls,
  // followed to CALL_DEPTH levels. Cross-file calls are not followed: the armoury
  // overlay owns only modal-veil, since renderArmouryOverlay never calls
  // renderArmouryPanel; equipment.js composes the panel into the overlay's wrap.
  // The least depth each function has been reached at. A function first met deep
  // in the walk is expanded again when a shallower path reaches it, so its own
  // callees are still followed to the full depth from there.
  const least = new Map();
  const addBody = (name, body, depth) => {
    if (least.has(name) && least.get(name) <= depth) return;
    least.set(name, depth);
    const embeddedRenderer = depth === 0 && /view=[^;]*\binside\s+\S/.test(notes) && isSharedModule(file);
    if (!embeddedRenderer) for (const w of classWordsOf(body)) out.add(w);
    for (const [local, exported] of kitNames(file)) {
      // A bare call only: not preceded by an identifier character, a dot or a $.
      if (new RegExp(`(?<![\\w$.])${escapeRe(local)}\\s*\\(`).test(body)) for (const w of kitClassesOf.get(exported)) out.add(w);
    }
    if (depth >= CALL_DEPTH) return;
    for (const callee of new Set([...body.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]))) {
      const calleeBody = functionBody(src, callee);
      if (calleeBody) addBody(callee, calleeBody, depth + 1);
    }
  };
  for (const name of viewNamesOf(notes)) {
    const body = functionBody(src, name);
    if (body) addBody(name, body, 0);
  }
  return out;
};
const CSS_UNRESOLVED = 'css:unresolved';
const cssClassesOf = [];
const cssCounts = { catalog: 0, resolved: 0, unresolved: 0, sameAsId: 0 };
{
  const c = inv.components;
  const idI = need(c, 'id', 'components');
  const fileI = need(c, 'file', 'components');
  const notesI = need(c, 'notes', 'components');
  c.rows = c.rows.map((r) => {
    const nr = r.slice();
    // Notes are rewritten from their base text, so a second run changes nothing.
    const base = String(r[notesI]).replace(/(; )?css:unresolved/g, '').replace(/(; )?owner:shared-renderer/g, '');
    const isCatalog = /\[catalog\b/.test(base);
    let classes = [];
    if (isCatalog) {
      cssCounts.catalog++;
      // A view that runs inside another surface and names a function of a shared
      // module: its own function's classes are the shared renderer's (see wordsOfComponent).
      const embedsShared = /view=[^;]*\binside\s+\S/.test(base) && isSharedModule(r[fileI]) && !selectorClasses.has(r[idI]);
      if (selectorClasses.has(r[idI])) { classes = [r[idI]]; cssCounts.sameAsId++; }
      else classes = [...wordsOfComponent(r[fileI], base)].filter(w => selectorClasses.has(w)).sort();
      if (classes.length) cssCounts.resolved++;
      else cssCounts.unresolved++;
      const owner = embedsShared ? 'owner:shared-renderer' : '';
      const tail = [owner, classes.length ? '' : CSS_UNRESOLVED].filter(Boolean).join('; ');
      nr[notesI] = [base, tail].filter(Boolean).join('; ');
    } else {
      nr[notesI] = base;
    }
    cssClassesOf.push(classes.join(' '));
    return nr;
  });
}

// ----------------------------------------------- styles -> catalog component
// A style row's componentId is the catalog component that owns its selector when
// exactly one catalog component's cssClasses use a class of that selector. Other
// rows keep their CSS-derived componentId. cssComponentId keeps that CSS-derived id
// for every row.
const catalogOfClass = new Map();
inv.components.rows.forEach((r, i) => {
  if (!/\[catalog\b/.test(get(inv.components, r, 'notes'))) return;
  for (const c of cssClassesOf[i].split(' ').filter(Boolean)) {
    if (!catalogOfClass.has(c)) catalogOfClass.set(c, new Set());
    catalogOfClass.get(c).add(get(inv.components, r, 'id'));
  }
});
// The classes of each selector's last compound: the element the rule styles.
// Classes in its ancestors (".card .ctext" -> ctext) do not name its owner.
// The classes inside :not(), :is() and :where() are not the element's own, so
// they are removed (balanced parentheses) before the selector is split.
function stripFunctionalPseudo(s) {
  let out = s;
  for (let m = /:(?:not|is|where)\(/.exec(out); m; m = /:(?:not|is|where)\(/.exec(out)) {
    let i = m.index + m[0].length;
    for (let depth = 1; i < out.length && depth > 0; i++) {
      if (out[i] === '(') depth++;
      else if (out[i] === ')') depth--;
    }
    out = out.slice(0, m.index) + out.slice(i);
  }
  return out;
}
function lastCompoundClasses(selector) {
  const out = new Set();
  for (const alt of stripFunctionalPseudo(selector.replace(/\[[^\]]*\]/g, '')).split(/\s*[|,]\s*/)) {
    const parts = alt.trim().split(/\s*(?:[>+~]|\s)\s*/).filter(Boolean);
    const last = parts.length ? parts[parts.length - 1] : '';
    for (const m of last.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) out.add(m[1]);
  }
  return out;
}
// State and variant classes that many components add (spent, outline, active,
// is-*) say nothing about which component owns a rule, so they never pick an
// owner: .deck-editor-tile.spent .deck-editor-name belongs to the deck editor.
const GENERIC_STATE = new Set(['spent', 'outline', 'active', 'selected', 'disabled', 'hidden', 'on', 'off', 'open', 'closed',
  'focus', 'focused', 'hover', 'pressed', 'current', 'locked', 'dim', 'show', 'visible', 'collapsed', 'expanded', 'invalid',
  'error', 'highlighted', 'primary', 'danger', 'reduced-motion']);
const GENERIC_OWNERS = 3; // a class that more than this many components add is generic
const isGenericClass = c => GENERIC_STATE.has(c) || /^(is|has)-/.test(c) || (catalogOfClass.get(c)?.size ?? 0) >= GENERIC_OWNERS;
const styleCssIds = [];
// A selector whose parentheses or brackets do not balance is a fragment left by
// a multi-line selector in the inventory (".card :is(.ctag", ".ctext)"). Its
// last compound cannot be trusted, so its row keeps the CSS-derived componentId.
const selectorBalanced = sel => {
  const count = (ch) => [...sel].filter(c => c === ch).length;
  return count('(') === count(')') && count('[') === count(']');
};
const styleRepointed = { rows: 0, distinctTargets: 0, brokenSelectors: 0 };
{
  const s = inv.styles;
  const selI = need(s, 'selector', 'styles');
  const cidI = need(s, 'componentId', 'styles');
  const targets = new Set();
  s.rows = s.rows.map((r) => {
    styleCssIds.push(r[cidI]);
    const owners = new Set();
    if (!selectorBalanced(String(r[selI]))) styleRepointed.brokenSelectors++;
    else {
      for (const c of lastCompoundClasses(String(r[selI]))) {
        if (isGenericClass(c)) continue;
        for (const id of catalogOfClass.get(c) || []) owners.add(id);
      }
    }
    const nr = r.slice();
    if (owners.size === 1) {
      nr[cidI] = [...owners][0];
      if (nr[cidI] !== r[cidI]) { styleRepointed.rows++; targets.add(nr[cidI]); }
    }
    return nr;
  });
  styleRepointed.distinctTargets = targets.size;
}

tagIds.components = rowMap('components', r => presId(groupOfComponent(get(inv.components, r, 'group'))));
liveRefs.components = rowMap('components', r => get(inv.components, r, 'file'));

tagIds.layouts = rowMap('layouts', r => presId('layout', 'breakpoint', bandOf(get(inv.layouts, r, 'breakpoint'))));
bandCols.layouts = rowMap('layouts', r => bandOf(get(inv.layouts, r, 'breakpoint')));
liveRefs.layouts = rowMap('layouts', r => get(inv.layouts, r, 'source'));

tagIds.styles = rowMap('styles', r => presId('style', styleKind(get(inv.styles, r, 'property'))));
bandCols.styles = rowMap('styles', r => bandOf(get(inv.styles, r, 'breakpoint')));
liveRefs.styles = rowMap('styles', r => get(inv.styles, r, 'source'));

tagIds.tokens = rowMap('tokens', () => presId('style', 'token'));
liveRefs.tokens = rowMap('tokens', r => get(inv.tokens, r, 'file'));

tagIds.breakpoints = rowMap('breakpoints', r => presId('layout', 'breakpoint', bandOf(get(inv.breakpoints, r, 'condition'))));
liveRefs.breakpoints = rowMap('breakpoints', r => get(inv.breakpoints, r, 'file'));

tagIds.assets = rowMap('assets', r => presId(ASSET_GROUP[get(inv.assets, r, 'category')] || 'other'));
liveRefs.assets = rowMap('assets', r => get(inv.assets, r, 'usedBy'));

tagIds.animations = rowMap('animations', r => presId('animation', slug(get(inv.animations, r, 'id').split('.')[0])));
liveRefs.animations = rowMap('animations', r => get(inv.animations, r, 'source'));

tagIds.effects = rowMap('effects', r => presId('effect', slug(get(inv.effects, r, 'kind'))));
liveRefs.effects = rowMap('effects', r => get(inv.effects, r, 'source'));

tagIds.resolutions = rowMap('resolutions', r => presId('resolution', slug(get(inv.resolutions, r, 'tier').split(':')[0])));
liveRefs.resolutions = rowMap('resolutions', r => get(inv.resolutions, r, 'source'));

tagIds.settings = rowMap('settings', r => presId('setting', scopeOf(r), slug(get(inv.settings, r, 'group'))));
scopeCols.settings = rowMap('settings', r => scopeOf(r));
liveRefs.settings = rowMap('settings', r => get(inv.settings, r, 'file'));

tagIds.symbols = rowMap('symbols', r => presId('symbol', slug(get(inv.symbols, r, 'id').split(':')[0])));
liveRefs.symbols = rowMap('symbols', r => get(inv.symbols, r, 'file'));

const symGroupSlugs = new Set(symGroups.map(slug));
tagIds['combat-symbols'] = rowMap('combat-symbols', r => {
  const g = slug(get(inv['combat-symbols'], r, 'tagKey').split(':')[0]);
  return symGroupSlugs.has(g) ? presId('symbol', g) : presId('symbol');
});
liveRefs['combat-symbols'] = rowMap('combat-symbols', r => {
  const m = get(inv['combat-symbols'], r, 'currentAssetRef').match(/src\/[^\s;]+/);
  return m ? m[0] : '';
});
// assignedAssetRef is an assets.id, an svg:<Module>.<NAME>.<key> reference to an
// inline SVG in code, or blank. A row with a suggested icon (a placeholder) takes
// that suggestion; a has-symbol row keeps its current icon. An inline SVG is a
// symbol (svg-source.mjs resolves it against the source file). Text that is none
// of these (a bare text glyph) is blank, and the row is status "missing".
const ICON_DIRS = {
  'card-icon': ['assets/cards/default-outline/icons/', 'assets/player-polish/ui/icons/'],
  'ui-icon': ['assets/player-polish/ui/icons/', 'assets/cards/default-outline/icons/'],
};
function iconRef(text) {
  const t = String(text).trim();
  if (!t) return '';
  const svg = svgRefFromText(t);
  if (svg) {
    const problem = svgRefProblem(svg);
    if (problem) throw new Error('combat-symbols: ' + problem);
    return svg;
  }
  return mapIcon(t);
}
function mapIcon(text) {
  const t = String(text).trim();
  if (!t) return '';
  if (assetIds.has(t)) return t;
  const m = t.match(/^(card-icon|ui-icon):([A-Za-z0-9-]+)$/);
  if (m) {
    for (const dir of ICON_DIRS[m[1]]) {
      const cand = dir + m[2] + '.svg';
      if (assetIds.has(cand)) return cand;
    }
  }
  return '';
}
const combatRows = inv['combat-symbols'];
['tagKey', 'currentSymbol', 'currentAssetRef', 'suggestedAssetRef', 'status'].forEach(c => need(combatRows, c, 'combat-symbols'));
const combatStatus = [];
const assignedAssetRef = combatRows.rows.map((r) => {
  const suggested = String(get(combatRows, r, 'suggestedAssetRef')).trim();
  const current = String(get(combatRows, r, 'currentAssetRef')).trim();
  const placeholder = suggested !== '';
  const mapped = iconRef(placeholder ? suggested : current);
  combatStatus.push(mapped === '' ? 'missing' : placeholder ? 'placeholder' : 'has symbol');
  return mapped;
});

tagIds.strings = rowMap('strings', r => presId('text', textKind(r)));
liveRefs.strings = rowMap('strings', r => get(inv.strings, r, 'file'));

// ------------------------------------------------------- tags.csv (legacy rows)
const TAG_HEAD = ['id', 'key', 'label', 'parent', 'erd', 'school', 'description', 'effect', 'variables', 'duration', 'stacking', 'related', 'status', 'glyph', 'color'];
const tagsPath = join(TABLES, 'tags.csv');
const tagsTable = readTable(tagsPath);
const ci = Object.fromEntries(TAG_HEAD.map(h => [h, tagsTable.header.indexOf(h)]));
const legacyRows = tagsTable.rows.filter(r => !r[ci.id].startsWith('meta.presentation'));
const oldKeyById = Object.fromEntries(legacyRows.map(r => [r[ci.id], r[ci.key]]));
const oldIdByKey = Object.fromEntries(legacyRows.map(r => [r[ci.key], r[ci.id]]));

// Reviewer tables must point at real things before anything is written.
const nodeIds = new Set(parseCsv(readFileSync(NODES, 'utf8').split('\n').filter(l => l && !l.startsWith('#')).join('\n')).slice(1).map(r => r[0]));
const legacyIds = new Set(legacyRows.map(r => r[ci.id]));
for (const [id, live] of Object.entries(LIVE)) {
  if (!legacyIds.has(id)) throw new Error('LIVE id is not a tag: ' + id);
  if (!nodeIds.has(live)) throw new Error(`LIVE target ${live} is not in nodes.csv (for ${id})`);
}
for (const id of GAME) if (!legacyIds.has(id)) throw new Error('GAME id is not a tag: ' + id);

// Task 3: status and liveId.
const liveByStatus = {};
const statusCount = {};
const legacyOut = legacyRows.map(r => {
  const id = r[ci.id];
  const legacy = LEGACY[id];
  if (!legacy) throw new Error('no legacy status snapshot for ' + id);
  let status;
  let liveId = '';
  if (LIVE[id]) { status = 'live-tag'; liveId = LIVE[id]; }
  else if (legacy === 'moved') status = 'live-tag';
  else if (legacy === 'existing') status = 'game-concept';
  else if (GAME.has(id)) status = 'game-concept';
  else status = 'new';
  // The note is written once: strip any copies from an earlier run, then add it back.
  const rest = r[ci.description].replace(MOVED_PREFIX, '');
  const description = legacy === 'moved' ? (rest ? `${MOVED_NOTE} ${rest}` : MOVED_NOTE) : rest;
  statusCount[status] = (statusCount[status] || 0) + 1;
  if (liveId) liveByStatus[status] = (liveByStatus[status] || 0) + 1;
  const row = Object.fromEntries(TAG_HEAD.map(h => [h, r[ci[h]]]));
  return { id, row: { ...row, description, status, liveId } };
});

// A nodes.csv id claimed by two tags is an error unless SHARED_LIVE says why.
const liveClaims = {};
for (const { id, row } of legacyOut) if (row.liveId) (liveClaims[row.liveId] ||= []).push(id);
const sharedLive = Object.entries(liveClaims).filter(([, ids]) => ids.length > 1);
for (const [live, ids] of sharedLive) {
  if (!SHARED_LIVE[live]) throw new Error(`liveId ${live} is claimed by ${ids.join(', ')} with no SHARED_LIVE reason`);
}
for (const live of Object.keys(SHARED_LIVE)) {
  if (!sharedLive.some(([l]) => l === live)) throw new Error(`SHARED_LIVE entry ${live} is not shared by two tags`);
}

// Task 2: presentation nodes.
const presRows = [...nodes.entries()].map(([id, n]) => ({
  id,
  row: { id, key: '', label: n.label, parent: parentOf(id), erd: n.erd, school: '', description: n.description, effect: '', variables: '', duration: '', stacking: '', related: '', status: 'new', glyph: '', color: '', liveId: '' },
}));

// Keys: shortest unique suffix of the id's dot-segments over ALL rows.
const allIds = [...legacyOut.map(x => x.id), ...presRows.map(x => x.id)];
if (new Set(allIds).size !== allIds.length) throw new Error('duplicate tag id');
function computeKeys(ids) {
  const out = {};
  for (const id of ids) {
    const segs = id.split('.');
    for (let n = 1; n <= segs.length; n++) {
      const suffix = segs.slice(segs.length - n).join('.');
      const clash = ids.some(o => o !== id && (o === suffix || o.endsWith('.' + suffix)));
      if (!clash) { out[id] = suffix; break; }
    }
    if (!out[id]) throw new Error('no unique key for ' + id);
  }
  return out;
}
const keyOf = computeKeys(allIds);

const changedKey = {};
let keysChanged = 0;
for (const { id } of legacyOut) {
  if (oldKeyById[id] !== keyOf[id]) {
    keysChanged++;
    changedKey[oldKeyById[id]] = keyOf[id];
  }
}
const rewriteKeys = value => String(value).split(/\s+/).filter(Boolean)
  .map(t => (changedKey[t] !== undefined && oldIdByKey[t] !== undefined ? changedKey[t] : t)).join(' ');

const tagOut = [...legacyOut, ...presRows].map(({ id, row }) => ({ ...row, key: keyOf[id], school: rewriteKeys(row.school), related: rewriteKeys(row.related) }));
writeFileSync(tagsPath, toCsv([...TAG_HEAD, 'liveId'], tagOut.map(r => [...TAG_HEAD, 'liveId'].map(h => r[h]))));

// Every table is LF with a final newline (CONTRIBUTING: CSVs are LF). Only the
// line endings of the existing tables change; their cells are untouched.
for (const f of readdirSync(TABLES).filter(f => f.endsWith('.csv'))) {
  const p = join(TABLES, f);
  const text = readFileSync(p, 'utf8');
  const lf = text.replace(/\r\n/g, '\n');
  if (lf !== text) writeFileSync(p, lf.endsWith('\n') ? lf : lf + '\n');
}

// objects.csv and relations.csv hold tag keys in these columns.
function rewriteTable(file, cols) {
  const p = join(TABLES, file);
  const t = readTable(p);
  let changed = 0;
  const rows = t.rows.map(r => r.map((v, i) => {
    if (!cols.includes(t.header[i])) return v;
    const nv = rewriteKeys(v);
    if (nv !== v) changed++;
    return nv;
  }));
  if (changed) writeFileSync(p, toCsv(t.header, rows));
  return changed;
}
const refRewrites = {
  objects: rewriteTable('objects.csv', ['tags', 'skill', 'exp', 'cardType', 'stance', 'rarity', 'costResource']),
  relations: rewriteTable('relations.csv', ['source', 'target']),
};

// Task 1: presentation copies. tag holds a key, so this runs after keys exist.
const tagKeyOf = id => {
  if (!keyOf[id]) throw new Error('presentation id has no key: ' + id);
  return keyOf[id];
};
const presRowCounts = {};
for (const name of INVENTORY) {
  const t = inv[name];
  const extra = DERIVED[name];
  const header = [...t.header, ...extra];
  const rows = t.rows.map((base, i) => {
    const b = base.slice();
    const vals = {
      tag: tagIds[name] ? tagKeyOf(tagIds[name][i]) : undefined,
      liveRef: liveRefs[name] ? liveRefs[name][i] : undefined,
      band: bandCols[name] ? bandCols[name][i] : undefined,
      scope: scopeCols[name] ? scopeCols[name][i] : undefined,
      assignedAssetRef: name === 'combat-symbols' ? assignedAssetRef[i] : undefined,
      cssClasses: name === 'components' ? cssClassesOf[i] : undefined,
      cssComponentId: name === 'styles' ? styleCssIds[i] : undefined,
    };
    if (name === 'combat-symbols') b[t.header.indexOf('status')] = combatStatus[i];
    return [...b, ...extra.map(c => vals[c])];
  });
  presRowCounts[name] = rows.length;
  writeFileSync(join(PRES, name + '.csv'), toCsv(header, rows));
}

const combatCounts = combatStatus.reduce((a, s) => ({ ...a, [s]: (a[s] || 0) + 1 }), {});
console.log(JSON.stringify({
  tagRows: tagOut.length,
  legacyRows: legacyOut.length,
  presentationNodes: presRows.length,
  keysChanged,
  refRewrites,
  statusCount,
  liveIdByStatus: liveByStatus,
  liveIdTotal: Object.values(liveByStatus).reduce((a, b) => a + b, 0),
  sharedLiveIds: sharedLive.map(([live, ids]) => `${live} <- ${ids.join(', ')}`),
  cleaning,
  cssClasses: cssCounts,
  stylesRepointed: styleRepointed,
  presentationRows: presRowCounts,
  combatSymbolStatus: combatCounts,
}, null, 1));
