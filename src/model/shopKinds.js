// src/model/shopKinds.js — the shop-kind framework's rules (SPEC §14.2), headless.
//
// The kinds and their offerings are data (content/shops.js). This file owns
// the four things every reader of that data must agree on:
//
//   · what a well-formed table is (`shopsTableProblems`, read by validateContent),
//   · the Settings rows generated from it (`shopConfigRows`, read by
//     model/advancedConfig.js beside the balance rows, so each is a
//     `gameConfig.*` key frozen into `run.advancedConfigSnapshot`),
//   · the refusals Settings shows by name (`shopSettingsProblems`),
//   · how a persisted stock names its kind and offerings, including a stock
//     saved before kinds existed (`shopStockKind`, `shopStockOfferings`,
//     `bringShopStockForward` at the migration door).
//
// The roll itself is engine/shopKinds.js.
import { NOTE } from '../content/balance.js';
import { shops as shippedShops } from '../content/shops.js';
import { uiStrings } from '../content/generated/uiStrings.js';
import { NEW_RUN_CLAUSE } from './balanceNotes.js';
import { marketAdditionStockProblems, blacksmithStockProblems, MARKET_ADDITIONS } from './marketStock.js';
import { utilityFlaskIds } from './gracerefill.js';
import { consumableSettingsProblems } from './consumables.js';
import { skillTracks } from './skills.js';

/** The kinds a shop can be (SPEC §14.2) — a closed set; a new kind is a spec change. */
export const SHOP_KINDS = Object.freeze(['market', 'blacksmith', 'master']);

/**
 * The kinds whose screen has shipped. Only these may carry a non-zero
 * `kindWeights` entry, and only these get a weight row in Settings. §14.6
 * step 6 added `blacksmith` with its screen (ui/screens/blacksmith.js); step 7
 * added `master` with its own (ui/screens/master.js).
 */
export const SHOP_KIND_SCREENS = Object.freeze(['market', 'blacksmith', 'master']);

/**
 * The market's shelves as the stock has always held them (engine/encounters.js
 * buildShopStock): each is an offering id AND the stock key of its shelf.
 */
export const MARKET_SHELVES = Object.freeze(['cards', 'relics', 'flasks', 'armaments', 'weaponArts']);

/** Today's market offerings — the shelves plus the Remove service. A pre-§14 stock offered all of them. */
export const LEGACY_MARKET_OFFERINGS = Object.freeze([...MARKET_SHELVES, 'remove']);

/**
 * THE CONDITIONAL OFFERINGS (SPEC §14.2, coordinator ruling on #1375). Each
 * offering authors a boolean `conditional` in content/shops.js: true when its
 * pool can be empty on a visit (every relic held, every armament carried, …),
 * so stock generation omits it and the guarantee fills from the others. None
 * of them counts toward the enablement minimum: a kind must keep at least
 * `guaranteedMinimum` enabled offerings that are not conditional, so the
 * guarantee can always be met. Read off the flag, never off a list of ids.
 */
export const isConditionalOffering = (row) => !!row && row.conditional === true;
// Authored per offering, never a Settings row (and so never overridden).
const AUTHORED_KEYS = Object.freeze(['conditional', 'stockKey']);
// A NON-CONDITIONAL OFFERING COUNTS ONLY WHILE ITS STOCK IS AT LEAST 1 (SPEC
// §14.2, coordinator ruling on #1375). `stockKey` names the bundle path of
// its per-visit count (`balance.shop.cardStock`); a service names none and
// always counts. `valueAt` resolves the path, through a Settings override
// when one is given.
// A path may also name an offering's own number as
// `shops.<kind>.<offeringId>.<key>` (SPEC §14.4): the offering is found by its
// id in that kind's list, so the path reads like its Settings key.
function resolvePath(root, path) {
  const parts = String(path).split('.');
  if (parts[0] === 'shops' && parts.length >= 4 && parts[2] !== 'offerings') {
    const list = root?.shops?.[parts[1]]?.offerings;
    if (Array.isArray(list)) {
      const row = list.find((offering) => offering && offering.id === parts[2]);
      return parts.slice(3).reduce((at, key) => (at == null ? undefined : at[key]), row);
    }
  }
  return parts.reduce((at, key) => (at == null ? undefined : at[key]), root);
}
// A NON-CONDITIONAL OFFERING ALSO NEEDS A NON-EMPTY AUTHORED POOL (SPEC
// §14.2): content that could never stock it is refused by name. Each reader
// returns why the pool is empty, or null. Read off the raw bundle, before any
// registry exists.
const SHOP_RARITIES = Object.freeze(['common', 'uncommon', 'rare']);
const AUTHORED_POOLS = Object.freeze({
  market: Object.freeze({
    // Utility flasks: every flask that is not a charge vessel (utilityFlaskIds).
    flasks(bundle) {
      const defs = Array.isArray(bundle.flasks) ? bundle.flasks : [];
      let ids;
      try {
        ids = utilityFlaskIds({ flasks: { ids: () => defs.map((def) => def && def.id), all: () => defs } });
      } catch { return null; } // a missing charge vessel is refused by its own check
      return ids.length ? null : 'no utility flask is authored (every flask is a charge vessel)';
    },
    // Cards: each class's shop pool, its card pool plus the colourless shop
    // cards — never a mountable weapon art, which rollShopCards leaves out for
    // the art shelf (engine/encounters.js; 5a re-review).
    cards(bundle) {
      const cards = Array.isArray(bundle.cards) ? bundle.cards : [];
      const known = new Set(cards.map((card) => card && card.id));
      const arts = authoredWeaponArtIds(bundle);
      const colourless = cards.filter((card) => card && card.class === 'colorless' && SHOP_RARITIES.includes(card.rarity) && !arts.has(card.id)).length;
      const empty = (Array.isArray(bundle.classes) ? bundle.classes : [])
        .filter((row) => row && !colourless && !(row.cardPool || []).some((id) => known.has(id)))
        .map((row) => `'${row.id}'`);
      return empty.length ? `the shop card pool of ${empty.join(', ')} is empty (no class card and no colourless shop card)` : null;
    },
  }),
  // THE MASTER'S TWO SURE OFFERINGS (SPEC §14.5): training and appraisal act
  // on the visiting master's own tracks, so their pool is the masters list.
  master: Object.freeze({
    training: (bundle) => (mastersOf(bundle).length ? null : 'shops.masters lists no master, so there is no track to train'),
    appraisal: (bundle) => (mastersOf(bundle).length ? null : 'shops.masters lists no master, so there is no track to show'),
  }),
});
const mastersOf = (bundle) => (Array.isArray(bundle?.shops?.masters) ? bundle.shops.masters : []);

