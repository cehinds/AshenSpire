// tools/score-studio-save.mjs — local repo read/write helpers for Score Studio (scoring.json + cardArtLayers.json).
//
// Used by tools/serve.mjs on localhost only. All paths are validated to stay inside the repository root.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, lstatSync, realpathSync } from 'node:fs';
import { resolve, relative, dirname, sep, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ValidateScoringConfig } from '../src/model/activeScoring.js';
import { ValidateSubclassCatalog, SerializeSubclassCatalog } from '../src/model/subclassCatalogExport.js';
import { tryAcquire, lockEnv, busyMessage } from './lib/build-lock.mjs';
import { expansionStatuses } from '../src/content/combatStatusRules.js';
import { createHash } from 'node:crypto';
import { writeFileAtomic } from './lib/write-atomic.mjs';
import {
  STUDIO_SAVE_FILES,
  STUDIO_SAVE_FILE_NAMES,
  STUDIO_SAVE_FORMAT_VERSION,
  STUDIO_SAVE_HEADER_KEYS,
  studioSaveData,
  studioSaveDocument,
  stableJson,
} from './score-studio/studioSaveFiles.js';

export const DEFAULT_SCORING_PATH = 'content/source/scoring.json';
export const DEFAULT_ART_LAYERS_PATH = 'content/source/cardArtLayers.json';
export const DEFAULT_ITEM_ART_LAYERS_PATH = 'content/source/itemArtLayers.json';
export const DEFAULT_CUSTOM_DECKS_PATH = 'content/source/studioDecks.json';

function resolveRepoPath(rootDir, relPath, fallback) {
  const chosen = typeof relPath === 'string' && relPath.trim() ? relPath.trim() : fallback;
  const cleaned = chosen.replace(/\\/g, '/').replace(/^\/+/, '');
  const rootResolved = resolve(rootDir);
  const target = resolve(rootResolved, cleaned);
  const rel = relative(rootResolved, target);
  if (isAbsolute(rel) || rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || target === rootResolved) {
    throw new Error(`Path "${chosen}" escapes the repository root.`);
  }
  if (!target.endsWith('.json')) {
    throw new Error(`Path "${chosen}" must be a .json file.`);
  }
  return { target, rel: rel.split(sep).join('/') };
}

export function readStudioConfig(rootDir, { scoringPath, artLayersPath, itemArtLayersPath, customDecksPath } = {}) {
  const sc = resolveRepoPath(rootDir, scoringPath, DEFAULT_SCORING_PATH);
  const al = resolveRepoPath(rootDir, artLayersPath, DEFAULT_ART_LAYERS_PATH);
  const il = resolveRepoPath(rootDir, itemArtLayersPath, DEFAULT_ITEM_ART_LAYERS_PATH);
  const cd = resolveRepoPath(rootDir, customDecksPath, DEFAULT_CUSTOM_DECKS_PATH);
  const scoringExists = existsSync(sc.target);
  const artLayersExists = existsSync(al.target);
  const itemArtLayersExists = existsSync(il.target);
  const customDecksExists = existsSync(cd.target);
  return {
    scoringPath: sc.rel,
    defaultScoringPath: DEFAULT_SCORING_PATH,
    scoringExists,
    scoring: scoringExists ? JSON.parse(readFileSync(sc.target, 'utf8')) : null,
    artLayersPath: al.rel,
    defaultArtLayersPath: DEFAULT_ART_LAYERS_PATH,
    artLayersExists,
    artLayers: artLayersExists ? JSON.parse(readFileSync(al.target, 'utf8')) : null,
    itemArtLayersPath: il.rel,
    defaultItemArtLayersPath: DEFAULT_ITEM_ART_LAYERS_PATH,
    itemArtLayersExists,
    itemArtLayers: itemArtLayersExists ? JSON.parse(readFileSync(il.target, 'utf8')) : null,
    customDecksPath: cd.rel,
    defaultCustomDecksPath: DEFAULT_CUSTOM_DECKS_PATH,
    customDecksExists,
    customDecks: customDecksExists ? JSON.parse(readFileSync(cd.target, 'utf8')) : null,
  };
}

