import { engravedIcon } from '../components/engravedIcon.js';
import { uiIconText } from '../../content/uiIcons.js';
import { logicalViewport } from '../viewViewport.js';
import { characterSheetModel } from '../models/CharacterSheetModel.js';
import { skillTrackButton } from './characterSheet.js';
import { progressionTip } from '../components/progressionCards.js';
import { swapOnError } from '../artFallback.js';
import { characterLevel } from '../../model/levelup.js';
import { levelProgress } from '../../model/progression.js';
import { equipmentRequirementReceipt } from '../../model/loadout.js';
import { renderEquipmentCard, equipmentDetails } from '../components/equipmentCard.js';
import { openCardInspection } from '../components/cardInspection.js';
import { createToast } from '../components/toast.js';
import { equipmentModLines, equipmentCompareRows } from '../../model/equipmentCompare.js';
import { mountEquipCompareModal } from '../components/equipCompareModal.js';
import { armouryPageOf } from '../../model/armouryPages.js';
import { openSlotChoiceModal, openEquipConfirmModal } from '../components/armouryEquipModals.js';
import { renderCollectibleCard } from '../components/collectibleCard.js';
import { paintedPresentation } from '../paintedOutfits.js';
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
  canSwap, canEquip, cycleSet, equipPiece, equipTransitionReceipt, gripRefusal, fitsSlot, cardMods, figureSpec,
  ownership, openedSets, visibleSets, rungFor, setCellState, slotHand, equippedPieces,
  loadoutLeaveRefusal,
} from '../../model/loadout.js';
import { armamentIntrinsicReceipt, equipmentSurfaceReceipt } from '../../model/equipmentPresentation.js';
import { inventoryRows, inventoryItemCount } from '../../model/inventoryPresentation.js';
import { equippedTagColor } from '../../model/equipmentUi.js';
import { relicText } from '../components/card.js';
import {
  renderEquipmentRequirements, renderPlayerPoise, renderPlayerLoad, renderRoleCopies,
} from '../components/equipmentReceipts.js';
import { esc, attachTooltip, hideTooltip } from '../components/tooltip.js';
import { armHold } from '../../framework/optionDecision.js';
import { refuses } from '../components/refusal.js';
import { playerSprite, equippedFigure, spritesAreEnabled } from '../assets.js';
import { sfx } from '../sfx.js';
import { statProjection, pieceWeight } from '../../model/statProjection.js';
import { resolveUpgradedEquipment } from '../../model/itemUpgrades.js';
import { syncFlaskGrowth } from '../../model/flaskgrowth.js';
import { closeFlaskActionMenu } from '../components/flask.js';
import {
  equipmentPositionCardState, inventorySelectionAction, normalizeArmouryLayout,
  orderArmouryPositions, orderArmourySlots,
} from '../../model/armouryLayout.js';
import {
  armouryOverlayModel, armouryPanelModel, equipmentSetCellModel, equipmentSlotModel,
} from '../models/ArmouryModels.js';
import {
  renderArmouryOverlay, renderArmouryPanel, renderEquipmentSlot,
} from '../components/armouryComponents.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';
import { armouryStatsPanel } from '../components/armouryStatsPanel.js';
import { armouryPickerTable, thumbSrc } from '../components/armouryPicker.js';
import { armouryInventoryBlock, isCollectibleCategory } from '../components/armouryInventory.js';
import { inventoryRowUsable } from '../models/ArmouryInventoryModel.js';
import { traySizeService } from '../services/TraySizeService.js';
import { clearSelection } from '../components/cardSelection.js';
import { t, tFull, tTip } from '../strings.js';
import { runClassIdentity } from '../../model/classCard.js';
import { attuneSigil, unattuneSigil, attunedSigilIds, attuneMaxOf, sigilRuleText } from '../../model/sigils.js';
import {
  armouryPaneSplit, inventoryComparison,
} from '../models/ArmouryWorkspaceModel.js';
// THE KIT (2026-09-04, the sweep): every piece inside the door is a kit builder
// — OptionCards for the positions, the inventory faces and the card rows,
// DetailCards for the character's numbers and the open item, StatPairs and
// KitLines for the facts, Flavour for the hints, a Blocker for a refusal —
// and styles/ui.css draws nothing for this screen any more.
import {
  el, eyebrow, titleS, subtitle, statusText, flavour, prose, pill, tagChip, artWell, detailCard, optionCard, options, optionGrid, face, button, chip, statStrip, kitLine, kitItem, blocker, meter,
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
  cards: Object.freeze({ view: 'cards', region: null }),
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
    label: t('armoury.tab.slots'),
    sel: '.armoury-body',
    count: (el) => el.querySelectorAll('.equip-slot').length,
    unit: 'slot',
  },
  {
    id: 'inventory',
    label: t('armoury.tab.inventory'),
    sel: '.armoury-inventory',
    count: (el) => [...el.querySelectorAll('[data-inventory-item]')]
      .reduce((sum, row) => sum + Number(row.dataset.itemCount || 0), 0),
    unit: 'item',
  },
  {
    id: 'cards',
    label: t('armoury.tab.cards'),
    sel: '.armoury-strip',
    count: (el) => el.querySelectorAll('[data-card-row]').length,
    unit: 'card',
  },
  {
    id: 'stats',
    label: t('armoury.tab.stats'),
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
    positions: orderArmouryPositions(
      ui.positions(slot).filter((position) => position.modelState !== 'hidden'),
    ),
  }));
  // The positions are OptionCards: one compact row each. Each row is a button
  // that selects it and opens its card inspection modal (no header row, no
  // count badge, no grid view: owner wireframe 2026-11-01).
  const slots = options([], { class: 'equip-slots armoury-position-list' });
  for (const { slot, positions } of positionsBySlot) {
    slots.appendChild(ui.positionGroup(slot, positions));
  }
  const equipment = el('section', { class: 'armoury-equipment armoury-section', dataset: { component: UI.armouryArmamentsCard, armamentView: 'list' } });
  const compact = ui.layout.equipment.compactList;
  equipment.style.setProperty('--armament-thumb-width', compact.thumbnailWidthPx);
  equipment.style.setProperty('--armament-phone-thumb-width', compact.phoneThumbnailWidthPx);
  equipment.style.setProperty('--armament-inspection-width', compact.inspectionWidthPx);
  equipment.append(el('div', { class: 'armament-list-workspace' }, [slots]));
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
  const painted = spritesAreEnabled() && !['classic', 'glyph'].includes(cz?.spriteStyle)
    ? paintedPresentation(run.class, figureSpec(registries, run.loadout, run.class).armourId, 'stand', equipmentAnimationForLoadout(registries, run.loadout, run.class)) : null;
  if (painted) { el.classList.add('painted-armoury'); el.appendChild(painted); return el; }
  const reacts = CFG().spriteReacts;
  const spec = figureSpec(registries, run.loadout, run.class);
  if (reacts === 'none') {
    el.appendChild(playerSprite(cz, run.class, spec.armourId));
    return el;
  }
  if (reacts === 'hands') spec.armourId = 'default';
  const fig = equippedFigure({ classId: run.class, ...spec });
  el.appendChild(fig || playerSprite(cz, run.class, spec.armourId));
  return el;
}

