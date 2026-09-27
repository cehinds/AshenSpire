// src/model/consumables.js — skill books, revive tokens and companions
// (SPEC §14.3, §14.6 step 5b), headless.
//
// Two run fields, both added at schema 16:
//
//   run.consumables  { [consumableId]: count }   whole counts ≥ 1; a used-up
//                                                entry is deleted
//   run.companions   [{ id, combatsLeft }]       one of each; leaves at 0
//
// This file owns what reads and writes them outside the shop's purchase
// (model/marketAdditions.js) and the fight's own mount and revive
// (engine/properties.js, engine/actions.js):
//
//   · reading a skill book (the Armoury's Read door) — one awardSkillXp, the
//     one writer of a track (§13.4d);
//   · selling a consumable back (the market's Sell pane), a plan/commit pair
//     paying min(sellValue, the buy price now), so a round trip never profits;
//   · settling a fight: its copy of the counts back to the run, and every
//     companion one fight closer to leaving (engine/runCombat.js runCombatEnd);
//   · the content door's checks and the Settings rows for every number.
import { NOTE } from '../content/balance.js';
import { awardSkillXp, skillTracks } from './skills.js';
import { uiStrings } from '../content/generated/uiStrings.js';
import { NEW_RUN_CLAUSE } from './balanceNotes.js';

// The run-shape checks are a leaf's (state.js reads them without this file's
// imports): model/marketStock.js.
// Re-exported as plain consts: tools/bundle.mjs inlines `export const` and
// does not read `export … from` (the rule model/validate.js follows).
import { consumablesProblems as consumablesProblems_, companionsProblems as companionsProblems_ } from './marketStock.js';
export const consumablesProblems = consumablesProblems_;
export const companionsProblems = companionsProblems_;

export const CONSUMABLE_KINDS = Object.freeze(['skillBook', 'revive']);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
// The sentence a refusal's uiStrings row says (the rule model/shopKinds.js
// shopSentence follows; read here directly so shopKinds.js may import this
// file for the item rows' Settings refusals without a cycle).
function say(id, tokens = {}) {
  const text = uiStrings.find((row) => row.id === id)?.short;
  if (!text) throw new Error(`uiStrings: '${id}' has no short form`);
  return text.replace(/\{(\w+)\}/g, (_, key) => {
    if (!Object.hasOwn(tokens, key)) throw new Error(`uiStrings: '${id}.short' wants {${key}}`);
    return String(tokens[key]);
  });
}
const revision = (run) => run.shopStock?.tradeRevision || 0;

/** The count of one consumable the run holds (0 when none). */
export const heldCount = (run, id) => (object(run.consumables) && Number.isSafeInteger(run.consumables[id]) ? run.consumables[id] : 0);

/** Add `n` to a count map, deleting an entry that reaches 0. Returns the map. */
export function adjustCount(map, id, n) {
  const next = (map[id] || 0) + n;
  if (next > 0) map[id] = next;
  else delete map[id];
  return map;
}

/** The first owned consumable id this build does not know, or null (the load door archives on one). */
export function unknownConsumableId(registries, run) {
  return Object.keys(object(run.consumables) ? run.consumables : {}).find((id) => !registries.consumables.has(id)) || null;
}

/** The first companion id this build does not know, or null (the load door archives on one). */
export function unknownCompanionId(registries, run) {
  return (Array.isArray(run.companions) ? run.companions : []).map((row) => row && row.id).find((id) => !registries.companions.has(id)) || null;
}

/** A consumable's shelf sentence, its {tokens} filled from the row's live values. */
export function consumableText(registries, def) {
  const track = def.skill ? skillTracks(registries).find((row) => row.id === def.skill) : null;
  return String(def.blurb || '').replace(/\{(\w+)\}/g, (whole, key) => {
    if (key === 'skill') return track ? track.label : String(def.skill || '');
    return def[key] !== undefined ? String(def[key]) : whole;
  });
}

/** What the market charges for one now: its `cost`, scaled by a custom run's price multiplier, rounded up. */
export function consumableBuyPrice(def, priceMult = 1) {
  return Math.max(1, Math.ceil(def.cost * (Number.isFinite(priceMult) && priceMult > 0 ? priceMult : 1)));
}

// ---------------------------------------------------------------------------
// Reading a skill book (the Armoury's Inventory)
// ---------------------------------------------------------------------------