export function saveStudioScoring(rootDir, { path: relPath, scoring, rebuild = true } = {}) {
  const errors = ValidateScoringConfig(scoring);
  if (errors.length) {
    throw new Error(`Invalid scoring configuration: ${errors.join(' ')}`);
  }
  const { target, rel } = resolveRepoPath(rootDir, relPath, DEFAULT_SCORING_PATH);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(scoring, null, 2) + '\n', 'utf8');

  const rebuilt = [];
  if (rebuild && rel === DEFAULT_SCORING_PATH) {
    for (const script of ['tools/content-build.mjs', 'tools/combat-power-report.mjs', 'tools/level-lists.mjs']) {
      const r = spawnSync(process.execPath, [resolve(rootDir, script)], { cwd: rootDir, encoding: 'utf8' });
      if (r.status !== 0) {
        throw new Error(`Saved ${rel}, but ${script} failed: ${(r.stderr || r.stdout || '').trim().slice(0, 400)}`);
      }
      rebuilt.push(script);
    }
  }
  return { path: rel, rebuilt };
}

export function saveStudioArtLayers(rootDir, { path: relPath, artLayers } = {}) {
  if (!artLayers || typeof artLayers !== 'object' || !Array.isArray(artLayers.layers)) {
    throw new Error('Art layers config must be an object with a "layers" array.');
  }
  const { target, rel } = resolveRepoPath(rootDir, relPath, DEFAULT_ART_LAYERS_PATH);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(artLayers, null, 2) + '\n', 'utf8');
  return { path: rel, layerCount: artLayers.layers.length };
}

export function saveStudioItemArtLayers(rootDir, { path: relPath, itemArtLayers, rebuild = true } = {}) {
  if (!itemArtLayers || typeof itemArtLayers !== 'object' || !Array.isArray(itemArtLayers.layers)) {
    throw new Error('Item art layers config must be an object with a "layers" array.');
  }
  const { target, rel } = resolveRepoPath(rootDir, relPath, DEFAULT_ITEM_ART_LAYERS_PATH);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(itemArtLayers, null, 2) + '\n', 'utf8');
  const rebuilt = [];
  if (rebuild && rel === DEFAULT_ITEM_ART_LAYERS_PATH) {
    const r = spawnSync(process.execPath, [resolve(rootDir, 'tools/content-build.mjs')], { cwd: rootDir, encoding: 'utf8' });
    if (r.status !== 0) {
      throw new Error(`Saved ${rel}, but tools/content-build.mjs failed: ${(r.stderr || r.stdout || '').trim().slice(0, 400)}`);
    }
    rebuilt.push('tools/content-build.mjs');
  }
  return { path: rel, layerCount: itemArtLayers.layers.length, rebuilt };
}

export function saveStudioDecks(rootDir, { path: relPath, bundle } = {}) {
  if (!bundle || typeof bundle !== 'object') {
    throw new Error('Studio deck/list bundle must be a JSON object.');
  }
  const { target, rel } = resolveRepoPath(rootDir, relPath, DEFAULT_CUSTOM_DECKS_PATH);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(bundle, null, 2) + '\n', 'utf8');
  return {
    path: rel,
    cardCount: Array.isArray(bundle.cards) ? bundle.cards.length : 0,
    itemCount: Array.isArray(bundle.items) ? bundle.items.length : 0,
    deckCount: Array.isArray(bundle.customDecks) ? bundle.customDecks.length : 0,
    classCount: Array.isArray(bundle.customClasses) ? bundle.customClasses.length : 0,
  };
}