// The mountable weapon arts, read off the raw bundle the way
// model/armamentTrading.js eligibleWeaponArts reads the registries: every
// armament's weaponArtDefaults whose card carries the extractable tag (a
// card's tags are its tagging.csv rows, or its own `tags` on a stamped copy).
function authoredWeaponArtIds(bundle) {
  const tag = bundle.balance?.equipment?.cardMounts?.extractableTag || 'extractable';
  const armaments = Array.isArray(bundle.equipment?.armaments) ? bundle.equipment.armaments : [];
  const tagged = new Set((Array.isArray(bundle.tagging) ? bundle.tagging : []).filter((row) => row && row.family === 'card' && row.tagId === tag).map((row) => row.objectId));
  const cards = new Map((Array.isArray(bundle.cards) ? bundle.cards : []).filter(Boolean).map((card) => [card.id, card]));
  const ids = new Set(armaments.flatMap((piece) => piece?.weaponCardPackage?.weaponArtDefaults || []));
  return new Set([...ids].filter((id) => tagged.has(id) || (cards.get(id)?.tags || []).includes(tag)));
}

function countsTowardMinimum(row, valueAt) {
  if (!row || row.enabled === false || isConditionalOffering(row)) return false;
  if (row.stockKey === undefined) return true;
  const stock = Number(valueAt(row.stockKey));
  return Number.isFinite(stock) && stock >= 1;
}

// The three keys every offering rolls by; any other number an offering carries
// is its own stock or price.
const ROLL_KEYS = Object.freeze(['enabled', 'chance', 'weight']);
const KIND_KEYS = Object.freeze(['guaranteedMinimum', 'offerings']);
export const SHOP_MINIMUM_FLOOR = 2;
const PREFIX = 'gameConfig.shops.';

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
// A shallow copy of `value` without `keys`, keeping its [NOTE].
function without(value, keys) {
  const out = Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
  if (value[NOTE]) out[NOTE] = value[NOTE];
  return out;
}
const noteFor = (holder, key) => (object(holder?.[NOTE]) && Object.hasOwn(holder[NOTE], key) ? holder[NOTE][key] : undefined);

// ---------------------------------------------------------------------------
// Reading a persisted stock
// ---------------------------------------------------------------------------

// The shelves a persisted stock still holds something on: a non-empty
// shelf list, or any market addition's stock at all.
function stockedShelves(stock) {
  return [
    ...MARKET_SHELVES.filter((key) => Array.isArray(stock[key]) && stock[key].length),
    ...MARKET_ADDITIONS.filter((key) => stock[key] !== undefined && !(Array.isArray(stock[key]) && !stock[key].length)),
  ];
}

/** The kind a persisted stock is. A stock saved before kinds existed is a market. */
export function shopStockKind(stock) {
  return object(stock) && typeof stock.kind === 'string' ? stock.kind : 'market';
}

/** The offerings a persisted stock laid out. A pre-§14 stock laid out every shelf it has. */
export function shopStockOfferings(stock) {
  return object(stock) && Array.isArray(stock.offerings) ? stock.offerings : LEGACY_MARKET_OFFERINGS;
}

function stockForward(stock) {
  if (!object(stock)) return;
  // Each field is filled only where it is missing: a pre-14 stock has
  // neither, and a hand-edited one keeps whatever it does carry.
  if (stock.kind === undefined) stock.kind = 'market';
  if (stock.offerings === undefined) stock.offerings = [...LEGACY_MARKET_OFFERINGS];
}

/**
 * bringShopStockForward(run) — the migration door's fill for a pre-schema-14
 * save (SPEC §14.2): `run.shopStock` and every atlas shop point's persisted
 * stock without a kind become `market`, offering today's shelves. The shelves,
 * prices and smith roll are left exactly as saved, so nothing is rerolled and
 * nothing sold comes back.
 */
export function bringShopStockForward(run) {
  if (!object(run)) return run;
  stockForward(run.shopStock);
  const states = run.journey?.serviceStates;
  if (object(states)) for (const state of Object.values(states)) if (object(state)) stockForward(state.stock);
  return run;
}

/**
 * The shape of a persisted stock's kind fields, refused by name
 * (validateRunShape): a known kind, and a non-empty list of that kind's own
 * offering ids. The ids are read from content/shops.js, where every offering
 * a kind can have is written — Settings tunes an offering, never adds one — so
 * a save naming an offering its kind has not got is malformed, and is archived
 * and refused rather than opened onto a shop with no shelf to show (Codex, on
 * #1371).
 */
