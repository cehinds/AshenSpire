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
