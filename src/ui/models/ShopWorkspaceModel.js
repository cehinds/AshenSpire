import { wireframeUi } from '../../content/wireframeUi.js';
import { cardShelf, cardShelfWidthPx } from './CardSizeModel.js';

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
 * THE OFFERS COLUMN IS WIDE ENOUGH FOR A SHELF OF CARDS, not a bare fraction.
 *
 * `offersFraction` gave the offers half the pane whatever was standing in it.
 * Measured at 1328x744: rail 287, pane 1000, offers 490 — and an armament
 * shelf needs 644px to stand four resting cards side by side, so it wrapped to
 * ONE card per row with the rest behind a scroll. The authored fraction was
 * never wrong about what the offers deserve at rest; it simply had no idea
 * what it was holding.
 *
 * So the share is a FLOOR, not the answer: the offers take their authored
 * fraction, or as much as a full shelf of resting cards needs, whichever is
 * larger — bounded by what the detail column can spare (`detailMinRem`, this
 * screen's own authored floor, because the detail here is a short stack of
 * facts rather than a reading door). Asking for more than a full shelf would
 * only stretch the gaps: the shelf never draws a card above its resting width.
 * Below the bound the offers keep the authored fraction and the shelf drops a
 * column, which is the shelf's own rule, not a second one written here.
 *
 * `rem` is the measured root size in CSS px, the same term the rest of this
 * model's rem numbers are resolved with — the app's root is `font-size: 62.5%`,
 * so a rem here is about ten pixels, which is the currency `railMinRem: 11`
 * and `wideMinRem: 60` are already counted in.
 *
 * `restingPx` is how wide a resting card is ACTUALLY being drawn: the authored
 * glance width, or a tuned one, or the phone's own variant. It is passed in
 * rather than read from the authored table because the table is not the last
 * word — `applyCardSizeSettings` in main.js lays a player's overrides over it
 * and projects the result as `--card-w-glance`. Reading the authored 152 here
 * while the cards on the shelf were drawn at 100 would have reserved 644px for
 * four of them where 436 was needed, squeezing the detail column to buy room
 * nothing was going to stand in — the model claiming the offers take what
 * their shelf needs while taking what a different shelf would have needed.
 */
export function shopOffersWidthPx(paneWidth, rem = 16, ui = wireframeUi.shop, restingPx = null) {
  const share = paneWidth * ui.offersFraction;
  const shelf = cardShelf();
  const resting = Number.isFinite(Number(restingPx)) && Number(restingPx) > 0
    ? Number(restingPx) : shelf.restingPx;
  const fullShelf = cardShelfWidthPx(shelf.maxColumns, resting);
  const spare = paneWidth - ui.detailMinRem * (rem > 0 ? rem : 16);
  const want = Math.max(0, Math.min(fullShelf, spare));
  return Math.min(paneWidth, Math.max(share, want));
}

/**
 * Layout for the measured frame. Wide: rail beside the pane, offers and
 * detail side by side. Compact: rail above, detail stacked under the offers
 * and capped so the offers keep the larger share. All numbers come from
 * `wireframeUi.shop`; `rem` is the measured root size in CSS px.
 *
 * `restingWidthPx` is how wide a resting card is being drawn right now, which
 * a tuner or a phone can move under the authored table; see
 * `shopOffersWidthPx`. `bodyWidth` is the measured width of `.shop-body` — the
 * grid the two columns actually divide. It is MEASURED rather than derived from `width` because
 * everything between the two is somebody else's number: the rail's track, the
 * pane's `--modal-inset` padding, whatever chrome is added next. An earlier
 * draft subtracted the rail and one gap from the frame and was wrong by the
 * pane's inset in one direction and by the column gap in the other, which took
 * the detail column under its own authored floor. With no measurement there is
 * no derivation: the authored fraction stands.
 */
export function shopWorkspaceLayout({ width = 0, bodyWidth = 0, bodyHeight = 0, rem = 16, restingWidthPx = null } = {}, ui = wireframeUi.shop) {
  const px = rem > 0 ? rem : 16;
  const wide = width >= ui.wideMinRem * px;
  const railWidth = wide
    ? Math.round(Math.min(Math.max(width * ui.railFraction, ui.railMinRem * px), ui.railMaxRem * px))
    : 0;
  const gap = Math.round(ui.gapRem * px);
  // The `fr` tracks divide what is left of the body once the gap between them
  // is taken; a fraction measured against the body's whole width would hand
  // each column its share of a gap that is not theirs. Stacked, the offers own
  // the full width and the fractions are not column tracks at all.
  const columnsWidth = Math.max(0, bodyWidth - gap);
  const offersFr = wide && columnsWidth > 0
    ? shopOffersWidthPx(columnsWidth, px, ui, restingWidthPx) / columnsWidth
    : ui.offersFraction;
  return Object.freeze({
    mode: wide ? 'wide' : 'compact',
    rail: wide ? 'side' : 'top',
    pane: wide ? 'columns' : 'stacked',
    railWidth,
    offersFr,
    detailFr: 1 - offersFr,
    gap,
    detailMax: wide ? null : Math.max(0, Math.floor(bodyHeight * ui.detailMaxFraction)),
  });
}