export function shopStockProblems(stock, path = 'shopStock', { required = false } = {}) {
  // Absent or null is no stock at all (between visits, or a point never
  // entered). Anything else must be an object: an array or a string would
  // reach the shop screen and crash it reading a shelf (Codex, on #1371).
  if (stock === undefined || stock === null) return [];
  if (!object(stock)) return [`${path} must be an object (a shop visit's stock), got ${Array.isArray(stock) ? 'an array' : JSON.stringify(stock)}`];
  const problems = [];
  // A schema-14 stock was written by a build that always writes both fields;
  // only an older save gets the market fallback, at the migration door. A
  // current save missing one would otherwise reopen every legacy shelf — a
  // Remove the visit never offered, say (Codex, on #1371).
  if (required) {
    if (stock.kind === undefined) problems.push(`${path}.kind is missing (a schema-14 stock names its kind)`);
    if (stock.offerings === undefined) problems.push(`${path}.offerings is missing (a schema-14 stock lists what its visit laid out)`);
  }
  // A kind whose screen has not shipped cannot be resumed: the market screen
  // cannot show its offerings, so such a save is refused, not opened empty
  // (Codex, on #1371). §14.6 steps 6 and 7 widen SHOP_KIND_SCREENS with theirs.
  if (stock.kind !== undefined && !SHOP_KIND_SCREENS.includes(stock.kind)) {
    problems.push(SHOP_KINDS.includes(stock.kind)
      ? `${path}.kind is '${stock.kind}', whose screen is not registered yet (open kinds: ${SHOP_KIND_SCREENS.join(', ')})`
      : `${path}.kind must be one of ${SHOP_KINDS.join(', ')}, got ${JSON.stringify(stock.kind)}`);
  }
  if (stock.offerings !== undefined) {
    // An empty list is a visit whose every shelf the load door pruned (an
    // unsold offer this build no longer knows, marketStock.js
    // pruneUnknownAdditionOffers): the screen then shows no shelf and Leave,
    // rather than an empty rail item. A visit is never BUILT empty.
    if (!(Array.isArray(stock.offerings) && stock.offerings.every((id) => typeof id === 'string' && id))) {
      problems.push(`${path}.offerings must be a list of offering ids`);
    } else if (!stock.offerings.length && stockedShelves(stock).length) {
      // Empty only as the prune leaves it, with nothing on any shelf (review
      // of #1377): stock with no offering laying it out is a tampered save.
      problems.push(`${path}.offerings is empty, but ${stockedShelves(stock).map((key) => `'${key}'`).join(', ')} still hold${stockedShelves(stock).length === 1 ? 's' : ''} stock`);
    } else {
      const kind = shopStockKind(stock);
      const known = new Set([...(shippedShops[kind]?.offerings || []).map((row) => row.id), ...(kind === 'market' ? LEGACY_MARKET_OFFERINGS : [])]);
      for (const id of stock.offerings) if (!known.has(id)) problems.push(`${path}.offerings names '${id}', which is not a ${kind} offering`);
    }
  }
  // The market additions' shelves (SPEC §14.3), each shape-checked by name.
  problems.push(...marketAdditionStockProblems(stock, path));
  // The blacksmith's own shelf and every stock's trade revision (SPEC §14.4).
  problems.push(...blacksmithStockProblems(stock, path));
  // The master's (SPEC §14.5).
  if (stock.kind === 'master') problems.push(...masterStockProblems(stock, path));
  return problems;
}

/**
 * masterStockProblems(stock, path) → a `master` stock refused by name (SPEC
 * §14.5): `{ kind: 'master', masterId, offerings, tradeRevision?, skillBooks?,
 * weaponArts?, armaments?, training?, lessons? }`. The masterId must name a
 * row of the shipped `shops.masters` (the list is content, never a Settings
 * row, so the shipped table is the configured one); a shelf is `[{ id, cost }]`;
 * `training` is `{ left }`; each `lessons` entry is keyed by one of that
 * master's tracks and shaped `{ cardIds, taken }` with distinct card ids.
 */
export function masterStockProblems(stock, path = 'shopStock') {
  const problems = [];
  const master = (shippedShops.masters || []).find((row) => row && row.id === stock.masterId) || null;
  if (!master) problems.push(`${path}.masterId must name a master of shops.masters (${(shippedShops.masters || []).map((row) => row.id).join(', ')}), got ${JSON.stringify(stock.masterId)}`);
  for (const shelf of ['skillBooks', 'weaponArts', 'armaments']) {
    const list = stock[shelf];
    if (list === undefined) continue;
    if (!Array.isArray(list)) { problems.push(`${path}.${shelf} must be a list of { id, cost }`); continue; }
    list.forEach((item, index) => {
      if (!object(item) || typeof item.id !== 'string' || !item.id || !(Number.isSafeInteger(item.cost) && item.cost > 0)) {
        problems.push(`${path}.${shelf}[${index}] must be { id, cost } with a non-empty id and a whole cost above 0`);
      }
    });
  }
  if (stock.training !== undefined && !(object(stock.training) && Object.keys(stock.training).join() === 'left' && Number.isSafeInteger(stock.training.left) && stock.training.left >= 0)) {
    problems.push(`${path}.training must be { left } with a whole left of at least 0, got ${JSON.stringify(stock.training)}`);
  }
  if (stock.lessons !== undefined) {
    if (!object(stock.lessons)) problems.push(`${path}.lessons must be an object keyed by the master's tracks`);
    else for (const [skillId, entry] of Object.entries(stock.lessons)) {
      if (master && !master.skills.includes(skillId)) problems.push(`${path}.lessons.${skillId} is not a track ${master.id} teaches (${master.skills.join(', ')})`);
      const ids = object(entry) ? entry.cardIds : undefined;
      if (!object(entry) || !Array.isArray(ids) || !ids.every((id) => typeof id === 'string' && id) || new Set(ids).size !== ids.length || typeof entry.taken !== 'boolean' || Object.keys(entry).some((key) => key !== 'cardIds' && key !== 'taken')) {
        problems.push(`${path}.lessons.${skillId} must be { cardIds, taken }: a list of distinct card ids and a true/false taken`);
      }
    }
  }
  return problems;
}

// The master's tracks can be weapon, focus or dual-wield tracks only (SPEC
// §14.5): an armour track has no item type or schools, and a `class:`
// respec would strand the class tree's picks.
const MASTER_TRACK_KINDS = Object.freeze(['weapon', 'focus', 'dual']);

/**
 * masterTableProblems(table, err, bundle) — the master's numbers and the
 * masters list, refused by name in validateContent (SPEC §14.5): every number
 * whole; the prices `training.cinders`, `lesson.cinders` and
 * `respec.cost.base` and the session's `training.xp` from 1; the counts from
 * 0; `respecRefundPct` only refused when not whole (every reader clamps it to
 * 50–75). The list is non-empty with unique ids; each master names a speaker
 * row and 3 or 4 distinct weapon, focus or dual-wield tracks.
 */
