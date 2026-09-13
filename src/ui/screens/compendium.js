// src/ui/screens/compendium.js — the Compendium: everything the Spire keeps.
//
// Constantine, verbatim: *"the potential weapons to unlock should be in its own
// menu on the main menu that keeps most things hidden."*
//
// THE LAST CLAUSE IS THE DESIGN, not decoration. This is a screen whose subject
// is the shape of what you do NOT have, and the honest failure modes sit either
// side of it: show everything and the surprise of finding a Twinblade is spent
// in a menu on turn one; show nothing and it is an empty room with a title. So
// the line, and it is one sentence:
//
//     A LOCKED ENTRY GIVES YOU ITS SHAPE AND ITS RARITY AND NOTHING ELSE.
//
// Shape is enough to want it. A name and a stat line is the item delivered
// without the climb. The silhouette is the piece's OWN icon painted to black —
// no second asset, no new column, nothing for an author to draw twice (Law 1
// clause 4: assets bind by name, and this binds to the same name).
//
// ---- AND THE ASSET SET CANNOT HONOUR THAT PROMISE FIVE TIMES ----------------
//
// Freja's own finding against her own screen, measured AT THE 68 px BOX THE GAME
// ACTUALLY PAINTS rather than at native size — which is the half that matters,
// and the half a native-size measurement had already missed. Carried into the
// merge by Viki because a promise this file cannot keep is a claim, not a bug
// report, and the claim is the thing I own:
//
//   24 icons -> 21 DISTINCT silhouettes at 68 px. Two collision groups.
//   buckler == roundShield == spikedShield   one drawing. A REDRAW.
//   ashStaff  vs boneSceptre                 15 differing px at 224, ZERO at
//                                            68. The BOX destroys a real
//                                            distinction — a different fix, and
//                                            nobody had named this one.
//
// SHARPEST, AND IT IS NOT A DEGRADED PROMISE BUT AN ABSENT ONE: `buckler` and
// `roundShield` share shape AND rarity. Two cells with NO distinguishing mark
// between them at all, stacked in the same column at 390. For that pair the
// sentence above delivers nothing.
//
// NEITHER FIX IS IN THIS FILE and neither is taken here: one is a redraw, one is
// a box size, and both are art direction. What is fixed here is the OVER-CLAIM —
// this header stated a property of the asset set that five cells do not have.
//
// ---- WHY IT IS NOT ORGANISED BY WHAT YOU HAVE -------------------------------
//
// The obvious build is two bands: YOURS, then the rest. I refused it. Two bands
// makes the screen's shape a function of your progress — on a fresh profile band
// one is empty and the whole page is a list of things you failed to get, and
// every find reflows the grid under you.
//
// So the structure is the COLLECTION's shape and it never moves: one section per
// armament kind, in the order the table declares them, every cell always in the
// same place. What changes is how much of it is LIT. In a palette this dark,
// LIGHT IS THE HIERARCHY — the eye lands on what is yours because it is the only
// bright thing in the grid, and I do not have to reorder anything to put it
// first. A constant grid that fills in reads as a map of what exists; a
// re-sorting list reads as a scoreboard.
//
// ON THE KIT, AS WIREFRAME W1f: a W1 workspace standing on the page. The head
// is the title "Compendium" (the whole count as its eyebrow) with the close in
// the corner; the body is a NavRail — one RailItem per kind, its held count as
// StatusText — beside a Pane split into the entry list (a grid of OptionCards)
// and the selected entry's known facts; the foot is the one Back action. On a
// compact host the rail becomes one `[Kind ▾]` selector above the pane and the
// two slots stack (components/w1Workspace.js). Each card is the kit's
// OptionCard with an ArtWell for its Glyph; a withheld piece is the `is-ghost`
// variant (dashed, the icon painted out, no name) and carries its rarity on
// the card's edge. The detail slot says exactly what the tooltip says, from
// models/CompendiumModel.js. The hooks tools read (`.compendium[data-surface]`,
// `.cp-cell`, `.cp-grid`, `.cp-scroll`, `#cp-back`) ride on kit parts and draw
// nothing.
//
// ---- WHAT AN AUTHOR WRITES, AND WHAT DERIVES (Law 0 clause 1) ---------------
//
// NOTHING. There is no compendium table and there must never be one. A row here
// IS a row of content/source/weapons.csv seen from another angle, and everything
// this screen draws comes off the characteristics already on it:
//
//   which section    `kind`            the section exists because a row is filed
//                                      under it — no authored list of sections
//   the silhouette   `id`              assets/equipment/icon_<id>.webp, the same
//                                      file the Armoury already binds by name
//   the rarity ring  `rarity`
//   is it yours      `unlock` + the found gate → ownership() in model/loadout.js
//   how much shows   that gate's reveal mode  → pieceReveal() in model/unlocks.js
//
// Two homes, and the split is the point (Viki, resolving the #90 merge): the
// first is a fact about your PROFILE, the second about the CATALOGUE ROW. This
// screen authors neither and asks both.
//
// A second list of unlockables would be the defect this house has spent two days
// killing, and it is the easiest one to commit here: this screen wants a table
// of "things to chase" so badly that writing one feels like the feature.
//
// ---- WHAT THIS SCREEN IS NOT ------------------------------------------------
//
// It is not the Armoury and it does not equip anything: it is reached from the
// title, where there is no run, no class, and therefore no armour — armour is
// `classId`-scoped and has no subject outside a run. THAT IS WHY THE SCREEN IS
// ARMAMENTS ONLY, and the reason is where he put it, not my taste.
//
// ~~Armour's unlocks are already visible, with their hints, in the Armoury
// picker.~~ STRUCK BY THE MERGE, not by its author (Viki). That was true at
// 77a02b9 and #90 falsified it underneath this branch: the picker now offers
// only what you own, so an unearned armour set is ABSENT there rather than
// locked-with-a-hint. Nine of twelve armour rows carry an unlock, and as of dev
// no screen in the game says they exist — `unlockView()` below, whose whole job
// is "what the wardrobe should draw", has ZERO callers in src/ at every ref I
// checked (77a02b9, e79e1cd, 52e0bc1).
//
// THE HOLE IS #90'S, NOT THIS SCREEN'S, and this branch neither opens nor closes
// it. Recorded here because the sentence it replaces gave a REASON for excluding
// armour, and that reason has expired: whether armour joins this screen is a
// design call for Freja and Constantine ("weapons" was his word), not a
// resolution I take while merging someone else's branch. The rail is where a
// further category (armour, cards, relics, flasks) would join: one RailItem,
// one pane of the same OptionCards.
//
// LAW 3: the rail switches SECTION (kit §03 RailItem), not tabs — the bumpers
// stay with whatever owns them. Every cell is a control and carries a tooltip
// for hover AND the focus cursor (clause 4), which is also where a locked
// cell's reason lives: printing "not yet found" twenty three times IS the wall
// of grey, and the wall is the thing to avoid.
//
// TWO OPEN, NEITHER THIS BRANCH'S AND NEITHER FIXED HERE (Freja, carried by Viki
// so the next reader does not rediscover them):
//
//   THE TAP PATH IS WRONG, on the screen whose whole payload is the tooltip. It
//   shows under the finger with `afterRelease: null`, and the 24 <button>s below
//   carry NO click handler at all. That is component behaviour and it is already
//   on dev — `showTooltipAt()` exists, one handler closes it, and it is hers.
//
//   GOLD MEANS TWO THINGS ON ONE GRID — *rare* and *yours*. Her palette, and
//   Sunna's floor the moment it costs the read.