export function skillBookReadPlan(registries, run, id, { inCombat = false } = {}) {
  const def = registries.consumables.has(id) ? registries.consumables.get(id) : null;
  let reason = '';
  if (!def || def.kind !== 'skillBook') reason = say('consumable.refuse.notBook');
  // Read outside combat only (SPEC §14.3): the model refuses, not only the door.
  else if (inCombat) reason = say('consumable.refuse.inCombat', { name: def.name });
  else if (heldCount(run, id) < 1) reason = say('consumable.refuse.none', { name: def.name });
  return { ok: !reason, reason, id, def, count: heldCount(run, id) };
}

/** One awardSkillXp on the book's track, then one fewer book. Returns the award's receipt. */
export function commitSkillBookRead(registries, run, quote, { inCombat = false } = {}) {
  const plan = skillBookReadPlan(registries, run, quote.id, { inCombat });
  if (!plan.ok) throw new Error(plan.reason);
  const receipt = awardSkillXp(registries, run, plan.def.skill, plan.def.xp);
  adjustCount(run.consumables, plan.id, -1);
  return receipt;
}

// ---------------------------------------------------------------------------
// Selling one back (the market's Sell pane)
// ---------------------------------------------------------------------------

export function consumableSalePlan(registries, run, id, { priceMult = 1 } = {}) {
  const def = registries.consumables.has(id) ? registries.consumables.get(id) : null;
  const price = def ? Math.min(def.sellValue, consumableBuyPrice(def, priceMult)) : NaN;
  let reason = '';
  if (!def) reason = say('shop.refuse.gone');
  else if (heldCount(run, id) < 1) reason = say('consumable.refuse.none', { name: def.name });
  else if (!(Number.isSafeInteger(price) && price >= 0)) reason = say('shop.refuse.unpriced');
  return { ok: !reason, reason, id, def, price, revision: revision(run) };
}

export function commitConsumableSale(registries, run, quote, { priceMult = 1 } = {}) {
  const plan = consumableSalePlan(registries, run, quote.id, { priceMult });
  if (!plan.ok) throw new Error(plan.reason);
  if (quote.revision !== plan.revision || quote.price !== plan.price) throw new Error(say('shop.refuse.stale'));
  adjustCount(run.consumables, plan.id, -1);
  run.cinders += plan.price;
  if (run.shopStock) run.shopStock.tradeRevision = plan.revision + 1;
  return { id: plan.id, price: plan.price };
}

// ---------------------------------------------------------------------------
// The fight: revive tokens and companions
// ---------------------------------------------------------------------------

/** The revive token a fight spends from `counts`: the first held, in content order, or null. */
export function reviveTokenFor(registries, counts) {
  if (!object(counts)) return null;
  return registries.consumables.all().find((def) => def.kind === 'revive' && counts[def.id] >= 1) || null;
}

/** HP a revive leaves: max(1, floor(maxHp × hpPct / 100)). */
export const reviveHp = (maxHp, hpPct) => Math.max(1, Math.floor((maxHp * hpPct) / 100));

/**
 * settleFightConsumables(run, combat) — the fight's copy of the counts back to
 * the run (SPEC §14.3). A fight restored from a snapshot written before the
 * field carries none (null), and leaves the run's counts as they were.
 */
export function settleFightConsumables(run, combat) {
  if (!combat || !object(combat.consumables)) return;
  run.consumables = Object.fromEntries(Object.entries(combat.consumables).filter(([, n]) => Number.isSafeInteger(n) && n >= 1));
}

/** Every companion one fight closer to leaving; those at 0 leave. Returns the ids that left. */
export function tickCompanions(run) {
  if (!Array.isArray(run.companions)) return [];
  const left = [];
  run.companions = run.companions
    .map((row) => ({ ...row, combatsLeft: row.combatsLeft - 1 }))
    .filter((row) => {
      if (row.combatsLeft >= 1) return true;
      left.push(row.id);
      return false;
    });
  return left;
}

// ---------------------------------------------------------------------------
// The content door
// ---------------------------------------------------------------------------

const CONSUMABLE_FIELDS = Object.freeze({
  skillBook: ['id', 'kind', 'name', 'blurb', 'cost', 'sellValue', 'skill', 'xp'],
  revive: ['id', 'kind', 'name', 'blurb', 'cost', 'sellValue', 'hpPct'],
});
const COMPANION_FIELDS = Object.freeze(['id', 'name', 'blurb', 'cost', 'combats']);
// Whether any row carries a [NOTE]: a JSON or structuredClone copy of the
// bundle holds none, and refusing each number of such a copy would refuse the
// copy, not the content (the rule shopsTableProblems follows).
const carriesNotes = (rows) => rows.some((row) => object(row) && object(row[NOTE]));