export function masterTableProblems(table, err, bundle = null) {
  if (!object(table)) return;
  const offerings = Array.isArray(table.master?.offerings) ? table.master.offerings : [];
  const valueAt = (id, path) => {
    const row = offerings.find((offering) => offering && offering.id === id);
    return row ? path.split('.').reduce((at, key) => (at == null ? at : at[key]), row) : undefined;
  };
  // Required when the offering is written (Copilot on #1438), not only
  // checked when present: a missing number would reach a quote as undefined.
  const whole = (id, path, floor) => {
    if (!offerings.some((offering) => offering && offering.id === id)) return;
    const value = valueAt(id, path);
    if (!(Number.isSafeInteger(value) && value >= floor)) err(`shops.master.${id}.${path}`, value === undefined ? `is missing: write a whole number of at least ${floor}` : `must be a whole number of at least ${floor}, got ${JSON.stringify(value)}`);
  };
  for (const [id, path] of [['skillBooks', 'stock'], ['weaponArts', 'stock'], ['armaments', 'stock'], ['training', 'training.perVisit'], ['respec', 'respec.cost.perLevel']]) whole(id, path, 0);
  for (const [id, path] of [['training', 'training.cinders'], ['training', 'training.xp'], ['lesson', 'cinders'], ['respec', 'respec.cost.base']]) whole(id, path, 1);
  const pct = table.master?.respecRefundPct;
  if (object(table.master) && !Number.isSafeInteger(pct)) err('shops.master.respecRefundPct', pct === undefined ? 'is missing: write a whole percentage (it is read between 50 and 75)' : `must be a whole percentage (it is read between 50 and 75), got ${JSON.stringify(pct)}`);

  const masters = table.masters;
  if (!Array.isArray(masters) || !masters.length) { err('shops.masters', 'must be a non-empty list of masters { id, name, speakerId, skills }'); return; }
  const tracks = bundle ? new Map(skillTracks(bundle).map((row) => [row.id, row.kind])) : null;
  const speakers = bundle && Array.isArray(bundle.speakers) ? new Set(bundle.speakers.map((row) => row && row.id)) : null;
  const seen = new Set();
  masters.forEach((row, index) => {
    if (!object(row) || typeof row.id !== 'string' || !row.id) { err(`shops.masters[${index}]`, 'must be a master { id, name, speakerId, skills }'); return; }
    const at = `shops.masters.${row.id}`;
    if (seen.has(row.id)) err(at, 'is listed twice: master ids are unique');
    seen.add(row.id);
    for (const key of Object.keys(row)) if (!['id', 'name', 'speakerId', 'skills'].includes(key)) err(`${at}.${key}`, 'is not a master field (fields: id, name, speakerId, skills)');
    if (typeof row.name !== 'string' || !row.name) err(`${at}.name`, 'must be a non-empty string');
    if (typeof row.speakerId !== 'string' || !row.speakerId) err(`${at}.speakerId`, 'must name a row of content/source/speakers.csv');
    else if (speakers && !speakers.has(row.speakerId)) err(`${at}.speakerId`, `names '${row.speakerId}', which is not a row of content/source/speakers.csv`);
    const skills = row.skills;
    if (!Array.isArray(skills) || skills.length < 3 || skills.length > 4) { err(`${at}.skills`, `must list 3 or 4 skill tracks, got ${Array.isArray(skills) ? skills.length : JSON.stringify(skills)}`); if (!Array.isArray(skills)) return; }
    const named = new Set();
    for (const skillId of skills) {
      if (named.has(skillId)) err(`${at}.skills`, `names '${skillId}' twice: a master's tracks are distinct`);
      named.add(skillId);
      if (!tracks) continue;
      const kind = tracks.get(skillId);
      if (!kind) err(`${at}.skills`, `names '${skillId}', which is not a skill track skillTracks derives`);
      else if (!MASTER_TRACK_KINDS.includes(kind)) err(`${at}.skills`, `names '${skillId}', a ${kind} track: a master teaches only weapon, focus and dual-wield tracks (SPEC §14.5)`);
    }
  });
}

// ---------------------------------------------------------------------------
// The content table
// ---------------------------------------------------------------------------

// Every leaf under `value` that is not a number, refused by its whole path: an
// offering (or a kind) carries numbers, or objects of numbers, and nothing
// else (Codex, on #1371).
function nonNumericLeaves(value, path, err) {
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'number') {
      if (!Number.isFinite(child)) err(`${path}.${key}`, `must be a finite number, got ${child}`);
    } else if (typeof child === 'boolean') continue; // a switch (SPEC §14.3 armour.includeLocked); it gets a bool row
    else if (object(child)) nonNumericLeaves(child, `${path}.${key}`, err);
    else err(`${path}.${key}`, `must be a number, true or false (or an object of those), got ${JSON.stringify(child)}`);
  }
}

// Whether any object in the table carries a [NOTE].
function carriesNotes(value) {
  if (Array.isArray(value)) return value.some(carriesNotes);
  if (!object(value)) return false;
  return object(value[NOTE]) || Object.values(value).some(carriesNotes);
}

