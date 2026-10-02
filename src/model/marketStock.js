// src/model/marketStock.js — the market additions' saved shapes (SPEC §14.3),
// headless and import-free.
//
// A LEAF ON PURPOSE. state.js (validateRunShape) and shopKinds.js
// (shopStockProblems) both read these checks, and the purchases beside them
// (model/marketAdditions.js) need loadout.js, which sits above state.js in the
// import graph. Keeping the shapes here, with no imports at all, is what keeps
// that graph acyclic.

/** The market offerings §14.3 adds beyond today's shelves, in the order content/shops.js writes them. */
export const MARKET_ADDITIONS = Object.freeze(['armour', 'smithStones', 'sigils', 'innRest', 'skillBooks', 'reviveTokens', 'questEvent', 'companions']);

/** The 5b shelves that hold a list of `{ id, cost }` offers (SPEC §14.3). */
export const ITEM_LIST_SHELVES = Object.freeze(['skillBooks', 'reviveTokens', 'companions']);

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
  // SPEC §14.3 (5b): the consumable and companion shelves are lists of
  // { id, cost }; the quest event is { eventId, price, taken }.
  for (const shelf of ITEM_LIST_SHELVES) if (stock[shelf] !== undefined) itemList(stock[shelf], `${path}.${shelf}`, problems);
  if (stock.questEvent !== undefined) {
    const offer = stock.questEvent;
    if (!object(offer) || typeof offer.eventId !== 'string' || !offer.eventId || !(Number.isSafeInteger(offer.price) && offer.price > 0) || typeof offer.taken !== 'boolean') {
      problems.push(`${path}.questEvent must be { eventId, price, taken } with a non-empty eventId, a whole price above 0 and a true/false taken`);
    }
  }
  return problems;
}

/**
 * blacksmithStockProblems(stock, path) → the blacksmith's own shelf and every
 * stock's trade revision, refused by name (SPEC §14.4). A blacksmith stock is
 * `{ kind: 'blacksmith', offerings, tradeRevision?, armaments?, smithStones? }`;
 * `smithStones` is the market's shape (marketAdditionStockProblems), and its
 * services keep no stock at all.
 */
export function blacksmithStockProblems(stock, path = 'shopStock') {
  const problems = [];
  if (stock.tradeRevision !== undefined && !count(stock.tradeRevision)) problems.push(`${path}.tradeRevision must be a whole number of at least 0, got ${JSON.stringify(stock.tradeRevision)}`);
  if (stock.kind === 'blacksmith' && stock.armaments !== undefined) itemList(stock.armaments, `${path}.armaments`, problems);
  return problems;
}

/**
 * pruneUnknownAdditionOffers(stock, { sigilKnown, armourKnown }) → the offers
 * removed. AN UNSOLD OFFER IS NOT A POSSESSION (Codex, on #1374; coordinator
 * ruling): when a content update drops a sigil or an armour set, an offer for
 * it on a saved shelf is pruned at the load door, never rerolled, and the run
 * is not archived — archiving stays for what the run owns. A shelf the prune
 * empties is no longer laid out (its id leaves `stock.offerings`, unless it is
 * the last one), so no empty rail item is left behind.
 */