function wholeAtLeast(row, key, floor, at, err, ceiling = Infinity) {
  const value = row[key];
  if (!(Number.isSafeInteger(value) && value >= floor && value <= ceiling)) {
    err(`${at}.${key}`, `must be a whole number ${ceiling === Infinity ? `of at least ${floor}` : `from ${floor} to ${ceiling}`}, got ${JSON.stringify(value)}`);
  }
}

/** content/consumables.js refused by name (validateContent). */
export function consumableTableProblems(rows, bundle, err) {
  if (!Array.isArray(rows)) { err('consumables', 'must be an array of consumable rows'); return; }
  const noted = carriesNotes(rows);
  const tracks = new Set(skillTracks(bundle).map((row) => row.id));
  const seen = new Set();
  rows.forEach((row, index) => {
    if (!object(row) || typeof row.id !== 'string' || !row.id) { err(`consumables[${index}]`, 'must be a consumable { id, kind, name, blurb, cost, sellValue, … }'); return; }
    const at = `consumables.${row.id}`;
    if (seen.has(row.id)) err(at, 'is listed twice');
    seen.add(row.id);
    if (!CONSUMABLE_KINDS.includes(row.kind)) { err(`${at}.kind`, `must be one of ${CONSUMABLE_KINDS.join(', ')}, got ${JSON.stringify(row.kind)}`); return; }
    for (const key of Object.keys(row)) if (!CONSUMABLE_FIELDS[row.kind].includes(key)) err(`${at}.${key}`, `is not a ${row.kind} field (fields: ${CONSUMABLE_FIELDS[row.kind].join(', ')})`);
    for (const key of ['name', 'blurb']) if (typeof row[key] !== 'string' || !row[key]) err(`${at}.${key}`, 'must be a non-empty string');
    wholeAtLeast(row, 'cost', 1, at, err);
    wholeAtLeast(row, 'sellValue', 1, at, err);
    if (Number.isSafeInteger(row.cost) && Number.isSafeInteger(row.sellValue) && row.sellValue > row.cost) {
      err(`${at}.sellValue`, `(${row.sellValue}) must not be above its cost (${row.cost}): buying one and selling it back must never profit`);
    }
    if (row.kind === 'skillBook') {
      wholeAtLeast(row, 'xp', 1, at, err);
      if (typeof row.skill !== 'string' || !tracks.has(row.skill)) err(`${at}.skill`, `must be a skill track id (${[...tracks].filter((id) => !id.startsWith('class:')).join(', ')}), got ${JSON.stringify(row.skill)}`);
      else if (row.skill.startsWith('class:')) err(`${at}.skill`, `is '${row.skill}', a class track; a skill book teaches a weapon, focus, armour or dual-wield track`);
    } else wholeAtLeast(row, 'hpPct', 1, at, err, 100);
    if (noted) for (const key of Object.keys(row)) {
      if (typeof row[key] === 'number' && typeof row[NOTE]?.[key] !== 'string') err(`${at}.${key}`, 'is a number with no [NOTE] beside it: write the sentence its Settings row shows');
    }
  });
}

/** content/companions.js refused by name (validateContent). `stamped` is the tagged collection. */
export function companionTableProblems(rows, bundle, err) {
  if (!Array.isArray(rows)) { err('companions', 'must be an array of companion rows'); return; }
  const noted = carriesNotes(rows);
  const tagging = Array.isArray(bundle.tagging) ? bundle.tagging : [];
  const propertyIds = new Set((Array.isArray(bundle.tags) ? bundle.tags : []).filter((tag) => tag && tag.domain === 'property').map((tag) => tag.id));
  const nodes = new Map((Array.isArray(bundle.nodes) ? bundle.nodes : []).map((node) => [node.id, node]));
  const underCompanion = (id) => {
    for (let at = nodes.get(id); at; at = nodes.get(at.parentId)) if (at.parentId === 'companion') return true;
    return false;
  };
  const seen = new Set();
  rows.forEach((row, index) => {
    if (!object(row) || typeof row.id !== 'string' || !row.id) { err(`companions[${index}]`, 'must be a companion { id, name, blurb, cost, combats }'); return; }
    const at = `companions.${row.id}`;
    if (seen.has(row.id)) err(at, 'is listed twice');
    seen.add(row.id);
    for (const key of ['triggers', 'modifiers']) {
      if (row[key] !== undefined) err(`${at}.${key}`, `is not authored on a companion (Codex on #1376): what a companion does is its property row in tagging.csv, a leaf under the companion branch with its rule in nodeEffects.json`);
    }
    for (const key of Object.keys(row)) if (!COMPANION_FIELDS.includes(key) && key !== 'triggers' && key !== 'modifiers') err(`${at}.${key}`, `is not a companion field (fields: ${COMPANION_FIELDS.join(', ')})`);
    for (const key of ['name', 'blurb']) if (typeof row[key] !== 'string' || !row[key]) err(`${at}.${key}`, 'must be a non-empty string');
    wholeAtLeast(row, 'cost', 1, at, err);
    wholeAtLeast(row, 'combats', 1, at, err);
    const props = tagging.filter((tag) => tag && tag.family === 'companion' && tag.objectId === row.id && propertyIds.has(tag.tagId)).map((tag) => tag.tagId);
    if (!props.length) err(at, 'derives no property tag: give it a `companion` row in tagging.csv naming a leaf under the companion branch of property');
    for (const tag of props) if (!underCompanion(tag)) err(at, `carries property '${tag}', which is not a leaf under the companion branch of property`);
    if (noted) for (const key of ['cost', 'combats']) if (typeof row[NOTE]?.[key] !== 'string') err(`${at}.${key}`, 'is a number with no [NOTE] beside it: write the sentence its Settings row shows');
  });
}

