#!/usr/bin/env node
// tools/build-game.mjs - compiles every authored JSON layer into one serialized, deterministic artifact
// (engine/contracts/build-artifact.schema.json) that web, mobile/desktop apps and Unity load.
//
//   node tools/build-game.mjs            write dist/build/<game>.build.json and games/<game>/build.summary.json
//   node tools/build-game.mjs --check    build, then fail when games/<game>/build.summary.json is not current
//   node tools/build-game.mjs --game=<id>
//
// The full artifact is build output (dist/build/, git-ignored); the summary is committed.
// Contract: docs/ai/json-game-modules/MECHANICS-ARCHITECTURE.md (Build artifact). Consumers: engine/export/README.md.
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { canonicalGameJSON, resolveGameAuthor, validateGameSchema } from '../engine/kernel/gameConfig.js';
import { loadGameProfileCatalog } from './game-config.mjs';
import { loadMechanics, loadOps } from '../engine/runtime/interpreter.mjs';
import { buildAssetCatalog } from './asset-catalog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FORMAT = 'ashen.build@1';
export const SUMMARY_FORMAT = 'ashen.build.summary@1';
const readJson = file => JSON.parse(readFileSync(path.join(ROOT, file), 'utf8'));
const readText = file => readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
const jsonFiles = dir => (existsSync(path.join(ROOT, dir)) ? readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith('.json')).sort() : []);
const sha = text => `sha256:${createHash('sha256').update(text).digest('hex')}`;
const sortKeys = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));

export const summaryFile = game => `games/${game}/build.summary.json`;
export const artifactFile = game => `dist/build/${game}.build.json`;

function loadDir(dir, fileToId = f => f.replace(/\.json$/, '')) {
  const out = {};
  for (const f of jsonFiles(dir)) out[fileToId(f)] = readJson(`${dir}/${f}`);
  return out;
}

// Longest known slug prefix of "slug.name" (slugs may contain dots).
function splitName(full, slugs) {
  for (let i = full.lastIndexOf('.'); i > 0; i = full.lastIndexOf('.', i - 1)) {
    if (slugs.has(full.slice(0, i))) return { slug: full.slice(0, i), name: full.slice(i + 1) };
  }
  return null;
}

function* walkSteps(steps) {
  for (const step of steps || []) {
    yield step;
    yield* walkSteps(step.then);
    yield* walkSteps(step.else);
    yield* walkSteps(step.do);
  }
}

function tagsOf(content) {
  const carried = new Map();
  const add = (tag, where) => { if (typeof tag === 'string') (carried.get(tag) || carried.set(tag, new Set()).get(tag)).add(where); };
  for (const kind of ['cards', 'characters', 'gear', 'enemyCards', 'enemies', 'enemyRelics']) {
    for (const item of content[kind] || []) for (const tag of item.tags || []) add(tag, kind);
  }
  return carried;
}

