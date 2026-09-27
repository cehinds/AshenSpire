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
import { marketAdditionStockProblems } from './marketStock.js';

/** The kinds a shop can be (SPEC §14.2) — a closed set; a new kind is a spec change. */
export const SHOP_KINDS = Object.freeze(['market', 'blacksmith', 'master']);

/**
 * The kinds whose screen has shipped. Only these may carry a non-zero
 * `kindWeights` entry, and only these get a weight row in Settings. §14.6
 * step 6 adds `blacksmith` here with its screen, and step 7 adds `master`.
 */
export const SHOP_KIND_SCREENS = Object.freeze(['market']);

/**
 * The market's shelves as the stock has always held them (engine/encounters.js
 * buildShopStock): each is an offering id AND the stock key of its shelf.
 */
export const MARKET_SHELVES = Object.freeze(['cards', 'relics', 'flasks', 'armaments', 'weaponArts']);

/** Today's market offerings — the shelves plus the Remove service. A pre-§14 stock offered all of them. */
export const LEGACY_MARKET_OFFERINGS = Object.freeze([...MARKET_SHELVES, 'remove']);

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
    if (!(Array.isArray(stock.offerings) && stock.offerings.length && stock.offerings.every((id) => typeof id === 'string' && id))) {
      problems.push(`${path}.offerings must be a non-empty list of offering ids`);
    } else {
      const kind = shopStockKind(stock);
      const known = new Set([...(shippedShops[kind]?.offerings || []).map((row) => row.id), ...(kind === 'market' ? LEGACY_MARKET_OFFERINGS : [])]);
      for (const id of stock.offerings) if (!known.has(id)) problems.push(`${path}.offerings names '${id}', which is not a ${kind} offering`);
    }
  }
  // The market additions' shelves (SPEC §14.3), each shape-checked by name.
  problems.push(...marketAdditionStockProblems(stock, path));
  return problems;
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
    } else if (object(child)) nonNumericLeaves(child, `${path}.${key}`, err);
    else err(`${path}.${key}`, `must be a number (or an object of numbers), got ${JSON.stringify(child)}`);
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
    if (typeof child === 'number' && typeof noteFor(value, key) !== 'string') err(`${path}.${key}`, 'is a number with no [NOTE] beside it: write the sentence its Settings row shows');
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
export function shopsTableProblems(table, err) {
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
  for (const key of Object.keys(table)) if (key !== 'kindWeights' && !SHOP_KINDS.includes(key)) at(key, `is not a shop kind (kinds: ${SHOP_KINDS.join(', ')})`);

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
      nonNumericLeaves(without(row, ['id', ...ROLL_KEYS]), where, at);
      unnoted(without(row, ['id']), where, at);
    });
    const enabled = offerings.filter((row) => object(row) && row.enabled === true);
    if (Number.isInteger(minimum) && minimum >= SHOP_MINIMUM_FLOOR && enabled.length < minimum) {
      const off = offerings.filter((row) => object(row) && row.enabled !== true).map((row) => `'${row.id}'`);
      at(kind, `disabling ${off.join(', ')} leaves ${enabled.length} enabled offering${enabled.length === 1 ? '' : 's'}, fewer than its guaranteedMinimum of ${minimum}`);
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
});
function shopDomain(path, value) {
  if (SHOP_DOMAINS[path]) return { ...numberDomain(value), ...SHOP_DOMAINS[path] };
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
      numberRows(without(offering, ['id', ...ROLL_KEYS]), [kind, offering.id], at, kind, offering.id, rows);
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
    }
  }
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
  return [...new Set(shopSettingsProblems(bundle, settings).map((problem) => `${PREFIX}${problem.kind}.`))];
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
