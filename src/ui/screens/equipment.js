// src/ui/screens/equipment.js — the Armoury.
//
// Three views of the same loadout, because the two obvious layouts are both
// right for different things and neither should have to win:
//
//   grid    the figure in the middle, slots as squares around it — you are
//           looking at a PERSON, and the kit hangs off them
//   rack    a dense two-column armament rack — you are looking at a LIST, and
//           you want to compare eight shields quickly
//   hybrid  the rack, with the figure and its slot squares alongside
//
// The panel builds itself from registries.equipment.slots, so a new row in
// equipSlots.csv appears here with no change to this file. The card strip at
// the bottom is the whole point of the system made visible: pick up a dagger
// and watch Strike become 3×2 before you commit to it.

import { balance } from '../../content/balance.js';
import { resolveCard } from '../../model/registries.js';
import {
  canSwap, canEquip, cycleSet, equipPiece, equipTransitionReceipt, fitsSlot, cardMods, runMods, loadoutTags, figureSpec,
  ownership, openedSets, visibleSets, rungFor, setCellState, slotHand,
} from '../../model/loadout.js';
import { equipmentSurfaceReceipt } from '../../model/equipmentPresentation.js';
import { inventoryRows, inventoryItemCount } from '../../model/inventoryPresentation.js';
import { equippedTagColor } from '../../model/equipmentUi.js';
import { renderCard, relicText } from '../components/card.js';
import { renderCandidateComparison, renderEquipmentRequirements, renderPlayerPoise } from '../components/equipmentReceipts.js';
import { esc, attachTooltip } from '../components/tooltip.js';
import { refuses } from '../components/refusal.js';
import { playerSprite, equippedFigure } from '../assets.js';
import { assetUrl } from '../assetmap.js';
import { sfx } from '../sfx.js';
import { statProjection } from '../../model/statProjection.js';
import { syncFlaskGrowth } from '../../model/flaskgrowth.js';
import { closeFlaskActionMenu } from '../components/flask.js';
import { mountDisclosure } from '../components/disclosure.js';

const CFG = () => balance.equipment;

// ---- the view set: a row DESCRIBES a layout, and the CELL is the vocabulary --
//
// EldenSpire#78, second pass. The first pass killed `if (view === 'grid') … else
// …` — the id was the handler, so a fourth id fell into the else and rendered as
// hybrid in silence. It replaced the id with two characteristics and declared
// each of them closed ON ITS OWN:
//
//     VIEW_VOCAB = { figure: [true, false], slots: ['flank', 'list'] }
//
// THAT IS NOT A CLOSED SET. It is two closed sets whose PRODUCT is four cells,
// and the screen drew three. Vira's gate found the fourth: one row of data,
// `{ id:'ghost', figure:false, slots:'flank' }`, written entirely in words this
// file declared legal — it passed viewLayout, took the flank branch (which
// appended the figure without ever consulting `figure`), and was then blanked by
// a ui.css rule whose real predicate was `figure:false AND slots:'list'`. Two
// mistakes that cancelled into `bodyInk: 0`: an empty armoury, no error, no
// banner, every instrument green. WORSE than the `else` it replaced, which at
// least rendered hybrid. Marina's property, house-wide from today:
//
//     A CLOSED SET MUST STAY CLOSED UNDER WHATEVER FACTORISATION REPLACES IT.
//
// So the unit of the vocabulary here is the CELL, not the factor. `LAYOUTS`
// below is keyed by the whole combination, and ITS KEYS ARE THE CLOSED SET — a
// row whose combination is not a key fails by name at boot (surfaces.js) and in
// the panel, exactly as an unknown word does. There is no second list of legal
// cells anywhere to disagree with this one: THE TABLE THAT DRAWS A CELL IS THE
// TABLE THAT DECLARES IT, and what an author may write is DERIVED from it
// (`viewCells()`), never written beside it. A second declaration is precisely
// how the fourth cell got in.
//
// This also answers the seam Vira left open — *"I proved the fourth cell renders
// nothing; I did not prove there are only four cells that matter."* There is
// nothing to enumerate: `slots: 'ring'` tomorrow makes the product six, and all
// six of those cells are legal only if six keys exist. Adding a value to a
// factor grants nothing on its own. That is the honest edge and it is now
// structural rather than argued.

/** The cell a row asks for — `figure:1|slots:flank` — or null if it is not one. */
function cellKey(row) {
  if (!row || typeof row.figure !== 'boolean' || typeof row.slots !== 'string' || !row.slots) return null;
  return `figure:${row.figure ? 1 : 0}|slots:${row.slots}`;
}

// Every layout the armoury has. THE KEYS ARE THE VOCABULARY.
//
// NOT A CELL, and deliberately: `figure:false + slots:'flank'`. "Flank" means
// the slot columns hang either side OF THE FIGURE; with no figure there is
// nothing to flank, and two columns around a hole is a layout nobody designed —
// shipping it to satisfy an arithmetic is the "renders something plausible"
// failure one level up. A row asking for it now says so by name. Building it is
// one key here plus its rule in ui.css: the DOM builder below already obeys
// `figure` on both branches, so the table really is the only decider.
const LAYOUTS = {
  'figure:1|slots:flank': buildFlank, // 'grid'   — the person, kit hanging off them
  'figure:1|slots:list': buildList, // 'hybrid' — the rack with the figure beside it
  'figure:0|slots:list': buildList, // 'rack'   — the list, no figure
};

/** Every declared view id, in authored order. The one enumeration. */
export function viewIds() {
  return (CFG().views || []).map((v) => (v && typeof v === 'object' ? v.id : v));
}

/** The cells that exist, DERIVED from the layouts. What an author may write. */
export function viewCells() {
  return Object.keys(LAYOUTS).map((k) => {
    const m = /^figure:([01])\|slots:(.+)$/.exec(k);
    return { figure: m[1] === '1', slots: m[2] };
  });
}

/** The same list as one line of English, for every message that has to say it. */
export function viewCellsSay() {
  return viewCells().map((c) => `figure: ${c.figure} + slots: '${c.slots}'`).join(' | ');
}

/**
 * viewLayout(id) → { figure, slots, cell } the screen can actually draw, or null.
 *
 * Null is the honest answer for every shape of breakage — an id nobody declared,
 * a row written in a word this file does not have, and a row written in a
 * COMBINATION nothing draws. The caller decides how loudly to say so;
 * assertSurfaces() says so at boot, by name.
 */
export function viewLayout(id) {
  const row = (CFG().views || []).find((v) => v && typeof v === 'object' && v.id === id);
  const cell = cellKey(row);
  if (!cell || !LAYOUTS[cell]) return null;
  return { figure: row.figure, slots: row.slots, cell };
}

