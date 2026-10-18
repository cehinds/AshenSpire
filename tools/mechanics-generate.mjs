#!/usr/bin/env node
// tools/mechanics-generate.mjs — one mechanic folder per behaviour tag and per status.
//
// Contract: docs/ai/json-game-modules/MECHANICS-ARCHITECTURE.md. Reads the tag tree
// (content/source/nodes.csv), the node variables and bindings, and the status
// definitions (authored rows in content/source/statuses.json, expansion rows derived in
// src/content/combatStatusRules.js, joined by the src/content/statuses.js shim), and writes
// engine/mechanics/<slug>/. A status's legacy.file is always its JavaScript home (the shim, or
// the reader that runs it); legacy.source names the authored data file or the derived rules
// module that defines the row.
//
//   node tools/mechanics-generate.mjs          write what is missing or stale
//   node tools/mechanics-generate.mjs --check  exit 1 if anything would change
//
// Rules: a folder whose mechanic.json says "authored": true is never touched;
// service.json and cases.json are never overwritten once present; everything
// else is regenerated from the sources, so a re-run changes nothing.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'engine/mechanics');
const FAMILIES = new Set('fx damage lifecycle trait maneuver camp targeting school cost scaling delivery counter range utility technique classification equipment theme source from item internal'.split(' '));
const BARE_FALLBACK_SKIP = new Set(['fx', 'classification', 'from']);
const CLASSIFICATION_ATTACH = {
  class: 'character', relic: 'relic', flask: 'run', keepsake: 'run', event: 'run', encounter: 'run', enemy: 'entity', armament: 'gear',
  armour: 'gear', basicCardProfile: 'card', slot: 'gear', startingKit: 'gear', unlock: 'run', companion: 'entity', sigil: 'gear', feat: 'character', enemyMove: 'entity',
};
const ATTACH_TO_MODEL = { card: 'card', status: 'entity', character: 'entity', entity: 'entity', gear: 'entity', relic: 'run', run: 'run', combat: 'combat', map: 'run', none: 'none' };

const read = path => readFileSync(join(ROOT, path), 'utf8');
const json = value => JSON.stringify(value, null, 2) + '\n';
const ascii = text => String(text ?? '')
  .replace(/[‒-―−]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/×/g, 'x').replace(/…/g, '...')
  .replace(/[^\x20-\x7E]+/g, ' ').replace(/\s+/g, ' ').trim();

function parseCsv(path) {
  const text = read(path).split('\n').filter(line => !line.startsWith('#')).join('\n');
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c; }
    else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(x => x !== '')) rows.push(row); row = []; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some(x => x !== '')) rows.push(row); }
  const [header, ...body] = rows;
  return body.map(r => Object.fromEntries(header.map((name, i) => [name, r[i] ?? ''])));
}

function listJs(dir) {
  const out = [];
  for (const name of readdirSync(join(ROOT, dir)).sort()) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...listJs(rel));
    else if (name.endsWith('.js')) out.push(rel);
  }
  return out;
}

const sources = ['src/engine', 'src/model'].flatMap(listJs).map(file => ({ file, lines: read(file).split('\n') }));
const isComment = line => /^\s*(\/\/|\*|\/\*)/.test(line);
function findReader(patterns) {
  for (const { file, lines } of sources) {
    for (let i = 0; i < lines.length; i++) {
      if (isComment(lines[i]) || !patterns.some(p => p.test(lines[i]))) continue;
      let symbol;
      for (let j = i; j >= 0 && !symbol; j--) {
        const m = lines[j].match(/^(?:export\s+)?(?:async\s+)?function\s+\*?\s*(\w+)/) || lines[j].match(/^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>/);
        if (m) symbol = m[1];
      }
      return { file, ...(symbol ? { symbol } : {}) };
    }
  }
  return null;
}
const esc = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const quotedPatterns = name => [new RegExp(`['"\`]${esc(name)}['"\`]`)];

const upFirst = text => text.replace(/^./, c => c.toUpperCase());
const titleCase = text => text.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').replace(/^./, c => c.toUpperCase());
const slugOf = tag => tag.replace(/:/g, '_');