/** A piece's mods, written the way a player reads them. */
function modSummary(registries, piece) {
  return equipmentModLines(registries, piece);
}

// EVERY CHIP IN THE PICKER IS ONE YOU OWN (#90), so there is no `locked` here
// any more and no `hint` to carry. The parameters were removed rather than
// passed as false: a dead argument is a second copy of a decision, and the next
// author to see `locked: false` at every call site would reasonably conclude the
// picker still has a locked state to reach.
//
/** A piece's thumbnail in an ArtWell; the art dies quietly if the file is
 *  missing — the single-file dist and file:// play both depend on this. */
function pieceArt(piece, fallback = 'attack') {
  const well = artWell({ src: thumbSrc(piece), alt: '', small: true });
  const image = well.querySelector('img');
  swapOnError(image, () => engravedIcon(piece.icon || fallback) || Object.assign(document.createElement('span'), { textContent: uiIconText(piece.icon || fallback) }));
  return well;
}

// One counter, because the chosen note is referenced BY ID from the card that
// owns it and two chips in the same picker must not claim the same id.
let chosenNoteSerial = 0;

/** The kit picker's chip (creation's starting kit): an OptionCard — art, name, mods, tags. `.ec-*` are the hooks the tools read. */
/**
 * `level` is the FLOOR this picker's current view mode asks for — a view
 * SELECTS one of the three presentation levels (src/model/cardFields.js), it
 * does not own a field set of its own. Lighting a chip still promotes it to
 * `focus` on top of that floor, so the grid's glance faces say more the moment
 * one is chosen without the picker keeping its own copy of which that is.
 */
export function pieceChip(registries, piece, { selected, kind = null, presentation = null, level = 'glance', surface = 'creation' }) {
  const card = document.createElement('div');
  card.className = 'equip-chip poker-equipment-choice';
  const face = (kind ? renderCollectibleCard(registries, piece, kind, { interactive: false, level, surface }) : renderEquipmentCard(registries, piece, { interactive: false, presentation, level, surface })).card;
  face.tabIndex = 0;
  face.setAttribute('role', 'group');
  const choose = document.createElement('button');
  choose.type = 'button';
  choose.className = 'equipment-choose';
  // THE BUTTON ONLY EVER OFFERS THE CHOICE; it never reports it. A chosen card
  // is read off the ring the card wears (kit.css, `.is-chosen`), which is the
  // same ring the spoils door draws — one signal for the whole game.
  choose.textContent = t('equipment.choose', { piece: piece.name });
  // The ring is a colour, and a colour is not available to everyone. This note
  // is the same fact in words, sized out of the layout (`.sr-only`), so the
  // state survives for a screen reader once the button goes quiet.
  // IT IS TIED TO THE CARD, NOT MERELY PLACED NEAR IT. A sibling nobody points
  // at is read by nobody: Tab lands on the card, and the card is what has to
  // carry the state — the pressed button that used to carry it is hidden, and
  // `visibility: hidden` leaves the accessibility tree as well as the page.
  const note = document.createElement('span');
  note.className = 'sr-only equip-chosen-note';
  note.id = `equip-chosen-note-${++chosenNoteSerial}`;
  face.setAttribute('aria-describedby', [face.getAttribute('aria-describedby'), note.id].filter(Boolean).join(' '));
  card.append(face, choose, note);
  setPieceChipChosen(card, selected);
  return card;
}

/**
 * Put a kit chip into (or out of) its chosen state — the ring on the card, the
 * quiet button, the spoken note. The picker calls this instead of writing the
 * three of them itself, so a chip can never wear a ring while its button still
 * offers the choice.
 */
export function setPieceChipChosen(chip, chosen) {
  const on = !!chosen;
  const face = chip.querySelector('.equipment-poker-card, .card');
  chip.classList.toggle('on', on);
  face?.classList.toggle('is-chosen', on);
  const choose = chip.querySelector('.equipment-choose');
  if (choose) choose.setAttribute('aria-pressed', String(on));
  const note = chip.querySelector('.equip-chosen-note');
  if (note) note.textContent = on ? 'Selected' : '';
  // THE BUTTON IS ABOUT TO VANISH UNDER THE KEYBOARD. A player who chose with
  // Enter still has focus on the control this call hides, and hiding a focused
  // element drops the ring to the document — the next Tab restarts at the top
  // of the page instead of continuing from the choice just made. The card is
  // the stable landing: it is focusable, it is what now wears the ring, and it
  // is the thing the choice was about.
  if (on && choose && document.activeElement === choose) face?.focus({ preventScroll: true });
}

// Re-exported: callers import it from here (components/armouryInventory.js owns it).
export { isCollectibleCategory };

/**
 * mountEquipment(host, opts) → { close() }
 *
 *   inCombat  applies the authored combat-change rule and each slot's swap rule
 *   onSwap    routes active-set changes through the priced combat intent
 *   onEquip   routes item replacement/move/unequip through the priced combat intent
 */