// Every number under `value` that has no [NOTE] in the object holding it.
function unnotedNumbers(value, path, err) {
  if (!object(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if ((typeof child === 'number' || typeof child === 'boolean') && typeof noteFor(value, key) !== 'string') err(`${path}.${key}`, `is a ${typeof child === 'number' ? 'number' : 'switch'} with no [NOTE] beside it: write the sentence its Settings row shows`);
    else if (object(child)) unnotedNumbers(child, `${path}.${key}`, err);
  }
}

/**
 * shopsTableProblems(table, err) — content/shops.js refused by name (SPEC §14.2):
 * the three kinds each with a `guaranteedMinimum` of at least 2 and a list of
 * offerings (`id`, `enabled`, `chance` 0–100, `weight` ≥ 0), enough of them
 * enabled to meet the minimum, a `[NOTE]` beside every number, and
 * `kindWeights` that give a non-zero weight only to a kind whose screen is
 * registered.
 */
export function shopsTableProblems(table, err, bundle = null) {
  const at = (path, msg) => err(path ? `shops.${path}` : 'shops', msg);
  if (!object(table)) { at('', 'must be an object { kindWeights, market, blacksmith, master }'); return; }
  // THE SENTENCES ARE CHECKED ON A TABLE THAT CARRIES THEM. A [NOTE] is a
  // Symbol key, so a JSON or structuredClone copy of the bundle (tests and
  // tools make them) holds none at all, and refusing every number of such a
  // copy would refuse a copy, not the content. The authored file and the
  // configured bundle (cloneShops keeps them) always carry notes, so there a
  // single missing sentence is refused by name.
  const noted = carriesNotes(table);
  const unnoted = noted ? unnotedNumbers : () => {};
  // `masters` is not a kind (SPEC §14.5): who a master visit can be, checked
  // by masterTableProblems, with no Settings row.
  for (const key of Object.keys(table)) if (key !== 'kindWeights' && key !== 'masters' && !SHOP_KINDS.includes(key)) at(key, `is not a shop kind (kinds: ${SHOP_KINDS.join(', ')})`);

  const weights = table.kindWeights;
  if (!object(weights)) at('kindWeights', 'must be an object { market, blacksmith, master }');
  else {
    for (const key of Object.keys(weights)) if (!SHOP_KINDS.includes(key)) at(`kindWeights.${key}`, 'is not a shop kind');
    let rollable = 0;
    for (const kind of SHOP_KINDS) {
      const weight = weights[kind];
      if (!(Number.isInteger(weight) && weight >= 0)) { at(`kindWeights.${kind}`, `must be a whole number of at least 0, got ${JSON.stringify(weight)}`); continue; }
      if (noted && typeof noteFor(weights, kind) !== 'string') at(`kindWeights.${kind}`, 'is a number with no [NOTE] beside it: write the sentence its Settings row shows');
      if (weight > 0 && !SHOP_KIND_SCREENS.includes(kind)) at(`kindWeights.${kind}`, `must be 0 while the ${kind} screen is not registered (SPEC §14.6 unlocks it with its screen), got ${weight}`);
      else if (weight > 0) rollable += 1;
    }
    if (!rollable) at('kindWeights', `must give at least one kind with a registered screen (${SHOP_KIND_SCREENS.join(', ')}) a weight above 0`);
  }

  for (const kind of SHOP_KINDS) {
    const def = table[kind];
    if (!object(def)) { at(kind, 'must be an object { guaranteedMinimum, offerings }'); continue; }
    const minimum = def.guaranteedMinimum;
    if (!(Number.isInteger(minimum) && minimum >= SHOP_MINIMUM_FLOOR)) at(`${kind}.guaranteedMinimum`, `must be a whole number of at least ${SHOP_MINIMUM_FLOOR}, got ${JSON.stringify(minimum)}`);
    nonNumericLeaves(without(def, KIND_KEYS), kind, at);
    // Kind-level numbers (guaranteedMinimum, respecRefundPct, …) each need a sentence.
    unnoted(without(def, ['offerings']), kind, at);
    const offerings = def.offerings;
    if (!Array.isArray(offerings) || !offerings.length) { at(`${kind}.offerings`, 'must be a non-empty list of offerings'); continue; }
    const seen = new Set();
    offerings.forEach((row, index) => {
      if (!object(row) || typeof row.id !== 'string' || !row.id) { at(`${kind}.offerings[${index}]`, 'must be an offering { id, enabled, chance, weight }'); return; }
      const where = `${kind}.${row.id}`;
      if (seen.has(row.id)) at(where, 'is listed twice');
      seen.add(row.id);
      if (typeof row.enabled !== 'boolean') at(`${where}.enabled`, `must be true or false, got ${JSON.stringify(row.enabled)}`);
      if (!(Number.isInteger(row.chance) && row.chance >= 0 && row.chance <= 100)) at(`${where}.chance`, `must be a whole percent 0–100, got ${JSON.stringify(row.chance)}`);
      if (!(Number.isFinite(row.weight) && row.weight >= 0)) at(`${where}.weight`, `must be a number of at least 0, got ${JSON.stringify(row.weight)}`);
      if (typeof row.conditional !== 'boolean') at(`${where}.conditional`, `must be true or false (can its pool be empty on a visit? SPEC §14.2), got ${JSON.stringify(row.conditional)}`);
      if (row.stockKey !== undefined) {
        if (typeof row.stockKey !== 'string' || !row.stockKey) at(`${where}.stockKey`, `must name the bundle path of its per-visit stock, got ${JSON.stringify(row.stockKey)}`);
        else if (bundle && !Number.isFinite(resolvePath(bundle, row.stockKey))) at(`${where}.stockKey`, `names '${row.stockKey}', which is not a number in the content`);
      }
      nonNumericLeaves(without(row, ['id', ...ROLL_KEYS, ...AUTHORED_KEYS]), where, at);
      unnoted(without(row, ['id']), where, at);
    });
    const enabled = offerings.filter((row) => object(row) && row.enabled === true);
    if (Number.isInteger(minimum) && minimum >= SHOP_MINIMUM_FLOOR && enabled.length < minimum) {
      const off = offerings.filter((row) => object(row) && row.enabled !== true).map((row) => `'${row.id}'`);
      at(kind, `disabling ${off.join(', ')} leaves ${enabled.length} enabled offering${enabled.length === 1 ? '' : 's'}, fewer than its guaranteedMinimum of ${minimum}`);
    } else if (Number.isInteger(minimum) && minimum >= SHOP_MINIMUM_FLOOR && SHOP_KIND_SCREENS.includes(kind)) {
      // The non-conditional minimum binds a kind once its screen is registered
      // (SPEC §14.2): until then its classification is provisional, and steps
      // 6 and 7 must satisfy it when they register the blacksmith and master.
      const sure = enabled.filter((row) => !isConditionalOffering(row));
      const stocked = bundle ? sure.filter((row) => countsTowardMinimum(row, (path) => resolvePath(bundle, path))) : sure;
      if (sure.length < minimum) {
        const maybe = enabled.filter(isConditionalOffering).map((row) => `'${row.id}'`);
        at(kind, `keeps ${sure.length} enabled offering${sure.length === 1 ? '' : 's'} that can never come up empty, fewer than its guaranteedMinimum of ${minimum}; ${maybe.join(', ')} ${maybe.length === 1 ? 'is' : 'are'} conditional (an empty pool is not laid out) and do${maybe.length === 1 ? 'es' : ''} not count (SPEC §14.2)`);
      }
      if (bundle) for (const row of sure) {
        const why = AUTHORED_POOLS[kind]?.[row.id]?.(bundle);
        if (why) at(`${kind}.${row.id}`, `is not conditional, but its authored pool is empty: ${why} (SPEC §14.2)`);
      }
      if (sure.length >= minimum && stocked.length < minimum) {
        const empty = sure.filter((row) => !stocked.includes(row)).map((row) => `'${row.id}' (${row.stockKey})`);
        at(kind, `keeps ${stocked.length} enabled offering${stocked.length === 1 ? '' : 's'} with a stock of at least 1, fewer than its guaranteedMinimum of ${minimum}; the stock of ${empty.join(', ')} is 0, so it lays out nothing and does not count (SPEC §14.2)`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Settings → Advanced → Shops
// ---------------------------------------------------------------------------

// A generated row's domain, read off the shipped value the way the balance
// rows read theirs, and then narrowed where a rule knows better.
function numberDomain(value) {
  const integer = Number.isInteger(value);
  const magnitude = Math.max(1, Math.abs(value));
  return { integer, step: integer ? 1 : 0.01, min: 0, max: Math.max(integer ? 20 : 10, Math.ceil(magnitude * 10)) };
}
const PERCENT = Object.freeze({ integer: true, step: 1, min: 0, max: 100 });
// The BALANCE_DOMAINS of the Shops rows (model/advancedConfig.js keeps the
// balance ones): every percentage is 0–100, and the respec refund is clamped
// to 50–75 by SPEC §14.5.
const SHOP_DOMAINS = Object.freeze({
  'master.respecRefundPct': Object.freeze({ integer: true, step: 1, min: 50, max: 75 }),
  // The sigil markup may rise above 100 as well as discount (coordinator
  // ruling, #1374), bounded at 300.
  'market.sigils.pricePct': Object.freeze({ integer: true, step: 1, min: 1, max: 300 }),
  // The blacksmith's refining (SPEC §14.4, Codex on #1378): `value` divides an
  // upgrade's stone cost, and `from` is a count of stones consumed, so neither
  // may be 0.
  'blacksmith.refineStones.refine.value': Object.freeze({ integer: true, step: 1, min: 1 }),
  'blacksmith.refineStones.refine.from': Object.freeze({ integer: true, step: 1, min: 1 }),
  // The master's floors (SPEC §14.5): a session pays something, and every
  // respec costs at least its base. The other prices are `cinders` (PAID).
  'master.training.training.xp': Object.freeze({ integer: true, step: 1, min: 1 }),
  'master.respec.respec.cost.base': Object.freeze({ integer: true, step: 1, min: 1 }),
});
// A PAID OFFERING IS NEVER FREE (Codex, on #1374): a price in cinders — a
// `price`, a `cinders` cost, an armour cost bound — or the percent of its own
// cost a sigil sells at starts at 1. A 0 would either silently close the
// purchase or roll a free item the saved-stock check refuses on the next load.
// A price in Smithing Stones (`stones`: an art upgrade, a stacked copy) is a
// price too (SPEC §14.4).
const PAID = /(^|\.)(price|cinders|pricePct|stones)$|(^|\.)cost\.(min|max)$/;
function shopDomain(path, value) {
  if (SHOP_DOMAINS[path]) return { ...numberDomain(value), ...SHOP_DOMAINS[path] };
  if (PAID.test(path)) return { ...numberDomain(value), min: 1 };
  if (/(^|\.)chance$|Pct$/.test(path)) return { ...numberDomain(value), ...PERCENT };
  return numberDomain(value);
}

const row = (fields) => ({ cat: 'Advanced', advancedGroup: 'Shops', generatedShop: true, ...fields });
const words = (value) => String(value).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[._-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
const noted = (note) => `${note} ${NEW_RUN_CLAUSE}`;

// Rows for every number under `value`, recursively, each with the sentence
// written beside it.
function numberRows(value, keyPath, configPath, kind, offeringId, rows) {
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'number') {
      const path = [...keyPath, key].join('.');
      const leaf = [...keyPath.slice(offeringId ? 2 : 1), key].join('.');
      rows.push(row({
        key: `${PREFIX}${path}`, type: 'number', def: child, ...shopDomain(path, child),
        label: `${words(kind)} — ${offeringId ? `${words(offeringId)}: ` : ''}${words(leaf)}`,
        shopLabel: { id: offeringId ? 'settings.shops.row.offeringValue' : 'settings.shops.row.kindValue', tokens: { kind: words(kind), offering: words(offeringId || ''), value: words(leaf) }, names: { kind, offering: offeringId } },
        shopTopic: kind,
        note: noted(noteFor(value, key) || ''),
        configPath: [...configPath, key], searchPath: `shops ${path.replace(/\./g, ' ')}`,
      }));
    } else if (typeof child === 'boolean') {
      // A switch an offering carries (SPEC §14.3 `armour.includeLocked`): a
      // bool row, generated the same way.
      const path = [...keyPath, key].join('.');
      const leaf = [...keyPath.slice(offeringId ? 2 : 1), key].join('.');
      rows.push(row({
        key: `${PREFIX}${path}`, def: child,
        label: `${words(kind)} — ${offeringId ? `${words(offeringId)}: ` : ''}${words(leaf)}`,
        shopLabel: { id: offeringId ? 'settings.shops.row.offeringValue' : 'settings.shops.row.kindValue', tokens: { kind: words(kind), offering: words(offeringId || ''), value: words(leaf) }, names: { kind, offering: offeringId } },
        shopTopic: kind,
        note: noted(noteFor(value, key) || ''),
        configPath: [...configPath, key], searchPath: `shops ${path.replace(/\./g, ' ')}`,
      }));
    } else if (object(child)) numberRows(child, [...keyPath, key], [...configPath, key], kind, offeringId, rows);
  }
}

/**
 * shopConfigRows(bundle) → the Advanced → Shops rows, generated from the
 * bundle's shops table the way `advancedConfigRows` generates the balance
 * rows: so adding an offering to the data adds its rows.
 *
 *   gameConfig.shops.kindWeights.<kind>            (registered kinds only)
 *   gameConfig.shops.<kind>.guaranteedMinimum
 *   gameConfig.shops.<kind>.<key>                  (every other kind-level number)
 *   gameConfig.shops.<kind>.<offering>.enabled|chance|weight
 *   gameConfig.shops.<kind>.<offering>.<key…>      (every other number it carries)
 *
 * `configPath` addresses the offering by its index, so the key stays the
 * readable id and the value lands on the row the id names.
 */
export function shopConfigRows(bundle) {
  const table = bundle?.shops;
  if (!object(table)) return [];
  const rows = [];
  // While one kind alone can open, its weight is what makes a merchant open
  // at all: 0 would leave no rollable kind, which validateContent refuses and
  // which would cost every Advanced setting at the next run. So its row starts
  // at 1 (Codex, on #1371); with two or more kinds, any one may be 0.
  const weightFloor = SHOP_KIND_SCREENS.length === 1 ? 1 : 0;
  for (const kind of SHOP_KIND_SCREENS) {
    const weight = table.kindWeights?.[kind];
    if (!Number.isFinite(weight)) continue;
    rows.push(row({
      key: `${PREFIX}kindWeights.${kind}`, type: 'number', def: weight, integer: true, step: 1, min: weightFloor, max: Math.max(1000, weight * 10),
      label: `Merchant kind weight — ${words(kind)}`,
      shopLabel: { id: 'settings.shops.row.kindWeight', tokens: { kind: words(kind) }, names: { kind } },
      shopTopic: 'kindWeights',
      note: noted(noteFor(table.kindWeights, kind) || ''),
      configPath: ['shops', 'kindWeights', kind], searchPath: `shops merchant kind weight ${kind}`,
    }));
  }
  for (const kind of SHOP_KINDS) {
    const def = table[kind];
    if (!object(def) || !Array.isArray(def.offerings)) continue;
    rows.push(row({
      key: `${PREFIX}${kind}.guaranteedMinimum`, type: 'number', def: def.guaranteedMinimum,
      integer: true, step: 1, min: SHOP_MINIMUM_FLOOR, max: Math.max(SHOP_MINIMUM_FLOOR, def.offerings.length),
      label: `${words(kind)} — guaranteed minimum`,
      shopLabel: { id: 'settings.shops.row.minimum', tokens: { kind: words(kind) }, names: { kind } },
      shopTopic: kind,
      note: noted(noteFor(def, 'guaranteedMinimum') || ''),
      configPath: ['shops', kind, 'guaranteedMinimum'], searchPath: `shops ${kind} guaranteed minimum`,
    }));
    numberRows(without(def, KIND_KEYS), [kind], ['shops', kind], kind, null, rows);
    def.offerings.forEach((offering, index) => {
      if (!object(offering) || typeof offering.id !== 'string') return;
      const base = `${PREFIX}${kind}.${offering.id}`;
      const at = ['shops', kind, 'offerings', index];
      const label = (field) => ({ id: `settings.shops.row.${field}`, tokens: { kind: words(kind), offering: words(offering.id) }, names: { kind, offering: offering.id } });
      rows.push(row({
        key: `${base}.enabled`, def: offering.enabled === true,
        label: `${words(kind)} — ${words(offering.id)}: offered`, shopLabel: label('enabled'), shopTopic: kind,
        note: noted(noteFor(offering, 'enabled') || ''), configPath: [...at, 'enabled'], searchPath: `shops ${kind} ${offering.id} enabled`,
      }));
      rows.push(row({
        key: `${base}.chance`, type: 'number', def: offering.chance, ...PERCENT,
        label: `${words(kind)} — ${words(offering.id)}: chance`, shopLabel: label('chance'), shopTopic: kind, suffix: '%',
        gates: [{ key: `${base}.enabled` }],
        note: noted(noteFor(offering, 'chance') || ''), configPath: [...at, 'chance'], searchPath: `shops ${kind} ${offering.id} chance`,
      }));
      rows.push(row({
        key: `${base}.weight`, type: 'number', def: offering.weight, ...numberDomain(offering.weight), min: 0, max: Math.max(1000, offering.weight * 10),
        label: `${words(kind)} — ${words(offering.id)}: weight`, shopLabel: label('weight'), shopTopic: kind,
        gates: [{ key: `${base}.enabled` }],
        note: noted(noteFor(offering, 'weight') || ''), configPath: [...at, 'weight'], searchPath: `shops ${kind} ${offering.id} weight`,
      }));
      numberRows(without(offering, ['id', ...ROLL_KEYS, ...AUTHORED_KEYS]), [kind, offering.id], at, kind, offering.id, rows);
    });
  }
  return rows;
}

// The sentence a refusal's uiStrings row says, filled with its tokens. Read
// from the generated table (content), so the model's import and structural
// checks can say it without reaching up into the UI layer.
export function shopSentence(id, tokens = {}) {
  const text = uiStrings.find((row) => row.id === id)?.short;
  if (!text) throw new Error(`uiStrings: '${id}' has no short form`);
  return text.replace(/\{(\w+)\}/g, (_, key) => {
    if (!Object.hasOwn(tokens, key)) throw new Error(`uiStrings: '${id}.short' wants {${key}}`);
    return String(tokens[key]);
  });
}

/**
 * shopSettingsProblems(bundle, settings) → [{ keys, id, tokens, message }], the
 * refusals Settings shows by name (SPEC §14.2): a guaranteed minimum below 2,
 * and disabling offerings until fewer are enabled than the kind's minimum.
 * Each names its kind and addresses the rows that cause it; `id` is the
 * sentence's row in content/source/uiStrings.csv, and `message` that
 * sentence filled in. advancedConfigProblemRows carries them, so Settings, a
 * configuration import and a sync restore all refuse the same combinations.
 */
export function shopSettingsProblems(bundle, settings = {}) {
  const table = bundle?.shops;
  if (!object(table)) return [];
  const problems = [];
  const read = (key, fallback) => (Object.hasOwn(settings, key) ? settings[key] : fallback);
  // A stock key read through its own Settings row (`gameConfig.<path>`).
  const stockAt = (path) => read(`gameConfig.${path}`, resolvePath(bundle, path));
  // Some kind with a shipped screen must keep a weight above 0, or no merchant
  // can open (validateContent refuses it, and the run would fall back to the
  // authored content, dropping every Advanced setting).
  const weightKeys = SHOP_KIND_SCREENS.map((kind) => `${PREFIX}kindWeights.${kind}`);
  const weightOf = (kind) => Number(read(`${PREFIX}kindWeights.${kind}`, table.kindWeights?.[kind]));
  if (object(table.kindWeights) && !SHOP_KIND_SCREENS.some((kind) => weightOf(kind) > 0)) {
    problems.push({ kind: 'kindWeights', keys: weightKeys, id: 'settings.shops.refuse.noKind', tokens: { kinds: SHOP_KIND_SCREENS.map(words).join(', ') } });
  }
  for (const kind of SHOP_KINDS) {
    const def = table[kind];
    if (!object(def) || !Array.isArray(def.offerings)) continue;
    const minimumKey = `${PREFIX}${kind}.guaranteedMinimum`;
    const minimum = Number(read(minimumKey, def.guaranteedMinimum));
    if (!(Number.isInteger(minimum) && minimum >= SHOP_MINIMUM_FLOOR)) {
      problems.push({ kind, keys: [minimumKey], id: 'settings.shops.refuse.minimum', tokens: { kind: words(kind), value: read(minimumKey, def.guaranteedMinimum), floor: SHOP_MINIMUM_FLOOR } });
      continue;
    }
    const enabledKey = (offering) => `${PREFIX}${kind}.${offering.id}.enabled`;
    const isOn = (offering) => read(enabledKey(offering), offering.enabled) === true;
    const on = def.offerings.filter(isOn);
    if (on.length < minimum) {
      const off = def.offerings.filter((offering) => !isOn(offering));
      problems.push({
        kind,
        keys: [minimumKey, ...off.map(enabledKey)],
        id: 'settings.shops.refuse.disabled',
        tokens: { kind: words(kind), offerings: off.map((offering) => words(offering.id)).join(', '), enabled: on.length, minimum },
      });
    } else if (SHOP_KIND_SCREENS.includes(kind)) {
      // Only an offering that can never come up empty counts toward the
      // minimum (SPEC §14.2), once the kind's screen is registered: a conditional one's pool may be empty on a
      // visit, and then nothing is left to fill the guarantee from.
      const sure = on.filter((offering) => !isConditionalOffering(offering));
      if (sure.length < minimum) {
        const maybe = on.filter(isConditionalOffering);
        const off = def.offerings.filter((offering) => !isOn(offering) && !isConditionalOffering(offering));
        problems.push({
          kind,
          keys: [minimumKey, ...maybe.map(enabledKey), ...off.map(enabledKey)],
          id: 'settings.shops.refuse.conditional',
          tokens: { kind: words(kind), conditional: maybe.map((offering) => words(offering.id)).join(', '), enabled: sure.length, minimum },
        });
      } else {
        // And one of those counts only while its named stock is at least 1
        // (coordinator ruling, #1375): a cards stock of 0 lays out nothing.
        const stocked = sure.filter((offering) => countsTowardMinimum({ ...offering, enabled: true }, stockAt));
        if (stocked.length < minimum) {
          const empty = sure.filter((offering) => !stocked.includes(offering));
          const stockKeys = empty.map((offering) => `gameConfig.${offering.stockKey}`);
          problems.push({
            kind,
            keys: [minimumKey, ...stockKeys],
            aside: stockKeys,
            id: 'settings.shops.refuse.emptyStock',
            tokens: { kind: words(kind), stocks: empty.map((offering) => words(offering.id)).join(', '), enabled: stocked.length, minimum },
          });
        }
      }
    }
    // A cost range runs from its min to its max (SPEC §14.3, the market's
    // armour): refused here by name, so it costs only this kind, not the whole
    // configuration at validateContent (review, #1374).
    def.offerings.forEach((offering) => {
      const cost = offering && offering.cost;
      if (!object(cost) || !Number.isFinite(cost.min) || !Number.isFinite(cost.max)) return;
      const minKey = `${PREFIX}${kind}.${offering.id}.cost.min`;
      const maxKey = `${PREFIX}${kind}.${offering.id}.cost.max`;
      const lo = Number(read(minKey, cost.min));
      const hi = Number(read(maxKey, cost.max));
      if (lo > hi) {
        problems.push({ kind, keys: [minKey, maxKey], id: 'settings.shops.refuse.armourCost', tokens: { kind: words(kind), offering: words(offering.id), min: lo, max: hi } });
      }
    });
  }
  // A piece's base sigil slots are counted in its most (SPEC §14.4): a base
  // above max is refused by name, costing only the blacksmith's rows.
  const slots = (table.blacksmith?.offerings || []).find((offering) => offering && offering.id === 'sigilSlots')?.sigilSlots;
  if (object(slots) && Number.isFinite(slots.base) && Number.isFinite(slots.max)) {
    const baseKey = `${PREFIX}blacksmith.sigilSlots.sigilSlots.base`;
    const maxKey = `${PREFIX}blacksmith.sigilSlots.sigilSlots.max`;
    const base = Number(read(baseKey, slots.base));
    const max = Number(read(maxKey, slots.max));
    if (base > max) problems.push({ kind: 'blacksmith', keys: [baseKey, maxKey], id: 'settings.shops.refuse.sigilSlotBase', tokens: { base, max } });
  }
  // The consumables' own rows (SPEC §14.3): a sale above the price.
  problems.push(...consumableSettingsProblems(bundle, read));
  return problems.map((problem) => ({ ...problem, message: shopSentence(problem.id, problem.tokens) }));
}

/**
 * shopOverridesSetAside(bundle, settings) → the `gameConfig.shops.` key
 * prefixes whose stored values are NOT applied, because together they break a
 * rule `shopSettingsProblems` names. ONE BAD KIND COSTS THAT KIND: the kind
 * (or the merchant-kind weights) keeps its authored values until the rows are
 * fixed, and every other Advanced setting still applies — the pattern
 * `configuredContentBundle` already follows for one bad class.
 */
export function shopOverridesSetAside(bundle, settings = {}) {
  // A problem may also name rows outside the shops group that break it (a
  // `balance.shop` stock at 0): those are set aside with the kind.
  return [...new Set(shopSettingsProblems(bundle, settings).flatMap((problem) => [`${PREFIX}${problem.kind}.`, ...(problem.aside || [])]))];
}

/** A deep copy of a shops table that keeps each [NOTE] (structuredClone drops a Symbol key). */
export function cloneShops(value) {
  if (Array.isArray(value)) return value.map(cloneShops);
  if (!object(value)) return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) out[key] = cloneShops(child);
  if (object(value[NOTE])) out[NOTE] = { ...value[NOTE] };
  return out;
}