// ---- sources -----------------------------------------------------------------
const nodes = parseCsv('content/source/nodes.csv');
const variables = parseCsv('content/source/nodeVariables.csv');
const bindings = parseCsv('content/source/variableBindings.csv').filter(row => row.scope === 'default');
const { statuses } = await import(pathToFileURL(join(ROOT, 'src/content/statuses.js')));
const authoredStatusIds = new Set(JSON.parse(read('content/source/statuses.json')).map(row => row.id));
const { balance } = await import(pathToFileURL(join(ROOT, 'src/content/balance.js')));
const balanceAt = path => path.split('.').reduce((v, k) => (v == null ? v : v[k]), balance);

const moduleTexts = readdirSync(join(ROOT, 'engine/modules')).sort().filter(id => existsSync(join(ROOT, 'engine/modules', id, 'module.json'))).map(id => ({
  id, text: ['guide.md', 'defaults.json', 'module.json'].map(f => existsSync(join(ROOT, 'engine/modules', id, f)) ? read(`engine/modules/${id}/${f}`) : '').join('\n'),
}));
function modulesFor(tag, statusId) {
  const loose = new RegExp(`(?<![A-Za-z0-9_:.-])${esc(tag)}(?![A-Za-z0-9_:-]|\\.[A-Za-z0-9])`);
  const quoted = statusId ? new RegExp(`["'\`]${esc(statusId)}["'\`]`) : null;
  const ids = moduleTexts.filter(m => loose.test(m.text) || (quoted && quoted.test(m.text))).map(m => m.id);
  if (statusId) ids.push('statuses');
  if (tag === 'mechanic.stagger') ids.push('stagger');
  return [...new Set(ids)].sort();
}

// ---- planned mechanics -------------------------------------------------------
const planned = [];
for (const node of nodes) {
  const m = node.id.match(/^([A-Za-z]+)[:.]/);
  if (!m || !FAMILIES.has(m[1])) continue;
  planned.push({ tag: node.id, family: m[1], node });
}
for (const status of statuses) planned.push({ tag: `status.${status.id}`, family: 'status', status });

function describe(entry) {
  const { tag, family, node, status } = entry;
  const label = upFirst(ascii(status ? status.name : node.label || titleCase(tag.split(/[:.]/).pop())));
  const description = upFirst(ascii(status ? status.tooltip : node.blurb)) || `Tag ${tag} in the ${family} family.`;
  let attaches = ['card'];
  if (status) attaches = ['status'];
  else if (family === 'equipment' || family === 'item') attaches = ['gear'];
  else if (family === 'classification') attaches = [CLASSIFICATION_ATTACH[tag.split('.').pop()] || 'card'];
  const color = node && /^[0-9A-Fa-f]{6}$/.test(node.color) ? node.color : null;

  let portability, legacy;
  if (status) {
    portability = 'legacy';
    const reader = findReader([...quotedPatterns(status.id), new RegExp(`\\bstatuses\\??\\.${esc(status.id)}\\b`)]);
    legacy = reader || { file: 'src/content/statuses.js', source: authoredStatusIds.has(status.id) ? 'content/source/statuses.json' : 'src/content/combatStatusRules.js' };
  } else if (family === 'classification' || family === 'fx' || /visual identity|presentation only/i.test(node.blurb)) {
    portability = 'data';
  } else {
    const bare = tag.split(/[:.]/).pop();
    const reader = findReader(quotedPatterns(tag)) || (BARE_FALLBACK_SKIP.has(family) ? null : findReader(quotedPatterns(bare)));
    if (reader) { portability = 'legacy'; legacy = reader; } else portability = 'data';
  }

  const rows = variables.filter(row => row.nodeId === tag);
  const properties = {};
  if (status) properties.stacks = { type: 'integer', minimum: 0, default: 0, description: 'Current stacks (a meter status reports its build-up points).' };
  for (const row of rows) {
    const prop = { type: 'number', 'x-role': row.role };
    const bound = bindings.find(b => b.nodeId === tag && b.variable === row.variable);
    if (bound) { prop['x-balance'] = bound.balancePath; const value = balanceAt(bound.balancePath); if (typeof value === 'number') prop.default = value; }
    properties[row.variable] = prop;
  }
  const model = { type: 'object', properties, required: [], additionalProperties: false, 'x-attach': ATTACH_TO_MODEL[attaches[0]] };

  const manifest = {
    id: slugOf(tag), tag, version: '1.0.0', family, label, description, attaches,
    files: { model: 'model.schema.json', interface: 'interface.json', service: 'service.json', cases: 'cases.json', guide: 'guide.md' },
    presentation: { icon: slugOf(tag), ...(color ? { color: color.toUpperCase() } : {}) },
    portability, ...(legacy ? { legacy } : {}),
  };
  const carried = status ? 'statuses on any entity' : attaches.join(', ') + 's';
  const where = legacy ? `\`${legacy.file}\`${legacy.symbol ? ` (\`${legacy.symbol}\`)` : ''}` : 'data only; no JavaScript reads it';
  const guide = [
    `# ${label} (\`${tag}\`)`,
    description,
    `- Carried by: ${carried}.`,
    `- Lives in: ${where}.`,
    ...(legacy?.source ? [`- Defined in: \`${legacy.source}\`.`] : []),
    `- Portability: ${portability}${portability === 'legacy' ? ' (service.json is empty until the behaviour moves to catalog ops)' : portability === 'data' ? ' (classification or presentation only)' : ''}.`,
  ].join('\n') + '\n';
  const iface = { mechanic: manifest.id, commands: {}, events: {}, queries: {}, listens: [], requires: [] };
  return { manifest, model, iface, guide, service: { mechanic: manifest.id, handlers: [] }, cases: [] };
}

