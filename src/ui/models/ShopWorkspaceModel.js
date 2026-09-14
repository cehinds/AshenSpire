import { wireframeUi } from '../../content/wireframeUi.js';

// W1d / W1v: THE MERCHANT AS A WORKSPACE. A category rail beside (or above) one
// active pane; the pane shows the category's offers with a price and an
// availability line each, the selected offer's detail, and a footer whose
// right-hand action is the selected offer's. Presentation state only: nothing
// here reads the run, rolls stock or prices anything. The screen projects the
// saved stock and the existing purchase plans into plain facts and asks this
// file how to present them.

/** The rail, in order. `sell` exists only while the player's toggle is on. */
export const SHOP_CATEGORIES = Object.freeze(['cards', 'armaments', 'weaponArts', 'relics', 'flasks', 'services', 'sell']);

export function shopCategories({ sellOn = true } = {}) {
  return Object.freeze(SHOP_CATEGORIES.filter((key) => key !== 'sell' || sellOn));
}

/**
 * The {Status} line a category carries on its rail item and its pane head.
 * `offered` counts the offers on the shelf; `available` those the player can
 * take now (sell and services read it). Returns a string id and its tokens.
 */
export function shopCategoryStatus(key, { offered = 0, available = 0 } = {}) {
  if (key === 'sell') return available ? { id: 'shop.status.willTake', tokens: { n: available } } : { id: 'shop.status.nothingWanted', tokens: null };
  if (key === 'services') return { id: 'shop.status.servicesOpen', tokens: { n: available, total: offered } };
  return offered ? { id: 'shop.status.forSale', tokens: { n: offered } } : { id: 'shop.status.soldOut', tokens: null };
}

/**
 * Stable offer identities: kind, id, and the occurrence of that id on the
 * shelf. Never a bare index, so a purchase that shifts the shelf cannot make
 * a stale selection point at a different item.
 */
export function offerRefs(kind, ids = []) {
  const seen = new Map();
  return Object.freeze(ids.map((id) => {
    const n = seen.get(id) || 0;
    seen.set(id, n + 1);
    return `${kind}:${id}#${n}`;
  }));
}

/**
 * Keep the selection while its offer is still on the shelf; otherwise take
 * the offer now standing where it stood (the next one along after a
 * purchase), clamped to the shelf. A shelf visited for the first time
 * selects its first offer the player can take (`available`), else its
 * first offer; an empty shelf selects nothing.
 */
export function resolveShopSelection(refs = [], previous = null, available = refs) {
  if (!refs.length) return null;
  if (previous && previous.ref && refs.includes(previous.ref)) return previous.ref;
  if (previous && Number.isInteger(previous.index)) return refs[Math.min(Math.max(previous.index, 0), refs.length - 1)];
  return available.find((ref) => refs.includes(ref)) || refs[0];
}

/**
 * Availability with each offer, only from facts the existing plans supply: a
 * plan's own refusal wins, then a full flask belt, then the price against the
 * purse. A sale has no price to afford (`price: null`).
 */
export function offerAvailability({ price = null, cinders = 0, reason = null, capacityFull = false } = {}) {
  if (reason) return Object.freeze({ available: false, because: 'plan', reason });
  if (capacityFull) return Object.freeze({ available: false, because: 'capacity', reason: null });
  if (price != null && !(cinders >= price)) return Object.freeze({ available: false, because: 'cinders', reason: null });
  return Object.freeze({ available: true, because: null, reason: null });
}

/**
 * The W0 footer for the selected offer: Leave bottom-left and the offer's
 * action bottom-right; with nothing selected, or an offer whose action lives
 * in the pane, Leave alone spans the footer.
 */
export function shopFooterActions(selected = null) {
  return Object.freeze(selected && selected.action ? ['leave', 'primary'] : ['leave']);
}

/**
 * Layout for the measured frame. Wide: rail beside the pane, offers and
 * detail side by side. Compact: rail above, detail stacked under the offers
 * and capped so the offers keep the larger share. All numbers come from
 * `wireframeUi.shop`; `rem` is the measured root size in CSS px.
 */
export function shopWorkspaceLayout({ width = 0, bodyHeight = 0, rem = 16 } = {}, ui = wireframeUi.shop) {
  const px = rem > 0 ? rem : 16;
  const wide = width >= ui.wideMinRem * px;
  const railWidth = wide
    ? Math.round(Math.min(Math.max(width * ui.railFraction, ui.railMinRem * px), ui.railMaxRem * px))
    : 0;
  return Object.freeze({
    mode: wide ? 'wide' : 'compact',
    rail: wide ? 'side' : 'top',
    pane: wide ? 'columns' : 'stacked',
    railWidth,
    offersFr: ui.offersFraction,
    detailFr: 1 - ui.offersFraction,
    gap: Math.round(ui.gapRem * px),
    detailMax: wide ? null : Math.max(0, Math.floor(bodyHeight * ui.detailMaxFraction)),
  });
}