// ---- the regions: which pane is the SUBJECT, and which is CONTEXT -----------
//
// EldenSpire#90. Constantine asked for the card list to be collapsible "so that
// I can see the armory slots better", and the clause after "so that" is the
// missing word, not the feature. `collapsible: true` on a pane states a
// MECHANISM; what the screen did not carry is which pane you opened it FOR. You
// collapse the context; you never collapse the subject.
//
// THIS SCREEN HAD ALREADY DECIDED IT, THREE TIMES, IN THREE MECHANISMS — which
// is why this is a collapse and not a feature:
//
//   narrowDefaultView: 'rack'   a phone opens on the view with no figure
//   `[data-slots='flank']:not(.picking) .armoury-right { display: none }`
//                               a whole pane hidden at narrow, no control, no
//                               trace, nothing a player can put back
//   Freja's armoury ruling      "a picture before the controls is a wall"
//
// One fact — the slots are the subject — written three times with nothing
// checking they agree. That is the second copy this seat exists to refuse.
//
// THE FIGURE IS DELIBERATELY NOT A REGION. `rack` already IS the figure's
// collapse: a whole declared view whose only job is to remove it. Making the
// figure collapsible too would be two mechanisms for one act, which is the
// defect, not the feature.
//
// FLAT, AND SAID OUT LOUD SO NOBODY DISCOVERS IT. The regions are the armoury's
// own children. Ordering INSIDE a region (Freja's figure-below-gear at narrow)
// is one level down and does NOT fall out of this word — a region TREE is a
// different word and I am not proposing one.
const REGIONS = [
  {
    id: 'slots',
    label: 'Slots',
    sel: '.armoury-body',
    count: (el) => el.querySelectorAll('.equip-slot').length,
    unit: 'slot',
  },
  {
    id: 'inventory',
    label: 'Inventory',
    sel: '.armoury-inventory',
    count: (el) => [...el.querySelectorAll('[data-inventory-item]')]
      .reduce((sum, row) => sum + Number(row.dataset.itemCount || 0), 0),
    unit: 'item',
  },
  {
    id: 'cards',
    label: 'Cards',
    sel: '.armoury-strip',
    count: (el) => el.querySelectorAll('.equip-cards > .equip-card-with-count').length,
    unit: 'card',
  },
];

/** Every region this screen has. The one enumeration. */
export function regionIds() {
  return REGIONS.map((r) => r.id);
}

/** A region by name, or null. The join's handler. */
export function regionById(id) {
  return REGIONS.find((r) => r.id === id) || null;
}

/**
 * The subject EXACTLY AS THE AUTHOR WROTE IT — not resolved, not defaulted.
 *
 * The join needs the raw string so the finding can name the entry (Law 1 clause
 * 5). Resolving first would hand it `null` and it would have to say *"the
 * subject is missing"* for both a typo and an omission, which are two different
 * edits and want two different sentences.
 */
export function authoredSubject() {
  return CFG().subject;
}

/** The subject as a region, or null if the author named one that is not there. */
export function subjectRegion() {
  return regionById(CFG().subject);
}

/**
 * The context regions — the COMPLEMENT of the subject, never authored.
 *
 * An unknown subject returns NOTHING rather than everything, and the direction
 * is the point (Law 0 clause 5). Loud is assertSurfaces(), which fails the boot
 * by name. Safe is here: a screen whose subject nobody can find collapses no
 * pane at all — it degrades to how the armoury behaves today. The plausible
 * failure would be the other way round, where a one-character typo quietly makes
 * every pane foldable and the player can put the whole screen away.
 */
export function contextRegions() {
  const s = subjectRegion();
  return s ? REGIONS.filter((r) => r.id !== s.id) : [];
}

/**
 * Does this region open collapsed?
 *
 * THE SAME THREE TERMS THE VIEW ALREADY USES, and reusing them is why this
 * bought no new field (see mountEquipment below): the player's own stored
 * choice, always, on every shape; otherwise the shape's default.
 *
 * THE SHAPE'S DEFAULT FOR CONTEXT IS *COLLAPSED*, ON EVERY SHAPE — Constantine's
 * ruling, 2026-08-21: *the Armoury opens with the figure, and CARDS is one click
 * away.* It used to be `!!narrow` — collapsed on a phone only — and the cost of
 * that was measured, not argued, at dev `456b8ea`, 1440x860, `?shot=combat`:
 *
 *     arrival, CARDS expanded   .armoury-figure VISIBLE 260x139  (area 36140)
 *     after one CARDS click     .armoury-figure VISIBLE 260x330  (area 85800)
 *
 * THE LAYOUT BOX IS 260x330 BOTH TIMES AND THAT IS THE TRAP. `getBoundingClientRect`
 * on the figure never moves; what moves is `.armoury-left`, its scroll parent,
 * which is 275x139 with the strip open and 260x628 with it shut. Reading the
 * figure's own rect says "nothing changed" while 58% of the figure is behind a
 * clipped, scrolling edge. The number this rule is answerable to is therefore the
 * VISIBLE area — the rect intersected with every clipping ancestor — and it is
 * measured that way in tools/armoury-arrival-figure.mjs, both edges, both shapes.
 *
 * NARROW IS NOT CONSULTED ANY MORE, AND DROPPING IT IS THE POINT, NOT AN OVERSIGHT.
 * `narrow` here was a SECOND decider of what arrives open, on top of
 * `narrowDefaultView` — which already answers "what does a phone open on" and
 * answers it with `rack`, the view whose whole job is to have no figure. Measured
 * at 390x844: `.armoury-figure` is ABSENT, so on a phone there was never a figure
 * for the strip to squeeze, and this rule changes NOTHING there — the phone
 * already opened folded. Keeping the parameter would have left two rules that can
 * disagree about one screen, which is #24's shape.
 *
 * The parameter is gone from the signature rather than left unread: an argument
 * nothing consults is the next reader's false lead, and mountEquipment is its one
 * caller.
 */
export function opensCollapsed(regionId, stored) {
  const s = stored && stored[regionId];
  if (typeof s === 'boolean') return s;
  return true;
}

// ---- the builders ----------------------------------------------------------
//
// Each takes the layout it was handed and a `ui` bag of the four things a
// builder may touch. THE BUILDER OBEYS EVERY CHARACTERISTIC IT IS HANDED, even
// where today's key set means it can only ever see one value — the flank branch
// ignoring `figure` is half of the defect Vira found, and an error that is
// currently unreachable is still an error. It is also what makes the sentence
// above true: adding `figure:0|slots:flank` to LAYOUTS is one key and one rule
// in ui.css, because nothing here would have to change.

function buildFlank(L, ui) {
  // The figure in the middle with its kit hanging off it, hands on the side they
  // are actually held: the sprite carries the right-hand armament at screen
  // right, so the Right Hand column is the right one.
  const cols = { l: document.createElement('div'), r: document.createElement('div') };
  cols.l.className = 'ag-col';
  cols.r.className = 'ag-col';
  ui.blocks.forEach(({ slot, el: b }, i) => {
    const id = slot.id.toLowerCase();
    const side = id.includes('right') ? 'r' : id.includes('left') ? 'l' : (i % 2 ? 'r' : 'l');
    cols[side].appendChild(b);
  });
  ui.left.appendChild(cols.l);
  if (L.figure) ui.left.appendChild(ui.figure());
  ui.left.appendChild(cols.r);
  ui.right.appendChild(ui.picker());
}

function buildList(L, ui) {
  // One column of slots beside the figure — or without it, when the row says
  // `figure: false`. The id is not consulted: 'rack' is simply the row that
  // asks for no figure.
  if (L.figure) ui.left.appendChild(ui.figure());
  const slotWrap = document.createElement('div');
  slotWrap.className = 'equip-slots';
  for (const b of ui.blocks) slotWrap.appendChild(b.el);
  ui.right.appendChild(slotWrap);
  ui.right.appendChild(ui.picker());
}

/**
 * The figure, as layers: a bare-handed body in the armour set's palette with
 * each held armament stacked over it (see assets.js equippedFigure). Anything
 * missing falls back to the ordinary class sprite, so the single-file dist and
 * file:// play keep working exactly as before.
 */
function figureFor(registries, run, cz) {
  const el = document.createElement('div');
  el.className = 'armoury-figure';
  const reacts = CFG().spriteReacts;
  if (reacts === 'none') {
    el.appendChild(playerSprite(cz, run.class));
    return el;
  }
  const spec = figureSpec(registries, run.loadout, run.class);
  if (reacts === 'hands') spec.armourId = 'default';
  const fig = equippedFigure({ classId: run.class, ...spec });
  el.appendChild(fig || playerSprite(cz, run.class));
  return el;
}

/**
 * A piece's thumbnail. Armaments have a tight icon render; an armour set's
 * "icon" is the set itself — the body in its own palette — because there is no
 * separate object to photograph.
 */
