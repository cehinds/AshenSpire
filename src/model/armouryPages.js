// src/model/armouryPages.js — the Armoury's pages, one home.
//
// The view dropdown (Character / Equipment / Inventory / Cards) was redundant
// with the shell's top tabs (Character, Armory, Edit Deck) and is gone (owner,
// 2026-11-05). The Armoury now draws two pages:
//
//   grid  the Character tab — the figure and its sheet
//   rack  the Armory tab — the equipment slots on top, the Inventory below
//
// `balance.equipment.views` is untouched data and still declares four ids; this
// maps any declared id (or a saved `equipView`, or a destination's view) onto
// the page that now holds its content, so nothing that named a retired view
// breaks. tools/release-shots.mjs reads ARMOURY_PAGES so retired views are not
// photographed as if they were screens.
export const ARMOURY_PAGES = Object.freeze(['grid', 'rack']);

/** The page a declared view id lands on: the Character page, or the combined Armory page. */
export const armouryPageOf = (viewId) => (viewId === 'grid' ? 'grid' : 'rack');

/**
 * Where the Armoury button reopens: the last menu the player left it on. `stored` is the saved `equipView`
 * (grid = Character, rack = Armory, cards = the Deck tab's editor). The Deck tab only counts while its door is
 * open; nothing saved opens the default (the Armory page, as before).
 */
export const armouryReopenTarget = (stored, { deckDoor = false } = {}) =>
  (stored === 'cards' && deckDoor ? 'deck' : armouryPageOf(stored));

/**
 * The routing decision of showArmoury (main.js), as data so it can be driven without the app.
 * `request` is what the caller passed: a view id ('grid' / 'rack'), or { destination, equipItemId }.
 * Returns { open: 'armoury' | 'deck', view, destination, equipItemId, saveView }: `saveView` is the explicit
 * view the player just chose, to remember as the last menu ('' when there is nothing new to save).
 */
export function armouryRoute(request, { stored, deckDoor = false } = {}) {
  const view = typeof request === 'string' ? request : '';
  const bag = request && typeof request === 'object' ? request : {};
  const destination = bag.destination || '';
  const equipItemId = bag.equipItemId || '';
  const explicit = Boolean(view || destination || equipItemId);
  const open = !explicit && armouryReopenTarget(stored, { deckDoor }) === 'deck' ? 'deck' : 'armoury';
  return Object.freeze({ open, view, destination, equipItemId, saveView: view && view !== stored ? view : '' });
}
