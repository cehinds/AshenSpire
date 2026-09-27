// src/model/marketStock.js — the market additions' saved shapes (SPEC §14.3),
// headless and import-free.
//
// A LEAF ON PURPOSE. state.js (validateRunShape) and shopKinds.js
// (shopStockProblems) both read these checks, and the purchases beside them
// (model/marketAdditions.js) need loadout.js, which sits above state.js in the
// import graph. Keeping the shapes here, with no imports at all, is what keeps
// that graph acyclic.

/** The market offerings §14.3 adds beyond today's shelves, in the order content/shops.js writes them. */
export const MARKET_ADDITIONS = Object.freeze(['armour', 'smithStones', 'sigils', 'innRest']);

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const count = (value) => Number.isSafeInteger(value) && value >= 0;
function itemList(list, path, problems) {
  if (!Array.isArray(list)) { problems.push(`${path} must be a list of { id, cost }`); return; }
  list.forEach((item, index) => {
    if (!object(item) || typeof item.id !== 'string' || !item.id || !(Number.isSafeInteger(item.cost) && item.cost > 0)) {
      problems.push(`${path}[${index}] must be { id, cost } with a non-empty id and a whole cost above 0`);
    }
  });
}

/** The addition shelves a persisted stock carries, refused by name (shopStockProblems reads it). */
export function marketAdditionStockProblems(stock, path = 'shopStock') {
  const problems = [];
  if (stock.smithStones !== undefined) {
    const shelf = stock.smithStones;
    if (!object(shelf) || !count(shelf.price) || !count(shelf.left)) problems.push(`${path}.smithStones must be { price, left }, both whole numbers of at least 0`);
  }
  if (stock.armour !== undefined) {
    itemList(stock.armour, `${path}.armour`, problems);
    // An armour offer names its class (SPEC §14.3): ids repeat across classes.
    if (Array.isArray(stock.armour)) stock.armour.forEach((item, index) => {
      if (object(item) && !(typeof item.classId === 'string' && item.classId)) problems.push(`${path}.armour[${index}] must carry the classId it was stocked for, a non-empty string`);
    });
  }
  if (stock.sigils !== undefined) itemList(stock.sigils, `${path}.sigils`, problems);
  if (stock.innRest !== undefined) {
    const offer = stock.innRest;
    if (!object(offer) || !count(offer.price) || typeof offer.bought !== 'boolean') problems.push(`${path}.innRest must be { price, bought } with a whole price and a true/false bought`);
  }
  return problems;
}

/** The bought-armour record's shape, refused by name (validateRunShape). Absent means none bought. */
export function boughtArmourProblems(loadout) {
  if (!loadout || loadout.boughtArmour === undefined) return [];
  const list = loadout.boughtArmour;
  if (!Array.isArray(list)) return ['loadout.boughtArmour must be a list of { classId, id }'];
  const problems = [];
  list.forEach((row, index) => {
    if (!object(row) || typeof row.classId !== 'string' || !row.classId || typeof row.id !== 'string' || !row.id) {
      problems.push(`loadout.boughtArmour[${index}] must be { classId, id } with both non-empty strings`);
    }
  });
  return problems;
}

/**
 * The market additions' content rules beyond the generic offering checks
 * (validateContent): an armour cost range runs from its min to its max.
 */
export function marketAdditionTableProblems(table, err) {
  const offerings = table?.market?.offerings;
  if (!Array.isArray(offerings)) return;
  const row = (id) => offerings.find((offering) => offering && offering.id === id);
  // Every count and price an addition writes into a saved stock is a whole
  // number, so no generated stock can fail its own saved-shape check
  // (Codex, on #1374): counts from 0, prices from 1.
  const whole = (id, path, floor) => {
    const offering = row(id);
    if (!offering) return;
    const value = path.split('.').reduce((at, key) => (at == null ? at : at[key]), offering);
    if (value !== undefined && !(Number.isSafeInteger(value) && value >= floor)) {
      err(`shops.market.${id}.${path}`, `must be a whole number of at least ${floor}, got ${JSON.stringify(value)}`);
    }
  };
  whole('smithStones', 'perVisit', 0);
  whole('armour', 'stock', 0);
  whole('sigils', 'stock', 0);
  whole('smithStones', 'price', 1);
  whole('innRest', 'price', 1);
  whole('armour', 'cost.min', 1);
  whole('armour', 'cost.max', 1);
  whole('sigils', 'pricePct', 1);
  // (A non-boolean `armour.includeLocked` is refused by the generic leaf check,
  // model/shopKinds.js nonNumericLeaves.)
  const armour = row('armour');
  const range = armour && armour.cost;
  if (range && Number.isFinite(range.min) && Number.isFinite(range.max) && range.min > range.max) {
    err('shops.market.armour.cost', `min (${range.min}) must not be above max (${range.max})`);
  }
}

/**
 * applyShopPriceMult(stock, mult) — a custom run's shop price multiplier
 * (Greedy Merchants, Hoarder: main.js shopPriceMult) applied to a classic
 * merchant's stock in place: the cards, relics and flasks, the Remove price,
 * and every market addition's price (armour and sigil items, the price of one
 * stone and of the rest), each rounded up. A multiplier of 1 changes nothing,
 * and a shelf the visit did not lay out stays absent.
 */
export function applyShopPriceMult(stock, mult) {
  if (!stock || mult === 1) return stock;
  const up = (n) => Math.ceil(n * mult);
  for (const kind of ['cards', 'relics', 'flasks', 'armour', 'sigils']) {
    if (Array.isArray(stock[kind])) for (const item of stock[kind]) item.cost = up(item.cost);
  }
  if (Number.isFinite(stock.removeCost)) stock.removeCost = up(stock.removeCost);
  if (stock.smithStones) stock.smithStones.price = up(stock.smithStones.price);
  if (stock.innRest) stock.innRest.price = up(stock.innRest.price);
  return stock;
}