export const SUBCLASS_CATALOG_PATH = 'content/source/subclassCatalog.json';
const SUBCLASS_CLASSES = ['reaver', 'rogue', 'starseer', 'herald'];
const SUBCLASS_BUILD_STEPS = ['tools/content-build.mjs', 'tools/game-config.mjs', 'tools/combat-power-report.mjs', 'tools/level-lists.mjs'];

// Read the tag tree's CSV without interpreting commas inside quoted labels.
function csvRows(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim() && !line.trimStart().startsWith('#'));
  const cells = line => {
    const out = []; let value = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"' && quoted) { value += '"'; i++; }
      else if (ch === '"') quoted = !quoted;
      else if (ch === ',' && !quoted) { out.push(value); value = ''; }
      else value += ch;
    }
    out.push(value); return out;
  };
  const header = cells(lines.shift() || '');
  return lines.map(line => Object.fromEntries(cells(line).map((value, i) => [header[i], value])));
}

/** Add a validated catalog to both content pipelines. Every write is rolled back if any builder fails. */
export function saveStudioSubclassCatalog(rootDir, { catalog, rebuild = true } = {}) {
  const release = tryAcquire(rootDir, 'Subclass catalog export');
  if (typeof release !== 'function') throw new Error(busyMessage(release.heldBy));
  try { return saveSubclassCatalogLocked(rootDir, { catalog, rebuild, env: { ...process.env, ...lockEnv(release) } }); }
  finally { release(); }
}

function isInsideDirectory(baseDirectory, targetPath)
{
  const relativePath = relative(baseDirectory, targetPath);
  return !isAbsolute(relativePath) && relativePath !== '..' && !relativePath.startsWith(`..${sep}`);
}

/**
 * A resolver for repository-relative paths that refuses an escape, a symbolic link anywhere on the
 * path, or a part whose real path lies outside the repository. `label` starts every refusal.
 */
function guardedRepoPath(rootDir, label)
{
  const root = resolve(rootDir);
  const realRoot = realpathSync(root);
  return (relativePath) =>
  {
    const target = resolve(root, relativePath);
    if (!isInsideDirectory(root, target))
    {
      throw new Error(`${label} path escapes the repository: ${relativePath}`);
    }
    for (let part = target; part !== root; part = dirname(part))
    {
      // lstat must run before any existence check: existsSync follows a link,
      // so a dangling link looks absent even though a later write follows it.
      let stat;
      try
      {
        stat = lstatSync(part);
      }
      catch (error)
      {
        if (error.code === 'ENOENT')
        {
          continue;
        }
        throw error;
      }
      if (stat.isSymbolicLink())
      {
        throw new Error(`${label} refuses symbolic-link path: ${relativePath}`);
      }
      if (!isInsideDirectory(realRoot, realpathSync(part)))
      {
        throw new Error(`${label} path resolves outside the repository: ${relativePath}`);
      }
    }
    return target;
  };
}