function thumbSrc(piece) {
  return piece.kind === 'armor'
    ? assetUrl(`assets/equipment/body_${piece.classId}_${piece.id}.webp`)
    : assetUrl(`assets/equipment/icon_${piece.artKey || piece.id}.webp`);
}

/** A piece's mods, written the way a player reads them. */
function modSummary(registries, piece) {
  const fields = registries.equipment.modFields || {};
  const parts = [];
  for (const raw of piece.mods || []) {
    const m = /^(\w+)\.(\w+)=([+-]?\d+)$/.exec(raw);
    if (!m) continue;
    const spec = fields[m[2]];
    if (!spec) continue;
    const where = m[1] === 'self' ? '' : `${m[1][0].toUpperCase()}${m[1].slice(1)} `;
    const sign = m[3][0] === '+' || m[3][0] === '-' ? m[3] : `= ${m[3]}`;
    parts.push(`${where}${spec.label} ${sign}`);
  }
  return parts;
}

// EVERY CHIP IN THE PICKER IS ONE YOU OWN (#90), so there is no `locked` here
// any more and no `hint` to carry. The parameters were removed rather than
// passed as false: a dead argument is a second copy of a decision, and the next
// author to see `locked: false` at every call site would reasonably conclude the
// picker still has a locked state to reach.
//
// TWO WRAPPERS, ONE MARKUP (Viki, 2026-08-21). The card is now BOTH a control in
// its own right and the face of a disclosure — and a <button> inside a <button>
// is not a thing the parser keeps, so the face wants the same card built out of
// phrasing content instead. That is a second SHAPE, and it must not become a
// second MARKUP: `pieceChipHtml` is the one home, and the two functions below
// differ only in the element they hang it on.
function pieceChipHtml(registries, piece) {
  const mods = modSummary(registries, piece);
  return `<img class="ec-art" src="${esc(thumbSrc(piece))}" alt="">`
    + `<span class="ec-name">${esc(piece.name)}</span>`
    + `<span class="ec-tags">${(piece.tags || []).map((t) => `<em>${esc(t)}</em>`).join('')}</span>`
    + `<span class="ec-mods">${mods.length ? mods.map(esc).join(' · ') : '—'}</span>`;
}

/** The art element dies quietly if the file is missing — the single-file dist
 *  and file:// play both depend on this and it is easy to drop in a refactor. */
function dropArtOnError(el) {
  const art = el.querySelector('.ec-art');
  if (art) art.addEventListener('error', () => art.remove());
  return el;
}

function pieceChip(registries, piece, { selected }) {
  const el = document.createElement('button');
  el.className = `equip-chip rarity-${piece.rarity || 'common'}${selected ? ' on' : ''}`;
  el.type = 'button';
  el.innerHTML = pieceChipHtml(registries, piece);
  return dropArtOnError(el);
}

/** The same card as phrasing content, for use INSIDE the disclosure face. */
function pieceFace(registries, piece, { selected, equippedLabel = '' }) {
  const el = document.createElement('span');
  el.className = `equip-chip as-face rarity-${piece.rarity || 'common'}${selected ? ' on' : ''}`;
  el.innerHTML = pieceChipHtml(registries, piece);
  if (equippedLabel) {
    const tags = el.querySelector('.ec-tags');
    const badge = document.createElement('em');
    badge.className = 'ec-equipped';
    badge.textContent = equippedLabel;
    tags.appendChild(badge);
  }
  return dropArtOnError(el);
}

function inventoryFace(row, { selected = false, draggable = false } = {}) {
  const el = document.createElement('span');
  el.className = `inventory-face${selected ? ' on' : ''}`;
  el.dataset.inventoryItem = row.key;
  el.dataset.itemId = row.id;
  el.dataset.itemCategory = row.category;
  el.dataset.itemCount = String(row.count);
  el.draggable = draggable;
  const equipped = row.equippedLabels.length
    ? (row.equippedLabels.length === 1 && row.equippedLabels[0] === 'Equipped'
      ? 'Equipped'
      : `Equipped: ${row.equippedLabels.join(' / ')}`)
    : '';
  el.innerHTML = `<span class="inventory-name">${esc(row.name)}</span>`
    + `<span class="inventory-category">${esc(row.category)}</span>`
    + `<span class="inventory-count">×${row.count}</span>`
    + (equipped ? `<em class="inventory-equipped">${esc(equipped)}</em>` : '');
  return el;
}

function inventoryReveal(registries, row, { comparison = null, action = null, instruction = '' } = {}) {
  const el = document.createElement('div');
  el.className = 'inventory-detail';
  const item = row.item;
  let art = '';
  if (row.category === 'Armour' || ['Weapon', 'Shield', 'Staff', 'Armament'].includes(row.category)) {
    art = `<img src="${esc(thumbSrc(item))}" alt="">`;
  } else if (item.artAsset) {
    art = `<img src="${esc(assetUrl(item.artAsset))}" alt="">`;
  } else {
    art = `<span aria-hidden="true">${esc(item.icon || '◆')}</span>`;
  }
  const description = row.category === 'Relic'
    ? relicText(item, registries)
    : (item.blurb || item.textTemplate || 'No additional information.');
  const tags = (item.tags || []).map((tag) => `<em>${esc(tag)}</em>`).join('');
  const mods = modSummary(registries, item);
  el.innerHTML = `<div class="inventory-model">${art}</div>`
    + `<div class="inventory-information"><h4>${esc(item.name)}</h4>`
    + `<p class="inventory-kind">${esc(row.category)} · ${esc(item.rarity || 'standard')} · ${row.count} owned</p>`
    + `<p>${esc(description)}</p>`
    + (mods.length ? `<p class="inventory-mods">${mods.map(esc).join(' · ')}</p>` : '')
    + (tags ? `<div class="inventory-tags">${tags}</div>` : '')
    + (instruction ? `<p class="inventory-instruction">${esc(instruction)}</p>` : '')
    + (comparison ? renderCandidateComparison(comparison, { expanded: true }) : '')
    + '</div>';
  if (action) el.querySelector('.inventory-information').appendChild(action);
  const image = el.querySelector('img');
  if (image) image.addEventListener('error', () => image.replaceWith(Object.assign(document.createElement('span'), { textContent: item.icon || '◆' })));
  return el;
}

/**
 * mountEquipment(host, opts) → { close() }
 *
 *   inCombat  seals storage and honours each slot's swap rule
 *   onSwap    called with (slotId, setIndex) instead of mutating, so combat can
 *             route the change through the engine intent that charges for it
 */
