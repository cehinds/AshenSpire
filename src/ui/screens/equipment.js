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
  canSwap, cycleSet, equipPiece, fitsSlot, cardMods, runMods, loadoutTags, figureSpec, carriedIds,
} from '../../model/loadout.js';
import { renderCard } from '../components/card.js';
import { esc, attachTooltip } from '../components/tooltip.js';
import { refuses } from '../components/refusal.js';
import { playerSprite, equippedFigure } from '../assets.js';
import { assetUrl } from '../assetmap.js';
import { sfx } from '../sfx.js';

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
    id: 'cards',
    label: 'Cards',
    sel: '.armoury-strip',
    count: (el) => el.querySelectorAll('.equip-cards > .card').length,
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
 * choice, always, on every shape; otherwise the shape's default. The shape's
 * default for CONTEXT is *collapsed on a phone* — which is the honest form of
 * "which pane a phone opens on" once panes can fold.
 */
export function opensCollapsed(regionId, stored, narrow) {
  const s = stored && stored[regionId];
  if (typeof s === 'boolean') return s;
  return !!narrow;
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
    : assetUrl(`assets/equipment/icon_${piece.id}.webp`);
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

function pieceChip(registries, piece, { selected, locked, hint }) {
  const el = document.createElement('button');
  el.className = `equip-chip rarity-${piece.rarity || 'common'}${selected ? ' on' : ''}${locked ? ' locked' : ''}`;
  el.type = 'button';
  const mods = modSummary(registries, piece);
  el.innerHTML =
    `<img class="ec-art" src="${esc(thumbSrc(piece))}" alt="">` +
    `<span class="ec-name">${esc(piece.name)}</span>` +
    `<span class="ec-tags">${(piece.tags || []).map((t) => `<em>${esc(t)}</em>`).join('')}</span>` +
    `<span class="ec-mods">${mods.length ? mods.map(esc).join(' · ') : '—'}</span>` +
    (locked ? `<span class="ec-lock">🔒 ${esc(hint || 'Locked')}</span>` : '');
  const art = el.querySelector('.ec-art');
  art.addEventListener('error', () => art.remove());
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
  registries, run, meta = {}, inCombat = false, onClose, onChange, onSwap,
}) {
  const eq = registries.equipment;
  const cz = (meta.settings && meta.settings.customization) || run.customization || {};
  const unlocked = new Set(meta.unlocked || []);
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
  const folded = new Map(contextRegions().map((r) => [r.id, opensCollapsed(r.id, storedFolds, narrow)]));
  let picking = null; // { slotId, setIndex }
  let notice = ''; // a refusal to show in place, cleared on the next draw

  const wrap = document.createElement('div');
  wrap.className = 'armoury-overlay';
  host.appendChild(wrap);

  const close = () => {
    wrap.remove();
    if (onClose) onClose();
  };

  // A piece gated behind an unlock shows locked with that unlock's HINT — the
  // thing you'd have to do — rather than its flavour blurb. A 'hidden' unlock
  // drops out of the list entirely: a genuine secret should not advertise the
  // shape of its own hole.
  const unlockById = new Map((registries.unlocks || []).map((u) => [u.id, u]));
  // `persistence` decides what counts as yours: what this run has picked up,
  // what the profile has ever held, or both (the default — a climb that ends
  // badly still widens the wardrobe).
  const drops = CFG().drops || {};
  const persistence = CFG().persistence;
  const available = new Set([
    ...(persistence !== 'perRun' ? meta.found || [] : []),
    ...(persistence !== 'unlocked' ? carriedIds(run.loadout) : []),
  ]);
  function gate(piece) {
    // Two independent gates. A CONDITION unlock is something you achieve; being
    // FOUND is something you pick up. Armour uses the first, armaments the
    // second, and a piece could one day use both.
    if (piece.unlock !== '' && !unlocked.has(piece.unlock)) {
      const u = unlockById.get(piece.unlock);
      if (u && u.reveal === 'hidden') return null;
      return { ...piece, locked: true, hint: (u && u.hint) || 'Not yet earned.' };
    }
    if (piece.kind !== 'armor' && drops.requireFound && !available.has(piece.id)) {
      return { ...piece, locked: true, hint: 'Not yet found. Armaments turn up in treasure, and on the bodies of things that owned them.' };
    }
    return { ...piece, locked: false };
  }

  function eligible(slot) {
    // fitsSlot is the model's gate, and the same one equipPiece enforces — the
    // picker must never offer a piece the mutation will refuse.
    const pool = slot.kinds.includes('armor')
      ? (eq.armour || []).filter((o) => o.classId === run.class && fitsSlot(slot, o))
      : (eq.armaments || []).filter((a) => fitsSlot(slot, a));
    return pool.map(gate).filter(Boolean);
  }

  function slotBlock(slot) {
    const box = document.createElement('div');
    box.className = 'equip-slot';
    const rule = canSwap(registries, slot.id, { inCombat });
    box.innerHTML =
      `<div class="es-head"><span class="es-label">${esc(slot.label)}</span>` +
      (rule.ok ? '' : `<span class="es-sealed" title="${esc(rule.reason)}">sealed</span>`) +
      `</div><div class="es-sets"></div>`;
    const sets = box.querySelector('.es-sets');

    (run.loadout.sets[slot.id] || []).forEach((itemId, i) => {
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
          cycleSet(run.loadout, slot.id, i);
          sfx.play('cardPlay');
          commit();
        } else if (!inCombat) {
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
      box.innerHTML = inCombat
        ? '<p class="ep-hint">Storage is sealed in combat. Cycle between the sets you brought.</p>'
        : '<p class="ep-hint">Pick a slot above to change what is in it.</p>';
      return box;
    }
    const slot = eq.slots.find((s) => s.id === picking.slotId);
    box.innerHTML = `<h4>${esc(slot.label)} · set ${picking.setIndex + 1}</h4><div class="ep-list"></div>`;
    const list = box.querySelector('.ep-list');

    const bare = document.createElement('button');
    bare.type = 'button';
    bare.className = 'equip-chip bare';
    bare.innerHTML = '<span class="ec-name">Bare</span><span class="ec-mods">Nothing at all</span>';
    bare.addEventListener('click', () => {
      equipPiece(registries, run.loadout, picking.slotId, picking.setIndex, null);
      commit();
    });
    list.appendChild(bare);

    const current = (run.loadout.sets[picking.slotId] || [])[picking.setIndex];
    for (const piece of eligible(slot)) {
      const chip = pieceChip(registries, piece, {
        selected: piece.id === current,
        locked: piece.locked,
        hint: piece.hint,
      });
      if (piece.locked) {
        // The reason travels WITH the mark (components/refusal.js). This chip
        // used to get no handler at all: a tap on a weapon the player can see
        // did nothing and said nothing, and its `🔒` line is below the fold on a
        // phone with sixteen of these in the list.
        refuses(chip, () => piece.hint);
      } else {
        chip.addEventListener('click', () => {
          equipPiece(registries, run.loadout, picking.slotId, picking.setIndex, piece.id);
          sfx.play('cardPlay');
          commit();
        });
      }
      list.appendChild(chip);
    }
    return box;
  }

  /** The rewrites, live: the actual cards this loadout produces right now. */
  function cardStrip() {
    const box = document.createElement('div');
    box.className = 'equip-cards';
    const mods = cardMods(registries, run.loadout, run.class);
    const ids = [...new Set((eq.targets || [])
      .filter((t) => t.classId === '*' || t.classId === run.class)
      .map((t) => t.cardId))];
    for (const cardId of ids) {
      if (!registries.cards.has(cardId)) continue;
      box.appendChild(renderCard(registries, { cardId, mods: mods.get(cardId) }, { small: true }));
    }
    const rm = runMods(registries, run.loadout, run.class);
    const bits = [];
    if (rm.maxHp) bits.push(`Max HP ${rm.maxHp > 0 ? '+' : ''}${rm.maxHp}`);
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

  function commit() {
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
        <div class="armoury-strip"></div>
      </div>`;

    const left = wrap.querySelector('.armoury-left');
    const right = wrap.querySelector('.armoury-right');
    const blocks = eq.slots
      // A slot with nothing that fits it isn't a slot yet: Talisman is declared
      // in equipSlots.csv but has no pieces authored, and three empty squares
      // read as broken rather than as a promise. It appears the day a talisman
      // row exists.
      .filter((slot) => eligible(slot).length)
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

  const onKey = (e) => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);

  draw();
  return { close, redraw: draw };
}