function saveSubclassCatalogLocked(rootDir, { catalog, rebuild, env }) {
  const root = resolve(rootDir);
  const pathOf = guardedRepoPath(rootDir, 'Subclass export');
  const read = rel => readFileSync(pathOf(rel), 'utf8');
  const json = rel => JSON.parse(read(rel));
  const initialErrors = ValidateSubclassCatalog(catalog);
  if (initialErrors.length) throw new Error(`Invalid subclass catalog: ${initialErrors.slice(0, 12).join('; ')}`);
  const nodes = csvRows(read('content/source/nodes.csv'));
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const familyNodes = csvRows(read('content/source/familyNodes.csv'));
  const allowedTags = family => {
    const roots = new Set(familyNodes.filter(row => row.family === family).map(row => row.nodeId));
    return new Set(nodes.filter(node => {
      const seen = new Set();
      for (let id = node.id; id && !seen.has(id); id = nodeById.get(id)?.parentId) { if (roots.has(id)) return true; seen.add(id); }
      return false;
    }).map(node => node.id));
  };
  const sourcePaths = readdirSync(pathOf('content/source/cards')).filter(name => name.endsWith('.json')).map(name => `content/source/cards/${name}`);
  const sourceCards = new Map(sourcePaths.map(path => [path, json(path)]));
  const corePath = 'games/ashenspire/packs/core/cards.json';
  const coreCards = json(corePath);
  const classesPath = 'content/source/classes.json', classes = json(classesPath);
  const allCards = [...sourceCards.values()].flat().concat(coreCards);
  const registries = {
    cards: new Set([...allCards, ...catalog.cards].map(card => card.id)), classes: new Set(classes.map(row => row.id)), scripts: new Set(),
    ...Object.fromEntries(['statuses', 'stances', 'keywords'].map(kind => [kind, new Set(json(`content/source/${kind}.json`).map(row => row.id))])),
  };
  // These statuses are joined by src/content/statuses.js, rather than authored in statuses.json.
  for (const status of expansionStatuses) registries.statuses.add(status.id);
  const baseStatusesPath = 'games/ashenspire/packs/base-cards/statuses.json';
  if (existsSync(pathOf(baseStatusesPath))) for (const status of json(baseStatusesPath).statuses || []) registries.statuses.add(status.id);
  const errors = ValidateSubclassCatalog(catalog, { registries, cardTags: allowedTags('card'), effectTags: allowedTags('effect'), nodeIds: new Set(nodeById.keys()), strictReferences: true });
  if (errors.length) throw new Error(`Invalid subclass catalog: ${errors.slice(0, 12).join('; ')}`);
  const previous = existsSync(pathOf(SUBCLASS_CATALOG_PATH)) ? json(SUBCLASS_CATALOG_PATH) : { cards: [], lists: [] };
  if (previous.cards.length && ValidateSubclassCatalog(previous).length) throw new Error('Existing subclass ownership catalog is invalid; refusing to overwrite content.');
  const owned = new Map(previous.cards.map(card => [card.id, card]));
  const incoming = new Map(catalog.cards.map(card => [card.id, card]));
  for (const card of catalog.cards) {
    if (allCards.some(row => row.id === card.id) && !owned.has(card.id)) throw new Error(`Card '${card.id}' collides with authored content; no files changed.`);
    if (owned.has(card.id) && owned.get(card.id).class !== card.class) throw new Error(`Card '${card.id}' cannot change its owning class.`);
  }
  const merged = { ...catalog, cards: [...previous.cards.filter(card => !incoming.has(card.id)), ...catalog.cards], lists: [...previous.lists.filter(list => !catalog.lists.some(row => row.id === list.id)), ...catalog.lists.map(list => ({ ...list, cardIds: [...new Set([...(previous.lists.find(old => old.id === list.id)?.cardIds || []), ...list.cardIds])] }))] };
  if (Array.isArray(previous.metadata) || Array.isArray(catalog.metadata)) merged.metadata = [...(previous.metadata || []).filter(row => !incoming.has(row.cardId)), ...(catalog.metadata || [])];
  const mergedErrors = ValidateSubclassCatalog(merged);
  if (mergedErrors.length) throw new Error(`Catalog merge failed: ${mergedErrors.slice(0, 8).join('; ')}`);
  const writes = new Map();
  const putJson = (path, value) => writes.set(path, JSON.stringify(value, null, 2) + '\n');
  // Canonical base content stores card tags in tagging.csv and damage carriers in cardExposure.csv.
  for (const classId of SUBCLASS_CLASSES) {
    const path = `content/source/cards/${classId}Cards.json`, old = sourceCards.get(path);
    if (!Array.isArray(old)) throw new Error(`Missing canonical ${classId} card source`);
    const additions = catalog.cards.filter(card => card.class === classId).map(({ tags, damageSchool, exposureBuildupPerHit, ...raw }) => raw);
    if (additions.length) putJson(path, [...old.filter(card => !incoming.has(card.id)), ...additions]);
  }
  const keepCsv = (path, keep, additions) => {
    const text = read(path), eol = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.split(/\r?\n/).filter(line => !line || line.trimStart().startsWith('#') || keep(line.split(',')));
    while (lines.at(-1) === '') lines.pop();
    writes.set(path, [...lines, ...additions].join(eol) + eol);
  };
  keepCsv('content/source/tagging.csv', cells => !(cells[0] === 'card' && incoming.has(cells[2])), catalog.cards.flatMap(card => card.tags.map(tag => `card,,${card.id},${tag}`)));
  keepCsv('content/source/cardExposure.csv', cells => !incoming.has(cells[0]), catalog.cards.filter(card => card.effects.some(effect => effect.op === 'damage')).map(card => `${card.id},${card.damageSchool || 'physical'},${card.exposureBuildupPerHit || 0}`));
  putJson(classesPath, classes.map(row => ({ ...row, cardPool: [...new Set([...(row.cardPool || []), ...catalog.cards.filter(card => card.class === row.id).map(card => card.id)])] })));
  putJson(corePath, [...coreCards.filter(card => !incoming.has(card.id)), ...catalog.cards]);
  const variantsPath = 'games/ashenspire/packs/core/resourceVariants.json', variants = json(variantsPath);
  for (const card of catalog.cards) variants[card.id] = Object.fromEntries([['none', false, false], ['sp', true, false], ['mp', false, true], ['sp,mp', true, true]].map(([key, sp, mp]) => [key, { cost: sp ? card.staminaCost : 0, staminaCost: sp ? card.staminaCost : 0, manaCost: mp ? card.manaCost : 0 }]));
  putJson(variantsPath, variants);
  writes.set(SUBCLASS_CATALOG_PATH, SerializeSubclassCatalog(merged));
  // Builders only write these generated trees and the profile lock. Preserve exact preexisting bytes.
  const snapshots = new Map();
  const snapshotFile = rel => snapshots.set(rel, existsSync(pathOf(rel)) ? readFileSync(pathOf(rel)) : null);
  const generatedTrees = ['src/content/generated', 'src/framework/data'];
  const filesUnder = rel => {
    if (!existsSync(pathOf(rel))) return [];
    return readdirSync(pathOf(rel), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? filesUnder(`${rel}/${entry.name}`) : [`${rel}/${entry.name}`]);
  };
  for (const rel of [...writes.keys(), 'games/ashenspire/game.lock.json', ...generatedTrees.flatMap(filesUnder)]) snapshotFile(rel);
  const rebuilt = [];
  try {
    for (const [rel, text] of writes) { mkdirSync(dirname(pathOf(rel)), { recursive: true }); writeFileSync(pathOf(rel), text, 'utf8'); }
    if (rebuild) for (const script of SUBCLASS_BUILD_STEPS) {
      const result = spawnSync(process.execPath, [pathOf(script), ...(script.endsWith('game-config.mjs') ? ['build'] : [])], { cwd: root, env, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
      if (result.status !== 0) throw new Error(`${script} failed: ${(result.stderr || result.stdout || result.error?.message || '').trim().slice(-1200)}`);
      rebuilt.push(script);
    }
  } catch (error) {
    for (const rel of generatedTrees.flatMap(filesUnder)) if (!snapshots.has(rel)) rmSync(pathOf(rel));
    for (const [rel, bytes] of snapshots) {
      if (bytes === null) { if (existsSync(pathOf(rel))) rmSync(pathOf(rel)); }
      else { mkdirSync(dirname(pathOf(rel)), { recursive: true }); writeFileSync(pathOf(rel), bytes); }
    }
    throw new Error(`Subclass export rolled back: ${error.message}`);
  }
  return { cardCount: catalog.cards.length, listCount: catalog.lists.length, paths: [...writes.keys()], rebuilt };
}

// ---------------------------------------------------------------------------
// Studio Save (SS-003): the Studio's own config, in fixed files under content/source/studio/.
// No request field names a path: the files are STUDIO_SAVE_FILES, and nothing else is written.
// ---------------------------------------------------------------------------

const STUDIO_SAVE_LABEL = 'Studio save';
const STUDIO_SAVE_REQUEST_KEYS = Object.freeze([
  'revision',
  'files',
]);
const ABSENT_FILE_MARK = '<absent>';
const HTTP_BAD_REQUEST = 400;
const HTTP_CONFLICT = 409;
export const STUDIO_SAVE_STALE_MESSAGE = 'The Studio save files changed since this Studio loaded them (another tab, or a git pull). Reload to see them; your draft is kept.';

class StudioSaveError extends Error
{
  constructor(message, statusCode = HTTP_BAD_REQUEST)
  {
    super(message);
    this.statusCode = statusCode;
  }
}

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function refuse(message)
{
  throw new StudioSaveError(`${STUDIO_SAVE_LABEL} refused: ${message}`);
}

function requireExactKeys(value, allowedKeys, where)
{
  if (!isPlainObject(value))
  {
    refuse(`${where} must be a JSON object.`);
  }
  const extra = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  if (extra.length)
  {
    refuse(`${where} has keys that are not allowed: ${extra.join(', ')}.`);
  }
}

function requireLayerSet(value, where)
{
  if (!isPlainObject(value) || !Array.isArray(value.layers))
  {
    refuse(`${where} must be an object with a "layers" array.`);
  }
}

const isCardObject = (card) => isPlainObject(card) && typeof card.id === 'string' && Boolean(card.id);
const isCardId = (id) => typeof id === 'string' && Boolean(id);

const STUDIO_SAVE_DATA_CHECKS = Object.freeze({
  [STUDIO_SAVE_FILE_NAMES.cards]: (data) =>
  {
    if (!Array.isArray(data.cards) || !data.cards.every(isCardObject))
    {
      refuse('cards must be an array of card objects, each with an id.');
    }
    if (new Set(data.cards.map((card) => card.id)).size !== data.cards.length)
    {
      refuse('cards holds the same id twice.');
    }
    if (!Array.isArray(data.removedCardIds) || !data.removedCardIds.every(isCardId))
    {
      refuse('removedCardIds must be an array of card ids.');
    }
  },
  [STUDIO_SAVE_FILE_NAMES.artLayers]: (data) =>
  {
    requireLayerSet(data.cardArtLayers, 'cardArtLayers');
    requireLayerSet(data.itemArtLayers, 'itemArtLayers');
  },
  [STUDIO_SAVE_FILE_NAMES.templates]: (data) =>
  {
    if (!Array.isArray(data.templates) || !data.templates.every(isPlainObject))
    {
      refuse('templates must be an array of objects.');
    }
  },
});

/** Checks one file's document as the Studio sent it and returns its data keys. */
function validateStudioSaveDocument(name, document)
{
  const spec = STUDIO_SAVE_FILES[name];
  requireExactKeys(document, [...STUDIO_SAVE_HEADER_KEYS, ...spec.dataKeys], name);
  if (document.kind !== spec.kind)
  {
    refuse(`${name} must have kind "${spec.kind}".`);
  }
  if (document.formatVersion !== STUDIO_SAVE_FORMAT_VERSION)
  {
    refuse(`${name} must have formatVersion ${STUDIO_SAVE_FORMAT_VERSION}.`);
  }
  const missing = spec.dataKeys.filter((key) => !(key in document));
  if (missing.length)
  {
    refuse(`${name} is missing ${missing.join(', ')}.`);
  }
  const data = studioSaveData(name, document);
  STUDIO_SAVE_DATA_CHECKS[name](data);
  return data;
}

function studioSaveSerialize(name, data, savedAt)
{
  return JSON.stringify(studioSaveDocument(name, data, savedAt), null, 2) + '\n';
}

function studioSaveRevisionOf(bytesByName)
{
  const hash = createHash('sha256');
  for (const name of Object.keys(STUDIO_SAVE_FILES))
  {
    hash.update(`${name}\n${bytesByName[name] ?? ABSENT_FILE_MARK}\n`);
  }
  return hash.digest('hex');
}

function readStudioSaveBytes(pathOf)
{
  const bytesByName = {};
  for (const [name, spec] of Object.entries(STUDIO_SAVE_FILES))
  {
    const target = pathOf(spec.path);
    bytesByName[name] = existsSync(target) ? readFileSync(target, 'utf8') : null;
  }
  return bytesByName;
}

/** The saved Studio files: { revision, paths, files: { name: document | null } }. */
export function readStudioSave(rootDir)
{
  const pathOf = guardedRepoPath(rootDir, STUDIO_SAVE_LABEL);
  const bytesByName = readStudioSaveBytes(pathOf);
  const files = {};
  const paths = {};
  for (const [name, spec] of Object.entries(STUDIO_SAVE_FILES))
  {
    paths[name] = spec.path;
    files[name] = bytesByName[name] === null ? null : JSON.parse(bytesByName[name]);
  }
  return { revision: studioSaveRevisionOf(bytesByName), paths, files };
}

function restorePriorBytes(written, priorBytes)
{
  for (const write of written)
  {
    const prior = priorBytes[write.name];
    if (prior === null)
    {
      rmSync(write.target, { force: true });
    }
    else
    {
      writeFileAtomic(write.target, prior);
    }
  }
}

/**
 * Writes the files a Studio Save sent, all or none. Refuses a stale revision (409), any key outside
 * the fixed shape, and an unknown file name. A file whose data equals what is on disk keeps its
 * bytes. `writeFile` and `now` exist for tests only; the endpoint never passes them.
 */
export function saveStudioSave(rootDir, body, { writeFile = writeFileAtomic, now = () => new Date().toISOString() } = {})
{
  requireExactKeys(body, STUDIO_SAVE_REQUEST_KEYS, 'The request');
  if (typeof body.revision !== 'string')
  {
    refuse('revision must be the revision the Studio loaded.');
  }
  requireExactKeys(body.files, Object.keys(STUDIO_SAVE_FILES), 'files');
  const names = Object.keys(body.files);
  if (!names.length)
  {
    refuse('files is empty.');
  }
  const dataByName = Object.fromEntries(names.map((name) => [name, validateStudioSaveDocument(name, body.files[name])]));
  const pathOf = guardedRepoPath(rootDir, STUDIO_SAVE_LABEL);
  const priorBytes = readStudioSaveBytes(pathOf);
  if (studioSaveRevisionOf(priorBytes) !== body.revision)
  {
    throw new StudioSaveError(STUDIO_SAVE_STALE_MESSAGE, HTTP_CONFLICT);
  }
  const savedAt = now();
  const writes = [];
  const unchanged = [];
  for (const name of names)
  {
    const prior = priorBytes[name] === null ? null : JSON.parse(priorBytes[name]);
    if (prior && stableJson(studioSaveData(name, prior)) === stableJson(dataByName[name]))
    {
      unchanged.push(name);
      continue;
    }
    writes.push({
      name,
      target: pathOf(STUDIO_SAVE_FILES[name].path),
      bytes: studioSaveSerialize(name, dataByName[name], savedAt),
    });
  }
  const written = [];
  try
  {
    for (const write of writes)
    {
      mkdirSync(dirname(write.target), { recursive: true });
      writeFile(write.target, write.bytes);
      written.push(write);
    }
  }
  catch (error)
  {
    restorePriorBytes(written, priorBytes);
    throw new StudioSaveError(`${STUDIO_SAVE_LABEL} failed and was rolled back: ${error.message}`);
  }
  const current = readStudioSave(rootDir);
  return {
    revision: current.revision,
    paths: current.paths,
    savedAt: writes.length ? savedAt : null,
    written: writes.map((write) => write.name),
    unchanged,
  };
}
