// Portable validation shared by Score Studio and its fixed-path game importer.
import { SCHEMAS, COMBAT_OPCODES, EVENTS } from './schemas.js';
import { walkSchema } from './validate/schemaWalk.js';
import { validateEffects } from './validate/effectGrammar.js';
import { UPGRADE_OPTION_KINDS } from './cardUpgradeSteps.js';
import { SUBCLASS_CATALOG } from './subclassCardGenerator.js';

const CLASSES = ['reaver', 'rogue', 'starseer', 'herald'];
const ID = /^subclass\.[a-z0-9][a-z0-9._-]*$/;
const styles = new Map(SUBCLASS_CATALOG.map(row => [row.id, row]));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const anyId = { has: value => typeof value === 'string' && value.length > 0 };

/** Remove transient Studio bookkeeping without changing authored mechanics. */
export function CleanSubclassCard(card) {
  return Object.fromEntries(Object.entries(card).filter(([key, value]) => !key.startsWith('_') && value !== undefined));
}

/** Returns named errors; registry sets are supplied by the server for strict reference checks. */
export function ValidateSubclassCatalog(catalog, { registries = {}, cardTags, effectTags, nodeIds, strictReferences = false } = {}) {
  const errors = [];
  const err = (path, message) => errors.push(`${path}: ${message}`);
  const inspect = (value, path, depth = 0) => {
    if (depth > 30) { err(path, 'nesting exceeds 30 levels'); return; }
    if (typeof value === 'number' && !Number.isFinite(value)) err(path, 'number must be finite');
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') err(path, 'must be JSON data');
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype', 'script'].includes(key)) err(`${path}.${key}`, 'unsafe or scripted field is not permitted');
      inspect(child, `${path}.${key}`, depth + 1);
    }
  };
  try {
    if (!object(catalog)) return ['catalog: must be an object'];
    inspect(catalog, 'catalog');
    if (errors.length) return errors;
    for (const key of Object.keys(catalog)) if (!['formatVersion', 'kind', 'seed', 'cards', 'lists', 'metadata', 'summary'].includes(key)) err(`catalog.${key}`, 'unknown field');
    if (catalog.formatVersion !== 1 || catalog.kind !== 'ashenspire.subclassCatalog') err('catalog', 'expected ashenspire.subclassCatalog formatVersion 1');
    if (!['string', 'number'].includes(typeof catalog.seed)) err('catalog.seed', 'must be a string or number');
    if (!Array.isArray(catalog.cards) || !catalog.cards.length || catalog.cards.length > 2000) return [...errors, 'catalog.cards: expected 1..2000 cards'];
    if (!Array.isArray(catalog.lists) || !catalog.lists.length || catalog.lists.length > 100) return [...errors, 'catalog.lists: expected 1..100 lists'];
    const cardById = new Map();
    const refs = new Proxy(registries, { get: (target, key) => target[key] || (strictReferences ? new Set() : anyId) });
    const vctx = { err, ids: refs, nodeIds: nodeIds || anyId, tagIds: effectTags || anyId };
    for (const [i, card] of catalog.cards.entries()) {
      const path = `catalog.cards[${i}]`;
      if (!object(card)) { err(path, 'must be a card object'); continue; }
      if (typeof card.id !== 'string' || !ID.test(card.id)) err(`${path}.id`, 'must use the subclass. namespace with lowercase safe characters');
      const style = styles.get(String(card.id).split('.')[1]);
      if (!style || style.classId !== card.class) err(`${path}.id`, 'must use subclass.<supported style>.<card> with the matching class');
      if (cardById.has(card.id)) err(`${path}.id`, 'duplicate card id');
      cardById.set(card.id, card);
      if (!CLASSES.includes(card.class)) err(`${path}.class`, 'must name one of the four classes');
      if (!['common', 'uncommon', 'rare'].includes(card.rarity)) err(`${path}.rarity`, 'must be common, uncommon, or rare');
      for (const key of ['cost', 'staminaCost', 'manaCost']) if (!Number.isInteger(card[key]) || card[key] < 0 || card[key] > 99) err(`${path}.${key}`, 'must be an integer from 0 to 99');
      if (card.costRule !== 'fixed') err(`${path}.costRule`, 'generated cards require fixed costs');
      if (!Array.isArray(card.tags) || !card.tags.length || card.tags.some(tag => typeof tag !== 'string' || (cardTags && !cardTags.has(tag)))) err(`${path}.tags`, 'must contain registered card tags');
      if (new Set(card.tags || []).size !== card.tags?.length) err(`${path}.tags`, 'duplicate tags');
      if (!Array.isArray(card.effects) || !card.effects.length) err(`${path}.effects`, 'must contain at least one effect');
      for (const menu of card.upgradeMenu || []) if (!UPGRADE_OPTION_KINDS.includes(menu)) err(`${path}.upgradeMenu`, `unknown upgrade option '${menu}'`);
      const { tags, ...raw } = card;
      walkSchema(raw, SCHEMAS.card, path, vctx);
      // Legacy schema escape hatches are not an unchecked card-import surface.
      for (const key of ['attack', 'counterCoverage', 'counterPayload', 'evade', 'traitValues', 'upcast', 'stanceExpiry', 'legacyFace', 'requirements', 'gradeProfiles', 'mechanicTags', 'mechanicBindings']) {
        if (card[key] !== undefined) err(`${path}.${key}`, 'not supported by the subclass catalog importer');
      }
      if (card.stanceTrigger !== undefined && (!object(card.stanceTrigger) || Object.keys(card.stanceTrigger).some(key => key !== 'stance') || !['attack', 'defend', 'counter', 'sweep', 'smash', 'casting', 'prepared', 'evade'].includes(card.stanceTrigger.stance))) err(`${path}.stanceTrigger`, 'must name one supported stance');
      if (card.comboHook !== undefined) {
        const hook = card.comboHook;
        if (!object(hook)) err(`${path}.comboHook`, 'must be an object');
        else {
          for (const key of Object.keys(hook)) if (!['on', 'statuses', 'reasons', 'targetKind', 'oncePerTurn', 'effects'].includes(key)) err(`${path}.comboHook.${key}`, 'unknown hook field');
          if (!EVENTS.includes(hook.on)) err(`${path}.comboHook.on`, 'unknown combat event');
          if (hook.oncePerTurn !== true) err(`${path}.comboHook.oncePerTurn`, 'imported hooks must be bounded to once per turn');
          if (hook.targetKind !== undefined && !['player', 'enemy'].includes(hook.targetKind)) err(`${path}.comboHook.targetKind`, 'must be player or enemy');
          for (const key of ['statuses', 'reasons']) if (hook[key] !== undefined && (!Array.isArray(hook[key]) || hook[key].some(value => typeof value !== 'string' || !value || (key === 'statuses' && !refs.statuses.has(value))))) err(`${path}.comboHook.${key}`, 'must contain valid references');
          validateEffects(hook.effects, `${path}.comboHook.effects`, vctx);
          if (!hook.effects?.length) err(`${path}.comboHook.effects`, 'must contain at least one effect');
        }
      }
      const checkOps = value => {
        if (!value || typeof value !== 'object') return;
        if (value.op && !COMBAT_OPCODES.includes(value.op)) err(path, `non-combat opcode '${value.op}' is not permitted`);
        for (const child of Object.values(value)) checkOps(child);
      };
      checkOps(card);
    }
    const seenLists = new Set(), listed = new Set();
    for (const [i, list] of catalog.lists.entries()) {
      const path = `catalog.lists[${i}]`;
      if (!object(list)) { err(path, 'must be an object'); continue; }
      for (const key of Object.keys(list)) if (!['id', 'classId', 'name', 'cardIds'].includes(key)) err(`${path}.${key}`, 'unknown list field');
      if (!styles.has(list.id) || seenLists.has(list.id)) err(`${path}.id`, 'must name one of the twelve supported styles, once');
      seenLists.add(list.id);
      if (!CLASSES.includes(list.classId)) err(`${path}.classId`, 'unknown class');
      if (styles.has(list.id) && styles.get(list.id).classId !== list.classId) err(`${path}.classId`, 'does not match the style class');
      if (typeof list.name !== 'string' || !list.name.trim()) err(`${path}.name`, 'must have a name');
      if (!Array.isArray(list.cardIds) || !list.cardIds.length) { err(`${path}.cardIds`, 'must be a nonempty array'); continue; }
      if (new Set(list.cardIds).size !== list.cardIds.length) err(`${path}.cardIds`, 'duplicate card reference');
      for (const id of list.cardIds) {
        if (!cardById.has(id)) err(`${path}.cardIds`, `unknown catalog card '${id}'`);
        else if (cardById.get(id).class !== list.classId) err(`${path}.cardIds`, `card '${id}' belongs to another class`);
        listed.add(id);
      }
    }
    for (const id of cardById.keys()) if (!listed.has(id)) err('catalog.lists', `card '${id}' is not assigned to a list`);
  } catch (error) { err('catalog', `malformed catalog: ${error.message}`); }
  return errors;
}

export function SerializeSubclassCatalog(catalog) {
  const clean = { ...catalog, cards: (catalog.cards || []).map(CleanSubclassCard) };
  const errors = ValidateSubclassCatalog(clean);
  if (errors.length) throw new Error(errors.slice(0, 8).join('\n'));
  return JSON.stringify(clean, null, 2) + '\n';
}
