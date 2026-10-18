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
import { readFileSync, readdirSync, existsSync, realpathSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { canonicalGameJSON, resolveGameAuthor, validateGameSchema } from '../engine/kernel/gameConfig.js';
import { loadGameProfileCatalog } from './game-config.mjs';
import { loadMechanics, loadOps } from '../engine/runtime/interpreter.mjs';
import { buildAssetCatalog, readAliases } from './asset-catalog.mjs';
import { contentBundle } from '../src/content/index.js';
import { TARGETS } from '../src/model/schemas.js';
import { combatStatusRules } from '../src/content/combatStatusRules.js';
const engineCards = Array.isArray(contentBundle.cards) ? contentBundle.cards : Object.values(contentBundle.cards || {});
import { resolveAtlasPath, validateMaps } from './maps-validate.mjs';
import { visibilityErrors, validateUi } from './ui-validate.mjs';

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
  // The resolved profile is frozen; a test patch edits a copy.
  const content = patch ? structuredClone(resolved.content) : resolved.content;
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
  // Every layer is loaded before any check so tests can patch one document (patch hook).
  const uiComponents = loadDir('engine/ui/components');
  const uiScreens = loadDir(`games/${game}/ui/screens`);
  const mapComponents = loadDir('engine/maps/components');
  const mapDocs = loadDir(`games/${game}/maps`);
  patch?.({ content, mechanics, uiComponents, uiScreens, mapComponents, mapDocs });
  // Literal card ids an op names (addCard) must exist in the shared pool; '$var' names resolve at run time.
  // The pool is the profile's cards and enemy cards plus the engine's built-in cards (status cards such as slimed/dazed/wound).
  const knownCards = new Set([...(content.cards || []), ...(content.enemyCards || []), ...engineCards].map(c => c.id));
  // Static status literals (applyStatus / removeStatus) name a status the profile exports: the bundle's status registry
  // (the web runtime reads registries.statuses.get(id) and throws on a miss; the portable interpreter would create an inert key).
  const knownStatuses = new Set((contentBundle.statuses || []).map(s => s.id));
  // `buildup` fills a status meter: its id is a row of the status-control rules (combatStatusControl.applyStatusPressure
  // throws 'Unknown status buildup' otherwise), a different vocabulary from the status registry.
  const knownBuildups = new Set(Object.keys(combatStatusRules.statuses || {}));
  // Op parameter literals by catalog type; '$var' strings and { f } formulas are resolved at run time.
  const isVar = x => typeof x === 'string' && x.startsWith('$');
  const isFormula = x => x && typeof x === 'object' && !Array.isArray(x) && 'f' in x;
  // staticContent (cards, enemies, variants): the engine reads each literal as written, so '$name' refs are refused and
  // an entityRef is one of the closed TARGETS ('Unknown effect target' in src/engine/actions.js). Mechanic service
  // steps keep '$' refs and arbitrary entity refs.
  const paramOk = (type, x, { staticContent = false } = {}) => {
    if (isVar(x) && !staticContent) return true;
    switch (type) {
      case 'value': case 'number': return typeof x === 'number' || isFormula(x);
      case 'integer': return Number.isInteger(x) || isFormula(x);
      case 'boolean': return typeof x === 'boolean';
      case 'string': return typeof x === 'string';
      case 'cardRef': return typeof x === 'string' && (knownCards === null || knownCards.has(x));
      case 'entityRef':
        // Static content: one scalar member of TARGETS — the legacy runtime's resolveRawTargets switches on a string;
        // an array target is only something the portable mechanic interpreter understands.
        if (staticContent) return typeof x === 'string' && TARGETS.includes(x);
        return typeof x === 'string' || (Array.isArray(x) && x.every(y => typeof y === 'string'));
      case 'object': return x !== null && typeof x === 'object' && !Array.isArray(x);
      default: return true;
    }
  };
  const slugs = new Set(Object.keys(mechanics));
  for (const row of index.mechanics) {
    if (!slugs.has(row.id)) fail(`engine/mechanics/index.json lists ${row.id}, which has no mechanic folder`);
    else if (mechanics[row.id].manifest.tag !== row.tag) fail(`index.json tag ${row.tag} differs from ${row.id}/mechanic.json tag ${mechanics[row.id].manifest.tag}`);
  }
  for (const slug of slugs) if (!index.mechanics.some(r => r.id === slug)) fail(`mechanic ${slug} is missing from engine/mechanics/index.json`);

  // requires / call / emit targets exist
  const commandsOf = slug => Object.keys(mechanics[slug].interface.commands || {});
  const eventsOf = slug => Object.keys(mechanics[slug].interface.events || {});
  const catalogOps = loadOps();
  // Condition shapes (SPEC section 5): both runtimes read operands unconditionally.
  const CMP = ['<', '<=', '==', '!=', '>=', '>'];
  const isValue = x => typeof x === 'number' || (typeof x === 'string' && x.startsWith('$')) || (x && typeof x === 'object' && !Array.isArray(x) && 'f' in x);
  const conditionErrors = (c, where) => {
    if (!c || typeof c !== 'object' || Array.isArray(c)) return [`${where}: condition must be an object`];
    const keys = Object.keys(c);
    if (keys.length !== 1) return [`${where}: condition needs exactly one of all, any, not, cmp, hasTag, hasStatus`];
    const [k] = keys, v = c[k];
    if (k === 'all' || k === 'any') return Array.isArray(v) ? v.flatMap((x, i) => conditionErrors(x, `${where}.${k}[${i}]`)) : [`${where}: ${k} needs an array`];
    if (k === 'not') return conditionErrors(v, `${where}.not`);
    if (k === 'cmp') {
      if (!(Array.isArray(v) && v.length === 3 && CMP.includes(v[0]))) return [`${where}: cmp needs [op, a, b] with op one of ${CMP.join(' ')}`];
      // Ordering needs numbers (SPEC section 5): a literal side must be a number; $vars and formulas resolve at run time.
      const ordered = !['==', '!='].includes(v[0]);
      return ordered ? v.slice(1).filter(x => !isValue(x)).map(x => `${where}: cmp ${v[0]} needs numbers, got ${JSON.stringify(x)}`) : [];
    }
    if (k === 'hasTag' || k === 'hasStatus') return Array.isArray(v) && v.length === 2 && v.every(x => typeof x === 'string') ? [] : [`${where}: ${k} needs [ref, id] as strings`];
    return [`${where}: unknown condition '${k}'`];
  };
  // Operand types from the catalog's field descriptions: arrays, entity refs/ids (strings), numbers (or $var / nested formula).
  const operandOk = (desc, x) => /^array of values/.test(desc) ? Array.isArray(x) && x.every(isValue)
    : /^array/.test(desc) ? Array.isArray(x)
    : /^(entity ref|status id|metric name)/.test(desc) ? typeof x === 'string'
    : /^number/.test(desc) ? (typeof x === 'number' || (typeof x === 'string' && x.startsWith('$')))  // the evaluator reads number fields directly; no nested formulas
    : true;
  const PORTABLE_FORMULAS = new Set(['add', 'mul', 'percentMaxHp', 'missingHp', 'missingMana', 'blockOf', 'hpOf', 'energySpent', 'cardsPlayedThisTurn', 'stacks']);
  const portableFormulaErrors = (v, where) => {
    if (Array.isArray(v)) return v.flatMap(x => portableFormulaErrors(x, where));
    if (!v || typeof v !== 'object') return [];
    const own = typeof v.f === 'string' && !PORTABLE_FORMULAS.has(v.f) ? [`${where}: formula '${v.f}' is legacy-only; portable mechanics cannot use it`] : [];
    return [...own, ...Object.values(v).flatMap(x => portableFormulaErrors(x, where))];
  };
  const formulaCatalog = readJson('engine/runtime/formulas.json').ops || {};
  const formulaOps = new Set(Object.keys(formulaCatalog));
  // formulas.json marks each operand "…, required"; a recognized operator missing one fails at run time.
  const formulaRequired = Object.fromEntries(Object.entries(formulaCatalog).map(([op, d]) => [op, Object.entries(d.fields || {}).filter(([, t]) => /\brequired\b/.test(String(t))).map(([k]) => k)]));
  // Every authored { f } formula anywhere in a step or query names a catalog formula (formulas.json).
  const formulaErrors = (v, where) => {
    if (Array.isArray(v)) return v.flatMap(x => formulaErrors(x, where));
    if (!v || typeof v !== 'object') return [];
    const own = !('f' in v) ? [] : !formulaOps.has(v.f) ? [`${where}: unknown formula '${v.f}'`]
      : [...formulaRequired[v.f].filter(k => v[k] === undefined).map(k => `${where}: formula '${v.f}' needs '${k}'`),
         ...(v.f === 'metric' && typeof v.metric === 'string' && !isVar(v.metric) && !(formulaCatalog.metric.metrics || []).includes(v.metric) ? [`${where}: unknown metric '${v.metric}'`] : []),
         ...['min', 'max'].filter(k => v[k] !== undefined && !(Number.isFinite(v[k]) || isVar(v[k]))).map(k => `${where}: formula '${v.f}' ${k} must be a number or variable, not a nested formula`),
         ...(v.f === 'stacks' && typeof v.per === 'number' && !(v.per > 0) ? [`${where}: formula 'stacks' per must be a positive number (it divides)`] : []),
         ...Object.entries(formulaCatalog[v.f].fields || {}).filter(([k]) => v[k] !== undefined && !operandOk(String(formulaCatalog[v.f].fields[k]), v[k])).map(([k]) => `${where}: formula '${v.f}' operand '${k}' has the wrong type (${formulaCatalog[v.f].fields[k]})`)];
    return [...own, ...Object.values(v).flatMap(x => formulaErrors(x, where))];
  };
  // Every card effect op (cards, enemy cards, effect variants) is a catalog op: the engine throws
  // 'Unknown opcode' on play otherwise (src/engine/actions.js).
  {
    const catalog = loadOps().ops;
    const walk = (v, where) => {
      if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${where}[${i}]`));
      if (!v || typeof v !== 'object') return;
      // A declarative amount must name a provider exported by this profile.
      if (v.op === 'heal' && v.rule !== undefined && (v.rule !== 'healRules' || !profile.modules['heal-rules'])) fail(`${where}: unknown or unavailable phase heal rule '${v.rule}'`);
      if ('op' in v && !catalog[v.op]) fail(`${where}: unknown effect op '${v.op}'`);
      else if ('op' in v) for (const [name, param] of Object.entries(catalog[v.op].params || {})) {
        if (param.required && v[name] === undefined && !(param.contentRequiredUnless && v[param.contentRequiredUnless] !== undefined)) fail(`${where}: op ${v.op} needs '${name}'`);
        else if (v[name] !== undefined && !paramOk(param.type, v[name], { staticContent: true })) fail(`${where}: op ${v.op} param '${name}' is not ${param.type === 'entityRef' ? `an effect target (${TARGETS.join(', ')})` : `a ${param.type}`}`);
      }
      if ((v.op === 'applyStatus' || v.op === 'removeStatus') && typeof v.status === 'string' && !knownStatuses.has(v.status)) fail(`${where}: op ${v.op} names status '${v.status}', which this profile does not export`);
      if (v.op === 'buildup' && typeof v.status === 'string' && !knownBuildups.has(v.status)) fail(`${where}: op buildup names status '${v.status}', which has no status-control row (src/content/combatStatusRules.js)`);
      // grantCardCharge's buildup bonus is keyed by buildupStatus and silently matches nothing when misspelled.
      if (typeof v.buildupStatus === 'string' && !knownBuildups.has(v.buildupStatus)) fail(`${where}: op ${v.op} names buildupStatus '${v.buildupStatus}', which has no status-control row (src/content/combatStatusRules.js)`);
      for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`);
    };
    for (const key of ['cards', 'enemyCards', 'resourceVariants', 'effectVariants', 'enemies', 'characters']) if (content[key]) { walk(content[key], `content.${key}`); for (const e of formulaErrors(content[key], `content.${key}`)) fail(e); }
  }
  for (const [slug, m] of Object.entries(mechanics)) {
    for (const [q, def] of Object.entries(m.interface.queries || {})) for (const e of formulaErrors(def.value, `${slug} query ${q}`)) fail(e);
    // Portable runtimes evaluate only the formulas they carry context for (SPEC section 7); metric and traitBonus
    // read engine-only state (abilityRiders, weapon damage, turn counters) and stay with the legacy engine.
    if (m.manifest.portability === 'portable') for (const e of portableFormulaErrors([m.interface.queries || {}, m.service.handlers || []], slug)) fail(e);
    for (const handler of m.service.handlers || []) if (handler.when !== undefined) for (const e of formulaErrors(handler.when, `${slug} handler ${handler.on} when`)) fail(e);
    for (const handler of m.service.handlers || []) if (handler.when !== undefined) for (const e of conditionErrors(handler.when, `${slug} handler ${handler.on} when`)) fail(e);
    // A portable mechanic implements every command it advertises (a host calls them directly).
    if (m.manifest.portability === 'portable') for (const c of commandsOf(slug)) if (!(m.service.handlers || []).some(h => h.on === `command.${c}`)) fail(`${slug}: interface command '${c}' has no command.${c} handler`);
    // Handler entry points: command.<name> is a declared command; event.<slug>.<event> names a declared event (or runtime.*) the mechanic lists in listens.
    for (const handler of m.service.handlers || []) {
      const on = String(handler.on || '');
      if (on.startsWith('command.')) { if (!commandsOf(slug).includes(on.slice(8))) fail(`${slug}: handler '${on}' is not a command in its interface`); }
      else if (on.startsWith('event.')) {
        const full = on.slice(6);
        if (full.startsWith('runtime.')) { if (!['runtime.poiseBroken', 'runtime.staggered'].includes(full)) fail(`${slug}: handler '${on}' listens to a runtime event the runtime never raises`); }
        else {
          const hit = splitName(full, slugs);
          if (!hit || !eventsOf(hit.slug).includes(hit.name)) fail(`${slug}: handler '${on}' listens to an event no mechanic declares`);
        }
        if (Array.isArray(m.interface.listens) && !m.interface.listens.includes(full)) fail(`${slug}: handler '${on}' is not in its interface listens`);
      }
    }
    for (const req of m.interface.requires || []) if (!slugs.has(req)) fail(`${slug}: requires unknown mechanic '${req}'`);
    for (const handler of m.service.handlers || []) {
      for (const step of walkSteps(handler.do)) {
        const check = (kind, full) => {
          if (typeof full !== 'string') return fail(`${slug}: ${kind} target must be a string, got ${JSON.stringify(full)}`);
          // runtime.* events are raised by ops only (SPEC section 6); a mechanic never emits them.
          if (kind === 'emit' && full.startsWith('runtime.')) return fail(`${slug}: emit '${full}' — runtime events are raised by ops, not emitted by mechanics`);
          const hit = splitName(full, slugs);
          if (!hit) return fail(`${slug}: ${kind} target '${full}' names no mechanic`);
          const known = kind === 'call' ? commandsOf(hit.slug) : eventsOf(hit.slug);
          if (!known.includes(hit.name)) fail(`${slug}: ${kind} target '${full}' is not a ${kind === 'call' ? 'command' : 'event'} of ${hit.slug}`);
          // A call runs the target's command.<name> handler, so the target mechanic must implement it.
          else if (kind === 'call' && !(mechanics[hit.slug].service.handlers || []).some(h => h.on === `command.${hit.name}`)) fail(`${slug}: call target '${full}' has no command.${hit.name} handler in ${hit.slug}`);
        };
        // Step kinds, in the runtime's order (SPEC section 6): anything else is 'Unknown step' at run time.
        if (!['op', 'if', 'forEach', 'emit', 'call', 'set'].some(k => k in step)) fail(`${slug}: unknown step ${JSON.stringify(step)}`);
        // Control steps carry their operands (SPEC section 6); both runtimes read them unconditionally.
        else if (!('op' in step)) {
          const bad = msg => fail(`${slug}: ${msg} in ${JSON.stringify(step).slice(0, 120)}`);
          if ('if' in step) { for (const e of conditionErrors(step.if, `${slug} if`)) fail(e); for (const k of ['then', 'else']) if (step[k] !== undefined && !Array.isArray(step[k])) bad(`if.${k} must be an array`); }
          else if ('forEach' in step) { if (typeof step.as !== 'string' || !step.as) bad('forEach needs a string as'); if (!Array.isArray(step.do)) bad('forEach needs a do array'); }
          else if ('set' in step) { if (typeof step.set !== 'string' || !step.set) bad('set needs a path string'); if (!('value' in step)) bad('set needs a value'); }
          for (const k of ['emit', 'call']) if (k in step && step.with !== undefined && (typeof step.with !== 'object' || step.with === null || Array.isArray(step.with))) bad(`${k}.with must be a record`);
        }
        for (const e of formulaErrors(Object.fromEntries(Object.entries(step).filter(([k]) => !['do', 'then', 'else'].includes(k))), slug)) fail(e);
        if ('call' in step) check('call', step.call);
        if ('emit' in step) check('emit', step.emit);
        // Ops: every op is in the catalog; a portable mechanic uses only portable ops (SPEC section 8).
        if ('op' in step) {
          const entry = catalogOps.ops[step.op];
          if (!entry) fail(`${slug}: op '${step.op}' is not in engine/runtime/ops.json`);
          else if (m.manifest.portability === 'portable' && entry.reference !== 'portable') fail(`${slug}: portable mechanic uses legacy op '${step.op}'`);
          else for (const [name, param] of Object.entries(entry.params || {})) {
            if (param.required && step[name] === undefined) fail(`${slug}: op ${step.op} needs '${name}'`);
            else if (step[name] !== undefined && !paramOk(param.type, step[name])) fail(`${slug}: op ${step.op} param '${name}' is not a ${param.type}`);
          }
        }
      }
    }
  }

  // ----- runtime -----
  const ops = loadOps();
  const formulas = readJson('engine/runtime/formulas.json');
  const runtime = { ops, formulas, specVersion: sha(readText('engine/runtime/SPEC.md')) };

  // ----- ui -----
  // A document's id is its file name (tools/ui-validate.mjs, tools/maps-validate.mjs): the artifact is keyed by it.
  for (const [where, docs] of [['ui/components', uiComponents], ['ui/screens', uiScreens], ['maps/components', mapComponents], ['maps', mapDocs]])
    for (const [key, doc] of Object.entries(docs)) if (doc?.id !== key) fail(`${where}/${key}: id '${doc?.id}' does not match the file name`);
  const layout = {};
  const addLayout = (ref, where) => {
    if (!ref) return;
    const uiRoot = path.join(ROOT, 'content/config/ui') + path.sep;
    if (!ref.startsWith('content/config/ui/') || !existsSync(path.join(ROOT, ref)) || !realpathSync(path.join(ROOT, ref)).startsWith(realpathSync(uiRoot.slice(0, -1)) + path.sep)) {
      if (!existsSync(path.join(ROOT, ref))) return fail(`${where}: layout ref '${ref}' does not exist`);
      return fail(`${where}: layout ref '${ref}' must live under content/config/ui/`);
    }
    if (!existsSync(path.join(ROOT, ref))) return fail(`${where}: layout ref '${ref}' does not exist`);
    layout[ref] ||= readJson(ref);
  };
  // Same rule as tools/ui-validate.mjs checkRef: a named layout.path must resolve inside its file.
  const layoutPath = (ref, dotted, where) => {
    if (!ref || dotted === undefined || !layout[ref]) return;
    let at = layout[ref];
    for (const part of dotted.split('.')) { if (at === null || typeof at !== 'object' || !(part in at)) return fail(`${where}: layout path '${dotted}' not found in ${ref}`); at = at[part]; }
  };
  for (const [id, c] of Object.entries(uiComponents)) {
    addLayout(c.layout?.ref, `component ${id}`);
    layoutPath(c.layout?.ref, c.layout?.path, `component ${id}`);
    for (const child of c.children || []) if (!uiComponents[child.component]) fail(`component ${id}: child '${child.component}' does not exist`);
    for (const e of visibilityErrors(c, `component ${id}`)) fail(e);
  }
  for (const [id, s] of Object.entries(uiScreens)) {
    addLayout(s.layout?.ref, `screen ${id}`);
    addLayout(s.scene?.ref, `screen ${id}`);
    for (const r of s.regions || []) if (!uiComponents[r.component]) fail(`screen ${id}: region '${r.slot}' uses unknown component '${r.component}'`);
  }
  const ui = { components: uiComponents, screens: uiScreens, layout: sortKeys(layout) };

  // ----- maps -----
  // Atlas documents the maps and components reference travel with the artifact (like ui.layout), so a consumer
  // that loads only the artifact can resolve atlas.ref / atlas.path and placement.atlas.
  const atlas = {};
  const sourceRoot = realpathSync(path.join(ROOT, 'content/source'));
  const addAtlas = (ref, where) => {
    if (typeof ref !== 'string' || !ref.startsWith('content/source/') || path.extname(ref) !== '.json') return fail(`${where}: atlas ref '${ref}' must live under content/source/ as JSON`);
    const file = path.join(ROOT, ref);
    if (!existsSync(file)) return fail(`${where}: atlas ref '${ref}' does not exist`);
    const relative = path.relative(sourceRoot, realpathSync(file));
    if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) return fail(`${where}: atlas ref '${ref}' must live under content/source/`);
    atlas[ref] ||= readJson(ref);
  };
  // Same rules as tools/maps-validate.mjs: every node has a component, every weighted type is a listed node component.
  const nodeComponents = new Set(Object.values(mapComponents).filter(c => c.kind === 'node').map(c => c.id));
  for (const c of Object.values(mapComponents)) if (c.placement?.atlas) addAtlas(c.placement.atlas, `map component ${c.id}`);
  for (const [id, m] of Object.entries(mapDocs)) {
    for (const n of m.nodes || []) if (!mapComponents[n]) fail(`map ${id}: node '${n}' has no map component`);
    if (m.atlas) {
      addAtlas(m.atlas.ref, `map ${id}`);
      if (atlas[m.atlas.ref] && m.atlas.path && resolveAtlasPath(atlas[m.atlas.ref], m.atlas.path) === undefined) fail(`map ${id}: atlas path '${m.atlas.path}' does not resolve in ${m.atlas.ref}`);
    }
    for (const [label, w] of Object.entries({ weights: m.generator?.weights, 'proposed.weights': m.generator?.proposed?.weights })) {
      for (const k of Object.keys(w || {})) {
        if (!nodeComponents.has(k)) fail(`map ${id}: ${label} names '${k}', which is not a node component`);
        else if (!(m.nodes || []).includes(k)) fail(`map ${id}: ${label} names '${k}', which the map does not list in nodes`);
      }
    }
    for (const [from, to] of Object.entries(m.generator?.proposed?.names || {})) if (!nodeComponents.has(to)) fail(`map ${id}: proposed.names ${from} -> '${to}' is not a node component`);
  }
  const maps = { components: mapComponents, maps: mapDocs, atlas: sortKeys(atlas) };

  // ----- assets -----
  const aliases = readAliases(ROOT, game);
  // aliases ship beside the catalog so an engine that reads only this artifact can resolve a UI slot (slot -> catalog id, or null for a placeholder).
  const assets = { catalog: buildAssetCatalog({ game }), aliases };
  const known = new Set(Object.keys(assets.catalog.assets));
  const referenced = (where, ids) => { for (const id of ids) if (id && !known.has(id)) fail(`${where}: asset '${id}' is not in the asset catalog or missing.json`); };
  // UI components and screens name logical asset slots (card.frame, scene.rest, icon.gold). A slot resolves through
  // the catalog or games/<game>/assets/aliases.json (a null alias is a placeholder on purpose); any other slot is
  // reported, not failed, until the art is mapped (see report.unresolvedAssets).
  const unresolvedAssets = [];
  const slot = (from, ids) => { for (const id of ids) if (id && !known.has(id) && !Object.hasOwn(aliases, id)) unresolvedAssets.push({ from, id }); };
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

  // Every layer document against its own contract (engine/contracts), so the documented build command
  // refuses data a consumer cannot interpret even when the separate test suites are not run.
  const contract = name => readJson(`engine/contracts/${name}.schema.json`);
  const check = (value, schema, where) => { try { validateGameSchema(value, schema, where); } catch (error) { fail(error.message); } };
  const C = { manifest: contract('mechanic'), iface: contract('mechanic-interface'), service: contract('mechanic-service'), cases: contract('mechanic-cases'),
    component: contract('ui-component'), screen: contract('ui-screen'), mapComponent: contract('map-component'), map: contract('map') };
  for (const [slug, m] of Object.entries(mechanics)) {
    check(m.manifest, C.manifest, `$/mechanics/${slug}/manifest`); check(m.interface, C.iface, `$/mechanics/${slug}/interface`);
    check(m.service, C.service, `$/mechanics/${slug}/service`); if (m.cases) check(m.cases, C.cases, `$/mechanics/${slug}/cases`);
  }
  for (const [id, c] of Object.entries(uiComponents)) check(c, C.component, `$/ui/components/${id}`);
  for (const [id, sc] of Object.entries(uiScreens)) check(sc, C.screen, `$/ui/screens/${id}`);
  for (const [id, c] of Object.entries(mapComponents)) check(c, C.mapComponent, `$/maps/components/${id}`);
  for (const [id, m] of Object.entries(mapDocs)) check(m, C.map, `$/maps/maps/${id}`);
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

async function main(argv) {
  // The standalone build refuses anything the dedicated validators refuse (map generator parity with
  // src/content/mapconfig.js and src/engine/mapgen.js, UI rules), so an artifact never skips them.
  const gameArg = argv.find(a => a.startsWith('--game='));
  const game = gameArg ? gameArg.slice(7) : 'ashenspire';
  const { problems } = await validateMaps({ game });
  const { errors: uiErrors } = validateUi({ games: [game] });
  if (problems.length || uiErrors.length) throw new Error(`build refused:\n  ${[...problems, ...uiErrors].join('\n  ')}`);
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
  main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exit(1); });
}