export function pruneUnknownAdditionOffers(stock, { sigilKnown, armourKnown, consumableKnown = () => true, companionKnown = () => true, eventKnown = () => true, armamentKnown = () => true, cardKnown = () => true }) {
  if (!object(stock)) return [];
  const removed = [];
  const keep = {
    // The blacksmith's armament shelf (SPEC §14.4): an unsold offer for an
    // armament this build no longer has is pruned like any market offer.
    ...(stock.kind === 'blacksmith' ? { armaments: (item) => armamentKnown(item.id) } : {}),
    // The master's rack and art shelf (SPEC §14.5), the same way; his skill
    // books are the `skillBooks` row below.
    ...(stock.kind === 'master' ? { armaments: (item) => armamentKnown(item.id), weaponArts: (item) => cardKnown(item.id) } : {}),
    sigils: (item) => sigilKnown(item.id),
    armour: (item) => armourKnown(item.classId, item.id),
    skillBooks: (item) => consumableKnown(item.id),
    reviveTokens: (item) => consumableKnown(item.id),
    companions: (item) => companionKnown(item.id),
  };
  // A shelf the prune empties is no longer laid out: its id leaves
  // `stock.offerings` too, even when it was the only one (5a re-review), so
  // no empty rail item is ever left behind.
  const retire = (shelf) => {
    if (Array.isArray(stock.offerings)) stock.offerings = stock.offerings.filter((id) => id !== shelf);
    delete stock[shelf];
  };
  for (const shelf of Object.keys(keep)) {
    if (!Array.isArray(stock[shelf])) continue;
    const before = stock[shelf];
    const kept = before.filter((item) => object(item) && keep[shelf](item));
    if (kept.length === before.length) continue;
    for (const item of before) if (!kept.includes(item)) removed.push({ shelf, ...(shelf === 'armour' ? { classId: item?.classId } : {}), id: item?.id });
    stock[shelf] = kept;
    if (!kept.length) retire(shelf);
  }
  // The quest event is one offer: an unknown event takes the shelf with it.
  if (object(stock.questEvent) && !eventKnown(stock.questEvent.eventId)) {
    removed.push({ shelf: 'questEvent', id: stock.questEvent.eventId });
    retire('questEvent');
  }
  // A master's lesson rolls (SPEC §14.5): an unknown card id is dropped from
  // its entry. An entry left with no card is a roll that found nothing, and it
  // stays refused; the lesson offering stays laid out (a service stays once
  // rolled).
  if (stock.kind === 'master' && object(stock.lessons)) {
    for (const [skillId, entry] of Object.entries(stock.lessons)) {
      if (!object(entry) || !Array.isArray(entry.cardIds)) continue;
      const kept = entry.cardIds.filter((id) => cardKnown(id));
      if (kept.length === entry.cardIds.length) continue;
      for (const id of entry.cardIds) if (!kept.includes(id)) removed.push({ shelf: `lessons.${skillId}`, id });
      stock.lessons[skillId] = { ...entry, cardIds: kept };
    }
  }
  return removed;
}

// ---------------------------------------------------------------------------
// The run's consumables and companions (SPEC §14.3, schema 16)
// ---------------------------------------------------------------------------

/** `run.consumables` refused by name (validateRunShape): { [id]: whole count ≥ 1 }. */
export function consumablesProblems(run) {
  const map = run.consumables;
  if (map === undefined || map === null) return [];
  if (!object(map)) return ['consumables must be an object { [consumableId]: count }'];
  const problems = [];
  for (const [id, n] of Object.entries(map)) {
    if (!id) problems.push('consumables has an empty id');
    else if (!(Number.isSafeInteger(n) && n >= 1)) problems.push(`consumables.${id} must be a whole count of at least 1 (a used-up entry is deleted), got ${JSON.stringify(n)}`);
  }
  return problems;
}