export function mountEquipment(host, {
  registries, run, meta = {}, inCombat: inCombatArg, onClose, onChange, onSwap,
}) {
  closeFlaskActionMenu({ cancelled: true });
  // THE DEFAULT THAT DECIDED WHAT THE MUTATION WAS TOLD (#98, Vira). This read
  // `inCombat = false`. #95 moved the gate off the screen and onto the mutation
  // — and left the screen holding the one value that gate is asked about, with a
  // permissive default. A third mount that forgot the flag would have re-armed
  // mid-fight while every model test stayed green, because the model would have
  // been told the truth about a lie. Both existing mounts already pass it
  // explicitly (main.js:716 `false`, combat.js:1068 `true`), so there is no
  // behaviour to change here — only the silence to close.
  //
  // IT FAILS LOUD AND CLOSED, in that order. A mount that cannot say whether a
  // fight is on is sealed: a visibly inert picker with a named cause on the
  // console beats a picker that quietly lets you re-arm. Law 1 clause 5 —
  // bad input fails by name, and the name here is the caller.
  if (typeof inCombatArg !== 'boolean') {
    console.error(
      `mountEquipment(): no boolean \`inCombat\` — got ${JSON.stringify(inCombatArg)}.`
      + ' Sealing the picker. This line is the defect, not the seal.'
    );
  }
  // ONE NAME IN THE BODY. The argument is validated once, here, and everything
  // below reads `inCombat` — a second name for the same fact is the defect this
  // seat is for, and it would be a strange one to introduce while closing this.
  const inCombat = typeof inCombatArg === 'boolean' ? inCombatArg : true;
  const eq = registries.equipment;
  const cz = (meta.settings && meta.settings.customization) || run.customization || {};
  // WHICH VIEW A PHONE OPENS ON — EldenSpire#38, and the order of these three
  // terms is the whole rule:
  //   1. the player's own saved choice, always, on every shape;
  //   2. otherwise the narrow default, if this is a narrow layout;
  //   3. otherwise the desktop default.
  // Sunna's ruling was "hybrid must not be what a phone OPENS" — opens, not
  // shows. Someone who picked hybrid on a phone keeps it, and since #38 the
  // stylesheet makes it fit, so honouring that choice is no longer a trap.
  //
  // `data-layout` is READ, never computed. autoLayout() writes it in the same
  // call that chooses --ui-zoom, so mode and zoom cannot disagree; asking the
  // width here would make a second decider, which is exactly the fight that
  // became unadvanceable in #24. The value is validated against the content's
  // own closed set rather than trusted, so a bad table entry degrades to the
  // desktop default instead of rendering a view class that does not exist.
  const CV = CFG();
  const narrow = typeof document !== 'undefined'
    && document.documentElement.getAttribute('data-layout') === 'narrow';
  // LAW 1 CLAUSE 5 — bad data fails LOUD and names the entry. Vira's condition on
  // #41: `narrowDefaultView: 'racks'` is a one-character typo that fell through
  // to `hybrid` in silence, and tools/menufit.mjs stayed green because the other
  // half of this PR had just made hybrid fit. THE TWO HALVES MASKED EACH OTHER —
  // a silent fallback plus a check that asks "does it fit" rather than "is it the
  // one the table names". A validated-then-discarded value is exactly the shape
  // clause 5 exists to forbid.
  const named = narrow ? CV.narrowDefaultView : CV.defaultView;
  const IDS = viewIds();
  if (named != null && !IDS.includes(named)) {
    console.error(`[content] balance.equipment.${narrow ? 'narrowDefaultView' : 'defaultView'}`
      + ` = ${JSON.stringify(named)} is not one of ${JSON.stringify(IDS)}`
      + ' — falling back, and this line is the defect, not the fallback.');
  }
  const shapeDefault = (named != null && IDS.includes(named)) ? named : CV.defaultView;
  // A STORED view the table no longer declares is not the defect this file
  // guards — the player saved 'hybrid' and the set moved under their save. It
  // degrades to the shape default and says so once. A DECLARED row that cannot
  // be drawn is the defect, and assertSurfaces() fails the boot before any of
  // this runs, so `viewLayout` below can only be null for the stored case.
  const stored = meta.settings && meta.settings.equipView;
  if (stored && !IDS.includes(stored)) {
    console.warn(`[armoury] saved view ${JSON.stringify(stored)} is no longer declared`
      + ` — opening on ${JSON.stringify(shapeDefault)}.`);
  }
  let view = (stored && IDS.includes(stored)) ? stored : shapeDefault;
  // WHICH PANES ARE FOLDED (#90). A preference about how you like your screen is
  // a preference, so it lives where preferences live — `meta.settings`, the same
  // free bag `equipView` rides in, keyed by region id. NO SAVE-SCHEMA CHANGE:
  // main.js already does `Object.assign(meta.settings, settingChange)`, so one
  // more key costs nothing.
  //
  // THE LIMIT, STATED RATHER THAN HIDDEN: the IN-COMBAT mount (combat.js) passes
  // a synthetic `meta` and no `onChange`, so there is nothing to read and nothing
  // to write — collapse is per-mount there. That is not new and it is not mine:
  // `equipView` is already per-mount at that call site for the same reason.
  const storedFolds = (meta.settings && meta.settings.armouryCollapsed) || null;
  const folded = new Map(contextRegions().map((r) => [r.id, opensCollapsed(r.id, storedFolds)]));
  let picking = null; // { slotId, setIndex }
  let notice = ''; // a refusal to show in place, cleared on the next draw

  // A `.modal-veil`, and not for the dimming — the same sentence `.qn-veil`
  // carries four files away, for the same reason. This panel mounts on <body>,
  // a SIBLING of #app, so input.js's scopeRoot() — which scopes the focus
  // cursor to the topmost `.modal-veil`, else #app — never saw it. Measured
  // before this line at ?shot=combat: ten focusable chips inside the open
  // panel, and forty-five arrow presses across four directions visited TWO
  // controls, both of them combat cards BEHIND it. A pad player could open
  // the Armoury and then drive the fight underneath it.
  //
  // It costs no pixels, and that is checkable rather than hopeful:
  // `.armoury-overlay` (ui.css) restates every one of `.modal-veil`'s six
  // declarations — position, inset, background, z-index, display, and the two
  // centring lines — and sits LATER in the same file, so it wins all six.
  // Measured both ways: veil and panel rects identical to the pixel.
  //
  // THE ONE THING THAT IS NOW LIVE AND WAS NOT: scopeRoot() picks the topmost
  // veil by DOM ORDER, and this one paints at z-index 60 while every other
  // veil is 500. No path today opens a 500 veil under an open Armoury — both
  // mounts (main.js showArmoury, combat.js #combat-armoury) run with nothing
  // else standing, and the quick-nav's armoury row closes itself after the
  // mount — so paint order and DOM order agree everywhere I could reach. If a
  // future screen opens one over the other, the focus cursor will drive the
  // panel underneath. Named here because the class is what makes it possible.
  const wrap = document.createElement('div');
  wrap.className = 'modal-veil armoury-overlay';
  const customEquippedTagColor = equippedTagColor(eq.armouryUi);
  wrap.style.setProperty('--equip-equipped-tag-color', customEquippedTagColor || 'var(--gold)');
  host.appendChild(wrap);

  // One teardown home for the listener this mount owns outside its subtree.
  // The 2026-08-23 disclosure correction removed the hold grips and their
  // window listeners; Escape still has to leave through every close road.
  const close = () => {
    document.removeEventListener('keydown', onKey);
    wrap.remove();
    if (onClose) onClose();
  };

  // Tap outside to close — the same three lines the other FIVE veils in this
  // game carry, verbatim (piles.js:36, quicknav.js:182, overlay.js:269,
  // settings.js:860, debuglog.js:214). The Armoury was the sixth and the only
  // one that did not, so a habit the game teaches on five panels failed on the
  // one opened mid-fight.
  //
  // I nearly ruled the other way, and the measurement is why I did not.
  // Against it: on a phone there is barely any backdrop to tap — 7.8 px of
  // veil down each side and a 33.77 px band top and bottom at 390x844, all
  // four under the tap floor, so this is NOT the phone's exit. The ✕ is, and
  // it is pinned and floored. For it: the same measurement says the accident
  // it risks is just as small, on desktop the strips are 24-60 px and a mouse
  // hits them on purpose, and — the part that decided it — ESCAPE ALREADY
  // CLOSES THIS PANEL WITH NO CONFIRMATION. The game already treats leaving
  // the Armoury as free. This adds no new loss; it gives the same free act a
  // channel a phone and a mouse have and a keyboard does not.
  //
  // `ev.target === wrap` is load-bearing: a click that started on the panel
  // and bubbled must not close it.
  wrap.addEventListener('click', (ev) => {
    if (ev.target === wrap) close();
  });


  // THE ARMOURY IS AN INVENTORY (#90). What the picker offers is what the
  // profile HAS, and that is one predicate with one home in the model — the
  // three gates that used to live in this file (unlock, reveal:'hidden',
  // requireFound) collapse into `owned.has(piece)`. Read the block above
  // `ownership()` in model/loadout.js for why it moved rather than shrank.
  //
  // `requireFound` DID NOT CHANGE MEANING and that is deliberate. It has always
  // said "you must have found it to own it"; what changed is what the screen
  // does with a piece you do not own, which was never that field's business.
  // Turning it off is still the sandbox it was documented as: everything is
  // owned, so the picker offers everything, with no second field to remember.
  //
  // Recomputed per draw, not per mount: `carriedIds` feeds it, and equipping
  // moves ids between storage and sets while this panel is open.
  const owned = () => ownership(registries, { meta, loadout: run.loadout });
  const ladderCtx = () => ({ meta, loadout: run.loadout });
  let draggingItemId = null;

  /** Every piece the CONTENT has for this slot, owned or not. Does it exist? */
  function authoredFor(slot) {
    return slot.kinds.includes('armor')
      ? (eq.armour || []).filter((o) => o.classId === run.class && fitsSlot(slot, o))
      : (eq.armaments || []).filter((a) => fitsSlot(slot, a));
  }

  /** Every piece you may put in it right now. Do you have it? */
  function eligible(slot) {
    // fitsSlot is the model's gate, and the same one equipPiece enforces — the
    // picker must never offer a piece the mutation will refuse. Ownership is now
    // the second half of that same sentence.
    const mine = owned();
    return authoredFor(slot).filter((p) => mine.has(p));
  }

  /** One mutation path for picker buttons and Inventory drag/drop. */
  function applyEquipmentChange(slotId, setIndex, pieceId, actionLabel) {
    const changed = equipPiece(
      registries, run.loadout, slotId, setIndex, pieceId, owned(),
      { inCombat, attributes: run.attributes }
    );
    if (!changed) {
      notice = `${actionLabel} was refused. The loadout was not changed.`;
      draw();
      return false;
    }
    sfx.play('cardPlay');
    commit();
    return true;
  }

  function equipmentRowFor(piece) {
    return inventoryRows(registries, run, meta).find((row) => row.item === piece) || null;
  }

  function comparisonFor(slotId, setIndex, pieceId) {
    return equipmentSurfaceReceipt(registries, run, {
      candidate: { slotId, setIndex, pieceId },
      meta,
    }).candidate;
  }

  /** Prefer what an item is equipped in, then the selected slot, then its first fit. */
  function inventoryTarget(row) {
    if (!row || !row.item || !['Armour', 'Weapon', 'Shield', 'Staff', 'Armament'].includes(row.category)) return null;
    const slots = (eq.slots || []).filter((slot) => fitsSlot(slot, row.item));
    if (!slots.length) return null;
    for (const slot of slots) {
      const index = (run.loadout.sets[slot.id] || []).findIndex((id) => id === row.id);
      if (index >= 0) return { slot, setIndex: index, pieceId: null, equipped: true };
    }
    const selected = picking && slots.find((slot) => slot.id === picking.slotId);
    const slot = selected || slots[0];
    return {
      slot,
      setIndex: selected ? picking.setIndex : (run.loadout.active[slot.id] || 0),
      pieceId: row.id,
      equipped: false,
    };
  }

  function slotBlock(slot) {
    const box = document.createElement('div');
    box.className = 'equip-slot';
    const rule = canSwap(registries, slot.id, { inCombat });
    box.innerHTML =
      `<div class="es-head"><span class="es-label">${esc(slot.label)}</span>` +
      // The badge word comes from the verdict it belongs to (#98). It was the
      // literal 'sealed' typed here while canSwap supplied only the tooltip, so
      // the one word a player reads had no home and nothing could compare it to
      // canEquip's sentence — which is exactly how the two came to share it.
      (rule.ok ? '' : `<span class="es-sealed" title="${esc(rule.reason)}">${esc(rule.word)}</span>`) +
      `</div><div class="es-sets"></div>`;
    const sets = box.querySelector('.es-sets');

    // THE LADDER (#90). `open` · `next` · `hidden`, derived from two integers
    // against the cell's index — never written on a cell. The model owns the
    // arithmetic (setCellState); this loop only draws what it is told, which is
    // why there is no state here that the model cannot produce.
    const opened = openedSets(registries, slot, ladderCtx());
    const visible = visibleSets(registries, slot, ladderCtx());

    (run.loadout.sets[slot.id] || []).forEach((itemId, i) => {
      const state = setCellState(i, opened, visible);
      if (state === 'hidden') return;
      if (state === 'next') {
        // THE ONE REFUSAL LEFT IN THIS SCREEN once the picker holds only what
        // you own. Its words are the RUNG'S OWN — `name` and `hint` from
        // unlocks.csv — because a reason invented here would be a sentence with
        // no author and no home. visibleSets() only shows this cell when a rung
        // exists, so refuses() can never be handed an empty reason.
        const rung = rungFor(registries, slot, i);
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'es-cell locked';
        cell.innerHTML = `<span class="es-lock">🔒</span><span>${esc(rung.name)}</span>`;
        refuses(cell, () => rung.hint);
        sets.appendChild(cell);
        return;
      }
      const active = (run.loadout.active[slot.id] || 0) === i;
      const piece = itemId
        ? (slot.kinds.includes('armor')
          ? (eq.armour || []).find((o) => o.classId === run.class && o.id === itemId)
          : (eq.armaments || []).find((a) => a.id === itemId))
        : null;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `es-cell${active ? ' on' : ''}${piece ? '' : ' empty'}`;
      cell.title = piece ? piece.name : 'Empty';
      cell.innerHTML = piece
        ? `<img src="${esc(thumbSrc(piece))}" alt=""><span>${esc(piece.name)}</span>`
        : `<span class="es-empty">＋</span>`;
      const im = cell.querySelector('img');
      if (im) im.addEventListener('error', () => { im.replaceWith(Object.assign(document.createElement('span'), { textContent: '⚔' })); });

      cell.addEventListener('dragover', (ev) => {
        const dragged = (eq.armaments || []).find((candidate) => candidate.id === draggingItemId)
          || (eq.armour || []).find((candidate) => candidate.classId === run.class && candidate.id === draggingItemId);
        if (!dragged || !fitsSlot(slot, dragged)) return;
        ev.preventDefault();
        if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
        cell.classList.add('drop-ready');
      });
      cell.addEventListener('dragleave', () => cell.classList.remove('drop-ready'));
      cell.addEventListener('drop', (ev) => {
        cell.classList.remove('drop-ready');
        const pieceId = (ev.dataTransfer && (ev.dataTransfer.getData('application/x-ashenspire-item')
          || ev.dataTransfer.getData('text/plain'))) || draggingItemId;
        const dragged = (eq.armaments || []).find((candidate) => candidate.id === pieceId)
          || (eq.armour || []).find((candidate) => candidate.classId === run.class && candidate.id === pieceId);
        if (!dragged || !fitsSlot(slot, dragged)) return;
        ev.preventDefault();
        picking = { slotId: slot.id, setIndex: i };
        applyEquipmentChange(slot.id, i, pieceId, `Equip ${dragged.name} to ${slot.label}`);
      });

      cell.addEventListener('click', () => {
        // Clicking a set you're not in switches to it; clicking the one you're
        // already in opens the picker. Same square, two jobs, no extra chrome.
        if (!active) {
          if (!rule.ok) { notice = rule.reason; draw(); return; }
          if (onSwap) {
            // In combat the swap is the engine's to allow or refuse — it may
            // say no because the energy isn't there, and the player should be
            // told that in the panel rather than in the console.
            const refused = onSwap(slot.id, i);
            if (refused) { notice = refused; draw(); }
            return;
          }
          cycleSet(registries, run.loadout, slot.id, i, { meta, inCombat });
          sfx.play('cardPlay');
          commit();
        } else {
          // OPENING THE PICKER IS NOT A MUTATION (#95). Constantine: "I think you
          // should be able to see your inventory in combat, just have the slots
          // locked in combat only." This branch used to read `else if (!inCombat)`
          // — the picker simply never opened mid-fight, so the inventory was not
          // hidden by a rule, it was hidden by an omission, and the same omission
          // was the ONLY thing stopping a mid-fight re-arm. Both halves are now
          // separated: the panel opens and shows you everything you own, and the
          // seal lives on the mutation (canEquip → equipPiece in model/loadout.js).
          picking = picking && picking.slotId === slot.id && picking.setIndex === i ? null : { slotId: slot.id, setIndex: i };
          draw();
        }
      });
      sets.appendChild(cell);
    });
    return box;
  }

  function pickerBlock() {
    const box = document.createElement('div');
    box.className = 'equip-picker';
    if (!picking) {
      // DERIVED FROM STATE, NOT AUTHORED (#90 follow-on, Freja). The picker with
      // no selection holds one italic line and, once the context pane folds, up
      // to 420 CSS px of nothing under it. `data-empty` is that condition said
      // once, here, where it is already known — the stylesheet then gives the
      // region a shape instead of a top edge. It cannot be set when a list is
      // present, which is the whole reason it is not a class someone maintains.
      box.dataset.empty = '1';
      box.innerHTML = inCombat
        ? '<p class="ep-hint">Pick a slot above to see what you are carrying.</p>'
        : '<p class="ep-hint">Pick a slot above to change what is in it.</p>';
      return box;
    }
    const slot = eq.slots.find((s) => s.id === picking.slotId);
    // ONE SENTENCE, ONE HOME. The seal's words are the model's (canEquip), the
    // same place the mutation reads them from, so the reason a chip gives when
    // it is tapped and the reason printed over the list cannot come apart. This
    // header line is the sentence said ONCE for the whole list — sixteen chips
    // each repeating it is a wall, and the chips still answer a tap individually
    // through refuses(), which is the property that actually failed on his phone.
    const seal = canEquip(registries, picking.slotId, { inCombat });
    box.innerHTML = '<h4>Inventory</h4>'
      + (seal.ok ? '' : `<p class="ep-hint">${esc(seal.reason)}</p>`)
      + '<div class="ep-list"></div>';
    const list = box.querySelector('.ep-list');

    // A CHIP IS DRAWN THE SAME WAY WHETHER OR NOT IT REFUSES, and the refusal is
    // added here rather than passed in. #90 deleted pieceChip's `locked`/`hint`
    // arguments because a dead argument is a second copy of a decision; putting
    // them back would be that copy with a caller. So pieceChip still only knows
    // how to draw a piece, and this function — which is where the seal is known —
    // decorates. `.equip-chip.locked` in styles/ui.css has styled nothing since
    // #90; it is the rule for "a chip you can see and cannot use", which is
    // exactly this, so it is reused rather than joined by a second one.
    const sealChip = (el) => {
      el.classList.add('locked');
      refuses(el, () => seal.reason);
      return el;
    };

    // ---- THE CARD IS THE CONTROL (Constantine, 2026-08-21) -----------------
    //
    // His two sentences, and the second corrects the first, so both are kept:
    //   "each item should be folded panes that can expand, the sub button
    //    should exist. clicking on the armory item pane should auto expand it
    //    with a button to equip (un equip in red if it's already equipped)"
    //   "the sub button under the folded weapon army item pane should NOT
    //    exist. it should be part of the card and is revealed pressing the card
    //    instead"
    //
    // So: ONE gesture on ONE surface. The card is the face; pressing it reveals
    // the comparison it always drew plus the single act you can take on it.
    //
    // MOUNTED, NOT BUILT. This is Sunna's disclosure renderer (D26,
    // components/disclosure.js) — the same one the creation screen and the shop
    // mount. tools/onefold.mjs counts the files that CONSTRUCT that affordance's
    // markup and declares ONE; a fold hand-rolled here would have made it two,
    // which is the debt that tool exists to hold at zero. What this act needed
    // from her component was one additive capability — a face may be a NODE —
    // because a card is art plus four spans and her faces were escaped text.
    // FLAGGED FOR HER RULING on the PR: the grammar is untouched (one open at a
    // time, the panel under the pressed row, the same aria contract), and the
    // revert is deleting the two guarded branches in drawFace/setValue.
    //
    // "BARE" IS GONE, AND THAT IS A COLLAPSE, NOT A LOSS. It was a chip whose
    // whole job was "put nothing here", which is exactly what Unequip does on
    // the card that is already in the slot. Two controls for one act is the
    // second copy this seat exists to refuse; with the slot empty there is no
    // equipped card, and there was nothing for Bare to undo either.
    //
    // A SEALED PIECE STILL OPENS. `canEquip` refuses mid-fight, and refusing the
    // READING as well would take away the compare he asked the card to carry
    // ("the card should be the button for compare and stats"). The face opens;
    // the ACT inside it refuses, with the model's own sentence.
    const current = (run.loadout.sets[picking.slotId] || [])[picking.setIndex];
    const equippedHands = (pieceId) => eq.slots
      .filter((candidate) => slotHand(candidate))
      .filter((candidate) => (run.loadout.sets[candidate.id] || []).some((id) => id === pieceId))
      .map((candidate) => candidate.label);
    const entries = eligible(slot).map((piece) => {
      const equipped = piece.id === current;
      const hands = [...new Set(equippedHands(piece.id))];
      const moving = !equipped && hands.length > 0;
      const candidatePieceId = equipped ? null : piece.id;
      const actionLabel = equipped
        ? 'Unequip'
        : `${moving ? 'Move' : 'Equip'} to ${slot.label}`;
      // `meta` is handed over because the swap-price rows are priced with the
      // LIVE rule (Settings › Advanced › Weapon swap cost). Omitting it would
      // price them with the shipping default and read as plausible — the row
      // carries the rule it used (`ruleId`) so that stays readable either way.
      const comparison = comparisonFor(picking.slotId, picking.setIndex, candidatePieceId);
      const transition = equipTransitionReceipt(
        registries, run.loadout, picking.slotId, picking.setIndex, candidatePieceId
      );

      const btn = document.createElement('button');
      btn.type = 'button';
      // "un equip in red" — `.danger` is this stylesheet's own word for red
      // (styles/ui.css `.subtle.danger`, `--blood`/`--ember`), so the colour is
      // named where colour is decided rather than typed here. THE WORD AND THE
      // COLOUR ARE TWO CHANNELS and the check reads both: a control that says
      // Unequip in the ordinary colour satisfies half his sentence.
      btn.className = equipped ? 'ep-equip danger' : 'ep-equip';
      btn.dataset.act = equipped ? 'unequip' : 'equip';
      btn.textContent = actionLabel;
      // One visible action, inside the open card. The 2026-08-23 correction
      // removed the always-visible hold shortcut so a folded item is one row,
      // not a row followed by a second action-shaped row.
      const act = () => applyEquipmentChange(picking.slotId, picking.setIndex, candidatePieceId, actionLabel);
      if (!seal.ok) sealChip(btn);
      else if (!transition.ok) {
        btn.classList.add('locked');
        refuses(btn, () => transition.reason);
      } else btn.addEventListener('click', act);

      const row = equipmentRowFor(piece);

      return {
        key: piece.id,
        kind: 'item',
        disclosure: 'face',
        equipped,
        actionLabel,
        face: {
          label: piece.name,
          node: inventoryFace(row, { selected: equipped }),
        },
        reveal: {
          node: inventoryReveal(registries, row, {
            comparison,
            action: btn,
            instruction: `Compare this item for ${slot.label}.`,
          }),
          sense: equipped
            ? 'Equipped. Press to unequip.'
            : moving
              ? `Equipped in ${hands.join(' / ')}. Press to move to ${slot.label}.`
              : `Press to compare and equip to ${slot.label}.`,
        },
      };
    });

    const fold = mountDisclosure(list, entries, { moreLabel: 'more' });
    // The 2026-08-23 correction removes the always-visible hold strip.
    // The face owns disclosure only; the single action remains inside the
    // adopted reveal node and therefore exists on glass only while open.
    // Clicking the title again is mountDisclosure's ordinary refold.
    box.addEventListener('click', (ev) => {
      if (!ev.target.closest('.ep-list')) fold.close();
    });
    // WHICH CARD IS THE ONE YOU ARE WEARING, published on the face itself.
    // Written after mount because the renderer owns the button; read by
    // tools/armoury-picked-up.mjs, which must find the equipped card WITHOUT
    // knowing the loadout — a probe that recomputed "which one is equipped"
    // would agree with a bug as happily as with the truth.
    for (const entry of entries) {
      const face = list.querySelector(`[data-face="${CSS.escape(entry.key)}"]`);
      if (face && entry.equipped) face.dataset.equipped = '1';
    }
    if (!entries.length) {
      list.insertAdjacentHTML('beforeend',
        '<p class="ep-hint">Nothing you are carrying fits this slot yet.</p>');
    }
    return box;
  }

  /** The no-selection shelf: all currently usable item kinds, folded by row. */
  function inventoryBlock() {
    const box = document.createElement('div');
    box.className = 'inventory-list ep-list';
    const rows = inventoryRows(registries, run, meta);
    const entries = rows.map((row) => {
      const target = inventoryTarget(row);
      const draggable = !!target;
      const face = inventoryFace(row, { draggable });
      if (draggable) {
        face.addEventListener('dragstart', (ev) => {
          draggingItemId = row.id;
          face.classList.add('dragging');
          if (ev.dataTransfer) {
            ev.dataTransfer.effectAllowed = 'move';
            ev.dataTransfer.setData('application/x-ashenspire-item', row.id);
            ev.dataTransfer.setData('text/plain', row.id);
          }
        });
        face.addEventListener('dragend', () => {
          draggingItemId = null;
          face.classList.remove('dragging');
          for (const cell of wrap.querySelectorAll('.es-cell.drop-ready')) cell.classList.remove('drop-ready');
        });
      }
      return {
        key: row.key,
        kind: 'item',
        disclosure: 'face',
        face: { label: row.name, node: face },
        reveal: {
          node: inventoryReveal(registries, row, {
            comparison: target ? comparisonFor(target.slot.id, target.setIndex, target.pieceId) : null,
            instruction: target ? 'Drag this item onto a compatible slot, or select a slot to use its action button.' : '',
          }),
          sense: `${row.name}. ${row.category}. ${row.count} owned.`,
        },
      };
    });
    mountDisclosure(box, entries, { moreLabel: 'more items' });
    box.dataset.inventoryCount = String(inventoryItemCount(rows));
    if (!entries.length) box.insertAdjacentHTML('beforeend', '<p class="ep-hint">Inventory is empty.</p>');
    return box;
  }

  /** The rewrites, live: the actual cards this loadout produces right now. */
  function cardStrip() {
    const box = document.createElement('div');
    box.className = 'equip-cards';
    const surface = equipmentSurfaceReceipt(registries, run);
    const shown = new Set();
    for (const inst of run.deck || []) {
      const key = inst.equipmentRole || `signature:${inst.cardId}`;
      if (shown.has(key)) continue;
      shown.add(key);
      const card = document.createElement('div');
      card.className = 'equip-card-with-count';
      card.appendChild(renderCard(registries, inst, { small: true }));
      const count = document.createElement('em');
      count.className = 'role-copy-count';
      count.textContent = `x${inst.equipmentRole ? surface.roleCopies[inst.equipmentRole] : surface.signature.copies}`;
      card.appendChild(count);
      box.appendChild(card);
    }
    const receipt = document.createElement('div');
    receipt.className = 'equip-role-receipts';
    receipt.innerHTML = surface.roles.map((row) => `<div data-role="${esc(row.role)}"><b>${esc(row.profile.displayName)} <em class="role-copy-count">x${row.copies}</em></b>`
      + `<span>${row.receipt.base} base + ${row.receipt.tier} tier × ${row.receipt.gainPerTier}`
      + ` + ${row.receipt.rarityBonus} rarity = <strong>${row.receipt.value}</strong></span>`
      + `<small>${esc(row.profile.damageSchool)} · ${(row.profile.tags || []).map(esc).join(' · ')}</small></div>`).join('');
    receipt.insertAdjacentHTML('beforeend', renderEquipmentRequirements(surface.requirements));
    receipt.insertAdjacentHTML('beforeend', renderPlayerPoise(surface.poise));
    box.appendChild(receipt);
    const rm = runMods(registries, run.loadout, run.class);
    const bits = [];
    if (rm.maxHp) bits.push(`Max HP ${rm.maxHp > 0 ? '+' : ''}${rm.maxHp}`);
    if (rm.maxMana) bits.push(`Max Mana ${rm.maxMana > 0 ? '+' : ''}${rm.maxMana}`);
    if (rm.maxStamina) bits.push(`Max Stamina ${rm.maxStamina > 0 ? '+' : ''}${rm.maxStamina}`);
    for (const s of rm.startStatuses) bits.push(`${registries.statuses.get(s.status).name} ${s.stacks}`);
    const tags = loadoutTags(registries, run.loadout, run.class);
    const foot = document.createElement('div');
    foot.className = 'equip-foot';
    foot.innerHTML =
      `<span class="ef-tags">${tags.map((t) => `<em>${esc(t)}</em>`).join('') || '<em class="none">no tags</em>'}</span>` +
      (bits.length ? `<span class="ef-run">${bits.map(esc).join(' · ')}</span>` : '');
    box.appendChild(foot);
    return box;
  }

  function statsComparison() {
    const projection = statProjection(registries, run);
    const box = document.createElement('section');
    box.className = 'armoury-stats';
    box.innerHTML = '<h3>ATTRIBUTES &amp; RESOURCES</h3>'
      + `<div class="statproj-attributes">${projection.attributes.map((row) => `<span><b>${esc(row.shortLabel)}</b> ${row.value}</span>`).join('')}</div>`
      + `<div class="statproj-derived">${projection.derived.map((row) => `<div data-stat="${esc(row.id)}"><b>${esc(row.label)}</b><span>${esc(row.formula)}</span>${row.note ? `<small>${esc(row.note)}</small>` : ''}</div>`).join('')}</div>`;
    return box;
  }

  function commit() {
    // Every loadout mutation lands here, so this is the one wire for the
    // growth chain's talisman source (model/flaskgrowth.js): a worn growth
    // talisman grows the maximum on equip and shrinks it back on unequip.
    // Idempotent, and a no-op until the first talisman growth row is authored.
    syncFlaskGrowth(registries, run);
    if (onChange) onChange(run.loadout);
    draw();
  }

  /**
   * Every region says what it is, and every CONTEXT region gets its control.
   *
   * DERIVED, NOT AUTHORED PER PANE. Nothing below names `cards` or `strip`: the
   * subject is marked because the author pointed at it, and the control exists
   * because a region is not the subject. Add a third region tomorrow and it is
   * dressed the same way with no edit here — and if the author moves `subject`
   * to it, the control moves with it.
   *
   * WHAT A COLLAPSED PANE MUST STILL SAY (Freja's floor, and the model's half of
   * it): it keeps its own header, so it still names itself, still says how much
   * is inside, and still carries the control that brings it back. A pane that
   * folds to nothing is a pane the player cannot find again — *decoration that
   * decorates nothing*, which is the live risk of this whole feature.
   *
   * The attributes are `data-region` / `data-role` / `data-collapsed`, NOT the
   * #78 `data-surface` / `data-member` convention, and the reason is a finding
   * rather than a preference: that convention is queried as
   * `[data-surface=X] [data-member]` — a DESCENDANT query, which does not
   * compose under nesting. `armouryView`'s host sits INSIDE `.armoury`, so a
   * region surface on `.armoury` would enumerate the three view buttons as its
   * own members. The convention has no answer for a set that contains another
   * set, and the armoury is where that first bites.
   */
  function dressRegions() {
    const subject = subjectRegion();
    for (const r of REGIONS) {
      const el = wrap.querySelector(r.sel);
      if (!el) continue;
      el.dataset.region = r.id;
      const isSubject = !!subject && r.id === subject.id;
      el.dataset.role = isSubject ? 'subject' : 'context';
      if (isSubject) { delete el.dataset.collapsed; continue; }
      const shut = folded.get(r.id) === true;
      el.dataset.collapsed = shut ? '1' : '0';

      const head = document.createElement('div');
      head.className = 'region-head';
      const n = r.count(el);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'region-fold';
      btn.dataset.fold = r.id;
      btn.setAttribute('aria-expanded', shut ? 'false' : 'true');
      // LAW 3 CLAUSE 4 — a control ships with a contextual tooltip or it is a
      // defect, and `title=` alone does NOT satisfy it: touch and gamepad players
      // never see one. The law's own words, and I wrote `data-tip` here first —
      // an attribute NOTHING in this tree reads, under a comment claiming the
      // clause was met. attachTooltip is the mechanism (pointer AND the pad's
      // gpfocus), so this is the mechanism, not an attribute that looks like it.
      const say = () => `<div class="tt-title">${esc(shut ? `Show ${r.label}` : `Hide ${r.label}`)}</div>`
        + esc(shut
          ? `${r.count(el)} ${r.unit}${r.count(el) === 1 ? '' : 's'} in here.`
          : `Folds away, so ${subject ? subject.label.toLowerCase() : 'the main pane'} get the room.`);
      btn.title = shut ? `Show ${r.label.toLowerCase()}` : `Hide ${r.label.toLowerCase()}`;
      attachTooltip(btn, say);
      btn.innerHTML = `<span class="rf-caret">${shut ? '▸' : '▾'}</span>`
        + `<span class="rf-label">${esc(r.label)}</span>`
        + `<span class="rf-count">${n} ${esc(r.unit)}${n === 1 ? '' : 's'}</span>`;
      btn.addEventListener('click', () => {
        folded.set(r.id, !folded.get(r.id));
        // The whole map goes back, not just the one that moved: a partial write
        // would make `meta.settings.armouryCollapsed` disagree with the screen
        // for every other region. One fact, one home.
        if (onChange) onChange(run.loadout, { armouryCollapsed: Object.fromEntries(folded) });
        draw();
        // draw() replaces the activated header. Put keyboard/gamepad focus on
        // its replacement so expanding a region does not throw the player out
        // of the control they just used.
        wrap.querySelector(`[data-fold="${r.id}"]`)?.focus();
      });
      head.appendChild(btn);
      el.insertBefore(head, el.firstChild);
    }
  }

  function draw() {
    // The layout is READ off the row, never inferred from the id. `data-surface`
    // / `data-member` are the house convention for a navigable set (#78): the
    // host names the set, each control names its member, so an instrument can
    // enumerate this from the rendered page without importing anything.
    const L = viewLayout(view);
    wrap.innerHTML = `
      <div class="armoury${picking ? ' picking' : ''}" data-figure="${L && L.figure ? '1' : '0'}" data-slots="${esc((L && L.slots) || 'none')}" data-view="${esc(view)}">
        <header class="armoury-head">
          <h2>ARMOURY</h2>
          <div class="armoury-views" data-surface="armouryView">
            ${viewIds().map((v) => `<button type="button" data-member="${esc(v)}" class="${v === view ? 'on' : ''}">${esc(v)}</button>`).join('')}
          </div>
          <button type="button" class="armoury-close" title="Close (Esc)">✕</button>
        </header>
        ${notice ? `<p class="armoury-notice">${esc(notice)}</p>` : ''}
        <div class="armoury-body">
          <div class="armoury-left"></div>
          <div class="armoury-right"></div>
        </div>
        <section class="armoury-inventory"></section>
        <div class="armoury-strip"></div>
      </div>`;

    const left = wrap.querySelector('.armoury-left');
    const right = wrap.querySelector('.armoury-right');
    const blocks = eq.slots
      // A slot with nothing that fits it isn't a slot yet: Talisman is declared
      // in equipSlots.csv but has no pieces authored, and three empty squares
      // read as broken rather than as a promise. It appears the day a talisman
      // row exists.
      //
      // AND THIS TEST HAD TO SPLIT IN TWO (#90). It used to ask `eligible(slot)`,
      // which then meant "pieces that fit, locked ones included". Once eligible()
      // means "pieces you OWN", the same line hides the Right Hand from a fresh
      // profile — because an empty inventory owns nothing — and the armoury
      // Constantine called *"more like an empty inventory"* would render with no
      // inventory in it. Two different questions had been sharing one call:
      //
      //   is this slot AUTHORED?  → does any piece in the content fit it
      //   what may go in it NOW?  → what the profile owns
      //
      // The first decides whether the square exists; the second fills the picker.
      // An empty square is the point of the screen; a square for a kind of thing
      // that does not exist yet is the defect the original line was written for.
      .filter((slot) => authoredFor(slot).length)
      .map((slot) => ({ slot, el: slotBlock(slot) }));

    // A LOOKUP, NOT A BRANCH. There is no `else` left to fall into: the cell
    // either has a builder or it has none, and none is a named failure. The
    // first pass turned the id into two characteristics and kept an if/else on
    // ONE of them — which is how a legal combination of the other reached a
    // branch that ignored it (Vira, gate of 5c49fed).
    const build = L && LAYOUTS[L.cell];
    if (build) {
      build(L, {
        left, right, blocks,
        figure: () => figureFor(registries, run, cz),
        picker: () => pickerBlock(),
      });
    } else {
      console.error(`[content] the armoury view ${JSON.stringify(view)} has no layout`
        + ` — its row must ask for a combination the screen has: ${viewCellsSay()}`
        + ' in src/content/balance.js. This line is the defect, not a fallback.');
      const dead = document.createElement('p');
      dead.className = 'armoury-notice';
      dead.textContent = `The "${view}" view is declared but has no layout. Pick another view above.`;
      right.appendChild(dead);
    }
    const inventory = wrap.querySelector('.armoury-inventory');
    if (inventory) inventory.appendChild(inventoryBlock());
    wrap.querySelector('.armoury-strip').appendChild(statsComparison());
    wrap.querySelector('.armoury-strip').appendChild(cardStrip());

    notice = '';
    dressRegions();
    wrap.querySelector('.armoury-close').addEventListener('click', close);
    for (const b of wrap.querySelectorAll('[data-surface="armouryView"] [data-member]')) {
      b.addEventListener('click', () => {
        view = b.dataset.member;
        if (onChange) onChange(run.loadout, { equipView: view });
        draw();
      });
    }
  }

  // The removal moved INTO `close()` — see the block there. Leaving a copy here
  // would be two homes for one teardown, disagreeing on every path but this one.
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);

  draw();
  return { close, redraw: draw };
}