// ---- plan the writes ---------------------------------------------------------
const writes = new Map(); // absolute path -> content
const seen = new Map();
for (const entry of planned) {
  const slug = slugOf(entry.tag);
  if (seen.has(slug)) throw new Error(`slug collision: ${entry.tag} and ${seen.get(slug)}`);
  seen.set(slug, entry.tag);
  const dir = join(OUT, slug);
  const manifestPath = join(dir, 'mechanic.json');
  if (existsSync(manifestPath) && JSON.parse(readFileSync(manifestPath, 'utf8')).authored === true) continue;
  const built = describe(entry);
  const always = { 'mechanic.json': json(built.manifest), 'model.schema.json': json(built.model), 'interface.json': json(built.iface), 'guide.md': built.guide };
  const once = { 'service.json': json(built.service), 'cases.json': json(built.cases) };
  for (const [name, content] of Object.entries(always)) writes.set(join(dir, name), content);
  for (const [name, content] of Object.entries(once)) if (!existsSync(join(dir, name))) writes.set(join(dir, name), content);
}

// ---- index: every folder, including hand-authored ones -------------------------
function manifestOf(slug) {
  const planPath = join(OUT, slug, 'mechanic.json');
  return writes.has(planPath) ? JSON.parse(writes.get(planPath)) : JSON.parse(readFileSync(planPath, 'utf8'));
}
const folders = new Set([...seen.keys()]);
if (existsSync(OUT)) for (const name of readdirSync(OUT)) if (existsSync(join(OUT, name, 'mechanic.json'))) folders.add(name);
const statusIds = new Set(statuses.map(s => s.id));
const index = {
  format: 'ashen.mechanics-index@1',
  mechanics: [...folders].sort().map(slug => {
    const m = manifestOf(slug);
    const statusId = m.tag.startsWith('status.') && statusIds.has(m.tag.slice(7)) ? m.tag.slice(7) : null;
    return { id: m.id, tag: m.tag, family: m.family, portability: m.portability, modules: modulesFor(m.tag, statusId) };
  }),
};
writes.set(join(OUT, 'index.json'), json(index));

// ---- apply ---------------------------------------------------------------------
const check = process.argv.includes('--check');
const changed = [...writes].filter(([path, content]) => !existsSync(path) || readFileSync(path, 'utf8') !== content);
if (check) {
  if (changed.length) {
    console.error(`mechanics-generate --check: ${changed.length} file(s) would change`);
    for (const [path] of changed.slice(0, 20)) console.error(`  ${relative(ROOT, path)}`);
    process.exit(1);
  }
} else {
  for (const [path, content] of changed) { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, content); }
}
const counts = {};
for (const m of index.mechanics) counts[m.portability] = (counts[m.portability] || 0) + 1;
console.log(`mechanics: ${index.mechanics.length} total; ${Object.entries(counts).sort().map(([k, v]) => `${k} ${v}`).join(', ')}; ${check ? 'up to date' : `${changed.length} file(s) written`}`);
