// src/ui/screens/equipment.js — the Armoury.
//
// Three views of the same loadout, because the two obvious layouts are both
// right for different things and neither should have to win:
//
//   grid    the full-width Character surface — summary/sprite left, stats right
//   rack    the full-width Inventory surface — armaments left, inventory right
//   hybrid  the shared 40/60 character and armaments shell
//
// The panel builds itself from registries.equipment.slots, so a new row in
// equipSlots.csv appears here with no change to this file. The card strip at
// the bottom is the whole point of the system made visible: pick up a dagger
// and watch Strike become 3×2 before you commit to it.

import { balance } from '../../content/balance.js';
import { resolveCard } from '../../model/registries.js';
import {
  canSwap, canEquip, cycleSet, equipPiece, equipTransitionReceipt, fitsSlot, cardMods, figureSpec,
  ownership, openedSets, visibleSets, rungFor, setCellState, slotHand, equippedPieces,
} from '../../model/loadout.js';
import { armamentIntrinsicReceipt, equipmentSurfaceReceipt } from '../../model/equipmentPresentation.js';
import { inventoryRows, inventoryItemCount } from '../../model/inventoryPresentation.js';
import { equippedTagColor } from '../../model/equipmentUi.js';
import { renderCard, relicText } from '../components/card.js';
import {
  renderCandidateComparison, renderEquipmentRequirements, renderPlayerPoise, renderPlayerLoad, renderRoleCopies,
} from '../components/equipmentReceipts.js';
import { esc, attachTooltip, showTooltipFor, stickTooltip } from '../components/tooltip.js';
import { armHold, holdMs, HOLD_POINTER_SLOP } from '../../framework/optionDecision.js';
import { refuses } from '../components/refusal.js';
import { playerSprite, equippedFigure } from '../assets.js';
import { assetUrl } from '../assetmap.js';
import { sfx } from '../sfx.js';
import { statProjection, pieceWeight } from '../../model/statProjection.js';
import { resolveUpgradedEquipment } from '../../model/itemUpgrades.js';
import { attributeCardModels } from '../../model/creationBrief.js';
import { syncFlaskGrowth } from '../../model/flaskgrowth.js';
import { closeFlaskActionMenu } from '../components/flask.js';
import { mountDisclosure } from '../components/disclosure.js';
import {
  equipmentPositionCardState, inventorySelectionAction, normalizeArmouryLayout,
  orderArmourySlots,
} from '../../model/armouryLayout.js';
import {
  armouryOverlayModel, armouryPanelModel, equipmentSetCellModel, equipmentSlotModel,
  inventoryItemCardModel, inventoryDetailCardModel,
} from '../models/ArmouryModels.js';
import {
  renderArmouryOverlay, renderArmouryPanel, renderEquipmentSlot,
  renderInventoryItemCard, renderInventoryDetailCard,
} from '../components/armouryComponents.js';
import { trayModel } from '../models/TrayModels.js';
import { renderTray } from '../components/trayComponents.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';
import { traySizeService } from '../services/TraySizeService.js';
import { FOLD_GLYPH } from '../components/foldGlyph.js';
// THE KIT (2026-09-04, the sweep): every piece inside the door is a kit builder
// — OptionCards for the positions, the inventory faces and the card rows,
// DetailCards for the character's numbers and the open item, StatPairs and
// KitLines for the facts, Flavour for the hints, a Blocker for a refusal —
// and styles/ui.css draws nothing for this screen any more.
import {
  el, eyebrow, titleS, subtitle, statusText, flavour, prose, pill, tagChip, artWell, detailCard, optionCard, options, optionGrid,
  face, row, button, chip, statStrip, kitLine, kitItem, blocker,
} from '../kit/index.js';

const CFG = () => balance.equipment;
const armouryTraySession = { folded: new Map(), heights: new Map() };
/** The view-toggle IconButton's glyph, by the view it switches TO. */
const VIEW_TOGGLE_GLYPH = Object.freeze({ grid: '⊞', list: '≡' });

export function resetArmouryTraySession() {
  armouryTraySession.folded.clear();
  armouryTraySession.heights.clear();
  traySizeService.reset();
}

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
  'figure:1|slots:flank': buildArmoury, // Grid keeps the shared shell
  'figure:1|slots:list': buildArmoury, // Hybrid keeps the shared shell
  'figure:0|slots:list': buildArmoury, // Rack keeps the shared shell
};

const ARMOURY_DESTINATIONS = Object.freeze({
  cards: Object.freeze({ view: 'grid', region: 'cards' }),
  equipment: Object.freeze({ view: 'rack', region: null }),
  character: Object.freeze({ view: 'grid', region: null }),
});