/** `run.companions` refused by name (validateRunShape): [{ id, combatsLeft ≥ 1 }], each id once. */
export function companionsProblems(run) {
  const list = run.companions;
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list)) return ['companions must be a list of { id, combatsLeft }'];
  const problems = [];
  const seen = new Set();
  list.forEach((row, index) => {
    if (!object(row) || typeof row.id !== 'string' || !row.id || !(Number.isSafeInteger(row.combatsLeft) && row.combatsLeft >= 1)) {
      problems.push(`companions[${index}] must be { id, combatsLeft } with a non-empty id and a whole combatsLeft of at least 1`);
    } else if (seen.has(row.id)) problems.push(`companions[${index}] names '${row.id}' again; one of each travels at a time`);
    else seen.add(row.id);
  });
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
    // A number the offering needs is required, not only checked when present
    // (Copilot on #1438): a missing one would reach a stock as undefined.
    if (!(Number.isSafeInteger(value) && value >= floor)) {
      err(`shops.market.${id}.${path}`, value === undefined ? `is missing: write a whole number of at least ${floor}` : `must be a whole number of at least ${floor}, got ${JSON.stringify(value)}`);
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
  whole('skillBooks', 'stock', 0);
  whole('reviveTokens', 'stock', 0);
  whole('companions', 'stock', 0);
  whole('questEvent', 'price', 1);
  // (A non-boolean `armour.includeLocked` is refused by the generic leaf check,
  // model/shopKinds.js nonNumericLeaves.)
  const armour = row('armour');
  const range = armour && armour.cost;
  if (range && Number.isFinite(range.min) && Number.isFinite(range.max) && range.min > range.max) {
    err('shops.market.armour.cost', `min (${range.min}) must not be above max (${range.max})`);
  }
}

/**
 * The blacksmith's numbers (SPEC §14.4, the floors of #1378), refused by name
 * in validateContent: every one whole; `refine.value` (a divisor), `refine.from`
 * and every price from 1; every count from 0; and a piece's base sigil slots
 * never above its most.
 */
export function blacksmithTableProblems(table, err) {
  const offerings = table?.blacksmith?.offerings;
  if (!Array.isArray(offerings)) return;
  const row = (id) => offerings.find((offering) => offering && offering.id === id);
  const valueAt = (id, path) => {
    const offering = row(id);
    return offering ? path.split('.').reduce((at, key) => (at == null ? at : at[key]), offering) : undefined;
  };
  // Required when the offering is written (Copilot on #1438), not only
  // checked when present.
  const whole = (id, path, floor) => {
    if (!row(id)) return;
    const value = valueAt(id, path);
    if (!(Number.isSafeInteger(value) && value >= floor)) {
      err(`shops.blacksmith.${id}.${path}`, value === undefined ? `is missing: write a whole number of at least ${floor}` : `must be a whole number of at least ${floor}, got ${JSON.stringify(value)}`);
    }
  };
  for (const [id, path] of [['armaments', 'stock'], ['smithStones', 'perVisit'], ['sigilSlots', 'sigilSlots.base'], ['sigilSlots', 'sigilSlots.max'], ['stackCopy', 'stack.stepPerOwned']]) whole(id, path, 0);
  for (const [id, path] of [['smithStones', 'price'], ['refineStones', 'refine.from'], ['refineStones', 'refine.value'], ['refineStones', 'refine.cinders'],
    ['sigilSlots', 'sigilSlots.cinders'], ['upgradeArt', 'stones'], ['stackCopy', 'stack.stones'], ['stackCopy', 'stack.cinders']]) whole(id, path, 1);
  const base = valueAt('sigilSlots', 'sigilSlots.base');
  const max = valueAt('sigilSlots', 'sigilSlots.max');
  if (Number.isFinite(base) && Number.isFinite(max) && base > max) err('shops.blacksmith.sigilSlots.sigilSlots', `base (${base}) must not be above max (${max}): max counts the base slots`);
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
  // Weapon arts too (Codex and Copilot on #1438): a market's art shelf and a
  // master's, through whichever door opened the visit, scaled here once.
  for (const kind of ['cards', 'relics', 'flasks', 'armaments', 'weaponArts', 'armour', 'sigils', ...ITEM_LIST_SHELVES]) {
    if (Array.isArray(stock[kind])) for (const item of stock[kind]) item.cost = up(item.cost);
  }
  if (Number.isFinite(stock.removeCost)) stock.removeCost = up(stock.removeCost);
  if (stock.smithStones) stock.smithStones.price = up(stock.smithStones.price);
  if (stock.innRest) stock.innRest.price = up(stock.innRest.price);
  if (stock.questEvent) stock.questEvent.price = up(stock.questEvent.price);
  return stock;
}