// ---------------------------------------------------------------------------
// Settings → Advanced → Shops: a row per item number
// ---------------------------------------------------------------------------

const ITEM_COLLECTIONS = Object.freeze(['consumables', 'companions']);
const words = (value) => String(value).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[._-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
// hpPct is a percent; every other item number is a whole count or price.
const domainFor = (key, value) => (key === 'hpPct'
  ? { integer: true, step: 1, min: 1, max: 100 }
  : { integer: true, step: 1, min: 1, max: Math.max(20, Math.ceil(Math.max(1, value) * 10)) });

/**
 * consumableConfigRows(bundle) → `gameConfig.consumables.<id>.<key>` and
 * `gameConfig.companions.<id>.<key>`, one per number an item row authors,
 * generated from the data (SPEC §14.3) the way shopConfigRows generates the
 * offerings' rows: adding a row adds its Settings rows.
 */
export function consumableConfigRows(bundle) {
  const rows = [];
  for (const collection of ITEM_COLLECTIONS) {
    const list = Array.isArray(bundle?.[collection]) ? bundle[collection] : [];
    list.forEach((item, index) => {
      if (!object(item) || typeof item.id !== 'string') return;
      for (const [key, value] of Object.entries(item)) {
        if (typeof value !== 'number') continue;
        rows.push({
          cat: 'Advanced', advancedGroup: 'Shops', generatedShop: true,
          key: `gameConfig.${collection}.${item.id}.${key}`, type: 'number', def: value, ...domainFor(key, value),
          label: `${words(collection)} — ${item.name || words(item.id)}: ${words(key)}`,
          shopLabel: { id: 'settings.shops.row.offeringValue', tokens: { kind: words(collection), offering: item.name || words(item.id), value: words(key) }, names: { kind: collection } },
          shopTopic: collection,
          note: `${object(item[NOTE]) && typeof item[NOTE][key] === 'string' ? item[NOTE][key] : ''} ${NEW_RUN_CLAUSE}`,
          configPath: [collection, index, key], searchPath: `shops ${collection} ${item.id} ${key}`,
        });
      }
    });
  }
  return rows;
}

/**
 * consumableSettingsProblems(bundle, read) → the refusals Settings names for
 * the item rows: a sale value above the price (a round trip would profit).
 * Each sets aside only that item's two rows.
 */
export function consumableSettingsProblems(bundle, read) {
  const problems = [];
  (Array.isArray(bundle?.consumables) ? bundle.consumables : []).forEach((def) => {
    if (!object(def)) return;
    const costKey = `gameConfig.consumables.${def.id}.cost`;
    const sellKey = `gameConfig.consumables.${def.id}.sellValue`;
    const cost = Number(read(costKey, def.cost));
    const sellValue = Number(read(sellKey, def.sellValue));
    if (sellValue > cost) {
      problems.push({ kind: 'consumables', keys: [costKey, sellKey], aside: [costKey, sellKey], id: 'settings.shops.refuse.sellValue', tokens: { name: def.name, sellValue, cost } });
    }
  });
  return problems;
}

/** A deep copy of an item collection that keeps each [NOTE] (structuredClone drops a Symbol key). */
export function cloneItems(rows) {
  return (rows || []).map((row) => {
    if (!object(row)) return row;
    const out = structuredClone(Object.fromEntries(Object.entries(row)));
    if (object(row[NOTE])) out[NOTE] = { ...row[NOTE] };
    return out;
  });
}