/** Translate a semantic action destination inside the Armoury boundary. */
export function armouryDestinationPlan(destination) {
  if (typeof destination !== 'string' || !Object.hasOwn(ARMOURY_DESTINATIONS, destination)) return null;
  return { ...ARMOURY_DESTINATIONS[destination] };
}

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
    count: (el) => el.querySelectorAll('[data-card-row]').length,
    unit: 'card',
  },
  {
    id: 'stats',
    label: 'Stats',
    sel: '.armoury-stats-tray',
    count: () => null,
    unit: 'summary',
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
export function opensCollapsed(regionId, stored, mode = null) {
  const s = stored && stored[regionId];
  if (typeof s === 'boolean') return s;
  if (mode && typeof mode[regionId] === 'string') return mode[regionId] !== 'expanded';
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

function buildArmoury(L, ui) {
  // Character is a character-only surface. Inventory is the Skyrim-like
  // equipment/inventory split. Hybrid is the authored 40/60 shell.
  if (ui.viewMode.pane === 'character' || ui.viewMode.pane === 'both') ui.left.appendChild(ui.character());

  const ordered = orderArmourySlots(ui.blocks.map((block) => block.slot), ui.layout);
  const positionsBySlot = ordered.map((slot) => ({
    slot,
    positions: ui.positions(slot).filter((position) => position.modelState !== 'hidden'),
  }));
  const itemCount = positionsBySlot.reduce((sum, row) => (
    sum + row.positions.filter((position) => position.state === 'occupied').length
  ), 0);
  // The positions are OptionCards: a column of them in the list view, a grid
  // of tiles per slot (the slot's label an Eyebrow) with one shared Details
  // card in the grid view.
  const slots = options([], { class: 'equip-slots armoury-position-list' });
  if (!ui.armamentsFolded && ui.armamentView === 'list') {
    for (const { slot, positions } of positionsBySlot) {
      slots.appendChild(ui.positionGroup(slot, positions, 'list'));
    }
  } else if (!ui.armamentsFolded) {
    slots.classList.add('armoury-position-grid-groups');
    for (const { slot, positions } of positionsBySlot) {
      const tiles = el('div', { class: 'armoury-position-grid-tiles' }, optionGrid([ui.positionGroup(slot, positions, 'grid')]));
      slots.appendChild(el('section', { class: 'armoury-position-grid-group', dataset: { equipmentGroup: slot.id } }, [eyebrow(slot.label), tiles]));
    }
    slots.appendChild(ui.armamentGridDetail(ordered));
  }
  const rendered = renderTray(trayModel({
    id: 'armaments',
    name: ui.layout.equipment.groupLabel,
    count: itemCount,
    itemType: 'item',
    edge: 'bottom',
    expanded: !ui.armamentsFolded,
    sortable: true,
    sortLabel: `Show Armaments as ${ui.armamentView === 'list' ? 'grid' : 'list'}`,
    resizable: false,
    items: [],
  }), {
    onToggle: ui.toggleArmaments,
    onSort: ui.toggleArmamentView,
    renderContent: (content) => content.appendChild(slots),
  });
  const equipment = rendered.element;
  equipment.classList.add('armoury-equipment');
  equipment.dataset.component = 'armoury.armamentsCard';
  equipment.dataset.armamentView = ui.armamentView;
  equipment.dataset.collapsed = ui.armamentsFolded ? '1' : '0';
  if (!ui.layout.equipment.outerBorder) equipment.dataset.outerBorder = 'off';
  rendered.header.classList.add('armoury-equipment-head');
  rendered.header.dataset.component = 'armoury.armamentsHeader';
  attachTooltip(rendered.fold, () => `<div class="tt-title">${ui.armamentsFolded ? 'Show' : 'Hide'} ${esc(ui.layout.equipment.groupLabel)}</div>`
    + `<p>${itemCount} equipped item${itemCount === 1 ? '' : 's'} across the authored equipment positions.</p>`);
  if (rendered.sort) {
    const next = ui.armamentView === 'list' ? 'grid' : 'list';
    rendered.sort.classList.add('armoury-card-view-toggle', 'armoury-armament-view-toggle');
    rendered.sort.dataset.component = 'armoury.armamentViewToggle';
    // The IconButton's glyph names the view it switches TO; the tooltip says it in words.
    rendered.sort.textContent = VIEW_TOGGLE_GLYPH[next];
    rendered.sort.setAttribute('aria-label', `Show Armaments as ${next}`);
    attachTooltip(rendered.sort, () => `<div class="tt-title">${esc(next === 'grid' ? 'Grid view' : 'List view')}</div><p>${esc(next === 'grid' ? 'Show compact position tiles and one shared Details pane.' : 'Show every equipment position as a full detail row.')}</p>`);
  }
  if (ui.viewMode.pane === 'inventory') ui.left.appendChild(equipment);
  if (ui.viewMode.pane === 'both') ui.right.appendChild(equipment);
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
/** A piece's thumbnail in an ArtWell; the art dies quietly if the file is
 *  missing — the single-file dist and file:// play both depend on this. */
function pieceArt(piece, fallback = '⚔') {
  const well = artWell({ src: thumbSrc(piece), alt: '', small: true });
  const image = well.querySelector('img');
  image.addEventListener('error', () => image.replaceWith(Object.assign(document.createElement('span'), { textContent: piece.icon || fallback })));
  return well;
}

/** The kit picker's chip (creation's starting kit): an OptionCard — art, name, mods, tags. `.ec-*` are the hooks the tools read. */
export function pieceChip(registries, piece, { selected }) {
  const mods = modSummary(registries, piece);
  const card = optionCard({
    art: pieceArt(piece),
    name: piece.name,
    description: mods.length ? mods.join(' · ') : '—',
    body: el('span', { class: 'tags ec-tags' }, (piece.tags || []).map((t) => tagChip({ label: t }))),
    selected, arrow: false,
    className: `equip-chip compact rarity-${piece.rarity || 'common'}${selected ? ' on' : ''}`,
  });
  card.querySelector('.on').classList.add('ec-name');
  card.querySelector('.od').classList.add('ec-mods');
  return card;
}

function inventoryFace(row, {
  selected = false, draggable = false, actionLabel = '', classModel = null,
} = {}) {
  const el = renderInventoryItemCard(inventoryItemCardModel(row, {
    selected, draggable, classModel,
  }));
  // While a position is selected the face says what the tap will do — a StatePill, lit.
  if (actionLabel) el.querySelector('.r-trail').appendChild(pill({ label: actionLabel, on: true, attrs: { class: 'inventory-inline-action' } }));
  return el;
}

function inventoryReveal(registries, row, {
  comparison = null, action = null, instruction = '', holdDuration = 0,
  registerHold = null, classModel = null, onClassAction = null, comparisonConfig = null,
} = {}) {
  const item = row.item;
  let art;
  if (row.category === 'Armour' || ['Weapon', 'Shield', 'Staff', 'Armament'].includes(row.category)) {
    art = { kind: 'image', value: thumbSrc(item) };
  } else if (item.artAsset) {
    art = { kind: 'image', value: assetUrl(item.artAsset) };
  } else {
    art = { kind: 'icon', value: item.icon || '◆' };
  }
  const description = row.category === 'Relic'
    ? relicText(item, registries)
    : (item.blurb || item.textTemplate || 'No additional information.');
  const mods = modSummary(registries, item);
  const detailModel = inventoryDetailCardModel({ row, art, description, mods, instruction, classModel });
  const comparisonPresentation = comparisonConfig?.presentation || 'tooltip';
  const comparisonHtml = comparison
    ? `<div data-ui-component="${UI.equipmentComparison}" data-ui-variant="${comparisonPresentation}"><div class="tt-title">Compare ${esc(item.name)}</div>${renderCandidateComparison(comparison, { expanded: true })}</div>`
    : '';
  const el = renderInventoryDetailCard(detailModel, {
    comparisonHtml: comparisonPresentation === 'inline' ? comparisonHtml : '',
    action,
  });
  el.dataset.inventoryItem = row.key;
  const cardOwnsAction = classModel?.holdAction === true && Boolean(onClassAction);
  if (comparison) {
    el.dataset.component = 'armoury.comparisonTooltipAnchor';
    el.tabIndex = 0;
    const actionVerb = action?.textContent?.trim() || 'equip this item';
    const actionInstruction = cardOwnsAction
      ? (holdDuration > 0
        ? ` Press and hold this card to ${actionVerb}.`
        : ` Activate this card to ${actionVerb}.`)
      : '';
    el.setAttribute('aria-label', comparisonPresentation === 'inline'
      ? `Compare ${item.name}. Comparison shown in this card.${actionInstruction}`
      : `Compare ${item.name}. Hover or focus this card to show comparison.${actionInstruction}`);
    const clear = el.closest('.disc-faces') || el.parentElement;
    const appearance = {
      variant: 'equipment-comparison',
      widthRem: comparisonConfig?.tooltipWidthRem,
      maxHeightRatio: comparisonConfig?.tooltipMaxHeightRatio,
    };
    if (comparisonPresentation === 'tooltip') attachTooltip(el, () => comparisonHtml, {
      intent: 'above',
      clear,
      delayMs: comparisonConfig?.hoverDelayMs,
      appearance,
    });
    if (comparisonPresentation === 'tooltip' && !cardOwnsAction) {
      const disarm = armHold(el, {
        ms: holdDuration,
        id: 'compareEquipment',
        onConfirm: () => {
          showTooltipFor(el, comparisonHtml, { intent: 'above', clear, appearance });
          stickTooltip(el);
        },
      });
      if (registerHold) registerHold(disarm);
    }
  }
  if (cardOwnsAction) {
    // Expanded cards are div-based composite controls, so opt them into the
    // same keyboard/gamepad focus cursor that already reaches folded buttons.
    // armHold then supplies the identical gppress/gprelease action contract.
    el.dataset.focusable = 'true';
    el.setAttribute('role', 'button');
    const disarm = armHold(el, {
      ms: holdDuration,
      id: 'equipInventory',
      onConfirm: onClassAction,
      feedbackHosts: () => {
        const reveal = el.closest('.disc-reveal');
        const faces = el.closest('.disc-faces');
        const faceButton = [...(faces?.children || [])]
          .find((candidate) => candidate.dataset?.face === row.key);
        return [reveal, faceButton?.querySelector('.inventory-face')];
      },
    });
    if (registerHold) registerHold(disarm);
  }
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
  registries, run, meta = {}, destination = '', inCombat: inCombatArg, onClose, onChange, onSwap, onEquipmentChanged,
}) {
  const destinationPlan = destination ? armouryDestinationPlan(destination) : null;
  if (destination && !destinationPlan) {
    console.error(`mountEquipment(): unknown action destination ${JSON.stringify(destination)}; refusing to open.`);
    return null;
  }
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
  const layout = normalizeArmouryLayout(eq.armouryUi && eq.armouryUi.layout);
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
  let view = destinationPlan?.view || ((stored && IDS.includes(stored)) ? stored : shapeDefault);
  const viewMode = () => layout.viewModes[view] || { label: view, pane: 'both', character: 'folded', armaments: 'folded', inventory: 'folded', cards: 'folded' };
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
  const storedFolds = armouryTraySession.folded.size
    ? Object.fromEntries(armouryTraySession.folded) : null;
  const folded = new Map(contextRegions().map((r) => [r.id, opensCollapsed(r.id, storedFolds, viewMode())]));
  folded.set('armaments', opensCollapsed('armaments', storedFolds, viewMode()));
  if (destinationPlan?.region) folded.set(destinationPlan.region, false);
  const clampTrayHeight = (value) => Math.min(
    layout.trays.maximumHeightRatio,
    Math.max(layout.trays.minimumHeightRatio, Number(value)),
  );
  const trayHeights = new Map(contextRegions().map((region) => [
    region.id,
    clampTrayHeight(Number.isFinite(Number(armouryTraySession.heights.get(region.id)))
      ? Number(armouryTraySession.heights.get(region.id)) : layout.trays.defaultHeightRatio),
  ]));
  let cardView = layout.cards.defaultView;
  const storedArmamentView = meta.settings && meta.settings.armouryArmamentView;
  let armamentView = ['list', 'grid'].includes(storedArmamentView)
    ? storedArmamentView : layout.equipment.defaultView;
  let armamentGridSelection = null;
  let picking = null; // { slotId, setIndex }
  let notice = ''; // a refusal to show in place, cleared on the next draw
  const clampPaneRatio = (value) => Math.min(
    layout.inventorySplit.maximumArmamentsRatio,
    Math.max(layout.inventorySplit.minimumArmamentsRatio, Number(value)),
  );
  const savedPaneRatio = meta.settings && Number(meta.settings.armouryPaneRatio);
  let paneRatio = clampPaneRatio(Number.isFinite(savedPaneRatio)
    ? savedPaneRatio : layout.inventorySplit.defaultArmamentsRatio);
  const savedHybridRatio = meta.settings && Number(meta.settings.armouryHybridRatio);
  let hybridRatio = clampPaneRatio(Number.isFinite(savedHybridRatio)
    ? savedHybridRatio : layout.shell.characterRatio);
  let paneObserver = null;
  let inventoryDisclosure = null;
  let holdDisarms = [];
  const clearHoldDisarms = () => {
    for (const disarm of holdDisarms.splice(0)) disarm();
  };
  const registerHold = (disarm) => holdDisarms.push(disarm);

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
  const customEquippedTagColor = equippedTagColor(eq.armouryUi);
  const overlayPanelModel = armouryPanelModel({
    view,
    views: viewIds(),
    viewLabels: Object.fromEntries(Object.entries(layout.viewModes).map(([id, mode]) => [id, mode.label || id])),
    layout: viewLayout(view),
    subject: 'slots',
  });
  const wrap = renderArmouryOverlay(armouryOverlayModel({
    panel: overlayPanelModel,
    equippedTagColor: customEquippedTagColor,
  }));
  host.appendChild(wrap);

  // One teardown home for the listener this mount owns outside its subtree.
  // The 2026-08-23 disclosure correction removed the hold grips and their
  // window listeners; Escape still has to leave through every close road.
  const close = () => {
    document.removeEventListener('keydown', onKey);
    if (paneObserver) paneObserver.disconnect();
    clearHoldDisarms();
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
    if (ev.target === wrap) { close(); return; }
    if (!picking) return;
    if (ev.target.closest('.armoury-close, [data-surface="armouryView"]')) return;
    if (ev.target.closest('.armoury-inventory, [data-slot-position]')) return;
    clearInventorySelection();
    if (onChange) onChange(run.loadout, foldSettings());
    draw();
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
  let pendingEquipmentChanged = null;
  const captureEquipmentChanged = (event) => { pendingEquipmentChanged = event; };

  /** Every piece the CONTENT has for this slot, owned or not. Does it exist? */
  function authoredFor(slot) {
    return slot.kinds.includes('armor')
      ? (eq.armour || []).filter((o) => o.classId === run.class && fitsSlot(slot, o))
      : (eq.armaments || []).filter((a) => fitsSlot(slot, a));
  }

  const foldSettings = () => {
    for (const [id, value] of folded) armouryTraySession.folded.set(id, value);
    return null;
  };
  const openInventoryForSelection = (slotId, setIndex) => {
    picking = { slotId, setIndex };
    folded.set('inventory', false);
  };
  const clearInventorySelection = () => {
    picking = null;
    // A replacement flow always gives the equipment pane back after commit,
    // even in the Inventory view whose arrival preset normally opens this
    // tray. Leaving it expanded redraws a fresh actionable row underneath the
    // still-held pointer; the release click can then perform a second action.
    // Collapsing is both Constantine's requested return state and the gesture
    // boundary that keeps one completed hold equal to one mutation.
    folded.set('inventory', true);
  };

  /** One mutation path for the shared Inventory buttons, holds, and drag/drop. */
  function applyEquipmentChange(slotId, setIndex, pieceId, actionLabel) {
    const hadSelection = !!picking;
    const changed = equipPiece(
      registries, run.loadout, slotId, setIndex, pieceId, owned(),
      { inCombat, attributes: run.attributes, itemUpgradeLevels: run.itemUpgradeLevels, armamentLevels: run.armamentLevels, classId: run.class, onEquipmentChanged: captureEquipmentChanged }
    );
    if (!changed) {
      notice = `${actionLabel} was refused. The loadout was not changed.`;
      draw();
      return false;
    }
    if (hadSelection) clearInventorySelection();
    sfx.play('cardPlay');
    commit(hadSelection ? foldSettings() : null);
    return true;
  }

  function comparisonFor(slotId, setIndex, pieceId) {
    return equipmentSurfaceReceipt(registries, run, {
      candidate: { slotId, setIndex, pieceId },
      meta,
    }).candidate;
  }

  /** A selected compatible position wins; otherwise use the item's current or first valid position. */
  function inventoryTarget(row) {
    if (!row || !row.item || !['Armour', 'Weapon', 'Shield', 'Staff', 'Armament'].includes(row.category)) return null;
    const slots = (eq.slots || []).filter((slot) => fitsSlot(slot, row.item));
    if (!slots.length) return null;
    const selected = picking && slots.find((slot) => slot.id === picking.slotId);
    if (selected) {
      const equippedPositions = slots.flatMap((slot) => (run.loadout.sets[slot.id] || []).map((itemId, setIndex) => ({
        slotId: slot.id, setIndex, itemId,
      })));
      const action = inventorySelectionAction({
        itemId: row.id,
        selectedSlotId: selected.id,
        selectedSetIndex: picking.setIndex,
        selectedItemId: (run.loadout.sets[selected.id] || [])[picking.setIndex] || null,
        equippedPositions,
      });
      return { ...action, slot: selected, equipped: action.kind === 'unequip' };
    }
    for (const slot of slots) {
      const index = (run.loadout.sets[slot.id] || []).findIndex((id) => id === row.id);
      if (index >= 0) return { slot, setIndex: index, pieceId: null, equipped: true, kind: 'unequip' };
    }
    const slot = slots[0];
    return {
      slot,
      setIndex: run.loadout.active[slot.id] || 0,
      pieceId: row.id,
      equipped: false,
      kind: 'equip',
    };
  }

  function activatePosition(slot, position, { openPicker = false } = {}) {
    const rule = canSwap(registries, slot.id, { inCombat });
    if (!position.active) {
      if (!rule.ok) { notice = rule.reason; draw(); return; }
      if (onSwap) {
        const refused = onSwap(slot.id, position.index);
        if (refused) { notice = refused; draw(); }
        return;
      }
      if (!cycleSet(registries, run.loadout, slot.id, position.index, {
        meta, inCombat, classId: run.class, onEquipmentChanged: captureEquipmentChanged,
      })) return;
      if (openPicker) openInventoryForSelection(slot.id, position.index);
      sfx.play('cardPlay');
      commit(openPicker ? foldSettings() : null);
      return;
    }
    if (picking && picking.slotId === slot.id && picking.setIndex === position.index) clearInventorySelection();
    else openInventoryForSelection(slot.id, position.index);
    if (onChange) onChange(run.loadout, foldSettings());
    draw();
  }

  function attachPositionDropTarget(target, slot, position) {
    target.addEventListener('dragover', (ev) => {
      const dragged = (eq.armaments || []).find((candidate) => candidate.id === draggingItemId)
        || (eq.armour || []).find((candidate) => candidate.classId === run.class && candidate.id === draggingItemId);
      if (!dragged || !fitsSlot(slot, dragged)) return;
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
      target.classList.add('drop-ready');
    });
    target.addEventListener('dragleave', () => target.classList.remove('drop-ready'));
    target.addEventListener('drop', (ev) => {
      target.classList.remove('drop-ready');
      const pieceId = (ev.dataTransfer && (ev.dataTransfer.getData('application/x-ashenspire-item')
        || ev.dataTransfer.getData('text/plain'))) || draggingItemId;
      const dragged = (eq.armaments || []).find((candidate) => candidate.id === pieceId)
        || (eq.armour || []).find((candidate) => candidate.classId === run.class && candidate.id === pieceId);
      if (!dragged || !fitsSlot(slot, dragged)) return;
      ev.preventDefault();
      openInventoryForSelection(slot.id, position.index);
      applyEquipmentChange(slot.id, position.index, pieceId, `Equip ${dragged.name} to ${position.label}`);
    });
  }

  /** The position's code (R1, L2…) as the card's badge, so a row of cards reads as a rack. */
  const positionBadge = (position) => pill({ label: position.code, attrs: { class: 'armoury-position-code' } });

  // A POSITION IS AN OPTIONCARD: art, name, the combat bonus as its description,
  // the category and weight as its meta, tags as Tags, the act (Equip /
  // Equipped) trailing. Locked and empty are the same card in other states.
  function positionCard(slot, position) {
    const selected = picking && picking.slotId === slot.id && picking.setIndex === position.index;
    if (position.state === 'locked') {
      const card = optionCard({
        glyph: '🔒', name: position.label, badge: positionBadge(position),
        description: position.rung?.name || 'Locked position', meta: 'Locked', arrow: false,
        className: 'armoury-position-card is-locked',
        attrs: { dataset: { component: 'armoury.lockedPositionCard', slotPosition: `${slot.id}:${position.index}` } },
      });
      refuses(card, () => position.rung?.hint || 'This equipment position is locked.');
      return card;
    }

    if (position.state === 'empty') {
      const card = optionCard({
        glyph: '＋', name: 'Empty position', badge: positionBadge(position),
        description: 'Select or drop a compatible item', meta: position.label, arrow: false, selected: !!selected,
        className: `armoury-position-card is-empty${selected ? ' is-selected' : ''}`,
        attrs: { dataset: { component: 'armoury.emptyPositionCard', slotPosition: `${slot.id}:${position.index}` } },
      });
      card.addEventListener('click', () => activatePosition(slot, position, { openPicker: true }));
      attachPositionDropTarget(card, slot, position);
      attachTooltip(card, () => `<div class="tt-title">${esc(position.label)}: Empty</div><p>Select this position, then choose an item from Inventory, or drag a compatible item here.</p>`);
      return card;
    }

    const card = el('details', {
      class: `armoury-position-card is-occupied${position.active ? ' is-active' : ''}${selected ? ' is-selected' : ''}`,
      dataset: { component: 'armoury.equipmentPositionCard', slotPosition: `${slot.id}:${position.index}`, positionState: position.action },
    });
    const action = button({
      label: position.action === 'equipped' ? 'Equipped' : 'Equip',
      weight: position.action === 'equipped' ? 'secondary' : 'primary',
      className: `armoury-position-action ${position.action}`,
    });
    const head = optionCard({
      tag: 'summary',
      art: pieceArt(position.summary.item, position.summary.item.icon || '◆'),
      name: position.summary.name, badge: positionBadge(position),
      description: position.summary.bonus,
      meta: `${position.summary.category} · ${position.summary.weight}`,
      body: el('span', { class: 'tags armoury-position-tags' }, (position.summary.tags.length ? position.summary.tags : ['untagged']).map((tag) => tagChip({ label: tag }))),
      trail: action, arrow: false, selected: !!selected,
      className: 'armoury-position-summary',
    });
    // The name stands in a <strong> the tools read (`.armoury-position-values strong`).
    const nameSlot = head.querySelector('.on');
    nameSlot.replaceChildren(el('strong', { text: position.summary.name }), positionBadge(position));
    head.querySelector('.ob').classList.add('armoury-position-values');
    action.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      activatePosition(slot, position, { openPicker: position.action === 'equipped' });
    });
    card.append(head, armamentDetail(slot, position.summary));
    attachPositionDropTarget(card, slot, position);
    attachTooltip(head, () => `<div class="tt-title">${esc(`${position.label}: ${position.summary.name}`)}</div><p>${esc(position.summary.bonus)} · ${esc(position.summary.weight)}. Click to show or hide full item details.</p>`);
    return card;
  }

  function toggleArmamentView() {
    const next = armamentView === 'list' ? 'grid' : 'list';
    armamentView = next;
    if (onChange) onChange(run.loadout, { armouryArmamentView: armamentView });
    draw();
    wrap.querySelector('.armoury-armament-view-toggle')?.focus();
  }

  /** A grid tile is the same OptionCard stood on end: art over name, the code as its badge. */
  function positionGridCard(slot, position) {
    if (!armamentGridSelection && position.active && position.state === 'occupied') {
      armamentGridSelection = { slotId: slot.id, index: position.index };
    }
    const selected = armamentGridSelection
      && armamentGridSelection.slotId === slot.id
      && armamentGridSelection.index === position.index;
    const art = position.state === 'locked' ? artWell({ glyph: '🔒', small: true })
      : position.summary.item ? pieceArt(position.summary.item, position.summary.item.icon || '◆')
        : artWell({ glyph: '＋', small: true });
    const card = optionCard({
      art, name: position.state === 'locked' ? 'Locked' : position.summary.name, badge: positionBadge(position),
      arrow: false, selected: !!selected,
      className: `armoury-position-grid-card is-${position.state}${selected ? ' is-selected' : ''}`,
      attrs: { dataset: { component: `armoury.${position.state}PositionGridCard`, slotPosition: `${slot.id}:${position.index}` } },
    });
    if (position.state === 'locked') {
      refuses(card, () => position.rung?.hint || 'This equipment position is locked.');
    } else {
      card.addEventListener('click', () => {
        armamentGridSelection = { slotId: slot.id, index: position.index };
        draw();
        wrap.querySelector(`[data-slot-position="${CSS.escape(`${slot.id}:${position.index}`)}"]`)?.focus();
      });
      attachPositionDropTarget(card, slot, position);
    }
    attachTooltip(card, () => `<div class="tt-title">${esc(position.label)}</div><p>${esc(position.state === 'locked' ? 'This position is locked.' : `${position.summary.name}. Select to show its details below.`)}</p>`);
    return card;
  }

  function armamentGridDetail(orderedSlots) {
    const positions = orderedSlots.flatMap((slot) => slotPositions(slot)
      .filter((position) => position.modelState !== 'hidden')
      .map((position) => ({ slot, position })));
    let selected = armamentGridSelection
      ? positions.find(({ slot, position }) => slot.id === armamentGridSelection.slotId && position.index === armamentGridSelection.index)
      : null;
    if (!selected) selected = positions.find(({ position }) => position.active && position.state === 'occupied')
      || positions.find(({ position }) => position.state !== 'locked') || positions[0] || null;
    if (selected) armamentGridSelection = { slotId: selected.slot.id, index: selected.position.index };
    const detail = el('section', { class: 'armoury-position-grid-detail', dataset: { component: 'armoury.armamentGridDetails' } }, eyebrow('Details'));
    if (!selected) detail.appendChild(flavour('No equipment positions are available.', { class: 'ep-hint' }));
    else if (selected.position.state === 'occupied') detail.appendChild(armamentDetail(selected.slot, selected.position.summary));
    else detail.appendChild(flavour(`${selected.position.label} is ${selected.position.state}.`, { class: 'ep-hint' }));
    return detail;
  }

  /** The one shared Inventory: all items normally, compatible replacements while a position is selected. */
  function inventoryBlock() {
    const box = document.createElement('div');
    box.className = 'inventory-list ep-list';
    const selectedSlot = picking ? eq.slots.find((slot) => slot.id === picking.slotId) : null;
    const allRows = inventoryRows(registries, run, meta);
    const rows = selectedSlot
      ? allRows.filter((row) => row.item && fitsSlot(selectedSlot, row.item))
      : allRows;
    const holdDuration = holdMs((meta && meta.settings) || {}, registries.balance.ui.holdConfirm);
    const inventoryItemClass = layout.cardClasses.inventoryItem;
    const faceActions = new Map();
    const draggableRows = new Map();
    // In combat the inventory stays readable, but every equipment action is
    // sealed. Keep that refusal on the action itself so opening an equipped
    // item explains why it cannot move instead of trying to bind a live act.
    const sealChip = (element, reason) => {
      element.classList.add('locked');
      refuses(element, () => reason);
      return element;
    };
    const attachInventoryDrag = (element, row) => {
      let pointerDrag = null;
      let suppressClick = false;
      const clearDropReady = () => {
        for (const cell of wrap.querySelectorAll('.armoury-position-card.drop-ready')) cell.classList.remove('drop-ready');
      };
      const dropAt = (x, y) => {
        const card = document.elementFromPoint(x, y)?.closest?.('[data-slot-position]');
        if (!card || card.classList.contains('is-locked')) return null;
        const [slotId, rawIndex] = String(card.dataset.slotPosition || '').split(':');
        const setIndex = Number(rawIndex);
        const slot = (eq.slots || []).find((candidate) => candidate.id === slotId);
        if (!slot || !Number.isInteger(setIndex) || !fitsSlot(slot, row.item)) return null;
        return { card, slot, setIndex };
      };
      const detachPointerTracking = () => {
        document.removeEventListener('pointermove', onPointerMove, true);
        document.removeEventListener('pointerup', onPointerUp, true);
        document.removeEventListener('pointercancel', onPointerCancel, true);
      };
      const finishPointerTracking = () => {
        detachPointerTracking();
        pointerDrag = null;
        element.classList.remove('dragging');
        clearDropReady();
      };
      const onPointerMove = (event) => {
        if (!pointerDrag || pointerDrag.id !== event.pointerId) return;
        if (!pointerDrag.dragging
          && Math.hypot(event.clientX - pointerDrag.x, event.clientY - pointerDrag.y) <= HOLD_POINTER_SLOP) return;
        if (!pointerDrag.dragging) element.dispatchEvent(new CustomEvent('carddragstart'));
        pointerDrag.dragging = true;
        event.preventDefault();
        element.classList.add('dragging');
        clearDropReady();
        pointerDrag.drop = dropAt(event.clientX, event.clientY);
        if (pointerDrag.drop) pointerDrag.drop.card.classList.add('drop-ready');
      };
      const onPointerUp = (event) => {
        if (!pointerDrag || pointerDrag.id !== event.pointerId) return;
        const completed = pointerDrag.dragging;
        const drop = pointerDrag.drop || (completed ? dropAt(event.clientX, event.clientY) : null);
        finishPointerTracking();
        if (!completed) return;
        suppressClick = true;
        event.preventDefault();
        event.stopPropagation();
        if (drop) {
          openInventoryForSelection(drop.slot.id, drop.setIndex);
          applyEquipmentChange(drop.slot.id, drop.setIndex, row.id, `Equip ${row.name} to ${drop.slot.label}`);
        }
      };
      const onPointerCancel = (event) => {
        if (!pointerDrag || pointerDrag.id !== event.pointerId) return;
        finishPointerTracking();
      };
      element.draggable = true;
      element.addEventListener('dragstart', (ev) => {
        element.dispatchEvent(new CustomEvent('carddragstart'));
        detachPointerTracking();
        pointerDrag = null;
        draggingItemId = row.id;
        element.classList.add('dragging');
        if (ev.dataTransfer) {
          ev.dataTransfer.effectAllowed = 'move';
          ev.dataTransfer.setData('application/x-ashenspire-item', row.id);
          ev.dataTransfer.setData('text/plain', row.id);
        }
      });
      element.addEventListener('dragend', () => {
        draggingItemId = null;
        element.classList.remove('dragging');
        clearDropReady();
      });
      // HTML drag/drop is retained for mouse browsers. Pointer drag is the
      // shared card path for touch and for browser surfaces that do not start
      // an HTML DragEvent from a disclosure button. Moving beyond the hold's
      // own slop cancels that hold and becomes a drag; a tap remains a tap.
      element.addEventListener('pointerdown', (event) => {
        if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
        detachPointerTracking();
        pointerDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false, drop: null };
        try { element.setPointerCapture(event.pointerId); } catch { /* capture is a progressive enhancement */ }
        document.addEventListener('pointermove', onPointerMove, true);
        document.addEventListener('pointerup', onPointerUp, true);
        document.addEventListener('pointercancel', onPointerCancel, true);
      });
      element.addEventListener('click', (event) => {
        if (!suppressClick) return;
        suppressClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
      }, true);
    };
    if (selectedSlot) {
      box.dataset.filteredFor = `${selectedSlot.id}:${picking.setIndex}`;
      box.setAttribute('aria-label', `Inventory items compatible with ${selectedSlot.label}`);
    }
    const entries = rows.map((row) => {
      const target = inventoryTarget(row);
      const draggable = !!target;
      const actionLabel = target
        ? (target.kind === 'unequip'
          ? 'Unequip'
          : `${target.kind === 'move' ? 'Move' : 'Equip'} to ${target.slot.label}`)
        : '';
      const face = inventoryFace(row, {
        draggable,
        actionLabel: selectedSlot ? actionLabel : '',
        classModel: inventoryItemClass,
      });
      if (draggable) draggableRows.set(row.key, row);
      let actionButton = null;
      if (target) {
        const act = () => applyEquipmentChange(target.slot.id, target.setIndex, target.pieceId, actionLabel);
        const seal = canEquip(registries, target.slot.id, { inCombat });
        const transition = equipTransitionReceipt(
          registries, run.loadout, target.slot.id, target.setIndex, target.pieceId
        );
        const wholeCardHold = inventoryItemClass.holdAction && holdDuration > 0 && seal.ok && transition.ok;
        // The act is a kit Button — danger for an unequip, primary for an equip.
        // When the whole card is the hold target the act is a lit StatePill that
        // names it, not a second control.
        actionButton = wholeCardHold
          ? pill({ label: actionLabel, on: true, attrs: { class: 'ep-equip inventory-card-action-label', 'aria-hidden': 'true' } })
          : button({ label: actionLabel, weight: target.kind === 'unequip' ? 'danger' : 'primary', className: 'ep-equip' });
        actionButton.dataset.act = target.kind;
        if (!wholeCardHold) {
          actionButton.addEventListener('pointerdown', (event) => event.stopPropagation());
          actionButton.addEventListener('click', (event) => event.stopPropagation());
        }
        if (!seal.ok) sealChip(actionButton, seal.reason);
        else if (!transition.ok) {
          actionButton.classList.add('locked');
          refuses(actionButton, () => transition.reason);
        } else if (wholeCardHold) {
          faceActions.set(row.key, act);
        } else {
          const disarm = armHold(actionButton, {
            ms: inventoryItemClass.holdAction ? holdDuration : 0,
            id: 'equipInventory',
            onConfirm: act,
          });
          registerHold(disarm);
          faceActions.set(row.key, act);
        }
      }
      return {
        key: row.key,
        kind: 'item',
        disclosure: 'face',
        face: {
          label: row.name,
          node: face,
          compact: true,
          className: 'inventoryItem',
          classModel: inventoryItemClass,
        },
        reveal: {
          node: inventoryReveal(registries, row, {
            comparison: target ? comparisonFor(target.slot.id, target.setIndex, target.pieceId) : null,
            action: actionButton,
            instruction: selectedSlot
              ? `${target?.kind === 'unequip' ? 'Unequip from' : 'Equip or drag to'} ${selectedSlot.label}.`
              : (target ? 'Drag this item onto a compatible equipment position.' : ''),
            holdDuration,
            registerHold,
            classModel: inventoryItemClass,
            comparisonConfig: layout.comparison,
            onClassAction: (selectedSlot || holdDuration > 0) ? (faceActions.get(row.key) || null) : null,
          }),
          sense: `${row.name}. ${row.category}. ${row.count} owned.`,
        },
      };
    });
    inventoryDisclosure = mountDisclosure(box, entries, {
      moreLabel: 'more items',
      layout: 'column',
      armFace: ({ button, entry, onTap }) => {
        const draggableRow = draggableRows.get(entry.key);
        if (draggableRow) attachInventoryDrag(button, draggableRow);
        if (entry.face?.classModel?.holdAction !== true) return false;
        const act = faceActions.get(entry.key);
        if (!act) return false;
        button.dataset.cardClass = entry.face.className;
        button.dataset.holdCapable = 'true';
        if (holdDuration > 0) {
          const disarm = armHold(button, {
            ms: holdDuration,
            id: 'equipInventory',
            onConfirm: act,
            onTap,
            hintHost: button.querySelector('.inventory-face'),
            hintBefore: button.querySelector('.inventory-category'),
            feedbackHosts: () => {
              const reveal = [...(button.parentElement?.children || [])]
                .find((candidate) => candidate.dataset?.revealFor === entry.key);
              return [button.querySelector('.inventory-face'), reveal];
            },
          });
          registerHold(disarm);
        } else if (selectedSlot) {
          button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            act();
          });
        } else {
          return false;
        }
        return true;
      },
    });
    box.dataset.inventoryCount = String(inventoryItemCount(rows));
    if (!entries.length) box.appendChild(flavour(selectedSlot ? `Nothing in Inventory fits ${selectedSlot.label}.` : 'Inventory is empty.', { class: 'ep-hint' }));
    return box;
  }

  /** The equipment-derived cards this loadout produces right now. */
  function cardStrip() {
    const box = options([], { class: 'equip-cards armoury-card-list', dataset: { component: 'armoury.cardList', cardView } });
    const gridColumns = typeof window !== 'undefined' && window.innerWidth <= layout.responsive.breakpoint
      ? layout.responsive.phone.cardsGridColumns
      : layout.cards.gridColumns;
    box.style.setProperty('--armoury-card-grid-columns', String(gridColumns));
    const groups = new Map();
    for (const inst of run.deck || []) {
      // This tray is the equipment-card surface. Class/signature cards do not
      // belong here; they have no armament source to inspect or compare.
      if (!inst.equipmentRole) continue;
      const key = inst.equipmentRole === 'attack'
        ? `${inst.equipmentRole}|${inst.cardId}|${inst.profileId}`
        : inst.equipmentRole;
      const group = groups.get(key) || { inst, count: 0 };
      group.count += 1;
      groups.set(key, group);
    }
    for (const { inst, count: copyCount } of groups.values()) {
      const rendered = renderCard(registries, inst, {});
      const def = resolveCard(registries, inst);
      const art = rendered.querySelector('.art')?.textContent || '❖';
      const type = rendered.querySelector('.ctype')?.textContent || def.type;
      const cost = rendered.querySelector('.cost')?.textContent || String(def.cost);
      const mana = rendered.querySelector('.mana-cost');
      const tags = rendered.querySelector('.ctags');
      const text = rendered.querySelector('.ctext');
      const fullText = text ? text.textContent.trim() : '';
      const combatText = fullText.match(/^.*?[.!?](?:\s|$)/)?.[0].trim() || fullText;

      // A CARD ROW is an OptionCard (glyph, name, type · cost, tags, the copy
      // count as a StatePill) that opens a DetailCard: the art in an ArtWell
      // beside the combat line, the full text and the flavour.
      const tagList = tags ? [...tags.querySelectorAll('.ctag')].map((tag) => tag.textContent.trim()) : [];
      const costLine = `${type} · ◆ ${cost}${mana ? ` · ${mana.textContent.trim()}` : ''}`;
      const row = el('details', { class: 'armoury-card-row', dataset: { cardRow: '1', component: 'armoury.cardRow' } });
      const summary = optionCard({
        tag: 'summary', glyph: art, name: def.name, meta: costLine,
        body: tagList.length ? el('span', { class: 'tags' }, tagList.map((tag) => tagChip({ label: tag }))) : null,
        trail: pill({ label: `x${copyCount}`, attrs: { class: 'armoury-card-row-count role-copy-count' } }),
        arrow: false, className: 'armoury-card-row-summary compact',
      });
      summary.querySelector('.on').replaceChildren(el('strong', { class: 'armoury-card-row-name', text: def.name }));
      attachTooltip(summary, () => `<div class="tt-title">${esc(def.name)}</div><p>Tap to expand the card details.</p>`);

      const detailsPane = el('div', { class: 'armoury-card-details-pane' }, [
        eyebrow('Combat data'),
        prose(combatText || 'No combat data authored.', { class: 'armoury-card-combat' }),
      ]);
      if (text) {
        const textClone = text.cloneNode(true);
        textClone.className = 'as-prose armoury-card-detail-text';
        detailsPane.appendChild(textClone);
      }
      if (def.flavor) detailsPane.appendChild(flavour(def.flavor));
      const detail = detailCard({
        eyebrow: costLine, name: def.name,
        children: el('div', { class: 'armoury-card-row-detail' }, [artWell({ glyph: art }), detailsPane]),
      });
      row.append(summary, detail);
      box.appendChild(row);
    }
    if (!groups.size) box.appendChild(flavour('No equipment cards are active.', { class: 'ep-hint' }));
    return box;
  }

  function equipmentReceiptPanel(surface) {
    const panel = el('section', { class: 'armoury-equipment-receipts' });
    panel.innerHTML = `<section class="equip-role-receipts"><span class="as-eyebrow">Equipment card packages</span>${renderRoleCopies(surface)}</section>`
      + renderEquipmentRequirements(surface.requirements)
      + renderPlayerPoise(surface.poise)
      + renderPlayerLoad(surface.load);
    return panel;
  }

  /** A compact, separate Stats tray; Cards owns no stat receipts. DetailCards of StatChips. */
  function statsComparison() {
    const projection = statProjection(registries, run);
    const surface = equipmentSurfaceReceipt(registries, run);
    const cls = registries.classes.get(run.class);
    const valueFor = (role) => surface.roles.find((row) => row.role === role)?.receipt.value ?? 0;
    const labelFor = (role) => layout.combatPower.cards.find((card) => card.role === role)?.label || role;
    const derived = (id) => projection.derived.find((row) => row.id === id)?.value ?? '—';
    const relicNames = (run.relics || []).map((id) => registries.relics.get(id)?.name || id);
    const runStats = run.stats || {};
    const group = (title, chips, attrs = {}) => detailCard({ eyebrow: title, muted: true, attrs: { class: 'armoury-stats-group', ...attrs }, children: statStrip(chips.map(([key, value]) => chip({ key, value: String(value) }))) });
    const box = el('div', { class: 'armoury-stats-summary', dataset: { component: 'armoury.statsSummary' } }, [
      detailCard({ eyebrow: 'Character', name: cls?.name || run.class, meta: `Level ${run.level || 1}`, attrs: { class: 'armoury-stats-identity' } }),
      group('Combat', [['Strike', valueFor('attack')], [labelFor('technique'), valueFor('technique')], ['Defense', valueFor('guard')]]),
      group('Attributes', projection.attributes.map((attr) => [attr.shortLabel || attr.label, attr.value])),
      group('Resources', [['Actions', derived('energy')], ['Hand', derived('draw')], ['Resistance', '—']]),
      group('Run', [['Fights won', runStats.fightsWon || 0], ['Damage dealt', runStats.damageDealt || 0], ['Damage taken', runStats.damageTaken || 0]]),
      detailCard({ eyebrow: 'Relics', muted: true, attrs: { class: 'armoury-stats-group' }, children: relicNames.length
        ? kitLine(relicNames.map((name) => kitItem({ glyph: '◆', name })))
        : flavour('0 equipped') }),
      equipmentReceiptPanel(surface),
    ]);
    return box;
  }

  function characterPowerEntries() {
    const surface = equipmentSurfaceReceipt(registries, run);
    const role = (card) => {
      const row = surface.roles.find((candidate) => candidate.role === card.role);
      const value = row ? row.receipt.value : 0;
      const formula = row
        ? `${row.receipt.base} base + ${row.receipt.tier} tier × ${row.receipt.gainPerTier} tier gain + ${row.receipt.rarityBonus} rarity`
        : 'No armament receipt is active.';
      // A power face: the label, its gear bonus as the description, the value trailing as StatusText.
      const powerFace = face({
        nameNode: el('span', { class: 'on' }, el('span', { class: 'combat-power-label', text: card.label })),
        description: row ? `+${row.receipt.rarityBonus} gear` : '—',
        trail: statusText(String(value), { class: 'combat-power-value' }),
        className: 'combat-power-face',
      });
      return {
        key: card.id,
        kind: 'power',
        disclosure: 'face',
        face: { label: card.fullLabel, value: String(value), node: powerFace, compact: true },
        reveal: { title: card.fullLabel, sense: `${card.fullLabel}. Tap to expand the calculation.`, lines: [formula] },
      };
    };
    return layout.combatPower.cards.map(role);
  }

  function relicEntries() {
    return (run.relics || []).map((id) => {
      const relic = registries.relics.get(id);
      return {
        key: id,
        kind: 'relic',
        disclosure: 'face',
        face: { label: relic.name, value: 'Equipped' },
        reveal: { title: relic.name, sense: relicText(relic, registries), lines: [relic.flavor || 'A relic carried into the Spire.'] },
      };
    });
  }

  function characterStatsPanel() {
    const box = document.createElement('section');
    box.className = 'armoury-character-stats';
    const projection = statProjection(registries, run);
    const surface = equipmentSurfaceReceipt(registries, run);
    const expanded = viewMode().character === 'expanded';

    // AN INFORMATION CARD is a fold-open DetailCard: its head a Row (caret
    // Glyph, the label as Title·S, the one-line summary as StatusText), its
    // body the group's faces.
    function informationCard({ id, label, summary, body }) {
      const head = el('summary', {}, row({
        glyph: FOLD_GLYPH.collapsed,
        labelNode: titleS(label, { tag: 'span', class: 'r-label character-info-label' }),
        status: summary, tag: 'div', className: 'character-info-head',
      }));
      head.querySelector('.as-glyph').classList.add('caret');
      const card = detailCard({ tag: 'details', attrs: { class: `character-info-card ${id}`, dataset: { component: `armoury.${id}` } }, children: [head, body] });
      card.open = expanded;
      attachTooltip(head, () => `<div class="tt-title">${esc(label)}</div><p>${esc(card.open ? `Fold ${label}.` : `Expand ${label} for its full calculation and details.`)}</p>`);
      return card;
    }

    const powers = el('section', { class: 'character-power-cards', dataset: { component: 'armoury.combatPowerGroup' } });
    const powerEntries = characterPowerEntries();
    mountDisclosure(powers, powerEntries, { moreLabel: 'more powers', layout: 'column' });
    box.appendChild(informationCard({
      id: 'combatPowerCard',
      label: layout.combatPower.groupLabel,
      summary: powerEntries.map((entry) => `${entry.face.node?.querySelector('.combat-power-label')?.textContent || entry.face.label} ${entry.face.value}`).join(' · '),
      body: powers,
    }));

    const attributes = el('section', { class: 'character-attributes' });
    const attributeHost = el('div');
    const attributeRows = attributeCardModels(registries, run.attributes, {
      projection,
      equipmentProfiles: run.equipmentProfileRuleSnapshot?.profiles,
    });
    for (const entry of attributeRows) entry.face = { ...entry.face, compact: true };
    mountDisclosure(attributeHost, attributeRows, { moreLabel: 'more attributes', layout: 'column' });
    attributes.appendChild(attributeHost);
    box.appendChild(informationCard({
      id: 'attributesCard',
      label: 'Attributes',
      summary: attributeRows.map((entry) => `${entry.face.label} ${entry.face.value}`).join(' · '),
      body: attributes,
    }));

    const relics = el('section', { class: 'character-relics' });
    const relicHost = el('div');
    const entries = relicEntries();
    for (const entry of entries) entry.face = { ...entry.face, compact: true };
    if (entries.length) mountDisclosure(relicHost, entries, { moreLabel: 'more relics', layout: 'column' });
    else relicHost.appendChild(flavour('No relics equipped.', { class: 'ep-hint' }));
    relics.appendChild(relicHost);
    box.appendChild(informationCard({
      id: 'relicsCard',
      label: 'Relics',
      summary: entries.length ? `${entries.length} equipped · ${entries.map((entry) => entry.face.label).join(' · ')}` : '0 equipped',
      body: relics,
    }));
    box.appendChild(informationCard({
      id: 'equipmentReceiptsCard',
      label: 'Equipment cards',
      summary: surface.roles.map((row) => `${row.profile.displayName} x${row.copies}`).join(' · '),
      body: equipmentReceiptPanel(surface),
    }));
    return box;
  }

  /** The character's summary is a LabelStack: Eyebrow (the case is the stylesheet's), Title·S, Subtitle. */
  function characterSummaryPanel() {
    const cls = registries.classes.get(run.class);
    return el('header', { class: 'character-summary as-labelstack' }, [
      eyebrow(`Forsaken · ${cls.name} · Level ${Number(run.level || 1)}`, { class: 'character-kicker' }),
      titleS(cls.name, { tag: 'h3' }),
      subtitle(cls.description || ''),
    ]);
  }

  function slotSummary(slot, setIndex = run.loadout.active?.[slot.id] || 0) {
    const itemId = (run.loadout.sets[slot.id] || [])[setIndex];
    const authored = slot.kinds.includes('armor')
      ? (eq.armour || []).find((piece) => piece.classId === run.class && piece.id === itemId)
      : (eq.armaments || []).find((piece) => piece.id === itemId);
    // The item AT ITS SMITHED TIER, the same resolution the load receipt
    // uses (equippedPieces → resolveUpgradedEquipment): a tier that raises
    // the poise threshold raises the armour's weight with it, and the card's
    // Poise and Weight labels must say what the total counts.
    const itemRef = authored ? (slot.kinds.includes('armor') ? `armor/${run.class}/${authored.id}` : `armament/${authored.id}`) : null;
    const item = authored ? resolveUpgradedEquipment(registries, itemRef, (run.itemUpgradeLevels || {})[itemRef] || 0) : null;
    const surface = equipmentSurfaceReceipt(registries, run);
    const roleLabels = new Map(layout.combatPower.cards.map((card) => [card.role, card.label]));
    const isActive = setIndex === (run.loadout.active?.[slot.id] || 0);
    const roleBonuses = item && isActive
      ? surface.roles
        .filter((row) => row.piece?.id === item.id && Number(row.receipt.value) !== 0)
        .map((row) => `${roleLabels.get(row.role) || row.role} ${row.receipt.value}`)
      : [];
    const authoredBonuses = item ? modSummary(registries, item) : [];
    const poise = item && Number.isFinite(Number(item.poiseThreshold)) ? `Poise ${Number(item.poiseThreshold)}` : '';
    const bonus = item
      ? [...roleBonuses, ...authoredBonuses, poise].filter(Boolean).slice(0, 2).join(' · ') || 'No combat bonus authored'
      : 'Empty socket';
    // One rule for the item and the total (model/statProjection.pieceWeight):
    // an armour piece weighs its poise threshold, so its card can never say
    // "Weight —" while the Equip load counts it.
    const weight = item ? `Weight ${pieceWeight(item)}` : 'Weight —';
    return {
      item,
      intrinsic: item && !slot.kinds.includes('armor') ? armamentIntrinsicReceipt(item) : null,
      name: item ? item.name : 'Empty socket',
      category: item ? (slot.kinds.includes('armor') ? 'Armour' : `${item.kind || 'Armament'}`.replace(/^./, (c) => c.toUpperCase())) : 'Empty',
      bonus,
      weight,
      tags: item && Array.isArray(item.tags) ? item.tags : (item?.tags ? [item.tags] : []),
      instruction: item ? 'Click to expand the equipped item and socket details.' : 'Click to expand this empty socket.',
    };
  }

  function slotPositions(slot) {
    const opened = openedSets(registries, slot, ladderCtx());
    const visible = visibleSets(registries, slot, ladderCtx());
    return (run.loadout.sets[slot.id] || []).map((itemId, index) => {
      const modelState = setCellState(index, opened, visible);
      const summary = slotSummary(slot, index);
      const cardState = equipmentPositionCardState({
        slot,
        index,
        modelState,
        item: summary.item,
        activeIndex: run.loadout.active?.[slot.id] || 0,
      });
      return {
        index,
        itemId,
        modelState,
        ...cardState,
        summary,
        rung: modelState === 'next' ? rungFor(registries, slot, index) : null,
      };
    });
  }

  function positionGroup(slot, positions, presentation = 'list') {
    const cells = positions.map((position) => equipmentSetCellModel({
      slotId: slot.id,
      index: position.index,
      state: position.modelState === 'next' ? 'next' : position.state,
      active: position.active,
      piece: position.summary.item ? {
        id: position.summary.item.id,
        name: position.summary.name,
        image: thumbSrc(position.summary.item),
      } : null,
      rung: position.rung,
    }));
    const model = equipmentSlotModel({
      slotId: slot.id,
      label: slot.label,
      rule: canSwap(registries, slot.id, { inCombat }),
      cells,
    });
    return renderEquipmentSlot(model, {
      showHeader: false,
      renderCell: (cellModel) => {
        const position = positions.find((candidate) => candidate.index === cellModel.properties.index);
        return presentation === 'grid' ? positionGridCard(slot, position) : positionCard(slot, position);
      },
    }).element;
  }

  // THE ITEM'S DETAILS are a DetailCard: Eyebrow (the slot), the name, the lore
  // as Flavour, then every fact as a StatRow (`Smithing tier` is the row the
  // Smith tool reads), the last smithing as a StatRow, the tags as a KitLine
  // whose items carry their meaning in the tooltip.
  function armamentDetail(slot, summaryItem) {
    const item = summaryItem.item;
    if (!item) {
      return detailCard({ muted: true, attrs: { class: 'armoury-position-detail', dataset: { component: 'armoury.armamentItemCard' } }, children: flavour('No item is assigned to this equipment position.', { class: 'armoury-armament-empty' }) });
    }

    const tags = Array.isArray(item.tags) ? item.tags : (item.tags ? [item.tags] : []);
    const tagRows = tags.map((tagId) => {
      const tag = (registries.tags || []).find((row) => row.id === tagId);
      return { id: tagId, label: tag?.label || tagId, description: tag?.blurb || 'Equipment classification.' };
    });
    const mods = modSummary(registries, item);
    const intrinsic = summaryItem.intrinsic;
    const itemRef = `armament/${item.id}`;
    const smithingLevel = Number.isInteger(run.itemUpgradeLevels?.[itemRef])
      ? run.itemUpgradeLevels[itemRef]
      : (Number.isInteger(run.armamentLevels?.[item.id]) ? run.armamentLevels[item.id] : 0);
    const smithingReceipt = (run.lastSmithingReceipt?.itemRef === itemRef || run.lastSmithingReceipt?.armamentId === item.id)
      ? run.lastSmithingReceipt
      : null;
    const fact = (name, value, attrs = {}) => statRowFlat(name, value, attrs);
    const facts = [
      fact('Type', `${summaryItem.category} · ${item.rarity || 'standard'}`),
      fact('Effects', mods.length ? mods.join(' · ') : 'No additional equipment effects authored.'),
      fact('Combat bonuses', summaryItem.bonus),
      fact('Smithing tier', String(smithingLevel)),
      ...(intrinsic ? [
        fact('Attack rating (AR)', String(intrinsic.attackRating)),
        fact('Defense rating (DEF)', String(intrinsic.defenseRating)),
        fact('Weight', String(intrinsic.weight)),
        fact('Weapon Art Mana', String(intrinsic.weaponArtManaCost)),
        fact('Unique Skill Stamina', String(intrinsic.uniqueSkillStaminaCost)),
      ] : []),
    ];
    const tagLine = kitLine(tagRows.length
      ? tagRows.map((tag) => {
        const item = kitItem({ glyph: '◆', name: tag.label });
        attachTooltip(item, () => `<div class="tt-title">${esc(tag.label)}</div><p>${esc(tag.description)}</p>`);
        return item;
      })
      : [kitItem({ glyph: '◆', name: 'No tags authored.' })], { class: 'armoury-armament-tag-details' });
    const detail = el('section', { class: 'armoury-armament-details', dataset: { component: 'armoury.armamentDetailPane' } }, [
      flavour(item.blurb || 'No lore text authored.', { class: 'armoury-armament-lore' }),
      ...facts,
      smithingReceipt ? el('div', { class: 'as-statrow flat armoury-smithing-receipt' }, [
        el('span', { class: 'sr-id' }, el('b', { class: 'sr-name', text: 'Last Smithing' })),
        el('span', { class: 'sr-vals' }, el('span', { class: 'sp-v', text: `Tier ${smithingReceipt.beforeLevel} → ${smithingReceipt.afterLevel} · ${smithingReceipt.cost} Stone · ${smithingReceipt.affectedCards.length} basic cards improved` })),
      ]) : null,
      tagLine,
    ]);
    const card = detailCard({
      eyebrow: slot.label, name: `${item.name} details`,
      attrs: { class: 'armoury-position-detail', dataset: { component: 'armoury.armamentItemCard' } },
      children: detail,
    });
    attachTooltip(card, () => `<div class="tt-title">${esc(`${slot.label}: ${item.name}`)}</div><p>${esc(summaryItem.bonus)} · ${esc(summaryItem.weight)}</p>`);
    return card;
  }

  /** One fact as a flat StatRow: the name left, its value right. */
  function statRowFlat(name, value, attrs = {}) {
    return el('div', { ...attrs, class: 'as-statrow flat' }, [
      el('span', { class: 'sr-id' }, el('span', { class: 'sr-name', text: name })),
      el('span', { class: 'sr-vals' }, el('span', { class: 'sp-v', text: value })),
    ]);
  }

  /** The character pane: the summary LabelStack, the figure in an ArtWell, the numbers. */
  function characterPanel() {
    const sprite = artWell({ attrs: { class: 'armoury-sprite-pane' } });
    sprite.appendChild(figureFor(registries, run, cz));
    return el('section', { class: 'armoury-character' }, [characterSummaryPanel(), sprite, characterStatsPanel()]);
  }

  function commit(settingChange = null) {
    // Every loadout mutation lands here, so this is the one wire for the
    // growth chain's talisman source (model/flaskgrowth.js): a worn growth
    // talisman grows the maximum on equip and shrinks it back on unequip.
    // Idempotent, and a no-op until the first talisman growth row is authored.
    syncFlaskGrowth(registries, run);
    if (onChange) onChange(run.loadout, settingChange || undefined);
    if (pendingEquipmentChanged) {
      if (onEquipmentChanged) onEquipmentChanged(pendingEquipmentChanged);
      if (typeof CustomEvent === 'function') {
        host.dispatchEvent(new CustomEvent('ashenspire:equipmentChanged', {
          detail: pendingEquipmentChanged,
          bubbles: true,
        }));
      }
      pendingEquipmentChanged = null;
    }
    draw();
  }

  function regionTray(r) {
    const source = wrap.querySelector(r.sel);
    if (!source) return null;
    const shut = folded.get(r.id) === true;
    const fillsInventoryPane = r.id === 'inventory' && viewMode().pane === 'inventory';
    const count = r.count(source);
    // The folded Stats header says the level and the combat and resource chips, read off the cards themselves.
    const summary = r.id === 'stats' ? (() => {
      const identity = source.querySelector('.armoury-stats-identity .dc-meta')?.textContent?.replace(/^Level\s+/i, 'Lv. ') || '';
      const groups = [...source.querySelectorAll('.armoury-stats-group')];
      const chipsOf = (group) => [...group.querySelectorAll('.as-chip')].map((c) => `${c.querySelector('.ck')?.textContent} ${c.querySelector('.cv')?.textContent}`);
      return [identity, ...groups.slice(0, 1).flatMap(chipsOf), ...groups.slice(2, 3).flatMap(chipsOf)].filter(Boolean).join(' · ');
    })() : '';
    // THE HOST IS THE DOOR'S BODY, NEVER THE GLASS: a tray's share is a share of
    // the panel it sits in (no vh below body — the body is zoomed). A remembered
    // height is that share; an arrival without one HUGS ITS CONTENT under the
    // kit's compact cap, so the subject keeps the room.
    const hostHeight = () => Math.max(1, wrap.querySelector('.armoury-shell-body')?.clientHeight || 1);
    const remembered = armouryTraySession.heights.has(r.id);
    const savedRatio = trayHeights.get(r.id) || layout.trays.defaultHeightRatio;
    const model = trayModel({
      id: r.id,
      name: r.label,
      count: count == null ? 0 : count,
      itemType: r.unit,
      summary,
      edge: 'bottom',
      expanded: !shut,
      sortable: r.id === 'cards',
      sortLabel: `Toggle ${r.label} list or grid`,
      resizable: !fillsInventoryPane,
      minExpandedSize: Math.max(96, Math.round(layout.trays.minimumHeightRatio * hostHeight())),
      items: [],
    });
    const snapRatio = (raw) => {
      const bounded = clampTrayHeight(raw);
      const nearest = layout.trays.snapRatios.reduce((best, value) => (
        Math.abs(value - bounded) < Math.abs(best - bounded) ? value : best
      ), layout.trays.snapRatios[0]);
      return Math.abs(nearest - bounded) <= layout.trays.snapTolerance ? nearest : bounded;
    };
    const rendered = renderTray(model, {
      sizeService: {
        read: () => null,
        write: (_id, _edge, size) => size,
      },
      onToggle: () => {
        folded.set(r.id, !folded.get(r.id));
        armouryTraySession.folded.set(r.id, folded.get(r.id));
        draw();
        wrap.querySelector(`[data-fold="${r.id}"]`)?.focus();
      },
      onSort: r.id === 'cards' ? () => {
        cardView = cardView === 'list' ? 'grid' : 'list';
        draw();
        wrap.querySelector('[data-tray-id="cards"] .tray-sort')?.focus();
      } : null,
      onResize: (_id, size) => {
        const next = snapRatio(size / hostHeight());
        trayHeights.set(r.id, next);
        armouryTraySession.heights.set(r.id, next);
        rendered.element.dataset.sized = '1';
        rendered.element.style.minHeight = `${layout.trays.multipleExpandedMinimumRatio * 100}%`;
        rendered.element.style.maxHeight = `${layout.trays.maximumHeightRatio * 100}%`;
        rendered.element.style.height = `${next * 100}%`;
      },
      renderContent: (content) => {
        while (source.firstChild) content.appendChild(source.firstChild);
      },
    });
    rendered.element.classList.add(...source.classList);
    rendered.element.dataset.region = r.id;
    rendered.element.dataset.role = 'context';
    rendered.element.dataset.cardView = r.id === 'cards' ? cardView : '';
    source.replaceWith(rendered.element);
    if (!shut && !fillsInventoryPane && remembered) {
      rendered.element.dataset.sized = '1';
      rendered.element.style.minHeight = `${layout.trays.multipleExpandedMinimumRatio * 100}%`;
      rendered.element.style.maxHeight = `${layout.trays.maximumHeightRatio * 100}%`;
      rendered.element.style.height = `${savedRatio * 100}%`;
    }
    if (r.id === 'cards' && rendered.sort) {
      const next = cardView === 'list' ? 'grid' : 'list';
      rendered.sort.classList.add('armoury-card-view-toggle');
      rendered.sort.textContent = VIEW_TOGGLE_GLYPH[next];
      rendered.sort.setAttribute('aria-label', `Show ${r.label} as ${next}`);
    }
    attachTooltip(rendered.fold, () => `<div class="tt-title">${shut ? 'Show' : 'Hide'} ${esc(r.label)}</div><p>${shut
      ? esc(summary || `${count || 0} ${r.unit}${count === 1 ? '' : 's'} in here.`)
      : `Fold ${esc(r.label)} back to its compact header.`}</p>`);
    if (rendered.resizeHandle) {
      rendered.resizeHandle.dataset.component = `armoury.${r.id}TrayResizeHandle`;
      attachTooltip(rendered.resizeHandle, () => `<div class="tt-title">Resize ${esc(r.label)}</div><p>Drag the shared tray edge. The expanded height snaps to the authored stops; folding remembers it.</p>`, { intent: 'above' });
    }
    return rendered.element;
  }

  function mountRegionTrays() {
    for (const region of contextRegions()) regionTray(region);
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
  function draw() {
    if (paneObserver) paneObserver.disconnect();
    clearHoldDisarms();
    // The layout is READ off the row, never inferred from the id. `data-surface`
    // / `data-member` are the house convention for a navigable set (#78): the
    // host names the set, each control names its member, so an instrument can
    // enumerate this from the rendered page without importing anything.
    const L = viewLayout(view);
    const panelModel = armouryPanelModel({
      view,
      views: viewIds(),
      viewLabels: Object.fromEntries(Object.entries(layout.viewModes).map(([id, mode]) => [id, mode.label || id])),
      layout: L,
      subject: 'slots',
      picking: !!picking,
      notice,
      regions: REGIONS.map((region) => ({
        id: region.id,
        label: region.label,
        count: region.id === 'inventory' ? inventoryItemCount(inventoryRows(registries, run, meta)) : 0,
        unit: region.unit,
        edge: 'bottom',
        expanded: folded.get(region.id) !== true,
        sortable: region.id === 'cards',
      })),
    });
    const rendered = renderArmouryPanel(panelModel, wrap);
    const panel = rendered.panel;
    panel.dataset.viewMode = viewMode().label;
    panel.dataset.pane = viewMode().pane;
    panel.dataset.characterState = viewMode().character;
    panel.dataset.composition = 'character-equipment';
    panel.dataset.responsive = typeof window !== 'undefined' && window.innerWidth <= layout.responsive.breakpoint
      ? 'phone' : 'desktop';
    const applyHybridRatio = () => {
      panel.style.setProperty('--armoury-character-ratio', `${hybridRatio}fr`);
      panel.style.setProperty('--armoury-equipment-ratio', `${1 - hybridRatio}fr`);
      panel.querySelector('.armoury-hybrid-splitter')?.setAttribute('aria-valuenow', String(Math.round(hybridRatio * 100)));
    };
    applyHybridRatio();
    panel.style.setProperty('--armoury-gap', `${layout.shell.gapRem}rem`);
    panel.style.setProperty('--armoury-sprite-ratio', `${layout.character.spriteRatio}fr`);
    panel.style.setProperty('--armoury-stats-ratio', `${layout.character.statsRatio}fr`);
    panel.style.setProperty('--armoury-stats-pane-ratio', `${layout.character.statsPaneRatio}fr`);
    panel.style.setProperty('--armoury-summary-pane-ratio', `${1 - layout.character.statsPaneRatio}fr`);
    panel.style.setProperty('--armoury-phone-character-ratio', `${layout.responsive.phone.characterRatio}fr`);
    panel.style.setProperty('--armoury-phone-equipment-ratio', `${layout.responsive.phone.equipmentRatio}fr`);
    panel.style.setProperty('--armoury-tray-content-gap', `${layout.trays.contentGapRem}rem`);
    const applyPaneRatio = () => {
      panel.style.setProperty('--armoury-armaments-pane-width', `${paneRatio}fr`);
      panel.style.setProperty('--armoury-inventory-pane-width', `${1 - paneRatio}fr`);
      const splitter = panel.querySelector('.armoury-pane-splitter');
      if (splitter) {
        splitter.setAttribute('aria-valuenow', String(Math.round(paneRatio * 100)));
        splitter.setAttribute('aria-orientation', panel.dataset.responsive === 'phone' ? 'horizontal' : 'vertical');
      }
    };
    applyPaneRatio();

    const left = wrap.querySelector('.armoury-left');
    const right = wrap.querySelector('.armoury-right');
    const blocks = eq.slots
      // A slot with nothing that fits it isn't a slot yet: Talisman is declared
      // in equipSlots.csv but has no pieces authored, and three empty squares
      // read as broken rather than as a promise. It appears the day a talisman
      // row exists.
      //
      // AND THIS TEST HAD TO SPLIT IN TWO (#90). It used to ask for the pieces
      // currently owned. That hid the Right Hand from a fresh
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
      .map((slot) => ({ slot }));

    // A LOOKUP, NOT A BRANCH. There is no `else` left to fall into: the cell
    // either has a builder or it has none, and none is a named failure. The
    // first pass turned the id into two characteristics and kept an if/else on
    // ONE of them — which is how a legal combination of the other reached a
    // branch that ignored it (Vira, gate of 5c49fed).
    const build = L && LAYOUTS[L.cell];
    if (build) {
      build(L, {
        left, right, blocks,
        layout,
        armamentView,
        armamentGridColumns: panel.dataset.responsive === 'phone'
          ? layout.responsive.phone.armamentGridColumns : layout.equipment.gridColumns,
        armamentsFolded: folded.get('armaments') === true,
        toggleArmaments: () => {
          folded.set('armaments', !folded.get('armaments'));
          armouryTraySession.folded.set('armaments', folded.get('armaments'));
          draw();
          wrap.querySelector('[data-fold="armaments"]')?.focus();
        },
        viewMode: viewMode(),
        positions: slotPositions,
        positionGroup,
        positionCard,
        positionGridCard,
        armamentGridDetail,
        toggleArmamentView,
        figure: () => figureFor(registries, run, cz),
        character: () => characterPanel(),
      });
    } else {
      console.error(`[content] the armoury view ${JSON.stringify(view)} has no layout`
        + ` — its row must ask for a combination the screen has: ${viewCellsSay()}`
        + ' in src/content/balance.js. This line is the defect, not a fallback.');
      right.appendChild(blocker(`The "${view}" view is declared but has no layout. Pick another view above.`, { attrs: { class: 'armoury-notice' } }));
    }
    const inventory = wrap.querySelector('.armoury-inventory');
    if (inventory) inventory.appendChild(inventoryBlock());
    wrap.querySelector('.armoury-strip').appendChild(cardStrip());
    const statsTray = wrap.querySelector('.armoury-stats-tray');
    if (viewMode().pane === 'inventory') statsTray.appendChild(statsComparison());
    else statsTray.remove();
    mountRegionTrays();

    const applyPaneDensity = () => {
      const equipmentPane = panel.querySelector('.armoury-equipment');
      const inventoryPane = panel.querySelector('.armoury-inventory');
      if (!equipmentPane) return;
      const equipmentWidth = equipmentPane.getBoundingClientRect().width;
      const inventoryWidth = inventoryPane ? inventoryPane.getBoundingClientRect().width : 0;
      panel.dataset.armamentDensity = equipmentWidth < layout.inventorySplit.foldGroupsBelowPx
        ? 'minimal' : equipmentWidth < layout.inventorySplit.compactItemsBelowPx ? 'compact' : 'comfortable';
      panel.dataset.inventoryDensity = viewMode().pane === 'inventory' && inventoryWidth < layout.inventorySplit.compactItemsBelowPx ? 'compact' : 'comfortable';
      // At phone width both panes stack, so a reveal left open before the
      // breakpoint would otherwise consume the inventory tray and push the
      // folded rows out of reach. Folding is presentation only; the player may
      // immediately reopen any item once the full-width tray has settled.
      if (panel.dataset.responsive === 'phone' && inventoryDisclosure) inventoryDisclosure.close();
      const cards = panel.querySelectorAll('details.armoury-position-card');
      if (equipmentWidth < layout.inventorySplit.foldSubcardsBelowPx) {
        for (const card of cards) {
          if (card.open) card.dataset.autoFolded = '1';
          card.open = false;
        }
      } else {
        for (const card of cards) {
          if (card.dataset.autoFolded === '1') card.open = true;
          delete card.dataset.autoFolded;
        }
      }
    };

    const splitter = panel.querySelector('.armoury-pane-splitter');
    if (splitter) {
      const snap = (raw) => {
        const bounded = clampPaneRatio(raw);
        const nearest = layout.inventorySplit.snapRatios.reduce((best, value) => (
          Math.abs(value - bounded) < Math.abs(best - bounded) ? value : best
        ), layout.inventorySplit.snapRatios[0]);
        return Math.abs(nearest - bounded) <= layout.inventorySplit.snapTolerance ? nearest : bounded;
      };
      const setFromPointer = (event) => {
        const content = panel.querySelector('.armoury-content');
        const rect = content.getBoundingClientRect();
        const phone = panel.dataset.responsive === 'phone';
        paneRatio = snap(phone
          ? (event.clientY - rect.top) / Math.max(1, rect.height)
          : (event.clientX - rect.left) / Math.max(1, rect.width));
        applyPaneRatio();
        applyPaneDensity();
      };
      splitter.addEventListener('pointerdown', (event) => {
        splitter.setPointerCapture(event.pointerId);
        splitter.classList.add('dragging');
        setFromPointer(event);
      });
      splitter.addEventListener('pointermove', (event) => {
        if (!splitter.hasPointerCapture(event.pointerId)) return;
        setFromPointer(event);
      });
      const finishResize = (event) => {
        if (splitter.hasPointerCapture(event.pointerId)) splitter.releasePointerCapture(event.pointerId);
        splitter.classList.remove('dragging');
        if (onChange) onChange(run.loadout, { armouryPaneRatio: paneRatio });
      };
      splitter.addEventListener('pointerup', finishResize);
      splitter.addEventListener('pointercancel', finishResize);
      splitter.addEventListener('keydown', (event) => {
        const phone = panel.dataset.responsive === 'phone';
        const directional = phone ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
        if (![...directional, 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        if (event.key === 'Home') paneRatio = layout.inventorySplit.minimumArmamentsRatio;
        else if (event.key === 'End') paneRatio = layout.inventorySplit.maximumArmamentsRatio;
        else paneRatio = snap(paneRatio + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 0.05 : -0.05));
        applyPaneRatio();
        applyPaneDensity();
        if (onChange) onChange(run.loadout, { armouryPaneRatio: paneRatio });
      });
      attachTooltip(splitter, () => panel.dataset.responsive === 'phone'
        ? '<div class="tt-title">Resize panes</div><p>Drag up or down. The divider snaps to the authored size stops.</p>'
        : '<div class="tt-title">Resize panes</div><p>Drag left or right. The divider snaps to the authored width stops.</p>');
    }
    const hybridSplitter = panel.querySelector('.armoury-hybrid-splitter');
    if (hybridSplitter && viewMode().pane === 'both') {
      const snap = (raw) => {
        const bounded = clampPaneRatio(raw);
        const nearest = layout.inventorySplit.snapRatios.reduce((best, value) => (
          Math.abs(value - bounded) < Math.abs(best - bounded) ? value : best
        ), layout.inventorySplit.snapRatios[0]);
        return Math.abs(nearest - bounded) <= layout.inventorySplit.snapTolerance ? nearest : bounded;
      };
      const setFromClientX = (clientX) => {
        const rect = panel.querySelector('.armoury-body').getBoundingClientRect();
        hybridRatio = snap((clientX - rect.left) / Math.max(1, rect.width));
        applyHybridRatio();
        applyPaneDensity();
      };
      hybridSplitter.addEventListener('pointerdown', (event) => {
        hybridSplitter.setPointerCapture(event.pointerId);
        hybridSplitter.classList.add('dragging');
        setFromClientX(event.clientX);
      });
      hybridSplitter.addEventListener('pointermove', (event) => {
        if (hybridSplitter.hasPointerCapture(event.pointerId)) setFromClientX(event.clientX);
      });
      const finishHybridResize = (event) => {
        if (hybridSplitter.hasPointerCapture(event.pointerId)) hybridSplitter.releasePointerCapture(event.pointerId);
        hybridSplitter.classList.remove('dragging');
        if (onChange) onChange(run.loadout, { armouryHybridRatio: hybridRatio });
      };
      hybridSplitter.addEventListener('pointerup', finishHybridResize);
      hybridSplitter.addEventListener('pointercancel', finishHybridResize);
      hybridSplitter.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        if (event.key === 'Home') hybridRatio = layout.inventorySplit.minimumArmamentsRatio;
        else if (event.key === 'End') hybridRatio = layout.inventorySplit.maximumArmamentsRatio;
        else hybridRatio = snap(hybridRatio + (event.key === 'ArrowRight' ? 0.05 : -0.05));
        applyHybridRatio();
        applyPaneDensity();
        if (onChange) onChange(run.loadout, { armouryHybridRatio: hybridRatio });
      });
      attachTooltip(hybridSplitter, () => '<div class="tt-title">Resize Hybrid panes</div><p>Drag left or right. The divider snaps to the authored width stops.</p>');
    }
    applyPaneDensity();
    if (typeof ResizeObserver !== 'undefined') {
      paneObserver = new ResizeObserver(applyPaneDensity);
      const content = panel.querySelector('.armoury-content');
      if (content) paneObserver.observe(content);
      const equipment = panel.querySelector('.armoury-equipment');
      if (equipment) paneObserver.observe(equipment);
    }

    notice = '';
    wrap.querySelector('.armoury-close').addEventListener('click', close);
    for (const b of wrap.querySelectorAll('[data-surface="armouryView"] [data-member]')) {
      b.addEventListener('click', () => {
        picking = null;
        view = b.dataset.member;
        // A view is a presentation preset, not a second saved preference.
        // Explicit per-region choices still win; untouched regions adopt the
        // newly selected Character/Inventory/Hybrid defaults.
        for (const region of contextRegions()) {
          if (!(storedFolds && typeof storedFolds[region.id] === 'boolean')) {
            folded.set(region.id, opensCollapsed(region.id, null, viewMode()));
          }
        }
        if (!(storedFolds && typeof storedFolds.armaments === 'boolean')) {
          folded.set('armaments', opensCollapsed('armaments', null, viewMode()));
        }
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

  const focusArmouryDestination = () => {
    if (!destinationPlan || !wrap.isConnected) return;
    const target = destinationPlan.region
      ? wrap.querySelector(`[data-fold="${destinationPlan.region}"]`)
      : wrap.querySelector(`[data-surface="armouryView"] [data-member="${destinationPlan.view}"]`);
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };

  draw();
  if (destinationPlan) queueMicrotask(focusArmouryDestination);
  return { close, redraw: draw };
}