export function mountEquipment(host, {
  registries, run, meta = {}, destination = '', equipItemId = '', inCombat: inCombatArg, onClose, onChange, onSwap, onEquip, onEquipmentChanged,
  // SPEC §14.1: the deck editor's Armoury door (under `free`, out of combat).
  onEditDeck = null, onCharacterSheet = null,
  handRules = null,
}) {
  // A SPENT BEAT BELONGS TO THE SCREEN THAT SPENT IT. cardSelection is a
  // page-wide store, and nothing in production ever emptied it — so a card
  // whose `i` had been read kept its first beat for the life of the page, and
  // meeting the same logical id on a later surface handed that surface a card
  // already one beat in: its first touch acted instead of selecting.
  clearSelection();
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
  // fight is on gets a visibly inert picker with a named cause. Law 1 clause 5 —
  // bad input fails by name, and the name here is the caller.
  if (typeof inCombatArg !== 'boolean') {
    console.error(
      `mountEquipment(): no boolean \`inCombat\` — got ${JSON.stringify(inCombatArg)}.`
      + ' Disabling its actions. This line is the defect, not the refusal.'
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
  if (stored && stored !== 'deck' && !IDS.includes(stored)) {
    console.warn(`[armoury] saved view ${JSON.stringify(stored)} is no longer declared`
      + ` — opening on ${JSON.stringify(shapeDefault)}.`);
  }
  // The view dropdown is gone (owner, 2026-11-05): the Armoury has two pages,
  // the Character tab's and the Armory tab's combined equipment + inventory
  // page. A saved view or a destination that names a retired view lands on the
  // page that now holds it (model/armouryPages.js).
  let view = armouryPageOf(destinationPlan?.view || ((stored && IDS.includes(stored)) ? stored : shapeDefault));
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
  if (!storedFolds) folded.set('inventory', false);
  if (destinationPlan?.region) folded.set(destinationPlan.region, false);
  // The Equipment view is one compact list (the grid view was retired 2026-11-01).
  const armamentView = 'list';
  // The row the player selected (outlined); Inspect opens its card in a modal.
  let armamentListSelection = null;
  let picking = null; // { slotId, setIndex }
  let selectedInventoryKey = null;
  let notice = ''; // a status or refusal, shown as a toast on the next draw
  const toast = createToast();
  // ONE HOME for the breakpoint question. `draw()` stamps it onto
  // `panel.dataset.responsive` and the pane observer below asks it again to tell
  // a real breakpoint crossing from a height-only resize; a second copy of the
  // comparison is how those two answers would drift.
  const responsiveMode = () => typeof window !== 'undefined' && logicalViewport().width <= layout.responsive.breakpoint ? 'phone' : 'desktop';
  let paneObserver = null;
  let paneFrame = 0;
  let inventoryDisclosure = null;
  let pickerSort = { column: 'status', direction: 'asc' };
  let pickerShowAll = false;
  let holdDisarms = [];
  const clearHoldDisarms = () => {
    for (const disarm of holdDisarms.splice(0)) disarm();
  };
  const registerHold = (disarm) => holdDisarms.push(disarm);
  // The footer's primary slot (W1e "Equip if available"). draw() binds it to
  // the panel it just rendered; the Inventory's selection fills it.
  let setFooterPrimary = () => {};
  const shellCopy = () => ({
    title: t('armoury.title'), closeLabel: t('armoury.close'), railLabel: t('armoury.categories'),
  });

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
    ...shellCopy(),
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
  // THE DECK'S FLOOR GATES EVERY ROAD THE PLAYER TAKES OUT (plan phase 3b,
  // proposal §5): Back, the close, Escape and the tap outside all go through
  // `leave`, which asks the model (loadoutLeaveRefusal) and shows its sentence
  // in place instead of closing. `close` itself stays unconditional — it is
  // also the teardown a host calls when a fight starts, and a door that can
  // trap a host is not a rule. `enteredWith` is what the run held when the
  // screen opened: a deck already under the floor on arrival may still leave.
  const enteredWith = Array.isArray(run.deck) ? run.deck.length : 0;
  const leave = () => {
    const refusal = loadoutLeaveRefusal(registries, run, { enteredWith });
    if (refusal) { notice = refusal; draw(); return; }
    close();
  };
  const close = () => {
    document.removeEventListener('keydown', onKey);
    if (paneObserver) paneObserver.disconnect();
    cancelAnimationFrame(paneFrame);
    clearHoldDisarms();
    toast.hide();
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
  // four under the tap floor, so this is NOT the phone's exit. The close is, and
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
    if (ev.target === wrap) { leave(); return; }
    if (!picking) return;
    // The footer's Back and action are outside the Inventory but are not a
    // "tap elsewhere": clearing the selection there would drop the action.
    if (ev.target.closest('.armoury-close, [data-surface="armouryView"], .modal-foot')) return;
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
    view = 'rack';
    folded.set('inventory', false);
  };
  const clearInventorySelection = () => {
    picking = null;
    armamentListSelection = null;
    selectedInventoryKey = null;
    view = 'rack';
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
    const slot = eq.slots.find(candidate => candidate.id === slotId);
    const previousId = run.loadout.sets[slotId]?.[setIndex];
    const previousName = previousId ? pieceById(slot, previousId)?.name || previousId : '';
    const piece = pieceId && (eq.slots.find(slot => slot.id === slotId)?.kinds.includes('armor')
      ? eq.armour.find(row => row.classId === run.class && row.id === pieceId)
      : eq.armaments.find(row => row.id === pieceId));
    const successMessage = piece
      ? t('armoury.change.equipped', { name: piece.name, slot: `${slot.label} · ${setIndex + 1}` })
        + (previousName && previousId !== pieceId ? ` ${t('armoury.change.stored', { name: previousName })}` : '')
      : t('armoury.change.unequipped', { name: previousName, slot: `${slot.label} · ${setIndex + 1}` });
    if (piece) {
      const requirement = equipmentRequirementReceipt(registries, piece, run.attributes, run);
      if (!requirement.ok) {
        notice = `${piece.name} requires ${requirement.failures.map(row => `${registries.attributes.get(row.attributeId).label} ${row.required} (you have ${row.actual ?? '—'})`).join(', ')}.`;
        draw();
        return false;
      }
    }
    if (inCombat) {
      if (typeof onEquip !== 'function') {
        notice = t('armoury.change.combatUnavailable');
        draw();
        return false;
      }
      const refused = onEquip(slotId, setIndex, pieceId);
      if (refused) {
        notice = refused;
        draw();
        return false;
      }
      if (hadSelection) clearInventorySelection();
      notice = successMessage;
      sfx.play('cardPlay');
      commit(hadSelection ? foldSettings() : null);
      return true;
    }
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
    notice = successMessage;
    sfx.play('cardPlay');
    commit(hadSelection ? foldSettings() : null);
    return true;
  }

  /**
   * Replace's last step (owner wireframe, 2026-11-01): a candidate picked for an
   * OCCUPIED position opens the comparison first, the equipped item on the left
   * and the new one on the right. Back returns to the picker having changed
   * nothing; Equip runs the same applyEquipmentChange the picker always ran.
   * An empty position, a drag/drop and the Inventory tab's own buttons are not a
   * replacement and equip at once.
   */
  function requestEquip(slotId, setIndex, pieceId, actionLabel, { confirm = false, opener = null, onBack = undefined } = {}) {
    const slot = eq.slots.find(candidate => candidate.id === slotId);
    const currentId = run.loadout.sets[slotId]?.[setIndex];
    if (!(picking || confirm) || !slot || !pieceId || currentId === pieceId || (!currentId && !confirm)) {
      return applyEquipmentChange(slotId, setIndex, pieceId, actionLabel);
    }
    const resolved = (id) => {
      const authored = pieceById(slot, id);
      if (!authored) return null;
      const ref = slot.kinds.includes('armor') ? `armor/${run.class}/${authored.id}` : `armament/${authored.id}`;
      return resolveUpgradedEquipment(registries, ref, (run.itemUpgradeLevels || {})[ref] || 0);
    };
    const current = currentId ? resolved(currentId) : null, next = resolved(pieceId);
    if (!next || (currentId && !current)) return applyEquipmentChange(slotId, setIndex, pieceId, actionLabel);
    if (!current) {
      // An EMPTY position: confirm with the item's card (Inventory equip flow, owner 2026-11-05).
      openEquipConfirmModal({
        registries, item: next, name: next.name, slotLabel: `${slot.label} · ${setIndex + 1}`, opener,
        onEquip: () => { applyEquipmentChange(slotId, setIndex, pieceId, actionLabel); }, onBack,
      });
      return true;
    }
    mountEquipCompareModal(wrap, {
      registries,
      title: t('armoury.compare.replaceTitle', { slot: slot.label }),
      current: { item: current, name: current.name },
      next: { item: next, name: next.name },
      rows: equipmentCompareRows(registries, current, next, {
        attributes: run.attributes, itemUpgradeLevels: run.itemUpgradeLevels, armamentLevels: run.armamentLevels,
      }),
      onEquip: () => { applyEquipmentChange(slotId, setIndex, pieceId, actionLabel); }, onBack,
      returnFocusElement: opener || undefined,
    });
    return true;
  }

  /**
   * Equip on an Inventory item (owner, 2026-11-05): every position open to it
   * is a destination. More than one asks first in a "Choose a slot" modal; one
   * goes straight to the compare modal (occupied) or the confirm modal (empty).
   * Equip itself is the same applyEquipmentChange as ever, so combat pricing
   * (onEquip) and refusals are unchanged.
   */
  function beginInventoryEquip(row, opener) {
    const choices = [];
    for (const slot of eq.slots.filter(candidate => fitsSlot(candidate, row.item))) {
      for (const position of slotPositions(slot).filter(candidate => candidate.modelState !== 'hidden')) {
        choices.push({ slot, position, id: `${slot.id}:${position.index}` });
      }
    }
    const open = choices.filter(choice => choice.position.state !== 'locked');
    // Back from the compare or confirm child lands on the slot list it came from (when there was one).
    const proceed = ({ slot, position }, onBack = undefined) => {
      const label = `${slot.label} · ${position.index + 1}`;
      const seal = canEquip(registries, slot.id, { inCombat, loadout: run.loadout, classId: run.class, setIndex: position.index, itemId: row.id, attributes: run.attributes, itemUpgradeLevels: run.itemUpgradeLevels, armamentLevels: run.armamentLevels });
      const transition = equipTransitionReceipt(registries, run.loadout, slot.id, position.index, row.id);
      const refusal = !seal.ok ? seal.reason : !transition.ok ? transition.reason : '';
      if (refusal) { notice = refusal; draw(); return; }
      requestEquip(slot.id, position.index, row.id, `Equip ${row.name} to ${label}`, { confirm: true, opener, onBack });
    };
    if (open.length === 1) { proceed(open[0]); return; }
    const chooseSlot = () => openSlotChoiceModal({
      opener,
      options: choices.map(({ slot, position, id }) => ({
        id, label: `${slot.label} · ${position.index + 1}`,
        disabled: position.state === 'locked',
        hint: position.rung?.hint || position.rung?.name || '',
        sub: `${t(position.active ? 'armoury.slot.active' : 'armoury.slot.reserve')} · ${position.state === 'empty' ? tTip('piles.empty') : position.summary.name}`,
      })),
      onChoose: (id) => { const choice = choices.find(candidate => candidate.id === id); if (choice) proceed(choice, chooseSlot); },
    });
    chooseSlot();
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
    // A compatible hand is not a player's choice. Inventory items without a
    // current position first ask for a destination; only that choice arms equip.
    return null;
  }

  function positionActivationSeal(slot, position) {
    const seal = canSwap(registries, slot.id, { inCombat });
    if (!seal.ok) return seal;
    const trial = structuredClone(run.loadout);
    trial.active[slot.id] = position.index;
    const reason = gripRefusal(registries, trial, run.class, slot.id, position.index, trial.sets[slot.id][position.index]);
    return reason ? { ok: false, reason } : seal;
  }

  function activatePosition(slot, position, { openPicker = false } = {}) {
    if (openPicker) {
      openInventoryForSelection(slot.id, position.index);
      selectedInventoryKey = null;
      draw();
      return;
    }
    const rule = positionActivationSeal(slot, position);
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
    if (picking) {
      const target = wrap.querySelector('.armoury-selection-context button');
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
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

  function positionActions(slot, position) {
    const actions = el('div', { class: 'armament-position-actions' });
    const replace = button({ label: t(position.state === 'empty' ? 'armoury.action.choose' : 'armoury.action.replace'),
      className: 'armament-replace', attrs: { 'aria-label': t('armoury.action.chooseFor', { slot: position.label }) } });
    replace.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      activatePosition(slot, position, { openPicker: true });
    });
    actions.append(replace);
    if (position.state === 'occupied') {
      const unequip = button({ label: t('armoury.action.unequip'), className: 'armament-unequip',
        attrs: { 'aria-label': t('armoury.action.unequipNamed', { name: position.summary.name, slot: position.label }) } });
      const seal = canEquip(registries, slot.id, { inCombat, loadout: run.loadout, classId: run.class,
        setIndex: position.index, itemId: null, attributes: run.attributes });
      const transition = equipTransitionReceipt(registries, run.loadout, slot.id, position.index, null);
      const reason = !seal.ok ? seal.reason : !transition.ok ? transition.reason
        : inCombat && !onEquip ? t('armoury.change.combatUnavailable') : '';
      if (reason) { unequip.disabled = true; unequip.title = reason; }
      else unequip.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        applyEquipmentChange(slot.id, position.index, null, `Unequipped ${position.summary.name} from ${position.label}`);
      });
      actions.append(unequip);
      if (reason) actions.append(prose(reason, { class: 'armament-action-reason' }));
    }
    if (!position.active) {
      const activate = button({ label: t('armoury.action.activate'), className: 'armament-activate',
        attrs: { 'aria-label': t('armoury.action.activateNamed', { slot: position.label }) } });
      const seal = positionActivationSeal(slot, position);
      activate.disabled = !seal.ok;
      if (!seal.ok) activate.title = seal.reason;
      activate.addEventListener('click', () => activatePosition(slot, position));
      actions.append(activate);
      if (!seal.ok) actions.append(prose(seal.reason, { class: 'armament-action-reason' }));
    }
    return actions;
  }

  const isInspected = (slot, position) => !!armamentListSelection
    && armamentListSelection.slotId === slot.id && armamentListSelection.index === position.index;
  /**
   * Inspect opens the item's card in the kit's inspection modal, as the Smith
   * rail does. The face is an inspect card with no inspection door of its own.
   */
  function openItemInspection(item, category, { owned: count = null, opener = null, extra = null } = {}) {
    if (!item) return null;
    const rendered = isCollectibleCategory(category)
      ? renderCollectibleCard(registries, item, category, { inspection: false, interactive: false, owned: count, level: 'inspect' })
      : renderEquipmentCard(registries, item, { inspection: false, interactive: false, owned: count, level: 'inspect', surface: 'armoury' });
    const details = equipmentDetails(rendered.explanations);
    // Smithing tier, the last smithing receipt and the Weapon Art / Unique Skill costs.
    if (extra) details.append(extra);
    return openCardInspection({ title: item.name, card: rendered.card, details, opener });
  }
  /** Selects a row (outline) and opens its card; the real buttons above it never reach here. */
  function selectPosition(slot, position) {
    armamentListSelection = { slotId: slot.id, index: position.index };
    draw();
    const opener = wrap.querySelector(`[data-slot-position="${CSS.escape(`${slot.id}:${position.index}`)}"] .armament-row-select`);
    opener?.focus({ preventScroll: true });
    if (position.state === 'occupied') {
      const extra = slot.kinds.includes('armor') ? null : armamentDetailPane(slot, position.summary);
      openItemInspection(position.summary.item, position.summary.category, { opener, extra });
    }
  }
  /** The row's whole face is one stretched button; Replace and Unequip sit above it. */
  function rowSelectButton(slot, position, name) {
    const hit = button({ label: '', className: 'armament-row-select',
      attrs: { 'aria-label': t('armoury.action.inspectNamed', { name, slot: position.label }),
        'aria-pressed': String(isInspected(slot, position)) } });
    hit.addEventListener('click', () => selectPosition(slot, position));
    return hit;
  }

  // A POSITION IS AN OPTIONCARD: art, name, the combat bonus as its description,
  // the category and weight as its meta, tags as Tags, the act (Equip /
  // Equipped) trailing. Locked and empty are the same card in other states.
  function positionCard(slot, position) {
    const selected = picking && picking.slotId === slot.id && picking.setIndex === position.index;
    if (position.state === 'locked') {
      return el('article', {
        class: 'armoury-position-card armament-vacant-row is-locked',
        dataset: { component: UI.armouryLockedPositionCard, slotPosition: `${slot.id}:${position.index}` },
      }, [
        el('div', { class: 'armament-compact-heading' }, [
          el('span', { class: 'armament-position-code', text: `${position.code} —`, title: position.label }),
          el('strong', { text: 'Locked' }),
          el('span', { class: 'armament-unlock-requirement', text: position.rung?.hint || position.rung?.name || 'Locked position' }),
        ]),
      ]);
    }

    if (position.state === 'empty') {
      const card = el('article', {
        class: `armoury-position-card armament-vacant-row is-empty${selected ? ' is-selected' : ''}${isInspected(slot, position) ? ' is-inspected' : ''}`,
        dataset: { component: UI.armouryEmptyPositionCard, slotPosition: `${slot.id}:${position.index}` },
      }, [
        el('div', { class: 'armament-compact-heading' }, [
          el('span', { class: 'armament-position-code', text: `${position.code} —`, title: position.label }),
          el('strong', { text: tTip('piles.empty') }),
          pill({ label: t(position.active ? 'armoury.slot.active' : 'armoury.slot.reserve'), attrs: { class: 'armament-equipped-badge' } }),
        ]), positionActions(slot, position), rowSelectButton(slot, position, tTip('piles.empty')),
      ]);
      attachPositionDropTarget(card, slot, position);
      return card;
    }

    const card = el('article', {
      class: `armoury-position-card armament-compact-row is-occupied${position.active ? ' is-active' : ''}${selected ? ' is-selected' : ''}${isInspected(slot, position) ? ' is-inspected' : ''}`,
      dataset: { component: UI.armouryEquipmentPositionCard, slotPosition: `${slot.id}:${position.index}`, positionState: position.action },
    });
    const thumbnail = el('div', { class: 'armament-card-thumbnail', 'aria-hidden': 'true' },
      renderEquipmentCard(registries, position.summary.item, { interactive: false, inspection: false, level: 'inspect', surface: 'armoury' }).card);
    const head = el('div', { class: 'armament-compact-heading armoury-position-values' }, [
      el('span', { class: 'armament-position-code', text: `${position.code} —`, title: position.label }),
      el('strong', { class: 'armament-position-name', text: position.summary.name }),
      pill({ label: position.active ? 'Equipped' : t('armoury.slot.reserve'), attrs: { class: 'armament-equipped-badge' } }),
    ]);
    card.append(rowSelectButton(slot, position, position.summary.name), thumbnail, el('div', { class: 'armament-compact-body' }, [head, positionActions(slot, position)]));
    attachPositionDropTarget(card, slot, position);
    return card;
  }

  const pieceById = (slot, id) => (slot.kinds.includes('armor')
    ? (eq.armour || []).find((piece) => piece.classId === run.class && piece.id === id)
    : (eq.armaments || []).find((piece) => piece.id === id)) || null;
  const RELATION_COPY = Object.freeze({
    replaces: 'armoury.compare.replaces', removes: 'armoury.compare.removes', fills: 'armoury.compare.fills',
  });

  /**
   * W1n: the selected item compared with what is equipped, and whether it can
   * go on. Every value is read from the candidate receipt and the loadout's
   * own refusals (models/ArmouryWorkspaceModel.js); nothing here is computed.
   */
  function selectionFacts(row, target, comparison, eligibility, actionLabel, roleLabels) {
    const occupantId = (run.loadout.sets[target.slot.id] || [])[target.setIndex] || null;
    const occupantName = target.kind === 'unequip' ? row.name
      : (occupantId && occupantId !== row.id ? (pieceById(target.slot, occupantId)?.name || occupantId) : null);
    const compared = inventoryComparison({
      candidate: comparison, target: { kind: target.kind, slotLabel: `${target.slot.label} · ${target.setIndex + 1}` }, occupantName, roleLabels,
    });
    const facts = el('section', { class: 'armoury-selection-facts', dataset: { component: UI.armourySelectionFacts } });
    if (compared) {
      const { relation } = compared;
      facts.append(
        eyebrow(t('armoury.compare.title')),
        prose(t(RELATION_COPY[relation.kind], relation.kind === 'fills'
          ? { slot: relation.slot } : { name: relation.name, slot: relation.slot }), { class: 'armoury-compare-relation' }),
        compared.unchanged
          ? statusText(t('armoury.compare.unchanged'), { class: 'armoury-compare-roles' })
          : kitLine(compared.roles.map((r) => kitItem({
            glyph: 'skill', name: t('armoury.compare.role', { label: r.label, before: r.before, after: r.after }),
          })), { class: 'armoury-compare-roles' }),
      );
    }
    if (eligibility && eligibility.state !== 'none') {
      const attributeLabel = (id) => registries.attributes.get(id)?.label || id;
      const requirementText = () => eligibility.shortfalls.map((s) => t('armoury.eligibility.requirement', {
        attribute: attributeLabel(s.attributeId), required: s.required, actual: s.actual ?? '—',
      })).join(', ');
      const line = eligibility.state === 'blocked'
        ? blocker(t('armoury.eligibility.blocked', { reason: eligibility.reason }))
        : statusText(eligibility.state === 'short'
          ? t('armoury.eligibility.short', { requirements: requirementText() })
          : t('armoury.eligibility.ready', { action: actionLabel }));
      line.classList.add('armoury-eligibility');
      line.dataset.eligibility = eligibility.state;
      facts.appendChild(line);
    }
    return facts;
  }

  /** The footer's primary: the selected item's own action, with its hold and its refusal. */
  function footerAction(plan) {
    if (!plan) return null;
    const node = button({
      label: plan.label, weight: 'primary', className: 'armoury-foot-action',
      attrs: { dataset: { focusable: 'true', footAct: plan.kind } },
    });
    if (plan.blocked) {
      node.disabled = true;
      node.classList.add('locked');
      node.setAttribute('aria-disabled', 'true');
      refuses(node, () => plan.reason);
      return node;
    }
    if (plan.explicit) node.addEventListener('click', plan.act);
    else registerHold(armHold(node, { ms: plan.holdMs, id: 'equipInventory', onConfirm: plan.act }));
    return node;
  }

  // SPEC §15.4: the Armoury's Sigils panel. One row per owned legendary, in
  // `run.sigils` order, with Attune / Unattune out of combat (the model pair in
  // model/sigils.js decides; a refusal is shown here as text). In combat the
  // rows show and no button is drawn. Absent while the run owns no legendary.
  let sigilRefusal = '';
  function sigilsPanel() {
    const owned = (run.sigils || []).filter((id) => registries.sigils.has(id) && registries.sigils.get(id).rarity === 'legendary');
    if (!owned.length) return null;
    const attuned = attunedSigilIds(run);
    const section = el('section', { class: 'armoury-sigils', dataset: { component: UI.armourySigilsPanel } });
    section.append(
      titleS(t('armoury.sigils.title')),
      statusText(t('armoury.sigils.count', { n: attuned.length, max: attuneMaxOf(registries) }), { class: 'armoury-sigils-count' }),
    );
    if (sigilRefusal) section.append(prose(sigilRefusal, { class: 'armoury-sigils-refusal' }));
    sigilRefusal = '';
    for (const id of owned) {
      const def = registries.sigils.get(id);
      const on = attuned.includes(id);
      const row = el('div', { class: 'armoury-sigil', dataset: { sigil: id, attuned: on ? 'true' : 'false' } });
      row.append(
        el('span', { class: 'armoury-sigil-name', text: def.name }),
        statusText(t(on ? 'armoury.sigils.attuned' : 'armoury.sigils.idle'), { class: 'armoury-sigil-state' }),
        prose(def.blurb, { class: 'armoury-sigil-blurb' }),
        prose(sigilRuleText(registries, id), { class: 'armoury-sigil-rule' }),
      );
      if (!inCombat) {
        const label = t(on ? 'armoury.sigils.unattune' : 'armoury.sigils.attune', { name: def.name });
        const act = button({ label, weight: on ? undefined : 'primary', className: 'armoury-sigil-act', attrs: { dataset: { focusable: 'true', sigilAct: on ? 'unattune' : 'attune' } } });
        act.addEventListener('click', () => {
          const result = on ? unattuneSigil(run, id) : attuneSigil(registries, run, id);
          if (!result.ok) { sigilRefusal = result.reason; draw(); return; }
          commit();
        });
        row.append(act);
      }
      section.append(row);
    }
    return section;
  }

  /** While a position is picked: the candidates as an Item / Status / Actions table. */
  function pickerTable(args) {
    return armouryPickerTable({
      run, eq, wrap, draw, openItemInspection, requestEquip,
      // Live: draw() rebinds setFooterPrimary, so never pass the value.
      setFooterPrimary: (plan) => setFooterPrimary(plan),
      getPicking: () => picking,
      getPickerSort: () => pickerSort,
      setPickerSort: (sort) => { pickerSort = sort; },
      getPickerShowAll: () => pickerShowAll,
      setPickerShowAll: (showAll) => { pickerShowAll = showAll; },
    }, args);
  }

  /** An owned item with an action of its own beyond equipping: a skill book (Read). Listed in and out of combat; the action is out of combat only. */
  // A learned class card is one too (SPEC §14.3: the Inventory may equip one learned card or leave the core slot empty); it is
  // listed only when there is a choice to make (more than one learned card, or the core slot already empty), out of combat,
  // and never on a configured profile (Core 2 keeps its class fixed).
  const usableRow = (row) => inventoryRowUsable(row, { inCombat, run });

  /** The Inventory section: the usable items normally (none, and no section, when there are none), compatible replacements while a position is selected. */
  function inventoryBlock() {
    return armouryInventoryBlock({
      registries, run, meta, layout, eq, inCombat, wrap,
      draw, commit, applyEquipmentChange, beginInventoryEquip, comparisonFor, footerAction, inventoryTarget,
      openInventoryForSelection, pickerTable, registerHold, requestEquip, responsiveMode, selectionFacts,
      setFooterPrimary: (plan) => setFooterPrimary(plan), slotSummary,
      getPicking: () => picking,
      setPicking: (value) => { picking = value; },
      getSelectedInventoryKey: () => selectedInventoryKey,
      setSelectedInventoryKey: (key) => { selectedInventoryKey = key; },
      setInventoryDisclosure: (disclosure) => { inventoryDisclosure = disclosure; },
      setDraggingItemId: (id) => { draggingItemId = id; },
    });
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
    const box = el('div', { class: 'armoury-stats-summary', dataset: { component: UI.armouryStatsSummary } }, [
      detailCard({ eyebrow: t('progression.tab.character'), name: runClassIdentity(registries, run).name, meta: `Level ${characterLevel(run)}`, attrs: { class: 'armoury-stats-identity' } }),
      group('Combat', [['Strike', valueFor('attack')], [labelFor('technique'), valueFor('technique')], ['Defense', valueFor('guard')]]),
      group(t('progression.attributes'), projection.attributes.map((attr) => [attr.shortLabel || attr.label, attr.value])),
      group('Resources', [[t('combat.actions'), derived('energy')], ['Hand', derived('draw')], ['Resistance', '—']]),
      group('Run', [['Fights won', runStats.fightsWon || 0], ['Damage dealt', runStats.damageDealt || 0], ['Damage taken', runStats.damageTaken || 0]]),
      detailCard({ eyebrow: 'Relics', muted: true, attrs: { class: 'armoury-stats-group' }, children: relicNames.length
        ? kitLine(relicNames.map((name) => kitItem({ glyph: 'skill', name })))
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
        ? `${row.receipt.base} base + ${row.receipt.rating.value} ${row.receipt.rating.id.toUpperCase()} (${row.receipt.rating.sourceLabel}) + ${row.receipt.rarityBonus} rarity`
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

  /**
   * Put a badge on a Meter's plate, before the value. NOT `plate?.insert…`:
   * a kit Meter that stopped emitting `.m-plate` would have taken the reason
   * to visit a shrine, and the draft waiting at the next reward, off the
   * screen with no error at all. A missing plate is a broken atom, so it says
   * so by name.
   */
  function badgePlate(node, badge, what) {
    const plate = node.querySelector('.m-plate');
    if (!plate) throw new Error(`armoury: the kit Meter has no .m-plate to place ${what} beside`);
    plate.insertBefore(badge, plate.querySelector('.m-value'));
  }

  /**
   * THE LEVEL BAR. The Armoury named the level and never said how far the next
   * one was, so the one ledger that always moves was the one thing the screen
   * would not show. The kit's Meter, stacked: the level on the plate, the XP
   * beside it, the climb as the fill. Every number is levelProgress's, which
   * is levelUpPlan's — the shrine and this bar read the same step.
   */
  function openProgression(opener, tab) {
    onCharacterSheet?.(opener, tab, () => {
      draw();
      wrap.querySelector(tab === 'skills' ? '.character-skill-progression' : '.character-level-action')?.focus({ preventScroll: true });
    });
  }

  function characterLevelMeter() {
    const progress = levelProgress(registries, run);
    const node = meter({
      stack: true, tone: 'xp',
      label: progress.label,
      value: progress.value,
      pct: progress.pct,
      // The kit's contract is that an instrument reads data-cur/data-max and
      // never the label, so a capped run — which has no next step — offers
      // neither rather than a pair the full bar contradicts.
      cur: progress.capped ? null : progress.xp, max: progress.capped ? null : progress.xpToNext,
      ariaLabel: progress.sense,
      attrs: {
        class: `character-level-meter${progress.points ? ' has-points' : ''}`,
        dataset: { component: UI.armouryLevelProgress, level: String(progress.level), capped: progress.capped ? 'true' : 'false' },
      },
    });
    attachTooltip(node, () => `<div class="tt-title">${esc(progress.label)}</div><p>${esc(progress.sense)}</p>`);
    // The waiting points belong beside the LEVEL, not past the XP: a stacked
    // plate spreads its children, and appending would have put the reason to
    // visit a shrine on the far side of the number it explains. The sentence
    // is the model's, spelled once there; the plate is only where it lands.
    if (progress.pointsLabel) {
      badgePlate(node, statusText(progress.pointsLabel, { class: 'character-level-points' }), 'the waiting attribute points');
    }
    if (onCharacterSheet) {
      const action = button({ label: t('progression.title'), className: 'character-level-action', attrs: { 'aria-haspopup': 'dialog' } });
      progressionTip(action, 'Open level, attributes, skills and class progression');
      action.addEventListener('click', () => openProgression(action, 'character'));
      node.append(action);
    }
    return node;
  }

  /** One skill track as a Meter: its name and level on the plate, its XP as the fill. */
  function skillProgressMeter(rowModel) {
    const track = characterSheetModel(registries, run).tracks.find(track => track.id === rowModel.id);
    return skillTrackButton(registries, run, track, rowModel);
  }

  function characterStatsPanel() {
    return armouryStatsPanel({
      registries, run, meta, layout, inCombat, handRules, onCharacterSheet,
      viewMode, characterPowerEntries, relicEntries, skillProgressMeter, equipmentReceiptPanel, openProgression,
    });
  }

  /** The character's summary is a LabelStack: Eyebrow (the case is the stylesheet's), Title·S, Subtitle. */
  function characterSummaryPanel() {
    const cls = registries.classes.get(run.class);
    const identity = runClassIdentity(registries, run);
    return el('header', { class: 'character-summary as-labelstack' }, [
      eyebrow(`Forsaken · ${identity.name} · Level ${characterLevel(run)}`, { class: 'character-kicker' }),
      titleS(identity.name, { tag: 'h3' }),
      subtitle(run.classUnequipped ? 'Class slot empty. Equip a learned class from your inventory.' : cls.description || ''),
      characterLevelMeter(),
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

  function positionGroup(slot, positions) {
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
        return positionCard(slot, position);
      },
    }).element;
  }

  // THE ITEM'S DETAILS are a DetailCard: Eyebrow (the slot), the name, the lore
  // as Flavour, then every fact as a StatRow (`Smithing tier` is the row the
  // Smith tool reads), the last smithing as a StatRow, the tags as a KitLine
  // whose items carry their meaning in the tooltip.
  function armamentDetailPane(slot, summaryItem) {
    const item = summaryItem.item;
    if (!item) {
      return null;
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
        fact('Weight', String(pieceWeight(item))),
        fact('Weapon Art Mana', String(intrinsic.weaponArtManaCost)),
        fact('Unique Skill Stamina', String(intrinsic.uniqueSkillStaminaCost)),
      ] : []),
    ];
    const tagLine = kitLine(tagRows.length
      ? tagRows.map((tag) => {
        const item = kitItem({ glyph: 'skill', name: tag.label });
        attachTooltip(item, () => `<div class="tt-title">${esc(tag.label)}</div><p>${esc(tag.description)}</p>`);
        return item;
      })
      : [kitItem({ glyph: 'skill', name: 'No tags authored.' })], { class: 'armoury-armament-tag-details' });
    const detail = el('section', { class: 'armoury-armament-details', dataset: { component: UI.armouryArmamentDetailPane } }, [
      flavour(item.blurb || 'No lore text authored.', { class: 'armoury-armament-lore' }),
      ...facts,
      smithingReceipt ? el('div', { class: 'as-statrow flat armoury-smithing-receipt' }, [
        el('span', { class: 'sr-id' }, el('b', { class: 'sr-name', text: 'Last Smithing' })),
        el('span', { class: 'sr-vals' }, el('span', { class: 'sp-v', text: `Tier ${smithingReceipt.beforeLevel} → ${smithingReceipt.afterLevel} · ${smithingReceipt.cost} Stone · ${(smithingReceipt.changes || []).some((change) => ['stat', 'budget', 'card'].includes(change.kind)) ? smithingReceipt.changes.map((change) => `${change.label} ${change.before} → ${change.after}`).join(', ') : `${smithingReceipt.affectedCards.length} basic cards improved`}` })),
      ]) : null,
      tagLine,
    ]);
    return detail;
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
    // W1e: the pane scrolls, or (Inventory) its item collection does.
    const previousScroll = wrap.querySelector('.armoury-pane')?.scrollTop || 0;
    const previousCollectionScroll = wrap.querySelector('.armoury-item-collection')?.scrollTop || 0;
    if (paneObserver) paneObserver.disconnect();
    cancelAnimationFrame(paneFrame);
    clearHoldDisarms();
    // The layout is READ off the row, never inferred from the id. `data-surface`
    // / `data-member` are the house convention for a navigable set (#78): the
    // host names the set, each control names its member, so an instrument can
    // enumerate this from the rendered page without importing anything.
    const L = viewLayout(view);
    const panelModel = armouryPanelModel({
      ...shellCopy(),
      view,
      views: viewIds(),
      viewLabels: Object.fromEntries(Object.entries(layout.viewModes).map(([id, mode]) => [id, mode.label || id])),
      layout: L,
      subject: 'slots',
      picking: !!picking,
      notice: '', // shown as a toast over the panel (below), not as a row
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
    // W1e footer: Back bottom-left (leaves, like the close and Escape); the
    // selected item's action bottom-right when there is one.
    const back = button({ label: t(picking ? 'armoury.destination.back' : 'common.back'), role: 'exit', className: 'armoury-back', attrs: { dataset: { focusable: 'true' } } });
    back.addEventListener('click', () => { if (picking) { clearInventorySelection(); draw(); } else leave(); });
    const rendered = renderArmouryPanel(panelModel, wrap, { back,
      tabs: [
        { id: 'character', label: t('progression.tab.character'), selected: view === 'grid' },
        { id: 'armory', label: t('armoury.hub.armory'), selected: view !== 'grid' },
        { id: 'deck', label: t('armoury.hub.deck'), selected: false },
      ],
      onTab: id => {
        hideTooltip();
        if (id === 'deck') {
          // Remember the Deck tab as the last menu, so the Armoury button reopens the editor (main.js showArmoury).
          if (onEditDeck) { onChange?.(run.loadout, { equipView: 'deck' }); leave(); if (!wrap.isConnected) onEditDeck(); else draw(); }
          else { notice = inCombat ? 'Deck editing is unavailable during combat.' : 'Deck editing is unavailable with the current settings.'; draw(); }
          return;
        }
        picking = null;
        view = id === 'character' ? 'grid' : 'rack';
        onChange?.(run.loadout, { equipView: view });
        draw();
        wrap.querySelector(`.armoury-head [data-modal-tab="${id}"]`)?.focus({ preventScroll: true });
      },
    });
    const deckTab = rendered.panel.querySelector('[data-modal-tab="deck"]');
    deckTab?.setAttribute('aria-disabled', String(!onEditDeck));
    if (deckTab) progressionTip(deckTab, onEditDeck ? 'Edit your deck' : inCombat ? 'Unavailable during combat' : 'Deck editing is disabled by the current settings');
    setFooterPrimary = rendered.setPrimary;
    const panel = rendered.panel;
    panel.dataset.viewMode = viewMode().label;
    panel.dataset.pane = viewMode().pane;
    panel.dataset.page = view;
    panel.dataset.characterState = viewMode().character;
    panel.dataset.composition = 'character-equipment';
    panel.dataset.responsive = responsiveMode();
    // The active pane's split (W1e itemCollection | equipmentDetail, W1n items
    // | comparison): columns on wide hosts, rows on phones; shares from config.
    const split = armouryPaneSplit({ responsive: panel.dataset.responsive });
    panel.dataset.split = split.axis;
    panel.style.setProperty('--armoury-collection-track', split.collectionTrack);
    panel.style.setProperty('--armoury-detail-track', split.detailTrack);
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
    wrap.querySelector('.armoury-stats-tray').remove();
    // The Armory page is ONE scrolling body: the equipment slots on top, the
    // Inventory's sections below them. The Character page carries neither.
    if (view !== 'grid') {
      // Owner 2026-11-06: the Armory tab is the equipped-slot rows and nothing else, so there is no scrolling. The item
      // collection and its detail pane are gone; items are chosen through the slot's picker (Choose item / Replace), which
      // is this same block opened for one slot, and through the reward / purchase Equip flow (beginInventoryEquip).
      if (picking || inventoryRows(registries, run, meta).some(usableRow)) {
        inventory.append(inventoryBlock());
        if (selectedInventoryKey) inventoryDisclosure?.open(selectedInventoryKey);
      }
      // SPEC §15.4: the Sigils panel stays below the slot rows.
      const sigils = sigilsPanel();
      if (sigils) inventory.append(sigils);
      if (!inventory.children.length) inventory.remove();
    } else inventory.remove();
    wrap.querySelector('.armoury-strip').parentElement.remove();

    let lastPaneWidths = null;
    const applyPaneDensity = () => {
      const equipmentPane = panel.querySelector('.armoury-equipment');
      const inventoryPane = panel.querySelector('.armoury-inventory');
      if (!equipmentPane) return;
      const equipmentWidth = equipmentPane.getBoundingClientRect().width;
      const inventoryWidth = inventoryPane ? inventoryPane.getBoundingClientRect().width : 0;
      const widths = [equipmentWidth, inventoryWidth, panel.dataset.responsive];
      if (lastPaneWidths && Math.abs(widths[0] - lastPaneWidths[0]) < 1
        && Math.abs(widths[1] - lastPaneWidths[1]) < 1 && widths[2] === lastPaneWidths[2]) return;
      lastPaneWidths = widths;
      panel.dataset.armamentDensity = equipmentWidth < layout.inventorySplit.foldGroupsBelowPx
        ? 'minimal' : equipmentWidth < layout.inventorySplit.compactItemsBelowPx ? 'compact' : 'comfortable';
      panel.dataset.inventoryDensity = viewMode().pane === 'inventory' && inventoryWidth < layout.inventorySplit.compactItemsBelowPx ? 'compact' : 'comfortable';
    };

    if (typeof ResizeObserver !== 'undefined') {
      // Density writes can change observed geometry. Run them outside the
      // observer delivery, and ignore height-only changes when a fold opens.
      paneObserver = new ResizeObserver(() => {
        cancelAnimationFrame(paneFrame);
        paneFrame = requestAnimationFrame(() => {
          if (!panel.isConnected) return;
          if (panel.dataset.responsive !== responsiveMode()) draw();
          else applyPaneDensity();
        });
      });
      const content = panel.querySelector('.armoury-content');
      if (content) paneObserver.observe(content);
      const equipment = panel.querySelector('.armoury-equipment');
      if (equipment) paneObserver.observe(equipment);
    }

    wrap.querySelector('.armoury-pane').scrollTop = previousScroll;
    const itemCollection = wrap.querySelector('.armoury-item-collection');
    if (itemCollection) itemCollection.scrollTop = previousCollectionScroll;
    if (notice) toast.show(notice, panel); else toast.attach(panel);
    notice = '';
    wrap.querySelector('.armoury-close').addEventListener('click', leave);
  }

  // The removal moved INTO `close()` — see the block there. Leaving a copy here
  // would be two homes for one teardown, disagreeing on every path but this one.
  // The press is the Armoury's: say so, or the screen under it (the quest
  // board's Leave, input.js's [data-back] rule) hears the same Escape.
  const onKey = (e) => {
    if (e.key === 'Escape' && !e.defaultPrevented && [...document.querySelectorAll('.modal-veil')].at(-1) === wrap) {
      e.preventDefault();
      leave();
    }
  };
  document.addEventListener('keydown', onKey);

  // A destination lands on the page that holds it, with focus on the tab that
  // names that page; a region (or the equipment slots) is scrolled into view.
  const focusArmouryDestination = () => {
    if (!destinationPlan || !wrap.isConnected) return;
    // The Deck door (key D, pad button 3) names `cards`. The deck gallery is not
    // on this screen any more; the Deck tab owns it (the editor, or its refusal).
    if (destinationPlan.view === 'cards') { wrap.querySelector('.armoury-head [data-modal-tab="deck"]')?.click(); return; }
    const tab = wrap.querySelector(`.armoury-head [data-modal-tab="${view === 'grid' ? 'character' : 'armory'}"]`);
    const region = destinationPlan.region ? wrap.querySelector(`[data-fold="${destinationPlan.region}"]`) : null;
    const scrollTo = region || (destinationPlan.view === 'rack' ? wrap.querySelector('.armoury-body') : null);
    (region || tab)?.focus({ preventScroll: true });
    scrollTo?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };

  draw();
  if (destinationPlan) queueMicrotask(focusArmouryDestination);
  // A shop purchase's "Equip" (owner, 2026-11-05) enters the same inventory equip flow the row's Equip button does.
  if (equipItemId) {
    const row = inventoryRows(registries, run, meta).find(candidate => candidate.id === equipItemId);
    if (row?.item) queueMicrotask(() => { if (wrap.isConnected) beginInventoryEquip(row, null); });
  }
  return { close, redraw: draw };
}
import { equipmentAnimationForLoadout } from '../../model/equipmentAnimation.js';