import { esc, attachTooltip } from '../components/tooltip.js';
import { assetUrl } from '../assetmap.js';
import { pieceReveal } from '../../model/unlocks.js';
import { ownership, modEffectLine } from '../../model/loadout.js';
import { LOCK_COPY, armamentKindLabel } from '../uiContent.js';
import { t } from '../strings.js';
import { compendiumView, entryDetail } from '../models/CompendiumModel.js';
import { workspaceFrame, categoryNav, markCurrent, land } from '../components/w1Workspace.js';
import {
  el, railed, railItem, pane, optionCard, options, artWell, button, statusText, detailCard, pageDoor, prose,
} from '../kit/index.js';

/** A piece's mods, written the way a player reads them. The second regex over
 *  the mod vocabulary lived here; the sentence is loadout.js's now, so this is
 *  the walk over the piece and nothing else. An unknown field no longer
 *  disappears — see modEffectLine for why that direction is the safe one. */
function modSummary(modFields, piece) {
  return (piece.mods || []).map((raw) => modEffectLine(modFields, raw));
}

// The sections, DERIVED, now in models/CompendiumModel.js (compendiumSections):
// a kind exists because a row is filed under it, in the order the table first
// mentions it — the same shape #88 gave settings categories. There is no list
// of sections to fall out of step with the table, so a new kind of armament
// appears here the day it is authored and an emptied kind takes its heading
// with it. A heading over nothing is the defect one level up from the fourth
// cell, and this is how it cannot happen.

