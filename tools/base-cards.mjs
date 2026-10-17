#!/usr/bin/env node
// JSON is the authoring source; this projection supports import-only/file:// builds.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { validateEffects, validateFormula, validatePredicate } from '../src/model/validate.js';
import { statuses } from '../src/content/statuses.js';
import { stances } from '../src/content/stances.js';
import { TAGS } from '../src/content/tags.js';
import { fileURLToPath } from 'node:url';
export const BASE_CARD_PACK = 'games/ashenspire/packs/base-cards';
export const BASE_CARD_OUTPUT = 'src/content/generated/baseCards.js';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function loadBaseCardPack(root = ROOT) {
  const read = name => JSON.parse(readFileSync(resolve(root, BASE_CARD_PACK, name), 'utf8'));
  const source = read('cards.json'), groups = read('groups.json'), variants = read('resourceVariants.json');
  const manifest = read('sourceManifest.json');
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  const digest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
  const originals = new Map(manifest.sourceEntries.map(entry => [entry.id, entry.sha256]));
  if (originals.size !== manifest.sourceEntries.length || source.cards.length !== originals.size) throw new Error('Base cards must preserve each approved source ID exactly once');
  const seenSources = new Set();
  for (const row of source.cards) {
    const original = row.provenance?.sourceProposal;
    if (!original || seenSources.has(original.id) || originals.get(original.id) !== digest(original)) throw new Error(`${row.definition?.id}: changed, duplicate or unrecognized source proposal`);
    seenSources.add(original.id);
  }
  const rows = [...source.cards, ...(source.helpers || [])], ids = new Set();
  for (const row of rows) {
    const card = row.definition;
    if (!card || typeof card.id !== 'string' || !card.id.startsWith('base.')) throw new Error('Base card requires an explicit base.* identity');
    if (ids.has(card.id)) throw new Error(`Duplicate base card id '${card.id}'`);
    ids.add(card.id);
    if (!card.effects?.length && !card.burden && !card.stanceTrigger) throw new Error(`${card.id}: no executable effect, burden or stance`);
    if (!Array.isArray(row.tags) || !Array.isArray(row.groups)) throw new Error(`${card.id}: missing authored tags/groups`);
    if (!variants[card.id] || ['sp,mp', 'sp', 'mp', 'none'].some(key => !variants[card.id][key])) throw new Error(`${card.id}: missing resource-off variant`);
    for (const group of row.groups) if (!groups[group]?.members?.includes(card.id)) throw new Error(`${card.id}: missing membership in '${group}'`);
  }
  for (const [id, group] of Object.entries(groups)) {
    if (new Set(group.members).size !== group.members.length) throw new Error(`${id}: duplicate group member`);
    for (const member of group.members) if (!ids.has(member)) throw new Error(`${id}: unknown card '${member}'`);
  }
  for (const id of Object.keys(variants)) if (!ids.has(id)) throw new Error(`Variants reference unknown base card '${id}'`);
  const statusPath = resolve(root, BASE_CARD_PACK, 'statuses.json');
  if (!existsSync(statusPath)) throw new Error('Missing base-cards/statuses.json');
  const statusSource = read('statuses.json');
  return { rows, groups, variants, statusSource };
}
export function validateBaseCardEffects({ rows, statusSource }) {
  const errors = [], context = {
    err: (path, message) => errors.push(`${path}: ${message}`),
    ids: { cards:new Set(rows.map(row => row.definition.id)), statuses:new Set([...statuses, ...statusSource.statuses].map(row => row.id)), stances:new Set(stances.map(row => row.id)), scripts:new Set() },
    tagIds:new Set(TAGS.map(row => row.id)), nodeIds:new Set(TAGS.map(row => row.id)),
  };
  for (const { definition: card } of rows) {
    validateEffects(card.effects, card.id, context);
    if (card.targetLimit !== undefined) validateFormula(card.targetLimit, `${card.id}.targetLimit`, context);
    for (const [i, variant] of (card.effectVariants || []).entries()) {
      validatePredicate(variant.if, `${card.id}.effectVariants[${i}].if`, context);
      validateEffects(variant.effects, `${card.id}.effectVariants[${i}].effects`, context);
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
}
export function compileBaseCards(root = ROOT) {
  const pack = loadBaseCardPack(root);
  validateBaseCardEffects(pack);
  const { rows, groups, statusSource } = pack;
  const values = {
    baseCardDefinitions: rows.map(row => row.definition),
    baseCardTagging: rows.flatMap(row => row.tags.map(tagId => ({ family: 'card', objectId: row.definition.id, tagId }))),
    baseCardRewardIds: groups['base.current-rewards'].members,
    baseCardPresentation: Object.fromEntries(rows.map(row => [row.definition.id, { ...row.presentation, textTemplate: row.definition.textTemplate }])),
    baseCardStatuses: statusSource.statuses,
    baseCardStatusRules: statusSource.rules,
  };
  // Compact generated JS data; the authored JSON pack remains readable.
  return '// Generated by tools/base-cards.mjs; edit the base-cards JSON pack.\n' + Object.entries(values).map(([name, value]) => `export const ${name} = ${JSON.stringify(value)};\n`).join('');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const text = compileBaseCards();
    if (process.argv.includes('--check')) {
      if (!existsSync(resolve(ROOT, BASE_CARD_OUTPUT)) || readFileSync(resolve(ROOT, BASE_CARD_OUTPUT), 'utf8') !== text) throw new Error(`Stale ${BASE_CARD_OUTPUT}; run node tools/base-cards.mjs`);
    } else writeFileSync(resolve(ROOT, BASE_CARD_OUTPUT), text);
    process.stdout.write(`Base card pack ${process.argv.includes('--check') ? 'checked' : 'compiled'}.\n`);
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