// `patch` (tests only) edits the loaded layers before validation, so reference checks can be exercised.
export function buildGame({ game = 'ashenspire', patch = null } = {}) {
  const errors = [];
  const fail = msg => errors.push(msg);

  // ----- profile and content -----
  const author = readJson(`games/${game}/game.json`);
  const resolved = resolveGameAuthor(author, loadGameProfileCatalog());
  // The resolved profile's hash/lock/provenance pin the JavaScript sources under src/ and the engine files;
  // they move on every code change, so they stay out of the artifact. Content and modules are the data.
  const profile = { id: resolved.id, formatVersion: resolved.formatVersion, author: resolved.author, modules: resolved.modules, instances: resolved.instances, portability: resolved.portability };
  const content = resolved.content;
  const version = String(author.core || '').split('@')[1] || '0.0.0';

  // ----- mechanics -----
  const index = readJson('engine/mechanics/index.json');
  const loaded = loadMechanics();
  const mechanics = {}, tags = {};
  for (const [slug, m] of [...loaded].sort(([a], [b]) => (a < b ? -1 : 1))) {
    mechanics[slug] = { manifest: m.manifest, model: m.model, interface: m.interface, service: m.service, cases: m.cases };
    if (m.manifest.tag) {
      if (tags[m.manifest.tag] && tags[m.manifest.tag] !== slug) fail(`tag ${m.manifest.tag} is bound by both ${tags[m.manifest.tag]} and ${slug}`);
      tags[m.manifest.tag] = slug;
    }
  }
  const slugs = new Set(Object.keys(mechanics));
  for (const row of index.mechanics) {
    if (!slugs.has(row.id)) fail(`engine/mechanics/index.json lists ${row.id}, which has no mechanic folder`);
    else if (mechanics[row.id].manifest.tag !== row.tag) fail(`index.json tag ${row.tag} differs from ${row.id}/mechanic.json tag ${mechanics[row.id].manifest.tag}`);
  }
  for (const slug of slugs) if (!index.mechanics.some(r => r.id === slug)) fail(`mechanic ${slug} is missing from engine/mechanics/index.json`);

  // requires / call / emit targets exist
  const commandsOf = slug => Object.keys(mechanics[slug].interface.commands || {});
  const eventsOf = slug => Object.keys(mechanics[slug].interface.events || {});
  for (const [slug, m] of Object.entries(mechanics)) {
    for (const req of m.interface.requires || []) if (!slugs.has(req)) fail(`${slug}: requires unknown mechanic '${req}'`);
    for (const handler of m.service.handlers || []) {
      for (const step of walkSteps(handler.do)) {
        const check = (kind, full) => {
          if (typeof full !== 'string') return;
          if (kind === 'emit' && full.startsWith('runtime.')) return;
          const hit = splitName(full, slugs);
          if (!hit) return fail(`${slug}: ${kind} target '${full}' names no mechanic`);
          const known = kind === 'call' ? commandsOf(hit.slug) : eventsOf(hit.slug);
          if (!known.includes(hit.name)) fail(`${slug}: ${kind} target '${full}' is not a ${kind === 'call' ? 'command' : 'event'} of ${hit.slug}`);
        };
        if ('call' in step) check('call', step.call);
        if ('emit' in step) check('emit', step.emit);
      }
    }
  }

  // ----- runtime -----
  const ops = loadOps();
  const formulas = readJson('engine/runtime/formulas.json');
  const runtime = { ops, formulas, specVersion: sha(readText('engine/runtime/SPEC.md')) };

  // ----- ui -----
  const uiComponents = loadDir('engine/ui/components');
  const uiScreens = loadDir(`games/${game}/ui/screens`);
  patch?.({ uiComponents, uiScreens });
  const layout = {};
  const addLayout = (ref, where) => {
    if (!ref) return;
    if (!existsSync(path.join(ROOT, ref))) return fail(`${where}: layout ref '${ref}' does not exist`);
    layout[ref] ||= readJson(ref);
  };
  for (const [id, c] of Object.entries(uiComponents)) {
    addLayout(c.layout?.ref, `component ${id}`);
    for (const child of c.children || []) if (!uiComponents[child.component]) fail(`component ${id}: child '${child.component}' does not exist`);
  }
  for (const [id, s] of Object.entries(uiScreens)) {
    addLayout(s.layout?.ref, `screen ${id}`);
    addLayout(s.scene?.ref, `screen ${id}`);
    for (const r of s.regions || []) if (!uiComponents[r.component]) fail(`screen ${id}: region '${r.slot}' uses unknown component '${r.component}'`);
  }
  const ui = { components: uiComponents, screens: uiScreens, layout: sortKeys(layout) };

  // ----- maps -----
  const mapComponents = loadDir('engine/maps/components');
  const mapDocs = loadDir(`games/${game}/maps`);
  const maps = { components: mapComponents, maps: mapDocs };
  for (const [id, m] of Object.entries(mapDocs)) for (const n of m.nodes || []) if (!mapComponents[n]) fail(`map ${id}: node '${n}' has no map component`);

  // ----- assets -----
  const assets = { catalog: buildAssetCatalog() };
  const known = new Set(Object.keys(assets.catalog.assets));
  const referenced = (where, ids) => { for (const id of ids) if (id && !known.has(id)) fail(`${where}: asset '${id}' is not in the asset catalog or missing.json`); };
  // UI components and screens name logical asset slots (card.frame, scene.rest, icon.gold) that no catalog id
  // or missing.json entry backs yet. They are reported, not failed, until the art is mapped (see report.unresolvedAssets).
  const unresolvedAssets = [];
  const slot = (from, ids) => { for (const id of ids) if (id && !known.has(id)) unresolvedAssets.push({ from, id }); };
  for (const [id, c] of Object.entries(uiComponents)) slot(`ui.components.${id}`, c.assets || []);
  for (const [id, s] of Object.entries(uiScreens)) slot(`ui.screens.${id}`, s.assets || []);
  for (const [id, c] of Object.entries(mapComponents)) referenced(`map component ${id}`, [c.icon, ...(c.assets || [])]);
  for (const [id, m] of Object.entries(mapDocs)) referenced(`map ${id}`, [m.environment, ...(m.assets || [])]);
  const missingIcons = Object.keys(mechanics).filter(s => { const i = mechanics[s].manifest.presentation?.icon; return i && !known.has(i); })
    .map(s => ({ mechanic: s, icon: mechanics[s].manifest.presentation.icon }));

  // ----- tag binding -----
  const families = new Set(index.mechanics.map(r => r.family));
  const unboundTags = [...tagsOf(content)].filter(([tag]) => families.has(tag.split(/[:.]/)[0]) && !tags[tag])
    .map(([tag, where]) => ({ tag, carriedBy: [...where].sort() })).sort((a, b) => (a.tag < b.tag ? -1 : 1));

  if (errors.length) throw new Error(`build-game: ${errors.length} problem(s)\n  ${errors.join('\n  ')}`);

  const count = p => Object.values(mechanics).filter(m => m.manifest.portability === p).length;
  const total = Object.keys(mechanics).length;
  const report = {
    mechanics: total, portable: count('portable'), legacy: count('legacy'), data: count('data'),
    portableShare: total ? Math.round((count('portable') / total) * 10000) / 10000 : 0,
    components: Object.keys(uiComponents).length, screens: Object.keys(uiScreens).length, maps: Object.keys(mapDocs).length,
    assets: known.size, unboundTags, missingIcons, unresolvedAssets,
  };

  const artifact = { format: FORMAT, game, version, profile, tags: sortKeys(tags), runtime, mechanics, content, ui, maps, assets, report };
  artifact.hash = sha(canonicalGameJSON(artifact));
  validateGameSchema(JSON.parse(canonicalGameJSON(artifact)), readJson('engine/contracts/build-artifact.schema.json'));
  const text = canonicalGameJSON(artifact) + '\n';
  return { artifact, text, summary: summarize(artifact, Buffer.byteLength(text)) };
}