function cell(piece, { state, hint, gate }, modFields, tags = []) {
  const held = state === 'held';
  const named = held || state === 'listed';
  // A held piece is announced by name; a withheld one is announced as what it
  // is, which is a shape you do not have. Screen readers get the same deal the
  // eye does — the alternative is an accessible label that leaks every name the
  // picture is deliberately hiding.
  const unknown = t('compendium.unknown', { kind: piece.kind });
  const card = optionCard({
    name: named ? piece.name : unknown,
    meta: `${piece.rarity || 'common'} · ${piece.hand} hand`,
    arrow: false,
    className: `cp-cell rarity-${piece.rarity || 'common'} state-${state}${held ? '' : ' is-ghost'}`,
    attrs: {
      'aria-label': named ? piece.name : unknown,
      dataset: { member: piece.id, rarity: piece.rarity || 'common', state },
    },
  });
  const art = artWell({ src: assetUrl(`assets/equipment/icon_${piece.id}.webp`), alt: '', small: true });
  art.querySelector('img').addEventListener('error', (e) => e.target.remove());
  card.insertBefore(art, card.firstChild);

  attachTooltip(card, () => {
    if (held) {
      const mods = modSummary(modFields, piece);
      return `<b>${esc(piece.name)}</b><br>${esc(piece.rarity)} · ${esc(piece.hand)} hand`
        + (mods.length ? `<p>${mods.map(esc).join(' · ')}</p>` : '')
        + ((piece.tags || []).length ? `<div class="inspection-tags">${piece.tags.map(id => {
          const tag = tags.find(row => row.id === id);
          return `<span class="inspection-tag" role="button" tabindex="0" data-tip="${esc(tag?.blurb || id)}">${esc(tag?.label || id)}</span>`;
        }).join('')}</div>` : '');
    }
    // WITHHELD, and the tooltip is held to the same line the picture is. It says
    // the rarity and the hand — which the edge and the section already say, so
    // it reveals nothing new — and then why it is not yours. It does NOT say the
    // name, the tags, the mods or the blurb, because a tooltip is not a loophole
    // in the design; it is the same decision at a different magnification.
    const head = named ? `<b>${esc(piece.name)}</b><br>` : '';
    return `${head}${esc(piece.rarity)} · ${esc(piece.hand)} hand<br><i>${esc(hint || LOCK_COPY[gate] || '')}</i>`;
  });
  return card;
}

/**
 * mountCompendium(app, { registries, meta, onBack })
 *
 * `meta.found` is the profile's permanent record of what it has ever held, and
 * off-run it is the whole of "yours" — there is no loadout to carry anything.
 * That makes this a PROFILE surface rather than a run surface, which is what
 * being on the title menu already meant.
 */
