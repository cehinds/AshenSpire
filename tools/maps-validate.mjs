#!/usr/bin/env node
// tools/maps-validate.mjs - validates the JSON map layer.
//
//   node tools/maps-validate.mjs           print the report
//   node tools/maps-validate.mjs --check   exit 1 on any problem
//
// Reads engine/maps/components/*.json and games/<game>/maps/*.json, holds them to
// engine/contracts/map-component.schema.json and map.schema.json, checks every
// cross-reference (map nodes, weights, atlas paths) and holds every number copied
// from the current generator to the JavaScript it came from, so the day
// src/content/mapconfig.js or src/engine/mapgen.js moves, this fails.
// Asset ids are checked against the asset catalog in tests/maps-json.test.mjs.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { validateGameSchema } from '../engine/kernel/gameConfig.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = 'ashenspire';
const read = file => JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
const lines = file => readFileSync(join(ROOT, file), 'utf8').split('\n');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function loadMapFiles(root = ROOT, game = GAME) {
  const dir = (rel, suffix = '.json') => existsSync(join(root, rel)) ? readdirSync(join(root, rel)).filter(f => f.endsWith(suffix)).sort() : [];
  const components = {}, maps = {};
  for (const f of dir('engine/maps/components')) components[f] = JSON.parse(readFileSync(join(root, 'engine/maps/components', f), 'utf8'));
  for (const f of dir(`games/${game}/maps`)) maps[f] = JSON.parse(readFileSync(join(root, `games/${game}/maps`, f), 'utf8'));
  return { components, maps };
}

/** Every string in a JSON value. */
export function strings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach(v => strings(v, out));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => { out.push(k); strings(v, out); });
  return out;
}

/** Every asset id a map file or component names. */
export function assetIds({ components, maps }) {
  const ids = new Set();
  for (const c of Object.values(components)) { if (c.icon) ids.add(c.icon); (c.assets || []).forEach(a => ids.add(a)); }
  for (const m of Object.values(maps)) { if (m.environment) ids.add(m.environment); (m.assets || []).forEach(a => ids.add(a)); }
  return [...ids].sort();
}

// "table[key=value]" or "table[key=value].field" against a JSON document.
export function resolveAtlasPath(doc, path) {
  let node = doc;
  for (const part of path.split('.')) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)(?:\[([A-Za-z_][A-Za-z0-9_]*)=([^\]]+)\])?$/.exec(part);
    if (!m) return undefined;
    node = node?.[m[1]];
    if (m[2]) node = Array.isArray(node) ? node.find(row => String(row[m[2]]) === m[3]) : undefined;
    if (node === undefined) return undefined;
  }
  return node;
}

// A cited "file:line" must still contain the token the rule is named after.
const TOKENS = {
  columns: 'columns', entries: 'entries', fixedFloor: 'at:', noShrineBefore: 'noShrineBefore', noEliteBefore: 'noEliteBefore',
  noShrineOn: 'noShrineOn', restBeforeElite: 'restBeforeElite', minElites: 'minElites', minMerchants: 'minMerchants',
  topFloorShrine: 'addNode(floors', noSameTypeAdjacent: 'banned', unknownWeights: 'unknownWeights', typingRetries: 'TYPING_RETRIES',
};