/** Recompute the hash of a parsed artifact (everything except `hash`). */
export function hashOf(artifact) {
  const { hash: _hash, ...rest } = artifact;
  return sha(canonicalGameJSON(rest));
}

export function summarize(artifact, bytes) {
  const r = artifact.report;
  return {
    _: 'DERIVED by node tools/build-game.mjs, never by hand. The full artifact is build output (dist/build/); this file pins it by hash.',
    format: SUMMARY_FORMAT,
    artifactFormat: artifact.format,
    game: artifact.game,
    version: artifact.version,
    hash: artifact.hash,
    bytes,
    report: {
      mechanics: r.mechanics, portable: r.portable, legacy: r.legacy, data: r.data, portableShare: r.portableShare,
      components: r.components, screens: r.screens, maps: r.maps, assets: r.assets,
      unboundTags: r.unboundTags.length, missingIcons: r.missingIcons.length, unresolvedAssets: r.unresolvedAssets.length,
    },
  };
}
export const summaryText = summary => JSON.stringify(summary, null, 2) + '\n';

function main(argv) {
  const gameArg = argv.find(a => a.startsWith('--game='));
  const game = gameArg ? gameArg.slice(7) : 'ashenspire';
  const check = argv.includes('--check');
  const { text, summary } = buildGame({ game });
  const out = path.join(ROOT, artifactFile(game));
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, text);
  const file = path.join(ROOT, summaryFile(game));
  if (check) {
    if (!existsSync(file) || readFileSync(file, 'utf8').replace(/\r\n/g, '\n') !== summaryText(summary)) {
      console.error(`error: ${summaryFile(game)} is stale; run node tools/build-game.mjs and commit it`);
      process.exit(1);
    }
  } else writeFileSync(file, summaryText(summary));
  const r = summary.report;
  console.log(`${check ? 'build ok (summary current)' : 'built'}: ${artifactFile(game)} ${summary.bytes} bytes ${summary.hash}`);
  console.log(`  ${r.mechanics} mechanics (${r.portable} portable, ${r.legacy} legacy, ${r.data} data), ${r.components} components, ${r.screens} screens, ${r.maps} maps, ${r.assets} assets, ${r.unboundTags} unbound tags, ${r.missingIcons} mechanic icons missing, ${r.unresolvedAssets} unresolved ui asset slots`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(1); }
}