export function mountCompendium(app, { registries, meta = {}, onBack }) {
  const eq = registries.equipment || {};
  // WHAT IS YOURS IS NOT THIS SCREEN'S QUESTION (Viki, resolving the #90 merge).
  // This read `meta.found` directly and built its own unlocked/available sets —
  // a second definition of ownership, correct today and wrong the moment
  // `balance.equipment.persistence` is not 'both'. One home, asked here:
  // `loadout: null`, because off the title menu there is no run to carry
  // anything, and the model already knows what that means for each persistence.
  // Reading `registries.balance` rather than the imported module is the same
  // narrowing — it is the object `ownership()` itself was handed.
  const drops = (((registries.balance || {}).equipment || {}).drops) || {};
  const owned = ownership(registries, { meta, loadout: null });
  const unlockById = new Map((registries.unlocks || []).map((u) => [u.id, u]));

  // The drawn set, and the denominator comes FROM IT rather than from the table.
  // A 'hidden' piece is absent AND uncounted on purpose: "1 of 25" over
  // twenty-four cells is the count advertising the shape of the hole the
  // silhouettes were careful not to show. The two halves of one secret have to
  // agree, so only one of them is allowed to do the arithmetic.
  const drawn = [];
  for (const piece of eq.armaments || []) {
    const r = pieceReveal(piece, { owned, unlockById, drops });
    if (r.state === 'hidden') continue;
    drawn.push({ piece, r });
  }
  // The model derives the sections (see above) and adds the selection and the
  // counts, and nothing else. The heading words stay uiContent's.
  const labelOf = armamentKindLabel;
  const drawnEntries = drawn.map(({ piece, r }) => ({ piece, reveal: r }));
  let current = null;
  let selectedId = null;
  let view = compendiumView(drawnEntries, { labelOf });

  const items = view.categories.map((cat) => {
    const item = railItem({ label: cat.label, member: cat.kind, id: `cp-kind-${cat.kind}`, current: cat.selected, className: 'with-status cp-kind', attrs: { 'aria-controls': 'cp-panel' } });
    item.appendChild(statusText(`${cat.have}/${cat.total}`));
    return item;
  });
  const nav = categoryNav({
    items, ariaLabel: t('compendium.kinds'),
    choose: (kind) => { current = kind; selectedId = null; render(); },
  });
  const grid = options([], { class: 'grid cp-grid cp-scroll' });
  const detail = el('div', { class: 'cp-detail', 'aria-live': 'polite' });
  const panel = pane({
    children: el('div', { class: 'w1-split' }, [el('div', { class: 'cp-list' }, grid), detail]),
    attrs: { class: 'cp-pane', id: 'cp-panel', role: 'tabpanel' },
  });
  const back = button({ label: t('common.back'), role: 'exit', id: 'cp-back' });
  const door = workspaceFrame(pageDoor({
    eyebrow: t('compendium.eyebrow', { held: view.held, total: view.total }),
    title: t('compendium.title'),
    size: 'xl',
    body: railed(nav.node, panel),
    bodyClassName: 'compendium-body',
    primary: back,
    footSize: 'short',
    onClose: onBack,
    closeLabel: t('compendium.close'),
  }));

  // The selected entry's known facts: the tooltip's decision at a larger
  // magnification, never more than it.
  function paintDetail() {
    for (const node of grid.children) {
      const on = node.dataset.member === view.selected?.piece.id;
      node.classList.toggle('is-selected', on);
      node.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    if (!view.selected) { detail.replaceChildren(); return; }
    const { piece, reveal } = view.selected;
    const facts = entryDetail(piece, reveal, {
      modLines: reveal.state === 'held' ? modSummary(eq.modFields, piece) : [],
      tags: registries.tags || [],
      lockCopy: LOCK_COPY,
    });
    const art = artWell({ src: assetUrl(`assets/equipment/icon_${facts.id}.webp`), alt: '' });
    art.querySelector('img').addEventListener('error', (e) => e.target.remove());
    detail.dataset.state = facts.state;
    detail.dataset.rarity = facts.rarity;
    detail.replaceChildren(art, detailCard({
      eyebrow: `${facts.rarity} · ${facts.hand} hand`,
      name: facts.named ? facts.name : t('compendium.unknown', { kind: facts.kind }),
      line: facts.hint,
      children: [
        ...facts.mods.map((line) => prose(line, { class: 'cp-mod' })),
        facts.tags.length ? el('div', { class: 'inspection-tags' }, facts.tags.map((tag) => el('span', {
          class: 'inspection-tag', role: 'button', tabindex: '0', dataset: { tip: tag.blurb }, text: tag.label,
        }))) : null,
      ],
      attrs: { class: 'cp-detail-card' },
    }));
  }

  function render() {
    view = compendiumView(drawnEntries, { current, selectedId, labelOf });
    current = view.current;
    markCurrent(items, current);
    const cat = view.categories.find((c) => c.selected);
    nav.sync(cat ? `${cat.label} ${cat.have}/${cat.total}` : '');
    panel.setAttribute('aria-labelledby', `cp-kind-${current}`);
    grid.setAttribute('aria-label', cat ? cat.label : '');
    grid.replaceChildren(...view.entries.map(({ piece, reveal }) => {
      const node = cell(piece, reveal, eq.modFields, registries.tags);
      node.addEventListener('click', () => {
        selectedId = piece.id;
        view = compendiumView(drawnEntries, { current, selectedId, labelOf });
        paintDetail();
      });
      return node;
    }));
    paintDetail();
  }
  render();

  app.innerHTML = '';
  app.appendChild(el('div', { class: 'screen compendium', dataset: { surface: 'compendium' } }, door));
  back.addEventListener('click', onBack);
  // The keyboard and the pad start on the category navigation.
  land(nav.start());
}