export async function validateMaps({ root = ROOT, game = GAME } = {}) {
  const problems = [];
  const bad = msg => problems.push(msg);
  const files = loadMapFiles(root, game);
  const componentSchema = read('engine/contracts/map-component.schema.json');
  const mapSchema = read('engine/contracts/map.schema.json');
  const ids = new Set();

  for (const [file, c] of Object.entries(files.components)) {
    try { validateGameSchema(c, componentSchema); } catch (e) { bad(`components/${file}: ${e.message}`); }
    if (`${c.id}.json` !== file) bad(`components/${file}: id '${c.id}' does not match the file name`);
    ids.add(c.id);
  }
  const nodeIds = new Set(Object.values(files.components).filter(c => c.kind === 'node').map(c => c.id));
  for (const [file, m] of Object.entries(files.maps)) {
    try { validateGameSchema(m, mapSchema); } catch (e) { bad(`maps/${file}: ${e.message}`); }
    if (`${m.id}.json` !== file) bad(`maps/${file}: id '${m.id}' does not match the file name`);
    for (const n of m.nodes || []) if (!ids.has(n)) bad(`maps/${file}: node '${n}' has no component`);
    const weightSets = { weights: m.generator?.weights, 'proposed.weights': m.generator?.proposed?.weights };
    for (const [label, w] of Object.entries(weightSets)) {
      for (const k of Object.keys(w || {})) {
        if (!nodeIds.has(k)) bad(`maps/${file}: ${label} names '${k}', which is not a node component`);
        else if (!(m.nodes || []).includes(k)) bad(`maps/${file}: ${label} names '${k}', which the map does not list in nodes`);
      }
    }
    for (const [from, to] of Object.entries(m.generator?.proposed?.names || {})) if (!nodeIds.has(to)) bad(`maps/${file}: proposed.names ${from} -> '${to}' is not a node component`);
    if (m.atlas) {
      const atlasFile = join(root, m.atlas.ref);
      if (!existsSync(atlasFile)) bad(`maps/${file}: atlas ref '${m.atlas.ref}' does not exist`);
      else if (m.atlas.path && resolveAtlasPath(JSON.parse(readFileSync(atlasFile, 'utf8')), m.atlas.path) === undefined) bad(`maps/${file}: atlas path '${m.atlas.path}' does not resolve in ${m.atlas.ref}`);
    }
  }
  for (const c of Object.values(files.components)) {
    const ref = c.placement?.atlas;
    if (ref && !existsSync(join(root, ref))) bad(`components/${c.id}.json: atlas '${ref}' does not exist`);
  }

  // No glyphs: ASCII only, everywhere.
  for (const [group, set] of Object.entries(files)) for (const [file, v] of Object.entries(set)) {
    const hit = strings(v).find(s => /[^\x00-\x7f]/.test(s));
    if (hit !== undefined) bad(`${group}/${file}: non-ASCII text '${hit}' (no glyphs in JSON)`);
  }

  // Drift: the numbers copied from the current generator.
  const cfgFile = pathToFileURL(join(root, 'src/content/mapconfig.js')).href;
  const { mapConfigs } = await import(cfgFile);
  const mapgenText = readFileSync(join(root, 'src/engine/mapgen.js'), 'utf8');
  const retries = Number(/const TYPING_RETRIES = (\d+);/.exec(mapgenText)?.[1]);
  const streams = new Set([...mapgenText.matchAll(/rng\.(?:int|float|pick|shuffle)\('(\w+)'/g)].map(m => m[1]));
  for (const [file, m] of Object.entries(files.maps)) {
    const cfg = mapConfigs[m.act], g = m.generator;
    if (!cfg) { bad(`maps/${file}: act ${m.act} has no entry in mapConfigs`); continue; }
    const fr = cfg.floorRules || {};
    const expect = (label, got, want) => { if (!same(got, want)) bad(`maps/${file}: ${label} is ${JSON.stringify(got)}, mapconfig/mapgen say ${JSON.stringify(want)}`); };
    const rule = name => (g.constraints || []).find(c => c.rule === name);
    const ruleAll = name => (g.constraints || []).filter(c => c.rule === name);
    expect('generator.steps', g.steps, cfg.floors);
    expect('generator.paths', g.paths, cfg.pathCount);
    expect('generator.weights', g.weights, cfg.typeWeights);
    expect('constraint columns', rule('columns')?.value, cfg.columns);
    expect('constraint entries', rule('entries')?.value, cfg.entries);
    for (const fixed of fr.fixed || []) {
      const row = ruleAll('fixedFloor').find(c => c.node === fixed.type);
      const { type, ...anchor } = fixed;
      expect(`fixedFloor ${type}`, row?.anchor, anchor);
    }
    expect('fixedFloor count', ruleAll('fixedFloor').length, (fr.fixed || []).length);
    for (const name of ['noShrineBefore', 'noEliteBefore', 'noShrineOn']) expect(`constraint ${name}`, rule(name)?.anchor, fr[name]);
    for (const name of ['restBeforeElite', 'minElites', 'minMerchants']) expect(`constraint ${name}`, rule(name)?.value, fr[name]);
    expect('constraint unknownWeights', rule('unknownWeights')?.weights, cfg.unknownWeights);
    expect('constraint typingRetries', rule('typingRetries')?.value, retries);
    if (!streams.has(g.seedStream)) bad(`maps/${file}: seedStream '${g.seedStream}' is not a stream mapgen.js draws from (${[...streams].join(', ')})`);
    if (cfg.floors < 2) bad(`maps/${file}: mapconfig floors ${cfg.floors} is too short`);
    for (const c of g.constraints || []) {
      const src = /^(.+):(\d+)$/.exec(c.source || '');
      if (!src) { bad(`maps/${file}: constraint ${c.rule} has no file:line source`); continue; }
      const text = existsSync(join(root, src[1])) ? lines(src[1])[Number(src[2]) - 1] : undefined;
      if (text === undefined) bad(`maps/${file}: constraint ${c.rule} cites ${c.source}, which does not exist`);
      else if (TOKENS[c.rule] && !text.includes(TOKENS[c.rule])) bad(`maps/${file}: constraint ${c.rule} cites ${c.source}, but that line no longer holds '${TOKENS[c.rule]}'`);
    }
  }
  // Component placement numbers.
  const cfg1 = mapConfigs[1], fr1 = cfg1.floorRules;
  const place = id => files.components[`${id}.json`]?.placement || {};
  const fixedOf = type => { const { type: _t, ...a } = fr1.fixed.find(f => f.type === type) || {}; return a; };
  const cmp = (label, got, want) => { if (!same(got, want)) bad(`components: ${label} is ${JSON.stringify(got)}, mapconfig says ${JSON.stringify(want)}`); };
  cmp('monster placement.fixedFloor', place('monster').fixedFloor, fixedOf('monster'));
  cmp('treasure placement.fixedFloor', place('treasure').fixedFloor, fixedOf('treasure'));
  cmp('elite placement.eliteFrom', place('elite').eliteFrom, fr1.noEliteBefore);
  cmp('elite placement.minPerAct', place('elite').minPerAct, fr1.minElites);
  cmp('elite placement.restBeforeElite', place('elite').restBeforeElite, fr1.restBeforeElite);
  cmp('shrine placement.shrineFrom', place('shrine').shrineFrom, fr1.noShrineBefore);
  cmp('shrine placement.noShrineOn', place('shrine').noShrineOn, fr1.noShrineOn);
  cmp('merchant placement.minPerAct', place('merchant').minPerAct, fr1.minMerchants);
  cmp('event placement.unknownWeights', place('event').unknownWeights, cfg1.unknownWeights);
  cmp('route placement.entries', place('route').entries, cfg1.entries);

  return { problems, counts: { components: Object.keys(files.components).length, maps: Object.keys(files.maps).length } };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { problems, counts } = await validateMaps();
  console.log(`maps: ${counts.components} components, ${counts.maps} maps, ${problems.length} problems`);
  for (const p of problems) console.log(`  ${p}`);
  if (process.argv.includes('--check') && problems.length) process.exit(1);
}
